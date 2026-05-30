import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsSidebar from './SettingsSidebar';
import type { SettingsSection } from './settingsSections';

const SECTIONS: SettingsSection[] = [
  { hash: 'account', label: 'Account', icon: 'fa-user' },
  { hash: 'security', label: 'Security', icon: 'fa-shield-halved' },
  { hash: 'integrations', label: 'Integrations', icon: 'fa-plug' },
];

let onSelectSection: ReturnType<typeof vi.fn>;
let onBackToTop: ReturnType<typeof vi.fn>;

function renderSidebar(
  overrides: Partial<Parameters<typeof SettingsSidebar>[0]> = {},
) {
  return render(
    <SettingsSidebar
      sections={SECTIONS}
      activeSection=""
      onSelectSection={onSelectSection}
      onBackToTop={onBackToTop}
      {...overrides}
    />,
  );
}

describe('SettingsSidebar', () => {
  beforeEach(() => {
    onSelectSection = vi.fn();
    onBackToTop = vi.fn();
  });

  it('renders a nav landmark labelled "Settings sections"', () => {
    renderSidebar();
    expect(
      screen.getByRole('navigation', { name: /settings sections/i }),
    ).toBeInTheDocument();
  });

  it('renders one button per section plus a back-to-top button', () => {
    renderSidebar();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(SECTIONS.length + 1);
    expect(buttons[0]).toHaveAccessibleName(/account/i);
    expect(buttons[2]).toHaveAccessibleName(/integrations/i);
    expect(buttons[3]).toHaveAccessibleName(/back to top/i);
  });

  it('applies aria-current="page" to the active section button only', () => {
    renderSidebar({ activeSection: 'security' });
    expect(
      screen.getByRole('button', { name: /account/i }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /security/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: /integrations/i }),
    ).not.toHaveAttribute('aria-current');
  });

  it('calls onSelectSection with the section hash when clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /security/i }));
    expect(onSelectSection).toHaveBeenCalledWith('security');
  });

  it('calls onBackToTop when the back-to-top button is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /back to top/i }));
    expect(onBackToTop).toHaveBeenCalledOnce();
  });
});
