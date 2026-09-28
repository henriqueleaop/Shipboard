import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
import { AuthForm } from '../src/features/auth/auth-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const server = setupServer();
beforeAll(() => {
  server.use(
    http.get('http://localhost:3001/api/v1/auth/providers', () =>
      HttpResponse.json({ github: false }),
    ),
  );
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.use(
    http.get('http://localhost:3001/api/v1/auth/providers', () =>
      HttpResponse.json({ github: false }),
    ),
  );
});
afterAll(() => server.close());

describe('authentication form', () => {
  it('shows validation and establishes an authenticated result', async () => {
    let posted = false;
    server.use(
      http.post(
        'http://localhost:3001/api/auth/sign-up/email',
        async ({ request }) => {
          const body = (await request.json()) as {
            email: string;
            password: string;
          };
          expect(body).toEqual({
            email: 'owner+ideas@example.com',
            password: '  correct-日本語-password  ',
          });
          posted = true;
          return HttpResponse.json({
            id: crypto.randomUUID(),
            email: body.email,
          });
        },
      ),
    );
    render(
      <Providers apiUrl="http://localhost:3001">
        <AuthForm mode="register" />
      </Providers>,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'bad' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create account' }).closest('form')!,
    );
    expect(await screen.findAllByRole('alert')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner+ideas@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: '  correct-日本語-password  ' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: (screen.getByLabelText('Password') as HTMLInputElement).value },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password')).toHaveValue(
      '  correct-日本語-password  ',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create account' }).closest('form')!,
    );
    await waitFor(() => expect(posted).toBe(true));
  });

  it('shows a generic login failure', async () => {
    server.use(
      http.post('http://localhost:3001/api/auth/sign-in/email', () =>
        HttpResponse.json(
          {
            type: 'https://shipboard.dev/problems/invalid-credentials',
            title: 'Authentication failed',
            status: 401,
            detail: 'Invalid email or password.',
            instance: '/api/auth/sign-in/email',
            code: 'INVALID_CREDENTIALS',
            requestId: 'test-request',
          },
          { status: 401 },
        ),
      ),
    );
    render(
      <Providers apiUrl="http://localhost:3001">
        <AuthForm mode="login" />
      </Providers>,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'unknown@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'incorrect' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Sign in' }).closest('form')!,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.',
    );
  });
});
