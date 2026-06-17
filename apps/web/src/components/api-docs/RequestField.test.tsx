/**
 * Wave 6 co-located coverage (a11y-lead wave-5 Minor 2). RequestField adopts
 * the shared `FormInput` (surface="mount") this wave; these tests pin the a11y
 * contract that must hold through that swap:
 *
 *   - a real visible `<label htmlFor>` associated with the input;
 *   - the error node is ALWAYS mounted (empty → sr-only) so the
 *     `aria-describedby` target never dangles;
 *   - `aria-describedby` composes the description (when present) + error ids;
 *   - the inert (logged-out / loading) state uses `aria-disabled` + `readOnly`,
 *     never native `disabled`, so the field stays focusable and in the AT tree.
 */

import RequestField from './RequestField';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

interface RenderOptions {
  description?: string;
  error?: string;
  inert?: boolean;
  required?: boolean;
  value?: string;
}

const FIELD_ID = 'endpoint-get-links-param-query-tag';

function renderField(options: RenderOptions = {}) {
  const {
    description,
    error = '',
    inert = false,
    required = false,
    value = '',
  } = options;
  return render(
    <RequestField
      fieldId={FIELD_ID}
      label="tag"
      required={required}
      description={description}
      value={value}
      error={error}
      inert={inert}
      onValueChange={vi.fn()}
    />,
  );
}

describe('RequestField', () => {
  it('renders a real visible label associated with the input', () => {
    renderField();
    const input = screen.getByLabelText(/tag/);
    expect(input).toHaveAttribute('id', FIELD_ID);
  });

  it('keeps the error node mounted (sr-only) when there is no error', () => {
    const { container } = renderField({ error: '' });
    const errorNode = container.querySelector(`#${FIELD_ID}-error`);
    expect(errorNode).not.toBeNull();
    expect(errorNode?.className).toContain('sr-only');
  });

  it('shows the error text and points aria-describedby at it when invalid', () => {
    renderField({ error: 'Required value missing' });
    const input = screen.getByLabelText(/tag/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(
      `${FIELD_ID}-error`,
    );
    expect(screen.getByText('Required value missing')).toBeInTheDocument();
  });

  it('composes description + error ids into aria-describedby', () => {
    renderField({ description: 'Filter by tag', error: 'Bad value' });
    const input = screen.getByLabelText(/tag/);
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(`${FIELD_ID}-desc`);
    expect(describedBy).toContain(`${FIELD_ID}-error`);
  });

  it('uses aria-disabled + readOnly (never native disabled) when inert', () => {
    renderField({ inert: true });
    const input = screen.getByLabelText(/tag/);
    expect(input).toHaveAttribute('aria-disabled', 'true');
    expect(input).toHaveAttribute('readonly');
    expect(input).not.toBeDisabled();
  });
});
