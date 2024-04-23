import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataSourceInstanceSettings,
  MetricFindValue,
  MutableDataFrame,
  FieldType,
  TimeRange,
  ScopedVars,
  FieldSchema,
  AnnotationQuery,
  FieldConfig,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, toDataQueryResponse, getTemplateSrv } from '@grafana/runtime';
import { lastValueFrom, Observable, throwError } from 'rxjs';

import { ThrukQuery, ThrukDataSourceOptions, defaultQuery, ThrukColumnConfig, ThrukColumnMetaColumn } from './types';
import { isNumber } from 'lodash';

export class DataSource extends DataSourceApi<ThrukQuery, ThrukDataSourceOptions> {
  url?: string;
  basicAuth?: string;
  withCredentials?: boolean;
  isProxyAccess: boolean;

  constructor(instanceSettings: DataSourceInstanceSettings<ThrukDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.url;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.isProxyAccess = instanceSettings.access === 'proxy';

    this.annotations = {
      prepareQuery(anno: AnnotationQuery<ThrukQuery>): ThrukQuery | undefined {
        let target = anno.target;
        return target;
      },
    };
  }

  async testDatasource() {
    let url = '/thruk?columns=thruk_version';
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

  // metricFindQuery gets called from variables page
  async metricFindQuery(query_string: string, options?: any): Promise<MetricFindValue[]> {
    if (query_string === '') {
      return [];
    }

    let query = this.parseVariableQuery(this.replaceVariables(query_string));

    return this.request(
      'GET',
      query.table +
        '?q=' +
        encodeURIComponent(query.condition || '') +
        '&columns=' +
        encodeURIComponent(query.columns.join(',')) +
        '&limit=' +
        encodeURIComponent(query.limit > 0 ? query.limit : '')
    ).then((response) => {
      let key = query.columns[0];
      return response.data.map((row: any) => {
        return { text: row[key], value: row[key] };
      });
    });
  }

  // standard dashboard queries / explorer
  async query(options: DataQueryRequest<ThrukQuery>): Promise<DataQueryResponse> {
    const templateSrv = getTemplateSrv();
    const data: DataQueryResponseData[] = [];

    // set defaults and replace template variables
    options.targets.map((target) => {
      target = defaults(target, defaultQuery);
      target.table = this.replaceVariables(target.table, undefined, options.scopedVars);
      target.limit = Number(templateSrv.replace(String(target.limit || '')));
    });

    options.targets = options.targets.filter((t) => !t.hide);
    options.targets = options.targets.filter((t) => t.table); /* hide queries without a table filter */

    if (options.targets.length <= 0) {
      return toDataQueryResponse({});
    }

    let queries: any[] = [];
    let columns: ThrukColumnConfig[] = [];

    options.targets.map((target) => {
      let col = this._buildColumns(target.columns);

      let path = target.table;
      path = path.replace(/^\//, '');
      path = this.replaceVariables(path, options.range, options.scopedVars);

      path = path + '?limit=' + encodeURIComponent(target.limit > 0 ? target.limit : '');
      if (col.hasColumns) {
        path = path + '&columns=' + encodeURIComponent(col.columns.join(','));
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

    options.targets.map((target, i: number) => {
      if (!target.result || !target.result.data) {
        throw new Error('Query failed, got no result data');
        return;
      }
      let meta = undefined;
      let metaColumns: Record<string, ThrukColumnMetaColumn> = {};
      if (!Array.isArray(target.result.data)) {
        if (target.result.data.data && target.result.data.meta) {
          meta = target.result.data.meta;
          target.result.data = target.result.data.data;
        }
        if (!Array.isArray(target.result.data)) {
          target.result.data = [target.result.data];
        }
      }
      let fields = columns[i].fields;
      if (meta && meta.columns) {
        meta.columns.forEach((column: ThrukColumnMetaColumn, i: number) => {
          metaColumns[column.name] = column;
          fields[i].name = column.name;
        });
      }
      if (!columns[i].hasColumns) {
        // extract columns from first result row if no columns given
        if (target.result && target.result.data && target.result.data.length > 0) {
          Object.keys(target.result.data[0]).forEach((key: string, i: number) => {
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
        this._fakeTimeseries(data, query, target.result.data as Array<{}>, options);
        return;
      }

      const frame = new MutableDataFrame({
        refId: query.refId,
        meta: {
          preferredVisualisationType: target.type,
        },
        fields: fields,
      });
      target.result.data.forEach((row: any, j: number) => {
        let dataRow: any[] = [];
        fields.forEach((f: FieldSchema, j: number) => {
          if (f.type === FieldType.time) {
            dataRow.push(row[f.name] * 1000);
          } else {
            dataRow.push(row[f.name]);
          }
        });
        frame.appendRow(dataRow);
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
      let ftype = FieldType.string;
      if (typeof type === 'string') {
        ftype = this.str2fieldtype(type);
      }
      return { name: key, type: ftype, config: config };
    }
    // seconds (from availabilty checks)
    if (key.match(/time_(down|up|unreachable|indeterminate|ok|warn|unknown|critical)/)) {
      return { name: key, type: FieldType.number, config: { unit: 's' } };
    }
    // timestamp fields
    if (key.match(/^(last_|next_|start_|end_|time)/)) {
      return { name: key, type: FieldType.time };
    }
    return { name: key, type: FieldType.string };
  }

  str2fieldtype(str: string): FieldType {
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
    str = templateSrv.replace(str, scopedVars, function (s: any) {
      if (s && Array.isArray(s)) {
        return '^(' + s.join('|') + ')$';
      }
      return s;
    });

    // replace time filter
    if (range) {
      let matches = str.match(/(\w+)\s*=\s*\$time/);
      if (matches && matches[1]) {
        let field = matches[1];
        let timefilter = '(' + field + ' > ' + Math.floor(range.from.toDate().getTime() / 1000);
        timefilter += ' AND ' + field + ' < ' + Math.floor(range.to.toDate().getTime() / 1000);
        timefilter += ')';
        str = str.replace(matches[0], timefilter);
      }
    }

    // fixup list regex filters
    let regex = new RegExp(/([\w_]+)\s*(>=|=)\s*"\^\((.*?)\)\$"/);
    let matches = str.match(regex);
    while (matches) {
      let groups: string[] = [];
      let segments = matches[3].split('|');
      segments.forEach((s) => {
        if (matches !== null) {
          groups.push(matches[1] + ' ' + matches[2] + ' "' + s + '"');
        }
      });
      str = str.replace(matches[0], '(' + groups.join(' OR ') + ')');
      matches = str.match(regex);
    }

    return str;
  }

  parseVariableQuery(query: string): ThrukQuery {
    let tmp = query.match(/^\s*SELECT\s+([\w_,\ ]+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*))(|\s+LIMIT\s+(\d+))$/i);
    if (!tmp) {
      throw new Error(
        'query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>] [LIMIT <limit>]'
      );
    }
    return {
      table: tmp[2],
      columns: tmp[1].replace(/\s+/g, '').split(','),
      condition: tmp[4],
      limit: tmp[6] ? Number(tmp[6]) : 0,
      type: 'table',
    } as ThrukQuery;
  }

  async request(method: string, url: string, data?: any, headers?: BackendSrvRequest['headers']): Promise<any> {
    try {
      let result = await lastValueFrom(this._request(method, url, data, headers));
      let resultData = result.data;
      if (!Array.isArray(resultData)) {
        if (resultData && resultData.data && resultData.meta) {
          resultData = resultData.data;
        }
      }

      // pass throught thruk errors
      if (resultData && resultData.message && resultData.code && resultData.code >= 400) {
        let description = resultData.description;
        if (description) {
          description = description.replace(/\s+at\s+.*\s+line\s+\d+\./, '');
        }
        throw new Error(resultData.code + ' ' + resultData.message + (description ? ' (' + description + ')' : ''));
      }
      return result;
    } catch (error: unknown) {
      console.error('failed to fetch ' + url);
      console.error(error);
      if (typeof error === 'string') {
        throw new Error(error);
      }
      if (error instanceof Error) {
        throw error;
      }

      let httpError = error as { status: number; statusText: string; data?: any };
      if (httpError.status) {
        let extra = '';
        if (httpError.data) {
          if (httpError.data.response) {
            let matches = httpError.data.response.match(/<h1>(.*?)<\/h1>/);
            if (matches[1] && matches[1] !== httpError.statusText) {
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

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = {
        Authorization: this.basicAuth,
      };
    }

    return getBackendSrv().fetch<any>(options);
  }

  _buildUrl(url: string): string {
    this.url = this.url?.replace(/\/$/, '');
    url = url.replace(/^\//, '');
    url = this.url + '/r/v1/' + url;
    return url;
  }

  _fixup_regex(value: any) {
    if (value === undefined || value == null) {
      return value;
    }
    let matches = value.match(/^\/?\^?\{(.*)\}\$?\/?$/);
    if (!matches) {
      return value;
    }
    let values = matches[1].split(/,/);
    for (let x = 0; x < values.length; x++) {
      values[x] = values[x].replace(/\//, '\\/');
    }
    return '/^(' + values.join('|') + ')$/';
  }

  _buildColumns(columns?: string[]): ThrukColumnConfig {
    let hasColumns = false;
    let hasStats = false;
    let newColumns: string[] = [];
    let fields: FieldSchema[] = [];

    if (!columns) {
      columns = [];
    }
    if (columns.length === 0 || (columns.length === 1 && columns[0] === '*')) {
      columns = [];
    }
    if (columns.length > 0) {
      columns.forEach((col) => {
        if (col.match(/^(.*)\(\)$/)) {
          hasStats = true;
          return false;
        }
        return true;
      });
      let op: string | undefined;
      columns.forEach((col) => {
        let matches = col.match(/^(.*)\(\)$/);
        if (matches && matches[1]) {
          op = matches[1];
        } else {
          if (op) {
            col = op + '(' + col + ')';
            op = undefined;
          }
          fields.push(this.buildField(col));
          newColumns.push(col);
        }
      });
      hasColumns = true;
    }
    return { columns: newColumns, fields: fields, hasColumns: hasColumns, hasStats: hasStats };
  }

  _fakeTimeseries(
    response: DataQueryResponseData[],
    target: ThrukQuery,
    data: any[],
    options: DataQueryRequest<ThrukQuery>
  ) {
    let steps = 10;
    let from = options.range.from.unix();
    let to = options.range.to.unix();
    let step = Math.floor((to - from) / steps);

    if (data.length === 0) {
      return;
    }

    // convert single row results with multiple columns into usable data rows
    if (data.length === 1 && Object.keys(data[0]).length > 2) {
      let converted: any[] = [];
      Object.keys(data[0]).forEach((key) => {
        converted.push([key, data[0][key]]);
      });
      data = converted;
    }

    let valueCol = '';
    let nameCol = '';
    // find first column using aggregation function and use this as value
    Object.keys(data[0]).forEach((key) => {
      if (key.match(/^\w+\(.*\)$/)) {
        valueCol = key;
        return false;
      }
      return true;
    });

    // nothing found, use first column with a numeric value
    if (valueCol === '') {
      Object.keys(data[0]).forEach((key) => {
        if (isNumber(data[0][key])) {
          valueCol = key;
          return false;
        }
        return true;
      });
    }

    // use first available column if none set yet
    if (valueCol === '') {
      valueCol = Object.keys(data[0])[0];
    }

    // use first column which is not the value column as name, otherwise use name of value column
    if (Object.keys(data[0]).length > 1) {
      Object.keys(data[0]).forEach((key) => {
        if (key !== valueCol) {
          nameCol = key;
          return false;
        }
        return true;
      });
    }

    // create timeseries based on group by keys
    data.forEach((row) => {
      if (Object.keys(row).length > 2) {
        throw new Error('timeseries with more than 2 columns are not supported.');
      }
      let val = row[valueCol];
      let alias = nameCol !== '' ? row[nameCol] : valueCol;
      const frame = new MutableDataFrame({
        refId: target.refId,
        meta: {
          preferredVisualisationType: 'graph',
        },
        fields: [
          { name: 'time', type: FieldType.time },
          { name: alias, type: FieldType.number },
        ],
      });

      for (let y = 0; y < steps; y++) {
        let row: any = {
          time: (from + step * y) * 1000,
        };
        row[alias] = val;
        frame.add(row);
      }
      response.push(frame);
    });
  }
}
