import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '../src/app/page';

describe('Page', () => {
  it('renders the project title', () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Football VAR Decision Explorer' }),
    ).toBeTruthy();
  });
});
