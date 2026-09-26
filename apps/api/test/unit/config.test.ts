import { describe, expect, it } from 'vitest';

import { readConfig } from '../../src/app/config.js';

describe('readConfig', () => {
  it('uses safe local defaults', () => {
    expect(readConfig({})).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 3001,
      NODE_ENV: 'development',
    });
  });
  it('rejects invalid external input without echoing values', () => {
    expect(() =>
      readConfig({ PORT: 'not-a-port', WEB_ORIGIN: 'secret-value' }),
    ).toThrow('Environment configuration is invalid.');
  });
});
