import React, { useState } from 'react';
import axios from 'axios';
import {
  X, UserPlus, LogIn, Mail, Lock, Phone, User,
  Eye, EyeOff, AlertTriangle, CheckCircle2, Sparkles, ArrowRight, WifiOff
} from 'lucide-react';
import { safeString } from './utils.js';

const API_BASE = '/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState('');
  const [showOfflineOption, setShowOfflineOption] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setError('');
    setErrorCode('');
    setSuccess('');
    setShowOfflineOption(false);
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setErrorCode('');
    setSuccess('');
    setShowOfflineOption(false);
  };

  const handleSwitchToLoginWithEmail = () => {
    setMode('login');
    setError('');
    setErrorCode('');
    setShowOfflineOption(false);
  };

  const handleContinueOffline = () => {
    const offlineUser = {
      id: 9999,
      name: name.trim() || 'Citizen Responder',
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      isOffline: true
    };
    const offlineToken = `offline_citizen_${Date.now()}`;
    sessionStorage.setItem('rapidresolve_user_token', offlineToken);
    sessionStorage.setItem('rapidresolve_user', JSON.stringify(offlineUser));
    onAuthSuccess(offlineUser, offlineToken);
    setSuccess('Signed in via Local Real-Time Cache! Logging you in...');
    setTimeout(() => onClose(), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setSuccess('');
    setShowOfflineOption(false);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Email and password are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Full name is required for registration.');
        return;
      }
      if (cleanPassword.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await axios.post(`${API_BASE}/auth/signup`, {
          name: name.trim(),
          email: cleanEmail,
          password: cleanPassword,
          phone: phone.trim() || undefined
        }, { timeout: 6000 });

        if (res.data?.success) {
          setSuccess('Account created successfully! Logging you in...');
          // Auto-login after signup
          try {
            const loginRes = await axios.post(`${API_BASE}/auth/login`, {
              email: cleanEmail,
              password: cleanPassword
            }, { timeout: 5000 });

            if (loginRes.data?.success) {
              sessionStorage.setItem('rapidresolve_user_token', loginRes.data.token);
              sessionStorage.setItem('rapidresolve_user', JSON.stringify(loginRes.data.user));
              onAuthSuccess(loginRes.data.user, loginRes.data.token);
              setTimeout(() => onClose(), 600);
              return;
            }
          } catch {
            // If auto-login fails, switch to login tab
            setMode('login');
            setSuccess('Account registered! Please sign in with your password.');
          }
        }
      } else {
        const res = await axios.post(`${API_BASE}/auth/login`, {
          email: cleanEmail,
          password: cleanPassword
        }, { timeout: 6000 });

        if (res.data?.success) {
          sessionStorage.setItem('rapidresolve_user_token', res.data.token);
          sessionStorage.setItem('rapidresolve_user', JSON.stringify(res.data.user));
          onAuthSuccess(res.data.user, res.data.token);
          setSuccess('Logged in successfully!');
          setTimeout(() => onClose(), 500);
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const code = data?.code;

      setErrorCode(code || '');

      if (status === 409 || code === 'EMAIL_EXISTS') {
        setError('An account with this email already exists.');
      } else if (status === 401 || code === 'USER_NOT_FOUND' || code === 'INVALID_PASSWORD') {
        setError(data?.error || 'Invalid email or password. Please try again.');
      } else if (status === 503 || code === 'BACKEND_OFFLINE' || err.code === 'ECONNREFUSED' || !err.response) {
        setError('Database server is initializing or offline on port 5000.');
        setShowOfflineOption(true);
      } else if (status === 500) {
        setError(data?.error || 'Database connection error. You can continue using offline guest mode.');
        setShowOfflineOption(true);
      } else {
        const raw = data?.error || err.message;
        setError(safeString(raw, 'Authentication failed. Please verify your details.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 anim-fade-in">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden anim-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 px-6 py-5 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-xs text-sky-100 font-medium">
                  Rapid Resolve Citizen Portal • Chhatrapati Sambhaji Nagar
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium space-y-2 anim-fade-in-up">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{safeString(error)}</span>
              </div>

              {/* Helpful 1-click helper if email already exists */}
              {errorCode === 'EMAIL_EXISTS' && mode === 'signup' && (
                <button
                  type="button"
                  onClick={handleSwitchToLoginWithEmail}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-100 hover:bg-sky-200 px-3 py-1.5 rounded-lg transition"
                >
                  <span>Already registered? Click to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Offline fallback button if backend is offline/error */}
              {showOfflineOption && (
                <div className="pt-1 border-t border-rose-200">
                  <p className="text-[11px] text-rose-600 mb-1.5">
                    Would you like to continue in local session mode while the database reconnects?
                  </p>
                  <button
                    type="button"
                    onClick={handleContinueOffline}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition shadow-sm"
                  >
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Continue in Offline Citizen Mode</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 anim-fade-in-up">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{safeString(success)}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div className="anim-fade-in-up">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ishaan Mohide"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                />
              </div>
            </div>
          )}

          <div className="anim-fade-in-up" style={{ animationDelay: mode === 'signup' ? '0.05s' : '0s' }}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="anim-fade-in-up" style={{ animationDelay: mode === 'signup' ? '0.1s' : '0.05s' }}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="anim-fade-in-up" style={{ animationDelay: '0.15s' }}>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 hover:shadow-sky-600/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="px-6 pb-5 pt-0 text-center">
          <div className="border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-sky-600 hover:text-sky-700 font-bold ml-1.5 transition hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
