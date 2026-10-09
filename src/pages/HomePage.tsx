import React from 'react';
import {
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Compass,
  Heart,
  HelpCircle,
  Mail,
  Languages,
  ShieldCheck
} from 'lucide-react';
import { TestimonialsSection } from '../components/common/TestimonialsSection';
import { SEO } from '../components/common/SEO';
import type { ServiceType } from '../types';
import logoImg from '../assets/astrosivam_appicon.png';

interface HomePageProps {
  onNavigate: (route: string) => void;
}

type HomeService = {
  type: ServiceType;
  title: string;
  description: string;
  detail: string;
  route: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  cardClass: string;
  iconClass: string;
  accentClass: string;
};

const HOME_SERVICES: HomeService[] = [
  {
    type: 'BIRTH_JATHAGAM',
    title: 'Birth Jathagam',
    description: 'A personal horoscope reading of your chart, life seasons, strengths, and planetary periods.',
    detail: 'Rasi and Navamsa charts, Vimshottari Dasa, doshas, and remedies',
    route: 'birth-jathagam',
    icon: Compass,
    cardClass: 'service-card-gold',
    iconClass: '',
    accentClass: 'text-amber-300'
  },
  {
    type: 'MARRIAGE_COMPATIBILITY',
    title: 'Marriage Compatibility',
    description: 'A clear comparison of two charts using the classical 10-Poruthams matching system.',
    detail: 'Porutham scores, Rajju and Vedha checks, Kuja Dosha, and Dasa Sandhi',
    route: 'marriage-compatibility',
    icon: Heart,
    cardClass: 'service-card-purple',
    iconClass: 'indigo',
    accentClass: 'text-purple-300'
  },
  {
    type: 'BABY_NAMING',
    title: 'Baby Naming',
    description: 'Meaningful Vedic name guidance based on the baby’s birth star and chart.',
    detail: 'Auspicious syllables, curated names, birth-star details, and certificate',
    route: 'baby-naming',
    icon: Baby,
    cardClass: 'service-card-rose',
    iconClass: 'rose',
    accentClass: 'text-rose-300'
  },
  {
    type: 'MUHURTHAM',
    title: 'Subha Muhurtham',
    description: 'A six-month calendar of suitable dates and times for your chosen ceremony.',
    detail: 'Panchangam checks, Nalla Neram, Rahu Kalam, and Tara Balam',
    route: 'muhurtham',
    icon: CalendarDays,
    cardClass: 'service-card-saffron',
    iconClass: 'saffron',
    accentClass: 'text-amber-300'
  }
];

const HOW_IT_WORKS = [
  {
    number: '1',
    title: 'Choose a report',
    description: 'Compare the available services, then open the report that fits your question.'
  },
  {
    number: '2',
    title: 'Enter birth details',
    description: 'Add the required names, birth date, exact time, and place in the secure form.'
  },
  {
    number: '3',
    title: 'India-based Priest Team prepares',
    description: 'Our India-based Vedic priest team calculates and reviews the chart before your personalised PDF is created.'
  },
  {
    number: '4',
    title: 'Receive your PDF by email',
    description: 'Our priest team prepares reports daily between 9:00 AM – 11:00 AM IST. Following admin review and approval, your verified PDF report and tax invoice are emailed directly to you.'
  }
];

