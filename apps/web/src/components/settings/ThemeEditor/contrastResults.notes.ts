import { isLiteralLayer } from './contrastResults.backdrops';
import { VAR_GROUPS, type Bundle } from './useThemeOverrides';
import type { ContrastPair } from './contrastResults.pairs';
import type { ContrastResults } from './contrastResults';

/*
 * Turning a failed measurement into the note one slot row shows.
 *
 * Separate from the measurement because it answers a different question. The
 * checker asks what the ratio is; this asks what to tell a user standing on a
 * particular row, which depends on how that row took part in the failure. A
 * row can be an endpoint of the pair, or merely a backdrop the measurement
 * composited through, and the two need different sentences.
 */

/**
 * A single token's worst FAILING contrast pair, used by the per-bundle slot
 * rows to surface failure feedback on the hex input (BL1). Only failing pairs
 * (resolved ratio below threshold) produce an entry; passing and unverified
 * pairs do not, so a row only ever reports a concrete, color-independent
 * "fails contrast" note (SC 3.3.1, SC 1.4.1).
 */
export interface TokenContrastFailure {
  /** Measured ratio of the failing pair. */
  ratio: number;
  /** Threshold the pair must clear. */
  threshold: number;
  /**
   * The failing pair as the SUBJECT of the note sentence, phrased for
   * the row it renders on: the partner slot when the row is an endpoint,
   * both slots when the row is only a backdrop. The row completes the
   * sentence and appends the ratio.
   */
  noteSubject: string;
  /**
   * Where the worst site renders, when that is somewhere a user would not
   * find by looking at the screen they are on. A palette that fails only
   * behind an overlay reads, from the row alone, exactly like one failing
   * in the chrome they just checked and found fine.
   */
  site?: string;
}

/**
 * Per-endpoint descriptor for every editable token, built once from the same
 * `VAR_GROUPS` the rows render from, so a failure note names a slot with the
 * EXACT label the user sees on that slot's row. The universal focus ring rides
 * the base group but belongs to no bundle, so its `bundle` is null (detected by
 * its token not matching the group's prefix); it is never bundle-qualified
 * since its name is already unique.
 */
const SLOT_INFO: ReadonlyMap<
  string,
  { bundle: Bundle | null; bundleLabel: string; slotLabel: string }
> = (() => {
  const info = new Map<
    string,
    { bundle: Bundle | null; bundleLabel: string; slotLabel: string }
  >();
  for (const group of VAR_GROUPS) {
    for (const item of group.items) {
      const belongsToBundle = item.variable.startsWith(`--${group.bundle}-`);
      info.set(item.variable, {
        bundle: belongsToBundle ? group.bundle : null,
        bundleLabel: group.label,
        slotLabel: item.label,
      });
    }
  }
  return info;
})();

/**
 * A slot's display label as seen from `rowToken`'s row. Bundle-qualified only
 * when the slot's bundle differs from the row's (or the row has no bundle, e.g.
 * the focus ring) so "Background" can't be mistaken for the wrong bundle's
 * background.
 */
function slotLabelFor(token: string, rowToken: string): string {
  const slot = SLOT_INFO.get(token);
  if (slot === undefined) return token;
  const row = SLOT_INFO.get(rowToken);
  if (slot.bundle !== null && slot.bundle !== row?.bundle) {
    return `${slot.bundleLabel} ${slot.slotLabel.toLowerCase()}`;
  }
  return slot.slotLabel;
}

/**
 * The failing pair, described from where the note renders.
 *
 * On a row that IS an endpoint the note only needs the other one: the row's own
 * label and the input's accessible name already say which slot the user is on.
 * A row that is neither endpoint took part as a backdrop the measurement
 * composited through, and naming one endpoint there reads as a claim that this
 * row pairs with it, which is false, so both are named instead.
 *
 * Naming both also decides the sentence shape. Two multi-word slot names
 * stacked in front of the noun build a pile-up nobody parses at a
 * glance, so that case leads with the noun and hangs both names off it.
 * The endpoint case has one name to place and keeps the shorter form.
 */
function noteSubjectFor(rowToken: string, pair: ContrastPair): string {
  if (rowToken === pair.foreground) {
    return `${slotLabelFor(pair.background, rowToken)} contrast`;
  }
  if (rowToken === pair.background) {
    return `${slotLabelFor(pair.foreground, rowToken)} contrast`;
  }
  const foreground = slotLabelFor(pair.foreground, rowToken).toLowerCase();
  const background = slotLabelFor(pair.background, rowToken).toLowerCase();
  return `Contrast between ${foreground} and ${background}`;
}

/**
 * Keys each failing pair under every token its measurement READ, so a token
 * that fails only as a BACKGROUND (e.g. a too-light card background under card
 * text) still reports a failure on its OWN slot row, not only on the far
 * foreground row (C3). A backdrop the pair names nowhere, like the page
 * background under a translucent card, reports on its own row too. Reuses the
 * evaluations already computed by `useContrastResults`; it measures nothing
 * itself.
 */
export function pairsTouchingToken(
  results: ContrastResults,
): Map<string, TokenContrastFailure> {
  const failures = new Map<string, TokenContrastFailure>();
  const consider = (
    token: string,
    ratio: number,
    pair: ContrastPair,
    site: string | undefined,
  ) => {
    const deficit = pair.threshold - ratio;
    const existing = failures.get(token);
    if (existing && existing.threshold - existing.ratio >= deficit) return;
    failures.set(token, {
      ratio,
      threshold: pair.threshold,
      noteSubject: noteSubjectFor(token, pair),
      site,
    });
  };
  for (const group of results.groups) {
    for (const { pair, ratio, reads, backdrop } of group.pairs) {
      if (ratio === null || ratio >= pair.threshold) continue;
      const site = backdrop?.find(isLiteralLayer)?.label;
      // any token the ratio read can fix it, backdrops included
      for (const token of reads ?? [pair.foreground, pair.background]) {
        consider(token, ratio, pair, site);
      }
    }
  }
  return failures;
}
