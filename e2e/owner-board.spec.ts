import { expect, test } from '@playwright/test';

test('owner registers, creates, edits, returns and handles a stale edit', async ({
  page,
  browser,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `owner-${suffix}@example.test`;
  const password = 'correct-password';
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'My boards' })).toBeVisible();
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) =>
    cookie.name.includes('session_token'),
  );
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.secure).toBe(true);
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe('Lax');
  await page.getByRole('link', { name: 'Create board' }).first().click();
  await page.getByLabel('Board name').fill('Product feedback');
  await page.getByLabel('Public slug').fill(`product-${suffix}`);
  await page.getByLabel('Description').fill('Feature requests');
  await page.getByRole('button', { name: 'Create board' }).click();
  await expect(
    page.getByRole('heading', { name: 'Product feedback' }),
  ).toBeVisible();
  const boardUrl = page.url();
  await page.getByLabel('Board name').fill('Product roadmap');
  await page.getByLabel('Public slug').fill(`roadmap-${suffix}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Board saved');
  await page.reload();
  await expect(page.getByLabel('Public slug')).toHaveValue(`roadmap-${suffix}`);

  const staleTab = await page.context().newPage();
  await staleTab.goto(boardUrl);
  await expect(staleTab.getByLabel('Board name')).toHaveValue(
    'Product roadmap',
  );
  await page.getByLabel('Board name').fill('Current roadmap');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Board saved');
  await staleTab.getByLabel('Board name').fill('Stale roadmap');
  await staleTab.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    staleTab.getByRole('alert').filter({ hasText: 'another tab' }),
  ).toBeVisible();
  await expect(staleTab.getByLabel('Board name')).toHaveValue('Stale roadmap');
  await staleTab.close();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto('/register');
  await otherPage.getByLabel('Email').fill(`other-${suffix}@example.test`);
  await otherPage.getByLabel('Password').fill(password);
  await otherPage.getByRole('button', { name: 'Create account' }).click();
  await expect(
    otherPage.getByRole('heading', { name: 'My boards' }),
  ).toBeVisible();
  await otherPage.goto(boardUrl);
  await expect(
    otherPage.getByRole('heading', { name: 'Board unavailable' }),
  ).toBeVisible();
  await other.close();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(`other-${suffix}@example.test`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'My boards' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Current roadmap/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'My boards' })).toBeVisible();
  await page.getByRole('link', { name: /Current roadmap/ }).click();
  await expect(page.getByLabel('Public slug')).toHaveValue(`roadmap-${suffix}`);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
