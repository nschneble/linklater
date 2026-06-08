import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import Alert from './Alert';

// These tests pin the resolved class strings for each (variant, baseTheme,
// mode) branch so the bundle-token migration is caught the next time anyone
// touches the variant map. The actual color resolution happens at CSS time
// against `bundles.css`; this file only verifies the class strings the
// component emits.

vi.mock('../../theme/ThemeContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../theme/ThemeContext')
  >('../../theme/ThemeContext');
  return {
    ...actual,
    useThemeStyling: vi.fn(() => ({
      baseTheme: 'scanner-darkly',
      mode: 'light',
    })),
  };
});

const { useThemeStyling } = await import('../../theme/ThemeContext');
const mockedUseThemeStyling = vi.mocked(useThemeStyling);

describe('Alert', () => {
  afterEach(() => {
    mockedUseThemeStyling.mockReturnValue({
      baseTheme: 'scanner-darkly',
      mode: 'light',
    });
  });

  describe('default theme branch (non-Apollo, non-Nouvelle Vague)', () => {
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
  });

  describe('apollo-10-1-2 theme branch (post-wave-8: uses bundle tokens)', () => {
    it('resolves the alert bundle tokens for the error variant in dark mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'apollo-10-1-2',
        mode: 'dark',
      });
      const { getByRole } = render(<Alert variant="error">Boom</Alert>);
      const className = getByRole('alert').className;
      expect(className).toContain('bg-[var(--alert-bg)]');
      expect(className).toContain('border-[var(--alert-border)]');
      expect(className).toContain('text-[var(--alert-text)]');
    });

    it('resolves the alert bundle tokens for the error variant in light mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'apollo-10-1-2',
        mode: 'light',
      });
      const { getByRole } = render(<Alert variant="error">Boom</Alert>);
      const className = getByRole('alert').className;
      expect(className).toContain('bg-[var(--alert-bg)]');
      expect(className).toContain('border-[var(--alert-border)]');
      expect(className).toContain('text-[var(--alert-text)]');
    });

    it('resolves the success bundle tokens for the success variant in dark mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'apollo-10-1-2',
        mode: 'dark',
      });
      const { getByRole } = render(<Alert variant="success">OK</Alert>);
      const className = getByRole('status').className;
      expect(className).toContain('bg-[var(--success-bg)]');
      expect(className).toContain('border-[var(--success-border)]');
      expect(className).toContain('text-[var(--success-text)]');
    });

    it('resolves the success bundle tokens for the success variant in light mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'apollo-10-1-2',
        mode: 'light',
      });
      const { getByRole } = render(<Alert variant="success">OK</Alert>);
      const className = getByRole('status').className;
      expect(className).toContain('bg-[var(--success-bg)]');
      expect(className).toContain('border-[var(--success-border)]');
      expect(className).toContain('text-[var(--success-text)]');
    });
  });

  describe('nouvelle-vague theme branch', () => {
    it('uses the grayscale palette for the error variant in dark mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'nouvelle-vague',
        mode: 'dark',
      });
      const { getByRole } = render(<Alert variant="error">Boom</Alert>);
      const className = getByRole('alert').className;
      expect(className).toContain('bg-gray-900/40');
      expect(className).toContain('border-gray-700');
      expect(className).toContain('text-gray-400');
    });

    it('uses the grayscale palette for the error variant in light mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'nouvelle-vague',
        mode: 'light',
      });
      const { getByRole } = render(<Alert variant="error">Boom</Alert>);
      const className = getByRole('alert').className;
      expect(className).toContain('bg-gray-100');
      expect(className).toContain('border-gray-300');
      expect(className).toContain('text-gray-700');
    });

    it('uses the grayscale palette for the success variant in dark mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'nouvelle-vague',
        mode: 'dark',
      });
      const { getByRole } = render(<Alert variant="success">OK</Alert>);
      const className = getByRole('status').className;
      expect(className).toContain('bg-gray-900/40');
      expect(className).toContain('border-gray-700');
      expect(className).toContain('text-gray-400');
    });

    it('uses the grayscale palette for the success variant in light mode', () => {
      mockedUseThemeStyling.mockReturnValue({
        baseTheme: 'nouvelle-vague',
        mode: 'light',
      });
      const { getByRole } = render(<Alert variant="success">OK</Alert>);
      const className = getByRole('status').className;
      expect(className).toContain('bg-gray-100');
      expect(className).toContain('border-gray-300');
      expect(className).toContain('text-gray-600');
    });
  });

  describe('hidden empty state', () => {
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
});
