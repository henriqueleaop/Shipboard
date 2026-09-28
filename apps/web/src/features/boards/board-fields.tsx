'use client';

import { useLocale } from '../../lib/i18n/provider';

import type { UseFormReturn } from 'react-hook-form';
import React from 'react';

import type { CreateBoardRequest } from '@shipboard/contracts';
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
  const suggestion = suggestSlug(slug);
  const slugError = form.formState.errors.slug;
  return (
    <>
      <label htmlFor="board-name">{t("Board name")}</label>
      <Input
        id="board-name"
        autoComplete="organization"
        aria-invalid={Boolean(form.formState.errors.name)}
        aria-describedby={
          form.formState.errors.name ? 'board-name-error' : undefined
        }
        {...form.register('name')}
      />
      {form.formState.errors.name && (
        <p id="board-name-error" role="alert" className="field-error">
          {form.formState.errors.name.message}
        </p>
      )}
      <label htmlFor="board-slug">{t("Public slug")}</label>
      <Input
        id="board-slug"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={Boolean(slugError)}
        aria-describedby={
          slugError ? 'board-slug-hint board-slug-error' : 'board-slug-hint'
        }
        {...form.register('slug')}
      />
      <p id="board-slug-hint" className="hint">
        Public URL: shipboard.app/{slug || 'your-board'}. Use lowercase letters,
        numbers and single hyphens.
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
        >{t("Use suggestion:")}{' '}{suggestion}
        </button>
      )}
      {slugError && (
        <p id="board-slug-error" role="alert" className="field-error">
          {slugError.message}
        </p>
      )}
      <label htmlFor="board-description">{t("Description")}</label>
      <Textarea
        id="board-description"
        rows={4}
        aria-invalid={Boolean(form.formState.errors.description)}
        aria-describedby={
          form.formState.errors.description
            ? 'board-description-error'
            : undefined
        }
        {...form.register('description')}
      />
      {form.formState.errors.description && (
        <p id="board-description-error" role="alert" className="field-error">
          {form.formState.errors.description.message}
        </p>
      )}
    </>
  );
}
