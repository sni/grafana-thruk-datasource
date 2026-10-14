import { DataSource } from 'datasource';
import { getTemplateSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(),
}));

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
