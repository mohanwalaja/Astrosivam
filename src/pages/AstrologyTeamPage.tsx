import React from 'react';
import { Sparkles, ShieldCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { AstrologyTeamSection } from '../components/common/AstrologyTeamSection';
import { useLanguage } from '../context/LanguageContext';
import { SEO } from '../components/common/SEO';

interface AstrologyTeamPageProps {
  onNavigate: (route: string) => void;
}

export const AstrologyTeamPage: React.FC<AstrologyTeamPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <SEO
        title="Our Vedic Scholars & Astrologers | ASTRO SIVAM"
        description="Meet the expert Vedic scholars, Sanskrit pandits, and computational astrologers behind ASTRO SIVAM's precise calculations."
        canonical="https://astrosivam.com/team"
      />
      
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 text-white shadow-2xl">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>India-Based Vedic Astrological Council</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Our Vedic Astrological Team
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            ASTRO SIVAM collaborates directly with seasoned Sanskrit Vedic scholars and Jyothida Vidwans located in Tamil Nadu and Kerala (India). Every horoscope calculation, marriage compatibility score, baby naming certificate, and Subha Muhurtham date selection is calculated using classical ephemeris formulas and supported by our India-based astrology scholars.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium text-amber-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Daily 9:00 AM – 11:00 AM IST Preparation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-200">Admin Approval &amp; Verified PDF + Invoice Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Astrology Team Grid Section */}
      <AstrologyTeamSection showTitle={false} />

      {/* Workflow Explainer */}
      <div className="celestial-card p-8 space-y-6">
        <h3 className="text-lg font-bold text-[#fffdfa]">
          How Our Team Collaborates With ASTRO SIVAM
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300 leading-relaxed">
          <div className="p-5 bg-amber-500/10 rounded-2xl space-y-2 border border-amber-500/20">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
              01
            </div>
            <h4 className="font-bold text-[#fffdfa]">
              Customer Order & Coordinates
            </h4>
            <p className="font-normal text-slate-300">
              When a user submits birth details, latitude, longitude, and timezone via Google Maps, the order enters our secure queue.
            </p>
          </div>

          <div className="p-5 bg-purple-500/10 rounded-2xl space-y-2 border border-purple-500/20">
            <div className="w-8 h-8 rounded-lg bg-purple-400 text-slate-950 font-bold flex items-center justify-center text-xs">
              02
            </div>
            <h4 className="font-bold text-[#fffdfa]">
              Admin Approval & Vedic Review
            </h4>
            <p className="font-normal text-slate-300">
              The ASTRO SIVAM administrator approves the order. The system triggers planetary ephemeris calculation with the backing of our India astrology team.
            </p>
          </div>

          <div className="p-5 bg-emerald-500/10 rounded-2xl space-y-2 border border-emerald-500/20">
            <div className="w-8 h-8 rounded-lg bg-emerald-400 text-slate-950 font-bold flex items-center justify-center text-xs">
              03
            </div>
            <h4 className="font-bold text-[#fffdfa]">
              Certified PDF Email Delivery
            </h4>
            <p className="font-normal text-slate-300">
              Upon priest team verification and admin approval, the official PDF report and tax invoice are emailed directly to your registered email (with live status tracked in your Customer Dashboard).
            </p>
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <button
            onClick={() => onNavigate('birth-jathagam')}
            className="button-primary text-xs !min-h-[44px] !px-6 flex items-center gap-2"
          >
            <span>Order Your Birth Jathagam Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
