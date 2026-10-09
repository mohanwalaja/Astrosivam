import React, { useState } from 'react';
import { Mail, Phone, Lock, UserPlus, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleLoginButton } from '../components/common/GoogleLoginButton';
import { PersonNameField } from '../components/common/PersonNameField';
import { normalizePersonName } from '../utils/birthDetails';
import { SEO } from '../components/common/SEO';
import { BrandLockup } from '../components/common/BrandLockup';

interface RegisterPageProps {
  onNavigate: (route: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register, verifyRegisterOtp, resendRegisterOtp } = useAuth();

  // OTP verification step (shown after a successful registration submit)
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Simple Account Details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('+679 ');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const normalizedName = normalizePersonName(name);
    if (!normalizedName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        name: normalizedName,
        email: normalizedEmail,
        mobile: mobile.trim(),
        password,
        country: 'India'
      });

      if (res.success && (res as any).status === 'otp_required') {
        setOtpEmail((res as any).email || normalizedEmail);
        setOtpInfo(res.message || `We've sent a 6-digit code to ${normalizedEmail}.`);
        setOtpStep(true);
      } else if (res.success) {
        onNavigate('dashboard');
      } else {
        setErrorMessage(res.message || 'Registration failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    if (otp.trim().length !== 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    setIsVerifying(true);
    try {
      const res = await verifyRegisterOtp(otpEmail, otp.trim(), password);
      if (res.success) {
        onNavigate('dashboard');
      } else {
        setOtpError(res.message || 'Verification failed');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError('');
    setIsResending(true);
    try {
      const res = await resendRegisterOtp(otpEmail);
      if (res.success) setOtpInfo(res.message || 'A new code has been sent.');
      else setOtpError(res.message || 'Could not resend code.');
    } catch (err: any) {
      setOtpError(err.message || 'Could not resend code');
    } finally {
      setIsResending(false);
    }
  };

  if (otpStep) {
    return (
      <div className="max-w-md mx-auto my-12 px-4 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Verify Your Email</h1>
            <p className="text-xs text-slate-500 mt-1">{otpInfo || `Enter the 6-digit code sent to ${otpEmail}`}</p>
          </div>
        </div>

        {otpError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{otpError}</span>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit code"
            className="w-full text-center tracking-[0.5em] text-lg font-bold p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            autoFocus
          />
          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Activate Account'}
          </button>
        </form>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isResending}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 cursor-pointer"
          >
            {isResending ? 'Sending...' : "Didn't get a code? Resend"}
          </button>
          <div>
            <button
              type="button"
              onClick={() => setOtpStep(false)}
              className="text-xs text-slate-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" /> Back to registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12 px-4 space-y-6">
      <SEO
        title="Create an Account | ASTRO SIVAM"
        description="Register for an ASTRO SIVAM account to save your birth profiles, track astrology orders, and access instant PDF reports."
        canonical="https://astrosivam.com/register"
      />
      
      {/* Header — emblem with the name and the slogan under it */}
      <div className="text-center space-y-3">
        <BrandLockup />
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Create Customer Account
          </h1>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold tracking-wide mt-0.5">
            Divine Guidance • Cosmic Insights • Destined Futures
          </p>
        </div>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Sign up in seconds. Birth details are not required now — you can enter and save your birth details when placing your astrology orders.
        </p>
      </div>

      {/* Registration Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* 1-Click Social Quick Registration */}
        <div className="space-y-2.5">
          <GoogleLoginButton
            mode="register"
            onSuccess={() => onNavigate('dashboard')}
            onError={msg => setErrorMessage(msg)}
          />
          <div className="relative flex items-center justify-center my-1 pt-1">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              or register with email
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <PersonNameField
            id="register-full-name"
            label="Full name"
            value={name}
            onChange={setName}
            placeholder="e.g. Ramesh Chand"
            size="sm"
          />

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Email Address <span className="text-rose-500">*</span>
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
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="tel"
                required
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+679 123 4567"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Confirm <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer mt-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isLoading ? 'Creating Account...' : 'Create Customer Account'}</span>
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('login')}
            className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Sign In
          </button>
        </div>

      </div>

    </div>
  );
};
