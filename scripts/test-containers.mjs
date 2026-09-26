import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  liveHealthResponseSchema,
  readyHealthResponseSchema,
  unavailableHealthResponseSchema,
} from '../packages/contracts/dist/index.js';

const mode = process.argv[2] ?? 'full';
if (!['--api', '--web', 'full'].includes(mode)) {
  throw new Error('Expected --api, --web, or no option.');
}

const suffix = randomUUID().slice(0, 8);
const network = `shipboard-smoke-${suffix}`;
const dbName = `${network}-postgres`;
const apiName = `${network}-api`;
const webName = `${network}-web`;
const password = `fixture-${randomUUID()}`;
const databaseUrl = `postgresql://smoke:${password}@${dbName}:5432/smoke`;
const project = `shipboard-smoke-${suffix}`;
const dockerEnv = { ...process.env };
for (const key of [
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_PORT',
  'DATABASE_URL',
  'COMPOSE_DATABASE_URL',
  'WEB_PORT',
  'API_PORT',
  'WEB_ORIGIN',
  'API_INTERNAL_URL',
  'LOG_LEVEL',
])
  delete dockerEnv[key];

async function run(args, { timeout = 60_000, allowFailure = false } = {}) {
  const child = spawn('docker', args, { windowsHide: true, env: dockerEnv });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (part) => (stdout += part));
  child.stderr.on('data', (part) => (stderr += part));
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Docker operation timed out.'));
    }, timeout);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  if (result !== 0 && !allowFailure) {
    throw new Error(
      `Docker operation failed (${result}). ${`${stdout}\n${stderr}`.replaceAll(password, '[redacted]').slice(-600)}`,
    );
  }
  return { code: result, stdout: stdout.trim(), stderr: stderr.trim() };
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function until(check, description, timeout = 35_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await check()) return;
    } catch {
      // The service may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

const requestScript = `const r=await fetch(process.argv[1],{signal:AbortSignal.timeout(2500)});console.log(JSON.stringify({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()}))`;
async function request(container, url) {
  const result = await run(
    [
      'exec',
      container,
      'node',
      '--input-type=module',
      '-e',
      requestScript,
      url,
    ],
    { timeout: 8_000 },
  );
  return JSON.parse(result.stdout);
}

function checkHealth(response, expected) {
  assert(
    response.status === expected,
    `Expected HTTP ${expected}; got ${response.status}.`,
  );
  const body = JSON.parse(response.body);
  if (expected === 200) readyHealthResponseSchema.parse(body);
  else unavailableHealthResponseSchema.parse(body);
  assert(response.headers['x-request-id'], 'Missing request ID.');
}

async function verifyApi() {
  const contents = await run([
    'run',
    '--rm',
    '--entrypoint',
    'node',
    'shipboard-api:sprint-003',
    '--input-type=module',
    '-e',
    `import fs from 'node:fs';import('@shipboard/contracts').then(()=>{if(process.getuid()===0||['tsx','vitest','drizzle-kit'].some(x=>fs.existsSync('/app/node_modules/.bin/'+x)))process.exit(1);console.log(process.getuid())})`,
  ]);
  assert(
    Number(contents.stdout) > 0,
    'API image must run as non-root with built contracts.',
  );

  const missing = await run(['run', '--rm', 'shipboard-api:sprint-003'], {
    allowFailure: true,
    timeout: 15_000,
  });
  assert(missing.code !== 0, 'Missing database URL must fail startup.');
  assert(
    !missing.stdout.includes(password) && !missing.stderr.includes(password),
    'Credentials leaked.',
  );

  await run(['network', 'create', network]);
  await run([
    'run',
    '-d',
    '--name',
    dbName,
    '--network',
    network,
    '-e',
    'POSTGRES_DB=smoke',
    '-e',
    'POSTGRES_USER=smoke',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:18.1',
  ]);
  await until(
    async () =>
      (
        await run(
          ['exec', dbName, 'pg_isready', '-U', 'smoke', '-d', 'smoke'],
          { allowFailure: true },
        )
      ).code === 0,
    'PostgreSQL',
  );

  await run([
    'run',
    '-d',
    '--name',
    apiName,
    '--network',
    network,
    '-e',
    `DATABASE_URL=${databaseUrl}`,
    '-e',
    'WEB_ORIGIN=http://localhost:3000',
    'shipboard-api:sprint-003',
  ]);
  await until(async () => {
    const response = await request(
      apiName,
      'http://127.0.0.1:3001/health/ready',
    );
    return response.status === 200;
  }, 'API readiness');
  const live = await request(apiName, 'http://127.0.0.1:3001/health/live');
  assert(live.status === 200, 'Liveness failed.');
  liveHealthResponseSchema.parse(JSON.parse(live.body));
  checkHealth(
    await request(apiName, 'http://127.0.0.1:3001/health/ready'),
    200,
  );

  const journalBefore = await run([
    'exec',
    dbName,
    'psql',
    '-U',
    'smoke',
    '-d',
    'smoke',
    '-Atqc',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='drizzle' AND table_name='__drizzle_migrations'",
  ]);
  assert(journalBefore.stdout === '0', 'API startup ran migrations.');
  for (let i = 0; i < 2; i++) {
    await run([
      'run',
      '--rm',
      '--network',
      network,
      '-e',
      `DATABASE_URL=${databaseUrl}`,
      'shipboard-api:sprint-003',
      'node',
      'dist/infrastructure/database/migrate.js',
    ]);
  }
  const journalAfter = await run([
    'exec',
    dbName,
    'psql',
    '-U',
    'smoke',
    '-d',
    'smoke',
    '-Atqc',
    'SELECT count(*) FROM drizzle.__drizzle_migrations',
  ]);
  assert(
    journalAfter.stdout === '1',
    'Baseline migration was not applied exactly once.',
  );

  await run(['stop', '--time', '10', apiName]);
  const state = await run([
    'inspect',
    '-f',
    '{{.State.ExitCode}} {{.State.OOMKilled}}',
    apiName,
  ]);
  assert(state.stdout === '0 false', 'API did not stop cleanly.');
  const logs = await run(['logs', apiName]);
  assert(
    logs.stdout.includes('api.shutdown_completed'),
    'Shutdown completion event missing.',
  );
  assert(
    !logs.stdout.includes(password) && !logs.stderr.includes(password),
    'Credentials leaked into API logs.',
  );
  console.log('API image smoke passed.');
}

async function verifyWeb() {
  const uid = await run([
    'run',
    '--rm',
    '--entrypoint',
    'node',
    'shipboard-web:sprint-003',
    '-e',
    "const fs=require('node:fs');if(process.getuid()===0||fs.existsSync('/app/node_modules/.bin/next')||fs.existsSync('/app/node_modules/.bin/tsc'))process.exit(1);console.log(process.getuid())",
  ]);
  assert(
    Number(uid.stdout) > 0,
    'Web image must run as non-root without development tools.',
  );
  await run([
    'run',
    '-d',
    '--name',
    webName,
    '-e',
    'PORT=3999',
    'shipboard-web:sprint-003',
  ]);
  await until(
    async () =>
      (await request(webName, 'http://127.0.0.1:3999/')).status === 200,
    'web startup',
  );
  const page = await request(webName, 'http://127.0.0.1:3999/');
  assert(
    page.body.includes('Shipboard') &&
      page.body.includes('Product feedback boards are being prepared.'),
    'Web production page did not render.',
  );
  const asset = page.body.match(/\/_next\/static\/[^" ]+\.css/);
  assert(asset, 'No generated CSS asset referenced by page.');
  const assetResponse = await request(
    webName,
    `http://127.0.0.1:3999${asset[0]}`,
  );
  assert(assetResponse.status === 200, 'Generated CSS asset unavailable.');
  console.log('Web image smoke passed.');
}

let fixtureDirectory;
let fixtureFile;
function compose(args, full = true, options = {}) {
  return run(
    [
      'compose',
      '--env-file',
      fixtureFile,
      '-p',
      project,
      ...(full ? ['--profile', 'full'] : []),
      ...args,
    ],
    options,
  );
}

async function composeId(service) {
  return (await compose(['ps', '-q', service])).stdout;
}

function fixtureValues(apiUrl = 'http://api:3001') {
  return (
    [
      'POSTGRES_DB=smoke',
      'POSTGRES_USER=smoke',
      `POSTGRES_PASSWORD=${password}`,
      'POSTGRES_PORT=0',
      'API_PORT=0',
      'WEB_PORT=0',
      `COMPOSE_DATABASE_URL=postgresql://smoke:${password}@postgres:5432/smoke`,
      `API_INTERNAL_URL=${apiUrl}`,
      'WEB_ORIGIN=http://localhost:3000',
    ].join('\n') + '\n'
  );
}

async function verifyFull() {
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'shipboard-stack-'));
  fixtureFile = join(fixtureDirectory, 'compose.env');
  await writeFile(fixtureFile, fixtureValues(), { mode: 0o600 });
  await compose(['config', '--quiet'], false);
  await compose(['config', '--quiet']);
  await compose(['up', '-d', '--wait', '--no-build', 'postgres'], false, {
    timeout: 90_000,
  });
  const defaultServices = (
    await compose(['ps', '--services', '--status', 'running'], false)
  ).stdout.split(/\s+/);
  assert(
    defaultServices.length === 1 && defaultServices[0] === 'postgres',
    'Default Compose profile must start PostgreSQL only.',
  );

  await compose(['up', '-d', '--wait', '--no-build'], true, {
    timeout: 120_000,
  });
  let api = await composeId('api');
  let web = await composeId('web');
  const postgres = await composeId('postgres');
  assert(
    api && web && postgres,
    'Full Compose stack did not start three services.',
  );
  checkHealth(await request(api, 'http://127.0.0.1:3001/health/ready'), 200);
  const live = await request(api, 'http://127.0.0.1:3001/health/live');
  assert(live.status === 200, 'API liveness failed in full stack.');
  liveHealthResponseSchema.parse(JSON.parse(live.body));
  const webPage = await request(web, 'http://127.0.0.1:3000/');
  assert(
    webPage.status === 200 && webPage.body.includes('Shipboard'),
    'Web page failed in full stack.',
  );
  await compose(['exec', '-T', 'web', 'node', 'scripts/probe-api.mjs']);
  const unreachable = await compose(
    [
      'exec',
      '-T',
      '-e',
      'API_INTERNAL_URL=http://127.0.0.1:9',
      'web',
      'node',
      'scripts/probe-api.mjs',
    ],
    true,
    { allowFailure: true },
  );
  assert(
    unreachable.code !== 0,
    'Unreachable API URL must fail the web probe.',
  );

  const journalBefore = await run([
    'exec',
    postgres,
    'psql',
    '-U',
    'smoke',
    '-d',
    'smoke',
    '-Atqc',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='drizzle' AND table_name='__drizzle_migrations'",
  ]);
  assert(journalBefore.stdout === '0', 'Full stack migrated on startup.');
  await run([
    'exec',
    postgres,
    'psql',
    '-U',
    'smoke',
    '-d',
    'smoke',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'CREATE TABLE volume_probe (value integer NOT NULL); INSERT INTO volume_probe VALUES (42);',
  ]);
  await compose(['stop', 'postgres']);
  await until(
    async () =>
      (await request(api, 'http://127.0.0.1:3001/health/ready')).status === 503,
    'readiness outage',
    15_000,
  );
  checkHealth(await request(api, 'http://127.0.0.1:3001/health/ready'), 503);
  assert(
    (await request(api, 'http://127.0.0.1:3001/health/live')).status === 200,
    'Liveness failed during outage.',
  );
  assert(
    (await request(web, 'http://127.0.0.1:3000/')).status === 200,
    'Web failed during outage.',
  );
  await compose(['start', 'postgres']);
  await until(
    async () =>
      (await request(api, 'http://127.0.0.1:3001/health/ready')).status === 200,
    'readiness recovery',
  );
  await compose(
    ['up', '-d', '--wait', '--no-build', '--force-recreate', 'postgres'],
    true,
    { timeout: 90_000 },
  );
  const postgresRecreated = await composeId('postgres');
  const marker = await run([
    'exec',
    postgresRecreated,
    'psql',
    '-U',
    'smoke',
    '-d',
    'smoke',
    '-Atqc',
    'SELECT value FROM volume_probe',
  ]);
  assert(
    marker.stdout === '42',
    'PostgreSQL volume did not survive recreation.',
  );

  for (let i = 0; i < 2; i++) {
    await compose(
      [
        'run',
        '--rm',
        '--no-deps',
        'api',
        'node',
        'dist/infrastructure/database/migrate.js',
      ],
      true,
      { timeout: 40_000 },
    );
  }
  const journalAfter = await run([
    'exec',
    postgresRecreated,
    'psql',
    '-U',
    'smoke',
    '-d',
    'smoke',
    '-Atqc',
    'SELECT count(*) FROM drizzle.__drizzle_migrations',
  ]);
  assert(
    journalAfter.stdout === '1',
    'Compose migration was not applied exactly once.',
  );

  await writeFile(fixtureFile, fixtureValues('http://api-alt:3001'), {
    mode: 0o600,
  });
  const oldWebImage = (await run(['inspect', '-f', '{{.Image}}', web])).stdout;
  await compose(
    ['up', '-d', '--wait', '--no-build', '--force-recreate', 'web'],
    true,
    { timeout: 90_000 },
  );
  web = await composeId('web');
  const newWebImage = (await run(['inspect', '-f', '{{.Image}}', web])).stdout;
  assert(
    oldWebImage === newWebImage,
    'Web image changed during runtime URL override.',
  );
  await compose(['exec', '-T', 'web', 'node', 'scripts/probe-api.mjs']);

  api = await composeId('api');
  await compose(['stop', 'api']);
  const exit = await run([
    'inspect',
    '-f',
    '{{.State.ExitCode}} {{.State.OOMKilled}}',
    api,
  ]);
  assert(exit.stdout === '0 false', 'Compose API failed to stop cleanly.');
  const logs = await run(['logs', api]);
  assert(
    logs.stdout.includes('api.shutdown_completed'),
    'Compose API shutdown event missing.',
  );
  assert(
    !logs.stdout.includes(password) && !logs.stderr.includes(password),
    'Credentials leaked into Compose API logs.',
  );
  console.log('Full Compose smoke passed.');
}

try {
  if (mode === '--api') await verifyApi();
  else if (mode === '--web') await verifyWeb();
  else await verifyFull();
} finally {
  await run(['rm', '-f', apiName, dbName, webName], { allowFailure: true });
  await run(['network', 'rm', network], { allowFailure: true });
  if (fixtureFile) {
    await compose(['down', '-v', '--remove-orphans'], true, {
      allowFailure: true,
      timeout: 60_000,
    });
    await unlink(fixtureFile);
    await rmdir(fixtureDirectory);
  }
}
