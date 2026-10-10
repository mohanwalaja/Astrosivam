/**
 * ASTRO SIVAM source-based astrologer — the customer/admin chat panel.
 *
 * GUIDED MODE: customers never type a question. They pick a topic (the eight
 * page-2 life cards, doshas, remedies, order facts, or complaint/help) and
 * then one curated option, which the server answers from the customer's own
 * chart and local rules. The only free text a customer can send is a short
 * detail line on complaint options, which goes to the human team.
 * Administrators keep a test input so they can evaluate the reply path.
 *
 * Part 4 scope: the entry point, customer paid-gate handling and the history.
 * The typing choreography (status text for 2-4s, then three dots, then
 * 2-4 bubbles 1-2s apart, capped at 12s) is tuned in Part 5; the hooks it needs
 * are already here as TIMING constants so the tuning is a numbers change, not a
 * rewrite.
 *
 * Replies come only from ASTRO SIVAM's local chart calculations and curated
 * source-based knowledge base; the panel never claims to be a person.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, RefreshCw, UserRound, X, ChevronLeft } from 'lucide-react';
import {
  aiAstrologer,
  AiAstrologerError,
  type AttachableOrder,
  type ChatLanguage,
  type ChatMessage,
  type GuidedCategory,
  type GuidedQuestion,
} from '../../services/aiAstrologerApi';

/**
 * Timing, in milliseconds. The 12s cap is absolute; local rule matching and
 * chart calculation usually finish well before it.
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
  en: (n) => `Hello ${n} — welcome to ASTRO SIVAM. Pick a topic below and I will answer from your chart using our own astrology rules and references.`,
  ta: (n) => `வணக்கம் ${n} — ASTRO SIVAM-க்கு வரவேற்கிறோம். கீழே ஒரு தலைப்பை தேர்வு செய்யுங்கள்; உங்கள் ஜாதகத்தை வைத்து எங்கள் சொந்த ஜோதிட விதிகளால் பதிலளிக்கிறேன்.`,
  hi: (n) => `नमस्ते ${n} — ASTRO SIVAM में आपका स्वागत है। नीचे कोई विषय चुनें; मैं आपकी कुंडली से हमारे अपने ज्योतिष नियमों द्वारा उत्तर दूँगा।`,
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
 * its order number, and opens the guided topic list.
 */
