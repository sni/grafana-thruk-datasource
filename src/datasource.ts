import { defaults, isNumber } from 'lodash';
import {
  createDataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataSourceInstanceSettings,
  MetricFindValue,
  FieldType,
  TimeRange,
  ScopedVars,
  FieldSchema,
  AnnotationQuery,
  FieldConfig,
  Field,
  DataFrame,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, toDataQueryResponse, getTemplateSrv } from '@grafana/runtime';
import { lastValueFrom, Observable, throwError } from 'rxjs';

import { ThrukQuery, ThrukDataSourceOptions, defaultQuery, ThrukColumnConfig, ThrukColumnMetaColumn } from './types';

export const defaultLimit = 1000;

export class DataSource extends DataSourceApi<ThrukQuery, ThrukDataSourceOptions> {
  url?: string;
  basicAuth?: string;
  withCredentials?: boolean;
  isProxyAccess: boolean;

  cachedColumns?: {
    url: string;
    columns: string[];
  };
  cachedTables?: string[];

  constructor(instanceSettings: DataSourceInstanceSettings<ThrukDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.url;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.isProxyAccess = instanceSettings.access === 'proxy';

    this.annotations = {
      prepareQuery(anno: AnnotationQuery<ThrukQuery>): ThrukQuery | undefined {
        const target = anno.target;
        return target;
      },
    };
  }

  // This function needs to be implemented to extend DataSourceApi
  async testDatasource() {
    const url = '/thruk?columns=thruk_version';
    return this.request('GET', url)
      .then((response) => {
        if (response.status === 200 && response.data.thruk_version) {
          return {
            status: 'success',
            message: 'Successfully connected to Thruk v' + response.data.thruk_version,
          };
        }
        return { status: 'error', message: 'invalid url, did not find thruk version in response.' };
      })
      .catch((err) => {
        return { status: 'error', message: 'Datasource error: ' + err.message };
      });
  }

  // This function can optionally be implemented to extend DataSourceApi
  // metricFindQuery gets called from variables page of a dashboard.
  // user needs to pick a variable from a dropdown list, and this populates the list.
  async metricFindQuery(query_string: string, options?: any): Promise<MetricFindValue[]> {
    if (query_string === '') {
      return [];
    }

    const query: ThrukQuery = this.parseVariableQuery(this.replaceVariables(query_string));
    let url: string = this.replaceVariables(query.table);
    url = this._appendUrlParam(url, 'q=' + encodeURIComponent(this.replaceVariables(query.condition || '')));
    url = this._appendUrlParam(url, 'columns=' + encodeURIComponent(this.replaceVariables(query.columns.join(','))));
    url = this._appendUrlParam(url, 'limit=' + encodeURIComponent(this.replaceVariables((query.limit || defaultLimit).toString())));

    return this.request('GET', url).then((response) => {
      const key = query.columns[0];
      return response.data.map((row: any) => {
        return { text: row[key], value: row[key] };
      });
    });
  }

