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
        }

        _createClass(ThrukDatasource, [{
          key: 'testDatasource',
          value: function testDatasource() {
            var requestOptions = this._requestOptions({
              url: this.url + '/r/v1/',
              method: 'GET'
            });
            return this.backendSrv.datasourceRequest(requestOptions).then(function (response) {
              if (response.status === 200) {
                return { status: "success", message: "Data source is working", title: "Success" };
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var query = this.parseQuery(options.annotation.query);
            if (query.table == 'logs' || query.table == '/logs') {
              query.columns = "time,message,type";
            }
            var path = query.table + "?columns=" + query.columns;
            if (query.where) {
              query.where += " AND ";
            }
            query.where += " time > " + Math.floor(options.range.from.toDate().getTime() / 1000);
            query.where += " AND time < " + Math.floor(options.range.to.toDate().getTime() / 1000);
            if (query.where) {
              path += '&q=' + encodeURIComponent(query.where);
            }

            var requestOptions = this._requestOptions({
              url: this.url + '/r/v1/' + path,
              method: 'GET'
            });
            // TODO: catch wrong column or other rest api errors
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
            });
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(options) {
            var query = this.parseQuery(options);
            var path = query.table + "?columns=" + query.columns;
            if (query.where) {
              path += '&q=' + encodeURIComponent(query.where);
            }
            var requestOptions = this._requestOptions({
              url: this.url + '/r/v1/' + path,
              method: 'GET'
            });
            // TODO: catch wrong column or other rest api errors
            return this.backendSrv.datasourceRequest(requestOptions).then(function (result) {
              return _.map(result.data, function (d, i) {
                return { text: Object.values(d).join(';'), value: Object.values(d).join(';') };
              });
            });
          }
        }, {
          key: 'query',
          value: function query(options) {
            var _this = this;

            // we can only handle a single query right now
            for (var x = 0; x < options.targets.length; x++) {
              var table = new TableModel();
              var target = options.targets[x];
              var path = target.table;
              if (target.columns && target.columns != '*') {
                path += "?columns=" + target.columns;
                target.columns.split(/\s*,\s*/).forEach(function (col) {
                  _this._addColumn(table, col);
                });
              }
              if (target.condition) {
                path += '&q=' + encodeURIComponent(target.condition);
              }
              var requestOptions = this._requestOptions({
                url: this.url + '/r/v1/' + path,
                method: 'GET'
              });
              return this.backendSrv.datasourceRequest(requestOptions).then(function (result) {
                var _this2 = this;

                // extract columns from first result row unless specified
                if (!(target.columns && target.columns != '*') && result.data[0]) {
                  Object.keys(result.data[0]).forEach(function (col) {
                    _this2._addColumn(table, col);
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
                return {
                  data: [table]
                };
              });
            }
          }
        }, {
          key: '_addColumn',
          value: function _addColumn(table, col) {
            if (col.match(/^(last_|next_|time)/)) {
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
          key: 'parseQuery',
          value: function parseQuery(query) {
            query = this.templateSrv.replace(query, null, 'regex');
            // TODO: support sort and limit
            var tmp = query.match(/^\s*SELECT\s+([\w_,\ ]+)\s+FROM\s+([\w_\/]+)(|\s+WHERE\s+(.*))$/i);
            if (!tmp) {
              throw new Error("query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>]");
            }
            return {
              columns: tmp[1].replace(/\s+/g, ''),
              table: tmp[2],
              where: tmp[4]
            };
          }
        }]);

        return ThrukDatasource;
      }());

      _export('ThrukDatasource', ThrukDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
