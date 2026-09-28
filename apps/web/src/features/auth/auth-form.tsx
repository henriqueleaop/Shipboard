'use client';

import { useLocale } from '../../lib/i18n/provider';

import {
  authFieldLimits,
  signInRequestSchema,
  signUpRequestSchema,
  localReturnPathSchema,
  type SignUpRequest,
} from '@shipboard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import React, { useEffect, useState } from 'react';
import { z } from 'zod';

import { useApiUrl } from '../../app/providers';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { CharacterCounter } from '../../components/ui/character-counter';
import { PasswordInput } from '../../components/ui/password-input';
import { authProviders, signIn, signUp, startGithub } from './api';
import { ApiError } from '../../lib/api/client';

export function AuthForm({ mode }: { mode: 'register' | 'login' }) {
  const { t, errorMessage } = useLocale();
  const apiUrl = useApiUrl();
  const router = useRouter();
  const client = useQueryClient();
  const [githubError, setGithubError] = useState(false);
  const [returnPath, setReturnPath] = useState('/boards');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGithubError(params.get('error') === 'github');
    const parsed = localReturnPathSchema.safeParse(
      params.get('returnTo') ?? '/boards',
    );
    setReturnPath(parsed.success ? parsed.data : '/boards');
  }, []);
  const providers = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => authProviders(apiUrl),
  });
  const github = useMutation({
    mutationFn: async () => {
      const returnTo =
        new URLSearchParams(window.location.search).get('returnTo') ??
        '/boards';
      return startGithub(apiUrl, returnTo);
    },
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const schema = signInRequestSchema
    .extend({ confirmation: z.string() })
    .superRefine((values, context) => {
      if (mode !== 'register') return;
      const result = signUpRequestSchema.safeParse({
        email: values.email,
        password: values.password,
      });
      if (!result.success)
        context.addIssue({
          code: 'custom',
          path: ['password'],
          message:
            'Use 12–128 characters, letters and a number, symbol or space. Avoid common or repeated sequences.',
        });
      if (!values.confirmation || values.confirmation !== values.password)
        context.addIssue({
          code: 'custom',
          path: ['confirmation'],
          message: 'Passwords must match.',
        });
    });
  const form = useForm<SignUpRequest & { confirmation: string }>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmation: '' },
  });
  const email = form.watch('email');
  const password = form.watch('password');
  const confirmation = form.watch('confirmation');
  const action = useMutation({
    mutationFn: (input: SignUpRequest) =>
      mode === 'register' ? signUp(apiUrl, input) : signIn(apiUrl, input),
    onSuccess: async (user) => {
      client.clear();
      client.setQueryData(['current-user'], user);
      const returnTo =
        new URLSearchParams(window.location.search).get('returnTo') ??
        '/boards';
      const safePath = localReturnPathSchema.safeParse(returnTo);
      router.push(safePath.success ? safePath.data : '/boards');
      router.refresh();
    },
  });

  return (
    <main className="page narrow auth-page">
      <p className="eyebrow">{t('Your space for better ideas')}</p>
      <h1>
        {mode === 'register' ? t('Start something good.') : t('Welcome back.')}
      </h1>
      <p>
        {mode === 'register'
          ? t('Open a board where your community can shape what comes next.')
          : t('Your boards and feedback are ready when you are.')}
      </p>
      {githubError && (
        <p role="alert" className="notice error">
          {t(
            'GitHub sign-in was cancelled or could not be completed. Try again or use email.',
          )}{' '}
        </p>
      )}
      <div className="form-panel">
        <form
          noValidate
          onSubmit={form.handleSubmit(({ email, password }) =>
            action.mutate({ email, password }),
          )}
        >
          <label htmlFor="email">{t('Email')}</label>
          <Input
            id="email"
            type="email"
            maxLength={authFieldLimits.email}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={
              form.formState.errors.email
                ? 'email-counter email-error'
                : 'email-counter'
            }
            {...form.register('email')}
          />
          <CharacterCounter
            id="email-counter"
            value={email}
            limit={authFieldLimits.email}
          />
          {form.formState.errors.email && (
            <p id="email-error" role="alert" className="field-error">
              {t('Enter a valid email address.')}
            </p>
          )}
          <label htmlFor="password">{t('Password')}</label>
          <PasswordInput
            id="password"
            maxLength={authFieldLimits.password}
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            aria-invalid={Boolean(form.formState.errors.password)}
            aria-describedby={
              form.formState.errors.password
                ? 'password-counter password-error password-hint'
                : mode === 'register'
                  ? 'password-counter password-hint'
                  : 'password-counter'
            }
            {...form.register('password')}
          />
          <CharacterCounter
            id="password-counter"
            value={password}
            limit={authFieldLimits.password}
          />
          {mode === 'register' && (
            <p id="password-hint" className="hint">
              {t(
                'Use 12–128 characters, letters and a number, symbol or space. Avoid common or repeated sequences.',
              )}
            </p>
          )}
          {form.formState.errors.password && (
            <p id="password-error" role="alert" className="field-error">
              {mode === 'register'
                ? t(
                    'Use 12–128 characters, letters and a number, symbol or space. Avoid common or repeated sequences.',
                  )
                : t('Enter your password.')}
            </p>
          )}
          {mode === 'register' && (
            <>
              <label htmlFor="confirmation">{t('Confirm password')}</label>
              <PasswordInput
                id="confirmation"
                confirmation
                maxLength={authFieldLimits.password}
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmation)}
                aria-describedby={
                  form.formState.errors.confirmation
                    ? 'confirmation-counter confirmation-error'
                    : 'confirmation-counter'
                }
                {...form.register('confirmation')}
              />
              <CharacterCounter
                id="confirmation-counter"
                value={confirmation}
                limit={authFieldLimits.password}
              />
              {form.formState.errors.confirmation && (
                <p id="confirmation-error" role="alert" className="field-error">
                  {t('Passwords must match.')}
                </p>
              )}
            </>
          )}
          {action.isError && (
            <p role="alert" className="notice error">
              {action.error instanceof ApiError
                ? errorMessage(action.error)
                : t('Could not connect. Try again.')}
            </p>
          )}
          <Button tone="primary" type="submit" disabled={action.isPending}>
            {action.isPending
              ? t('Please wait…')
              : mode === 'register'
                ? t('Create account')
                : t('Sign in')}
          </Button>
        </form>
        {providers.data?.github && (
          <div className="auth-provider">
            <Button
              className="w-full"
              type="button"
              onClick={() => github.mutate()}
              disabled={github.isPending}
            >
              {github.isPending ? t('Connecting…') : t('Continue with GitHub')}
            </Button>
            {github.isError && (
              <p role="alert" className="field-error">
                {t('Could not start GitHub sign-in. Try again.')}{' '}
              </p>
            )}
          </div>
        )}
      </div>
      <p className="alternate">
        {mode === 'register' ? (
          <>
            {t('Already registered?')}{' '}
            <Link href={`/login?returnTo=${encodeURIComponent(returnPath)}`}>
              {t('Sign in')}{' '}
            </Link>
          </>
        ) : (
          <>
            {t('New to Shipboard?')}{' '}
            <Link href={`/register?returnTo=${encodeURIComponent(returnPath)}`}>
              {t('Create account')}{' '}
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
