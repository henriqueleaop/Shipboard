import { describe, expect, it } from 'vitest';

import { readConfig } from '../../src/app/config.js';

describe('readConfig', () => {
  const databaseUrl = 'postgresql://example:secret@127.0.0.1:5432/shipboard';

  it('uses safe local defaults', () => {
    expect(readConfig({ DATABASE_URL: databaseUrl })).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 3001,
      NODE_ENV: 'development',
    });
  });
  it('accepts a valid production configuration', () => {
    expect(
      readConfig({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '8080',
        WEB_ORIGIN: 'https://shipboard.example',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://telemetry.example',
        DATABASE_URL: databaseUrl,
      }),
    ).toMatchObject({ NODE_ENV: 'production', HOST: '0.0.0.0', PORT: 8080 });
  });
  it('rejects invalid external input without echoing values', () => {
    expect(() =>
      readConfig({ PORT: 'not-a-port', WEB_ORIGIN: 'secret-value' }),
    ).toThrow('Environment configuration is invalid.');
    expect(() => readConfig({})).toThrow(
      'Environment configuration is invalid.',
    );
    expect(() => readConfig({ DATABASE_URL: 'https://example.com' })).toThrow(
      'Environment configuration is invalid.',
    );
  });
});
