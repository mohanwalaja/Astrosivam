import React, { createContext, useContext, useState } from 'react';
import { AppLanguage } from '../types';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
}

const translations: Record<string, string> = {
  brand_name: 'ASTRO SIVAM',
  brand_tagline: 'Divine Guidance • Cosmic Insights • Destined Futures',
  brand_subtitle: 'Accurate Sidereal Jyotisha • 10 Poruthams • Baby Naming • Subha Muhurtham',
  brand_slogan: 'Understand Your Life Through Vedic Astrology',
  home: 'Home',
  services: 'Services',
  birth_jathagam: 'Birth Jathagam',
  marriage_compatibility: 'Marriage Compatibility',
  baby_naming: 'Baby Naming',
  muhurtham: 'Subha Muhurtham',
  how_it_works: 'How It Works',
  about: 'About Us',
  contact: 'Contact',
  login: 'Log In',
  register: 'Sign Up',
  logout: 'Log Out',
  dashboard: 'Customer Dashboard',
  admin_portal: 'Admin Portal',
  my_orders: 'My Orders',
  birth_profile: 'Birth Profile',
  fiji_fjd: 'Fiji (FJ$)',
  intl_usd: 'International (US$)',

  // Home Hero
  hero_title: 'Understand Your Life Through Vedic Astrology',
  hero_sub: 'Accurate sidereal calculations computed with Lahiri ephemeris. Securely get your detailed birth horoscope, 10-Poruthams marriage matching, baby naming certificates, and Subha Muhurtham auspicious dates delivered directly to your email in English.',
  explore_services: 'Explore Our Services',
  free_beta_badge: '★ FREE BETA TESTING ACTIVE',
  free_beta_desc: 'All astrology services are currently 100% free! Every order is verified and approved by Admin before automatic calculation and PDF email delivery.',
  paid_mode_badge: 'OFFICIAL SERVICE PRICING',
  paid_mode_fiji: 'Fiji Local: FJ$10 (Vodafone M-Paisa)',
  paid_mode_intl: 'International: US$5 (PayPal)',

  // Services
  service_jathagam_title: 'Birth Jathagam (Horoscope)',
  service_jathagam_desc: 'Complete natal horoscope with 12 Bhavas, 9 planetary positions, Navamsa chart, Vimshottari Mahadasha timeline, Sade Sati & Dosha analysis, and life aspect predictions.',
  service_match_title: 'Marriage Compatibility (Porutham)',
  service_match_desc: '10 Classical Poruthams matching, in-depth Kuja (Mars) Dosha evaluation with cancellation rules, Dosha Samyam balance, and matrimonial recommendation certificate.',
  service_baby_title: 'Baby Naming (Nakshatra Letters)',
  service_baby_desc: 'Determine auspicious starting syllables, exact birth pada vibration, Nakshatra deity and lord energies, plus curated traditional and modern name suggestions.',
  service_muhurtham_title: 'Subha Muhurtham (Auspicious Dates)',
  service_muhurtham_desc: 'Six-month auspicious date calendar for 18 Vedic ceremonies computed from tithi, nakshatra, yoga, karana and lagna with Nalla Neram windows, Rahu Kalam avoidance and Tara Balam star checks.',
  order_now: 'Order Report',
  preview_free: 'Calculate Preview',

  // Workflow
  workflow_title: 'How ASTRO SIVAM Works',
  step1_title: '1. Register & Birth Profile',
  step1_desc: 'Enter your birth date, exact time, and select your location via Google Maps once. It is saved for lifetime reuse.',
  step2_title: '2. Select Service',
  step2_desc: 'Choose Birth Jathagam, Marriage Matching, Baby Naming, or Subha Muhurtham for an authentic Vedic reading.',
  step3_title: '3. Admin Review & Approval',
  step3_desc: 'Admin verifies the order details or payment status and authorizes backend processing.',
  step4_title: '4. Precision Calculations',
  step4_desc: 'Our proprietary Vedic ephemeris engine calculates precise planetary longitudes, Bhavas, and charts on the secure backend.',
  step5_title: '5. PDF Generation & Email Delivery',
  step5_desc: 'A pristine ASTRO SIVAM branded certificate is compiled in English and automatically delivered to your registered email.',

  // Footer
  privacy_policy: 'Privacy Policy',
  terms_conditions: 'Terms & Conditions',
  payment_policy: 'Payment Policy',
  refund_policy: 'Refund & Cancellation Policy',
  all_rights_reserved: 'All rights reserved.'
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => translations[key] || key
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<AppLanguage>('en');

  const t = (key: string): string => {
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

