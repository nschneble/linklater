import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuItem from './MenuItem';

/**
 * Pin the hover class-string contract so a future refactor cannot silently
 * drop the highlight fill or the border-y stroke. WCAG guarantees live at the
 * token layer:
 *
 *   - SC 1.4.11 (3:1 non-text) on the hover indicator is carried by
 *     `--orbit-highlight` vs `--orbit-bg` >= 3:1, enforced for every theme
 *     in `bundles.contrast.test.ts`.
 *   - SC 2.4.7 (focus visible) + SC 1.4.11 on the focus ring are carried by
 *     `--focus-ring` vs `--orbit-bg` >= 3:1, also enforced in
 *     `bundles.contrast.test.ts`. `FOCUS_RING` (lib/styles.ts) is the only
 *     focus-visible styling — no separate fill/inset-ring needed.
 *
 * This test only guards that the bundle-driven hover affordance is wired up
 * on the component, not the contrast math itself.
 */
describe('MenuItem', () => {
  it('applies hover bg + border-y for menu-row state', () => {
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={() => {}} />);
    const button = screen.getByRole('menuitem');
    const className = button.className;
    expect(className).toMatch(/hover:bg-\[var\(--orbit-highlight\)\]\/80/);
    expect(className).toMatch(/border-y/);
    expect(className).toMatch(/border-transparent/);
    expect(className).toMatch(
      /hover:border-\[var\(--orbit-highlight-hover\)\]\/80/,
    );
  });
});
