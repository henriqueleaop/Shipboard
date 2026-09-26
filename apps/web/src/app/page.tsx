import type { LiveHealthResponse } from '@shipboard/contracts';
import React from 'react';

const livenessContractIsAvailable: LiveHealthResponse['status'] = 'ok';

export default function HomePage() {
  return (
    <main>
      <h1>Shipboard</h1>
      <p>Product feedback boards are being prepared.</p>
      <span className="sr-only">
        Shared API contract status: {livenessContractIsAvailable}
      </span>
    </main>
  );
}
