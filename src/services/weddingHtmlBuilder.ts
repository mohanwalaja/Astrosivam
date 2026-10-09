import { WeddingMatchResult, AppLanguage, PoruthamStatus } from '../../server/astrology/types';
import { REPORT_FONT_LINK_TAG } from './reportFonts';
import { buildReportHeaderHtml, reportHeaderCss } from './reportHeader';
import { normalizeReportLanguage } from './reportLanguage';
import { formatBirthPlace } from './formatUtils';
import {
  buildWeddingDisclaimerNotes,
  weddingDisclaimerRichHtml
} from './weddingDisclaimerNotes';

const WEDDING_RASI_NAMES: Record<number, { en: string; ta: string; hi: string }> = {
  1: { en: 'Mesham', ta: 'மேஷம்', hi: 'मेष' },
  2: { en: 'Rishabam', ta: 'ரிஷபம்', hi: 'वृषभ' },
  3: { en: 'Mithunam', ta: 'மிதுனம்', hi: 'मिथुन' },
  4: { en: 'Kadagam', ta: 'கடகம்', hi: 'कर्क' },
  5: { en: 'Simham', ta: 'சிம்மம்', hi: 'सिंह' },
  6: { en: 'Kanni', ta: 'கன்னி', hi: 'कन्या' },
  7: { en: 'Thulam', ta: 'துலாம்', hi: 'तुला' },
  8: { en: 'Viruchigam', ta: 'விருச்சிகம்', hi: 'वृश्चिक' },
  9: { en: 'Dhanusu', ta: 'தனுசு', hi: 'धनु' },
  10: { en: 'Magaram', ta: 'மகரம்', hi: 'मकर' },
  11: { en: 'Kumbam', ta: 'கும்பம்', hi: 'कुंभ' },
  12: { en: 'Meenam', ta: 'மீனம்', hi: 'मीन' }
};

const validRasiNumber = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
};
const validPadaNumber = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 4;
};
const validHouseNumber = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
};

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Optional extras that only the order-aware callers (preview / email) can supply. */
export interface WeddingReportOptions {
  /** Printed in the page-2 attestation block. Falls back to a timestamp reference. */
  orderNumber?: string;
}

/**
 * Full-page layout contract
 * -------------------------
 * Every page is an A4 canvas (210 × 297 mm) whose content ALWAYS fills the
 * sheet: the fixed blocks keep their natural height and the growing block
 * (page 1: the 10 Poruthams table, page 2: the disclaimer panel) absorbs the
 * remaining space with `flex: 1 0 auto`. A page can therefore never end half
 * empty, and it can never clip either — if a report genuinely has more content
 * than one sheet the page grows instead of hiding text.
 */
