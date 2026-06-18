import { buildCurlCommand } from './buildCurlCommand';
import { describe, expect, it } from 'vitest';

describe('buildCurlCommand', () => {
  it('builds a bodyless command for a GET request', () => {
    const command = buildCurlCommand({
      method: 'get',
      url: 'https://api.test/links',
      body: null,
    });

    expect(command).toBe(
      "curl -X GET 'https://api.test/links' \\\n" +
        "  -H 'Authorization: Bearer ltk_…'",
    );
  });

  it('appends content-type and body for a request with a body', () => {
    const command = buildCurlCommand({
      method: 'post',
      url: 'https://api.test/links',
      body: '{\n  "url": ""\n}',
    });

    expect(command).toContain("curl -X POST 'https://api.test/links' \\");
    expect(command).toContain("  -H 'Authorization: Bearer ltk_…' \\");
    expect(command).toContain("  -H 'Content-Type: application/json' \\");
    expect(command).toContain('  -d \'{\n  "url": ""\n}\'');
  });

  it('never renders a real token — only the ltk_ placeholder', () => {
    const command = buildCurlCommand({
      method: 'get',
      url: 'https://api.test/links',
      body: null,
    });

    expect(command).toContain('ltk_…');
    expect(command).not.toContain('Bearer ltk_real');
  });
});
