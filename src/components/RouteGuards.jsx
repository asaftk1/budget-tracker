import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Signed-in, email-verified users only.
export function RequireAuth({ children }) {
  // undefined while the first auth state (and its reload) is pending.
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user || !user.emailVerified) return <Navigate to="/login" replace />;
  return children;
}

// For the login page: verified users are sent on to the app.
export function PublicRoute({ children }) {
  // undefined while the first auth state (and its reload) is pending.
  const { user } = useAuth();
  if (user === undefined) return null;
  if (user && user.emailVerified) return <Navigate to="/dashboard" replace />;
  return children;
}
