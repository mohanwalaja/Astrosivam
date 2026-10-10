/**
 * ASTRO SIVAM AI Astrologer — the customer/admin chat panel.
 *
 * Part 4 scope: the entry point, customer paid-gate handling and the history.
 * The typing choreography (status text for 2-4s, then three dots, then
 * 2-4 bubbles 1-2s apart, capped at 12s) is tuned in Part 5; the hooks it needs
 * are already here as TIMING constants so the tuning is a numbers change, not a
 * rewrite.
 *
 * The header always says "ASTRO SIVAM AI Astrologer" and the panel never claims
 * to be a person - both are hard requirements.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, RefreshCw, UserRound, X } from 'lucide-react';
import {
  aiAstrologer,
  AiAstrologerError,
  type ChatLanguage,
  type ChatMessage,
} from '../../services/aiAstrologerApi';

/**
 * Timing, in milliseconds. The 12s cap is absolute and the real AI response
 * time counts towards it - a slow model must never be padded out further.
 */
const TIMING = {
  statusMin: 2000,
  statusMax: 4000,
  bubbleGap: 1500,
  hardCap: 12000,
};

const DISCLAIMER: Record<ChatLanguage, string> = {
  en: 'Astrological guidance based on Vedic and Tamil traditions; not a substitute for medical, legal or financial advice.',
  ta: 'வேத மற்றும் தமிழ் மரபுகளின் அடிப்படையிலான ஜோதிட வழிகாட்டல்; மருத்துவ, சட்ட அல்லது நிதி ஆலோசனைக்கு மாற்று அல்ல.',
  hi: 'वैदिक और तमिल परंपराओं पर आधारित ज्योतिष मार्गदर्शन; चिकित्सा, कानूनी या वित्तीय सलाह का विकल्प नहीं।',
};

const STATUS: Record<ChatLanguage, string> = {
  en: 'ASTRO SIVAM Astrologer is checking your chart...',
  ta: 'ASTRO SIVAM ஜோதிடர் உங்கள் ஜாதகத்தைப் பார்க்கிறார்...',
  hi: 'ASTRO SIVAM ज्योतिषी आपकी कुंडली देख रहे हैं...',
};

const GREETING: Record<ChatLanguage, (name: string) => string> = {
  en: (n) => `Hello ${n} — I am the ASTRO SIVAM AI Astrologer. Ask me anything about your chart or your report, and I will explain it.`,
  ta: (n) => `வணக்கம் ${n} — நான் ASTRO SIVAM AI ஜோதிடர். உங்கள் ஜாதகம் அல்லது அறிக்கை பற்றி எதுவும் கேளுங்கள் — நான் விளக்குகிறேன்.`,
  hi: (n) => `नमस्ते ${n} — मैं ASTRO SIVAM AI ज्योतिषी हूँ। अपनी कुंडली या रिपोर्ट के बारे में कुछ भी पूछें — मैं हर हिस्सा समझाऊँगा।`,
};

/** Display names for the report the customer just received, per language. */
const SERVICE_TITLE: Record<string, Record<ChatLanguage, string>> = {
  BIRTH_JATHAGAM: { en: 'Birth Jathagam', ta: 'ஜன்ம ஜாதக', hi: 'जन्म कुंडली' },
  MARRIAGE_COMPATIBILITY: { en: 'Marriage Compatibility', ta: 'திருமண பொருத்த', hi: 'विवाह मिलान' },
  BABY_NAMING: { en: 'Baby Naming', ta: 'குழந்தை பெயர்', hi: 'नामकरण' },
  MUHURTHAM: { en: 'Muhurtham', ta: 'முகூர்த்த', hi: 'मुहूर्त' },
};

/**
 * Welcome for a customer whose report was just delivered. Names the report and
 * its order number, and opens the floor to chart AND order questions.
 */
const ORDER_GREETING: Record<ChatLanguage, (name: string, service: string, orderNo: string) => string> = {
  en: (n, s, o) => `Hello ${n} — thank you for your order. Your ${s} report (#${o}) has been delivered to your email. Ask me anything about your chart or your order — I am here to help.`,
  ta: (n, s, o) => `வணக்கம் ${n} — உங்கள் ஆர்டருக்கு நன்றி. உங்கள் ${s} அறிக்கை (#${o}) உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டுள்ளது. உங்கள் ஜாதகம் அல்லது ஆர்டர் பற்றி எதுவும் கேளுங்கள் — நான் உதவ தயாராக இருக்கிறேன்.`,
  hi: (n, s, o) => `नमस्ते ${n} — आपके ऑर्डर के लिए धन्यवाद। आपकी ${s} रिपोर्ट (#${o}) आपके ईमेल पर भेज दी गई है। अपनी कुंडली या ऑर्डर के बारे में कुछ भी पूछें — मैं मदद के लिए यहाँ हूँ।`,
};

