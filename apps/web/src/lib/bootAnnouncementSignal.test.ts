/*
 * The flag a slow boot raises so an auth screen mounting under it does
 * not move focus over the announcement.
 *
 * Only the clear is really worth pinning. A flag that goes up is easy to
 * get right and is exercised by every consumer; one that never comes
 * back down strands focus on `<body>` for every login and signup switch
 * left in the session, which is the failure `useAuthFormArrival.ts`
 * already carries a latch to avoid.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearBootAnnouncementInbound,
  hasBootAnnouncementInbound,
  markBootAnnouncementInbound,
} from './bootAnnouncementSignal';

beforeEach(() => {
  clearBootAnnouncementInbound();
});

describe('bootAnnouncementSignal', () => {
  it('is down until a boot has something to say', () => {
    expect(hasBootAnnouncementInbound()).toBe(false);
  });

  it('goes up when a boot raises it', () => {
    markBootAnnouncementInbound();

    expect(hasBootAnnouncementInbound()).toBe(true);
  });

  it('comes back down again', () => {
    markBootAnnouncementInbound();
    clearBootAnnouncementInbound();

    expect(hasBootAnnouncementInbound()).toBe(false);
  });

  it('does not stack, so one clear is enough after repeated marks', () => {
    markBootAnnouncementInbound();
    markBootAnnouncementInbound();
    clearBootAnnouncementInbound();

    expect(hasBootAnnouncementInbound()).toBe(false);
  });
});
