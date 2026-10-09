/**
 * ASTRO SIVAM AI Astrologer — the customer-facing chat panel.
 *
 * Part 4 scope: the entry point, the paid-gate handling, the history and the
 * upload. The typing choreography (status text for 2-4s, then three dots, then
 * 2-4 bubbles 1-2s apart, capped at 12s) is tuned in Part 5; the hooks it needs
 * are already here as TIMING constants so the tuning is a numbers change, not a
 * rewrite.
 *
 * The header always says "ASTRO SIVAM AI Astrologer" and the panel never claims
 * to be a person - both are hard requirements.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, Paperclip, RefreshCw, UserRound, X } from 'lucide-react';
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
  en: (n) => `Hello ${n} — I am the ASTRO SIVAM AI Astrologer. Ask me anything about your chart, or upload the report we prepared for you and I will explain any part of it.`,
  ta: (n) => `வணக்கம் ${n} — நான் ASTRO SIVAM AI ஜோதிடர். உங்கள் ஜாதகத்தை பற்றி எதுவும் கேளுங்கள், அல்லது நாங்கள் தயாரித்த அறிக்கையை இணையுங்கள்; அதன் எந்த பகுதியையும் விளக்குகிறேன்.`,
  hi: (n) => `नमस्ते ${n} — मैं ASTRO SIVAM AI ज्योतिषी हूँ। अपनी कुंडली के बारे में कुछ भी पूछें, या हमारी बनाई रिपोर्ट जोड़ें और मैं उसका हर हिस्सा समझाऊँगा।`,
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
  onClose?: () => void;
}

export default function AiAstrologerPanel({
  customerId,
  customerName,
  language,
  orderId,
  orderLabel,
  onClose,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'status' | 'typing' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
        const h = await aiAstrologer.history(s.sessionId);
        if (cancelled) return;
        setMessages(h.messages);
        if (h.messages.length === 0) {
          push({ role: 'system', language, content: GREETING[language](customerName) });
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
      setPhase('failed');
      const err = e as AiAstrologerError;
      if (err.status === 403) {
        setError(language === 'ta' ? err.messageTa : language === 'hi' ? err.messageHi : err.message);
      } else if (err.status === 429) {
        setError(err.message + (err.retryAfterSeconds ? ` (${err.retryAfterSeconds}s)` : ''));
        setRemaining(0);
      } else {
        setError(RETRY_TEXT[language]);
      }
    }
  };

  const onUpload = async (file: File) => {
    if (!sessionId) return;
    setUploading(true);
    setError(null);
    try {
      const r = await aiAstrologer.uploadReport(sessionId, file);
      push({
        role: 'system',
        language,
        content: language === 'ta'
          ? `அறிக்கை இணைக்கப்பட்டது (#${r.orderNumber}). எந்த பகுதியை விளக்க வேண்டும்?`
          : language === 'hi'
            ? `रिपोर्ट जुड़ गई (#${r.orderNumber})। कौन सा हिस्सा समझाऊँ?`
            : `Report attached (#${r.orderNumber}). Which part would you like me to explain?`,
      });
    } catch (e) {
      const err = e as AiAstrologerError;
      const localized = language === 'ta' ? err.messageTa : language === 'hi' ? err.messageHi : null;
      push({ role: 'system', language, content: localized || err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
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
            {orderLabel || (remaining !== null ? `${remaining} questions left today` : ' ')}
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
            onClick={() => { setError(null); setPhase('idle'); }}
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
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !sessionId}
            title="Upload your ASTRO SIVAM report"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>
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
