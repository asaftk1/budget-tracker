import { useState, useEffect } from "react";
import { auth, provider } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

const Auth = ({ onAuth }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (onAuth) onAuth(currentUser);
    });
    return () => unsubscribe();
  }, [onAuth]);

  const handleEmailAuth = async () => {
    try {
      setError("");
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError("");
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (user) {
    return (
      <div style={{ textAlign: "center", margin: "20px" }}>
        <p>🔐 מחובר כ־<strong>{user.email}</strong></p>
        <button onClick={handleLogout}>התנתק</button>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isRegistering ? "הרשמה" : "התחברות"}</h2>

        <input
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button onClick={handleEmailAuth}>
          {isRegistering ? "הירשם" : "התחבר"}
        </button>

        <button onClick={handleGoogleLogin}>
          התחברות עם Google
        </button>

        <p style={{ marginTop: "10px" }}>
          {isRegistering ? "כבר יש לך חשבון?" : "אין לך חשבון?"}{" "}
          <span
            style={{ color: "#007bff", cursor: "pointer" }}
            onClick={() => setIsRegistering((prev) => !prev)}
          >
            {isRegistering ? "התחבר כאן" : "הרשם כאן"}
          </span>
        </p>
      </div>

      <style>{`
        .auth-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: #f4f6f8;
        }

        .auth-card {
          background: white;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 400px;
          text-align: center;
        }

        .auth-card input {
          width: 100%;
          padding: 10px;
          margin-bottom: 12px;
          border: 1px solid #ccc;
          border-radius: 8px;
        }

        .auth-card button {
          width: 100%;
          padding: 10px;
          margin-top: 8px;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .auth-card button:nth-of-type(1) {
          background-color: #4caf50;
          color: white;
        }

        .auth-card button:nth-of-type(2) {
          background-color: #4285f4;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default Auth;
