import {
  publicBoardResponseSchema,
  suggestionListResponseSchema,
  suggestionResponseSchema,
  type CreateSuggestionRequest,
  type SuggestionSort,
  type SuggestionStatus,
} from '@shipboard/contracts';
import { requestApi } from '../../lib/api/client';

export async function publicBoard(
  baseUrl: string,
  username: string,
  slug: string,
) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/public/boards/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
  );
  return publicBoardResponseSchema.parse(await response.json());
}

export async function legacyPublicBoard(baseUrl: string, slug: string) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/public/boards/${encodeURIComponent(slug)}`,
  );
  return publicBoardResponseSchema.parse(await response.json());
}

export async function listSuggestions(
  baseUrl: string,
  board: { username?: string; slug?: string; id?: string },
  options: {
    sort?: SuggestionSort;
    status?: SuggestionStatus;
    cursor?: string;
  },
) {
  const path =
    board.slug && board.username
      ? `/api/v1/public/boards/${encodeURIComponent(board.username)}/${encodeURIComponent(board.slug)}/suggestions`
      : `/api/v1/boards/${board.id}/suggestions`;
  const url = new URL(path, baseUrl);
  if (options.sort) url.searchParams.set('sort', options.sort);
  if (options.status) url.searchParams.set('status', options.status);
  if (options.cursor) url.searchParams.set('cursor', options.cursor);
  const response = await requestApi(baseUrl, url.pathname + url.search);
  return suggestionListResponseSchema.parse(await response.json());
}

export async function getSuggestion(
  baseUrl: string,
  username: string,
  slug: string,
  id: string,
) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/public/boards/${encodeURIComponent(username)}/${encodeURIComponent(slug)}/suggestions/${id}`,
  );
  return suggestionResponseSchema.parse(await response.json());
}

export async function createSuggestionRequest(
  baseUrl: string,
  boardId: string,
  body: CreateSuggestionRequest,
  key: string,
) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/boards/${boardId}/suggestions`,
    {
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: JSON.stringify(body),
    },
  );
  return suggestionResponseSchema.parse(await response.json());
}

export async function updateSuggestionStatus(
  baseUrl: string,
  boardId: string,
  id: string,
  status: SuggestionStatus,
  version: number,
) {
  const response = await requestApi(
    baseUrl,
    `/api/v1/boards/${boardId}/suggestions/${id}/status`,
    {
      method: 'PATCH',
      headers: { 'if-match': `"${version}"` },
      body: JSON.stringify({ status }),
    },
  );
  return suggestionResponseSchema.parse(await response.json());
}
