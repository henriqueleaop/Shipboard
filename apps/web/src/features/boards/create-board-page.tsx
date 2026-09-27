'use client';

import {
  createBoardRequestSchema,
  type CreateBoardRequest,
} from '@shipboard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useRef } from 'react';
import { useForm } from 'react-hook-form';

import { useApiUrl } from '../../app/providers';
import { ApiError, createBoardRequest } from '../api/client';
import { BoardFields } from './board-fields';

export default function NewBoardPage() {
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
      <Link href="/boards">← My boards</Link>
      <p className="eyebrow">Board setup</p>
      <h1>Create a board</h1>
      <form onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <BoardFields form={form} />
        {create.isError && (
          <p role="alert" className="notice error">
            {create.error instanceof ApiError
              ? create.error.code === 'IDEMPOTENCY_IN_PROGRESS'
                ? 'The board is still being created. Wait a moment and try again.'
                : create.error.code === 'SLUG_CONFLICT'
                  ? 'That slug is already in use. Choose another.'
                  : create.error.status === 401
                    ? 'Your session expired. Sign in again.'
                    : create.error.message
              : 'Could not connect. Try again.'}
          </p>
        )}
        <button className="primary" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create board'}
        </button>
      </form>
    </main>
  );
}
