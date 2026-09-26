import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';

import { describe, expect, it } from 'vitest';

import { liveHealthResponseSchema } from '@shipboard/contracts';

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

function startApi(port: number | string) {
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      LOG_LEVEL: 'info',
      OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
    },
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  return { child, output: () => output };
}

async function waitForExit(
  child: ChildProcessWithoutNullStreams,
): Promise<number | null> {
  if (child.exitCode !== null || child.signalCode !== null)
    return child.exitCode;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('API did not exit within 8 seconds')),
      8_000,
    );
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function waitForLiveness(port: number): Promise<Response> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/live`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return response;
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Compiled API did not serve liveness within 8 seconds');
}

describe('compiled API process', () => {
  it('starts without a database or collector and serves liveness', async () => {
    const port = await availablePort();
    const { child, output } = startApi(port);
    try {
      const response = await waitForLiveness(port);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-request-id')).toBeTruthy();
      expect(liveHealthResponseSchema.parse(await response.json())).toEqual({
        status: 'ok',
      });
      expect(output()).toContain('api.started');
    } finally {
      child.kill();
      await waitForExit(child);
    }
  }, 12_000);

  it('rejects invalid configuration before listening without echoing it', async () => {
    const { child, output } = startApi('sensitive-invalid-port');
    try {
      expect(await waitForExit(child)).not.toBe(0);
      expect(output()).not.toContain('sensitive-invalid-port');
      expect(output()).not.toContain('api.started');
    } finally {
      if (child.exitCode === null) child.kill();
    }
  }, 12_000);

  it.skipIf(process.platform === 'win32')(
    'handles SIGTERM and releases its port on Linux',
    async () => {
      const port = await availablePort();
      const { child, output } = startApi(port);
      try {
        await waitForLiveness(port);
        child.kill('SIGTERM');
        expect(await waitForExit(child)).toBe(0);
        expect(output()).toContain('api.shutdown_completed');
        const server = createServer();
        await new Promise<void>((resolve) =>
          server.listen(port, '127.0.0.1', resolve),
        );
        await new Promise<void>((resolve) => server.close(() => resolve()));
      } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
      }
    },
    12_000,
  );
});
