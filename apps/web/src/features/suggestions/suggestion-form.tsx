'use client';

import { useLocale } from '../../lib/i18n/provider';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createSuggestionRequestSchema,
  type CreateSuggestionRequest,
} from '@shipboard/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useRef } from 'react';
import { useForm } from 'react-hook-form';

import { useApiUrl } from '../../app/providers';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { ApiError } from '../../lib/api/client';
import { createSuggestionRequest } from './api';

export function SuggestionForm({
  boardId,
  slug,
  signedIn,
}: {
  boardId: string;
  slug: string;
  signedIn: boolean;
}) {
  const { t } = useLocale();
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const router = useRouter();
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const form = useForm<CreateSuggestionRequest>({
    resolver: zodResolver(createSuggestionRequestSchema),
    defaultValues: { title: '', description: '' },
  });
  const submit = useMutation({
    mutationFn: (body: CreateSuggestionRequest) => {
      const serialized = JSON.stringify(body);
      if (!attempt.current || attempt.current.body !== serialized) {
        attempt.current = { key: crypto.randomUUID(), body: serialized };
      }
      return createSuggestionRequest(
        apiUrl,
        boardId,
        body,
        attempt.current.key,
      );
    },
    onSuccess: async (result) => {
      attempt.current = null;
      form.reset();
      await client.invalidateQueries({ queryKey: ['suggestions'] });
      router.push(`/${slug}/suggestions/${result.id}`);
    },
  });
  if (!signedIn)
    return (
      <div className="form-panel">
        <h2>{t("Bring an idea aboard")}</h2>
        <p>{t("Sign in to share what you would like to see next.")}</p>
        <Link
          className="button primary"
          href={`/login?returnTo=${encodeURIComponent(`/${slug}`)}`}
        >{t("Sign in to suggest")}{' '}</Link>
      </div>
    );
  return (
    <div className="form-panel">
      <p className="eyebrow">{t("The next thing")}</p>
      <h2>{t("Share an idea")}</h2>
      <form onSubmit={form.handleSubmit((values) => submit.mutate(values))}>
        <label htmlFor="suggestion-title">{t("A clear title")}</label>
        <Input
          id="suggestion-title"
          placeholder={t("What should we build next?")}
          aria-invalid={Boolean(form.formState.errors.title)}
          aria-describedby={
            form.formState.errors.title ? 'suggestion-title-error' : undefined
          }
          {...form.register('title')}
        />
        {form.formState.errors.title && (
          <p id="suggestion-title-error" role="alert" className="field-error">
            {form.formState.errors.title.message}
          </p>
        )}
        <label htmlFor="suggestion-description">{t("Why it matters")}</label>
        <Textarea
          id="suggestion-description"
          rows={5}
          placeholder={t("Tell us how this would help your work.")}
          aria-invalid={Boolean(form.formState.errors.description)}
          aria-describedby={
            form.formState.errors.description
              ? 'suggestion-description-error'
              : undefined
          }
          {...form.register('description')}
        />
        {form.formState.errors.description && (
          <p
            id="suggestion-description-error"
            role="alert"
            className="field-error"
          >
            {form.formState.errors.description.message}
          </p>
        )}
        {submit.isError && (
          <p role="alert" className="notice error">
            {submit.error instanceof ApiError && submit.error.status === 401
              ? t("Your session expired. Your text is still here.")
              : t("Could not publish your idea. Your text is still here; try again.")}
            {submit.error instanceof ApiError &&
              submit.error.status === 401 && (
                <>
                  {' '}
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(`/${slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >{t("Sign in in a new tab")}{' '}</Link>{t(", then return to publish.")}{' '}</>
              )}
          </p>
        )}
        <Button type="submit" tone="primary" disabled={submit.isPending}>
          {submit.isPending ? t("Publishing…") : t("Publish idea →")}
        </Button>
      </form>
    </div>
  );
}
