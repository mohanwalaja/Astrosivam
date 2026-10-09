export type DoshaLanguage = 'en' | 'ta' | 'hi';

export interface NavagrahaDoshaInfo {
  /** Indicator name shown on the report. */
  name: Record<DoshaLanguage, string>;
  /** Deity traditionally associated with this graha, offered as a prayer focus. */
  deity: Record<DoshaLanguage, string>;
  /** Weekday traditionally held to belong to this graha. */
  day: Record<DoshaLanguage, string>;
  /** Colour traditionally associated with this graha. */
  colour: Record<DoshaLanguage, string>;
  /**
   * Items traditionally given in charity for this graha. Wording deliberately
   * avoids ritual vocabulary (no mantra, no temple ritual) because the vast
   * majority of Astro Sivam users live outside India, so every suggestion here
   * has to be something a person can act on anywhere in the world.
   */
  charity: Record<DoshaLanguage, string>;
  /** Everyday conduct traditionally recommended for this graha. */
  practice: Record<DoshaLanguage, string>;
  /** Short one-line prayer suggestion kept for compact surfaces and tests. */
  remedies: Record<DoshaLanguage, string>;
  aliases: string[];
}

/** Labels used to compose the full remedy line for a Navagraha indicator. */
const REMEDY_LABELS: Record<DoshaLanguage, {
  pray: string; day: string; colour: string; charity: string; practice: string; end: string;
}> = {
  en: { pray: 'Pray to', day: 'Day', colour: 'Colour', charity: 'Give in charity', practice: 'Conduct', end: '.' },
  ta: { pray: 'வழிபாடு', day: 'நாள்', colour: 'நிறம்', charity: 'கொடை', practice: 'நடத்தை', end: '.' },
  hi: { pray: 'आराधना', day: 'वार', colour: 'रंग', charity: 'सहायता सामग्री', practice: 'आचरण', end: '।' }
};

/**
 * Compose the full remedy line shown on the report for a Navagraha indicator.
 *
 * Deliberately limited to universal actions — a prayer focus, a weekday, a
 * colour, something to give away, and everyday conduct. No ritual recitation
 * and no temple pilgrimage are prescribed, because most Astro Sivam users
 * live outside India.
 */
export function navagrahaRemedyText(info: NavagrahaDoshaInfo, lang: DoshaLanguage): string {
  const label = REMEDY_LABELS[lang] || REMEDY_LABELS.en;
  const sep = lang === 'hi' ? '। ' : '. ';
  return [
    `${label.pray}: ${info.deity[lang]}`,
    `${label.day}: ${info.day[lang]}`,
    `${label.colour}: ${info.colour[lang]}`,
    `${label.charity}: ${info.charity[lang]}`,
    `${label.practice}: ${info.practice[lang]}`
  ]
    .join(sep)
    .replace(/\s+/g, ' ')
    .trim() + label.end;
}

/**
 * Traditional devotional and charitable correspondences for each of the nine
 * Navagrahas, cross-checked against published Vedic references.
 *
 * Scope rules agreed for Astro Sivam reports:
 *   - No mantras or chanting instructions are given.
 *   - No temple pilgrimage is prescribed, because most users live abroad and
 *     cannot visit the Navagraha sthalas in Tamil Nadu.
 *   - Only universal actions are listed: whom to pray to, the weekday, the
 *     colour, items to give in charity, and everyday conduct.
 *
 * Practices differ by lineage, so these are traditional suggestions only —
 * never guaranteed outcomes or prescriptive rituals.
 *
 * Sources:
 * https://panchang.org/navagraha-dosha-remedies-planets-worship-rituals/
 * https://www.asthawaani.com/blog/navgrah-shanti
 * https://panditnmshrimali.com/blog/navagraha-puja-benefits
 * https://povnews.in/nine-colour-food-donations-to-balance-navagraha/
 * https://timesofindia.indiatimes.com/astrology/planets-transits/navagrahas-and-their-deities-vedic-remedies-to-enhance-planetary-influence/articleshow/116066587.cms
 */
