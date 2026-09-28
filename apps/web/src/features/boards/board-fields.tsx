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
import { GitHubRepositorySelect } from './github-repository-select';

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
      <GitHubRepositorySelect
        value={githubRepositoryUrl}
        onChange={(value) =>
          form.setValue('githubRepositoryUrl', value, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />
    </>
  );
}
