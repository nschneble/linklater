import { describe, expect, it } from 'vitest';
import {
  DISABLED,
  FOCUS_RING,
  FOCUS_RING_DANGER,
  FOCUS_RING_DANGER_FILLED,
  menuRevealStyle,
} from './styles';

describe('menuRevealStyle', () => {
  describe('when isOpen is true', () => {
    it('returns opacity 1', () => {
      const style = menuRevealStyle(true);
      expect(style.opacity).toBe(1);
    });

    it('uses 150ms ease-out transition for both opacity and transform', () => {
      const style = menuRevealStyle(true);
      expect(style.transition).toBe(
        'opacity 150ms ease-out, transform 150ms ease-out',
      );
    });

    it('uses scale(1) as the default open transform', () => {
      const style = menuRevealStyle(true);
      expect(style.transform).toBe('scale(1)');
    });

    it('uses a custom openTransform when provided', () => {
      const style = menuRevealStyle(true, 'translateY(0)');
      expect(style.transform).toBe('translateY(0)');
    });
  });

  describe('when isOpen is false', () => {
    it('returns opacity 0', () => {
      const style = menuRevealStyle(false);
      expect(style.opacity).toBe(0);
    });

    it('uses 100ms ease-in transition for both opacity and transform', () => {
      const style = menuRevealStyle(false);
      expect(style.transition).toBe(
        'opacity 100ms ease-in, transform 100ms ease-in',
      );
    });

    it('uses scale(0.95) as the default closed transform', () => {
      const style = menuRevealStyle(false);
      expect(style.transform).toBe('scale(0.95)');
    });

    it('uses a custom closedTransform when provided', () => {
      const style = menuRevealStyle(false, 'scale(1)', 'translateY(-4px)');
      expect(style.transform).toBe('translateY(-4px)');
    });
  });
});

describe('FOCUS_RING', () => {
  it('contains focus-visible:outline-none', () => {
    expect(FOCUS_RING).toContain('focus-visible:outline-none');
  });

  it('contains focus-visible:ring-2', () => {
    expect(FOCUS_RING).toContain('focus-visible:ring-2');
  });

  it('contains the focus-ring color', () => {
    expect(FOCUS_RING).toContain('focus-visible:ring-[var(--focus-ring)]');
  });

  it('carries the Windows HCM outline fallback (forced-colors)', () => {
    // Forced Colors Mode strips background colors including the ring; the
    // system-color outline is the second-channel focus indicator for HCM
    // keyboard users per SC 2.4.7.
    expect(FOCUS_RING).toContain('forced-colors:focus-visible:outline-2');
    expect(FOCUS_RING).toContain(
      'forced-colors:focus-visible:outline-[ButtonText]',
    );
  });
});

describe('FOCUS_RING_DANGER', () => {
  it('contains focus-visible:outline-none', () => {
    expect(FOCUS_RING_DANGER).toContain('focus-visible:outline-none');
  });

  it('contains focus-visible:ring-2', () => {
    expect(FOCUS_RING_DANGER).toContain('focus-visible:ring-2');
  });

  it('contains the alert highlight color', () => {
    expect(FOCUS_RING_DANGER).toContain(
      'focus-visible:ring-[var(--alert-highlight)]',
    );
  });

  it('carries the Windows HCM outline fallback (forced-colors)', () => {
    expect(FOCUS_RING_DANGER).toContain(
      'forced-colors:focus-visible:outline-2',
    );
    expect(FOCUS_RING_DANGER).toContain(
      'forced-colors:focus-visible:outline-[ButtonText]',
    );
  });
});

describe('FOCUS_RING_DANGER_FILLED', () => {
  it('contains focus-visible:outline-none', () => {
    expect(FOCUS_RING_DANGER_FILLED).toContain('focus-visible:outline-none');
  });

  it('contains focus-visible:ring-2', () => {
    expect(FOCUS_RING_DANGER_FILLED).toContain('focus-visible:ring-2');
  });

  it('uses --alert-highlight-fg (NOT --alert-highlight) for the ring color', () => {
    // Recovery A (Toast precedent): danger-filled buttons paint
    // --alert-highlight as their fill. A --alert-highlight ring would render
    // 1:1 invisible against that fill, breaking SC 2.4.7. --alert-highlight-fg
    // inherits 4.5:1 vs --alert-highlight from the bundle contract.
    expect(FOCUS_RING_DANGER_FILLED).toContain(
      'focus-visible:ring-[var(--alert-highlight-fg)]',
    );
    expect(FOCUS_RING_DANGER_FILLED).not.toContain(
      'focus-visible:ring-[var(--alert-highlight)]',
    );
  });

  it('carries the Windows HCM outline fallback (forced-colors)', () => {
    expect(FOCUS_RING_DANGER_FILLED).toContain(
      'forced-colors:focus-visible:outline-2',
    );
    expect(FOCUS_RING_DANGER_FILLED).toContain(
      'forced-colors:focus-visible:outline-[ButtonText]',
    );
  });
});

describe('DISABLED', () => {
  it('contains disabled:opacity-60', () => {
    expect(DISABLED).toContain('disabled:opacity-60');
  });

  it('contains disabled:cursor-not-allowed', () => {
    expect(DISABLED).toContain('disabled:cursor-not-allowed');
  });
});
