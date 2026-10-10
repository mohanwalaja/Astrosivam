import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { aiAstrologer, type ChatLanguage } from '../../services/aiAstrologerApi';
import AiAstrologerPanel from './AiAstrologerPanel';

/**
 * Site-wide AI Astrologer launcher, replacing the retired canned support chat.
 * Customers only see it while the server confirms a recently delivered paid
 * report. Administrators always see it while signed in.
 */
export const AiAstrologerLauncher: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setIsAvailable(false);
      setIsOpen(false);
      return;
    }

    if (isAdmin) {
      setIsAvailable(true);
      return;
    }

    let cancelled = false;
    const refreshAccess = async () => {
      try {
        // This endpoint uses the same server-side email-delivery and 7-day
        // entitlement gate as the chat itself. The browser never grants access.
        await aiAstrologer.usage();
        if (!cancelled) setIsAvailable(true);
      } catch {
        if (!cancelled) {
          setIsAvailable(false);
          setIsOpen(false);
        }
      }
    };

    void refreshAccess();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshAccess();
    }, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshAccess();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, isAdmin]);

  if (!user?.id || !isAvailable) return null;

  const language: ChatLanguage = isAdmin ? 'en' : (user.country === 'India' ? 'hi' : 'ta');

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-3 z-[60] w-[calc(100vw-1.5rem)] max-w-lg select-auto sm:right-5">
          <AiAstrologerPanel
            customerId={String(user.id)}
            customerName={user.name || (isAdmin ? 'Administrator' : 'there')}
            language={language}
            isAdmin={isAdmin}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-3">
        {!isOpen && (
          <div className="hidden items-center gap-2 rounded-full border border-amber-500/30 bg-slate-900/95 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md sm:flex">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Ask AI Astrologer</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-500 text-slate-950 shadow-2xl transition-all hover:scale-110 active:scale-95"
          aria-label={isOpen ? 'Close AI Astrologer chat' : 'Open AI Astrologer chat'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-6" />}
        </button>
      </div>
    </>
  );
};
