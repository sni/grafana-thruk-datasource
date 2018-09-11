import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class ThrukDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv)  {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv     = uiSegmentSrv;
    this.target.table     = this.target.table     || '/';
    this.target.columns   = this.target.columns   || '*';
    this.target.condition = this.target.condition || '';
  }

  getTables() {
    var requestOptions = this.datasource._requestOptions({
      url: this.datasource.url + '/r/v1/index?columns=url&protocol=get',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return this.datasource.backendSrv.datasourceRequest(requestOptions)
      .then(result => _.map(result.data, (d, i) => {
        return { text: d.url, value: d.url };
      }))
      .then(this.uiSegmentSrv.transformToSegments(false));
  }

  /*
  getColumns() {
    var requestOptions = this.datasource._requestOptions({
      url: this.datasource.url + '/r/v1/'+this.target.table+'?limit=1',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return this.datasource.backendSrv.datasourceRequest(requestOptions)
      .then(function(result) {
        var data = [];
        if(result.data[0]) {
          Object.keys(result.data[0]).forEach(function(key) {
            data.push({ text: key, value: key });
          });
        }
        return(data);
      })
      .then(this.uiSegmentSrv.transformToSegments(false));
  }
  */

  onChangeInternal() {
    this.panelCtrl.refresh();
  }

  getCollapsedText() {
    return('SELECT '+this.target.columns
           +' FROM '+this.target.table
           +' WHERE '+this.target.condition
           );
  }
}

ThrukDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
