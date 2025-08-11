import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { AuthProvider } from './contexts/AuthContext'; // 👈 ייבוא הקונטקסט שיצרת

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider> {/* 👈 עטיפה סביב כל האפליקציה */}
      <App />
    </AuthProvider>
  </React.StrictMode>
);
