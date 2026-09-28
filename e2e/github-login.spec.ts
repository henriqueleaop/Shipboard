import { expect, test } from '@playwright/test';

test('GitHub provider establishes, repeats and revokes a real persisted session', async ({
  page,
}) => {
  const fixture = process.env.E2E_GITHUB_URL;
  if (!fixture) throw new Error('The isolated provider fixture is required.');
  await page.route(
    'https://github.com/login/oauth/authorize*',
    async (route) => {
      const github = new URL(route.request().url());
      const target = new URL('/authorize', fixture);
      target.search = github.search;
      await route.fulfill({
        status: 302,
        headers: { location: target.toString() },
      });
    },
  );
  await page.goto('/login?returnTo=%2Fboards');
  await page.getByRole('button', { name: 'Continue with GitHub' }).click();
  await expect(
    page.getByRole('heading', { name: 'GitHub test identity' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Authorize test identity' }).click();
  await expect(page.getByRole('heading', { name: 'My boards' })).toBeVisible();
  const cookie = (await page.context().cookies()).find((value) =>
    value.name.includes('session_token'),
  );
  expect(cookie?.secure).toBe(true);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My boards' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Continue with GitHub' }).click();
  await page.getByRole('link', { name: 'Authorize test identity' }).click();
  await expect(page.getByRole('heading', { name: 'My boards' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/boards');
  await expect(
    page.getByRole('heading', { name: 'Sign in to manage boards' }),
  ).toBeVisible();
});