  // This function needs to be implemented to extend DataSourceApi
  // standard dashboard queries / explorer
  async query(options: DataQueryRequest<ThrukQuery>): Promise<DataQueryResponse> {
    const templateSrv = getTemplateSrv();
    const data: DataQueryResponseData[] = [];

    // set defaults and replace template variables
    options.targets.map((target) => {
      defaults(target, defaultQuery);
      target.table = this.replaceVariables(target.table, undefined, options.scopedVars);
      target.limit = Number(templateSrv.replace(String(target.limit || defaultLimit)));
    });

    options.targets = options.targets.filter((t) => !t.hide);
    options.targets = options.targets.filter((t) => t.table); /* hide queries without a table filter */

    if (options.targets.length <= 0) {
      return toDataQueryResponse({});
    }

    const queries: Array<Promise<any>> = [];
    const columns: ThrukColumnConfig[] = [];

    options.targets.map((target) => {
      const col: ThrukColumnConfig = this._buildColumns(target.columns);

      let path = target.table;
      path = path.replace(/^\//, '');
      path = this.replaceVariables(path, options.range, options.scopedVars);

      path = this._appendUrlParam(
        path,
        'limit=' +
          encodeURIComponent(this.replaceVariables((target.limit > 0 ? target.limit : defaultLimit).toString()))
      );
      if (col.hasColumns) {
        path = path + '&columns=' + encodeURIComponent(this.replaceVariables(col.columns.join(',')));
      }
      if (target.condition) {
        path =
          path + '&q=' + encodeURIComponent(this.replaceVariables(target.condition, options.range, options.scopedVars));
      }

      queries.push(this.request('GET', path, null, { 'X-THRUK-OutputFormat': 'wrapped_json' }));
      columns.push(col);
    });

    await Promise.allSettled(queries).then((results) => {
      results.forEach((result, i) => {
        switch (result.status) {
          case 'rejected':
            throw new Error('failed to fetch data: ' + result.reason);
            break;
          case 'fulfilled':
            options.targets[i].result = result.value;
            break;
        }
      });
    });

    // one query can contain multiple targets
    options.targets.map((target, i: number) => {
      if (!target.result || !target.result.data) {
        throw new Error('Query failed, got no result data');
      }

      // target.result saves the response of the API
      // target.result.data may be an array or an separate object
      // organize them into target.result.data and meta
      let meta = undefined;
      if (!Array.isArray(target.result.data)) {
        if (target.result.data.data && target.result.data.meta) {
          meta = target.result.data.meta;
          target.result.data = target.result.data.data;
        }
        if (!Array.isArray(target.result.data)) {
          target.result.data = [target.result.data];
        }
      }

      // target.result.data is an array, each element is in form "columnName" : columnValue
      // target.result.meta is an object
      // target.result.meta.columns is an array, each element is an object with "name" attribute corresponding to columnName. These elements are of type ThrukColumnMetaColumn

      const metaColumns: Record<string, ThrukColumnMetaColumn> = {};
      if (meta && meta.columns) {
        meta.columns.forEach((column: ThrukColumnMetaColumn) => {
          metaColumns[column.name] = column;
        });
      }

      const fields = columns[i].fields;
      if (!columns[i].hasColumns) {
        // extract columns from first result row if no columns given
        if (target.result && target.result.data && target.result.data.length > 0) {
          Object.keys(target.result.data[0]).forEach((key: string) => {
            fields.push(
              this.buildField(
                metaColumns[key]?.name || key,
                metaColumns[key]?.type,
                metaColumns[key]?.config as FieldConfig
              )
            );
          });
        }
      }

      if (meta && meta.columns) {
        meta.columns.forEach((column: ThrukColumnMetaColumn) => {
          const field = fields.find((f: FieldSchema) => f.name === column.name);
          if (!field) {
            return;
          }
          if (column.type) {
            field.type = this.str2fieldType(column.type);
          }
          if (column.config) {
            field.config = column.config as FieldConfig;
          }
        });
      }

      fields.forEach((field: FieldSchema) => {
        if (!field.config) {
          field.config = {};
        }
        if (!field.config.custom) {
          field.config.custom = {};
        }
      });

      // adjust number / time field types
      if (target.result && target.result.data && target.result.data.length > 0) {
        fields.forEach((field: FieldSchema, i: number) => {
          if (fields[i].type !== FieldType.string) {
            return true;
          }
          if (isNumber(target.result.data[0][field.name])) {
            fields[i].type = FieldType.number;
          }
          return true;
        });
      }

      const query = defaults(target, defaultQuery);
      if (target.type === 'timeseries') {
        target.type = 'graph';
      }

      if (target.type === 'graph') {
        this._fakeTimeseries(data, query, target.result.data as Array<{}>, options, columns[i]);
        return;
      }

      const valueArrays: Record<string, any[]> = {};
      fields.forEach((f: FieldSchema) => {
        valueArrays[f.name] = [];
      });
      target.result.data.forEach((row: any) => {
        fields.forEach((f: FieldSchema) => {
          if (f.type === FieldType.time) {
            valueArrays[f.name].push(row[f.name] * 1000);
          } else {
            valueArrays[f.name].push(row[f.name]);
          }
        });
      });

      const frameFields: Array<Partial<Field>> = fields.map((f: FieldSchema) => ({
        name: f.name,
        type: f.type,
        config: f.config || { custom: {} },
        values: valueArrays[f.name],
      }));

      const frame: DataFrame = createDataFrame({
        refId: query.refId,
        meta: {
          preferredVisualisationType: target.type,
        },
        fields: frameFields,
      });
      data.push(frame);
    });

    return { data };
  }

  /**
   * Builds a FieldSchema object based on the provided key and optional type.
   *
   * @param {string} key - The name of the field.
   * @param {FieldType} [type] - The type of the field. If not provided, it will be inferred based on the key.
   * @return {FieldSchema} The built FieldSchema object.
   */
  buildField(key: string, type?: FieldType | string, config?: FieldConfig): FieldSchema {
    if (type !== undefined) {
      let fType = FieldType.string;
      if (typeof type === 'string') {
        fType = this.str2fieldType(type);
      }
      return { name: key, type: fType, config: { ...config, custom: config?.custom || {} } };
    }
    // seconds (from availability checks)
    if (key.match(/time_(down|up|unreachable|indeterminate|ok|warn|unknown|critical)/)) {
      return { name: key, type: FieldType.number, config: { unit: 's', custom: {} } };
    }
    // timestamp fields
    if (key.match(/^(last_|next_|start_|end_|time)/)) {
      return { name: key, type: FieldType.time };
    }
    return { name: key, type: FieldType.string };
  }

  str2fieldType(str: string): FieldType {
    switch (str) {
      case 'number':
        return FieldType.number;
      case 'time':
        return FieldType.time;
      case 'bool':
      case 'boolean':
        return FieldType.boolean;
    }
    return FieldType.string;
  }

  replaceVariables(str: string, range?: TimeRange, scopedVars?: ScopedVars) {
    const templateSrv = getTemplateSrv();
    let s = templateSrv.replace(str, scopedVars, function (v: any) {
      if (v && Array.isArray(v)) {
        return '^(' + v.join('|') + ')$';
      }
      return v;
    });

    // replace time filter
    if (range) {
      const matches = s.match(/(\w+)\s*=\s*\$time/);
      if (matches && matches[1]) {
        const field = matches[1];
        let timeFilter = '(' + field + ' >= ' + Math.floor(range.from.toDate().getTime() / 1000);
        timeFilter += ' AND ' + field + ' <= ' + Math.floor(range.to.toDate().getTime() / 1000);
        timeFilter += ')';
        s = s.replace(matches[0], timeFilter);
      }
    }

    // fixup list regex filters
    const regex = new RegExp(/([\w_]+)\s*(>=|=)\s*"\^\((.*?)\)\$"/);
    let matches = s.match(regex);
    while (matches) {
      const groups: string[] = [];
      const segments = matches[3].split('|');
      segments.forEach((seg) => {
        if (matches !== null) {
          groups.push(matches[1] + ' ' + matches[2] + ' "' + seg + '"');
        }
      });
      s = s.replace(matches[0], '(' + groups.join(' OR ') + ')');
      matches = s.match(regex);
    }

    return s;
  }

  parseVariableQuery(query: string): ThrukQuery {
    const tmp = query.match(/^\s*SELECT\s+(.+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*?))(|\s+LIMIT\s+(\d+))\s*$/i);
    if (!tmp) {
      throw new Error(
        'query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>] [LIMIT <limit>]'
      );
    }

    return {
      table: tmp[2],
      columns: tmp[1].split(',').map((c) => c.trim()),
      condition: tmp[4],
      limit: Number(tmp[6] || defaultLimit),
      type: 'table',
    } as ThrukQuery;
  }