const FAQ_ITEMS = [
  {
    question: 'When and how will I receive my report?',
    answer: 'Every day between 9:00 AM and 11:00 AM IST (India Standard Time), our India-based priest team prepares and reviews the astrological charts. Following administrator review and approval, your official PDF report and Tax Invoice are emailed directly to your registered address.'
  },
  {
    question: 'What birth details do I need?',
    answer: 'Please provide the person’s name, date of birth, exact time of birth, and birth place. Marriage Compatibility needs these details for both people. An accurate birth time and place improve the chart calculation.'
  },
  {
    question: 'Which calculation system and languages do you use?',
    answer: 'ASTRO SIVAM uses the sidereal zodiac with Chitra Paksha Lahiri Ayanamsa. Reports can be prepared in English, Tamil, or Hindi.'
  },
  {
    question: 'Which payment methods can I use?',
    answer: 'Available checkout methods include Vodafone M-PAiSA, Google Pay or UPI, and PayPal or card. The options available to you are shown during checkout.'
  },
  {
    question: 'Can I see the report format before ordering?',
    answer: 'Yes. Each service page has an ‘Open sample PDF’ option that opens a full example made with fixed sample details. No customer data is used in a sample report.'
  }
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="home-page space-y-16 sm:space-y-20 pb-12 sm:pb-16 w-full overflow-x-hidden">
      <SEO
        title="ASTRO SIVAM - Understand Your Life Through Vedic Astrology | astrosivam.com"
        description="ASTRO SIVAM offers Birth Jathagam, 10-Poruthams Marriage Compatibility, Vedic Baby Naming, and Subha Muhurtham reports in Tamil, English, and Hindi."
        canonical="https://astrosivam.com/"
      />

      {/* 1. INTRODUCTION */}
      <section id="introduction" className="hero-backdrop border-b border-amber-900/30 py-12 sm:py-16 lg:py-20 text-white">
        <div className="site-container relative z-10">
          <div className="max-w-4xl">
            <div className="eyebrow text-[#f3ba70]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/60 bg-black p-0.5">
                <img src={logoImg} alt="" className="h-full w-full rounded-full object-cover" />
              </span>
              <span>Online Vedic astrology</span>
            </div>

            <h1 className="display-serif mt-5 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-[#fffdfa] sm:text-5xl lg:text-[3.8rem]">
              Understand your life through <span className="font-normal italic text-[#f5c474]">Vedic astrology.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-200 sm:text-lg sm:leading-8">
              Order a personalised Birth Jathagam, Marriage Compatibility, Baby Naming, or Subha Muhurtham report. Each report is prepared by our Vedic priest team in India and delivered as a clear PDF in English, Tamil, or Hindi.
            </p>

            <div className="mt-7 flex flex-row items-center gap-2.5 sm:gap-4 max-w-lg">
              <button
                type="button"
                onClick={() => scrollToSection('services')}
                className="button-primary flex-1 sm:flex-initial justify-center !min-h-[46px] sm:!min-h-12 !px-3 sm:!px-6 !text-xs sm:!text-sm shadow-xl shadow-amber-950/40"
              >
                <span>View services</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('how-it-works')}
                className="dark-quiet flex-1 sm:flex-initial justify-center !min-h-[46px] sm:!min-h-12 !px-3 sm:!px-6 !text-xs sm:!text-sm"
              >
                <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>How it works</span>
              </button>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-amber-100/90 sm:flex-row sm:flex-wrap sm:gap-x-7">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#f5c474]" />
                Private birth details
              </span>
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-[#f5c474]" />
                Prepared daily 9–11 AM IST &amp; emailed
              </span>
              <span className="flex items-center gap-2">
                <Languages className="h-4 w-4 shrink-0 text-[#f5c474]" />
                English, Tamil &amp; Hindi
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SERVICES */}
      <section id="services" className="site-container scroll-mt-24">
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <div className="eyebrow">Services</div>
          <h2 className="display-serif mt-3 text-3xl font-bold text-[#fffdfa] sm:text-4xl">
            Choose the report you need
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-300 sm:text-base">
            Every option includes a personalised PDF prepared from the birth details you provide.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {HOME_SERVICES.map(service => {
            const ServiceIcon = service.icon;

            return (
              <article
                key={service.type}
                className={`service-card ${service.cardClass} !min-h-0 !p-5 sm:!p-6`}
              >
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start gap-4">
                    <div className={`service-icon ${service.iconClass}`}>
                      <ServiceIcon className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="display-serif text-2xl font-bold text-[#fffdfa]">{service.title}</h3>
                      <p className="mt-2 text-[15px] leading-6 text-slate-200">{service.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
                    <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${service.accentClass}`} />
                    <span>{service.detail}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(service.route)}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-500/25 sm:w-auto sm:self-start"
                  >
                    Choose {service.title}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section id="how-it-works" className="site-container scroll-mt-24">
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <div className="eyebrow">How it works</div>
          <h2 className="display-serif mt-3 text-3xl font-bold text-[#fffdfa] sm:text-4xl">
            From your details to your report
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-300 sm:text-base">
            The order process is straightforward and works on mobile, tablet, or desktop.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {HOW_IT_WORKS.map(step => (
            <li key={step.number} className="rounded-2xl border border-white/10 bg-[#16122d]/85 p-5 sm:p-6">
              <div className="flex items-start gap-4 xl:block">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/45 bg-amber-500/10 font-serif text-lg font-bold text-amber-300">
                  {step.number}
                </div>
                <div className="min-w-0 xl:mt-4">
                  <h3 className="text-base font-bold text-[#fffdfa]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. REVIEWS */}
      <section id="reviews" className="site-container scroll-mt-24">
        <TestimonialsSection />
      </section>

      {/* 5. FAQ */}
      <section id="faq" className="site-container scroll-mt-24">
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <div className="eyebrow">Frequently asked questions</div>
          <h2 className="display-serif mt-3 text-3xl font-bold text-[#fffdfa] sm:text-4xl">
            Helpful details before you order
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-300 sm:text-base">
            Quick answers about ordering, delivery, calculations, samples, and payment.
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-amber-500/20 bg-[#181230]/90 px-5 py-1 transition-colors open:border-amber-500/45 sm:px-6"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-4 text-left text-[15px] font-bold leading-6 text-[#fffdfa] marker:hidden sm:text-base [&::-webkit-details-marker]:hidden">
                <HelpCircle className="h-5 w-5 shrink-0 text-amber-400" />
                <span className="flex-1">{item.question}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 pl-8 pr-2 text-sm leading-6 text-slate-300 sm:text-[15px] sm:leading-7">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};
