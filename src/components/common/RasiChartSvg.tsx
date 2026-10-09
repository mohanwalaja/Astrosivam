import React, { useState } from 'react';
import { PlanetPosition, AppLanguage, Rasi, Graha } from '../../types';

export type ChartStyle = 'south' | 'north';
export type ChartDivision = 'rasi' | 'navamsa';

interface RasiChartSvgProps {
  title?: string;
  lagnaRasiNumber?: number; // 1 to 12
  lagnaRasi?: number; // alias
  planets: PlanetPosition[];
  navamsaPositions?: Record<string, { rasi: Rasi; rasiNameTa: string; rasiNameEn: string; rasiNameHi: string; isVargottama?: boolean }>;
  lagnaNavamsaRasi?: number;
  language?: AppLanguage;
  size?: number;
  allowToggleStyle?: boolean;
  allowToggleDivision?: boolean;
  defaultStyle?: ChartStyle;
  defaultDivision?: ChartDivision;
}

const SIGN_INFO: Record<number, { nameEn: string; nameTa: string; nameHi: string; shortEn: string; shortTa: string; shortHi: string }> = {
  1:  { nameEn: 'Mesham (Aries)', nameTa: 'மேஷம்', nameHi: 'मेष', shortEn: 'Ar', shortTa: 'மேஷ', shortHi: 'मेष' },
  2:  { nameEn: 'Rishabam (Taurus)', nameTa: 'ரிஷபம்', nameHi: 'वृषभ', shortEn: 'Ta', shortTa: 'ரிஷ', shortHi: 'वृष' },
  3:  { nameEn: 'Mithunam (Gemini)', nameTa: 'மிதுனம்', nameHi: 'मिथुन', shortEn: 'Ge', shortTa: 'மிது', shortHi: 'मिथु' },
  4:  { nameEn: 'Kadagam (Cancer)', nameTa: 'கடகம்', nameHi: 'कर्क', shortEn: 'Ca', shortTa: 'கட', shortHi: 'कर्क' },
  5:  { nameEn: 'Simham (Leo)', nameTa: 'சிம்மம்', nameHi: 'सिंह', shortEn: 'Le', shortTa: 'சிம்', shortHi: 'सिंह' },
  6:  { nameEn: 'Kanni (Virgo)', nameTa: 'கன்னி', nameHi: 'कन्या', shortEn: 'Vi', shortTa: 'கன்', shortHi: 'कन्य' },
  7:  { nameEn: 'Thulam (Libra)', nameTa: 'துலாம்', nameHi: 'तुला', shortEn: 'Li', shortTa: 'துலா', shortHi: 'तुला' },
  8:  { nameEn: 'Viruchigam (Scorpio)', nameTa: 'விருச்சிகம்', nameHi: 'वृश्चिक', shortEn: 'Sc', shortTa: 'விரு', shortHi: 'वृश्चि' },
  9:  { nameEn: 'Dhanusu (Sagittarius)', nameTa: 'தனுசு', nameHi: 'धनु', shortEn: 'Sa', shortTa: 'தனு', shortHi: 'धनु' },
  10: { nameEn: 'Magaram (Capricorn)', nameTa: 'மகரம்', nameHi: 'मकर', shortEn: 'Cp', shortTa: 'மக', shortHi: 'मकर' },
  11: { nameEn: 'Kumbam (Aquarius)', nameTa: 'கும்பம்', nameHi: 'कुंभ', shortEn: 'Aq', shortTa: 'கும்', shortHi: 'कुंभ' },
  12: { nameEn: 'Meenam (Pisces)', nameTa: 'மீனம்', nameHi: 'मीन', shortEn: 'Pi', shortTa: 'மீன', shortHi: 'मीन' }
};

const isValidRasiNumber = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
};

