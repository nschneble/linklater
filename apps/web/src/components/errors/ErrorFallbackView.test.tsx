/**
 * The fallback replaces the whole page, with no header, nav or skip link
 * ahead of it, so it owes what `NotFoundView` next door owes: a `<main>`
 * landmark (SC 1.3.1), focus moved into that landmark (SC 2.4.3) and a
 * title that names the page it became (SC 2.4.2). The subtree it replaced
 * is gone, so focus otherwise falls to `<body>` with a virtual cursor
 * pointing into a buffer that no longer exists.
 *
 * The APG rule against moving focus to an alert does not reach this. It
 * governs a message injected beside content the user is still reading;
 * here there is no such content left.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import ErrorFallbackView from './ErrorFallbackView';
import { render, screen } from '@testing-library/react';

beforeEach(() => {
  document.title = 'unset';
});

describe('ErrorFallbackView', () => {
  it('renders a <main> landmark (SC 1.3.1)', () => {
    render(<ErrorFallbackView />);

    const main = screen.getByRole('main');
    expect(main.tagName).toBe('MAIN');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('moves keyboard focus to the <main> on mount (SC 2.4.3)', () => {
    render(<ErrorFallbackView />);

    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('names the page it became in the title (SC 2.4.2)', () => {
    render(<ErrorFallbackView />);

    expect(document.title).toBe('Linklater – Something went wrong');
  });

  it('keeps the heading and the reload affordance', () => {
    render(<ErrorFallbackView />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Reload page/ }),
    ).toBeInTheDocument();
  });
});
