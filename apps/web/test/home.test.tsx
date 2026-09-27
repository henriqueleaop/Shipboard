import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../src/app/page';

describe('home page', () => {
  it('offers the account setup journey', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'Shipboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create an account' }),
    ).toBeInTheDocument();
  });
});
