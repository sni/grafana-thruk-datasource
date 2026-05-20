import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MetricFindValue,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { Observable, of } from 'rxjs';

import { ThrukQuery, ThrukDataSourceOptions, defaultQuery } from './types';

export const defaultLimit = 1000;

export class DataSource extends DataSourceWithBackend<ThrukQuery, ThrukDataSourceOptions> {
  url: string;

  constructor(instanceSettings: DataSourceInstanceSettings<ThrukDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url || '';
  }

  query(request: DataQueryRequest<ThrukQuery>): Observable<DataQueryResponse> {
    const templateSrv = getTemplateSrv();

    const targets = request.targets
      .filter((t) => !t.hide)
      .filter((t) => t.table)
      .map((target) => {
        target = defaults(target, defaultQuery);
        target.table = this.replaceVariables(target.table, undefined, request.scopedVars);
        target.limit = Number(templateSrv.replace(String(target.limit || defaultLimit)));
        if (target.condition) {
          target.condition = this.replaceVariables(target.condition, request.range, request.scopedVars);
        }
        return target;
      });

    if (targets.length === 0) {
      return of({ data: [] });
    }

    return super.query({ ...request, targets });
  }

  async metricFindQuery(query_string: string, _options?: any): Promise<MetricFindValue[]> {
    if (query_string === '') {
      return [];
    }

    const query = this.parseVariableQuery(this.replaceVariables(query_string));
    const url = this.replaceVariables(query.table);
    const params: Record<string, string> = {
      table: url,
      q: encodeURIComponent(this.replaceVariables(query.condition || '')),
      columns: encodeURIComponent(this.replaceVariables(query.columns.join(','))),
      limit: encodeURIComponent(this.replaceVariables((query.limit || defaultLimit).toString())),
    };

    try {
      const response = await this.getResource('variable-query', params);
      if (response && Array.isArray(response)) {
        const key = query.columns[0];
        return response.map((row: any) => ({
          text: row[key],
          value: row[key],
        }));
      }
      return [];
    } catch (err) {
      console.warn('metricFindQuery failed', err);
      return [];
    }
  }

  replaceVariables(str: string, range?: TimeRange, scopedVars?: ScopedVars) {
    const templateSrv = getTemplateSrv();
    str = templateSrv.replace(str, scopedVars, function (s: any) {
      if (s && Array.isArray(s)) {
        return '^(' + s.join('|') + ')$';
      }
      return s;
    });

    if (range) {
      const matches = str.match(/(\w+)\s*=\s*\$time/);
      if (matches && matches[1]) {
        const field = matches[1];
        let timeFilter = '(' + field + ' > ' + Math.floor(range.from.toDate().getTime() / 1000);
        timeFilter += ' AND ' + field + ' < ' + Math.floor(range.to.toDate().getTime() / 1000);
        timeFilter += ')';
        str = str.replace(matches[0], timeFilter);
      }
    }

    const regex = new RegExp(/([\w_]+)\s*(>=|=)\s*"\^\((.*?)\)\$"/);
    let matches = str.match(regex);
    while (matches) {
      const groups: string[] = [];
      const segments = matches[3].split('|');
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
    const tmp = query.match(/^\s*SELECT\s+(.+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*?))(|\s+LIMIT\s+(\d+))\s*$/i);
    if (!tmp) {
      throw new Error(
        'query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>] [LIMIT <limit>]'
      );
    }

    return {
      table: tmp[2],
      columns: [tmp[1]],
      condition: tmp[4],
      limit: Number(tmp[6] || defaultLimit),
      type: 'table',
    } as ThrukQuery;
  }
}
