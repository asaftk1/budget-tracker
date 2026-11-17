import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { app } from "../firebase"; // make sure you export initialized app from firebase.js/ts

const AuthContext = createContext(null);

// The Firebase user object is mutated in place by reload(), so putting it in state never triggers a
// re-render when emailVerified changes. The context holds an immutable snapshot of the fields the
// app reads instead; a new snapshot object is created whenever one of them changes.
export function userSnapshot(u) {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
  };
}

const sameSnapshot = (a, b) =>
  a === b || (!!a && !!b && Object.keys(a).every((k) => a[k] === b[k]));

export function AuthProvider({ children }) {
  const auth = getAuth(app);
  const [user, setUser] = useState(undefined);

  // Publish the current state of a Firebase user; keeps the old snapshot (no re-render) when
  // nothing the app reads has changed.
  const updateUser = useCallback((u) => {
    const next = userSnapshot(u);
    setUser((prev) => (prev !== undefined && sameSnapshot(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    // persist auth across refreshes
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        try { await u.reload(); } catch {}
        updateUser(u);
      } else {
        setUser(null);
      }
    });
  }, [auth, updateUser]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    return res.user;
  };

  const signUpWithEmail = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(cred.user);
    } finally {
      // Never leave an unverified user signed in; they must verify, then log in.
      await fbSignOut(auth);
    }
  };

  const signInWithEmail = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await cred.user.reload();
    updateUser(cred.user);
    if (!cred.user.emailVerified) {
      const e = new Error("Email not verified");
      e.code = "auth/email-not-verified";
      throw e;
    }
    return cred.user;
  };

  const resendVerification = async () => {
    if (!auth.currentUser) throw new Error("auth/no-current-user");
    await auth.currentUser.reload();
    updateUser(auth.currentUser);
    if (auth.currentUser.emailVerified) return true;
    await sendEmailVerification(auth.currentUser);
    return true;
  };

  const signOutUser = () => fbSignOut(auth);

  const value = {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerification,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
