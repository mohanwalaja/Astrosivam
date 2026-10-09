/**
 * ASTRO SIVAM - Indic Script Transliteration Utility
 * Provides phonetic transliteration of Indian personal names to Tamil and Devanagari (Hindi)
 */

const TAMIL_NAME_OVERRIDES: Record<string, string> = {
  dushyant: 'துஷ்யந்த்',
  revathi: 'ரேவதி',
  renuka: 'ரேணுகா',
  renugadevi: 'ரேணுகாதேவி',
  rethika: 'ரேதிகா',
  rekha: 'ரேகா',
  reva: 'ரேவா',
  rohini: 'ரோஹிணி',
  roshini: 'ரோஷினி',
  roshni: 'ரோஷ்னி',
  rohita: 'ரோஹிதா',
  tapan: 'தபன்',
  rochak: 'ரோசக்',
  reet: 'ரீத்',
  roshika: 'ரோஷிகா',
  ronika: 'ரோனிகா',
  romil: 'ரோமில்',
  ronit: 'ரோனித்',
  ronak: 'ரோனக்',
  rajesh: 'ராஜேஷ்',
  rakesh: 'ரகேஷ்',
  ramesh: 'ரமேஷ்',
  rupesh: 'ரூபேஷ்',
  // Common Tamil / Sanskrit Vedic names
  rudhran: 'ருத்ரன்',
  rudra: 'ருத்ரா',
  rudramoorthy: 'ருத்ரமூர்த்தி',
  rupan: 'ரூபன்',
  rukesh: 'ருகேஷ்',
  raman: 'ராமன்',
  rama: 'ராமர்',
  ram: 'ராம்',
  ravichandran: 'ரவிச்சந்திரன்',
  ramachandran: 'ராமச்சந்திரன்',
  rithik: 'ரித்திக்',
  rethinavel: 'ரத்தினவேல்',
  rethik: 'ரேத்திக்',
  renjith: 'ரேஞ்சித்',
  revanth: 'ரேவந்த்',
  rajan: 'ராஜன்',
  ramakrishnan: 'ராமகிருஷ்ணன்',
  rajarajan: 'ராஜராஜன்',
  rithish: 'ரித்தீஷ்',
  rohan: 'ரோஹன்',
  rohit: 'ரோஹித்',
  rohith: 'ரோஹித்',
  roshan: 'ரோஷன்',
  rohinthan: 'ரோஹிந்தன்',
  raghav: 'ராகவ்',
  raghavan: 'ராகவன்',
  rajendran: 'ராஜேந்திரன்',
  raam: 'ராம்',
  rishikesan: 'ரிஷிகேசன்',
  rishikesh: 'ரிஷிகேஷ்',
  rishi: 'ரிஷி',
  reyansh: 'ரேயான்ஷ்',
  revansh: 'ரேவான்ஷ்',
  rahul: 'ராகுல்',
  ravi: 'ரவி',
  ritvik: 'ரித்விக்',
  ridhaan: 'ரிதான்',
  ritul: 'ரிதுல்',
  ranveer: 'ரன்வீர்',
  rishabh: 'ரிஷப்',
  tharun: 'தருண்',
  tarun: 'தருண்',
  thangaraj: 'தங்கராஜ்',
  thangavel: 'தங்கவேல்',
  thamizharasan: 'தமிழரசன்',
  dhanasekaran: 'தனசேகரன்',
  dharanidharan: 'தரணிதரன்',
  thavamani: 'தவமணி',
  thamodaran: 'தாமோதரன்',
  thayumanavan: 'தாயுமானவன்',
  dhanush: 'தனுஷ்',
  dheeraj: 'தீரஜ்',
  dhiraj: 'திராஜ்',
  danish: 'டேனிஷ்',
  dheeman: 'தீமன்',
  dhir: 'தீர்',
  theerth: 'தீர்த்',
  aarav: 'ஆரவ்',
  aditya: 'ஆதித்யா',
  ananya: 'அனன்யா',
  anushka: 'அனுஷ்கா',
  akshay: 'அக்ஷய்',
  arjun: 'அர்ஜுன்',
  abhay: 'அபய்',
  arnav: 'அர்ணவ்',
  anirudh: 'அனிருத்',
  aryan: 'ஆர்யன்',
  advait: 'அத்வைத்',
  akhil: 'அகில்',
  ansh: 'அன்ஷ்',
  amit: 'அமித்',
  aanya: 'ஆனியா',
  aaradhya: 'ஆராத்யா',
  aditi: 'அதிதி',
  akshara: 'அக்ஷரா',
  anika: 'அனிகா',
  aadya: 'ஆத்யா',
  avni: 'அவனி',
  amrita: 'அமிர்தா',
  aisha: 'ஆயிஷா',
  arul: 'அருள்',
  anbu: 'அன்பு',
  azhagan: 'அழகன்',
  aadhavan: 'ஆதவன்',
  amudhan: 'அமுதரன்',
  amudha: 'அமுதா',
  arivazhagan: 'அறிவழகன்',
  anbarasan: 'அன்பரசன்',
  arulmozhi: 'அருள்மொழி',
  anjali: 'அஞ்சலி',
  aarthi: 'ஆர்த்தி',
  abinaya: 'அபிநயா',
  anitha: 'அனிதா',
  aruna: 'அருணா',
  aadhira: 'ஆதிரா',
  anbarasi: 'அன்பரசி',
  agalya: 'அகல்யா',
  anusiya: 'அனுசியா',
  ilango: 'இளங்கோ',
  ilamaran: 'இளமாறன்',
  ilavarasan: 'இளவரசன்',
  iniyan: 'இனியன்',
  ilakkiyan: 'இலக்கியன்',
  isaiarasu: 'இசையரசு',
  ilayarasan: 'இளையரசன்',
  iniya: 'இனியா',
  ilakkiya: 'இலக்கியா',
  ilamathi: 'இளமதி',
  inbavalli: 'இன்பவள்ளி',
  isaiyarasi: 'இசையரசி',
  udhay: 'உதய்',
  udhayan: 'உதயன்',
  uthaman: 'உத்தமன்',
  ulaganathan: 'உலகநாதன்',
  udhayakumar: 'உதயகுமார்',
  umamaheswari: 'உமாமகேஸ்வரி',
  uma: 'உமா',
  usha: 'உஷா',
  ezhilarasan: 'எழிலரசன்',
  elango: 'இளங்கோ',
  ezhilan: 'எழிலன்',
  eesan: 'ஈசன்',
  ezhil: 'எழில்',
  ezhilarasi: 'எழிலரசி',
  eeswari: 'ஈஸ்வரி',
  elavarasi: 'இளவரசி',
  oviyan: 'ஓவியன்',
  oviya: 'ஓவியா',
  vasanthan: 'வசந்தன்',
  valavan: 'வளவன்',
  vaanavan: 'வானவன்',
  varadhan: 'வரதன்',
  vaithianathan: 'வைத்தியநாதன்',
  vasanthakumar: 'வசந்தகுமார்',
  vallavan: 'வல்லவன்',
  vasudevan: 'வாசுதேவன்',
  varadharajan: 'வரதராஜன்',
  vallinayagam: 'வள்ளிநாயகம்',
  vaishnavi: 'வைஷ்ணவி',
  vasanthi: 'வசந்தி',
  valli: 'வள்ளி',
  vasundhari: 'வசுந்தரி',
  vaanathi: 'வானதி',
  vaijayanthi: 'வைஜெயந்தி',
  valarmathi: 'வளர்மதி',
  veeramani: 'வீரமணி',
  veeran: 'வீரன்',
  vignesh: 'விக்னேஷ்',
  vigneshwaran: 'விக்னேஸ்வரன்',
  vijayan: 'விஜயன்',
  veerapandian: 'வீரபாண்டியன்',
  vidhya: 'வித்யா',
  viswanathan: 'விஸ்வநாதன்',
  vijayakumar: 'விஜயகுமார்',
  vijay: 'விஜய்',
  vikram: 'விக்ரம்',
  vihaan: 'விஹான்',
  vivaan: 'விவான்',
  vinay: 'வினய்',
  vishnu: 'விஷ்ணு',
  senthil: 'செந்தில்',
  selvan: 'செல்வன்',
  selvam: 'செல்வம்',
  sekaran: 'சேகரன்',
  sethupathi: 'சேதுபதி',
  senthilvelan: 'செந்தில்வேலன்',
  selvakumar: 'செல்வகுமார்',
  sekar: 'சேகர்',
  senthamilan: 'செந்தமிழன்',
  sedhuraman: 'சேதுராமன்',
  seetha: 'சீதா',
  selvi: 'செல்வி',
  selvarani: 'செல்வராணி',
  seethalakshmi: 'சீதாலட்சுமி',
  senthamarai: 'செந்தாமரை',
  selvarasi: 'செல்வரசி',
  somasundaram: 'சோமசுந்தரம்',
  chozhan: 'சோழன்',
  somanathan: 'சோமநாதன்',
  chokkalingam: 'சொக்கலிங்கம்',
  somasundar: 'சோமசுந்தர்',
  solaippan: 'சோலைப்பன்',
  chozharasan: 'சோழரசன்',
  sobana: 'சோபனா',
  sornambika: 'சொர்ணாம்பிகா',
  sundaram: 'சுந்தரம்',
  subramanian: 'சுப்பிரமணியன்',
  suriyan: 'சூரியன்',
  suresh: 'சுரேஷ்',
  sureshkumar: 'சுரேஷ்குமார்',
  sudharshan: 'சுதர்ஷன்',
  sutharsan: 'சுதர்சன்',
  suganthan: 'சுகந்தன்',
  suganya: 'சுகன்யா',
  sudha: 'சுதா',
  sumathi: 'சுமதி',
  sundari: 'சுந்தரி',
  sujatha: 'சுஜாதா',
  sukirtha: 'சுகிர்தா',
  supriya: 'சுப்ரியா',
  sunitha: 'சுனிதா',
  suvetha: 'சுவேதா',
  subiksha: 'சுபிக்ஷா',
  lavanyan: 'லாவண்யன்',
  lakshmanan: 'லக்ஷ்மணன்',
  lalithan: 'லலிதன்',
  lakshminarayanan: 'லக்ஷ்மிநாராயணன்',
  lakshan: 'லக்ஷன்',
  lavanya: 'லாவண்யா',
  lakshmi: 'லட்சுமி',
  laxmi: 'லட்சுமி',
  lalitha: 'லலிதா',
  lakshana: 'லக்ஷணா',
  lakshmipriya: 'லக்ஷ்மிப்ரியா',
  lalithambal: 'லலிதாம்பாள்',
  karthik: 'கார்த்திக்',
  karthika: 'கார்த்திகா',
  karthikeyan: 'கார்த்திகேயன்',
  kavitha: 'கவிதா',
  kamal: 'கமல்',
  kamalan: 'கமலன்',
  kavin: 'கவின்',
  kaviyarasan: 'கவியரசன்',
  kannan: 'கண்ணன்',
  krishnan: 'கிருஷ்ணன்',
  krishna: 'கிருஷ்ணா',
  ganesh: 'கணேஷ்',
  ganesha: 'கணேஷா',
  shiva: 'சிவா',
  siva: 'சிவா',
  murugan: 'முருகன்',
  thirumavalavan: 'திருமாவளவன்'
};

