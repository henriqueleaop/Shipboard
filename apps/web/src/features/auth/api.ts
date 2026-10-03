import {
  currentUserSchema,
  authProvidersResponseSchema,
  githubStartResponseSchema,
  localReturnPathSchema,
  type SignInRequest,
  type SignUpRequest,
  updateProfileRequestSchema,
} from '@shipboard/contracts';
import { ApiError, requestApi } from '../../lib/api/client';

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

export async function authProviders(baseUrl: string) {
  const response = await requestApi(baseUrl, '/api/v1/auth/providers');
  return authProvidersResponseSchema.parse(await response.json());
}

export async function startGithub(baseUrl: string, returnTo: string) {
  const safeReturnTo = localReturnPathSchema.safeParse(returnTo);
  const response = await requestApi(baseUrl, '/api/auth/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({
      returnTo: safeReturnTo.success ? safeReturnTo.data : '/boards',
    }),
  });
  return githubStartResponseSchema.parse(await response.json());
}

export async function updateProfile(baseUrl: string, username: string) {
  const body = updateProfileRequestSchema.parse({ username });
  const response = await requestApi(baseUrl, '/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return currentUserSchema.parse(await response.json());
}

export async function startGithubLink(baseUrl: string, returnTo: string) {
  const safeReturnTo = localReturnPathSchema.safeParse(returnTo);
  const response = await requestApi(baseUrl, '/api/auth/link-social/github', {
    method: 'POST',
    body: JSON.stringify({
      returnTo: safeReturnTo.success ? safeReturnTo.data : '/settings',
    }),
  });
  return githubStartResponseSchema.parse(await response.json());
}

export async function syncGithubProfile(baseUrl: string) {
  const response = await requestApi(baseUrl, '/api/v1/me/github/profile', {
    method: 'POST',
    body: '{}',
  });
  return currentUserSchema.parse(await response.json());
}
