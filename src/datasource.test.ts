import { DataSource } from 'datasource';
import { getTemplateSrv } from '@grafana/runtime';
import { DataFrame, DataQueryRequest, dateTime } from '@grafana/data';
import { ThrukQuery } from './types';
import { of, throwError } from 'rxjs';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(),
}));

test('single-row stats produce a named timeseries for each column', () => {
  const ds = new DataSource({} as any);
  const data: DataFrame[] = [];
  const row = { num_services_ok: 5, num_services_warn: 0, num_services_crit: 2 };
  ds._fakeTimeseries(
    data,
    { refId: 'A' } as ThrukQuery,
    [row],
    { range: { from: dateTime(1700000000000), to: dateTime(1700003600000) } } as DataQueryRequest<ThrukQuery>,
    ds._buildColumns(Object.keys(row))
  );

  expect(data).toHaveLength(3);
  data.forEach((frame, i) => {
    expect(frame.refId).toBe('A');
    expect(frame.fields[1].name).toBe(Object.keys(row)[i]);
    expect(frame.fields[1].values).toEqual(Array(10).fill(Object.values(row)[i]));
  });
});

describe('query', () => {
  beforeEach(() => {
    (getTemplateSrv as jest.Mock).mockReturnValue({ replace: (str: string) => str });
  });

  test('keeps unset timestamps empty and converts valid seconds to milliseconds', async () => {
    const ds = new DataSource({} as any);
    jest.spyOn(ds, 'request').mockResolvedValue({
      data: [0, null, undefined, 1700000000].map((next_check) => ({ next_check, state: 0 })),
    });
    const result = await ds.query({
      targets: [{ refId: 'A', table: '/hosts', type: 'table', columns: ['next_check', 'state'] }],
    } as unknown as DataQueryRequest<ThrukQuery>);
    const frame = result.data[0] as DataFrame;
    expect(frame.fields[0].values).toEqual([null, null, null, 1700000000000]);
    expect(frame.fields[1].values).toEqual([0, 0, 0, 0]);
  });

  test.each([['*'], ['label', 'count', 'checked']])(
    'builds a frame from wrapped_json with columns %j',
    async (...columns) => {
      const ds = new DataSource({} as any);
      const request = jest.spyOn(ds, 'request').mockResolvedValue({
        data: {
          data: [{ label: 'host1', count: 3, checked: 1700000000 }],
          meta: {
            columns: [
              { name: 'label', type: 'string' },
              { name: 'count', type: 'number', config: { unit: 'short' } },
              { name: 'checked', type: 'time' },
            ],
          },
        },
      });

      const result = await ds.query({
        targets: [{ refId: 'A', table: '/hosts', type: 'table', columns }],
      } as unknown as DataQueryRequest<ThrukQuery>);

      expect(request).toHaveBeenCalledWith('GET', expect.stringContaining('hosts?limit=1000'), null, {
        'X-THRUK-OutputFormat': 'wrapped_json',
      });
      expect(result.data).toHaveLength(1);
      const frame = result.data[0] as DataFrame;
      expect(frame.refId).toBe('A');
      expect(frame.meta?.preferredVisualisationType).toBe('table');
      expect(frame.fields.map(({ name, type, values }) => ({ name, type, values }))).toEqual([
        { name: 'label', type: 'string', values: ['host1'] },
        { name: 'count', type: 'number', values: [3] },
        { name: 'checked', type: 'time', values: [1700000000000] },
      ]);
      expect(frame.fields[1].config.unit).toBe('short');
    }
  );
});

describe('request error mapping', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('extracts useful details from an HTTP HTML error', async () => {
    const ds = new DataSource({} as any);
    jest.spyOn(ds, '_request').mockReturnValue(
      throwError(() => ({
        status: 502,
        statusText: 'Bad Gateway',
        data: { response: '<html><h1>Thruk unavailable</h1></html>', message: 'Proxy failed' },
      }))
    );
    await expect(ds.request('GET', '/hosts')).rejects.toThrow('502 Bad Gateway (Thruk unavailable) Proxy failed');
  });

  test('reports wrapped Thruk errors without Perl source locations', async () => {
    const ds = new DataSource({} as any);
    jest.spyOn(ds, '_request').mockReturnValue(
      of({
        data: {
          data: { code: 400, message: 'Invalid query', description: 'Unknown column at /thruk/query.pm line 42.' },
          meta: {},
        },
      })
    );
    await expect(ds.request('GET', '/hosts')).rejects.toThrow('400 Invalid query (Unknown column)');
  });
});

// test parsing variables query
test('parse variables query', async () => {
  const ds = new DataSource({} as any);
  const result = await ds.parseVariableQuery('SELECT name from /hosts WHERE name like ^abc LIMIT 137');

  expect(result.table).toEqual('/hosts');
  expect(result.columns).toEqual(['name']);
  expect(result.condition).toEqual('name like ^abc');
  expect(result.limit).toEqual(137);
});

