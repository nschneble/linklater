import {
  chainsFor,
  isLiteralLayer,
  type BackdropLayer,
} from './contrastResults.backdrops';
import {
  compositeOver,
  contrastRatio,
  parseColor,
} from '../../../theme/colorMath';
import type { Rgb, Rgba } from '../../../theme/colorMath';

/** One pair's measurement across every place its background renders. */
export interface PairEvaluation {
  /**
   * The WORST ratio among the render sites that could be measured, or null
   * when none could. An unmeasurable site never suppresses this: the user
   * loses nothing they could have acted on.
   */
  ratio: number | null;
  /** How many render sites could not be measured at all. */
  unmeasurable: number;
  /**
   * Every token whose VALUE any site's computation consumed, unioned across
   * sites. It is the union rather than the worst site's set because a token
   * read only by a better-scoring site can still change WHICH site scores
   * worst, and the row for that token has to show the note. Compositing stops
   * at the first opaque backdrop, so on an all-opaque palette this is exactly
   * the foreground and background and nothing else.
   */
  reads: ReadonlySet<string>;
  /** The subset of `reads` no site could resolve. */
  unresolved: ReadonlySet<string>;
  /** The chain the worst ratio came from, for naming it in a note. */
  backdrop: readonly BackdropLayer[];
}

/** What the evaluation touched, accumulated across every chain. */
interface Trace {
  reads: Set<string>;
  unresolved: Set<string>;
}

function parseOrNull(value: string): Rgba | null {
  try {
    return parseColor(value);
  } catch {
    return null;
  }
}

/**
 * Flattens `token` against `chain` until it is opaque, recording every token
 * whose value gets consumed. Null when a needed value is unreadable, or when
 * the chain runs out while the color is still translucent: nothing behind the
 * page background means there is no honest number to report.
 *
 * Alpha rides the whole way down, so each step is real source-over rather
 * than a group flatten, and the rounding happens once at the end.
 */
function flatten(
  token: string,
  chain: readonly BackdropLayer[],
  resolve: (token: string) => string,
  trace: Trace,
): Rgb | null {
  trace.reads.add(token);
  let color = parseOrNull(resolve(token));
  if (color === null) {
    trace.unresolved.add(token);
    return null;
  }

  for (const layer of chain) {
    if (color[3] >= 1) break;
    if (isLiteralLayer(layer)) {
      // no row edits a literal, so keying it would break the read invariant
      const literal = parseOrNull(layer.color);
      if (literal === null) return null;
      color = compositeOver(color, literal);
      continue;
    }
    trace.reads.add(layer);
    const backdrop = parseOrNull(resolve(layer));
    if (backdrop === null) {
      trace.unresolved.add(layer);
      return null;
    }
    color = compositeOver(color, backdrop);
  }

  if (color[3] < 1) {
    trace.unresolved.add(token);
    return null;
  }
  return [Math.round(color[0]), Math.round(color[1]), Math.round(color[2])];
}

/**
 * Measures a pair against every place its background really renders and
 * reports the worst measured result, the count of sites it could not measure,
 * and the tokens the whole evaluation consumed.
 *
 * Worst and unmeasurable are separate answers on purpose. Collapsing them
 * loses a number the user could have acted on the moment any one site goes
 * unreadable, which contradicts `resolveContrastStatus` ranking a measured
 * failure ahead of an unverified pair.
 *
 * Returning `reads` rather than deriving it elsewhere is what keeps the
 * completeness invariant provable: the key set IS the computation, so the two
 * cannot disagree.
 */
export function evaluatePair(
  foreground: string,
  background: string,
  resolve: (token: string) => string,
): PairEvaluation {
  const trace: Trace = { reads: new Set(), unresolved: new Set() };
  let ratio: number | null = null;
  let backdrop: readonly BackdropLayer[] = [];
  let unmeasurable = 0;

  for (const chain of chainsFor(background)) {
    const surface = flatten(background, chain, resolve, trace);
    // the foreground sits on the resolved background, so that is its backdrop
    const ink =
      surface === null
        ? null
        : flatten(foreground, [background, ...chain], resolve, trace);
    if (surface === null || ink === null) {
      unmeasurable += 1;
      continue;
    }
    const candidate = contrastRatio(ink, surface);
    if (ratio === null || candidate < ratio) {
      ratio = candidate;
      backdrop = chain;
    }
  }

  return {
    ratio,
    unmeasurable,
    reads: trace.reads,
    unresolved: trace.unresolved,
    backdrop,
  };
}
