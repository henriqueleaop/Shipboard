import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../src/app/page';

describe('home page', () => {
  it('shows a semantic Shipboard heading and bootstrap copy', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'Shipboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Product feedback boards are being prepared.'),
    ).toBeInTheDocument();
  });
});
