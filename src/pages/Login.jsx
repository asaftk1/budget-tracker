import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
      if (err?.code === "auth/email-not-verified") {
        setNeedsVerification(true);
        setError("האימייל טרם אומת. אשר/י את הכתובת דרך המייל שנשלח אליך ואז התחבר/י שוב.");
      } else {
        setError("Invalid email, password, or unverified account");
      }
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
    <div dir="rtl" className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md text-center w-80">
        <h2 className="text-2xl font-bold mb-6 text-green-600">
          {mode === "login" ? "התחברות למערכת" : "הרשמה למערכת"}
        </h2>

        {/* A real form, so Enter submits. noValidate keeps the browser from adding its own popups. */}
        <form onSubmit={handleSubmit} noValidate>
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

          {info && <p role="status" className="text-green-700 text-sm mt-2">{info}</p>}
          {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
          {needsVerification && (
            <button type="button" className="text-sm text-blue-600 underline" onClick={handleResend}>
              שלח/י שוב מייל אימות
            </button>
          )}

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-3">
            {mode === "login" ? "התחבר" : "הירשם"}
          </Button>

          <button
            type="button"
            className="text-sm text-blue-600 mt-2"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "אין לך חשבון? הירשם" : "כבר יש לך חשבון? התחבר"}
          </button>
        </form>

        <hr className="my-4" />

        <Button type="button" onClick={signInWithGoogle} className="w-full bg-green-600 hover:bg-green-700 text-white">
          התחבר באמצעות Google
        </Button>
      </div>
    </div>
  );
}
