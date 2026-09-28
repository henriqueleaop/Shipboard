import { expect, test } from '@playwright/test';
import { captureResponsive } from './helpers/visual';
import { seedPaginationIdeas } from './helpers/feedback-fixtures';

test('visitor suggests and votes; owner changes status; public board reflects progress', async ({
  page,
  browser,
}, testInfo) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `feedback-${suffix}`;
  const password = 'correct-password';
  await page.goto('/register');
  await page.getByLabel('Email').fill(`owner-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('link', { name: 'Create board' }).first().click();
  await page.getByLabel('Board name').fill('Northstar');
  await page.getByLabel('Public slug').fill(slug);
  await page.getByLabel('Description').fill('Help us choose what comes next.');
  await page.getByRole('button', { name: 'Create board' }).click();
  await expect(page.getByRole('heading', { name: 'Northstar' })).toBeVisible();
  const ownerUrl = page.url();
  const owner = await page.context().newPage();
  await owner.goto(ownerUrl);
  await owner.getByRole('link', { name: 'Review ideas' }).click();
  await expect(
    owner.getByRole('heading', { name: 'No ideas in this view' }),
  ).toBeVisible();
  await captureResponsive(owner, testInfo, 'owner-empty');
  await owner.goto(ownerUrl);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/${slug}`);
  await expect(
    visitorPage.getByRole('heading', { name: 'Northstar' }),
  ).toBeVisible();
  await expect(
    visitorPage.getByRole('heading', { name: 'No ideas here yet' }),
  ).toBeVisible();
  await captureResponsive(visitorPage, testInfo, 'public-empty');
  await expect(
    visitorPage.getByRole('link', { name: 'Sign in to suggest' }),
  ).toHaveAttribute('href', /returnTo=/);
  await visitorPage.getByRole('link', { name: 'Sign in to suggest' }).click();
  const registerLink = visitorPage
    .getByRole('main')
    .getByRole('link', { name: 'Create account' });
  await expect(registerLink).toHaveAttribute('href', new RegExp(slug));
  await registerLink.click();
  await expect(
    visitorPage.getByRole('heading', { name: 'Start something good.' }),
  ).toBeVisible();
  await visitorPage.getByLabel('Email').fill(`visitor-${suffix}@example.test`);
  await visitorPage.getByLabel('Password', { exact: true }).fill(password);
  await visitorPage.getByRole('button', { name: 'Create account' }).click();
  await expect(
    visitorPage.getByRole('heading', { name: 'Northstar' }),
  ).toBeVisible();
  await visitorPage.getByLabel('A clear title').fill('Keyboard shortcuts');
  await visitorPage
    .getByLabel('Why it matters')
    .fill('Move through the board without a mouse.');
  await visitorPage.getByRole('button', { name: 'Publish idea' }).click();
  await expect(
    visitorPage.getByRole('heading', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  await visitorPage.getByRole('button', { name: /Vote$/ }).click();
  await expect(
    visitorPage.getByRole('button', { name: /Voted/ }),
  ).toBeVisible();
  await visitorPage.getByRole('button', { name: /Voted/ }).click();
  await expect(visitorPage.getByText('0 votes')).toBeVisible();
  await visitorPage.reload();
  await expect(
    visitorPage.getByRole('button', { name: /Vote$/ }),
  ).toHaveAttribute('aria-pressed', 'false');
  await visitorPage.getByRole('button', { name: /Vote$/ }).click();
  await expect(
    visitorPage.getByRole('button', { name: /Voted/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await visitorPage.reload();
  await expect(visitorPage.getByText('1 vote')).toBeVisible();
  await expect(
    visitorPage.getByRole('button', { name: /Voted/ }),
  ).toBeVisible();
  await visitorPage.screenshot({
    path: testInfo.outputPath('idea-detail.png'),
    fullPage: true,
  });
  await captureResponsive(visitorPage, testInfo, 'idea-detail');

  await visitorPage.goto(`/${slug}`);
  await expect(
    visitorPage.getByRole('button', {
      name: 'Remove vote from Keyboard shortcuts',
    }),
  ).toHaveAttribute('aria-pressed', 'true');

  await owner.getByRole('link', { name: 'Review ideas' }).click();
  await expect(
    owner.getByRole('heading', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  const staleReview = await owner.context().newPage();
  await staleReview.goto(owner.url());
  await staleReview.getByLabel('Move to').selectOption('IN_PROGRESS');
  await owner.getByLabel('Move to').selectOption('PLANNED');
  await owner.getByRole('button', { name: 'Update status' }).click();
  await expect(owner.getByText('Planned', { exact: true })).toBeVisible();
  await staleReview.getByRole('button', { name: 'Update status' }).click();
  await expect(
    staleReview.getByRole('alert').filter({ hasText: 'another tab' }),
  ).toBeVisible();
  await expect(staleReview.getByLabel('Move to')).toHaveValue('IN_PROGRESS');
  await staleReview.close();
  await owner.screenshot({
    path: testInfo.outputPath('owner-review.png'),
    fullPage: true,
  });
  await captureResponsive(owner, testInfo, 'owner-review');
  await owner.getByLabel('Sort by').selectOption('most_voted');
  await expect(
    owner.getByRole('heading', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  await owner.getByLabel('Show', { exact: true }).selectOption('REJECTED');
  await expect(
    owner.getByRole('heading', { name: 'No ideas in this view' }),
  ).toBeVisible();
  await owner.getByLabel('Show', { exact: true }).selectOption('');
  await expect(
    owner.getByRole('heading', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.screenshot({
    path: testInfo.outputPath('owner-review-mobile.png'),
    fullPage: true,
  });
  expect(
    await owner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await visitorPage.reload();
  await expect(visitorPage.getByText('Planned', { exact: true })).toBeVisible();
  await visitorPage.goto(`/${slug}?sort=most_voted&status=PLANNED`);
  await expect(
    visitorPage.getByRole('link', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  await visitorPage.screenshot({
    path: testInfo.outputPath('public-board-desktop.png'),
    fullPage: true,
  });
  await captureResponsive(visitorPage, testInfo, 'public-board');
  await visitorPage.setViewportSize({ width: 390, height: 844 });
  await visitorPage.screenshot({
    path: testInfo.outputPath('public-board-mobile.png'),
    fullPage: true,
  });
  expect(
    await visitorPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const boardId = new URL(ownerUrl).pathname.split('/').at(-1)!;
  const longDescription =
    'A long community request with café, 日本語 and useful context. '.repeat(
      30,
    );
  await seedPaginationIdeas(boardId, longDescription);
  await visitorPage.setViewportSize({ width: 1440, height: 1000 });
  await visitorPage.goto(`/${slug}`);
  await visitorPage.getByRole('button', { name: 'Load more ideas' }).click();
  await expect(
    visitorPage.getByRole('link', { name: /Additional idea/ }),
  ).toHaveCount(21);
  await expect(
    visitorPage.getByRole('button', { name: 'Load more ideas' }),
  ).toHaveCount(0);
  await visitorPage.getByLabel('Sort by').selectOption('most_voted');
  await expect(visitorPage).toHaveURL(/sort=most_voted/);
  await expect(visitorPage.locator('.suggestion-card').first()).toContainText(
    'Keyboard shortcuts',
  );
  await visitorPage
    .getByLabel('Status', { exact: true })
    .selectOption('SHIPPED');
  await expect(
    visitorPage.getByRole('heading', { name: 'No ideas here yet' }),
  ).toBeVisible();
  await captureResponsive(visitorPage, testInfo, 'filtered-empty');
  await visitorPage.goBack();
  await expect(visitorPage.getByLabel('Status', { exact: true })).toHaveValue(
    '',
  );
  await expect(
    visitorPage.getByRole('link', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  for (const width of [768, 320]) {
    await visitorPage.setViewportSize({ width, height: 1000 });
    await visitorPage.screenshot({
      path: testInfo.outputPath(`public-board-${width}.png`),
      fullPage: true,
    });
    expect(
      await visitorPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await visitorPage.setViewportSize({ width: 1440, height: 1000 });
  await visitorPage.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await visitorPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await visitorPage.screenshot({
    path: testInfo.outputPath('public-board-zoom.png'),
    fullPage: true,
  });
  await visitorPage.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  await visitorPage.goto(`/${slug}/suggestions/${crypto.randomUUID()}`);
  await expect(
    visitorPage.getByRole('heading', { name: 'This idea could not be found.' }),
  ).toBeVisible();
  await captureResponsive(visitorPage, testInfo, 'idea-not-found');
  await visitorPage.goto(`/missing-${suffix}`);
  await expect(
    visitorPage.getByRole('heading', {
      name: 'This board could not be found.',
    }),
  ).toBeVisible();
  await captureResponsive(visitorPage, testInfo, 'board-not-found');
  const publicApi = `**/api/v1/public/boards/${slug}`;
  await visitorPage.route(publicApi, (route) => route.abort());
  await visitorPage.goto(`/${slug}`);
  await expect(
    visitorPage.getByRole('heading', { name: 'We could not load this board.' }),
  ).toBeVisible();
  await captureResponsive(visitorPage, testInfo, 'board-network-error');
  await visitorPage.unroute(publicApi);
  await visitorPage
    .getByRole('button', { name: 'Try again', exact: true })
    .click();
  await expect(
    visitorPage.getByRole('heading', { name: 'Northstar' }),
  ).toBeVisible();
  await visitor.close();
  await owner.close();
});