const HINDI_NAME_OVERRIDES: Record<string, string> = {
  rudhran: 'रुद्रन',
  rudra: 'रुद्र',
  rudramoorthy: 'रुद्रमूर्ति',
  rupan: 'रूपन',
  rukesh: 'रुकेश',
  raman: 'रामन',
  rama: 'राम',
  ram: 'राम',
  ravichandran: 'रविचंद्रन',
  ramachandran: 'रामचंद्रन',
  rithik: 'ऋतिक',
  rethinavel: 'रत्नवेल',
  rethik: 'रेतिक',
  renjith: 'रंजीत',
  revanth: 'रेवंत',
  rajan: 'राजन',
  ramakrishnan: 'रामकृष्णन',
  rajarajan: 'राजराजन',
  rithish: 'रितीश',
  rohan: 'रोहन',
  rohit: 'रोहित',
  rohith: 'रोहित',
  roshan: 'रोशन',
  rohinthan: 'रोहिंतन',
  raghav: 'राघव',
  raghavan: 'राघवन',
  rajendran: 'राजेंद्रन',
  raam: 'राम',
  rishikesan: 'ऋषिकेश',
  rishikesh: 'ऋषिकेश',
  rishi: 'ऋषि',
  reyansh: 'रेयांश',
  revansh: 'रेवांश',
  rahul: 'राहुल',
  ravi: 'रवि',
  ritvik: 'ऋत्विक',
  ridhaan: 'रिधान',
  ritul: 'रितुल',
  ranveer: 'रणवीर',
  rishabh: 'ऋषभ',
  tharun: 'तरुण',
  tarun: 'तरुण',
  thangaraj: 'तंगराज',
  thangavel: 'तंगवेल',
  thamizharasan: 'तमिळरसन',
  dhanasekaran: 'धनशेखरन',
  dharanidharan: 'धरणीधरन',
  thavamani: 'तवमणि',
  thamodaran: 'दामोदरन',
  thayumanavan: 'तायुमानवन',
  dhanush: 'धनुष',
  dheeraj: 'धीरज',
  dhiraj: 'धीरज',
  danish: 'दानिश',
  dheeman: 'धीमान',
  dhir: 'धीर',
  theerth: 'तीर्थ',
  aarav: 'आरव',
  aditya: 'आदित्य',
  ananya: 'अनन्या',
  anushka: 'अनुष्का',
  akshay: 'अक्षय',
  arjun: 'अर्जुन',
  abhay: 'अभय',
  arnav: 'अर्णव',
  anirudh: 'अनिरुद्ध',
  aryan: 'आर्यन',
  advait: 'अद्वैत',
  akhil: 'अखिल',
  ansh: 'अंश',
  amit: 'अमित',
  aanya: 'आन्या',
  aaradhya: 'आराध्या',
  aditi: 'अदिति',
  akshara: 'अक्षरा',
  anika: 'अनिका',
  aadya: 'आद्या',
  avni: 'अवनी',
  amrita: 'अमृता',
  aisha: 'आयशा',
  karthik: 'कार्तिक',
  karthika: 'कार्तिका',
  karthikeyan: 'कार्तिकेयन',
  lakshmi: 'लक्ष्मी',
  laxmi: 'लक्ष्मी',
  vishnu: 'विष्णु',
  ganesh: 'गणेश',
  shiva: 'शिव',
  suresh: 'सुरेश',
  senthil: 'सेंथिल',
  selvan: 'सेल्वन',
  vijay: 'विजय',
  vikram: 'विक्रम',
  vihaan: 'विहान',
  vivaan: 'विवान',
  lavanya: 'लावण्या'
};

