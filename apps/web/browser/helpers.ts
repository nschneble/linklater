import type { Page } from '@playwright/test';

export const CENTER_TOLERANCE_PX = 2;
export const TOP_BAR_OFFSETS_PX = [0, 100];

export async function openResetForm(page: Page, topBarOffset: number) {
  await page.goto('/reset-password?token=browser-test-token');
  await page.evaluate((offset) => {
    document.body.style.paddingTop = `${offset}px`;
  }, topBarOffset);
}
