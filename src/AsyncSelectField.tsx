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

  const { loadOptions } = props;
  useEffect(() => {
    const fetchOptions = async () => {
      const result = await loadOptions();
      setLoadChache(result);
    };

    fetchOptions();
  }, [loadOptions]);

  const getOptions = (): void | Promise<Array<SelectableValue<any>>> => {
    return new Promise((resolve) => {
      resolve(loadChache);
    });
  };

  //
  // set input field value and emit changed event
  const inputTypeValue = (inp: HTMLInputElement, value: string) => {
    // special cases for select * and "+" button
    if (value === '*' || value === '+') {
      value = '';
    }
    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (!nativeInputValueSetter) {
      inp.value = value;
      return;
    }
    nativeInputValueSetter.call(inp, value);

    const event = new Event('input', { bubbles: true });
    inp.dispatchEvent(event);
  };

  let lastInput: HTMLInputElement;
  // set current value so it can be changed instead of typing it again
  const makeInputEditable = (value: string, inp?: HTMLInputElement) => {
    if (inp) {
      lastInput = inp;
    } else {
      inp = lastInput;
    }
    if (!inp) {
      return;
    }
    console.log(value);
    inputTypeValue(inp, value);
    setTimeout(() => {
      if (!inp) {
        return;
      }
      inputTypeValue(inp, value);
    }, 200);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    console.log(props.value, e.target);
    makeInputEditable(props.value.value, e.target as HTMLInputElement);
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
          onFocus={handleFocus as unknown as () => void}
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
