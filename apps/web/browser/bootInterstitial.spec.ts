import { expect, test } from '@playwright/test';

const BOOT_MESSAGE = 'Defrosting Linklater in the microwave…';
const CENTER_TOLERANCE_PX = 2;
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
      const liveRegion = '[role="status"], [aria-live]';
      const box = element.getBoundingClientRect();
      const interstitial = element.closest('[data-theme="branding"]')!;
      return {
        center: box.top + box.height / 2,
        hidden: element.closest('[aria-hidden="true"]') !== null,
        insideLiveRegion: interstitial.closest(liveRegion) !== null,
        holdsLiveRegion: interstitial.querySelector(liveRegion) !== null,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });

    expect(
      Math.abs(layout.center - layout.viewportHeight / 2),
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.insideLiveRegion).toBe(false);
    expect(layout.holdsLiveRegion).toBe(false);
    expect(layout.hidden).toBe(false);
  });
}
