import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Captions,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Crown,
  Eye,
  FileText,
  Layers,
  LockKeyhole,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  MousePointer2,
  Music2,
  Pause,
  Play,
  Receipt,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SEO } from '../components/common/SEO';
import './HowItWorksPage.css';

interface HowItWorksPageProps {
  onNavigate: (route: string) => void;
}

interface CaptionLine {
  start: number;
  end: number;
  text: string;
}

interface StepDetail {
  id: number;
  title: string;
  shortTitle: string;
  startSec: number;
  endSec: number;
  icon: React.ReactNode;
  tagline: string;
  description: string;
  features: string[];
  narrationDuration: number;
  captions: CaptionLine[];
}

interface CinemaShot {
  id: string;
  start: number;
  end: number;
  image: string;
  label: string;
  broll?: boolean;
  camera: number;
}

type ViewMode = 'hybrid' | 'cinema' | 'focus';

type SpeechEnvelope = {
  values: Float32Array;
  duration: number;
};

const TOTAL_VIDEO_DURATION = 108;
const WAVEFORM_BAR_COUNT = 28;
const AUDIO_BASE = '/audio/step-';
const SCENE_BASE = '/video-scenes/';

const STEPS: StepDetail[] = [
  {
    id: 1,
    title: 'Sign in securely',
    shortTitle: '01 · Sign in',
    startSec: 0,
    endSec: 17,
    icon: <UserCheck aria-hidden="true" />,
    tagline: 'A private user account, ready in moments.',
    description: 'Sign in with Google or your email to open a secure, personal ASTRO SIVAM dashboard.',
    features: ['Google or email sign-in', 'Private user dashboard', 'A simple, guided start'],
    narrationDuration: 16.13,
    captions: [
      { start: 0, end: 3.2, text: 'Step one: Login and access your account.' },
      { start: 3.2, end: 6.9, text: 'Sign in easily using Google or your email.' },
      { start: 6.9, end: 11.5, text: 'Your account gives you secure, private access' },
      { start: 11.5, end: 16.13, text: 'to your personalized astrological dashboard.' },
    ],
  },
  {
    id: 2,
    title: 'Choose a service',
    shortTitle: '02 · Service',
    startSec: 17,
    endSec: 37,
    icon: <Sparkles aria-hidden="true" />,
    tagline: 'Find the Vedic service that fits your occasion.',
    description: 'Explore Janma Kundali, marriage compatibility, baby naming, and Subha Muhurtham services.',
    features: ['Birth Jathagam & Kundali', '10-Porutham matching', 'Baby naming & Muhurtham'],
    narrationDuration: 18.89,
    captions: [
      { start: 0, end: 3.7, text: 'Step two: Select your astrological service.' },
      { start: 3.7, end: 7.2, text: 'Choose a Janma Kundali birth chart,' },
      { start: 7.2, end: 10.5, text: 'marriage compatibility, auspicious baby naming,' },
      { start: 10.5, end: 18.89, text: 'or Subha Muhurtham dates for eighteen sacred ceremonies.' },
    ],
  },
  {
    id: 3,
    title: 'Share the details',
    shortTitle: '03 · Details',
    startSec: 37,
    endSec: 56,
    icon: <Calendar aria-hidden="true" />,
    tagline: 'Birth information or ceremony preferences, entered with care.',
    description: 'Provide the birth or event details needed for a careful reading; location search helps map coordinates.',
    features: ['Exact date and time', 'Ceremony and month preferences', 'Place search with coordinates'],
    narrationDuration: 18.05,
    captions: [
      { start: 0, end: 4, text: 'Step three: Fill in user and event details.' },
      { start: 4, end: 9, text: 'Enter birth data, or choose your ceremony' },
      { start: 9, end: 13.1, text: 'and a starting month for Subha Muhurtham.' },
      { start: 13.1, end: 18.05, text: 'Place search helps map precise planetary coordinates.' },
    ],
  },
  {
    id: 4,
    title: 'Complete payment',
    shortTitle: '04 · Payment',
    startSec: 56,
    endSec: 70,
    icon: <Receipt aria-hidden="true" />,
    tagline: 'Choose a convenient payment option for your region.',
    description: 'Review the available checkout options: Google Pay in India, PayPal internationally, and Vodafone M-PAiSA in Fiji.',
    features: ['Google Pay · India', 'PayPal · International', 'Vodafone M-PAiSA · Fiji'],
    narrationDuration: 13.03,
    captions: [
      { start: 0, end: 3.3, text: 'Step four: Make a secure payment.' },
      { start: 3.3, end: 6.8, text: 'Use Google Pay for India,' },
      { start: 6.8, end: 9.7, text: 'PayPal for international clients,' },
      { start: 9.7, end: 13.03, text: 'or Vodafone M-PAiSA for Fiji.' },
    ],
  },
  {
    id: 5,
    title: 'The priest team prepares your report',
    shortTitle: '05 · Analysis',
    startSec: 70,
    endSec: 89,
    icon: <Compass aria-hidden="true" />,
    tagline: 'A considered review of charts, timing, and tradition.',
    description: 'Senior Sivachariyar scholars review the relevant chart, compatibility factors, or Panchanga windows for your service.',
    features: ['12-house Rāsi & D-9 preview', 'Dasha and Bhukti review', 'Panchanga & Tara Balam'],
    narrationDuration: 18.19,
    captions: [
      { start: 0, end: 4, text: 'Step five: Priest team chart analysis.' },
      { start: 4, end: 8.8, text: 'Our senior Sivachariyar Vedic scholars and astrologers' },
      { start: 8.8, end: 13.3, text: 'carefully analyze your planetary chart and Dasha Bhukti,' },
      { start: 13.3, end: 18.19, text: 'or six-month Panchanga Shuddhi Muhurtham windows.' },
    ],
  },
  {
    id: 6,
    title: 'Review, approve, and deliver',
    shortTitle: '06 · Delivery',
    startSec: 89,
    endSec: 108,
    icon: <Send aria-hidden="true" />,
    tagline: 'Your report and official tax invoice travel together.',
    description: 'After the administration reviews the order, the horoscope report and tax invoice are prepared and emailed directly to you.',
    features: ['Report PDF', 'Official tax invoice PDF', 'Email and client-portal delivery'],
    narrationDuration: 18.91,
    captions: [
      { start: 0, end: 4, text: 'Step six: Admin approval and delivery.' },
      { start: 4, end: 8, text: 'The administrator verifies and approves your order.' },
      { start: 8, end: 13.4, text: 'Your Astrological Report PDF and Tax Invoice' },
      { start: 13.4, end: 18.91, text: 'are prepared daily 9 to 11 AM India time and emailed after approval.' },
    ],
  },
];

