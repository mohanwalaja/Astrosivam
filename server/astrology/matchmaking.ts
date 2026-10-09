import rajjuTable from '../../api/astrology/rajju.json' with { type: 'json' };
import {
  Rasi,
  PoruthamStatus,
  SinglePoruthamResult,
  SevvayDoshamAnalysis,
  WeddingMatchResult
} from './types.js';
import { kujaDoshaFromHoroscope } from './kujaDosha.js';
import {
  NAKSHATRAM_NAMES_TA,
  NAKSHATRAM_NAMES_EN,
  NAKSHATRAM_NAMES_HI,
  RASI_INFO,
  calculatePrecisionHoroscope
} from './astronomy.js';

// Gana: 0 = Deva, 1 = Manushya, 2 = Rakshasa
const NAKSHATRA_GANA = [
  0, 1, 2, 1, 0, 1, 0, 0, 2,
  2, 1, 1, 0, 2, 0, 2, 0, 2,
  2, 1, 1, 0, 2, 2, 1, 1, 0
];

// Rajju: 0=Siro (Head), 1=Kanda (Neck), 2=Udhara (Stomach), 3=Uru (Thigh), 4=Pada (Foot)
//
// The classical Tamil five-group split (Thirumana Porutham), in the engine's
// Nakshatra order:
//   Siro   (head):  Mrigashirsha, Chitra, Dhanishta
//   Kanda  (neck):  Rohini, Ardra, Hasta, Swati, Shravana, Shatabhisha
//   Udhara (navel): Krittika, Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha, Purva Bhadrapada
//   Uru    (thigh): Bharani, Pushya, Purva Phalguni, Anuradha, Purva Ashadha, Uttara Bhadrapada
//   Pada   (foot):  Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati
//
// The five groups repeat identically over each nine-Nakshatra arc, so the
// table is (4,3,2,1,0,1,2,3,4) three times. Rajju MATCHES when the bride and
// the groom fall in DIFFERENT groups and fails only when both fall in the SAME
// group. The former table rotated 4,3,2,1,0 every five stars, which shifted
// Ardra/Punarvasu/Pushya/Ashlesha, Swati/Vishakha/Anuradha/Jyeshtha and
// Shatabhisha/Purva Bhadrapada/Uttara Bhadrapada by one group and wrongly
// failed pairs such as Dhanishta (Siro) + Swati (Kanda).
const NAKSHATRA_RAJJU = rajjuTable.groups;

const RAJJU_NAMES_TA = ['சிரோ ரஜ்ஜு (தலை)', 'கண்ட ரஜ்ஜு (கழுத்து)', 'உதர ரஜ்ஜு (வயிறு)', 'ஊரு ரஜ்ஜு (தொடை)', 'பாத ரஜ்ஜு (பாதம்)'];
const RAJJU_NAMES_EN = ['Siro Rajju (Head)', 'Kanda Rajju (Neck)', 'Udhara Rajju (Stomach)', 'Uru Rajju (Thigh)', 'Pada Rajju (Foot)'];
const RAJJU_NAMES_HI = ['शिरो रज्जु (सिर)', 'कंठ रज्जु (गला)', 'उदर रज्जु (नाभि)', 'उरु रज्जु (जंघा)', 'पाद रज्जु (पैर)'];

// Yoni animal types (14 animals)
const NAKSHATRA_YONI = [
  0, 1, 2, 3, 3, 4, 5, 2, 5,
  6, 6, 7, 8, 9, 8, 9, 10, 10,
  4, 11, 12, 11, 13, 0, 13, 7, 1
];

// Inimical Yoni pairs (Horse-Buffalo, Elephant-Lion, Sheep-Monkey, Serpent-Mongoose, Dog-Deer, Cat-Rat, Cow-Tiger)
const INIMICAL_YONIS = new Set([
  '0,8', '8,0',
  '1,13', '13,1',
  '2,11', '11,2',
  '3,12', '12,3',
  '4,10', '10,4',
  '5,6', '6,5',
  '7,9', '9,7'
]);

const YONI_ANIMAL_NAMES = [
  { en: 'Horse', ta: 'குதிரை', hi: 'घोड़ा' },
  { en: 'Elephant', ta: 'யானை', hi: 'हाथी' },
  { en: 'Goat', ta: 'ஆடு', hi: 'बकरी' },
  { en: 'Serpent', ta: 'பாம்பு', hi: 'सर्प' },
  { en: 'Dog', ta: 'நாய்', hi: 'कुत्ता' },
  { en: 'Cat', ta: 'பூனை', hi: 'बिल्ली' },
  { en: 'Rat', ta: 'எலி', hi: 'चूहा' },
  { en: 'Cow', ta: 'பசு', hi: 'गाय' },
  { en: 'Buffalo', ta: 'எருமை', hi: 'भैंस' },
  { en: 'Tiger', ta: 'புலி', hi: 'बाघ' },
  { en: 'Deer', ta: 'மான்', hi: 'हिरण' },
  { en: 'Monkey', ta: 'குரங்கு', hi: 'बंदर' },
  { en: 'Mongoose', ta: 'கீரி', hi: 'नेवला' },
  { en: 'Lion', ta: 'சிங்கம்', hi: 'सिंह' }
] as const;

// Vedha pairs
const VEDHA_PAIRS = new Set([
  '0,17', '17,0',
  '1,16', '16,1',
  '2,15', '15,2',
  '3,14', '14,3',
  '5,21', '21,5',
  '6,20', '20,6',
  '7,19', '19,7',
  '8,18', '18,8',
  '9,26', '26,9',
  '10,25', '25,10',
  '11,24', '24,11',
  '12,23', '23,12',
  '4,13', '13,4', '13,22', '22,13', '4,22', '22,4'
]);

