import Link from 'next/link';
import React from 'react';

export default function HomePage() {
  return (
    <main className="page hero">
      <div>
        <p className="eyebrow">A clearer route from idea to shipped</p>
        <h1>Make room for better ideas.</h1>
        <p className="hero-lede">
          Give your community one place to suggest, support and follow what
          matters. Keep every decision visible from first request to release.
        </p>
        <div className="actions">
          <Link className="button primary" href="/register">
            Start a feedback board
          </Link>
          <Link className="button" href="/login">
            Sign in
          </Link>
        </div>
      </div>
      <div className="hero-art" aria-label="Example feedback board">
        <p className="hero-number">01 / Listen, decide, deliver</p>
        <h2>Ideas in motion</h2>
        <div className="sample-card">
          <span className="status">Under review</span>
          <strong>Make onboarding simpler</strong>
          <small>From first impression to first success.</small>
        </div>
        <div className="sample-card">
          <span className="status">Planned</span>
          <strong>Bring the roadmap together</strong>
          <small>Give everyone a clearer view of what comes next.</small>
        </div>
        <div className="sample-card">
          <span className="status">Shipped</span>
          <strong>Find requests faster</strong>
          <small>A good idea deserves to be found.</small>
        </div>
      </div>
    </main>
  );
}
