import { renderAppAtRoute } from '@app/test/renderAppAtRoute';
import { server } from '@app/test/setup';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

describe('browser-session bootstrap', () => {
  it('treats an invalid cookie as anonymous without mounting protected content', async () => {
    renderAppAtRoute('/corrections');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
  });

  it('keeps protected content blocked through an outage and explicit retry', async () => {
    server.use(graphql.query('Me', () => HttpResponse.error()));
    renderAppAtRoute('/corrections');

    expect(
      await screen.findByText('Authentication is temporarily unavailable. Please retry.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();

    server.resetHandlers();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
