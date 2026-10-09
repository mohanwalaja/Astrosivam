// src/services/gunamData.ts
// Positive-traits ("gunam") text for the baby naming certificate.

export interface GunamSet {
  ta: string[];
  en: string[];
  hi: string[];
}

export const RASI_GUNAM: Record<string, GunamSet> = {
  mesham: { // Aries
    ta: ["துணிச்சலும் தலைமைத் திறனும் இயல்பாகவே அமையும்.", "விரைவான முடிவெடுக்கும் ஆற்றல்.", "புதிய முயற்சிகளில் முன்னின்று செயல்படும் குணம்."],
    en: ["Natural courage and leadership instincts.", "Quick, decisive thinking.", "A pioneering spirit that takes initiative."],
    hi: ["स्वाभाविक साहस और नेतृत्व क्षमता।", "त्वरित एवं निर्णायक सोच।", "नई पहल में अग्रणी रहने का स्वभाव।"],
  },
  rishabam: { // Taurus
    ta: ["பொறுமையும் உறுதியான மனநிலையும் கொண்டவர்.", "அழகியல் மற்றும் கலைகளில் இயல்பான ஈர்ப்பு.", "நம்பகத்தன்மையும் நடைமுறை புத்தியும்."],
    en: ["Patient with a steady, grounded temperament.", "A natural appreciation for beauty and the arts.", "Reliable and practical-minded."],
    hi: ["धैर्यवान और स्थिर स्वभाव।", "सौंदर्य और कला के प्रति स्वाभाविक रुचि।", "विश्वसनीय और व्यावहारिक सोच।"],
  },
  mithunam: { // Gemini
    ta: ["விரைவான புரிதலும் நல்ல தொடர்பாடல் திறனும்.", "ஆர்வமும் அறிவார்வமும் மிக்கவர்.", "பன்முக திறமைகளுடன் விளங்குவர்."],
    en: ["Quick understanding and strong communication skills.", "Curious and eager to learn.", "Versatile, with talents across many areas."],
    hi: ["त्वरित समझ और अच्छा संवाद कौशल।", "जिज्ञासु और सीखने के इच्छुक।", "बहुमुखी प्रतिभा के धनी।"],
  },
  kadagam: { // Cancer
    ta: ["ஆழ்ந்த உணர்வுபூர்வமான குணமும் அக்கறையும்.", "குடும்ப பாசமும் பாதுகாக்கும் மனப்பான்மையும்.", "நல்ல நினைவாற்றலும் உள்ளுணர்வும்."],
    en: ["Deeply empathetic and caring nature.", "Strong family bonds and a protective instinct.", "Good memory paired with sharp intuition."],
    hi: ["गहरी संवेदनशीलता और देखभाल का स्वभाव।", "पारिवारिक स्नेह और सुरक्षात्मक प्रवृत्ति।", "अच्छी स्मरण शक्ति और सहज ज्ञान।"],
  },
  simmam: { // Leo
    ta: ["இயல்பான தலைமைத்துவமும் தன்னம்பிக்கையும்.", "பெருந்தன்மையும் கம்பீரமான பண்பும்.", "பிறரை ஊக்குவிக்கும் ஆற்றல்."],
    en: ["Natural leadership and self-confidence.", "Generous, with a dignified presence.", "The ability to inspire and motivate others."],
    hi: ["स्वाभाविक नेतृत्व और आत्मविश्वास।", "उदार स्वभाव और गरिमामय व्यक्तित्व।", "दूसरों को प्रेरित करने की क्षमता।"],
  },
  kanni: { // Virgo
    ta: ["நுட்பமான அறிவும் ஒழுங்குபடுத்தும் திறனும்.", "நேர்மையும் விவரங்களில் கவனமும்.", "சேவை மனப்பான்மையும் உதவும் குணமும்."],
    en: ["Sharp analytical mind and strong organizational skill.", "Honest, with careful attention to detail.", "A service-oriented, helpful disposition."],
    hi: ["तीक्ष्ण बुद्धि और व्यवस्थित सोच।", "ईमानदार और विवरणों पर ध्यान देने वाला स्वभाव।", "सेवाभाव और सहायक प्रवृत्ति।"],
  },
  thulam: { // Libra
    ta: ["நியாய உணர்வும் சமநிலை பேணும் குணமும்.", "நல்லுறவுகளை வளர்க்கும் திறன்.", "அழகியல் மற்றும் கலை உணர்வு."],
    en: ["A strong sense of fairness and balance.", "Skilled at building harmonious relationships.", "An eye for beauty and aesthetics."],
    hi: ["न्यायप्रियता और संतुलित स्वभाव।", "सामंजस्यपूर्ण संबंध बनाने में कुशल।", "सौंदर्यबोध और कलात्मक दृष्टि।"],
  },
  viruchigam: { // Scorpio
    ta: ["ஆழ்ந்த உறுதியும் மன வலிமையும்.", "ஆராய்ச்சி மனப்பான்மையும் கூர்மையான புத்தியும்.", "உண்மையான நட்பையும் விசுவாசத்தையும் மதிக்கும் குணம்."],
    en: ["Deep determination and inner strength.", "A probing, investigative mind.", "Values loyalty and genuine bonds."],
    hi: ["गहरा संकल्प और आंतरिक शक्ति।", "जिज्ञासु और गहन सोच।", "सच्ची मित्रता और निष्ठा को महत्व देना।"],
  },
  dhanusu: { // Sagittarius
    ta: ["தத்துவ ஞானமும் விரிந்த பார்வையும்.", "நேர்மையும் வெளிப்படையான குணமும்.", "பயணம் மற்றும் புதிய அனுபவங்களில் ஆர்வம்."],
    en: ["A philosophical mind with a broad outlook.", "Honest and straightforward by nature.", "A love of travel and new experiences."],
    hi: ["दार्शनिक सोच और व्यापक दृष्टिकोण।", "ईमानदार और स्पष्टवादी स्वभाव।", "यात्रा और नए अनुभवों के प्रति रुचि।"],
  },
  makaram: { // Capricorn
    ta: ["உறுதியான இலக்கு நோக்கிய முயற்சியும் பொறுப்புணர்வும்.", "கடின உழைப்பும் நடைமுறை புத்தியும்.", "பொறுமையுடன் நீண்ட கால வெற்றியை நோக்கி செல்லும் குணம்."],
    en: ["Goal-driven effort with a strong sense of responsibility.", "Hard-working and practical.", "Patient, steady progress toward long-term success."],
    hi: ["लक्ष्य-उन्मुख प्रयास और उत्तरदायित्व की भावना।", "मेहनती और व्यावहारिक स्वभाव।", "दीर्घकालिक सफलता की ओर धैर्यपूर्वक अग्रसर।"],
  },
  kumbam: { // Aquarius
    ta: ["புதுமையான சிந்தனையும் சுதந்திர மனப்பான்மையும்.", "சமூக நலனில் அக்கறையும் நட்பு உணர்வும்.", "தனித்துவமான பார்வையுடன் செயல்படும் குணம்."],
    en: ["Innovative thinking with an independent spirit.", "Socially conscious and friendly.", "A distinctive, original perspective."],
    hi: ["नवीन सोच और स्वतंत्र स्वभाव।", "सामाजिक चेतना और मित्रवत स्वभाव।", "विशिष्ट एवं मौलिक दृष्टिकोण।"],
  },
  meenam: { // Pisces
    ta: ["இரக்க குணமும் படைப்பாற்றலும் இயல்பாகவே அமையும்.", "ஆன்மீக நாட்டமும் நல்லுள்ளமும் கொண்டவர்.", "குரு பகவானின் ஆசியால் அறிவும் நல் வழிகாட்டுதலும் பெறுவர்."],
    en: ["A compassionate, naturally creative disposition.", "Spiritually inclined with a kind heart.", "Blessed with wisdom and good guidance under Jupiter's grace."],
    hi: ["करुणामय और स्वाभाविक रूप से रचनात्मक स्वभाव।", "आध्यात्मिक झुकाव और दयालु हृदय।", "गुरु की कृपा से ज्ञान और सुमार्गदर्शन प्राप्त होगा।"],
  },
};

