import {
  boardResponseSchema,
  ownedBoardsResponseSchema,
  type CreateBoardRequest,
} from '@shipboard/contracts';
import { requestApi } from '../../lib/api/client';

export async function listBoards(baseUrl: string, cursor?: string) {
  const url = new URL('/api/v1/boards', baseUrl);
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await requestApi(baseUrl, url.pathname + url.search);
  return ownedBoardsResponseSchema.parse(await response.json());
}

export async function createBoardRequest(
  baseUrl: string,
  body: CreateBoardRequest,
  key: string,
) {
  const response = await requestApi(baseUrl, '/api/v1/boards', {
    method: 'POST',
    headers: { 'idempotency-key': key },
    body: JSON.stringify(body),
  });
  return boardResponseSchema.parse(await response.json());
}

export async function getBoard(baseUrl: string, id: string) {
  const response = await requestApi(baseUrl, `/api/v1/boards/${id}`);
  return {
    board: boardResponseSchema.parse(await response.json()),
    etag: response.headers.get('etag'),
  };
}

export async function updateBoard(
  baseUrl: string,
  id: string,
  body: CreateBoardRequest,
  etag: string,
) {
  const response = await requestApi(baseUrl, `/api/v1/boards/${id}`, {
    method: 'PATCH',
    headers: { 'if-match': etag },
    body: JSON.stringify(body),
  });
  return {
    board: boardResponseSchema.parse(await response.json()),
    etag: response.headers.get('etag'),
  };
}
