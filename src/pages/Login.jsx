import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function Login() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && user.emailVerified) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async () => {
    try {
      setError("");
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        alert("Verification email sent. Please confirm before login.");
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError("Invalid email, password, or unverified account");
    }
  };

  return (
    <div dir="rtl" className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md text-center w-80">
        <h2 className="text-2xl font-bold mb-6 text-green-600">
          {mode === "login" ? "התחברות למערכת" : "הרשמה למערכת"}
        </h2>

        <Input type="email" placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-3">
          {mode === "login" ? "התחבר" : "הירשם"}
        </Button>

        <button
          className="text-sm text-blue-600 mt-2"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "אין לך חשבון? הירשם" : "כבר יש לך חשבון? התחבר"}
        </button>

        <hr className="my-4" />

        <Button onClick={signInWithGoogle} className="w-full bg-green-600 hover:bg-green-700 text-white">
          התחבר באמצעות Google
        </Button>
      </div>
    </div>
  );
}
