import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { ThrukQuery, ThrukDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, ThrukQuery, ThrukDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
