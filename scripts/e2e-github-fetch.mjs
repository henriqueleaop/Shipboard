// Loaded only by the isolated E2E runner; application startup never imports this.
const providerUrl = process.env.SHIPBOARD_E2E_GITHUB_URL;
if (!providerUrl) throw new Error('Missing isolated GitHub fixture URL.');
const originalFetch = globalThis.fetch;
const endpoints = new Map([
  ['https://github.com/login/oauth/access_token', '/token'],
  ['https://api.github.com/user', '/user'],
  ['https://api.github.com/user/emails', '/emails'],
]);
globalThis.fetch = (input, options) => {
  const url = input instanceof Request ? input.url : String(input);
  const replacement = endpoints.get(url);
  return originalFetch(
    replacement ? new URL(replacement, providerUrl) : input,
    options,
  );
};
