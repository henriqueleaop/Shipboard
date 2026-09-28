import { z } from 'zod';

export const usernameFieldLimits = { username: 39 } as const;

export const reservedUsernames = [
  'api',
  'boards',
  'login',
  'register',
  'settings',
  'suggestions',
] as const;

export function isReservedUsername(value: string): boolean {
  return (reservedUsernames as readonly string[]).includes(value);
}

export const usernameSchema = z
  .string()
  .min(3)
  .max(usernameFieldLimits.username)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !isReservedUsername(value), {
    message: 'This username is reserved for Shipboard.',
  });

export const githubRepositoryUrlSchema = z.string().max(256).url().refine(
  (value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    );
  },
  { message: 'Enter the canonical URL of a public GitHub repository.' },
);

export const boardVisibilitySchema = z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']);

export type BoardVisibility = z.infer<typeof boardVisibilitySchema>;
