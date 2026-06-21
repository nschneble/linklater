import SchemaTable from './SchemaTable';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

describe('SchemaTable', () => {
  const objectSchema: OpenAPIV3.SchemaObject = {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', description: 'The link to save.' },
      title: { type: 'string' },
    },
  };

  it('renders a real table with the supplied caption (T1/T2)', () => {
    render(<SchemaTable caption="Request body" schema={objectSchema} />);
    const table = screen.getByRole('table', { name: 'Request body' });
    expect(table.tagName).toBe('TABLE');
  });

  it('uses scope=col headers and scope=row on the property cell (T2)', () => {
    render(<SchemaTable caption="Request body" schema={objectSchema} />);

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.map((header) => header.textContent)).toEqual([
      'Property',
      'Type',
      'Required',
      'Description',
    ]);
    columnHeaders.forEach((header) =>
      expect(header).toHaveAttribute('scope', 'col'),
    );

    const rowHeader = screen.getByRole('rowheader', { name: 'url' });
    expect(rowHeader).toHaveAttribute('scope', 'row');
  });

  it('conveys required-ness as the words Required / Optional (T3)', () => {
    render(<SchemaTable caption="Request body" schema={objectSchema} />);

    const requiredRow = screen
      .getByRole('rowheader', { name: 'url' })
      .closest('tr');
    expect(
      within(requiredRow as HTMLElement).getByText('Required'),
    ).toBeInTheDocument();

    const optionalRow = screen
      .getByRole('rowheader', { name: 'title' })
      .closest('tr');
    expect(
      within(optionalRow as HTMLElement).getByText('Optional'),
    ).toBeInTheDocument();
  });

  it('renders the "No properties." fallback for an empty schema (T5)', () => {
    render(<SchemaTable caption="Request body" schema={{ type: 'object' }} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/No properties\./)).toBeInTheDocument();
  });

  it('renders a nested child table for a nested object one level deep (T4)', () => {
    const nestedSchema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: { source: { type: 'string' } },
        },
      },
    };

    render(<SchemaTable caption="Request body" schema={nestedSchema} />);
    expect(
      screen.getByRole('table', { name: 'metadata properties' }),
    ).toBeInTheDocument();
  });

  it('renders a text note instead of a third table beyond one level (T4)', () => {
    // Two levels of nesting: the top table expands `outer`, the child table
    // hits depth 1 and must collapse `inner` to a note rather than recurse.
    const deepSchema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: {
            inner: {
              type: 'object',
              properties: { leaf: { type: 'string' } },
            },
          },
        },
      },
    };

    render(<SchemaTable caption="Request body" schema={deepSchema} />);

    // The first nested level renders as a table...
    expect(
      screen.getByRole('table', { name: 'outer properties' }),
    ).toBeInTheDocument();
    // ...but the second level is a text note, not a third table.
    expect(
      screen.queryByRole('table', { name: 'inner properties' }),
    ).toBeNull();
    expect(
      screen.getByText(/Nested object – see full schema\./),
    ).toBeInTheDocument();
  });
});
