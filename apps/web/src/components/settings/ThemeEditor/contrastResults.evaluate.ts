import { chainsFor } from './contrastResults.backdrops';
import {
  compositeOverBg,
  contrastRatio,
  parseColor,
} from '../../../theme/colorMath';
import type { Rgb, Rgba } from '../../../theme/colorMath';

/** One pair's measurement, instrumented with what it actually read. */
export interface PairEvaluation {
  /** Null when some value the computation needed could not be resolved. */
  ratio: number | null;
  /**
   * Tokens whose VALUE this computation consumed. Compositing stops at the
   * first opaque backdrop, so on an all-opaque palette this is exactly the
   * foreground and background and nothing else.
   */
  reads: ReadonlySet<string>;
  /** The subset of `reads` that could not be resolved. Empty when ratio is set. */
  unresolved: ReadonlySet<string>;
  /** The chain the worst result came from, for naming it in a note. */
  backdrop: readonly string[];
}

/** What one chain's evaluation touched. */
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
 */
function flatten(
  token: string,
  chain: readonly string[],
  resolve: (token: string) => string,
  trace: Trace,
): Rgb | null {
  trace.reads.add(token);
  let color = parseOrNull(resolve(token));
  if (color === null) {
    trace.unresolved.add(token);
    return null;
  }

  for (const backdropToken of chain) {
    if (color[3] >= 1) break;
    trace.reads.add(backdropToken);
    const backdrop = parseOrNull(resolve(backdropToken));
    if (backdrop === null) {
      trace.unresolved.add(backdropToken);
      return null;
    }
    const blended = compositeOverBg(color, [
      backdrop[0],
      backdrop[1],
      backdrop[2],
    ]);
    color = [...blended, backdrop[3]];
  }

  if (color[3] < 1) {
    trace.unresolved.add(token);
    return null;
  }
  return [color[0], color[1], color[2]];
}

function evaluateChain(
  foreground: string,
  background: string,
  chain: readonly string[],
  resolve: (token: string) => string,
): PairEvaluation {
  const trace: Trace = { reads: new Set(), unresolved: new Set() };
  const surface = flatten(background, chain, resolve, trace);
  // the foreground sits on the resolved background, so that is its backdrop
  const ink =
    surface && flatten(foreground, [background, ...chain], resolve, trace);
  return {
    ratio: surface && ink ? contrastRatio(ink, surface) : null,
    reads: trace.reads,
    unresolved: trace.unresolved,
    backdrop: chain,
  };
}

/** True when `candidate` is a worse, or less knowable, result than `worst`. */
function isWorse(candidate: PairEvaluation, worst: PairEvaluation): boolean {
  if (worst.ratio === null) return false;
  // an unmeasurable instance outranks a measured one: it is the bigger gap
  return candidate.ratio === null || candidate.ratio < worst.ratio;
}

/**
 * Measures a pair against every place its background really renders and
 * reports the WORST, along with the tokens that measurement consumed.
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
  let worst: PairEvaluation | null = null;
  for (const chain of chainsFor(background)) {
    const candidate = evaluateChain(foreground, background, chain, resolve);
    if (worst === null || isWorse(candidate, worst)) worst = candidate;
  }
  return worst as PairEvaluation;
}