export function calculateWeddingCompatibility(
  param1: any,
  param2?: any
): WeddingMatchResult {
  let brideInput: any = null;
  let groomInput: any = null;

  if (param1 && param2) {
    brideInput = param1;
    groomInput = param2;
  } else if (param1) {
    const p = param1;
    brideInput = p.bride || p.girl || p.brideDetails || p.girlDetails || (p.brideName || p.brideDob ? {
      name: p.brideName || p.girlName || p.p1Name,
      dob: p.brideDob || p.girlDob || p.p1Dob,
      tob: p.brideTob || p.girlTob || p.p1Tob,
      birthPlace: p.brideBirthPlace || p.bridePlace || p.birthPlace,
      country: p.brideCountry || '',
      latitude: p.brideLatitude ?? p.latitude,
      longitude: p.brideLongitude ?? p.longitude,
      timezoneOffsetHours: p.brideTimezoneOffsetHours ?? p.timezoneOffsetHours,
      gender: 'F'
    } : null);

    groomInput = p.groom || p.boy || p.groomDetails || p.boyDetails || (p.groomName || p.groomDob ? {
      name: p.groomName || p.boyName || p.p2Name,
      dob: p.groomDob || p.boyDob || p.p2Dob,
      tob: p.groomTob || p.boyTob || p.p2Tob,
      birthPlace: p.groomBirthPlace || p.groomPlace || p.birthPlace,
      country: p.groomCountry || '',
      latitude: p.groomLatitude ?? p.latitude,
      longitude: p.groomLongitude ?? p.longitude,
      timezoneOffsetHours: p.groomTimezoneOffsetHours ?? p.timezoneOffsetHours,
      gender: 'M'
    } : null);

    if (!brideInput && !groomInput && p.p1 && p.p2) {
      if (p.p1Role === 'bride' || p.p1.gender === 'F') {
        brideInput = p.p1;
        groomInput = p.p2;
      } else {
        groomInput = p.p1;
        brideInput = p.p2;
      }
    }
  }

  // Missing birth particulars must fail rather than silently creating a
  // compatibility result from the former 1990/Nadi defaults.
  const brideName = brideInput?.name || brideInput?.brideName || brideInput?.devoteeName || 'Bride';
  const brideDob = brideInput?.dob || brideInput?.brideDob || '';
  const brideTob = brideInput?.tob || brideInput?.brideTob || '';
  const bridePlace = brideInput?.birthPlace || brideInput?.bridePlace || brideInput?.place || '';
  const brideCountry = brideInput?.country || brideInput?.brideCountry || '';
  const brideLat = Number(brideInput?.latitude);
  const brideLng = Number(brideInput?.longitude);
  const brideTz = Number(brideInput?.timezoneOffsetHours);

  const groomName = groomInput?.name || groomInput?.groomName || groomInput?.devoteeName || 'Groom';
  const groomDob = groomInput?.dob || groomInput?.groomDob || '';
  const groomTob = groomInput?.tob || groomInput?.groomTob || '';
  const groomPlace = groomInput?.birthPlace || groomInput?.groomPlace || groomInput?.place || '';
  const groomCountry = groomInput?.country || groomInput?.groomCountry || '';
  const groomLat = Number(groomInput?.latitude);
  const groomLng = Number(groomInput?.longitude);
  const groomTz = Number(groomInput?.timezoneOffsetHours);

  const brideChart = calculatePrecisionHoroscope(
    brideName,
    brideDob,
    brideTob,
    bridePlace,
    brideLat,
    brideLng,
    brideTz,
    brideCountry,
    'F'
  );

  const groomChart = calculatePrecisionHoroscope(
    groomName,
    groomDob,
    groomTob,
    groomPlace,
    groomLat,
    groomLng,
    groomTz,
    groomCountry,
    'M'
  );

  const bStar = brideChart.janmaNakshatraIndex;
  const gStar = groomChart.janmaNakshatraIndex;
  const bPada = brideChart.janmaPada;
  const gPada = groomChart.janmaPada;
  const bRasi = brideChart.chandraRasi;
  const gRasi = groomChart.chandraRasi;

  const brideMars = brideChart.planetPositions.find(p => p.graha === 'mars');
  const groomMars = groomChart.planetPositions.find(p => p.graha === 'mars');
  if (!brideMars || !groomMars) {
    throw new Error('Mars placement is unavailable; Kuja compatibility was not calculated.');
  }

  const poruthams: SinglePoruthamResult[] = [];

  // 1. Dina Porutham (Health & Long Life)
  const starDiff = ((gStar - bStar + 27) % 27) + 1;
  const dinaRem = starDiff % 9;
  let dinaStatus = PoruthamStatus.MADHYAMAM;

  if ([2, 4, 6, 8, 0].includes(dinaRem) || starDiff === 27) {
    dinaStatus = PoruthamStatus.UTTHAMAM;
  } else if (bStar === gStar && [3, 5, 9, 15, 21, 25, 26].includes(bStar)) {
    dinaStatus = PoruthamStatus.UTTHAMAM;
  } else if ([1, 3, 5, 7].includes(dinaRem)) {
    dinaStatus = PoruthamStatus.PORUNDHADHU;
  }

  poruthams.push({
    id: 'dina',
    nameTa: '1. தினப் பொருத்தம்',
    nameEn: '1. Dina Porutham (Health & Longevity)',
    nameHi: '1. दिन पोरुथम (स्वास्थ्य एवं दीर्घायु)',
    status: dinaStatus,
    pointsEarned: dinaStatus === PoruthamStatus.UTTHAMAM ? 1.0 : dinaStatus === PoruthamStatus.MADHYAMAM ? 0.5 : 0.0,
    maxPoints: 1.0,
    explanationTa: dinaStatus === PoruthamStatus.UTTHAMAM
      ? 'உத்தமம்! தம்பதியரின் நீண்ட ஆயுளையும், உடல் நலனையும், நோய் நொடியற்ற வளமான வாழ்க்கையையும் அருளும்.'
      : dinaStatus === PoruthamStatus.MADHYAMAM
      ? 'மத்திமம்! மிதமான நட்சத்திர தூரம்; முழு ஆரோக்கிய ஆதரவு இல்லை.'
      : 'பொருந்தாது! நட்சத்திர இடைவெளி ஆரோக்கியத்தையும் நீண்ட ஆயுளையும் தாங்கவில்லை; மற்ற முதன்மைப் பொருத்தங்களின் பலம் தேவை.',
    explanationEn: dinaStatus === PoruthamStatus.UTTHAMAM
      ? 'Auspicious! Bestows vitality, health resilience, long life, and prosperity to the couple.'
      : dinaStatus === PoruthamStatus.MADHYAMAM
      ? 'Only a partial Dina match - the star distance supports average, not full, vitality and longevity.'
      : 'No Dina support - the star distance carries neither full vitality and longevity nor freedom from discord, so it needs support from the other crucial Poruthams.',
    explanationHi: dinaStatus === PoruthamStatus.UTTHAMAM
      ? 'उत्तम! दंपत्ति के दीर्घायु, उत्तम स्वास्थ्य और समृद्धि का कारक है।'
      : dinaStatus === PoruthamStatus.MADHYAMAM
      ? 'आंशिक मेल - मध्यम नक्षत्र दूरी; पूर्ण स्वास्थ्य एवं दीर्घायु समर्थन नहीं।'
      : 'दिन पोरुथम नहीं - नक्षत्र दूरी स्वास्थ्य, दीर्घायु एवं मतभेद-रहितता का बल नहीं देती।',
    isCrucial: true
  });

  // 2. Gana Porutham (Temperament & Psychology)
  const bGana = NAKSHATRA_GANA[bStar];
  const gGana = NAKSHATRA_GANA[gStar];
  let ganaStatus = PoruthamStatus.PORUNDHADHU;

  if (bGana === gGana) {
    ganaStatus = PoruthamStatus.UTTHAMAM;
  } else if (gGana === 0 && bGana === 1) {
    ganaStatus = PoruthamStatus.UTTHAMAM; // Deva groom + Manushya bride
  } else if (gGana === 1 && bGana === 0) {
    ganaStatus = PoruthamStatus.MADHYAMAM; // Manushya groom + Deva bride
  } else if (gGana === 2 && bGana === 0 && starDiff > 14) {
    ganaStatus = PoruthamStatus.MADHYAMAM;
  } else {
    ganaStatus = PoruthamStatus.PORUNDHADHU;
  }

  const ganaNamesTa = ['தேவ கணம்', 'மனுஷ்ய கணம்', 'ராட்சச கணம்'];
  const ganaNamesEn = ['Deva Gana (Divine)', 'Manushya Gana (Human)', 'Rakshasa Gana (Dynamic)'];
  const ganaNamesHi = ['देव गण', 'मनुष्य गण', 'राक्षस गण'];

  poruthams.push({
    id: 'gana',
    nameTa: '2. கணப் பொருத்தம்',
    nameEn: '2. Gana Porutham (Temperament & Mind)',
    nameHi: '2. गण पोरुथम (स्वभाव एवं सामंजस्य)',
    status: ganaStatus,
    pointsEarned: ganaStatus === PoruthamStatus.UTTHAMAM ? 1.0 : ganaStatus === PoruthamStatus.MADHYAMAM ? 0.5 : 0.0,
    maxPoints: 1.0,
    explanationTa: `பெண்: ${ganaNamesTa[bGana]}, பிள்ளை: ${ganaNamesTa[gGana]}. ` +
      (ganaStatus === PoruthamStatus.UTTHAMAM ? 'மன ஒற்றுமை, புரிதல் மற்றும் இல்லற அமைதியை நல்கும்.' : 'இயல்பு குண வேறுபாடுகளை விட்டுக்கொடுத்து வாழ வேண்டும்.'),
    explanationEn: `Bride: ${ganaNamesEn[bGana]}, Groom: ${ganaNamesEn[gGana]}. ` +
      (ganaStatus === PoruthamStatus.UTTHAMAM ? 'Excellent psychological resonance and emotional compatibility.' : 'Divergent temperaments; requires patient mutual adjustment.'),
    explanationHi: `कन्या: ${ganaNamesHi[bGana]}, वर: ${ganaNamesHi[gGana]}। ` +
      (ganaStatus === PoruthamStatus.UTTHAMAM ? 'उत्तम मानसिक और भावनात्मक तालमेल।' : 'परस्पर समझदारी आवश्यक।'),
    isCrucial: true
  });

  // 3. Mahendra Porutham (Progeny & Lineage Growth)
  const mahendraStatus = [4, 7, 10, 13, 16, 19, 22, 25].includes(starDiff)
    ? PoruthamStatus.UTTHAMAM
    : PoruthamStatus.PORUNDHADHU;

  poruthams.push({
    id: 'mahendra',
    nameTa: '3. மகேந்திரப் பொருத்தம்',
    nameEn: '3. Mahendra Porutham (Progeny & Lineage)',
    nameHi: '3. महेंद्र पोरुथम (संतान एवं वंश वृद्धि)',
    status: mahendraStatus,
    pointsEarned: mahendraStatus === PoruthamStatus.UTTHAMAM ? 1.0 : 0.0,
    maxPoints: 1.0,
    explanationTa: mahendraStatus === PoruthamStatus.UTTHAMAM
      ? 'உத்தமம்! புத்திர பாக்கியம், வம்ச விருத்தி மற்றும் சந்ததி மேன்மையை நல்கும்.'
      : 'பொருந்தாது! மகேந்திர ஆதரவு இல்லை; புத்திர பாக்கியம் இருவரின் தனிப்பட்ட ஜாதகத்தில் 5-ம் பாவகம் கொண்டு அறியப்படும்.',
    explanationEn: mahendraStatus === PoruthamStatus.UTTHAMAM
      ? 'Auspicious! Bestows blessed offspring, family lineage expansion, and prosperity.'
      : 'Not supportive - the star distance gives no Mahendra strength for progeny and lineage growth (each chart is judged separately from its 5th house).',
    explanationHi: mahendraStatus === PoruthamStatus.UTTHAMAM
      ? 'उत्तम! संतान सुख और कुल वृद्धि के लिए अत्यंत शुभ।'
      : 'सहायक नहीं - नक्षत्र दूरी से महेंद्र बल नहीं मिलता (संतान योग प्रत्येक कुंडली के पंचम भाव से अलग देखा जाता है)।',
    isCrucial: false
  });

  // 4. Stree Deergha Porutham (Prosperity for Bride)
  let sthreeStatus = PoruthamStatus.PORUNDHADHU;
  if (starDiff > 13) {
    sthreeStatus = PoruthamStatus.UTTHAMAM;
  } else if (starDiff >= 7) {
    sthreeStatus = PoruthamStatus.MADHYAMAM;
  }

  poruthams.push({
    id: 'sthree_dheergam',
    nameTa: '4. ஸ்திரீ தீர்க்கப் பொருத்தம்',
    nameEn: '4. Stree Deergha Porutham (Bride Prosperity)',
    nameHi: '4. स्त्री दीर्घ पोरुथम (स्त्री सुख एवं सौभाग्य)',
    status: sthreeStatus,
    pointsEarned: sthreeStatus === PoruthamStatus.UTTHAMAM ? 1.0 : sthreeStatus === PoruthamStatus.MADHYAMAM ? 0.5 : 0.0,
    maxPoints: 1.0,
    explanationTa: sthreeStatus === PoruthamStatus.UTTHAMAM
      ? 'உத்தமம்! பெண்ணிற்கு வாழ்நாள் முழுதும் மங்கலமும், ஐஸ்வர்யமும், நல்வாழ்வும் நிலைக்கும்.'
      : sthreeStatus === PoruthamStatus.MADHYAMAM
      ? 'மத்திமம்! மிதமான நட்சத்திர தூரம்; மணமகளுக்கு வலுவான வளர்ச்சி ஆதரவு இல்லை.'
      : 'பொருந்தாது! நட்சத்திர இடைவெளி குறைவு; மணமகளுக்கு நீண்ட ஆயுள் மற்றும் முழு வளர்ச்சி ஆதரவு இல்லை.',
    explanationEn: sthreeStatus === PoruthamStatus.UTTHAMAM
      ? 'Auspicious! Safeguards prosperity, health, happiness, and marital security for the bride.'
      : sthreeStatus === PoruthamStatus.MADHYAMAM
      ? 'Only a moderate star interval - long-term prosperity for the bride is weakly supported.'
      : 'No Stree Deergha support - the short star interval gives the bride neither full longevity nor all-round growth.',
    explanationHi: sthreeStatus === PoruthamStatus.UTTHAMAM
      ? 'उत्तम! वधु के दीर्घ सौभाग्य और गृह समृद्धि की वृद्धि।'
      : sthreeStatus === PoruthamStatus.MADHYAMAM
      ? 'मध्यम दूरी - वधू की दीर्घकालिक समृद्धि को सीमित समर्थन मात्र।'
      : 'स्त्री दीर्घ पोरुथम नहीं - कम नक्षत्र दूरी से वधू को दीर्घायु एवं सर्वांगीण विकास का बल नहीं मिलता।',
    isCrucial: false
  });

  // 5. Yoni Porutham (Physical & Emotional Harmony)
  const brideYoni = NAKSHATRA_YONI[bStar];
  const groomYoni = NAKSHATRA_YONI[gStar];
  const isYoniEnemy = INIMICAL_YONIS.has(`${brideYoni},${groomYoni}`);
  const yoniRelationship: 'same' | 'neutral' | 'enemy' = brideYoni === groomYoni
    ? 'same'
    : isYoniEnemy
    ? 'enemy'
    : 'neutral';
  const yoniStatus = brideYoni === groomYoni
    ? PoruthamStatus.UTTHAMAM
    : !isYoniEnemy
    ? PoruthamStatus.MADHYAMAM
    : PoruthamStatus.PORUNDHADHU;
  const brideYoniAnimal = YONI_ANIMAL_NAMES[brideYoni];
  const groomYoniAnimal = YONI_ANIMAL_NAMES[groomYoni];
  const yoniRelationshipTa = { same: 'ஒரே யோனி', friend: 'நட்பு', neutral: 'நடுநிலை', enemy: 'பகை' }[yoniRelationship];
  const yoniRelationshipEn = { same: 'same yoni', friend: 'friendly', neutral: 'neutral', enemy: 'enmity' }[yoniRelationship];
  const yoniRelationshipHi = { same: 'समान योनि', friend: 'मैत्रीपूर्ण', neutral: 'तटस्थ', enemy: 'शत्रुता' }[yoniRelationship];

  poruthams.push({
    id: 'yoni',
    nameTa: '5. யோனிப் பொருத்தம்',
    nameEn: '5. Yoni Porutham (Mutual Harmony)',
    nameHi: '5. योनि पोरुथम (परस्पर आकर्षण एवं सुख)',
    status: yoniStatus,
    pointsEarned: yoniStatus === PoruthamStatus.UTTHAMAM ? 1.0 : yoniStatus === PoruthamStatus.MADHYAMAM ? 0.5 : 0.0,
    maxPoints: 1.0,
    explanationTa: `மணமகள்: ${brideYoniAnimal.ta}; மணமகன்: ${groomYoniAnimal.ta}. யோனி உறவு: ${yoniRelationshipTa}.`,
    explanationEn: `Bride: ${brideYoniAnimal.en}; Groom: ${groomYoniAnimal.en}. Yoni relationship: ${yoniRelationshipEn}.`,
    explanationHi: `वधू: ${brideYoniAnimal.hi}; वर: ${groomYoniAnimal.hi}। योनि संबंध: ${yoniRelationshipHi}।`,
    isCrucial: true,
    yoniBrideAnimalTa: brideYoniAnimal.ta,
    yoniBrideAnimalEn: brideYoniAnimal.en,
    yoniBrideAnimalHi: brideYoniAnimal.hi,
    yoniGroomAnimalTa: groomYoniAnimal.ta,
    yoniGroomAnimalEn: groomYoniAnimal.en,
    yoniGroomAnimalHi: groomYoniAnimal.hi,
    yoniRelationship
  });

  // 6. Rasi Porutham (Sign Harmony & Lineage Bliss)
  const rasiDiff = ((gRasi - bRasi + 12) % 12) + 1;
  let rasiStatus = PoruthamStatus.MADHYAMAM;

  if (rasiDiff === 7) {
    rasiStatus = PoruthamStatus.UTTHAMAM; // Sama Sapthama
  } else if ([3, 4, 10, 11, 12].includes(rasiDiff)) {
    rasiStatus = PoruthamStatus.UTTHAMAM;
  } else if ([6, 8].includes(rasiDiff)) {
    // Shashtashtaka exception for friendly lords
    const bLord = RASI_INFO[bRasi].lordEn;
    const gLord = RASI_INFO[gRasi].lordEn;
    if (bLord === gLord || ([1, 8].includes(bRasi) && [1, 8].includes(gRasi))) {
      rasiStatus = PoruthamStatus.MADHYAMAM;
    } else {
      rasiStatus = PoruthamStatus.PORUNDHADHU;
    }
  }

  poruthams.push({
    id: 'rasi',
    nameTa: '6. ராசிப் பொருத்தம்',
    nameEn: '6. Rasi Porutham (Zodiac Sign Unity)',
    nameHi: '6. राशि पोरुथम (पारस्परिक सौहार्द)',
    status: rasiStatus,
    pointsEarned: rasiStatus === PoruthamStatus.UTTHAMAM ? 1.0 : rasiStatus === PoruthamStatus.MADHYAMAM ? 0.5 : 0.0,
    maxPoints: 1.0,
    explanationTa: rasiStatus === PoruthamStatus.UTTHAMAM
      ? 'உத்தமம்! குடும்ப ஒற்றுமை, வம்ச மேன்மை மற்றும் சுப காரிய வெற்றிகளை அருளும்.'
      : rasiStatus === PoruthamStatus.MADHYAMAM
      ? 'மத்திமம்! ராசி இணக்கம் மிதமானது; குடும்ப ஒற்றுமைக்கு முயற்சி தேவை.'
      : 'சஷ்டாஷ்டகம் (6/8 ராசி வித்தியாசம்). பிற கிரக பலம் கொண்டு சமன் செய்ய வேண்டும்.',
    explanationEn: rasiStatus === PoruthamStatus.UTTHAMAM
      ? 'Auspicious! Strengthens family unity, financial synergy, and long-term matrimonial joy.'
      : rasiStatus === PoruthamStatus.MADHYAMAM
      ? 'Only moderate sign compatibility - mutual respect exists, but family unity needs conscious effort.'
      : 'Shashtashtaka (6/8 distance); relies on mitigating benefic planetary aspects.',
    explanationHi: rasiStatus === PoruthamStatus.UTTHAMAM
      ? 'उत्तम! पारिवारिक सुख-शांति और कुल गौरव के लिए श्रेष्ठ।'
      : 'राशि मेल मध्यम है; पारिवारिक एकता हेतु प्रयास आवश्यक।',
    isCrucial: true
  });

  // 7. Rasiyadhipathi Porutham (Planetary Lord Friendship)
  const bLord = RASI_INFO[bRasi].lordEn;
  const gLord = RASI_INFO[gRasi].lordEn;
  const devaPlanets = new Set(['Sun', 'Moon', 'Mars', 'Jupiter']);
  const asuraPlanets = new Set(['Mercury', 'Venus', 'Saturn']);
  const isSameLord = bLord === gLord;
  const isFriendlyLords =
    (devaPlanets.has(bLord) && devaPlanets.has(gLord)) ||
    (asuraPlanets.has(bLord) && asuraPlanets.has(gLord));

  let rasiAdhipathiStatus = PoruthamStatus.PORUNDHADHU;
  if (isSameLord || isFriendlyLords) {
    rasiAdhipathiStatus = PoruthamStatus.UTTHAMAM;
  } else if ((bLord === 'Mercury' && devaPlanets.has(gLord)) || (gLord === 'Mercury' && devaPlanets.has(bLord))) {
    rasiAdhipathiStatus = PoruthamStatus.MADHYAMAM;
  }

  poruthams.push({
    id: 'rasiyadhipathi',
    nameTa: '7. ராசியாதிபதிப் பொருத்தம்',
    nameEn: '7. Rasiyadhipathi (Planetary Lord Affinity)',
    nameHi: '7. राश्याधिपति पोरुथम (ग्रह मित्रता)',
    status: rasiAdhipathiStatus,
    pointsEarned: rasiAdhipathiStatus === PoruthamStatus.UTTHAMAM ? 1.0 : rasiAdhipathiStatus === PoruthamStatus.MADHYAMAM ? 0.5 : 0.0,
    maxPoints: 1.0,
    explanationTa: `பெண் ராசி அதிபதி: ${RASI_INFO[bRasi].lordTa}, பிள்ளை ராசி அதிபதி: ${RASI_INFO[gRasi].lordTa}. ` +
      (rasiAdhipathiStatus === PoruthamStatus.UTTHAMAM ? 'கிரக அதிபதிகள் நண்பர்கள்; மனமார்ந்த நட்பு தொடரும்.' : 'மத்திமம்! ராசி அதிபதிகள் பரஸ்பர நண்பர்கள் அல்ல; மன ஒற்றுமைக்கு முயற்சி தேவை.'),
    explanationEn: `Bride Lord: ${bLord}, Groom Lord: ${gLord}. ` +
      (rasiAdhipathiStatus === PoruthamStatus.UTTHAMAM ? 'Ruling planets are mutual friends, fostering deep lifelong companionship.' : 'Only neutral planetary affinity - the ruling planets are not mutual friends, so mental harmony needs conscious effort.'),
    explanationHi: `कन्या राश्याधिपति: ${RASI_INFO[bRasi].lordHi}, वर राश्याधिपति: ${RASI_INFO[gRasi].lordHi}। ` +
      (rasiAdhipathiStatus === PoruthamStatus.UTTHAMAM ? 'ग्रह स्वामी मित्र हैं, जिससे सौहार्द बना रहेगा।' : 'राशि स्वामी परस्पर मित्र नहीं हैं; मानसिक सामंजस्य हेतु प्रयास आवश्यक।'),
    isCrucial: false
  });

  // 8. Vasiya Porutham (Mutual Attraction & Magnetic Bond)
  const vasiyaPairs: Record<number, number[]> = {
    1: [5, 8], 2: [4, 7], 3: [6], 4: [8, 9], 5: [7, 9], 6: [3, 12],
    7: [10, 12], 8: [4, 11], 9: [12], 10: [1, 11], 11: [1, 10], 12: [3, 10]
  };
  const isVasiya =
    vasiyaPairs[bRasi]?.includes(gRasi) ||
    vasiyaPairs[gRasi]?.includes(bRasi) ||
    false;
  const vasiyaStatus = isVasiya ? PoruthamStatus.UTTHAMAM : PoruthamStatus.MADHYAMAM;

  poruthams.push({
    id: 'vasiya',
    nameTa: '8. வசியப் பொருத்தம்',
    nameEn: '8. Vasiya Porutham (Mutual Attraction & Adoration)',
    nameHi: '8. वश्य पोरुथम (परस्पर आकर्षण)',
    status: vasiyaStatus,
    pointsEarned: isVasiya ? 1.0 : 0.5,
    maxPoints: 1.0,
    explanationTa: isVasiya
      ? 'உத்தமம்! தம்பதியரிடையே பிரியாத காதலும், ஒருவரை ஒருவர் கவரும் வசிய ஈர்ப்பும் உண்டாகும்.'
      : 'மத்திமம்! இயல்பான அன்பு மட்டுமே; சிறப்பு வசிய ஈர்ப்பு இல்லை.',
    explanationEn: isVasiya
      ? 'Auspicious! Special magnetic bond, continuous adoration, and endearing mutual attraction.'
      : 'Only ordinary affection - the special Vasiya (mutual attraction) pull is absent.',
    explanationHi: isVasiya
      ? 'उत्तम! परस्पर प्रगाढ़ प्रेम और आकर्षण का सूचक।'
      : 'सामान्य स्नेह मात्र - विशेष वश्य आकर्षण नहीं।',
    isCrucial: false
  });

  // 9. Rajju Porutham (Marital Longevity - MOST CRITICAL)
  const bRajju = NAKSHATRA_RAJJU[bStar];
  const gRajju = NAKSHATRA_RAJJU[gStar];
  const isSameRajju = bRajju === gRajju;
  const rajjuStatus = !isSameRajju ? PoruthamStatus.UTTHAMAM : PoruthamStatus.PORUNDHADHU;

  poruthams.push({
    id: 'rajju',
    nameTa: '9. ரஜ்ஜுப் பொருத்தம் (மிக முக்கியமானது)',
    nameEn: '9. Rajju Porutham (Marital Longevity - CRITICAL)',
    nameHi: '9. रज्जु पोरुथम (मांगल्य एवं दीर्घायु - अति महत्वपूर्ण)',
    status: rajjuStatus,
    pointsEarned: !isSameRajju ? 1.0 : 0.0,
    maxPoints: 1.0,
    explanationTa: !isSameRajju
      ? `உத்தமம்! வேறுபட்ட ரஜ்ஜு (பெண்: ${RAJJU_NAMES_TA[bRajju]}, பிள்ளை: ${RAJJU_NAMES_TA[gRajju]}). மாங்கல்ய பலமும் நீண்ட ஆயுளும் அருளும்.`
      : `ஏக ரஜ்ஜு தோஷம் (${RAJJU_NAMES_TA[bRajju]}). தம்பதியரின் தனி ஜாதக ஆய்வும், விசேஷ சுப பரிகாரங்களும் ஆலோசிக்கப்பட வேண்டும்.`,
    explanationEn: !isSameRajju
      ? `Auspicious! Different Rajjus (Bride: ${RAJJU_NAMES_EN[bRajju]}, Groom: ${RAJJU_NAMES_EN[gRajju]}). Confers unbroken marital security and longevity.`
      : `Same Rajju affliction (${RAJJU_NAMES_EN[bRajju]}). Classical Rajju affliction requires expert astrological review.`,
    explanationHi: !isSameRajju
      ? `उत्तम! भिन्न रज्जु (वधु: ${RAJJU_NAMES_HI[bRajju]}, वर: ${RAJJU_NAMES_HI[gRajju]})। अखंड सौभाग्य एवं दीर्घायु का वरदान।`
      : `एक रज्जु दोष (${RAJJU_NAMES_HI[bRajju]})। कुंडली का गहन विश्लेषण आवश्यक।`,
    isCrucial: true
  });

  // 10. Vedhai Porutham (Obstacle & Affliction Prevention)
  const isVedhaAfflicted = VEDHA_PAIRS.has(`${bStar},${gStar}`);
  const vedhaStatus = !isVedhaAfflicted ? PoruthamStatus.UTTHAMAM : PoruthamStatus.PORUNDHADHU;

  poruthams.push({
    id: 'vedhai',
    nameTa: '10. வேதைப் பொருத்தம்',
    nameEn: '10. Vedha Porutham (Discord Elimination)',
    nameHi: '10. वेध पोरुथम (विघ्न निवारण)',
    status: vedhaStatus,
    pointsEarned: !isVedhaAfflicted ? 1.0 : 0.0,
    maxPoints: 1.0,
    explanationTa: !isVedhaAfflicted
      ? 'உத்தமம்! வேதை தோஷம் இல்லை. குடும்பத்தில் பகை, துன்பங்கள் மற்றும் தடைகளைத் தடுக்கும்.'
      : 'வேதை தோஷம் உள்ளது; நட்சத்திரங்களிடையே எதிர்மறை தொடர்பு உள்ளது.',
    explanationEn: !isVedhaAfflicted
      ? 'Auspicious! Free of Vedha obstruction. Shields against sorrow, dispute, and unnecessary friction.'
      : 'Vedha obstruction present between the chosen nakshatras.',
    explanationHi: !isVedhaAfflicted
      ? 'उत्तम! वेध दोष से मुक्त। गृह कलह और बाधाओं से सुरक्षा।'
      : 'वेध बाधा उपस्थित है।',
    isCrucial: true
  });

  // Sevvay Dosham (Kuja Dosha) Analysis & Dosha Samyam
  // Both charts are judged by the shared classical rule set in ./kujaDosha.ts —
  // the same algorithm the PHP engine uses: Mars in house 2, 4, 7, 8 or 12
  // counted whole-sign from the Lagna, the Moon AND Venus, with the full
  // exception and mitigation list. The rule that used to live here tested only
  // houses 2, 4, 7, 8, 12 from the Lagna, which missed 60 of the doshas the PHP
  // engine reports over a 400-chart sample, so a couple could be declared a
  // "clean match" here while the PDF called them Manglik.
  const brideKuja = kujaDoshaFromHoroscope(brideChart);
  const groomKuja = kujaDoshaFromHoroscope(groomChart);
  const bCancelled = brideKuja.cancelled === true;
  const gCancelled = groomKuja.cancelled === true;
  const bEffective = brideKuja.isPresent === true;
  const gEffective = groomKuja.isPresent === true;

  // Samyam can only be asserted when both verdicts are known; an unassessable
  // chart must not be reported as a clean, balanced match.
  const isBalanced =
    brideKuja.isPresent !== null && groomKuja.isPresent !== null && brideKuja.isPresent === groomKuja.isPresent;

  const brideMarsHouse = brideKuja.houses.lagna ?? brideKuja.marsBhava;
  const groomMarsHouse = groomKuja.houses.lagna ?? groomKuja.marsBhava;
  const severityFor = (a: ReturnType<typeof kujaDoshaFromHoroscope>) => ({
    ta: a.isPresent === false
      ? 'தோஷம் இல்லை'
      : a.status === 'DOSHA_MILD'
      ? 'மிதமான செவ்வாய் தோஷம்'
      : a.status === 'DOSHA_PRESENT'
      ? 'செவ்வாய் தோஷம் உள்ளது'
      : 'தோஷம் மதிப்பிடப்படவில்லை',
    en: a.isPresent === false
      ? 'No Kuja Dosha'
      : a.status === 'DOSHA_MILD'
      ? 'Mild Sevvay Dosha'
      : a.status === 'DOSHA_PRESENT'
      ? 'Sevvay Dosha Present'
      : 'Kuja Dosha not assessed',
    hi: a.isPresent === false
      ? 'मंगल दोष नहीं'
      : a.status === 'DOSHA_MILD'
      ? 'अल्प मंगल दोष'
      : a.status === 'DOSHA_PRESENT'
      ? 'मंगल दोष उपस्थित'
      : 'मंगल दोष का आकलन नहीं हुआ'
  });
  const bSeverity = severityFor(brideKuja);
  const gSeverity = severityFor(groomKuja);
  // Cancellations and mitigations are reported in the reader's language, not
  // translated at the template layer.
  const reasonFor = (a: ReturnType<typeof kujaDoshaFromHoroscope>) => {
    const notes = a.exceptions.length > 0 ? a.exceptions : a.mitigations;
    if (notes.length === 0) return null;
    return {
      ta: notes.map(note => note.ta).join(' '),
      en: notes.map(note => note.en).join(' '),
      hi: notes.map(note => note.hi).join(' ')
    };
  };
  const bReason = reasonFor(brideKuja);
  const gReason = reasonFor(groomKuja);

  const sevvayAnalysis: SevvayDoshamAnalysis = {
    isBrideHasDosham: bEffective,
    isGroomHasDosham: gEffective,
    brideDoshamSeverityTa: bSeverity.ta,
    brideDoshamSeverityEn: bSeverity.en,
    brideDoshamSeverityHi: bSeverity.hi,
    groomDoshamSeverityTa: gSeverity.ta,
    groomDoshamSeverityEn: gSeverity.en,
    groomDoshamSeverityHi: gSeverity.hi,
    brideCancellationReasonTa: bReason?.ta ?? null,
    brideCancellationReasonEn: bReason?.en ?? null,
    brideCancellationReasonHi: bReason?.hi ?? null,
    groomCancellationReasonTa: gReason?.ta ?? null,
    groomCancellationReasonEn: gReason?.en ?? null,
    groomCancellationReasonHi: gReason?.hi ?? null,
    brideMarsHouses: brideKuja.houses,
    groomMarsHouses: groomKuja.houses,
    brideAfflictedFrom: brideKuja.afflictedFrom,
    groomAfflictedFrom: groomKuja.afflictedFrom,
    brideDoshaStatus: brideKuja.status,
    groomDoshaStatus: groomKuja.status,
    doshaSamyamStatusTa: isBalanced
      ? (bEffective && gEffective ? 'தோஷ சாம்யம் உண்டு (இருவருக்கும் செவ்வாய் தோஷம் சமன் அடைகிறது)' : 'சுபப் பொருத்தம் (இருவருக்கும் செவ்வாய் தோஷம் இல்லை)')
      : (bEffective ? 'தோஷ சமனின்மை (பெண்ணிற்கு செவ்வாய் உண்டு, பிள்ளைக்கு இல்லை)' : 'தோஷ சமனின்மை (பிள்ளைக்கு செவ்வாய் உண்டு, பெண்ணிற்கு இல்லை)'),
    doshaSamyamStatusEn: isBalanced
      ? (bEffective && gEffective ? 'Dosha Samyam Balanced (Both partners have Kuja Dosha, neutralizing each other)' : 'Clean Match (Neither partner has Kuja Dosha)')
      : 'Dosha Imbalance (One partner has active Kuja Dosha while the other does not)',
    doshaSamyamStatusHi: isBalanced
      ? (bEffective && gEffective ? 'दोष साम्य संतुलित (दोनों कुंडलियों में मंगल दोष परस्पर संतुलित)' : 'दोष रहित शुभ मिलान (दोनों में मंगल दोष नहीं)')
      : 'दोष असंतुलन (एक पक्ष में मंगल दोष विद्यमान है)',
    recommendationTa: isBalanced
      ? 'செவ்வாய் தோஷக் கண்ணோட்டத்தில் மட்டும் சமநிலை உள்ளது; இது முழுத் திருமணப் பொருத்தத்தின் பரிந்துரை அல்ல.'
      : 'செவ்வாய் தோஷ சமனின்மை உள்ளதால் முறையான பரிசீலனையும் பரிகார ஆலோசனையும் நலம்; இது செவ்வாய் தோஷம் குறித்த வழிகாட்டல் மட்டுமே.',
    recommendationEn: isBalanced
      ? 'Kuja Dosha alignment is balanced from the Kuja perspective alone; this is not an overall marriage recommendation.'
      : 'Kuja Dosha imbalance detected. Expert review and remedial guidance are advised for Kuja Dosha alone.',
    recommendationHi: isBalanced
      ? 'केवल मंगल दोष की दृष्टि से साम्य संतुलित है; यह समग्र विवाह अनुशंसा नहीं है।'
      : 'मंगल दोष में असंतुलन है; विशेषज्ञ समीक्षा और उपाय संबंधी सलाह उचित है। यह केवल मंगल दोष का मार्गदर्शन है।'
  };

  // This Node engine uses ten equal-weight Poruthams on a normalized 10-point
  // scale. The legacy PHP engine keeps traditional weighted marks (max 35), so
  // reports must carry/display their own row-summed denominator rather than
  // relabeling one engine's score as the other's.
  const totalPoints = poruthams.reduce((sum, p) => sum + p.pointsEarned, 0);
  const matchedCount = poruthams.filter(p => p.status === PoruthamStatus.UTTHAMAM || p.status === PoruthamStatus.MADHYAMAM).length;
  const rajjuOk = !isSameRajju;
  const vedhaOk = !isVedhaAfflicted;
  // Rajju and Vedha are the two hard-stop rules used by the PHP report path;
  // keep the live Node verdict from promoting a high numeric score over either.
  //
  // The failed hard stop is stated ONCE, by the overall verdict below. It is
  // deliberately not appended to sevvayDosham.recommendation* any more: the
  // Kuja box printed that sentence on top of the verdict line and the final
  // verdict banner, so a single Rajju failure appeared three times in the same
  // part of the report.
  const criticalPoruthamsOk = rajjuOk && vedhaOk;

  let verdictStatus = PoruthamStatus.PORUNDHADHU;
  if (totalPoints >= 7.0 && criticalPoruthamsOk && isBalanced) {
    verdictStatus = PoruthamStatus.UTTHAMAM;
  } else if (totalPoints >= 5.0 && criticalPoruthamsOk) {
    verdictStatus = PoruthamStatus.MADHYAMAM;
  }

  // Both failed hard stops are named, not just the first one: the classical
  // Vedha obstruction pairs also share a Rajju group, so a single pair can
  // genuinely fail both, and the report must say so.
  const failedCriticalEn = [!rajjuOk && 'Rajju', !vedhaOk && 'Vedha'].filter(Boolean).join(' and ');
  const failedCriticalTa = [!rajjuOk && 'ரஜ்ஜு', !vedhaOk && 'வேதை'].filter(Boolean).join(' மற்றும் ');
  const failedCriticalHi = [!rajjuOk && 'रज्जु', !vedhaOk && 'वेध'].filter(Boolean).join(' और ');

  const verdictTa = verdictStatus === PoruthamStatus.UTTHAMAM
    ? `மிக உத்தமமான பொருத்தம்! 10-ல் ${matchedCount} பொருத்தங்களும், முக்கிய ரஜ்ஜு/வேதைப் பொருத்தமும் மற்றும் செவ்வாய் சாம்யமும் மிகச் சிறப்பாக அமைந்துள்ளன. திருமணம் செய்ய மிகவும் உத்தமம்.`
    : verdictStatus === PoruthamStatus.MADHYAMAM
    ? `மத்திமமான பொருத்தம்! 10-ல் ${matchedCount} பொருத்தங்கள் பொருந்துகின்றன. பரிகாரங்களுடன் ஏற்றுக்கொள்ளத்தக்கது.`
    : !criticalPoruthamsOk
    ? `${failedCriticalTa} பொருத்தமின்மை உள்ளது. விரிவான ஜாதக பரிசீலனை தேவைப்படுகிறது.`
    : `குறைந்த பொருத்தங்கள் (10-ல் ${matchedCount}). திருமணத்திற்கு பரிந்துரைக்கப்படவில்லை.`;

  const verdictEn = verdictStatus === PoruthamStatus.UTTHAMAM
    ? `Highly Auspicious Match! ${matchedCount}/10 Poruthams matched with clear Rajju and Vedha checks and balanced Kuja Dosha. Highly recommended for marriage.`
    : verdictStatus === PoruthamStatus.MADHYAMAM
    ? `Moderate match: ${matchedCount}/10 Poruthams matched; acceptable with remedies.`
    : !criticalPoruthamsOk
    ? `Critical ${failedCriticalEn} mismatch. Requires detailed astrological assessment.`
    : `Low compatibility (${matchedCount}/10 Poruthams). Not recommended without mitigating factors.`;

  const verdictHi = verdictStatus === PoruthamStatus.UTTHAMAM
    ? `अत्यंत शुभ मिलान! 10 में से ${matchedCount} गुण/पोरुथम मिले हैं तथा रज्जु, वेध और मंगल दोष संतुलित हैं। विवाह हेतु सर्वथा उपयुक्त।`
    : verdictStatus === PoruthamStatus.MADHYAMAM
    ? `मध्यम मिलान: 10 में से ${matchedCount} पोरुथम मिले; उपायों के साथ स्वीकार्य।`
    : !criticalPoruthamsOk
    ? `${failedCriticalHi} दोष है। विस्तृत ज्योतिषीय मूल्यांकन आवश्यक है।`
    : `अनुकूलता कम है (${matchedCount}/10)।`;

  const generatedAt = new Date();
  const generatedAtTimeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return {
    brideName: brideChart.devoteeName,
    brideDob: brideChart.dob,
    brideTob: brideChart.tob,
    bridePlace: brideChart.birthPlace,
    brideRasi: brideChart.chandraRasi,
    brideRasiNameTa: brideChart.chandraRasiNameTa,
    brideRasiNameEn: brideChart.chandraRasiNameEn,
    brideRasiNameHi: brideChart.chandraRasiNameHi,
    brideNakshatraNameTa: brideChart.janmaNakshatraTa,
    brideNakshatraNameEn: brideChart.janmaNakshatraEn,
    brideNakshatraNameHi: brideChart.janmaNakshatraHi,
    bridePada: brideChart.janmaPada,
    brideLagnaNameTa: brideChart.lagnaRasiNameTa,
    brideLagnaNameEn: brideChart.lagnaRasiNameEn,
    brideLagnaNameHi: brideChart.lagnaRasiNameHi,
    brideMarsHouse,

    groomName: groomChart.devoteeName,
    groomDob: groomChart.dob,
    groomTob: groomChart.tob,
    groomPlace: groomChart.birthPlace,
    groomRasi: groomChart.chandraRasi,
    groomRasiNameTa: groomChart.chandraRasiNameTa,
    groomRasiNameEn: groomChart.chandraRasiNameEn,
    groomRasiNameHi: groomChart.chandraRasiNameHi,
    groomNakshatraNameTa: groomChart.janmaNakshatraTa,
    groomNakshatraNameEn: groomChart.janmaNakshatraEn,
    groomNakshatraNameHi: groomChart.janmaNakshatraHi,
    groomPada: groomChart.janmaPada,
    groomLagnaNameTa: groomChart.lagnaRasiNameTa,
    groomLagnaNameEn: groomChart.lagnaRasiNameEn,
    groomLagnaNameHi: groomChart.lagnaRasiNameHi,
    groomMarsHouse,

    bride: brideChart,
    groom: groomChart,

    poruthams,
    totalPoruthamsMatched: matchedCount,
    totalScore: Number(totalPoints.toFixed(1)),
    score: Number(totalPoints.toFixed(1)),
    maxScore: 10.0,
    overallVerdictTa: verdictTa,
    overallVerdictEn: verdictEn,
    overallVerdictHi: verdictHi,
    verdictStatus,
    rajjuMatch: rajjuOk,
    vedhaMatch: vedhaOk,
    sevvayDosham: sevvayAnalysis,
    generatedAt: generatedAt.toISOString(),
    generatedAtTimeZoneId
  };
}

export const calculateMarriageMatch = calculateWeddingCompatibility;
