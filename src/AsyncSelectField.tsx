import { AsyncSelect, AsyncSelectProps, SegmentAsync } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';

interface AsyncSelectFieldProps extends AsyncSelectProps<any> {
  loadOptions: (query?: string | undefined) => Promise<Array<SelectableValue<any>>>;
  onChange: (item: SelectableValue<any>) => void;
}

export function AsyncSelectField(props: AsyncSelectFieldProps) {
  const [isSelected, setIsSelected] = useState<boolean>(false);
  const [loadChache, setLoadChache] = useState<Array<SelectableValue<any>> | PromiseLike<Array<SelectableValue<any>>>>(
    []
  );

  useEffect(() => {
    const fetchOptions = async () => {
      const result = await props.loadOptions();
      setLoadChache(result);
    };

    fetchOptions();
  });

  const getOptions = (): void | Promise<Array<SelectableValue<any>>> => {
    return new Promise((resolve) => {
      resolve(loadChache);
    });
  };

  const component = (): React.ReactNode => {
    if (isSelected) {
      return (
        <AsyncSelect
          onChange={props.onChange}
          value={props.value}
          loadOptions={getOptions}
          defaultOptions={true}
          filterOption={(option, searchQuery) => {
            const label = option?.label ?? '';
            if (typeof label === 'string' && label && searchQuery) {
              return label.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
          }}
          allowCustomValue={true}
          createOptionPosition="first"
          allowCreateWhileLoading={true}
          onCreateOption={props.onCreateOption}
          disabled={false}
          isClearable={false}
          onBlur={() => setIsSelected(false)}
          autoFocus={true}
          isOpen={true}
          onCloseMenu={() => setIsSelected(false)}
          width={'auto'}
        />
      );
    } else {
      return (
        <SegmentAsync
          value={props.value}
          loadOptions={() => {
            return Promise.resolve([]);
          }}
          onChange={props.onChange}
          inputMinWidth={250}
          noOptionMessageHandler={() => ''}
          onFocus={() => {
            setIsSelected(true);
          }}
        />
      );
    }
  };

  return <div>{component()}</div>;
}
