import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { cookies, headers } from 'next/headers';

import { Providers } from './providers';
import { SiteHeader } from '../features/auth/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: 'Shipboard',
  description: 'A clearer route from product ideas to shipped features.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await connection();
  const preferences = await cookies();
  const language = preferences.get('shipboard-locale')?.value;
  const locale = language === 'en' || language === 'pt-BR' ? language : (await headers()).get('accept-language')?.startsWith('en') ? 'en' : 'pt-BR';
  const savedTheme = preferences.get('shipboard-theme')?.value;
  const theme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system';
  const apiUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
  const parsed = new URL(apiUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API_PUBLIC_URL must be an HTTP origin.');
  }
  return (
    <html lang={locale} data-theme={theme}>
      <body>
        <Providers apiUrl={parsed.origin} initialLocale={locale} initialTheme={theme}>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
