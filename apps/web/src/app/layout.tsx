import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';

import { Providers } from './providers';
import { SiteHeader } from '../features/auth/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: 'Shipboard',
  description: 'Product feedback boards, launching soon.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await connection();
  const apiUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
  const parsed = new URL(apiUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API_PUBLIC_URL must be an HTTP origin.');
  }
  return (
    <html lang="en">
      <body>
        <Providers apiUrl={parsed.origin}>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
