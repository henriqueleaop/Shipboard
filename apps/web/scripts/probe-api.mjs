const rawUrl = process.env.API_INTERNAL_URL ?? 'http://api:3001';

try {
  const origin = new URL(rawUrl);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.pathname !== '/'
  ) {
    throw new Error('Invalid API URL.');
  }
  const response = await fetch(new URL('/health/ready', origin), {
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok || (await response.json()).status !== 'ok') {
    throw new Error('API is unavailable.');
  }
  process.stdout.write('API reachable.\n');
} catch {
  process.stderr.write('API connectivity probe failed.\n');
  process.exitCode = 1;
}
