import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RequireAuth, PublicRoute } from './RouteGuards';
import { useAuth } from '../contexts/AuthContext';

// Virtual: the installed Jest cannot resolve react-router-dom v7 (it only ships an exports map).
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <span data-redirect={to} />,
}), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
});

// Re-render the same root, like a context update would.
async function show(Guard, user) {
  useAuth.mockReturnValue({ user });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () => act(async () => root.render(<Guard><p id="page">page</p></Guard>));
  await render();
  return { render, setUser: (u) => { useAuth.mockReturnValue({ user: u }); } };
}
const redirect = () => document.body.querySelector('[data-redirect]')?.getAttribute('data-redirect');
const page = () => document.body.querySelector('#page');

describe('RequireAuth', () => {
  test('renders nothing while the auth state is pending', async () => {
    await show(RequireAuth, undefined);
    expect(page()).toBeNull();
    expect(redirect()).toBeUndefined();
  });
  test('signed out goes to /login', async () => {
    await show(RequireAuth, null);
    expect(redirect()).toBe('/login');
  });
  test('an unverified user goes to /login', async () => {
    await show(RequireAuth, { uid: 'u', emailVerified: false });
    expect(redirect()).toBe('/login');
  });
  test('a verified user sees the page', async () => {
    await show(RequireAuth, { uid: 'u', emailVerified: true });
    expect(page()).not.toBeNull();
  });
  test('a user who becomes verified gets in without a reload', async () => {
    const h = await show(RequireAuth, { uid: 'u', emailVerified: false });
    expect(redirect()).toBe('/login');
    h.setUser({ uid: 'u', emailVerified: true });
    await h.render();
    expect(page()).not.toBeNull();
  });
});

describe('PublicRoute', () => {
  test('renders nothing while pending', async () => {
    await show(PublicRoute, undefined);
    expect(page()).toBeNull();
    expect(redirect()).toBeUndefined();
  });
  test('signed-out and unverified users see the page', async () => {
    await show(PublicRoute, null);
    expect(page()).not.toBeNull();
    document.body.innerHTML = '';
    await show(PublicRoute, { uid: 'u', emailVerified: false });
    expect(page()).not.toBeNull();
  });
  test('a verified user is sent to /dashboard', async () => {
    await show(PublicRoute, { uid: 'u', emailVerified: true });
    expect(redirect()).toBe('/dashboard');
  });
});
