'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

const ApiUrlContext = createContext('http://localhost:3001');

export function Providers({
  apiUrl,
  children,
}: {
  apiUrl: string;
  children: ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      }),
  );
  return (
    <ApiUrlContext.Provider value={apiUrl}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ApiUrlContext.Provider>
  );
}

export function useApiUrl() {
  return useContext(ApiUrlContext);
}
