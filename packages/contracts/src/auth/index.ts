import { z } from 'zod';

export const signUpRequestSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const signInRequestSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

export const currentUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
