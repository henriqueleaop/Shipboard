'use client';

import { usernameSchema } from '@shipboard/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { useApiUrl } from '../../../app/providers';
import { ApiError } from '../../../lib/api/client';
import {
  authProviders,
  currentUser,
  startGithubLink,
  syncGithubProfile,
  updateProfile,
} from '../../../features/auth/api';

export default function SettingsPage() {
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const search = useSearchParams();
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });
  const providers = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => authProviders(apiUrl),
  });
  const [username, setUsername] = useState('');
  const save = useMutation({
    mutationFn: () => updateProfile(apiUrl, username),
    onSuccess: async (value) => {
      client.setQueryData(['current-user'], value);
      await client.invalidateQueries({
        queryKey: ['public-profile', value.username],
      });
    },
  });
  const link = useMutation({
    mutationFn: () => startGithubLink(apiUrl, '/settings?linked=github'),
    onSuccess: (value) => {
      window.location.assign(value.url);
    },
  });
  const sync = useMutation({
    mutationFn: () => syncGithubProfile(apiUrl),
    onSuccess: (value) => client.setQueryData(['current-user'], value),
  });
  useEffect(() => {
    if (
      search.get('linked') === 'github' &&
      !user.data?.githubProfileUrl &&
      !sync.isPending
    ) {
      sync.mutate();
    }
  }, [search, sync, user.data?.githubProfileUrl]);
  if (user.isPending)
    return (
      <main className="page">
        <p>Loading settings…</p>
      </main>
    );
  if (!user.data)
    return (
      <main className="page">
        <h1>Sign in to edit your profile</h1>
        <Link href="/login">Sign in</Link>
      </main>
    );
  const value = username || user.data.username;
  const valid = usernameSchema.safeParse(value).success;
  return (
    <main className="page narrow">
      <Link href="/boards">← My boards</Link>
      <p className="eyebrow">Profile settings</p>
      <h1>Your public identity</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={value}
          onChange={(event) => setUsername(event.target.value)}
          autoCapitalize="none"
          autoComplete="username"
        />
        <p className="field-hint">
          3–39 lowercase letters, numbers, and single hyphens.
        </p>
        {save.isError && (
          <p role="alert" className="notice error">
            {save.error instanceof ApiError &&
            save.error.code === 'USERNAME_CONFLICT'
              ? 'That username is unavailable.'
              : 'Could not save your profile.'}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="notice success">
            Profile saved.
          </p>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={!valid || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save username'}
        </button>
      </form>
      <section className="mt-8">
        <h2>GitHub</h2>
        {user.data.githubProfileUrl ? (
          <a href={user.data.githubProfileUrl} target="_blank" rel="noreferrer">
            Open linked GitHub profile ↗
          </a>
        ) : providers.data?.github ? (
          <button
            className="button"
            type="button"
            disabled={link.isPending}
            onClick={() => link.mutate()}
          >
            {link.isPending ? 'Connecting…' : 'Link GitHub'}
          </button>
        ) : (
          <p>GitHub sign-in is not configured for this deployment.</p>
        )}
        {link.isError && (
          <p role="alert" className="notice error">
            Could not start GitHub linking.
          </p>
        )}
        {sync.isError && (
          <p role="alert" className="notice error">
            GitHub was linked, but its public profile could not be loaded yet.
          </p>
        )}
      </section>
    </main>
  );
}
