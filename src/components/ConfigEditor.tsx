import React from 'react';
import { InlineField, Input } from '@grafana/ui';
import { ConnectionSettings, ConfigSection, Auth, AdvancedHttpSettings, convertLegacyAuthProps } from '@grafana/plugin-ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ThrukDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<ThrukDataSourceOptions> {}

export function ConfigEditor (props: Props) {
  const { onOptionsChange, options } = props;

  const options2 = {
    ...options,
    jsonData: {
      ...options.jsonData,
      keepCookies: options.jsonData.keepCookies || ['thruk_auth'],
    }
  }


  // const onUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   onOptionsChange({
  //     ...options,
  //     url: event.target.value,
  //   });
  // };

  // DataSourceHttpSettings is deprecated
  // Using the new Grafana styles according to documentation
  // https://github.com/grafana/plugin-ui/blob/main/src/components/ConfigEditor/migrating-from-datasource-http-settings.md
  return (
    <>

      {/* Example field for setting a variable*/}
      {/* <InlineField label="Url" labelWidth={14} interactive tooltip={'Url for querying'}>
        <Input
          id="config-editor-path"
          onChange={onUrlChange}
          value={options.url}
          placeholder="Enter the url, e.g. http://127.0.0.1/sitename/thruk"
          width={40}
        />
      </InlineField> */}

      <ConnectionSettings
        config={options2}
        onChange={props.onOptionsChange}
      />

      <Auth
        {...convertLegacyAuthProps({
          config: options2,
          onChange: props.onOptionsChange,
        })}
      />

      <ConfigSection
        title="Advanced settings"
        isCollapsible
        isInitiallyOpen={true}
      >

        <AdvancedHttpSettings
          config={options2}
          onChange={props.onOptionsChange}
        />

      </ConfigSection>

    </>


  );
}
