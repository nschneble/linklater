/**
 * Whether a boot is holding an announcement that has not gone out yet.
 *
 * A module-level flag rather than a prop or a context, for the same
 * reason `hasPendingNotice` is one. The reader is the focus bail in
 * `useAuthFormArrival.ts`, and the route elements it sits under are
 * built by a zero-parameter `unauthenticatedRoutes()`, so threading a
 * prop down would rewrite six signatures to carry one boolean. Context
 * is no better: the bail latches its answer at mount and never
 * re-subscribes, so a value that arrives later arrives to nobody.
 *
 * `useBootStatus` raises it when the boot screen first speaks and drops
 * it when the terminal message is resolved, whether or not that message
 * turned out to be worth saying. It has to come back down. The notice
 * arm beside it self-clears because the store behind it is one-shot,
 * while this one lives as long as the document, and the bail re-asks on
 * every real mode change; left up, it would hold focus off the inputs
 * for every switch between login and signup left in the session.
 */

let bootAnnouncementInbound = false;

export function markBootAnnouncementInbound(): void {
  bootAnnouncementInbound = true;
}

export function clearBootAnnouncementInbound(): void {
  bootAnnouncementInbound = false;
}

export function hasBootAnnouncementInbound(): boolean {
  return bootAnnouncementInbound;
}
