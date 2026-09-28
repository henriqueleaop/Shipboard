import React, { Suspense } from 'react';
import PublicBoardPage from '../../features/suggestions/public-board-page';

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <p>Loading board…</p>
        </main>
      }
    >
      <PublicBoardPage />
    </Suspense>
  );
}
