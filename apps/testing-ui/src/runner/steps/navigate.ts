import type { Page } from 'playwright';
import type { HarnessConfig } from '../../../playwright.config.ts';

export async function runNavigate(
  page: Page,
  path: string,
  config: HarnessConfig,
): Promise<void> {
  const url = new URL(path, config.baseUrl).toString();
  await page.goto(url, {
    timeout: config.navigationTimeoutMs,
    waitUntil: 'networkidle',
  });
}