// Every cut uses a supplied photographic plate; the inserts are intentional mid-step B-roll.
const CINEMA_SHOTS: CinemaShot[] = [
  { id: 'login-wide', start: 0, end: 9, image: `${SCENE_BASE}scene-1-login.jpg`, label: 'CAM 01 · USER PORTAL', camera: 1 },
  { id: 'temple-login-insert', start: 9, end: 12, image: `${SCENE_BASE}broll-temple-sanctum.jpg`, label: 'B-ROLL · LAMP-LIT SANCTUM', broll: true, camera: 3 },
  { id: 'login-close', start: 12, end: 17, image: `${SCENE_BASE}scene-1-login.jpg`, label: 'CAM 02 · ACCOUNT ACCESS', camera: 2 },
  { id: 'services-wide', start: 17, end: 27, image: `${SCENE_BASE}scene-2-services.jpg`, label: 'CAM 01 · SERVICE SELECTION', camera: 2 },
  { id: 'temple-service-insert', start: 27, end: 30, image: `${SCENE_BASE}broll-temple-sanctum.jpg`, label: 'B-ROLL · PRAYER & TRADITION', broll: true, camera: 1 },
  { id: 'services-close', start: 30, end: 37, image: `${SCENE_BASE}scene-2-services.jpg`, label: 'CAM 02 · CHOOSE YOUR SERVICE', camera: 3 },
  { id: 'details-wide', start: 37, end: 44, image: `${SCENE_BASE}scene-3-details.jpg`, label: 'CAM 01 · USER DETAILS', camera: 3 },
  { id: 'rasi-details-insert', start: 44, end: 48, image: `${SCENE_BASE}broll-rasi-chart-hands.jpg`, label: 'B-ROLL · RĀSI CHART STUDY', broll: true, camera: 2 },
  { id: 'details-close', start: 48, end: 56, image: `${SCENE_BASE}scene-3-details.jpg`, label: 'CAM 02 · PLACE & BIRTH DATA', camera: 1 },
  { id: 'payment-wide', start: 56, end: 62, image: `${SCENE_BASE}scene-4-payment.jpg`, label: 'CAM 01 · SECURE CHECKOUT', camera: 2 },
  { id: 'temple-payment-insert', start: 62, end: 66, image: `${SCENE_BASE}broll-temple-sanctum.jpg`, label: 'B-ROLL · A MOMENT OF STILLNESS', broll: true, camera: 3 },
  { id: 'payment-close', start: 66, end: 70, image: `${SCENE_BASE}scene-4-payment.jpg`, label: 'CAM 02 · PAYMENT CONFIRMATION', camera: 1 },
  { id: 'priest-wide', start: 70, end: 78, image: `${SCENE_BASE}scene-5-priest.jpg`, label: 'CAM 01 · SENIOR SCHOLAR REVIEW', camera: 1 },
  { id: 'rasi-priest-insert', start: 78, end: 83, image: `${SCENE_BASE}broll-rasi-chart-hands.jpg`, label: 'B-ROLL · TWELVE-HOUSE READING', broll: true, camera: 3 },
  { id: 'priest-close', start: 83, end: 89, image: `${SCENE_BASE}scene-5-priest.jpg`, label: 'CAM 02 · REPORT PREPARATION', camera: 2 },
  { id: 'delivery-wide', start: 89, end: 98, image: `${SCENE_BASE}scene-6-delivery.jpg`, label: 'CAM 01 · QUALITY REVIEW', camera: 3 },
  { id: 'temple-delivery-insert', start: 98, end: 102, image: `${SCENE_BASE}broll-temple-sanctum.jpg`, label: 'B-ROLL · PRAYERFUL CLOSE', broll: true, camera: 2 },
  { id: 'delivery-close', start: 102, end: 108, image: `${SCENE_BASE}scene-6-delivery.jpg`, label: 'CAM 02 · REPORT + INVOICE', camera: 1 },
];

const SERVICE_CHOICES = [
  { title: 'Birth Jathagam', subtitle: 'Janma Kundali', mark: 'ஜ', kind: 'kundali' },
  { title: 'Marriage Match', subtitle: '10 Porutham', mark: '♡', kind: 'match' },
  { title: 'Baby Naming', subtitle: 'Nama Karanam', mark: '✦', kind: 'naming' },
  { title: 'Subha Muhurtham', subtitle: '18 ceremonies', mark: '◷', kind: 'muhurtham' },
];

const ZODIAC_SHORT = ['Mes', 'Rish', 'Mith', 'Kad', 'Sim', 'Kany', 'Thul', 'Vri', 'Dhan', 'Mak', 'Kumb', 'Meen'];
const ZODIAC_FULL = ['Mesha', 'Rishabha', 'Mithuna', 'Kataka', 'Simha', 'Kanya', 'Thula', 'Vrischika', 'Dhanus', 'Makara', 'Kumbha', 'Meena'];
const SAMPLE_GRAHAS = [
  { short: 'Su', name: 'Sun', longitude: 125.2 },
  { short: 'Mo', name: 'Moon', longitude: 212.8 },
  { short: 'Ma', name: 'Mars', longitude: 42.4 },
  { short: 'Me', name: 'Mercury', longitude: 140.6 },
  { short: 'Ju', name: 'Jupiter', longitude: 17.9 },
  { short: 'Ve', name: 'Venus', longitude: 93.3 },
  { short: 'Sa', name: 'Saturn', longitude: 275.1 },
  { short: 'Ra', name: 'Rahu', longitude: 183.5 },
  { short: 'Ke', name: 'Ketu', longitude: 3.5 },
];
const SAMPLE_LAGNA_LONGITUDE = 112.6;
const SOUTH_INDIAN_CELL_POSITIONS = [
  { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 1, column: 3 }, { row: 1, column: 4 },
  { row: 2, column: 4 }, { row: 3, column: 4 }, { row: 4, column: 4 }, { row: 4, column: 3 },
  { row: 4, column: 2 }, { row: 4, column: 1 }, { row: 3, column: 1 }, { row: 2, column: 1 },
];

const activeStepForTime = (time: number) => {
  const found = STEPS.findIndex((step) => time >= step.startSec && time < step.endSec);
  return found < 0 ? STEPS.length - 1 : found;
};

const getShotForTime = (time: number) => CINEMA_SHOTS.find((shot) => time >= shot.start && time < shot.end) ?? CINEMA_SHOTS[CINEMA_SHOTS.length - 1];

