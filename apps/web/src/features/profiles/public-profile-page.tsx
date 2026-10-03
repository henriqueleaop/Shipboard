'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { ApiError } from '../../lib/api/client';
import { legacyPublicBoard } from '../suggestions/api';
import { publicProfile } from './api';

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const apiUrl = useApiUrl();
  const profileCheck = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => publicProfile(apiUrl, username),
  });
  const profile = useInfiniteQuery({
    queryKey: ['public-profile', username, 'pages'],
    queryFn: ({ pageParam }) => publicProfile(apiUrl, username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    enabled: profileCheck.isSuccess,
  });
  const legacy = useQuery({
    queryKey: ['legacy-public-board', username],
    queryFn: () => legacyPublicBoard(apiUrl, username),
    enabled:
      profileCheck.isError &&
      profileCheck.error instanceof ApiError &&
      profileCheck.error.status === 404,
    retry: false,
  });
  React.useEffect(() => {
    if (legacy.data)
      router.replace(`/${legacy.data.ownerUsername}/${legacy.data.slug}`);
  }, [legacy.data, router]);
  if (profileCheck.isPending || (profileCheck.isSuccess && profile.isPending))
    return (
      <main className="page">
        <p>Loading profile…</p>
      </main>
    );
  if (
    profileCheck.isError &&
    profileCheck.error instanceof ApiError &&
    profileCheck.error.status === 404 &&
    (legacy.isPending || legacy.data)
  )
    return (
      <main className="page">
        <p>Resolving this board's new address…</p>
      </main>
    );
  if (profileCheck.isError)
    return (
      <main className="page narrow">
        <p className="eyebrow">Profile unavailable</p>
        <h1>
          {profileCheck.error instanceof ApiError &&
          profileCheck.error.status === 404
            ? 'This profile could not be found.'
            : 'We could not load this profile.'}
        </h1>
        <Link href="/">Return home</Link>
      </main>
    );
  if (profile.isError)
    return (
      <main className="page narrow">
        <p className="eyebrow">Profile unavailable</p>
        <h1>We could not load this profile.</h1>
        <Link href="/">Return home</Link>
      </main>
    );
  const pages = profile.data?.pages ?? [];
  const boardItems = pages.flatMap((page) => page.boards);
  const first = pages[0];
  if (!first) return null;
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Shipboard profile</p>
          <h1>@{first.username}</h1>
        </div>
        {first.githubProfileUrl && (
          <a href={first.githubProfileUrl} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        )}
      </header>
      {boardItems.length === 0 ? (
        <section className="empty-state">
          <h2>No public boards yet</h2>
          <p>This member has not published a board.</p>
        </section>
      ) : (
        <ul className="board-grid">
          {boardItems.map((board) => (
            <li key={board.slug}>
              <Link
                className="board-card"
                href={`/${first.username}/${board.slug}`}
              >
                <strong>{board.name}</strong>
                <span>/{board.slug}</span>
                <p>{board.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {profile.hasNextPage && (
        <button
          type="button"
          onClick={() => profile.fetchNextPage()}
          disabled={profile.isFetchingNextPage}
        >
          {profile.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </main>
  );
}
