import { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ThrukDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<ThrukDataSourceOptions> {}

export function ConfigEditor (props: Props) {
  const { onOptionsChange, options } = props;

  const onUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      url: event.target.value,
    });
  };

  return (
    <>
      <InlineField label="Url" labelWidth={14} interactive tooltip={'Url for querying'}>
        <Input
          id="config-editor-path"
          onChange={onUrlChange}
          value={options.url}
          placeholder="Enter the url, e.g. http://127.0.0.1/sitename/thruk"
          width={40}
        />
      </InlineField>
    </>
  );
}
