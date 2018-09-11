import _ from "lodash";
import TableModel from 'app/core/table_model';

export class ThrukDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.url = instanceSettings.url;
    this.withCredentials = instanceSettings.withCredentials;
    this.basicAuth = instanceSettings.basicAuth;
  }

  testDatasource() {
    var requestOptions = this._requestOptions({
      url: this.url + '/r/v1/',
      method: 'GET'
    });
    return this.backendSrv.datasourceRequest(requestOptions)
      .then(response => {
        if (response.status === 200) {
          return { status: "success", message: "Data source is working", title: "Success" };
        }
      });
  }

  annotationQuery(options) {
    var query = this.parseQuery(options.annotation.query);
    if(query.table == 'logs' || query.table == '/logs') {
      query.columns = "time,message,type";
    }
    var path = query.table+"?columns="+query.columns;
    if(query.where) {
      query.where += " AND ";
    }
    query.where += " time > "+Math.floor(options.range.from.toDate().getTime()/1000);
    query.where += " AND time < "+Math.floor(options.range.to.toDate().getTime()/1000);
    if(query.where) {
      path += '&q='+encodeURIComponent(query.where)
    }

    var requestOptions = this._requestOptions({
      url: this.url + '/r/v1/'+path,
      method: 'GET'
    });
    // TODO: catch wrong column or other rest api errors
    return this.backendSrv.datasourceRequest(requestOptions)
      .then(result => {
        return _.map(result.data, (d, i) => {
          return {
            "annotation": options.annotation,
            "title": d['type'],
            "time": d['time']*1000,
            "text": d['message'].replace(/^\[\d+\]\s+/, '').replace(/^[^:]+:\s+/, ''),
            "tags": d['type'],
          };
        });
      });
  }

  metricFindQuery(options) {
    var query = this.parseQuery(options);
    var path = query.table+"?columns="+query.columns;
    if(query.where) {
      path += '&q='+encodeURIComponent(query.where)
    }
    var requestOptions = this._requestOptions({
      url: this.url + '/r/v1/'+path,
      method: 'GET',
    });
    // TODO: catch wrong column or other rest api errors
    return this.backendSrv.datasourceRequest(requestOptions)
      .then(result => {
        return _.map(result.data, (d, i) => {
          return { text: Object.values(d).join(';'), value: Object.values(d).join(';') };
        });
      });
  }

  query(options) {
    // we can only handle a single query right now
    for(var x=0; x<options.targets.length; x++) {
      var table = new TableModel();
      var target = options.targets[x];
      var path = target.table
      if(target.columns && target.columns != '*') {
        path += "?columns="+target.columns;
        target.columns.split(/\s*,\s*/).forEach(col => {
          table.addColumn({ text: col });
        });
      }
      if(target.condition) {
        path += '&q='+encodeURIComponent(target.condition)
      }
      var requestOptions = this._requestOptions({
        url: this.url + '/r/v1/'+path,
        method: 'GET',
      });
      return this.backendSrv.datasourceRequest(requestOptions).then(function(result) {
        _.map(result.data, (d, i) => {
          table.rows.push(Object.values(d));
        });
        if(!(target.columns && target.columns != '*') && result.data[0]) {
          Object.keys(result.data[0]).forEach(col => {
            table.addColumn({ text: col });
          });
        }
        return({
          data: [
            table
          ]
        });
      });
    }
  }

  _requestOptions(options) {
    options = options || {};
    options.headers = options.headers || {};
    if(this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if(this.basicAuth) {
      options.headers.Authorization = this.basicAuth;
    }
    options.headers['Content-Type'] = 'application/json';
    return(options);
  }

  parseQuery(query) {
    query = this.templateSrv.replace(query, null, 'regex')
    // TODO: support sort and limit
    var tmp = query.match(/^\s*SELECT\s+([\w_,\ ]+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*))$/i);
    if(!tmp) {
      throw new Error("query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>]");
    }
    return({
      columns: tmp[1].replace(/\s+/g, ''),
      table:   tmp[2],
      where:   tmp[4],
    });
  }
}
