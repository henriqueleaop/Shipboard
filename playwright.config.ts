import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // The built API keeps Better Auth's production per-IP sign-up limit.
  workers: 1,
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    browserName: 'chromium',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  outputDir: 'test-results',
});