describe('replaceVariables', () => {
  beforeEach(() => {
    (getTemplateSrv as jest.Mock).mockReturnValue({
      replace: (str: string) => str,
    });
  });

  test('returns template-replaced string when no range given', () => {
    const ds = new DataSource({} as any);
    expect(ds.replaceVariables('host = foo')).toEqual('host = foo');
  });

  test('replaces $time filter with range bounds', () => {
    const ds = new DataSource({} as any);
    const range = {
      from: { toDate: () => new Date(1700000000000) },
      to: { toDate: () => new Date(1700003600000) },
    } as any;
    expect(ds.replaceVariables('time = $time', range)).toEqual('(time >= 1700000000 AND time <= 1700003600)');
  });

  test('expands multi-value regex filter into OR clauses', () => {
    const ds = new DataSource({} as any);
    expect(ds.replaceVariables('host = "^(a|b)$"')).toEqual('(host = "a" OR host = "b")');
  });

  test('replaces every $time filter without changing longer variable names', () => {
    const ds = new DataSource({} as any);
    const range = {
      from: dateTime(1700000000000),
      to: dateTime(1700003600000),
      raw: { from: 'now-1h', to: 'now' },
    };
    expect(ds.replaceVariables('(start = $time AND end=$time) OR time = $timezone', range)).toBe(
      '((start >= 1700000000 AND start <= 1700003600) AND (end >= 1700000000 AND end <= 1700003600)) OR time = $timezone'
    );
  });

  test('uses array values from template service as regex alternation', () => {
    (getTemplateSrv as jest.Mock).mockReturnValue({
      replace: (str: string, _scopedVars: any, fn: (v: any) => any) => fn(['a', 'b']),
    });
    const ds = new DataSource({} as any);
    expect(ds.replaceVariables('$host')).toEqual('^(a|b)$');
  });
});

describe('_buildColumns', () => {
  const ds = new DataSource({} as any);

  test('no columns given', () => {
    const result = ds._buildColumns(undefined);
    expect(result.hasColumns).toBe(false);
    expect(result.columns).toEqual([]);
    expect(result.fields).toEqual([]);
  });

  test('wildcard only means no explicit columns', () => {
    const result = ds._buildColumns(['*']);
    expect(result.hasColumns).toBe(false);
    expect(result.columns).toEqual([]);
  });

  test('plain columns become fields', () => {
    const result = ds._buildColumns(['host', 'state']);
    expect(result.hasColumns).toBe(true);
    expect(result.columns).toEqual(['host', 'state']);
    expect(result.fields.map((f) => f.name)).toEqual(['host', 'state']);
  });

  test('aggregation operator applies to following column', () => {
    const result = ds._buildColumns(['avg()', 'duration']);
    expect(result.columns).toEqual(['avg(duration)']);
    expect(result.fields.map((f) => f.name)).toEqual(['avg(duration)']);
  });

  test('timestamp column gets time field type', () => {
    const result = ds._buildColumns(['last_check']);
    expect(result.fields[0].type).toBe('time');
  });
});

describe('metricFindQuery', () => {
  beforeEach(() => {
    (getTemplateSrv as jest.Mock).mockReturnValue({
      replace: (str: string) => str,
    });
  });

  test('uses the first column of the result rows as value', async () => {
    const ds = new DataSource({} as any);
    // the value key comes from the result, not the parsed query, so
    // expressions like concat(a, '-', b) as x work; non-string values are
    // coerced because grafana's toMetricFindValues only accepts
    // string/number/null
    (ds as any).request = jest.fn().mockResolvedValue({
      data: [{ id: 'abc-1' }, { id: 42 }, { id: null }, {}],
    });
    const result = await ds.metricFindQuery('SELECT concat(id, "-", name) as id FROM sites');
    expect(result).toEqual([
      { text: 'abc-1', value: 'abc-1' },
      { text: '42', value: '42' },
      { text: '', value: '' },
      { text: '', value: '' },
    ]);
  });

  test('returns no values for empty result', async () => {
    const ds = new DataSource({} as any);
    (ds as any).request = jest.fn().mockResolvedValue({ data: [] });
    const result = await ds.metricFindQuery('SELECT name FROM /hosts');
    expect(result).toEqual([]);
  });

  test('uses the dashboard range and scoped variables before building the URL', async () => {
    const ds = new DataSource({} as any);
    const scopedVars = { host: { text: 'server1', value: 'server1' } };
    const replace = jest.fn((str: string, vars: typeof scopedVars) => str.replace('$host', vars.host.value));
    (getTemplateSrv as jest.Mock).mockReturnValue({ replace });
    const request = jest.spyOn(ds, 'request').mockResolvedValue({ data: [] });

    await ds.metricFindQuery('SELECT message FROM /hosts/$host/alerts WHERE time = $time', {
      range: { from: dateTime(1700000000000), to: dateTime(1700003600000) },
      scopedVars,
    });

    expect(replace).toHaveBeenCalledWith(expect.any(String), scopedVars, expect.any(Function));
    const url = new URL(request.mock.calls[0][1], 'https://thruk.example');
    expect(url.pathname).toBe('/hosts/server1/alerts');
    expect(url.searchParams.get('q')).toBe('(time >= 1700000000 AND time <= 1700003600)');
    expect(url.searchParams.get('columns')).toBe('message');
    expect(url.searchParams.get('limit')).toBe('1000');
  });
});
