import {
  CENTER_TOLERANCE_PX,
  openResetForm,
  TOP_BAR_OFFSETS_PX,
} from './helpers';
import { expect, test, type Page } from '@playwright/test';

const WIDE_VIEWPORT = { height: 768, width: 1024 };

async function measureCentering(page: Page, heading: string) {
  const card = page.getByRole('heading', { name: heading }).locator('..');
  await expect(card).toBeVisible();

  return card.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const content = range.getBoundingClientRect();
    const layer = element
      .closest('[data-theme="branding"]')!
      .getBoundingClientRect();
    return {
      horizontalCenter: content.left + content.width / 2,
      layerBottom: layer.bottom,
      layerTop: layer.top,
      verticalCenter: content.top + content.height / 2,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
}

function expectCentered(layout: Awaited<ReturnType<typeof measureCentering>>) {
  expect(
    Math.abs(layout.verticalCenter - layout.viewportHeight / 2),
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(
    Math.abs(layout.horizontalCenter - layout.viewportWidth / 2),
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(layout.layerTop).toBe(0);
  expect(layout.layerBottom).toBe(layout.viewportHeight);
}

for (const topBarOffset of TOP_BAR_OFFSETS_PX) {
  test(`reset form is centered with a ${topBarOffset}px top bar`, async ({
    page,
  }) => {
    await openResetForm(page, topBarOffset);
    expectCentered(await measureCentering(page, 'Reset Password'));
  });
}

test('reset form is centered in a viewport wider than the card', async ({
  page,
}) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await openResetForm(page, 0);
  expectCentered(await measureCentering(page, 'Reset Password'));
});

test('reset MFA challenge is centered with a 100px top bar', async ({
  page,
}) => {
  await page.route('**/auth/reset-password', (route) =>
    route.fulfill({ json: { mfaMethod: 'totp', mfaToken: 'browser-mfa' } }),
  );
  await openResetForm(page, 100);

  await page.getByLabel('New password', { exact: true }).fill('a'.repeat(12));
  await page.getByLabel('Confirm new password').fill('a'.repeat(12));
  await page.getByRole('button', { name: 'Reset password' }).click();

  expectCentered(await measureCentering(page, 'Multi-factor authentication'));
});
