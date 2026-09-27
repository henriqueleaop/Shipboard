import Link from 'next/link';
import React from 'react';

export default function HomePage() {
  return (
    <main className="page hero">
      <p className="eyebrow">Product feedback, in one place</p>
      <h1>Shipboard</h1>
      <p>Create a board for your product and keep its details up to date.</p>
      <div className="actions">
        <Link className="button primary" href="/register">
          Create an account
        </Link>
        <Link className="button" href="/login">
          Sign in
        </Link>
      </div>
    </main>
  );
}
