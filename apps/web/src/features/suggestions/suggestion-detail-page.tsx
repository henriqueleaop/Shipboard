'use client';

import { useLocale } from '../../lib/i18n/provider';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { ApiError } from '../../lib/api/client';
import { getSuggestion, publicBoard } from './api';
import { VoteButton } from '../votes/vote-button';
import { StatusBadge } from './suggestion-card';

export default function SuggestionDetailPage() {
  const { t, date } = useLocale();
  const { slug, suggestionId } = useParams<{
    slug: string;
    suggestionId: string;
  }>();
  const apiUrl = useApiUrl();
  const board = useQuery({
    queryKey: ['public-board', slug],
    queryFn: () => publicBoard(apiUrl, slug),
  });
  const idea = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => getSuggestion(apiUrl, slug, suggestionId),
    enabled: Boolean(board.data),
  });
  if (board.isError || idea.isError) {
    const error = board.error ?? idea.error;
    return (
      <main className="page narrow">
        <p className="eyebrow">{t("Idea unavailable")}</p>
        <h1>
          {error instanceof ApiError && error.status === 404
            ? t("This idea could not be found.")
            : t("We could not load this idea.")}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            className="button"
            type="button"
            onClick={() => {
              void board.refetch();
              void idea.refetch();
            }}
          >{t("Try again")}{' '}</button>
          <Link href={`/${slug}`}>{t("Back to board")}</Link>
        </div>
      </main>
    );
  }
  if (board.isPending || idea.isPending)
    return (
      <main className="page">
        <p>{t("Loading idea…")}</p>
      </main>
    );
  const value = idea.data;
  return (
    <main className="page narrow">
      <Link className="breadcrumb" href={`/${slug}`}>
        ← {board.data.name}
      </Link>
      <article className="idea-detail">
        <p className="eyebrow">{t("Community idea ·")}{' '}
          {date(value.createdAt)}
        </p>
        <StatusBadge status={value.status} />
        <h1>{value.title}</h1>
        <p className="idea-description">{value.description}</p>
        <div className="idea-detail-footer">
          <div>
            <strong>{value.voteCount}</strong>{' '}
            {value.voteCount === 1 ? t("vote") : t("votes")}
          </div>
          <VoteButton
            suggestionId={value.id}
            returnTo={`/${slug}/suggestions/${value.id}`}
          />
        </div>
      </article>
    </main>
  );
}
