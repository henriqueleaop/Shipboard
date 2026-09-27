import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import {
  createServer as createTlsServer,
  type Server as TlsServer,
} from 'node:https';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port.');
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

async function ready(url: string, child: ChildProcess, description: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`${description} exited early.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The isolated process is still starting.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`${description} did not become ready.`);
}

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((done) => child.once('exit', () => done())),
    new Promise<void>((done) => setTimeout(done, 8_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

const container = await new PostgreSqlContainer('postgres:18.1').start();
let api: ChildProcess | undefined;
let web: ChildProcess | undefined;
const tlsServers: TlsServer[] = [];
const certificateDirectory = mkdtempSync(join(tmpdir(), 'shipboard-e2e-tls-'));
try {
  const databaseUrl = container.getConnectionUri();
  const apiPort = await freePort();
  const webPort = await freePort();
  const apiTlsPort = await freePort();
  const webTlsPort = await freePort();
  const apiUrl = `http://localhost:${apiPort}`;
  const webUrl = `http://localhost:${webPort}`;
  const publicApiUrl = `https://localhost:${apiTlsPort}`;
  const publicWebUrl = `https://localhost:${webTlsPort}`;
  const keyPath = join(certificateDirectory, 'key.pem');
  const certPath = join(certificateDirectory, 'cert.pem');
  const gitOpenSsl = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';
  const openssl =
    process.env.OPENSSL_BIN ??
    (process.platform === 'win32' && existsSync(gitOpenSsl)
      ? gitOpenSsl
      : 'openssl');
  const certificate = spawnSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
    ],
    { stdio: 'ignore' },
  );
  if (certificate.status !== 0)
    throw new Error('Could not create the test TLS certificate.');
  const tlsOptions = {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
  async function proxy(targetPort: number, listenPort: number) {
    const server = createTlsServer(tlsOptions, (incoming, outgoing) => {
      const upstream = httpRequest(
        {
          hostname: '127.0.0.1',
          port: targetPort,
          path: incoming.url,
          method: incoming.method,
          headers: incoming.headers,
        },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
        },
      );
      upstream.on('error', () => outgoing.destroy());
      incoming.pipe(upstream);
    });
    await new Promise<void>((done) =>
      server.listen(listenPort, '127.0.0.1', done),
    );
    tlsServers.push(server);
  }
  await proxy(apiPort, apiTlsPort);
  await proxy(webPort, webTlsPort);
  const apiRoot = resolve('apps/api');
  const webRoot = resolve('apps/web');
  const authSecret = `e2e-${randomUUID()}-${randomUUID()}`;
  const apiEnv = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: authSecret,
    AUTH_BASE_URL: publicApiUrl,
    WEB_ORIGIN: publicWebUrl,
    OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
  };
  const migration = spawnSync(
    process.execPath,
    ['dist/infrastructure/database/migrate.js'],
    { cwd: apiRoot, env: apiEnv, encoding: 'utf8', timeout: 30_000 },
  );
  if (migration.status !== 0) throw new Error('E2E migration failed.');
  api = spawn(process.execPath, ['dist/server.js'], {
    cwd: apiRoot,
    env: apiEnv,
    windowsHide: true,
    stdio: 'ignore',
  });
  await ready(`${apiUrl}/health/ready`, api, 'API');
  web = spawn(process.execPath, ['.next/standalone/apps/web/server.js'], {
    cwd: webRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(webPort),
      API_PUBLIC_URL: publicApiUrl,
      API_INTERNAL_URL: apiUrl,
    },
    windowsHide: true,
    stdio: 'ignore',
  });
  await ready(webUrl, web, 'Web');
  const runner = spawn(
    process.execPath,
    [resolve('node_modules/@playwright/test/cli.js'), 'test'],
    {
      cwd: process.cwd(),
      env: { ...process.env, E2E_WEB_URL: publicWebUrl },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  const code = await new Promise<number | null>((done, fail) => {
    runner.once('error', fail);
    runner.once('exit', done);
  });
  if (code !== 0) throw new Error('Playwright journey failed.');
} finally {
  await stop(web);
  await stop(api);
  await Promise.all(
    tlsServers.map(
      (server) => new Promise<void>((done) => server.close(() => done())),
    ),
  );
  rmSync(certificateDirectory, { recursive: true, force: true });
  await container.stop();
}
