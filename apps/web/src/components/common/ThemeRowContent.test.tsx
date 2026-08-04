/*
 * Tests for ThemeRowContent – the role-agnostic theme-row CONTENT primitive
 * shared by the copy menu (menuitem ACTIONS) and the picker list
 * (menuitemradio SELECTIONS). It must render swatch + label + optional
 * accessible glyph and NOTHING interactive: no button, role, tabindex, or
 * selection state. Each host owns those (SC 4.1.2).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThemeRowContent from './ThemeRowContent';

describe('ThemeRowContent', () => {
  it('renders content only: no button, role, or tabindex', () => {
    const { container } = render(
      <ThemeRowContent
        label="Apollo"
        swatchSize="w-3.5 h-3.5"
        glyphSize="text-[0.5rem]"
      />,
    );
    expect(screen.getByText('Apollo')).toBeInTheDocument();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[role]')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    // no selection state leaks into the role-agnostic primitive
    expect(container.querySelector('[aria-checked]')).toBeNull();
    expect(container.querySelector('[aria-selected]')).toBeNull();
  });

  it('overlays the film glyph on the swatch when a swatchIcon is given', () => {
    const { container } = render(
      <ThemeRowContent
        label="Apollo"
        swatchIcon="fa-user-astronaut"
        accent="#4e89c9"
        swatchSize="w-3.5 h-3.5"
        glyphSize="text-[0.5rem]"
      />,
    );
    const glyph = container.querySelector('.fa-user-astronaut');
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits the film glyph when no swatchIcon is given', () => {
    const { container } = render(
      <ThemeRowContent
        label="Apollo"
        swatchSize="w-3.5 h-3.5"
        glyphSize="text-[0.5rem]"
      />,
    );
    // only the swatch span renders; no decorative <i> inside it
    expect(container.querySelector('i')).toBeNull();
  });

  it('renders the universal-access glyph + sr-only label when accessible', () => {
    const { container } = render(
      <ThemeRowContent
        label="Apollo"
        swatchSize="w-3.5 h-3.5"
        glyphSize="text-[0.5rem]"
        isAccessible
      />,
    );
    expect(container.querySelector('.fa-universal-access')).not.toBeNull();
    expect(screen.getByText('Accessible theme')).toHaveClass('sr-only');
  });

  it('omits the accessible affordance when not accessible', () => {
    const { container } = render(
      <ThemeRowContent
        label="Apollo"
        swatchSize="w-3.5 h-3.5"
        glyphSize="text-[0.5rem]"
      />,
    );
    expect(container.querySelector('.fa-universal-access')).toBeNull();
    expect(screen.queryByText('Accessible theme')).toBeNull();
  });

  it('renders an optional sr-only label suffix', () => {
    render(
      <ThemeRowContent
        label="Custom"
        swatchSize="w-5 h-5"
        glyphSize="text-[0.6rem]"
        labelSuffix={<span className="sr-only">, custom theme</span>}
      />,
    );
    expect(screen.getByText(', custom theme')).toHaveClass('sr-only');
  });

  it('renders a host-owned node between the label and the accessible glyph', () => {
    const { container } = render(
      <ThemeRowContent
        label="Apollo"
        swatchSize="w-5 h-5"
        glyphSize="text-[0.6rem]"
        afterLabel={<i className="fa-check" aria-hidden="true" />}
        isAccessible
      />,
    );
    const icons = Array.from(container.querySelectorAll('i'));
    const checkIndex = icons.findIndex((icon) =>
      icon.classList.contains('fa-check'),
    );
    const accessIndex = icons.findIndex((icon) =>
      icon.classList.contains('fa-universal-access'),
    );
    // the host adornment sits before the accessible glyph in DOM order
    expect(checkIndex).toBeGreaterThanOrEqual(0);
    expect(accessIndex).toBeGreaterThan(checkIndex);
  });
});
