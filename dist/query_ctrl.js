'use strict';

System.register(['app/plugins/sdk', './css/query-editor.css!'], function (_export, _context) {
  "use strict";

  var QueryCtrl, _createClass, ThrukDatasourceQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  return {
    setters: [function (_appPluginsSdk) {
      QueryCtrl = _appPluginsSdk.QueryCtrl;
    }, function (_cssQueryEditorCss) {}],
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

      _export('ThrukDatasourceQueryCtrl', ThrukDatasourceQueryCtrl = function (_QueryCtrl) {
        _inherits(ThrukDatasourceQueryCtrl, _QueryCtrl);

        function ThrukDatasourceQueryCtrl($scope, $injector, uiSegmentSrv) {
          _classCallCheck(this, ThrukDatasourceQueryCtrl);

          var _this = _possibleConstructorReturn(this, (ThrukDatasourceQueryCtrl.__proto__ || Object.getPrototypeOf(ThrukDatasourceQueryCtrl)).call(this, $scope, $injector));

          _this.scope = $scope;
          _this.uiSegmentSrv = uiSegmentSrv;
          _this.target.table = _this.target.table || '/';
          _this.target.columns = _this.target.columns || ['*'];
          _this.target.condition = _this.target.condition || '';

          _this.setColSegments();
          return _this;
        }

        _createClass(ThrukDatasourceQueryCtrl, [{
          key: 'getTables',
          value: function getTables() {
            var requestOptions = this.datasource._requestOptions({
              url: this.datasource.url + '/r/v1/index?columns=url&protocol=get',
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            });
            return this.datasource.backendSrv.datasourceRequest(requestOptions).then(function (result) {
              return _.map(result.data, function (d, i) {
                return { text: d.url, value: d.url };
              });
            }).then(this.uiSegmentSrv.transformToSegments(false)).catch(this.datasource._handleQueryError.bind(this));
          }
        }, {
          key: 'getColumns',
          value: function getColumns() {
            var requestOptions = this.datasource._requestOptions({
              url: this.datasource.url + '/r/v1/' + this.target.table + '?limit=1',
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            });
            return this.datasource.backendSrv.datasourceRequest(requestOptions).then(function (result) {
              var data = [];
              data.push({ text: '-- remove --', value: '-- remove --' });
              if (result.data[0]) {
                Object.keys(result.data[0]).forEach(function (key) {
                  data.push({ text: key, value: key });
                });
              }
              return data;
            }).then(this.uiSegmentSrv.transformToSegments(false)).catch(this.datasource._handleQueryError.bind(this));
          }
        }, {
          key: 'tagSegmentUpdated',
          value: function tagSegmentUpdated(col, index) {
            this.target.columns[index] = col.value;
            if (col.value == "-- remove --") {
              this.target.columns.splice(index, 1);
            }
            this.setColSegments();
            this.onChangeInternal();
            return;
          }
        }, {
          key: 'setColSegments',
          value: function setColSegments() {
            var _this2 = this;

            this.colSegments = [];
            if (!angular.isArray(this.target.columns)) {
              if (!this.target.columns) {
                this.target.columns = ['*'];
              } else {
                this.target.columns = this.target.columns.split("\s*,\s*");
              }
            }
            this.target.columns.forEach(function (col) {
              _this2.colSegments.push(_this2.uiSegmentSrv.newSegment({ value: col }));
            });
            if (this.colSegments.length == 0) {
              this.colSegments.push(this.uiSegmentSrv.newSegment({ value: '*' }));
            }
            this.colSegments.push(this.uiSegmentSrv.newPlusButton());
          }
        }, {
          key: 'onChangeInternal',
          value: function onChangeInternal() {
            this.panelCtrl.refresh();
          }
        }, {
          key: 'getCollapsedText',
          value: function getCollapsedText() {
            var query = 'SELECT ' + this.target.columns.join(',') + ' FROM ' + this.target.table;
            if (this.target.condition) {
              query += ' WHERE ' + this.target.condition;
            }
            if (this.target.limit) {
              query += ' LIMIT ' + this.target.limit;
            }
            return query;
          }
        }]);

        return ThrukDatasourceQueryCtrl;
      }(QueryCtrl));

      _export('ThrukDatasourceQueryCtrl', ThrukDatasourceQueryCtrl);

      ThrukDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
    }
  };
});
//# sourceMappingURL=query_ctrl.js.map
