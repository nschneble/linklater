import ParameterTable from './ParameterTable';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NormalizedParameter } from '../../lib/openapi';

const parameters: NormalizedParameter[] = [
  {
    name: 'id',
    location: 'path',
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
  it('renders a real table with the supplied caption (T1/T2)', () => {
    render(
      <ParameterTable
        caption="Path & query parameters"
        parameters={parameters}
      />,
    );
    const table = screen.getByRole('table', {
      name: 'Path & query parameters',
    });
    expect(table.tagName).toBe('TABLE');
  });

  it('uses scope=col headers and scope=row on the parameter cell (T2)', () => {
    render(
      <ParameterTable
        caption="Path & query parameters"
        parameters={parameters}
      />,
    );

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.map((header) => header.textContent)).toEqual([
      'Parameter',
      'In',
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

  it('shows the parameter location in the In column', () => {
    render(
      <ParameterTable
        caption="Path & query parameters"
        parameters={parameters}
      />,
    );

    const pathRow = screen.getByRole('rowheader', { name: 'id' }).closest('tr');
    expect(
      within(pathRow as HTMLElement).getByText('path'),
    ).toBeInTheDocument();

    const queryRow = screen
      .getByRole('rowheader', { name: 'search' })
      .closest('tr');
    expect(
      within(queryRow as HTMLElement).getByText('query'),
    ).toBeInTheDocument();
  });

  it('conveys required-ness as the words Required / Optional (T3)', () => {
    render(
      <ParameterTable
        caption="Path & query parameters"
        parameters={parameters}
      />,
    );

    const requiredRow = screen
      .getByRole('rowheader', { name: 'id' })
      .closest('tr');
    expect(
      within(requiredRow as HTMLElement).getByText('Required'),
    ).toBeInTheDocument();

    const optionalRow = screen
      .getByRole('rowheader', { name: 'search' })
      .closest('tr');
    expect(
      within(optionalRow as HTMLElement).getByText('Optional'),
    ).toBeInTheDocument();
  });
});
