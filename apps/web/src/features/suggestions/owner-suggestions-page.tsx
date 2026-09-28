'use client';

import { useLocale } from '../../lib/i18n/provider';

import {
  suggestionStatusSchema,
  suggestionSortSchema,
  type SuggestionResponse,
  type SuggestionSort,
  type SuggestionStatus,
} from '@shipboard/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useState } from 'react';

import { useApiUrl } from '../../app/providers';
import { BoardWorkspace } from '../../components/layout/board-workspace';
import { ApiError } from '../../lib/api/client';
import { getBoard } from '../boards/api';
import { getSuggestion, listSuggestions, updateSuggestionStatus } from './api';
import { StatusBadge } from './suggestion-card';

function ReviewRow({
  value,
  boardId,
  slug,
}: {
  value: SuggestionResponse;
  boardId: string;
  slug: string;
}) {
  const { t, statusLabel } = useLocale();
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const [loaded, setLoaded] = useState(value);
  const [choice, setChoice] = useState<SuggestionStatus>(value.status);
  const change = useMutation({
    mutationFn: () =>
      updateSuggestionStatus(
        apiUrl,
        boardId,
        loaded.id,
        choice,
        loaded.version,
      ),
    onSuccess: async (saved) => {
      setLoaded(saved);
      setChoice(saved.status);
      await client.invalidateQueries({
        queryKey: ['owner-suggestions', boardId],
      });
      await client.invalidateQueries({ queryKey: ['suggestions', slug] });
      await client.invalidateQueries({ queryKey: ['suggestion', value.id] });
    },
  });
  const reload = useMutation({
    mutationFn: () => getSuggestion(apiUrl, slug, value.id),
    onSuccess: (fresh) => {
      setLoaded(fresh);
      change.reset();
    },
  });
  return (
    <article className="review-row">
      <div>
        <div className="suggestion-meta">
          <StatusBadge status={loaded.status} />
          <span>
            {value.voteCount} {value.voteCount === 1 ? t("vote") : t("votes")}
          </span>
        </div>
        <h3>
          <Link href={`/${slug}/suggestions/${value.id}`}>{value.title}</Link>
        </h3>
        <p>{value.description}</p>
      </div>
      <div className="review-action">
        <label htmlFor={`status-${value.id}`}>{t("Move to")}</label>
        <select
          id={`status-${value.id}`}
          value={choice}
          onChange={(event) =>
            setChoice(event.target.value as SuggestionStatus)
          }
        >
          {suggestionStatusSchema.options.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <button
          className="button primary"
          type="button"
          disabled={
            change.isPending || reload.isPending || choice === loaded.status
          }
          onClick={() => change.mutate()}
        >
          {change.isPending ? t("Saving…") : t("Update status")}
        </button>
        {change.isError && (
          <p role="alert" className="field-error">
            {change.error instanceof ApiError && change.error.status === 412
              ? t("This idea changed in another tab. Reload the list before saving.")
              : t("Could not update this idea.")}{' '}
            <button
              type="button"
              disabled={reload.isPending}
              onClick={() => reload.mutate()}
            >{t("Reload")}{' '}</button>
          </p>
        )}
        {reload.isError && (
          <p role="alert">{t("Could not reload this idea. Try again.")}</p>
        )}
      </div>
    </article>
  );
}

export default function OwnerSuggestionsPage() {
  const { t, statusLabel, errorMessage } = useLocale();
  const { id } = useParams<{ id: string }>();
  const apiUrl = useApiUrl();
  const [status, setStatus] = useState<SuggestionStatus | undefined>();
  const [sort, setSort] = useState<SuggestionSort>('newest');
  const board = useQuery({
    queryKey: ['board', id],
    queryFn: () => getBoard(apiUrl, id),
  });
  const ideas = useInfiniteQuery({
    queryKey: ['owner-suggestions', id, status, sort],
    queryFn: ({ pageParam }) =>
      listSuggestions(apiUrl, { id }, { status, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    enabled: Boolean(board.data),
  });
  if (board.isError)
    return (
      <main className="page narrow">
        <h1>{t("Board unavailable")}</h1>
        <p role="alert">
          {board.error instanceof ApiError
            ? errorMessage(board.error)
            : t("Could not load board.")}
        </p>
        <Link href="/boards">{t("My boards")}</Link>
      </main>
    );
  if (board.isPending)
    return (
      <main className="page">
        <p>{t("Loading board…")}</p>
      </main>
    );
  const rows = ideas.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <main className="page">
      <BoardWorkspace id={id} slug={board.data.board.slug} active="ideas">
        <Link className="breadcrumb" href={`/boards/${id}`}>{t("← Board settings")}{' '}</Link>
        <div className="page-heading">
          <div>
            <p className="eyebrow">{t("Feedback desk /")}{' '}{board.data.board.slug}</p>
            <h1>{t("Review ideas")}</h1>
            <p>{t("Move the best feedback forward. Every change appears on the public board.")}{' '}</p>
          </div>
          <Link className="button" href={`/${board.data.board.slug}`}>{t("View public board ↗")}{' '}</Link>
        </div>
        <div className="filter-bar">
          <label htmlFor="owner-sort">{t("Sort by")}</label>
          <select
            id="owner-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SuggestionSort)}
          >
            {suggestionSortSchema.options.map((value) => (
              <option key={value} value={value}>
                {value === 'newest' ? t("Newest first") : t("Most voted")}
              </option>
            ))}
          </select>
          <label htmlFor="owner-status">{t("Show")}</label>
          <select
            id="owner-status"
            value={status ?? ''}
            onChange={(event) =>
              setStatus((event.target.value as SuggestionStatus) || undefined)
            }
          >
            <option value="">{t("All statuses")}</option>
            {suggestionStatusSchema.options.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </select>
        </div>
        {ideas.isPending && <p>{t("Loading ideas…")}</p>}
        {ideas.isError && (
          <p role="alert" className="notice error">{t("Could not load ideas.")}{' '}
            <button type="button" onClick={() => ideas.refetch()}>{t("Try again")}{' '}</button>
          </p>
        )}
        {ideas.isSuccess && rows.length === 0 && (
          <div className="empty-state">
            <h2>{t("No ideas in this view")}</h2>
            <p>{t("Share your public board to start gathering feedback.")}</p>
          </div>
        )}
        <div className="review-list">
          {rows.map((item) => (
            <ReviewRow
              key={item.id}
              value={item}
              boardId={id}
              slug={board.data.board.slug}
            />
          ))}
        </div>
        {ideas.hasNextPage && (
          <button
            className="button"
            type="button"
            disabled={ideas.isFetchingNextPage}
            onClick={() => ideas.fetchNextPage()}
          >
            {ideas.isFetchingNextPage ? t("Loading…") : t("Load more")}
          </button>
        )}
      </BoardWorkspace>
    </main>
  );
}
