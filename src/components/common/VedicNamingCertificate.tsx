import React, { useState } from 'react';
import { getGunam } from '../../services/gunamData';

export interface VedicNamingCertificateProps {
  data?: {
    babyName?: string;
    gender?: 'M' | 'F' | string;
    dob?: string;
    tob?: string;
    birthPlace?: string;
    country?: string;
    lagnaRasiNameEn?: string;
    lagnaRasiNameTa?: string;
    lagnaRasiNameHi?: string;
    chandraRasiNameEn?: string;
    chandraRasiNameTa?: string;
    chandraRasiNameHi?: string;
    janmaPada?: number;
    nakshatraLetters?: {
      nakshatraNameEn?: string;
      nakshatraNameTa?: string;
      nakshatraNameHi?: string;
      deityEn?: string;
      deityTa?: string;
      deityHi?: string;
      lordEn?: string;
      lordTa?: string;
      lordHi?: string;
      ganaEn?: string;
      ganaTa?: string;
      ganaHi?: string;
      yoniEn?: string;
      yoniTa?: string;
      yoniHi?: string;
      rajjuEn?: string;
      rajjuTa?: string;
      rajjuHi?: string;
      padas?: Array<{
        padaNumber: number;
        letterEn: string;
        letterTa: string;
        letterHi: string;
        rasiEn: string;
        rasiTa?: string;
        rasiHi?: string;
      }>;
    };
  };
  initialLang?: 'ta' | 'en' | 'hi';
}

const SAMPLE_CERT_DATA = {
  babyName: "Varun",
  gender: "M",
  dob: "02-11-2023",
  tob: "10:30 AM",
  birthPlace: "Chennai",
  country: "India",
  lagnaRasiNameEn: "Meenam (Pisces)",
  lagnaRasiNameTa: "மீனம்",
  lagnaRasiNameHi: "मीन",
  chandraRasiNameEn: "Meenam (Pisces)",
  chandraRasiNameTa: "மீனம்",
  chandraRasiNameHi: "मीन",
  janmaPada: 4,
  nakshatraLetters: {
    nakshatraNameEn: "Uthirattathi (Uttara Bhadrapada)",
    nakshatraNameTa: "உத்திரட்டாதி",
    nakshatraNameHi: "उत्तरभाद्रपद",
    deityEn: "Chandra Bhagavan (Moon)",
    deityTa: "சந்திர பகவான்",
    deityHi: "चंद्र भगवान",
    lordEn: "Mars (Chevvai)",
    lordTa: "செவ்வாய்",
    lordHi: "मंगल",
    ganaEn: "Deva Gana",
    ganaTa: "தேவ கணம்",
    ganaHi: "देव गण",
    yoniEn: "Cow (பசு)",
    yoniTa: "பசு",
    yoniHi: "गाय",
    rajjuEn: "Shiro Rajju (சிரோ)",
    rajjuTa: "சிரோ ரஜ்ஜு",
    rajjuHi: "शिरो रज्जु",
    padas: [
      { padaNumber: 1, letterEn: "Ve", letterTa: "வே", letterHi: "वे", rasiEn: "Rishabam", rasiTa: "ரிஷபம்", rasiHi: "वृषभ" },
      { padaNumber: 2, letterEn: "Vo", letterTa: "வோ", letterHi: "वो", rasiEn: "Rishabam", rasiTa: "ரிஷபம்", rasiHi: "वृषभ" },
      { padaNumber: 3, letterEn: "Kaa", letterTa: "கா", letterHi: "का", rasiEn: "Meenam", rasiTa: "மீனம்", rasiHi: "मीन" },
      { padaNumber: 4, letterEn: "Jai", letterTa: "ஜை", letterHi: "जै", rasiEn: "Meenam", rasiTa: "மீனம்", rasiHi: "मीन" },
    ]
  }
};

