import { expect, type Page, type TestInfo } from '@playwright/test';

export async function captureResponsive(
  page: Page,
  info: TestInfo,
  name: string,
) {
  const original = page.viewportSize();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${name} at ${width}px`,
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${name}-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name} at 200%`,
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath(`${name}-zoom.png`),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  if (original) await page.setViewportSize(original);
}
