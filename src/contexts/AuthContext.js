import { createContext, useContext, useEffect, useState } from "react";
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

export function AuthProvider({ children }) {
  const auth = getAuth(app);
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    // persist auth across refreshes
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        try { await u.reload(); } catch {}
        setUser(u);
      } else {
        setUser(null);
      }
    });
  }, [auth]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    return res.user;
  };

  const signUpWithEmail = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    // do NOT signOut here; let the user stay signed-in but not verified
    return cred.user;
  };

  const signInWithEmail = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await cred.user.reload();
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
