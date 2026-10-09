import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, ShieldAlert } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (err: string) => void;
  mode?: 'signin' | 'register';
  className?: string;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  mode = 'signin',
  className = ''
}) => {
  const { settings, googleLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalError, setModalError] = useState('');

  const isEnabled = settings?.googleLoginEnabled !== false;
  const clientId = settings?.googleClientId?.trim();

  // Dynamically load Google Identity Services SDK
  useEffect(() => {
    if (!document.getElementById('google-gsi-client')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  if (!isEnabled) {
    return null;
  }

  const handleGoogleClick = async () => {
    // If Google Client ID is configured, attempt official Google OAuth2 / GIS popup
    if (clientId && window.google?.accounts) {
      setIsLoading(true);
      try {
        if (window.google.accounts.oauth2) {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                setIsLoading(false);
                setModalError('Google sign-in was cancelled or blocked by your browser. Please allow pop-ups for astrosivam.com and try again.');
                setShowConfigModal(true);
                return;
              }

              try {
                // Send ONLY the access token. The server calls Google's
                // userinfo endpoint itself, so the identity cannot be spoofed.
                const res = await googleLogin({ accessToken: tokenResponse.access_token });

                if (res.success) {
                  onSuccess?.();
                } else {
                  setModalError(res.message || 'Google sign in failed.');
                  setShowConfigModal(true);
                  onError?.(res.message || 'Google sign in failed.');
                }
              } catch (e: any) {
                onError?.(e.message || 'Error processing Google profile data.');
              } finally {
                setIsLoading(false);
              }
            }
          });

          tokenClient.requestAccessToken();
          return;
        } else if (window.google.accounts.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                // Send ONLY the signed ID token. The server verifies it with
                // Google and derives the identity itself.
                const res = await googleLogin({ credential: response.credential });

                if (res.success) {
                  onSuccess?.();
                } else {
                  setModalError(res.message || 'Google login failed.');
                  setShowConfigModal(true);
                  onError?.(res.message || 'Google login failed.');
                }
              }
              setIsLoading(false);
            }
          });

          window.google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              setIsLoading(false);
              setModalError('The Google sign-in prompt could not be displayed. Please allow third-party cookies / pop-ups for astrosivam.com, or sign in with your e-mail and password instead.');
              setShowConfigModal(true);
            }
          });
          return;
        }
      } catch (err: any) {
        console.warn('Google GIS error:', err);
        setIsLoading(false);
      }
    }

    // No Google client configured, or the SDK failed to load. We CANNOT sign
    // the devotee in without a Google-verified token, so explain the situation
    // instead of trusting a hand-typed e-mail address.
    setModalError(
      !clientId
        ? 'Google Sign-In is not configured for this site yet. Please sign in with your e-mail address and password, or contact support.'
        : 'Google Sign-In could not be reached. Please check your connection and try again, or sign in with your e-mail address and password.'
    );
    setShowConfigModal(true);
  };

  return (
    <>
      <button
        type="button"
        id="google-login-btn"
        onClick={handleGoogleClick}
        disabled={isLoading}
        className={`w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {/* Official Multi-Color Google G Logo */}
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            fill="#EA4335"
          />
        </svg>

        <span className="whitespace-nowrap">
          {isLoading
            ? 'Connecting to Google...'
            : mode === 'signin'
            ? 'Continue with Google'
            : 'Sign Up with Google'}
        </span>
      </button>

      {/* Seamless Google Sign-In & Verification Dialog */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sign in with Google
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ASTRO SIVAM User Portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {modalError || 'Google sign-in could not be completed.'}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              For your security, ASTRO SIVAM only accepts sign-ins verified directly by Google.
              An account can never be accessed by simply typing in an e-mail address.
            </p>

            <div className="pt-1 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalError('');
                  setShowConfigModal(false);
                  handleGoogleClick();
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
