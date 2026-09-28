'use client';

import { useLocale } from '../../lib/i18n/provider';

import type { SuggestionResponse } from '@shipboard/contracts';
import Link from 'next/link';
import React from 'react';


export function StatusBadge({
  status,
}: {
  status: SuggestionResponse['status'];
}) {
  const { statusLabel } = useLocale();
  return (
    <span
      className={`status-badge status-${status.toLowerCase().replace('_', '-')}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function SuggestionCard({
  suggestion,
  slug,
  action,
}: {
  suggestion: SuggestionResponse;
  slug: string;
  action?: React.ReactNode;
}) {
  const { t, date } = useLocale();
  return (
    <article className="suggestion-card">
      <div className="suggestion-score">
        <strong>{suggestion.voteCount}</strong>
        <span>{suggestion.voteCount === 1 ? t("vote") : t("votes")}</span>
      </div>
      <div className="suggestion-card-body">
        <div className="suggestion-meta">
          <StatusBadge status={suggestion.status} />
          <span>
            {date(suggestion.createdAt)}
          </span>
        </div>
        <h3>
          <Link href={`/${slug}/suggestions/${suggestion.id}`}>
            {suggestion.title}
          </Link>
        </h3>
        <p>{suggestion.description}</p>
      </div>
      {action && <div className="suggestion-action">{action}</div>}
    </article>
  );
}
