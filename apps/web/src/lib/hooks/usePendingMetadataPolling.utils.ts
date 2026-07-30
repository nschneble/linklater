/** The batch of ids to poll this tick, plus the cursor to carry to the next. */
export interface PollBatch {
  batch: string[];
  nextCursor: number;
}

/**
 * Picks the next up-to-`cap` ids to poll, starting at `cursor` and wrapping
 * round-robin so a pending set larger than `cap` still cycles every id through
 * across successive ticks. Returns the advanced cursor to persist for the next
 * call; the caller keeps it monotonic (never modulo'd) so rotation survives a
 * set that grows or shrinks between ticks. Assumes `ids` is non-empty.
 */
export function selectPollBatch(
  ids: string[],
  cursor: number,
  cap: number,
): PollBatch {
  const count = Math.min(cap, ids.length);
  const start = cursor % ids.length;
  const batch: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    batch.push(ids[(start + offset) % ids.length]);
  }
  return { batch, nextCursor: cursor + count };
}

/**
 * Doubles the back-off interval for the next poll, capped at `max`. Drives the
 * 2s -> 4s -> 8s -> 16s decay: the poll rate eases off while a card stays
 * pending, then holds at the cap so a slow metadata job is still retried.
 */
export function nextInterval(current: number, max: number): number {
  return Math.min(current * 2, max);
}
