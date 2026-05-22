import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsGroup from './SettingsGroup';

describe('SettingsGroup', () => {
  it('renders the title as an h2', () => {
    render(
      <SettingsGroup id="account" title="Account">
        <p>content</p>
      </SettingsGroup>,
    );
    const heading = screen.getByRole('heading', { level: 2, name: /account/i });
    expect(heading).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <SettingsGroup
        id="account"
        title="Account"
        description="Manage your stuff."
      >
        <p>content</p>
      </SettingsGroup>,
    );
    expect(screen.getByText('Manage your stuff.')).toBeInTheDocument();
  });

  it('exposes the id as the section anchor', () => {
    render(
      <SettingsGroup id="power" title="Power tools">
        <p>content</p>
      </SettingsGroup>,
    );
    const section = document.getElementById('power');
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe('SECTION');
  });

  it('is focusable via tabIndex=-1 so deep links can move focus to it', () => {
    render(
      <SettingsGroup id="power" title="Power tools">
        <p>content</p>
      </SettingsGroup>,
    );
    expect(document.getElementById('power')).toHaveAttribute('tabindex', '-1');
  });

  it('aria-labelledby points to the heading id', () => {
    render(
      <SettingsGroup id="power" title="Power tools">
        <p>content</p>
      </SettingsGroup>,
    );
    const section = document.getElementById('power');
    expect(section).toHaveAttribute('aria-labelledby', 'power-heading');
    expect(document.getElementById('power-heading')).toHaveTextContent(
      'Power tools',
    );
  });

  it('applies rose-tinted classes when variant="danger"', () => {
    render(
      <SettingsGroup id="danger" title="Danger zone" variant="danger">
        <p>content</p>
      </SettingsGroup>,
    );
    const section = document.getElementById('danger');
    expect(section?.className).toMatch(/rose-/);
  });

  it('renders the icon when provided', () => {
    render(
      <SettingsGroup id="account" title="Account" icon="fa-user">
        <p>content</p>
      </SettingsGroup>,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    const icon = heading.querySelector('i');
    expect(icon).not.toBeNull();
    expect(icon?.className).toMatch(/fa-user/);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders children inside the section', () => {
    render(
      <SettingsGroup id="account" title="Account">
        <p data-testid="child">child content</p>
      </SettingsGroup>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
