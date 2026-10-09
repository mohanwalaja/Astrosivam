import React from 'react';
import { Compass, Home, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { SEO } from '../components/common/SEO';

interface NotFoundPageProps {
  onNavigate: (route: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  const { language } = useLanguage();
  const isTa = language === 'ta';
  const isHi = language === 'hi';

  const t = {
    badge: isTa ? '404 பிழை' : isHi ? '404 त्रुटि' : '404 Celestial Coordinates Not Found',
    title: isTa ? 'பக்கம் கிடைக்கவில்லை' : isHi ? 'पृष्ठ नहीं मिला' : 'Page Not Found',
    subtitle: isTa
      ? 'நீங்கள் தேடும் வானியல் பக்கம் அல்லது தொடர்பு தளம் தற்போது கிடைக்கவில்லை அல்லது வேறு இடத்திற்கு மாற்றப்பட்டிருக்கலாம்.'
      : isHi
      ? 'आप जिस पृष्ठ की तलाश कर रहे हैं वह उपलब्ध नहीं है अथवा स्थानांतरित कर दिया गया है।'
      : 'The sacred page or celestial chart you are looking for does not exist, may have been moved, or the URL contains a typo.',
    returnHome: isTa ? 'முகப்புக்குத் திரும்பு' : isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Return to Home',
    exploreServices: isTa ? 'எங்கள் சேவைகளைப் பார்க்கவும்' : isHi ? 'हमारी सेवाएं देखें' : 'Explore Vedic Services',
    servicesTitle: isTa ? 'பிரபலமான வேத சேவைகள்:' : isHi ? 'लोकप्रिय वैदिक सेवाएं:' : 'Explore Authentic Vedic Services:',
    services: [
      {
        id: 'birth-jathagam',
        title: isTa ? 'பிறந்த ஜாதகம்' : isHi ? 'जन्म कुंडली (जातक)' : 'Birth Jathagam (Horoscope)',
        desc: isTa ? 'லக்னம், நவாம்சம் & தசா புக்தி பலன்கள்' : isHi ? 'लग्न, नवांश एवं दशा फल' : 'Complete Birth Chart & Dasha Predictions',
      },
      {
        id: 'marriage-compatibility',
        title: isTa ? 'திருமணப் பொருத்தம்' : isHi ? 'विवाह मिलान (गुण मिलान)' : 'Marriage Compatibility',
        desc: isTa ? '10 பொருத்தங்கள் & ரஜ்ஜு பொருத்தம்' : isHi ? '10 कूट मिलान एवं रज्जु विचार' : 'Authentic 10-Porutham & Kuta Assessment',
      },
      {
        id: 'baby-naming',
        title: isTa ? 'குழந்தை பெயர் சூட்டுதல்' : isHi ? 'शिशु नामकरण संस्कार' : 'Baby Naming (Namakaran)',
        desc: isTa ? 'சுப துவக்க அக்ஷரங்கள் & வேத குணங்கள்' : isHi ? 'शुभ नामाक्षर एवं गुण' : 'Sacred Pada Syllables & Virtues',
      },
      {
        id: 'muhurtham',
        title: isTa ? 'சுப முகூர்த்தம்' : isHi ? 'शुभ मुहूर्त' : 'Subha Muhurtham (Auspicious Dates)',
        desc: isTa ? '6 மாத சுப முகூர்த்த நாட்கள் & நல்ல நேரம்' : isHi ? '6 माह शुभ मुहूर्त एवं शुभ समय' : '6-Month Auspicious Dates & Nalla Neram',
      },
    ],
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 relative">
      <SEO
        title="404 - Page Not Found | ASTRO SIVAM"
        description="The page you are looking for does not exist on ASTRO SIVAM. Explore our authentic Vedic astrology horoscope, marriage matching, baby naming, and Subha Muhurtham auspicious dates services."
        noindex={true}
      />
      <div className="max-w-2xl w-full text-center relative z-10 space-y-8">
        
        {/* Glow Medallion Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-500/20 via-rose-500/10 to-transparent border border-amber-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.15)] animate-pulse">
            <Compass className="w-14 h-14 text-amber-400" />
          </div>
          <span className="absolute -top-1 -right-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-rose-900/80 text-rose-200 border border-rose-600/50 uppercase">
            404
          </span>
        </div>

        {/* Headings */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-wider uppercase">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t.badge}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-serif tracking-tight">
            {t.title}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            <span>{t.returnHome}</span>
          </button>

          <button
            onClick={() => onNavigate('services')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{t.exploreServices}</span>
          </button>
        </div>

        {/* Popular Services Quick-Links Card */}
        <div className="mt-10 pt-8 border-t border-slate-800/80 text-left">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 text-center">
            {t.servicesTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {t.services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => onNavigate(svc.id)}
                className="group p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 transition-all text-left flex flex-col justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-200 group-hover:text-amber-400 transition-colors">
                    {svc.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {svc.desc}
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[10px] font-bold text-amber-400/80 group-hover:text-amber-400">
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
