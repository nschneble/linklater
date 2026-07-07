import ParameterTable from './ParameterTable';
import { render, screen, within } from '@testing-library/react';
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

  it('uses scope=col headers and scope=row on the parameter cell, with no In column (T2)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.map((header) => header.textContent)).toEqual([
      'Parameter',
      'Type',
      'Required',
      'Description',
    ]);
    columnHeaders.forEach((header) =>
      expect(header).toHaveAttribute('scope', 'col'),
    );

    const rowHeader = screen.getByRole('rowheader', { name: 'id' });
    expect(rowHeader).toHaveAttribute('scope', 'row');
  });

  it('renders no per-row location cell (the caption carries the location)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );
    // The "query"/"path" location strings are no longer painted as cells.
    expect(screen.queryByText('query')).not.toBeInTheDocument();
    expect(screen.queryByText('path')).not.toBeInTheDocument();
  });

  it('conveys required-ness as the words Yes / No (T3)', () => {
    render(
      <ParameterTable caption="Query Parameters" parameters={parameters} />,
    );

    const requiredRow = screen
      .getByRole('rowheader', { name: 'id' })
      .closest('tr');
    expect(
      within(requiredRow as HTMLElement).getByText('Yes'),
    ).toBeInTheDocument();

    const optionalRow = screen
      .getByRole('rowheader', { name: 'search' })
      .closest('tr');
    expect(
      within(optionalRow as HTMLElement).getByText('No'),
    ).toBeInTheDocument();
  });
});
