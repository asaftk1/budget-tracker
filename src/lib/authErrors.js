// Maps Firebase Auth error codes to the Hebrew messages shown on the login page.
// Returns null for a closed popup: the user cancelled on purpose, so nothing should be shown.
export function authErrorMessage(err) {
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'החלון של Google נחסם על ידי הדפדפן. אפשר/י חלונות קופצים ונסה/י שוב.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'אימייל או סיסמה שגויים.';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות. נסה/י שוב בעוד כמה דקות.';
    case 'auth/email-not-verified':
      return 'האימייל טרם אומת. אשר/י את הכתובת דרך המייל שנשלח אליך ואז התחבר/י שוב.';
    case 'auth/email-already-in-use':
      return 'כתובת האימייל כבר רשומה. נסה/י להתחבר.';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי. בחר/י סיסמה של לפחות 6 תווים.';
    case 'auth/network-request-failed':
      return 'אין חיבור לרשת. בדוק/י את החיבור ונסה/י שוב.';
    default:
      return 'ההתחברות נכשלה. נסה/י שוב.';
  }
}