  async request(method: string, url: string, data?: any, headers?: BackendSrvRequest['headers']): Promise<any> {
    try {
      const result = await lastValueFrom(this._request(method, url, data, headers));
      let resultData = result.data;
      if (!Array.isArray(resultData)) {
        if (resultData && resultData.data && resultData.meta) {
          resultData = resultData.data;
        }
      }

      // pass through thruk errors
      if (resultData && resultData.message && resultData.code && resultData.code >= 400) {
        let description = resultData.description;
        if (description) {
          description = description.replace(/\s+at\s+.*\s+line\s+\d+\./, '');
        }
        throw new Error(resultData.code + ' ' + resultData.message + (description ? ' (' + description + ')' : ''));
      }
      return result;
    } catch (error: unknown) {
      console.warn('failed to fetch ' + url);
      console.warn(error);
      if (typeof error === 'string') {
        throw new Error(error);
      }
      if (error instanceof Error) {
        throw error;
      }

      const httpError = error as { status: number; statusText: string; data?: any };
      if (httpError.status) {
        let extra = '';
        if (httpError.data) {
          if (httpError.data.response) {
            const matches = httpError.data.response.match(/<h1>(.*?)<\/h1>/);
            if (matches && matches[1] && matches[1] !== httpError.statusText) {
              extra = ' (' + matches[1] + ')';
            }
          }
          if (
            httpError.data.message &&
            httpError.data.message !== httpError.data.response &&
            httpError.data.message !== httpError.statusText
          ) {
            extra += ' ' + httpError.data.message;
          }
          if (httpError.data.description) {
            extra += ' (' + httpError.data.description + ')';
          }
        }
        throw new Error(httpError.status + ' ' + httpError.statusText + extra);
      }

      throw new Error('failed to fetch data, unknown error');
    }
  }

