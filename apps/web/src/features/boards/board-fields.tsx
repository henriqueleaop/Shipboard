'use client';

import { useLocale } from '../../lib/i18n/provider';

import type { UseFormReturn } from 'react-hook-form';
import React from 'react';

import {
  boardFieldLimits,
  type CreateBoardRequest,
} from '@shipboard/contracts';
import { CharacterCounter } from '../../components/ui/character-counter';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

function suggestSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function BoardFields({
  form,
}: {
  form: UseFormReturn<CreateBoardRequest>;
}) {
  const { t } = useLocale();
  const slug = form.watch('slug');
  const name = form.watch('name');
  const description = form.watch('description');
  const githubRepositoryUrl = form.watch('githubRepositoryUrl') ?? '';
  const suggestion = suggestSlug(slug);
  const slugError = form.formState.errors.slug;
  return (
    <>
      <label htmlFor="board-name">{t('Board name')}</label>
      <Input
        id="board-name"
        maxLength={boardFieldLimits.name}
        autoComplete="organization"
        aria-invalid={Boolean(form.formState.errors.name)}
        aria-describedby={
          form.formState.errors.name
            ? 'board-name-counter board-name-error'
            : 'board-name-counter'
        }
        {...form.register('name')}
      />
      <CharacterCounter
        id="board-name-counter"
        value={name}
        limit={boardFieldLimits.name}
      />
      {form.formState.errors.name && (
        <p id="board-name-error" role="alert" className="field-error">
          {t('Enter a board name.')}
        </p>
      )}
      <label htmlFor="board-slug">{t('Public slug')}</label>
      <Input
        id="board-slug"
        maxLength={boardFieldLimits.slug}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={Boolean(slugError)}
        aria-describedby={
          slugError
            ? 'board-slug-hint board-slug-counter board-slug-error'
            : 'board-slug-hint board-slug-counter'
        }
        {...form.register('slug')}
      />
      <CharacterCounter
        id="board-slug-counter"
        value={slug}
        limit={boardFieldLimits.slug}
      />
      <p id="board-slug-hint" className="hint">
        {t('Public URL:')} shipboard.app/{slug || 'your-board'}.{' '}
        {t('Use lowercase letters, numbers and single hyphens.')}
      </p>
      {slug && suggestion && suggestion !== slug && (
        <button
          type="button"
          className="button"
          onClick={() =>
            form.setValue('slug', suggestion, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        >
          {t('Use suggestion:')} {suggestion}
        </button>
      )}
      {slugError && (
        <p id="board-slug-error" role="alert" className="field-error">
          {t(
            'Choose an available address using lowercase letters, numbers and single hyphens.',
          )}
        </p>
      )}
      <label htmlFor="board-description">{t('Description')}</label>
      <Textarea
        id="board-description"
        rows={4}
        maxLength={boardFieldLimits.description}
        aria-invalid={Boolean(form.formState.errors.description)}
        aria-describedby={
          form.formState.errors.description
            ? 'board-description-counter board-description-error'
            : 'board-description-counter'
        }
        {...form.register('description')}
      />
      <CharacterCounter
        id="board-description-counter"
        value={description}
        limit={boardFieldLimits.description}
      />
      {form.formState.errors.description && (
        <p id="board-description-error" role="alert" className="field-error">
          {t('Check the form fields.')}
        </p>
      )}
      <label htmlFor="board-visibility">{t('Visibility')}</label>
      <select id="board-visibility" {...form.register('visibility')}>
        <option value="PUBLIC">{t('Public and listed on your profile')}</option>
        <option value="UNLISTED">{t('Public with the link only')}</option>
        <option value="PRIVATE">{t('Private to you')}</option>
      </select>
      <label htmlFor="board-github-repository">
        {t('Public GitHub repository')}
      </label>
      <Input
        id="board-github-repository"
        type="url"
        inputMode="url"
        maxLength={boardFieldLimits.githubRepositoryUrl}
        placeholder="https://github.com/owner/repository"
        aria-invalid={Boolean(form.formState.errors.githubRepositoryUrl)}
        aria-describedby={
          form.formState.errors.githubRepositoryUrl
            ? 'board-github-repository-counter board-github-repository-error'
            : 'board-github-repository-counter'
        }
        {...form.register('githubRepositoryUrl', {
          setValueAs: (value) => value || null,
        })}
      />
      <CharacterCounter
        id="board-github-repository-counter"
        value={githubRepositoryUrl}
        limit={boardFieldLimits.githubRepositoryUrl}
      />
      {form.formState.errors.githubRepositoryUrl && (
        <p
          id="board-github-repository-error"
          role="alert"
          className="field-error"
        >
          {t('Enter the canonical URL of a public GitHub repository.')}
        </p>
      )}
    </>
  );
}
