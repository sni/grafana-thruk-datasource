import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { ThrukQuery, ThrukDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, ThrukQuery, ThrukDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
