/**
 * Wave 6 co-located coverage (a11y-lead wave-5 Minor 2). RequestBodyEditor
 * mirrors FormInput's mount token set this wave; these tests pin the a11y
 * contract that must hold through that swap:
 *
 *   - a real visible `<label htmlFor>` associated with the textarea;
 *   - the error node is ALWAYS mounted (empty → sr-only) so the
 *     `aria-describedby` target never dangles;
 *   - `aria-describedby` composes the description + error ids;
 *   - the inert state uses `aria-disabled` + `readOnly`, never native disabled.
 */

import RequestBodyEditor from './RequestBodyEditor';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const FIELD_ID = 'endpoint-post-links-body';

interface RenderOptions {
  error?: string;
  inert?: boolean;
  value?: string;
}

function renderEditor(options: RenderOptions = {}) {
  const { error = '', inert = false, value = '{}' } = options;
  return render(
    <RequestBodyEditor
      fieldId={FIELD_ID}
      value={value}
      error={error}
      inert={inert}
      onValueChange={vi.fn()}
    />,
  );
}

describe('RequestBodyEditor', () => {
  it('renders a real visible label associated with the textarea', () => {
    renderEditor();
    const textarea = screen.getByLabelText('Request body (JSON)');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('id', FIELD_ID);
  });

  it('keeps the error node mounted (sr-only) when there is no error', () => {
    const { container } = renderEditor({ error: '' });
    const errorNode = container.querySelector(`#${FIELD_ID}-error`);
    expect(errorNode).not.toBeNull();
    expect(errorNode?.className).toContain('sr-only');
  });

  it('flips aria-invalid and shows the parse error when invalid', () => {
    renderEditor({ error: 'Invalid JSON', value: '{' });
    const textarea = screen.getByLabelText('Request body (JSON)');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
  });

  it('always composes description + error ids into aria-describedby', () => {
    renderEditor();
    const textarea = screen.getByLabelText('Request body (JSON)');
    const describedBy = textarea.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(`${FIELD_ID}-desc`);
    expect(describedBy).toContain(`${FIELD_ID}-error`);
  });

  it('uses aria-disabled + readOnly (never native disabled) when inert', () => {
    renderEditor({ inert: true });
    const textarea = screen.getByLabelText('Request body (JSON)');
    expect(textarea).toHaveAttribute('aria-disabled', 'true');
    expect(textarea).toHaveAttribute('readonly');
    expect(textarea).not.toBeDisabled();
  });
});
