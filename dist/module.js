'use strict';

System.register(['./datasource', './query_ctrl'], function (_export, _context) {
  "use strict";

  var ThrukDatasource, ThrukDatasourceQueryCtrl, ThrukConfigCtrl, ThrukQueryOptionsCtrl, ThrukAnnotationsQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_datasource) {
      ThrukDatasource = _datasource.ThrukDatasource;
    }, function (_query_ctrl) {
      ThrukDatasourceQueryCtrl = _query_ctrl.ThrukDatasourceQueryCtrl;
    }],
    execute: function () {
      _export('ConfigCtrl', ThrukConfigCtrl = function ThrukConfigCtrl() {
        _classCallCheck(this, ThrukConfigCtrl);
      });

      ThrukConfigCtrl.templateUrl = 'partials/config.html';

      _export('QueryOptionsCtrl', ThrukQueryOptionsCtrl = function ThrukQueryOptionsCtrl() {
        _classCallCheck(this, ThrukQueryOptionsCtrl);
      });

      ThrukQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

      _export('AnnotationsQueryCtrl', ThrukAnnotationsQueryCtrl = function ThrukAnnotationsQueryCtrl() {
        _classCallCheck(this, ThrukAnnotationsQueryCtrl);
      });

      ThrukAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

      _export('Datasource', ThrukDatasource);

      _export('QueryCtrl', ThrukDatasourceQueryCtrl);

      _export('ConfigCtrl', ThrukConfigCtrl);

      _export('QueryOptionsCtrl', ThrukQueryOptionsCtrl);

      _export('AnnotationsQueryCtrl', ThrukAnnotationsQueryCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
