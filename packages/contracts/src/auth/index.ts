import { z } from 'zod';

// Registration only: existing credentials remain valid for sign-in.
export const registrationPasswordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine(
    (value) => {
      const compact = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      return (
        /\p{L}/u.test(value) &&
        /[^\p{L}]/u.test(value) &&
        !/^(.{1,6})\1+$/.test(compact) &&
        ![
          'password123456',
          '123456789012',
          'qwerty123456',
          'abcdefghijkl',
        ].includes(compact)
      );
    },
    {
      message:
        'Choose a password with 12–128 characters, letters and a number, symbol or space. Avoid common or repeated sequences.',
    },
  );

export const signUpRequestSchema = z.strictObject({
  email: z.email(),
  password: registrationPasswordSchema,
});

export const signInRequestSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

export const currentUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
});

export const localReturnPathSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((path) => {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path))
      return false;
    try {
      const url = new URL(path, 'https://shipboard.example');
      return url.origin === 'https://shipboard.example';
    } catch {
      return false;
    }
  });

export const githubStartRequestSchema = z.strictObject({
  returnTo: localReturnPathSchema.default('/boards'),
});

export const githubStartResponseSchema = z.strictObject({
  url: z.url(),
});

export const authProvidersResponseSchema = z.strictObject({
  github: z.boolean(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