export const NAKSHATRAM_GUNAM: Record<string, GunamSet> = {
  ashwini: {
    ta: [
      "விரைவான செயல்பாடும் புத்துணர்வும் கொண்டவர்.",
      "குணப்படுத்தும் திறனும் உதவும் மனப்பான்மையும்.",
      "துணிச்சலுடன் புதிய தொடக்கங்களை ஏற்கும் குணம்."
    ],
    en: [
      "Quick to act, with a fresh, energetic outlook.",
      "A natural healer's instinct and willingness to help.",
      "Bold in embracing new beginnings."
    ],
    hi: [
      "त्वरित कार्यशैली और ऊर्जावान स्वभाव।",
      "उपचार की स्वाभाविक क्षमता और सहायक प्रवृत्ति।",
      "नई शुरुआत को साहसपूर्वक अपनाने का स्वभाव।"
    ],
  },
  bharani: {
    ta: [
      "உறுதியான மன வலிமையும் பொறுப்புணர்வும்.",
      "நேர்மையும் கடின உழைப்பும்.",
      "பாதுகாக்கும் மற்றும் வளர்க்கும் இயல்பு."
    ],
    en: [
      "Strong willpower and a deep sense of responsibility.",
      "Honest and hard-working.",
      "A nurturing, protective nature."
    ],
    hi: [
      "दृढ़ इच्छाशक्ति और उत्तरदायित्व की भावना।",
      "ईमानदार और परिश्रमी स्वभाव।",
      "पोषण और सुरक्षा की स्वाभाविक प्रवृत्ति।"
    ],
  },
  krittika: {
    ta: [
      "சுடர் போன்ற அறிவுக்கூர்மையும் தெளிவான சிந்தனையும்.",
      "நேர்மையான பேச்சும் நீதியை நிலைநாட்டும் குணமும்.",
      "பிறரை வழிநடத்தும் ஆற்றல்."
    ],
    en: [
      "Radiant intellect with sharp, clear thinking.",
      "Truthful speech with a passion for righteousness.",
      "Inherent ability to guide and lead others."
    ],
    hi: [
      "तेजस्वी बुद्धि और स्पष्ट विचार।",
      "सत्यवादी वाणी और न्यायप्रिय स्वभाव।",
      "दूसरों का मार्गदर्शन करने की स्वाभाविक क्षमता।"
    ],
  },
  rohini: {
    ta: [
      "கவர்ச்சிகரமான ஆளுமையும் கலை உணர்வும்.",
      "பொருளாதார செழிப்பையும் வளத்தையும் ஈர்க்கும் குணம்.",
      "அன்பான மற்றும் பராமரிக்கும் இயல்பு."
    ],
    en: [
      "A charming personality with a strong artistic sense.",
      "Draws material comfort and prosperity.",
      "Warm, nurturing, and affectionate."
    ],
    hi: [
      "आकर्षक व्यक्तित्व और कलात्मक अभिरुचि।",
      "समृद्धि और भौतिक सुख को आकर्षित करने वाला स्वभाव।",
      "स्नेही और पालन-पोषण करने वाला स्वभाव।"
    ],
  },
  mrigashirsha: {
    ta: [
      "ஆராய்ச்சி மனமும் மென்மையான பேச்சும் கொண்டவர்.",
      "புதிய தகவல்களை விரைவாக கற்கும் ஆர்வம்.",
      "நட்பான மற்றும் விசுவாசமான குணம்."
    ],
    en: [
      "An inquiring mind paired with gentle speech.",
      "Keen curiosity and rapid learning ability.",
      "Friendly, loyal, and sincere in companionship."
    ],
    hi: [
      "जिज्ञासु मन और मधुर वाणी।",
      "नई जानकारी तेजी से सीखने की लगन।",
      "मित्रवत, वफादार और सच्चा स्वभाव।"
    ],
  },
  ardra: {
    ta: [
      "ஆழ்ந்த அறிவுத்திறனும் நுண்ணறிவும் கொண்டவர்.",
      "சவால்களை சமாளிக்கும் மனோபலம்.",
      "புதுமையான மாற்றங்களை உருவாக்கும் ஆற்றல்."
    ],
    en: [
      "Deep intellectual capacity and keen intuition.",
      "Resilience in overcoming difficult challenges.",
      "Transformative power that sparks positive change."
    ],
    hi: [
      "गहन बौद्धिक क्षमता और तीक्ष्ण अंतर्ज्ञान।",
      "कठिन चुनौतियों से उबरने का धैर्य।",
      "सकारात्मक परिवर्तन लाने की सामर्थ्य।"
    ],
  },
  punarvasu: {
    ta: [
      "பெருந்தன்மையும் நேர்மறையான மனப்பான்மையும்.",
      "ஆன்மீக நாட்டமும் நீதி நெறி தவறாத வாழ்வும்.",
      "தோல்விகளிலிருந்து மீண்டு வெற்றி பெறும் பண்பு."
    ],
    en: [
      "Generous, noble-hearted, and optimistic.",
      "Devoted to spiritual wisdom and moral values.",
      "Remarkable ability to bounce back and succeed."
    ],
    hi: [
      "उदार हृदय और आशावादी दृष्टिकोण।",
      "आध्यात्मिक ज्ञान और नैतिक मूल्यों के प्रति समर्पित।",
      "विपत्तियों से उबरकर सफल होने का गुण।"
    ],
  },
  pushya: {
    ta: [
      "அனைவரையும் அரவணைக்கும் தாயுள்ளம் கொண்டவர்.",
      "ஞானமும் முதிர்ந்த சிந்தனையும் இயல்பாகவே அமையும்.",
      "அனைத்து செயல்களிலும் சுப அனுகூலம் பெறுவர்."
    ],
    en: [
      "Nurturing, compassionate, and universally supportive.",
      "Blessed with natural wisdom and maturity.",
      "Endowed with auspicious fortune in undertakings."
    ],
    hi: [
      "पालन-पोषण करने वाला और करुणामय स्वभाव।",
      "स्वाभाविक ज्ञान और परिपक्व सोच।",
      "सभी कार्यों में शुभता और सफलता प्राप्त करने वाले।"
    ],
  },
  ashlesha: {
    ta: [
      "நுட்பமான புத்திசாலித்தனமும் உள்ளுணர்வு ஆற்றலும்.",
      "விவேகமான முடிவெடுக்கும் திறன்.",
      "தன்னை சார்ந்தவர்களை பாதுகாக்கும் மனப்பான்மை."
    ],
    en: [
      "Astute intelligence with deep psychic sensitivity.",
      "Strategic thinking and shrewd judgment.",
      "Fiercely protective of loved ones."
    ],
    hi: [
      "चतुर बुद्धि और गहरा अंतर्ज्ञान।",
      "रणनीतिक सोच और विवेकपूर्ण निर्णय।",
      "अपने प्रियजनों की रक्षा करने की भावना।"
    ],
  },
  magha: {
    ta: [
      "கம்பீரமான ஆளுமையும் பாரம்பரிய மதிப்பும்.",
      "தலைமை தாங்கும் இயல்பான தகுதி.",
      "பெரியோர்களை மதித்து நற்பெயர் ஈட்டும் குணம்."
    ],
    en: [
      "Dignified persona with deep respect for lineage and tradition.",
      "Natural authoritative leadership.",
      "Earns high honor and respect from society."
    ],
    hi: [
      "गरिमामय व्यक्तित्व और परंपराओं का सम्मान।",
      "स्वाभाविक नेतृत्व और अधिकार।",
      "समाज में आदर और प्रतिष्ठा पाने वाले।"
    ],
  },
  purvaphalguni: {
    ta: [
      "மகிழ்ச்சியான சுபாவமும் கலை ஆர்வமும்.",
      "தாராள மனமும் கவர்ச்சியான ஆளுமையும்.",
      "சமூகத்தில் அனைவராலும் விரும்பப்படும் நற்பண்பு."
    ],
    en: [
      "Joyful, creative, and lovers of life's refined pleasures.",
      "Generous spirit and magnetic social grace.",
      "Naturally popular and well-liked by all."
    ],
    hi: [
      "आनंदमय स्वभाव और कला के प्रति प्रेम।",
      "उदार हृदय और आकर्षक व्यक्तित्व।",
      "समाज में लोकप्रिय और स्नेही।"
    ],
  },
  uttaraphalguni: {
    ta: [
      "கொடுத்த வாக்கைக் காப்பாற்றும் உத்தம குணம்.",
      "நட்பில் விசுவாசமும் நேர்மையும்.",
      "பிறருக்கு உதவும் வள்ளல் தன்மை."
    ],
    en: [
      "Steadfast integrity and dedication to promises.",
      "Deeply loyal and trustworthy friend.",
      "Philanthropic and ever-ready to assist."
    ],
    hi: [
      "वचनबद्धता और सत्यनिष्ठा।",
      "सच्ची मित्रता और विश्वसनीयता।",
      "परोपकारी और दूसरों की मदद के लिए तत्पर।"
    ],
  },
  hasta: {
    ta: [
      "கைத்தொழில் மற்றும் படைப்பாற்றலில் சிறந்த தேர்ச்சி.",
      "புத்திசாலித்தனமான நகைச்சுவை உணர்வும் சுறுசுறுப்பும்.",
      "சிக்கல்களை எளிதில் தீர்க்கும் திறன்."
    ],
    en: [
      "Exceptional dexterity and creative craft skills.",
      "Witty intellect and lively, industrious spirit.",
      "Knack for practical problem-solving."
    ],
    hi: [
      "हस्तशिल्प और रचनात्मकता में निपुणता।",
      "हाजिरजवाबी और परिश्रमी स्वभाव।",
      "समस्याओं का व्यावहारिक समाधान खोजने की कला।"
    ],
  },
  chitra: {
    ta: [
      "அழகியல் ஞானமும் தனித்துவமான வடிவமைக்கும் திறனும்.",
      "கவர்ச்சிகரமான பேச்சும் தோற்றமும்.",
      "எதிலும் முழுமையை நாடும் உன்னத நோக்கம்."
    ],
    en: [
      "Brilliant aesthetic sense and architectural flair.",
      "Charismatic presentation and captivating speech.",
      "Strives for excellence and perfection in work."
    ],
    hi: [
      "सौंदर्यबोध और विलक्षण रचनात्मक दृष्टि।",
      "आकर्षक अभिव्यक्ति और वाणी।",
      "हर कार्य में पूर्णता और उत्कृष्टता की चाह।"
    ],
  },
  swati: {
    ta: [
      "சுதந்திர சிந்தனையும் மென்மையான பண்பும்.",
      "வியாபாரம் மற்றும் நிதியில் நல்ல வெற்றி.",
      "அனைவரிடமும் இனிமையாக பழகும் நற்குணம்."
    ],
    en: [
      "Independent thinker with a courteous demeanor.",
      "Aptitude for commerce, diplomacy, and prosperity.",
      "Sweet-spoken and adaptable in diverse environments."
    ],
    hi: [
      "स्वतंत्र सोच और विनम्र स्वभाव।",
      "व्यापार और वित्त में सफलता की संभावना।",
      "मधुरभाषी और सभी के साथ तालमेल बिठाने वाले।"
    ],
  },
  vishakha: {
    ta: [
      "இலக்குகளை வென்றெடுக்கும் விடாமுயற்சி.",
      "கூர்மையான புத்தியும் குறிக்கோள் கொண்ட வாழ்வும்.",
      "ஆன்மீக மற்றும் உலகியல் துறைகளில் சாதனை."
    ],
    en: [
      "Tenacious determination to achieve ambitious goals.",
      "Focused intellect and clear sense of purpose.",
      "Balances material achievement with spiritual insight."
    ],
    hi: [
      "लक्ष्य प्राप्ति के लिए दृढ़ संकल्प और परिश्रम।",
      "तीक्ष्ण बुद्धि और स्पष्ट दृष्टिकोण।",
      "भौतिक और आध्यात्मिक दोनों क्षेत्रों में सफलता।"
    ],
  },
  anuradha: {
    ta: [
      "அன்பான நட்பும் நேர்மையான மனமும்.",
      "வெளிநாடு மற்றும் வெளிவட்டார தொடர்புகளால் நன்மை.",
      "இறை பக்தியும் சேவை மனப்பான்மையும்."
    ],
    en: [
      "Devoted friend with a genuine, harmonious heart.",
      "Success and prosperity through distant travels and alliances.",
      "Deep spiritual devotion and service mentality."
    ],
    hi: [
      "सच्ची मित्रता और निश्छल हृदय।",
      "दूरस्थ संबंधों और यात्राओं से लाभ।",
      "ईश्वर भक्ति और परोपकारी स्वभाव।"
    ],
  },
  jyeshta: {
    ta: [
      "மூத்த தலைமை பண்பும் பாதுகாக்கும் வலிமையும்.",
      "தைரியமான மனமும் பொறுப்புணர்வும்.",
      "சமூகத்தில் செல்வாக்கும் மரியாதையும்."
    ],
    en: [
      "Elderly wisdom, authority, and protective strength.",
      "Courageous spirit and high sense of responsibility.",
      "Natural prominence and respect in community."
    ],
    hi: [
      "वरिष्ठ नेतृत्व और सुरक्षा की भावना।",
      "साहसी और उत्तरदायी व्यक्तित्व।",
      "समाज में सम्मान और प्रभाव।"
    ],
  },
  moola: {
    ta: [
      "விஷயங்களின் ஆழம் வரை சென்று அறியும் கூர்மை.",
      "நேர்மையும் தத்துவ சிந்தனையும்.",
      "ஆன்மீக ஞானமும் மன உறுதியும்."
    ],
    en: [
      "Deep, probing mind that seeks foundational truths.",
      "Philosophical depth and unwavering directness.",
      "Spiritual resilience and breakthrough power."
    ],
    hi: [
      "गहन शोधकर्ता बुद्धि जो मूल सत्य तक पहुंचती है।",
      "दार्शनिक गहराई और स्पष्टवादिता।",
      "आध्यात्मिक शक्ति और आंतरिक दृढ़ता।"
    ],
  },
  purvashada: {
    ta: [
      "வெற்றியை கவரும் அசாத்திய தன்னம்பிக்கை.",
      "அழகான பேச்சும் மக்கள் செல்வாக்கும்.",
      "அன்பும் இரக்கமும் நிறைந்த பெருந்தன்மை."
    ],
    en: [
      "Invincible self-confidence and optimistic magnetism.",
      "Eloquent communicator who wins hearts.",
      "Generous and deeply compassionate toward all."
    ],
    hi: [
      "अपराजेय आत्मविश्वास और चुंबकीय व्यक्तित्व।",
      "प्रभावशाली वक्ता और लोकप्रिय स्वभाव।",
      "उदार और दयालु हृदय।"
    ],
  },
  uttarashada: {
    ta: [
      "அனைவராலும் மதிக்கப்படும் சாந்தமும் நீதியும்.",
      "அமைதியான உழைப்பும் நிலையான வெற்றியும்.",
      "தர்ம நெறி தவறாத உத்தம வாழ்வு."
    ],
    en: [
      "Enduring patience, righteousness, and humility.",
      "Steady, dedicated effort resulting in lasting victories.",
      "Living in alignment with high ethical values."
    ],
    hi: [
      "धैर्यवान, विनम्र और न्यायप्रिय स्वभाव।",
      "निरंतर परिश्रम से स्थायी सफलता।",
      "धर्म और सदाचार के मार्ग पर चलने वाले।"
    ],
  },
  shravana: {
    ta: [
      "நல்லவற்றை கேட்கும் ஆர்வமும் கற்றல் திறனும்.",
      "அறிவார்ந்த பேச்சும் நற்பெயரும்.",
      "பெரியோர்களிடம் பணிவும் இறை பக்தியும்."
    ],
    en: [
      "Attentive listener with great thirst for knowledge.",
      "Wise speech that earns high esteem.",
      "Reverence for elders, teachers, and the Divine."
    ],
    hi: [
      "उत्कृष्ट श्रोता और ज्ञानार्जन की तीव्र इच्छा।",
      "विवेकपूर्ण वाणी और उच्च प्रतिष्ठा।",
      "गुरुजनों और ईश्वर के प्रति अगाध श्रद्धा।"
    ],
  },
  dhanishta: {
    ta: [
      "இசை, கலை மற்றும் செல்வ வளம் சேரும் யோகம்.",
      "தைரியமும் தாராள மனப்பான்மையும்.",
      "சமூகத்தில் மதிப்பும் உயர் நிலையும்."
    ],
    en: [
      "Affinity for music, rhythm, and material abundance.",
      "Courageous, bold, and charitable disposition.",
      "High status and prominence in social circles."
    ],
    hi: [
      "संगीत, कला और धन-धान्य का शुभ योग।",
      "साहसी, उदार और परोपकारी।",
      "समाज में प्रतिष्ठा और उच्च पद।"
    ],
  },
  shatabhisha: {
    ta: [
      "குணப்படுத்தும் ஆற்றலும் ரகசியங்களை அறியும் கூர்மையும்.",
      "சுயாதீன சிந்தனையும் தூர நோக்கும்.",
      "உண்மையை நிலைநாட்டும் உறுதி."
    ],
    en: [
      "Healing abilities and profound esoteric insight.",
      "Visionary perspective with an independent mind.",
      "Steadfast commitment to universal truth."
    ],
    hi: [
      "आरोग्य प्रदाता गुण और गूढ़ ज्ञान की समझ।",
      "दूरदर्शी और स्वतंत्र सोच।",
      "सत्य के प्रति अटूट निष्ठा।"
    ],
  },
  purvabhadrapada: {
    ta: [
      "ஆன்மீக ஆழமும் இலட்சியவாத சிந்தனையும்.",
      "உண்மையை தைரியமாக பேசும் பண்பு.",
      "உயர்ந்த கொள்கைகளுக்காக பாடுபடும் மனப்பான்மை."
    ],
    en: [
      "Spiritual depth and elevated philosophical ideals.",
      "Courageous champion of truth and honesty.",
      "Selfless dedication to noble principles."
    ],
    hi: [
      "आध्यात्मिक गहराई और उच्च आदर्शवादी सोच।",
      "सत्यवादी और स्पष्टवादी स्वभाव।",
      "महान सिद्धांतों के लिए समर्पित।"
    ],
  },
  uthirattathi: {
    ta: [
      "ஆழ்ந்த கருணையும் அனைவரிடமும் அன்பு காட்டும் இயல்பும் கொண்டவர்.",
      "நல்ல உள்ளுணர்வு மற்றும் தூர நோக்குடன் முடிவெடுக்கும் திறன்.",
      "ஆன்மீகத்தில் இயல்பான ஈடுபாடு; இறை பக்தி வளரும்.",
      "பிறருக்கு உதவும் பண்பும், தன்னலமற்ற சேவை மனப்பான்மையும்.",
      "கலை, இசை அல்லது படைப்பாற்றல் துறைகளில் ஆர்வம் காட்டக்கூடும்.",
      "பொறுமையும் அமைதியான குணமும் வாழ்வில் நல்ல பெயரை பெற்றுத் தரும்."
    ],
    en: [
      "Deep compassion and a natural warmth toward everyone around them.",
      "Strong intuition paired with far-sighted, thoughtful decision-making.",
      "A natural inclination toward spirituality and devotion.",
      "A helpful nature with a selfless, service-minded outlook.",
      "Likely affinity for the arts, music, or creative pursuits.",
      "Patience and a calm temperament that earn lasting goodwill."
    ],
    hi: [
      "गहरी करुणा और सभी के प्रति स्वाभाविक स्नेह।",
      "मजबूत अंतर्ज्ञान के साथ दूरदर्शी और विचारशील निर्णय क्षमता।",
      "आध्यात्मिकता और भक्ति की ओर स्वाभाविक झुकाव।",
      "सहायक स्वभाव और निःस्वार्थ सेवा भावना।",
      "कला, संगीत या रचनात्मक क्षेत्रों में रुचि संभव।",
      "धैर्य और शांत स्वभाव जीवन में सम्मान दिलाता है।"
    ],
  },
  uttarabhadrapada: {
    ta: [
      "ஆழ்ந்த கருணையும் அனைவரிடமும் அன்பு காட்டும் இயல்பும் கொண்டவர்.",
      "நல்ல உள்ளுணர்வு மற்றும் தூர நோக்குடன் முடிவெடுக்கும் திறன்.",
      "ஆன்மீகத்தில் இயல்பான ஈடுபாடு; இறை பக்தி வளரும்.",
      "பிறருக்கு உதவும் பண்பும், தன்னலமற்ற சேவை மனப்பான்மையும்.",
      "கலை, இசை அல்லது படைப்பாற்றல் துறைகளில் ஆர்வம் காட்டக்கூடும்.",
      "பொறுமையும் அமைதியான குணமும் வாழ்வில் நல்ல பெயரை பெற்றுத் தரும்."
    ],
    en: [
      "Deep compassion and a natural warmth toward everyone around them.",
      "Strong intuition paired with far-sighted, thoughtful decision-making.",
      "A natural inclination toward spirituality and devotion.",
      "A helpful nature with a selfless, service-minded outlook.",
      "Likely affinity for the arts, music, or creative pursuits.",
      "Patience and a calm temperament that earn lasting goodwill."
    ],
    hi: [
      "गहरी करुणा और सभी के प्रति स्वाभाविक स्नेह।",
      "मजबूत अंतर्ज्ञान के साथ दूरदर्शी और विचारशील निर्णय क्षमता।",
      "आध्यात्मिकता और भक्ति की ओर स्वाभाविक झुकाव।",
      "सहायक स्वभाव और निःस्वार्थ सेवा भावना।",
      "कला, संगीत या रचनात्मक क्षेत्रों में रुचि संभव।",
      "धैर्य और शांत स्वभाव जीवन में सम्मान दिलाता है।"
    ],
  },
  revati: {
    ta: [
      "மென்மையான உள்ளமும் அனைவரையும் அரவணைக்கும் அன்பும்.",
      "பயணங்கள் மற்றும் கலைகளில் நல்ல விருப்பம்.",
      "சகல சௌபாக்கியங்களும் நல்வளமும் சேரும் யோகம்."
    ],
    en: [
      "Gentle, pure-hearted, and unconditionally loving.",
      "Affinity for spiritual journeys and expressive arts.",
      "Blessed with abundant peace, prosperity, and joy."
    ],
    hi: [
      "कोमल हृदय और निस्वार्थ प्रेम।",
      "यात्राओं और ललित कलाओं में रुचि।",
      "सुख-समृद्धि और शांति का वरदान प्राप्त।"
    ],
  },
};

