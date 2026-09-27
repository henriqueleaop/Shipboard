import {
  boardResponseSchema,
  currentUserSchema,
  ownedBoardsResponseSchema,
  problemSchema,
  type CreateBoardRequest,
  type SignInRequest,
  type SignUpRequest,
} from '@shipboard/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function requestApi(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    let detail = 'The request could not be completed.';
    try {
      const problem = problemSchema.parse(await response.json());
      code = problem.code;
      detail = problem.detail;
    } catch {
      // The API's safe fallback is enough when the response is not a Problem.
    }
    throw new ApiError(response.status, code, detail);
  }
  return response;
}

export async function currentUser(baseUrl: string) {
  try {
    const response = await requestApi(baseUrl, '/api/v1/me');
    return currentUserSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signUp(baseUrl: string, body: SignUpRequest) {
  const response = await requestApi(baseUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return currentUserSchema.parse(await response.json());
}

export async function signIn(baseUrl: string, body: SignInRequest) {
  const response = await requestApi(baseUrl, '/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return currentUserSchema.parse(await response.json());
}

export async function signOut(baseUrl: string) {
  await requestApi(baseUrl, '/api/auth/sign-out', {
    method: 'POST',
    body: '{}',
  });
}

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
