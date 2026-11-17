import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './Login';
import { useAuth } from '../contexts/AuthContext';

const mockNavigate = jest.fn();
// Virtual: the installed Jest cannot resolve react-router-dom v7 (it only ships an exports map).
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

let auth;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  auth = {
    user: null,
    signInWithGoogle: jest.fn(),
    signInWithEmail: jest.fn().mockResolvedValue({}),
    signUpWithEmail: jest.fn().mockResolvedValue({}),
    resendVerification: jest.fn().mockResolvedValue(true),
  };
  useAuth.mockReturnValue(auth);
});

async function renderLogin() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<Login />); });
  return container;
}
const setInput = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = (form) => act(async () => {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
});
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const byText = (t) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(t));

describe('Login form', () => {
  test('the fields live inside one form, so Enter submits', async () => {
    await renderLogin();
    const form = document.body.querySelector('form');
    expect(form).not.toBeNull();
    expect(form.querySelector('input[type=email]')).not.toBeNull();
    expect(form.querySelector('input[type=password]')).not.toBeNull();
  });

  test('submitting signs in with the typed credentials and does not reload the page', async () => {
    await renderLogin();
    await setInput(document.body.querySelector('input[type=email]'), 'a@b.co');
    await setInput(document.body.querySelector('input[type=password]'), 'secret1');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => { document.body.querySelector('form').dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(auth.signInWithEmail).toHaveBeenCalledWith('a@b.co', 'secret1');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('clicking the submit button submits the form', async () => {
    await renderLogin();
    await click(document.body.querySelector('button[type=submit]'));
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1);
  });

  test('the other buttons are type=button and never submit', async () => {
    await renderLogin();
    const others = [...document.body.querySelectorAll('button:not([type=submit])')];
    expect(others.length).toBeGreaterThanOrEqual(2); // mode switch and Google
    for (const b of others) expect(b.getAttribute('type')).toBe('button');
    await click(byText('Google'));
    expect(auth.signInWithEmail).not.toHaveBeenCalled();
  });

  test('switching to sign-up changes what Enter does and the autofill hint', async () => {
    await renderLogin();
    const password = () => document.body.querySelector('input[type=password]');
    expect(password().getAttribute('autocomplete')).toBe('current-password');
    await click(byText('הירשם'));
    expect(password().getAttribute('autocomplete')).toBe('new-password');
    await setInput(document.body.querySelector('input[type=email]'), 'n@b.co');
    await setInput(password(), 'secret1');
    await submit(document.body.querySelector('form'));
    expect(auth.signUpWithEmail).toHaveBeenCalledWith('n@b.co', 'secret1');
    expect(auth.signInWithEmail).not.toHaveBeenCalled();
  });

  test('inputs have accessible names and autofill hints', async () => {
    await renderLogin();
    const email = document.body.querySelector('input[type=email]');
    const password = document.body.querySelector('input[type=password]');
    expect(email.getAttribute('aria-label')).toBeTruthy();
    expect(password.getAttribute('aria-label')).toBeTruthy();
    expect(email.getAttribute('autocomplete')).toBe('email');
  });

  test('an unverified account shows an alert and the resend button works without submitting', async () => {
    const error = new Error('x');
    error.code = 'auth/email-not-verified';
    auth.signInWithEmail.mockRejectedValue(error);
    await renderLogin();
    await submit(document.body.querySelector('form'));
    expect(document.body.querySelector('[role=alert]')).not.toBeNull();
    const resend = [...document.body.querySelectorAll('button')].find((b) => b.className.includes('underline'));
    expect(resend.getAttribute('type')).toBe('button');
    await click(resend);
    expect(auth.resendVerification).toHaveBeenCalledTimes(1);
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[role=status]')).not.toBeNull();
  });

  const errorText = () => document.body.querySelector('[role=alert]')?.textContent;
  const reject = (fn, code) => fn.mockRejectedValue(Object.assign(new Error('x'), { code }));

  test('wrong credentials show a Hebrew message and no alert() is used', async () => {
    window.alert = jest.fn();
    reject(auth.signInWithEmail, 'auth/invalid-credential');
    await renderLogin();
    await submit(document.body.querySelector('form'));
    expect(errorText()).toBe('אימייל או סיסמה שגויים.');
    expect(window.alert).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('too many requests has its own message', async () => {
    reject(auth.signInWithEmail, 'auth/too-many-requests');
    await renderLogin();
    await submit(document.body.querySelector('form'));
    expect(errorText()).toContain('יותר מדי ניסיונות');
  });

  test('a failed Google sign-in is caught and shown inline', async () => {
    reject(auth.signInWithGoogle, 'auth/popup-blocked');
    await renderLogin();
    await click(byText('Google'));
    expect(errorText()).toContain('Google');
  });

  test('closing the Google popup shows no error', async () => {
    reject(auth.signInWithGoogle, 'auth/popup-closed-by-user');
    await renderLogin();
    await click(byText('Google'));
    expect(document.body.querySelector('[role=alert]')).toBeNull();
  });
});
