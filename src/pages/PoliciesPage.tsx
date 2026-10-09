import React from 'react';
import { ShieldCheck, FileText, CreditCard, RotateCcw } from 'lucide-react';
import { SEO } from '../components/common/SEO';

interface PoliciesProps {
  type: 'privacy' | 'terms' | 'payment' | 'refund';
  onNavigate: (route: string) => void;
}

const POLICY_META = {
  privacy: {
    title: 'Privacy Policy | ASTRO SIVAM',
    description: "Read ASTRO SIVAM's Privacy Policy. Learn how we safeguard your birth data, personal information, and payment details with strict confidentiality.",
    canonical: 'https://astrosivam.com/privacy-policy'
  },
  terms: {
    title: 'Terms of Service | ASTRO SIVAM',
    description: "Terms and Conditions governing the use of ASTRO SIVAM's Vedic astrology services, calculations, and digital deliverables.",
    canonical: 'https://astrosivam.com/terms'
  },
  payment: {
    title: 'Payment Policy | ASTRO SIVAM',
    description: 'Information regarding accepted payment methods, secure transaction processing, and multi-currency billing at ASTRO SIVAM.',
    canonical: 'https://astrosivam.com/payment-policy'
  },
  refund: {
    title: 'Refund & Cancellation Policy | ASTRO SIVAM',
    description: 'Review our policy on refunds and cancellations for personalized astrological calculations and digital PDF deliverables.',
    canonical: 'https://astrosivam.com/refund-policy'
  }
};

export const PoliciesPage: React.FC<PoliciesProps> = ({ type, onNavigate }) => {
  const meta = POLICY_META[type] || POLICY_META.privacy;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <SEO
        title={meta.title}
        description={meta.description}
        canonical={meta.canonical}
      />
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => onNavigate('policy-privacy')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            type === 'privacy'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Privacy Policy</span>
        </button>

        <button
          onClick={() => onNavigate('policy-terms')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            type === 'terms'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Terms & Conditions</span>
        </button>

        <button
          onClick={() => onNavigate('policy-payment')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            type === 'payment'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Policy</span>
        </button>

        <button
          onClick={() => onNavigate('policy-refund')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            type === 'refund'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refund & Cancellation</span>
        </button>
      </div>

      {/* Policy Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm text-slate-700 dark:text-slate-300 space-y-6 text-xs sm:text-sm leading-relaxed">
        
        {type === 'privacy' && (
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500">Last updated: January 2026</p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              1. Information We Collect
            </h3>
            <p>
              ASTRO SIVAM collects personal identity and astrological birth details, including your full name, email address, mobile contact number, date of birth, exact time of birth, and geographic coordinates of your birthplace (latitude, longitude, and timezone).
            </p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              2. How Your Birth Data is Used
            </h3>
            <p>
              Your birth data is used strictly and exclusively for calculating Vedic astrological positions (Ascendant/Lagna, 12 Bhavas, Navagraha longitudes, Mahadashas, and matching scores) and generating your requested PDF reports. We never sell, lease, or monetize your personal data.
            </p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              3. Branding & Strict Confidentiality
            </h3>
            <p>
              All astrology reports and certificates generated by ASTRO SIVAM bear official ASTRO SIVAM branding exclusively. No priest, temple, or external third-party details are attached to your reports.
            </p>
          </div>
        )}

        {type === 'terms' && (
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Terms & Conditions
            </h1>
            <p className="text-xs text-slate-500">Last updated: January 2026</p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              1. Astrological Interpretations Disclaimer
            </h3>
            <p>
              Astrological reports, charts, and predictions provided by ASTRO SIVAM are calculated based on ancient Vedic principles (Chitra Paksha Lahiri ephemeris). Astrology is an advisory spiritual science; all reports are provided for guidance and self-awareness.
            </p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              2. Accuracy of Input Data
            </h3>
            <p>
              The accuracy of your Vedic horoscope depends entirely on the precision of the birth date, exact birth time, and birth location provided. ASTRO SIVAM is not responsible for discrepancies arising from inaccurate client inputs.
            </p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              3. Service Delivery
            </h3>
            <p>
              Reports and official tax invoices are generated in digital PDF format and delivered directly to your registered email address upon priest team verification. Order history and live delivery tracking are maintained in your Customer Dashboard.
            </p>
          </div>
        )}

        {type === 'payment' && (
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Payment Policy
            </h1>
            <p className="text-xs text-slate-500">Last updated: January 2026</p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              1. Accepted Payment Methods
            </h3>
            <div className="space-y-2">
              <p><strong>1. India Payments:</strong> Google Pay (GPay) direct transfer to our verified registered account.</p>
              <p><strong>2. International Payments:</strong> PayPal official portal checkout for global users.</p>
              <p><strong>3. Fiji Payments:</strong> Vodafone M-PAiSA mobile wallet transfers.</p>
            </div>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              2. Payment Verification
            </h3>
            <p>
              When placing a paid order, clients must submit their transaction reference/receipt number. The order is reviewed by the administrator before calculations are finalized and dispatched.
            </p>
          </div>
        )}

        {type === 'refund' && (
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Refund & Cancellation Policy
            </h1>
            <p className="text-xs text-slate-500">Last updated: January 2026</p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              1. Digital Personalized Services
            </h3>
            <p>
              Because our astrological horoscopes, matrimonial matching reports, baby naming certificates, and Subha Muhurtham date reports are uniquely generated and custom-calculated digital products, orders that have already been generated and emailed cannot be refunded.
            </p>

            <h3 className="font-bold text-slate-900 dark:text-white text-base pt-2">
              2. Cancellation Before Generation
            </h3>
            <p>
              If you discover an error in your birth details prior to admin verification and report generation, you may contact admin@astrosivam.com immediately to correct your input coordinates at no additional charge.
            </p>
          </div>
        )}

      </div>

    </div>
  );
};
