/**
 * Returns `true` for any hostname that resolves to a private, loopback,
 * link-local, or otherwise non-public address. Used by both the DTO
 * validator (SSRF gate at input time) and the metadata fetcher (second
 * line of defence before any network I/O).
 *
 * IPv6 unique-local (fc00::/7) and link-local (fe80::/10) are blocked.
 * IPv4-mapped IPv6 (`::ffff:<ipv4>`) is unwrapped and the embedded IPv4
 * is checked against the private ranges – without this step the loopback
 * and RFC 1918 ranges are reachable through the mapped form.
 */
export function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (lower === 'localhost') return true;

  if (lower === '::1' || lower === '[::1]') return true;

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10). Anchored to
  // IPv6 literal syntax (hex segment + colon) so public DNS hostnames
  // starting with 'fc'/'fd'/'fe8'–'feb' (e.g. fcc.gov, fdic.gov, febreze.com)
  // are not matched – those contain dots, not colons.
  if (/^\[?(?:f[cd][0-9a-f]{0,2}|fe[89ab][0-9a-f]?):/i.test(lower)) return true;

  // IPv4-mapped IPv6 – unwrap and fall through to IPv4 checks below
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
    const [, firstOctet, secondOctet] = ipv4.map(Number);
    if (firstOctet === 0) return true; // 0.0.0.0/8 "this host" – routes to loopback on Linux/macOS (SSRF bypass)
    if (firstOctet === 127) return true; // 127.0.0.0/8 loopback
    if (firstOctet === 10) return true; // 10.0.0.0/8 private
    if (firstOctet === 169 && secondOctet === 254) return true; // 169.254.0.0/16 link-local
    if (firstOctet === 192 && secondOctet === 168) return true; // 192.168.0.0/16 private
    if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
      return true; // 172.16.0.0/12 private
  }

  return false;
}
