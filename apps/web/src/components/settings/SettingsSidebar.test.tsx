import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsSidebar from './SettingsSidebar';
import type { SettingsSection } from './settingsSections';

const SECTIONS: SettingsSection[] = [
  { hash: 'account', label: 'Account', icon: 'fa-user' },
  { hash: 'security', label: 'Security', icon: 'fa-shield-halved' },
  { hash: 'integrations', label: 'Integrations', icon: 'fa-plug' },
];

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderSidebar(
  properties: Parameters<typeof SettingsSidebar>[0],
  route = '/settings',
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/settings/:section?"
          element={<SettingsSidebar {...properties} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsSidebar', () => {
  beforeEach(() => navigateMock.mockReset());

  it('renders a nav landmark labelled "Settings sections"', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'account' });
    expect(
      screen.getByRole('navigation', { name: /settings sections/i }),
    ).toBeInTheDocument();
  });

  it('renders one button per section', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'account' });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(SECTIONS.length);
    expect(buttons[0]).toHaveAccessibleName(/account/i);
    expect(buttons[2]).toHaveAccessibleName(/integrations/i);
  });

  it('applies aria-current="page" to the active button only', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'security' });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'page');
    expect(buttons[2]).not.toHaveAttribute('aria-current');
  });

  it('calls navigate with the section path when a button is clicked', () => {
    renderSidebar({ sections: SECTIONS, activeHash: 'account' });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));
    expect(navigateMock).toHaveBeenCalledWith('/settings/security');
  });
});