const PLANET_LABELS: Record<string, { en: string; ta: string; hi: string }> = {
  sun:     { en: 'Su', ta: 'சூரி', hi: 'सूर्य' },
  moon:    { en: 'Mo', ta: 'சந்', hi: 'चंद्र' },
  mars:    { en: 'Ma', ta: 'செவ்', hi: 'मंगल' },
  mercury: { en: 'Me', ta: 'புத', hi: 'बुध' },
  jupiter: { en: 'Ju', ta: 'குரு', hi: 'गुरु' },
  venus:   { en: 'Ve', ta: 'சுக்', hi: 'शुक्र' },
  saturn:  { en: 'Sa', ta: 'சனி', hi: 'शनि' },
  rahu:    { en: 'Ra', ta: 'ராகு', hi: 'राहु' },
  ketu:    { en: 'Ke', ta: 'கேது', hi: 'केतु' }
};

// South Indian Sign grid layout (Fixed 4x4)
const SOUTH_SIGN_GRID: Record<number, { col: number; row: number }> = {
  12: { col: 0, row: 0 }, 1:  { col: 1, row: 0 }, 2:  { col: 2, row: 0 }, 3:  { col: 3, row: 0 },
  11: { col: 0, row: 1 },                                                  4:  { col: 3, row: 1 },
  10: { col: 0, row: 2 },                                                  5:  { col: 3, row: 2 },
  9:  { col: 0, row: 3 }, 8:  { col: 1, row: 3 }, 7:  { col: 2, row: 3 }, 6:  { col: 3, row: 3 }
};

