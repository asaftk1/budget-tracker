import { authErrorMessage } from './authErrors';

const msg = (code) => authErrorMessage({ code });

describe('authErrorMessage', () => {
  test('a closed popup shows nothing', () => {
    expect(msg('auth/popup-closed-by-user')).toBeNull();
    expect(msg('auth/cancelled-popup-request')).toBeNull();
  });

  test.each([
    'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email',
  ])('%s is reported as wrong credentials', (code) => {
    expect(msg(code)).toBe('אימייל או סיסמה שגויים.');
  });

  test('too many requests, unverified email and blocked popup each have their own message', () => {
    const messages = new Set([
      msg('auth/too-many-requests'), msg('auth/email-not-verified'), msg('auth/popup-blocked'),
      msg('auth/some-new-code'),
    ]);
    expect(messages.size).toBe(4);
  });

  test('anything unknown, or a non-Firebase error, gets the generic message', () => {
    expect(msg('auth/some-new-code')).toBe('ההתחברות נכשלה. נסה/י שוב.');
    expect(authErrorMessage(new Error('boom'))).toBe('ההתחברות נכשלה. נסה/י שוב.');
    expect(authErrorMessage(undefined)).toBe('ההתחברות נכשלה. נסה/י שוב.');
  });

  test('every message is Hebrew', () => {
    ['auth/popup-blocked', 'auth/too-many-requests', 'auth/email-not-verified', 'x'].forEach((c) => {
      expect(msg(c)).toMatch(/[֐-׿]/);
    });
  });
});
