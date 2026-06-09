import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Alert from './Alert';

// These tests pin the resolved class strings for each variant so the
// bundle-token migration is caught the next time anyone touches the variant
// map. The actual color resolution happens at CSS time against
// `bundles.css`; this file only verifies the class strings the component
// emits.

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
});
