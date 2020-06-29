'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnnotationsQueryCtrl = exports.QueryOptionsCtrl = exports.ConfigCtrl = exports.QueryCtrl = exports.Datasource = undefined;

var _datasource = require('./datasource');

var _query_ctrl = require('./query_ctrl');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ThrukConfigCtrl = function ThrukConfigCtrl() {
  _classCallCheck(this, ThrukConfigCtrl);
};

ThrukConfigCtrl.templateUrl = 'partials/config.html';

var ThrukQueryOptionsCtrl = function ThrukQueryOptionsCtrl() {
  _classCallCheck(this, ThrukQueryOptionsCtrl);
};

ThrukQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

var ThrukAnnotationsQueryCtrl = function ThrukAnnotationsQueryCtrl() {
  _classCallCheck(this, ThrukAnnotationsQueryCtrl);
};

ThrukAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

exports.Datasource = _datasource.ThrukDatasource;
exports.QueryCtrl = _query_ctrl.ThrukDatasourceQueryCtrl;
exports.ConfigCtrl = ThrukConfigCtrl;
exports.QueryOptionsCtrl = ThrukQueryOptionsCtrl;
exports.AnnotationsQueryCtrl = ThrukAnnotationsQueryCtrl;
//# sourceMappingURL=module.js.map
