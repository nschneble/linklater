import { CENTER_TOLERANCE_PX } from './helpers';
import { expect, test } from '@playwright/test';

const BOOT_MESSAGE = 'Defrosting Linklater in the microwave…';
const TOP_BAR_OFFSETS_PX = [0, 100];

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/me', () => {});
  await page.addInitScript(() => {
    localStorage.setItem('linklater_token', 'browser-test-token');
  });
});

for (const topBarOffset of TOP_BAR_OFFSETS_PX) {
  test(`boot message is centered with a ${topBarOffset}px top bar`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate((offset) => {
      document.body.style.paddingTop = `${offset}px`;
    }, topBarOffset);

    const message = page.getByText(BOOT_MESSAGE, { exact: true });
    await expect(message).toBeVisible();

    const layout = await message.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const interstitial = element.closest('[data-theme="branding"]')!;
      return {
        horizontalCenter: text.left + text.width / 2,
        insideLiveRegion:
          interstitial.closest('[role="status"], [aria-live]') !== null,
        scrollHeight: document.documentElement.scrollHeight,
        verticalCenter: text.top + text.height / 2,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(
      Math.abs(layout.verticalCenter - layout.viewportHeight / 2),
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expect(
      Math.abs(layout.horizontalCenter - layout.viewportWidth / 2),
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.insideLiveRegion).toBe(false);
  });
}
