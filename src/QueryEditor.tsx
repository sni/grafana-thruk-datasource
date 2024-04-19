import { defaults, debounce } from 'lodash';
import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { SegmentSection, InlineLabel, Input, SegmentAsync, InlineField } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from './datasource';
import { ThrukDataSourceOptions, ThrukQuery, defaultQuery } from './types';

type Props = QueryEditorProps<DataSource, ThrukQuery, ThrukDataSourceOptions>;

export function toSelectableValue<T extends string>(t: T): SelectableValue<T> {
  return { label: t, value: t };
}

export const QueryEditor = (props: Props) => {
  const { onRunQuery } = props;
  const debouncedRunQuery = useMemo(() => debounce(onRunQuery, 500), [onRunQuery]);
  props.query = defaults(props.query, defaultQuery);

  const prependDashboardVariables = (data: SelectableValue[]) => {
    getTemplateSrv()
      .getVariables()
      .forEach((v, i) => {
        data.unshift({
          label: '/^$' + v.name + '$/',
          value: '/^$' + v.name + '$/',
        });
      });
    return data;
  };

  const loadTypes = (filter?: string): Promise<SelectableValue[]> => {
    return Promise.resolve([
      { label: 'Table', value: 'table' },
      { label: 'Timeseries', value: 'graph' },
      { label: 'Logs', value: 'logs' },
    ]);
  };

  const loadTables = (filter?: string): Promise<SelectableValue[]> => {
    return props.datasource
      .request('GET', '/index?columns=url&protocol=get')
      .then((response) => {
        return response.data.map((row: { url?: string }) => {
          return { label: row.url, value: row.url };
        });
      })
      .then(prependDashboardVariables);
  };

  const loadColumns = (filter?: string): Promise<SelectableValue[]> => {
    if (!props.query.table) {
      return Promise.resolve([toSelectableValue('*')]);
    }

    return props.datasource
      .request('GET', props.query.table + '?limit=1')
      .then((response) => {
        if (!response.data) {
          return [toSelectableValue('*')];
        }
        if (Array.isArray(response.data) && response.data[0]) {
          return Object.keys(response.data[0]).map((key: string, i: number) => {
            return toSelectableValue(key);
          });
        }
        if (response.data instanceof Object) {
          return Object.keys(response.data).map((key: string, i: number) => {
            return toSelectableValue(key);
          });
        }
        return [toSelectableValue('*')];
      })
      .then((data: SelectableValue[]) => {
        ['avg()', 'min()', 'max()', 'sum()', 'count()'].reverse().forEach((el) => {
          data.unshift({ label: el, value: el });
        });
        if (filter !== 'remove') {
          data.unshift({ label: '-- remove --', value: '' });
        }
        return data;
      });
  };

  const onValueChange = (key: keyof ThrukQuery, value: any) => {
    props.query[key] = value as never;
    props.onChange(props.query);
    debouncedRunQuery();
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const [removed] = props.query.columns.splice(result.source.index, 1);
    props.query.columns.splice(result.destination.index, 0, removed);
    props.onChange(props.query);
    debouncedRunQuery();
  };
  const getListStyle = (isDraggingOver: boolean) => ({
    background: isDraggingOver ? 'lightblue' : '',
    display: 'flex',
    overflow: 'auto',
  });
  const getItemStyle = (isDragging: boolean, draggableStyle: any) => ({
    userSelect: 'none',
    background: isDragging ? 'lightgreen' : '',
    ...draggableStyle,
  });
  const css = `
  .thruk-dnd-label {
    padding: 0 12px;
    cursor: grab;
  }
  .thruk-dnd-label:hover {
    background: lightblue;
    cursor: grab;
  }
  .thruk-dnd-label LABEL {
    padding: 0 4px;
    margin: 0;
    cursor: text;
  }
  `;

  // set input field value and emit changed event
  const inputTypeValue = (inp: HTMLInputElement, value: string, skipEvent?: boolean) => {
    // special cases for select * and "+" button
    if(value == "*" || value == "+") {
      value = "";
    }
    if(skipEvent) {
      inp.value = value;
      inp.style.minWidth = inp.parentElement?.offsetWidth + 'px';
      // clear placeholder watermark, it overlaps current text
      if (inp.parentElement?.parentElement?.firstElementChild) {
        inp.parentElement.parentElement.firstElementChild.innerHTML = '';
      }
      return;
    }
    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if(!nativeInputValueSetter) {
      inp.value = value;
      return;
    }
    nativeInputValueSetter.call(inp, value);

    const event = new Event('input', { bubbles: true });
    inp.dispatchEvent(event);
  };

  let lastInput: HTMLInputElement;
  // set current value so it can be changed instead of typing it again
  const makeInputEditable = (value: string, inp?: HTMLInputElement, skipEvent?: boolean) => {
    if (inp) {
      lastInput = inp;
    } else {
      inp = lastInput;
    }
    if (!inp) {
      return;
    }
    inputTypeValue(inp, value, skipEvent);
    setTimeout(() => {
      if (!inp) {
        return;
      }
      inputTypeValue(inp, value, skipEvent);
    }, 200);
  };
  return (
    <>
      <style>{css}</style>
      <div className="gf-form">
        <SegmentSection label="FROM">
          <></>
        </SegmentSection>
        <SegmentAsync
          onFocus={(e) => {
            makeInputEditable(props.query.table, e.target as HTMLInputElement);
          }}
          value={toSelectableValue(props.query.table || '/')}
          loadOptions={(filter?: string): Promise<SelectableValue[]> => {
            return loadTables(filter).then((data) => {
              makeInputEditable(props.query.table);
              return data;
            });
          }}
          onChange={(v) => {
            onValueChange('table', v.value);
          }}
          allowCustomValue
          inputMinWidth={250}
          noOptionMessageHandler={() => ''}
        />
        <InlineField grow>
          <InlineLabel> </InlineLabel>
        </InlineField>
      </div>
      <div className="gf-form" style={{ width: '100%' }}>
        <SegmentSection label="SELECT">
          <></>
        </SegmentSection>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="thruk-columns-list" direction="horizontal">
            {(provided, snapshot) => (
              <div ref={provided.innerRef} style={getListStyle(snapshot.isDraggingOver)} {...provided.droppableProps}>
                {props.query.columns.map((sel, index) => (
                  <Draggable key={'thruk-col' + index} draggableId={'thruk-col' + index} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={getItemStyle(snapshot.isDragging, provided.draggableProps.style)}
                      >
                        <InlineLabel width={'auto'} className="thruk-dnd-label">
                          <SegmentAsync
                            key={props.query.table}
                            value={toSelectableValue(sel || '*')}
                            onFocus={(e) => {
                              makeInputEditable(sel, e.target as HTMLInputElement, true);
                            }}
                            loadOptions={(filter?: string): Promise<SelectableValue[]> => {
                              return loadColumns(filter).then((data) => {
                                makeInputEditable(sel, undefined, true);
                                return data;
                              });
                            }}
                            onChange={(v) => {
                              if (v.value === '') {
                                // remove segment
                                props.query.columns.splice(index, 1);
                              } else {
                                props.query.columns[index] = v.value;
                              }
                              // remove '*' from list
                              let i = props.query.columns.indexOf('*');
                              if (i !== -1) {
                                props.query.columns.splice(i, 1);
                              }
                              if (props.query.columns.length === 0) {
                                props.query.columns.push('*');
                              }
                              props.onChange(props.query);
                              debouncedRunQuery();
                            }}
                            allowCustomValue={false}
                            inputMinWidth={180}
                          />
                        </InlineLabel>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <SegmentAsync
          value={toSelectableValue('+')}
          loadOptions={(filter?: string): Promise<SelectableValue[]> => {
            return loadColumns('remove');
          }}
          onChange={(v) => {
            props.query.columns.push(v.value);
            // remove '*' from list
            let i = props.query.columns.indexOf('*');
            if (i !== -1) {
              props.query.columns.splice(i, 1);
            }
            props.onChange(props.query);
            debouncedRunQuery();
          }}
          allowCustomValue={false}
          inputMinWidth={180}
        />
        <InlineField grow>
          <InlineLabel> </InlineLabel>
        </InlineField>
      </div>
      <div className="gf-form">
        <SegmentSection label="WHERE">
          <></>
        </SegmentSection>
        <Input
          placeholder="condition..., ex.: ( host_name = '$host' OR host_alias ~ '^a' ) AND time = $time"
          value={props.query.condition?.toString()}
          onChange={(v) => {
            onValueChange('condition', v.currentTarget.value);
          }}
        />
      </div>
      <div className="gf-form">
        <SegmentSection label="LIMIT">
          <></>
        </SegmentSection>
        <Input
          placeholder="No Limit"
          value={props.query.limit?.toString()}
          onChange={(v) => {
            let limit = Number(v.currentTarget.value);
            if (limit <= 0) {
              onValueChange('limit', undefined);
            } else {
              onValueChange('limit', limit);
            }
          }}
          type={'number'}
          width={10}
        />
        <SegmentSection label="AS">
          <></>
        </SegmentSection>
        <SegmentAsync
          value={toSelectableValue(props.query.type || 'table')}
          loadOptions={loadTypes}
          onChange={(v) => {
            onValueChange('type', v.value);
          }}
          allowCustomValue={false}
          inputMinWidth={80}
        />
        <InlineField grow>
          <InlineLabel> </InlineLabel>
        </InlineField>
      </div>
    </>
  );
};
