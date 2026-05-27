import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsSidebar from './SettingsSidebar';
import type { SettingsSection } from './settingsSections';

const SECTIONS: SettingsSection[] = [
  { hash: 'account', label: 'Account', icon: 'fa-user' },
  { hash: 'security', label: 'Security', icon: 'fa-shield-halved' },
  { hash: 'integrations', label: 'Integrations', icon: 'fa-plug' },
];

function renderSidebar(properties: Parameters<typeof SettingsSidebar>[0]) {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsSidebar {...properties} />
    </MemoryRouter>,
  );
}

describe('SettingsSidebar', () => {
  it('renders a nav landmark labelled "Settings sections"', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'account' });
    expect(
      screen.getByRole('navigation', { name: /settings sections/i }),
    ).toBeInTheDocument();
  });

  it('renders one anchor per section', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'account' });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(SECTIONS.length);
    expect(links[0]).toHaveAttribute('href', '#account');
    expect(links[2]).toHaveAttribute('href', '#integrations');
  });

  it('applies aria-current="location" to the active link only', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'security' });
    const links = screen.getAllByRole('link');
    expect(links[0]).not.toHaveAttribute('aria-current');
    expect(links[1]).toHaveAttribute('aria-current', 'location');
    expect(links[2]).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate with the hash when a link is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar({
      sections: SECTIONS,
      activeHash: 'account',
      onNavigate,
    });
    screen.getByRole('link', { name: /security/i }).click();
    expect(onNavigate).toHaveBeenCalledWith('security');
  });
});