// Aliases and index mapping for robust lookup
const NAKSHATRA_INDEX_MAP: Record<number, string> = {
  1: 'ashwini',
  2: 'bharani',
  3: 'krittika',
  4: 'rohini',
  5: 'mrigashirsha',
  6: 'ardra',
  7: 'punarvasu',
  8: 'pushya',
  9: 'ashlesha',
  10: 'magha',
  11: 'purvaphalguni',
  12: 'uttaraphalguni',
  13: 'hasta',
  14: 'chitra',
  15: 'swati',
  16: 'vishakha',
  17: 'anuradha',
  18: 'jyeshtha',
  19: 'moola',
  20: 'purvaashadha',
  21: 'uttaraashadha',
  22: 'shravana',
  23: 'dhanishta',
  24: 'shatabhisha',
  25: 'purvabhadrapada',
  26: 'uttarabhadrapada',
  27: 'revati'
};

const NAKSHATRA_ALIAS_MAP: Record<string, string> = {
  // Tamil names
  'அசுவினி': 'ashwini',
  'அஸ்வினி': 'ashwini',
  'பரணி': 'bharani',
  'கார்த்திகை': 'krittika',
  'கிருத்திகை': 'krittika',
  'ரோகிணி': 'rohini',
  'மிருகசீரிஷம்': 'mrigashirsha',
  'மிருகசீரிடம்': 'mrigashirsha',
  'மிருகசீர்ஷம்': 'mrigashirsha',
  'திருவாதிரை': 'ardra',
  'புனர்பூசம்': 'punarvasu',
  'பூசம்': 'pushya',
  'ஆயில்யம்': 'ashlesha',
  'மகம்': 'magha',
  'பூரம்': 'purvaphalguni',
  'உத்திரம்': 'uttaraphalguni',
  'அஸ்தம்': 'hasta',
  'சித்திரை': 'chitra',
  'சுவாதி': 'swati',
  'விசாகம்': 'vishakha',
  'அனுஷம்': 'anuradha',
  'கேட்டை': 'jyeshtha',
  'மூலம்': 'moola',
  'பூராடம்': 'purvaashadha',
  'உத்திராடம்': 'uttaraashadha',
  'திருவோணம்': 'shravana',
  'அவிட்டம்': 'dhanishta',
  'சதயம்': 'shatabhisha',
  'பூரட்டாதி': 'purvabhadrapada',
  'உத்திரட்டாதி': 'uttarabhadrapada',
  'ரேவதி': 'revati',

  // Sanskrit / Alternate English spelling
  'arudra': 'ardra',
  'tiruvadirai': 'ardra',
  'thiruvathirai': 'ardra',
  'punarpoosam': 'punarvasu',
  'poosam': 'pushya',
  'ayilyam': 'ashlesha',
  'aayilyam': 'ashlesha',
  'pooram': 'purvaphalguni',
  'uthiram': 'uttaraphalguni',
  'hastham': 'hasta',
  'chithirai': 'chitra',
  'swathi': 'swati',
  'visakam': 'vishakha',
  'anusham': 'anuradha',
  'kettai': 'jyeshtha',
  'moolam': 'moola',
  'pooradam': 'purvaashadha',
  'uthiradam': 'uttaraashadha',
  'thiruvonam': 'shravana',
  'avittam': 'dhanishta',
  'sadayam': 'shatabhisha',
  'shatabhishak': 'shatabhisha',
  'poorattathi': 'purvabhadrapada',
  'uthirattathi': 'uttarabhadrapada',
  'uttarabhadra': 'uttarabhadrapada',
  'purvabhadra': 'purvabhadrapada',
  'uttaraphalgun': 'uttaraphalguni',
  'purvaphalgun': 'purvaphalguni',
};

