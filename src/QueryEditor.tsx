import { defaults, debounce } from 'lodash';
import React, { useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  SegmentSection,
  InlineLabel,
  ComboboxOption,
  Input,
  SegmentAsync,
  InlineField,
  IconButton,
  Combobox,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from './datasource';
import { ThrukDataSourceOptions, ThrukQuery, defaultQuery } from './types';
import styles from './QueryEditor.module.css';

type Props = QueryEditorProps<DataSource, ThrukQuery, ThrukDataSourceOptions>;

export const QueryEditor = (props: Props) => {
  const { onRunQuery } = props;
  const debouncedRunQuery = useMemo(() => debounce(onRunQuery, 500), [onRunQuery]);
  props.query = defaults(props.query, defaultQuery);

  const prependDashboardVariables = (data: string[]) => {
    getTemplateSrv()
      .getVariables()
      .forEach((v, i) => {
        data.unshift('/^$' + v.name + '$/');
      });
    return data;
  };

  const loadTables = (filter?: string): Promise<string[]> => {
    return props.datasource
      .request('GET', '/index?columns=url&protocol=get')
      .then((response) => {
        return response.data.map((row: { url?: string }) => {
          return row.url;
        });
      })
      .then(prependDashboardVariables)
      .then((data) =>
        data.filter((item) => {
          return !filter || (item && item.toLowerCase().includes(filter.toLowerCase()));
        })
      );
  };

  const loadColumns = (filter?: string): Promise<string[]> => {
    if (!props.query.table) {
      return Promise.resolve(['*']);
    }
    return props.datasource
      .request('GET', props.datasource._appendUrlParam(props.query.table, 'limit=1'))
      .then((response) => {
        if (!response.data) {
          return ['*'];
        }
        if (Array.isArray(response.data) && response.data[0]) {
          return Object.keys(response.data[0]).map((key: string, i: number) => {
            return key;
          });
        }
        if (response.data instanceof Object) {
          return Object.keys(response.data).map((key: string, i: number) => {
            return key;
          });
        }
        return ['*'];
      })
      .then((data: string[]) => {
        ['avg()', 'min()', 'max()', 'sum()', 'count()'].reverse().forEach((el) => {
          data.unshift(el);
        });
        return data;
      })
      .then(prependDashboardVariables)
      .then((data) =>
        data.filter((item) => {
          return !filter || (item && item.toLowerCase().includes(filter.toLowerCase()));
        })
      );
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

  let outputRef = useRef(null);
  let copyBtn = useRef(null);
  return (
    <>
      <div className="gf-form">
        <SegmentSection label="FROM">
          <></>
        </SegmentSection>
        <Combobox
          isClearable={true}
          createCustomValue={true}
          value={props.query.table || '/'}
          onChange={(v) => {
            onValueChange('table', v !== null ? v.value : '/');
          }}
          options={(filter?: string): Promise<ComboboxOption[]> => {
            return loadTables(filter).then((data) => {
              return data.map((item) => {
                return { value: item };
              });
            });
          }}
          minWidth={30}
          maxWidth={300}
          width={'auto'}
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
              <div
                ref={provided.innerRef}
                style={getListStyle(snapshot.isDraggingOver)}
                {...provided.droppableProps}
                className={styles.DNDList}
              >
                {props.query.columns.map((sel, index) => (
                  <Draggable key={'thruk-col' + index} draggableId={'thruk-col' + index} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={getItemStyle(snapshot.isDragging, provided.draggableProps.style)}
                      >
                        <InlineLabel width={'auto'} className={styles.DNDLabel}>
                          <Combobox
                            isClearable={true}
                            createCustomValue={true}
                            value={sel || '*'}
                            options={(filter?: string): Promise<ComboboxOption[]> => {
                              return loadColumns(filter).then((data) => {
                                return data.map((item) => {
                                  return { value: item, label: item };
                                });
                              });
                            }}
                            width={'auto'}
                            minWidth={5}
                            onChange={(v) => {
                              if (v === null) {
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
          value={'+'}
          style={{ width: 'auto', padding: '0 4px' }}
          loadOptions={(filter?: string): Promise<SelectableValue[]> => {
            return loadColumns(filter).then((data) => {
              return data.map((item) => {
                return { value: item, label: item };
              });
            });
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
          inputMinWidth={200}
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
        <SegmentSection label={(<div style={{ textAlign: 'right', width: '100%' }}>AS</div>) as unknown as string}>
          <></>
        </SegmentSection>
        <Combobox
          value={props.query.type || 'table'}
          options={[
            { label: 'Table', value: 'table' },
            { label: 'Timeseries', value: 'graph' },
            { label: 'Logs', value: 'logs' },
          ]}
          onChange={(v) => {
            onValueChange('type', v);
          }}
          isClearable={false}
          createCustomValue={false}
          width="auto"
          minWidth={15}
        />
        <InlineField grow>
          <InlineLabel> </InlineLabel>
        </InlineField>
        <SegmentSection label={(<div style={{ textAlign: 'right', width: '100%' }}>Helper</div>) as unknown as string}>
          <></>
        </SegmentSection>
        <Input
          width={16}
          placeholder="url encode text"
          onChange={(v) => {
            if (outputRef.current) {
              if ((outputRef.current as any) instanceof HTMLInputElement) {
                let inp = outputRef.current as HTMLInputElement;
                inp.value = encodeURIComponent(v.currentTarget.value);
              }
            }
          }}
        />
        <Input ref={outputRef} width={12} placeholder="output" value={''} readOnly={true} />
        <IconButton
          ref={copyBtn}
          name="copy"
          size="lg"
          variant="secondary"
          tooltip="Copy encoded text to clipboard"
          style={{ padding: '6px', borderRadius: '4px' }}
          onClick={(e) => {
            if (outputRef.current) {
              if ((outputRef.current as any) instanceof HTMLInputElement) {
                let inp = outputRef.current as HTMLInputElement;
                try {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(inp.value);
                  }
                  if (copyBtn.current) {
                    if ((copyBtn.current as any) instanceof HTMLButtonElement) {
                      let btn = copyBtn.current as HTMLButtonElement;
                      btn.style.transition = '';
                      btn.style.backgroundColor = '#00b500';
                      setTimeout(() => {
                        btn.style.transition = 'background-color 1s';
                        btn.style.backgroundColor = '';
                      }, 500);
                    }
                  }
                } catch (e) {
                  console.warn(e);
                }
              }
            }
          }}
        />
      </div>
    </>
  );
};
