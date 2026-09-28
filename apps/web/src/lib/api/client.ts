import { problemSchema } from '@shipboard/contracts';

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
