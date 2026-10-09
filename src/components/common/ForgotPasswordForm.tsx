import React, { useState } from 'react';
import { api } from '../../services/api';
import { Mail, Lock, KeyRound, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface ForgotPasswordFormProps {
  initialEmail?: string;
  /** Called after a successful reset, or when the user backs out. */
  onBackToSignIn: (notice?: string) => void;
}

const inputClass =
  'w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none';

/**
 * Two-step password reset: request an emailed 6-digit code, then enter the
 * code with a new password. The server gives the same reply for unknown
 * emails, so this form never reveals whether an account exists.
 */
export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ initialEmail = '', onBackToSignIn }) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      const res = await api.forgotPassword(email);
      if (res.success) {
        setNotice(res.message || 'If an account exists for that email, a reset code has been sent.');
        setStep('reset');
      } else {
        setError(res.message || 'Could not send a reset code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not send a reset code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.resetPassword(email, code, password);
      if (res.success) {
        onBackToSignIn(res.message || 'Your password has been reset. Please sign in with your new password.');
      } else {
        setError(res.message || 'Could not reset your password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not reset your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Reset your password</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {step === 'request'
            ? 'Enter the email address on your account and we will send you a 6-digit reset code.'
            : `Enter the code we sent to ${email} and choose a new password. The code expires in 15 minutes.`}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && !error && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {step === 'request' ? (
        <form onSubmit={requestCode} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Sending code...' : 'Send reset code'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              6-digit code *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              New password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Confirm new password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Resetting...' : 'Set new password'}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setStep('request'); setError(''); setNotice(''); setCode(''); }}
            className="w-full text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Didn&apos;t get the code? Send a new one
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => onBackToSignIn()}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to sign in
      </button>
    </div>
  );
};
