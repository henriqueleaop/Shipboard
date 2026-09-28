'use client';

import { useLocale } from '../lib/i18n/provider';

import Link from 'next/link';
import React from 'react';

export default function HomePage() {
  const { t } = useLocale();
  return (
    <main className="page hero">
      <div>
        <p className="eyebrow">{t("A clearer route from idea to shipped")}</p>
        <h1>{t("Make room for better ideas.")}</h1>
        <p className="hero-lede">{t("Give your community one place to suggest, support and follow what matters. Keep every decision visible from first request to release.")}{' '}</p>
        <div className="actions">
          <Link className="button primary" href="/register">{t("Start a feedback board")}{' '}</Link>
          <Link className="button" href="/login">{t("Sign in")}{' '}</Link>
        </div>
      </div>
      <div className="hero-art" aria-label={t("Example feedback board")}>
        <p className="hero-number">{t("01 / Listen, decide, deliver")}</p>
        <h2>{t("Ideas in motion")}</h2>
        <div className="sample-card">
          <span className="status">{t("Under review")}</span>
          <strong>{t("Make onboarding simpler")}</strong>
          <small>{t("From first impression to first success.")}</small>
        </div>
        <div className="sample-card">
          <span className="status">{t("Planned")}</span>
          <strong>{t("Bring the roadmap together")}</strong>
          <small>{t("Give everyone a clearer view of what comes next.")}</small>
        </div>
        <div className="sample-card">
          <span className="status">{t("Shipped")}</span>
          <strong>{t("Find requests faster")}</strong>
          <small>{t("A good idea deserves to be found.")}</small>
        </div>
      </div>
    </main>
  );
}
