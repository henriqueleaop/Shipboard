'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { useApiUrl } from '../../app/providers';
import { PreferenceControls, useLocale } from '../../lib/i18n/provider';
import { currentUser, signOut } from './api';

export function SiteHeader() {
  const { t } = useLocale();
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });

  async function logout() {
    setPending(true);
    setLogoutError(false);
    try {
      await signOut(apiUrl);
      client.clear();
      router.push('/login');
      router.refresh();
    } catch {
      setLogoutError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="site-header">
      <div className="header-primary">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          Shipboard
        </Link>
        <nav aria-label={t('Main navigation')}>
          {user.data ? (
            <>
              <Link href="/boards">{t('My boards')}</Link>
              <button type="button" onClick={logout} disabled={pending}>
                {pending ? t('Signing out…') : t('Sign out')}
              </button>
            </>
          ) : (
            <>
              <Link href="/login">{t('Sign in')}</Link>
              <Link href="/register">{t('Create account')}</Link>
            </>
          )}
        </nav>
      </div>
      <PreferenceControls />
      {logoutError && (
        <p role="alert" className="header-error">
          {t('Could not sign out. Try again.')}
        </p>
      )}
    </header>
  );
}
