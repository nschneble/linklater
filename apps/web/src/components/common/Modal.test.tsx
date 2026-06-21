/*
 * Tests for Modal – shared dialog primitive used by WelcomeModal and
 * KeyboardShortcutsModal.
 *
 * Covers the ARIA + focus + scroll-lock contracts the primitive owns.
 * Consumer-specific contracts (surface props, content shape) live in
 * the consumer test files.
 */

import Modal, { type ModalControl } from './Modal';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HEADING_ID = 'modal-heading';
const DESCRIPTION_ID = 'modal-description';

interface RenderOptions {
  describedBy?: string;
  panelClassName?: string;
  onClose?: () => void;
  controlReference?: React.RefObject<ModalControl | null>;
  extraButton?: boolean;
}

function renderModal({
  describedBy,
  panelClassName,
  onClose = vi.fn(),
  controlReference,
  extraButton = false,
}: RenderOptions = {}) {
  return render(
    <Modal
      labelledBy={HEADING_ID}
      describedBy={describedBy}
      onClose={onClose}
      closeLabel="Close test dialog"
      backdropLabel="Dismiss test dialog"
      panelClassName={panelClassName}
      controlRef={controlReference}
    >
      <h2 id={HEADING_ID} tabIndex={-1} data-modal-initial-focus>
        Heading
      </h2>
      {describedBy !== undefined && (
        <p id={describedBy}>Description paragraph</p>
      )}
      {extraButton && <button type="button">Extra action</button>}
    </Modal>,
  );
}

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders a dialog with role + aria-modal + aria-labelledby', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', HEADING_ID);
  });

  it('wires aria-describedby only when describedBy is provided', () => {
    const { unmount } = renderModal({ describedBy: DESCRIPTION_ID });
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-describedby',
      DESCRIPTION_ID,
    );
    unmount();

    renderModal();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('moves focus to [data-modal-initial-focus] on mount', () => {
    renderModal();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: /heading/i }),
    );
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close test dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab forward – focus on the last focusable wraps to the first', () => {
    renderModal({ extraButton: true });
    const closeButton = screen.getByRole('button', {
      name: /close test dialog/i,
    });
    const extraButton = screen.getByRole('button', { name: /extra action/i });
    extraButton.focus();
    expect(document.activeElement).toBe(extraButton);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('traps Shift+Tab backward – focus on the first focusable wraps to the last', () => {
    renderModal({ extraButton: true });
    const closeButton = screen.getByRole('button', {
      name: /close test dialog/i,
    });
    const extraButton = screen.getByRole('button', { name: /extra action/i });
    closeButton.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(document.activeElement).toBe(extraButton);
  });

  it('locks body scroll on mount and restores it on unmount', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('restores focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderModal();
    act(() => {
      unmount();
    });
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('skipRestore via controlRef suppresses focus return on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const controlReference: React.RefObject<ModalControl | null> = {
      current: null,
    };
    const { unmount } = renderModal({ controlReference });

    expect(controlReference.current).not.toBeNull();
    controlReference.current?.skipRestore();

    act(() => {
      unmount();
    });
    expect(document.activeElement).not.toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('renders into document.body via portal', () => {
    const { container } = renderModal();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('appends panelClassName to the panel defaults instead of replacing them', () => {
    renderModal({ panelClassName: 'max-w-xs pt-12 custom-marker' });
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('z-30');
    expect(dialog.className).toContain('max-w-xs');
    expect(dialog.className).toContain('custom-marker');
  });
});
