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
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { ApiError, signIn, signUp } from '../api/client';

export function AuthForm({ mode }: { mode: 'register' | 'login' }) {
  const apiUrl = useApiUrl();
  const router = useRouter();
  const client = useQueryClient();
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
      <p className="eyebrow">Your workspace</p>
      <h1>{mode === 'register' ? 'Create account' : 'Sign in'}</h1>
      <p>
        {mode === 'register'
          ? 'Start a board for your product.'
          : 'Return to your boards.'}
      </p>
      <form onSubmit={form.handleSubmit((values) => action.mutate(values))}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p role="alert" className="field-error">
            {form.formState.errors.email.message}
          </p>
        )}
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={
            mode === 'register' ? 'new-password' : 'current-password'
          }
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p role="alert" className="field-error">
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
