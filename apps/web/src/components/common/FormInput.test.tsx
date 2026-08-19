/*
 * Tests for FormInput, the themed text input shared across forms.
 *
 * The load-bearing piece is the `surface` prop. It names the host bundle
 * (base = page chrome, mount = card / settings panel / auth card) and the
 * component derives its own paint internally. These tests pin the resolved
 * class strings per surface so the bundle-token contract is locked: any
 * future rewire of the variant map gets caught here, and CSS-time color
 * resolution stays the only moving part.
 *
 * Forwarded ref + native-attribute pass-through are also pinned because
 * callers (LinkForm auto-focus, AuthForm re-focus on mode change) depend
 * on them.
 */

import { compileClasses } from '../../../test/tailwind';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { FOCUS_RING_FLUSH } from '../../lib/styles';
import FormInput from './FormInput';

describe('FormInput', () => {
  it('defaults to base surface – paints from base-input-bg / base-border / base-text / base-alt-text', () => {
    const { getByRole } = render(<FormInput type="text" aria-label="x" />);
    const className = getByRole('textbox').className;
    expect(className).toContain('bg-[var(--base-input-bg)]');
    expect(className).toContain('border-[var(--base-border)]');
    expect(className).toContain('text-[var(--base-text)]');
    expect(className).toContain('placeholder:text-[var(--base-alt-text)]');
  });

  it('surface="base" explicitly matches the default', () => {
    const { getByRole } = render(
      <FormInput type="text" surface="base" aria-label="x" />,
    );
    const className = getByRole('textbox').className;
    expect(className).toContain('bg-[var(--base-input-bg)]');
    expect(className).toContain('border-[var(--base-border)]');
    expect(className).toContain('text-[var(--base-text)]');
    expect(className).toContain('placeholder:text-[var(--base-alt-text)]');
  });

  it('surface="mount" paints from mount-input-bg / mount-border / mount-text / mount-alt-text', () => {
    const { getByRole } = render(
      <FormInput type="text" surface="mount" aria-label="x" />,
    );
    const className = getByRole('textbox').className;
    expect(className).toContain('bg-[var(--mount-input-bg)]');
    expect(className).toContain('border-[var(--mount-border)]');
    expect(className).toContain('text-[var(--mount-text)]');
    expect(className).toContain('placeholder:text-[var(--mount-alt-text)]');
  });

  /*
   * A read-only field swallows keystrokes, and screen readers say so. Every
   * other control this form locks changes visibly, so a field that looks
   * exactly like the one the user was typing into a moment ago is the odd
   * one out. A dashed border carries it in every theme, which a fill swap
   * would not: eight of the shipped cascades set --{surface}-input-bg to
   * the same value as --{surface}-bg.
   */
  it('marks a read-only field as one, since nothing else does', () => {
    const { getByRole } = render(
      <FormInput type="text" readOnly aria-label="x" />,
    );
    const className = getByRole('textbox').className;
    expect(className).toContain('read-only:not-disabled:border-dashed');
    expect(className).toContain('read-only:not-disabled:cursor-default');
  });

  // CSS :read-only also matches a disabled input, which is a different state
  it('leaves a natively disabled field to the treatment it already had', async () => {
    const css = await compileClasses([
      'read-only:not-disabled:border-dashed',
      'read-only:not-disabled:cursor-default',
    ]);
    expect(css).toContain(':read-only:not(:disabled)');
    expect(css).toContain('border-style: dashed');
    expect(css).toContain('cursor: default');
  });

  it('drops the opposite surface classes – base surface omits mount-* paint', () => {
    const { getByRole } = render(<FormInput type="text" aria-label="x" />);
    const className = getByRole('textbox').className;
    expect(className).not.toContain('var(--mount-input-bg)');
    expect(className).not.toContain('var(--mount-border)');
  });

  it('drops the opposite surface classes – mount surface omits base-* paint', () => {
    const { getByRole } = render(
      <FormInput type="text" surface="mount" aria-label="x" />,
    );
    const className = getByRole('textbox').className;
    expect(className).not.toContain('var(--base-input-bg)');
    expect(className).not.toContain('var(--base-border)');
  });

  it('forwards its ref to the underlying input', () => {
    const reference = createRef<HTMLInputElement>();
    render(<FormInput ref={reference} type="text" aria-label="x" />);
    expect(reference.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through a caller className without dropping surface classes', () => {
    const { getByRole } = render(
      <FormInput type="text" className="custom-marker" aria-label="x" />,
    );
    const className = getByRole('textbox').className;
    expect(className).toContain('custom-marker');
    expect(className).toContain('bg-[var(--base-input-bg)]');
  });

  it('forwards native input attributes (type, placeholder, required, aria-describedby)', () => {
    const { getByRole } = render(
      <FormInput
        type="email"
        placeholder="you@example.com"
        required
        aria-describedby="hint"
        aria-label="email"
      />,
    );
    const input = getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('you@example.com');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe('hint');
  });

  it('forwards value + onChange so callers can drive controlled inputs', () => {
    const handleChange = vi.fn();
    const { getByRole } = render(
      <FormInput
        type="text"
        value="hello"
        onChange={handleChange}
        aria-label="x"
      />,
    );
    const input = getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('hello');
    fireEvent.change(input, { target: { value: 'world' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('sits the focus outline flush, where its own border was', () => {
    const { getByRole } = render(<FormInput type="text" aria-label="x" />);
    const className = getByRole('textbox').className;
    expect(className).toContain(FOCUS_RING_FLUSH);
  });

  it('ships a 16px mobile font to avoid iOS Safari auto-zoom on focus', () => {
    const { getByRole } = render(<FormInput type="text" aria-label="x" />);
    const className = getByRole('textbox').className;
    expect(className).toContain('text-base');
    expect(className).toContain('sm:text-sm');
  });
});
