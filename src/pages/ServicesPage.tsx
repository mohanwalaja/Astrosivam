import React from 'react';
import {
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  Globe2,
  Heart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEO } from '../components/common/SEO';

interface ServicesPageProps {
  onNavigate: (route: string) => void;
}

interface ServiceListing {
  title: string;
  category: string;
  description: string;
  features: string[];
  Icon: LucideIcon;
  theme: 'gold' | 'purple' | 'rose' | 'saffron';
  iconTone: string;
  iconStyle: string;
  fee: string;
  indiaFee: number;
  route: string;
  action: string;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigate }) => {
  const { settings } = useAuth();
  const isBeta = settings?.serviceMode === 'FREE_BETA';

  const bjFjd = settings?.servicePricing?.BIRTH_JATHAGAM?.fjd ?? settings?.fijiPriceFJD ?? 35;
  const bjInr = settings?.servicePricing?.BIRTH_JATHAGAM?.inr ?? settings?.indiaPriceINR ?? 499;
  const bjUsd = settings?.servicePricing?.BIRTH_JATHAGAM?.usd ?? settings?.intlPriceUSD ?? 18;

  const mcFjd = settings?.servicePricing?.MARRIAGE_COMPATIBILITY?.fjd ?? settings?.fijiPriceFJD ?? 45;
  const mcInr = settings?.servicePricing?.MARRIAGE_COMPATIBILITY?.inr ?? settings?.indiaPriceINR ?? 699;
  const mcUsd = settings?.servicePricing?.MARRIAGE_COMPATIBILITY?.usd ?? settings?.intlPriceUSD ?? 22;

  const bnFjd = settings?.servicePricing?.BABY_NAMING?.fjd ?? settings?.fijiPriceFJD ?? 30;
  const bnInr = settings?.servicePricing?.BABY_NAMING?.inr ?? settings?.indiaPriceINR ?? 399;
  const bnUsd = settings?.servicePricing?.BABY_NAMING?.usd ?? settings?.intlPriceUSD ?? 15;

  const mhFjd = settings?.servicePricing?.MUHURTHAM?.fjd ?? 40;
  const mhInr = settings?.servicePricing?.MUHURTHAM?.inr ?? 599;
  const mhUsd = settings?.servicePricing?.MUHURTHAM?.usd ?? 20;

  const services: ServiceListing[] = [
    {
      title: 'Birth Jathagam (Vedic Horoscope & Ephemeris)',
      category: 'Full Natal Horoscope & Life Guidance',
      description: 'A comprehensive 2-page astrological dossier mapping your planetary karma, soul purpose, and life timings. Computed with precise latitude, longitude, and timezone calculations for any global birthplace.',
      features: [
        '12 Bhavas & Navagraha Longitudes',
        'Vimshottari Mahadasha Sequence',
        'Sade Sati (Ezharai Sani) Status & Remedies',
        'Available in Tamil, English & Hindi',
      ],
      Icon: Compass,
      theme: 'gold',
      iconTone: 'text-amber-300',
      iconStyle: '',
      fee: `FJ$${bjFjd} / US$${bjUsd}`,
      indiaFee: bjInr,
      route: 'birth-jathagam',
      action: 'Order Birth Jathagam',
    },
    {
      title: 'Marriage Compatibility (10 Vedic Poruthams & Koota Matching)',
      category: 'Matrimonial Matching & 10 Poruthams',
      description: 'Authentic Kuta matching evaluating the 10 classical Poruthams, Rajju concordance, and Kuja (Mars) Dosha cancellation rules between bride and groom horoscopes.',
      features: [
        '10 Classical Poruthams Breakdown',
        'Rajju & Vedha Crucial Check',
        'Kuja Dosha Samyam Analysis',
        'Uses Customer Profile for Person 1',
      ],
      Icon: Heart,
      theme: 'purple',
      iconTone: 'text-purple-300',
      iconStyle: 'indigo',
      fee: `FJ$${mcFjd} / US$${mcUsd}`,
      indiaFee: mcInr,
      route: 'marriage-compatibility',
      action: 'Order Marriage Match',
    },
    {
      title: 'Baby Naming (Vedic Namakaranam & Auspicious Syllables)',
      category: 'Namakaran Syllables & Suggestions',
      description: 'Calculate the auspicious sound vibrations for your newborn based on exact Moon nakshatra and pada at birth. Receive curated meaningful names in English, Tamil, and Hindi.',
      features: [
        'Primary Starting Syllable for Birth Pada',
        'Syllables for all 4 Padas of Nakshatra',
        'Curated Vedic Baby Name Repository',
        'Official ASTRO SIVAM Naming Certificate',
      ],
      Icon: Baby,
      theme: 'rose',
      iconTone: 'text-rose-300',
      iconStyle: 'rose',
      fee: `FJ$${bnFjd} / US$${bnUsd}`,
      indiaFee: bnInr,
      route: 'baby-naming',
      action: 'Order Baby Naming',
    },
    {
      title: 'Subha Muhurtham (6-Month Auspicious Dates)',
      category: 'Panchangam Auspicious Date Calendar',
      description: 'Receive muhurtham dates across six months: the two months before your selected month, then that month and the following three. Available for 18 ceremonies including Wedding, Griha Pravesam, Bhoomi Pooja, Business Start, Annaprasanam, Seemantham, Upanayanam and more. Computed from tithi, nakshatra, yoga, karana, lagna and Guru-Sukra strength.',
      features: [
        '18 Vedic Ceremonies Covered',
        'Nalla Neram, Rahu Kalam & Yamaganda',
        'Tara Balam & Chandrashtama Star Checks',
        'English, Tamil & Hindi PDF Reports',
      ],
      Icon: CalendarDays,
      theme: 'saffron',
      iconTone: 'text-amber-300',
      iconStyle: 'saffron',
      fee: `FJ$${mhFjd} / US$${mhUsd}`,
      indiaFee: mhInr,
      route: 'muhurtham',
      action: 'Order Subha Muhurtham',
    },
  ];

  return (
    <div className="py-9 sm:py-12">
      <SEO
        title="Vedic Astrology Services - Jathagam, Marriage Matching, Baby Naming & Subha Muhurtham | ASTRO SIVAM"
        description="Explore authentic Vedic astrology services by ASTRO SIVAM. Get comprehensive Birth Jathagam, 10-Poruthams Marriage Matching, Sacred Baby Naming, and a 6-Month Subha Muhurtham Auspicious Date Calendar with instant digital delivery."
        canonical="https://astrosivam.com/services"
      />

      <div className="site-container space-y-8 sm:space-y-10">
        <header className="mx-auto max-w-2xl space-y-2.5 text-center">
          <div className="eyebrow justify-center text-[#f3ba70]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>Vedic astrology services</span>
          </div>
          <h1 className="display-serif text-2xl font-bold tracking-tight text-[#fffdfa] sm:text-3xl lg:text-3.5xl">
            Authentic Astrological Services &amp; Precision Reports
          </h1>
          <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
            Choose a considered Vedic reading for the moment that matters. Each report is calculated with the Chitra Paksha Lahiri ephemeris and reviewed by our dedicated priest and astrologer team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1.5 text-xs font-medium text-amber-100/80">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />Reviewed by our Vedic team</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />Prepared daily 9–11 AM IST &amp; emailed upon admin approval</span>
            <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />For users worldwide</span>
          </div>
        </header>

        <section className="space-y-6" aria-labelledby="services-list-title">
          <div className="flex flex-col gap-2 border-b border-amber-500/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="eyebrow text-amber-400">Choose your reading</div>
              <h2 id="services-list-title" className="display-serif mt-2 text-2xl font-bold text-[#fffdfa] sm:text-3xl">
                A little more clarity, when you need it most.
              </h2>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-slate-400 sm:text-sm sm:text-right">
              Compare what each consultation includes, then continue to its secure order page.
            </p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            {services.map(({ title, category, description, features, Icon, theme, iconTone, iconStyle, fee, indiaFee, route, action }) => (
              <article key={route} className={`service-card service-card-${theme} flex h-full flex-col`}>
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`service-icon ${iconStyle}`}>
                      <Icon className={`h-6 w-6 ${iconTone}`} aria-hidden="true" />
                    </div>
                    <span className={`max-w-[75%] rounded-full border px-3 py-1 text-right text-[10px] font-bold leading-snug sm:text-xs ${
                      theme === 'purple'
                        ? 'border-purple-400/30 bg-purple-500/15 text-purple-200'
                        : theme === 'rose'
                          ? 'border-rose-400/30 bg-rose-500/15 text-rose-200'
                          : 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                    }`}>
                      {category}
                    </span>
                  </div>

                  <h3 className="display-serif mt-5 text-xl font-bold leading-snug text-[#fffdfa] sm:text-2xl">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {description}
                  </p>

                  <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-200 sm:grid-cols-2 sm:text-[13px]">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <div className="rounded-2xl border border-white/10 bg-[#0b0718]/55 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Service fee</div>
                          <div className={`mt-1 text-xl font-black ${iconTone}`}>
                            {isBeta ? '1st FREE (Beta)' : fee}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">India domestic: ₹{indiaFee} INR</div>
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 sm:justify-end">
                          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                          Report + invoice after review
                        </div>
                      </div>
                      {isBeta && (
                        <p className="mt-3 text-[11px] leading-relaxed text-emerald-200/90">
                          One free report per customer; additional reports are charged at the standard price.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate(route)}
                        className="button-primary mt-4 w-full !min-h-[46px] !text-xs"
                      >
                        <span>{action}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="beta-banner flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="eyebrow text-amber-400">A guided beginning</div>
            <h2 className="display-serif text-xl font-bold text-amber-100 sm:text-2xl">
              See how your consultation comes together.
            </h2>
            <p className="text-xs leading-relaxed text-amber-100/80 sm:text-sm">
              Follow the six steps from service selection and secure checkout to traditional review and delivery of your report and invoice.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('how-it-works')} className="button-primary relative z-10 shrink-0">
            <span>See how it works</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
};
