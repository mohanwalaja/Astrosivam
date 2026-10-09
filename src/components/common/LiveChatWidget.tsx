import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Minus,
  Send,
  RotateCcw,
  ChevronRight,
  Headphones,
  CheckCircle2,
  ExternalLink,
  Phone,
  Mail
} from 'lucide-react';
import logoImg from '../../assets/astrosivam_appicon.png';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  options?: { label: string; action: string }[];
  actionLink?: { label: string; url: string; external?: boolean };
}

export const LiveChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const getInitialMessages = (): ChatMessage[] => [
    {
      id: 'msg_welcome',
      sender: 'bot',
      text: 'Namaste! 🙏 Welcome to **ASTRO SIVAM Customer Support**.\n\nHow can we help you today with your horoscope reports, Subha Muhurtham dates, or order status?',
      timestamp: 'Just now',
      options: [
        { label: '📅 Subha Muhurtham (6-Month Auspicious Dates)', action: 'info_muhurtham' },
        { label: '🌟 How Muhurtham Calculation Works', action: 'info_how_muhurtham' },
        { label: '🏛️ View 18 Vedic Ceremonies Supported', action: 'info_ceremonies' },
        { label: '📝 Required Details to Order Muhurtham', action: 'info_muhurtham_reqs' },
        { label: '📦 Track My Order / Report Status', action: 'track_order' },
        { label: '🔮 Birth Horoscope (Janma Kundali)', action: 'info_horoscope' },
        { label: '💍 Marriage Compatibility Matching', action: 'info_marriage' },
        { label: '👶 Baby Naming (Namakaran)', action: 'info_baby' },
        { label: '💳 Pricing & Payment Options', action: 'info_payment' },
        { label: '✉️ Send Message to Priest / Admin', action: 'send_admin_message' }
      ]
    }
  ];

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('astrosivam_support_chat_v3');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return getInitialMessages();
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  useEffect(() => {
    try {
      localStorage.setItem('astrosivam_support_chat_v3', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  useEffect(() => {
    const handleOpen = () => handleOpenChat();
    window.addEventListener('app:open-live-chat', handleOpen);
    return () => window.removeEventListener('app:open-live-chat', handleOpen);
  }, []);

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleOpenChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCloseChat = () => {
    setIsOpen(false);
  };

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleClearChat = () => {
    setMessages(getInitialMessages());
  };

  const processQuery = (rawText: string = '') => {
    const query = (rawText || '').toLowerCase().trim();
    setIsTyping(true);

    setTimeout(() => {
      let botText = '';
      let botOptions: { label: string; action: string }[] = [];
      let botLink: { label: string; url: string; external?: boolean } | undefined;

      // 1. Required details to order Subha Muhurtham
      if (
        query.includes('detail') && (query.includes('need') || query.includes('order') || query.includes('require') || query.includes('fill') || query.includes('form')) ||
        query.includes('what is needed') ||
        query.includes('how to order muhurtham') ||
        query.includes('muhurtham requirement')
      ) {
        botText = `### 📋 What Details Are Needed on the Subha Muhurtham Page:

To generate your personalized **6-Month Subha Muhurtham Report**, you simply provide:

1. **User Details (or Bride/Groom/Family Head)**:
   • **Full Name**: Name of the primary person(s) for the ceremony.
   • **Date of Birth & Time of Birth (with AM/PM)**: Used to calculate Janma Nakshatra (birth star) and Rasi (moon sign).
   • **Birth Place**: City/town of birth for exact astronomical planetary longitude calculations.

2. **Event & Function Details**:
   • **Ceremony Type**: Choose from 18 Vedic events (Vivaham, Griha Pravesam, Bhoomi Pooja, Vahana Pooja, Business Opening, etc.).
   • **Target Function Month**: Select your ideal target month. The engine computes a **6-month matrix** (2 months before, target month, and 3 months after).
   • **Function / Event Location**: City or venue coordinates to compute precise local sunrise, Nalla Neram, Rahu Kalam, and Yamagandam windows.
   • **Report Language**: Choose **English**, **Tamil (தமிழ்)**, or **Hindi (हिंदी)**.

3. **Priest Team Review & PDF Delivery**:
   • Prepared daily by our **India Priest Team (9:00 AM – 11:00 AM IST)**.
   • Official 2-Page PDF Report + Tax Invoice are emailed directly upon admin approval.`;
        botOptions = [
          { label: '🗓️ Go to Subha Muhurtham Page', action: 'create_muhurtham' },
          { label: '🌟 How Calculation Works', action: 'info_how_muhurtham' },
          { label: '🏛️ View 18 Supported Ceremonies', action: 'info_ceremonies' },
          { label: '💳 View Pricing & Sample Report', action: 'go_services' }
        ];
      }

      // 2. How Muhurtham Works / Astronomical Calculation Details
      else if (
        query.includes('how muhurtham') ||
        query.includes('how it work') ||
        query.includes('how does muhurtham work') ||
        query.includes('how its work') ||
        query.includes('how it\'s work') ||
        query.includes('muhurtham calculation') ||
        query.includes('muhurtham rules') ||
        query.includes('muhurta method') ||
        query.includes('tara balam') ||
        query.includes('chandrashtama') ||
        query.includes('panchanga shuddhi')
      ) {
        botText = `### 🌟 How Subha Muhurtham Calculation Works:

Our **Vedic Muhurtham Engine** performs an exhaustive astronomical scan across **6 consecutive months** (the 2 months before, your target month, and 3 months after):

1. **Panchanga Shuddhi (5 Sacred Pillars)**:
   • **Tithi**: Filters out Rikta tithis (Chaturthi 4th, Navami 9th, Chaturdashi 14th) and Amavasya.
   • **Vara**: Checks weekday planetary lord harmony for the specific ritual.
   • **Nakshatra**: Verifies star compatibility with the ceremony.
   • **Yoga & Karana**: Strictly eliminates malefic yogas (*Vaidhriti, Vyatipata*) and *Vishti (Bhadra)* karanas.
   • **Lagna Shuddhi**: Pinpoints auspicious ascendant windows with benefics in Kendra/Trikona.

2. **Personalised Star Alignment (Tara Balam & Chandrashtama)**:
   • **Tara Balam (9 Sectors)**: Computes Janma, Sampat, Vipat, Kshema, Pratyak, Sadhana, Naidhana, Mitra & Paramamitra for your birth star.
   • **Chandrashtama Avoidance**: Eliminates days when the transit Moon traverses the 8th house from your Janma Rasi.

3. **Inauspicious Period Elimination**:
   • Cuts out **Rahu Kalam**, **Yamagandam**, and **Gulika Kalam** using exact local sunrise and GPS coordinates of your function venue.
   • Applies seasonal & planetary filters (e.g. Aadi, Purattasi, Margazhi, Shukra/Guru Moudhya).

4. **2-Page Certified PDF Report**:
   • **Page 1**: 6-Month Auspicious Calendar overview, BEST & GOOD rated dates, and exact Nalla Neram ceremony windows.
   • **Page 2**: *Why These Dates Were Selected* ceremonial guide and traditional rule explanations.
   • Prepared daily by our **India Priest Team (9:00 AM – 11:00 AM IST)** and emailed with official Tax Invoice upon admin approval.`;
        botOptions = [
          { label: '🗓️ Open Subha Muhurtham Page', action: 'create_muhurtham' },
          { label: '📜 View 18 Ceremony Types', action: 'info_ceremonies' },
          { label: '📝 Required Details to Order', action: 'info_muhurtham_reqs' },
          { label: '📦 Track My Existing Order', action: 'track_order' }
        ];
      }

      // 3. Supported Ceremonies & Rituals
      else if (
        query.includes('ceremon') ||
        query.includes('events') ||
        query.includes('vivaha') ||
        query.includes('griha') ||
        query.includes('house warming') ||
        query.includes('housewarming') ||
        query.includes('bhoomi') ||
        query.includes('vahana') ||
        query.includes('vehicle') ||
        query.includes('shop') ||
        query.includes('opening') ||
        query.includes('business') ||
        query.includes('upanayanam') ||
        query.includes('seemantham')
      ) {
        botText = `### 🏛️ 18 Vedic Ceremonies Supported on Muhurtham Page:

1. **Vivaham** (Wedding / Marriage)
2. **Nishtheka** (Engagement / Ring Exchange)
3. **Griha Pravesam** (Housewarming)
4. **House Purchase** (Dhanpravesha - House)
5. **House Construction / Bhoomi Pooja** (Foundation Stone)
6. **Land / Plot Purchase** (Bhoomi Labha)
7. **Shifting / Home Relocation**
8. **Business / Shop Opening** (Vyapararambha)
9. **New Job / Career Joining** (Udyoga)
10. **Gold / Jewel Purchase** (Swarna Dhanpravesha)
11. **Vehicle Purchase / Vahana Pooja** (New Car/Bike)
12. **Education Start / Vidyarambham** (Aksharabhyasam)
13. **Baby Naming / Namakaranam**
14. **First Solid Food / Annaprashana**
15. **Seemantham / Pumsavana** (Baby Shower Blessing)
16. **Sacred Thread / Upanayanam**
17. **Ear Piercing / Karnavedha**
18. **First Hair Tonsure / Mundan / Chaulam**

Each ceremony includes a **customized 6-month auspicious date calendar** with exact localized Nalla Neram windows!`;
        botOptions = [
          { label: '✨ Select Ceremony & Find Dates', action: 'create_muhurtham' },
          { label: '📖 How Muhurtham Works', action: 'info_how_muhurtham' },
          { label: '📝 Details Needed on Form', action: 'info_muhurtham_reqs' },
          { label: '💳 View Pricing & Sample PDF', action: 'go_services' }
        ];
      }

      // 4. Subha Muhurtham Page & General Muhurtham Queries
      else if (
        query.includes('muhurtham') ||
        query.includes('muhoortham') ||
        query.includes('muhurta') ||
        query.includes('subha') ||
        query.includes('auspicious date') ||
        query.includes('good date') ||
        query.includes('nalla neram') ||
        query.includes('wedding date') ||
        query.includes('grihapravesam') ||
        query.includes('panchangam')
      ) {
        botText = `### 📅 Subha Muhurtham Page Details & Features:

Our **Subha Muhurtham (சுப முகூர்த்தம் / शुभ मुहूर्त)** page helps you find the most auspicious astronomical dates and timings for life's important milestones:

• **6-Month Auspicious Calendar Matrix**: Comprehensive scan covering 6 consecutive months (2 months prior, selected month, and 3 months ahead).
• **18 Vedic Ceremonies Supported**: Custom rules for Weddings, Housewarmings, Bhoomi Pooja, Vehicle Purchases, Business Openings, Upanayanam, Baby Naming, and more.
• **Exact Nalla Neram & Timings**: Localized sunrise/sunset with exact ritual start and end windows computed for your specific function city.
• **Panchanga & Star Compatibility**: Checks all 5 pillars of Panchangam, Tara Balam for your Janma Nakshatra, and eliminates Chandrashtama days.
• **Inauspicious Period Elimination**: Eliminates Rahu Kalam, Yamagandam, Gulika Kalam, and solar restrictions (Aadi, Purattasi, Margazhi, Shukra/Guru Moudhya).
• **2-Page Certified PDF Report**: Page 1 calendar and timings + Page 2 ceremonial explanatory guide in English, Tamil, or Hindi.
• **Priest Team Preparation & Admin Approval**: Prepared daily by our India-based Vedic priest team (9:00 AM – 11:00 AM IST) and emailed with an official Tax Invoice upon admin approval.`;
        botOptions = [
          { label: '🗓️ Go to Subha Muhurtham Page', action: 'create_muhurtham' },
          { label: '🌟 How Calculation Works', action: 'info_how_muhurtham' },
          { label: '🏛️ View 18 Ceremony Types', action: 'info_ceremonies' },
          { label: '📝 Required Details to Order', action: 'info_muhurtham_reqs' },
          { label: '💳 View Pricing & Sample PDF', action: 'go_services' }
        ];
      }

      // 5. Order Tracking & Delivery
      else if (
        query.includes('track') ||
        query.includes('status') ||
        query.includes('order') ||
        query.includes('delivery')
      ) {
        botText = 'To track your horoscope or Muhurtham order:\n\n1. Go to the **Customer Dashboard** or click below.\n2. Enter your Order ID (e.g. `AF-2026-XXXX`) or registered email.\n3. The dashboard shows real-time delivery status. Our India-based priest team prepares reports daily between 9:00 AM – 11:00 AM IST, and verified PDF reports are sent directly to your registered email upon admin approval.';
        botOptions = [
          { label: 'Go to Customer Dashboard', action: 'go_dashboard' },
          { label: 'Send Direct Message to Admin', action: 'send_admin_message' }
        ];
      }

      // 6. Birth Horoscope / Jathagam
      else if (query.includes('horoscope') || query.includes('jathagam') || query.includes('birth')) {
        botText = 'Our **Janma Jathagam (Birth Horoscope)** includes:\n• Precise Lahiri Ayanamsa Planetary Positions\n• Rasi & Navamsa (D-9) Charts\n• 120-Year Vimshottari Mahadasha & Antardasha Table\n• Mars / Kuja Dosha, Rahu-Ketu, & Kalasarpa Analysis\n• 5-Year Yearly Predictions & Temple Remedies';
        botOptions = [
          { label: 'Create Birth Horoscope Now', action: 'create_horoscope' },
          { label: '📅 Subha Muhurtham Dates', action: 'info_muhurtham' },
          { label: 'Track Existing Order', action: 'track_order' }
        ];
      }

      // 7. Marriage Compatibility
      else if (query.includes('marriage') || query.includes('porutham') || query.includes('match')) {
        botText = 'Our **10-Poruthams Marriage Matching** calculates:\n• All 10 Vedic Poruthams (Dina, Gana, Mahendra, Yoni, Rajju, Vedha, etc.)\n• Papa Samyam (Malefic dosha balance)\n• Dasa Sandhi & Sevvai Dosha cancellation\n• Detailed Priest Compatibility Verdict & Advice with clear Green/Red verdict';
        botOptions = [
          { label: 'Check Marriage Matching', action: 'create_matching' },
          { label: '📅 Find Auspicious Wedding Dates', action: 'info_muhurtham' },
          { label: 'Send Inquiry to Admin', action: 'send_admin_message' }
        ];
      }

      // 8. Baby Naming
      else if (query.includes('baby') || query.includes('name') || query.includes('namakaran')) {
        botText = 'Our **Baby Naming (Namakaran)** service provides:\n• Auspicious first syllables matching Nakshatra Pada\n• Curated traditional Tamil and Sanskrit names with meanings\n• Numerology & planetary strength alignment';
        botOptions = [
          { label: 'Generate Baby Names', action: 'create_baby' },
          { label: '📅 Namakaranam Muhurtham Dates', action: 'info_muhurtham' },
          { label: 'Contact Astrologer', action: 'send_admin_message' }
        ];
      }

      // 9. Pricing & Payment
      else if (query.includes('price') || query.includes('payment') || query.includes('cost') || query.includes('upi') || query.includes('fee')) {
        botText = 'We accept all major payment modes including **Fiji M-PAiSA (FJ$10)**, **India GPay / PhonePe / UPI (₹499)**, and **International PayPal / Credit Card (US$5)**. Free beta reports require no payment when enabled.';
        botOptions = [
          { label: 'View Pricing & Services', action: 'go_services' },
          { label: '📅 Subha Muhurtham Page', action: 'create_muhurtham' },
          { label: 'Track Existing Order', action: 'track_order' }
        ];
      }

      // Default Fallback
      else {
        botText = `Thank you for your message regarding "${rawText}".\n\nOur customer support and Vedic priests are available to assist you. You can explore our Subha Muhurtham auspicious dates engine, track existing orders, or learn about our Vedic calculation methods.`;
        botOptions = [
          { label: '📅 Subha Muhurtham (Auspicious Dates)', action: 'info_muhurtham' },
          { label: '🌟 How Muhurtham Works', action: 'info_how_muhurtham' },
          { label: '🏛️ 18 Vedic Ceremonies', action: 'info_ceremonies' },
          { label: '📦 Track My Order', action: 'track_order' },
          { label: '✉️ Send Message to Admin', action: 'send_admin_message' }
        ];
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: botText,
          timestamp: getTimeString(),
          options: botOptions,
          actionLink: botLink
        }
      ]);
      setIsTyping(false);
      if (!isOpen || isMinimized) {
        setUnreadCount((c) => c + 1);
      }
    }, 400);
  };

  const navigateTo = (route: string) => {
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: route }));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('route', route);
      window.history.pushState({}, '', url.toString());
    } catch (e) {}
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'track_order':
        processQuery('track my order status');
        break;
      case 'info_horoscope':
        processQuery('birth horoscope details');
        break;
      case 'info_marriage':
        processQuery('marriage compatibility details');
        break;
      case 'info_baby':
        processQuery('baby naming details');
        break;
      case 'info_muhurtham':
        processQuery('subha muhurtham auspicious dates details');
        break;
      case 'info_how_muhurtham':
        processQuery('how does muhurtham work');
        break;
      case 'info_ceremonies':
        processQuery('ceremonies supported in muhurtham');
        break;
      case 'info_muhurtham_reqs':
        processQuery('what details are needed to order muhurtham');
        break;
      case 'info_payment':
        processQuery('payment and delivery options');
        break;
      case 'go_dashboard':
        navigateTo('dashboard');
        break;
      case 'send_admin_message':
        navigateTo('contact');
        break;
      case 'create_horoscope':
        navigateTo('birth-jathagam');
        break;
      case 'create_matching':
        navigateTo('marriage-compatibility');
        break;
      case 'create_baby':
        navigateTo('baby-naming');
        break;
      case 'create_muhurtham':
        navigateTo('muhurtham');
        break;
      case 'go_services':
        navigateTo('services');
        break;
      default:
        break;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: getTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    processQuery(userText);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-none select-none">
      
      {/* Live Chat Window */}
      {isOpen && (
        <div
          id="astrosivam-live-chat-panel"
          className={`pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 w-[94vw] sm:w-[380px] ${
            isMinimized ? 'h-14 mb-3' : 'h-[520px] max-h-[82vh] mb-3'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 px-4 py-3 text-white flex items-center justify-between border-b border-amber-500/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/60 bg-black flex items-center justify-center p-0.5 shadow-md">
                  <img
                    src={logoImg}
                    alt="ASTRO SIVAM"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse"></span>
              </div>
              <div>
                <div className="font-bold text-sm text-white flex items-center gap-1.5 leading-tight">
                  <span>ASTRO SIVAM Support</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                    ONLINE
                  </span>
                </div>
                <div className="text-[10.5px] text-amber-300/80 leading-tight mt-0.5">
                  Order Help & Astrology Inquiries
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                title="Reset conversation"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleToggleMinimize}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCloseChat}
                title="Close Chat"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          {!isMinimized && (
            <>
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3 shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none space-y-2'
                      }`}
                    >
                      <div className="whitespace-pre-line leading-relaxed text-[12px] sm:text-[12.5px]">
                        {msg.text}
                      </div>

                      {/* Interactive Option Chips */}
                      {msg.options && msg.options.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1">
                          {msg.options.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleAction(opt.action)}
                              className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/80 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors flex items-center gap-1"
                            >
                              <span>{opt.label}</span>
                              <ChevronRight className="w-3 h-3 text-amber-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[9.5px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic py-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Support agent is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your question or order ID..."
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold shadow transition-transform active:scale-95"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating Action Button (Launcher) */}
      <div className="pointer-events-auto flex items-center gap-3">
        {!isOpen && (
          <div
            onClick={handleOpenChat}
            className="cursor-pointer hidden sm:flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-amber-500/30 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-semibold hover:border-amber-400 transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>💬 Live Support & Order Help</span>
          </div>
        )}

        <button
          id="astrosivam-live-chat-launcher"
          type="button"
          onClick={isOpen ? handleCloseChat : handleOpenChat}
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group"
          aria-label="Open Live Chat"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-slate-950" />
          ) : (
            <>
              <MessageSquare className="w-6 h-6 text-slate-950 group-hover:rotate-6 transition-transform" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-rose-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>

    </div>
  );
};
