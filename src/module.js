import {ThrukDatasource} from './datasource';
import {ThrukDatasourceQueryCtrl} from './query_ctrl';

class ThrukConfigCtrl {}
ThrukConfigCtrl.templateUrl = 'partials/config.html';

class ThrukQueryOptionsCtrl {}
ThrukQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

class ThrukAnnotationsQueryCtrl {}
ThrukAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html'

export {
  ThrukDatasource as Datasource,
  ThrukDatasourceQueryCtrl as QueryCtrl,
  ThrukConfigCtrl as ConfigCtrl,
  ThrukQueryOptionsCtrl as QueryOptionsCtrl,
  ThrukAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
