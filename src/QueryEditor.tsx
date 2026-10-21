import { defaults, debounce } from 'lodash';
import React, { useRef } from 'react';
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
  CodeEditor,
  InlineSwitch,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import type { Monaco, MonacoEditor } from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource, defaultLimit } from './datasource';
import { ThrukDataSourceOptions, ThrukQuery, defaultQuery } from './types';
import styles from './QueryEditor.module.css';

type Props = QueryEditorProps<DataSource, ThrukQuery, ThrukDataSourceOptions>;

let codeCompletionProvider: { dispose: () => void } | undefined;

export const QueryEditor = (props: Props) => {
  const { onRunQuery } = props;
  const debouncedRunQuery = React.useMemo(() => debounce(onRunQuery, 500), [onRunQuery]);

  const queryDefaulted = defaults({}, props.query, defaultQuery);

  const prependDashboardVariables = (data: string[]) => {
    getTemplateSrv()
      .getVariables()
      .forEach((v, i) => {
        data.unshift('/^$' + v.name + '$/');
      });
    return data;
  };

  const loadTables = (filter?: string): Promise<string[]> => {
    return fetchTablesCached()
      .then(prependDashboardVariables)
      .then((data) =>
        data.filter((item) => {
          return !filter || (item && item.toLowerCase().includes(filter.toLowerCase()));
        })
      );
  };

  const fetchTablesCached = (): Promise<string[]> => {
    if (props.datasource.cachedTables && props.datasource.cachedTables.length > 0) {
      return Promise.resolve(props.datasource.cachedTables.slice());
    }
    return props.datasource
      .request('GET', '/index?columns=url&protocol=get')
      .then((response) => {
        return response.data.map((row: { url?: string }) => {
          return row.url;
        });
      })
      .then((response) => {
        props.datasource.cachedTables = response.slice();
        return response;
      });
  };

  const loadColumns = (filter?: string): Promise<string[]> => {
    if (!queryDefaulted.table) {
      return Promise.resolve(['*']);
    }
    return fetchColumnsCached()
      .then((data: string[]) => {
        ['avg()', 'min()', 'max()', 'sum()', 'count()', 'calc()', 'concat()', 'uniq()'].reverse().forEach((el) => {
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

  const fetchColumnsCached = (table?: string): Promise<string[]> => {
    const url = props.datasource.replaceVariables(table || queryDefaulted.table);
    if (props.datasource.cachedColumns && props.datasource.cachedColumns.url === url) {
      return Promise.resolve(props.datasource.cachedColumns.columns.slice());
    }
    return props.datasource
      .request('GET', props.datasource._appendUrlParam(url, 'limit=1'), null, {
        'X-Thruk-Output-Metadata-Only': '1',
        'X-THRUK-OutputFormat': 'wrapped_json',
        'x-thruk-columns': true,
      })
      .then((response) => {
        const columns = response.data?.meta?.columns;
        if (columns?.length) {
          return columns.map((column: { name: string }) => column.name);
        }
        const data = response.data?.meta ? response.data.data : response.data;
        const row = Array.isArray(data) ? data[0] : data;
        return row instanceof Object ? Object.keys(row) : ['*'];
      })
      .then((response) => {
        props.datasource.cachedColumns = {
          url: url,
          columns: response.slice(),
        };
        return response;
      });
  };

  const buildCodeText = (): string => {
    const cols = queryDefaulted.columns && queryDefaulted.columns.length > 0 ? queryDefaulted.columns.join(', ') : '*';
    const code = ['SELECT', '  ' + cols, 'FROM ' + (queryDefaulted.table || '/')];
    if (queryDefaulted.condition) {
      code.push('WHERE ' + queryDefaulted.condition);
    }
    if (queryDefaulted.limit && queryDefaulted.limit !== defaultLimit) {
      code.push('LIMIT ' + queryDefaulted.limit);
    }
    return code.join('\n');
  };

  const parseCode = (text: string, backToForm?: boolean) => {
    try {
      const parsed = {
        ...props.datasource.parseVariableQuery(text.replace(/(?:[ \t]*\r?\n)+/g, ' ').trim()),
        codeMode: backToForm ? false : true,
        codeText: text,
        error: undefined,
      };
      props.onChange(parsed);
    } catch (e) {
      props.onChange({
        ...props.query,
        codeMode: true,
        codeText: text,
        error:
          'query syntax error, expecting: SELECT <column>[,<columns>] FROM <rest url> [WHERE <filter conditions>] [LIMIT <limit>]',
      });
    }
    debouncedRunQuery();
    return props.query as ThrukQuery;
  };

  // stable reference: grafana disposes/re-registers the monaco provider when
  // this changes, and the provider reads the live caches when called
  const codeEditorSuggestions = React.useMemo(
    () => () => {
      const items: { label: string; detail: string }[] = [];
      if (props.datasource.cachedTables && props.datasource.cachedTables.length > 0) {
        props.datasource.cachedTables.forEach((url: string) => {
          items.push({ label: url, detail: 'url' });
        });
      }
      if (props.datasource.cachedColumns && props.datasource.cachedColumns.columns.length > 0) {
        props.datasource.cachedColumns.columns.forEach((column: string) => {
          items.push({ label: column, detail: 'column' });
        });
      }
      return items;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onValueChange = (key: keyof ThrukQuery, value: any) => {
    const updatedQuery = {
      ...queryDefaulted,
      [key]: value as never,
    };
    props.onChange(updatedQuery);
    debouncedRunQuery();
  };

  // operate on a copy of columns to avoid mutating props.query
  const commitColumns = (cols: string[]) => {
    const i = cols.indexOf('*');
    if (i !== -1) {
      cols.splice(i, 1);
    }
    if (cols.length === 0) {
      cols.push('*');
    }
    props.onChange({ ...queryDefaulted, columns: cols });
    debouncedRunQuery();
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const newColumns = Array.from(queryDefaulted.columns);
    const [removed] = newColumns.splice(result.source.index, 1);
    newColumns.splice(result.destination.index, 0, removed);
    props.onChange({
      ...queryDefaulted,
      columns: newColumns,
    });
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

  const outputRef = useRef(null);
  const copyBtn = useRef(null);

  const codeMode = queryDefaulted.codeMode === true;
  const codeText =
    queryDefaulted.codeText && queryDefaulted.codeText.trim().length > 0 ? queryDefaulted.codeText : buildCodeText();

  // the table parsed from the current code text, so column autocomplete
  // follows url changes made inside the code editor
  let codeTable = queryDefaulted.table;
  if (codeMode) {
    const normalized = codeText.replace(/(?:[ \t]*\r?\n)+/g, ' ').trim();
    try {
      codeTable = props.datasource.parseVariableQuery(normalized).table;
    } catch (e) {
      // the query is incomplete (e.g. empty columns clause), still follow the
      // typed url so the column cache matches what the user sees
      const from = normalized.match(/\bFROM\s+(\S+)/i);
      if (from) {
        codeTable = from[1];
      }
    }
  }

  // warm the caches used for code editor autocomplete
  React.useEffect(() => {
    if (!codeMode) {
      return;
    }
    fetchTablesCached().catch(() => {});
    fetchColumnsCached(codeTable).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeMode, codeTable]);

  // extra provider so space (and $) opens completions; grafana's provider only
  // triggers on $
  const registerSpaceCompletion = (_editor: MonacoEditor, monaco: Monaco) => {
    codeCompletionProvider?.dispose();
    codeCompletionProvider = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '$'],
      provideCompletionItems: (model, position) => {
        const lineText = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const prefix = (lineText.match(/[\w./-]*$/) || [''])[0];
        // only suggest what belongs after the nearest keyword: SELECT/WHERE take
        // columns, FROM takes urls
        const textBeforeCursor = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const keywords = textBeforeCursor.match(/\b(select|from|where|limit)\b/gi) || [];
        const lastKeyword = (keywords.length > 0 ? keywords[keywords.length - 1] : '').toLowerCase();
        const allSuggestions = codeEditorSuggestions();
        const suggestions = allSuggestions.filter(
          (s) =>
            (lastKeyword === 'from' ? s.detail === 'url' : lastKeyword === 'limit' ? false : s.detail !== 'url') &&
            (!prefix || s.label.toLowerCase().startsWith(prefix.toLowerCase()))
        );
        const items = suggestions.map((s) => ({
          label: s.label,
          detail: s.detail,
          insertText: s.label,
          kind: monaco.languages.CompletionItemKind.Field,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - prefix.length,
            endColumn: position.column,
          },
        }));
        return items.length > 0 ? { suggestions: items } : undefined;
      },
    });
  };

  const codeEditor = (
    <CodeEditor
      value={codeText}
      language="sql"
      onEditorDidMount={registerSpaceCompletion}
      onEditorWillUnmount={() => {
        codeCompletionProvider?.dispose();
        codeCompletionProvider = undefined;
      }}
      height={'100%'}
      showLineNumbers
      wordWrap
      showMiniMap={false}
      containerStyles={styles.codeEditorContainer}
      onChange={(v) => {
        props.onChange({ ...queryDefaulted, codeMode: true, codeText: v });
      }}
      getSuggestions={codeEditorSuggestions}
      onBlur={(v) => {
        parseCode(v);
      }}
      onSave={(v) => {
        parseCode(v);
      }}
    />
  );

  return (
    <>
      <div className={styles.row}>
        {!codeMode && (
          <SegmentSection label="FROM">
            <></>
          </SegmentSection>
        )}
        {codeMode ? (
          <>
            <InlineField grow>
              <InlineLabel> </InlineLabel>
            </InlineField>
            <InlineField>
              <InlineSwitch
                value={true}
                showLabel={true}
                label={'Code'}
                onChange={(e) => {
                  parseCode(codeText, true);
                }}
              />
            </InlineField>
          </>
        ) : (
          <>
            <Combobox
              isClearable={true}
              createCustomValue={true}
              value={queryDefaulted.table || '/'}
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
            <InlineField>
              <InlineSwitch
                value={false}
                showLabel={true}
                label={'Code'}
                onChange={(e) => {
                  props.onChange({ ...queryDefaulted, codeMode: true, codeText: buildCodeText() });
                  debouncedRunQuery();
                }}
              />
            </InlineField>
          </>
        )}
      </div>
      {codeMode && (
        <>
          {queryDefaulted.error ? <div style={{ color: 'var(--error-text, red)' }}>{queryDefaulted.error}</div> : <></>}
          <div className={styles.codeEditorRow}>{codeEditor}</div>
        </>
      )}
      {!codeMode && (
        <>
          <div className={styles.row} style={{ width: '100%' }}>
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
                    {queryDefaulted.columns.map((sel, index) => (
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
                                  const cols = [...queryDefaulted.columns];
                                  if (v === null) {
                                    // remove segment
                                    cols.splice(index, 1);
                                  } else {
                                    cols[index] = v.value;
                                  }
                                  commitColumns(cols);
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
              className={styles.ColumnPlusBtn}
              loadOptions={(filter?: string): Promise<SelectableValue[]> => {
                return loadColumns(filter).then((data) => {
                  return data.map((item) => {
                    return { value: item, label: item };
                  });
                });
              }}
              onChange={(v) => {
                const cols = [...queryDefaulted.columns];
                cols.push(v.value);
                commitColumns(cols);
              }}
              inputMinWidth={200}
            />
            <InlineField grow>
              <InlineLabel> </InlineLabel>
            </InlineField>
          </div>
          <div className={styles.row}>
            <SegmentSection label="WHERE">
              <></>
            </SegmentSection>
            <Input
              placeholder="condition..., ex.: ( host_name = '$host' OR host_alias ~ '^a' ) AND time = $time"
              value={queryDefaulted.condition?.toString()}
              onChange={(v) => {
                onValueChange('condition', v.currentTarget.value);
              }}
            />
          </div>
        </>
      )}
      <div className={styles.row}>
        <SegmentSection label="LIMIT">
          <></>
        </SegmentSection>
        <Input
          placeholder={defaultLimit.toString()}
          value={queryDefaulted.limit?.toString()}
          onChange={(v) => {
            const limit = Number(v.currentTarget.value);
            if (limit <= 0) {
              onValueChange('limit', defaultLimit);
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
          value={queryDefaulted.type || 'table'}
          options={[
            { label: 'Table', value: 'table' },
            { label: 'Timeseries', value: 'graph' },
            { label: 'Logs', value: 'logs' },
          ]}
          onChange={(v) => {
            onValueChange('type', v ? v.value : 'table');
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
                const inp = outputRef.current as HTMLInputElement;
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
                const inp = outputRef.current as HTMLInputElement;
                try {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(inp.value);
                  }
                  if (copyBtn.current) {
                    if ((copyBtn.current as any) instanceof HTMLButtonElement) {
                      const btn = copyBtn.current as HTMLButtonElement;
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
