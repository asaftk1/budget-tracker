import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as authMod from 'firebase/auth';
import { AuthProvider, useAuth, userSnapshot } from './AuthContext';

jest.mock('../firebase', () => ({ app: {} }));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  setPersistence: jest.fn(() => Promise.resolve()),
  browserLocalPersistence: {},
}));

let authCallback;
let firebaseUser;
const seen = [];

function Probe() {
  const value = useAuth();
  seen.push(value.user);
  return <span id="state">{value.user === undefined ? 'pending' : value.user === null ? 'out' : `verified=${value.user.emailVerified}`}</span>;
}

let ctx;
function Capture() {
  ctx = useAuth();
  return null;
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  seen.length = 0;
  // Like the real SDK: one user object, mutated in place by reload().
  firebaseUser = {
    uid: 'u1', email: 'a@b.co', displayName: null, photoURL: null, emailVerified: false,
    reload: jest.fn(async () => {}),
  };
  authMod.getAuth.mockImplementation(() => ({ currentUser: firebaseUser }));
  authMod.setPersistence.mockResolvedValue();
  authMod.onAuthStateChanged.mockImplementation((auth, cb) => {
    authCallback = cb;
    return () => {};
  });
});

async function renderProvider(children = <Probe />) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<AuthProvider>{children}<Capture /></AuthProvider>);
  });
  return container;
}
const state = () => document.body.querySelector('#state').textContent;

describe('AuthContext user snapshot', () => {
  test('userSnapshot copies the fields and maps no user to null', () => {
    expect(userSnapshot(null)).toBeNull();
    const snap = userSnapshot(firebaseUser);
    expect(snap).not.toBe(firebaseUser);
    expect(snap).toEqual({ uid: 'u1', email: 'a@b.co', displayName: null, photoURL: null, emailVerified: false });
  });

  test('pending, then signed-out', async () => {
    await renderProvider();
    expect(state()).toBe('pending');
    await act(async () => authCallback(null));
    expect(state()).toBe('out');
  });

  test('a resend check that finds the email verified re-renders consumers (the user object is mutated)', async () => {
    await renderProvider();
    await act(async () => authCallback(firebaseUser));
    expect(state()).toBe('verified=false');

    // The user verifies in another tab; reload() flips the flag on the same object.
    firebaseUser.reload.mockImplementation(async () => { firebaseUser.emailVerified = true; });
    await act(async () => { await ctx.resendVerification(); });

    expect(state()).toBe('verified=true');
    expect(authMod.sendEmailVerification).not.toHaveBeenCalled();
  });

  test('signing in after verifying elsewhere publishes the verified state', async () => {
    await renderProvider();
    firebaseUser.reload.mockImplementation(async () => { firebaseUser.emailVerified = true; });
    authMod.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser });
    await act(async () => { await ctx.signInWithEmail('a@b.co', 'pw'); });
    expect(state()).toBe('verified=true');
  });

  test('an unverified sign-in still throws auth/email-not-verified', async () => {
    await renderProvider();
    authMod.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser });
    let caught;
    await act(async () => { await ctx.signInWithEmail('a@b.co', 'pw').catch((e) => { caught = e; }); });
    expect(caught).toMatchObject({ code: 'auth/email-not-verified' });
  });

  test('an unchanged user does not replace the snapshot (no needless re-render)', async () => {
    await renderProvider();
    await act(async () => authCallback(firebaseUser));
    const first = seen[seen.length - 1];
    await act(async () => authCallback(firebaseUser));
    expect(seen[seen.length - 1]).toBe(first);
  });

  test('the first auth state is published after reload, never before', async () => {
    let finish;
    firebaseUser.reload.mockImplementation(() => new Promise((r) => { finish = r; }));
    await renderProvider();
    await act(async () => { authCallback(firebaseUser); });
    expect(state()).toBe('pending');
    firebaseUser.emailVerified = true;
    await act(async () => finish());
    expect(state()).toBe('verified=true');
  });
});
