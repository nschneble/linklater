import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SettingsSectionNav from './SettingsSectionNav';
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

function renderNav(properties: Parameters<typeof SettingsSectionNav>[0]) {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route
          path="/settings/:section?"
          element={<SettingsSectionNav {...properties} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

let scrollIntoViewMock: ReturnType<typeof vi.fn>;
let matchMediaMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigateMock.mockReset();
  scrollIntoViewMock = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoViewMock;

  matchMediaMock = vi.fn().mockReturnValue({ matches: false });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMediaMock,
  });
});

describe('SettingsSectionNav', () => {
  it('renders a nav landmark labelled "Settings sections (compact)"', () => {
    renderNav({ sections: SECTIONS, activeHash: 'account' });
    expect(
      screen.getByRole('navigation', {
        name: /settings sections \(compact\)/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders one chip button per section', () => {
    renderNav({ sections: SECTIONS, activeHash: 'account' });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(SECTIONS.length);
    expect(buttons[2]).toHaveAccessibleName(/integrations/i);
  });

  it('applies aria-current="page" to the active chip only', () => {
    renderNav({ sections: SECTIONS, activeHash: 'integrations' });
    const buttons = screen.getAllByRole('button');
    expect(buttons[2]).toHaveAttribute('aria-current', 'page');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
  });

  it('scrolls the active chip into view on mount', () => {
    renderNav({ sections: SECTIONS, activeHash: 'security' });
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inline: 'center',
        block: 'nearest',
        behavior: 'smooth',
      }),
    );
  });

  it('uses behavior="auto" when prefers-reduced-motion is set', () => {
    matchMediaMock.mockReturnValue({ matches: true });
    renderNav({ sections: SECTIONS, activeHash: 'security' });
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    );
  });

  it('navigates to the section path with an intent token when a chip is clicked', () => {
    renderNav({ sections: SECTIONS, activeHash: 'account' });
    fireEvent.click(screen.getByRole('button', { name: /integrations/i }));
    expect(navigateMock).toHaveBeenCalledWith('/settings/integrations', {
      state: { settingsIntent: expect.any(Number) },
    });
  });
});
