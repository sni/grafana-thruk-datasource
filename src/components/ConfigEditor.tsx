import React from 'react';
import { InlineField, Input } from '@grafana/ui';
import { ConnectionSettings, ConfigSection, Auth, AdvancedHttpSettings, convertLegacyAuthProps } from '@grafana/plugin-ui';
import { DataSourcePluginOptionsEditorProps, LogLevel } from '@grafana/data';
import { ThrukDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<ThrukDataSourceOptions> {}

export function ConfigEditor (props: Props) {
  const { onOptionsChange, options } = props;

  const options2 = {
    ...options,
    jsonData: {
      ...options.jsonData,
      keepCookies: options.jsonData.keepCookies || ['thruk_auth'],
      logLevel: options.jsonData.logLevel || 0,
      logPath: options.jsonData.logPath || "$HOME/var/log/grafana/thruk-grafana-plugin.log"
    }
  }


  const onLogLevelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        logLevel: Number(event.target.value),
      }
    });
  };

  const onLogPathChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        logPath: event.target.value,
      }
    });
  };

  // DataSourceHttpSettings is deprecated
  // Using the new Grafana styles according to documentation
  // https://github.com/grafana/plugin-ui/blob/main/src/components/ConfigEditor/migrating-from-datasource-http-settings.md
  return (
    <>

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

        <InlineField label="Log Level" labelWidth={14} interactive tooltip={'LogLevel to use for the plugin. Level 0 disables logging'}>
          <Input
            id="config-editor-path"
            onChange={onLogLevelChange}
            value={options.jsonData.logLevel}
            placeholder="Enter a numeric log level"
            width={40}
          />
        </InlineField>

        <InlineField label="Log Path" labelWidth={14} interactive tooltip={'Log Path to use for the plugin. Can specify $HOME or %APPDATA% etc. as path placeholders'}>
          <Input
            id="config-editor-path"
            onChange={onLogPathChange}
            value={options.jsonData.logPath}
            placeholder="Enter a log path"
            width={40}
          />
        </InlineField>

      </ConfigSection>

    </>


  );
}