const ORDER_GREETING: Record<ChatLanguage, (name: string, service: string, orderNo: string) => string> = {
  en: (n, s, o) => `Hello ${n} — your ${s} report (#${o}) has been delivered. Pick a topic below and I will answer from your chart using our own astrology rules and references.`,
  ta: (n, s, o) => `வணக்கம் ${n} — உங்கள் ${s} அறிக்கை (#${o}) அனுப்பப்பட்டுள்ளது. கீழே ஒரு தலைப்பை தேர்வு செய்யுங்கள்; உங்கள் ஜாதகத்தை வைத்து எங்கள் சொந்த ஜோதிட விதிகளால் பதிலளிக்கிறேன்.`,
  hi: (n, s, o) => `नमस्ते ${n} — आपकी ${s} रिपोर्ट (#${o}) भेज दी गई है। नीचे कोई विषय चुनें; मैं आपकी कुंडली से हमारे अपने ज्योतिष नियमों द्वारा उत्तर दूँगा।`,
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

const MENU_TITLE: Record<ChatLanguage, string> = {
  en: 'Choose a topic',
  ta: 'ஒரு தலைப்பை தேர்வு செய்யவும்',
  hi: 'एक विषय चुनें',
};

const ALL_TOPICS: Record<ChatLanguage, string> = {
  en: 'All topics',
  ta: 'அனைத்து தலைப்புகள்',
  hi: 'सभी विषय',
};

const DETAILS_PLACEHOLDER: Record<ChatLanguage, string> = {
  en: 'Add a short detail for our team (optional)...',
  ta: 'எங்கள் குழுவுக்கு சிறு விவரம் சேர்க்கவும் (விருப்பம்)...',
  hi: 'हमारी टीम के लिए संक्षिप्त विवरण जोड़ें (वैकल्पिक)...',
};

const DETAILS_SEND: Record<ChatLanguage, string> = {
  en: 'Send to our team',
  ta: 'குழுவுக்கு அனுப்பவும்',
  hi: 'टीम को भेजें',
};

const CANCEL_TEXT: Record<ChatLanguage, string> = {
  en: 'Cancel',
  ta: 'ரத்து',
  hi: 'रद्द करें',
};

const MENU_LOADING: Record<ChatLanguage, string> = {
  en: 'Loading the question list...',
  ta: 'கேள்விப் பட்டியல் ஏறுகிறது...',
  hi: 'प्रश्न-सूची लोड हो रही है...',
};

const REPORT_LABEL: Record<ChatLanguage, string> = {
  en: 'Report',
  ta: 'அறிக்கை',
  hi: 'रिपोर्ट',
};

const NO_REPORT: Record<ChatLanguage, string> = {
  en: 'No report attached',
  ta: 'அறிக்கை இணைக்கப்படவில்லை',
  hi: 'कोई रिपोर्ट नहीं जुड़ी',
};

/** Shown after the customer moves the chat to one of their own reports. */
const ATTACHED_NOTE: Record<ChatLanguage, (title: string) => string> = {
  en: (t) => `Now reading your ${t} report.`,
  ta: (t) => `இப்போது உங்கள் ${t} அறிக்கையைப் படிக்கிறேன்.`,
  hi: (t) => `अब मैं आपकी ${t} रिपोर्ट पढ़ रहा हूँ।`,
};

const BIND_FAILED: Record<ChatLanguage, string> = {
  en: 'That report could not be attached to this conversation.',
  ta: 'அந்த அறிக்கையை இந்த உரையாடலுடன் இணைக்க முடியவில்லை.',
  hi: 'वह रिपोर्ट इस बातचीत से नहीं जोड़ी जा सकी।',
};

const MENU_FAILED: Record<ChatLanguage, string> = {
  en: 'The question list is not available right now. Please close and reopen the chat.',
  ta: 'கேள்விப் பட்டியல் இப்போது இல்லை. உரையாடலை மூடி மீண்டும் திறக்கவும்.',
  hi: 'प्रश्न-सूची अभी उपलब्ध नहीं है। कृपया चैट बंद करके फिर खोलें।',
};

const ADMIN_TEST_LABEL: Record<ChatLanguage, string> = {
  en: 'Admin test input (customers never see this)',
  ta: 'நிர்வாகி சோதனை உள்ளீடு (வாடிக்கையாளர்கள் பார்க்க மாட்டார்கள்)',
  hi: 'एडमिन परीक्षण इनपुट (ग्राहक इसे कभी नहीं देखते)',
};

const ADMIN_TEST_PLACEHOLDER: Record<ChatLanguage, string> = {
  en: 'Type a test question...',
  ta: 'சோதனை கேள்வியை எழுதவும்...',
  hi: 'परीक्षण प्रश्न लिखें...',
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

/** Routing for the next send: a curated option id, or nothing for admin free text. */
interface PendingAsk {
  questionId: string | null;
  complaintDetails: string;
}

const EMPTY_ASK: PendingAsk = { questionId: null, complaintDetails: '' };

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
  /** Guided menu state: the topic list, the open topic, and an option awaiting details. */
  const [categories, setCategories] = useState<GuidedCategory[] | null>(null);
  const [menuFailed, setMenuFailed] = useState(false);
  /**
   * The customer's own delivered reports, and the one this conversation is
   * reading. The floating launcher opens with no report attached, so the
   * Wedding Matching / Baby Naming / Subha Muhurtham chapters need a way to
   * attach one here.
   */
  const [orders, setOrders] = useState<AttachableOrder[]>([]);
  const [boundOrderNumber, setBoundOrderNumber] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pendingOption, setPendingOption] = useState<GuidedQuestion | null>(null);
  const pendingAsk = useRef<PendingAsk>(EMPTY_ASK);
  const failedAsk = useRef<PendingAsk | null>(null);
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = useCallback((m: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    setMessages((prev) => [...prev, { ...m, id: Date.now() + Math.random(), createdAt: new Date().toISOString() } as ChatMessage]);
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Open (or rejoin) a session, then load history and the guided menu. A
  // failed session open is not recoverable in the UI, so it is surfaced
  // plainly rather than silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await aiAstrologer.createSession({ orderId, language });
        if (cancelled) return;
        setSessionId(s.sessionId);
        setBoundOrderNumber(s.orderNumber ?? null);
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
        try {
          const menu = await aiAstrologer.options(language);
          if (cancelled) return;
          setCategories(menu.categories);
          setOrders(menu.orders ?? []);
        } catch {
          if (!cancelled) setMenuFailed(true);
        }
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
    const ask = pendingAsk.current;
    if (!question || !sessionId || phase !== 'idle') return;
    // Customers always send a curated option; only admins may send free text.
    if (!ask.questionId && !isAdmin) return;

    setInput('');
    setError(null);
    setFailedQuestion(null);
    failedAsk.current = null;
    push({ role: 'customer', language, content: question });
    setPhase('status');

    const startedAt = Date.now();
    // The status line shows for 2-4s, then the dots. Both are cut short by the
    // 12s hard cap so local chart/source work is never padded.
    const statusFor = TIMING.statusMin + Math.random() * (TIMING.statusMax - TIMING.statusMin);
    timers.current.push(
      window.setTimeout(() => {
        if (Date.now() - startedAt < TIMING.hardCap) setPhase('typing');
      }, statusFor)
    );

    try {
      const reply = await aiAstrologer.ask(
        sessionId,
        ask.questionId
          ? { questionId: ask.questionId, ...(ask.complaintDetails ? { complaintDetails: ask.complaintDetails } : {}) }
          : { question },
        language,
      );
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
      failedAsk.current = ask;
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
    pendingAsk.current = failedAsk.current ?? EMPTY_ASK;
    failedAsk.current = null;
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

  /**
   * Moves the conversation onto one of the customer's own delivered reports
   * (or off it, with an empty orderNumber). The server re-checks that the
   * report belongs to this account before the chat will read from it.
   */
  const attachReport = async (orderNumber: string) => {
    if (!sessionId || binding) return;
    setBinding(true);
    setError(null);
    try {
      const res = await aiAstrologer.bind(sessionId, orderNumber);
      setBoundOrderNumber(res.orderNumber);
      setSessionOrderLabel(res.orderNumber ? `Report #${res.orderNumber}` : undefined);
      push({
        role: 'system',
        language,
        content: res.serviceTitle ? ATTACHED_NOTE[language](res.serviceTitle) : NO_REPORT[language],
      });
    } catch {
      setError(BIND_FAILED[language]);
    } finally {
      setBinding(false);
    }
  };

  /** A menu option was tapped: options that need details open the detail box, the rest send at once. */
  const tapOption = (option: GuidedQuestion) => {
    if (phase !== 'idle' || !sessionId) return;
    if (option.needsDetails) {
      setPendingOption(option);
      setInput('');
      setError(null);
      return;
    }
    pendingAsk.current = { questionId: option.id, complaintDetails: '' };
    void send(option.text);
  };

  /** Sends a complaint/support option together with its optional detail line. */
  const sendPendingOption = () => {
    if (!pendingOption || phase !== 'idle' || !sessionId) return;
    const details = input.trim();
    pendingAsk.current = { questionId: pendingOption.id, complaintDetails: details };
    const display = details ? `${pendingOption.text}\n${details}` : pendingOption.text;
    setPendingOption(null);
    void send(display);
  };

  /** Admin-only free-text test question. Customers never see this box. */
  const sendAdminTest = () => {
    if (!isAdmin || phase !== 'idle' || !sessionId || !input.trim()) return;
    pendingAsk.current = EMPTY_ASK;
    void send(input);
  };

  const openCategory = activeCategory ? (categories ?? []).find((c) => c.id === activeCategory) ?? null : null;
  const menuBusy = phase !== 'idle' || !sessionId;

  return (
    <div className="flex flex-col h-[600px] max-h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header - the name is fixed and never replaced by a person's name. */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shrink-0">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Bot className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-tight truncate">ASTRO SIVAM Astrologer</div>
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

      {/* Guided menu: topics, then the options of the open topic. Customers
          never get a free question box; complaint options get one short
          detail line for the human team. */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0 max-h-[38%] overflow-y-auto">
        {/* The report this conversation is reading. The service chapters
            (Wedding Matching, Baby Naming, Subha Muhurtham) are answered from
            the attached report, and the floating launcher starts with none. */}
        {orders.length > 0 && (
          <div className="flex items-center gap-2 pb-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {REPORT_LABEL[language]}
            </span>
            <select
              value={boundOrderNumber ?? ''}
              onChange={(e) => void attachReport(e.target.value)}
              disabled={binding || menuBusy}
              aria-label={REPORT_LABEL[language]}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-40"
            >
              <option value="">{NO_REPORT[language]}</option>
              {orders.map((o) => (
                <option key={o.orderNumber} value={o.orderNumber}>
                  {o.title} · #{o.orderNumber}
                </option>
              ))}
            </select>
          </div>
        )}
        {pendingOption ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
              {pendingOption.text}
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={DETAILS_PLACEHOLDER[language]}
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={sendPendingOption}
                disabled={menuBusy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" /> {DETAILS_SEND[language]}
              </button>
              <button
                onClick={() => { setPendingOption(null); setInput(''); }}
                disabled={menuBusy}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                {CANCEL_TEXT[language]}
              </button>
            </div>
          </div>
        ) : openCategory ? (
          <div className="space-y-2">
            <button
              onClick={() => setActiveCategory(null)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-amber-600 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {ALL_TOPICS[language]}
            </button>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {openCategory.icon} {openCategory.title}
            </div>
            <div className="space-y-1.5">
              {openCategory.questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => tapOption(q)}
                  disabled={menuBusy}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[13px] font-medium text-slate-800 dark:text-slate-100 hover:border-amber-500/60 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-40 cursor-pointer"
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        ) : categories ? (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {MENU_TITLE[language]}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  disabled={menuBusy}
                  title={c.hint}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-500/60 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-40 cursor-pointer"
                >
                  <span className="text-xl leading-none">{c.icon}</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight text-center">
                    {c.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : menuFailed ? (
          <div className="text-xs text-rose-600 dark:text-rose-300 text-center py-2">{MENU_FAILED[language]}</div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-2">{MENU_LOADING[language]}</div>
        )}

        {isAdmin && !pendingOption && (
          <div className="mt-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {ADMIN_TEST_LABEL[language]}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAdminTest();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={ADMIN_TEST_PLACEHOLDER[language]}
                className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <button
                onClick={sendAdminTest}
                disabled={menuBusy || !input.trim() || !sessionId}
                className="p-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
