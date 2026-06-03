import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface DiffOutcome {
  diffPng: Buffer;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
}

/**
 * Compares two PNG buffers with pixelmatch. Returns a third PNG buffer that
 * highlights every changed pixel in red so the reporter can show it next to
 * the baseline and actual images. Dimensions must match — if they do not, the
 * diff fails loudly because a size change is itself a regression.
 */
export function diffPngs(
  baseline: Buffer,
  actual: Buffer,
  pixelThreshold: number,
): DiffOutcome {
  const baselinePng = PNG.sync.read(baseline);
  const actualPng = PNG.sync.read(actual);
  if (
    baselinePng.width !== actualPng.width ||
    baselinePng.height !== actualPng.height
  ) {
    throw new ScreenshotSizeMismatchError(
      { width: baselinePng.width, height: baselinePng.height },
      { width: actualPng.width, height: actualPng.height },
    );
  }
  const diffPng = new PNG({
    width: baselinePng.width,
    height: baselinePng.height,
  });
  const diffPixels = pixelmatch(
    baselinePng.data,
    actualPng.data,
    diffPng.data,
    baselinePng.width,
    baselinePng.height,
    { threshold: pixelThreshold },
  );
  const totalPixels = baselinePng.width * baselinePng.height;
  return {
    diffPng: PNG.sync.write(diffPng),
    diffPixels,
    totalPixels,
    diffRatio: diffPixels / totalPixels,
  };
}

export class ScreenshotSizeMismatchError extends Error {
  readonly baseline: { width: number; height: number };
  readonly actual: { width: number; height: number };
  constructor(
    baseline: { width: number; height: number },
    actual: { width: number; height: number },
  ) {
    super(
      `Screenshot dimensions changed: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`,
    );
    this.name = 'ScreenshotSizeMismatchError';
    this.baseline = baseline;
    this.actual = actual;
  }
}
