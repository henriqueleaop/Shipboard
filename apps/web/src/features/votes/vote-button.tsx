'use client';

import { useLocale } from '../../lib/i18n/provider';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import React from 'react';

import { useApiUrl } from '../../app/providers';
import { currentUser } from '../auth/api';
import { getVote, setVote } from './api';

export function VoteButton({
  suggestionId,
  returnTo,
}: {
  suggestionId: string;
  returnTo: string;
}) {
  const { t } = useLocale();
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });
  const vote = useQuery({
    queryKey: [t("vote"), suggestionId, user.data?.id],
    queryFn: () => getVote(apiUrl, suggestionId),
    enabled: Boolean(user.data),
  });
  const change = useMutation({
    mutationFn: (voted: boolean) => setVote(apiUrl, suggestionId, voted),
    onSuccess: async (state) => {
      client.setQueryData([t("vote"), suggestionId, user.data?.id], state);
      await client.invalidateQueries({ queryKey: ['my-votes'] });
      await client.invalidateQueries({ queryKey: ['suggestions'] });
      await client.invalidateQueries({
        queryKey: ['suggestion', suggestionId],
      });
    },
  });
  if (!user.data)
    return (
      <Link
        className="button"
        href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
      >{t("Sign in to vote")}{' '}</Link>
    );
  return (
    <div className="vote-control">
      <button
        type="button"
        className={vote.data?.voted ? 'vote-active' : ''}
        aria-pressed={vote.data?.voted ?? false}
        disabled={!vote.data || change.isPending}
        onClick={() => change.mutate(!vote.data?.voted)}
      >
        {vote.data?.voted ? t("▲ Voted") : t("△ Vote")}
      </button>
      {change.isError && (
        <span role="alert">{t("Could not update your vote. Try again.")}</span>
      )}
      {vote.isError && (
        <span role="alert">{t("Could not load your vote.")}{' '}
          <button type="button" onClick={() => vote.refetch()}>{t("Try again")}{' '}</button>
        </span>
      )}
    </div>
  );
}
