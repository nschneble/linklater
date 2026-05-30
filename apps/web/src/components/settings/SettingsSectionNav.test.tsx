import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsSectionNav from './SettingsSectionNav';
import type { SettingsSection } from './settingsSections';

const SECTIONS: SettingsSection[] = [
  { hash: 'account', label: 'Account', icon: 'fa-user' },
  { hash: 'security', label: 'Security', icon: 'fa-shield-halved' },
  { hash: 'integrations', label: 'Integrations', icon: 'fa-plug' },
];

let onSelectSection: ReturnType<typeof vi.fn>;

function renderNav(
  overrides: Partial<Parameters<typeof SettingsSectionNav>[0]> = {},
) {
  return render(
    <SettingsSectionNav
      sections={SECTIONS}
      activeSection=""
      onSelectSection={onSelectSection}
      {...overrides}
    />,
  );
}

describe('SettingsSectionNav', () => {
  beforeEach(() => {
    onSelectSection = vi.fn();
  });

  it('renders a nav landmark labelled "Settings sections (compact)"', () => {
    renderNav();
    expect(
      screen.getByRole('navigation', {
        name: /settings sections \(compact\)/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders one chip button per section', () => {
    renderNav();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(SECTIONS.length);
    expect(buttons[2]).toHaveAccessibleName(/integrations/i);
  });

  it('applies aria-current="page" to the active chip only', () => {
    renderNav({ activeSection: 'integrations' });
    expect(
      screen.getByRole('button', { name: /integrations/i }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('button', { name: /account/i }),
    ).not.toHaveAttribute('aria-current');
  });

  it('calls onSelectSection with the section hash when a chip is clicked', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /integrations/i }));
    expect(onSelectSection).toHaveBeenCalledWith('integrations');
  });
});