const RETRY_TEXT: Record<ChatLanguage, string> = {
  en: 'Please give me a moment, I am checking again.',
  ta: 'ஒரு கணம் பொறுங்கள், மீண்டும் பார்க்கிறேன்.',
  hi: 'एक क्षण रुकिए, मैं फिर से देख रहा हूँ।',
};

const HANDOFF_LABEL: Record<ChatLanguage, string> = {
  en: 'Talk to our astrologer',
  ta: 'எங்கள் ஜோதிடரிடம் பேசுங்கள்',
  hi: 'हमारे ज्योतिषी से बात करें',
};

interface Props {
  customerId: string;
  customerName: string;
  language: ChatLanguage;
  /** Bind the conversation to one report. Omit for a general chat. */
  orderId?: string;
  orderLabel?: string;
  /** Administrators have purchase- and daily-limit-free access. */
  isAdmin?: boolean;
  onClose?: () => void;
}

export default function AiAstrologerPanel({
  customerId,
  customerName,
  language,
  orderId,
  orderLabel,
  isAdmin = false,
  onClose,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'status' | 'typing'>('idle');
  const [error, setError] = useState<string | null>(null);
  /** The question that got no answer, so "Retry" resends it instead of nothing. */
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sessionOrderLabel, setSessionOrderLabel] = useState<string | undefined>(orderLabel);
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = useCallback((m: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    setMessages((prev) => [...prev, { ...m, id: Date.now() + Math.random(), createdAt: new Date().toISOString() } as ChatMessage]);
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Open (or rejoin) a session, then load history. A failed session open is not
  // recoverable in the UI, so it is surfaced plainly rather than silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await aiAstrologer.createSession({ orderId, language });
        if (cancelled) return;
        setSessionId(s.sessionId);
        setSessionOrderLabel(orderLabel || (s.orderNumber ? `Report #${s.orderNumber}` : undefined));
        const h = await aiAstrologer.history(s.sessionId);
        if (cancelled) return;
        setMessages(h.messages);
        if (h.messages.length === 0) {
          // A delivered report gets a welcome that names it; anything else
          // (admins, report-less sessions) gets the general greeting.
          const serviceTitle = s.serviceType ? (SERVICE_TITLE[s.serviceType]?.[language] ?? s.serviceType) : null;
          push({
            role: 'system',
            language,
            content: s.orderNumber && serviceTitle
              ? ORDER_GREETING[language](customerName, serviceTitle, s.orderNumber)
              : GREETING[language](customerName),
          });
        }
        const u = await aiAstrologer.usage();
        if (!cancelled) setRemaining(u.remaining);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the chat.');
      }
    })();
    return () => {
      cancelled = true;
      clearTimers();
    };
    // customerId is the gate subject; a different account must never inherit a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, phase]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || !sessionId || phase !== 'idle') return;

    setInput('');
    setError(null);
    setFailedQuestion(null);
    push({ role: 'customer', language, content: question });
    setPhase('status');

    const startedAt = Date.now();
    // The status line shows for 2-4s, then the dots. Both are cut short by the
    // 12s hard cap so a slow model is never padded.
    const statusFor = TIMING.statusMin + Math.random() * (TIMING.statusMax - TIMING.statusMin);
    timers.current.push(
      window.setTimeout(() => {
        if (Date.now() - startedAt < TIMING.hardCap) setPhase('typing');
      }, statusFor)
    );

    try {
      const reply = await aiAstrologer.ask(sessionId, question, language);
      clearTimers();

      const bubbles = reply.bubbles?.length ? reply.bubbles : [reply.content];
      // Show the bubbles one at a time, but stop waiting as soon as the cap is
      // reached - the remaining bubbles render immediately rather than never.
      bubbles.forEach((b, i) => {
        const delay = Math.min(i * TIMING.bubbleGap, Math.max(0, TIMING.hardCap - (Date.now() - startedAt)));
        timers.current.push(
          window.setTimeout(() => {
            push({
              role: 'assistant',
              language,
              content: b,
              areaId: reply.areaId,
              sources: i === bubbles.length - 1 ? reply.sources : null,
            });
          }, delay)
        );
      });

      timers.current.push(
        window.setTimeout(() => setPhase('idle'), Math.min(bubbles.length * TIMING.bubbleGap, TIMING.hardCap))
      );
      setRemaining(reply.remainingToday);
    } catch (e) {
      clearTimers();
      setFailedQuestion(question);
      const err = e as AiAstrologerError;
      if (err.status === 403) {
        setError(language === 'ta' ? err.messageTa : language === 'hi' ? err.messageHi : err.message);
      } else if (err.status === 429) {
        setError(err.message + (err.retryAfterSeconds ? ` (${err.retryAfterSeconds}s)` : ''));
        setRemaining(0);
      } else if (err.isSetupProblem) {
        // A server setup problem does not fix itself by retrying, so it is
        // named rather than hidden. The wording is the server's own: for an
        // administrator it says what to configure, for a customer it says the
        // assistant is not available yet. Both are more useful than a line
        // that reads as a temporary delay and never resolves.
        setError(err.message);
      } else {
        setError(RETRY_TEXT[language]);
      }
      // Back to idle, always. Leaving the phase at 'failed' disabled the send
      // button and made Enter do nothing, so one bad reply froze the whole
      // panel: every later question was silently dropped and the chat looked
      // permanently dead. The error bar above still offers the explicit retry.
      setPhase('idle');
    }
  };

  /**
   * Resends the question that got no answer. The bubble that never received a
   * reply is removed first, so a retry replaces it rather than asking twice.
   */
  const retry = () => {
    const question = failedQuestion;
    setError(null);
    setFailedQuestion(null);
    if (!question) return;
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'customer') return [...prev.slice(0, i), ...prev.slice(i + 1)];
      }
      return prev;
    });
    void send(question);
  };

  const handoff = async () => {
    if (!sessionId) return;
    try {
      await aiAstrologer.requestHandoff(sessionId, input.trim() || messages[messages.length - 1]?.content || '', language);
      push({
        role: 'system',
        language,
        content: language === 'ta'
          ? 'நன்றி. உங்கள் கேள்வி எங்கள் ஜோதிடருக்கு அனுப்பப்பட்டுள்ளது.'
          : language === 'hi'
            ? 'धन्यवाद। आपका प्रश्न हमारे ज्योतिषी को भेज दिया गया है।'
            : 'Thank you. Your question has been sent to our astrologer.',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that.');
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header - the name is fixed and never replaced by a person's name. */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shrink-0">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Bot className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-tight truncate">ASTRO SIVAM AI Astrologer</div>
          <div className="text-[11px] text-slate-400 truncate">
            {sessionOrderLabel || (isAdmin
              ? 'Administrator access · no daily limit'
              : (remaining !== null ? `${remaining} questions left today` : ' '))}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close chat" className="p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'customer'
                  ? 'bg-amber-500 text-slate-950 rounded-br-md'
                  : m.role === 'system'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs italic'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md'
              }`}
            >
              {m.content}
              {m.sources && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-300/40 text-[11px] opacity-70">{m.sources}</div>
              )}
            </div>
          </div>
        ))}

        {phase === 'status' && (
          <div className="text-xs text-slate-500 dark:text-slate-400 italic">{STATUS[language]}</div>
        )}
        {phase === 'typing' && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={retry}
            className="shrink-0 inline-flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> {language === 'ta' ? 'மீண்டும்' : language === 'hi' ? 'फिर से' : 'Retry'}
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 leading-snug">
        {DISCLAIMER[language]}
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={language === 'ta' ? 'உங்கள் கேள்வியை இங்கே எழுதுங்கள்...' : language === 'hi' ? 'अपना प्रश्न यहाँ लिखें...' : 'Ask about your chart...'}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            onClick={() => void send(input)}
            disabled={phase !== 'idle' || !input.trim() || !sessionId}
            className="p-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handoff}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-amber-600 cursor-pointer"
        >
          <UserRound className="w-3.5 h-3.5" /> {HANDOFF_LABEL[language]}
        </button>
      </div>
    </div>
  );
}
