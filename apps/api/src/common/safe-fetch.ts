import { isIP, type LookupFunction } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { Agent, fetch as undiciFetch } from 'undici';
import { isPrivateAddress, isPrivateHost } from './private-host.js';

/**
 * SSRF-hardened fetch for the metadata worker.
 *
 * The threat: a saved URL is attacker-controlled. A pattern-only host check
 * (see `isPrivateHost`) is bypassable two ways:
 *   1. DNS bypass: a *public* hostname whose A/AAAA record points at an
 *      internal address (e.g. `169.254.169.254`, `127.0.0.1`, `10.x`).
 *   2. Redirect bypass: a public URL that 3xx-redirects to an internal host.
 *
 * The load-bearing defence here is to resolve the hostname to its IP(s) and
 * validate every resolved address against the private ranges before connecting,
 * and to follow redirects manually so each hop is re-resolved, re-validated,
 * and scheme-checked.
 *
 * DNS-rebinding (TOCTOU) is closed by pinning the actual TCP connection to a
 * validated address: `safeAgent` installs a validating `lookup` on undici's
 * connector, so the address undici connects to is resolved and validated at
 * connect time, not a separately-resolved address that could have changed
 * between the check and the connect. `assertPublicHost` additionally does an
 * eager resolve+validate before each hop for a fast, well-logged early reject.
 */

/** Maximum number of redirect hops `safeFetch` will follow before bailing. */
export const MAX_REDIRECTS = 5;

/** Resolves a hostname to the list of IP address strings it points at. */
export type HostResolver = (hostname: string) => Promise<string[]>;

/** A `fetch`-compatible callable (injectable so callers/tests can substitute). */
export type FetchImpl = (
  url: string,
  init: RequestInit & { dispatcher?: Agent },
) => Promise<Response>;

export interface SafeFetchOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Overridable for tests; defaults to a `node:dns/promises` lookup. */
  resolver?: HostResolver;
  /** Overridable for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchImpl;
}

/** Thrown when a host resolves to (or literally is) a private address. */
export class PrivateHostError extends Error {
  constructor(hostname: string, address?: string) {
    const via =
      address && address !== hostname ? ` (resolved to ${address})` : '';
    super(`Refusing to connect to private host: ${hostname}${via}`);
    this.name = 'PrivateHostError';
  }
}

/** Default resolver backed by the system resolver via `node:dns/promises`. */
const defaultResolver: HostResolver = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true });
  return records.map((record) => record.address);
};

/**
 * Resolves `hostname` and asserts every resulting address is public. Returns
 * the validated address list.
 *
 * - `localhost` and private IP literals are rejected without any DNS lookup.
 * - A public IP literal is accepted as-is (no DNS lookup needed).
 * - A DNS name is resolved via `resolver`; if it yields no addresses, or any
 *   resolved address is private, the call rejects.
 *
 * @throws {PrivateHostError} when the host is, or resolves to, a private address.
 * @throws {Error} when the host cannot be resolved to any address.
 */
export async function assertPublicHost(
  hostname: string,
  resolver: HostResolver = defaultResolver,
): Promise<string[]> {
  if (isPrivateHost(hostname)) {
    throw new PrivateHostError(hostname);
  }

  // A public IP literal needs no DNS resolution. It is already an address.
  if (isIP(hostname) !== 0) {
    return [hostname];
  }

  const addresses = await resolver(hostname);
  if (addresses.length === 0) {
    throw new Error(`Host did not resolve to any address: ${hostname}`);
  }

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new PrivateHostError(hostname, address);
    }
  }

  return addresses;
}

/**
 * Builds an undici `lookup` that resolves + validates at connect time, so the
 * connection is pinned to a validated address (closes the DNS-rebind window).
 *
 * The `resolver` is injected (same DI seam as `safeFetch`/`assertPublicHost`)
 * so the load-bearing rebind gate is unit-testable without a live DNS or a
 * real socket, exported for exactly that purpose.
 */
export const createValidatingLookup =
  (resolver: HostResolver): LookupFunction =>
  (hostname, options, callback): void => {
    assertPublicHost(hostname, resolver)
      .then((addresses) => {
        // honour the family undici asked for (0 = any); wrong family fails connect
        const results = addresses
          .map((address) => ({ address, family: isIP(address) || 4 }))
          .filter(
            (result) => !options.family || result.family === options.family,
          );

        if (results.length === 0) {
          callback(new Error(`No validated address for ${hostname}`), [], 0);
          return;
        }

        if (options.all) {
          callback(null, results);
        } else {
          callback(null, results[0].address, results[0].family);
        }
      })
      // on rejection undici only inspects the error; the address is ignored
      .catch((error: Error) => callback(error, [], 0));
  };

/**
 * Process-lifetime dispatcher whose connector validates the resolved IP before
 * every TCP connect. Shared (undici pools connections), no per-request churn.
 */
const safeAgent = new Agent({
  connect: { lookup: createValidatingLookup(defaultResolver) },
});

/**
 * The fetch implementation `safeFetch` dispatches through by default.
 *
 * It MUST come from the same `undici` instance as `safeAgent`: a dispatcher
 * built by one `undici` major is rejected by a `fetch` from another
 * (`InvalidArgumentError: invalid onRequestStart method`), which surfaces as a
 * failed fetch for every request. Node's built-in global `fetch` is a
 * *separately versioned* `undici` bundled inside the runtime, so dispatching
 * `safeAgent` through it breaks whenever the runtime's `undici` and this
 * package's declared `undici` dependency drift across a major — as they did
 * once `undici` was bumped to v8 while the deploy runtime still shipped v6/v7.
 * Using `undici`'s own `fetch` pins both halves to the locked dependency.
 */
export const defaultFetchImpl = undiciFetch as unknown as FetchImpl;

/** Returns `true` for an http(s) 3xx redirect that carries a `Location`. */
const isRedirect = (status: number): boolean => status >= 300 && status < 400;

/**
 * Fetches `url` with manual, validated redirect handling. Every hop is checked
 * for an http(s) scheme and a public (resolved) host before connecting, and the
 * connection is pinned to a validated address via `safeAgent`. Returns the
 * final (non-redirect) `Response`; the caller owns reading its body.
 *
 * @throws {PrivateHostError} for a private host at any hop.
 * @throws {Error} for a non-http(s) scheme or when the redirect cap is exceeded.
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const {
    signal,
    headers,
    resolver = defaultResolver,
    fetchImpl = defaultFetchImpl,
  } = options;

  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(currentUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Refusing non-http(s) scheme: ${parsed.protocol}`);
    }

    // fast early reject; `safeAgent`'s pinned connect is what closes the rebind
    await assertPublicHost(parsed.hostname, resolver);

    const response = await fetchImpl(currentUrl, {
      signal,
      headers,
      redirect: 'manual',
      dispatcher: safeAgent,
    });

    if (!isRedirect(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      // a 3xx with no Location has nothing to follow, so return it as-is
      return response;
    }

    // discard the intermediate body so the pooled socket is released
    await response.body?.cancel().catch(() => undefined);
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(
    `Too many redirects (>${MAX_REDIRECTS}) while fetching ${url}`,
  );
}
