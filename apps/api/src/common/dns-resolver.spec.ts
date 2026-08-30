import { jest } from '@jest/globals';

import { createCachedResolver } from './dns-resolver.js';

describe('createCachedResolver', () => {
  it('returns the raw lookup result', async () => {
    const rawLookup = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34']);
    const resolver = createCachedResolver(rawLookup);

    await expect(resolver('example.com')).resolves.toEqual(['93.184.216.34']);
  });

  it('caches a resolved hostname, skipping a second raw lookup within the ttl', async () => {
    const rawLookup = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34']);
    const resolver = createCachedResolver(rawLookup, { ttlMs: 60_000 });

    await resolver('example.com');
    await resolver('example.com');

    expect(rawLookup).toHaveBeenCalledTimes(1);
  });

  it('re-resolves once the cache entry expires', async () => {
    jest.useFakeTimers();
    try {
      const rawLookup = jest
        .fn<(hostname: string) => Promise<string[]>>()
        .mockResolvedValue(['93.184.216.34']);
      const resolver = createCachedResolver(rawLookup, { ttlMs: 1_000 });

      await resolver('example.com');
      jest.advanceTimersByTime(1_001);
      await resolver('example.com');

      expect(rawLookup).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('caches each hostname independently', async () => {
    const rawLookup = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockImplementation(async (hostname) => [`${hostname}-address`]);
    const resolver = createCachedResolver(rawLookup, { ttlMs: 60_000 });

    await resolver('a.example');
    await resolver('b.example');
    await resolver('a.example');

    expect(rawLookup).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entry once past maxEntries', async () => {
    const rawLookup = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockImplementation(async (hostname) => [`${hostname}-address`]);
    const resolver = createCachedResolver(rawLookup, {
      ttlMs: 60_000,
      maxEntries: 2,
    });

    await resolver('a.example');
    await resolver('b.example');
    await resolver('c.example'); // evicts a.example
    await resolver('a.example'); // must re-resolve

    expect(rawLookup).toHaveBeenCalledTimes(4);
  });

  it('rejects with a timeout error instead of hanging when the raw lookup never settles', async () => {
    const rawLookup = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockImplementation(() => new Promise(() => undefined));
    const resolver = createCachedResolver(rawLookup, { timeoutMs: 20 });

    await expect(resolver('slow.example')).rejects.toThrow(/timed out/i);
  });

  it('does not cache a timed-out lookup', async () => {
    const rawLookup = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce(['93.184.216.34']);
    const resolver = createCachedResolver(rawLookup, { timeoutMs: 20 });

    await expect(resolver('flaky.example')).rejects.toThrow(/timed out/i);
    await expect(resolver('flaky.example')).resolves.toEqual(['93.184.216.34']);
    expect(rawLookup).toHaveBeenCalledTimes(2);
  });
});
