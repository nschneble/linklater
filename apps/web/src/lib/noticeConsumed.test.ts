/*
 * The latch that records whether a queued notice was handed out during
 * this page's life.
 *
 * It has a file of its own because it is monotone and module-scoped:
 * once up it stays up for the document. Mixing it into
 * `pendingNotice.test.ts`, where most tests consume something, would
 * make the down cases depend on where in that file they happened to
 * sit. Here every case lowers it first, so each one states its own
 * starting position rather than inheriting the one above it.
 *
 * It cannot live in storage. `sessionStorage` survives a reload, and a
 * notice consumed by the previous page load would then suppress a boot
 * message on the next one.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumePendingNotice,
  noticeWasConsumed,
  resetNoticeConsumed,
  setPendingNotice,
} from './pendingNotice';

beforeEach(() => {
  resetNoticeConsumed();
});

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
    setPendingNotice('session-unavailable');
    consumePendingNotice();

    expect(consumePendingNotice()).toBeNull();
    expect(noticeWasConsumed()).toBe(true);
  });
});
