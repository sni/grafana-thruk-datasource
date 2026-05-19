import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSource } from 'datasource';
import { ThrukDataSourceOptions } from './types';

const mockSettings: DataSourceInstanceSettings<ThrukDataSourceOptions> = {
  id: 1,
  uid: 'test-uid',
  type: 'sni-thruk-datasource',
  name: 'thruk',
  url: 'https://thruk.example.com',
  access: 'proxy',
  jsonData: {},
  readOnly: false,
  meta: {} as any,
};

test('parse variables query', async () => {
  const ds = new DataSource(mockSettings);
  const result = await ds.parseVariableQuery('SELECT name from /hosts WHERE name like ^abc LIMIT 137');

  expect(result.table).toEqual('/hosts');
  expect(result.columns).toEqual(['name']);
  expect(result.condition).toEqual('name like ^abc');
  expect(result.limit).toEqual(137);
});
