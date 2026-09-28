'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { useApiUrl } from '../../app/providers';
import { CharacterCounter } from '../../components/ui/character-counter';
import { Input } from '../../components/ui/input';
import { useLocale } from '../../lib/i18n/provider';
import { githubRepositories, startGithubLink } from './api';

export function GitHubRepositorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string | null) => void;
}) {
  const { t, errorMessage } = useLocale();
  const apiUrl = useApiUrl();
  const [search, setSearch] = useState('');
  const repositories = useQuery({
    queryKey: ['github-repositories'],
    queryFn: () => githubRepositories(apiUrl),
  });
  const link = useMutation({
    mutationFn: () => startGithubLink(apiUrl),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const items = (repositories.data?.items ?? []).filter((repository) =>
    repository.fullName.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="github-repository-picker">
      <label htmlFor="github-repository-search">
        {t('Public GitHub repository')}
      </label>
      <Input
        id="github-repository-search"
        type="search"
        maxLength={100}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('Search your public repositories')}
        aria-describedby="github-repository-search-counter"
      />
      <CharacterCounter
        id="github-repository-search-counter"
        value={search}
        limit={100}
      />
      <select
        aria-label={t('Available GitHub repositories')}
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={repositories.isPending || repositories.isError}
      >
        <option value="">{t('No linked repository')}</option>
        {items.map((repository) => (
          <option key={repository.url} value={repository.url}>
            {repository.fullName}
          </option>
        ))}
      </select>
      {repositories.isError && (
        <div role="alert" className="field-error">
          <p>{errorMessage(repositories.error)}</p>
          <button type="button" className="button" onClick={() => link.mutate()}>
            {link.isPending ? t('Connecting…') : t('Connect GitHub')}
          </button>
        </div>
      )}
      {repositories.isSuccess && items.length === 0 && (
        <p className="hint">{t('No public repositories found.')}</p>
      )}
    </div>
  );
}
