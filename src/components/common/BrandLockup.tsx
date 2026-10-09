import React from 'react';
import logoImg from '../../assets/astrosivam_logo.png';

/**
 * ASTRO SIVAM brand lockup — emblem, wordmark, slogan.
 *
 * The brand line is fixed by LOGO_BRAND_GUIDELINES.md §9: the name plus its
 * slogan, and nothing else. It lives here once instead of being retyped in every
 * page that shows the mark, so the slogan can never drift or go missing.
 */
export const BRAND_NAME = 'ASTRO SIVAM';
export const BRAND_SLOGAN = 'INDIAN VEDIC ASTROLOGY';

/**
 * Horizontal lock-up: emblem on the left, name over slogan on the right.
 *
 * The footer's treatment is the reference, so its classes live here once and the
 * navbar uses the very same component — the two can no longer drift apart. The
 * type classes are deliberately not overridable; only the emblem can be sized
 * per surface.
 */
const BRAND_EMBLEM_CLASS =
  'w-11 h-11 sm:w-12 sm:h-12 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)]';
const BRAND_NAME_CLASS =
  'text-xl sm:text-2xl font-black tracking-wider uppercase bg-gradient-to-r from-[#ffe58f] via-[#ffd54f] to-[#f59e0b] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight font-serif';
const BRAND_SLOGAN_CLASS =
  'text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-[#d4af37] uppercase leading-none mt-0.5';

interface BrandWordmarkProps {
  /** Sizing/effects for the emblem image. Defaults to the footer's sizing. */
  emblemClassName?: string;
  /** Alt text — pass '' when the surrounding control already announces the name. */
  emblemAlt?: string;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  emblemClassName = BRAND_EMBLEM_CLASS,
  emblemAlt = `${BRAND_NAME} Emblem`,
}) => (
  <>
    <span className="relative flex shrink-0 items-center justify-center">
      <img
        src={logoImg}
        alt={emblemAlt}
        referrerPolicy="no-referrer"
        className={emblemClassName}
      />
    </span>
    <span className="flex flex-col justify-center">
      <span className={BRAND_NAME_CLASS}>{BRAND_NAME}</span>
      <span className={BRAND_SLOGAN_CLASS}>{BRAND_SLOGAN}</span>
    </span>
  </>
);

interface BrandLockupProps {
  /** Extra classes for the wrapper. */
  className?: string;
  /** Emblem frame size — defaults to the 96px circle the auth pages used. */
  emblemClassName?: string;
  /** Wordmark size classes. */
  nameClassName?: string;
  /** Slogan size classes. */
  sloganClassName?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({
  className = '',
  emblemClassName = 'w-24 h-24',
  nameClassName = 'text-2xl',
  sloganClassName = 'text-[8px] tracking-[0.08em]',
}) => (
  <div className={`flex flex-col items-center text-center select-none ${className}`}>
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/60 bg-black p-1 shadow-xl ${emblemClassName}`}
    >
      <img
        src={logoImg}
        alt={`${BRAND_NAME} emblem`}
        referrerPolicy="no-referrer"
        className="h-full w-full rounded-full object-cover"
      />
    </div>

    {/* Slogan sits directly under the name — same lockup as the navbar/footer. */}
    <span
      className={`mt-3 block whitespace-nowrap font-serif font-black uppercase leading-tight tracking-wider text-[#0b1f4b] dark:text-[#f5c474] ${nameClassName}`}
    >
      {BRAND_NAME}
    </span>
    {/* Type size split is 3:1 (name : slogan) — see the note in Navbar.tsx. */}
    <span
      className={`mt-1 block whitespace-nowrap font-bold uppercase leading-none text-amber-600 dark:text-[#d4af37] ${sloganClassName}`}
    >
      {BRAND_SLOGAN}
    </span>
  </div>
);
