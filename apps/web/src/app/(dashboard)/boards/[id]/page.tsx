'use client';

import {
  createBoardRequestSchema,
  type CreateBoardRequest,
} from '@shipboard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useApiUrl } from '../../../providers';
import {
  ApiError,
  getBoard,
  updateBoard,
} from '../../../../features/api/client';
import { BoardFields } from '../../../../features/boards/board-fields';

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const [conflict, setConflict] = useState(false);
  const initialised = useRef<string | null>(null);
  const form = useForm<CreateBoardRequest>({
    resolver: zodResolver(createBoardRequestSchema),
    defaultValues: { name: '', slug: '', description: '' },
  });
  const board = useQuery({
    queryKey: ['board', id],
    queryFn: () => getBoard(apiUrl, id),
    enabled: Boolean(id),
  });
  useEffect(() => {
    if (board.data && initialised.current !== id) {
      form.reset({
        name: board.data.board.name,
        slug: board.data.board.slug,
        description: board.data.board.description,
      });
      initialised.current = id;
    }
  }, [board.data, form, id]);
  const save = useMutation({
    mutationFn: (values: CreateBoardRequest) => {
      if (!board.data?.etag) throw new Error('The board version is missing.');
      return updateBoard(apiUrl, id, values, board.data.etag);
    },
    onSuccess: async (result) => {
      client.setQueryData(['board', id], result);
      await client.invalidateQueries({ queryKey: ['boards'] });
      form.reset({
        name: result.board.name,
        slug: result.board.slug,
        description: result.board.description,
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 412) setConflict(true);
    },
  });

  async function reloadBoard() {
    const fresh = await board.refetch();
    if (fresh.data) {
      form.reset({
        name: fresh.data.board.name,
        slug: fresh.data.board.slug,
        description: fresh.data.board.description,
      });
      setConflict(false);
      save.reset();
    }
  }

  if (board.isPending)
    return (
      <main className="page">
        <p>Loading board…</p>
      </main>
    );
  if (board.isError) {
    const error = board.error;
    return (
      <main className="page">
        <h1>
          {error instanceof ApiError && error.status === 401
            ? 'Sign in to continue'
            : 'Board unavailable'}
        </h1>
        <p role="alert">
          {error instanceof ApiError
            ? error.message
            : 'Could not load this board.'}
        </p>
        <Link
          href={
            error instanceof ApiError && error.status === 401
              ? '/login'
              : '/boards'
          }
        >
          {error instanceof ApiError && error.status === 401
            ? 'Sign in'
            : 'My boards'}
        </Link>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <Link href="/boards">← My boards</Link>
      <p className="eyebrow">Board management</p>
      <h1>{board.data.board.name}</h1>
      <p>
        Edit the details of this board. The public page will be available when
        feedback features are added.
      </p>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <BoardFields form={form} />
        {conflict && (
          <div role="alert" className="notice error">
            This board changed in another tab. Your edits remain in the form.
            Reload the latest version before saving again.
            <button type="button" onClick={reloadBoard}>
              Reload board
            </button>
          </div>
        )}
        {save.isError && !conflict && (
          <p role="alert" className="notice error">
            {save.error instanceof ApiError
              ? save.error.code === 'SLUG_CONFLICT'
                ? 'That slug is already in use. Choose another.'
                : save.error.status === 401
                  ? 'Your session expired. Sign in again.'
                  : save.error.message
              : 'Could not connect. Try again.'}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="notice success">
            Board saved.
          </p>
        )}
        <button
          className="primary"
          type="submit"
          disabled={save.isPending || conflict}
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </main>
  );
}
