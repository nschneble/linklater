import { lookup as dnsLookup } from 'node:dns/promises';

/** Resolves a hostname to the IP address strings it points at. */
export type RawDnsLookup = (hostname: string) => Promise<string[]>;

export interface CachedResolverOptions {
  /** Max time to wait for a raw lookup before rejecting. */
  timeoutMs?: number;
  /** How long a resolved hostname stays cached. */
  ttlMs?: number;
  /** Cap on distinct cached hostnames, oldest evicted first. */
  maxEntries?: number;
}

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_ENTRIES = 500;

interface CacheEntry {
  addresses: string[];
  expiresAt: number;
}

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  hostname: string,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`DNS lookup timed out after ${timeoutMs}ms: ${hostname}`),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/**
 * Wraps a raw DNS lookup with a hard timeout and a short-lived cache, so a
 * slow/flaky resolver can't hang a request and repeat lookups for the same
 * hostname don't pay for a fresh syscall.
 */
export function createCachedResolver(
  rawLookup: RawDnsLookup,
  options: CachedResolverOptions = {},
): RawDnsLookup {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const cache = new Map<string, CacheEntry>();

  return async (hostname: string): Promise<string[]> => {
    const cached = cache.get(hostname);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.addresses;
    }

    const addresses = await withTimeout(
      rawLookup(hostname),
      timeoutMs,
      hostname,
    );

    if (!cache.has(hostname) && cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(hostname, { addresses, expiresAt: Date.now() + ttlMs });

    return addresses;
  };
}

const rawSystemLookup: RawDnsLookup = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true });
  return records.map((record) => record.address);
};

/** Timeout+cache wrapped system resolver, the production default. */
export const systemResolver: RawDnsLookup =
  createCachedResolver(rawSystemLookup);
