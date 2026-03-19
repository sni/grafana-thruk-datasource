import React from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ThrukDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<ThrukDataSourceOptions> {}

interface State {}

export class ConfigEditor extends React.PureComponent<Props, State> {
  render() {
    const { onOptionsChange, options } = this.props;

    const optionsCopy = {
      ...options,
      jsonData: {
        ...options.jsonData,
        keepCookies: options.jsonData.keepCookies || ['thruk_auth']
      }
    }

    return (
      <div className="gf-form-group">
        <>
          <DataSourceHttpSettings
            defaultUrl={'http://127.0.0.1/sitename/thruk'}
            dataSourceConfig={optionsCopy}
            showAccessOptions={false}
            onChange={onOptionsChange}
          />
        </>
      </div>
    );
  }
}
