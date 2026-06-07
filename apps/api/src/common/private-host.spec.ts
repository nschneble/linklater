import { isPrivateHost } from './private-host.js';

describe('isPrivateHost', () => {
  describe('blocks private hosts', () => {
    it('blocks localhost', () => {
      expect(isPrivateHost('localhost')).toBe(true);
    });

    it('blocks 127.0.0.1 (loopback)', () => {
      expect(isPrivateHost('127.0.0.1')).toBe(true);
    });

    it('blocks 127.x.x.x range', () => {
      expect(isPrivateHost('127.0.0.2')).toBe(true);
    });

    it('blocks 10.x.x.x (RFC 1918)', () => {
      expect(isPrivateHost('10.0.0.1')).toBe(true);
    });

    it('blocks 10.255.255.255 (RFC 1918 upper bound)', () => {
      expect(isPrivateHost('10.255.255.255')).toBe(true);
    });

    it('blocks 172.16.x.x (RFC 1918)', () => {
      expect(isPrivateHost('172.16.0.1')).toBe(true);
    });

    it('blocks 172.31.x.x (RFC 1918 upper bound)', () => {
      expect(isPrivateHost('172.31.255.255')).toBe(true);
    });

    it('allows 172.15.x.x (just outside RFC 1918 range)', () => {
      expect(isPrivateHost('172.15.0.1')).toBe(false);
    });

    it('allows 172.32.x.x (just outside RFC 1918 range)', () => {
      expect(isPrivateHost('172.32.0.1')).toBe(false);
    });

    it('blocks 192.168.x.x (RFC 1918)', () => {
      expect(isPrivateHost('192.168.1.1')).toBe(true);
    });

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isPrivateHost('169.254.0.1')).toBe(true);
    });

    it('blocks ::1 (IPv6 loopback)', () => {
      expect(isPrivateHost('::1')).toBe(true);
    });

    it('blocks [::1] (bracketed IPv6 loopback)', () => {
      expect(isPrivateHost('[::1]')).toBe(true);
    });

    it('blocks fe80:: (IPv6 link-local)', () => {
      expect(isPrivateHost('fe80::1')).toBe(true);
    });

    it('blocks fd00:: (IPv6 unique-local)', () => {
      expect(isPrivateHost('fd00::1')).toBe(true);
    });

    it('blocks fc00:: (IPv6 unique-local)', () => {
      expect(isPrivateHost('fc00::1')).toBe(true);
    });

    it('blocks ::ffff:127.0.0.1 (IPv4-mapped loopback, dotted form)', () => {
      expect(isPrivateHost('::ffff:127.0.0.1')).toBe(true);
    });

    it('blocks ::ffff:10.0.0.1 (IPv4-mapped RFC 1918, dotted form)', () => {
      expect(isPrivateHost('::ffff:10.0.0.1')).toBe(true);
    });

    it('blocks ::ffff:192.168.1.1 (IPv4-mapped RFC 1918, dotted form)', () => {
      expect(isPrivateHost('::ffff:192.168.1.1')).toBe(true);
    });

    it('blocks IPv4-mapped loopback in compressed hex form', () => {
      // ::ffff:127.0.0.1 in compressed hex = ::ffff:7f00:1
      expect(isPrivateHost('::ffff:7f00:1')).toBe(true);
    });

    it('blocks 0.0.0.0 (routes to loopback on Linux/macOS)', () => {
      expect(isPrivateHost('0.0.0.0')).toBe(true);
    });

    it('blocks 0.255.255.255 (entire 0.0.0.0/8 reserved range)', () => {
      expect(isPrivateHost('0.255.255.255')).toBe(true);
    });
  });

  describe('allows public hosts', () => {
    it('allows example.com', () => {
      expect(isPrivateHost('example.com')).toBe(false);
    });

    it('allows 8.8.8.8 (public IPv4)', () => {
      expect(isPrivateHost('8.8.8.8')).toBe(false);
    });

    it('allows 2001:db8::1 (public IPv6 documentation range)', () => {
      expect(isPrivateHost('2001:db8::1')).toBe(false);
    });

    it('allows fcc.gov (public DNS host that starts with "fc")', () => {
      expect(isPrivateHost('fcc.gov')).toBe(false);
    });

    it('allows fdic.gov (public DNS host that starts with "fd")', () => {
      expect(isPrivateHost('fdic.gov')).toBe(false);
    });

    it('allows fda.gov (public DNS host that starts with "fd")', () => {
      expect(isPrivateHost('fda.gov')).toBe(false);
    });

    it('allows febreze.com (public DNS host that starts with "feb")', () => {
      expect(isPrivateHost('febreze.com')).toBe(false);
    });

    it('allows fe80styles.com (public DNS host that starts with "fe80" but is not an IPv6 literal)', () => {
      expect(isPrivateHost('fe80styles.com')).toBe(false);
    });
  });
});