export const VedicNamingCertificate: React.FC<VedicNamingCertificateProps> = ({
  data = SAMPLE_CERT_DATA,
  initialLang = 'ta'
}) => {
  const [lang, setLang] = useState<'ta' | 'en' | 'hi'>(initialLang);

  // The no-prop default is an intentional sample certificate. Once a caller
  // supplies data, however, absent chart values must not borrow sample signs,
  // Nakshatra details, or the sample birth Pada.
  const certData = data;
  const nak = certData.nakshatraLetters;
  const padas = Array.isArray(nak?.padas) ? nak.padas : [];
  const rawBirthPada = certData.janmaPada;
  const birthPada = Number.isInteger(rawBirthPada) && rawBirthPada! >= 1 && rawBirthPada! <= 4
    ? rawBirthPada!
    : 'N/A';

  const babyName = certData.babyName || (certData.gender === 'M' ? (lang === 'ta' ? 'ஆண் குழந்தை' : lang === 'hi' ? 'बालक' : 'Baby Boy') : (lang === 'ta' ? 'பெண் குழந்தை' : lang === 'hi' ? 'बालिका' : 'Baby Girl'));
  
  const gunamList = getGunam(
    nak?.nakshatraNameEn || '',
    certData.chandraRasiNameEn || '',
    lang
  );

  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="w-full max-w-3xl mx-auto my-4 font-sans text-[#331c0e]">
      {/* Language switcher */}
      <div className="flex gap-2 justify-center mb-3">
        {(['ta', 'en', 'hi'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setLang(k)}
            className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
              lang === k
                ? 'bg-[#7a1f1f] text-[#fdf3e0] border-[#7a1f1f]'
                : 'bg-transparent text-[#7a1f1f] border-[#7a1f1f] hover:bg-[#7a1f1f]/10'
            }`}
          >
            {k === 'ta' ? 'தமிழ்' : k === 'en' ? 'English' : 'हिन्दी'}
          </button>
        ))}
      </div>

      {/* Main Certificate Card */}
      <div className="bg-[#fdf3e0] border-4 border-double border-[#a67c1f] rounded-lg p-5 sm:p-7 shadow-md">
        
        {/* Header */}
        <div className="text-center border-b-2 border-[#7a1f1f] pb-3 mb-3">
          <div className="text-2xl text-[#7a1f1f]">ॐ</div>
          <div className="font-bold text-lg text-[#7a1f1f] mt-0.5">
            {lang === 'ta' ? 'அஸ்ட்ரோ சிவம்' : lang === 'hi' ? 'एस्ट्रो शिवम' : 'ASTRO SIVAM'}
          </div>
          <div className="text-xs text-[#a67c1f] mt-0.5">
            {lang === 'ta' ? 'பாரம்பரிய வேத ஜோதிட சேவை • admin@astrosivam.com' : lang === 'hi' ? 'पारंपरिक वैदिक ज्योतिष सेवा • admin@astrosivam.com' : 'Authentic Vedic Astrology Services • admin@astrosivam.com'}
          </div>
          <div className="text-sm font-bold text-[#7a1f1f] mt-2">
            {lang === 'ta' ? 'வேத நாமகரணப் பத்திரம்' : lang === 'hi' ? 'वैदिक नामकरण प्रमाणपत्र' : 'Vedic Naming Certificate'}
          </div>
          <div className="text-xs text-[#5a4632]">
            {lang === 'ta' ? 'நட்சத்திர அக்ஷர சான்றிதழ்' : lang === 'hi' ? 'नक्षत्र अक्षर प्रमाणपत्र' : 'Nakshatra Akshara Certificate'}
          </div>
        </div>

        {/* Section: Child Details */}
        <div className="mb-3">
          <div className="text-xs font-bold text-[#7a1f1f] mb-1.5 border-b border-dotted border-[#a67c1f] pb-0.5">
            {lang === 'ta' ? 'குழந்தையின் விவரம்' : lang === 'hi' ? 'बच्चे का विवरण' : 'Child Details'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'பெயர்' : lang === 'hi' ? 'नाम' : 'Name'}: </strong>
              <span className="font-semibold">{babyName}</span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'பாலினம்' : lang === 'hi' ? 'लिंग' : 'Gender'}: </strong>
              <span className="font-semibold">
                {certData.gender === 'M'
                  ? (lang === 'ta' ? 'ஆண்' : lang === 'hi' ? 'पुत्र' : 'Male')
                  : (lang === 'ta' ? 'பெண்' : lang === 'hi' ? 'पुत्री' : 'Female')}
              </span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'லக்னம்' : lang === 'hi' ? 'लग्न' : 'Lagnam'}: </strong>
              <span className="font-semibold">
                {lang === 'ta' ? certData.lagnaRasiNameTa || 'N/A' : lang === 'hi' ? certData.lagnaRasiNameHi || 'N/A' : certData.lagnaRasiNameEn || 'N/A'}
              </span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'பிறந்த தேதி' : lang === 'hi' ? 'जन्म तिथि' : 'Date of Birth'}: </strong>
              <span className="font-semibold">{certData.dob || 'N/A'}</span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'பிறந்த நேரம்' : lang === 'hi' ? 'जन्म समय' : 'Time of Birth'}: </strong>
              <span className="font-semibold">{certData.tob || 'N/A'}</span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'பிறந்த இடம்' : lang === 'hi' ? 'जन्म स्थान' : 'Place of Birth'}: </strong>
              <span className="font-semibold">{certData.birthPlace || 'N/A'}{certData.country ? `, ${certData.country}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Star Card */}
        <div className="bg-[#fff9ec] border border-[#a67c1f] rounded p-2.5 sm:p-3 mb-3">
          <div className="text-xs font-bold text-[#7a1f1f] mb-1.5">
            ⭐ {lang === 'ta' ? 'நட்சத்திரம் & ராசி விவரம்' : lang === 'hi' ? 'नक्षत्र और राशि विवरण' : 'Nakshatram & Rasi Details'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'நட்சத்திரம்' : lang === 'hi' ? 'नक्षत्र' : 'Nakshatram'}: </strong>
              <span className="font-semibold">
                {lang === 'ta' ? nak?.nakshatraNameTa || 'N/A' : lang === 'hi' ? nak?.nakshatraNameHi || 'N/A' : nak?.nakshatraNameEn || 'N/A'}
              </span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'ராசி' : lang === 'hi' ? 'राशि' : 'Rasi'}: </strong>
              <span className="font-semibold">
                {lang === 'ta' ? certData.chandraRasiNameTa || 'N/A' : lang === 'hi' ? certData.chandraRasiNameHi || 'N/A' : certData.chandraRasiNameEn || 'N/A'}
              </span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'பாதம்' : lang === 'hi' ? 'पाद' : 'Pada'}: </strong>
              <span className="font-semibold">{birthPada}</span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'நட்சத்திர அதிபதி' : lang === 'hi' ? 'नक्षत्र स्वामी' : 'Star Lord'}: </strong>
              <span className="font-semibold">
                {lang === 'ta' ? nak?.lordTa || 'N/A' : lang === 'hi' ? nak?.lordHi || 'N/A' : nak?.lordEn || 'N/A'}
              </span>
            </div>
            <div>
              <strong className="text-[#5a4632]">{lang === 'ta' ? 'ஜோதிட தத்துவம்' : lang === 'hi' ? 'तत्व' : 'Element'}: </strong>
              <span className="font-semibold">
                {lang === 'ta' ? 'அக்னி / சுப பிரகாசம்' : lang === 'hi' ? 'अग्नि / शुभ तेज' : 'Fire / Luminary'}
              </span>
            </div>
          </div>
        </div>

        {/* Naming Syllables by Pada */}
        <div className="mb-3">
          <div className="text-xs font-bold text-[#7a1f1f] mb-1.5 border-b border-dotted border-[#a67c1f] pb-0.5">
            {lang === 'ta' ? 'எழுத்து ஆரம்ப எழுத்துகள் (4 பாதம்)' : lang === 'hi' ? 'पाद अनुसार नामकरण अक्षर (4 पाद)' : 'Naming Syllables by Pada (4 Padas)'}
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#7a1f1f] text-[#fdf3e0]">
                <th className="p-1.5 text-left font-semibold">{lang === 'ta' ? 'பாதம்' : lang === 'hi' ? 'पाद' : 'Pada'}</th>
                <th className="p-1.5 text-left font-semibold">{lang === 'ta' ? 'ஆரம்ப எழுத்து' : lang === 'hi' ? 'प्रारंभिक अक्षर' : 'Starting Syllable'}</th>
                <th className="p-1.5 text-left font-semibold">{lang === 'ta' ? 'ராசி' : lang === 'hi' ? 'राशि' : 'Rasi'}</th>
              </tr>
            </thead>
            <tbody>
              {padas.map((p) => {
                const isChosen = p.padaNumber === birthPada;
                const letter = lang === 'ta' ? p.letterTa : lang === 'hi' ? p.letterHi : p.letterEn;
                const rasi = lang === 'ta' ? p.rasiTa || p.rasiEn || 'N/A' : lang === 'hi' ? p.rasiHi || p.rasiEn || 'N/A' : p.rasiEn || 'N/A';
                return (
                  <tr key={p.padaNumber} className={isChosen ? 'bg-[#f6e6c8] font-bold' : 'border-b border-[#a67c1f]/20'}>
                    <td className={`p-1.5 ${isChosen ? 'text-sm text-[#7a1f1f]' : ''}`}>
                      {p.padaNumber} {isChosen ? '★' : ''}
                    </td>
                    <td className={`p-1.5 ${isChosen ? 'text-3xl text-[#7a1f1f]' : 'text-2xl font-bold text-[#7a1f1f]'}`}>
                      {letter} {lang !== 'en' && <span className="text-xs font-normal text-[#7a1f1f]/70">({p.letterEn})</span>}
                    </td>
                    <td className="p-1.5 font-medium">{rasi}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[11px] text-[#2d5a3d] mt-1 italic font-semibold">
            {lang === 'ta'
              ? '★ இக்குழந்தையின் பிறப்பு பாதம் — இதன்படியே பெயர் வைக்கப்பட்டுள்ளது'
              : lang === 'hi'
              ? '★ इस बालक का जन्म पाद — इसी अनुसार नाम रखा गया है'
              : "★ This child's birth pada — the name is chosen accordingly"}
          </div>
        </div>

        {/* Positive Traits & Qualities (Gunam) */}
        <div className="bg-[#fbf6ea] border-l-4 border-[#2d5a3d] rounded p-2.5 sm:p-3 mb-3">
          <div className="text-xs font-bold text-[#2d5a3d] mb-1">
            ✨ {lang === 'ta' ? 'நன்மைகள் & குணநலன்கள்' : lang === 'hi' ? 'शुभ गुण' : 'Positive Traits & Qualities'}
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-xs text-[#331c0e]">
            {gunamList.map((trait, idx) => (
              <li key={idx} className="leading-relaxed">{trait}</li>
            ))}
          </ul>
        </div>

        {/* Natural Compatibility */}
        <div className="text-xs mb-3 leading-relaxed">
          <strong className="text-[#7a1f1f]">
            {lang === 'ta' ? 'இயல்பான பொருத்தம்' : lang === 'hi' ? 'स्वाभाविक अनुकूलता' : 'Natural Compatibility'}:{' '}
          </strong>
          <span>{lang === 'ta' ? 'கணம்' : lang === 'hi' ? 'गण' : 'Gana'}: <strong>{lang === 'ta' ? nak?.ganaTa || 'N/A' : lang === 'hi' ? nak?.ganaHi || 'N/A' : nak?.ganaEn || 'N/A'}</strong></span>
          &nbsp;|&nbsp;
          <span>{lang === 'ta' ? 'யோனி' : lang === 'hi' ? 'योनि' : 'Yoni'}: <strong>{lang === 'ta' ? nak?.yoniTa || 'N/A' : lang === 'hi' ? nak?.yoniHi || 'N/A' : nak?.yoniEn || 'N/A'}</strong></span>
          &nbsp;|&nbsp;
          <span>{lang === 'ta' ? 'ரஜ்ஜு' : lang === 'hi' ? 'रज्जु' : 'Rajju'}: <strong>{lang === 'ta' ? nak?.rajjuTa || 'N/A' : lang === 'hi' ? nak?.rajjuHi || 'N/A' : nak?.rajjuEn || 'N/A'}</strong></span>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-[#7a1f1f] pt-2.5 text-center">
          <div className="text-xs font-bold text-[#7a1f1f]">
            {lang === 'ta'
              ? '|| சுப மங்களம் • நல்வாழ்வு வாழ்த்துகள் ||'
              : lang === 'hi'
              ? '|| शुभ मंगलम् • दीर्घायु एवं कल्याण ||'
              : '|| SUBHA MANGALAM • BLESSINGS & PROSPERITY ||'}
          </div>
          <div className="text-[11.5px] leading-relaxed mt-1 text-[#5a4632]">
            {lang === 'ta'
              ? `அஸ்ட்ரோ சிவம் வேத ஜோதிட ஆசிகளுடன் ${babyName} குழந்தை நல்வாழ்வு, ஞானம், தீர்க்காயுள் மற்றும் சகல சௌபாக்கியங்களும் பெற்று சிறக்க வாழ ஆசீர்வதிக்கின்றோம்.`
              : lang === 'hi'
              ? `एस्ट्रो शिवम वैदिक ज्योतिषीय शुभकामनाओं के साथ, हम ${babyName} को उत्तम स्वास्थ्य, दीर्घायु, विद्या एवं समस्त सौभाग्य की प्राप्ति का आशीर्वाद देते हैं।`
              : `With ASTRO SIVAM sacred Vedic astrological blessings, we bless ${babyName} with health, wisdom, prosperity, and longevity.`}
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center text-[10.5px] mt-2.5 text-[#5a4632] gap-1">
            <span>
              <strong>{lang === 'ta' ? 'தேதி' : lang === 'hi' ? 'तिथि' : 'Date'}: </strong>{todayStr}
            </span>
            <span className="font-semibold">
              {lang === 'ta'
                ? 'அஸ்ட்ரோ சிவம் • வேத அறிஞர்கள் குழு'
                : lang === 'hi'
                ? 'एस्ट्रो शिवम • वैदिक विद्वान मंडल'
                : 'ASTRO SIVAM • Vedic Ephemeris Board'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
