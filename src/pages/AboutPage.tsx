import React from 'react';
import { Sparkles, MapPin, ShieldCheck, HeartHandshake, Compass, Clock } from 'lucide-react';
import { AstrologyTeamSection } from '../components/common/AstrologyTeamSection';
import { SEO } from '../components/common/SEO';
import fullLogoImg from '../assets/astrosivam_full_logo.png';

interface AboutPageProps {
  onNavigate: (route: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 select-none">
      <SEO
        title="About Us - Authentic Vedic Astrology Heritage | ASTRO SIVAM"
        description="Learn about ASTRO SIVAM's mission to deliver uncompromisingly authentic Vedic astrology calculations, high-precision algorithms, and spiritual wisdom worldwide."
        canonical="https://astrosivam.com/about"
      />
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="w-full max-w-md mx-auto p-3 flex items-center justify-center">
          <img
            src={fullLogoImg}
            alt="ASTRO SIVAM Official Logo"
            referrerPolicy="no-referrer"
            className="w-full h-auto max-h-32 object-contain"
          />
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>About ASTRO SIVAM</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Authentic Vedic Astrology from Chennai, India to Global Users
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Based in Chennai, India — serving Fiji, Australia, NZ &amp; the worldwide diaspora with sacred Vedic Jyotish wisdom — ASTRO SIVAM (astrosivam.com) is an authentic Vedic platform. Every reading, calculation, and horoscope is prepared directly by our revered India-based Vedic priest team daily between 9:00 AM – 11:00 AM IST, delivering mathematical precision, multilingual accessibility, and verified email delivery upon admin approval.
        </p>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Chitra Paksha Lahiri Ephemeris
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            We adhere strictly to the traditional sidereal Nirayana zodiac using standard Lahiri Ayanamsa and J2000 epoch astronomical matrices for planetary coordinates, house cusps, and dasha balances.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Absolute Privacy & Dignity
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            All reports and certificates bear official ASTRO SIVAM branding exclusively. No third-party advertisements or promotional data is attached to your personal astrological documents.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Multilingual PDF Export
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Astrology reports and certificates are available for PDF export in English, Tamil, and Hindi, honoring the linguistic traditions of our global users and families.
          </p>
        </div>
      </div>

      {/* Meet the Team Section */}
      <AstrologyTeamSection showTitle={true} limit={3} onNavigate={onNavigate} />

      {/* Mission statement */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white space-y-4">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <MapPin className="w-4 h-4" />
          <span>Chennai, India • Serving Fiji, Australia, NZ &amp; worldwide diaspora</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold">
          Empowering Life Decisions Through Timeless Vedic Wisdom
        </h2>
        <p className="text-xs text-sm text-slate-300 leading-relaxed max-w-3xl">
          Whether you are navigating career transitions, matching horoscopes for a sacred matrimony, or selecting an auspicious vibrational name for a newborn child, ASTRO SIVAM provides clear, verifiable, and sacred astrological clarity handled personally by our dedicated Vedic priest team.
        </p>
      </div>

    </div>
  );
};