export function buildWeddingMatchHtml(
  result: WeddingMatchResult,
  lang: AppLanguage = 'en',
  options: WeddingReportOptions = {}
): string {
  lang = normalizeReportLanguage(lang);
  const isTa = lang === 'ta';
  const isHi = lang === 'hi';

  const resAny = result as any;
  const brideObj = resAny.bride || resAny.girl || {};
  const groomObj = resAny.groom || resAny.boy || {};
  const inputP = resAny.inputPayload || {};
  const inputBride = inputP.bride || inputP.girl || {};
  const inputGroom = inputP.groom || inputP.boy || {};

  // Extract raw Bride Name
  let rawBrideName = result.brideName;
  if (!rawBrideName || rawBrideName === 'Native' || rawBrideName === 'Bride') {
    rawBrideName = brideObj.devoteeName || brideObj.name || inputBride.name || inputP.brideName || inputP.p1Name || rawBrideName || (isTa ? 'பெண்' : isHi ? 'वधू' : 'Bride');
  }
  const brideName = escapeHtml(rawBrideName);

  // Extract raw Groom Name
  let rawGroomName = result.groomName;
  if (!rawGroomName || rawGroomName === 'Native' || rawGroomName === 'Groom') {
    rawGroomName = groomObj.devoteeName || groomObj.name || inputGroom.name || inputP.groomName || inputP.p2Name || rawGroomName || (isTa ? 'ஆண்' : isHi ? 'वर' : 'Groom');
  }
  const groomName = escapeHtml(rawGroomName);

  const rawBrideDob = result.brideDob || brideObj.dob || brideObj.birthDetails?.dob || inputBride.dob || inputP.brideDob || inputP.p1Dob || '';
  const rawBrideTob = result.brideTob || brideObj.tob || brideObj.birthDetails?.tob || inputBride.tob || inputP.brideTob || inputP.p1Tob || '';
  const missingBirthPlace = isTa ? 'குறிப்பிடப்படவில்லை' : isHi ? 'उल्लेख नहीं किया गया' : 'Not provided';
  const brideBirthPlace = brideObj.birthPlace || brideObj.birthDetails?.birthPlace || inputBride.birthPlace || inputP.brideBirthPlace || inputP.bridePlace || '';
  const brideBirthCountry = brideObj.country ?? brideObj.birthDetails?.country ?? inputBride.country ?? inputP.brideCountry ?? '';
  const rawBridePlace = formatBirthPlace(brideBirthPlace, brideBirthCountry) || missingBirthPlace;

  const rawGroomDob = result.groomDob || groomObj.dob || groomObj.birthDetails?.dob || inputGroom.dob || inputP.groomDob || inputP.p2Dob || '';
  const rawGroomTob = result.groomTob || groomObj.tob || groomObj.birthDetails?.tob || inputGroom.tob || inputP.groomTob || inputP.p2Tob || '';
  const groomBirthPlace = groomObj.birthPlace || groomObj.birthDetails?.birthPlace || inputGroom.birthPlace || inputP.groomBirthPlace || inputP.groomPlace || '';
  const groomBirthCountry = groomObj.country ?? groomObj.birthDetails?.country ?? inputGroom.country ?? inputP.groomCountry ?? '';
  const rawGroomPlace = formatBirthPlace(groomBirthPlace, groomBirthCountry) || missingBirthPlace;

  const brideRasiNumber = validRasiNumber(result.brideRasi) ? Number(result.brideRasi) : null;
  const groomRasiNumber = validRasiNumber(result.groomRasi) ? Number(result.groomRasi) : null;
  const brideRasi = brideRasiNumber === null ? 'N/A' : WEDDING_RASI_NAMES[brideRasiNumber]?.[lang] || 'N/A';
  const groomRasi = groomRasiNumber === null ? 'N/A' : WEDDING_RASI_NAMES[groomRasiNumber]?.[lang] || 'N/A';

  const brideStar = (isTa ? result.brideNakshatraNameTa : isHi ? result.brideNakshatraNameHi : result.brideNakshatraNameEn)
    || (isTa ? brideObj.janmaNakshatraTa : isHi ? brideObj.janmaNakshatraHi : brideObj.janmaNakshatraEn)
    || 'N/A';

  const groomStar = (isTa ? result.groomNakshatraNameTa : isHi ? result.groomNakshatraNameHi : result.groomNakshatraNameEn)
    || (isTa ? groomObj.janmaNakshatraTa : isHi ? groomObj.janmaNakshatraHi : groomObj.janmaNakshatraEn)
    || 'N/A';

  const brideLagna = (isTa ? result.brideLagnaNameTa : isHi ? result.brideLagnaNameHi : result.brideLagnaNameEn)
    || (isTa ? brideObj.lagnaRasiNameTa : isHi ? brideObj.lagnaRasiNameHi : brideObj.lagnaRasiNameEn)
    || 'N/A';

  const groomLagna = (isTa ? result.groomLagnaNameTa : isHi ? result.groomLagnaNameHi : result.groomLagnaNameEn)
    || (isTa ? groomObj.lagnaRasiNameTa : isHi ? groomObj.lagnaRasiNameHi : groomObj.lagnaRasiNameEn)
    || 'N/A';

  const bridePadaRaw = result.bridePada ?? brideObj.janmaPada;
  const groomPadaRaw = result.groomPada ?? groomObj.janmaPada;
  const bridePada = validPadaNumber(bridePadaRaw) ? Number(bridePadaRaw) : 'N/A';
  const groomPada = validPadaNumber(groomPadaRaw) ? Number(groomPadaRaw) : 'N/A';

  // Format DOB (DD-MM-YYYY)
  const formatDob = (dobStr: string) => {
    if (dobStr && dobStr.includes('-')) {
      const parts = dobStr.split('-');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dobStr || 'N/A';
  };

  // Format TOB
  const formatTob = (tobStr: string) => {
    if (!tobStr) return '';
    const [hStr, mStr] = tobStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
    return tobStr;
  };

  const brideDobFormatted = rawBrideTob ? `${formatDob(rawBrideDob)} (${formatTob(rawBrideTob)})` : formatDob(rawBrideDob);
  const groomDobFormatted = rawGroomTob ? `${formatDob(rawGroomDob)} (${formatTob(rawGroomTob)})` : formatDob(rawGroomDob);

  const bridePlaceStr = escapeHtml(rawBridePlace);
  const groomPlaceStr = escapeHtml(rawGroomPlace);

  const isGood = result.verdictStatus === PoruthamStatus.UTTHAMAM;
  const isModerate = result.verdictStatus === PoruthamStatus.MADHYAMAM;
  const isIncompatible = result.verdictStatus === PoruthamStatus.PORUNDHADHU;
  const verdictKnown = isGood || isModerate || isIncompatible;
  const notAvailableLabel = isTa ? 'கிடைக்கவில்லை (N/A)' : isHi ? 'उपलब्ध नहीं (N/A)' : 'N/A';

  const finalVerdictLabel = isTa ? 'இறுதி முடிவு' : isHi ? 'अंतिम निर्णय' : 'FINAL VERDICT';
  // The final sentence and colour follow the same exact rating tier as the
  // badge and the overall summary. Madhyamam is acceptable with remedies, not
  // an unqualified "good match"; Porundhadhu stays cautious and non-categorical.
  const finalVerdictText = !verdictKnown
    ? notAvailableLabel
    : isGood
    ? (isTa ? 'இந்தப் பொருத்தம் நல்லது' : isHi ? 'यह अच्छा मिलान है।' : 'This is a good match.')
    : isModerate
    ? (isTa ? 'ஏற்றுக்கொள்ளத்தக்க பொருத்தம்; பரிகாரங்களுடன் பொருந்தும்' : isHi ? 'स्वीकार्य मिलान; उपायों के साथ विचारणीय।' : 'Acceptable match; suitable with remedies.')
    : (isTa
      ? 'இந்தப் பொருத்தம் சாதகமற்றது; இது ஜோதிட வழிகாட்டல் மட்டுமே. இறுதி முடிவிற்கு முன் விரிவான ஜாதக ஆய்வு மற்றும் நிபுணர் ஆலோசனை பெறவும்.'
      : isHi
      ? 'वर्तमान आकलन के अनुसार यह मिलान अनुकूल नहीं है; यह केवल ज्योतिषीय मार्गदर्शन है। निर्णय से पहले विस्तृत कुंडली समीक्षा और विशेषज्ञ सलाह लें।'
      : 'This match is not recommended on the current assessment; this is astrological guidance only. Seek a detailed horoscope review before deciding.');
  const finalVerdictClass = !verdictKnown
    ? 'final-verdict-unavailable'
    : isGood ? 'final-verdict-good' : isModerate ? 'final-verdict-moderate' : 'final-verdict-not-good';

  const verdictBadgeText = !verdictKnown
    ? 'N/A'
    : isGood
    ? (isTa ? 'உத்தமம் (மிக நன்று)' : isHi ? 'उत्तम (अति शुभ)' : 'Utthamam (Highly Auspicious)')
    : isModerate
    ? (isTa ? 'மத்திமம் (பரிகாரங்களுடன்)' : isHi ? 'मध्यम (उपाय सहित)' : 'Madhyamam (with remedies)')
    : (isTa ? 'பொருந்தாது' : isHi ? 'अशुभ' : 'Not Recommended');

  const verdictBadgeClass = !verdictKnown ? 'badge-na' : isGood ? 'badge-good' : isModerate ? 'badge-moderate' : 'badge-bad';

  // Keep the summary sentence on the same rating tier as the badge and final box;
  // legacy engine copy is not allowed to upgrade a Madhyamam to a good match.
  const overallVerdictText = verdictKnown ? finalVerdictText : notAvailableLabel;
  const doshaBalanceText = (isTa ? result.sevvayDosham?.doshaSamyamStatusTa : isHi ? result.sevvayDosham?.doshaSamyamStatusHi : result.sevvayDosham?.doshaSamyamStatusEn) || notAvailableLabel;
  const brideDoshaText = (isTa ? result.sevvayDosham?.brideDoshamSeverityTa : isHi ? result.sevvayDosham?.brideDoshamSeverityHi : result.sevvayDosham?.brideDoshamSeverityEn) || notAvailableLabel;
  const groomDoshaText = (isTa ? result.sevvayDosham?.groomDoshamSeverityTa : isHi ? result.sevvayDosham?.groomDoshamSeverityHi : result.sevvayDosham?.groomDoshamSeverityEn) || notAvailableLabel;
  const doshaGuidanceText = (isTa ? result.sevvayDosham?.recommendationTa : isHi ? result.sevvayDosham?.recommendationHi : result.sevvayDosham?.recommendationEn) || notAvailableLabel;
  // Classical exception / mitigation that cancelled or reduced a Mars placement
  // in a dosha house (DOSHA_CANCELLED / DOSHA_MILD); empty when not applicable.
  const brideDoshaReason = (isTa ? result.sevvayDosham?.brideCancellationReasonTa : isHi ? result.sevvayDosham?.brideCancellationReasonHi : result.sevvayDosham?.brideCancellationReasonEn) || '';
  const groomDoshaReason = (isTa ? result.sevvayDosham?.groomCancellationReasonTa : isHi ? result.sevvayDosham?.groomCancellationReasonHi : result.sevvayDosham?.groomCancellationReasonEn) || '';

  const lblBride = isTa ? 'பெண்' : isHi ? 'वधू' : 'Bride';
  const lblGroom = isTa ? 'ஆண்' : isHi ? 'वर' : 'Groom';
  const lblMarsPlacement = isTa ? 'செவ்வாய் நிலை' : isHi ? 'मंगल स्थिति' : 'Mars (Kuja) Placement';
  const lblGuidance = isTa ? 'வழிகாட்டல்' : isHi ? 'मार्गदर्शन' : 'Guidance';

  const houseOrdinal = (house: number): string => {
    if (house % 100 >= 11 && house % 100 <= 13) return `${house}th`;
    return `${house}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[house % 10] || 'th'}`;
  };
  const referenceFromText = (reference: 'lagna' | 'moon' | 'venus') => isTa
    ? ({ lagna: 'லக்னத்திலிருந்து', moon: 'சந்திரனிலிருந்து', venus: 'சுக்கிரனிலிருந்து' }[reference])
    : isHi
    ? ({ lagna: 'लग्न से', moon: 'चंद्र से', venus: 'शुक्र से' }[reference])
    : ({ lagna: 'from the Lagna', moon: 'from Chandra (Moon)', venus: 'from Sukra (Venus)' }[reference]);
  const marsPlacementLabel = (
    person: 'bride' | 'groom',
    fallbackHouse: unknown,
    severity: string
  ): string => {
    const houses = person === 'bride' ? result.sevvayDosham?.brideMarsHouses : result.sevvayDosham?.groomMarsHouses;
    // Show each house actually assessed, not just the raw triggering points:
    // a cancelled Venus-based indication must not hide a clean fifth house
    // from Lagna (the same computed values used by the detail/explanation).
    const references = ['lagna', 'moon', 'venus'] as const;
    const locations = references.map(reference => {
      const rawHouse = houses?.[reference] ?? (reference === 'lagna' ? fallbackHouse : null);
      if (!validHouseNumber(rawHouse)) return null;
      const house = Number(rawHouse);
      return isTa
        ? `${referenceFromText(reference)} ${house}-ஆம் இடம்`
        : isHi
        ? `${referenceFromText(reference)} ${house}वाँ भाव`
        : `${houseOrdinal(house)} house ${referenceFromText(reference)}`;
    }).filter((location): location is string => Boolean(location));
    const locationText = locations.length > 0 ? locations.join(isTa ? ', ' : '; ') : 'N/A';
    return `${locationText} (${severity || 'N/A'})`;
  };
  const marsPlacementValues = `${lblBride}: ${escapeHtml(marsPlacementLabel('bride', result.brideMarsHouse, brideDoshaText))} &bull; ` +
    `${lblGroom}: ${escapeHtml(marsPlacementLabel('groom', result.groomMarsHouse, groomDoshaText))}`;
  const scoreRows = Array.isArray(result.poruthams) ? result.poruthams : [];
  const scoreRowsComplete = scoreRows.length === 10 && scoreRows.every((p: any) => {
    const earned = p?.pointsEarned ?? p?.points;
    const maximum = p?.maxPoints;
    return earned !== undefined && earned !== null && earned !== '' && Number.isFinite(Number(earned)) && Number(earned) >= 0 &&
      maximum !== undefined && maximum !== null && maximum !== '' && Number.isFinite(Number(maximum)) && Number(maximum) > 0;
  });
  const derivedScore = scoreRowsComplete
    ? scoreRows.reduce((sum: number, p: any) => sum + Number(p.pointsEarned ?? p.points), 0)
    : undefined;
  const derivedMaxScore = scoreRowsComplete
    ? scoreRows.reduce((sum: number, p: any) => sum + Number(p.maxPoints), 0)
    : undefined;
  const rawScore = result.totalScore ?? resAny.score ?? resAny.totalPointsEarned ?? derivedScore;
  const rawMaxScore = result.maxScore ?? resAny.maxScore ?? resAny.maxPossiblePoints ?? derivedMaxScore;
  const scoreValue = rawScore !== undefined && rawScore !== null && rawScore !== '' ? Number(rawScore) : Number.NaN;
  const maxScoreValue = rawMaxScore !== undefined && rawMaxScore !== null && rawMaxScore !== '' ? Number(rawMaxScore) : Number.NaN;
  const scoreDisplay = Number.isFinite(scoreValue) && scoreValue >= 0 ? String(Number(scoreValue.toFixed(1))) : 'N/A';
  const maxScoreDisplay = Number.isFinite(maxScoreValue) && maxScoreValue > 0 ? String(Number(maxScoreValue.toFixed(1))) : 'N/A';
  const rawMatchedCount = result.totalPoruthamsMatched ?? resAny.matchedCount;
  const poruthamsForCount = Array.isArray(result.poruthams) ? result.poruthams : [];
  const poruthamRowsCountable = poruthamsForCount.length === 10 && poruthamsForCount.every((p: any) => {
    const points = p?.pointsEarned ?? p?.points;
    const hasPoints = points !== undefined && points !== null && points !== '' && Number.isFinite(Number(points));
    const hasStatus = [PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(p?.status);
    return hasStatus || hasPoints;
  });
  const matchedCountValue = rawMatchedCount !== undefined && rawMatchedCount !== null
    ? Number(rawMatchedCount)
    : poruthamRowsCountable
    ? poruthamsForCount.filter((p: any) => {
      if ([PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(p?.status)) {
        return p.status === PoruthamStatus.UTTHAMAM || p.status === PoruthamStatus.MADHYAMAM;
      }
      const points = p.pointsEarned ?? p.points;
      return Number.isFinite(Number(points)) && Number(points) > 0;
    }).length
    : Number.NaN;
  const matchedCountDisplay = Number.isInteger(matchedCountValue) && matchedCountValue >= 0 && matchedCountValue <= 10
    ? String(matchedCountValue)
    : 'N/A';
  const rajjuKnown = typeof (result as any).rajjuMatch === 'boolean';
  const rajjuStatusText = !rajjuKnown
    ? 'N/A'
    : result.rajjuMatch
    ? (isTa ? 'பொருத்துகிறது (சுபம்)' : isHi ? 'शुभ' : 'Auspicious Match')
    : (isTa ? 'ரஜ்ஜு தட்டுப்படுகிறது' : isHi ? 'अशुभ' : 'Afflicted');
  const rajjuStatusColor = !rajjuKnown ? 'var(--ink-muted)' : result.rajjuMatch ? 'var(--green)' : 'var(--maroon)';

  // Poruthams rows
  const poruthamsRowsHtml = (result.poruthams || []).map((p, idx) => {
    const pName = (isTa ? p.nameTa : isHi ? p.nameHi : p.nameEn) || 'N/A';
    const pExp = (isTa ? p.explanationTa : isHi ? p.explanationHi : p.explanationEn) || 'N/A';
    const pStatusKnown = [PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(p.status);
    const pStatusClass = !pStatusKnown
      ? 'status-na'
      : p.status === PoruthamStatus.UTTHAMAM ? 'status-good' : p.status === PoruthamStatus.MADHYAMAM ? 'status-moderate' : 'status-bad';
    const pStatusLabel = !pStatusKnown
      ? 'N/A'
      : p.status === PoruthamStatus.UTTHAMAM
      ? (isTa ? 'உத்தமம்' : isHi ? 'उत्तम' : 'Utthamam')
      : p.status === PoruthamStatus.MADHYAMAM
      ? (isTa ? 'மத்திமம்' : isHi ? 'मध्यम' : 'Madhyamam')
      : (isTa ? 'பொருந்தாது' : isHi ? 'अशुभ' : 'Incompatible');
    // `??` (not `||`) so a genuine ZERO earned score still prints "0 / 4":
    // `0 || fallback` would blank the numerator and leave a bare "/ 4".
    // The legacy `points` key is accepted because the PHP engine and old saved
    // orders carry both spellings; every other renderer already does this.
    const rawEarned: unknown = p.pointsEarned ?? (p as any).points;
    const rawMaximum: unknown = p.maxPoints;
    const earnedPoints = rawEarned === undefined || rawEarned === null || rawEarned === '' ? Number.NaN : Number(rawEarned);
    const maximumPoints = rawMaximum === undefined || rawMaximum === null || rawMaximum === '' ? Number.NaN : Number(rawMaximum);
    const pPoints = Number.isFinite(earnedPoints) && earnedPoints >= 0 && Number.isFinite(maximumPoints) && maximumPoints > 0
      ? `${Number(earnedPoints.toFixed(1))} / ${Number(maximumPoints.toFixed(1))}`
      : 'N/A / N/A';

    return `
      <tr>
        <td class="porutham-num">${idx + 1}</td>
        <td class="porutham-name">${pName} ${p.isCrucial ? '<span class="crucial-star" title="Crucial Kuta">★</span>' : ''}</td>
        <td class="porutham-status"><span class="status-pill ${pStatusClass}">${pStatusLabel}</span></td>
        <td class="porutham-points">${pPoints}</td>
        <td class="porutham-desc">${pExp}</td>
      </tr>
    `;
  }).join('\n');

  // ── Page 2: Marriage Matching disclaimer, in the language the order was placed in ──
  const disclaimer = buildWeddingDisclaimerNotes(lang);
  const disclaimerParagraphsHtml = disclaimer.paragraphs
    .map(p => `        <p class="disclaimer-para">${weddingDisclaimerRichHtml(p)}</p>`)
    .join('\n');

  // Shared header / footer so page 1 and page 2 print as one official document.
  const pageSubtitleHtml = isTa
    ? 'திருமணப் பொருத்த அறிக்கை (10 பொருத்தங்கள்)'
    : isHi
    ? 'विवाह मेलापक रिपोर्ट (10 Poruthams)'
    : '10-Poruthams Vedic Marriage Compatibility Report';

  const renderHeader = (subtitle: string) => buildReportHeaderHtml({ subtitle });

  const renderFooter = `
    <div class="footer">
      <div class="brand-title">ASTRO SIVAM - OFFICIAL VEDIC REPORT</div>
      <div class="brand-sub">astrosivam.com • admin@astrosivam.com</div>
    </div>
  `;

  // ── Attestation block (page 2) ────────────────────────────────────────────
  const generatedAt = resAny.generatedAt ? new Date(resAny.generatedAt) : null;
  const generatedAtZone = typeof resAny.generatedAtTimeZoneId === 'string' && resAny.generatedAtTimeZoneId.trim()
    ? resAny.generatedAtTimeZoneId.trim()
    : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const issuedOn = generatedAt && !isNaN(generatedAt.getTime())
    ? generatedAt.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: generatedAtZone, timeZoneName: 'short'
    })
    : '—';
  const stamp = generatedAt && !isNaN(generatedAt.getTime())
    ? `${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, '0')}${String(generatedAt.getDate()).padStart(2, '0')}`
    : '';
  const referenceNo = options.orderNumber || resAny.orderNumber || resAny.reportNumber || (stamp ? `ASTRO-WED-${stamp}` : '—');

  const attestTitle = isTa ? 'சான்றளிக்கப்பட்டது &amp; உறுதிப்படுத்தப்பட்டது' : isHi ? 'प्रमाणित एवं अभिप्रमाणित' : 'CERTIFIED &amp; ATTESTED';
  const lblReference = isTa ? 'குறிப்பு எண்' : isHi ? 'संदर्भ क्रमांक' : 'Reference';
  const lblIssuedOn = isTa ? 'வழங்கப்பட்ட நாள்' : isHi ? 'जारी तिथि' : 'Issued On';
  const lblPreparedFor = isTa ? 'இவர்களுக்காக' : isHi ? 'हेतु तैयार' : 'Prepared For';
  const lblSignatory = isTa ? 'அங்கீகரிக்கப்பட்டவர்' : isHi ? 'अधिकृत हस्ताक्षरकर्ता' : 'Authorised Signatory';
  const signatoryDesk = isTa ? 'ASTRO SIVAM வேத ஆய்வு மையம்' : isHi ? 'ASTRO SIVAM वैदिक अनुसंधान केंद्र' : 'ASTRO SIVAM Vedic Research Desk';

  const attestationHtml = `
    <div class="attestation">
      <div class="attestation-title">${attestTitle}</div>
      <div class="attestation-grid">
        <div class="attestation-col">
          <div class="attest-item">
            <span class="label">${lblReference}</span>
            <span class="value">${escapeHtml(String(referenceNo))}</span>
          </div>
          <div class="attest-item">
            <span class="label">${lblIssuedOn}</span>
            <span class="value">${escapeHtml(issuedOn)}</span>
          </div>
          <div class="attest-item">
            <span class="label">${lblPreparedFor}</span>
            <span class="value">${brideName} &#9792; &amp; ${groomName} &#9794;</span>
          </div>
        </div>
        <div class="attestation-sign">
          <div class="signature-rule"></div>
          <div class="signatory-label">${lblSignatory}</div>
          <div class="signatory-desk">${signatoryDesk}</div>
        </div>
      </div>
    </div>
  `;

  const fontFamilies = isTa
    ? "'Noto Sans Tamil', sans-serif"
    : isHi
    ? "'Noto Sans Devanagari', sans-serif"
    : "'Noto Sans', sans-serif";

  const headerFont = isTa
    ? "'Baloo Thambi 2', serif"
    : isHi
    ? "'Yatra One', serif"
    : "'Cinzel', serif";

  // Tamil and Devanagari set wider than Latin, so the page-2 body column is
  // sized per language to keep the paragraphs filling (never overflowing) the sheet.
  const disclaimerPanelWidth = isTa ? '100%' : isHi ? '150mm' : '152mm';
  const disclaimerParaSize = isTa ? '12px' : isHi ? '13.5px' : '13px';
  const disclaimerParaGap = '3mm';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<title>ASTRO SIVAM - Marriage Compatibility Report</title>
${REPORT_FONT_LINK_TAG}
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Baloo+Thambi+2:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Yatra+One&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

  :root {
    --maroon: #881337;
    --maroon-dark: #4c0519;
    --gold: #b45309;
    --gold-light: #fef3c7;
    --green: #047857;
    --slate-bg: #f8fafc;
    --slate-border: #e2e8f0;
    --ink: #0f172a;
    --ink-light: #334155;
    --ink-muted: #64748b;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 0;
  }

  body {
    background: #ffffff;
    font-family: ${fontFamilies};
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
  }

  /* Full Page A4 Canvas (210mm x 297mm)
     min-height (not height) on purpose: a page is always at least one full A4
     sheet, and the growing block inside it distributes the leftover space so
     the sheet is filled edge to edge. A page with genuinely more content grows
     instead of silently clipping the overflow. */
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    font-family: ${fontFamilies};
    color: var(--ink);
    position: relative;
    padding: 7mm 11mm 7mm;
    box-sizing: border-box;
  }

  .inner {
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  /* ── Shared centred Baby Naming report lockup ── */
  ${reportHeaderCss(headerFont)}

  /* ── Profiles Grid ── */
  .profiles-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3.5mm;
    margin-bottom: 2mm;
    flex-shrink: 0;
  }
  .profile-card {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-radius: 8px;
    padding: 2.6mm 3.8mm;
  }
  .profile-card.bride { border-top: 3.5px solid #db2777; }
  .profile-card.groom { border-top: 3.5px solid #2563eb; }
  .profile-card h3 {
    font-family: ${headerFont};
    font-size: 12.5px;
    font-weight: 800;
    margin-bottom: 1.2mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 1mm;
    border-bottom: 1px solid var(--slate-border);
  }
  .profile-card.bride h3 { color: #be185d; }
  .profile-card.groom h3 { color: #1d4ed8; }

  .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 3mm; }
  .profile-item { font-size: 11px; line-height: 1.25; }
  .profile-item .label {
    color: var(--ink-muted);
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
    margin-bottom: 0.5mm;
  }
  .profile-item .value {
    font-weight: 700;
    color: var(--ink);
    font-size: 11.5px;
  }

  /* ── Score Medallion ── */
  .score-panel {
    background: #ffffff;
    border: 1px solid var(--slate-border);
    border-radius: 8px;
    padding: 2.5mm 4.5mm;
    margin-bottom: 2mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3.5mm;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    flex-shrink: 0;
  }
  .score-left { flex: 1; }
  .score-title {
    font-family: ${headerFont};
    font-size: 12.5px;
    font-weight: 800;
    color: var(--maroon);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .score-stats {
    font-size: 11px;
    color: var(--ink-light);
    margin-top: 0.8mm;
    font-weight: 600;
    line-height: 1.45;
  }
  .score-badge {
    padding: 1.8mm 5mm;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 800;
    text-align: center;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .badge-good { background: #ecfdf5; color: #065f46; border: 1.5px solid #6ee7b7; }
  .badge-moderate { background: #fef3c7; color: #92400e; border: 1.5px solid #fcd34d; }
  .badge-bad { background: #fee2e2; color: #991b1b; border: 1.5px solid #fca5a5; }
  .badge-na { background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; }

  /* ── 10 Poruthams Table ──────────────────────────────────────────────────
     The growing block of page 1: it takes every millimetre left between the
     profile cards and the verdict so the sheet is always filled to the footer. */
  .poruthams-wrap {
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-bottom: 2mm;
  }
  table.poruthams-table {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    font-size: 10px;
    background: #ffffff;
    border: 1px solid var(--slate-border);
    border-radius: 8px;
    overflow: hidden;
    table-layout: fixed;
  }
  table.poruthams-table th {
    background: var(--slate-bg);
    color: var(--ink-muted);
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 1.4mm 2.4mm;
    text-align: left;
    border-bottom: 1px solid var(--slate-border);
  }
  table.poruthams-table td {
    padding: 1.2mm 2.4mm;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  table.poruthams-table tr:last-child td { border-bottom: none; }
  .porutham-num { text-align: center; font-weight: 700; color: var(--ink-muted); width: 24px; font-size: 10px; }
  .porutham-name { font-weight: 700; color: var(--maroon); width: 168px; font-size: 11px; }
  .crucial-star { color: #d97706; font-size: 11px; margin-left: 2px; }
  .porutham-status { text-align: center; width: 84px; }
  .porutham-points { text-align: center; font-weight: 700; width: 52px; color: var(--ink); font-size: 10.5px; }
  .porutham-desc { font-size: 10.5px; line-height: 1.3; color: var(--ink-light); font-weight: 500; }

  .status-pill {
    display: inline-block;
    padding: 0.8mm 2.5mm;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
  }
  .status-good { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .status-moderate { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .status-bad { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .status-na { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

  /* ── Sevvay Dosham & Matrimonial Guidance ── */
  .recommendation-panel {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-left: 4px solid var(--maroon);
    border-radius: 8px;
    padding: 2.4mm 4.5mm;
    margin-bottom: 2mm;
    flex-shrink: 0;
  }
  .recommendation-panel h3 {
    font-family: ${headerFont};
    color: var(--maroon);
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 1mm;
  }
  .recommendation-panel p {
    font-size: 10px;
    line-height: 1.4;
    color: var(--ink-light);
    margin-bottom: 1mm;
    font-weight: 500;
  }
  .recommendation-panel p:last-child { margin-bottom: 0; }
  .recommendation-panel p.dosha-reason { font-size: 9px; line-height: 1.35; color: var(--ink-light); padding-left: 3mm; }
  .recommendation-panel strong { color: var(--maroon); font-weight: 800; }

  /* ── Clear final match verdict ── */
  .final-verdict {
    text-align: center;
    border-radius: 8px;
    padding: 2mm 3mm;
    margin: 0 0 2mm;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .final-verdict-good {
    color: #166534;
    background: #ecfdf5;
    border: 1px solid #86efac;
  }
  .final-verdict-moderate {
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fcd34d;
  }
  .final-verdict-not-good {
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fca5a5;
  }
  .final-verdict-unavailable {
    color: #475569;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
  }
  .final-verdict-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.7px;
    margin-bottom: 0.6mm;
  }
  .final-verdict-message {
    font-size: 13px;
    line-height: 1.25;
    font-weight: 900;
  }

  /* ── Footer ──
     No auto top margin: the growing block owns the leftover height, so the
     footer already lands on the bottom edge of the sheet. */
  .footer {
    text-align: center;
    border-top: 1px solid var(--slate-border);
    padding-top: 1.5mm;
    flex-shrink: 0;
    font-size: 9.5px;
    color: var(--ink-muted);
    line-height: 1.3;
    flex-shrink: 0;
  }
  .footer .brand-title {
    color: var(--maroon);
    font-weight: 800;
    font-size: 10.5px;
    letter-spacing: 0.5px;
    font-family: ${headerFont};
  }
  .footer .brand-sub {
    font-size: 9.5px;
    color: var(--ink-muted);
    font-weight: 600;
    margin-top: 0.3mm;
  }

  /* ── Page 2: Marriage Matching disclaimer ──
     Same fill-the-sheet contract: the panel grows to the full body height and
     spreads any leftover space evenly, so a disclaimer can never leave half a
     page blank. */
  .disclaimer-body {
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-bottom: 2.5mm;
  }
  .disclaimer-panel {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-left: 4px solid var(--maroon);
    border-radius: 8px;
    padding: 5mm 6mm;
    width: ${disclaimerPanelWidth};
    max-width: 100%;
    margin: 0 auto;
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .disclaimer-title {
    font-family: ${headerFont};
    font-size: 15px;
    font-weight: 800;
    color: var(--maroon);
    letter-spacing: 0.6px;
    text-align: center;
    text-transform: uppercase;
    padding-bottom: 1.5mm;
    border-bottom: 1px dotted var(--gold);
  }
  .disclaimer-heading {
    font-family: ${headerFont};
    font-size: 12.5px;
    font-weight: 800;
    color: var(--green);
    text-align: center;
    margin-top: 2mm;
  }
  .disclaimer-para {
    font-size: ${disclaimerParaSize};
    line-height: 1.6;
    color: var(--ink-light);
    font-weight: 500;
    margin-top: ${disclaimerParaGap};
    text-align: left;
    overflow-wrap: anywhere;
  }
  .disclaimer-para strong {
    color: var(--maroon);
    font-weight: 800;
  }

  /* ── Page 2: attestation / signature block ── */
  .attestation {
    border: 1px solid var(--slate-border);
    border-top: 3px solid var(--maroon);
    border-radius: 8px;
    background: var(--slate-bg);
    padding: 4mm 5mm;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .attestation-title {
    font-family: ${headerFont};
    font-size: 12px;
    font-weight: 800;
    color: var(--maroon);
    letter-spacing: 0.8px;
    text-align: center;
    text-transform: uppercase;
    padding-bottom: 2mm;
    border-bottom: 1px dotted var(--gold);
  }
  .attestation-grid {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 3mm;
    margin-top: 3mm;
  }
  .attest-item { margin-bottom: 2.5mm; }
  .attest-item:last-child { margin-bottom: 0; }
  .attest-item .label {
    color: var(--ink-muted);
    font-weight: 700;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
    margin-bottom: 0.5mm;
  }
  .attest-item .value {
    font-weight: 700;
    color: var(--ink);
    font-size: 10.5px;
  }
  .attestation-sign {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;
    padding-left: 3mm;
    border-left: 1px dashed var(--slate-border);
  }
  .signature-rule {
    height: 0;
    border-bottom: 1px solid var(--ink-muted);
    margin-bottom: 1.5mm;
  }
  .signatory-label { font-size: 9.5px; font-weight: 800; color: var(--ink); }
  .signatory-desk { font-size: 9px; font-weight: 600; color: var(--ink-muted); margin-top: 0.5mm; }

  .panel, .profile-card, .score-panel, .recommendation-panel, .attestation {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>

<div class="page" id="wedding-page-1">
  <div class="inner">
    ${renderHeader(pageSubtitleHtml)}

    <!-- Profiles -->
    <div class="profiles-grid">
      <!-- Bride -->
      <div class="profile-card bride">
        <h3>
          <span>${isTa ? 'பெண் விபரம் (Bride)' : isHi ? 'वधू विवरण (Bride)' : 'Bride Profile'}</span>
          <span>&#9792;</span>
        </h3>
        <div class="profile-grid">
          <div class="profile-item">
            <span class="label">${isTa ? 'பெயர்' : isHi ? 'नाम' : 'Name'}</span>
            <span class="value">${brideName}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'பிறந்த தேதி & நேரம்' : isHi ? 'जन्म तिथि एवं समय' : 'Birth Date & Time'}</span>
            <span class="value">${brideDobFormatted}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'பிறந்த இடம்' : isHi ? 'जन्म स्थान' : 'Birth Place'}</span>
            <span class="value">${bridePlaceStr}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'ராசி' : isHi ? 'राशि' : 'Moon Sign (Rasi)'}</span>
            <span class="value">${brideRasi}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'நட்சத்திரம்' : isHi ? 'नक्षत्र' : 'Nakshatra & Pada'}</span>
            <span class="value">${brideStar} (${isTa ? 'பாதம்' : isHi ? 'चरण' : 'Pada'} ${bridePada})</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'லக்னம்' : isHi ? 'लग्न' : 'Lagna (Ascendant)'}</span>
            <span class="value">${brideLagna}</span>
          </div>
        </div>
      </div>

      <!-- Groom -->
      <div class="profile-card groom">
        <h3>
          <span>${isTa ? 'ஆண் விபரம் (Groom)' : isHi ? 'वर विवरण (Groom)' : 'Groom Profile'}</span>
          <span>&#9794;</span>
        </h3>
        <div class="profile-grid">
          <div class="profile-item">
            <span class="label">${isTa ? 'பெயர்' : isHi ? 'नाम' : 'Name'}</span>
            <span class="value">${groomName}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'பிறந்த தேதி & நேரம்' : isHi ? 'जन्म तिथि एवं समय' : 'Birth Date & Time'}</span>
            <span class="value">${groomDobFormatted}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'பிறந்த இடம்' : isHi ? 'जन्म स्थान' : 'Birth Place'}</span>
            <span class="value">${groomPlaceStr}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'ராசி' : isHi ? 'राशि' : 'Moon Sign (Rasi)'}</span>
            <span class="value">${groomRasi}</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'நட்சத்திரம்' : isHi ? 'नक्षत्र' : 'Nakshatra & Pada'}</span>
            <span class="value">${groomStar} (${isTa ? 'பாதம்' : isHi ? 'चरण' : 'Pada'} ${groomPada})</span>
          </div>
          <div class="profile-item">
            <span class="label">${isTa ? 'லக்னம்' : isHi ? 'लग्न' : 'Lagna (Ascendant)'}</span>
            <span class="value">${groomLagna}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Compatibility Score Medallion -->
    <div class="score-panel">
      <div class="score-left">
        <div class="score-title">
          ${isTa ? 'பொருத்த முடிவுகள் மற்றும் மதிப்பெண்' : isHi ? 'मेलापक परिणाम एवं प्राप्तांक' : 'Compatibility Score & Summary'}
        </div>
        <div class="score-stats">
          <strong>${matchedCountDisplay} / 10</strong> ${isTa ? 'பொருத்தங்கள் பொருந்துகின்றன' : isHi ? 'गुण मिलान' : 'Poruthams Matched'}
          &bull; <strong>${scoreDisplay} / ${maxScoreDisplay}</strong> ${isTa ? 'புள்ளிகள்' : isHi ? 'अंक' : 'Points'}
          &bull; ${isTa ? 'ரஜ்ஜு பொருத்தம்:' : isHi ? 'रज्जु स्थिति:' : 'Rajju Status:'} <strong style="color: ${rajjuStatusColor}">${rajjuStatusText}</strong>
        </div>
      </div>
      <div class="score-badge ${verdictBadgeClass}">
        ${verdictBadgeText}
      </div>
    </div>

    <!-- 10 Poruthams Table (grows to fill the sheet) -->
    <div class="poruthams-wrap">
      <table class="poruthams-table">
        <colgroup>
          <col style="width: 24px;" />
          <col style="width: 168px;" />
          <col style="width: 84px;" />
          <col style="width: 52px;" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>${isTa ? 'பொருத்தம் (Kuta)' : isHi ? 'कूट (Porutham)' : 'Porutham (Kuta)'}</th>
            <th style="text-align:center;">${isTa ? 'நிலை' : isHi ? 'परिणाम' : 'Verdict'}</th>
            <th style="text-align:center;">${isTa ? 'புள்ளி' : isHi ? 'अंक' : 'Score'}</th>
            <th>${isTa ? 'விளக்கம் & பலன்' : isHi ? 'फलित एवं महत्व' : 'Significance & Influence'}</th>
          </tr>
        </thead>
        <tbody>
          ${poruthamsRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Sevvay Dosham & Matrimonial Guidance -->
    <div class="recommendation-panel">
      <h3>${isTa ? 'செவ்வாய் தோஷ சமநிலை & ஜோதிட வழிகாட்டல்' : isHi ? 'मंगल दोष संतुलन एवं अंतिम परामर्श' : 'Kuja (Mars) Dosha Analysis & Final Recommendation'}</h3>
      <p><strong>${lblMarsPlacement}:</strong> ${marsPlacementValues}</p>
      ${brideDoshaReason ? `<p class="dosha-reason"><strong>${lblBride}:</strong> ${escapeHtml(brideDoshaReason)}</p>` : ''}
      ${groomDoshaReason ? `<p class="dosha-reason"><strong>${lblGroom}:</strong> ${escapeHtml(groomDoshaReason)}</p>` : ''}
      <p><strong>${isTa ? 'தோஷ சமநிலை:' : isHi ? 'दोष संतुलन:' : 'Dosha Balance:'}</strong> ${doshaBalanceText}</p>
      <p style="font-weight: 600; color: var(--maroon);">
        <strong>${isTa ? 'இறுதி முடிவு:' : isHi ? 'अंतिम परामर्श:' : 'Recommendation:'}</strong> ${overallVerdictText}
      </p>
      ${doshaGuidanceText ? `      <p><strong>${lblGuidance}:</strong> ${doshaGuidanceText}</p>` : ''}
    </div>

    <div class="final-verdict ${finalVerdictClass}" role="status" aria-label="${finalVerdictLabel}">
      <div class="final-verdict-label">${finalVerdictLabel}</div>
      <div class="final-verdict-message">${finalVerdictText}</div>
    </div>

    ${renderFooter}
  </div>
</div>

<!-- ======================= PAGE 2 - DISCLAIMER ======================= -->
<div class="page" id="wedding-page-2">
  <div class="inner">
    ${renderHeader(disclaimer.pageSubtitle)}

    <div class="disclaimer-body">
      <div class="disclaimer-panel">
        <div class="disclaimer-title">${escapeHtml(disclaimer.title)}</div>
        <div class="disclaimer-heading">${escapeHtml(disclaimer.heading)}</div>
${disclaimerParagraphsHtml}
      </div>
    </div>

${attestationHtml}

    ${renderFooter}
  </div>
</div>

</body>
</html>`;
}
