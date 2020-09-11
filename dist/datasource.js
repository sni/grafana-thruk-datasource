'use strict';

System.register(['lodash', 'app/core/table_model'], function (_export, _context) {
  "use strict";

  var _, TableModel, _createClass, ThrukDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreTable_model) {
      TableModel = _appCoreTable_model.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('ThrukDatasource', ThrukDatasource = function () {
        function ThrukDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, ThrukDatasource);

          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.url = instanceSettings.url;
          this.withCredentials = instanceSettings.withCredentials;
          this.basicAuth = instanceSettings.basicAuth;
          this.name = instanceSettings.name;
          this.id = instanceSettings.id;
        }

        // testDatasource is used on the datasource options page


        _createClass(ThrukDatasource, [{
          key: 'testDatasource',
          value: function testDatasource() {
            var requestOptions = this._requestOptions({
              url: this.url + '/r/v1/thruk?columns=rest_version',
              method: 'GET'
            });
            return this.backendSrv.datasourceRequest(requestOptions).then(function (response) {
              if (response.status === 200 && response.data && response.data.rest_version === 1) {
                return { status: "success", message: "Data source is working", title: "Success" };
              }
              if (response.status === 200 && response.data && response.data.match(/login\.cgi/)) {
                return { status: 'error', message: 'Data source connected, but no valid data received. Verify authorization.' };
              }
              return { status: 'error', message: response.status + " " + response.statusText };
            }).catch(function (err) {
              if (err.status && err.status >= 400) {
                return { status: 'error', message: 'Data source not connected: ' + err.status + ' ' + err.statusText };
              }
              return { status: 'error', message: err.message };
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var query = this._parseQuery(this._replaceVariables(options.annotation.query, options.range, options.scopedVars));
            var path = query.table.replace(/^\//, '');
            if (query.columns.split(/\s*,\s*/)[0] != "time") {
              throw new Error("query syntax error, first column must be 'time' for annotations.");
            }
            var params = {
              columns: query.columns
            };
            params.q = query.where;

            var requestOptions = this._requestOptions({
              url: this.url + '/r/v1/' + path,
              method: 'GET',
              params: params
            });
            return this.backendSrv.datasourceRequest(requestOptions).then(function (result) {
              return _.map(result.data, function (d, i) {
                return {
                  "annotation": options.annotation,
                  "title": d['type'],
                  "time": d['time'] * 1000,
                  "text": d['message'].replace(/^\[\d+\]\s+/, '').replace(/^[^:]+:\s+/, ''),
                  "tags": d['type']
                };
              });
            }).catch(this._handleQueryError.bind(this));
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(options) {
            var query = this._parseQuery(this._replaceVariables(options));
            var path = query.table + "?columns=" + query.columns;
            path = path.replace(/^\//, '');
            if (query.where) {
              path += '&q=' + encodeURIComponent(query.where);
            }
            var requestOptions = this._requestOptions({
              url: this.url + '/r/v1/' + path,
              method: 'GET'
            });
            return this.backendSrv.datasourceRequest(requestOptions).then(function (result) {
              return _.map(result.data, function (d, i) {
                return { text: Object.values(d).join(';'), value: Object.values(d).join(';') };
              });
            }).catch(this._handleQueryError.bind(this));
          }
        }, {
          key: 'query',
          value: function query(options) {
            var This = this;
            // we can only handle a single query right now
            for (var x = 0; x < options.targets.length; x++) {
              var table = new TableModel();
              var target = options.targets[x];
              var path = target.table;
              var hasColumns = false;
              var params = {};

              if (!path) {
                return This.q.when([]);
              }
              path = path.replace(/^\//, '');
              path = this._replaceVariables(path, options.range, options.scopedVars);

              if (!target.columns) {
                target.columns = [];
              }
              if (target.columns[0] == '*') {
                target.columns.shift();
              }
              var hasStats = false;
              if (target.columns.length > 0) {
                target.columns.forEach(function (col) {
                  if (col.match(/^(.*)\(\)$/)) {
                    hasStats = true;
                    return false;
                  }
                });
                params.columns = [];
                var op;
                target.columns.forEach(function (col) {
                  var matches = col.match(/^(.*)\(\)$/);
                  if (matches && matches[1]) {
                    op = matches[1];
                  } else {
                    if (op) {
                      col = op + '(' + col + ')';
                      op = undefined;
                    }
                    if (!hasStats) {
                      This._addColumn(table, col);
                    }
                    params.columns.push(col);
                  }
                });
                hasColumns = true;
              }
              if (target.condition) {
                params.q = this._replaceVariables(target.condition, options.range, options.scopedVars);
              }
              if (target.limit) {
                params.limit = target.limit;
              }
              var requestOptions = This._requestOptions({
                url: This.url + '/r/v1/' + path,
                method: 'GET',
                params: params
              });
              return This.backendSrv.datasourceRequest(requestOptions).then(function (result) {
                if (!angular.isArray(result.data)) {
                  result.data = [result.data];
                }
                // extract columns from first result row unless specified
                if ((!hasColumns || hasStats) && result.data[0]) {
                  Object.keys(result.data[0]).forEach(function (col) {
                    This._addColumn(table, col);
                  });
                }
                // add data rows
                _.map(result.data, function (d, i) {
                  var row = [];
                  table.columns.forEach(function (col) {
                    if (col.type == "time") {
                      row.push(d[col.text] * 1000);
                    } else {
                      row.push(d[col.text]);
                    }
                  });
                  table.rows.push(row);
                });
                if (target.type == "timeseries") {
                  return This._fakeTimeseries(table, target, options, hasStats);
                }
                return {
                  data: [table]
                };
              }).catch(this._handleQueryError.bind(this));
            }
          }
        }, {
          key: '_addColumn',
          value: function _addColumn(table, col) {
            if (col.match(/^(last_|next_|start_|end_|time)/)) {
              table.addColumn({ text: col, type: 'time' });
            } else {
              table.addColumn({ text: col });
            }
          }
        }, {
          key: '_requestOptions',
          value: function _requestOptions(options) {
            options = options || {};
            options.headers = options.headers || {};
            if (this.basicAuth || this.withCredentials) {
              options.withCredentials = true;
            }
            if (this.basicAuth) {
              options.headers.Authorization = this.basicAuth;
            }
            options.headers['Content-Type'] = 'application/json';
            return options;
          }
        }, {
          key: '_parseQuery',
          value: function _parseQuery(query) {
            var tmp = query.match(/^\s*SELECT\s+([\w_,\ ]+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*))(|\s+LIMIT\s+(\d+))$/i);
            if (!tmp) {
              throw new Error("query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>] [LIMIT <limi>]");
            }
            return {
              columns: tmp[1].replace(/\s+/g, ''),
              table: tmp[2],
              where: tmp[4],
              limit: tmp[6]
            };
          }
        }, {
          key: '_replaceVariables',
          value: function _replaceVariables(str, range, scopedVars) {
            str = this.templateSrv.replace(str, scopedVars, function (s) {
              if (s && angular.isArray(s)) {
                return "^(" + s.join('|') + ')$';
              }
              return s;
            });

            // replace time filter
            if (range) {
              var matches = str.match(/(\w+)\s*=\s*\$time/);
              if (matches && matches[1]) {
                var field = matches[1];
                var timefilter = "(" + field + " > " + Math.floor(range.from.toDate().getTime() / 1000);
                timefilter += " AND " + field + " < " + Math.floor(range.to.toDate().getTime() / 1000);
                timefilter += ")";
                str = str.replace(matches[0], timefilter);
              }
            }

            // fixup list regex filters
            var regex = new RegExp(/([\w_]+)\s*(>=|=)\s*"\^\((.*?)\)\$"/);
            var matches = str.match(regex);
            while (matches) {
              var groups = [];
              var segments = matches[3].split('|');
              segments.forEach(function (s) {
                groups.push(matches[1] + ' ' + matches[2] + ' "' + s + '"');
              });
              str = str.replace(matches[0], '(' + groups.join(' OR ') + ')');
              matches = str.match(regex);
            }

            return str;
          }
        }, {
          key: '_handleQueryError',
          value: function _handleQueryError(err) {
            console.log(err);
            if (err.data && err.data.code && err.data.code >= 400) {
              var error = "query error: " + err.data.message;
              if (err.data.description) {
                error += " - " + err.data.description;
              }
              throw new Error(error);
            }
            if (err.status && err.status > 400) {
              throw new Error("query error: " + err.status + " - " + err.statusText);
            }
            throw new Error(err);
            return [];
          }
        }, {
          key: '_fakeTimeseries',
          value: function _fakeTimeseries(table, target, options, hasStats) {
            var data = { data: [] };
            var steps = 10;
            var from = options.range.from.unix();
            var to = options.range.to.unix();
            var step = Math.floor((to - from) / steps);

            // create timeseries based on group by keys
            if (table.rows.length > 1 || hasStats && table.columnMap[":KEY"]) {
              var keyIndex = 0;
              var x = 0;
              table.columns.forEach(function (col) {
                if (col.text == ':KEY') {
                  keyIndex = x;
                  return false;
                }
                x++;
              });
              table.rows.forEach(function (row) {
                var datapoints = [];
                var alias = row[keyIndex];
                var val = row[1];
                if (row.length > 2) {
                  throw new Error("timeseries from grouped stats queries with more than 2 columns are not supported.");
                }
                for (var y = 0; y < steps; y++) {
                  datapoints.push([val, (from + step * y) * 1000]);
                }
                data.data.push({
                  "target": alias,
                  "datapoints": datapoints
                });
              });
              return data;
            }

            var x = 0;
            table.columns.forEach(function (col) {
              var datapoints = [];
              var val = table.rows[0][x];
              for (var y = 0; y < steps; y++) {
                datapoints.push([val, (from + step * y) * 1000]);
              }
              data.data.push({
                "target": col.text,
                "datapoints": datapoints
              });
              x++;
            });
            return data;
          }
        }]);

        return ThrukDatasource;
      }());

      _export('ThrukDatasource', ThrukDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
