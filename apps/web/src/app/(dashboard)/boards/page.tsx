'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import React from 'react';

import { useApiUrl } from '../../providers';
import {
  ApiError,
  currentUser,
  listBoards,
} from '../../../features/api/client';

export default function BoardsPage() {
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
        <p>Checking your session…</p>
      </main>
    );
  if (user.isError)
    return (
      <main className="page">
        <p role="alert">Could not load your account. Try refreshing.</p>
      </main>
    );
  if (!user.data)
    return (
      <main className="page">
        <h1>Sign in to manage boards</h1>
        <Link href="/login">Sign in</Link>
      </main>
    );
  const items = boards.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>My boards</h1>
        </div>
        <Link className="button primary" href="/boards/new">
          Create board
        </Link>
      </div>
      {boards.isPending && <p>Loading boards…</p>}
      {boards.isError && (
        <p role="alert" className="notice error">
          {boards.error instanceof ApiError
            ? boards.error.message
            : 'Could not load boards.'}
        </p>
      )}
      {boards.isSuccess && items.length === 0 && (
        <section className="empty-state">
          <h2>No boards yet</h2>
          <p>Create your first board to set up a place for product feedback.</p>
          <Link href="/boards/new">Create board</Link>
        </section>
      )}
      {items.length > 0 && (
        <ul className="board-grid">
          {items.map((board) => (
            <li key={board.id}>
              <Link className="board-card" href={`/boards/${board.id}`}>
                <strong>{board.name}</strong>
                <span>/{board.slug}</span>
                <p>{board.description || 'No description yet.'}</p>
              </Link>
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
          {boards.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </main>
  );
}
