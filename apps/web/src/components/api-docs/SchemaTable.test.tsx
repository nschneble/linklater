import SchemaTable from './SchemaTable';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

/** Resolve a disclosure trigger's panel <tr> via its `aria-controls` target. */
function panelForTrigger(trigger: HTMLElement): HTMLElement {
  const panelId = trigger.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  const panel = document.getElementById(panelId as string);
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

describe('SchemaTable', () => {
  const objectSchema: OpenAPIV3.SchemaObject = {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', description: 'The link to save.' },
      title: { type: 'string' },
    },
  };

  const twoNestedSchema: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      metadata: {
        type: 'object',
        properties: { source: { type: 'string' } },
      },
      owner: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  };

  it('renders a real table named by the supplied caption', () => {
    render(<SchemaTable caption="Request body" schema={objectSchema} />);
    const table = screen.getByRole('table', { name: 'Request body' });
    expect(table.tagName).toBe('TABLE');
  });

  it('is single-column: property cells are scope=row, no column headers', () => {
    render(<SchemaTable caption="Request body" schema={objectSchema} />);

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.length).toBeGreaterThan(0);
    rowHeaders.forEach((rowHeader) =>
      expect(rowHeader).toHaveAttribute('scope', 'row'),
    );
  });

  it('conveys required-ness with a "?" suffix on optional properties', () => {
    render(<SchemaTable caption="Request body" schema={objectSchema} />);

    const requiredHeader = screen.getByRole('rowheader', { name: /url/ });
    expect(requiredHeader.textContent).toMatch(/url:/);
    expect(requiredHeader.textContent).not.toMatch(/url\?/);

    const optionalHeader = screen.getByRole('rowheader', { name: /title/ });
    expect(optionalHeader.textContent).toMatch(/title\?:/);
  });

  it('renders the "No properties." fallback for an empty schema', () => {
    render(<SchemaTable caption="Request body" schema={{ type: 'object' }} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/No properties\./)).toBeInTheDocument();
  });

  it('gives a nested-object property a disclosure toggle, scalars none', () => {
    render(<SchemaTable caption="Request body" schema={twoNestedSchema} />);

    const trigger = screen.getByRole('button', { name: 'metadata' });
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded');
    expect(trigger).toHaveAttribute('aria-controls');
    // The toggle sits inside the property's row header (single-column table).
    expect(trigger.closest('th')).toHaveAttribute('scope', 'row');

    // A scalar property never gets a toggle.
    render(<SchemaTable caption="Request body" schema={objectSchema} />);
    expect(screen.queryByRole('button', { name: 'url' })).toBeNull();
  });

  it('contracts every nested schema by default when 2+ top-level rows', () => {
    render(<SchemaTable caption="Response body" schema={twoNestedSchema} />);

    const metadataTrigger = screen.getByRole('button', { name: 'metadata' });
    const ownerTrigger = screen.getByRole('button', { name: 'owner' });
    expect(metadataTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(ownerTrigger).toHaveAttribute('aria-expanded', 'false');

    expect(panelForTrigger(metadataTrigger)).toHaveAttribute('hidden');
    expect(panelForTrigger(ownerTrigger)).toHaveAttribute('hidden');

    // The collapsed panels' contents are out of the accessibility tree.
    expect(screen.queryByRole('rowheader', { name: /source/ })).toBeNull();
    expect(screen.queryByRole('rowheader', { name: /id/ })).toBeNull();
  });

  it('expands a lone top-level OBJECT property by default (depth 0, 1 row)', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        data: { type: 'object', properties: { id: { type: 'string' } } },
      },
    };
    render(<SchemaTable caption="Response body" schema={schema} />);

    const trigger = screen.getByRole('button', { name: 'data' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panelForTrigger(trigger)).not.toHaveAttribute('hidden');
    // The single property's nested value is in the tree without a click.
    expect(screen.getByRole('rowheader', { name: /id/ })).toBeInTheDocument();
  });

  it('expands a lone top-level ARRAY property by default (depth 0, 1 row)', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        links: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    };
    render(<SchemaTable caption="Response body" schema={schema} />);

    const trigger = screen.getByRole('button', { name: 'links' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panelForTrigger(trigger)).not.toHaveAttribute('hidden');
    expect(screen.getByRole('rowheader', { name: /id/ })).toBeInTheDocument();
  });

  it('keeps deeper levels contracted even in a single-property chain', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: {
            mid: {
              type: 'object',
              properties: { leaf: { type: 'string' } },
            },
          },
        },
      },
    };
    render(<SchemaTable caption="Response body" schema={schema} />);

    // Top level (depth 0, one row) is expanded...
    const outerTrigger = screen.getByRole('button', { name: 'outer' });
    expect(outerTrigger).toHaveAttribute('aria-expanded', 'true');

    // ...but the nested `mid` (depth 1) stays contracted despite being the
    // only row at its level — the exception is depth 0 only.
    const midTrigger = screen.getByRole('button', { name: 'mid' });
    expect(midTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(panelForTrigger(midTrigger)).toHaveAttribute('hidden');
    expect(screen.queryByRole('rowheader', { name: /leaf/ })).toBeNull();
  });

  it('round-trips a toggle: aria-expanded and hidden flip both ways', () => {
    render(<SchemaTable caption="Response body" schema={twoNestedSchema} />);

    const trigger = screen.getByRole('button', { name: 'metadata' });
    const panel = panelForTrigger(trigger);

    // Starts contracted.
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
    expect(screen.queryByRole('rowheader', { name: /source/ })).toBeNull();

    // Expands.
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
    expect(
      screen.getByRole('rowheader', { name: /source/ }),
    ).toBeInTheDocument();

    // Re-contracts.
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
    expect(screen.queryByRole('rowheader', { name: /source/ })).toBeNull();
  });

  it('does not model a phantom multi-column grid on the panel cell (1.3.1)', () => {
    render(<SchemaTable caption="Response body" schema={twoNestedSchema} />);

    const panel = panelForTrigger(
      screen.getByRole('button', { name: 'metadata' }),
    );
    const cell = panel.querySelector('td');
    expect(cell).not.toBeNull();
    // Single-column table: no colSpan attribute (defaults to 1), never 4.
    expect(cell).not.toHaveAttribute('colspan');
  });

  it('caps nesting with a text note, not another toggle, beyond two levels', () => {
    const deepSchema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: {
            mid: {
              type: 'object',
              properties: {
                inner: {
                  type: 'object',
                  properties: { leaf: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    };
    render(<SchemaTable caption="Response body" schema={deepSchema} />);

    // `outer` is expanded by default; `mid` must be opened to reach the cap.
    fireEvent.click(screen.getByRole('button', { name: 'mid' }));

    // At depth 2, `inner` collapses to a note rather than a third toggle.
    expect(
      screen.getByText(/Nested object – see full schema\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'inner' })).toBeNull();
  });
});
