import Disclosure from './Disclosure';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('Disclosure', () => {
  it('renders collapsed by default with a truly-hidden panel (E2)', () => {
    render(
      <Disclosure header={<span>Toggle me</span>}>
        <p>panel content</p>
      </Disclosure>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle me' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Hidden panel leaves the AT tree, so queryByText finds nothing visible.
    const panelText = screen.getByText('panel content');
    expect(panelText.closest('[hidden]')).not.toBeNull();
  });

  it('wires aria-controls to the panel id (E2/E4)', () => {
    render(
      <Disclosure header={<span>Toggle me</span>}>
        <p>panel content</p>
      </Disclosure>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle me' });
    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = screen.getByText('panel content').closest('div[id]');
    expect(panel).toHaveAttribute('id', panelId as string);
  });

  it('toggles aria-expanded and reveals the panel on click (K2)', async () => {
    const user = userEvent.setup();
    render(
      <Disclosure header={<span>Toggle me</span>}>
        <p>panel content</p>
      </Disclosure>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle me' });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('panel content').closest('[hidden]')).toBeNull();

    // Focus stays on the toggle — never moved programmatically.
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles via the keyboard (Enter)', async () => {
    const user = userEvent.setup();
    render(
      <Disclosure header={<span>Toggle me</span>}>
        <p>panel content</p>
      </Disclosure>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle me' });
    toggle.focus();
    await user.keyboard('{Enter}');

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onAfterCollapse when collapsing, not when expanding (K2 hook)', async () => {
    const user = userEvent.setup();
    const onAfterCollapse = vi.fn();
    render(
      <Disclosure
        header={<span>Toggle me</span>}
        onAfterCollapse={onAfterCollapse}
      >
        <p>panel content</p>
      </Disclosure>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle me' });
    await user.click(toggle); // expand
    expect(onAfterCollapse).not.toHaveBeenCalled();

    await user.click(toggle); // collapse
    expect(onAfterCollapse).toHaveBeenCalledTimes(1);
  });
});
