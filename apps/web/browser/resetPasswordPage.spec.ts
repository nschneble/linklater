import { expect, test, type Page } from '@playwright/test';

const CENTER_TOLERANCE_PX = 2;
const SHORT_VIEWPORT = { height: 320, width: 393 };
const TOP_BAR_OFFSETS_PX = [0, 100];

async function openResetForm(page: Page, topBarOffset: number) {
  await page.goto('/reset-password?token=browser-test-token');
  await page.evaluate((offset) => {
    document.body.style.paddingTop = `${offset}px`;
  }, topBarOffset);
}

async function measureCentering(page: Page, heading: string) {
  const card = page.getByRole('heading', { name: heading }).locator('..');
  await expect(card).toBeVisible();

  return card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const layer = element
      .closest('[data-theme="branding"]')!
      .getBoundingClientRect();
    return {
      center: box.top + box.height / 2,
      layerBottom: layer.bottom,
      layerTop: layer.top,
      viewportHeight: window.innerHeight,
    };
  });
}

function expectCentered(layout: Awaited<ReturnType<typeof measureCentering>>) {
  expect(
    Math.abs(layout.center - layout.viewportHeight / 2),
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

  test(`reset form scrolls its last control into a short viewport with a ${topBarOffset}px top bar`, async ({
    page,
  }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    await openResetForm(page, topBarOffset);

    const lastControl = page.getByRole('button', { name: 'Back to login' });
    await expect(lastControl).toBeVisible();

    const layout = await lastControl.evaluate((element) => {
      const card = element.closest('form')!.parentElement!;
      const layer = card.closest<HTMLElement>('[data-theme="branding"]')!;
      const cardTopAtRest = card.getBoundingClientRect().top;
      const controlBottomAtRest = element.getBoundingClientRect().bottom;
      layer.scrollTop = layer.scrollHeight;
      const control = element.getBoundingClientRect();
      return {
        cardHeight: card.getBoundingClientRect().height,
        cardTopAtRest,
        controlBottomAtRest,
        controlBottom: control.bottom,
        controlTop: control.top,
        viewportHeight: window.innerHeight,
      };
    });

    expect(layout.cardHeight).toBeGreaterThan(layout.viewportHeight);
    expect(layout.cardTopAtRest).toBeGreaterThanOrEqual(0);
    expect(layout.controlBottomAtRest).toBeGreaterThan(layout.viewportHeight);
    expect(layout.controlTop).toBeGreaterThanOrEqual(0);
    expect(layout.controlBottom).toBeLessThanOrEqual(layout.viewportHeight);
  });
}

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
