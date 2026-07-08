import ParameterTable from './ParameterTable';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NormalizedParameter } from '../../lib/openapi';

// A single-location list (all query). The caller partitions by location and
// picks the caption; ParameterTable no longer carries a per-row "In" column.
const parameters: NormalizedParameter[] = [
  {
    name: 'id',
    location: 'query',
    required: true,
    description: 'The link id.',
    schema: { type: 'string' },
  },
  {
    name: 'search',
    location: 'query',
    required: false,
    schema: { type: 'string' },
  },
];

describe('ParameterTable', () => {
  it('renders a real table with the supplied location caption (T1/T2)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );
    const table = screen.getByRole('table', {
      name: 'Query Parameters',
    });
    expect(table.tagName).toBe('TABLE');
  });

  it('renders each parameter as a scope=row header, no column-header row (T2)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );

    // The spruced table dropped the column-header row: each parameter is a
    // single scope=row header carrying its name, type and description.
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders).toHaveLength(2);
    rowHeaders.forEach((header) =>
      expect(header).toHaveAttribute('scope', 'row'),
    );

    // The name header inlines the type from describeType().
    const idHeader = screen.getByRole('rowheader', { name: /^id:/ });
    expect(idHeader).toHaveTextContent('string');
  });

  it('renders no per-row location cell (the caption carries the location)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );
    // The "query"/"path" location strings are no longer painted as cells.
    expect(screen.queryByText('query')).not.toBeInTheDocument();
    expect(screen.queryByText('path')).not.toBeInTheDocument();
  });

  it('marks optional params with a trailing ? and required params without one (T3)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );

    // Required-ness now rides on the parameter name: required is bare, optional
    // gains a trailing "?" (parity with the schema tables).
    expect(screen.getByRole('rowheader', { name: /^id:/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('rowheader', { name: /^id\?/ }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('rowheader', { name: /^search\?:/ }),
    ).toBeInTheDocument();
  });
});
