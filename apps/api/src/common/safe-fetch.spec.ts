import { Agent } from 'undici';
import { jest } from '@jest/globals';
import { type LookupFunction } from 'node:net';

import {
  assertPublicHost,
  createValidatingLookup,
  defaultFetchImpl,
  PrivateHostError,
  safeFetch,
} from './safe-fetch.js';

/**
 * Builds a minimal manual-redirect Response stub. `safeFetch` only reads
 * `status` (to detect a 3xx) and `headers.get('location')` (to find the next
 * hop), so those are the only fields the stub needs.
 */
const makeResponse = (status: number, location?: string) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get: (key: string) =>
      key.toLowerCase() === 'location' ? (location ?? null) : null,
  },
  body: null,
});

describe('assertPublicHost', () => {
  it('blocks a literal private host without resolving DNS', async () => {
    const resolver = jest.fn();
    await expect(
      assertPublicHost('127.0.0.1', resolver as never),
    ).rejects.toBeInstanceOf(PrivateHostError);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('blocks localhost without resolving DNS', async () => {
    const resolver = jest.fn();
    await expect(
      assertPublicHost('localhost', resolver as never),
    ).rejects.toBeInstanceOf(PrivateHostError);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('allows a public IP literal without resolving DNS', async () => {
    const resolver = jest.fn();
    await expect(
      assertPublicHost('93.184.216.34', resolver as never),
    ).resolves.toEqual(['93.184.216.34']);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('DNS bypass: blocks a public hostname that resolves to a private IP', async () => {
    // The load-bearing case: hostname is a public string, but its A record
    // points at the AWS metadata endpoint.
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['169.254.169.254']);
    await expect(
      assertPublicHost('metadata.attacker.example', resolver),
    ).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('blocks when ANY resolved address is private (mixed record set)', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34', '10.0.0.5']);
    await expect(
      assertPublicHost('mixed.attacker.example', resolver),
    ).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('allows a public hostname that resolves to public IPs', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34']);
    await expect(assertPublicHost('example.com', resolver)).resolves.toEqual([
      '93.184.216.34',
    ]);
  });

  it('rejects a hostname that resolves to no addresses', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue([]);
    await expect(
      assertPublicHost('void.attacker.example', resolver),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('createValidatingLookup', () => {
  type LookupResult = { address: string; family: number };

  /**
   * Drives the undici `lookup` callback contract directly against the REAL
   * `createValidatingLookup` (no fake dispatcher), returning the callback's
   * arguments so a test can assert on the error/address/family it hands back.
   */
  const invokeLookup = (
    lookup: LookupFunction,
    hostname: string,
    options: { all?: boolean; family?: number },
  ): Promise<[Error | null, string | LookupResult[], number?]> =>
    new Promise((resolve) => {
      (
        lookup as unknown as (
          hostname: string,
          options: unknown,
          callback: (...callbackArguments: unknown[]) => void,
        ) => void
      )(hostname, options, (...callbackArguments) =>
        resolve(
          callbackArguments as [Error | null, string | LookupResult[], number?],
        ),
      );
    });

  it('hands the callback an error when the host resolves to a private address', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['10.0.0.5']);
    const lookup = createValidatingLookup(resolver);

    const [error, address] = await invokeLookup(
      lookup,
      'internal.attacker.example',
      {},
    );

    expect(error).toBeInstanceOf(PrivateHostError);
    expect(address).toEqual([]);
    expect(resolver).toHaveBeenCalledWith('internal.attacker.example');
  });

  it('hands the callback the validated address (single-address shape) for a public host', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34']);
    const lookup = createValidatingLookup(resolver);

    const [error, address, family] = await invokeLookup(
      lookup,
      'example.com',
      {},
    );

    expect(error).toBeNull();
    expect(address).toBe('93.184.216.34');
    expect(family).toBe(4);
  });

  it('hands the callback the full validated list (all:true shape) for a public host', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34', '93.184.216.35']);
    const lookup = createValidatingLookup(resolver);

    const [error, results] = await invokeLookup(lookup, 'example.com', {
      all: true,
    });

    expect(error).toBeNull();
    expect(results).toEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '93.184.216.35', family: 4 },
    ]);
  });

  it('selects the requested family (family:6 → the IPv6 record) via the filter', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34', '2001:db8::1']);
    const lookup = createValidatingLookup(resolver);

    const [error, address, family] = await invokeLookup(
      lookup,
      'dual-stack.example',
      { family: 6 },
    );

    expect(error).toBeNull();
    expect(address).toBe('2001:db8::1');
    expect(family).toBe(6);
  });

  it('hands the callback an error when no address survives the family filter (results.length === 0)', async () => {
    // family:6 requested but the host only has a public IPv4 record – the
    // documented empty-result behaviour rather than a wrong-family connect.
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValue(['93.184.216.34']);
    const lookup = createValidatingLookup(resolver);

    const [error, address] = await invokeLookup(lookup, 'v4-only.example', {
      family: 6,
    });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/no validated address/i);
    expect(address).toEqual([]);
  });
});

describe('safeFetch', () => {
  const publicResolver = async () => ['93.184.216.34'];

  it('fetches a public URL and returns the response', async () => {
    const fetchImpl = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue(makeResponse(200));
    const response = await safeFetch('https://example.com/', {
      resolver: publicResolver,
      fetchImpl: fetchImpl as never,
    });
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows a redirect to another public host', async () => {
    const fetchImpl = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(makeResponse(302, 'https://cdn.example.com/page'))
      .mockResolvedValueOnce(makeResponse(200));
    const response = await safeFetch('https://example.com/', {
      resolver: publicResolver,
      fetchImpl: fetchImpl as never,
    });
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('redirect bypass: rejects a redirect hop to a private host', async () => {
    const fetchImpl = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(makeResponse(302, 'http://192.168.1.10/'));
    await expect(
      safeFetch('https://attacker.example/x', {
        resolver: publicResolver,
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toBeInstanceOf(PrivateHostError);
    // Only the first hop was fetched; the private hop was blocked before connect.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('redirect bypass: rejects a redirect hop to a DNS name that resolves private', async () => {
    const resolver = jest
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValueOnce(['93.184.216.34']) // first hop public
      .mockResolvedValueOnce(['10.1.2.3']); // redirect target resolves private
    const fetchImpl = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(
        makeResponse(302, 'https://internal.attacker.example/'),
      );
    await expect(
      safeFetch('https://attacker.example/x', {
        resolver,
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toBeInstanceOf(PrivateHostError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect hop to a non-http(s) scheme', async () => {
    const fetchImpl = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(makeResponse(302, 'file:///etc/passwd'));
    await expect(
      safeFetch('https://attacker.example/x', {
        resolver: publicResolver,
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(/scheme/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-http(s) starting URL before any fetch', async () => {
    const fetchImpl = jest.fn<() => Promise<unknown>>();
    await expect(
      safeFetch('ftp://example.com/file', {
        resolver: publicResolver,
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(/scheme/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects after exceeding the redirect limit', async () => {
    // Always redirects to another public host – should bail once the cap is hit.
    const fetchImpl = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue(makeResponse(302, 'https://example.com/next'));
    await expect(
      safeFetch('https://example.com/', {
        resolver: publicResolver,
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(/too many redirects/i);
  });
});

describe('defaultFetchImpl', () => {
  it('dispatches through an undici Agent without a cross-version handler failure', async () => {
    // Regression guard for the metadata-fetch outage. safeFetch pins the TCP
    // connect through an undici `Agent` dispatcher (`safeAgent`), so its default
    // fetch MUST come from the same `undici` instance as that Agent. A
    // dispatcher built by one `undici` major is rejected by a `fetch` from
    // another with `InvalidArgumentError: invalid onRequestStart method`, which
    // fails every request. Node's built-in global `fetch` is a separately
    // versioned `undici` bundled in the runtime, so dispatching `safeAgent`
    // through it broke all metadata fetches once `undici` was bumped to a major
    // the deploy runtime did not ship.
    //
    // The connector below fails fast with a marker instead of opening a socket,
    // so no network is touched. Reaching the connector proves the fetch/Agent
    // pair is compatible; a handler-validation failure rejects before the
    // connector ever runs.
    const agent = new Agent({
      connect(_options, callback) {
        callback(new Error('connector-reached'), null);
      },
    });

    try {
      const rejection = await defaultFetchImpl('http://public.example/', {
        dispatcher: agent,
      }).then(
        () => {
          throw new Error('expected the fetch to reject');
        },
        (error: unknown) => error,
      );

      const cause = (rejection as { cause?: unknown }).cause;
      const causeMessage =
        cause instanceof Error ? cause.message : String(cause);
      expect(causeMessage).toBe('connector-reached');
    } finally {
      await agent.close();
    }
  });
});
