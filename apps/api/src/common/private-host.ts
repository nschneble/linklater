/**
 * Classifies a single IP literal (IPv4, IPv6, or IPv4-mapped IPv6) as private.
 * Returns `true` for the ranges an SSRF blocklist must reject:
 *   - `0.0.0.0/8` "this host" (routes to loopback on Linux/macOS)
 *   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 private)
 *   - `100.64.0.0/10` (RFC 6598 CGNAT / shared address space)
 *   - `127.0.0.0/8` (loopback)
 *   - `169.254.0.0/16` (link-local)
 *   - `192.0.0.0/24` (IETF protocol assignments)
 *   - IPv6 `::1` (loopback), `::` (unspecified), `fc00::/7` (unique-local),
 *     and `fe80::/10` (link-local)
 *
 * This is a purely *lexical* check on the address string. It performs no DNS
 * resolution. It is the entry point used to validate an address that has
 * already been resolved (by the SSRF guard in `safe-fetch.ts`) as well as by
 * `isPrivateHost` below.
 *
 * IPv6 unique-local (fc00::/7) and link-local (fe80::/10) are blocked.
 * IPv4-mapped IPv6 (`::ffff:<ipv4>`) is unwrapped and the embedded IPv4
 * is checked against the private ranges. Without this step the loopback
 * and RFC 1918 ranges are reachable through the mapped form.
 */
export function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase();

  if (lower === '::1' || lower === '[::1]') return true;

  // IPv6 unspecified address (like 0.0.0.0/8): connecting to it routes to a
  // local service, so block it explicitly rather than relying on a failed
  // resolution to reject it.
  if (lower === '::' || lower === '[::]') return true;

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10). Anchored to
  // IPv6 literal syntax (hex segment + colon) so public DNS hostnames
  // starting with 'fc'/'fd'/'fe8'–'feb' (e.g. fcc.gov, fdic.gov, febreze.com)
  // are not matched, as those contain dots, not colons.
  if (/^\[?(?:f[cd][0-9a-f]{0,2}|fe[89ab][0-9a-f]?):/i.test(lower)) return true;

  // IPv4-mapped IPv6: unwrap and fall through to IPv4 checks below
  const ipv4MappedDotted = lower.match(
    /^\[?::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?$/i,
  );
  const ipv4MappedHex = lower.match(
    /^\[?::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]?$/i,
  );

  let effective = lower;
  if (ipv4MappedDotted) {
    effective = ipv4MappedDotted[1];
  } else if (ipv4MappedHex) {
    const high = parseInt(ipv4MappedHex[1], 16);
    const low = parseInt(ipv4MappedHex[2], 16);
    effective = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
  }

  const ipv4 = effective.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, firstOctet, secondOctet, thirdOctet] = ipv4.map(Number);
    if (firstOctet === 0) return true; // 0.0.0.0/8 "this host", routes to loopback on Linux/macOS (SSRF bypass)
    if (firstOctet === 127) return true; // 127.0.0.0/8 loopback
    if (firstOctet === 10) return true; // 10.0.0.0/8 private
    if (firstOctet === 100 && secondOctet >= 64 && secondOctet <= 127)
      return true; // 100.64.0.0/10 RFC 6598 CGNAT / shared address space (cloud k8s pod/service IPs)
    if (firstOctet === 169 && secondOctet === 254) return true; // 169.254.0.0/16 link-local
    if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
      return true; // 172.16.0.0/12 private
    if (firstOctet === 192 && secondOctet === 0 && thirdOctet === 0)
      return true; // 192.0.0.0/24 IETF protocol assignments
    if (firstOctet === 192 && secondOctet === 168) return true; // 192.168.0.0/16 private
  }

  return false;
}

/**
 * Purely *lexical* SSRF fast-fail: returns `true` for the `localhost` label and
 * for any IP literal in a private/loopback/link-local range (via
 * `isPrivateAddress`). Performs no DNS resolution, so it cannot catch a public
 * hostname whose DNS record points at a private address. That (and redirect
 * following) is handled by the resolving guard in `safe-fetch.ts`
 * (`assertPublicHost` / `safeFetch`), which is the load-bearing SSRF defence.
 *
 * Used by the DTO validator as a cheap literal check and by the metadata
 * fetcher to short-circuit obviously-private literal hosts before any I/O.
 */
export function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (lower === 'localhost') return true;

  return isPrivateAddress(lower);
}
