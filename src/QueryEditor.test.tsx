import { ReactElement } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from './datasource';
import { QueryEditor } from './QueryEditor';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useRef: () => ({ current: null }),
  useEffect: () => undefined,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: jest.fn((props: any) => <div data-testid="code-editor" {...props} />),
  InlineSwitch: jest.fn((props: any) => <button data-testid="code-switch" {...props} />),
}));

test.each([
  { data: { meta: { columns: [{ name: 'name' }, { name: 'state' }] }, data: [] } },
  { data: { meta: {}, data: [{ name: 'host1', state: 0 }] } },
  { data: [{ name: 'host1', state: 0 }] },
  { data: { name: 'host1', state: 0 } },
  { data: [] },
])('discovers columns from metadata or legacy responses: %j', async (response) => {
  (getTemplateSrv as jest.Mock).mockReturnValue({ replace: (value: string) => value, getVariables: () => [] });
  const datasource = new DataSource({} as any);
  const request = jest.spyOn(datasource, 'request').mockResolvedValue(response);
  const editor = QueryEditor({
    datasource,
    query: { refId: 'A', table: '/hosts', columns: ['*'], condition: '', limit: 1000, type: 'table' },
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  });
  const addColumn = findElement(editor, (el) => el.props.value === '+');
  const options = await addColumn.props.loadOptions();
  expect(request).toHaveBeenCalledWith('GET', '/hosts?limit=1', null, {
    'X-Thruk-Output-Metadata-Only': '1',
    'X-THRUK-OutputFormat': 'wrapped_json',
    'x-thruk-columns': true,
  });
  const expected = Array.isArray(response.data) && !response.data.length ? ['uniq()', '*'] : ['name', 'state'];
  expect(options.map((option: { value: string }) => option.value).slice(-2)).toEqual(expected);
});

const makeEditor = (query: any, onChange: jest.Mock, onRunQuery: jest.Mock) => {
  (getTemplateSrv as jest.Mock).mockReturnValue({ replace: (value: string) => value, getVariables: () => [] });
  const datasource = new DataSource({} as any);
  jest.spyOn(datasource, 'request').mockResolvedValue({ data: { meta: {}, data: [] } });
  return QueryEditor({ datasource, query, onChange, onRunQuery } as any);
};

const isElement = (c: unknown): c is ReactElement =>
  !!c && typeof c === 'object' && (c as ReactElement).type !== undefined;

const findElement = (root: ReactElement, predicate: (el: ReactElement) => boolean): ReactElement => {
  let found: ReactElement | undefined;
  const walk = (elements: ReactElement[]) => {
    for (const el of elements) {
      if (predicate(el)) {
        found = el;
        return;
      }
      const children = el.props.children;
      if (Array.isArray(children)) {
        walk(children.filter(isElement));
        if (found) {
          return;
        }
      } else if (isElement(children)) {
        walk([children]);
        if (found) {
          return;
        }
      }
    }
  };
  walk((root.props.children as unknown[]).filter(isElement));
  if (!found) {
    throw new Error('element not found');
  }
  return found!;
};

test('code mode round-trips between form fields and raw query', () => {
  const onChange = jest.fn();
  const editor = makeEditor(
    { refId: 'A', table: '/hosts', columns: ['name', 'state'], condition: 'state = 0', limit: 42, type: 'table' },
    onChange,
    jest.fn()
  );
  // default (form) mode: no code editor, switch off
  expect((editor.props.children as unknown[]).filter(isElement).some((child) => child.props.language === 'sql')).toBe(
    false
  );
  const codeSwitch = (root: ReactElement) => findElement(root, (el) => el.props.label === 'Code');
  expect(codeSwitch(editor).props.value).toBe(false);

  codeSwitch(editor).props.onChange();
  const codeQuery = onChange.mock.calls.at(-1)[0];
  expect(codeQuery.codeMode).toBe(true);
  expect(codeQuery.codeText).toBe('SELECT\n  name, state\nFROM /hosts\nWHERE state = 0\nLIMIT 42');

  const codeEditorEl = findElement(
    makeEditor({ ...codeQuery, refId: 'A' }, jest.fn(), jest.fn()),
    (el) => el.props.language === 'sql'
  );
  expect(codeEditorEl.props.value).toBe('SELECT\n  name, state\nFROM /hosts\nWHERE state = 0\nLIMIT 42');

  // switch back: parses the raw query into form fields
  const onChange2 = jest.fn();
  const editor2 = makeEditor(codeQuery, onChange2, jest.fn());
  codeSwitch(editor2).props.onChange();
  const parsed = onChange2.mock.calls.at(-1)[0];
  expect(parsed.table).toBe('/hosts');
  expect(parsed.columns).toEqual(['name', 'state']);
  expect(parsed.condition).toBe('state = 0');
  expect(parsed.limit).toBe(42);
  expect(parsed.codeMode).toBe(false);
});

test('code mode keeps unsaved text and reports parse errors', () => {
  const onChange = jest.fn();
  const editor = makeEditor(
    { refId: 'A', table: '/hosts', columns: ['name'], codeMode: true, codeText: 'SELECT bogus' },
    onChange,
    jest.fn()
  );
  const codeEditorEl = findElement(editor, (el) => el.props.language === 'sql');
  // switching back with an unparseable query keeps the text and sets an error
  findElement(editor, (el) => el.props.label === 'Code').props.onChange();
  const badQuery = onChange.mock.calls.at(-1)[0];
  expect(badQuery.codeMode).toBe(true);
  expect(badQuery.codeText).toBe('SELECT bogus');
  expect(badQuery.error).toContain('query syntax error');
  // the raw text is kept while typing
  codeEditorEl.props.onChange('SELECT name FROM /hosts');
  const typedQuery = onChange.mock.calls.at(-1)[0];
  expect(typedQuery.codeMode).toBe(true);
  expect(typedQuery.codeText).toBe('SELECT name FROM /hosts');
});