// Transliterate Romanized Indian name to Tamil script
export function transliterateToTamil(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  if (!lower) return trimmed;

  if (TAMIL_NAME_OVERRIDES[lower]) {
    return TAMIL_NAME_OVERRIDES[lower];
  }

  let s = lower;

  // Common Tamil compound endings
  const SUFFIX_REPLACEMENTS_TA: Array<[RegExp, string]> = [
    [/moorthy$/i, 'மூர்த்தி'],
    [/murthy$/i, 'மூர்த்தி'],
    [/murthi$/i, 'மூர்த்தி'],
    [/nathan$/i, 'நாதன்'],
    [/rajan$/i, 'ராஜன்'],
    [/kumar$/i, 'குமார்'],
    [/kumaran$/i, 'குமரன்'],
    [/swamy$/i, 'சாமி'],
    [/sami$/i, 'சாமி'],
    [/priya$/i, 'பிரியா'],
    [/lakshmi$/i, 'லட்சுமி'],
    [/laxmi$/i, 'லட்சுமி'],
    [/vathi$/i, 'வதி'],
    [/wathi$/i, 'வதி'],
    [/rani$/i, 'ராணி'],
    [/devi$/i, 'தேவி'],
    [/shree$/i, 'ஸ்ரீ'],
    [/sri$/i, 'ஸ்ரீ'],
    [/velan$/i, 'வேலன்'],
    [/vel$/i, 'வேல்'],
    [/ammal$/i, 'அம்மாள்'],
    [/dharan$/i, 'தரன்'],
    [/sekaran$/i, 'சேகரன்'],
    [/arasan$/i, 'அரசன்'],
    [/arasu$/i, 'அரசு'],
    [/mani$/i, 'மணி'],
    [/valli$/i, 'வள்ளி'],
    [/mathi$/i, 'மதி'],
    [/selvi$/i, 'செல்வி'],
    [/selvan$/i, 'செல்வன்'],
    [/chandran$/i, 'சந்திரன்'],
    [/krishnan$/i, 'கிருஷ்ணன்'],
    [/raman$/i, 'ராமன்'],
    [/lingam$/i, 'லிங்கம்'],
    [/pathi$/i, 'பதி']
  ];

  for (const [pattern, replacement] of SUFFIX_REPLACEMENTS_TA) {
    if (pattern.test(s)) {
      const prefix = s.replace(pattern, '');
      if (prefix) {
        return transliterateToTamil(prefix) + replacement;
      }
    }
  }
  
  // Multi-character consonant tokens sorted by length
  const CONSONANTS: Array<[string, string]> = [
    ['karth', 'கார்த்த்'], ['krish', 'கிருஷ்'], ['shree', 'ஸ்ரீ'], ['sri', 'ஸ்ரீ'],
    ['sh', 'ஷ'], ['ch', 'ச'], ['th', 'த'], ['dh', 'த'], ['zh', 'ழ'],
    ['ng', 'ங்'], ['ny', 'ஞ்'], ['nj', 'ஞ்'], ['nd', 'ண்ட'], ['nt', 'ந்த'],
    ['mp', 'ம்ப'], ['mb', 'ம்ப'], ['kk', 'க்க'], ['tt', 'ட்ட'], ['pp', 'ப்ப'],
    ['ss', 'ஸ்ஸ'], ['ll', 'ல்ல'], ['nn', 'ன்ன'], ['mm', 'ம்ம'], ['rr', 'ற்ற'],
    ['k', 'க'], ['g', 'க'], ['c', 'ச'], ['s', 'ச'], ['j', 'ஜ'],
    ['t', 'ட'], ['d', 'ட'], ['n', 'ந'], ['p', 'ப'], ['b', 'ப'],
    ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['l', 'ல'], ['v', 'வ'],
    ['w', 'வ'], ['h', 'ஹ'], ['z', 'ஜ'], ['x', 'க்ஷ']
  ];

  const VOWEL_INITIAL: Record<string, string> = {
    aa: 'ஆ', a: 'அ', ee: 'ஈ', ii: 'ஈ', i: 'இ',
    oo: 'ஊ', uu: 'ஊ', u: 'உ', ai: 'ஐ', ay: 'ஐ',
    ae: 'ஏ', ea: 'ஏ', e: 'எ', oa: 'ஓ', oh: 'ஓ', o: 'ஒ',
    au: 'ஔ', ou: 'ஔ', ow: 'ஔ'
  };

  const VOWEL_SIGNS: Record<string, string> = {
    aa: 'ா', a: '', ee: 'ீ', ii: 'ீ', i: 'ி',
    oo: 'ூ', uu: 'ூ', u: 'ு', ai: 'ை', ay: 'ை',
    ae: 'ே', ea: 'ே', e: 'ெ', oa: 'ோ', oh: 'ோ', o: 'ொ',
    au: 'ௌ', ou: 'ௌ', ow: 'ௌ'
  };

  let out = '';
  let i = 0;
  const len = s.length;

  // Handle initial vowel if any
  let matchedInitVowel = false;
  for (const v of ['aa', 'ai', 'ay', 'au', 'ou', 'ow', 'ee', 'ii', 'oo', 'uu', 'ae', 'ea', 'oa', 'oh', 'a', 'i', 'u', 'e', 'o']) {
    if (s.startsWith(v)) {
      out += VOWEL_INITIAL[v] || '';
      i += v.length;
      matchedInitVowel = true;
      break;
    }
  }

  while (i < len) {
    // Find next consonant
    let cFound = '';
    let cTamil = '';
    for (const [token, tam] of CONSONANTS) {
      if (s.startsWith(token, i)) {
        cFound = token;
        cTamil = tam;
        break;
      }
    }

    if (cFound) {
      i += cFound.length;
      // Check following vowel
      let vFound = '';
      let vSign = '';
      for (const v of ['aa', 'ai', 'ay', 'au', 'ou', 'ow', 'ee', 'ii', 'oo', 'uu', 'ae', 'ea', 'oa', 'oh', 'a', 'i', 'u', 'e', 'o']) {
        if (s.startsWith(v, i)) {
          vFound = v;
          vSign = VOWEL_SIGNS[v];
          break;
        }
      }

      // If at the end of word and consonant is n, m, r, l, etc., add virama (்)
      if (cFound === 'n' && i >= len) {
        out += 'ன்';
      } else if (cFound === 'm' && i >= len) {
        out += 'ம்';
      } else if (cFound === 'r' && i >= len) {
        out += 'ர்';
      } else if (cFound === 'l' && i >= len) {
        out += 'ல்';
      } else if (cFound === 's' && i >= len) {
        out += 'ஸ்';
      } else if (cFound === 'sh' && i >= len) {
        out += 'ஷ்';
      } else if (cFound === 'th' && i >= len) {
        out += 'த்';
      } else if (cFound === 'k' && i >= len) {
        out += 'க்';
      } else if (!vFound) {
        // Half consonant / terminal consonant with virama
        if (cTamil.endsWith('்')) {
          out += cTamil;
        } else {
          out += cTamil + '்';
        }
      } else {
        // Consonant + Vowel sign
        i += vFound.length;
        if (cTamil.endsWith('்')) {
          // e.g. 'கார்த்த்' + vowel
          out += cTamil.slice(0, -1) + vSign;
        } else {
          out += cTamil + vSign;
        }
      }
    } else {
      // Independent vowel mid-word or unknown char
      const ch = s[i];
      if (VOWEL_INITIAL[ch]) {
        out += VOWEL_INITIAL[ch];
      } else {
        out += ch;
      }
      i++;
    }
  }

  return out || trimmed;
}

