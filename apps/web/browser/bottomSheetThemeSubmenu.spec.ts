import { CENTER_TOLERANCE_PX } from './helpers';
import { expect, test, type Route } from '@playwright/test';

const MIN_TARGET_SIZE_PX = 24;
const USER_EMAIL = 'browser-test@linklater.test';

const ME_RESPONSE = {
  accountDeletionPending: false,
  connectedProviders: [],
  customTheme: null,
  customThemeEnabled: false,
  cvdMode: false,
  dyslexicFont: false,
  email: USER_EMAIL,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  hasPassword: true,
  mode: 'light',
  multiFactorMethod: null,
  multiFactorPending: false,
  pendingEmail: null,
  theme: 'apollo-10-1-2',
  userId: 'browser-test-user',
  welcomedAt: '2026-01-01T00:00:00.000Z',
};

function fulfillApi(route: Route) {
  const request = route.request();
  if (!['fetch', 'xhr'].includes(request.resourceType())) {
    return route.continue();
  }

  const path = new URL(request.url()).pathname;
  if (path.endsWith('/auth/me')) {
    return route.fulfill({ json: ME_RESPONSE });
  }
  if (path.endsWith('/links')) {
    return route.fulfill({ json: { data: [], limit: 20, page: 1, total: 0 } });
  }
  return route.fulfill({ json: {} });
}

test.use({ hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await page.route('**/*', fulfillApi);
  await page.addInitScript(() => {
    localStorage.setItem('linklater_token', 'browser-test-token');
  });
});

test('theme subview centers its title beside an intrinsic-width back button', async ({
  page,
}) => {
  await page.goto('/unread');
  await page.getByRole('button', { name: `User menu (${USER_EMAIL})` }).tap();

  const sheet = page.getByRole('dialog', { name: 'User menu' });
  const logOut = sheet.getByRole('menuitem', { name: 'Log out' });
  await expect(logOut).toBeVisible();
  const logOutLayout = await logOut.evaluate((element) => ({
    sectionWidth: element.parentElement!.getBoundingClientRect().width,
    width: element.getBoundingClientRect().width,
  }));
  expect(logOutLayout.width).toBe(logOutLayout.sectionWidth);

  await sheet.getByRole('menuitem', { name: /^Theme/ }).tap();
  const backButton = sheet.getByRole('menuitem', { name: 'Back to main menu' });
  await expect(backButton).toBeFocused();

  const layout = await backButton.evaluate((element) => {
    const panel = element.closest('[role="menu"]')!.getBoundingClientRect();
    const section = element.parentElement!;
    const title = section.querySelector('p')!.getBoundingClientRect();
    const firstColumnWidth = parseFloat(
      getComputedStyle(section).gridTemplateColumns.split(' ')[0],
    );
    const button = element.getBoundingClientRect();
    return {
      button: {
        height: button.height,
        width: button.width,
      },
      firstColumnWidth,
      panelCenter: panel.left + panel.width / 2,
      titleCenter: title.left + title.width / 2,
    };
  });

  expect(Math.abs(layout.titleCenter - layout.panelCenter)).toBeLessThanOrEqual(
    CENTER_TOLERANCE_PX,
  );
  expect(layout.button.width).toBeGreaterThanOrEqual(MIN_TARGET_SIZE_PX);
  expect(layout.button.height).toBeGreaterThanOrEqual(MIN_TARGET_SIZE_PX);
  expect(layout.button.width).toBeLessThan(layout.firstColumnWidth);
});
