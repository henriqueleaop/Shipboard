import {
  voteStateResponseSchema,
  myVotesResponseSchema,
} from '@shipboard/contracts';
import { requestApi } from '../../lib/api/client';

export async function getVote(baseUrl: string, suggestionId: string) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/suggestions/${suggestionId}/vote`,
  );
  return voteStateResponseSchema.parse(await response.json());
}

export async function setVote(
  baseUrl: string,
  suggestionId: string,
  voted: boolean,
) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/suggestions/${suggestionId}/vote`,
    { method: voted ? 'PUT' : 'DELETE' },
  );
  if (!voted) return getVote(baseUrl, suggestionId);
  return voteStateResponseSchema.parse(await response.json());
}

export async function getMyVotes(
  baseUrl: string,
  boardId: string,
  ids: string[],
) {
  const url = new URL(`/api/v1/boards/${boardId}/my-votes`, baseUrl);
  url.searchParams.set('suggestionIds', ids.join(','));
  const response = await requestApi(baseUrl, url.pathname + url.search);
  return myVotesResponseSchema.parse(await response.json());
}
