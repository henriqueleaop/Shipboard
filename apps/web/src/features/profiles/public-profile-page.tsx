'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { ApiError } from '../../lib/api/client';
import { publicProfile } from './api';

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const apiUrl = useApiUrl();
  const profile = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => publicProfile(apiUrl, username),
  });
  if (profile.isPending)
    return (
      <main className="page">
        <p>Loading profile…</p>
      </main>
    );
  if (profile.isError)
    return (
      <main className="page narrow">
        <p className="eyebrow">Profile unavailable</p>
        <h1>
          {profile.error instanceof ApiError && profile.error.status === 404
            ? 'This profile could not be found.'
            : 'We could not load this profile.'}
        </h1>
        <Link href="/">Return home</Link>
      </main>
    );
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Shipboard profile</p>
          <h1>@{profile.data.username}</h1>
        </div>
        {profile.data.githubProfileUrl && (
          <a
            href={profile.data.githubProfileUrl}
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        )}
      </header>
      {profile.data.boards.length === 0 ? (
        <section className="empty-state">
          <h2>No public boards yet</h2>
          <p>This member has not published a board.</p>
        </section>
      ) : (
        <ul className="board-grid">
          {profile.data.boards.map((board) => (
            <li key={board.slug}>
              <Link
                className="board-card"
                href={`/${profile.data.username}/${board.slug}`}
              >
                <strong>{board.name}</strong>
                <span>/{board.slug}</span>
                <p>{board.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
