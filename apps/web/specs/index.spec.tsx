import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Page from '../src/app/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

describe('Page', () => {
  it('renders the Ask the Laws screen', async () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Football VAR Decision Explorer' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Question')).toBeTruthy();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
