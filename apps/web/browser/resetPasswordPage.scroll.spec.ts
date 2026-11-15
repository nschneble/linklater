import { expect, test } from '@playwright/test';
import { openResetForm, TOP_BAR_OFFSETS_PX } from './helpers';

const LAYER_PADDING_PX = 15.5;
const SHORT_VIEWPORT = { height: 320, width: 393 };

for (const topBarOffset of TOP_BAR_OFFSETS_PX) {
  test(`reset form scrolls its last control into view in a short viewport with a ${topBarOffset}px top bar`, async ({
    page,
  }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    await openResetForm(page, topBarOffset);

    const lastControl = page.getByRole('button', { name: 'Back to login' });
    await expect(lastControl).toBeVisible();

    const layout = await lastControl.evaluate((element) => {
      const card = element.closest('form')!.parentElement!;
      const layer = card.closest<HTMLElement>('[data-theme="branding"]')!;
      const layerRect = layer.getBoundingClientRect();
      const cardTopAtRest = card.getBoundingClientRect().top;
      const controlBottomAtRest = element.getBoundingClientRect().bottom;
      layer.scrollTop = layer.scrollHeight;
      const control = element.getBoundingClientRect();
      return {
        cardBottomAtEnd: card.getBoundingClientRect().bottom,
        cardHeight: card.getBoundingClientRect().height,
        cardTopAtRest,
        controlBottomAtRest,
        controlBottom: control.bottom,
        controlTop: control.top,
        layerBottom: layerRect.bottom,
        layerTop: layerRect.top,
        viewportHeight: window.innerHeight,
      };
    });

    expect(layout.cardHeight).toBeGreaterThan(layout.viewportHeight);
    expect(layout.cardTopAtRest - layout.layerTop).toBeGreaterThanOrEqual(
      LAYER_PADDING_PX,
    );
    expect(layout.layerBottom - layout.cardBottomAtEnd).toBeGreaterThanOrEqual(
      LAYER_PADDING_PX,
    );
    expect(layout.controlBottomAtRest).toBeGreaterThan(layout.viewportHeight);
    expect(layout.controlTop).toBeGreaterThanOrEqual(0);
    expect(layout.controlBottom).toBeLessThanOrEqual(layout.viewportHeight);
  });
}
