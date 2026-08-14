/*
 * The latch that records whether a queued notice was handed out during
 * this page's life.
 *
 * It has a file of its own because it is monotone and module-scoped:
 * once up it stays up for the document, so the case that needs it down
 * has to be asked before the case that raises it. Mixing it into
 * `pendingNotice.test.ts`, where most tests consume something, would
 * make the down cases depend on where in that file they happened to
 * sit. The order below is deliberate, and the tests are written to be
 * read top to bottom.
 *
 * It cannot live in storage. `sessionStorage` survives a reload, and a
 * notice consumed by the previous page load would then suppress a boot
 * message on the next one.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  consumePendingNotice,
  noticeWasConsumed,
  setPendingNotice,
} from './pendingNotice';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('noticeWasConsumed', () => {
  it('starts down, before anything has read the store', () => {
    expect(noticeWasConsumed()).toBe(false);
  });

  it('stays down when the read found nothing queued', () => {
    expect(consumePendingNotice()).toBeNull();
    expect(noticeWasConsumed()).toBe(false);
  });

  it('stays down for a value the catalog cannot answer to', () => {
    window.sessionStorage.setItem('linklater_pending_notice', 'not-a-notice');

    expect(consumePendingNotice()).toBeNull();
    expect(noticeWasConsumed()).toBe(false);
  });

  it('goes up once an entry has actually been handed out', () => {
    setPendingNotice('session-unavailable');

    expect(consumePendingNotice()).not.toBeNull();
    expect(noticeWasConsumed()).toBe(true);
  });

  it('stays up after the store has gone back to empty', () => {
    expect(consumePendingNotice()).toBeNull();
    expect(noticeWasConsumed()).toBe(true);
  });
});
