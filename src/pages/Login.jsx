import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { authErrorMessage } from "../lib/authErrors";
import { Wallet } from "lucide-react";

export default function Login() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (user && user.emailVerified) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setInfo("");
      setNeedsVerification(false);
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        setMode("login");
        setPassword("");
        setInfo("נשלח אליך מייל אימות. אשר/י את הכתובת (בדוק/י גם בספאם) ואז התחבר/י.");
      } else {
        await signInWithEmail(email, password);
        // Navigate explicitly: the user object is mutated by reload(), which does not trigger a re-render.
        navigate("/dashboard");
      }
    } catch (err) {
      if (err?.code === "auth/email-not-verified") setNeedsVerification(true);
      setError(authErrorMessage(err) || "");
    }
  };

  const handleGoogle = async () => {
    try {
      setError("");
      setInfo("");
      await signInWithGoogle();
    } catch (err) {
      // A closed popup maps to null: no message.
      setError(authErrorMessage(err) || "");
    }
  };

  const handleResend = async () => {
    try {
      setError("");
      await resendVerification();
      setInfo("מייל אימות נשלח שוב. בדוק/י את תיבת הדואר (גם בספאם).");
    } catch (err) {
      setError("שליחת מייל האימות נכשלה. נסה/י שוב בעוד מספר דקות.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-card border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-card bg-primary text-white" aria-hidden="true">
            <Wallet size={24} />
          </span>
          <p className="text-sm font-medium text-muted-foreground">מעקב תקציב</p>
          <h1 className="text-2xl font-bold leading-tight text-foreground">
            {mode === "login" ? "התחברות למערכת" : "הרשמה למערכת"}
          </h1>
        </div>

        {/* A real form, so Enter submits. noValidate keeps the browser from adding its own popups. */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            aria-label="אימייל"
            placeholder="אימייל"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-label="סיסמה"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {info && <p role="status" className="text-sm text-primary">{info}</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {needsVerification && (
            <button
              type="button"
              className="rounded text-sm font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={handleResend}
            >
              שלח/י שוב מייל אימות
            </button>
          )}

          <Button type="submit" size="lg" className="w-full">
            {mode === "login" ? "התחבר" : "הירשם"}
          </Button>

          <button
            type="button"
            className="block w-full rounded py-1 text-center text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "אין לך חשבון? הירשם" : "כבר יש לך חשבון? התחבר"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" role="separator">
          <span className="h-px flex-1 bg-border" />
          <span>או</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" size="lg" onClick={handleGoogle} className="w-full">
          התחבר באמצעות Google
        </Button>
      </div>
    </div>
  );
}
