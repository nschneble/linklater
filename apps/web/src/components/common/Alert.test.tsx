import Alert from './Alert';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

// pins each variant's resolved class strings to catch bundle-token drift

describe('Alert', () => {
  it('uses the alert bundle tokens for the error variant', () => {
    const { getByRole } = render(<Alert variant="error">Boom</Alert>);
    const className = getByRole('alert').className;
    expect(className).toContain('bg-[var(--alert-bg)]');
    expect(className).toContain('border-[var(--alert-border)]');
    expect(className).toContain('text-[var(--alert-text)]');
  });

  it('uses the success bundle tokens for the success variant', () => {
    const { getByRole } = render(<Alert variant="success">OK</Alert>);
    const className = getByRole('status').className;
    expect(className).toContain('bg-[var(--success-bg)]');
    expect(className).toContain('border-[var(--success-border)]');
    expect(className).toContain('text-[var(--success-text)]');
  });

  it('emits role="alert" for the error variant', () => {
    const { getByRole } = render(<Alert variant="error">Boom</Alert>);
    expect(getByRole('alert')).toBeTruthy();
  });

  it('emits role="status" for the success variant', () => {
    const { getByRole } = render(<Alert variant="success">OK</Alert>);
    expect(getByRole('status')).toBeTruthy();
  });

  it('renders the default error icon', () => {
    const { container } = render(<Alert variant="error">Boom</Alert>);
    expect(container.querySelector('i.fa-circle-exclamation')).toBeTruthy();
  });

  it('renders the default success icon', () => {
    const { container } = render(<Alert variant="success">OK</Alert>);
    expect(container.querySelector('i.fa-circle-check')).toBeTruthy();
  });

  it('allows overriding the icon', () => {
    const { container } = render(
      <Alert variant="error" icon="fa-skull">
        Boom
      </Alert>,
    );
    expect(container.querySelector('i.fa-skull')).toBeTruthy();
    expect(container.querySelector('i.fa-circle-exclamation')).toBeFalsy();
  });

  it('keeps a hidden placeholder when children is empty', () => {
    const { container } = render(
      <Alert variant="error" id="form-error">
        {null}
      </Alert>,
    );
    const placeholder = container.querySelector('#form-error');
    expect(placeholder).toBeTruthy();
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder?.className).toContain('sr-only');
  });

  it('forwards inert to the rendered alert when set', () => {
    const { getByRole } = render(
      <Alert variant="error" inert>
        Boom
      </Alert>,
    );
    expect(getByRole('alert', { hidden: true })).toHaveAttribute('inert');
  });

  it('forwards inert to the empty placeholder branch when set', () => {
    const { container } = render(
      <Alert variant="error" id="form-error" inert>
        {null}
      </Alert>,
    );
    expect(container.querySelector('#form-error')).toHaveAttribute('inert');
  });

  it('omits inert by default so existing callers are unaffected', () => {
    const { getByRole } = render(<Alert variant="error">Boom</Alert>);
    expect(getByRole('alert')).not.toHaveAttribute('inert');
  });
});
