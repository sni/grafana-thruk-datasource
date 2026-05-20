import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface ThrukQuery extends DataQuery {
  table: string;
  columns: string[];
  condition: string;
  limit: number;
  type: 'table' | 'graph' | 'logs' | 'timeseries';
}

export const defaultQuery: Partial<ThrukQuery> = {
  table: '/',
  columns: ['*'],
  condition: '',
  type: 'table',
};

export interface ThrukDataSourceOptions extends DataSourceJsonData {
  keepCookies?: string[];
  logLevel?: number;
  logPath?: string;
}
