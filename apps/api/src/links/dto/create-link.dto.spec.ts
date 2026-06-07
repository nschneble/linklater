import { validate } from 'class-validator';
import { CreateLinkDto } from './create-link.dto.js';

const makeDto = (overrides: Partial<CreateLinkDto> = {}) =>
  Object.assign(new CreateLinkDto(), {
    url: 'https://example.com/article',
    ...overrides,
  });

describe('CreateLinkDto', () => {
  it('accepts a valid https URL', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid http URL', async () => {
    const errors = await validate(makeDto({ url: 'http://example.com' }));
    expect(errors).toHaveLength(0);
  });

  it('rejects a plain string that is not a URL', async () => {
    const errors = await validate(makeDto({ url: 'not a url' }));
    const urlErrors = errors.filter((error) => error.property === 'url');
    expect(urlErrors.length).toBeGreaterThan(0);
  });

  it('rejects a missing url', async () => {
    const dto = new CreateLinkDto();
    const errors = await validate(dto);
    const urlErrors = errors.filter((error) => error.property === 'url');
    expect(urlErrors.length).toBeGreaterThan(0);
  });

  it('rejects a URL without a protocol', async () => {
    const errors = await validate(makeDto({ url: 'example.com/article' }));
    const urlErrors = errors.filter((error) => error.property === 'url');
    expect(urlErrors.length).toBeGreaterThan(0);
  });

  it('rejects a URL with credentials in it', async () => {
    const errors = await validate(
      makeDto({ url: 'https://user:pass@example.com' }),
    );
    const urlErrors = errors.filter((error) => error.property === 'url');
    expect(urlErrors.length).toBeGreaterThan(0);
  });

  describe('SSRF protection — private hosts', () => {
    it('rejects loopback 127.0.0.1', async () => {
      const errors = await validate(makeDto({ url: 'http://127.0.0.1' }));
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects localhost', async () => {
      const errors = await validate(
        makeDto({ url: 'http://localhost/secret' }),
      );
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects RFC 1918 10.x.x.x', async () => {
      const errors = await validate(makeDto({ url: 'http://10.0.0.1' }));
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects RFC 1918 172.16.x.x', async () => {
      const errors = await validate(makeDto({ url: 'http://172.16.0.1' }));
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects RFC 1918 192.168.x.x', async () => {
      const errors = await validate(makeDto({ url: 'http://192.168.1.1' }));
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects IPv6 loopback ::1', async () => {
      const errors = await validate(makeDto({ url: 'http://[::1]' }));
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects IPv6 link-local fe80::', async () => {
      const errors = await validate(makeDto({ url: 'http://[fe80::1]' }));
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('rejects IPv4-mapped loopback ::ffff:127.0.0.1', async () => {
      const errors = await validate(
        makeDto({ url: 'http://[::ffff:127.0.0.1]' }),
      );
      const urlErrors = errors.filter((error) => error.property === 'url');
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('accepts a public URL (not a private range)', async () => {
      const errors = await validate(
        makeDto({ url: 'https://news.ycombinator.com/item?id=1' }),
      );
      expect(errors).toHaveLength(0);
    });
  });
});
