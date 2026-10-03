'use client';

import { useLocale } from '../../lib/i18n/provider';

import {
  suggestionSortSchema,
  suggestionStatusSchema,
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
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { ApiError } from '../../lib/api/client';
import { currentUser } from '../auth/api';
import { getMyVotes, setVote } from '../votes/api';
import { listSuggestions, publicBoard } from './api';
import { SuggestionForm } from './suggestion-form';
import { SuggestionCard } from './suggestion-card';

export default function PublicBoardPage() {
  const { t, statusLabel } = useLocale();
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const sort: SuggestionSort =
    suggestionSortSchema.safeParse(search.get('sort')).data ?? 'newest';
  const status: SuggestionStatus | undefined = suggestionStatusSchema.safeParse(
    search.get('status'),
  ).data;
  const board = useQuery({
    queryKey: ['public-board', username, slug],
    queryFn: () => publicBoard(apiUrl, username, slug),
  });
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });
  const ideas = useInfiniteQuery({
    queryKey: ['suggestions', username, slug, sort, status],
    queryFn: ({ pageParam }) =>
      listSuggestions(
        apiUrl,
        { username, slug },
        { sort, status, cursor: pageParam },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    enabled: Boolean(board.data),
  });
  const items = ideas.data?.pages.flatMap((page) => page.items) ?? [];
  const ids = items.map((item) => item.id);
  const myVotes = useQuery({
    queryKey: ['my-votes', board.data?.id, user.data?.id, ids.join(',')],
    queryFn: async () => {
      const chunks = Array.from(
        { length: Math.ceil(ids.length / 50) },
        (_, index) => ids.slice(index * 50, index * 50 + 50),
      );
      const pages = await Promise.all(
        chunks.map((chunk) => getMyVotes(apiUrl, board.data!.id, chunk)),
      );
      return new Map(
        pages
          .flatMap((page) => page.items)
          .map((item) => [item.suggestionId, item.voted]),
      );
    },
    enabled: Boolean(user.data && board.data && ids.length),
  });
  const vote = useMutation({
    mutationFn: ({ id, voted }: { id: string; voted: boolean }) =>
      setVote(apiUrl, id, voted),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['my-votes', board.data?.id],
      });
      await client.invalidateQueries({
        queryKey: ['suggestions', username, slug],
      });
    },
  });
  const change = (nextSort: SuggestionSort, nextStatus?: SuggestionStatus) => {
    const params = new URLSearchParams();
    if (nextSort !== 'newest') params.set('sort', nextSort);
    if (nextStatus) params.set('status', nextStatus);
    router.push(`/${username}/${slug}${params.size ? `?${params}` : ''}`);
  };
  if (board.isPending)
    return (
      <main className="page">
        <p>{t('Loading this board…')}</p>
      </main>
    );
  if (board.isError)
    return (
      <main className="page narrow">
        <p className="eyebrow">{t('Board unavailable')}</p>
        <h1>
          {board.error instanceof ApiError && board.error.status === 404
            ? t('This board could not be found.')
            : t('We could not load this board.')}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            className="button"
            type="button"
            onClick={() => board.refetch()}
          >
            {t('Try again')}{' '}
          </button>
          <Link href="/">{t('Return home')}</Link>
        </div>
      </main>
    );
  return (
    <main className="page public-board">
      <header className="public-board-hero">
        <div>
          <Link href="/" className="breadcrumb">
            ← Shipboard
          </Link>
          <p className="eyebrow">
            {t('Public feedback board · /')}
            {board.data.slug}
          </p>
          <h1>{board.data.name}</h1>
          <p className="hero-lede">
            {board.data.description || t('A place to shape what comes next.')}
          </p>
        </div>
        <div className="public-board-stat">
          <strong>{items.length}</strong>
          <span>{t('ideas in view')}</span>
          <small>{t('Real voices. Clear progress.')}</small>
        </div>
      </header>
      <div className="feedback-layout">
        <section aria-labelledby="ideas-heading">
          <div className="ideas-heading">
            <div>
              <p className="eyebrow">{t('The conversation')}</p>
              <h2 id="ideas-heading">{t('Ideas & progress')}</h2>
            </div>
            <span>
              {items.length}
              {t('shown')}
            </span>
          </div>
          <div className="filter-bar">
            <label htmlFor="sort-ideas">{t('Sort by')}</label>
            <select
              id="sort-ideas"
              value={sort}
              onChange={(event) =>
                change(event.target.value as SuggestionSort, status)
              }
            >
              <option value="newest">{t('Newest first')}</option>
              <option value="most_voted">{t('Most voted')}</option>
            </select>
            <label htmlFor="filter-status">{t('Status')}</label>
            <select
              id="filter-status"
              value={status ?? ''}
              onChange={(event) =>
                change(
                  sort,
                  (event.target.value as SuggestionStatus) || undefined,
                )
              }
            >
              <option value="">{t('All statuses')}</option>
              {suggestionStatusSchema.options.map((value) => (
                <option value={value} key={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </div>
          {ideas.isPending && <p>{t('Loading ideas…')}</p>}
          {ideas.isError && (
            <p role="alert" className="notice error">
              {t('Could not load ideas.')}{' '}
              <button type="button" onClick={() => ideas.refetch()}>
                {t('Try again')}{' '}
              </button>
            </p>
          )}
          {ideas.isSuccess && items.length === 0 && (
            <div className="empty-state">
              <p className="eyebrow">{t('Open deck')}</p>
              <h3>{t('No ideas here yet')}</h3>
              <p>
                {status
                  ? t('Try another status, or share a new idea.')
                  : t(
                      'Be the first to suggest what this product should do next.',
                    )}
              </p>
            </div>
          )}
          <div className="suggestion-list">
            {items.map((item) => (
              <SuggestionCard
                key={item.id}
                suggestion={item}
                username={username}
                slug={slug}
                action={
                  user.data ? (
                    <button
                      className="inline-vote"
                      type="button"
                      aria-label={`${myVotes.data?.get(item.id) ? t('Remove vote from') : t('Vote for')} ${item.title}`}
                      aria-pressed={myVotes.data?.get(item.id) ?? false}
                      disabled={!myVotes.data || vote.isPending}
                      onClick={() =>
                        vote.mutate({
                          id: item.id,
                          voted: !myVotes.data?.get(item.id),
                        })
                      }
                    >
                      {myVotes.data?.get(item.id) ? t('▲ Voted') : t('△ Vote')}
                    </button>
                  ) : (
                    <Link
                      className="inline-vote"
                      href={`/login?returnTo=${encodeURIComponent(`/${username}/${slug}`)}`}
                    >
                      {t('Sign in to vote')}{' '}
                    </Link>
                  )
                }
              />
            ))}
          </div>
          {vote.isError && (
            <p role="alert" className="notice error">
              {t('Could not update your vote. Try again.')}{' '}
            </p>
          )}
          {ideas.hasNextPage && (
            <button
              className="button"
              type="button"
              disabled={ideas.isFetchingNextPage}
              onClick={() => ideas.fetchNextPage()}
            >
              {ideas.isFetchingNextPage ? t('Loading…') : t('Load more ideas')}
            </button>
          )}
        </section>
        <aside>
          <SuggestionForm
            boardId={board.data.id}
            slug={slug}
            signedIn={Boolean(user.data)}
          />
          <div className="board-aside-note">
            <span>01 / 03</span>
            <p>
              {t(
                'Ideas move from review to the roadmap, into progress, and finally to shipped.',
              )}{' '}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
