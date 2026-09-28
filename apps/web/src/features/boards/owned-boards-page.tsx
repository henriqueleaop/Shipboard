'use client';

import { useLocale } from '../../lib/i18n/provider';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { ApiError } from '../../lib/api/client';
import { currentUser } from '../auth/api';
import { listBoards } from './api';

export default function BoardsPage() {
  const { t, errorMessage } = useLocale();
  const apiUrl = useApiUrl();
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });
  const boards = useInfiniteQuery({
    queryKey: ['boards'],
    queryFn: ({ pageParam }) => listBoards(apiUrl, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    enabled: Boolean(user.data),
  });

  if (user.isPending)
    return (
      <main className="page">
        <p>{t("Checking your session…")}</p>
      </main>
    );
  if (user.isError)
    return (
      <main className="page">
        <p role="alert">{t("Could not load your account. Try refreshing.")}</p>
      </main>
    );
  if (!user.data)
    return (
      <main className="page">
        <h1>{t("Sign in to manage boards")}</h1>
        <Link href="/login">{t("Sign in")}</Link>
      </main>
    );
  const items = boards.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("Your workspace")}</p>
          <h1>{t("My boards")}</h1>
        </div>
        <Link className="button primary" href="/boards/new">{t("Create board")}{' '}</Link>
      </div>
      {boards.isPending && <p>{t("Loading boards…")}</p>}
      {boards.isError && (
        <p role="alert" className="notice error">
          {boards.error instanceof ApiError
            ? errorMessage(boards.error)
            : t("Could not load boards.")}
        </p>
      )}
      {boards.isSuccess && items.length === 0 && (
        <section className="empty-state">
          <h2>{t("No boards yet")}</h2>
          <p>{t("Create your first board to set up a place for product feedback.")}</p>
          <Link href="/boards/new">{t("Create board")}</Link>
        </section>
      )}
      {items.length > 0 && (
        <ul className="board-grid">
          {items.map((board) => (
            <li key={board.id}>
              <Link className="board-card" href={`/boards/${board.id}`}>
                <strong>{board.name}</strong>
                <span>/{board.slug}</span>
                <p>{board.description || t("No description yet.")}</p>
              </Link>
              <Link href={`/boards/${board.id}/suggestions`}>{t("Review feedback →")}{' '}</Link>
            </li>
          ))}
        </ul>
      )}
      {boards.hasNextPage && (
        <button
          type="button"
          onClick={() => boards.fetchNextPage()}
          disabled={boards.isFetchingNextPage}
        >
          {boards.isFetchingNextPage ? t("Loading…") : t("Load more")}
        </button>
      )}
    </main>
  );
}