  _request(method: string, url: string, data?: any, headers?: BackendSrvRequest['headers']): Observable<any> {
    if (!this.isProxyAccess) {
      return throwError(
        () =>
          new Error('Browser access mode in the Thruk datasource is no longer available. Switch to server access mode.')
      );
    }

    const options: BackendSrvRequest = {
      url: this._buildUrl(url),
      method,
      data,
      headers,
    };

    if (this.basicAuth) {
      options.credentials = 'same-origin';
      options.headers = {
        ...(options.headers || {}),
        Authorization: this.basicAuth,
      };
    }

    return getBackendSrv().fetch<any>(options);
  }

  _buildUrl(url: string): string {
    this.url = this.url?.replace(/\/$/, '');
    const path = url.replace(/^\//, '');
    return this.url + '/r/v1/' + path;
  }

  // checks if url contains '?' to see if parameter part has started, and adds the parameter accordingly
  _appendUrlParam(url: string, param: string): string {
    if (url.match(/\?/)) {
      return url + '&' + param;
    }
    return url + '?' + param;
  }

  _buildColumns(columns?: string[]): ThrukColumnConfig {
    let hasColumns = false;
    const newColumns: string[] = [];
    const fields: FieldSchema[] = [];

    let cols: string[] = columns || [];
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '*')) {
      cols = [];
    }
    if (cols.length > 0) {
      let op: string | undefined;
      cols.forEach((col) => {
        const matches = col.match(/^(.*)\(\)$/);
        if (matches && matches[1]) {
          op = matches[1];
        } else {
          let c = col;
          if (op) {
            c = op + '(' + col + ')';
            op = undefined;
          }
          fields.push(this.buildField(c));
          newColumns.push(c);
        }
      });
      hasColumns = true;
    }
    return { columns: newColumns, fields: fields, hasColumns: hasColumns };
  }

  _fakeTimeseries(
    response: DataQueryResponseData[],
    target: ThrukQuery,
    data: any[],
    options: DataQueryRequest<ThrukQuery>,
    columns: ThrukColumnConfig
  ) {
    const steps = 10;
    const from = options.range.from.unix();
    const to = options.range.to.unix();
    const step = Math.floor((to - from) / steps);

    if (data.length === 0) {
      return;
    }

    let orderedColumns: string[] = Object.keys(data[0]);
    if (columns.columns.length > 0) {
      orderedColumns = columns.columns;
    }

    let rows: any[] = data;

    // convert single row results with multiple columns into usable data rows
    if (rows.length === 1 && orderedColumns.length > 2) {
      const converted: any[] = [];
      orderedColumns.forEach((key) => {
        converted.push([key, data[0][key]]);
      });
      rows = converted;
    }

    const valueCol: string[] = [];
    const nameCol: string[] = [];
    // find first column using aggregation function and use this as value
    orderedColumns.forEach((key) => {
      if (key.match(/^\w+\(.*\)$/)) {
        valueCol.push(key);
      }
    });

    // nothing found, use first column with a numeric value
    if (valueCol.length === 0) {
      orderedColumns.forEach((key) => {
        if (isNumber(data[0][key])) {
          valueCol.push(key);
        }
      });
    }

    // use first available column if none set yet
    if (valueCol.length === 0) {
      valueCol.push(orderedColumns[0]);
    }

    // name columns are all remaining columns not used as value
    orderedColumns.forEach((key) => {
      if (!valueCol.includes(key)) {
        nameCol.push(key);
      }
    });

    // create timeseries based on group by keys
    rows.forEach((row) => {
      const val = row[valueCol[0]];
      let names: string[] = [];
      if (nameCol.length === 0) {
        names = [valueCol[0]];
      } else {
        nameCol.forEach((key) => {
          names.push(row[key]);
        });
      }
      const alias = names.join(';');
      const timeValues: number[] = [];
      const valueValues: number[] = [];
      for (let y = 0; y < steps; y++) {
        timeValues.push((from + step * y) * 1000);
        valueValues.push(val);
      }
      const frame = createDataFrame({
        refId: target.refId,
        meta: {
          preferredVisualisationType: 'graph',
        },
        fields: [
          { name: 'time', type: FieldType.time, values: timeValues },
          { name: alias, type: FieldType.number, values: valueValues },
        ],
      });
      response.push(frame);
    });
  }
}
