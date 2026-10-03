import { publicProfileSchema } from '@shipboard/contracts';

import { requestApi } from '../../lib/api/client';

export async function publicProfile(baseUrl: string, username: string) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/public/profiles/${encodeURIComponent(username)}`,
  );
  return publicProfileSchema.parse(await response.json());
}
