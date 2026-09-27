'use client';

import {
  signInRequestSchema,
  signUpRequestSchema,
  type SignUpRequest,
} from '@shipboard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import React, { useState } from 'react';

import { useApiUrl } from '../../app/providers';
import { Input } from '../../components/ui/input';
import { ApiError, signIn, signUp } from '../api/client';

export function AuthForm({ mode }: { mode: 'register' | 'login' }) {
  const apiUrl = useApiUrl();
  const router = useRouter();
  const client = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<SignUpRequest>({
    resolver: zodResolver(
      mode === 'register' ? signUpRequestSchema : signInRequestSchema,
    ),
    defaultValues: { email: '', password: '' },
  });
  const action = useMutation({
    mutationFn: (input: SignUpRequest) =>
      mode === 'register' ? signUp(apiUrl, input) : signIn(apiUrl, input),
    onSuccess: async (user) => {
      client.clear();
      client.setQueryData(['current-user'], user);
      router.push('/boards');
      router.refresh();
    },
  });

  return (
    <main className="page narrow">
      <p className="eyebrow">Your space for better ideas</p>
      <h1>{mode === 'register' ? 'Start something good.' : 'Welcome back.'}</h1>
      <p>
        {mode === 'register'
          ? 'Open a board where your community can shape what comes next.'
          : 'Your boards and feedback are ready when you are.'}
      </p>
      <div className="form-panel">
        <form onSubmit={form.handleSubmit((values) => action.mutate(values))}>
          <label htmlFor="email">Email</label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={
              form.formState.errors.email ? 'email-error' : undefined
            }
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p id="email-error" role="alert" className="field-error">
              {form.formState.errors.email.message}
            </p>
          )}
          <label htmlFor="password">Password</label>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            aria-invalid={Boolean(form.formState.errors.password)}
            aria-describedby={
              form.formState.errors.password ? 'password-error' : undefined
            }
            {...form.register('password')}
          />
          <button
            type="button"
            className="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
          {form.formState.errors.password && (
            <p id="password-error" role="alert" className="field-error">
              {form.formState.errors.password.message}
            </p>
          )}
          {action.isError && (
            <p role="alert" className="notice error">
              {action.error instanceof ApiError
                ? action.error.message
                : 'Could not connect. Try again.'}
            </p>
          )}
          <button className="primary" type="submit" disabled={action.isPending}>
            {action.isPending
              ? 'Please wait…'
              : mode === 'register'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </div>
      <p className="alternate">
        {mode === 'register' ? (
          <>
            Already registered? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New to Shipboard? <Link href="/register">Create account</Link>
          </>
        )}
      </p>
    </main>
  );
}
