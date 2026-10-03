'use client';

import { useLocale } from '../../lib/i18n/provider';

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

import { useApiUrl } from '../../app/providers';
import { BoardWorkspace } from '../../components/layout/board-workspace';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../lib/api/client';
import { getBoard, updateBoard } from './api';
import { BoardFields } from './board-fields';
import { currentUser } from '../auth/api';

export default function BoardDetailPage() {
  const { t, errorMessage } = useLocale();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const apiUrl = useApiUrl();
  const client = useQueryClient();
  const [conflict, setConflict] = useState(false);
  const initialised = useRef<string | null>(null);
  const form = useForm<CreateBoardRequest>({
    resolver: zodResolver(createBoardRequestSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      visibility: 'PUBLIC',
      githubRepositoryUrl: null,
    },
  });
  const board = useQuery({
    queryKey: ['board', id],
    queryFn: () => getBoard(apiUrl, id),
    enabled: Boolean(id),
  });
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: () => currentUser(apiUrl),
  });
  useEffect(() => {
    if (board.data && initialised.current !== id) {
      form.reset({
        name: board.data.board.name,
        slug: board.data.board.slug,
        description: board.data.board.description,
        visibility: board.data.board.visibility,
        githubRepositoryUrl: board.data.board.githubRepositoryUrl,
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
        visibility: result.board.visibility,
        githubRepositoryUrl: result.board.githubRepositoryUrl,
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
        visibility: fresh.data.board.visibility,
        githubRepositoryUrl: fresh.data.board.githubRepositoryUrl,
      });
      setConflict(false);
      save.reset();
    }
  }

  if (board.isPending)
    return (
      <main className="page">
        <p>{t('Loading board…')}</p>
      </main>
    );
  if (board.isError) {
    const error = board.error;
    return (
      <main className="page">
        <h1>
          {error instanceof ApiError && error.status === 401
            ? t('Sign in to continue')
            : t('Board unavailable')}
        </h1>
        <p role="alert">
          {error instanceof ApiError
            ? errorMessage(error)
            : t('Could not load this board.')}
        </p>
        <Link
          href={
            error instanceof ApiError && error.status === 401
              ? '/login'
              : '/boards'
          }
        >
          {error instanceof ApiError && error.status === 401
            ? t('Sign in')
            : t('My boards')}
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <BoardWorkspace id={id} slug={board.data.board.slug} active="settings">
        <Link href="/boards">{t('← My boards')}</Link>
        <p className="eyebrow">{t('Board management')}</p>
        <h1>{board.data.board.name}</h1>
        <p>
          {t(
            'Edit the details of this board, review ideas, or open the public page.',
          )}{' '}
        </p>
        <div className="actions">
          <Button asChild tone="primary">
            <Link href={`/boards/${id}/suggestions`}>{t('Review ideas')}</Link>
          </Button>
          {user.data && (
            <Link
              className="button"
              href={`/${user.data.username}/${board.data.board.slug}`}
            >
              {t('View public board ↗')}{' '}
            </Link>
          )}
        </div>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <BoardFields form={form} />
          {conflict && (
            <div role="alert" className="notice error">
              {t(
                'This board changed in another tab. Your edits remain in the form. Reload the latest version before saving again.',
              )}{' '}
              <button type="button" onClick={reloadBoard}>
                {t('Reload board')}{' '}
              </button>
            </div>
          )}
          {save.isError && !conflict && (
            <p role="alert" className="notice error">
              {save.error instanceof ApiError
                ? save.error.code === 'SLUG_CONFLICT'
                  ? t('That slug is already in use. Choose another.')
                  : save.error.status === 401
                    ? t('Your session expired. Sign in again.')
                    : errorMessage(save.error)
                : t('Could not connect. Try again.')}
            </p>
          )}
          {save.isSuccess && (
            <p role="status" className="notice success">
              {t('Board saved.')}{' '}
            </p>
          )}
          <button
            className="primary"
            type="submit"
            disabled={save.isPending || conflict}
          >
            {save.isPending ? t('Saving…') : t('Save changes')}
          </button>
        </form>
      </BoardWorkspace>
    </main>
  );
}