const RASI_ALIAS_MAP: Record<string, string> = {
  'மேஷம்': 'mesham',
  'ரிஷபம்': 'rishabam',
  'மிதுனம்': 'mithunam',
  'கடகம்': 'kadagam',
  'சிம்மம்': 'simmam',
  'கன்னி': 'kanni',
  'துலாம்': 'thulam',
  'விருச்சிகம்': 'viruchigam',
  'தனுசு': 'dhanusu',
  'மகரம்': 'makaram',
  'கும்பம்': 'kumbam',
  'மீனம்': 'meenam',
  'aries': 'mesham',
  'taurus': 'rishabam',
  'gemini': 'mithunam',
  'cancer': 'kadagam',
  'leo': 'simmam',
  'virgo': 'kanni',
  'libra': 'thulam',
  'scorpio': 'viruchigam',
  'sagittarius': 'dhanusu',
  'capricorn': 'makaram',
  'aquarius': 'kumbam',
  'pisces': 'meenam',
  'simham': 'simmam',
  'magaram': 'makaram'
};

/**
 * Look up gunam traits for a given baby naming result.
 */
export function getGunam(
  nakshatraInput: string | number = '',
  rasiInput: string | number = '',
  lang: 'ta' | 'en' | 'hi' = 'ta'
): string[] {
  // If number passed (1..27)
  if (typeof nakshatraInput === 'number' && NAKSHATRA_INDEX_MAP[nakshatraInput]) {
    const key = NAKSHATRA_INDEX_MAP[nakshatraInput];
    if (NAKSHATRAM_GUNAM[key]) return NAKSHATRAM_GUNAM[key][lang];
  }

  const nakRaw = String(nakshatraInput || '').trim();
  const rasiRaw = String(rasiInput || '').trim();

  // Check alias map
  if (NAKSHATRA_ALIAS_MAP[nakRaw]) {
    const key = NAKSHATRA_ALIAS_MAP[nakRaw];
    if (NAKSHATRAM_GUNAM[key]) return NAKSHATRAM_GUNAM[key][lang];
  }

  const nakKey = nakRaw
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z]/g, '');

  if (NAKSHATRA_ALIAS_MAP[nakKey]) {
    const key = NAKSHATRA_ALIAS_MAP[nakKey];
    if (NAKSHATRAM_GUNAM[key]) return NAKSHATRAM_GUNAM[key][lang];
  }

  const rasiKey = rasiRaw
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z]/g, '');

  // Exact or prefix match on nakshatram (skip when no nakshatra input given,
  // otherwise '' prefix-matches the first entry and rasi lookups never run)
  if (nakKey) {
    if (NAKSHATRAM_GUNAM[nakKey]) {
      return NAKSHATRAM_GUNAM[nakKey][lang];
    }

    for (const key of Object.keys(NAKSHATRAM_GUNAM)) {
      if (nakKey.startsWith(key) || key.startsWith(nakKey)) {
        return NAKSHATRAM_GUNAM[key][lang];
      }
    }
  }

  // Fall back to rasi alias (guard on raw input: Tamil names normalize to '' but match raw aliases)
  if (rasiRaw) {
    if (RASI_ALIAS_MAP[rasiRaw]) {
      const rKey = RASI_ALIAS_MAP[rasiRaw];
      if (RASI_GUNAM[rKey]) return RASI_GUNAM[rKey][lang];
    }
    if (RASI_ALIAS_MAP[rasiKey]) {
      const rKey = RASI_ALIAS_MAP[rasiKey];
      if (RASI_GUNAM[rKey]) return RASI_GUNAM[rKey][lang];
    }

    // Direct Rasi match
    if (RASI_GUNAM[rasiKey]) {
      return RASI_GUNAM[rasiKey][lang];
    }

    for (const key of Object.keys(RASI_GUNAM)) {
      if (rasiKey.includes(key)) {
        return RASI_GUNAM[key][lang];
      }
    }
  }

  // Unknown or absent inputs are not a Meenam result. Returning no traits lets
  // callers show an explicit unavailable state instead of inventing a sign.
  return [];
}