const formatTime = (time: number) => {
  const safeTime = Math.max(0, Math.min(TOTAL_VIDEO_DURATION, time));
  const minutes = Math.floor(safeTime / 60);
  const seconds = Math.floor(safeTime % 60);
  const tenths = Math.floor((safeTime % 1) * 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
};

const revealText = (value: string, localTime: number, start: number, duration: number) => {
  if (localTime <= start) return '';
  const amount = Math.min(1, (localTime - start) / duration);
  return value.slice(0, Math.floor(value.length * amount));
};

const getNavamsaSign = (longitude: number) => {
  const rasi = Math.floor(((longitude % 360) + 360) % 360 / 30);
  const navamsa = Math.min(8, Math.floor((longitude % 30) / (30 / 9)));
  const startingSign = rasi % 3 === 0 ? rasi : rasi % 3 === 1 ? (rasi + 8) % 12 : (rasi + 4) % 12;
  return (startingSign + navamsa) % 12;
};

const getCursorPosition = (stepIndex: number, localTime: number) => {
  if (stepIndex === 0) return localTime < 4.5 ? { x: 70, y: 42 } : localTime < 10.8 ? { x: 46, y: 66 } : { x: 52, y: 88 };
  if (stepIndex === 1) {
    const service = localTime < 7.2 ? 0 : localTime < 8.8 ? 1 : localTime < 10.5 ? 2 : 3;
    return [{ x: 27, y: 57 }, { x: 73, y: 57 }, { x: 27, y: 83 }, { x: 73, y: 83 }][service];
  }
  if (stepIndex === 2) return localTime < 5 ? { x: 57, y: 34 } : localTime < 9.5 ? { x: 57, y: 58 } : { x: 59, y: 82 };
  if (stepIndex === 3) return localTime < 4.2 ? { x: 22, y: 66 } : localTime < 8.5 ? { x: 50, y: 66 } : { x: 78, y: 66 };
  if (stepIndex === 4) return localTime < 8 ? { x: 76, y: 30 } : { x: 51, y: 83 };
  return localTime < 7 ? { x: 30, y: 69 } : { x: 73, y: 69 };
};

const clickMomentsByStep = [[4.6, 11.2], [6.3, 7.9, 9.4, 13.6], [4.7, 9.6, 12.2], [5.5, 8.2, 11.1], [7.6, 12.4], [6.8, 12.8, 16.4]];

const SouthIndianChart: React.FC<{ localTime: number }> = ({ localTime }) => {
  const navamsaView = localTime >= 9.3;
  const chartTitle = navamsaView ? 'D-9 Navamsha' : 'Rāsi · D-1';
  const lagnaSign = navamsaView ? getNavamsaSign(SAMPLE_LAGNA_LONGITUDE) : Math.floor(SAMPLE_LAGNA_LONGITUDE / 30);
  const scanHouse = (Math.floor(localTime * 0.72) % 12) + 1;
  const progress = Math.min(100, Math.max(5, (localTime / 17.2) * 100));

  const planetsBySign = useMemo(() => {
    const bySign = new Map<number, string[]>();
    SAMPLE_GRAHAS.forEach((graha) => {
      const sign = navamsaView ? getNavamsaSign(graha.longitude) : Math.floor(graha.longitude / 30);
      bySign.set(sign, [...(bySign.get(sign) ?? []), graha.short]);
    });
    bySign.set(lagnaSign, [...(bySign.get(lagnaSign) ?? []), 'As']);
    return bySign;
  }, [lagnaSign, navamsaView]);

  return (
    <div className="hiw-chart-card">
      <div className="hiw-chart-card__head">
        <div>
          <span className="hiw-screen-eyebrow">LIVE CALCULATION PREVIEW</span>
          <h3>South Indian horoscope</h3>
        </div>
        <span className="hiw-chart-mode">{chartTitle}</span>
      </div>
      <div className="hiw-chart-meta"><span>Sample positions · Lahiri ayanāṁśa</span><span>12 bhāvas</span></div>
      <div className="hiw-south-chart" aria-label={`${chartTitle} twelve-house sample chart`}>
        {SOUTH_INDIAN_CELL_POSITIONS.map((position, sign) => {
          const house = ((sign - lagnaSign + 12) % 12) + 1;
          const contents = planetsBySign.get(sign) ?? [];
          const isScanning = house === scanHouse;
          return (
            <div
              key={sign}
              className={`hiw-south-chart__cell${isScanning ? ' is-scanning' : ''}${contents.includes('As') ? ' is-lagna' : ''}`}
              style={{ gridRow: position.row, gridColumn: position.column }}
            >
              <span className="hiw-south-chart__house">{house}</span>
              <span className="hiw-south-chart__sign">{ZODIAC_SHORT[sign]}</span>
              <span className="hiw-south-chart__grahas">{contents.join(' · ') || '—'}</span>
            </div>
          );
        })}
        <div className="hiw-south-chart__center">
          <strong>{chartTitle}</strong>
          <span>Lagna · {ZODIAC_FULL[lagnaSign]}</span>
          <small>{navamsaView ? 'Navāṁśa mapping' : 'Rāsi mapping'} in progress</small>
        </div>
      </div>
      <div className="hiw-chart-progress" aria-label={`Sample chart calculation ${Math.round(progress)} percent`}>
        <div className="hiw-chart-progress__label"><span>Checking bhāva {scanHouse} of 12</span><span>{Math.round(progress)}%</span></div>
        <div className="hiw-chart-progress__track"><span style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="hiw-chart-disclaimer">Illustrative sample only · personalized positions use submitted birth details.</div>
    </div>
  );
};

const WalkthroughPanel: React.FC<{ stepIndex: number; localTime: number }> = ({ stepIndex, localTime }) => {
  const cursor = getCursorPosition(stepIndex, localTime);
  const selectedServiceIndex = localTime < 7.2 ? 0 : localTime < 8.8 ? 1 : localTime < 10.5 ? 2 : 3;
  const selectedPaymentIndex = localTime < 6.8 ? 0 : localTime < 9.7 ? 1 : 2;
  const isClicking = (clickMomentsByStep[stepIndex] ?? []).some((moment) => Math.abs(localTime - moment) < 0.2);
  const cursorStyle = { left: `${cursor.x}%`, top: `${cursor.y}%` };

  return (
    <div className="hiw-demo-panel" aria-label={`Live interface walkthrough: ${STEPS[stepIndex].title}`}>
      <div className="hiw-demo-chrome">
        <div className="hiw-demo-chrome__lights"><i /><i /><i /></div>
        <div className="hiw-demo-chrome__address"><LockKeyhole aria-hidden="true" /> app.astrosivam.com <span>SECURE PORTAL</span></div>
        <span className="hiw-demo-chrome__live"><i /> LIVE</span>
      </div>
      <div className={`hiw-demo-surface hiw-demo-surface--step-${stepIndex + 1}`}>
        {stepIndex === 0 && (
          <div className="hiw-login-screen">
            <div className="hiw-demo-brand"><span className="hiw-demo-brand__mark">✦</span><span>ASTRO <b>SIVAM</b></span></div>
            <div className="hiw-login-screen__welcome">
              <span className="hiw-screen-eyebrow">USER PORTAL</span>
              <h3>Welcome back</h3>
              <p>Sign in to continue your journey.</p>
            </div>
            <button className="hiw-demo-google" type="button" tabIndex={-1}><b>G</b> Continue with Google <span>↗</span></button>
            <div className="hiw-demo-divider"><span>or continue with email</span></div>
            <label className="hiw-demo-label">EMAIL ADDRESS</label>
            <div className="hiw-demo-input"><Mail aria-hidden="true" /><span>{revealText('sivam.user@example.com', localTime, 3.1, 3.3)}</span><i /></div>
            <label className="hiw-demo-label">PASSWORD</label>
            <div className="hiw-demo-input"><LockKeyhole aria-hidden="true" /><span className="hiw-password-dots">{'●'.repeat(Math.min(12, Math.max(0, Math.floor((localTime - 6.8) * 3))))}</span></div>
            <button className={`hiw-demo-primary${localTime > 11 ? ' is-confirmed' : ''}`} type="button" tabIndex={-1}>
              {localTime > 11 ? <><Check aria-hidden="true" /> Secure sign-in verified</> : <>Sign in securely <ArrowRight aria-hidden="true" /></>}
            </button>
            <div className="hiw-demo-footnote"><ShieldCheck aria-hidden="true" /> Your user details stay private.</div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="hiw-services-screen">
            <div className="hiw-screen-heading"><div><span className="hiw-screen-eyebrow">NEW CONSULTATION</span><h3>Choose your service</h3></div><span className="hiw-step-stamp">01 / 04</span></div>
            <div className="hiw-services-grid">
              {SERVICE_CHOICES.map((service, index) => {
                const selected = selectedServiceIndex === index;
                return (
                  <div key={service.kind} className={`hiw-service-tile${selected ? ' is-selected' : ''}`}>
                    <span className={`hiw-service-tile__mark hiw-service-tile__mark--${service.kind}`}>{service.mark}</span>
                    <span className="hiw-service-tile__copy"><b>{service.title}</b><small>{service.subtitle}</small></span>
                    <span className="hiw-service-tile__check">{selected ? <Check aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</span>
                  </div>
                );
              })}
            </div>
            <div className="hiw-demo-summary"><Sparkles aria-hidden="true" /><span><b>Selected service</b><small>{SERVICE_CHOICES[selectedServiceIndex].title}</small></span><button type="button" tabIndex={-1}>Continue <ArrowRight aria-hidden="true" /></button></div>
            <div className="hiw-demo-footnote">Your order summary is shown before checkout.</div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="hiw-details-screen">
            <div className="hiw-screen-heading"><div><span className="hiw-screen-eyebrow">JANMA KUNDALI · DETAILS</span><h3>Tell us about the birth</h3></div><span className="hiw-step-stamp">STEP 02 / 04</span></div>
            <div className="hiw-details-form">
              <label className="hiw-demo-label">USER NAME<div className="hiw-demo-input"><span>{revealText('Arun Kumar', localTime, 1.1, 2.8)}</span><i /></div></label>
              <div className="hiw-details-form__row">
                <label className="hiw-demo-label">DATE OF BIRTH<div className="hiw-demo-input"><Calendar aria-hidden="true" /><span>{localTime > 4.5 ? '14 / 08 / 1992' : 'DD / MM / YYYY'}</span></div></label>
                <label className="hiw-demo-label">BIRTH TIME<div className="hiw-demo-input"><Clock aria-hidden="true" /><span>{localTime > 6.3 ? '06:42 AM' : '--:-- --'}</span></div></label>
              </div>
              <label className="hiw-demo-label">BIRTH PLACE<div className={`hiw-demo-input hiw-place-input${localTime > 13.1 ? ' is-resolved' : ''}`}><MapPin aria-hidden="true" /><span>{revealText('Chennai, Tamil Nadu, India', localTime, 10.1, 3) || 'Search city or place'}</span><small>{localTime > 13.1 ? 'FOUND' : 'SEARCH'}</small></div></label>
              <div className="hiw-coordinate-row"><span><i /> GOOGLE PLACES · {localTime > 13.1 ? 'FOUND' : 'SEARCHING'}</span><b>{localTime > 13.1 ? '13.0827° N · 80.2707° E' : 'Place coordinates pending'}</b><span>{localTime > 13.1 ? 'UTC +05:30' : 'TIMEZONE'}</span></div>
            </div>
            <div className="hiw-demo-footnote">Required details are checked before the chart is prepared.</div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="hiw-payment-screen">
            <div className="hiw-screen-heading"><div><span className="hiw-screen-eyebrow">ORDER CHECKOUT · DEMO</span><h3>Select a payment route</h3></div><span className="hiw-step-stamp">SECURE</span></div>
            <div className="hiw-payment-methods">
              {[
                { title: 'Google Pay', region: 'India', mark: 'G', type: 'gpay' },
                { title: 'PayPal', region: 'International', mark: 'P', type: 'paypal' },
                { title: 'M-PAiSA', region: 'Fiji · Vodafone', mark: 'M', type: 'mpaisa' },
              ].map((method, index) => {
                const selected = selectedPaymentIndex === index;
                return (
                  <div key={method.type} className={`hiw-payment-method hiw-payment-method--${method.type}${selected ? ' is-selected' : ''}`}>
                    <span className="hiw-payment-method__mark">{method.mark}</span>
                    <span className="hiw-payment-method__text"><b>{method.title}</b><small>{method.region}</small></span>
                    <span className="hiw-payment-method__check">{selected ? <Check aria-hidden="true" /> : null}</span>
                  </div>
                );
              })}
            </div>
            <div className="hiw-checkout-summary"><span>Consultation service</span><b>Secure order · reviewed before payment</b></div>
            <button className="hiw-demo-primary hiw-demo-primary--checkout" type="button" tabIndex={-1}><LockKeyhole aria-hidden="true" /> Continue to secure checkout <ArrowRight aria-hidden="true" /></button>
            <div className="hiw-demo-footnote"><ShieldCheck aria-hidden="true" /> Payment options are region-aware. No transaction is made in this preview.</div>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="hiw-chart-screen">
            <div className="hiw-screen-heading"><div><span className="hiw-screen-eyebrow">SCHOLAR WORKSPACE · SAMPLE</span><h3>Chart review in progress</h3></div><span className="hiw-computing-pulse"><i /> COMPUTING</span></div>
            <SouthIndianChart localTime={localTime} />
            <div className="hiw-chart-screen__footer"><span><Crown aria-hidden="true" /> Senior Sivachariyar review</span><span>Rāsi <i /> D-9</span></div>
          </div>
        )}

        {stepIndex === 5 && (
          <div className="hiw-delivery-screen">
            <div className="hiw-screen-heading"><div><span className="hiw-screen-eyebrow">ORDER REVIEW · COMPLETE</span><h3>Two documents, together</h3></div><span className={`hiw-delivery-status${localTime > 13.4 ? ' is-sent' : ''}`}><i />{localTime > 13.4 ? 'SENT' : 'APPROVED'}</span></div>
            <div className="hiw-approval-row"><span className="hiw-approval-row__seal"><Check aria-hidden="true" /></span><span><b>Admin quality review</b><small>{localTime > 5.8 ? 'Verified · ready for dispatch' : 'Checking report & invoice'}</small></span><span className="hiw-approved-stamp">APPROVED</span></div>
            <div className={`hiw-document-pair${localTime > 13.4 ? ' is-delivered' : ''}`}>
              <div className="hiw-document-card hiw-document-card--report"><span className="hiw-document-card__icon"><FileText aria-hidden="true" /></span><span className="hiw-document-card__copy"><b>Astrological Report</b><small>Personalized report · PDF</small></span><span className="hiw-document-card__check"><Check aria-hidden="true" /></span></div>
              <div className="hiw-document-card hiw-document-card--invoice"><span className="hiw-document-card__icon"><Receipt aria-hidden="true" /></span><span className="hiw-document-card__copy"><b>Tax Invoice</b><small>Official receipt · PDF</small></span><span className="hiw-document-card__check"><Check aria-hidden="true" /></span></div>
            </div>
            <div className="hiw-delivery-route"><span className="hiw-delivery-route__mail"><Mail aria-hidden="true" /></span><span className="hiw-delivery-route__line"><i /></span><span className="hiw-delivery-route__inbox"><Check aria-hidden="true" /></span><span className="hiw-delivery-route__label">User inbox &amp; client portal</span></div>
            <div className="hiw-demo-footnote"><Clock aria-hidden="true" /> Prepared daily 9:00 AM – 11:00 AM IST; PDF emailed after admin approval.</div>
          </div>
        )}
        <div className={`hiw-walkthrough-cursor${isClicking ? ' is-clicking' : ''}`} style={cursorStyle} aria-hidden="true"><MousePointer2 /></div>
      </div>
    </div>
  );
};

const NarratorPip: React.FC<{ waveform: number[]; waveformMode: string; isSpeaking: boolean }> = ({ waveform, waveformMode, isSpeaking }) => (
  <div className="hiw-narrator-pip" aria-label="Narrator picture-in-picture: Siva Sri Mohan Sivam">
    <div className="hiw-narrator-pip__portrait"><img src={`${SCENE_BASE}narrator-acharya.jpg`} alt="Siva Sri Mohan Sivam" /></div>
    <div className="hiw-narrator-pip__info">
      <div className="hiw-narrator-pip__eyebrow"><span className={isSpeaking ? 'is-live' : ''} /> SOUTH INDIAN VOICE</div>
      <strong>Siva Sri Mohan Sivam</strong>
      <span className="hiw-narrator-pip__role">Original male narration</span>
      <div className="hiw-waveform" aria-label={`Voice waveform · ${waveformMode}`}>
        {waveform.map((value, index) => <i key={index} style={{ height: `${Math.max(10, Math.min(100, value * 100))}%` }} />)}
      </div>
      <span className="hiw-narrator-pip__wave-label">{waveformMode}</span>
    </div>
  </div>
);

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAmbienceOn, setIsAmbienceOn] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('hybrid');
  const [captionsOn, setCaptionsOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seekRevision, setSeekRevision] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => 0.14 + Math.abs(Math.sin(index * 0.71)) * 0.18));
  const [waveformMode, setWaveformMode] = useState('VOICE METER');
  const [envelopeReady, setEnvelopeReady] = useState(false);

  const playerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playheadRef = useRef(0);
  const lastDisplayedTenthRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const narrationRequestRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ambienceGainRef = useRef<GainNode | null>(null);
  const ambienceNodesRef = useRef<OscillatorNode[]>([]);
  const envelopeLoadStartedRef = useRef(false);
  const speechEnvelopeRef = useRef<Record<number, SpeechEnvelope>>({});
  const waveformModeRef = useRef('VOICE METER');

  const activeStepIndex = activeStepForTime(currentTime);
  const activeStep = STEPS[activeStepIndex];
  const localTime = Math.max(0, currentTime - activeStep.startSec);
  const activeShot = getShotForTime(currentTime);
  const progress = (currentTime / TOTAL_VIDEO_DURATION) * 100;
  const activeCaption = activeStep.captions.find((caption) => localTime >= caption.start && localTime < caption.end)?.text;
  const isComplete = currentTime >= TOTAL_VIDEO_DURATION;

  const setWaveformLabel = useCallback((label: string) => {
    if (waveformModeRef.current !== label) {
      waveformModeRef.current = label;
      setWaveformMode(label);
    }
  }, []);

  const extractSpeechEnvelope = useCallback((context: AudioContext) => {
    if (envelopeLoadStartedRef.current) return;
    envelopeLoadStartedRef.current = true;

    void Promise.all(STEPS.map(async (step, index) => {
      try {
        const response = await fetch(`${AUDIO_BASE}${index + 1}.mp3`);
        if (!response.ok) return;
        const encodedAudio = await response.arrayBuffer();
        const decodedAudio = await context.decodeAudioData(encodedAudio.slice(0));
        const samples = decodedAudio.getChannelData(0);
        const samplesPerBucket = Math.max(1, Math.floor(decodedAudio.sampleRate * 0.045));
        const envelope = new Float32Array(Math.ceil(samples.length / samplesPerBucket));
        let peak = 0;

        for (let bucket = 0; bucket < envelope.length; bucket += 1) {
          const start = bucket * samplesPerBucket;
          const end = Math.min(samples.length, start + samplesPerBucket);
          let energy = 0;
          for (let sample = start; sample < end; sample += 1) energy += samples[sample] * samples[sample];
          const rms = Math.sqrt(energy / Math.max(1, end - start));
          envelope[bucket] = rms;
          peak = Math.max(peak, rms);
        }

        if (peak > 0) {
          for (let bucket = 0; bucket < envelope.length; bucket += 1) {
            envelope[bucket] = Math.min(1, Math.pow(envelope[bucket] / peak, 0.68));
          }
        }
        speechEnvelopeRef.current[index + 1] = { values: envelope, duration: decodedAudio.duration || step.narrationDuration };
      } catch {
        // The analyser remains available even if a browser declines offline decoding.
      }
    })).then(() => setEnvelopeReady(Object.keys(speechEnvelopeRef.current).length > 0));
  }, []);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (typeof window === 'undefined' || !audio) return;
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      let context = audioContextRef.current;
      if (!context) {
        context = new AudioContextConstructor();
        audioContextRef.current = context;
      }

      if (!audioSourceRef.current) {
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.76;
        source.connect(analyser);
        analyser.connect(context.destination);
        audioSourceRef.current = source;
        analyserRef.current = analyser;
      }

      if (!ambienceGainRef.current) {
        const ambienceBus = context.createGain();
        const lowPass = context.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 780;
        ambienceBus.gain.value = 0;
        ambienceBus.connect(lowPass);
        lowPass.connect(context.destination);
        [110, 164.81, 220].forEach((frequency, index) => {
          const drone = context.createOscillator();
          const voiceGain = context.createGain();
          drone.type = index === 1 ? 'triangle' : 'sine';
          drone.frequency.value = frequency;
          voiceGain.gain.value = index === 0 ? 0.34 : 0.2;
          drone.connect(voiceGain);
          voiceGain.connect(ambienceBus);
          drone.start();
          ambienceNodesRef.current.push(drone);
        });
        ambienceGainRef.current = ambienceBus;
      }

      audio.muted = isMuted;
      ambienceGainRef.current.gain.setTargetAtTime(isAmbienceOn && isPlaying ? 0.028 : 0, context.currentTime, 0.28);
      if (context.state === 'suspended') await context.resume();
      extractSpeechEnvelope(context);
    } catch {
      // The HTML audio element still plays normally if Web Audio is unavailable.
    }
  }, [extractSpeechEnvelope, isAmbienceOn, isMuted, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = isMuted;
      if (!isPlaying || isMuted) audio.pause();
    }
    const context = audioContextRef.current;
    if (context && ambienceGainRef.current) {
      ambienceGainRef.current.gain.setTargetAtTime(isAmbienceOn && isPlaying ? 0.028 : 0, context.currentTime, 0.28);
    }
  }, [isAmbienceOn, isMuted, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      return;
    }

    let previousFrame = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.max(0, (now - previousFrame) / 1000);
      previousFrame = now;
      const nextTime = Math.min(TOTAL_VIDEO_DURATION, playheadRef.current + elapsed * playbackSpeed);
      playheadRef.current = nextTime;
      const displayedTenth = Math.floor(nextTime * 10);
      if (displayedTenth !== lastDisplayedTenthRef.current || nextTime >= TOTAL_VIDEO_DURATION) {
        lastDisplayedTenthRef.current = displayedTenth;
        setCurrentTime(nextTime >= TOTAL_VIDEO_DURATION ? TOTAL_VIDEO_DURATION : displayedTenth / 10);
      }

      if (nextTime >= TOTAL_VIDEO_DURATION) {
        setIsPlaying(false);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [isPlaying, playbackSpeed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const requestId = ++narrationRequestRef.current;

    if (!isPlaying || isMuted || isComplete) {
      audio.pause();
      return () => { narrationRequestRef.current += 1; };
    }

    const step = STEPS[activeStepIndex];
    const clipUrl = `${AUDIO_BASE}${activeStepIndex + 1}.mp3`;
    const seekOffset = Math.max(0, playheadRef.current - step.startSec);
    audio.muted = false;
    audio.playbackRate = playbackSpeed;

    const playFromOffset = () => {
      if (requestId !== narrationRequestRef.current) return;
      audio.playbackRate = playbackSpeed;
      const duration = Number.isFinite(audio.duration) ? audio.duration : step.narrationDuration;
      if (seekOffset >= duration) {
        audio.pause();
        return;
      }
      if (Math.abs(audio.currentTime - seekOffset) > 0.25) audio.currentTime = seekOffset;
      void audio.play().catch(() => undefined);
    };

    if (audio.dataset.clip !== String(activeStepIndex + 1)) {
      audio.pause();
      audio.dataset.clip = String(activeStepIndex + 1);
      audio.src = clipUrl;
      audio.load();
    }

    if (audio.readyState >= 1) playFromOffset();
    else audio.addEventListener('loadedmetadata', playFromOffset, { once: true });

    return () => { narrationRequestRef.current += 1; };
  }, [activeStepIndex, isComplete, isMuted, isPlaying, playbackSpeed, seekRevision]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  // Build the fallback waveform from decoded MP3 samples; live playback uses the AnalyserNode above it.
  useEffect(() => {
    let animationFrame = 0;
    let lastUpdate = 0;
    const frequencyData = new Uint8Array(64);

    const drawWaveform = (now: number) => {
      if (now - lastUpdate >= 65) {
        lastUpdate = now;
        const analyser = analyserRef.current;
        const audio = audioRef.current;
        let nextBars: number[];
        let label = 'METER PREVIEW';

        if (isPlaying && !isMuted && analyser) {
          analyser.getByteFrequencyData(frequencyData);
          nextBars = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
            const bin = Math.min(frequencyData.length - 1, 2 + Math.floor((index / (WAVEFORM_BAR_COUNT - 1)) * (frequencyData.length - 2)));
            return Math.max(0.11, frequencyData[bin] / 255);
          });
          label = 'LIVE · ANALYSER';
        } else {
          const stepIndex = activeStepForTime(playheadRef.current);
          const speech = speechEnvelopeRef.current[stepIndex + 1];
          if (speech) {
            const audioPosition = Math.max(0, Math.min(speech.duration, audio?.currentTime ?? playheadRef.current - STEPS[stepIndex].startSec));
            const center = Math.floor((audioPosition / Math.max(0.1, speech.duration)) * (speech.values.length - 1));
            const spacing = Math.max(1, Math.floor(speech.values.length / WAVEFORM_BAR_COUNT));
            nextBars = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
              const offset = (index - Math.floor(WAVEFORM_BAR_COUNT / 2)) * spacing;
              return Math.max(0.1, speech.values[Math.max(0, Math.min(speech.values.length - 1, center + offset))] ?? 0.1);
            });
            label = envelopeReady ? 'PRE-EXTRACTED VOICE' : 'SPEECH ENVELOPE';
          } else {
            const phase = playheadRef.current * 3.2;
            nextBars = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => 0.1 + Math.abs(Math.sin(index * 0.71 + phase)) * 0.25);
          }
        }

        setWaveform(nextBars);
        setWaveformLabel(label);
      }
      animationFrame = requestAnimationFrame(drawWaveform);
    };

    animationFrame = requestAnimationFrame(drawWaveform);
    return () => cancelAnimationFrame(animationFrame);
  }, [envelopeReady, isMuted, isPlaying, setWaveformLabel]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    audioRef.current?.pause();
    ambienceNodesRef.current.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
    });
    void audioContextRef.current?.close().catch(() => undefined);
  }, []);

  const playFromHere = useCallback(async () => {
    if (playheadRef.current >= TOTAL_VIDEO_DURATION) {
      playheadRef.current = 0;
      lastDisplayedTenthRef.current = 0;
      setCurrentTime(0);
    }
    await ensureAudioGraph();
    setIsPlaying(true);
  }, [ensureAudioGraph]);

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      const pausedAt = playheadRef.current;
      lastDisplayedTenthRef.current = Math.floor(pausedAt * 10);
      setCurrentTime(pausedAt);
      setIsPlaying(false);
      return;
    }
    await playFromHere();
  }, [isPlaying, playFromHere]);

  const seekTo = useCallback((time: number) => {
    const nextTime = Math.max(0, Math.min(TOTAL_VIDEO_DURATION, Math.round(time * 10) / 10));
    playheadRef.current = nextTime;
    lastDisplayedTenthRef.current = Math.floor(nextTime * 10);
    setCurrentTime(nextTime);
    setSeekRevision((revision) => revision + 1);
  }, []);

  const jumpToStep = useCallback(async (index: number) => {
    seekTo(STEPS[index].startSec);
    await ensureAudioGraph();
    setIsPlaying(true);
  }, [ensureAudioGraph, seekTo]);

  const restartPlayback = useCallback(async () => {
    seekTo(0);
    await ensureAudioGraph();
    setIsPlaying(true);
  }, [ensureAudioGraph, seekTo]);

  const toggleAmbience = useCallback(async () => {
    const next = !isAmbienceOn;
    setIsAmbienceOn(next);
    await ensureAudioGraph();
    const context = audioContextRef.current;
    if (context && ambienceGainRef.current) {
      ambienceGainRef.current.gain.setTargetAtTime(next && isPlaying ? 0.028 : 0, context.currentTime, 0.28);
    }
  }, [ensureAudioGraph, isAmbienceOn, isPlaying]);

  const toggleFullscreen = useCallback(async () => {
    const player = playerRef.current;
    if (!player || typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await player.requestFullscreen();
    } catch {
      // Fullscreen is optional on browsers or embedded contexts that deny the request.
    }
  }, []);

  const handleSpeedChange = (speed: number) => {
    const position = playheadRef.current;
    lastDisplayedTenthRef.current = Math.floor(position * 10);
    setCurrentTime(position);
    setPlaybackSpeed(speed);
  };

  const subtitle = captionsOn && activeCaption && currentTime < activeStep.startSec + activeStep.narrationDuration ? activeCaption : null;

  return (
    <main className="hiw-page">
      <SEO
        title="How It Works - Authentic Vedic Astrology Calculation Process | ASTRO SIVAM"
        description="See how ASTRO SIVAM guides users through service selection, secure checkout, traditional chart review, and report delivery."
        canonical="https://astrosivam.com/how-it-works"
      />
      <div className="hiw-container">
        <header className="hiw-hero">
          <div className="hiw-hero__eyebrow">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>A closer look at the process</span>
          </div>
          <h1>How ASTRO SIVAM works</h1>
          <p>A six-step journey, told through real South Indian cinema-inspired imagery and an original South Indian male narration. From your first sign-in to the report arriving in your inbox.</p>
          <div className="hiw-hero__facts">
            <span><Clock className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" /> 1 minute 48 seconds</span>
            <i />
            <span><Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" /> Six clear steps</span>
            <i />
            <span><ShieldCheck className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" /> Report + invoice delivery</span>
          </div>
        </header>

        <section className="hiw-player" ref={playerRef} aria-label="ASTRO SIVAM cinematic process film">
          <div className="hiw-player__topbar">
            <div className="hiw-player__brand">
              <span className="hiw-player__record"><i /> ASTRO SIVAM <small>· CINEMA JOURNAL</small></span>
              <span className="hiw-player__brand-sub">A guided look at your consultation</span>
            </div>
            <div className="hiw-player__tools">
              <div className="hiw-speed" aria-label="Playback speed">
                {[1, 1.25, 1.5].map((speed) => <button key={speed} type="button" aria-pressed={playbackSpeed === speed} onClick={() => handleSpeedChange(speed)}>{speed}×</button>)}
              </div>
              <button className={`hiw-tool-button${captionsOn ? ' is-on' : ''}`} type="button" onClick={() => setCaptionsOn((value) => !value)} aria-pressed={captionsOn} title={captionsOn ? 'Turn captions off' : 'Turn captions on'}><Captions aria-hidden="true" /><span>CC</span></button>
              <button className={`hiw-tool-button${isMuted ? '' : ' is-on'}`} type="button" onClick={() => setIsMuted((value) => !value)} aria-pressed={!isMuted} title={isMuted ? 'Turn narration on' : 'Mute narration'}>{isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<span>{isMuted ? 'Voice off' : 'Voice'}</span></button>
              <button className={`hiw-tool-button${isAmbienceOn ? ' is-on' : ''}`} type="button" onClick={() => void toggleAmbience()} aria-pressed={isAmbienceOn} title={isAmbienceOn ? 'Turn temple drone off' : 'Turn on a subtle Tambura temple drone'}><Music2 aria-hidden="true" /><span>Tambura</span></button>
              <button className="hiw-tool-button hiw-tool-button--square" type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>{isFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button>
            </div>
          </div>

          <div className="hiw-player__modebar">
            <div className="hiw-mode-switcher" role="group" aria-label="Cinema view mode">
              <span className="hiw-mode-switcher__label">VIEW</span>
              <button type="button" className={viewMode === 'hybrid' ? 'is-selected' : ''} aria-pressed={viewMode === 'hybrid'} onClick={() => setViewMode('hybrid')}><Layers aria-hidden="true" /><span>Cinema + live UI</span></button>
              <button type="button" className={viewMode === 'cinema' ? 'is-selected' : ''} aria-pressed={viewMode === 'cinema'} onClick={() => setViewMode('cinema')}><Eye aria-hidden="true" /><span>Full cinema footage</span></button>
              <button type="button" className={viewMode === 'focus' ? 'is-selected' : ''} aria-pressed={viewMode === 'focus'} onClick={() => setViewMode('focus')}><MousePointer2 aria-hidden="true" /><span>Focus UI walkthrough</span></button>
            </div>
            <div className="hiw-shot-label"><span>{activeShot.broll ? 'INSERT' : 'SHOT'}</span>{activeShot.label}</div>
          </div>

          <div className={`hiw-cinema__viewport hiw-view--${viewMode}`} aria-label={`${activeShot.label}; ${activeStep.title}`}>
            <img key={activeShot.id} className={`hiw-cinema__photo hiw-cinema__photo--camera-${activeShot.camera}`} src={activeShot.image} alt={`${activeShot.broll ? 'B-roll' : 'Cinematic scene'}: ${activeShot.label.toLowerCase()}`} />
            <div className="hiw-cinema__grade" />
            <div className="hiw-cinema__vignette" />
            <div className="hiw-cinema__grain" />
            <div className="hiw-cinema__lamp-glow" />
            <div className="hiw-cinema__corner-mark"><span>ASTRO SIVAM</span><i /> <span>108 SEC · SOUTH INDIAN VOICE</span></div>
            <div className="hiw-cinema__step-caption"><span>CHAPTER {String(activeStep.id).padStart(2, '0')}</span><strong>{activeStep.title}</strong><small>{activeStep.tagline}</small></div>

            {viewMode !== 'cinema' && <WalkthroughPanel key={activeStepIndex} stepIndex={activeStepIndex} localTime={localTime} />}
            <NarratorPip waveform={waveform} waveformMode={waveformMode} isSpeaking={isPlaying && !isMuted && localTime < activeStep.narrationDuration} />

            {subtitle && <div className="hiw-subtitle" role="status" aria-live="polite"><span>CC</span>{subtitle}</div>}

            {!isPlaying && !isComplete && currentTime === 0 && (
              <div className="hiw-play-intro">
                <button type="button" onClick={() => void playFromHere()} aria-label="Play the 108-second ASTRO SIVAM walkthrough"><Play aria-hidden="true" /></button>
                <div><span>THE USER JOURNEY · 01:48</span><strong>Begin the walkthrough</strong><small>Six steps · original South Indian male narration</small></div>
              </div>
            )}

            {!isPlaying && isComplete && (
              <div className="hiw-film-end">
                <div className="hiw-film-end__seal"><CheckCircle2 aria-hidden="true" /></div>
                <span>END OF FILM · 01:48</span>
                <h2>Your journey, clearly explained.</h2>
                <p>From first sign-in to a reviewed report and invoice, every step has a place.</p>
                <div><button type="button" onClick={() => void restartPlayback()}><RotateCcw aria-hidden="true" /> Replay film</button><button type="button" onClick={() => onNavigate('birth-jathagam')}>Start an order <ArrowRight aria-hidden="true" /></button></div>
              </div>
            )}
          </div>

          <div className="hiw-player__controls">
            <div className="hiw-timeline-wrap">
              <input
                className="hiw-timeline"
                type="range"
                min="0"
                max={TOTAL_VIDEO_DURATION}
                step="0.1"
                value={currentTime}
                aria-label="Seek through the 108-second film"
                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(TOTAL_VIDEO_DURATION)}`}
                style={{ '--progress': `${progress}%` } as React.CSSProperties}
                onChange={(event) => seekTo(Number(event.currentTarget.value))}
              />
              <div className="hiw-timeline__chapters" aria-hidden="true">
                {STEPS.slice(1).map((step) => <i key={step.id} style={{ left: `${(step.startSec / TOTAL_VIDEO_DURATION) * 100}%` }} />)}
              </div>
            </div>
            <div className="hiw-control-row">
              <div className="hiw-control-row__transport">
                <button type="button" className="hiw-play-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Pause film' : 'Play film'}>{isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}<span>{isPlaying ? 'Pause' : isComplete ? 'Replay' : currentTime === 0 ? 'Play film' : 'Resume'}</span></button>
                <button type="button" className="hiw-restart-button" onClick={() => void restartPlayback()} aria-label="Restart film"><RotateCcw aria-hidden="true" /></button>
                <span className="hiw-runtime"><b>{formatTime(currentTime)}</b><i>/</i>{formatTime(TOTAL_VIDEO_DURATION)}</span>
              </div>
              <div className="hiw-chapter-tabs" aria-label="Jump to a chapter">
                {STEPS.map((step, index) => <button key={step.id} type="button" className={index === activeStepIndex ? 'is-active' : ''} aria-current={index === activeStepIndex ? 'step' : undefined} onClick={() => void jumpToStep(index)}><i>{String(step.id).padStart(2, '0')}</i><span>{step.shortTitle.split('· ')[1]}</span></button>)}
              </div>
            </div>
          </div>
          <audio ref={audioRef} preload="auto" aria-hidden="true" />
        </section>

        <section className="hiw-steps-section" aria-labelledby="hiw-steps-title">
          <div className="hiw-section-heading">
            <div><span className="hiw-section-heading__eyebrow">A clear process, from start to finish</span><h2 id="hiw-steps-title">Six steps. One considered journey.</h2></div>
            <p>Choose a chapter in the film or open a step below to jump straight to that part of the story.</p>
          </div>
          <div className="hiw-step-grid">
            {STEPS.map((step, index) => (
              <button key={step.id} type="button" className={`hiw-step-card${index === activeStepIndex ? ' is-current' : ''}`} onClick={() => void jumpToStep(index)} aria-current={index === activeStepIndex ? 'step' : undefined}>
                <span className="hiw-step-card__top"><span className="hiw-step-card__icon">{step.icon}</span><span className="hiw-step-card__time">{formatTime(step.startSec)} — {formatTime(step.endSec)}</span></span>
                <span className="hiw-step-card__title">{step.title}</span>
                <span className="hiw-step-card__tagline">{step.tagline}</span>
                <span className="hiw-step-card__description">{step.description}</span>
                <span className="hiw-step-card__features">{step.features.map((feature) => <span key={feature}><CheckCircle2 aria-hidden="true" />{feature}</span>)}</span>
                <span className="hiw-step-card__open">Open this chapter <ArrowRight aria-hidden="true" /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="hiw-trust-band">
          <div className="hiw-trust-band__icon"><ShieldCheck aria-hidden="true" /></div>
          <div className="hiw-trust-band__copy"><span>TRADITIONAL REVIEW · CLEAR DELIVERY</span><h2>Thoughtful astrology, with a process you can follow.</h2><p>Our team reviews each order before delivery. Your astrological report and tax invoice are prepared as separate documents and sent together after approval.</p></div>
          <button type="button" onClick={() => onNavigate('birth-jathagam')}>Explore services <ArrowRight aria-hidden="true" /></button>
        </section>

        <section className="hiw-final-cta">
          <div className="hiw-final-cta__ornament">✦</div>
          <div><span>BEGIN WHEN YOU’RE READY</span><h2>Start with the service that matters to you.</h2><p>Explore a birth Jathagam, marriage compatibility, baby naming, or an auspicious Muhurtham consultation.</p></div>
          <div className="hiw-final-cta__actions"><button type="button" onClick={() => onNavigate('birth-jathagam')}>Explore services <ArrowRight aria-hidden="true" /></button><button type="button" onClick={() => onNavigate('login')}>User login <ChevronRight aria-hidden="true" /></button></div>
        </section>
      </div>
    </main>
  );
};
