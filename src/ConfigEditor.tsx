import React, { PureComponent } from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ThrukDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<ThrukDataSourceOptions> {}

interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
  render() {
    const { onOptionsChange, options } = this.props;
    if (!options.jsonData.keepCookies) {
      options.jsonData.keepCookies = ['thruk_auth'];
    }
    return (
      <div className="gf-form-group">
        <>
          <DataSourceHttpSettings
            defaultUrl={'http://127.0.0.1/sitename/thruk'}
            dataSourceConfig={options}
            showAccessOptions={false}
            onChange={onOptionsChange}
          />
        </>
      </div>
    );
  }
}
