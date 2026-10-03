import { publicProfileSchema } from '@shipboard/contracts';

import { requestApi } from '../../lib/api/client';

export async function publicProfile(
  baseUrl: string,
  username: string,
  cursor?: string,
) {
  const url = new URL(
    `/api/v1/public/profiles/${encodeURIComponent(username)}`,
    baseUrl,
  );
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await requestApi(baseUrl, url.pathname + url.search);
  return publicProfileSchema.parse(await response.json());
}
