import { DataSourceJsonData, FieldSchema } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface ThrukQuery extends DataQuery {
  table: string;
  columns: string[]; // raw string columns
  condition: string;
  limit: number;
  type: 'table' | 'graph' | 'logs' | 'timeseries';

  // In wrapped_json mode, the result looks like this
  /*
  {
    "data" : [
      {
        "col1" : string1
        "col2" : bool2
        "col3" : ["string3_1","string3_2"]
      }
    ],
    "meta" : {
      "columns" : [
        {"name" : "col1"},
        {"name" : "col2"},
        {"name" : "col10" , "type" : "time" }
        {"name" : "col11" , "config": { "unit" : "s" }, "type" : "number" },
      ]
    }
  }
  */
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
  columns: string[]; // raw string columns in the query
  fields: FieldSchema[]; // fieldSchema stores information about the column required by grafana api
  hasColumns: boolean;
  hasStats: boolean;
}

export interface ThrukColumnMeta {
  columns: ThrukColumnMetaColumn[];
}

export interface ThrukColumnMetaColumn {
  name: string;
  type: string;
  config: any;
}
