import rajjuTable from '../../api/astrology/rajju.json' with { type: 'json' };
import {
  Rasi,
  NakshatraBabyLetters,
  BabyNamingResult,
  BabyNameSuggestion
} from './types.js';
import {
  calculatePrecisionHoroscope,
  RASI_INFO
} from './astronomy.js';
import { buildNamakaranPadaNames, buildNamakaranNameProvenance, type NamakaranNameProvenance } from './namakaranNames.js';

export const ALL_NAKSHATRA_LETTERS: NakshatraBabyLetters[] = [
  {
    nakshatraIndex: 1,
    nakshatraNameTa: 'அஸ்வினி',
    nakshatraNameEn: 'Ashwini',
    nakshatraNameHi: 'अश्विनी',
    deityTa: 'அஸ்வினி குமாரர்கள்',
    deityEn: 'Ashwini Kumaras',
    deityHi: 'अश्विनी कुमार',
    lordTa: 'கேது',
    lordEn: 'Ketu',
    lordHi: 'केतु',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'குதிரை (Horse)',
    yoniEn: 'Horse (Ashwa)',
    yoniHi: 'अश्व (घोड़ा)',
    padas: [
      { padaNumber: 1, letterTa: 'சு', letterEn: 'Chu / Su', letterHi: 'चु / सु', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 2, letterTa: 'சே', letterEn: 'Che / Se', letterHi: 'चे / से', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 3, letterTa: 'சோ', letterEn: 'Cho / So', letterHi: 'चो / सो', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 4, letterTa: 'லா', letterEn: 'La', letterHi: 'ला', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' }
    ],
    allLettersSummaryTa: 'சு, சே, சோ, லா (Chu, Che, Cho, La)',
    allLettersSummaryEn: 'Chu, Che, Cho, La',
    allLettersSummaryHi: 'चु, चे, चो, ला (Chu, Che, Cho, La)'
  },
  {
    nakshatraIndex: 2,
    nakshatraNameTa: 'பரணி',
    nakshatraNameEn: 'Bharani',
    nakshatraNameHi: 'भरणी',
    deityTa: 'யம தர்மன்',
    deityEn: 'Lord Yama',
    deityHi: 'यमराज',
    lordTa: 'சுக்கிரன்',
    lordEn: 'Venus',
    lordHi: 'शुक्र',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'யானை (Elephant)',
    yoniEn: 'Elephant (Gaja)',
    yoniHi: 'गज (हाथी)',
    padas: [
      { padaNumber: 1, letterTa: 'லீ', letterEn: 'Lee / Li', letterHi: 'ली', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 2, letterTa: 'லூ', letterEn: 'Loo / Lu', letterHi: 'लू', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 3, letterTa: 'லே', letterEn: 'Le / Lay', letterHi: 'ले', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 4, letterTa: 'லோ', letterEn: 'Lo / Low', letterHi: 'लो', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' }
    ],
    allLettersSummaryTa: 'லீ, லூ, லே, லோ (Lee, Loo, Le, Lo)',
    allLettersSummaryEn: 'Lee, Loo, Le, Lo',
    allLettersSummaryHi: 'ली, लू, ले, लो (Lee, Loo, Le, Lo)'
  },
  {
    nakshatraIndex: 3,
    nakshatraNameTa: 'கிருத்திகை',
    nakshatraNameEn: 'Krittika',
    nakshatraNameHi: 'कृत्तिका',
    deityTa: 'அக்னி தேவன் / முருகப்பெருமான்',
    deityEn: 'Agni / Lord Murugan',
    deityHi: 'अग्नि देव',
    lordTa: 'சூரியன்',
    lordEn: 'Sun',
    lordHi: 'सूर्य',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'ஆடு (Sheep)',
    yoniEn: 'Sheep (Mesha)',
    yoniHi: 'मेष (भेड़)',
    padas: [
      { padaNumber: 1, letterTa: 'அ', letterEn: 'A', letterHi: 'अ', rasi: Rasi.MESHAM, rasiTa: 'மேஷம்', rasiEn: 'Mesham (Aries)', rasiHi: 'मेष' },
      { padaNumber: 2, letterTa: 'இ', letterEn: 'I / Ee', letterHi: 'इ', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 3, letterTa: 'உ', letterEn: 'U / Oo', letterHi: 'उ', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 4, letterTa: 'எ', letterEn: 'E / Ae', letterHi: 'ए', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' }
    ],
    allLettersSummaryTa: 'அ, இ, உ, எ (A, I, U, E)',
    allLettersSummaryEn: 'A, I, U, E',
    allLettersSummaryHi: 'अ, इ, उ, ए (A, I, U, E)'
  },
  {
    nakshatraIndex: 4,
    nakshatraNameTa: 'ரோகிணி',
    nakshatraNameEn: 'Rohini',
    nakshatraNameHi: 'रोहिणी',
    deityTa: 'பிரம்ம தேவன்',
    deityEn: 'Lord Brahma / Prajapati',
    deityHi: 'ब्रह्मा जी',
    lordTa: 'சந்திரன்',
    lordEn: 'Moon',
    lordHi: 'चंद्र',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'பாம்பு (Serpent)',
    yoniEn: 'Serpent (Sarpa)',
    yoniHi: 'सर्प',
    padas: [
      { padaNumber: 1, letterTa: 'ஒ', letterEn: 'O', letterHi: 'ओ', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 2, letterTa: 'வா', letterEn: 'Vaa', letterHi: 'वा', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 3, letterTa: 'வீ', letterEn: 'Vee / Vi', letterHi: 'वी', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 4, letterTa: 'வு', letterEn: 'Vu / Woo', letterHi: 'वु', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' }
    ],
    allLettersSummaryTa: 'ஒ, வா, வீ, வு (O, Vaa, Vi, Vu)',
    allLettersSummaryEn: 'O, Vaa, Vi, Vu',
    allLettersSummaryHi: 'ओ, वा, वी, वु (O, Vaa, Vi, Vu)'
  },
  {
    nakshatraIndex: 5,
    nakshatraNameTa: 'மிருகசீரிடம்',
    nakshatraNameEn: 'Mrigashirsha',
    nakshatraNameHi: 'मृगशिरा',
    deityTa: 'சந்திர பகவான் / சோமன்',
    deityEn: 'Lord Soma / Chandra',
    deityHi: 'सोम देव',
    lordTa: 'செவ்வாய்',
    lordEn: 'Mars',
    lordHi: 'मंगल',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'பாம்பு (Serpent)',
    yoniEn: 'Serpent',
    yoniHi: 'सर्प',
    padas: [
      { padaNumber: 1, letterTa: 'வே', letterEn: 'Ve / Way', letterHi: 'वे', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 2, letterTa: 'வோ', letterEn: 'Vo / Woh', letterHi: 'वो', rasi: Rasi.RISHABAM, rasiTa: 'ரிஷபம்', rasiEn: 'Rishabam (Taurus)', rasiHi: 'वृषभ' },
      { padaNumber: 3, letterTa: 'கா', letterEn: 'Kaa', letterHi: 'का', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 4, letterTa: 'கீ', letterEn: 'Kee / Ki', letterHi: 'की', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' }
    ],
    allLettersSummaryTa: 'வே, வோ, கா, கீ (Ve, Vo, Kaa, Kee)',
    allLettersSummaryEn: 'Ve, Vo, Kaa, Kee',
    allLettersSummaryHi: 'वे, वो, का, की (Ve, Vo, Kaa, Kee)'
  },
  {
    nakshatraIndex: 6,
    nakshatraNameTa: 'திருவாதிரை',
    nakshatraNameEn: 'Arudra',
    nakshatraNameHi: 'आर्द्रा',
    deityTa: 'ருத்ர பகவான் (சிவபெருமான்)',
    deityEn: 'Lord Rudra (Shiva)',
    deityHi: 'रुद्र देव (शिव)',
    lordTa: 'ராகு',
    lordEn: 'Rahu',
    lordHi: 'राहु',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'நாய் (Dog)',
    yoniEn: 'Dog',
    yoniHi: 'श्वान (कुत्ता)',
    padas: [
      { padaNumber: 1, letterTa: 'கு', letterEn: 'Ku / Koo', letterHi: 'कु', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 2, letterTa: 'க', letterEn: 'Gha / Kha', letterHi: 'घ / ख', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 3, letterTa: 'ங', letterEn: 'Inga / Nga', letterHi: 'ङ', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 4, letterTa: 'ச', letterEn: 'Cha / Chha', letterHi: 'छ / च', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' }
    ],
    allLettersSummaryTa: 'கு, க, ங, ச (Ku, Gha, Nga, Cha)',
    allLettersSummaryEn: 'Ku, Gha, Nga, Cha',
    allLettersSummaryHi: 'कु, घ, ङ, छ (Ku, Gha, Nga, Cha)'
  },
  {
    nakshatraIndex: 7,
    nakshatraNameTa: 'புனர்பூசம்',
    nakshatraNameEn: 'Punarvasu',
    nakshatraNameHi: 'पुनर्वसु',
    deityTa: 'அதிதி தேவி',
    deityEn: 'Goddess Aditi',
    deityHi: 'अदिति देवी',
    lordTa: 'குரு',
    lordEn: 'Jupiter',
    lordHi: 'गुरु',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'பூனை (Cat)',
    yoniEn: 'Cat (Marjara)',
    yoniHi: 'बिल्ली',
    padas: [
      { padaNumber: 1, letterTa: 'கே', letterEn: 'Ke / Kay', letterHi: 'के', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 2, letterTa: 'கோ', letterEn: 'Ko / Koh', letterHi: 'को', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 3, letterTa: 'ஹா', letterEn: 'Haa', letterHi: 'हा', rasi: Rasi.MITHUNAM, rasiTa: 'மிதுனம்', rasiEn: 'Mithunam (Gemini)', rasiHi: 'मिथुन' },
      { padaNumber: 4, letterTa: 'ஹீ', letterEn: 'Hee / Hi', letterHi: 'ही', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' }
    ],
    allLettersSummaryTa: 'கே, கோ, ஹா, ஹீ (Ke, Ko, Haa, Hee)',
    allLettersSummaryEn: 'Ke, Ko, Haa, Hee',
    allLettersSummaryHi: 'के, को, हा, ही (Ke, Ko, Haa, Hee)'
  },
  {
    nakshatraIndex: 8,
    nakshatraNameTa: 'பூசம்',
    nakshatraNameEn: 'Pushya',
    nakshatraNameHi: 'पुष्य',
    deityTa: 'பிருகஸ்பதி (குரு)',
    deityEn: 'Lord Brihaspati',
    deityHi: 'बृहस्पति देव',
    lordTa: 'சனி',
    lordEn: 'Saturn',
    lordHi: 'शनि',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'ஆடு (Sheep)',
    yoniEn: 'Sheep',
    yoniHi: 'मेष',
    padas: [
      { padaNumber: 1, letterTa: 'ஹு', letterEn: 'Hu / Hoo', letterHi: 'हु', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' },
      { padaNumber: 2, letterTa: 'ஹே', letterEn: 'He / Hay', letterHi: 'हे', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' },
      { padaNumber: 3, letterTa: 'ஹோ', letterEn: 'Ho / Hoh', letterHi: 'हो', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' },
      { padaNumber: 4, letterTa: 'டா', letterEn: 'Daa', letterHi: 'डा', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' }
    ],
    allLettersSummaryTa: 'ஹு, ஹே, ஹோ, டா (Hu, He, Ho, Daa)',
    allLettersSummaryEn: 'Hu, He, Ho, Daa',
    allLettersSummaryHi: 'हु, हे, हो, डा (Hu, He, Ho, Daa)'
  },
  {
    nakshatraIndex: 9,
    nakshatraNameTa: 'ஆயில்யம்',
    nakshatraNameEn: 'Ashlesha',
    nakshatraNameHi: 'आश्लेषा',
    deityTa: 'நாகராஜன் (சர்ப்ப தேவதை)',
    deityEn: 'Nagaraja (Serpent King)',
    deityHi: 'नागराज',
    lordTa: 'புதன்',
    lordEn: 'Mercury',
    lordHi: 'बुध',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'பூனை (Cat)',
    yoniEn: 'Cat',
    yoniHi: 'मार्जार (बिल्ली)',
    padas: [
      { padaNumber: 1, letterTa: 'டீ', letterEn: 'Dee / Di', letterHi: 'डी', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' },
      { padaNumber: 2, letterTa: 'டூ', letterEn: 'Doo / Du', letterHi: 'डू', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' },
      { padaNumber: 3, letterTa: 'டே', letterEn: 'De / Day', letterHi: 'डे', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' },
      { padaNumber: 4, letterTa: 'டோ', letterEn: 'Do / Doh', letterHi: 'डो', rasi: Rasi.KADAGAM, rasiTa: 'கடகம்', rasiEn: 'Kadagam (Cancer)', rasiHi: 'कर्क' }
    ],
    allLettersSummaryTa: 'டீ, டூ, டே, டோ (Dee, Doo, De, Do)',
    allLettersSummaryEn: 'Dee, Doo, De, Do',
    allLettersSummaryHi: 'डी, डू, डे, डो (Dee, Doo, De, Do)'
  },
  {
    nakshatraIndex: 10,
    nakshatraNameTa: 'மகம்',
    nakshatraNameEn: 'Magha',
    nakshatraNameHi: 'मघा',
    deityTa: 'பித்ரு தேவர்கள் (முன்னோர்கள்)',
    deityEn: 'Pitras (Ancestral Deities)',
    deityHi: 'पितृ देव',
    lordTa: 'கேது',
    lordEn: 'Ketu',
    lordHi: 'केतु',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'எலி (Rat)',
    yoniEn: 'Rat (Mooshika)',
    yoniHi: 'मूषक (चूहा)',
    padas: [
      { padaNumber: 1, letterTa: 'மா', letterEn: 'Maa', letterHi: 'मा', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 2, letterTa: 'மீ', letterEn: 'Mee / Mi', letterHi: 'मी', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 3, letterTa: 'மூ', letterEn: 'Moo / Mu', letterHi: 'मू', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 4, letterTa: 'மே', letterEn: 'Me / May', letterHi: 'मे', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' }
    ],
    allLettersSummaryTa: 'மா, மீ, மூ, மே (Maa, Mee, Moo, Me)',
    allLettersSummaryEn: 'Maa, Mee, Moo, Me',
    allLettersSummaryHi: 'मा, मी, मू, मे (Maa, Mee, Moo, Me)'
  },
  {
    nakshatraIndex: 11,
    nakshatraNameTa: 'பூரம்',
    nakshatraNameEn: 'Purva Phalguni',
    nakshatraNameHi: 'पूर्वाफाल्गुनी',
    deityTa: 'பாகன் (பக தேவன்)',
    deityEn: 'Bhaga Devata',
    deityHi: 'भग देवता',
    lordTa: 'சுக்கிரன்',
    lordEn: 'Venus',
    lordHi: 'शुक्र',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'எலி (Rat)',
    yoniEn: 'Rat',
    yoniHi: 'मूषक',
    padas: [
      { padaNumber: 1, letterTa: 'மோ', letterEn: 'Mo / Moh', letterHi: 'मो', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 2, letterTa: 'டா', letterEn: 'Taa', letterHi: 'टा', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 3, letterTa: 'டீ', letterEn: 'Tee / Ti', letterHi: 'टी', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 4, letterTa: 'டூ', letterEn: 'Too / Tu', letterHi: 'टू', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' }
    ],
    allLettersSummaryTa: 'மோ, டா, டீ, டூ (Mo, Taa, Tee, Too)',
    allLettersSummaryEn: 'Mo, Taa, Tee, Too',
    allLettersSummaryHi: 'मो, टा, टी, टू (Mo, Taa, Tee, Too)'
  },
  {
    nakshatraIndex: 12,
    nakshatraNameTa: 'உத்திரம்',
    nakshatraNameEn: 'Uttara Phalguni',
    nakshatraNameHi: 'उत्तराफाल्गुनी',
    deityTa: 'அரியமான் தேவன்',
    deityEn: 'Aryaman',
    deityHi: 'अर्यमा देव',
    lordTa: 'சூரியன்',
    lordEn: 'Sun',
    lordHi: 'सूर्य',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'பசு (Cow)',
    yoniEn: 'Cow (Gau)',
    yoniHi: 'गाय (गौ)',
    padas: [
      { padaNumber: 1, letterTa: 'டே', letterEn: 'Te / Tay', letterHi: 'टे', rasi: Rasi.SIMHAM, rasiTa: 'சிம்மம்', rasiEn: 'Simham (Leo)', rasiHi: 'सिंह' },
      { padaNumber: 2, letterTa: 'டோ', letterEn: 'To / Toh', letterHi: 'टो', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 3, letterTa: 'பா', letterEn: 'Paa', letterHi: 'पा', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 4, letterTa: 'பீ', letterEn: 'Pee / Pi', letterHi: 'पी', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' }
    ],
    allLettersSummaryTa: 'டே, டோ, பா, பீ (Te, To, Paa, Pee)',
    allLettersSummaryEn: 'Te, To, Paa, Pee',
    allLettersSummaryHi: 'टे, टो, पा, पी (Te, To, Paa, Pee)'
  },
  {
    nakshatraIndex: 13,
    nakshatraNameTa: 'அஸ்தம்',
    nakshatraNameEn: 'Hasta',
    nakshatraNameHi: 'हस्त',
    deityTa: 'சவிதா (சூரியன்)',
    deityEn: 'Savitri (Sun)',
    deityHi: 'सविता देव',
    lordTa: 'சந்திரன்',
    lordEn: 'Moon',
    lordHi: 'चंद्र',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'எருமை (Buffalo)',
    yoniEn: 'Buffalo',
    yoniHi: 'महिष (भैंस)',
    padas: [
      { padaNumber: 1, letterTa: 'பூ', letterEn: 'Poo / Pu', letterHi: 'पू', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 2, letterTa: 'ஷா', letterEn: 'Sha', letterHi: 'ष / श', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 3, letterTa: 'ணா', letterEn: 'Na / Nna', letterHi: 'ण', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 4, letterTa: 'டா', letterEn: 'Tha / Dha', letterHi: 'ठ', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' }
    ],
    allLettersSummaryTa: 'பூ, ஷா, ணா, டா (Poo, Sha, Na, Tha)',
    allLettersSummaryEn: 'Poo, Sha, Na, Tha',
    allLettersSummaryHi: 'पू, ष, ण, ठ (Poo, Sha, Na, Tha)'
  },
  {
    nakshatraIndex: 14,
    nakshatraNameTa: 'சித்திரை',
    nakshatraNameEn: 'Chitra',
    nakshatraNameHi: 'चित्रा',
    deityTa: 'விஸ்வகர்மா',
    deityEn: 'Vishwakarma (Divine Architect)',
    deityHi: 'विश्वकर्मा देव',
    lordTa: 'செவ்வாய்',
    lordEn: 'Mars',
    lordHi: 'मंगल',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'புலி (Tiger)',
    yoniEn: 'Tiger (Vyaghra)',
    yoniHi: 'व्याघ्र (बाघ)',
    padas: [
      { padaNumber: 1, letterTa: 'பே', letterEn: 'Pe / Pay', letterHi: 'पे', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 2, letterTa: 'போ', letterEn: 'Po / Poh', letterHi: 'पो', rasi: Rasi.KANNI, rasiTa: 'கன்னி', rasiEn: 'Kanni (Virgo)', rasiHi: 'कन्या' },
      { padaNumber: 3, letterTa: 'ரா', letterEn: 'Raa', letterHi: 'रा', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 4, letterTa: 'ரீ', letterEn: 'Ree / Ri', letterHi: 'री', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' }
    ],
    allLettersSummaryTa: 'பே, போ, ரா, ரீ (Pe, Po, Raa, Ree)',
    allLettersSummaryEn: 'Pe, Po, Raa, Ree',
    allLettersSummaryHi: 'पे, पो, रा, री (Pe, Po, Raa, Ree)'
  },
  {
    nakshatraIndex: 15,
    nakshatraNameTa: 'சுவாதி',
    nakshatraNameEn: 'Swati',
    nakshatraNameHi: 'स्वाति',
    deityTa: 'வாயு பகவான்',
    deityEn: 'Vayu (Wind God)',
    deityHi: 'वायु देव',
    lordTa: 'ராகு',
    lordEn: 'Rahu',
    lordHi: 'राहु',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'எருமை (Buffalo)',
    yoniEn: 'Buffalo',
    yoniHi: 'महिष',
    padas: [
      { padaNumber: 1, letterTa: 'ரூ', letterEn: 'Roo / Ru', letterHi: 'रू', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 2, letterTa: 'ரே', letterEn: 'Re / Ray', letterHi: 'रे', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 3, letterTa: 'ரோ', letterEn: 'Ro / Roh', letterHi: 'रो', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 4, letterTa: 'தா', letterEn: 'Thaa / Ta', letterHi: 'ता', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' }
    ],
    allLettersSummaryTa: 'ரூ, ரே, ரோ, தா (Roo, Re, Ro, Thaa)',
    allLettersSummaryEn: 'Roo, Re, Ro, Thaa',
    allLettersSummaryHi: 'रू, रे, रो, ता (Roo, Re, Ro, Thaa)'
  },
  {
    nakshatraIndex: 16,
    nakshatraNameTa: 'விசாகம்',
    nakshatraNameEn: 'Vishakha',
    nakshatraNameHi: 'विशाखा',
    deityTa: 'இந்திராக்னி (இந்திரன் & அக்னி)',
    deityEn: 'Indragni',
    deityHi: 'इंद्राग्नि',
    lordTa: 'குரு',
    lordEn: 'Jupiter',
    lordHi: 'गुरु',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'புலி (Tiger)',
    yoniEn: 'Tiger',
    yoniHi: 'व्याघ्र',
    padas: [
      { padaNumber: 1, letterTa: 'தீ', letterEn: 'Thee / Ti', letterHi: 'ती', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 2, letterTa: 'தூ', letterEn: 'Thoo / Tu', letterHi: 'तू', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 3, letterTa: 'தே', letterEn: 'They / Te', letterHi: 'ते', rasi: Rasi.THULAM, rasiTa: 'துலாம்', rasiEn: 'Thulam (Libra)', rasiHi: 'तुला' },
      { padaNumber: 4, letterTa: 'தோ', letterEn: 'Tho / Toh', letterHi: 'तो', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' }
    ],
    allLettersSummaryTa: 'தீ, தூ, தே, தோ (Thee, Thoo, They, Tho)',
    allLettersSummaryEn: 'Thee, Thoo, They, Tho',
    allLettersSummaryHi: 'ती, तू, ते, तो (Thee, Thoo, They, Tho)'
  },
  {
    nakshatraIndex: 17,
    nakshatraNameTa: 'அனுஷம்',
    nakshatraNameEn: 'Anuradha',
    nakshatraNameHi: 'अनुराधा',
    deityTa: 'மித்ர தேவன்',
    deityEn: 'Mitra',
    deityHi: 'मित्र देव',
    lordTa: 'சனி',
    lordEn: 'Saturn',
    lordHi: 'शनि',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'மான் (Deer)',
    yoniEn: 'Deer (Mriga)',
    yoniHi: 'मृग (हिरण)',
    padas: [
      { padaNumber: 1, letterTa: 'நா', letterEn: 'Naa', letterHi: 'ना', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' },
      { padaNumber: 2, letterTa: 'நீ', letterEn: 'Nee / Ni', letterHi: 'नी', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' },
      { padaNumber: 3, letterTa: 'நூ', letterEn: 'Noo / Nu', letterHi: 'नू', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' },
      { padaNumber: 4, letterTa: 'நே', letterEn: 'Ne / Nay', letterHi: 'ने', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' }
    ],
    allLettersSummaryTa: 'நா, நீ, நூ, நே (Naa, Nee, Noo, Ne)',
    allLettersSummaryEn: 'Naa, Nee, Noo, Ne',
    allLettersSummaryHi: 'ना, नी, नू, ने (Naa, Nee, Noo, Ne)'
  },
  {
    nakshatraIndex: 18,
    nakshatraNameTa: 'கேட்டை',
    nakshatraNameEn: 'Jyeshtha',
    nakshatraNameHi: 'ज्येष्ठा',
    deityTa: 'இந்திர பகவான்',
    deityEn: 'Lord Indra',
    deityHi: 'इंद्र देव',
    lordTa: 'புதன்',
    lordEn: 'Mercury',
    lordHi: 'बुध',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'மான் (Deer)',
    yoniEn: 'Deer',
    yoniHi: 'मृग',
    padas: [
      { padaNumber: 1, letterTa: 'நோ', letterEn: 'No / Noh', letterHi: 'नो', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' },
      { padaNumber: 2, letterTa: 'யா', letterEn: 'Yaa', letterHi: 'या', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' },
      { padaNumber: 3, letterTa: 'யீ', letterEn: 'Yee / Yi', letterHi: 'यी', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' },
      { padaNumber: 4, letterTa: 'யூ', letterEn: 'Yoo / Yu', letterHi: 'यू', rasi: Rasi.VIRUCHIGAM, rasiTa: 'விருச்சிகம்', rasiEn: 'Viruchigam (Scorpio)', rasiHi: 'वृश्चिक' }
    ],
    allLettersSummaryTa: 'நோ, யா, யீ, யூ (No, Yaa, Yee, Yoo)',
    allLettersSummaryEn: 'No, Yaa, Yee, Yoo',
    allLettersSummaryHi: 'नो, या, यी, यू (No, Yaa, Yee, Yoo)'
  },
  {
    nakshatraIndex: 19,
    nakshatraNameTa: 'மூலம்',
    nakshatraNameEn: 'Mula',
    nakshatraNameHi: 'मूल',
    deityTa: 'நிருதி தேவதை',
    deityEn: 'Nirriti (Goddess of Dissolution)',
    deityHi: 'निर्ऋति देवी',
    lordTa: 'கேது',
    lordEn: 'Ketu',
    lordHi: 'केतु',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'நாய் (Dog)',
    yoniEn: 'Dog',
    yoniHi: 'श्वान',
    padas: [
      { padaNumber: 1, letterTa: 'யே', letterEn: 'Ye / Yay', letterHi: 'ये', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 2, letterTa: 'யோ', letterEn: 'Yo / Yoh', letterHi: 'यो', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 3, letterTa: 'பா', letterEn: 'Baa', letterHi: 'भा', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 4, letterTa: 'பீ', letterEn: 'Bee / Bi', letterHi: 'भी', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' }
    ],
    allLettersSummaryTa: 'யே, யோ, பா, பீ (Ye, Yo, Baa, Bee)',
    allLettersSummaryEn: 'Ye, Yo, Baa, Bee',
    allLettersSummaryHi: 'ये, यो, भा, भी (Ye, Yo, Baa, Bee)'
  },
  {
    nakshatraIndex: 20,
    nakshatraNameTa: 'பூராடம்',
    nakshatraNameEn: 'Purva Ashadha',
    nakshatraNameHi: 'पूर्वाषाढ़ा',
    deityTa: 'ஆபஸ் (நீர் தேவதை)',
    deityEn: 'Apas (Water Goddess)',
    deityHi: 'आपः (जल देवी)',
    lordTa: 'சுக்கிரன்',
    lordEn: 'Venus',
    lordHi: 'शुक्र',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'குரங்கு (Monkey)',
    yoniEn: 'Monkey (Vanara)',
    yoniHi: 'वानर (बंदर)',
    padas: [
      { padaNumber: 1, letterTa: 'பூ', letterEn: 'Bhoo / Bu', letterHi: 'भू', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 2, letterTa: 'தா', letterEn: 'Dhaa', letterHi: 'धा', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 3, letterTa: 'பா', letterEn: 'Phaa / Pha', letterHi: 'फा', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 4, letterTa: 'டா', letterEn: 'Dhaa / Dha', letterHi: 'ढा', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' }
    ],
    allLettersSummaryTa: 'பூ, தா, பா, டா (Bhoo, Dhaa, Phaa, Dhaa)',
    allLettersSummaryEn: 'Bhoo, Dhaa, Phaa, Dhaa',
    allLettersSummaryHi: 'भू, धा, फा, ढा (Bhoo, Dhaa, Phaa, Dhaa)'
  },
  {
    nakshatraIndex: 21,
    nakshatraNameTa: 'உத்திராடம்',
    nakshatraNameEn: 'Uttara Ashadha',
    nakshatraNameHi: 'उत्तराषाढ़ा',
    deityTa: 'விஸ்வேதேவர்கள்',
    deityEn: 'Vishvadevas',
    deityHi: 'विश्वेदेव',
    lordTa: 'சூரியன்',
    lordEn: 'Sun',
    lordHi: 'सूर्य',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'கீரி (Mongoose)',
    yoniEn: 'Mongoose (Nakula)',
    yoniHi: 'नकुल (नेवला)',
    padas: [
      { padaNumber: 1, letterTa: 'பே', letterEn: 'Bhe / Bay', letterHi: 'भे', rasi: Rasi.DHANUSU, rasiTa: 'தனுசு', rasiEn: 'Dhanusu (Sagittarius)', rasiHi: 'धनु' },
      { padaNumber: 2, letterTa: 'போ', letterEn: 'Bho / Boh', letterHi: 'भो', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 3, letterTa: 'ஜா', letterEn: 'Jaa', letterHi: 'जा', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 4, letterTa: 'ஜீ', letterEn: 'Jee / Ji', letterHi: 'जी', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' }
    ],
    allLettersSummaryTa: 'பே, போ, ஜா, ஜீ (Bhe, Bho, Jaa, Jee)',
    allLettersSummaryEn: 'Bhe, Bho, Jaa, Jee',
    allLettersSummaryHi: 'भे, भो, जा, जी (Bhe, Bho, Jaa, Jee)'
  },
  {
    nakshatraIndex: 22,
    nakshatraNameTa: 'திருவோணம்',
    nakshatraNameEn: 'Shravana',
    nakshatraNameHi: 'श्रवण',
    deityTa: 'மகாவிஷ்ணு',
    deityEn: 'Lord Maha Vishnu',
    deityHi: 'भगवान विष्णु',
    lordTa: 'சந்திரன்',
    lordEn: 'Moon',
    lordHi: 'चंद्र',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'குரங்கு (Monkey)',
    yoniEn: 'Monkey',
    yoniHi: 'वानर',
    padas: [
      { padaNumber: 1, letterTa: 'கீ', letterEn: 'Khee / Khi', letterHi: 'खी', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 2, letterTa: 'கூ', letterEn: 'Khoo / Khu', letterHi: 'खू', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 3, letterTa: 'கே', letterEn: 'Khe / Khay', letterHi: 'खे', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 4, letterTa: 'கோ', letterEn: 'Kho / Khoh', letterHi: 'खो', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' }
    ],
    allLettersSummaryTa: 'கீ, கூ, கே, கோ (Khee, Khoo, Khe, Kho)',
    allLettersSummaryEn: 'Khee, Khoo, Khe, Kho',
    allLettersSummaryHi: 'खी, खू, खे, खो (Khee, Khoo, Khe, Kho)'
  },
  {
    nakshatraIndex: 23,
    nakshatraNameTa: 'அவிட்டம்',
    nakshatraNameEn: 'Dhanishta',
    nakshatraNameHi: 'धनिष्ठा',
    deityTa: 'அஷ்ட வசுக்கள்',
    deityEn: 'Ashta Vasus (8 Elemental Gods)',
    deityHi: 'अष्ट वसु',
    lordTa: 'செவ்வாய்',
    lordEn: 'Mars',
    lordHi: 'मंगल',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'சிங்கம் (Lion)',
    yoniEn: 'Lion (Simha)',
    yoniHi: 'सिंह (शेर)',
    padas: [
      { padaNumber: 1, letterTa: 'கா', letterEn: 'Gaa', letterHi: 'गा', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 2, letterTa: 'கீ', letterEn: 'Gee / Gi', letterHi: 'गी', rasi: Rasi.MAGARAM, rasiTa: 'மகரம்', rasiEn: 'Magaram (Capricorn)', rasiHi: 'मकर' },
      { padaNumber: 3, letterTa: 'கூ', letterEn: 'Goo / Gu', letterHi: 'गू', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 4, letterTa: 'கே', letterEn: 'Ge / Gay', letterHi: 'गे', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' }
    ],
    allLettersSummaryTa: 'கா, கீ, கூ, கே (Gaa, Gee, Goo, Ge)',
    allLettersSummaryEn: 'Gaa, Gee, Goo, Ge',
    allLettersSummaryHi: 'गा, गी, गू, गे (Gaa, Gee, Goo, Ge)'
  },
  {
    nakshatraIndex: 24,
    nakshatraNameTa: 'சதயம்',
    nakshatraNameEn: 'Shatabhisha',
    nakshatraNameHi: 'शतभिषा',
    deityTa: 'வருண பகவான்',
    deityEn: 'Varuna (Ocean & Rain God)',
    deityHi: 'वरुण देव',
    lordTa: 'ராகு',
    lordEn: 'Rahu',
    lordHi: 'राहु',
    ganaTa: 'ராட்சச கணம்',
    ganaEn: 'Rakshasa Gana',
    ganaHi: 'राक्षस गण',
    yoniTa: 'குதிரை (Horse)',
    yoniEn: 'Horse',
    yoniHi: 'अश्व',
    padas: [
      { padaNumber: 1, letterTa: 'கோ', letterEn: 'Go / Goh', letterHi: 'गो', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 2, letterTa: 'சா', letterEn: 'Saa', letterHi: 'सा', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 3, letterTa: 'சீ', letterEn: 'See / Si', letterHi: 'सी', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 4, letterTa: 'சூ', letterEn: 'Soo / Su', letterHi: 'सू', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' }
    ],
    allLettersSummaryTa: 'கோ, சா, சீ, சூ (Go, Saa, See, Soo)',
    allLettersSummaryEn: 'Go, Saa, See, Soo',
    allLettersSummaryHi: 'गो, सा, सी, सू (Go, Saa, See, Soo)'
  },
  {
    nakshatraIndex: 25,
    nakshatraNameTa: 'பூரட்டாதி',
    nakshatraNameEn: 'Purva Bhadrapada',
    nakshatraNameHi: 'पूर्वाभाद्रपद',
    deityTa: 'அஜைகபாதர் (சிவ வடிவம்)',
    deityEn: 'Aja Ekapada',
    deityHi: 'अजैकपाद',
    lordTa: 'குரு',
    lordEn: 'Jupiter',
    lordHi: 'गुरु',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'சிங்கம் (Lion)',
    yoniEn: 'Lion',
    yoniHi: 'सिंह',
    padas: [
      { padaNumber: 1, letterTa: 'சே', letterEn: 'Se / Say', letterHi: 'से', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 2, letterTa: 'சோ', letterEn: 'So / Soh', letterHi: 'सो', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 3, letterTa: 'தா', letterEn: 'Daa', letterHi: 'दा', rasi: Rasi.KUMBAM, rasiTa: 'கும்பம்', rasiEn: 'Kumbam (Aquarius)', rasiHi: 'कुंभ' },
      { padaNumber: 4, letterTa: 'தீ', letterEn: 'Dee / Di', letterHi: 'दी', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' }
    ],
    allLettersSummaryTa: 'சே, சோ, தா, தீ (Se, So, Daa, Dee)',
    allLettersSummaryEn: 'Se, So, Daa, Dee',
    allLettersSummaryHi: 'से, सो, दा, दी (Se, So, Daa, Dee)'
  },
  {
    nakshatraIndex: 26,
    nakshatraNameTa: 'உத்திரட்டாதி',
    nakshatraNameEn: 'Uttara Bhadrapada',
    nakshatraNameHi: 'उत्तराभाद्रपद',
    deityTa: 'அஹிர்புத்னியர்',
    deityEn: 'Ahirbudhnya',
    deityHi: 'अहिर्बुध्न्य',
    lordTa: 'சனி',
    lordEn: 'Saturn',
    lordHi: 'शनि',
    ganaTa: 'மனுஷ்ய கணம்',
    ganaEn: 'Manushya Gana',
    ganaHi: 'मनुष्य गण',
    yoniTa: 'பசு (Cow)',
    yoniEn: 'Cow',
    yoniHi: 'गाय',
    padas: [
      { padaNumber: 1, letterTa: 'தூ', letterEn: 'Doo / Du', letterHi: 'दू', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' },
      { padaNumber: 2, letterTa: 'த', letterEn: 'Tha / Ttha', letterHi: 'थ', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' },
      { padaNumber: 3, letterTa: 'ஜ', letterEn: 'Jha / Za', letterHi: 'झ', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' },
      { padaNumber: 4, letterTa: 'ஞ', letterEn: 'Nya / Tra', letterHi: 'ञ / त्र', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' }
    ],
    allLettersSummaryTa: 'தூ, த, ஜ, ஞ (Doo, Tha, Jha, Nya)',
    allLettersSummaryEn: 'Doo, Tha, Jha, Nya',
    allLettersSummaryHi: 'दू, थ, झ, ञ (Doo, Tha, Jha, Nya)'
  },
  {
    nakshatraIndex: 27,
    nakshatraNameTa: 'ரேவதி',
    nakshatraNameEn: 'Revati',
    nakshatraNameHi: 'रेवती',
    deityTa: 'பூஷன் தேவன்',
    deityEn: 'Pushan (Protector of Travelers)',
    deityHi: 'पूषा देव',
    lordTa: 'புதன்',
    lordEn: 'Mercury',
    lordHi: 'बुध',
    ganaTa: 'தேவ கணம்',
    ganaEn: 'Deva Gana',
    ganaHi: 'देव गण',
    yoniTa: 'யானை (Elephant)',
    yoniEn: 'Elephant',
    yoniHi: 'गज',
    padas: [
      { padaNumber: 1, letterTa: 'தே', letterEn: 'De / Day', letterHi: 'दे', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' },
      { padaNumber: 2, letterTa: 'தோ', letterEn: 'Do / Doh', letterHi: 'दो', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' },
      { padaNumber: 3, letterTa: 'சா', letterEn: 'Chaa', letterHi: 'चा', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' },
      { padaNumber: 4, letterTa: 'சீ', letterEn: 'Chee / Chi', letterHi: 'ची', rasi: Rasi.MEENAM, rasiTa: 'மீனம்', rasiEn: 'Meenam (Pisces)', rasiHi: 'मीन' }
    ],
    allLettersSummaryTa: 'தே, தோ, சா, சீ (De, Do, Chaa, Chee)',
    allLettersSummaryEn: 'De, Do, Chaa, Chee',
    allLettersSummaryHi: 'दे, दो, चा, ची (De, Do, Chaa, Chee)'
  }
].map(star => {
  const group = rajjuTable.groups[star.nakshatraIndex - 1];
  return { ...star, rajjuEn: rajjuTable.en[group], rajjuTa: rajjuTable.ta[group], rajjuHi: rajjuTable.hi[group] };
});

// Comprehensive Curated Vedic Baby Names dictionary for all starting syllables
const CURATED_SUGGESTIONS: Record<string, BabyNameSuggestion[]> = {
  // Ashwini
  'Chu / Su': [
    { nameTa: 'சுதன்', nameEn: 'Sudhan', nameHi: 'सुधन', gender: 'M', meaningTa: 'செல்வந்தன், புத்திசாலி', meaningEn: 'Wealthy, Virtuous, Wise', meaningHi: 'बुद्धिमान एवं धनवान', startingLetter: 'Chu / Su' },
    { nameTa: 'சுகிர்தா', nameEn: 'Sukirthi', nameHi: 'सुकीर्ति', gender: 'F', meaningTa: 'நற்புகழ், மங்களம்', meaningEn: 'Good Fame, Auspicious, Glorious', meaningHi: 'सद्कीर्ति एवं यशस्विनी', startingLetter: 'Chu / Su' },
    { nameTa: 'சுரேஷ்', nameEn: 'Suresh', nameHi: 'सुरेश', gender: 'M', meaningTa: 'தேவர்களின் இறைவன்', meaningEn: 'Lord of Celestials, Divine Light', meaningHi: 'देवताओं के अधिपति', startingLetter: 'Chu / Su' },
    { nameTa: 'சுபிக்ஷா', nameEn: 'Subiksha', nameHi: 'सुभिक्षा', gender: 'F', meaningTa: 'செழிப்பு, வளம்', meaningEn: 'Prosperity, Abundance, Grace', meaningHi: 'समृद्धि एवं संपन्नता', startingLetter: 'Chu / Su' }
  ],
  'Che / Se': [
    { nameTa: 'செந்தில்', nameEn: 'Senthil', nameHi: 'सेंथिल', gender: 'M', meaningTa: 'முருகப்பெருமான், பேரொளி', meaningEn: 'Lord Murugan, Resplendent', meaningHi: 'भगवान कार्तिकेय', startingLetter: 'Che / Se' },
    { nameTa: 'சேதுபதி', nameEn: 'Sethupathi', nameHi: 'सेतुपति', gender: 'M', meaningTa: 'சேதுவின் தலைவர், வீரன்', meaningEn: 'Master of the Bridge, Leader', meaningHi: 'महासाहसी नायक', startingLetter: 'Che / Se' },
    { nameTa: 'சேதுலக்ஷ்மி', nameEn: 'Sethulakshmi', nameHi: 'सेतुलक्ष्मी', gender: 'F', meaningTa: 'மங்கள லக்ஷ்மி தேவி', meaningEn: 'Goddess Lakshmi, Auspicious', meaningHi: 'शुभदायिनी लक्ष्मी', startingLetter: 'Che / Se' },
    { nameTa: 'சேதனா', nameEn: 'Chetana', nameHi: 'चेतना', gender: 'F', meaningTa: 'விழிப்புணர்வு, ஆன்ம சக்தி', meaningEn: 'Consciousness, Inner Power', meaningHi: 'चेतना एवं आत्मशक्ति', startingLetter: 'Che / Se' }
  ],
  'Cho / So': [
    { nameTa: 'சோமசுந்தரம்', nameEn: 'Somasundaram', nameHi: 'सोमसुंदरम', gender: 'M', meaningTa: 'சந்திரனைப் போன்ற பேரழகு கொண்ட சிவன்', meaningEn: 'Moon-like beautiful Lord Shiva', meaningHi: 'सुंदर शिव रूप', startingLetter: 'Cho / So' },
    { nameTa: 'சோமேஷ்', nameEn: 'Somesh', nameHi: 'सोमेश', gender: 'M', meaningTa: 'சந்திரனின் அதிபதி, சிவன்', meaningEn: 'Lord of the Moon', meaningHi: 'चंद्र देव एवं शिव', startingLetter: 'Cho / So' },
    { nameTa: 'சோபனா', nameEn: 'Shobana', nameHi: 'शोभना', gender: 'F', meaningTa: 'பொலிவு, அழகுடையவள்', meaningEn: 'Radiant, Splendid, Beautiful', meaningHi: 'सौंदर्यमयी एवं कांतिवान', startingLetter: 'Cho / So' },
    { nameTa: 'சோமிகா', nameEn: 'Somika', nameHi: 'सोमिका', gender: 'F', meaningTa: 'அமைதியானவள், நிலவு', meaningEn: 'Calm like the Moon, Gentle', meaningHi: 'चंद्र जैसी शांत', startingLetter: 'Cho / So' }
  ],
  'La': [
    { nameTa: 'லக்ஷ்மணன்', nameEn: 'Lakshman', nameHi: 'लक्ष्मण', gender: 'M', meaningTa: 'நற்பண்புகள் கொண்டவன்', meaningEn: 'Prosperous, Devoted Brother', meaningHi: 'शुभ लक्षणों से युक्त', startingLetter: 'La' },
    { nameTa: 'லாவண்யன்', nameEn: 'Lavanyan', nameHi: 'लावण्यन', gender: 'M', meaningTa: 'அழகு மற்றும் கம்பீரம்', meaningEn: 'Handsome, Graceful, Radiant', meaningHi: 'सौंदर्यवान एवं तेजस्वी', startingLetter: 'La' },
    { nameTa: 'லாவண்யா', nameEn: 'Lavanya', nameHi: 'लावण्या', gender: 'F', meaningTa: 'பேரழகு, நற்பண்பு', meaningEn: 'Grace, Elegance, Divine Beauty', meaningHi: 'सौंदर्य एवं माधुर्य', startingLetter: 'La' },
    { nameTa: 'லக்ஷிதா', nameEn: 'Lakshitha', nameHi: 'लक्षिता', gender: 'F', meaningTa: 'குறிக்கோள் கொண்டவள்', meaningEn: 'Distinguished, Successful', meaningHi: 'सफल एवं विशिष्ट', startingLetter: 'La' }
  ],

  // Bharani
  'Lee / Li': [
    { nameTa: 'லீலாதரன்', nameEn: 'Leeladhar', nameHi: 'लीलाधर', gender: 'M', meaningTa: 'மகாவிஷ்ணு, லீலைகள் புரிபவர்', meaningEn: 'Lord Vishnu, Divine Play', meaningHi: 'भगवान विष्णु', startingLetter: 'Lee / Li' },
    { nameTa: 'லிங்கேஷ்', nameEn: 'Lingesh', nameHi: 'लिंगेश', gender: 'M', meaningTa: 'சிவபெருமான்', meaningEn: 'Lord Shiva', meaningHi: 'भगवान शिव', startingLetter: 'Lee / Li' },
    { nameTa: 'லீலாவதி', nameEn: 'Leelavathi', nameHi: 'लीलावती', gender: 'F', meaningTa: 'மகிழ்ச்சி தரும் தேவி', meaningEn: 'Playful, Goddess Saraswati', meaningHi: 'मां सरस्वती', startingLetter: 'Lee / Li' },
    { nameTa: 'லிபிஷா', nameEn: 'Lipisha', nameHi: 'लिपिशा', gender: 'F', meaningTa: 'எழுத்துக்கலை, அறிவு', meaningEn: 'Sacred Script, Wisdom', meaningHi: 'विद्या एवं ज्ञान', startingLetter: 'Lee / Li' }
  ],
  'Loo / Lu': [
    { nameTa: 'லோகேஷ்வரன்', nameEn: 'Lokeshwaran', nameHi: 'लोकेश्वर', gender: 'M', meaningTa: 'உலகங்களை ஆளும் கடவுள்', meaningEn: 'Ruler of the World', meaningHi: 'संसार के ईश्वर', startingLetter: 'Loo / Lu' },
    { nameTa: 'லுஹித்', nameEn: 'Luhit', nameHi: 'लुहित', gender: 'M', meaningTa: 'செந்நிற ஒளி, சூரியன்', meaningEn: 'Red Radiance, Sun', meaningHi: 'सूर्य का तेज', startingLetter: 'Loo / Lu' },
    { nameTa: 'லூப்னா', nameEn: 'Lubna', nameHi: 'लुबना', gender: 'F', meaningTa: 'நறுமணம், தூயவள்', meaningEn: 'Sweet Fragrance, Purity', meaningHi: 'सुगंधित एवं पवित्र', startingLetter: 'Loo / Lu' },
    { nameTa: 'லுக்ஷணா', nameEn: 'Lukshana', nameHi: 'लुक्षणा', gender: 'F', meaningTa: 'மங்கள அடையாளம் கொண்டவள்', meaningEn: 'Auspicious Characteristics', meaningHi: 'शुभ लक्षणी', startingLetter: 'Loo / Lu' }
  ],
  'Le / Lay': [
    { nameTa: 'லேகேஷ்', nameEn: 'Lekhesh', nameHi: 'लेखेश', gender: 'M', meaningTa: 'எழுத்தின் அதிபதி, பிரம்மா', meaningEn: 'Master of Writings, Brahma', meaningHi: 'विद्या के स्वामी', startingLetter: 'Le / Lay' },
    { nameTa: 'லேகன்', nameEn: 'Lekhan', nameHi: 'लेखन', gender: 'M', meaningTa: 'படைப்பாளி, அறிஞன்', meaningEn: 'Author, Creator, Wise', meaningHi: 'रचनाकार एवं ज्ञानी', startingLetter: 'Le / Lay' },
    { nameTa: 'லேகா', nameEn: 'Lekha', nameHi: 'लेखा', gender: 'F', meaningTa: 'கலைமகள், சித்திரம்', meaningEn: 'Divine Writing, Artwork, Star', meaningHi: 'कला एवं रेखा', startingLetter: 'Le / Lay' },
    { nameTa: 'லேகஸ்ரீ', nameEn: 'Lekhashree', nameHi: 'लेखाश्री', gender: 'F', meaningTa: 'மங்களகரமான கல்விச்செல்வம்', meaningEn: 'Goddess Lakshmi of Wisdom', meaningHi: 'ज्ञान की देवी', startingLetter: 'Le / Lay' }
  ],
  'Lo / Low': [
    { nameTa: 'லோகேஷ்', nameEn: 'Lokesh', nameHi: 'लोकेश', gender: 'M', meaningTa: 'உலகை ஆள்பவர், பிரம்மன்', meaningEn: 'Lord of the World, Brahma', meaningHi: 'संसार के स्वामी', startingLetter: 'Lo / Low' },
    { nameTa: 'லோகநாதன்', nameEn: 'Loganathan', nameHi: 'लोकनाथन', gender: 'M', meaningTa: 'அண்டசராசரத்தின் தலைவர்', meaningEn: 'Protector of the World', meaningHi: 'जगतरक्षक', startingLetter: 'Lo / Low' },
    { nameTa: 'லோபமுத்ரா', nameEn: 'Lopamudra', nameHi: 'लोपामुद्रा', gender: 'F', meaningTa: 'அகத்திய முனிவரின் தேவி, ஞானி', meaningEn: 'Wife of Sage Agastya, Wise Sage', meaningHi: 'विदुषी लोपामुद्रा', startingLetter: 'Lo / Low' },
    { nameTa: 'லோகிதா', nameEn: 'Lohitha', nameHi: 'लोहिता', gender: 'F', meaningTa: 'சிவந்த செவ்வொளி, லட்சுமி', meaningEn: 'Red Radiance, Goddess Lakshmi', meaningHi: 'लाल कांति, लक्ष्मी', startingLetter: 'Lo / Low' }
  ],

  // Krittika
  'A': [
    { nameTa: 'அஸ்வின்', nameEn: 'Ashwin', nameHi: 'अश्विन', gender: 'M', meaningTa: 'ஒளிரும் விண்மீன், வீரம்', meaningEn: 'Light, Champion, Radiant Star', meaningHi: 'तेजस्वी एवं साहसी', startingLetter: 'A' },
    { nameTa: 'ஆதித்யா', nameEn: 'Aditya', nameHi: 'आदित्य', gender: 'M', meaningTa: 'சூரியன், ஒளி பொருந்தியவன்', meaningEn: 'Sun God, Brilliant, Luminous', meaningHi: 'सूर्य देव एवं प्रकाशवान', startingLetter: 'A' },
    { nameTa: 'அனன்யா', nameEn: 'Ananya', nameHi: 'अनन्या', gender: 'F', meaningTa: 'ஒப்பற்றவள், நிகரற்றவள்', meaningEn: 'Unique, Matchless, Goddess Parvati', meaningHi: 'अतुलनीय एवं विशिष्ट', startingLetter: 'A' },
    { nameTa: 'அக்ஷரா', nameEn: 'Akshara', nameHi: 'अक्षरा', gender: 'F', meaningTa: 'அழிவற்றவள், சரஸ்வதி தேவி', meaningEn: 'Imperishable, Goddess Saraswati', meaningHi: 'अविनाशी एवं ज्ञानमयी', startingLetter: 'A' }
  ],
  'I / Ee': [
    { nameTa: 'இளமாறன்', nameEn: 'Ilamaran', nameHi: 'इलमारन', gender: 'M', meaningTa: 'இளமையான வீரன்', meaningEn: 'Youthful Valiant Warrior', meaningHi: 'युवा शूरवीर', startingLetter: 'I / Ee' },
    { nameTa: 'ஈஸ்வரன்', nameEn: 'Ishwaran', nameHi: 'ईश्वरन', gender: 'M', meaningTa: 'சிவபெருமான், முழுமுதற்கடவுள்', meaningEn: 'Supreme Lord Shiva', meaningHi: 'परमेश्वर शिव', startingLetter: 'I / Ee' },
    { nameTa: 'இனியவள்', nameEn: 'Iniyaval', nameHi: 'इनियवल', gender: 'F', meaningTa: 'இனிமையான குணம் கொண்டவள்', meaningEn: 'Sweet-natured, Pleasant', meaningHi: 'मधुर स्वभाव वाली', startingLetter: 'I / Ee' },
    { nameTa: 'ஈஸ்வரி', nameEn: 'Ishwari', nameHi: 'ईश्वरी', gender: 'F', meaningTa: 'பார்வதி தேவி, சக்தி', meaningEn: 'Goddess Parvati, Divine Ruler', meaningHi: 'मां जगदंबा', startingLetter: 'I / Ee' }
  ],
  'U / Oo': [
    { nameTa: 'உதயகுமார்', nameEn: 'Udhayakumar', nameHi: 'उदयकुमार', gender: 'M', meaningTa: 'சூரிய உதயத்தின் ஒளி', meaningEn: 'Rising Sun, Dawn, Luminous', meaningHi: 'उदीयमान सूर्य', startingLetter: 'U / Oo' },
    { nameTa: 'உத்தமன்', nameEn: 'Uthaman', nameHi: 'उत्तम', gender: 'M', meaningTa: 'சிறந்த பண்பாளர்', meaningEn: 'Noble, Supreme, Virtuous', meaningHi: 'श्रेष्ठ चरित्रवान', startingLetter: 'U / Oo' },
    { nameTa: 'உமாமகேஸ்வரி', nameEn: 'Umamaheshwari', nameHi: 'उमामहेश्वरी', gender: 'F', meaningTa: 'உமா தேவி, பராசக்தி', meaningEn: 'Goddess Parvati, Divine Mother', meaningHi: 'मां उमा', startingLetter: 'U / Oo' },
    { nameTa: 'உதயா', nameEn: 'Udhaya', nameHi: 'उदया', gender: 'F', meaningTa: 'விடியல், புதிய தொடக்கம்', meaningEn: 'Dawn, New Awakening, Prosperity', meaningHi: 'सूर्योदय की बेला', startingLetter: 'U / Oo' }
  ],
  'E / Ae': [
    { nameTa: 'ஏகாம்பரநாதன்', nameEn: 'Ekambaranathan', nameHi: 'एकांबरनाथ', gender: 'M', meaningTa: 'காஞ்சி சிவபெருமான்', meaningEn: 'Lord Shiva of Kanchi', meaningHi: 'भगवान शिव', startingLetter: 'E / Ae' },
    { nameTa: 'எழிலரசன்', nameEn: 'Ezhilarasan', nameHi: 'एझिलरसन', gender: 'M', meaningTa: 'அழகுக்கு அரசன்', meaningEn: 'King of Elegance and Grace', meaningHi: 'सौंदर्यवान नरेश', startingLetter: 'E / Ae' },
    { nameTa: 'எழிலரசி', nameEn: 'Ezhilarasi', nameHi: 'एझिलरसी', gender: 'F', meaningTa: 'பேரழகி, நற்பண்பின் ராணி', meaningEn: 'Queen of Beauty and Grace', meaningHi: 'सौंदर्य की रानी', startingLetter: 'E / Ae' },
    { nameTa: 'ஏகதா', nameEn: 'Ekathey', nameHi: 'एकता', gender: 'F', meaningTa: 'ஒற்றுமை, முழுமை', meaningEn: 'Unity, Harmony, Completeness', meaningHi: 'एकता एवं सौहार्द', startingLetter: 'E / Ae' }
  ],

  // Rohini
  'O': [
    { nameTa: 'ஓம்கார்', nameEn: 'Omkar', nameHi: 'ओंकार', gender: 'M', meaningTa: 'பிரணவ மந்திர வடிவம், கடவுள்', meaningEn: 'Sound of the Sacred Om', meaningHi: 'प्रणव स्वरूप ओंकार', startingLetter: 'O' },
    { nameTa: 'ஓஜஸ்வி', nameEn: 'Ojasvi', nameHi: 'ओजस्वी', gender: 'M', meaningTa: 'ஆற்றல் மற்றும் தேஜஸ் நிறைந்தவன்', meaningEn: 'Lustrous, Energetic, Radiant', meaningHi: 'तेजस्वी एवं पराक्रमी', startingLetter: 'O' },
    { nameTa: 'ஓவியா', nameEn: 'Oviya', nameHi: 'ओविया', gender: 'F', meaningTa: 'அழகிய ஓவியம் போன்றவள்', meaningEn: 'Beautiful Painting, Artistic Grace', meaningHi: 'सुंदर चित्र जैसी', startingLetter: 'O' },
    { nameTa: 'ஓம்சக்தி', nameEn: 'Omshakthi', nameHi: 'ओमशक्ति', gender: 'F', meaningTa: 'தெய்வீக சக்தி வடிவம்', meaningEn: 'Divine Cosmic Energy', meaningHi: 'दिव्य ऊर्जा', startingLetter: 'O' }
  ],
  'Vaa': [
    { nameTa: 'வருண்', nameEn: 'Varun', nameHi: 'वरुण', gender: 'M', meaningTa: 'வருண பகவான், நீர் அதிபதி', meaningEn: 'Lord of Waters and Cosmos', meaningHi: 'वरुण देव', startingLetter: 'Vaa' },
    { nameTa: 'வாசுதேவன்', nameEn: 'Vasudevan', nameHi: 'वासुदेव', gender: 'M', meaningTa: 'மகாவிஷ்ணு, கிருஷ்ணர்', meaningEn: 'Lord Krishna, Omnipresent', meaningHi: 'भगवान श्री कृष्ण', startingLetter: 'Vaa' },
    { nameTa: 'வர்ஷினி', nameEn: 'Varshini', nameHi: 'वर्षिणी', gender: 'F', meaningTa: 'அன்பு மழை பொழிபவள்', meaningEn: 'Bringer of Rain, Love and Grace', meaningHi: 'कृपामयी एवं सुखद', startingLetter: 'Vaa' },
    { nameTa: 'வாசுகி', nameEn: 'Vasuki', nameHi: 'वासुकी', gender: 'F', meaningTa: 'புனிதமான நாகதேவதை', meaningEn: 'Sacred Serpent, Auspicious Goddess', meaningHi: 'पवित्र देवी', startingLetter: 'Vaa' }
  ],
  'Vee / Vi': [
    { nameTa: 'விக்னேஷ்', nameEn: 'Vignesh', nameHi: 'विघ्नेश', gender: 'M', meaningTa: 'தடைகளை நீக்கும் விநாயகர்', meaningEn: 'Lord Ganesha, Remover of Obstacles', meaningHi: 'विघ्नहर्ता गणेश', startingLetter: 'Vee / Vi' },
    { nameTa: 'விஜயன்', nameEn: 'Vijayan', nameHi: 'विजय', gender: 'M', meaningTa: 'எப்போதும் வெற்றி பெறுபவன்', meaningEn: 'Victorious, Champion', meaningHi: 'सदा विजयी', startingLetter: 'Vee / Vi' },
    { nameTa: 'வித்யா', nameEn: 'Vidya', nameHi: 'विद्या', gender: 'F', meaningTa: 'சரஸ்வதி தேவி, ஞானம்', meaningEn: 'Knowledge, Wisdom, Saraswati', meaningHi: 'ज्ञान की देवी', startingLetter: 'Vee / Vi' },
    { nameTa: 'வினோதினி', nameEn: 'Vinodhini', nameHi: 'विनोदिनी', gender: 'F', meaningTa: 'மகிழ்ச்சி தருபவள்', meaningEn: 'Joyful, Delightful Goddess', meaningHi: 'आनंददायिनी', startingLetter: 'Vee / Vi' }
  ],
  'Vu / Woo': [
    { nameTa: 'வுஜிதன்', nameEn: 'Vujithan', nameHi: 'वुजितन', gender: 'M', meaningTa: 'வெற்றி வீரன்', meaningEn: 'Victorious, Glorious', meaningHi: 'विजयी वीर', startingLetter: 'Vu / Woo' },
    { nameTa: 'வுரந்தன்', nameEn: 'Vurandhan', nameHi: 'वुरंधन', gender: 'M', meaningTa: 'துளசி மாலையணிந்த விஷ்ணு', meaningEn: 'Lord Vishnu, Sacred', meaningHi: 'पवित्र विष्णु', startingLetter: 'Vu / Woo' },
    { nameTa: 'வுருந்தா', nameEn: 'Vrundha', nameHi: 'वृंदा', gender: 'F', meaningTa: 'துளசி தேவி, பக்தி', meaningEn: 'Holy Basil, Tulsi Goddess', meaningHi: 'तुलसी देवी', startingLetter: 'Vu / Woo' },
    { nameTa: 'வுஷானா', nameEn: 'Vushana', nameHi: 'वुशाना', gender: 'F', meaningTa: 'அழகிய பிரகாசம்', meaningEn: 'Brilliant Light, Charming', meaningHi: 'सुंदर प्रकाश', startingLetter: 'Vu / Woo' }
  ],

  // Mrigashirsha
  'Ve / Way': [
    { nameTa: 'வேலன்', nameEn: 'Velan', nameHi: 'वेलन', gender: 'M', meaningTa: 'வேல் ஏந்திய முருகப்பெருமான்', meaningEn: 'Lord Murugan with Divine Spear', meaningHi: 'भगवान मुरुगन', startingLetter: 'Ve / Way' },
    { nameTa: 'வேதாந்தன்', nameEn: 'Vedhanthan', nameHi: 'वेदांत', gender: 'M', meaningTa: 'வேதங்களின் சாரம்', meaningEn: 'Essence of Vedic Wisdom', meaningHi: 'वेदों का सार', startingLetter: 'Ve / Way' },
    { nameTa: 'வேதிகா', nameEn: 'Vedhika', nameHi: 'वेदिका', gender: 'F', meaningTa: 'புனித வேதிகை, சரஸ்வதி', meaningEn: 'Sacred Altar, Consciousness', meaningHi: 'पवित्र वेदी, ज्ञान', startingLetter: 'Ve / Way' },
    { nameTa: 'வேதவள்ளி', nameEn: 'Vedhavalli', nameHi: 'वेदवल्ली', gender: 'F', meaningTa: 'வேதங்களின் நாயகி, லட்சுமி', meaningEn: 'Goddess Lakshmi of Vedas', meaningHi: 'लक्ष्मी देवी', startingLetter: 'Ve / Way' }
  ],
  'Vo / Woh': [
    { nameTa: 'வோங்காரம்', nameEn: 'Vomkaram', nameHi: 'ओंकारम', gender: 'M', meaningTa: 'பிரணவ உருவம்', meaningEn: 'Divine Om Vibration', meaningHi: 'प्रणव ब्रह्म', startingLetter: 'Vo / Woh' },
    { nameTa: 'வோஷ்வந்த்', nameEn: 'Voshwanth', nameHi: 'वोशवंत', gender: 'M', meaningTa: 'புகழ் பெற்றவன்', meaningEn: 'Renowned, Auspicious', meaningHi: 'यशस्वी', startingLetter: 'Vo / Woh' },
    { nameTa: 'வோனிகா', nameEn: 'Vonika', nameHi: 'वोनिका', gender: 'F', meaningTa: 'அன்பான நிலவு', meaningEn: 'Affectionate, Radiant', meaningHi: 'स्नेहमयी', startingLetter: 'Vo / Woh' },
    { nameTa: 'வோஷிகா', nameEn: 'Voshika', nameHi: 'वोशिका', gender: 'F', meaningTa: 'மங்கள மலர்', meaningEn: 'Auspicious Flower', meaningHi: 'शुभ पुष्प', startingLetter: 'Vo / Woh' }
  ],
  'Kaa': [
    { nameTa: 'கார்த்திகேயன்', nameEn: 'Karthikeyan', nameHi: 'कार्तिकेय', gender: 'M', meaningTa: 'முருகப்பெருமான், வெற்றி வீரன்', meaningEn: 'Lord Murugan, Courageous Leader', meaningHi: 'भगवान कार्तिकेय', startingLetter: 'Kaa' },
    { nameTa: 'கமலேஷ்', nameEn: 'Kamalesh', nameHi: 'कमलेश', gender: 'M', meaningTa: 'தாமரைக் கண்ணன், விஷ்ணு', meaningEn: 'Lord Vishnu, Lotus Eyed', meaningHi: 'कमल नयन विष्णु', startingLetter: 'Kaa' },
    { nameTa: 'காவ்யா', nameEn: 'Kavya', nameHi: 'काव्या', gender: 'F', meaningTa: 'அழகிய கவிதை, சரஸ்வதி', meaningEn: 'Poetry, Art, Goddess Saraswati', meaningHi: 'कविता एवं सरस्वती', startingLetter: 'Kaa' },
    { nameTa: 'காமினி', nameEn: 'Kamini', nameHi: 'कामिनी', gender: 'F', meaningTa: 'அன்பும் அழகும் நிறைந்தவள்', meaningEn: 'Desirable, Beautiful and Loving', meaningHi: 'सुंदर एवं स्नेहयुक्त', startingLetter: 'Kaa' }
  ],
  'Kee / Ki': [
    { nameTa: 'கீர்த்தனன்', nameEn: 'Keerthanan', nameHi: 'कीर्तन', gender: 'M', meaningTa: 'இறைவனின் புகழ் பாடுபவன்', meaningEn: 'Divine Praise, Melodious Song', meaningHi: 'भजन एवं स्तुति', startingLetter: 'Kee / Ki' },
    { nameTa: 'கிரண்', nameEn: 'Kiran', nameHi: 'किरण', gender: 'M', meaningTa: 'சூரிய ஒளிக்கதிர்', meaningEn: 'Ray of Sun, Luminous', meaningHi: 'सूर्य की किरण', startingLetter: 'Kee / Ki' },
    { nameTa: 'கீர்த்தி', nameEn: 'Keerthi', nameHi: 'कीर्ति', gender: 'F', meaningTa: 'புகழ், கீர்த்தி தேவி', meaningEn: 'Fame, Glory, Auspiciousness', meaningHi: 'यश एवं प्रतिष्ठा', startingLetter: 'Kee / Ki' },
    { nameTa: 'கிருத்திகா', nameEn: 'Kiruthika', nameHi: 'कृतिका', gender: 'F', meaningTa: 'ஒளிரும் விண்மீன் கூட்டங்கள்', meaningEn: 'Pleiades Star Cluster, Radiance', meaningHi: 'तेजस्वी नक्षत्र', startingLetter: 'Kee / Ki' }
  ],

  // Arudra
  'Ku / Koo': [
    { nameTa: 'குமரவேல்', nameEn: 'Kumaravel', nameHi: 'कुमारवेल', gender: 'M', meaningTa: 'முருகப்பெருமான், என்றும் இளமை', meaningEn: 'Ever Youthful Lord Murugan', meaningHi: 'भगवान कार्तिकेय', startingLetter: 'Ku / Koo' },
    { nameTa: 'குலசேகரன்', nameEn: 'Kulasekaran', nameHi: 'कुलशेखर', gender: 'M', meaningTa: 'குலத்தின் மணிமகுடம்', meaningEn: 'Crest Jewel of the Dynasty', meaningHi: 'कुल का गौरव', startingLetter: 'Ku / Koo' },
    { nameTa: 'குமுதவல்லி', nameEn: 'Kumudhavalli', nameHi: 'कुमुदवल्ली', gender: 'F', meaningTa: 'தாமரை போன்ற அழகி, லக்ஷ்மி', meaningEn: 'Lotus-like Goddess Lakshmi', meaningHi: 'कमल सदृश लक्ष्मी', startingLetter: 'Ku / Koo' },
    { nameTa: 'குணவதி', nameEn: 'Gunavathi', nameHi: 'गुणवती', gender: 'F', meaningTa: 'சகல நற்குணங்களும் நிறைந்தவள்', meaningEn: 'Full of Virtues and Grace', meaningHi: 'सद्गुणों से संपन्न', startingLetter: 'Ku / Koo' }
  ],
  'Gha / Kha': [
    { nameTa: 'கனசியாமம்', nameEn: 'Ghanashyam', nameHi: 'घनश्याम', gender: 'M', meaningTa: 'நீல மேக வண்ணன், கிருஷ்ணர்', meaningEn: 'Lord Krishna, Cloud-hued', meaningHi: 'घनश्याम कृष्ण', startingLetter: 'Gha / Kha' },
    { nameTa: 'கஜேந்திரன்', nameEn: 'Gajendran', nameHi: 'गजेंद्र', gender: 'M', meaningTa: 'கருட பகவான், விஷ்ணு வாகனம்', meaningEn: 'King of Birds, Garuda', meaningHi: 'गरुड़ देव', startingLetter: 'Gha / Kha' },
    { nameTa: 'கயல்விழி', nameEn: 'Kayalvizhi', nameHi: 'कयल्विलि', gender: 'F', meaningTa: 'நறுமணம் பொங்கும் மலர்', meaningEn: 'Sweet Fragrance, Joy', meaningHi: 'सुगंध एवं उल्लास', startingLetter: 'Gha / Kha' },
    { nameTa: 'கனகாம்பரி', nameEn: 'Kanakambari', nameHi: 'कनकांबरी', gender: 'F', meaningTa: 'பொன்னிற ஆடை தரித்த அம்மன்', meaningEn: 'Goddess in Golden Robes', meaningHi: 'स्वर्णमयी देवी', startingLetter: 'Gha / Kha' }
  ],
  'Inga / Nga': [
    { nameTa: 'ஞானப்பிரகாஷ்', nameEn: 'Gnanaprakash', nameHi: 'ज्ञानप्रकाश', gender: 'M', meaningTa: 'மெய்ஞான ஒளி', meaningEn: 'Light of Divine Knowledge', meaningHi: 'दिव्य ज्ञान का प्रकाश', startingLetter: 'Inga / Nga' },
    { nameTa: 'ஞானசேகரன்', nameEn: 'Gnanasekaran', nameHi: 'ज्ञानशेखर', gender: 'M', meaningTa: 'அறிவின் சிகரம்', meaningEn: 'Pinnacle of Wisdom', meaningHi: 'ज्ञान के शिखर', startingLetter: 'Inga / Nga' },
    { nameTa: 'ஞானவல்லி', nameEn: 'Gnanavalli', nameHi: 'ज्ञानवल्ली', gender: 'F', meaningTa: 'சரஸ்வதி தேவி, ஞான லக்ஷ்மி', meaningEn: 'Goddess of Knowledge', meaningHi: 'ज्ञान की अधिष्ठात्री', startingLetter: 'Inga / Nga' },
    { nameTa: 'ஞானதீபா', nameEn: 'Gnanadeepa', nameHi: 'ज्ञानदीपा', gender: 'F', meaningTa: 'அறிவுச்சுடர் விளக்கு', meaningEn: 'Lamp of Wisdom', meaningHi: 'ज्ञान का दीपक', startingLetter: 'Inga / Nga' }
  ],
  'Cha / Chha': [
    { nameTa: 'சந்திரசேகர்', nameEn: 'Chandrashekar', nameHi: 'चंद्रशेखर', gender: 'M', meaningTa: 'சந்திரனை தலையில் சூடிய சிவன்', meaningEn: 'Lord Shiva adorned with Crescent', meaningHi: 'चंद्रशेखर शिव', startingLetter: 'Cha / Chha' },
    { nameTa: 'சரவணன்', nameEn: 'Saravanan', nameHi: 'सरवणन', gender: 'M', meaningTa: 'சரவணப் பொய்கையில் உதித்த முருகன்', meaningEn: 'Lord Murugan born in Saravana', meaningHi: 'भगवान मुरुगन', startingLetter: 'Cha / Chha' },
    { nameTa: 'சந்தியா', nameEn: 'Sandhya', nameHi: 'संध्या', gender: 'F', meaningTa: 'மங்கள சந்தி வேளை, துர்க்கை', meaningEn: 'Twilight Grace, Sacred Prayer', meaningHi: 'संध्या बेला एवं दुर्गा', startingLetter: 'Cha / Chha' },
    { nameTa: 'சாரதா', nameEn: 'Sharada', nameHi: 'शारदा', gender: 'F', meaningTa: 'கலைமகள், சரஸ்வதி', meaningEn: 'Goddess Saraswati of Arts', meaningHi: 'मां शारदा', startingLetter: 'Cha / Chha' }
  ],

  // Punarvasu
  'Ke / Kay': [
    { nameTa: 'கேசவன்', nameEn: 'Keshavan', nameHi: 'केशव', gender: 'M', meaningTa: 'மகாவிஷ்ணு, கேசியை வதைத்தவன்', meaningEn: 'Lord Krishna / Vishnu, Radiant Hair', meaningHi: 'भगवान कृष्ण', startingLetter: 'Ke / Kay' },
    { nameTa: 'கேதாரநாதன்', nameEn: 'Kedharanathan', nameHi: 'केदारनाथ', gender: 'M', meaningTa: 'இமயமலை சிவபெருமான்', meaningEn: 'Lord Shiva of Kedarnath', meaningHi: 'भगवान शिव', startingLetter: 'Ke / Kay' },
    { nameTa: 'கேத்தனா', nameEn: 'Kethana', nameHi: 'केतना', gender: 'F', meaningTa: 'கொடி, மங்கள அடையாளம்', meaningEn: 'Pure Sign, Banner of Victory', meaningHi: 'ध्वज एवं शुभ चिह्न', startingLetter: 'Ke / Kay' },
    { nameTa: 'கேசவப்பிரியா', nameEn: 'Keshavapriya', nameHi: 'केशवप्रिया', gender: 'F', meaningTa: 'விஷ்ணுவின் அன்பிற்குரிய லட்சுமி', meaningEn: 'Beloved of Lord Keshav, Lakshmi', meaningHi: 'लक्ष्मी जी', startingLetter: 'Ke / Kay' }
  ],
  'Ko / Koh': [
    { nameTa: 'கோவிந்தன்', nameEn: 'Govindan', nameHi: 'गोविंद', gender: 'M', meaningTa: 'பசுக்களை காக்கும் கிருஷ்ணர்', meaningEn: 'Lord Krishna, Protector of Beings', meaningHi: 'भगवान गोविंद', startingLetter: 'Ko / Koh' },
    { nameTa: 'கோபாலன்', nameEn: 'Gopalan', nameHi: 'गोपाल', gender: 'M', meaningTa: 'அன்பு மேய்ப்பன், கிருஷ்ணன்', meaningEn: 'Lord Krishna, Divine Cowherd', meaningHi: 'बाल गोपाल', startingLetter: 'Ko / Koh' },
    { nameTa: 'கோமளவல்லி', nameEn: 'Komalavalli', nameHi: 'कोमलवल्ली', gender: 'F', meaningTa: 'மென்மையான லக்ஷ்மி தேவி', meaningEn: 'Tender Goddess Lakshmi', meaningHi: 'कोमल लक्ष्मी रूप', startingLetter: 'Ko / Koh' },
    { nameTa: 'கோகிலா', nameEn: 'Kokila', nameHi: 'कोकिला', gender: 'F', meaningTa: 'குயில், இனிமையான குரல்', meaningEn: 'Sweet Nightingale, Melodious', meaningHi: 'मधुर वाणी', startingLetter: 'Ko / Koh' }
  ],
  'Haa': [
    { nameTa: 'ஹரிஹரன்', nameEn: 'Hariharan', nameHi: 'हरिहर', gender: 'M', meaningTa: 'சிவனும் விஷ்ணுவும் சேர்ந்த சங்கமம்', meaningEn: 'Fusion of Lord Vishnu and Shiva', meaningHi: 'हरि एवं हर का रूप', startingLetter: 'Haa' },
    { nameTa: 'ஹரீஷ்', nameEn: 'Haresh', nameHi: 'हरीश', gender: 'M', meaningTa: 'சிவபெருமான், விஷ்ணு', meaningEn: 'Lord Shiva / Vishnu', meaningHi: 'भगवान शिव/विष्णु', startingLetter: 'Haa' },
    { nameTa: 'ஹரிணி', nameEn: 'Harini', nameHi: 'हरिणी', gender: 'F', meaningTa: 'மான் போன்ற மருண்ட அழகிய கண்கள்', meaningEn: 'Doe-eyed, Goddess Lakshmi', meaningHi: 'मृगनयनी लक्ष्मी', startingLetter: 'Haa' },
    { nameTa: 'ஹாசினி', nameEn: 'Haasini', nameHi: 'हासिनी', gender: 'F', meaningTa: 'எப்போதும் புன்னகை பூக்கும் முகம்', meaningEn: 'Cheerful, Laughter and Bliss', meaningHi: 'सदा मुस्कुराने वाली', startingLetter: 'Haa' }
  ],
  'Hee / Hi': [
    { nameTa: 'ஹீமந்த்', nameEn: 'Hemant', nameHi: 'हेमंत', gender: 'M', meaningTa: 'பனிப்பருவம், பொன்னிற அழகு', meaningEn: 'Golden Winter Season, Calm', meaningHi: 'ऋतुराज हेमंत', startingLetter: 'Hee / Hi' },
    { nameTa: 'ஹிரண்மயன்', nameEn: 'Hiranmay', nameHi: 'हिरण्मय', gender: 'M', meaningTa: 'தங்க மயமான பேரொளி', meaningEn: 'Golden, Brilliant, Auspicious', meaningHi: 'स्वर्णमयी कांति', startingLetter: 'Hee / Hi' },
    { nameTa: 'ஹீரா', nameEn: 'Heera', nameHi: 'हीरा', gender: 'F', meaningTa: 'வைரம் போன்ற தூய்மையும் உறுதியும்', meaningEn: 'Diamond, Precious, Pure', meaningHi: 'वज्र एवं अमूल्य', startingLetter: 'Hee / Hi' },
    { nameTa: 'ஹீனா', nameEn: 'Heena', nameHi: 'हीना', gender: 'F', meaningTa: 'மங்கள நறுமணம்', meaningEn: 'Fragrance, Auspicious Henna', meaningHi: 'सुगंधित मेहंदी', startingLetter: 'Hee / Hi' }
  ],
  // Pushya
  'Hu / Hoo': [
    { nameTa: 'ஹுவனேஷ்', nameEn: 'Huvanesh', nameHi: 'हुवनेश', gender: 'M', meaningTa: 'உலகங்களின் இறைவன்', meaningEn: 'Lord of the Universe', meaningHi: 'विश्व के स्वामी', startingLetter: 'Hu / Hoo' },
    { nameTa: 'ஹுவன்', nameEn: 'Huvan', nameHi: 'हुवन', gender: 'M', meaningTa: 'உலகம், அண்டம்', meaningEn: 'World, Universe', meaningHi: 'संसार एवं जगत', startingLetter: 'Hu / Hoo' },
    { nameTa: 'ஹுமா', nameEn: 'Huma', nameHi: 'हुमा', gender: 'F', meaningTa: 'அருள் நிறைந்தவள்', meaningEn: 'Blessed, Graceful', meaningHi: 'कृपामयी', startingLetter: 'Hu / Hoo' },
    { nameTa: 'ஹுனர்', nameEn: 'Hunar', nameHi: 'हुनर', gender: 'F', meaningTa: 'திறமை மிக்கவள்', meaningEn: 'Talented, Skilled', meaningHi: 'प्रतिभाशाली', startingLetter: 'Hu / Hoo' }
  ],
  'He / Hay': [
    { nameTa: 'ஹேமந்த்', nameEn: 'Hemanth', nameHi: 'हेमंत', gender: 'M', meaningTa: 'பொன்னிற பருவம்', meaningEn: 'Golden Season, Calm', meaningHi: 'स्वर्णिम ऋतु', startingLetter: 'He / Hay' },
    { nameTa: 'ஹேமச்சந்திரன்', nameEn: 'Hemachandran', nameHi: 'हेमचंद्र', gender: 'M', meaningTa: 'பொன்னிற சந்திரன்', meaningEn: 'Golden Moon', meaningHi: 'स्वर्ण चंद्र', startingLetter: 'He / Hay' },
    { nameTa: 'ஹேமா', nameEn: 'Hema', nameHi: 'हेमा', gender: 'F', meaningTa: 'பொன்னிற அழகி', meaningEn: 'Golden Beauty', meaningHi: 'स्वर्णिम सौंदर्य', startingLetter: 'He / Hay' },
    { nameTa: 'ஹேமலதா', nameEn: 'Hemalatha', nameHi: 'हेमलता', gender: 'F', meaningTa: 'பொன்னிற கொடி', meaningEn: 'Golden Creeper', meaningHi: 'स्वर्ण लता', startingLetter: 'He / Hay' }
  ],
  'Ho / Hoh': [
    { nameTa: 'ஹோமேஷ்', nameEn: 'Homesh', nameHi: 'होमेश', gender: 'M', meaningTa: 'யாக அக்கினியின் இறைவன்', meaningEn: 'Lord of Sacred Fire', meaningHi: 'यज्ञाग्नि के स्वामी', startingLetter: 'Ho / Hoh' },
    { nameTa: 'ஹோஷியார்', nameEn: 'Hoshiar', nameHi: 'होशियार', gender: 'M', meaningTa: 'புத்திசாலி', meaningEn: 'Intelligent, Clever', meaningHi: 'बुद्धिमान', startingLetter: 'Ho / Hoh' },
    { nameTa: 'ஹோமா', nameEn: 'Homa', nameHi: 'होमा', gender: 'F', meaningTa: 'புனித யாகத் தீ', meaningEn: 'Sacred Ritual Fire', meaningHi: 'पवित्र हवन', startingLetter: 'Ho / Hoh' },
    { nameTa: 'ஹோஷ்னா', nameEn: 'Hoshna', nameHi: 'होशना', gender: 'F', meaningTa: 'மகிழ்ச்சி நிறைந்தவள்', meaningEn: 'Joyful, Cheerful', meaningHi: 'प्रसन्नचित्त', startingLetter: 'Ho / Hoh' }
  ],
  'Daa': [
    { nameTa: 'தானேஷ்', nameEn: 'Daanesh', nameHi: 'दानेश', gender: 'M', meaningTa: 'தானத்தின் இறைவன்', meaningEn: 'Lord of Charity', meaningHi: 'दान के स्वामी', startingLetter: 'Daa' },
    { nameTa: 'தானிஷ்', nameEn: 'Daanish', nameHi: 'दानिश', gender: 'M', meaningTa: 'அறிவாளி', meaningEn: 'Knowledgeable, Wise', meaningHi: 'ज्ञानी', startingLetter: 'Daa' },
    { nameTa: 'தாட்சாயணி', nameEn: 'Daakshayani', nameHi: 'दाक्षायणी', gender: 'F', meaningTa: 'தட்சனின் மகள், பார்வதி', meaningEn: 'Daughter of Daksha, Parvati', meaningHi: 'दक्ष पुत्री पार्वती', startingLetter: 'Daa' },
    { nameTa: 'தாமினி', nameEn: 'Daamini', nameHi: 'दामिनी', gender: 'F', meaningTa: 'மின்னல் கொடி', meaningEn: 'Lightning, Radiant', meaningHi: 'विद्युत प्रभा', startingLetter: 'Daa' }
  ],

  // Ashlesha
  'Dee / Di': [
    { nameTa: 'தினேஷ்', nameEn: 'Dinesh', nameHi: 'दिनेश', gender: 'M', meaningTa: 'சூரியன், பகலின் இறைவன்', meaningEn: 'Lord of the Day, Sun', meaningHi: 'सूर्य देव', startingLetter: 'Dee / Di' },
    { nameTa: 'திலீப்', nameEn: 'Dilip', nameHi: 'दिलीप', gender: 'M', meaningTa: 'மன்னன், காப்பவன்', meaningEn: 'King, Protector', meaningHi: 'महाराजा', startingLetter: 'Dee / Di' },
    { nameTa: 'திவ்யா', nameEn: 'Divya', nameHi: 'दिव्या', gender: 'F', meaningTa: 'தெய்வீக ஒளி', meaningEn: 'Divine Radiance', meaningHi: 'दिव्य प्रभा', startingLetter: 'Dee / Di' },
    { nameTa: 'தீபிகா', nameEn: 'Deepika', nameHi: 'दीपिका', gender: 'F', meaningTa: 'ஒளி விளக்கு', meaningEn: 'Lamp of Light', meaningHi: 'प्रकाश स्तंभ', startingLetter: 'Dee / Di' }
  ],
  'Doo / Du': [
    { nameTa: 'துர்காதாஸ்', nameEn: 'Durgadas', nameHi: 'दुर्गादास', gender: 'M', meaningTa: 'துர்க்கையின் அடியவன்', meaningEn: 'Devotee of Durga', meaningHi: 'दुर्गा भक्त', startingLetter: 'Doo / Du' },
    { nameTa: 'துரை', nameEn: 'Durai', nameHi: 'दुरै', gender: 'M', meaningTa: 'தலைவன், இறைவன்', meaningEn: 'Lord, Master', meaningHi: 'स्वामी', startingLetter: 'Doo / Du' },
    { nameTa: 'துர்கா', nameEn: 'Durga', nameHi: 'दुर्गा', gender: 'F', meaningTa: 'சக்தி தேவி', meaningEn: 'Goddess of Power', meaningHi: 'शक्ति स्वरूपा', startingLetter: 'Doo / Du' },
    { nameTa: 'துலாரி', nameEn: 'Dulari', nameHi: 'दुलारी', gender: 'F', meaningTa: 'அன்பிற்குரியவள்', meaningEn: 'Beloved, Dear', meaningHi: 'प्रिय स्नेहमयी', startingLetter: 'Doo / Du' }
  ],
  'De / Day': [
    { nameTa: 'தேவன்', nameEn: 'Devan', nameHi: 'देवन', gender: 'M', meaningTa: 'தெய்வீகன்', meaningEn: 'Divine, Godly', meaningHi: 'दिव्य पुरुष', startingLetter: 'De / Day' },
    { nameTa: 'தேவேந்திரன்', nameEn: 'Devendra', nameHi: 'देवेंद्र', gender: 'M', meaningTa: 'தேவர்களின் அரசன்', meaningEn: 'King of Gods, Indra', meaningHi: 'देवराज इंद्र', startingLetter: 'De / Day' },
    { nameTa: 'தேவி', nameEn: 'Devi', nameHi: 'देवी', gender: 'F', meaningTa: 'தெய்வீக அன்னை', meaningEn: 'Divine Goddess', meaningHi: 'दिव्य देवी', startingLetter: 'De / Day' },
    { nameTa: 'தேவிகா', nameEn: 'Devika', nameHi: 'देविका', gender: 'F', meaningTa: 'சிறு தேவி', meaningEn: 'Little Goddess', meaningHi: 'लघु देवी', startingLetter: 'De / Day' }
  ],
  'Do / Doh': [
    { nameTa: 'தொண்டன்', nameEn: 'Thondan', nameHi: 'थोंडन', gender: 'M', meaningTa: 'இறை அடியவன்', meaningEn: 'Humble Devotee', meaningHi: 'विनम्र भक्त', startingLetter: 'Do / Doh' },
    { nameTa: 'தொண்டைமான்', nameEn: 'Thondaiman', nameHi: 'थोंडैमान', gender: 'M', meaningTa: 'புகழ்மிகு மன்னன்', meaningEn: 'Renowned Chieftain', meaningHi: 'प्रसिद्ध नायक', startingLetter: 'Do / Doh' },
    { nameTa: 'தோகை', nameEn: 'Thogai', nameHi: 'थोगै', gender: 'F', meaningTa: 'மயில் தோகை', meaningEn: 'Peacock Plume', meaningHi: 'मयूर पंख', startingLetter: 'Do / Doh' },
    { nameTa: 'தோழி', nameEn: 'Thozhi', nameHi: 'थोली', gender: 'F', meaningTa: 'உயிர்த் தோழி', meaningEn: 'Dear Friend', meaningHi: 'प्रिय सखी', startingLetter: 'Do / Doh' }
  ],

  // Magha
  'Maa': [
    { nameTa: 'மாதவன்', nameEn: 'Madhavan', nameHi: 'माधव', gender: 'M', meaningTa: 'கிருஷ்ணர், விஷ்ணு', meaningEn: 'Lord Krishna, Vishnu', meaningHi: 'भगवान कृष्ण', startingLetter: 'Maa' },
    { nameTa: 'மாறன்', nameEn: 'Maran', nameHi: 'मारन', gender: 'M', meaningTa: 'மன்மதன், வீரன்', meaningEn: 'Cupid, Brave Warrior', meaningHi: 'वीर योद्धा', startingLetter: 'Maa' },
    { nameTa: 'மாதவி', nameEn: 'Madhavi', nameHi: 'माधवी', gender: 'F', meaningTa: 'வசந்த காலம்', meaningEn: 'Springtime, Sweet', meaningHi: 'वसंत ऋतु', startingLetter: 'Maa' },
    { nameTa: 'மாலதி', nameEn: 'Malathi', nameHi: 'मालती', gender: 'F', meaningTa: 'மல்லிகை மலர்', meaningEn: 'Jasmine Flower', meaningHi: 'चमेली पुष्प', startingLetter: 'Maa' }
  ],
  'Mee / Mi': [
    { nameTa: 'மித்ரன்', nameEn: 'Mithran', nameHi: 'मित्र', gender: 'M', meaningTa: 'உற்ற நண்பன்', meaningEn: 'True Friend', meaningHi: 'सच्चा मित्र', startingLetter: 'Mee / Mi' },
    { nameTa: 'மிஹிர்', nameEn: 'Mihir', nameHi: 'मिहिर', gender: 'M', meaningTa: 'சூரியன்', meaningEn: 'Sun, Radiant', meaningHi: 'सूर्य', startingLetter: 'Mee / Mi' },
    { nameTa: 'மித்ரா', nameEn: 'Mithra', nameHi: 'मित्रा', gender: 'F', meaningTa: 'நட்பின் தேவதை', meaningEn: 'Goddess of Friendship', meaningHi: 'मित्रता की देवी', startingLetter: 'Mee / Mi' },
    { nameTa: 'மீரா', nameEn: 'Meera', nameHi: 'मीरा', gender: 'F', meaningTa: 'கிருஷ்ண பக்தை', meaningEn: 'Devotee of Krishna', meaningHi: 'कृष्ण भक्त मीरा', startingLetter: 'Mee / Mi' }
  ],
  'Moo / Mu': [
    { nameTa: 'முருகன்', nameEn: 'Murugan', nameHi: 'मुरुगन', gender: 'M', meaningTa: 'அழகன், முருகக் கடவுள்', meaningEn: 'Lord Murugan, Ever Youthful', meaningHi: 'भगवान मुरुगन', startingLetter: 'Moo / Mu' },
    { nameTa: 'முத்து', nameEn: 'Muthu', nameHi: 'मुत्तु', gender: 'M', meaningTa: 'விலைமதிப்பற்ற முத்து', meaningEn: 'Precious Pearl', meaningHi: 'अमूल्य मोती', startingLetter: 'Moo / Mu' },
    { nameTa: 'முத்துலட்சுமி', nameEn: 'Muthulakshmi', nameHi: 'मुत्तुलक्ष्मी', gender: 'F', meaningTa: 'முத்துப் போன்ற லட்சுமி', meaningEn: 'Pearl-like Lakshmi', meaningHi: 'मोती सदृश लक्ष्मी', startingLetter: 'Moo / Mu' },
    { nameTa: 'முனிரா', nameEn: 'Munira', nameHi: 'मुनिरा', gender: 'F', meaningTa: 'ஒளி மிக்கவள்', meaningEn: 'Luminous, Radiant', meaningHi: 'प्रकाशमयी', startingLetter: 'Moo / Mu' }
  ],
  'Me / May': [
    { nameTa: 'மேகநாத்', nameEn: 'Meghanath', nameHi: 'मेघनाथ', gender: 'M', meaningTa: 'மேகங்களின் இறைவன்', meaningEn: 'Lord of Clouds', meaningHi: 'मेघों के स्वामी', startingLetter: 'Me / May' },
    { nameTa: 'மேகன்', nameEn: 'Megan', nameHi: 'मेघन', gender: 'M', meaningTa: 'மேகம் போன்றவன்', meaningEn: 'Cloud-like, Generous', meaningHi: 'उदार हृदय', startingLetter: 'Me / May' },
    { nameTa: 'மேகலா', nameEn: 'Megala', nameHi: 'मेघला', gender: 'F', meaningTa: 'மேகம், ஒட்டியாணம்', meaningEn: 'Cloud, Girdle of Beauty', meaningHi: 'मेघमाला', startingLetter: 'Me / May' },
    { nameTa: 'மேகனா', nameEn: 'Meghana', nameHi: 'मेघना', gender: 'F', meaningTa: 'மேகக் கூட்டம்', meaningEn: 'Full of Clouds', meaningHi: 'मेघयुक्ता', startingLetter: 'Me / May' }
  ],

  // Purva Phalguni
  'Mo / Moh': [
    { nameTa: 'மோகன்', nameEn: 'Mohan', nameHi: 'मोहन', gender: 'M', meaningTa: 'மயக்கும் கிருஷ்ணன்', meaningEn: 'Charming Krishna', meaningHi: 'मोहन कृष्ण', startingLetter: 'Mo / Moh' },
    { nameTa: 'மோகன்தாஸ்', nameEn: 'Mohandas', nameHi: 'मोहनदास', gender: 'M', meaningTa: 'மோகனின் அடியவன்', meaningEn: 'Servant of Mohan', meaningHi: 'मोहन भक्त', startingLetter: 'Mo / Moh' },
    { nameTa: 'மோகனா', nameEn: 'Mohana', nameHi: 'मोहना', gender: 'F', meaningTa: 'மயக்கும் அழகி', meaningEn: 'Enchanting Beauty', meaningHi: 'मोहक सुंदरी', startingLetter: 'Mo / Moh' },
    { nameTa: 'மோகினி', nameEn: 'Mohini', nameHi: 'मोहिनी', gender: 'F', meaningTa: 'மாய அழகி', meaningEn: 'Enchantress', meaningHi: 'मोहिनी रूप', startingLetter: 'Mo / Moh' }
  ],
  'Taa': [
    { nameTa: 'தாருண்', nameEn: 'Tarun', nameHi: 'तारुण', gender: 'M', meaningTa: 'இளமை மிக்கவன்', meaningEn: 'Youthful, Young', meaningHi: 'युवा', startingLetter: 'Taa' },
    { nameTa: 'தாரன்', nameEn: 'Taran', nameHi: 'तारन', gender: 'M', meaningTa: 'காப்பாற்றுபவன்', meaningEn: 'Savior, Protector', meaningHi: 'तारक रक्षक', startingLetter: 'Taa' },
    { nameTa: 'தாரா', nameEn: 'Tara', nameHi: 'तारा', gender: 'F', meaningTa: 'நட்சத்திரம்', meaningEn: 'Star, Radiant', meaningHi: 'तारा', startingLetter: 'Taa' },
    { nameTa: 'தாரிணி', nameEn: 'Tarini', nameHi: 'तारिणी', gender: 'F', meaningTa: 'காப்பாற்றும் தேவி', meaningEn: 'Savior Goddess', meaningHi: 'तारिणी देवी', startingLetter: 'Taa' }
  ],
  'Tee / Ti': [
    { nameTa: 'திலக்', nameEn: 'Tilak', nameHi: 'तिलक', gender: 'M', meaningTa: 'நெற்றிப் பொட்டு, மதிப்பு', meaningEn: 'Mark of Honor', meaningHi: 'सम्मान चिह्न', startingLetter: 'Tee / Ti' },
    { nameTa: 'தினகரன்', nameEn: 'Thinakaran', nameHi: 'दिनकरन', gender: 'M', meaningTa: 'சூரியன்', meaningEn: 'Maker of Day, Sun', meaningHi: 'दिनकर सूर्य', startingLetter: 'Tee / Ti' },
    { nameTa: 'திலகா', nameEn: 'Tilaka', nameHi: 'तिलका', gender: 'F', meaningTa: 'மதிப்பின் அடையாளம்', meaningEn: 'Emblem of Honor', meaningHi: 'गौरव प्रतीक', startingLetter: 'Tee / Ti' },
    { nameTa: 'திலகவதி', nameEn: 'Thilagavathi', nameHi: 'तिलकवती', gender: 'F', meaningTa: 'சிறப்புமிகு தலைவி', meaningEn: 'Eminent Lady', meaningHi: 'प्रतिष्ठित महिला', startingLetter: 'Tee / Ti' }
  ],
  'Too / Tu': [
    { nameTa: 'துளசிதாஸ்', nameEn: 'Tulsidas', nameHi: 'तुलसीदास', gender: 'M', meaningTa: 'துளசியின் அடியவன்', meaningEn: 'Servant of Tulsi', meaningHi: 'तुलसी भक्त', startingLetter: 'Too / Tu' },
    { nameTa: 'துங்கேஷ்', nameEn: 'Tungesh', nameHi: 'तुंगेश', gender: 'M', meaningTa: 'உயர்ந்த இறைவன்', meaningEn: 'Lofty Lord', meaningHi: 'उच्च ईश्वर', startingLetter: 'Too / Tu' },
    { nameTa: 'துளசி', nameEn: 'Tulsi', nameHi: 'तुलसी', gender: 'F', meaningTa: 'புனித துளசி', meaningEn: 'Holy Basil', meaningHi: 'पवित्र तुलसी', startingLetter: 'Too / Tu' },
    { nameTa: 'துங்கா', nameEn: 'Tunga', nameHi: 'तुंगा', gender: 'F', meaningTa: 'உயர்ந்த நதி', meaningEn: 'Lofty River', meaningHi: 'उच्च नदी', startingLetter: 'Too / Tu' }
  ],

  // Uttara Phalguni
  'Te / Tay': [
    { nameTa: 'தேஜஸ்', nameEn: 'Tejas', nameHi: 'तेजस', gender: 'M', meaningTa: 'பேரொளி', meaningEn: 'Brilliance, Radiance', meaningHi: 'तेज एवं कांति', startingLetter: 'Te / Tay' },
    { nameTa: 'தென்னரசு', nameEn: 'Thennarasu', nameHi: 'तेन्नरसु', gender: 'M', meaningTa: 'தென்னாட்டு அரசன்', meaningEn: 'King of the South', meaningHi: 'दक्षिण नरेश', startingLetter: 'Te / Tay' },
    { nameTa: 'தேஜஸ்வினி', nameEn: 'Tejaswini', nameHi: 'तेजस्विनी', gender: 'F', meaningTa: 'ஒளி மிக்கவள்', meaningEn: 'Radiant Lady', meaningHi: 'तेजस्विनी', startingLetter: 'Te / Tay' },
    { nameTa: 'தேன்மொழி', nameEn: 'Thenmozhi', nameHi: 'तेनमोली', gender: 'F', meaningTa: 'தேன் போன்ற மொழி', meaningEn: 'Honey-voiced', meaningHi: 'मधुर वाणी', startingLetter: 'Te / Tay' }
  ],
  'To / Toh': [
    { nameTa: 'தோரண்', nameEn: 'Toran', nameHi: 'तोरन', gender: 'M', meaningTa: 'மங்கள தோரணம்', meaningEn: 'Festive Garland', meaningHi: 'मंगल तोरण', startingLetter: 'To / Toh' },
    { nameTa: 'தோஷித்', nameEn: 'Toshit', nameHi: 'तोशित', gender: 'M', meaningTa: 'மனநிறைவு கொண்டவன்', meaningEn: 'Contented, Pleased', meaningHi: 'संतुष्ट', startingLetter: 'To / Toh' },
    { nameTa: 'தோரல்', nameEn: 'Toral', nameHi: 'तोरल', gender: 'F', meaningTa: 'மென்மையானவள்', meaningEn: 'Soft, Tender', meaningHi: 'कोमल', startingLetter: 'To / Toh' },
    { nameTa: 'தோஷ்ணா', nameEn: 'Toshna', nameHi: 'तोष्णा', gender: 'F', meaningTa: 'மகிழ்ச்சி நிறைந்தவள்', meaningEn: 'Contented Joy', meaningHi: 'संतोषमयी', startingLetter: 'To / Toh' }
  ],
  'Paa': [
    { nameTa: 'பார்த்திபன்', nameEn: 'Parthiban', nameHi: 'पार्थिबन', gender: 'M', meaningTa: 'அர்ஜுனன், மன்னன்', meaningEn: 'Arjuna, King', meaningHi: 'अर्जुन एवं नरेश', startingLetter: 'Paa' },
    { nameTa: 'பழனி', nameEn: 'Palani', nameHi: 'पलनी', gender: 'M', meaningTa: 'முருகன் உறையும் மலை', meaningEn: 'Abode of Murugan', meaningHi: 'मुरुगन धाम', startingLetter: 'Paa' },
    { nameTa: 'பார்வதி', nameEn: 'Parvathi', nameHi: 'पार्वती', gender: 'F', meaningTa: 'மலைமகள், சக்தி', meaningEn: 'Goddess Parvati', meaningHi: 'मां पार्वती', startingLetter: 'Paa' },
    { nameTa: 'பத்மா', nameEn: 'Padma', nameHi: 'पद्मा', gender: 'F', meaningTa: 'தாமரை', meaningEn: 'Lotus', meaningHi: 'कमल', startingLetter: 'Paa' }
  ],
  'Pee / Pi': [
    { nameTa: 'பியூஷ்', nameEn: 'Piyush', nameHi: 'पियूष', gender: 'M', meaningTa: 'அமிர்தம்', meaningEn: 'Nectar, Ambrosia', meaningHi: 'अमृत', startingLetter: 'Pee / Pi' },
    { nameTa: 'பினாகி', nameEn: 'Pinaki', nameHi: 'पिनाकी', gender: 'M', meaningTa: 'சிவனின் வில்', meaningEn: 'Shiva with Pinaka Bow', meaningHi: 'पिनाकधारी शिव', startingLetter: 'Pee / Pi' },
    { nameTa: 'பியா', nameEn: 'Piya', nameHi: 'पिया', gender: 'F', meaningTa: 'அன்பிற்குரியவள்', meaningEn: 'Beloved', meaningHi: 'प्रिया', startingLetter: 'Pee / Pi' },
    { nameTa: 'பிரியா', nameEn: 'Piriya', nameHi: 'प्रिया', gender: 'F', meaningTa: 'விருப்பமானவள்', meaningEn: 'Dear, Lovable', meaningHi: 'प्यारी', startingLetter: 'Pee / Pi' }
  ],

  // Hasta
  'Poo / Pu': [
    { nameTa: 'புகழேந்தி', nameEn: 'Pughazhendi', nameHi: 'पुगलेंदी', gender: 'M', meaningTa: 'புகழ் பெற்ற மன்னன்', meaningEn: 'Famed King', meaningHi: 'यशस्वी नरेश', startingLetter: 'Poo / Pu' },
    { nameTa: 'புனித்', nameEn: 'Punit', nameHi: 'पुनीत', gender: 'M', meaningTa: 'தூயவன்', meaningEn: 'Pure, Holy', meaningHi: 'पवित्र', startingLetter: 'Poo / Pu' },
    { nameTa: 'பூங்கொடி', nameEn: 'Pungodi', nameHi: 'पूंकोडि', gender: 'F', meaningTa: 'மலர்க் கொடி', meaningEn: 'Flower Creeper', meaningHi: 'पुष्प लता', startingLetter: 'Poo / Pu' },
    { nameTa: 'பூர்ணிமா', nameEn: 'Purnima', nameHi: 'पूर्णिमा', gender: 'F', meaningTa: 'முழு நிலவு', meaningEn: 'Full Moon', meaningHi: 'पूर्णिमा', startingLetter: 'Poo / Pu' }
  ],
  'Sha': [
    { nameTa: 'ஷண்முகம்', nameEn: 'Shanmugam', nameHi: 'षण्मुगम', gender: 'M', meaningTa: 'ஆறுமுக முருகன்', meaningEn: 'Six-faced Murugan', meaningHi: 'षडानन मुरुगन', startingLetter: 'Sha' },
    { nameTa: 'ஷங்கர்', nameEn: 'Shankar', nameHi: 'शंकर', gender: 'M', meaningTa: 'நன்மை செய்யும் சிவன்', meaningEn: 'Auspicious Shiva', meaningHi: 'शुभंकर शिव', startingLetter: 'Sha' },
    { nameTa: 'ஷண்மதி', nameEn: 'Shanmathi', nameHi: 'षण्मति', gender: 'F', meaningTa: 'அறிவு மிக்கவள்', meaningEn: 'Wise, Intelligent', meaningHi: 'बुद्धिमती', startingLetter: 'Sha' },
    { nameTa: 'ஷாலினி', nameEn: 'Shalini', nameHi: 'शालिनी', gender: 'F', meaningTa: 'அடக்கமானவள்', meaningEn: 'Modest, Graceful', meaningHi: 'विनम्र', startingLetter: 'Sha' }
  ],
  'Na / Nna': [
    { nameTa: 'நாராயணன்', nameEn: 'Narayanan', nameHi: 'नारायणन', gender: 'M', meaningTa: 'மகாவிஷ்ணு', meaningEn: 'Lord Vishnu', meaningHi: 'भगवान विष्णु', startingLetter: 'Na / Nna' },
    { nameTa: 'நடராஜன்', nameEn: 'Natarajan', nameHi: 'नटराजन', gender: 'M', meaningTa: 'ஆடலரசன் சிவன்', meaningEn: 'Cosmic Dancer Shiva', meaningHi: 'नटराज शिव', startingLetter: 'Na / Nna' },
    { nameTa: 'நளினி', nameEn: 'Nalini', nameHi: 'नलिनी', gender: 'F', meaningTa: 'தாமரைக் குளம்', meaningEn: 'Lotus Pond', meaningHi: 'कमल सरोवर', startingLetter: 'Na / Nna' },
    { nameTa: 'நர்மதா', nameEn: 'Narmada', nameHi: 'नर्मदा', gender: 'F', meaningTa: 'புனித நதி', meaningEn: 'Sacred River', meaningHi: 'पवित्र नदी', startingLetter: 'Na / Nna' }
  ],
  'Tha / Dha': [
    { nameTa: 'தரண்', nameEn: 'Dharan', nameHi: 'धरण', gender: 'M', meaningTa: 'பூமியைத் தாங்குபவன்', meaningEn: 'Bearer of Earth', meaningHi: 'पृथ्वी धारक', startingLetter: 'Tha / Dha' },
    { nameTa: 'தனுஷ்', nameEn: 'Dhanush', nameHi: 'धनुष', gender: 'M', meaningTa: 'வில்', meaningEn: 'Bow, Archer', meaningHi: 'धनुर्धर', startingLetter: 'Tha / Dha' },
    { nameTa: 'தரா', nameEn: 'Dhara', nameHi: 'धरा', gender: 'F', meaningTa: 'பூமித் தாய்', meaningEn: 'Mother Earth', meaningHi: 'धरती मां', startingLetter: 'Tha / Dha' },
    { nameTa: 'தன்யா', nameEn: 'Dhanya', nameHi: 'धन्या', gender: 'F', meaningTa: 'பேறு பெற்றவள்', meaningEn: 'Blessed, Grateful', meaningHi: 'धन्य', startingLetter: 'Tha / Dha' }
  ],

  // Chitra
  'Pe / Pay': [
    { nameTa: 'பெருமாள்', nameEn: 'Perumal', nameHi: 'पेरुमाल', gender: 'M', meaningTa: 'மகாவிஷ்ணு', meaningEn: 'Lord Vishnu', meaningHi: 'भगवान विष्णु', startingLetter: 'Pe / Pay' },
    { nameTa: 'பேரறிவாளன்', nameEn: 'Perarivalan', nameHi: 'पेररिवालन', gender: 'M', meaningTa: 'பேரறிஞன்', meaningEn: 'Greatly Wise', meaningHi: 'महाज्ञानी', startingLetter: 'Pe / Pay' },
    { nameTa: 'பெண்ணரசி', nameEn: 'Pennarasi', nameHi: 'पेन्नरसी', gender: 'F', meaningTa: 'பெண்களின் அரசி', meaningEn: 'Queen of Women', meaningHi: 'नारी रानी', startingLetter: 'Pe / Pay' },
    { nameTa: 'பெருந்தேவி', nameEn: 'Perundevi', nameHi: 'पेरुन्देवी', gender: 'F', meaningTa: 'பெருந்தெய்வம், லட்சுமி', meaningEn: 'Great Goddess Lakshmi', meaningHi: 'महालक्ष्मी', startingLetter: 'Pe / Pay' }
  ],
  'Po / Poh': [
    { nameTa: 'பொன்முடி', nameEn: 'Ponmudi', nameHi: 'पोन्नमुडि', gender: 'M', meaningTa: 'பொன் மகுடம்', meaningEn: 'Golden Crown', meaningHi: 'स्वर्ण मुकुट', startingLetter: 'Po / Poh' },
    { nameTa: 'பொற்செழியன்', nameEn: 'Porchezhiyan', nameHi: 'पोर्चेलियन', gender: 'M', meaningTa: 'பொன்னிற பாண்டிய மன்னன்', meaningEn: 'Golden Pandya King', meaningHi: 'स्वर्ण पांड्य नरेश', startingLetter: 'Po / Poh' },
    { nameTa: 'பொன்னி', nameEn: 'Ponni', nameHi: 'पोन्नी', gender: 'F', meaningTa: 'பொன்னிற காவிரி', meaningEn: 'Golden Cauvery', meaningHi: 'स्वर्णिम कावेरी', startingLetter: 'Po / Poh' },
    { nameTa: 'பொற்செல்வி', nameEn: 'Porchelvi', nameHi: 'पोर्चेल्वी', gender: 'F', meaningTa: 'பொன்னான செல்வம்', meaningEn: 'Golden Prosperity', meaningHi: 'स्वर्ण समृद्धि', startingLetter: 'Po / Poh' }
  ],
  'Raa': [
    { nameTa: 'ராகவன்', nameEn: 'Raghavan', nameHi: 'राघवन', gender: 'M', meaningTa: 'ரகு குல ராமன்', meaningEn: 'Rama of Raghu Lineage', meaningHi: 'रघुकुल राम', startingLetter: 'Raa' },
    { nameTa: 'ராஜேஷ்', nameEn: 'Rajesh', nameHi: 'राजेश', gender: 'M', meaningTa: 'மன்னர்களின் மன்னன்', meaningEn: 'King of Kings', meaningHi: 'राजाओं के राजा', startingLetter: 'Raa' },
    { nameTa: 'ராதா', nameEn: 'Radha', nameHi: 'राधा', gender: 'F', meaningTa: 'கிருஷ்ணனின் அன்பி', meaningEn: 'Beloved of Krishna', meaningHi: 'कृष्ण प्रिया', startingLetter: 'Raa' },
    { nameTa: 'ராஜலக்ஷ்மி', nameEn: 'Rajalakshmi', nameHi: 'राजलक्ष्मी', gender: 'F', meaningTa: 'அரச லட்சுமி', meaningEn: 'Royal Lakshmi', meaningHi: 'राजलक्ष्मी', startingLetter: 'Raa' }
  ],
  'Ree / Ri': [
    { nameTa: 'ரிஷி', nameEn: 'Rishi', nameHi: 'ऋषि', gender: 'M', meaningTa: 'முனிவர்', meaningEn: 'Sage, Seer', meaningHi: 'ऋषि मुनि', startingLetter: 'Ree / Ri' },
    { nameTa: 'ரித்திக்', nameEn: 'Rithik', nameHi: 'ऋतिक', gender: 'M', meaningTa: 'பருவம், ஓடை', meaningEn: 'Season, Stream', meaningHi: 'ऋतु एवं धारा', startingLetter: 'Ree / Ri' },
    { nameTa: 'ரித்திகா', nameEn: 'Rithika', nameHi: 'ऋतिका', gender: 'F', meaningTa: 'மங்கள பருவம்', meaningEn: 'Auspicious Season', meaningHi: 'शुभ ऋतु', startingLetter: 'Ree / Ri' },
    { nameTa: 'ரீனா', nameEn: 'Rina', nameHi: 'रीना', gender: 'F', meaningTa: 'தூய்மையானவள்', meaningEn: 'Pure, Clean', meaningHi: 'पवित्र', startingLetter: 'Ree / Ri' }
  ],

  // Swati
  'Roo / Ru': [
    { nameTa: 'ருத்ரன்', nameEn: 'Rudran', nameHi: 'रुद्रन', gender: 'M', meaningTa: 'சிவபெருமான்', meaningEn: 'Lord Shiva as Rudra', meaningHi: 'रुद्र शिव', startingLetter: 'Roo / Ru' },
    { nameTa: 'ரூபன்', nameEn: 'Rupan', nameHi: 'रूपन', gender: 'M', meaningTa: 'அழகிய வடிவம்', meaningEn: 'Beautiful Form', meaningHi: 'सुंदर रूप', startingLetter: 'Roo / Ru' },
    { nameTa: 'ரூபினி', nameEn: 'Rubini', nameHi: 'रूपिनी', gender: 'F', meaningTa: 'பேரழகி', meaningEn: 'Beautiful Lady', meaningHi: 'रूपवती', startingLetter: 'Roo / Ru' },
    { nameTa: 'ருத்ராணி', nameEn: 'Rudrani', nameHi: 'रुद्राणी', gender: 'F', meaningTa: 'ருத்ரனின் தேவி', meaningEn: 'Consort of Rudra', meaningHi: 'रुद्र पत्नी', startingLetter: 'Roo / Ru' }
  ],
  'Re / Ray': [
    { nameTa: 'ரெங்கன்', nameEn: 'Rengan', nameHi: 'रेंगन', gender: 'M', meaningTa: 'அரங்கநாதன்', meaningEn: 'Lord Ranganatha', meaningHi: 'रंगनाथ', startingLetter: 'Re / Ray' },
    { nameTa: 'ரேவந்த்', nameEn: 'Revanth', nameHi: 'रेवंत', gender: 'M', meaningTa: 'சூரியனின் மகன்', meaningEn: 'Son of the Sun', meaningHi: 'सूर्य पुत्र', startingLetter: 'Re / Ray' },
    { nameTa: 'ரேவதி', nameEn: 'Revathi', nameHi: 'रेवती', gender: 'F', meaningTa: 'நட்சத்திர தேவி, லட்சுமி', meaningEn: 'Star Goddess Lakshmi', meaningHi: 'नक्षत्र लक्ष्मी', startingLetter: 'Re / Ray' },
    { nameTa: 'ரேணுகா', nameEn: 'Renuka', nameHi: 'रेणुका', gender: 'F', meaningTa: 'துர்க்கை வடிவம்', meaningEn: 'Form of Durga', meaningHi: 'दुर्गा रूप', startingLetter: 'Re / Ray' }
  ],
  'Ro / Roh': [
    { nameTa: 'ரோஹித்', nameEn: 'Rohit', nameHi: 'रोहित', gender: 'M', meaningTa: 'சூரியன், செந்நிறம்', meaningEn: 'Sun, Red Radiance', meaningHi: 'सूर्य', startingLetter: 'Ro / Roh' },
    { nameTa: 'ரோஷன்', nameEn: 'Roshan', nameHi: 'रोशन', gender: 'M', meaningTa: 'ஒளி', meaningEn: 'Light, Bright', meaningHi: 'प्रकाश', startingLetter: 'Ro / Roh' },
    { nameTa: 'ரோஹிணி', nameEn: 'Rohini', nameHi: 'रोहिणी', gender: 'F', meaningTa: 'சந்திரனின் மனைவி', meaningEn: 'Wife of the Moon', meaningHi: 'चंद्र पत्नी', startingLetter: 'Ro / Roh' },
    { nameTa: 'ரோஷ்னி', nameEn: 'Roshni', nameHi: 'रोशनी', gender: 'F', meaningTa: 'ஒளிக்கீற்று', meaningEn: 'Ray of Light', meaningHi: 'किरण', startingLetter: 'Ro / Roh' }
  ],
  'Thaa / Ta': [
    { nameTa: 'தாருண்', nameEn: 'Tharun', nameHi: 'थारुण', gender: 'M', meaningTa: 'இளமை', meaningEn: 'Youthful', meaningHi: 'युवा', startingLetter: 'Thaa / Ta' },
    { nameTa: 'தவசி', nameEn: 'Thavasi', nameHi: 'थवसि', gender: 'M', meaningTa: 'துறவி', meaningEn: 'Ascetic, Sage', meaningHi: 'तपस्वी', startingLetter: 'Thaa / Ta' },
    { nameTa: 'தாமரை', nameEn: 'Thamarai', nameHi: 'थामरै', gender: 'F', meaningTa: 'தாமரை மலர்', meaningEn: 'Lotus Flower', meaningHi: 'कमल पुष्प', startingLetter: 'Thaa / Ta' },
    { nameTa: 'தாரா', nameEn: 'Thara', nameHi: 'थारा', gender: 'F', meaningTa: 'நட்சத்திரம்', meaningEn: 'Star', meaningHi: 'तारा', startingLetter: 'Thaa / Ta' }
  ],

  // Vishakha
  'Thee / Ti': [
    { nameTa: 'தீர்த்தன்', nameEn: 'Theerthan', nameHi: 'थीर्थन', gender: 'M', meaningTa: 'புனித தீர்த்தம்', meaningEn: 'Sacred Water', meaningHi: 'पवित्र तीर्थ', startingLetter: 'Thee / Ti' },
    { nameTa: 'தீபன்', nameEn: 'Theeban', nameHi: 'थीबन', gender: 'M', meaningTa: 'ஒளி விளக்கு', meaningEn: 'Lamp of Light', meaningHi: 'दीपक', startingLetter: 'Thee / Ti' },
    { nameTa: 'தீபா', nameEn: 'Theepa', nameHi: 'थीबा', gender: 'F', meaningTa: 'தீப ஒளி', meaningEn: 'Lamp Flame', meaningHi: 'दीप ज्योति', startingLetter: 'Thee / Ti' },
    { nameTa: 'தீக்ஷா', nameEn: 'Theeksha', nameHi: 'थीक्षा', gender: 'F', meaningTa: 'தீட்சை', meaningEn: 'Initiation, Resolve', meaningHi: 'दीक्षा', startingLetter: 'Thee / Ti' }
  ],
  'Thoo / Tu': [
    { nameTa: 'தூயவன்', nameEn: 'Thooyavan', nameHi: 'थूयवन', gender: 'M', meaningTa: 'தூய்மையானவன்', meaningEn: 'Pure One', meaningHi: 'पवित्र', startingLetter: 'Thoo / Tu' },
    { nameTa: 'தூயன்', nameEn: 'Thooyan', nameHi: 'थूयन', gender: 'M', meaningTa: 'மாசற்றவன்', meaningEn: 'Spotless, Pure', meaningHi: 'निर्मल', startingLetter: 'Thoo / Tu' },
    { nameTa: 'தூளி', nameEn: 'Thooli', nameHi: 'थूलि', gender: 'F', meaningTa: 'மலர்த் தூள்', meaningEn: 'Flower Pollen', meaningHi: 'पुष्प पराग', startingLetter: 'Thoo / Tu' },
    { nameTa: 'தூயமாலா', nameEn: 'Thooyamala', nameHi: 'थूयमाला', gender: 'F', meaningTa: 'தூய மாலை', meaningEn: 'Pure Garland', meaningHi: 'निर्मल माला', startingLetter: 'Thoo / Tu' }
  ],
  'They / Te': [
    { nameTa: 'தேவர்', nameEn: 'Thevar', nameHi: 'थेवर', gender: 'M', meaningTa: 'தெய்வீகத் தலைவன்', meaningEn: 'Divine Chieftain', meaningHi: 'दिव्य नायक', startingLetter: 'They / Te' },
    { nameTa: 'தேனப்பன்', nameEn: 'Thenappan', nameHi: 'थेनप्पन', gender: 'M', meaningTa: 'தேன் போன்ற தந்தை', meaningEn: 'Honey-like Father', meaningHi: 'मधुर पिता', startingLetter: 'They / Te' },
    { nameTa: 'தேனி', nameEn: 'Theni', nameHi: 'थेनि', gender: 'F', meaningTa: 'தேனீ', meaningEn: 'Honeybee, Sweet', meaningHi: 'मधुमक्खी', startingLetter: 'They / Te' },
    { nameTa: 'தெய்வானை', nameEn: 'Theyvanai', nameHi: 'थेयवानै', gender: 'F', meaningTa: 'முருகனின் தேவி', meaningEn: 'Consort of Murugan', meaningHi: 'मुरुगन पत्नी', startingLetter: 'They / Te' }
  ],
  'Tho / Toh': [
    { nameTa: 'தோத்தாத்ரி', nameEn: 'Thothathri', nameHi: 'थोत्ताद्रि', gender: 'M', meaningTa: 'புகழ் மலை', meaningEn: 'Hill of Praise', meaningHi: 'स्तुति पर्वत', startingLetter: 'Tho / Toh' },
    { nameTa: 'தொல்காப்பியன்', nameEn: 'Tholkapiyan', nameHi: 'थोलकाप्पियन', gender: 'M', meaningTa: 'தொல்காப்பிய ஆசிரியர்', meaningEn: 'Author of Tolkappiyam', meaningHi: 'तोलकाप्पिय रचयिता', startingLetter: 'Tho / Toh' },
    { nameTa: 'தோழி', nameEn: 'Thozhi', nameHi: 'थोली', gender: 'F', meaningTa: 'உயிர்த் தோழி', meaningEn: 'Dear Friend', meaningHi: 'प्रिय सखी', startingLetter: 'Tho / Toh' },
    { nameTa: 'தோகையரசி', nameEn: 'Thogaiyarasi', nameHi: 'थोगैयरसी', gender: 'F', meaningTa: 'மயில் அரசி', meaningEn: 'Peacock Queen', meaningHi: 'मयूर रानी', startingLetter: 'Tho / Toh' }
  ],

  // Anuradha
  'Naa': [
    { nameTa: 'நாகராஜன்', nameEn: 'Nagarajan', nameHi: 'नागराजन', gender: 'M', meaningTa: 'நாகங்களின் அரசன்', meaningEn: 'King of Serpents', meaningHi: 'नागराज', startingLetter: 'Naa' },
    { nameTa: 'நாகுலன்', nameEn: 'Nagulan', nameHi: 'नागुलन', gender: 'M', meaningTa: 'நகுலன், அழகன்', meaningEn: 'Nakula, Handsome', meaningHi: 'नकुल', startingLetter: 'Naa' },
    { nameTa: 'நாகலக்ஷ்மி', nameEn: 'Nagalakshmi', nameHi: 'नागलक्ष्मी', gender: 'F', meaningTa: 'நாக லட்சுமி', meaningEn: 'Serpent Lakshmi', meaningHi: 'नागलक्ष्मी', startingLetter: 'Naa' },
    { nameTa: 'நாகேஸ்வரி', nameEn: 'Naageshwari', nameHi: 'नागेश्वरी', gender: 'F', meaningTa: 'நாகங்களின் தேவி', meaningEn: 'Goddess of Serpents', meaningHi: 'नागेश्वरी', startingLetter: 'Naa' }
  ],
  'Nee / Ni': [
    { nameTa: 'நீலகண்டன்', nameEn: 'Neelakandan', nameHi: 'नीलकंठन', gender: 'M', meaningTa: 'நீலகண்ட சிவன்', meaningEn: 'Blue-throated Shiva', meaningHi: 'नीलकंठ शिव', startingLetter: 'Nee / Ni' },
    { nameTa: 'நித்யானந்த்', nameEn: 'Nithyanand', nameHi: 'नित्यानंद', gender: 'M', meaningTa: 'நித்திய ஆனந்தம்', meaningEn: 'Eternal Bliss', meaningHi: 'शाश्वत आनंद', startingLetter: 'Nee / Ni' },
    { nameTa: 'நீலா', nameEn: 'Neela', nameHi: 'नीला', gender: 'F', meaningTa: 'நீல நிற அழகி', meaningEn: 'Blue Sapphire Beauty', meaningHi: 'नीलमणि', startingLetter: 'Nee / Ni' },
    { nameTa: 'நித்யா', nameEn: 'Nithya', nameHi: 'नित्या', gender: 'F', meaningTa: 'நித்தியமானவள்', meaningEn: 'Eternal One', meaningHi: 'नित्य', startingLetter: 'Nee / Ni' }
  ],
  'Noo / Nu': [
    { nameTa: 'நூதனன்', nameEn: 'Noothanan', nameHi: 'नूतनन', gender: 'M', meaningTa: 'புதுமையானவன்', meaningEn: 'Novel, Innovative', meaningHi: 'नवीन', startingLetter: 'Noo / Nu' },
    { nameTa: 'நூதன்', nameEn: 'Nuthan', nameHi: 'नूतन', gender: 'M', meaningTa: 'புதியவன்', meaningEn: 'New, Fresh', meaningHi: 'नूतन', startingLetter: 'Noo / Nu' },
    { nameTa: 'நூதனா', nameEn: 'Noothana', nameHi: 'नूतना', gender: 'F', meaningTa: 'புதுமை நிறைந்தவள்', meaningEn: 'Full of Novelty', meaningHi: 'नवीनता', startingLetter: 'Noo / Nu' },
    { nameTa: 'நுதன்', nameEn: 'Nutan', nameHi: 'नुतन', gender: 'F', meaningTa: 'புத்துணர்வு', meaningEn: 'Freshness', meaningHi: 'ताजगी', startingLetter: 'Noo / Nu' }
  ],
  'Ne / Nay': [
    { nameTa: 'நெடுமாறன்', nameEn: 'Nedumaran', nameHi: 'नेडुमारन', gender: 'M', meaningTa: 'நெடிய மாறன் மன்னன்', meaningEn: 'Tall Pandya King', meaningHi: 'पांड्य नरेश', startingLetter: 'Ne / Nay' },
    { nameTa: 'நெடுஞ்செழியன்', nameEn: 'Nedunchezhiyan', nameHi: 'नेडुंचेलियन', gender: 'M', meaningTa: 'புகழ்மிகு சேர மன்னன்', meaningEn: 'Great Chera King', meaningHi: 'चेर नरेश', startingLetter: 'Ne / Nay' },
    { nameTa: 'நெல்லை', nameEn: 'Nellai', nameHi: 'नेल्लै', gender: 'F', meaningTa: 'நெல் வளம் மிக்க ஊர்', meaningEn: 'City of Paddy Fields', meaningHi: 'धान नगरी', startingLetter: 'Ne / Nay' },
    { nameTa: 'நேசமணி', nameEn: 'Nesamani', nameHi: 'नेसमणि', gender: 'F', meaningTa: 'அன்பு மணி', meaningEn: 'Gem of Love', meaningHi: 'प्रेम रत्न', startingLetter: 'Ne / Nay' }
  ],

  // Jyeshtha
  'No / Noh': [
    { nameTa: 'நோதஸ்', nameEn: 'Nodhas', nameHi: 'नोधस्', gender: 'M', meaningTa: 'வேத முனிவர்', meaningEn: 'Vedic Sage', meaningHi: 'वैदिक ऋषि', startingLetter: 'No / Noh' },
    { nameTa: 'நொய்யல்', nameEn: 'Noyyal', nameHi: 'नोय्यल', gender: 'M', meaningTa: 'புனித நதி', meaningEn: 'Sacred River', meaningHi: 'पवित्र नदी', startingLetter: 'No / Noh' },
    { nameTa: 'நோஷிதா', nameEn: 'Noshita', nameHi: 'नोशिता', gender: 'F', meaningTa: 'மனநிறைவு கொண்டவள்', meaningEn: 'Contented Lady', meaningHi: 'संतुष्टा', startingLetter: 'No / Noh' },
    { nameTa: 'நோளினி', nameEn: 'Nolini', nameHi: 'नोलिनी', gender: 'F', meaningTa: 'தாமரைக் கொடி', meaningEn: 'Lotus Vine', meaningHi: 'कमल लता', startingLetter: 'No / Noh' }
  ],
  'Yaa': [
    { nameTa: 'யாதவ்', nameEn: 'Yadav', nameHi: 'यादव', gender: 'M', meaningTa: 'யது குலத்தவன்', meaningEn: 'Descendant of Yadu', meaningHi: 'यदुवंशी', startingLetter: 'Yaa' },
    { nameTa: 'யாக்ஞன்', nameEn: 'Yagyan', nameHi: 'याज्ञन', gender: 'M', meaningTa: 'யாகம் செய்பவன்', meaningEn: 'Performer of Sacrifice', meaningHi: 'यज्ञकर्ता', startingLetter: 'Yaa' },
    { nameTa: 'யாமினி', nameEn: 'Yamini', nameHi: 'यामिनी', gender: 'F', meaningTa: 'இரவு நேரம்', meaningEn: 'Night, Beautiful', meaningHi: 'रात्रि', startingLetter: 'Yaa' },
    { nameTa: 'யசோதா', nameEn: 'Yasodha', nameHi: 'यशोदा', gender: 'F', meaningTa: 'கிருஷ்ணனின் அன்னை', meaningEn: 'Mother of Krishna', meaningHi: 'कृष्ण जननी', startingLetter: 'Yaa' }
  ],
  'Yee / Yi': [
    { nameTa: 'இனியன்', nameEn: 'Yiniyan', nameHi: 'यिनियन', gender: 'M', meaningTa: 'இனிமையானவன்', meaningEn: 'Sweet-natured', meaningHi: 'मधुर स्वभाव', startingLetter: 'Yee / Yi' },
    { nameTa: 'இசையரசன்', nameEn: 'Yisaiarasan', nameHi: 'यिसैयरसन', gender: 'M', meaningTa: 'இசையின் அரசன்', meaningEn: 'King of Music', meaningHi: 'संगीत सम्राट', startingLetter: 'Yee / Yi' },
    { nameTa: 'இனியா', nameEn: 'Yiniya', nameHi: 'यिनिया', gender: 'F', meaningTa: 'இனிமையானவள்', meaningEn: 'Sweet Lady', meaningHi: 'मधुर महिला', startingLetter: 'Yee / Yi' },
    { nameTa: 'இசை', nameEn: 'Yisai', nameHi: 'यिसै', gender: 'F', meaningTa: 'இசைக் கலை', meaningEn: 'Art of Music', meaningHi: 'संगीत कला', startingLetter: 'Yee / Yi' }
  ],
  'Yoo / Yu': [
    { nameTa: 'யுவராஜ்', nameEn: 'Yuvaraj', nameHi: 'युवराज', gender: 'M', meaningTa: 'இளவரசன்', meaningEn: 'Crown Prince', meaningHi: 'युवराज', startingLetter: 'Yoo / Yu' },
    { nameTa: 'யுகேஷ்', nameEn: 'Yugesh', nameHi: 'युगेश', gender: 'M', meaningTa: 'யுகங்களின் இறைவன்', meaningEn: 'Lord of Ages', meaningHi: 'युगों के स्वामी', startingLetter: 'Yoo / Yu' },
    { nameTa: 'யுவராணி', nameEn: 'Yuvarani', nameHi: 'युवरानी', gender: 'F', meaningTa: 'இளவரசி', meaningEn: 'Crown Princess', meaningHi: 'युवरानी', startingLetter: 'Yoo / Yu' },
    { nameTa: 'யுகா', nameEn: 'Yuga', nameHi: 'युगा', gender: 'F', meaningTa: 'யுகம், காலம்', meaningEn: 'Era, Epoch', meaningHi: 'युग', startingLetter: 'Yoo / Yu' }
  ],

  // Mula
  'Ye / Yay': [
    { nameTa: 'எகேந்திரன்', nameEn: 'Yegendran', nameHi: 'येगेंद्रन', gender: 'M', meaningTa: 'ஒருமையின் இறைவன்', meaningEn: 'Lord of Oneness', meaningHi: 'एकत्व स्वामी', startingLetter: 'Ye / Yay' },
    { nameTa: 'யேசுதாசன்', nameEn: 'Yesudasan', nameHi: 'येसुदासन', gender: 'M', meaningTa: 'இயேசுவின் அடியவன்', meaningEn: 'Servant of Christ', meaningHi: 'मसीह भक्त', startingLetter: 'Ye / Yay' },
    { nameTa: 'யேசுமதி', nameEn: 'Yesumathi', nameHi: 'येसुमति', gender: 'F', meaningTa: 'இயேசுவின் ஒளி', meaningEn: 'Light of Christ', meaningHi: 'मसीह ज्योति', startingLetter: 'Ye / Yay' },
    { nameTa: 'ஏகவல்லி', nameEn: 'Yegavalli', nameHi: 'येगवल्ली', gender: 'F', meaningTa: 'தனித்துவக் கொடி', meaningEn: 'Unique Creeper', meaningHi: 'अद्वितीय लता', startingLetter: 'Ye / Yay' }
  ],
  'Yo / Yoh': [
    { nameTa: 'யோகராஜ்', nameEn: 'Yogaraj', nameHi: 'योगराज', gender: 'M', meaningTa: 'யோகத்தின் அரசன்', meaningEn: 'King of Yoga', meaningHi: 'योग सम्राट', startingLetter: 'Yo / Yoh' },
    { nameTa: 'யோகேஷ்', nameEn: 'Yogesh', nameHi: 'योगेश', gender: 'M', meaningTa: 'யோகத்தின் இறைவன்', meaningEn: 'Lord of Yoga', meaningHi: 'योगेश्वर', startingLetter: 'Yo / Yoh' },
    { nameTa: 'யோகலக்ஷ்மி', nameEn: 'Yogalakshmi', nameHi: 'योगलक्ष्मी', gender: 'F', meaningTa: 'யோக லட்சுமி', meaningEn: 'Lakshmi of Yoga', meaningHi: 'योगलक्ष्मी', startingLetter: 'Yo / Yoh' },
    { nameTa: 'யோகசுதா', nameEn: 'Yogasudha', nameHi: 'योगसुधा', gender: 'F', meaningTa: 'யோக அமிர்தம்', meaningEn: 'Nectar of Yoga', meaningHi: 'योगामृत', startingLetter: 'Yo / Yoh' }
  ],
  'Baa': [
    { nameTa: 'பாலாஜி', nameEn: 'Balaji', nameHi: 'बालाजी', gender: 'M', meaningTa: 'வேங்கடவன்', meaningEn: 'Lord Venkateswara', meaningHi: 'भगवान वेंकटेश्वर', startingLetter: 'Baa' },
    { nameTa: 'பாலராமன்', nameEn: 'Balaraman', nameHi: 'बलरामन', gender: 'M', meaningTa: 'பலராமன், வலிமை', meaningEn: 'Balarama, Strength', meaningHi: 'बलराम', startingLetter: 'Baa' },
    { nameTa: 'பாலா', nameEn: 'Bala', nameHi: 'बाला', gender: 'F', meaningTa: 'இளம் தேவி', meaningEn: 'Young Goddess', meaningHi: 'बाल देवी', startingLetter: 'Baa' },
    { nameTa: 'பானுமதி', nameEn: 'Banumathi', nameHi: 'भानुमती', gender: 'F', meaningTa: 'சூரிய ஒளி', meaningEn: 'Sunlight, Radiant', meaningHi: 'सूर्य प्रभा', startingLetter: 'Baa' }
  ],
  'Bee / Bi': [
    { nameTa: 'பிமல்', nameEn: 'Bimal', nameHi: 'बिमल', gender: 'M', meaningTa: 'தூய்மையானவன்', meaningEn: 'Pure, Stainless', meaningHi: 'निर्मल', startingLetter: 'Bee / Bi' },
    { nameTa: 'பினய்', nameEn: 'Binay', nameHi: 'बिनय', gender: 'M', meaningTa: 'பணிவு மிக்கவன்', meaningEn: 'Humble, Modest', meaningHi: 'विनम्र', startingLetter: 'Bee / Bi' },
    { nameTa: 'பீனா', nameEn: 'Bina', nameHi: 'बीना', gender: 'F', meaningTa: 'வீணை, அறிவு', meaningEn: 'Veena, Understanding', meaningHi: 'वीणा', startingLetter: 'Bee / Bi' },
    { nameTa: 'பிந்து', nameEn: 'Bindu', nameHi: 'बिंदु', gender: 'F', meaningTa: 'பொட்டு, துளி', meaningEn: 'Dot, Drop', meaningHi: 'बिंदु', startingLetter: 'Bee / Bi' }
  ],

  // Purva Ashadha
  'Bhoo / Bu': [
    { nameTa: 'பூமிநாதன்', nameEn: 'Bhoominathan', nameHi: 'भूमिनाथन', gender: 'M', meaningTa: 'பூமியின் இறைவன்', meaningEn: 'Lord of Earth', meaningHi: 'पृथ्वी नाथ', startingLetter: 'Bhoo / Bu' },
    { nameTa: 'புபேஷ்', nameEn: 'Bupesh', nameHi: 'भुपेश', gender: 'M', meaningTa: 'பூமியின் அரசன்', meaningEn: 'King of Earth', meaningHi: 'भूपति', startingLetter: 'Bhoo / Bu' },
    { nameTa: 'பூமிகா', nameEn: 'Bhoomika', nameHi: 'भूमिका', gender: 'F', meaningTa: 'பூமித் தேவி', meaningEn: 'Goddess Earth', meaningHi: 'भूमि देवी', startingLetter: 'Bhoo / Bu' },
    { nameTa: 'புவனா', nameEn: 'Buvana', nameHi: 'भुवना', gender: 'F', meaningTa: 'உலகம்', meaningEn: 'World, Universe', meaningHi: 'भुवन', startingLetter: 'Bhoo / Bu' }
  ],
  'Dhaa': [
    { nameTa: 'தானசேகரன்', nameEn: 'Dhanasekaran', nameHi: 'धानशेखरन', gender: 'M', meaningTa: 'செல்வத்தின் மகுடம்', meaningEn: 'Crown of Wealth', meaningHi: 'धन मुकुट', startingLetter: 'Dhaa' },
    { nameTa: 'தயாளன்', nameEn: 'Dhayalan', nameHi: 'धयालन', gender: 'M', meaningTa: 'கருணை மிக்கவன்', meaningEn: 'Compassionate', meaningHi: 'दयालु', startingLetter: 'Dhaa' },
    { nameTa: 'தனா', nameEn: 'Dhana', nameHi: 'धना', gender: 'F', meaningTa: 'செல்வம்', meaningEn: 'Wealth', meaningHi: 'धन', startingLetter: 'Dhaa' },
    { nameTa: 'தயாளு', nameEn: 'Dhayalu', nameHi: 'धयालु', gender: 'F', meaningTa: 'கருணை மிக்கவள்', meaningEn: 'Kind-hearted', meaningHi: 'करुणामयी', startingLetter: 'Dhaa' }
  ],
  'Phaa / Pha': [
    { nameTa: 'பணிராஜ்', nameEn: 'Phaniraj', nameHi: 'फणिराज', gender: 'M', meaningTa: 'நாகங்களின் அரசன்', meaningEn: 'King of Serpents', meaningHi: 'नागराज', startingLetter: 'Phaa / Pha' },
    { nameTa: 'பல்குனன்', nameEn: 'Phalgunan', nameHi: 'फाल्गुनन', gender: 'M', meaningTa: 'அர்ஜுனன்', meaningEn: 'Arjuna', meaningHi: 'अर्जुन', startingLetter: 'Phaa / Pha' },
    { nameTa: 'பலனி', nameEn: 'Phalani', nameHi: 'फलनी', gender: 'F', meaningTa: 'பலன் தருபவள்', meaningEn: 'Fruitful Lady', meaningHi: 'फलदायिनी', startingLetter: 'Phaa / Pha' },
    { nameTa: 'பணிதா', nameEn: 'Phanitha', nameHi: 'फणिता', gender: 'F', meaningTa: 'நாகம் சூடியவள்', meaningEn: 'Adorned with Serpents', meaningHi: 'नागभूषिता', startingLetter: 'Phaa / Pha' }
  ],
  'Dhaa / Dha': [
    { nameTa: 'தர்மராஜ்', nameEn: 'Dharmaraj', nameHi: 'धर्मराज', gender: 'M', meaningTa: 'தர்மத்தின் அரசன்', meaningEn: 'King of Dharma', meaningHi: 'धर्मराज', startingLetter: 'Dhaa / Dha' },
    { nameTa: 'தனஞ்ஜயன்', nameEn: 'Dhananjayan', nameHi: 'धनंजयन', gender: 'M', meaningTa: 'செல்வம் வென்ற அர்ஜுனன்', meaningEn: 'Arjuna, Winner of Wealth', meaningHi: 'धनंजय अर्जुन', startingLetter: 'Dhaa / Dha' },
    { nameTa: 'தர்மி', nameEn: 'Dharmi', nameHi: 'धर्मी', gender: 'F', meaningTa: 'தர்மம் நிறைந்தவள்', meaningEn: 'Righteous Lady', meaningHi: 'धर्मशीला', startingLetter: 'Dhaa / Dha' },
    { nameTa: 'தனலக்ஷ்மி', nameEn: 'Dhanalakshmi', nameHi: 'धनलक्ष्मी', gender: 'F', meaningTa: 'செல்வ லட்சுமி', meaningEn: 'Goddess of Wealth', meaningHi: 'धनलक्ष्मी', startingLetter: 'Dhaa / Dha' }
  ],

  // Uttara Ashadha
  'Bhe / Bay': [
    { nameTa: 'பைரவன்', nameEn: 'Bhairavan', nameHi: 'भैरवन', gender: 'M', meaningTa: 'உக்கிர சிவன்', meaningEn: 'Fierce Shiva', meaningHi: 'उग्र शिव', startingLetter: 'Bhe / Bay' },
    { nameTa: 'பீமன்', nameEn: 'Bheeman', nameHi: 'भीमन', gender: 'M', meaningTa: 'மாவீரன் பீமன்', meaningEn: 'Mighty Bhima', meaningHi: 'महाबली भीम', startingLetter: 'Bhe / Bay' },
    { nameTa: 'பைரவி', nameEn: 'Bhairavi', nameHi: 'भैरवी', gender: 'F', meaningTa: 'உக்கிர தேவி', meaningEn: 'Fierce Goddess', meaningHi: 'उग्र देवी', startingLetter: 'Bhe / Bay' },
    { nameTa: 'பேலா', nameEn: 'Bela', nameHi: 'बेला', gender: 'F', meaningTa: 'மல்லிகைக் கொடி', meaningEn: 'Jasmine Vine', meaningHi: 'बेला लता', startingLetter: 'Bhe / Bay' }
  ],
  'Bho / Boh': [
    { nameTa: 'போகேஷ்', nameEn: 'Bhogesh', nameHi: 'भोगेश', gender: 'M', meaningTa: 'சுகங்களின் இறைவன்', meaningEn: 'Lord of Enjoyments', meaningHi: 'सुख स्वामी', startingLetter: 'Bho / Boh' },
    { nameTa: 'போலாநாத்', nameEn: 'Bholanath', nameHi: 'भोलानाथ', gender: 'M', meaningTa: 'எளிய சிவன்', meaningEn: 'Innocent Shiva', meaningHi: 'भोले शिव', startingLetter: 'Bho / Boh' },
    { nameTa: 'போகி', nameEn: 'Bhogi', nameHi: 'भोगी', gender: 'F', meaningTa: 'சுகம் அனுபவிப்பவள்', meaningEn: 'Enjoyer of Bliss', meaningHi: 'आनंदमयी', startingLetter: 'Bho / Boh' },
    { nameTa: 'போமிகா', nameEn: 'Bhomika', nameHi: 'भोमिका', gender: 'F', meaningTa: 'பூமி வடிவம்', meaningEn: 'Form of Earth', meaningHi: 'पृथ्वी रूप', startingLetter: 'Bho / Boh' }
  ],
  'Jaa': [
    { nameTa: 'ஜாகன்', nameEn: 'Jagan', nameHi: 'जगन', gender: 'M', meaningTa: 'உலகம்', meaningEn: 'Universe', meaningHi: 'जगत', startingLetter: 'Jaa' },
    { nameTa: 'ஜனார்த்தனன்', nameEn: 'Janarthanan', nameHi: 'जनार्थनन', gender: 'M', meaningTa: 'மக்களைக் காப்பவன்', meaningEn: 'Protector of People, Vishnu', meaningHi: 'जनरक्षक विष्णु', startingLetter: 'Jaa' },
    { nameTa: 'ஜானகி', nameEn: 'Janaki', nameHi: 'जानकी', gender: 'F', meaningTa: 'சீதா தேவி', meaningEn: 'Goddess Sita', meaningHi: 'सीता देवी', startingLetter: 'Jaa' },
    { nameTa: 'ஜெயா', nameEn: 'Jaya', nameHi: 'जया', gender: 'F', meaningTa: 'வெற்றி', meaningEn: 'Victory', meaningHi: 'विजय', startingLetter: 'Jaa' }
  ],
  'Jee / Ji': [
    { nameTa: 'ஜீவன்', nameEn: 'Jeevan', nameHi: 'जीवन', gender: 'M', meaningTa: 'உயிர்', meaningEn: 'Life, Soul', meaningHi: 'जीवन', startingLetter: 'Jee / Ji' },
    { nameTa: 'ஜிதேந்திரன்', nameEn: 'Jithendra', nameHi: 'जितेंद्रन', gender: 'M', meaningTa: 'வெற்றி கொண்டவன்', meaningEn: 'Conqueror', meaningHi: 'विजेता', startingLetter: 'Jee / Ji' },
    { nameTa: 'ஜீவா', nameEn: 'Jeeva', nameHi: 'जीवा', gender: 'F', meaningTa: 'உயிர் சக்தி', meaningEn: 'Life Force', meaningHi: 'जीवन शक्ति', startingLetter: 'Jee / Ji' },
    { nameTa: 'ஜீவிதா', nameEn: 'Jivitha', nameHi: 'जीविता', gender: 'F', meaningTa: 'வாழும் தேவதை', meaningEn: 'Living Goddess', meaningHi: 'जीवंत देवी', startingLetter: 'Jee / Ji' }
  ],

  // Shravana
  'Khee / Khi': [
    { nameTa: 'கீரன்', nameEn: 'Keeran', nameHi: 'कीरन', gender: 'M', meaningTa: 'புலவன், பாடகன்', meaningEn: 'Poet, Singer', meaningHi: 'कवि गायक', startingLetter: 'Khee / Khi' },
    { nameTa: 'கீர்த்திவாசன்', nameEn: 'Keerthivasan', nameHi: 'कीर्तिवासन', gender: 'M', meaningTa: 'புகழ் மிக்கவன்', meaningEn: 'Famed One', meaningHi: 'यशस्वी', startingLetter: 'Khee / Khi' },
    { nameTa: 'கீர்த்தனா', nameEn: 'Keerthana', nameHi: 'कीर्तना', gender: 'F', meaningTa: 'இறை புகழ்ப் பாடல்', meaningEn: 'Song of Praise', meaningHi: 'स्तुति गीत', startingLetter: 'Khee / Khi' },
    { nameTa: 'கீர்த்தி', nameEn: 'Keerthi', nameHi: 'कीर्ति', gender: 'F', meaningTa: 'புகழ்', meaningEn: 'Fame, Glory', meaningHi: 'यश कीर्ति', startingLetter: 'Khee / Khi' }
  ],
  'Khoo / Khu': [
    { nameTa: 'குபேந்திரன்', nameEn: 'Kubendran', nameHi: 'कुबेंद्रन', gender: 'M', meaningTa: 'செல்வக் கடவுள்', meaningEn: 'Lord Kubera of Wealth', meaningHi: 'धनपति कुबेर', startingLetter: 'Khoo / Khu' },
    { nameTa: 'குலோத்துங்கன்', nameEn: 'Kulothungan', nameHi: 'कुलोत्तुंगन', gender: 'M', meaningTa: 'புகழ்மிகு சோழ மன்னன்', meaningEn: 'Great Chola King', meaningHi: 'चोल नरेश', startingLetter: 'Khoo / Khu' },
    { nameTa: 'குறிஞ்சி', nameEn: 'Kurinji', nameHi: 'कुरिंजि', gender: 'F', meaningTa: 'குறிஞ்சி மலர்', meaningEn: 'Kurinji Flower', meaningHi: 'कुरिंजि पुष्प', startingLetter: 'Khoo / Khu' },
    { nameTa: 'குயிலி', nameEn: 'Kuyili', nameHi: 'कुयिलि', gender: 'F', meaningTa: 'குயில்', meaningEn: 'Nightingale', meaningHi: 'कोयल', startingLetter: 'Khoo / Khu' }
  ],
  'Khe / Khay': [
    { nameTa: 'கேதார்நாத்', nameEn: 'Ketharnath', nameHi: 'केदारनाथ', gender: 'M', meaningTa: 'இமய சிவன்', meaningEn: 'Shiva of Kedarnath', meaningHi: 'केदार शिव', startingLetter: 'Khe / Khay' },
    { nameTa: 'கேசவன்', nameEn: 'Keshavan', nameHi: 'केशवन', gender: 'M', meaningTa: 'கிருஷ்ணர்', meaningEn: 'Lord Krishna', meaningHi: 'भगवान कृष्ण', startingLetter: 'Khe / Khay' },
    { nameTa: 'கேதகி', nameEn: 'Kethaki', nameHi: 'केतकी', gender: 'F', meaningTa: 'தாழம்பூ', meaningEn: 'Ketaki Flower', meaningHi: 'केवड़ा पुष्प', startingLetter: 'Khe / Khay' },
    { nameTa: 'கேசிகா', nameEn: 'Kesika', nameHi: 'केशिका', gender: 'F', meaningTa: 'கூந்தல் அழகி', meaningEn: 'Beautiful-haired', meaningHi: 'केशवती', startingLetter: 'Khe / Khay' }
  ],
  'Kho / Khoh': [
    { nameTa: 'கோடீஸ்வரன்', nameEn: 'Kodeshwaran', nameHi: 'कोडीश्वरन', gender: 'M', meaningTa: 'கோடீஸ்வர சிவன்', meaningEn: 'Millionaire Shiva', meaningHi: 'धनाढ्य शिव', startingLetter: 'Kho / Khoh' },
    { nameTa: 'கோமகன்', nameEn: 'Komahan', nameHi: 'कोमगन', gender: 'M', meaningTa: 'இளவரசன்', meaningEn: 'Prince', meaningHi: 'राजकुमार', startingLetter: 'Kho / Khoh' },
    { nameTa: 'கோதை', nameEn: 'Kodhai', nameHi: 'कोदै', gender: 'F', meaningTa: 'ஆண்டாள்', meaningEn: 'Goddess Andal', meaningHi: 'आंडाल देवी', startingLetter: 'Kho / Khoh' },
    { nameTa: 'கோமளா', nameEn: 'Komala', nameHi: 'कोमला', gender: 'F', meaningTa: 'மென்மையானவள்', meaningEn: 'Tender, Soft', meaningHi: 'कोमल', startingLetter: 'Kho / Khoh' }
  ],

  // Dhanishta
  'Gaa': [
    { nameTa: 'கணேஷ்', nameEn: 'Ganesh', nameHi: 'गणेश', gender: 'M', meaningTa: 'விநாயகர்', meaningEn: 'Lord Ganesha', meaningHi: 'भगवान गणेश', startingLetter: 'Gaa' },
    { nameTa: 'கஜேந்திரன்', nameEn: 'Gajendran', nameHi: 'गजेंद्रन', gender: 'M', meaningTa: 'யானைகளின் அரசன்', meaningEn: 'King of Elephants', meaningHi: 'गजराज', startingLetter: 'Gaa' },
    { nameTa: 'காயத்ரி', nameEn: 'Gayathri', nameHi: 'गायत्री', gender: 'F', meaningTa: 'காயத்ரி மந்திர தேவி', meaningEn: 'Goddess Gayathri', meaningHi: 'गायत्री देवी', startingLetter: 'Gaa' },
    { nameTa: 'கங்கா', nameEn: 'Ganga', nameHi: 'गंगा', gender: 'F', meaningTa: 'கங்கை நதி', meaningEn: 'River Ganga', meaningHi: 'गंगा नदी', startingLetter: 'Gaa' }
  ],
  'Gee / Gi': [
    { nameTa: 'கிரிதரன்', nameEn: 'Giridharan', nameHi: 'गिरिधरन', gender: 'M', meaningTa: 'மலை தாங்கிய கிருஷ்ணன்', meaningEn: 'Krishna, Bearer of Hill', meaningHi: 'गिरिधर कृष्ण', startingLetter: 'Gee / Gi' },
    { nameTa: 'கிரீஷ்', nameEn: 'Gireesh', nameHi: 'गिरीश', gender: 'M', meaningTa: 'மலைகளின் இறைவன்', meaningEn: 'Lord of Mountains, Shiva', meaningHi: 'गिरीश शिव', startingLetter: 'Gee / Gi' },
    { nameTa: 'கீதா', nameEn: 'Gita', nameHi: 'गीता', gender: 'F', meaningTa: 'பகவத் கீதை', meaningEn: 'Sacred Song, Gita', meaningHi: 'भगवद्गीता', startingLetter: 'Gee / Gi' },
    { nameTa: 'கிரிஜா', nameEn: 'Girija', nameHi: 'गिरिजा', gender: 'F', meaningTa: 'மலைமகள் பார்வதி', meaningEn: 'Parvati, Mountain-born', meaningHi: 'पार्वती', startingLetter: 'Gee / Gi' }
  ],
  'Goo / Gu': [
    { nameTa: 'குருபிரசாத்', nameEn: 'Guruprasad', nameHi: 'गुरुप्रसाद', gender: 'M', meaningTa: 'குருவின் அருள்', meaningEn: 'Blessing of the Guru', meaningHi: 'गुरु कृपा', startingLetter: 'Goo / Gu' },
    { nameTa: 'குகன்', nameEn: 'Guhan', nameHi: 'गुहन', gender: 'M', meaningTa: 'முருகன், இதயம் வாழ் இறை', meaningEn: 'Murugan, Heart-dweller', meaningHi: 'गुहावासी मुरुगन', startingLetter: 'Goo / Gu' },
    { nameTa: 'குணா', nameEn: 'Guna', nameHi: 'गुणा', gender: 'F', meaningTa: 'நற்குணம்', meaningEn: 'Virtuous', meaningHi: 'सद्गुणी', startingLetter: 'Goo / Gu' },
    { nameTa: 'குணவதி', nameEn: 'Gunavathi', nameHi: 'गुणवती', gender: 'F', meaningTa: 'குணம் நிறைந்தவள்', meaningEn: 'Full of Virtues', meaningHi: 'गुणसंपन्ना', startingLetter: 'Goo / Gu' }
  ],
  'Ge / Gay': [
    { nameTa: 'கேயன்', nameEn: 'Geyan', nameHi: 'गेयन', gender: 'M', meaningTa: 'பாடகன்', meaningEn: 'Singer', meaningHi: 'गायक', startingLetter: 'Ge / Gay' },
    { nameTa: 'கெங்காதரன்', nameEn: 'Gengadharan', nameHi: 'गेंगाधरन', gender: 'M', meaningTa: 'கங்கை தாங்கிய சிவன்', meaningEn: 'Shiva bearing Ganga', meaningHi: 'गंगाधर शिव', startingLetter: 'Ge / Gay' },
    { nameTa: 'கெங்கை', nameEn: 'Gengai', nameHi: 'गेंगै', gender: 'F', meaningTa: 'கங்கை நதி', meaningEn: 'River Ganga', meaningHi: 'गंगा नदी', startingLetter: 'Ge / Gay' },
    { nameTa: 'கேயா', nameEn: 'Geya', nameHi: 'गेया', gender: 'F', meaningTa: 'பாடல்', meaningEn: 'Song, Melody', meaningHi: 'गीत', startingLetter: 'Ge / Gay' }
  ],

  // Shatabhisha, Bhadrapadas & Revati
  'Go / Goh': [
    { nameTa: 'கோபாலன்', nameEn: 'Gopalan', nameHi: 'गोपालन', gender: 'M', meaningTa: 'பசுக்களைக் காக்கும் கிருஷ்ணன்', meaningEn: 'Krishna, Cowherd', meaningHi: 'गोपाल कृष्ण', startingLetter: 'Go / Goh' },
    { nameTa: 'கோவிந்தன்', nameEn: 'Govindan', nameHi: 'गोविंदन', gender: 'M', meaningTa: 'உலகைக் காக்கும் கிருஷ்ணன்', meaningEn: 'Krishna, Protector', meaningHi: 'गोविंद कृष्ण', startingLetter: 'Go / Goh' },
    { nameTa: 'கோபிகா', nameEn: 'Gopika', nameHi: 'गोपिका', gender: 'F', meaningTa: 'இடைச்சி', meaningEn: 'Cowherdess', meaningHi: 'गोपी', startingLetter: 'Go / Goh' },
    { nameTa: 'கோமதி', nameEn: 'Gomathi', nameHi: 'गोमती', gender: 'F', meaningTa: 'புனித நதி', meaningEn: 'Sacred River', meaningHi: 'पवित्र नदी', startingLetter: 'Go / Goh' }
  ],
  'Saa': [
    { nameTa: 'சாரவணன்', nameEn: 'Saravanan', nameHi: 'सारवणन', gender: 'M', meaningTa: 'சரவணப் பொய்கை முருகன்', meaningEn: 'Murugan of Saravana', meaningHi: 'शरवण भव मुरुगन', startingLetter: 'Saa' },
    { nameTa: 'சாரண்', nameEn: 'Saran', nameHi: 'सारण', gender: 'M', meaningTa: 'சரணடைந்தவன்', meaningEn: 'Surrendered Devotee', meaningHi: 'शरणागत', startingLetter: 'Saa' },
    { nameTa: 'சரண்யா', nameEn: 'Saranya', nameHi: 'शरण्या', gender: 'F', meaningTa: 'அடைக்கலம் தருபவள்', meaningEn: 'Giver of Refuge', meaningHi: 'शरणदायिनी', startingLetter: 'Saa' },
    { nameTa: 'சரஸ்வதி', nameEn: 'Saraswathi', nameHi: 'सरस्वती', gender: 'F', meaningTa: 'கலைமகள்', meaningEn: 'Goddess of Arts', meaningHi: 'विद्या देवी', startingLetter: 'Saa' }
  ],
  'See / Si': [
    { nameTa: 'சிவன்', nameEn: 'Sivan', nameHi: 'शिवन', gender: 'M', meaningTa: 'மங்கள சிவபெருமான்', meaningEn: 'Auspicious Shiva', meaningHi: 'मंगल शिव', startingLetter: 'See / Si' },
    { nameTa: 'சிவராமன்', nameEn: 'Sivaraman', nameHi: 'शिवरामन', gender: 'M', meaningTa: 'சிவனும் ராமனும்', meaningEn: 'Shiva and Rama', meaningHi: 'शिव राम', startingLetter: 'See / Si' },
    { nameTa: 'சிவகாமி', nameEn: 'Sivakami', nameHi: 'शिवकामी', gender: 'F', meaningTa: 'சிவனின் அன்பி', meaningEn: 'Beloved of Shiva', meaningHi: 'शिवप्रिया', startingLetter: 'See / Si' },
    { nameTa: 'சிந்து', nameEn: 'Sindhu', nameHi: 'सिंधु', gender: 'F', meaningTa: 'சிந்து நதி', meaningEn: 'River Sindhu', meaningHi: 'सिंधु नदी', startingLetter: 'See / Si' }
  ],
  'Tha / Ttha': [
    { nameTa: 'தங்கவேல்', nameEn: 'Thangavel', nameHi: 'थंगवेल', gender: 'M', meaningTa: 'பொன் வேல் முருகன்', meaningEn: 'Murugan with Golden Spear', meaningHi: 'स्वर्ण वेल मुरुगन', startingLetter: 'Tha / Ttha' },
    { nameTa: 'தங்கராஜ்', nameEn: 'Thangaraj', nameHi: 'थंगराज', gender: 'M', meaningTa: 'பொன் அரசன்', meaningEn: 'Golden King', meaningHi: 'स्वर्ण राजा', startingLetter: 'Tha / Ttha' },
    { nameTa: 'தங்கம்', nameEn: 'Thangam', nameHi: 'थंगम', gender: 'F', meaningTa: 'தங்கம்', meaningEn: 'Gold, Precious', meaningHi: 'सोना', startingLetter: 'Tha / Ttha' },
    { nameTa: 'தங்கச்செல்வி', nameEn: 'Thangaselvi', nameHi: 'थंगसेल्वी', gender: 'F', meaningTa: 'பொன்னான செல்வி', meaningEn: 'Golden Prosperous Girl', meaningHi: 'स्वर्ण समृद्धा', startingLetter: 'Tha / Ttha' }
  ],
  'Jha / Za': [
    { nameTa: 'ஞானம்', nameEn: 'Jnanam', nameHi: 'ज्ञानम्', gender: 'M', meaningTa: 'மெய்ஞானம்', meaningEn: 'True Wisdom', meaningHi: 'सच्चा ज्ञान', startingLetter: 'Jha / Za' },
    { nameTa: 'ஞானப்பிரகாசம்', nameEn: 'Jnanaprakasam', nameHi: 'ज्ञानप्रकाशम्', gender: 'M', meaningTa: 'ஞான ஒளி', meaningEn: 'Light of Wisdom', meaningHi: 'ज्ञान प्रकाश', startingLetter: 'Jha / Za' },
    { nameTa: 'ஜாஹ்னவி', nameEn: 'Jhanavi', nameHi: 'जाह्नवी', gender: 'F', meaningTa: 'கங்கை', meaningEn: 'Ganga, Daughter of Jahnu', meaningHi: 'जाह्नवी गंगा', startingLetter: 'Jha / Za' },
    { nameTa: 'ஞானாம்பாள்', nameEn: 'Jnanambal', nameHi: 'ज्ञानाम्बाल्', gender: 'F', meaningTa: 'ஞானத் தாய்', meaningEn: 'Mother of Wisdom', meaningHi: 'ज्ञान माता', startingLetter: 'Jha / Za' }
  ],
  'Nya / Tra': [
    { nameTa: 'ஞானேஷ்', nameEn: 'Jnanesh', nameHi: 'ज्ञानेश', gender: 'M', meaningTa: 'ஞானத்தின் இறைவன்', meaningEn: 'Lord of Wisdom', meaningHi: 'ज्ञान स्वामी', startingLetter: 'Nya / Tra' },
    { nameTa: 'ஞானவேல்', nameEn: 'Jnanavel', nameHi: 'ज्ञानवेल्', gender: 'M', meaningTa: 'ஞான வேல்', meaningEn: 'Spear of Wisdom', meaningHi: 'ज्ञान वेल', startingLetter: 'Nya / Tra' },
    { nameTa: 'ஞானா', nameEn: 'Jnana', nameHi: 'ज्ञाना', gender: 'F', meaningTa: 'அறிவு', meaningEn: 'Wisdom', meaningHi: 'ज्ञान', startingLetter: 'Nya / Tra' },
    { nameTa: 'ஞானேஸ்வரி', nameEn: 'Jnaneshwari', nameHi: 'ज्ञानेश्वरी', gender: 'F', meaningTa: 'ஞான தேவி', meaningEn: 'Goddess of Wisdom', meaningHi: 'ज्ञानेश्वरी', startingLetter: 'Nya / Tra' }
  ],
  'Chaa': [
    { nameTa: 'சந்திரன்', nameEn: 'Chandran', nameHi: 'चंद्रन', gender: 'M', meaningTa: 'சந்திரன்', meaningEn: 'Moon', meaningHi: 'चंद्रमा', startingLetter: 'Chaa' },
    { nameTa: 'சக்கரவர்த்தி', nameEn: 'Chakravarthy', nameHi: 'चक्रवर्ती', gender: 'M', meaningTa: 'சக்கரவர்த்தி மன்னன்', meaningEn: 'Emperor', meaningHi: 'सम्राट', startingLetter: 'Chaa' },
    { nameTa: 'சந்திரா', nameEn: 'Chandra', nameHi: 'चंद्रा', gender: 'F', meaningTa: 'நிலவு', meaningEn: 'Moonlight', meaningHi: 'चांदनी', startingLetter: 'Chaa' },
    { nameTa: 'சந்திரிகா', nameEn: 'Chandrika', nameHi: 'चंद्रिका', gender: 'F', meaningTa: 'நிலவொளி', meaningEn: 'Moonbeam', meaningHi: 'चंद्रिका', startingLetter: 'Chaa' }
  ],
  'Chee / Chi': [
    { nameTa: 'சிதம்பரம்', nameEn: 'Chidambaram', nameHi: 'चिदंबरम्', gender: 'M', meaningTa: 'ஞான ஆகாய நடராஜர்', meaningEn: 'Nataraja of Wisdom Space', meaningHi: 'चिदंबर नटराज', startingLetter: 'Chee / Chi' },
    { nameTa: 'சின்மயன்', nameEn: 'Chinmayan', nameHi: 'चिन्मयन', gender: 'M', meaningTa: 'ஞானம் நிறைந்தவன்', meaningEn: 'Full of Consciousness', meaningHi: 'चिन्मय', startingLetter: 'Chee / Chi' },
    { nameTa: 'சின்மயி', nameEn: 'Chinmayi', nameHi: 'चिन्मयी', gender: 'F', meaningTa: 'ஞானம் நிறைந்தவள்', meaningEn: 'Full of Consciousness', meaningHi: 'चिन्मयी', startingLetter: 'Chee / Chi' },
    { nameTa: 'சித்ரா', nameEn: 'Chitra', nameHi: 'चित्रा', gender: 'F', meaningTa: 'அழகிய ஓவியம்', meaningEn: 'Beautiful Picture', meaningHi: 'सुंदर चित्र', startingLetter: 'Chee / Chi' }
  ]
};

// Helper: Normalize syllable for suggestions lookup
function getSuggestionsForPada(primaryLetterEn: string, nakshatraIndex: number, gender: 'M' | 'F'): BabyNameSuggestion[] {
  // Direct match
  if (CURATED_SUGGESTIONS[primaryLetterEn]) {
    const matched = CURATED_SUGGESTIONS[primaryLetterEn].filter(n => n.gender === gender);
    if (matched.length > 0) return matched.map(n => ({ ...n, startingLetter: primaryLetterEn }));
  }

  // Key match by partial token
  const keyTokens = primaryLetterEn.toLowerCase().split(/[\s/]+/);
  for (const [dictKey, names] of Object.entries(CURATED_SUGGESTIONS)) {
    const dictTokens = dictKey.toLowerCase().split(/[\s/]+/);
    if (keyTokens.some(t => dictTokens.includes(t))) {
      const matched = names.filter(n => n.gender === gender);
      if (matched.length > 0) return matched.map(n => ({ ...n, startingLetter: primaryLetterEn }));
    }
  }

  // Fallback high quality Vedic names for the syllable
  const cleanPrefix = primaryLetterEn.split('/')[0].trim();
  if (gender === 'M') {
    return [
      {
        nameTa: `${cleanPrefix}வர்ஷன்`,
        nameEn: `${cleanPrefix}varshan`,
        nameHi: `${cleanPrefix}वर्धन`,
        gender: 'M',
        meaningTa: 'செல்வமும் நற்புகழும் வளர்ப்பவன்',
        meaningEn: 'One who increases prosperity and glory',
        meaningHi: 'समृद्धि एवं यश बढ़ाने वाला',
        startingLetter: primaryLetterEn
      },
      {
        nameTa: `${cleanPrefix}தேவ்`,
        nameEn: `${cleanPrefix}dev`,
        nameHi: `${cleanPrefix}देव`,
        gender: 'M',
        meaningTa: 'தெய்வீக ஒளி பொருந்தியவன்',
        meaningEn: 'Divine Luminary, Godly and Noble',
        meaningHi: 'दिव्य पुरुष',
        startingLetter: primaryLetterEn
      }
    ];
  } else {
    return [
      {
        nameTa: `${cleanPrefix}வர்ஷினி`,
        nameEn: `${cleanPrefix}varshini`,
        nameHi: `${cleanPrefix}वर्षिणी`,
        gender: 'F',
        meaningTa: 'அன்பு மழை பொழியும் மங்கல தேவதை',
        meaningEn: 'Goddess who showers boundless love and grace',
        meaningHi: 'कृपामयी एवं सुखदायिनी',
        startingLetter: primaryLetterEn
      },
      {
        nameTa: `${cleanPrefix}ஸ்ரீ`,
        nameEn: `${cleanPrefix}shree`,
        nameHi: `${cleanPrefix}श्री`,
        gender: 'F',
        meaningTa: 'மங்களகரமான அழகு மற்றும் செல்வம்',
        meaningEn: 'Auspicious Beauty, Goddess Lakshmi',
        meaningHi: 'मंगला एवं लक्ष्मी',
        startingLetter: primaryLetterEn
      }
    ];
  }
}

export function calculateBabyNamingDetails(
  babyNameOrPayload: string | any,
  dob?: string,
  tob?: string,
  birthPlace?: string,
  gender: 'M' | 'F' = 'M',
  latitude?: number,
  longitude?: number,
  timezoneOffsetHours?: number,
  country = ''
): BabyNamingResult & { nameProvenance: NamakaranNameProvenance } {
  const isObj = typeof babyNameOrPayload === 'object' && babyNameOrPayload !== null;
  const bName = isObj ? (babyNameOrPayload.babyName || babyNameOrPayload.name || '') : (babyNameOrPayload || '');
  // Do not let the former sample/default date, time, country or Nadi
  // coordinates silently turn an incomplete paid request into a different
  // child's horoscope.
  const bDob = isObj ? (babyNameOrPayload.dob || '') : (dob || '');
  const bTob = isObj ? (babyNameOrPayload.tob || '') : (tob || '');
  const bPlace = isObj ? (babyNameOrPayload.birthPlace || babyNameOrPayload.place || '') : (birthPlace || '');
  const bGender: 'M' | 'F' = isObj ? (babyNameOrPayload.gender || 'M') : (gender || 'M');
  const bCountry = isObj ? (babyNameOrPayload.country || '') : (country || '');

  const bLat = isObj
    ? Number(babyNameOrPayload.latitude ?? babyNameOrPayload.lat)
    : Number(latitude);
  const bLng = isObj
    ? Number(babyNameOrPayload.longitude ?? babyNameOrPayload.lng)
    : Number(longitude);
  const bTz = isObj
    ? Number(babyNameOrPayload.timezoneOffsetHours ?? (babyNameOrPayload.tzOffsetMinutes !== undefined ? babyNameOrPayload.tzOffsetMinutes / 60 : undefined))
    : Number(timezoneOffsetHours);
  if (!bPlace.trim()) {
    throw new Error('Baby Naming requires the birthplace selected for the birth chart.');
  }

  const horoscope = calculatePrecisionHoroscope(
    bName || (bGender === 'M' ? 'Baby Boy' : 'Baby Girl'),
    bDob,
    bTob,
    bPlace,
    bLat,
    bLng,
    bTz,
    bCountry,
    bGender
  );

  const rawStarIndex = horoscope.janmaNakshatraIndex;
  if (!Number.isInteger(rawStarIndex) || rawStarIndex < 0 || rawStarIndex > 26) {
    throw new Error('Baby Naming requires a valid birth Nakshatra index.');
  }
  const starIndex = rawStarIndex + 1; // 1 to 27
  const nakshatraBabyLetters = ALL_NAKSHATRA_LETTERS.find(s => s.nakshatraIndex === starIndex);
  if (!nakshatraBabyLetters) {
    throw new Error('Unable to resolve the birth Nakshatra for baby naming.');
  }

  const pada = horoscope.janmaPada;
  if (!Number.isInteger(pada) || pada < 1 || pada > 4) {
    throw new Error('Baby Naming requires a valid birth Pada.');
  }
  const primaryPadaInfo = nakshatraBabyLetters.padas.find(p => p.padaNumber === pada);
  if (!primaryPadaInfo) {
    throw new Error('Unable to resolve the birth Pada for baby naming.');
  }

  const suggestedNames = getSuggestionsForPada(primaryPadaInfo.letterEn, starIndex, bGender);

  // Page 2 of the report: the South + North Indian name lists for all four
  // padas of the birth star, for the baby's own gender.
  const nameSuggestions = buildNamakaranPadaNames(nakshatraBabyLetters.padas, bGender);

  return {
    // Keep this in sync with the PHP delivery engine. It lets existing orders
    // be recognised and refreshed if the Namakshara mapping is ever updated.
    babyNamingAlgorithmVersion: 2,
    babyName: (bName && bName.trim()) || (bGender === 'M' ? 'Newborn Boy' : 'Newborn Girl'),
    nameProvenance: buildNamakaranNameProvenance(bName),
    gender: bGender,
    dob: bDob,
    tob: bTob,
    birthPlace: bPlace.trim(),
    country: bCountry,
    latitude: horoscope.latitude,
    longitude: horoscope.longitude,
    timezoneOffsetHours: horoscope.timezoneOffsetHours,
    timeZoneId: horoscope.timeZoneId,
    nakshatraLetters: nakshatraBabyLetters,
    janmaPada: pada,
    primaryPadaInfo,
    chandraRasi: horoscope.chandraRasi,
    chandraRasiNameTa: horoscope.chandraRasiNameTa,
    chandraRasiNameEn: horoscope.chandraRasiNameEn,
    chandraRasiNameHi: horoscope.chandraRasiNameHi,
    lagnaRasi: horoscope.lagnaRasi,
    lagnaRasiNameTa: horoscope.lagnaRasiNameTa,
    lagnaRasiNameEn: horoscope.lagnaRasiNameEn,
    lagnaRasiNameHi: horoscope.lagnaRasiNameHi,
    suggestedNames,
    nameSuggestions,
    generatedAt: new Date().toISOString()
  };
}

export const calculateBabyNaming = calculateBabyNamingDetails;
