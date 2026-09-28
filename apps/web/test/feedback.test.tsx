import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { Providers } from '../src/app/providers';
import { SuggestionForm } from '../src/features/suggestions/suggestion-form';
import OwnerSuggestionsPage from '../src/features/suggestions/owner-suggestions-page';
import { VoteButton } from '../src/features/votes/vote-button';

const boardId = 'a156f531-c3f1-467b-9004-ea4dc924a03f';
const ideaId = 'dc577a13-cd57-4586-b6a3-52817fbf7be4';
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  useParams: () => ({ id: 'a156f531-c3f1-467b-9004-ea4dc924a03f' }),
}));
const base = 'http://localhost:3001';
const idea = {
  id: ideaId,
  boardId,
  title: 'Keyboard shortcuts',
  description: 'Use the board without a mouse.',
  status: 'UNDER_REVIEW',
  version: 1,
  voteCount: 0,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
};
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

function RefreshOwner() {
  const client = useQueryClient();
  return (
    <button
      onClick={() =>
        client.invalidateQueries({ queryKey: ['owner-suggestions', boardId] })
      }
    >
      Background refresh
    </button>
  );
}

function SwitchAccount() {
  const client = useQueryClient();
  return (
    <button
      onClick={() =>
        client.setQueryData(['current-user'], {
          id: 'af0cbb50-228b-4925-b71d-bc6b66c28fa8',
          email: 'second@example.test',
        })
      }
    >
      Switch account
    </button>
  );
}

describe('feedback forms', () => {
  it('reads personal vote state separately after an account switch', async () => {
    let reads = 0;
    server.use(
      http.get(`${base}/api/v1/me`, () =>
        HttpResponse.json({
          id: '53bd7395-0447-43d1-ad85-d700680d5b82',
          email: 'first@example.test',
        }),
      ),
      http.get(`${base}/api/v1/suggestions/${ideaId}/vote`, () => {
        reads++;
        return HttpResponse.json({
          suggestionId: ideaId,
          voted: reads === 1,
          voteCount: 1,
        });
      }),
    );
    render(
      <Providers apiUrl={base}>
        <SwitchAccount />
        <VoteButton suggestionId={ideaId} returnTo="/northstar" />
      </Providers>,
    );
    expect(
      await screen.findByRole('button', { name: /Voted/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Switch account' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Vote$/ })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: /Vote$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(reads).toBe(2);
  });

  it('retains Unicode drafts and retry keys, and rotates the key when content changes', async () => {
    const attempts: { key: string | null; body: unknown }[] = [];
    server.use(
      http.post(
        `${base}/api/v1/boards/${boardId}/suggestions`,
        async ({ request }) => {
          attempts.push({
            key: request.headers.get('idempotency-key'),
            body: await request.json(),
          });
          return HttpResponse.json({}, { status: 503 });
        },
      ),
    );
    render(
      <Providers apiUrl={base}>
        <SuggestionForm boardId={boardId} slug="northstar" signedIn />
      </Providers>,
    );
    const title = screen.getByLabelText('Suggestion title');
    const description = screen.getByLabelText('Why it matters');
    expect(title).toHaveAttribute('maxlength', '120');
    expect(description).toHaveAttribute('maxlength', '2000');
    expect(screen.getByText('0 / 120')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish suggestion/ }));
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    fireEvent.compositionStart(title);
    fireEvent.change(title, { target: { value: '  日本語 / café 🎯  ' } });
    fireEvent.compositionEnd(title);
    fireEvent.change(description, {
      target: {
        value:
          '  Preserve punctuation, aliases + and newlines.\nSecond line.  ',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish suggestion/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your text is still here',
    );
    expect(title).toHaveValue('  日本語 / café 🎯  ');
    fireEvent.click(screen.getByRole('button', { name: /Publish suggestion/ }));
    await waitFor(() => expect(attempts).toHaveLength(2));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Publish suggestion/ }),
      ).toBeEnabled(),
    );
    expect(attempts[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(attempts[1]?.key).toBe(attempts[0]?.key);
    expect(attempts[0]?.body).toEqual({
      title: '日本語 / café 🎯',
      description:
        'Preserve punctuation, aliases + and newlines.\nSecond line.',
    });
    fireEvent.change(title, { target: { value: 'Revised 日本語 idea' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish suggestion/ }));
    await waitFor(() => expect(attempts).toHaveLength(3));
    expect(attempts[2]?.key).not.toBe(attempts[0]?.key);
  });

  it('keeps the loaded version through background refresh and preserves the choice after conflict', async () => {
    let latest = idea;
    let lists = 0;
    const matches: string[] = [];
    server.use(
      http.get(`${base}/api/v1/boards/${boardId}`, () =>
        HttpResponse.json({
          id: boardId,
          ownerId: '53bd7395-0447-43d1-ad85-d700680d5b82',
          name: 'Northstar',
          slug: 'northstar',
          description: 'Ideas',
          version: 1,
          createdAt: idea.createdAt,
          updatedAt: idea.updatedAt,
        }),
      ),
      http.get(`${base}/api/v1/boards/${boardId}/suggestions`, () => {
        lists++;
        return HttpResponse.json({
          items: [latest],
          page: { nextCursor: null },
        });
      }),
      http.get(
        `${base}/api/v1/public/boards/northstar/suggestions/${ideaId}`,
        () => HttpResponse.json(latest),
      ),
      http.patch(
        `${base}/api/v1/boards/${boardId}/suggestions/${ideaId}/status`,
        ({ request }) => {
          const match = request.headers.get('if-match')!;
          matches.push(match);
          if (match === '"1"')
            return HttpResponse.json(
              {
                type: 'https://shipboard.dev/problems/stale',
                title: 'Conflict',
                detail: 'Reload.',
                status: 412,
                code: 'SUGGESTION_STALE',
                requestId: 'test-request',
              },
              { status: 412 },
            );
          latest = { ...latest, version: 3, status: 'PLANNED' };
          return HttpResponse.json(latest);
        },
      ),
    );
    render(
      <Providers apiUrl={base}>
        <RefreshOwner />
        <OwnerSuggestionsPage />
      </Providers>,
    );
    const select = await screen.findByLabelText('Move to');
    fireEvent.change(select, { target: { value: 'PLANNED' } });
    latest = { ...idea, version: 2, status: 'SHIPPED' };
    fireEvent.click(screen.getByRole('button', { name: 'Background refresh' }));
    await waitFor(() => expect(lists).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('another tab');
    expect(matches).toEqual(['"1"']);
    expect(select).toHaveValue('PLANNED');
    fireEvent.click(
      screen.getByRole('button', { name: 'Reload', exact: true }),
    );
    await waitFor(() =>
      expect(document.querySelector('.status-shipped')).toHaveTextContent(
        'Shipped',
      ),
    );
    expect(select).toHaveValue('PLANNED');
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }));
    await waitFor(() => expect(select).toHaveValue('PLANNED'));
    expect(matches).toEqual(['"1"', '"2"']);
  });
});
