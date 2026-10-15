import { DataSource } from 'datasource';
import { getTemplateSrv } from '@grafana/runtime';
import { DataFrame, DataQueryRequest, dateTime } from '@grafana/data';
import { ThrukQuery } from './types';

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
    const range = { from: dateTime(1700000000000), to: dateTime(1700003600000) };
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
});
