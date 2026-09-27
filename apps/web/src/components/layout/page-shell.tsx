import React, { type ReactNode } from 'react';

export function PageShell({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return <main className={`page ${narrow ? 'narrow' : ''}`}>{children}</main>;
}
