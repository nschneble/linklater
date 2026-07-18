import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { THROTTLER_CONFIG } from './throttler.config.js';

/**
 * Cross-layer invariant for the rate limiter.
 *
 * `@nestjs/throttler` v6 only evaluates throttlers declared in
 * `ThrottlerModule.forRoot(...)`. Any `@Throttle({ 'name': { ttl, limit } })`
 * decorator whose name is missing from `THROTTLER_CONFIG` is silently ignored,
 * so the route never binds its intended limit. This spec scans every
 * controller source file for `@Throttle` names + values and asserts they match
 * `THROTTLER_CONFIG` exactly, in both directions:
 *   - every decorator name is declared with matching ttl/limit, and
 *   - every declared bucket is actually used by a decorator (no dead config).
 */

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));

interface ThrottleUsage {
  name: string;
  ttl: number;
  limit: number;
  file: string;
}

/** Recursively collects every `*.controller.ts` under `directory`. */
function collectControllerFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectControllerFiles(fullPath));
    } else if (
      entry.name.endsWith('.controller.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Extracts every `@Throttle({ 'name': { ttl, limit } })` usage in the tree. */
function collectThrottleUsages(): ThrottleUsage[] {
  const usages: ThrottleUsage[] = [];
  const pattern =
    /@Throttle\(\{\s*'([^']+)':\s*\{\s*ttl:\s*(\d+),\s*limit:\s*(\d+)\s*\}\s*\}\)/g;
  for (const file of collectControllerFiles(SOURCE_ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      usages.push({
        name: match[1],
        ttl: Number(match[2]),
        limit: Number(match[3]),
        file,
      });
    }
  }
  return usages;
}

describe('throttler configuration coherence', () => {
  const usages = collectThrottleUsages();
  const configByName = new Map(
    THROTTLER_CONFIG.map((throttler) => [throttler.name, throttler]),
  );

  it('finds @Throttle decorators to check (guards against a broken scan)', () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it('declares every @Throttle name in THROTTLER_CONFIG with matching ttl/limit', () => {
    const undeclared: string[] = [];
    const mismatched: string[] = [];
    for (const usage of usages) {
      const declared = configByName.get(usage.name);
      if (!declared) {
        undeclared.push(`${usage.name} (used in ${usage.file})`);
        continue;
      }
      if (declared.ttl !== usage.ttl || declared.limit !== usage.limit) {
        mismatched.push(
          `${usage.name}: decorator ${usage.ttl}/${usage.limit} vs config ${declared.ttl}/${declared.limit}`,
        );
      }
    }
    expect({ undeclared, mismatched }).toEqual({
      undeclared: [],
      mismatched: [],
    });
  });

  it('does not declare any bucket that no @Throttle decorator uses', () => {
    const usedNames = new Set(usages.map((usage) => usage.name));
    const unused = THROTTLER_CONFIG.map((throttler) => throttler.name).filter(
      (name) => !usedNames.has(name),
    );
    expect(unused).toEqual([]);
  });

  it('has no duplicate names in THROTTLER_CONFIG', () => {
    const names = THROTTLER_CONFIG.map((throttler) => throttler.name);
    expect(names).toHaveLength(new Set(names).size);
  });
});
