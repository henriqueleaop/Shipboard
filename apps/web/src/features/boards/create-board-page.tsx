'use client';

import { useLocale } from '../../lib/i18n/provider';

import {
  createBoardRequestSchema,
  type CreateBoardRequest,
} from '@shipboard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useRef } from 'react';
import { Button } from '../../components/ui/button';
import { useForm } from 'react-hook-form';

import { useApiUrl } from '../../app/providers';
import { ApiError } from '../../lib/api/client';
import { createBoardRequest } from './api';
import { BoardFields } from './board-fields';

export default function NewBoardPage() {
  const { t, errorMessage } = useLocale();
  const apiUrl = useApiUrl();
  const router = useRouter();
  const client = useQueryClient();
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const form = useForm<CreateBoardRequest>({
    resolver: zodResolver(createBoardRequestSchema),
    defaultValues: { name: '', slug: '', description: '' },
  });
  const create = useMutation({
    mutationFn: async (values: CreateBoardRequest) => {
      const body = JSON.stringify(values);
      if (attempt.current?.body !== body) {
        attempt.current = { body, key: crypto.randomUUID() };
      }
      return createBoardRequest(apiUrl, values, attempt.current.key);
    },
    onSuccess: async (board) => {
      attempt.current = null;
      await client.invalidateQueries({ queryKey: ['boards'] });
      router.push(`/boards/${board.id}`);
    },
  });

  return (
    <main className="page narrow">
      <Link href="/boards">{t("← My boards")}</Link>
      <p className="eyebrow">{t("Board setup")}</p>
      <h1>{t("Create a board")}</h1>
      <form onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <BoardFields form={form} />
        {create.isError && (
          <p role="alert" className="notice error">
            {create.error instanceof ApiError
              ? create.error.code === 'IDEMPOTENCY_IN_PROGRESS'
                ? t("The board is still being created. Wait a moment and try again.")
                : create.error.code === 'SLUG_CONFLICT'
                  ? t("That slug is already in use. Choose another.")
                  : create.error.status === 401
                    ? t("Your session expired. Sign in again.")
                    : errorMessage(create.error)
              : t("Could not connect. Try again.")}
          </p>
        )}
        <Button tone="primary" type="submit" disabled={create.isPending}>
          {create.isPending ? t("Creating…") : t("Create board")}
        </Button>
      </form>
    </main>
  );
}