/**
 * Detailed multi-dimensional Gunam report (Nakshatra virtues + Moon Sign virtues)
 */
export function getDetailedGunam(
  nakshatraInput: string | number = '',
  rasiInput: string | number = '',
  lang: 'ta' | 'en' | 'hi' = 'en'
): {
  nakshatraTraits: string[];
  rasiTraits: string[];
  combinedVirtues: string[];
} {
  const nakTraits = getGunam(nakshatraInput, '', lang);
  const rasiTraits = getGunam('', rasiInput, lang);
  const combined = Array.from(new Set([...nakTraits, ...rasiTraits]));

  return {
    nakshatraTraits: nakTraits,
    rasiTraits: rasiTraits,
    combinedVirtues: combined
  };
}

export interface NakshatraMeta {
  key: string;
  index: number;
  nameEn: string;
  nameTa: string;
  nameHi: string;
}

export const NAKSHATRAS_METADATA: NakshatraMeta[] = [
  { key: 'ashwini', index: 1, nameEn: 'Ashwini', nameTa: 'அசுவினி', nameHi: 'अश्विनी' },
  { key: 'bharani', index: 2, nameEn: 'Bharani', nameTa: 'பரணி', nameHi: 'भरणी' },
  { key: 'krittika', index: 3, nameEn: 'Krittika', nameTa: 'கார்த்திகை', nameHi: 'कृत्तिका' },
  { key: 'rohini', index: 4, nameEn: 'Rohini', nameTa: 'ரோகிணி', nameHi: 'रोहिणी' },
  { key: 'mrigashirsha', index: 5, nameEn: 'Mrigashirsha', nameTa: 'மிருகசீரிடம்', nameHi: 'मृगशिरा' },
  { key: 'ardra', index: 6, nameEn: 'Ardra / Thiruvathirai', nameTa: 'திருவாதிரை', nameHi: 'आर्द्रा' },
  { key: 'punarvasu', index: 7, nameEn: 'Punarvasu / Punarpoosam', nameTa: 'புனர்பூசம்', nameHi: 'पुनर्वसु' },
  { key: 'pushya', index: 8, nameEn: 'Pushya / Poosam', nameTa: 'பூசம்', nameHi: 'पुष्य' },
  { key: 'ashlesha', index: 9, nameEn: 'Ashlesha / Ayilyam', nameTa: 'ஆயில்யம்', nameHi: 'अश्लेषा' },
  { key: 'magha', index: 10, nameEn: 'Magha / Magam', nameTa: 'மகம்', nameHi: 'मघा' },
  { key: 'purvaphalguni', index: 11, nameEn: 'Purva Phalguni / Pooram', nameTa: 'பூரம்', nameHi: 'पूर्वाफाल्गुनी' },
  { key: 'uttaraphalguni', index: 12, nameEn: 'Uttara Phalguni / Uthiram', nameTa: 'உத்திரம்', nameHi: 'उत्तराफाल्गुनी' },
  { key: 'hasta', index: 13, nameEn: 'Hasta / Hastham', nameTa: 'அஸ்தம்', nameHi: 'हस्त' },
  { key: 'chitra', index: 14, nameEn: 'Chitra / Chithirai', nameTa: 'சித்திரை', nameHi: 'चित्रा' },
  { key: 'swati', index: 15, nameEn: 'Swati / Swathi', nameTa: 'சுவாதி', nameHi: 'स्वाति' },
  { key: 'vishakha', index: 16, nameEn: 'Vishakha / Visakam', nameTa: 'விசாகம்', nameHi: 'विशाखा' },
  { key: 'anuradha', index: 17, nameEn: 'Anuradha / Anusham', nameTa: 'அனுஷம்', nameHi: 'अनुराधा' },
  { key: 'jyeshtha', index: 18, nameEn: 'Jyeshtha / Kettai', nameTa: 'கேட்டை', nameHi: 'ज्येष्ठा' },
  { key: 'moola', index: 19, nameEn: 'Moola / Moolam', nameTa: 'மூலம்', nameHi: 'मूल' },
  { key: 'purvaashadha', index: 20, nameEn: 'Purva Ashadha / Pooradam', nameTa: 'பூராடம்', nameHi: 'पूर्वाषाढ़ा' },
  { key: 'uttaraashadha', index: 21, nameEn: 'Uttara Ashadha / Uthiradam', nameTa: 'உத்திராடம்', nameHi: 'उत्तराषाढ़ा' },
  { key: 'shravana', index: 22, nameEn: 'Shravana / Thiruvonam', nameTa: 'திருவோணம்', nameHi: 'श्रवण' },
  { key: 'dhanishta', index: 23, nameEn: 'Dhanishta / Avittam', nameTa: 'அவிட்டம்', nameHi: 'धनिष्ठा' },
  { key: 'shatabhisha', index: 24, nameEn: 'Shatabhisha / Sadayam', nameTa: 'சதயம்', nameHi: 'शतभिषा' },
  { key: 'purvabhadrapada', index: 25, nameEn: 'Purva Bhadrapada / Poorattathi', nameTa: 'பூரட்டாதி', nameHi: 'पूर्वाभाद्रपद' },
  { key: 'uttarabhadrapada', index: 26, nameEn: 'Uttara Bhadrapada / Uthirattathi', nameTa: 'உத்திரட்டாதி', nameHi: 'उत्तराभाद्रपद' },
  { key: 'revati', index: 27, nameEn: 'Revati', nameTa: 'ரேவதி', nameHi: 'रेवती' }
];

