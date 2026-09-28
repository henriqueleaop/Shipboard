import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CreateBoardRequest } from '@shipboard/contracts';
import { BoardFields } from '../src/features/boards/board-fields';

vi.mock('../src/features/boards/github-repository-select', () => ({
  GitHubRepositorySelect: () => <select aria-label="GitHub repository" />,
}));

afterEach(cleanup);

function Example() {
  const form = useForm<CreateBoardRequest>({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      visibility: 'PUBLIC',
      githubRepositoryUrl: null,
    },
  });
  return <BoardFields form={form} />;
}

describe('board fields', () => {
  it('shows the backend-aligned counter only for the focused field', () => {
    render(<Example />);
    const name = screen.getByLabelText('Board name');
    const counter = screen.getByText('0 / 100');
    expect(name).toHaveAttribute('maxlength', '100');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Northstar' } });
    expect(counter).toHaveTextContent('9 / 100');
  });

  it('keeps an entered slug until the user chooses its suggested form', () => {
    render(<Example />);
    const slug = screen.getByLabelText('Public slug');
    fireEvent.change(slug, { target: { value: 'My Board!' } });
    expect(slug).toHaveValue('My Board!');
    expect(
      screen.getByText(/Public URL: shipboard.app\/My Board!/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Use suggestion: my-board' }),
    );
    expect(slug).toHaveValue('my-board');
  });

  it('offers all board visibility options and a GitHub repository selector', () => {
    render(<Example />);
    expect(screen.getByLabelText('Visibility')).toHaveValue('PUBLIC');
    expect(screen.getByLabelText('GitHub repository')).toBeInTheDocument();
  });
});
