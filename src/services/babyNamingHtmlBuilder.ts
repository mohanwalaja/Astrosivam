import { firstNameSound, nameMatchesPada } from '../lib/astrology/namakaranSound';
import { BabyNamingResult, AppLanguage, Rasi } from '../lib/astrology/types';
import { RASI_INFO } from '../lib/astrology/astronomy';
import { REPORT_FONT_LINK_TAG } from './reportFonts';
import { ALL_NAKSHATRA_LETTERS } from '../lib/astrology/babynames';
import {
  buildNamakaranPadaNamesFromResult,
  NAMAKARAN_MAX_PER_SIDE,
  type NamakaranPadaNames
} from '../lib/astrology/namakaranNames';
import { getGunam } from './gunamData';
import { formatBirthPlace } from './formatUtils';
import { normalizeReportLanguage } from './reportLanguage';
import { formatBabyNameForReport } from './indicTransliteration';

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildBabyNamingHtml(result: BabyNamingResult, lang: AppLanguage = 'en'): string {
  lang = normalizeReportLanguage(lang);
  const isTa = lang === 'ta';
  const isHi = lang === 'hi';

  const resAny = (result as any) || {};

  // Child's Name
  const defaultBabyName = result.gender === 'M'
    ? (isTa ? 'ஆண் குழந்தை' : isHi ? 'बालक' : 'Baby Boy')
    : (isTa ? 'பெண் குழந்தை' : isHi ? 'बालिका' : 'Baby Girl');

  const babyName = escapeHtml(
    result.babyName ||
    resAny.childName ||
    resAny.inputPayload?.babyName ||
    resAny.inputPayload?.name ||
    defaultBabyName
  );

  const genderStr = result.gender === 'M'
    ? (isTa ? 'ஆண்' : isHi ? 'पुत्र' : 'Male (Boy)')
    : (isTa ? 'பெண்' : isHi ? 'पुत्री' : 'Female (Girl)');

  // Resolve against the canonical 108-pada table even for a previously saved
  // order. Older PHP results carried the correct star name but incorrectly
  // attached Ashwini's four sounds to every star; accepting those padas here
  // would reproduce the error in browser-generated PDF previews.
  const rawStarEn = (resAny.janmaNakshatraEn || resAny.nakshatraNameEn || result.nakshatraLetters?.nakshatraNameEn || resAny.nakshatra || resAny.star || '').toLowerCase().trim();
  const rawStarTa = (resAny.janmaNakshatraTa || resAny.nakshatraNameTa || result.nakshatraLetters?.nakshatraNameTa || '').trim();
  const rawStarHi = (resAny.janmaNakshatraHi || resAny.nakshatraNameHi || result.nakshatraLetters?.nakshatraNameHi || '').trim();

  const nameMatches = (knownName: string, rawName: string) =>
    Boolean(rawName && (knownName === rawName || knownName.includes(rawName) || rawName.includes(knownName)));
  const canonicalNakshatra =
    (rawStarEn ? ALL_NAKSHATRA_LETTERS.find(s => nameMatches((s.nakshatraNameEn || '').toLowerCase(), rawStarEn)) : undefined) ||
    (rawStarTa ? ALL_NAKSHATRA_LETTERS.find(s => nameMatches(s.nakshatraNameTa, rawStarTa)) : undefined) ||
    (rawStarHi ? ALL_NAKSHATRA_LETTERS.find(s => nameMatches(s.nakshatraNameHi, rawStarHi)) : undefined);

  let nakLetters = result.nakshatraLetters;
  const useCanonicalNakshatra = Boolean(canonicalNakshatra);

  if (useCanonicalNakshatra && canonicalNakshatra) {
    nakLetters = canonicalNakshatra;
  } else if (!nakLetters || !nakLetters.padas || nakLetters.padas.length === 0) {
    const starIdx = (resAny.janmaNakshatraIndex !== undefined ? resAny.janmaNakshatraIndex + 1 : 0) ||
      (resAny.nakshatraIndex || 0);
    if (starIdx >= 1 && starIdx <= 27) {
      nakLetters = ALL_NAKSHATRA_LETTERS.find(s => s.nakshatraIndex === starIdx);
    }
  }
  if (!nakLetters || !Array.isArray(nakLetters.padas) || nakLetters.padas.length !== 4) {
    throw new Error('Cannot render Baby Naming report without a verified birth Nakshatra and all four pada syllables.');
  }

  const rawJanmaPada = Number(result.janmaPada ?? resAny.pada ?? resAny.janmaPadaNumber ?? result.primaryPadaInfo?.padaNumber);
  if (!Number.isInteger(rawJanmaPada) || rawJanmaPada < 1 || rawJanmaPada > 4) {
    throw new Error('Cannot render Baby Naming report without the verified birth pada.');
  }
  const janmaPada = rawJanmaPada;
  const canonicalPrimaryPada = nakLetters.padas.find(p => p.padaNumber === janmaPada);
  if (!canonicalPrimaryPada) {
    throw new Error('Cannot render Baby Naming report because the birth pada syllable is missing.');
  }
  const suppliedPrimaryPadaMatches = Boolean(
    result.primaryPadaInfo &&
    result.primaryPadaInfo.letterEn === canonicalPrimaryPada.letterEn &&
    result.primaryPadaInfo.letterTa === canonicalPrimaryPada.letterTa &&
    result.primaryPadaInfo.letterHi === canonicalPrimaryPada.letterHi
  );

  const primaryPada = !useCanonicalNakshatra && suppliedPrimaryPadaMatches
    ? result.primaryPadaInfo
    : canonicalPrimaryPada;

  const starName = isTa
    ? (nakLetters.nakshatraNameTa || resAny.janmaNakshatraTa || 'N/A')
    : isHi
    ? (nakLetters.nakshatraNameHi || resAny.janmaNakshatraHi || 'N/A')
    : (nakLetters.nakshatraNameEn || resAny.janmaNakshatraEn || 'N/A');

  const normalizeRasiNumber = (value: unknown): Rasi | null => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= Rasi.MESHAM && numeric <= Rasi.MEENAM
      ? numeric as Rasi
      : null;
  };
  const savedChandraRasi = normalizeRasiNumber(result.chandraRasi ?? resAny.chandraRasiNumber);
  const padaChandraRasi = normalizeRasiNumber(primaryPada.rasi);
  // A verified Nakshatra + Pada identifies the Moon's 30-degree sign segment.
  // If the saved numeric sign conflicts with that mapping, report N/A rather
  // than trusting a possibly stale localized label or choosing one side.
  const resolvedChandraRasi = savedChandraRasi !== null && padaChandraRasi !== null && savedChandraRasi !== padaChandraRasi
    ? null
    : savedChandraRasi ?? padaChandraRasi;
  const chandraRasiInfo = resolvedChandraRasi !== null ? RASI_INFO[resolvedChandraRasi] : null;
  const rasiName = isTa
    ? (chandraRasiInfo?.nameTa || 'N/A')
    : isHi
    ? (chandraRasiInfo?.nameHi || 'N/A')
    : (chandraRasiInfo?.nameEn || 'N/A');

  const lagnaRasiNumber = normalizeRasiNumber(result.lagnaRasi ?? resAny.lagnaRasiNumber);
  const lagnaRasiInfo = lagnaRasiNumber !== null ? RASI_INFO[lagnaRasiNumber] : null;
  const lagnaName = isTa
    ? (lagnaRasiInfo?.nameTa || 'N/A')
    : isHi
    ? (lagnaRasiInfo?.nameHi || 'N/A')
    : (lagnaRasiInfo?.nameEn || 'N/A');

  // Format DOB (DD-MM-YYYY)
  let rawDob = result.dob || resAny.inputPayload?.dob || '';
  let formattedDob = rawDob;
  if (rawDob && rawDob.includes('-')) {
    const parts = rawDob.split('-');
    if (parts.length === 3) formattedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Format TOB
  let rawTob = result.tob || resAny.inputPayload?.tob || '';
  let formattedTob = rawTob;
  if (rawTob) {
    const [hStr, mStr] = rawTob.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      formattedTob = `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
  }

  const birthPlace = formatBirthPlace(
    result.birthPlace || resAny.inputPayload?.birthPlace || '',
    result.country || resAny.inputPayload?.country || ''
  );
  const birthPlaceStr = escapeHtml(
    birthPlace || (isTa ? 'குறிப்பிடப்படவில்லை' : isHi ? 'उल्लेख नहीं किया गया' : 'Not provided')
  );

  const lordName = isTa
    ? (nakLetters?.lordTa || 'கேது')
    : isHi
    ? (nakLetters?.lordHi || 'केतु')
    : (nakLetters?.lordEn || 'Ketu');

  const ganaName = isTa
    ? (nakLetters?.ganaTa || 'தேவ கணம்')
    : isHi
    ? (nakLetters?.ganaHi || 'देव गण')
    : (nakLetters?.ganaEn || 'Deva Gana');

  const yoniName = isTa
    ? (nakLetters?.yoniTa || 'குதிரை')
    : isHi
    ? (nakLetters?.yoniHi || 'अश्व')
    : (nakLetters?.yoniEn || 'Horse (Ashwa)');

  const rajjuName = isTa
    ? (nakLetters?.rajjuTa || 'பாத ரஜ்ஜு')
    : isHi
    ? (nakLetters?.rajjuHi || 'पाद रज्जु')
    : (nakLetters?.rajjuEn || 'Pada (Foot) Rajju');

  const now = result.generatedAt ? new Date(result.generatedAt) : new Date();
  const todayFormatted = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Asia/Kolkata'
  }) + ' IST';
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/-/g, '');
  const referenceNo = escapeHtml(resAny.orderNumber || resAny.reportNumber || `ASTRO-NAME-${stamp}`);
  const suppliedName = result.babyName || resAny.inputPayload?.babyName || resAny.inputPayload?.name || '';
  const firstSound = escapeHtml(firstNameSound(suppliedName));
  const birthSound = escapeHtml(primaryPada.letterEn);
  const matches = nameMatchesPada(suppliedName, primaryPada.letterTa);
  const nameCheck = !suppliedName ? (isTa ? 'பெயர் வழங்கப்படவில்லை' : isHi ? 'नाम नहीं दिया गया' : 'No name supplied')
    : isTa ? `பெயரின் முதல் ஒலி (${firstSound}) ஜன்ம பாத ஒலிக்கு (${birthSound}) ${matches ? 'பொருந்துகிறது' : 'பொருந்தவில்லை'}`
    : isHi ? `नाम की पहली ध्वनि (${firstSound}) जन्म पाद (${birthSound}) से ${matches ? 'मेल खाती है' : 'मेल नहीं खाती'}`
    : `Name’s first sound (${firstSound}) ${matches ? 'matches' : 'does not match'} the birth-pada sound (${birthSound}).`;
  const signatory = isTa ? 'அங்கீகரிக்கப்பட்டவர்' : isHi ? 'अधिकृत हस्ताक्षरकर्ता' : 'Authorised Signatory';
  const signatoryDesk = isTa ? 'ASTRO SIVAM வேத ஆய்வு மையம்' : isHi ? 'ASTRO SIVAM वैदिक अनुसंधान केंद्र' : 'ASTRO SIVAM Vedic Research Desk';

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 DATA — window.REPORT_DATA
  //
  // Page 1 is a pure function of ONE object in exactly the shape the host app
  // sets as window.REPORT_DATA before load:
  //
  //   { name, gender, dob, tob, place, nakshatra, pada, rasi, lagna,
  //     nakshatraLord, gana, yoni, rajju, reportDate,
  //     languages: ["ta", "en", "hi"],          // order of preference
  //     syllables: [ { pada, rasi, letters: { ta, en, hi } }, … 4 ],
  //     virtues: [ … ] }
  //
  // Nothing on page 1 is hardcoded: every card is rendered from this object,
  // and a value that is absent renders as "-". The page stays correct without
  // JavaScript too (email, print, PDF capture), because the very same object is
  // what the server render below is built from; the bootstrap script at the end
  // of the document re-renders the blocks only when a host really replaces
  // window.REPORT_DATA. An inline script in report HTML is an established
  // pattern here: see the page-fitting script in jathagamHtmlBuilder.
  // ══════════════════════════════════════════════════════════════════════════
  const DASH = '-';
  const txt = (value: unknown): string => {
    if (value === undefined || value === null) return DASH;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : DASH;
  };
  /** Same as txt(), escaped for markup. */
  const txtHtml = (value: unknown): string => escapeHtml(txt(value));

  // Script → font family. Latin, Tamil and Devanagari ship with every report;
  // any other script pulls its own Noto face (and its own stylesheet link) so a
  // syllable is never drawn with a font that has no glyph for it.
  const SCRIPT_FONTS: Record<string, { css: string; google?: string }> = {
    en: { css: "'Noto Sans', sans-serif" },
    ta: { css: "'Noto Sans Tamil', 'Noto Sans', sans-serif" },
    hi: { css: "'Noto Sans Devanagari', 'Noto Sans', sans-serif" },
    ml: { css: "'Noto Sans Malayalam', 'Noto Sans', sans-serif", google: 'Noto Sans Malayalam' },
    te: { css: "'Noto Sans Telugu', 'Noto Sans', sans-serif", google: 'Noto Sans Telugu' },
    kn: { css: "'Noto Sans Kannada', 'Noto Sans', sans-serif", google: 'Noto Sans Kannada' },
    bn: { css: "'Noto Sans Bengali', 'Noto Sans', sans-serif", google: 'Noto Sans Bengali' },
    gu: { css: "'Noto Sans Gujarati', 'Noto Sans', sans-serif", google: 'Noto Sans Gujarati' },
    pa: { css: "'Noto Sans Gurmukhi', 'Noto Sans', sans-serif", google: 'Noto Sans Gurmukhi' },
    or: { css: "'Noto Sans Oriya', 'Noto Sans', sans-serif", google: 'Noto Sans Oriya' },
    si: { css: "'Noto Sans Sinhala', 'Noto Sans', sans-serif", google: 'Noto Sans Sinhala' }
  };
  const scriptFont = (code: string) => (SCRIPT_FONTS[code] || SCRIPT_FONTS.en).css;

  // The languages the family asked for, in their own order of preference. When
  // the order carries no choice, the report language leads (the big letter) and
  // English follows as the transliteration line — the certificate's long
  // standing look.
  const reportLanguages = (() => {
    const supplied = resAny.languages ?? resAny.inputPayload?.languages;
    const requested = (Array.isArray(supplied) ? supplied : [])
      .map((entry: unknown) => String(entry ?? '').toLowerCase().trim())
      .filter((code: string) => /^[a-z]{2,3}$/.test(code));
    const ordered = requested.length ? requested : [lang, 'en'];
    return ordered.filter((code, index) => ordered.indexOf(code) === index);
  })();
  const extraFontLink = (() => {
    const families = Array.from(new Set(
      reportLanguages.map(code => SCRIPT_FONTS[code]?.google).filter(Boolean) as string[]
    ));
    if (!families.length) return '';
    const query = families.map(family => `family=${family.replace(/ /g, '+')}:wght@400;600;700;800`).join('&');
    return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${query}&display=swap">`;
  })();

  const padaWord = isTa ? 'பாதம்' : isHi ? 'पाद' : 'Pada';
  const rasiLabel = isTa ? 'நவாம்சம்' : isHi ? 'नवांश' : 'Navamsa';
  const janmaBadgeLabel = `\u2605 ${isTa ? 'ஜன்ம பாதம்' : isHi ? 'जन्म पाद' : 'JANMA PADA'}`;
  const particularsTitle = isTa ? 'குழந்தை விபரம் & ஜோதிட கணிப்புகள்' : isHi ? 'शिशु विवरण एवं ज्योतिषीय गणना' : 'Baby Particulars &amp; Astrological Coordinates';
  const padasTitle = isTa ? '4 நட்சத்திர பாத சுப ஒலிகள்' : isHi ? 'चारों नक्षत्र पाद नामाक्षर' : '4 Nakshatra Pada Auspicious Syllables';
  const virtuesTitle = isTa ? 'வேத குணநலன்கள் & பண்புகள்' : isHi ? 'वैदिक गुण एवं स्वभाव' : 'Vedic Gunam &amp; Core Virtues';
  const certificationTitle = isTa ? 'வேத ஆசீர்வாதம் & சான்றிதழ்' : isHi ? 'वैदिक आशीर्वाद एवं प्रमाणीकरण' : 'Vedic Certification &amp; Divine Blessing';
  const verifiedLabel = isTa ? 'கணிப்பு சரிபார்க்கப்பட்டது' : isHi ? 'गणना सत्यापित' : 'CALCULATION VERIFIED';

  // One entry per pada: its syllable in every script we hold, and the Rasi that
  // pada falls in (in the report's language).
  const syllables = (nakLetters.padas || []).map((entry, index) => ({
    pada: Number(entry.padaNumber) || index + 1,
    rasi: txt(RASI_INFO[((nakLetters.nakshatraIndex - 1) * 4 + entry.padaNumber - 1) % 12 + 1][isTa ? 'nameTa' : isHi ? 'nameHi' : 'nameEn']),
    letters: {
      ta: entry.letterTa || '',
      en: entry.letterEn || '',
      hi: entry.letterHi || ''
    } as Record<string, string>
  }));

  // Positive traits ("gunam") for this star + Moon sign, in the report language.
  const gunamPoints = getGunam(
    nakLetters?.nakshatraNameEn,
    chandraRasiInfo?.nameEn || '',
    isTa ? 'ta' : isHi ? 'hi' : 'en'
  );

  const reportData = {
    name: txt(result.babyName || resAny.childName || resAny.inputPayload?.babyName || resAny.inputPayload?.name),
    gender: txt(genderStr),
    dob: txt(formattedDob),
    tob: txt(formattedTob),
    // An order that never recorded a birthplace keeps the report family's
    // wording ("Not provided") instead of a dash — it is asserted by
    // tests/full-suite.test.ts for this builder.
    place: txt(birthPlace || (isTa ? 'குறிப்பிடப்படவில்லை' : isHi ? 'उल्लेख नहीं किया गया' : 'Not provided')),
    nakshatra: txt(starName),
    pada: janmaPada,
    rasi: txt(rasiName),
    lagna: txt(lagnaName),
    nakshatraLord: txt(lordName),
    gana: txt(ganaName),
    yoni: txt(yoniName),
    rajju: txt(rajjuName),
    reportDate: txt(resAny.reportDate || todayFormatted),
    languages: reportLanguages,
    syllables,
    virtues: gunamPoints.slice(0, 3).filter((point: unknown) => String(point ?? '').trim().length > 0)
  };

  // 12 particulars, 4 per row. The label strings are the report family's.
  const particularCards: Array<{ key: string; label: string; value: string; accent?: boolean }> = [
    { key: 'name', label: isTa ? 'குழந்தையின் பெயர்' : isHi ? 'शिशु का नाम' : 'Baby Name', value: reportData.name, accent: true },
    { key: 'gender', label: isTa ? 'பாலினம்' : isHi ? 'लिंग' : 'Gender', value: reportData.gender },
    { key: 'dob', label: isTa ? 'பிறந்த தேதி' : isHi ? 'जन्म तिथि' : 'Date of Birth', value: reportData.dob },
    { key: 'tob', label: isTa ? 'பிறந்த நேரம்' : isHi ? 'जन्म समय' : 'Time of Birth', value: reportData.tob },
    { key: 'place', label: isTa ? 'பிறந்த இடம்' : isHi ? 'जन्म स्थान' : 'Birth Place', value: reportData.place },
    { key: 'nakshatra', label: isTa ? 'ஜன்ம நட்சத்திரம்' : isHi ? 'जन्म नक्षत्र' : 'Janma Nakshatra', value: reportData.nakshatra, accent: true },
    { key: 'pada', label: isTa ? 'ஜன்ம பாதம்' : isHi ? 'पाद / चरण' : 'Janma Pada', value: `${padaWord} ${reportData.pada}` },
    { key: 'rasi', label: isTa ? 'சந்திர ராசி' : isHi ? 'चंद्र राशि' : 'Moon Sign (Rasi)', value: reportData.rasi },
    // The Ascendant keeps "N/A" when its sign number cannot be trusted (never a
    // stale label): tests/astrology-integrity-regression.test.tsx asserts both
    // the wording and that the neighbouring cards never borrow a sign.
    { key: 'lagna', label: isTa ? 'லக்னம்' : isHi ? 'लग्न' : 'Lagna (Ascendant)', value: reportData.lagna },
    { key: 'nakshatraLord', label: isTa ? 'நட்சத்திர அதிபதி' : isHi ? 'नक्षत्र स्वामी' : 'Nakshatra Lord', value: reportData.nakshatraLord },
    { key: 'gana', label: isTa ? 'கணம்' : isHi ? 'गण' : 'Gana', value: reportData.gana },
    { key: 'yoniRajju', label: isTa ? 'யோனி & ரஜ்ஜு' : isHi ? 'योनि एवं रज्जु' : 'Yoni &amp; Rajju', value: `${reportData.yoni} / ${reportData.rajju}` }
  ];

  const particularCardsHtml = particularCards.map(card => `
        <div class="baby-item" data-nk-field="${card.key}">
          <span class="label">${card.label}</span>
          <span class="value${card.accent ? ' accent' : ''}">${txtHtml(card.value)}</span>
        </div>`).join('');

  // Four equal cards in ONE row. Each card prints the syllables in the order the
  // family chose: the first language is the very big letter, the second is a
  // large bold line, any further language is a medium line, each in its own
  // script's font. The baby's own pada is highlighted and badged.
  const padaCardsHtml = reportData.syllables.map(pada => {
    const isJanma = pada.pada === reportData.pada;
    const lettersHtml = reportData.languages.map((code, index) => {
      const classes = index === 0
        ? (isJanma ? 'sound-big-char' : 'pada-big-letter')
        : index === 1 ? 'pada-mid-letter' : 'pada-small-letter';
      return `<span class="${classes}" style="font-family: ${scriptFont(code)};">${txtHtml(pada.letters[code])}</span>`;
    }).join('');
    return `
        <div class="pada-card${isJanma ? ' is-janma' : ''}" data-nk-pada="${pada.pada}">
          ${isJanma ? `<span class="janma-badge">${escapeHtml(janmaBadgeLabel)}</span>` : ''}
          <span class="pada-card-label">${padaWord} ${pada.pada}</span>
          <div class="pada-letters">${lettersHtml}
            <span class="pada-rasi-line">${rasiLabel}: ${txtHtml(pada.rasi)}</span>
          </div>
        </div>`;
  }).join('');

  const virtuesHtml = reportData.virtues.length ? `
    <div class="panel virtues-box" data-nk-virtues>
      <h2><span>${virtuesTitle}</span></h2>
      <div class="virtues-row">
${reportData.virtues.map((point, index) => `        <div class="virtue-card">
          <span class="virtue-index">${index + 1}</span>
          <span class="virtue-text">${escapeHtml(String(point))}</span>
        </div>`).join('\n')}
      </div>
    </div>` : '';

  // ── The Surya-Chandra emblem, inline: identical on both sheets, drawn to the
  //    brand geometry (twelve rasi dots, sun disc, crescent separated by
  //    construction). No shadow — the certificate is flat.
  const sunEmblemMarkup = `<span class="header-logo" role="img" aria-label="ASTRO SIVAM - Surya Chandra emblem">
        <svg class="header-logo-mark" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
          <g fill="#c9962c">
            <circle cx="50" cy="10" r="4" />
            <circle cx="70" cy="15.36" r="4" />
            <circle cx="84.64" cy="30" r="4" />
            <circle cx="90" cy="50" r="4" />
            <circle cx="84.64" cy="70" r="4" />
            <circle cx="70" cy="84.64" r="4" />
            <circle cx="50" cy="90" r="4" />
            <circle cx="30" cy="84.64" r="4" />
            <circle cx="15.36" cy="70" r="4" />
            <circle cx="10" cy="50" r="4" />
            <circle cx="15.36" cy="30" r="4" />
            <circle cx="30" cy="15.36" r="4" />
            <circle cx="42.5" cy="50" r="18.2" />
            <path d="M53.9 33.993 A16.8 16.8 0 1 1 53.9 66.007 A16.8 16.8 0 0 0 53.9 33.993 Z" />
          </g>
        </svg>
      </span>`;

  const certNameHtml = reportData.name === DASH ? babyName : txtHtml(reportData.name);
  const certNakshatraHtml = txtHtml(reportData.nakshatra);
  const certificationSentence = isTa
    ? `இவ்வறிக்கை <span data-nk-cert="name">${certNameHtml}</span> குழந்தையின் ஜன்ம நட்சத்திரம் (<span data-nk-cert="nakshatra">${certNakshatraHtml}</span>), சுப அக்ஷரங்கள் லஹிரி அயனாம்ச முறைப்படி கணித்து சான்றளிக்கப்படுகிறது. வழங்கப்பட்ட பெயர் அடையாளத்திற்காக மட்டுமே; அது பிறந்த பாத ஒலிக்குப் பொருந்துவதாகச் சான்றளிக்கப்படவில்லை.`
    : isHi
    ? `यह रिपोर्ट <span data-nk-cert="name">${certNameHtml}</span> के जन्म नक्षत्र (<span data-nk-cert="nakshatra">${certNakshatraHtml}</span>) और शुभ नामाक्षरों की लाहिरी अयनांश पद्धति से गणना प्रमाणित करती है। दिया गया नाम केवल पहचान के लिए है; जन्म-पाद की ध्वनि से उसका मेल प्रमाणित नहीं है।`
    : `This report certifies the computed Janma Nakshatra (<span data-nk-cert="nakshatra">${certNakshatraHtml}</span>) and naming syllables for <span data-nk-cert="name">${certNameHtml}</span>. The supplied name is for identification only, not a certified birth-pada name match.`;

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

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — SOUTH & NORTH INDIAN NAME SUGGESTIONS
  //
  // For every pada of the birth star (all four sacred syllables) the report
  // prints up to 8 South Indian style names on the left and up to 8 North
  // Indian style names on the right, for the baby's own gender.
  // ══════════════════════════════════════════════════════════════════════════
  const nameColumns: NamakaranPadaNames[] = buildNamakaranPadaNamesFromResult(
    { ...result, nakshatraLetters: nakLetters } as any,
    NAMAKARAN_MAX_PER_SIDE
  );
  const isBoy = result.gender !== 'F';
  const genderWord = isBoy
    ? (isTa ? 'ஆண் குழந்தை' : isHi ? 'बालक' : 'Baby Boy')
    : (isTa ? 'பெண் குழந்தை' : isHi ? 'बालिका' : 'Baby Girl');

  const suggestionRows = nameColumns.reduce((total, column) =>
    total + Math.max(1, Math.ceil(Math.max(column.south.length, column.north.length) / 2)), 0);
  // Normal name banks get large reading type; the maximum 64-name sheet
  // uses a denser (but still enlarged) size instead of cropping any entries.
  const suggestionNameSize = suggestionRows > 28 ? 10 : suggestionRows > 22 ? 12.5 : isTa ? 13 : 14;
  const suggestionMeaningSize = suggestionRows > 28 ? 7 : suggestionRows > 22 ? 9 : isTa ? 9 : 10;

  const suggestionBlocks = (side: 'south' | 'north') =>
    nameColumns.map(column => {
      const names = column[side] || [];
      // Both styles share a row budget, keeping the four pada headings aligned.
      // Larger two-line entries expand into the entire remaining A4 canvas.
      const rowCount = Math.max(1, Math.ceil(Math.max(column.south.length, column.north.length) / 2));
      const namesHtml = names.length
        ? names.map(entry => {
            const { primary, isLocalized } = formatBabyNameForReport(entry.name, isTa ? 'ta' : isHi ? 'hi' : 'en');
            const nameHtml = isLocalized
              ? `<span class="sug-name-primary" style="font-family: ${isTa ? "'Noto Sans Tamil', sans-serif" : "'Noto Sans Devanagari', sans-serif"};">${escapeHtml(primary)}</span>`
              : `<span class="sug-name-primary">${escapeHtml(entry.name)}</span>`;
            const relatedSoundLabel = isTa ? 'தொடர்புடைய ஒலி; சரியான பாத ஒலி அல்ல' : isHi ? 'संबंधित ध्वनि; पाद की सटीक ध्वनि नहीं' : 'Related sound; not the exact pada sound';
            const relatedSoundMarker = entry.isRelatedSound
              ? `<sup class="sug-related-marker" title="${escapeHtml(relatedSoundLabel)}" data-related-sound="true">†</sup>`
              : '';
            return `
              <div class="sug-name">
                <span class="sug-name-text">${nameHtml}${relatedSoundMarker}</span>
                <span class="sug-name-meaning" style="font-family: ${isTa ? "'Noto Sans Tamil', sans-serif" : isHi ? "'Noto Sans Devanagari', sans-serif" : "'Noto Sans', sans-serif"};">${escapeHtml(isTa ? entry.meaningTa : isHi ? entry.meaningHi : entry.meaningEn || entry.meaning)}</span>
              </div>`;
          }).join('')
        : `<div class="sug-empty">${isTa ? 'இந்த ஒலிக்கு பெயர்கள் இல்லை' : isHi ? 'इस ध्वनि हेतु नाम उपलब्ध नहीं' : 'No names available for this sound'}</div>`;
      return `
        <div class="sug-block${column.padaNumber === janmaPada ? ' birth-pada-section' : ''}" style="flex-grow: ${rowCount};">
          <div class="sug-block-head">
            <span class="sug-chip${column.padaNumber === janmaPada ? ' is-janma' : ''}">${escapeHtml(isTa ? column.soundTa : isHi ? column.soundHi : column.soundTa)}</span>
            <span class="sug-chip-text">
              <span class="sug-chip-sound">${escapeHtml(isTa ? column.soundTa : isHi ? column.soundHi : column.soundEn)}</span>
              <span class="sug-chip-rasi">${escapeHtml((isTa ? column.rasiTa : isHi ? column.rasiHi : column.rasiEn) || column.rasiEn)}</span>
            </span>
            <span class="sug-chip-pada">${column.padaNumber === janmaPada ? '★ ' : ''}${padaWord} ${column.padaNumber}</span>
          </div>
          <div class="sug-names" style="grid-template-rows: repeat(${rowCount}, minmax(min-content, 1fr));">${namesHtml}</div>
        </div>`;
    }).join('');

  const usesRelatedSounds = nameColumns.some(column => column.usesRelatedSounds);
  const relatedNote = usesRelatedSounds
    ? (isTa
      ? '† குறிக்கப்பட்ட பெயர்கள் தொடர்புடைய மாற்று ஒலிகளைப் பயன்படுத்துகின்றன; அந்தப் பாதத்தின் சரியான தொடக்க ஒலி அல்ல.'
      : isHi
      ? '† चिह्नित नाम संबंधित वैकल्पिक ध्वनि के हैं; वे पाद की सटीक प्रारंभिक ध्वनि नहीं हैं।'
      : '† Marked names use related alternative sounds, not the exact birth-pada starting sound.')
    : '';

  const southTitle = isTa ? 'தென்னிந்திய பாணி பெயர்கள்' : isHi ? 'दक्षिण भारतीय शैली के नाम' : 'South Indian Style Names';
  const northTitle = isTa ? 'வடஇந்திய பாணி பெயர்கள்' : isHi ? 'उत्तर भारतीय शैली के नाम' : 'North Indian Style Names';

  /** The centred brand header. Both certificate sheets open identically. */
  const certificateHeader = (subtitle: string) => `
    <div class="header">
      ${sunEmblemMarkup}
      <div class="header-text">
        <h1>ASTRO SIVAM - OFFICIAL VEDIC REPORT</h1>
        <div class="subtitle">${subtitle}</div>
        <div class="contact-line">astrosivam.com • admin@astrosivam.com</div>
      </div>
    </div>`;
  const pageOneSubtitle = isTa
    ? 'வேத நாமகரண அறிக்கை (குழந்தை பெயர் சூட்டும் வழிகாட்டி)'
    : isHi
    ? 'वैदिक नामकरण रिपोर्ट (शुभ नामाक्षर एवं मार्गदर्शन)'
    : 'Vedic Namakaran Report (Baby Naming Dossier &amp; Auspicious Syllables)';
  const pageTwoSubtitle = isTa
    ? 'வேத நாமகரண அறிக்கை — பெயர் பரிந்துரைகள்'
    : isHi
    ? 'वैदिक नामकरण रिपोर्ट — नाम सुझाव'
    : 'Vedic Namakaran Report &mdash; Name Suggestions';

  const suggestionsPage = `
<div class="page namakaran-certificate-page namakaran-suggestions-page" id="namakaran-page-2">
  <div class="royal-frame inner">

    ${certificateHeader(pageTwoSubtitle)}

    <div class="modern-divider"></div>

    <div class="sug-band">
      <div class="sug-band-title">${
        isTa
          ? 'பெயர் பரிந்துரைகள் — தென்னிந்திய & வடஇந்திய பாணி'
          : isHi
          ? 'नाम सुझाव — दक्षिण भारतीय एवं उत्तर भारतीय शैली'
          : 'Name Suggestions &mdash; South &amp; North Indian Styles'
      }</div>
      <div class="sug-band-meta">
        <span><b>${escapeHtml(babyName)}</b></span>
        <span>&bull;</span>
        <span>${escapeHtml(starName)} ${isTa ? 'நட்சத்திரம்' : isHi ? 'नक्षत्र' : 'Nakshatra'} &bull; ${padaWord} ${janmaPada}</span>
        <span>&bull;</span>
        <span>${genderWord}</span>
      </div>
      <div class="sug-band-note">${
        isTa
          ? '★ குறியிட்ட ஜன்ம பாத ஒலிக்கான பெயர்களுக்கு முன்னுரிமை அளிக்கவும். மற்ற பாதப் பெயர்கள் மாற்று வாய்ப்புகள் மட்டுமே.'
          : isHi
          ? '★ चिह्नित जन्म-पाद के नामों को प्राथमिकता दें। अन्य पादों के नाम विकल्प मात्र हैं.'
          : 'Prioritize names in the ★ birth-pada section. Other pada names are alternatives.'
      }</div>
    </div>

    <div class="sug-columns">
      <div class="sug-panel south-panel">
        <div class="sug-panel-head">${southTitle}</div>
        ${suggestionBlocks('south')}
      </div>
      <div class="sug-panel north-panel">
        <div class="sug-panel-head">${northTitle}</div>
        ${suggestionBlocks('north')}
      </div>
    </div>

    ${relatedNote ? `<div class="sug-related-note">${relatedNote}</div>` : ''}

    <div class="footer">
      <div class="brand-title">ASTRO SIVAM - OFFICIAL VEDIC REPORT</div>
      <div class="brand-sub">astrosivam.com • admin@astrosivam.com</div>
    </div>

  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<title>ASTRO SIVAM - Vedic Baby Naming Report</title>
${REPORT_FONT_LINK_TAG}
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Baloo+Thambi+2:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Yatra+One&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

  :root {
    /* Namakaran certificate palette (page 1 brief): deep maroon headings,
       ritual green, warm brown accents, cream highlight, cool grey cards. */
    --maroon: #7d1233;
    --maroon-dark: #4c0519;
    --gold: #a85a14;
    --gold-light: #fdeec0;
    --gold-glow: #fde68a;
    --highlight-from: #fffbea;
    --highlight-to: #fdeec0;
    --green: #0b7a5a;
    --slate-bg: #f7f8fb;
    --slate-border: #e3e6ee;
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

  /* Full Page A4 Canvas (210mm x 297mm).
     min-height (not height) keeps every sheet at least one A4 while still
     letting a page grow instead of clipping when the report is longer. */
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
    padding: 7.5mm 11mm 7.5mm;
    box-sizing: border-box;
  }

  .inner {
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    box-sizing: border-box;
  }

  /* ── Header ── */
  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6mm;
    margin-bottom: 2mm;
    text-align: center;
    flex-shrink: 0;
  }
  /* Centered, outline-free emblem above the brand copy. */
  .header .header-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    display: block;
    border-radius: 50%;
    flex-shrink: 0;
    margin: 0;
    background: transparent;
    filter: none;
  }
  .header .header-text {
    flex: 0 1 auto;
    text-align: center;
    min-width: 0;
  }
  .header h1 {
    font-family: ${headerFont};
    font-size: clamp(17px, 2.7vw, 22px);
    font-weight: 800;
    color: var(--maroon);
    line-height: 1.2;
    letter-spacing: 0.5px;
  }
  .header .subtitle {
    font-size: clamp(11.5px, 1.75vw, 14px);
    color: var(--green);
    margin-top: 0.4mm;
    font-weight: 700;
  }
  .header .contact-line {
    font-size: 10.5px;
    color: var(--ink-muted);
    margin-top: 0.4mm;
    font-weight: 600;
  }

  /* The certificate uses the same centered, shadow-less lockup on both sheets. */
  .header .header-logo .header-logo-mark {
    display: block;
    width: 100%;
    height: 100%;
  }
  .namakaran-certificate-page .header .header-text {
    flex: 0 1 auto;
    text-align: center;
    min-width: 0;
  }
  .namakaran-certificate-page .header h1,
  .namakaran-certificate-page .header .subtitle,
  .namakaran-certificate-page .header .contact-line {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .modern-divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--maroon), var(--gold), var(--maroon), transparent);
    margin: 0.8mm 0 2.5mm;
    flex-shrink: 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     PAGE 1 — Vedic Namakaran certificate

     Layout rules (see STRICT RULES in the page-1 brief):
       * Every text box grows with its content: no fixed heights and no
         overflow:hidden anywhere near text, so a long name or a three-line
         syllable card can never be clipped.
       * position:absolute is used by ONE element only — the ★ JANMA PADA
         badge — which sits in a reserved top rail with free space above the
         letters.
       * The four-syllable row is a grid of minmax(0, 1fr) columns; letters use
         clamp() sizes and line-height ≥ 1.25 so Tamil and Devanagari glyph tops
         and bottoms are never cut off.
       * .padas-panel is the growing block that keeps the sheet full to the
         footer band (REPORT_AND_INVOICE_FULL_PAGE_LAYOUT.md).
     ══════════════════════════════════════════════════════════════════ */

  /* ── Panels ── */
  .panel {
    background: #ffffff;
    border: 1px solid var(--slate-border);
    border-radius: 10px;
    padding: 3.4mm 4.2mm;
    margin-bottom: 2.6mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-width: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* The syllable band takes the spare height, so the sheet always ends at the
     footer and the cards simply breathe instead of the paper ending half empty. */
  .padas-panel {
    /* The syllable cards keep their natural certificate height; the spare A4
       height is shared by the particulars grid and the virtue row, so the four
       cards stay compact instead of stretching into a column of empty space. */
    flex: 0 0 auto;
    min-height: 0;
  }
  .particulars-panel { flex: 2 0 auto; min-height: 0; }
  .panel h2 {
    font-family: ${headerFont};
    color: var(--maroon);
    font-size: clamp(11px, 1.7vw, 13px);
    font-weight: 800;
    line-height: 1.3;
    letter-spacing: 0.4px;
    margin-bottom: 2mm;
    border-bottom: 1px solid var(--slate-border);
    padding-bottom: 1.2mm;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1mm 3mm;
    flex-wrap: wrap;
    min-width: 0;
  }
  .panel h2 > span {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .panel h2 .panel-date {
    color: var(--gold);
    font-family: ${fontFamilies};
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.2px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Baby Particulars Grid: twelve cards, four per row ── */
  .baby-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.8mm 2.4mm;
    min-width: 0;
    flex: 1 0 auto;
    min-height: 0;
    align-content: space-evenly;
  }
  .baby-item {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-radius: 7px;
    padding: 2mm 2.6mm;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .baby-item .label {
    display: block;
    color: var(--ink-muted);
    font-weight: 700;
    font-size: clamp(8px, 1.1vw, 9.2px);
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 0.5mm;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .baby-item .value {
    display: block;
    font-weight: 700;
    color: var(--ink);
    font-size: clamp(11px, 1.55vw, 13px);
    line-height: 1.3;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .baby-item .value.accent {
    color: var(--maroon);
    font-weight: 800;
  }

  /* ── Four Nakshatra Pada cards: one row, equal columns ── */
  .pada-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2.4mm;
    align-items: stretch;
    flex: 1 0 auto;
    min-height: 0;
    min-width: 0;
  }
  .pada-card {
    /* The ONLY absolutely positioned text on the page is the janma badge below,
       and every card reserves the same top rail for it, so the four cards stay
       aligned and the badge can never touch the letters. */
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1.4mm;
    min-width: 0;
    padding: 8mm 2.6mm 3mm;
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-radius: 9px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .pada-card.is-janma {
    background: linear-gradient(160deg, var(--highlight-from) 0%, var(--highlight-to) 100%);
    border: 2px solid var(--gold);
  }
  .janma-badge {
    position: absolute;
    top: 1.6mm;
    left: 50%;
    transform: translateX(-50%);
    /* max-content keeps the badge on one line; the transform keeps it centred
       and max-width stops a longer translation from leaving the card. */
    width: max-content;
    max-width: calc(100% - 3mm);
    background: var(--maroon);
    color: #fff6e0;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.6px;
    line-height: 1.25;
    padding: 0.7mm 2.4mm;
    border-radius: 999px;
    text-align: center;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .pada-card-label {
    font-size: clamp(8.4px, 1.15vw, 9.4px);
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--ink-muted);
    line-height: 1.3;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .pada-card.is-janma .pada-card-label { color: var(--gold); }
  .pada-letters {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.6mm;
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    padding: 1mm 0;
  }
  /* Language 1 — the very big letter, on the birth card also carrying the
     .sound-big-char hook the report tooling has always used. line-height keeps
     Tamil and Devanagari ascenders and descenders inside the line box. */
  .pada-big-letter, .sound-big-char {
    font-size: clamp(30px, 7.2vw, 58px);
    font-weight: 800;
    line-height: 1.35;
    color: var(--ink);
    overflow-wrap: anywhere;
    white-space: normal;
  }
  /* Language 2 — large and bold. */
  .pada-mid-letter {
    font-size: clamp(12px, 2.3vw, 19px);
    font-weight: 800;
    line-height: 1.35;
    color: var(--ink-light);
    overflow-wrap: anywhere;
    white-space: normal;
  }
  /* Language 3 and any further language — medium. */
  .pada-small-letter {
    font-size: clamp(10px, 1.9vw, 15px);
    font-weight: 700;
    line-height: 1.35;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .pada-card.is-janma .pada-big-letter,
  .pada-card.is-janma .sound-big-char,
  .pada-card.is-janma .pada-mid-letter,
  .pada-card.is-janma .pada-small-letter { color: var(--maroon); }
  .pada-rasi-line {
    width: 100%;
    font-size: clamp(9px, 1.25vw, 10.4px);
    font-weight: 700;
    line-height: 1.35;
    color: var(--ink-muted);
    border-top: 1px solid var(--slate-border);
    padding-top: 1.4mm;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .pada-card.is-janma .pada-rasi-line {
    color: var(--gold);
    border-top-color: #e6cd9a;
  }


  /* ── Vedic Gunam & Core Virtues: three per row ── */
  .virtues-box { flex: 2 0 auto; min-height: 0; }
  .virtues-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2.4mm;
    min-width: 0;
    flex: 1 0 auto;
    min-height: 0;
  }
  .virtue-card {
    display: flex;
    align-items: center;
    gap: 2mm;
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-radius: 7px;
    padding: 2.4mm 2.6mm;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .virtue-index {
    background: var(--maroon);
    color: #ffffff;
    font-size: 8.5px;
    font-weight: 800;
    width: 16px;
    height: 16px;
    min-width: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 0.2mm;
  }
  .virtue-text {
    font-size: clamp(9.8px, 1.35vw, 11px);
    line-height: 1.42;
    color: var(--ink-light);
    font-weight: 500;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }


  /* ── Vedic certification & divine blessing ── */
  .certification-panel {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-left: 4px solid var(--maroon);
    border-radius: 9px;
    padding: 3mm 3.6mm;
    margin-bottom: 2.6mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2.5mm 4mm;
    flex-wrap: wrap;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .certification-text {
    min-width: 0;
    flex: 1 1 62%;
  }
  .certification-text h3 {
    font-family: ${headerFont};
    font-size: clamp(11px, 1.6vw, 12.5px);
    color: var(--maroon);
    font-weight: 800;
    line-height: 1.3;
    letter-spacing: 0.3px;
    margin-bottom: 0.8mm;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .certification-text p {
    font-size: clamp(9.4px, 1.25vw, 10.2px);
    line-height: 1.45;
    color: var(--ink-light);
    font-weight: 500;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .seal-verified-stamp { flex-shrink: 0; }
  .verified-badge {
    display: inline-block;
    background: #e8f7f1;
    border: 1.5px solid var(--green);
    color: var(--green);
    padding: 1.4mm 3.6mm;
    border-radius: 999px;
    font-weight: 800;
    font-size: 10px;
    letter-spacing: 0.6px;
    white-space: nowrap;
  }

  /* ── Footer ── */
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
    font-size: 11px;
    letter-spacing: 0.5px;
    font-family: ${headerFont};
  }
  .footer .brand-sub {
    font-size: 9px;
    color: var(--ink-muted);
    font-weight: 600;
    margin-top: 0.2mm;
  }

  .panel, .certification-panel, .pada-cards, .virtues-row {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* ── Narrow screens (phone e-mail viewers): the sheet goes fluid, the
        particulars drop to two columns, the virtues stack, and the four
        syllables stay in ONE row exactly as the certificate requires. ── */
  @media (max-width: 559px) {
    .page {
      width: 100%;
      padding: 5mm 5mm;
    }
    .header .header-logo { width: 48px; height: 48px; }
    #namakaran-page-1 .header .header-logo { width: 48px; height: 48px; }
    .panel { padding: 2.4mm 2.6mm; }
    .baby-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .virtues-row { grid-template-columns: 1fr; }
    .pada-cards { gap: 1.3mm; }
    .pada-card { padding: 6.6mm 1.2mm 1.8mm; gap: 0.7mm; }
    .pada-big-letter, .sound-big-char { font-size: clamp(20px, 7.4vw, 30px); }
    .pada-mid-letter { font-size: clamp(9.5px, 2.6vw, 12px); }
    .pada-small-letter { font-size: clamp(8.4px, 2.2vw, 10.5px); }
    .janma-badge {
      font-size: 6.4px;
      letter-spacing: 0.2px;
      padding: 0.5mm 1.4mm;
      max-width: calc(100% - 1.4mm);
    }
    .certification-panel { padding: 2.4mm 3mm; }
  }

  /* ══════════════════════════════════════════════════════════════════
     PAGE 2 — Name suggestions (South | North Indian style)

     The two style panels fill the remaining A4 height. Each pada receives
     space proportional to its shared South/North row count, including sparse
     lists. Names and meanings have separate lines rather than tiny, clipped
     inline text; all 4 x 8 names per side still fit on this one page.
     ══════════════════════════════════════════════════════════════════ */
  .namakaran-suggestions-page {
    page-break-before: always;
    break-before: page;
  }
  .namakaran-suggestions-page .royal-frame.inner {
    justify-content: flex-start;
    min-height: 0;
  }
  .namakaran-suggestions-page .footer { margin-top: 1.4mm; }

  /* The second sheet stays compact: it carries up to 64 names, so it wears the
     same centred lockup a size down, with tighter brand margins. */
  .namakaran-suggestions-page .header { gap: 0.3mm; margin-bottom: 1.4mm; }
  .namakaran-suggestions-page .header .header-logo { width: 44px; height: 44px; }
  .namakaran-suggestions-page .header h1 { font-size: clamp(14px, 2.1vw, 16.5px); }
  .namakaran-suggestions-page .header .subtitle {
    font-size: clamp(10px, 1.45vw, 11px);
    line-height: 1.25;
  }
  .namakaran-suggestions-page .header .contact-line { font-size: 9.5px; line-height: 1.25; margin-top: 0.2mm; }
  .namakaran-suggestions-page .modern-divider { margin: 0.6mm 0 1.6mm; }

  /* Intro strip — the maroon rule of the certification panel, on a slate card. */
  .sug-band {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-left: 4px solid var(--maroon);
    border-radius: 9px;
    padding: 1.5mm 3mm 1.5mm;
    margin-bottom: 1.8mm;
    flex-shrink: 0;
  }
  .sug-band-title {
    font-family: ${headerFont};
    font-size: clamp(12.5px, 1.8vw, 14px);
    font-weight: 800;
    letter-spacing: 0.3px;
    line-height: 1.3;
    color: var(--maroon);
    text-align: center;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .sug-band-meta {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.6mm;
    flex-wrap: wrap;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--green);
    margin-top: 0.6mm;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .sug-band-meta b { color: var(--maroon); font-size: 11.5px; font-weight: 800; }
  .sug-band-note {
    font-size: 9.5px;
    color: var(--ink-muted);
    text-align: center;
    margin-top: 0.7mm;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .sug-columns {
    display: flex;
    gap: 3mm;
    flex: 1 1 auto;
    min-height: 0;
  }
  .sug-panel {
    flex: 1 1 0;
    min-width: 0;
    border: 1px solid var(--slate-border);
    border-radius: 8px;
    padding: 1.4mm 1.8mm 1.6mm;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  /* Style headings: the green of the auspicious and the cream of the birth
     pada — the same two accents page 1 uses. */
  .sug-panel-head {
    font-family: ${headerFont};
    font-size: clamp(11px, 1.55vw, 12.5px);
    font-weight: 800;
    letter-spacing: 0.4px;
    line-height: 1.3;
    text-align: center;
    border-radius: 7px;
    padding: 1mm 1.4mm;
    margin-bottom: 1.4mm;
    flex-shrink: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .south-panel .sug-panel-head {
    background: linear-gradient(135deg, #eaf8f2 0%, #d9f2e8 100%);
    border: 1px solid #bfe4d6;
    color: var(--green);
  }
  .north-panel .sug-panel-head {
    background: linear-gradient(135deg, var(--highlight-from) 0%, var(--highlight-to) 100%);
    border: 1px solid #e6cd9a;
    color: var(--maroon);
  }

  .sug-block {
    display: flex;
    flex-direction: column;
    flex-basis: 7.5mm;
    flex-shrink: 0;
    min-height: 0;
    margin-bottom: 1.8mm;
  }
  .sug-block:last-child { margin-bottom: 0; }
  .sug-block-head {
    display: flex;
    align-items: center;
    gap: 1.2mm;
    border-bottom: 1px solid var(--slate-border);
    padding-bottom: 0.6mm;
    margin-bottom: 0.7mm;
    flex-shrink: 0;
  }
  /* The syllable chip is a page-1 card; the birth pada's chip carries the same
     highlight the birth pada card does on the first sheet. */
  .sug-chip {
    font-family: 'Noto Sans Tamil', sans-serif;
    min-width: 6.2mm;
    text-align: center;
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-radius: 6px;
    color: var(--maroon);
    font-size: 14px;
    font-weight: 800;
    line-height: 1.15;
    padding: 0.4mm 0.8mm;
    flex-shrink: 0;
  }
  .sug-chip.is-janma {
    background: linear-gradient(160deg, var(--highlight-from) 0%, var(--highlight-to) 100%);
    border: 1.5px solid var(--gold);
  }
  .sug-block-head .sug-chip-pada { color: var(--gold); }
  .sug-chip-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 1.1; }
  .sug-chip-sound {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--maroon);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sug-chip-rasi {
    font-size: 9px;
    color: var(--ink-muted);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sug-chip-pada {
    font-size: 9px;
    font-weight: 700;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sug-names {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 2.2mm;
    flex: 1 1 auto;
    min-height: 0;
  }
  .birth-pada-section { background: #fff7e0; border-left: 2px solid #c9962c; padding-left: 1mm; }
  .naming-authorization { font-size: 8px; text-align: center; line-height: 1.5; margin-top: 1mm; }
  .sug-name {
    min-height: 9mm;
    padding: 0.5mm 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    font-family: 'Noto Sans', sans-serif;
    line-height: 1.3;
  }
  .sug-related-marker { font-size: 0.65em; line-height: 0; }
  .sug-name-text {
    font-size: ${suggestionNameSize}px;
    flex-shrink: 0;
    font-weight: 700;
    color: var(--ink);
    overflow-wrap: anywhere;
    line-height: 1.6;
  }
  .sug-name-primary {
    color: var(--maroon);
    font-weight: 800;
  }
  .sug-name-secondary {
    font-size: 0.88em;
    color: var(--ink-light);
    font-weight: 600;
  }
  .sug-name-meaning {
    font-size: ${suggestionMeaningSize}px;
    flex-shrink: 0;
    line-height: 1.5;
    color: var(--ink-muted);
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .sug-empty {
    grid-column: 1 / -1;
    font-size: 10px;
    color: var(--ink-muted);
    font-style: italic;
  }
  .sug-related-note {
    font-size: 9px;
    color: var(--ink-muted);
    text-align: center;
    margin-top: 1mm;
    line-height: 1.25;
    flex-shrink: 0;
    overflow-wrap: anywhere;
  }
</style>
</head>
<body>

<div class="page namakaran-certificate-page" id="namakaran-page-1">
  <div class="royal-frame inner">

    <!-- 1 ─ Centred brand header: sun emblem, maroon brand line, green subtitle -->
    ${certificateHeader(pageOneSubtitle)}

    <div class="modern-divider"></div>

    <!-- 2 ─ Baby particulars & astrological coordinates (report date on the right) -->
    <div class="panel particulars-panel">
      <h2>
        <span>${particularsTitle}</span>
        <span class="panel-date">${isTa ? 'தேதி:' : isHi ? 'दिनांक:' : 'Report Date:'} <span data-nk-date>${txtHtml(reportData.reportDate)}</span></span>
      </h2>
      <div class="baby-grid">${particularCardsHtml}
      </div>
    </div>

    <!-- 3 ─ 4 Nakshatra pada auspicious syllables: one row of four equal cards,
           the letters in the family's chosen order, the birth pada highlighted -->
    <div class="panel padas-panel">
      <h2><span>${padasTitle}</span></h2>
      <div class="pada-cards" data-janma-badge-label="${escapeHtml(janmaBadgeLabel)}" data-pada-word="${escapeHtml(padaWord)}" data-rasi-label="${escapeHtml(rasiLabel)}">${padaCardsHtml}
      </div>
    </div>

    <!-- 4 ─ Vedic gunam & core virtues (the block is omitted when there are none) -->
${virtuesHtml}

    <!-- 5 ─ Vedic certification & divine blessing -->
    <div class="certification-panel">
      <div class="certification-text" data-nk-virtues-title="${escapeHtml(virtuesTitle)}">
        <h3>${certificationTitle}</h3>
        <p>${certificationSentence}</p>
        <p class="name-sound-check">${nameCheck}</p>
      </div>
      <div class="seal-verified-stamp">
        <div class="verified-badge">&#10003; ${verifiedLabel}</div>
      </div>
    </div>

    <div class="naming-authorization">${referenceNo} · ${todayFormatted}<br/>${signatory} — ${signatoryDesk}</div>

    <!-- 6 ─ Footer -->
    <div class="footer">
      <div class="brand-title">ASTRO SIVAM - OFFICIAL VEDIC REPORT</div>
      <div class="brand-sub">astrosivam.com • admin@astrosivam.com</div>
    </div>

  </div>
</div>
${suggestionsPage}

<script>
/* ── REPORT_DATA hydration ─────────────────────────────────────────────────
   The host app may set window.REPORT_DATA (the object documented above page 1)
   before this document loads. When it does, page 1 is re-rendered from it:
   every value, the syllable order of the chosen languages, the birth-pada
   highlight and the virtue list.

   REPORT_DATA is an OVERRIDE layer, never a blanking layer: a field the host
   does not carry keeps the value the server already rendered, a field that
   neither source has shows "-", and the block disappears only when the host
   says so with an explicit empty list. That keeps the page correct when the
   host sends the full object, when it sends part of it, and when it sends
   nothing at all — which is exactly the case inside e-mail clients, print and
   the sandboxed PDF capture (that frame ships without allow-scripts, so it
   always photographs the server render). */
(function () {
  var data = window.REPORT_DATA;
  if (!data || typeof data !== 'object') return;

  var DASH = '-';
  var FONTS = {
    en: "'Noto Sans', sans-serif",
    ta: "'Noto Sans Tamil', 'Noto Sans', sans-serif",
    hi: "'Noto Sans Devanagari', 'Noto Sans', sans-serif",
    ml: "'Noto Sans Malayalam', 'Noto Sans', sans-serif",
    te: "'Noto Sans Telugu', 'Noto Sans', sans-serif",
    kn: "'Noto Sans Kannada', 'Noto Sans', sans-serif",
    bn: "'Noto Sans Bengali', 'Noto Sans', sans-serif",
    gu: "'Noto Sans Gujarati', 'Noto Sans', sans-serif",
    pa: "'Noto Sans Gurmukhi', 'Noto Sans', sans-serif",
    or: "'Noto Sans Oriya', 'Noto Sans', sans-serif",
    si: "'Noto Sans Sinhala', 'Noto Sans', sans-serif"
  };
  var GOOGLE = {
    ml: 'Noto Sans Malayalam', te: 'Noto Sans Telugu', kn: 'Noto Sans Kannada',
    bn: 'Noto Sans Bengali', gu: 'Noto Sans Gujarati', pa: 'Noto Sans Gurmukhi',
    or: 'Noto Sans Oriya', si: 'Noto Sans Sinhala'
  };

  function clean(value) {
    if (value === undefined || value === null) return '';
    return String(value).replace(/\\s+/g, ' ').trim();
  }
  function isArray(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  }
  /** The incoming value when it carries data, otherwise what is already shown. */
  function merge(next, current) {
    var incoming = clean(next);
    if (incoming.length) return incoming;
    var shown = clean(current);
    return shown.length ? shown : DASH;
  }
  function element(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function padaNumber(value) {
    var number = Number(clean(value));
    return Number.isInteger(number) && number >= 1 && number <= 4 ? number : null;
  }

  var page = document.getElementById('namakaran-page-1');
  if (!page) return;

  // The chosen languages, in the family's own order of preference. An absent or
  // malformed list leaves the rendered certificate exactly as it is.
  var languages = [];
  var requested = isArray(data.languages) ? data.languages : [];
  for (var i = 0; i < requested.length; i++) {
    var code = clean(requested[i]).toLowerCase();
    if (/^[a-z]{2,3}$/.test(code) && languages.indexOf(code) < 0) languages.push(code);
  }
  var extraFamilies = [];
  for (var j = 0; j < languages.length; j++) {
    var family = GOOGLE[languages[j]];
    if (family && extraFamilies.indexOf(family) < 0) extraFamilies.push(family);
  }
  if (extraFamilies.length) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + extraFamilies.map(function (name) {
      return 'family=' + name.replace(/ /g, '+') + ':wght@400;600;700;800';
    }).join('&') + '&display=swap';
    document.head.appendChild(link);
  }

  // ① The report date beside the particulars heading.
  var dateNode = page.querySelector('[data-nk-date]');
  if (dateNode) dateNode.textContent = merge(data.reportDate, dateNode.textContent);

  // ② The twelve particular cards (each card carries its own field name).
  var padaWord = '';
  var wordHolder = page.querySelector('[data-pada-word]');
  if (wordHolder) padaWord = wordHolder.getAttribute('data-pada-word') || '';
  var fields = page.querySelectorAll('[data-nk-field]');
  for (var f = 0; f < fields.length; f++) {
    var field = fields[f];
    var valueNode = field.querySelector('.value');
    if (!valueNode) continue;
    var key = field.getAttribute('data-nk-field');
    if (key === 'yoniRajju') {
      var yoni = clean(data.yoni);
      var rajju = clean(data.rajju);
      if (yoni.length && rajju.length) valueNode.textContent = yoni + ' / ' + rajju;
    } else if (key === 'pada') {
      var janmaForCard = padaNumber(data.pada);
      valueNode.textContent = janmaForCard === null
        ? valueNode.textContent
        : (padaWord ? padaWord + ' ' + janmaForCard : String(janmaForCard));
    } else {
      valueNode.textContent = merge(data[key], valueNode.textContent);
    }
  }

  // ③ The four syllable cards. The letters are only rebuilt when the host really
  //    supplies the ritual sounds; the Rasi line and the birth-pada highlight
  //    follow data.pada whenever it is a real pada number.
  var badgeLabel = '';
  var rasiLabel = '';
  var holder = page.querySelector('.pada-cards');
  if (holder) {
    badgeLabel = holder.getAttribute('data-janma-badge-label') || '';
    rasiLabel = holder.getAttribute('data-rasi-label') || '';
    var syllableList = isArray(data.syllables) ? data.syllables : [];
    var janmaPada = padaNumber(data.pada);
    var cards = holder.querySelectorAll('[data-nk-pada]');
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      var pada = Number(card.getAttribute('data-nk-pada'));
      // Without a pada in the data the birth highlight (and its ★ badge and big
      // letter marker) stays exactly as the server rendered it.
      var isJanma = janmaPada !== null ? pada === janmaPada : card.className.indexOf('is-janma') >= 0;

      if (janmaPada !== null) {
        card.className = 'pada-card' + (isJanma ? ' is-janma' : '');
        var badge = card.querySelector('.janma-badge');
        if (isJanma && !badge && badgeLabel) {
          card.insertBefore(element('span', 'janma-badge', badgeLabel), card.firstChild);
        } else if (!isJanma && badge && badge.parentNode) {
          badge.parentNode.removeChild(badge);
        }
      }

      if (!syllableList.length) continue;
      var entry = null;
      for (var e = 0; e < syllableList.length; e++) {
        if (padaNumber(syllableList[e] && syllableList[e].pada) === pada) entry = syllableList[e];
      }
      var rasiNode = card.querySelector('.pada-rasi-line');
      if (rasiNode) {
        rasiNode.textContent = (rasiLabel ? rasiLabel + ': ' : '') + merge(entry ? entry.rasi : undefined, rasiNode.textContent.split(': ').pop());
      }
      if (!languages.length) continue;
      var lettersWrap = card.querySelector('.pada-letters');
      if (!lettersWrap) continue;
      // Only the letters are replaced — the centred Rasi line stays put.
      var previous = lettersWrap.querySelectorAll('.pada-big-letter, .sound-big-char, .pada-mid-letter, .pada-small-letter');
      for (var d = 0; d < previous.length; d++) previous[d].parentNode.removeChild(previous[d]);
      for (var k = 0; k < languages.length; k++) {
        var className = k === 0
          ? (isJanma ? 'sound-big-char' : 'pada-big-letter')
          : (k === 1 ? 'pada-mid-letter' : 'pada-small-letter');
        var span = element('span', className, clean(entry && entry.letters ? entry.letters[languages[k]] : '') || DASH);
        span.style.fontFamily = FONTS[languages[k]] || FONTS.en;
        lettersWrap.insertBefore(span, rasiNode || null);
      }
    }
  }

  // ④ Vedic gunam & core virtues — an explicit empty list hides the block, a
  //    supplied list replaces it, and an absent list keeps what was rendered.
  var box = page.querySelector('[data-nk-virtues]');
  var supplied = isArray(data.virtues) ? data.virtues : null;
  if (supplied) {
    var virtues = [];
    for (var v = 0; v < supplied.length; v++) {
      var point = clean(supplied[v]);
      if (point.length) virtues.push(point);
    }
    if (box) box.style.display = virtues.length ? '' : 'none';
    if (virtues.length) {
      var row = box ? box.querySelector('.virtues-row') : null;
      if (!row && !box) {
        // The chart produced no virtue text at render time: build the block.
        var titleHolder = page.querySelector('[data-nk-virtues-title]');
        box = element('div', 'panel virtues-box');
        box.setAttribute('data-nk-virtues', '');
        var heading = element('h2');
        heading.appendChild(element('span', '', titleHolder ? titleHolder.getAttribute('data-nk-virtues-title') : ''));
        box.appendChild(heading);
        row = element('div', 'virtues-row');
        box.appendChild(row);
        var anchor = page.querySelector('.certification-panel');
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor);
        else page.appendChild(box);
      }
      if (row) {
        while (row.firstChild) row.removeChild(row.firstChild);
        for (var r = 0; r < virtues.length; r++) {
          var virtueCard = element('div', 'virtue-card');
          virtueCard.appendChild(element('span', 'virtue-index', String(r + 1)));
          virtueCard.appendChild(element('span', 'virtue-text', virtues[r]));
          row.appendChild(virtueCard);
        }
      }
    }
  }

  // ⑤ The certification sentence quotes the same data.
  var certName = page.querySelector('[data-nk-cert="name"]');
  if (certName) certName.textContent = merge(data.name, certName.textContent);
  var certStar = page.querySelector('[data-nk-cert="nakshatra"]');
  if (certStar) certStar.textContent = merge(data.nakshatra, certStar.textContent);
})();
</script>

</body>
</html>`;
}