export const RasiChartSvg: React.FC<RasiChartSvgProps> = ({
  title,
  lagnaRasiNumber,
  lagnaRasi,
  planets = [],
  navamsaPositions,
  lagnaNavamsaRasi,
  language = 'en',
  size = 380,
  allowToggleStyle = true,
  allowToggleDivision = true,
  defaultStyle = 'south',
  defaultDivision = 'rasi'
}) => {
  const [style, setStyle] = useState<ChartStyle>(defaultStyle);
  const [division, setDivision] = useState<ChartDivision>(defaultDivision);

  const rasiLagna = isValidRasiNumber(lagnaRasiNumber)
    ? Number(lagnaRasiNumber)
    : isValidRasiNumber(lagnaRasi)
    ? Number(lagnaRasi)
    : null;
  const navamsaLagnaValue = lagnaNavamsaRasi ?? navamsaPositions?.lagna?.rasi;
  const navamsaLagna = isValidRasiNumber(navamsaLagnaValue) ? Number(navamsaLagnaValue) : null;
  // D9 has its own Ascendant. Never substitute the D1 sign when it is missing.
  const activeLagna = division === 'rasi' ? rasiLagna : navamsaLagna;
  const missingLagnaMessage = language === 'ta'
    ? (division === 'rasi' ? 'லக்னம் கிடைக்கவில்லை; லக்னக் குறியீடு காட்டப்படவில்லை.' : 'நவாம்ச லக்னம் கிடைக்கவில்லை; லக்னக் குறியீடு காட்டப்படவில்லை.')
    : language === 'hi'
    ? (division === 'rasi' ? 'लग्न उपलब्ध नहीं है; लग्न चिह्न नहीं दिखाया गया।' : 'नवांश लग्न उपलब्ध नहीं है; लग्न चिह्न नहीं दिखाया गया।')
    : (division === 'rasi' ? 'Ascendant unavailable; no Lagna marker is shown.' : 'Navamsa Ascendant unavailable; no Lagna marker is shown.');
  const northChartUnavailableMessage = language === 'ta'
    ? (division === 'rasi'
      ? 'வடஇந்திய பாவக் கட்டத்திற்கு சரியான லக்னம் தேவை. பாவங்கள் ஊகிக்கப்படவில்லை.'
      : 'வடஇந்திய நவாம்ச பாவக் கட்டத்திற்கு சரியான நவாம்ச லக்னம் தேவை. பாவங்கள் ஊகிக்கப்படவில்லை.')
    : language === 'hi'
    ? (division === 'rasi'
      ? 'उत्तर भारतीय भाव-चार्ट के लिए सही लग्न चाहिए। भावों का अनुमान नहीं लगाया गया।'
      : 'उत्तर भारतीय नवांश भाव-चार्ट के लिए सही नवांश लग्न चाहिए। भावों का अनुमान नहीं लगाया गया।')
    : (division === 'rasi'
      ? 'A valid Ascendant is required for the North Indian house chart. Houses were not inferred.'
      : 'A valid Navamsa Ascendant is required for the North Indian D9 house chart. Houses were not inferred.');

  // Normalize planets by sign index (1-12) based on division (Rasi vs Navamsa)
  const planetsBySign: Record<number, Array<{
    grahaKey: string;
    label: string;
    degText: string;
    isRetro: boolean;
    isCombust: boolean;
    isVargottama: boolean;
  }>> = {};

  for (let i = 1; i <= 12; i++) {
    planetsBySign[i] = [];
  }

  planets.forEach(p => {
    const grahaKey = (p.graha || (p as any).planetKey || '').toLowerCase();
    const suppliedRasi = p.rasi ?? (p as any).rasiNumber;
    let signValue: unknown = suppliedRasi;

    if (division === 'navamsa') {
      // A missing D9 position is not the D1 position; omit it rather than
      // placing the planet into a fabricated Navamsa sign.
      signValue = navamsaPositions?.[grahaKey]?.rasi ?? p.navamsaRasi;
    }

    if (!isValidRasiNumber(signValue)) return;
    const signNum = Number(signValue);

    const labelObj = PLANET_LABELS[grahaKey] || {
      en: (p.nameEn || grahaKey).substring(0, 2),
      ta: p.shortTa || p.nameTa || grahaKey,
      hi: p.shortHi || p.nameHi || grahaKey
    };
    const label = language === 'ta' ? labelObj.ta : language === 'hi' ? labelObj.hi : labelObj.en;
    const hasValidDegree = Number.isFinite(p.degrees) && p.degrees >= 0 && p.degrees < 30;
    const degText = division === 'rasi' && hasValidDegree ? `${Math.floor(p.degrees)}°` : '';
    const isVargottama = Boolean(p.isVargottama || (p.navamsaRasi && p.rasi && p.navamsaRasi === p.rasi));

    planetsBySign[signNum].push({
      grahaKey,
      label,
      degText,
      isRetro: Boolean(p.isRetrograde),
      isCombust: Boolean(p.isCombust),
      isVargottama
    });
  });

  const getLagnaBadge = () => {
    return language === 'ta' ? 'லக்' : language === 'hi' ? 'लग्न' : 'LAG';
  };

  const cellSize = size / 4;

  return (
    <div className="flex flex-col items-center select-none w-full max-w-md mx-auto">
      {/* Header with Title and Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between w-full mb-2 gap-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          {title || (division === 'rasi' ? 'RASI KUNDALI (D1)' : 'NAVAMSA KUNDALI (D9)')}
        </div>

        <div className="flex items-center gap-1.5">
          {allowToggleDivision && navamsaPositions && (
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => setDivision('rasi')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  division === 'rasi'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Rasi (D1)
              </button>
              <button
                type="button"
                onClick={() => setDivision('navamsa')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  division === 'navamsa'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Navamsa (D9)
              </button>
            </div>
          )}

          {allowToggleStyle && (
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => setStyle('south')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  style === 'south'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="South Indian Fixed-Sign Grid"
              >
                ⊞ South
              </button>
              <button
                type="button"
                onClick={() => setStyle('north')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  style === 'north'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="North Indian Fixed-House Diamond"
              >
                ◈ North
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SVG Container */}
      <div className="w-full flex justify-center">
        {style === 'south' ? (
          /* ==================================================== */
          /* SOUTH INDIAN STYLE (4x4 Sign-Fixed Grid)             */
          /* ==================================================== */
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="bg-amber-50/50 dark:bg-slate-900 border-2 border-amber-800 dark:border-amber-600 rounded-2xl shadow-lg w-full max-w-[380px] h-auto aspect-square"
          >
            {/* Outer Grid Outline */}
            <rect x="0" y="0" width={size} height={size} fill="none" stroke="#92400e" strokeWidth="2.5" />

            {/* Horizontal Grid Lines */}
            <line x1="0" y1={cellSize} x2={size} y2={cellSize} stroke="#b45309" strokeWidth="1.2" />
            <line x1="0" y1={cellSize * 2} x2={cellSize} y2={cellSize * 2} stroke="#b45309" strokeWidth="1.2" />
            <line x1={cellSize * 3} y1={cellSize * 2} x2={size} y2={cellSize * 2} stroke="#b45309" strokeWidth="1.2" />
            <line x1="0" y1={cellSize * 3} x2={size} y2={cellSize * 3} stroke="#b45309" strokeWidth="1.2" />

            {/* Vertical Grid Lines */}
            <line x1={cellSize} y1="0" x2={cellSize} y2={size} stroke="#b45309" strokeWidth="1.2" />
            <line x1={cellSize * 2} y1="0" x2={cellSize * 2} y2={cellSize} stroke="#b45309" strokeWidth="1.2" />
            <line x1={cellSize * 2} y1={cellSize * 3} x2={cellSize * 2} y2={size} stroke="#b45309" strokeWidth="1.2" />
            <line x1={cellSize * 3} y1="0" x2={cellSize * 3} y2={size} stroke="#b45309" strokeWidth="1.2" />

            {/* Center 2x2 Merged Box */}
            <defs>
              <linearGradient id="centerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.98" />
              </linearGradient>
            </defs>
            <rect
              x={cellSize + 2}
              y={cellSize + 2}
              width={cellSize * 2 - 4}
              height={cellSize * 2 - 4}
              fill="url(#centerGrad)"
              rx="6"
            />
            <text x={size / 2} y={size / 2 - 16} textAnchor="middle" fill="#f59e0b" fontSize="13" fontWeight="900" letterSpacing="1.5">
              ASTRO SIVAM
            </text>
            <text x={size / 2} y={size / 2 + 2} textAnchor="middle" fill="#fef08a" fontSize="9" fontWeight="bold">
              {division === 'rasi' ? 'VEDIC RASI (D1)' : 'NAVAMSA (D9)'}
            </text>
            <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="#94a3b8" fontSize="7.5">
              Thirukanitha Sidereal • Lahiri
            </text>

            {/* 12 Sign Boxes */}
            {Object.entries(SOUTH_SIGN_GRID).map(([signStr, pos]) => {
              const signNum = Number(signStr);
              const x = pos.col * cellSize;
              const y = pos.row * cellSize;
              const isLagna = activeLagna === signNum;
              const signData = SIGN_INFO[signNum];
              const boxPlanets = planetsBySign[signNum] || [];

              const signLabel = language === 'ta' ? signData.nameTa : language === 'hi' ? signData.nameHi : signData.nameEn.split(' ')[0];

              return (
                <g key={signNum} transform={`translate(${x}, ${y})`}>
                  {/* Lagna background tint */}
                  {isLagna && (
                    <rect x="1.5" y="1.5" width={cellSize - 3} height={cellSize - 3} fill="#fef3c7" className="dark:fill-amber-950/50" opacity="0.65" rx="2" />
                  )}

                  {/* Sign label */}
                  <text x="5" y="12" fontSize="7.5" fontWeight="bold" fill="#78350f" className="dark:fill-amber-400" opacity="0.85">
                    {signLabel}
                  </text>

                  {/* Lagna marker */}
                  {isLagna && (
                    <g transform="translate(5, 24)">
                      <rect x="-2" y="-9" width="30" height="11" rx="2.5" fill="#dc2626" />
                      <text x="13" y="-1" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#ffffff">
                        {getLagnaBadge()}
                      </text>
                    </g>
                  )}

                  {/* Occupant Planets */}
                  <g transform={`translate(6, ${isLagna ? 36 : 24})`}>
                    {boxPlanets.map((p, idx) => (
                      <text key={idx} x="0" y={idx * 12} fontSize="8" fontWeight="bold" fill="#0f172a" className="dark:fill-slate-100">
                        <tspan fill="#b45309" className="dark:fill-amber-300">
                          {p.label}
                        </tspan>
                        {p.degText && (
                          <tspan fontSize="7" fill="#64748b" className="dark:fill-slate-400">
                            {' '}{p.degText}
                          </tspan>
                        )}
                        {p.isRetro && (
                          <tspan fontSize="7" fontWeight="900" fill="#dc2626" className="dark:fill-rose-400">
                            (R)
                          </tspan>
                        )}
                        {p.isVargottama && (
                          <tspan fontSize="6.5" fontWeight="900" fill="#059669" className="dark:fill-emerald-400">
                            [V]
                          </tspan>
                        )}
                      </text>
                    ))}
                  </g>
                </g>
              );
            })}
          </svg>
        ) : activeLagna === null ? (
          <div className="w-full max-w-[380px] aspect-square flex items-center justify-center rounded-2xl border-2 border-amber-800 bg-amber-50/50 p-6 text-center text-sm text-slate-600 dark:border-amber-600 dark:bg-slate-900 dark:text-slate-300" role="status">
            {northChartUnavailableMessage}
          </div>
        ) : (
          /* ==================================================== */
          /* NORTH INDIAN STYLE (Diamond House-Fixed Kundali)     */
          /* ==================================================== */
          <NorthIndianDiamondChart
            size={size}
            lagnaRasi={activeLagna}
            planetsBySign={planetsBySign}
            language={language}
            division={division}
          />
        )}
      </div>
      {style === 'south' && activeLagna === null && (
        <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300" role="status">
          {missingLagnaMessage}
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
          <span>Lagna (Ascendant)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-600 font-bold">(R)</span>
          <span>Retrograde (Vakra)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-emerald-600 font-bold">[V]</span>
          <span>Vargottama Yoga</span>
        </span>
      </div>
    </div>
  );
};

/**
 * North Indian Diamond Chart (Fixed House geometry)
 * House 1 is top diamond, houses count counter-clockwise 1-12
 */
const NorthIndianDiamondChart: React.FC<{
  size: number;
  lagnaRasi: number;
  planetsBySign: Record<number, Array<{
    grahaKey: string;
    label: string;
    degText: string;
    isRetro: boolean;
    isCombust: boolean;
    isVargottama: boolean;
  }>>;
  language: AppLanguage;
  division: ChartDivision;
}> = ({ size, lagnaRasi, planetsBySign, language, division }) => {
  const S = size;
  const H = size / 2;

  // 12 House centers and label positions in diamond geometry
  // House index: 1 to 12
  const HOUSE_POLYGONS: Record<number, string> = {
    // House 1: Top diamond
    1: `M ${H},0 L ${S},${H/2} L ${H},${H} L 0,${H/2} Z`, // inner diamond clipped by diagonals
    // Using standard standard line grid representation:
  };

  // Sign in each house: House 1 has lagnaRasi, House 2 has (lagnaRasi % 12) + 1, etc.
  const getSignForHouse = (houseNum: number) => {
    return ((lagnaRasi - 1 + (houseNum - 1)) % 12) + 1;
  };

  // Coordinates for rendering planets & sign numbers in the 12 houses:
  const HOUSE_CENTERS: Record<number, { textX: number; textY: number; signX: number; signY: number }> = {
    1:  { textX: H,       textY: H * 0.42, signX: H,       signY: H * 0.72 },
    2:  { textX: H * 0.5, textY: H * 0.22, signX: H * 0.5, signY: H * 0.42 },
    3:  { textX: H * 0.2, textY: H * 0.5,  signX: H * 0.4, signY: H * 0.5 },
    4:  { textX: H * 0.42,textY: H,        signX: H * 0.72,signY: H },
    5:  { textX: H * 0.2, textY: H * 1.5,  signX: H * 0.4, signY: H * 1.5 },
    6:  { textX: H * 0.5, textY: H * 1.78, signX: H * 0.5, signY: H * 1.58 },
    7:  { textX: H,       textY: H * 1.58, signX: H,       signY: H * 1.28 },
    8:  { textX: H * 1.5, textY: H * 1.78, signX: H * 1.5, signY: H * 1.58 },
    9:  { textX: H * 1.8, textY: H * 1.5,  signX: H * 1.6, signY: H * 1.5 },
    10: { textX: H * 1.58,textY: H,        signX: H * 1.28,signY: H },
    11: { textX: H * 1.8, textY: H * 0.5,  signX: H * 1.6, signY: H * 0.5 },
    12: { textX: H * 1.5, textY: H * 0.22, signX: H * 1.5, signY: H * 0.42 }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="bg-amber-50/50 dark:bg-slate-900 border-2 border-amber-800 dark:border-amber-600 rounded-2xl shadow-lg w-full max-w-[380px] h-auto aspect-square"
    >
      {/* Outer Border */}
      <rect x="0" y="0" width={size} height={size} fill="none" stroke="#92400e" strokeWidth="2.5" />

      {/* Main Diagonals */}
      <line x1="0" y1="0" x2={size} y2={size} stroke="#b45309" strokeWidth="1.5" />
      <line x1={size} y1="0" x2="0" y2={size} stroke="#b45309" strokeWidth="1.5" />

      {/* Inner Diamond */}
      <polygon
        points={`${H},0 ${size},${H} ${H},${size} 0,${H}`}
        fill="none"
        stroke="#b45309"
        strokeWidth="1.5"
      />

      {/* Lagna House 1 Highlight */}
      <polygon
        points={`${H},0 ${size * 0.75},${H * 0.5} ${H},${H} ${size * 0.25},${H * 0.5}`}
        fill="#fef3c7"
        className="dark:fill-amber-950/40"
        opacity="0.6"
      />

      {/* Center Seal */}
      <circle cx={H} cy={H} r="18" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="1" />
      <text x={H} y={H + 3.5} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="bold">
        ॐ
      </text>

      {/* Render 12 Houses */}
      {Array.from({ length: 12 }, (_, i) => {
        const houseNum = i + 1;
        const signNum = getSignForHouse(houseNum);
        const coords = HOUSE_CENTERS[houseNum];
        const occupants = planetsBySign[signNum] || [];

        return (
          <g key={houseNum}>
            {/* Sign Number */}
            <text
              x={coords.signX}
              y={coords.signY}
              textAnchor="middle"
              fontSize="8"
              fontWeight="bold"
              fill="#92400e"
              className="dark:fill-amber-400"
              opacity="0.8"
            >
              {signNum}
            </text>

            {/* Lagna Tag on House 1 */}
            {houseNum === 1 && (
              <text
                x={coords.textX}
                y={coords.textY - 12}
                textAnchor="middle"
                fontSize="8"
                fontWeight="900"
                fill="#dc2626"
              >
                {language === 'ta' ? 'லக்னம்' : language === 'hi' ? 'लग्न' : 'ASC'}
              </text>
            )}

            {/* Planets */}
            <g transform={`translate(${coords.textX}, ${coords.textY})`}>
              {occupants.map((p, pIdx) => {
                const yOff = (pIdx - (occupants.length - 1) / 2) * 11;
                return (
                  <text
                    key={pIdx}
                    x="0"
                    y={yOff}
                    textAnchor="middle"
                    fontSize="7.5"
                    fontWeight="bold"
                    fill="#0f172a"
                    className="dark:fill-slate-100"
                  >
                    <tspan fill="#b45309" className="dark:fill-amber-300">
                      {p.label}
                    </tspan>
                    {p.isRetro && (
                      <tspan fontSize="6.5" fontWeight="900" fill="#dc2626">
                        (R)
                      </tspan>
                    )}
                    {p.isVargottama && (
                      <tspan fontSize="6.5" fontWeight="900" fill="#059669">
                        [V]
                      </tspan>
                    )}
                  </text>
                );
              })}
            </g>
          </g>
        );
      })}
    </svg>
  );
};
