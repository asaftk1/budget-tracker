import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Login() {
  const { user, signInWithGoogle, signInWithEmail } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleEmailLogin = async () => {
    try {
      setError('');
      await signInWithEmail(email, password);
    } catch (err) {
      setError('שגיאה בהתחברות: בדוק אימייל וסיסמה');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md text-center w-80">
        <h2 className="text-2xl font-bold mb-6 text-green-600">התחברות למערכת</h2>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="אימייל"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            onClick={handleEmailLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
             התחבר 
          </Button>

          <hr className="my-4" />

          <Button
            onClick={signInWithGoogle}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            🔒 התחבר באמצעות Google
          </Button>
        </div>
      </div>
    </div>
  );
}