// Transliterate Romanized Indian name to Devanagari script (Hindi)
export function transliterateToHindi(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  if (!lower) return trimmed;

  if (HINDI_NAME_OVERRIDES[lower]) {
    return HINDI_NAME_OVERRIDES[lower];
  }

  // General rule-based phonetic engine for Hindi (Devanagari)
  let s = lower;

  const CONSONANTS_HI: Array<[string, string]> = [
    ['karth', 'कार्थ'], ['krish', 'कृष'], ['shree', 'श्री'], ['sri', 'श्री'],
    ['ksh', 'क्ष'], ['gy', 'ज्ञ'], ['tr', 'त्र'], ['chh', 'छ'], ['ch', 'च'],
    ['shh', 'ष'], ['sh', 'श'], ['th', 'थ'], ['dh', 'ध'], ['kh', 'ख'],
    ['gh', 'घ'], ['jh', 'झ'], ['bh', 'भ'], ['ph', 'फ'], ['ng', 'ं'],
    ['k', 'क'], ['g', 'ग'], ['c', 'च'], ['s', 'स'], ['j', 'ज'],
    ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['b', 'ब'],
    ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'],
    ['w', 'व'], ['h', 'ह'], ['z', 'ज़'], ['f', 'फ़']
  ];

  const VOWEL_INITIAL_HI: Record<string, string> = {
    aa: 'आ', a: 'अ', ee: 'ई', ii: 'ई', i: 'इ',
    oo: 'ऊ', uu: 'ऊ', u: 'उ', ai: 'ऐ', ay: 'ऐ',
    ae: 'ए', ea: 'ए', e: 'ए', oa: 'ओ', oh: 'ओ', o: 'ओ',
    au: 'औ', ou: 'औ', ow: 'औ', ri: 'ऋ'
  };

  const VOWEL_SIGNS_HI: Record<string, string> = {
    aa: 'ा', a: '', ee: 'ी', ii: 'ी', i: 'ि',
    oo: 'ू', uu: 'ू', u: 'ु', ai: 'ै', ay: 'ै',
    ae: 'े', ea: 'े', e: 'े', oa: 'ो', oh: 'ो', o: 'ो',
    au: 'ौ', ou: 'ौ', ow: 'ौ', ri: 'ृ'
  };

  let out = '';
  let i = 0;
  const len = s.length;

  for (const v of ['aa', 'ai', 'ay', 'au', 'ou', 'ow', 'ee', 'ii', 'oo', 'uu', 'ae', 'ea', 'oa', 'oh', 'ri', 'a', 'i', 'u', 'e', 'o']) {
    if (s.startsWith(v)) {
      out += VOWEL_INITIAL_HI[v] || '';
      i += v.length;
      break;
    }
  }

  while (i < len) {
    let cFound = '';
    let cHi = '';
    for (const [token, dev] of CONSONANTS_HI) {
      if (s.startsWith(token, i)) {
        cFound = token;
        cHi = dev;
        break;
      }
    }

    if (cFound) {
      i += cFound.length;
      let vFound = '';
      let vSign = '';
      for (const v of ['aa', 'ai', 'ay', 'au', 'ou', 'ow', 'ee', 'ii', 'oo', 'uu', 'ae', 'ea', 'oa', 'oh', 'ri', 'a', 'i', 'u', 'e', 'o']) {
        if (s.startsWith(v, i)) {
          vFound = v;
          vSign = VOWEL_SIGNS_HI[v];
          break;
        }
      }

      if (!vFound) {
        if (i >= len) {
          // Terminal Hindi consonant (halant omitted in standard Hindi names e.g. राम, रोहन)
          out += cHi;
        } else {
          out += cHi + '्';
        }
      } else {
        i += vFound.length;
        out += cHi + vSign;
      }
    } else {
      const ch = s[i];
      if (VOWEL_INITIAL_HI[ch]) {
        out += VOWEL_INITIAL_HI[ch];
      } else {
        out += ch;
      }
      i++;
    }
  }

  return out || trimmed;
}

/**
 * Returns formatted localized name display according to the report language
 */
export function formatBabyNameForReport(name: string, lang: string): {
  primary: string;
  secondary: string;
  isLocalized: boolean;
} {
  const normLang = String(lang || 'en').toLowerCase().trim();
  if (normLang === 'ta') {
    const taName = transliterateToTamil(name);
    return {
      primary: taName,
      secondary: '',
      isLocalized: true
    };
  } else if (normLang === 'hi') {
    const hiName = transliterateToHindi(name);
    return {
      primary: hiName,
      secondary: '',
      isLocalized: true
    };
  }
  return {
    primary: name,
    secondary: '',
    isLocalized: false
  };
}
