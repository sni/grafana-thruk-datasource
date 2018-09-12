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
    var path = query.table.replace(/^\//, '');
    if(query.columns[0] != "time") {
      throw new Error("query syntax error, first column must be 'time' for annotations.");
    }
    var params = {
      columns: query.columns
    };
    if(query.where) {
      query.where += " AND ";
    }
    query.where += " time > "+Math.floor(options.range.from.toDate().getTime()/1000);
    query.where += " AND time < "+Math.floor(options.range.to.toDate().getTime()/1000);
    params.q = query.where;

    var requestOptions = this._requestOptions({
      url: this.url + '/r/v1/'+path,
      method: 'GET',
      params: params,
    });
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
      })
      .catch(this.handleQueryError.bind(this));
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
    return this.backendSrv.datasourceRequest(requestOptions)
      .then(result => {
        return _.map(result.data, (d, i) => {
          return { text: Object.values(d).join(';'), value: Object.values(d).join(';') };
        });
      })
      .catch(this.handleQueryError.bind(this));
  }

  query(options) {
    var This = this;
    // we can only handle a single query right now
    for(var x=0; x<options.targets.length; x++) {
      var table = new TableModel();
      var target = options.targets[x];
      var path = target.table
      var hasColumns = false;
      var params = {};

      if(!path) {
        return(This.$q.when([]));
      }
      path = path.replace(/^\//, '');

      if(!target.columns) { target.columns = []; }
      if(target.columns[0] == '*') {
        target.columns.shift();
      }
      if(target.columns.length > 0) {
        params.columns = target.columns.join(',');
        target.columns.forEach(col => {
          This._addColumn(table, col);
        });
        hasColumns = true;
      }
      if(target.condition) {
        params.q = this.templateSrv.replace(target.condition, null, 'glob')
      }
      if(target.limit) {
        params.limit = target.limit;
      }
      var requestOptions = This._requestOptions({
        url: This.url + '/r/v1/'+path,
        method: 'GET',
        params: params,
      });
      return This.backendSrv.datasourceRequest(requestOptions).then(function(result) {
        // extract columns from first result row unless specified
        if(!hasColumns && result.data[0]) {
          Object.keys(result.data[0]).forEach(col => {
            This._addColumn(table, col);
          });
        }
        // add data rows
        _.map(result.data, (d, i) => {
          var row = [];
          table.columns.forEach(col => {
            if(col.type == "time") {
              row.push(d[col.text] * 1000);
            } else {
              row.push(d[col.text]);
            }
          });
          table.rows.push(row);
        });
        return({
          data: [
            table
          ]
        });
      })
      .catch(this.handleQueryError.bind(this));
    }
  }

  _addColumn(table, col) {
    if(col.match(/^(last_|next_|time)/)) {
      table.addColumn({ text: col, type: 'time' });
    } else {
      table.addColumn({ text: col });
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
    query = this.templateSrv.replace(query, null, 'glob')
    var tmp = query.match(/^\s*SELECT\s+([\w_,\ ]+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*))(|\s+LIMIT\s+(\d+))$/i);
    if(!tmp) {
      throw new Error("query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>] [LIMIT <limi>]");
    }
    return({
      columns: tmp[1].replace(/\s+/g, ''),
      table:   tmp[2],
      where:   tmp[4],
      limit:   tmp[6],
    });
  }

  handleQueryError(err) {
    console.log(err);
    if(err.data.code && err.data.code > 400) {
      var error = "query error: "+err.data.message;
      if(err.data.description) {
        error += " - "+err.data.description;
      }
      throw new Error(error);
    }
    return [];
  }
}