export const NAVAGRAHA_DOSHA_DATA: Record<string, NavagrahaDoshaInfo> = {
  sun: {
    name: { en: 'Surya (Sun) Affliction Indicator', ta: 'சூரிய கிரகப் பாதிப்பு குறியீடு', hi: 'सूर्य ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Surya, the Sun God', ta: 'சூரிய பகவான்', hi: 'भगवान सूर्य' },
    day: { en: 'Sunday', ta: 'ஞாயிறு', hi: 'रविवार' },
    colour: { en: 'Red or copper', ta: 'சிவப்பு அல்லது செம்பு நிறம்', hi: 'लाल या ताम्र' },
    charity: { en: 'Wheat, jaggery, red cloth or copper', ta: 'கோதுமை, வெல்லம், சிவப்புத் துணி', hi: 'गेहूँ, गुड़, लाल वस्त्र' },
    practice: { en: 'Offer clean water to the rising sun in the morning, and honour your father and elders', ta: 'காலையில் எழும் சூரியனுக்குத் தூய நீர் வழங்கி வணங்குங்கள்; தந்தையையும் மூத்தோரையும் மதியுங்கள்', hi: 'उगते सूर्य को शुद्ध जल अर्पित करें, और पिता तथा वृद्धों का सम्मान करें' },
    remedies: { en: 'Pray to Lord Surya.', ta: 'சூரிய பகவானைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान सूर्य से प्रार्थना करें।' },
    aliases: ['surya', 'sun']
  },
  moon: {
    name: { en: 'Chandra (Moon) Affliction Indicator', ta: 'சந்திர கிரகப் பாதிப்பு குறியீடு', hi: 'चंद्र ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Shiva', ta: 'சிவபெருமான்', hi: 'भगवान शिव' },
    day: { en: 'Monday', ta: 'திங்கள்', hi: 'सोमवार' },
    colour: { en: 'White or silver', ta: 'வெள்ளை அல்லது வெள்ளி நிறம்', hi: 'सफेद या चाँदी' },
    charity: { en: 'Rice, milk, sugar or white cloth', ta: 'அரிசி, பால், சர்க்கரை, வெள்ளைத் துணி', hi: 'चावल, दूध, चीनी या सफेद वस्त्र' },
    practice: { en: 'Care for your mother and keep a calm, regular daily routine', ta: 'தாயைக் கவனித்துக் கொள்ளுங்கள்; அமைதியான ஒழுங்கான நாள்வழக்கத்தைக் கடைப்பிடியுங்கள்', hi: 'माता की सेवा करें और शांत, नियमित दिनचर्या रखें' },
    remedies: { en: 'Pray to Lord Shiva.', ta: 'சிவபெருமானைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान शिव से प्रार्थना करें।' },
    aliases: ['chandra', 'moon']
  },
  mars: {
    name: { en: 'Mangala (Mars) Affliction Indicator', ta: 'செவ்வாய் கிரகப் பாதிப்பு குறியீடு', hi: 'मंगल ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Murugan (Karthikeya) or Lord Hanuman', ta: 'முருகன் (கார்த்திகேயன்) அல்லது அனுமன்', hi: 'भगवान कार्तिकेय या हनुमान जी' },
    day: { en: 'Tuesday', ta: 'செவ்வாய்', hi: 'मंगलवार' },
    colour: { en: 'Red', ta: 'சிவப்பு', hi: 'लाल' },
    charity: { en: 'Red lentils, jaggery or red cloth', ta: 'சிவப்புப் பயறு, வெல்லம், சிவப்புத் துணி', hi: 'लाल दाल, गुड़ या लाल वस्त्र' },
    practice: { en: 'Control anger and impatience, and keep cordial relations with your brothers and sisters', ta: 'கோபத்தையும் பொறுமையின்மையையும் கட்டுப்படுத்துங்கள்; சகோதரர்களுடன் நல்லுறவைப் பேணுங்கள்', hi: 'क्रोध और अधीरता पर नियंत्रण रखें, और भाइयों-बहनों से सौहार्द रखें' },
    remedies: { en: 'Pray to Karthikeyan (Murugan) or Lord Hanuman.', ta: 'முருகன் (கார்த்திகேயன்) அல்லது அனுமனைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान कार्तिकेय या हनुमान जी से प्रार्थना करें।' },
    aliases: ['mangala', 'mangal', 'mars', 'kuja', 'chevvai']
  },
  mercury: {
    name: { en: 'Budha (Mercury) Affliction Indicator', ta: 'புதன் கிரகப் பாதிப்பு குறியீடு', hi: 'बुध ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Vishnu or Lord Ganesha', ta: 'மகா விஷ்ணு அல்லது விநாயகர்', hi: 'भगवान विष्णु या भगवान गणेश' },
    day: { en: 'Wednesday', ta: 'புதன்', hi: 'बुधवार' },
    colour: { en: 'Green', ta: 'பச்சை', hi: 'हरा' },
    charity: { en: 'Green gram (mung beans), green cloth or books', ta: 'பச்சைப் பயறு, பச்சைத் துணி, நூல்கள்', hi: 'हरी मूँग, हरा वस्त्र या पुस्तकें' },
    practice: { en: 'Speak the truth and avoid deceit or careless speech', ta: 'உண்மையே பேசுங்கள்; வஞ்சகத்தையும் சிந்தியாத பேச்சையும் தவிருங்கள்', hi: 'सत्य बोलें और छल तथा असावधान वाणी से बचें' },
    remedies: { en: 'Pray to Lord Vishnu.', ta: 'மகா விஷ்ணுவைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान विष्णु से प्रार्थना करें।' },
    aliases: ['budha', 'mercury']
  },
  jupiter: {
    name: { en: 'Guru (Jupiter) Affliction Indicator', ta: 'குரு கிரகப் பாதிப்பு குறியீடு', hi: 'गुरु ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Brihaspati or Lord Dakshinamurthy', ta: 'குரு பகவான் அல்லது தட்சிணாமூர்த்தி', hi: 'भगवान बृहस्पति या दक्षिणामूर्ति' },
    day: { en: 'Thursday', ta: 'வியாழன்', hi: 'गुरुवार' },
    colour: { en: 'Yellow', ta: 'மஞ்சள்', hi: 'पीला' },
    charity: { en: 'Chickpeas, turmeric, bananas, yellow cloth or books', ta: 'கொண்டைக்கடலை, மஞ்சள், வாழைப்பழம், மஞ்சள் துணி', hi: 'चना, हल्दी, केले, पीला वस्त्र' },
    practice: { en: 'Honour your teachers and elders, and set ego aside', ta: 'ஆசிரியர்களையும் மூத்தோரையும் மதியுங்கள்; அகந்தையை விடுங்கள்', hi: 'गुरुओं और वृद्धों का सम्मान करें, और अहंकार त्यागें' },
    remedies: { en: 'Pray to Lord Brihaspati or Lord Dakshinamurthy.', ta: 'குரு பகவான் அல்லது தட்சிணாமூர்த்தியைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान बृहस्पति या दक्षिणामूर्ति से प्रार्थना करें।' },
    aliases: ['guru', 'jupiter', 'brihaspati']
  },
  venus: {
    name: { en: 'Shukra (Venus) Affliction Indicator', ta: 'சுக்கிர கிரகப் பாதிப்பு குறியீடு', hi: 'शुक्र ग्रह पीड़ा संकेत' },
    deity: { en: 'Goddess Maha Lakshmi', ta: 'மகா லட்சுமி', hi: 'माँ महालक्ष्मी' },
    day: { en: 'Friday', ta: 'வெள்ளி', hi: 'शुक्रवार' },
    colour: { en: 'White or cream', ta: 'வெள்ளை அல்லது வெண்மை', hi: 'सफेद या क्रीम' },
    charity: { en: 'Rice, yoghurt, white sweets or white cloth', ta: 'அரிசி, தயிர், வெள்ளை இனிப்பு, வெள்ளைத் துணி', hi: 'चावल, दही, सफेद मिठाई या सफेद वस्त्र' },
    practice: { en: 'Treat women with respect and keep your home and surroundings clean', ta: 'பெண்களை மதியுங்கள்; வீட்டையும் சுற்றுப்புறத்தையும் தூய்மையாக வையுங்கள்', hi: 'स्त्रियों का सम्मान करें और घर तथा परिवेश को स्वच्छ रखें' },
    remedies: { en: 'Pray to Goddess Maha Lakshmi.', ta: 'மகா லட்சுமியைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'माँ महालक्ष्मी से प्रार्थना करें।' },
    aliases: ['shukra', 'sukra', 'venus']
  },
  saturn: {
    name: { en: 'Shani (Saturn) Affliction Indicator', ta: 'சனி கிரகப் பாதிப்பு குறியீடு', hi: 'शनि ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Shani or Lord Hanuman', ta: 'சனி பகவான் அல்லது அனுமன்', hi: 'भगवान शनि या हनुमान जी' },
    day: { en: 'Saturday', ta: 'சனி', hi: 'शनिवार' },
    colour: { en: 'Black or dark blue', ta: 'கருப்பு அல்லது அடர் நீலம்', hi: 'काला या गहरा नीला' },
    charity: { en: 'Black sesame seeds, sesame oil (nallennai), iron, black cloth or warm blankets', ta: 'கருப்பு எள்ளு, நல்லெண்ணெய், இரும்பு, போர்வைகள்', hi: 'काले तिल, तिल का तेल, लोहा, कंबल' },
    practice: { en: 'Serve the poor, the elderly and the disabled, and stay patient and disciplined', ta: 'ஏழைகள், முதியோர், மாற்றுத்திறனாளிகளுக்கு உதவுங்கள்; பொறுமையும் ஒழுக்கமும் கடைப்பிடியுங்கள்', hi: 'निर्धनों, वृद्धों और दिव्यांगों की सेवा करें, और धैर्य तथा अनुशासन रखें' },
    remedies: { en: 'Pray to Lord Shani or Lord Hanuman.', ta: 'சனி பகவான் அல்லது அனுமனைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान शनि या हनुमान जी से प्रार्थना करें।' },
    aliases: ['shani', 'sani', 'saturn']
  },
  rahu: {
    name: { en: 'Rahu Affliction Indicator', ta: 'ராகு கிரகப் பாதிப்பு குறியீடு', hi: 'राहु ग्रह पीड़ा संकेत' },
    deity: { en: 'Goddess Durga or Lord Bhairava', ta: 'துர்க்கை அல்லது பைரவர்', hi: 'माँ दुर्गा या भगवान भैरव' },
    day: { en: 'Saturday', ta: 'சனி', hi: 'शनिवार' },
    colour: { en: 'Blue or smoky grey', ta: 'நீலம் அல்லது புகைச் சாம்பல்', hi: 'नीला या धुँआरा स्लेटी' },
    charity: { en: 'Black gram, coconut, sesame seeds or warm blankets', ta: 'கருப்பு உளுந்து, தேங்காய், எள், போர்வைகள்', hi: 'काला उड़द, नारियल, तिल के बीज, कंबल' },
    practice: { en: 'Avoid addictions and deception, and live an honest, open life', ta: 'பழக்க அடிமைத்தனத்தையும் வஞ்சகத்தையும் தவிருங்கள்; நேர்மையான திறந்த வாழ்வை வாழுங்கள்', hi: 'व्यसनों और छल से बचें, और ईमानदार, खुला जीवन जिएँ' },
    remedies: { en: 'Pray to Goddess Durga or Lord Bhairava.', ta: 'துர்க்கை அல்லது பைரவரைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'माँ दुर्गा या भगवान भैरव से प्रार्थना करें।' },
    aliases: ['rahu']
  },
  ketu: {
    name: { en: 'Ketu Affliction Indicator', ta: 'கேது கிரகப் பாதிப்பு குறியீடு', hi: 'केतु ग्रह पीड़ा संकेत' },
    deity: { en: 'Lord Ganesha', ta: 'விநாயகர்', hi: 'भगवान गणेश' },
    day: { en: 'Tuesday or Saturday', ta: 'செவ்வாய் அல்லது சனி', hi: 'मंगलवार या शनिवार' },
    colour: { en: 'Grey or multi-coloured', ta: 'சாம்பல் அல்லது பல்நிறம்', hi: 'स्लेटी या बहुरंगी' },
    charity: { en: 'Sesame seeds, horse gram or warm blankets', ta: 'எள்ளு, கொள்ளு, போர்வைகள்', hi: 'तिल, कुल्थी, कंबल' },
    practice: { en: 'Feed and care for stray dogs, set aside time for quiet reflection, and avoid needless conflict', ta: 'தெரு நாய்களுக்கு உணவளித்துக் கவனியுங்கள்; அமைதியான சிந்தனைக்கு நேரம் ஒதுக்குங்கள்; தேவையற்ற சண்டைகளைத் தவிருங்கள்', hi: 'आवारा कुत्तों को भोजन दें और उनकी देखभाल करें, शांत चिंतन के लिए समय निकालें, और अनावश्यक विवाद से बचें' },
    remedies: { en: 'Pray to Lord Ganesha.', ta: 'விநாயகரைப் பிரார்த்தனை செய்யுங்கள்.', hi: 'भगवान गणेश से प्रार्थना करें।' },
    aliases: ['ketu']
  }
};

/** Canonical Navagraha order used by the reference table on page 3. */
export const NAVAGRAHA_ORDER: string[] = [
  'sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'
];

/** Column headings for the Navagraha reference table on page 3. */
export const NAVAGRAHA_TABLE_HEADINGS: Record<DoshaLanguage, {
  graha: string; deity: string; day: string; colour: string; charity: string; practice: string;
}> = {
  en: { graha: 'Graha', deity: 'Prayer focus', day: 'Day', colour: 'Colour', charity: 'Give in charity', practice: 'Everyday conduct' },
  ta: { graha: 'கிரகம்', deity: 'வழிபாடு', day: 'நாள்', colour: 'நிறம்', charity: 'கொடைப் பொருள்', practice: 'அன்றாட நடத்தை' },
  hi: { graha: 'ग्रह', deity: 'आराधना', day: 'वार', colour: 'रंग', charity: 'सहायता सामग्री', practice: 'दैनिक आचरण' }
};

/**
 * The Navagraha guidance block shown in the lower half of page 3.
 *
 * Source: the ASTRO SIVAM Navagraha handout supplied by the client. The third
 * bullet of "ways to face planetary doshas" originally named a mantra; per the
 * report policy agreed for Astro Sivam (no mantra is ever prescribed, and no
 * temple pilgrimage either, since most users live outside India) it is worded
 * as traditional devotional worship instead.
 */
export const NAVAGRAHA_GUIDANCE: Record<DoshaLanguage, {
  title: string;
  intro: string;
  reasonsTitle: string;
  reasons: Array<{ h: string; p: string }>;
  waysTitle: string;
  ways: Array<{ h: string; p: string }>;
  closing: string;
}> = {
  ta: {
    title: 'நவக்கிரகங்கள்',
    intro: 'நவக்கிரகங்கள் என்பவர்கள் சூரியன், சந்திரன், செவ்வாய், புதன், குரு, சுக்கிரன், சனி, ராகு மற்றும் கேது ஆகிய ஒன்பது கிரகங்கள் ஆவர். இவர்கள் நமக்குக் கஷ்டங்களைத் தருவதில்லை; மாறாக, நாம் செய்த முன்வினைப் பயன்களை (கர்மா) அனுபவிக்க உதவும் நடுநிலையான நீதிபதிகளாக மட்டுமே செயல்படுகிறார்கள்.',
    reasonsTitle: 'கஷ்டங்கள் தருவதன் காரணங்கள்',
    reasons: [
      { h: 'கர்ம வினைப் பயன்', p: 'முற்பிறவிகளிலும் இப்பிறவியிலும் செய்த பாவ, புண்ணிய கணக்குகளின்படியே கிரகங்கள் பலன்களைத் தருகின்றன.' },
      { h: 'தண்டனை அல்ல, திருத்தம்', p: 'தவறுகளை உணர்ந்து திருத்திக் கொள்வதற்காகவே கஷ்டங்கள் வருகின்றன.' },
      { h: 'அகந்தையை அழித்தல்', p: 'பேராசை, தலைக்கனம், அகந்தையை அடக்கி இறைவனிடம் சரணடைய வைக்கும்.' },
      { h: 'ஆத்ம வளர்ச்சி', p: 'இக்கட்டான சூழ்நிலைகள் பொறுமையையும் மனப்பக்குவத்தையும் உண்டாக்குகின்றன.' }
    ],
    waysTitle: 'கிரக தோஷங்களை எதிர்கொள்ளும் வழிகள்',
    ways: [
      { h: 'இறை வழிபாடு', p: 'கிரகத்திற்குரிய அதிதேவதைகளை வழிபடுவது கஷ்டங்களைக் குறைக்கும்.' },
      { h: 'தான தர்மங்கள்', p: 'ஏழைகள், விலங்குகளுக்கு உணவு அளிப்பது கர்ம வினையைக் குறைக்கும்.' },
      { h: 'பாரம்பரிய பக்தி முறைகள்', p: 'மன அமைதிக்கான வழிபாடு கஷ்டங்களை எதிர்கொள்ளும் வலிமையைத் தரும்.' },
      { h: 'நன்னடத்தை', p: 'நேர்மையான வாழ்க்கை கிரகங்களின் தீய தாக்கத்திலிருந்து காக்கும்.' }
    ],
    closing: 'வாழ்க்கையில் வரும் கஷ்டங்கள் அனைத்தும் தற்காலிகமானவையே. அவை நம்மைப் புடம் போட்ட தங்கமாக மாற்றுவதற்கே தவிர, அழிப்பதற்காக அல்ல.'
  },
  en: {
    title: 'The Navagrahas',
    intro: 'The Navagrahas are the nine grahas: Surya (Sun), Chandra (Moon), Mangal (Mars), Budha (Mercury), Guru (Jupiter), Shukra (Venus), Shani (Saturn), Rahu and Ketu. They do not bring us hardship of their own accord; rather, they act only as impartial judges who help us experience the results of our own past actions (karma).',
    reasonsTitle: 'Why the Navagrahas Bring Difficulties',
    reasons: [
      { h: 'Fruits of Karma', p: 'The grahas deliver results exactly according to the account of wrong and meritorious deeds accumulated in past lives and in this life.' },
      { h: 'Correction, Not Punishment', p: 'Hardships come so that we recognise our mistakes and correct ourselves.' },
      { h: 'Dissolving the Ego', p: 'They subdue greed, stubbornness and ego, and lead us to surrender to the Divine.' },
      { h: 'Growth of the Soul', p: 'Difficult circumstances build patience and maturity of mind.' }
    ],
    waysTitle: 'Ways to Face Planetary Doshas',
    ways: [
      { h: 'Worship of God', p: 'Worshipping the presiding deity of the graha reduces hardship.' },
      { h: 'Charity', p: 'Feeding the poor and feeding animals lightens the burden of karma.' },
      { h: 'Traditional Devotion', p: 'Worship that calms the mind gives the strength to face hardship.' },
      { h: 'Good Conduct', p: 'An honest life protects you from the adverse influence of the grahas.' }
    ],
    closing: 'All hardships in life are temporary. They exist to change us into gold tested in fire — not to destroy us.'
  },
  hi: {
    title: 'नवग्रह',
    intro: 'नवग्रह नौ ग्रह हैं — सूर्य, चंद्र, मंगल, बुध, गुरु, शुक्र, शनि, राहु और केतु। वे हमें स्वयं कष्ट नहीं देते; बल्कि वे निष्पक्ष न्यायाधीशों की भाँति केवल इतना करते हैं कि हम अपने पूर्वकर्मों (कर्म) के फलों का अनुभव कर सकें।',
    reasonsTitle: 'नवग्रह कष्ट क्यों देते हैं',
    reasons: [
      { h: 'कर्मफल', p: 'पूर्वजन्मों और इस जन्म में किए गए पाप-पुण्य के हिसाब के अनुसार ही ग्रह फल देते हैं।' },
      { h: 'दंड नहीं, सुधार', p: 'कष्ट इसलिए आते हैं कि हम अपनी गलतियों को पहचानें और सुधार करें।' },
      { h: 'अहंकार का नाश', p: 'लोभ, हठ और अहंकार को वश में करके वे हमें ईश्वर की शरण में ले जाते हैं।' },
      { h: 'आत्मिक विकास', p: 'कठिन परिस्थितियाँ धैर्य और मन की परिपक्वता उत्पन्न करती हैं।' }
    ],
    waysTitle: 'ग्रह दोषों से निपटने के उपाय',
    ways: [
      { h: 'ईश्वर की आराधना', p: 'ग्रह के अधिदेवता की आराधना करने से कष्ट कम होते हैं।' },
      { h: 'सेवा और परोपकार', p: 'निर्धनों को और पशुओं को भोजन देने से कर्म-भार कम होता है।' },
      { h: 'पारंपरिक भक्ति', p: 'मन को शांत करने वाली आराधना कष्ट सहने की शक्ति देती है।' },
      { h: 'सदाचार', p: 'ईमानदार जीवन ग्रहों के प्रतिकूल प्रभाव से रक्षा करता है।' }
    ],
    closing: 'जीवन में आने वाले सभी कष्ट अस्थायी हैं। वे हमें तपाये हुए सोने की भाँति बदलने के लिए आते हैं, नष्ट करने के लिए नहीं।'
  }
};

export const GENERIC_DEVOTIONAL_REMEDY: Record<DoshaLanguage, string> = {
  en: 'Pray to Lord Ganesha.',
  ta: 'விநாயகரைப் பிரார்த்தனை செய்யுங்கள்.',
  hi: 'भगवान गणेश से प्रार्थना करें।'
};

export const NO_DOSHA_REMEDY_NOTE: Record<DoshaLanguage, string> = {
  en: 'No dosha-specific recommendation was triggered by the selected chart rules. For general devotional wellbeing, you may pray to Lord Ganesha.',
  ta: 'இந்த அறிக்கையின் தேர்ந்த விதிகளின்படி குறிப்பிட்ட தோஷப் பரிந்துரை இல்லை. பொதுவான ஆன்மிக நலனுக்காக விநாயகரைப் பிரார்த்திக்கலாம்.',
  hi: 'चुने गए नियमों के अनुसार कोई विशेष दोष-उपाय नहीं बताया गया है। सामान्य आध्यात्मिक कल्याण के लिए भगवान गणेश से प्रार्थना कर सकते हैं।'
};

// ---------------------------------------------------------------------------
// SHORT SUMMARY PAGE (page 3) — additive data only.
//
// The Birth Jathagam page 3 ("Short Summary") explains pages 1 and 2 in plain
// language. It is driven by the SAME Navagraha lookup above:
//   * worship  -> NAVAGRAHA_DOSHA_DATA[key].deity + .day   (never restated)
//   * donation -> NAVAGRAHA_DOSHA_DATA[key].charity        (never restated)
//   * lamp / mantra are new, additive fields (below), because the reference
//     table has no column for them.
// Nothing in NAVAGRAHA_DOSHA_DATA / NAVAGRAHA_GUIDANCE / NAVAGRAHA_ORDER /
// NAVAGRAHA_TABLE_HEADINGS is modified, moved or removed by this block, and the
// new fields never replace an existing remedy line.
// ---------------------------------------------------------------------------

/** graha key in NAVAGRAHA_DOSHA_DATA -> the engine's Graha code. */
export const NAVAGRAHA_GRAHA_CODES: Record<string, string> = {
  sun: 'sun', moon: 'moon', mars: 'mars', mercury: 'mercury', jupiter: 'jupiter',
  venus: 'venus', saturn: 'saturn', rahu: 'rahu', ketu: 'ketu'
};

/** Lamp oil traditionally offered for each graha (new; page 3 only). */
export const SHORT_SUMMARY_LAMP_OIL: Record<string, Record<DoshaLanguage, string>> = {
  // REVIEW (astrologer): the lamp oils below follow the common Tamil practice
  // (nallennai / sesame for the malefic grahas, ghee for Guru and Ketu). Where
  // a lineage uses a different oil, that lineage's reading applies.
  sun: { en: 'Sesame oil lamp', ta: 'நல்லெண்ணெய் விளக்கு', hi: 'तिल के तेल का दीपक' },
  moon: { en: 'Ghee lamp', ta: 'நெய் விளக்கு', hi: 'घी का दीपक' },
  mars: { en: 'Sesame oil lamp', ta: 'நல்லெண்ணெய் விளக்கு', hi: 'तिल के तेल का दीपक' },
  mercury: { en: 'Ghee lamp', ta: 'நெய் விளக்கு', hi: 'घी का दीपक' },
  jupiter: { en: 'Ghee lamp', ta: 'நெய் விளக்கு', hi: 'घी का दीपक' },
  venus: { en: 'Ghee lamp', ta: 'நெய் விளக்கு', hi: 'घी का दीपक' },
  saturn: { en: 'Sesame oil lamp', ta: 'நல்லெண்ணெய் விளக்கு', hi: 'तिल के तेल का दीपक' },
  rahu: { en: 'Sesame oil lamp', ta: 'நல்லெண்ணெய் விளக்கு', hi: 'तिल के तेल का दीपक' },
  ketu: { en: 'Ghee lamp', ta: 'நெய் விளக்கு', hi: 'घी का दीपक' }
};

/**
 * Short mantra for each graha, kept in the script of its own language (the
 * mantra is never transliterated for ta/hi). New; page 3 only.
 *
 * REVIEW (astrologer / native speaker): Mantras to be approved by an astrologer
 * before print. Mars, Rahu and Ketu follow the suggested bases in the change
 * request; the remaining six follow the common Navagraha beeja/namah mantras.
 */
export const SHORT_SUMMARY_MANTRA: Record<string, Record<DoshaLanguage, string>> = {
  sun: { en: 'Om Suryaya Namah', ta: 'ஓம் சூரியாய நம:', hi: 'ॐ सूर्याय नमः' },
  moon: { en: 'Om Chandraya Namah', ta: 'ஓம் சந்திராய நம:', hi: 'ॐ चन्द्राय नमः' },
  mars: { en: 'Om Angarakaya Namah', ta: 'ஓம் அங்காரகாய நம:', hi: 'ॐ अंगारकाय नमः' },
  mercury: { en: 'Om Budhaya Namah', ta: 'ஓம் புதாய நம:', hi: 'ॐ बुधाय नमः' },
  jupiter: { en: 'Om Gurave Namah', ta: 'ஓம் குரவே நம:', hi: 'ॐ गुरवे नमः' },
  venus: { en: 'Om Shukraya Namah', ta: 'ஓம் சுக்கிராய நம:', hi: 'ॐ शुक्राय नमः' },
  saturn: { en: 'Om Shanaye Namah', ta: 'ஓம் சனைச்சராய நம:', hi: 'ॐ शनैश्चराय नमः' },
  rahu: { en: 'Om Rahave Namah', ta: 'ஓம் ராஹவே நம:', hi: 'ॐ राहवे नमः' },
  ketu: { en: 'Om Ketave Namah', ta: 'ஓம் கேதவே நம:', hi: 'ॐ केतवे नमः' }
};

/**
 * Grain / food to donate, drawn from the existing `charity` entry of the
 * reference table and shortened to the single item a devotee can act on. The
 * full reference-table wording always remains the source of truth.
 */
export const SHORT_SUMMARY_DONATION: Record<string, Record<DoshaLanguage, string>> = {
  sun: { en: 'Wheat or jaggery', ta: 'கோதுமை அல்லது வெல்லம்', hi: 'गेहूँ या गुड़' },
  moon: { en: 'Rice or milk', ta: 'அரிசி அல்லது பால்', hi: 'चावल या दूध' },
  mars: { en: 'Toor dal or jaggery', ta: 'துவரம் பருப்பு அல்லது வெல்லம்', hi: 'अरहर दाल या गुड़' },
  mercury: { en: 'Green gram', ta: 'பச்சைப் பயறு', hi: 'हरी मूँग' },
  jupiter: { en: 'Chickpeas or turmeric', ta: 'கொண்டைக்கடலை அல்லது மஞ்சள்', hi: 'चना या हल्दी' },
  venus: { en: 'Rice or white sweets', ta: 'அரிசி அல்லது வெள்ளை இனிப்பு', hi: 'चावल या सफेद मिठाई' },
  saturn: { en: 'Black sesame or iron', ta: 'கருப்பு எள்ளு அல்லது இரும்பு', hi: 'काले तिल या लोहा' },
  rahu: { en: 'Black gram or coconut', ta: 'கருப்பு உளுந்து அல்லது தேங்காய்', hi: 'काला उड़द या नारियल' },
  ketu: { en: 'Horse gram or sesame', ta: 'கொள்ளு அல்லது எள்ளு', hi: 'कुल्थी या तिल' }
};

/**
 * Plain-language meaning of every graha for the Short Summary, in the 3 report
 * languages. `support` is what the graha supports when it is well placed;
 * `difficulties` is the plain-language line shown when the graha is flagged.
 *
 * REVIEW (astrologer / native speaker): all Hindi rows are marked for review by
 * a native speaker before print.
 */
export const JATHAGAM_PLANET_PROFILES: Record<string, {
  support: Record<DoshaLanguage, string>;
  difficulties: Record<DoshaLanguage, string>;
}> = {
  sun: {
    support: { en: 'Respect and recognition, a steady position', ta: 'மரியாதை, அங்கீகாரம், நிலையான நிலை', hi: 'सम्मान, पहचान और स्थिर स्थान' },
    difficulties: { en: 'Work pressure, ego clashes, distance from father or elders', ta: 'வேலை அழுத்தம், தந்தை அல்லது முதியோரிடமிருந்து விலகல்', hi: 'कार्यभार, पिता या बड़ों से दूरी' }
  },
  moon: {
    support: { en: 'Calm mind, family happiness, care for others', ta: 'அமைதியான மனம், குடும்ப மகிழ்ச்சி, பிறரைக் கவனிக்கும் தன்மை', hi: 'शांत मन, पारिवारिक सुख और परवाह करने का भाव' },
    difficulties: { en: 'Worry, mood swings, disturbed sleep', ta: 'கவலை, மன ஏற்ற இறக்கம், தூக்கமின்மை', hi: 'चिंता, मन का उतार-चढ़ाव, नींद की गड़बड़ी' }
  },
  mars: {
    support: { en: 'Courage, hard work, property and siblings', ta: 'தைரியம், கடின உழைப்பு, சொத்து, சகோதர உறவு', hi: 'साहस, परिश्रम, संपत्ति और भाई-बहन' },
    difficulties: { en: 'Anger, hasty decisions, delays in marriage', ta: 'கோபம், அவசர முடிவுகள், திருமணத் தாமதம்', hi: 'क्रोध, जल्दबाज़ी के निर्णय, विवाह में देरी' }
  },
  mercury: {
    support: { en: 'Education, speech, business sense', ta: 'கல்வி, பேச்சுத் திறன், வியாபார நுண்ணறிவு', hi: 'शिक्षा, वाणी और व्यापार की समझ' },
    difficulties: { en: 'Confusion in decisions, speech issues, delay in studies', ta: 'முடிவில் குழப்பம், பேச்சுப் பிரச்சினை, கல்வித் தாமதம்', hi: 'निर्णय में उलझन, वाणी की समस्या, पढ़ाई में विलंब' }
  },
  jupiter: {
    support: { en: 'Wisdom, good guidance, children and growth', ta: 'ஞானம், நல்ல வழிகாட்டல், பிள்ளை பேறு, வளர்ச்சி', hi: 'बुद्धि, अच्छा मार्गदर्शन, संतान और विकास' },
    difficulties: { en: 'Missed guidance, unwanted expenses, delay in good things', ta: 'வழிகாட்டல் தவறுதல், தேவையற்ற செலவு, நல்லவை தாமதம்', hi: 'मार्गदर्शन की कमी, अनावश्यक खर्च, शुभ कार्यों में देरी' }
  },
  venus: {
    support: { en: 'Comfort, good relationships, art and beauty', ta: 'வசதி, நல்ல உறவு, கலை மற்றும் அழகு', hi: 'सुख-सुविधा, अच्छे संबंध, कला और सौंदर्य' },
    difficulties: { en: 'Family misunderstandings, money waste, health of spouse', ta: 'குடும்பத் தவறான புரிதல், பண விரயம், துணைவர் உடல்நலம்', hi: 'पारिवारिक गलतफहमी, धन की बर्बादी, जीवनसाथी का स्वास्थ्य' }
  },
  saturn: {
    support: { en: 'Discipline, long-term success, service to others', ta: 'ஒழுக்கம், நீண்டகால வெற்றி, சேவை உணர்வு', hi: 'अनुशासन, दीर्घकालिक सफलता, सेवा का भाव' },
    difficulties: { en: 'Slow progress, worry about money, misunderstandings', ta: 'மெதுவான முன்னேற்றம், பணக் கவலை, தவறான புரிதல்கள்', hi: 'धीमी प्रगति, धन की चिंता, गलतफहमियाँ' }
  },
  rahu: {
    support: { en: 'Courage to try new things, foreign links', ta: 'புதிய முயற்சிகளுக்குத் தைரியம், வெளிநாட்டுத் தொடர்பு', hi: 'नए प्रयासों का साहस, विदेश से जुड़ाव' },
    difficulties: { en: 'Confusion, greed, unwanted changes', ta: 'குழப்பம், பேராசை, தேவையற்ற மாற்றங்கள்', hi: 'भ्रम, लोभ, अनावश्यक बदलाव' }
  },
  ketu: {
    support: { en: 'Detachment, spiritual growth, deep insight', ta: 'பற்றின்மை, ஆன்மிக வளர்ச்சி, ஆழ்ந்த உணர்வு', hi: 'वैराग्य, आध्यात्मिक विकास, गहरी समझ' },
    difficulties: { en: 'Sudden doubts, loneliness, health of ancestors', ta: 'திடீர் சந்தேகம், தனிமை, முன்னோர் உடல்நலம்', hi: 'अचानक संदेह, अकेलापन, पितरों का स्वास्थ्य' }
  }
};

/**
 * The four labelled remedy lines of the Short Summary table. "Worship" and
 * "Donation" are captions for the existing deity/day and charity entries; "Lamp"
 * and "Mantra" caption the additive lamp-oil and mantra fields above. They are
 * NOT replacements for the reference-table headings.
 */
export const SHORT_SUMMARY_REMEDY_LABELS: Record<DoshaLanguage, {
  worship: string; lamp: string; donation: string; mantra: string;
}> = {
  en: { worship: 'Worship', lamp: 'Lamp', donation: 'Donation', mantra: 'Mantra' },
  ta: { worship: 'வழிபாடு', lamp: 'தீபம்', donation: 'தானம்', mantra: 'மந்திரம்' },
  hi: { worship: 'पूजा', lamp: 'दीपक', donation: 'दान', mantra: 'मंत्र' }
};

/**
 * Every fixed string on the Short Summary page.
 *
 * REVIEW (native speaker): the Hindi block must be reviewed in full before
 * print; the Tamil block was written to match the wording already used in this
 * report.
 */
export const SHORT_SUMMARY_TEXT: Record<DoshaLanguage, {
  subtitle: string;
  detailsTitle: string;
  supportiveTitle: string;
  careTitle: string;
  summaryTitle: string;
  tablePlanet: string;
  tableDifficulties: string;
  tableRemedies: string;
  noCarePlanet: string;
  noSupportPlanet: string;
  assessmentIncomplete: string;
  /** Full sentence used when no graha is counted supportive (grammar-safe). */
  summaryLeadNoSupport: string;
  /** Full sentence used when no graha is flagged (grammar-safe). */
  summaryLeadNoCare: string;
  reassurance: string;
  summaryLead: string;
  summaryRemedy: string;
  summaryFaith: string;
  dailyHabit: string;
  compactModeNote: string;
}> = {
  en: {
    subtitle: 'Birth Chart Summary - Simple Explanation',
    detailsTitle: 'Your Details',
    supportiveTitle: 'Planets Supporting You',
    careTitle: 'Planets Needing Extra Care',
    summaryTitle: 'In Short',
    tablePlanet: 'Planet',
    tableDifficulties: 'Possible difficulties',
    tableRemedies: 'Remedies',
    noCarePlanet: 'No planet is flagged in your chart',
    noSupportPlanet: 'No single planet stands out as specially supportive in this chart',
    assessmentIncomplete: 'Dosha assessment is incomplete (N/A) because required planetary placements are unavailable; no remedy or clean-status conclusion is inferred.',
    reassurance: 'No planet is "bad". This is guidance, not a reason for fear. For decisions about health, money or law, please also consult a qualified professional.',
    summaryLead: 'In your chart, {supportive} support you, while {care} need extra care.',
    summaryLeadNoSupport: 'In your chart, no single planet stands out as specially supportive, while {care} need extra care.',
    summaryLeadNoCare: 'In your chart, {supportive} support you, and no planet needs extra care.',
    summaryRemedy: 'The remedies are simple and can be done at home; chant the mantra 11 times with faith.',
    summaryFaith: '',
    dailyHabit: 'Every day: five minutes of morning prayer, respect elders, and help those in need.',
    compactModeNote: ''
  },
  ta: {
    subtitle: 'ஜாதக சுருக்கம் - எளிய விளக்கம்',
    detailsTitle: 'உங்கள் விவரங்கள்',
    supportiveTitle: 'உங்களுக்கு ஆதரவாக இருக்கும் கிரகங்கள்',
    careTitle: 'கூடுதல் கவனம் தேவையான கிரகங்கள்',
    summaryTitle: 'சுருக்கமாக',
    tablePlanet: 'கிரகம்',
    tableDifficulties: 'சாத்தியமான கஷ்டங்கள்',
    tableRemedies: 'பரிகாரங்கள்',
    noCarePlanet: 'எந்தக் கிரகமும் கவனம் தேவை என்று குறிக்கப்படவில்லை',
    noSupportPlanet: 'இந்த ஜாதகத்தில் சிறப்பாக ஆதரவாக இருக்கும் ஒரு கிரகம் தனியாக இல்லை',
    assessmentIncomplete: 'தேவையான கிரக நிலை கிடைக்காததால் தோஷ மதிப்பீடு முழுமையில்லை (N/A); பரிகாரம் அல்லது இல்லாமை குறித்து முடிவு செய்யப்படவில்லை.',
    reassurance: "எந்த கிரகமும் 'கெட்டது' அல்ல. இது பயப்படுவதற்காக அல்ல, வழிகாட்டுதலுக்காக மட்டுமே. உடல்நலம், பணம், சட்டம் தொடர்பான முடிவுகளுக்கு தகுந்த நிபுணரையும் அணுகுங்கள்.",
    summaryLead: 'உங்கள் ஜாதகத்தில் {supportive} ஆதரவாக உள்ளன; {care} கூடுதல் கவனம் தேவை.',
    summaryLeadNoSupport: 'உங்கள் ஜாதகத்தில் சிறப்பாக ஆதரவாக இருக்கும் கிரகம் தனியாக இல்லை; {care} கூடுதல் கவனம் தேவை.',
    summaryLeadNoCare: 'உங்கள் ஜாதகத்தில் {supportive} ஆதரவாக உள்ளன; எந்தக் கிரகத்திற்கும் கூடுதல் கவனம் தேவையில்லை.',
    summaryRemedy: 'பரிகாரங்கள் எளிமையானவை; மந்திரத்தை 11 முறை நம்பிக்கையுடன் சொல்லுங்கள்.',
    summaryFaith: '',
    dailyHabit: 'தினமும்: காலையில் ஐந்து நிமிட பிரார்த்தனை, மூத்தோரை மதித்தல், தேவைப்படுவோருக்கு உதவுதல்.',
    compactModeNote: 'தினமும் ஒரு விளக்கு ஏற்றி, கிரகத்தின் பெயரைச் சொல்லி வணங்குங்கள்.'
  },
  hi: {
    subtitle: 'जन्म कुंडली सारांश - सरल व्याख्या',
    detailsTitle: 'आपका विवरण',
    supportiveTitle: 'आपके सहायक ग्रह',
    careTitle: 'विशेष ध्यान देने योग्य ग्रह',
    summaryTitle: 'संक्षेप में',
    tablePlanet: 'ग्रह',
    tableDifficulties: 'संभावित कठिनाइयाँ',
    tableRemedies: 'उपाय',
    noCarePlanet: 'आपकी कुंडली में किसी ग्रह पर विशेष ध्यान का संकेत नहीं है',
    noSupportPlanet: 'इस कुंडली में कोई एक ग्रह विशेष रूप से सहायक के रूप में सामने नहीं आता',
    assessmentIncomplete: 'आवश्यक ग्रह स्थिति उपलब्ध न होने से दोष-मूल्यांकन अधूरा है (N/A); उपाय या दोष-रहित होने का निष्कर्ष नहीं निकाला गया।',
    reassurance: 'कोई भी ग्रह "बुरा" नहीं होता। यह डरने के लिए नहीं, मार्गदर्शन के लिए है। स्वास्थ्य, धन या कानून से जुड़े निर्णयों के लिए योग्य विशेषज्ञ से भी परामर्श करें।',
    summaryLead: 'आपकी कुंडली में {supportive} सहायक हैं, {care} को विशेष ध्यान चाहिए।',
    summaryLeadNoSupport: 'आपकी कुंडली में कोई एक ग्रह विशेष रूप से सहायक सामने नहीं आता, जबकि {care} को विशेष ध्यान चाहिए।',
    summaryLeadNoCare: 'आपकी कुंडली में {supportive} सहायक हैं, और किसी ग्रह को विशेष ध्यान की आवश्यकता नहीं है।',
    summaryRemedy: 'उपाय सरल हैं; मंत्र को 11 बार श्रद्धा से जपें।',
    summaryFaith: '',
    dailyHabit: 'प्रतिदिन: सुबह पाँच मिनट प्रार्थना, बड़ों का सम्मान, और ज़रूरतमंदों की सहायता.',
    compactModeNote: 'प्रतिदिन एक दीपक जलाएँ और ग्रह का नाम लेकर प्रार्थना करें।'
  }
};

export const DOSHA_DATA = {
  mars: {
    name: {
      ta: 'செவ்வாய் தோஷம் (Kuja Dosha)',
      en: 'Mars (Kuja) Dosha',
      hi: 'मंगल (कुज) दोष'
    },
    symptoms: {
      ta: 'திருமணத் தாமதம், குடும்ப கருத்து வேறுபாடு, கோபம், அவசர முடிவுகள்.',
      en: 'Delay in marriage, disagreements within the family, anger, hasty decisions.',
      hi: 'विवाह में देरी, पारिवारिक मतभेद, क्रोध, जल्दबाज़ी में लिए गए निर्णय।'
    },
    remedies: {
      ta: [NAVAGRAHA_DOSHA_DATA.mars.remedies.ta],
      en: [NAVAGRAHA_DOSHA_DATA.mars.remedies.en],
      hi: [NAVAGRAHA_DOSHA_DATA.mars.remedies.hi]
    }
  },
  kalasarpa: {
    name: {
      ta: 'காலசர்ப தோஷம்',
      en: 'Kala Sarpa Dosha',
      hi: 'काल सर्प दोष'
    },
    symptoms: {
      ta: 'ராகு-கேது அச்சுக்கு உள்ளே அனைத்து கிரகங்களும் அமையும் நிலை.',
      en: 'All planets fall within the Rahu-Ketu axis.',
      hi: 'सभी ग्रह राहु-केतु अक्ष के भीतर स्थित होते हैं।'
    },
    remedies: {
      ta: ['சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.'],
      en: ['Pray to Lord Shiva.'],
      hi: ['भगवान शिव का नाम लेकर प्रार्थना करें।']
    }
  },
  pitru: {
    name: {
      ta: 'பித்ரு தோஷம்',
      en: 'Pitru Dosha',
      hi: 'पितृ दोष'
    },
    symptoms: {
      ta: 'முன்னோர் தொடர்பான கவலைகள் அல்லது தடைகள்.',
      en: 'Concerns or obstacles linked to ancestral matters.',
      hi: 'पितरों से संबंधित चिंताएं या बाधाएं।'
    },
    remedies: {
      ta: ['மகா விஷ்ணு பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.'],
      en: ['Pray to Maha Vishnu.'],
      hi: ['महाविष्णु का नाम लेकर प्रार्थना करें।']
    }
  },
  guruchandala: {
    name: {
      ta: 'குரு சண்டாள தோஷம் (Guru Chandala Dosha)',
      en: 'Guru Chandala Dosha',
      hi: 'गुरु चांडाल दोष'
    },
    symptoms: {
      ta: 'குரு பகவானும் ராகு அல்லது கேதுவும் ஒரே ராசியில் இணைவு அல்லது பார்த்துக் கொள்ளுதல்.',
      en: 'Conjunction or aspect of benefic Jupiter with shadow planet Rahu or Ketu.',
      hi: 'देवगुरु बृहस्पति की राहु या केतु के साथ युति अथवा दृष्टि संबंध।'
    },
    remedies: {
      ta: ['தட்சிணாமூர்த்தி அல்லது சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.'],
      en: ['Pray to Lord Dakshinamurthy or Lord Shiva.'],
      hi: ['भगवान दक्षिणामूर्ति या भगवान शिव का नाम लेकर प्रार्थना करें।']
    }
  }
};

// General prayer suggestions remain available to other screens, but the
// birth-report page now shows only chart-specific recommendations.
export const PRAYER_GUIDANCE = {
  en: [
    'Pray to Ganesha, Shiva or Parvati.',
    'Pray to Karthikeyan (Murugan).',
    'Pray to Maha Vishnu, Maha Lakshmi or Saraswati.'
  ],
  ta: [
    'விநாயகர், சிவன் அல்லது பார்வதியைப் பிரார்த்தனை செய்யுங்கள்.',
    'முருகனைப் பிரார்த்தனை செய்யுங்கள்.',
    'மகா விஷ்ணு, மகா லட்சுமி அல்லது சரஸ்வதியைப் பிரார்த்தனை செய்யுங்கள்.'
  ],
  hi: [
    'गणेश, शिव या पार्वती से प्रार्थना करें।',
    'कार्तिकेय से प्रार्थना करें।',
    'महाविष्णु, महालक्ष्मी या सरस्वती से प्रार्थना करें।'
  ]
};
