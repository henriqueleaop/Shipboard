'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { PreferencesProvider } from '../lib/i18n/provider';
import type { Locale, Theme } from '../lib/i18n/messages';

const ApiUrlContext = createContext('http://localhost:3001');

export function Providers({
  apiUrl,
  children,
  initialLocale,
  initialTheme,
}: {
  apiUrl: string;
  children: ReactNode;
  initialLocale?: Locale;
  initialTheme?: Theme;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      }),
  );
  return (
    <ApiUrlContext.Provider value={apiUrl}>
      <PreferencesProvider initialLocale={initialLocale} initialTheme={initialTheme}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </PreferencesProvider>
    </ApiUrlContext.Provider>
  );
}

export function useApiUrl() {
  return useContext(ApiUrlContext);
}