export interface RasiMeta {
  key: string;
  index: number;
  nameEn: string;
  nameTa: string;
  nameHi: string;
}

export const RASIS_METADATA: RasiMeta[] = [
  { key: 'mesham', index: 1, nameEn: 'Mesham (Aries)', nameTa: 'மேஷம்', nameHi: 'मेष' },
  { key: 'rishabam', index: 2, nameEn: 'Rishabam (Taurus)', nameTa: 'ரிஷபம்', nameHi: 'वृषभ' },
  { key: 'mithunam', index: 3, nameEn: 'Mithunam (Gemini)', nameTa: 'மிதுனம்', nameHi: 'मिथुन' },
  { key: 'kadagam', index: 4, nameEn: 'Kadagam (Cancer)', nameTa: 'கடகம்', nameHi: 'कर्क' },
  { key: 'simmam', index: 5, nameEn: 'Simham (Leo)', nameTa: 'சிம்மம்', nameHi: 'सिंह' },
  { key: 'kanni', index: 6, nameEn: 'Kanni (Virgo)', nameTa: 'கன்னி', nameHi: 'कन्या' },
  { key: 'thulam', index: 7, nameEn: 'Thulam (Libra)', nameTa: 'துலாம்', nameHi: 'तुला' },
  { key: 'viruchigam', index: 8, nameEn: 'Viruchigam (Scorpio)', nameTa: 'விருச்சிகம்', nameHi: 'वृश्चिक' },
  { key: 'dhanusu', index: 9, nameEn: 'Dhanusu (Sagittarius)', nameTa: 'தனுசு', nameHi: 'धनु' },
  { key: 'makaram', index: 10, nameEn: 'Magaram (Capricorn)', nameTa: 'மகரம்', nameHi: 'मकर' },
  { key: 'kumbam', index: 11, nameEn: 'Kumbam (Aquarius)', nameTa: 'கும்பம்', nameHi: 'कुंभ' },
  { key: 'meenam', index: 12, nameEn: 'Meenam (Pisces)', nameTa: 'மீனம்', nameHi: 'मीन' }
];
