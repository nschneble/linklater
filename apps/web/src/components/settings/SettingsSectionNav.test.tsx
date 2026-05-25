import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SettingsSectionNav from './SettingsSectionNav';
import type { SettingsSection } from './settingsSections';

const SECTIONS: SettingsSection[] = [
  { hash: 'account', label: 'Account', icon: 'fa-user' },
  { hash: 'security', label: 'Security', icon: 'fa-shield-halved' },
  { hash: 'integrations', label: 'Integrations', icon: 'fa-plug' },
];

let scrollIntoViewMock: ReturnType<typeof vi.fn>;
let matchMediaMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
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
  it('renders a nav landmark labelled "Settings sections"', () => {
    render(<SettingsSectionNav sections={SECTIONS} activeHash="account" />);
    expect(
      screen.getByRole('navigation', { name: /settings sections/i }),
    ).toBeInTheDocument();
  });

  it('renders one chip anchor per section', () => {
    render(<SettingsSectionNav sections={SECTIONS} activeHash="account" />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(SECTIONS.length);
    expect(links[2]).toHaveAttribute('href', '#integrations');
  });

  it('applies aria-current="location" to the active chip only', () => {
    render(
      <SettingsSectionNav sections={SECTIONS} activeHash="integrations" />,
    );
    const links = screen.getAllByRole('link');
    expect(links[2]).toHaveAttribute('aria-current', 'location');
    expect(links[0]).not.toHaveAttribute('aria-current');
  });

  it('scrolls the active chip into view on mount', () => {
    render(<SettingsSectionNav sections={SECTIONS} activeHash="security" />);
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
    render(<SettingsSectionNav sections={SECTIONS} activeHash="security" />);
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    );
  });

  it('calls onNavigate with the hash when a chip is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <SettingsSectionNav
        sections={SECTIONS}
        activeHash="account"
        onNavigate={onNavigate}
      />,
    );
    screen.getByRole('link', { name: /integrations/i }).click();
    expect(onNavigate).toHaveBeenCalledWith('integrations');
  });
});
