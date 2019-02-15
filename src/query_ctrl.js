import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class ThrukDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv)  {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv     = uiSegmentSrv;
    this.target.table     = this.target.table     || '/';
    this.target.columns   = this.target.columns   || ['*'];
    this.target.condition = this.target.condition || '';

    this.setColSegments();
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
      .then(this.uiSegmentSrv.transformToSegments(false))
      .catch(this.datasource._handleQueryError.bind(this));
  }

  getColumns() {
    var This = this;
    var requestOptions = this.datasource._requestOptions({
      url: this.datasource.url + '/r/v1/'+this.target.table+'?limit=1',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return this.datasource.backendSrv.datasourceRequest(requestOptions)
      .then(function(result) {
        var data = [
          This.uiSegmentSrv.newOperator('-- remove --'),
          This.uiSegmentSrv.newOperator('avg()'),
          This.uiSegmentSrv.newOperator('min()'),
          This.uiSegmentSrv.newOperator('max()'),
          This.uiSegmentSrv.newOperator('sum()'),
          This.uiSegmentSrv.newOperator('count()'),
        ];
        if(result.data[0]) {
          Object.keys(result.data[0]).forEach(function(key) {
            data.push(This.uiSegmentSrv.newSegment({ text: key, value: key }));
          });
        }
        return(data);
      })
      .catch(this.datasource._handleQueryError.bind(this));
  }

  tagSegmentUpdated(col,index) {
    this.target.columns[index] = col.value;
    if(col.value == "-- remove --") {
      this.target.columns.splice(index, 1);
    }
    this.setColSegments();
    this.onChangeInternal();
    return;
  }

  setColSegments() {
    this.colSegments = [];
    if(!angular.isArray(this.target.columns)) {
      if(!this.target.columns) {
        this.target.columns = ['*'];
      } else {
        this.target.columns = this.target.columns.split("\s*,\s*");
      }
    }
    this.target.columns.forEach(col => {
      this.colSegments.push(this.uiSegmentSrv.newSegment({ value: col }));
    });
    if(this.colSegments.length == 0) {
      this.colSegments.push(this.uiSegmentSrv.newSegment({ value: '*' }));
    } else {
      if(this.colSegments[this.colSegments.length-1].text && this.colSegments[this.colSegments.length-1].text.match(/\(\)$/)) {
        this.colSegments.push(this.uiSegmentSrv.newSegment({ value: ' ' }));
      }
    }
    this.colSegments.push(this.uiSegmentSrv.newPlusButton());
  }

  onChangeInternal() {
    this.panelCtrl.refresh();
  }

  getCollapsedText() {
    var query = 'SELECT '+this.target.columns.join(',')
               +' FROM '+this.target.table;
    if(this.target.condition) {
      query +=  ' WHERE '+this.target.condition
    }
    if(this.target.limit) {
      query +=  ' LIMIT '+this.target.limit
    }
    return(query);
  }
}

ThrukDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
