import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GoogleLoginButton } from '../components/common/GoogleLoginButton';
import { SEO } from '../components/common/SEO';
import { BrandLockup } from '../components/common/BrandLockup';
import { ForgotPasswordForm } from '../components/common/ForgotPasswordForm';

interface LoginPageProps {
  onNavigate: (route: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        // Routing follows the server-issued role; no email address is privileged client-side.
        onNavigate(res.user?.role === 'admin' ? 'admin' : 'dashboard');
      } else {
        setErrorMessage(res.message || 'Invalid email or password');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4 space-y-6 select-none">
      <SEO
        title="Client Login | ASTRO SIVAM"
        description="Log in to your ASTRO SIVAM account to access your purchased Vedic horoscopes, family orders, and live astrological charts."
        canonical="https://astrosivam.com/login"
      />
      
      {/* Brand Header — emblem with the name and the slogan under it */}
      <div className="text-center space-y-3">
        <BrandLockup />
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Customer Sign In
          </h1>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold tracking-wide mt-0.5">
            Divine Guidance • Cosmic Insights • Destined Futures
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Access your saved birth profile, Vedic astrology orders, and verified PDF reports.
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {notice && !errorMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs leading-relaxed">
            {notice}
          </div>
        )}

        {showForgot ? (
          <ForgotPasswordForm
            initialEmail={email}
            onBackToSignIn={msg => {
              setShowForgot(false);
              setErrorMessage('');
              setNotice(msg || '');
            }}
          />
        ) : (
          <>
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* 1-Click Social Sign In Options */}
        <div className="space-y-2.5">
          <GoogleLoginButton
            mode="signin"
            onSuccess={() => onNavigate('dashboard')}
            onError={msg => setErrorMessage(msg)}
          />
          <div className="relative flex items-center justify-center my-1 pt-1">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              or sign in with email
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Customer Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end -mt-2">
            <button
              type="button"
              onClick={() => { setErrorMessage(''); setNotice(''); setShowForgot(true); }}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Signing In...' : 'Sign In to Customer Dashboard'}</span>
          </button>
        </form>

        {/* Register link */}
        <div className="text-center text-xs text-slate-500 pt-2">
          Don&apos;t have an ASTRO SIVAM customer account?{' '}
          <button
            onClick={() => onNavigate('register')}
            className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Register Here
          </button>
        </div>
          </>
        )}

      </div>

    </div>
  );
};

