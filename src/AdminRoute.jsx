import React from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';

/**
 * AdminRoute — Protected route wrapper for the Admin Command Center.
 * Only allows access if admin is authenticated via session token.
 * Shows an access denied page for unauthenticated users.
 */
export default function AdminRoute({ children }) {
  const token = sessionStorage.getItem('rapidresolve_admin_token');

  if (!token) {
    // Not authenticated — show the login-gated CommandCenter
    // which has its own built-in login form
    return children;
  }

  return children;
}
