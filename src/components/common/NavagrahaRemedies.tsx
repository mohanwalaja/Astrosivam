import React, { useState } from "react";

export const NAVAGRAHA_CONTENT = {
  ta: {
    title: "நவக்கிரகங்கள்",
    intro: "நவக்கிரகங்கள் என்பவர்கள் சூரியன் (Surya), சந்திரன் (Chandra), செவ்வாய் (Mangal), புதன் (Budha), குரு (Guru / Brihaspati), சுக்கிரன் (Shukra), சனி (Shani), ராகு (Rahu) மற்றும் கேது (Ketu) ஆகிய ஒன்பது கிரகங்கள் ஆவர். இவர்கள் நமக்குக் கஷ்டங்களைத் தருவதில்லை; மாறாக, நாம் செய்த முன்வினைப் பயன்களை (கர்மா) அறுவடை செய்ய உதவும் நடுநிலையான நீதிபதிகளாக மட்டுமே செயல்படுகிறார்கள்.",
    reasonsTitle: "கஷ்டங்கள் தருவதன் காரணங்கள்",
    reasons: [
      { h: "கர்ம வினைப் பயன்", p: "முன்பிறவிகளிலும் இப்பிறவியிலும் செய்த பாவ, புண்ணிய கணக்குகளின்படியே கிரகங்கள் பலன்களைத் தருகின்றன." },
      { h: "தண்டனை அல்ல, திருத்தம்", p: "தவறுகளை உணர்ந்து திருத்திக் கொள்வதற்காகவே கஷ்டங்கள் வருகின்றன." },
      { h: "அகந்தையை அழித்தல்", p: "பேராசை, தலைக்கனம், அகந்தையை அடக்கி இறைவனிடம் சரணடைய வைக்கும்." },
      { h: "ஆத்ம வளர்ச்சி", p: "இக்கட்டான சூழ்நிலைகள் பொறுமையையும் மனப்பக்குவத்தையும் உண்டாக்குகின்றன." },
    ],
    closing: "வாழ்க்கையில் வரும் கஷ்டங்கள் அனைத்தும் தற்காலிகமானவையே. அவை நம்மைப் புடம் போட்ட தங்கமாக மாற்றுவதற்கே தவிர, அழிப்பதற்காக அல்ல.",
  },
  en: {
    title: "The Navagrahas",
    intro: "The Navagrahas are the nine celestial influencers: Surya (Sun), Chandra (Moon), Mangal / Chevvai (Mars), Budha (Mercury), Guru / Brihaspati (Jupiter), Shukra (Venus), Shani (Saturn), Rahu and Ketu. They do not cause hardship out of malice — they act as impartial judges who help us reap the results of our own past actions (karma).",
    reasonsTitle: "Why the Navagrahas Bring Difficulties",
    reasons: [
      { h: "Fruits of Karma", p: "Results are delivered based on deeds accumulated across past lives and this life." },
      { h: "Correction, Not Punishment", p: "Hardships help us recognize mistakes and reform." },
      { h: "Dissolving the Ego", p: "Trials curb greed and pride, bringing wisdom and humility." },
      { h: "Growth of the Soul", p: "Difficult circumstances teach patience and maturity." },
    ],
    closing: "All hardships in life are temporary. They exist to purify us like gold tested in fire — not to destroy us.",
  },
  hi: {
    title: "नवग्रह",
    intro: "नवग्रह नौ ग्रह हैं — सूर्य (Surya), चंद्र (Chandra), मंगल (Mangal), बुध (Budha), गुरु (Guru / Brihaspati), शुक्र (Shukra), शनि (Shani), राहु (Rahu) और केतु (Ketu)। ये हमें कष्ट देने के लिए नहीं, बल्कि हमारे पूर्वकर्मों (कर्म) के फलों को भुगतने में सहायता करने वाले निष्पक्ष न्यायाधीशों के रूप में कार्य करते हैं।",
    reasonsTitle: "नवग्रह कष्ट क्यों देते हैं",
    reasons: [
      { h: "कर्मफल", p: "पूर्वजन्मों और इस जन्म के कर्मों के अनुसार ही ग्रह फल देते हैं।" },
      { h: "दंड नहीं, सुधार", p: "गलतियों का एहसास कराकर सुधारने के लिए कष्ट आते हैं।" },
      { h: "अहंकार का नाश", p: "लोभ और अहंकार को त्यागकर विनम्रता और विवेक अपनाने की प्रेरणा मिलती है।" },
      { h: "आत्मिक विकास", p: "कठिन परिस्थितियाँ धैर्य और परिपक्वता सिखाती हैं।" },
    ],
    closing: "जीवन में आने वाले सभी कष्ट अस्थायी हैं। वे हमें शुद्ध सोने की तरह तपाने के लिए आते हैं, नष्ट करने के लिए नहीं।",
  },
};

const LANG_LABELS: Record<string, string> = { ta: "தமிழ்", en: "English", hi: "हिन्दी" };

export interface NavagrahaRemediesProps {
  lang?: 'ta' | 'en' | 'hi';
}

/**
 * NavagrahaRemedies — static content, identical for every user.
 * Page 3 philosophical and remedial guidance section.
 */
export default function NavagrahaRemedies({ lang: langProp }: NavagrahaRemediesProps) {
  const [internalLang] = useState<'ta' | 'en' | 'hi'>('en');
  const lang = langProp || internalLang;
  const t = NAVAGRAHA_CONTENT[lang] || NAVAGRAHA_CONTENT.en;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 40px", fontFamily: "'Noto Sans',sans-serif", color: "#331c0e" }}>
      <h1 style={{ textAlign: "center", color: "#7a1f1f", fontSize: 24, marginBottom: 16 }}>{t.title}</h1>
      <p style={{ lineHeight: 1.7, fontSize: 15, marginBottom: 20 }}>{t.intro}</p>

      <h2 style={{ color: "#a67c1f", fontSize: 18, borderBottom: "1px dotted #a67c1f", paddingBottom: 6 }}>{t.reasonsTitle}</h2>
      {t.reasons.map((item, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <strong style={{ color: "#7a1f1f" }}>{item.h}:</strong> <span style={{ lineHeight: 1.7 }}>{item.p}</span>
        </div>
      ))}

      <p style={{ marginTop: 20, fontStyle: "italic", lineHeight: 1.7, color: "#2d5a3d" }}>{t.closing}</p>
    </div>
  );
}
