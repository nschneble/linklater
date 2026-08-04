/**
 * NotFoundView is mounted as a TOP-LEVEL route (`path="*"`), a sibling of
 * AppShell with no header/nav/skip-link before it. It must therefore expose
 * its own `<main>` landmark (SC 1.3.1) and move keyboard focus into that
 * landmark on mount (SC 2.4.3) so a keyboard user is not stranded on `<body>`
 * after a route miss.
 */

import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import NotFoundView from './NotFoundView';
import { render, screen } from '@testing-library/react';

function renderNotFound() {
  // start at /not-found so the redirect effect is a no-op (single mount)
  return render(
    <MemoryRouter initialEntries={['/not-found']}>
      <NotFoundView />
    </MemoryRouter>,
  );
}

describe('NotFoundView', () => {
  it('renders a <main> landmark (SC 1.3.1)', () => {
    renderNotFound();

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main.tagName).toBe('MAIN');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('moves keyboard focus to the <main> on mount (SC 2.4.3)', () => {
    renderNotFound();

    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('keeps the "Page not found" heading and the back affordance', () => {
    renderNotFound();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Back to Linklater/ }),
    ).toBeInTheDocument();
  });
});
