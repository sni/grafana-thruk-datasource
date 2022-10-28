import { DataQuery, DataSourceJsonData, FieldSchema } from '@grafana/data';

export interface ThrukQuery extends DataQuery {
  table: string;
  columns: string[];
  condition: string;
  limit: number;
  type: 'table' | 'graph' | 'logs' | 'timeseries';

  result?: any;
}

export const defaultQuery: Partial<ThrukQuery> = {
  table: '/',
  columns: ['*'],
  condition: '',
  type: 'table',
};

export interface ThrukDataSourceOptions extends DataSourceJsonData {
  keepCookies?: string[];
}

export interface ThrukColumnConfig {
  columns: string[];
  fields: FieldSchema[];
  hasColumns: boolean;
  hasStats: boolean;
}
