'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { useApiUrl } from '../../app/providers';
import { currentUser, signOut } from '../api/client';

export function SiteHeader() {
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });

  async function logout() {
    setPending(true);
    try {
      await signOut(apiUrl);
      client.clear();
      router.push('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Shipboard
      </Link>
      <nav aria-label="Main navigation">
        {user.data ? (
          <>
            <Link href="/boards">My boards</Link>
            <button type="button" onClick={logout} disabled={pending}>
              {pending ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Sign in</Link>
            <Link href="/register">Create account</Link>
          </>
        )}
      </nav>
    </header>
  );
}
