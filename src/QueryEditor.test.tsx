import { ReactElement } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from './datasource';
import { QueryEditor } from './QueryEditor';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useRef: () => ({ current: null }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(),
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
  const addColumn = editor.props.children[1].props.children.find((child: ReactElement) => child.props.value === '+');
  const options = await addColumn.props.loadOptions();
  expect(request).toHaveBeenCalledWith('GET', '/hosts?limit=1', null, {
    'X-Thruk-Output-Metadata-Only': '1',
    'X-THRUK-OutputFormat': 'wrapped_json',
    'x-thruk-columns': true,
  });
  const expected = Array.isArray(response.data) && !response.data.length ? ['uniq()', '*'] : ['name', 'state'];
  expect(options.map((option: { value: string }) => option.value).slice(-2)).toEqual(expected);
});
