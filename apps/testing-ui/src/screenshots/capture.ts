import type { Page } from 'playwright';

/**
 * Full-page screenshot with animations disabled and caret hidden so the same
 * UI renders to bit-identical pixels across runs. Returns the raw PNG buffer
 * so the caller can write to a baseline or an actual file.
 */
export async function capturePage(page: Page): Promise<Buffer> {
  return page.screenshot({
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
}
