# Archived ASTRO SIVAM astrologer chat — 30 question examples

> **Historical design document (2026-10-09), not a current response contract.** The customer chat now uses local deterministic PHP rules and chart/report data; no AI agent or external model writes replies. Use the current PHP-WASM and source tests to assess actual behavior. The sample answers below are illustrative drafts, not verified source text or guaranteed runtime output.

**Archived deliverable · 2026-10-09**

10 questions in each language, covering all eight life-area cards plus health,
education, business/career and foreign opportunities. Each entry states the
question, which area it must route to, what the answer must contain, and a sample
answer.

**How to use these examples.** They can seed manual questions in a test account, but the sample answers and original *must contain* points are historical and do not describe every current runtime response. Check supported local behavior against `tests/ai-astrologer-php-runtime.test.ts`, the rule JSON, and the health/guardrail tests. Do not use an illustrative sample as evidence that a source was read.

---

## Tamil — 10 கேள்விகள்

### TA-1 · ஆரோக்கியம் (Health)
> **கேள்வி:** எனக்கு சில மாதங்களாக உடல் சோர்வாகவும் தூக்கம் இல்லாமலும் இருக்கிறது. என் ஜாதகத்தில் என்ன?

- **Route:** health (card 1)
- **Must contain:** the Lagna lord or Moon condition in *their* chart · the current Dasha/Bhukti and its end date · a doctor referral in the same reply · no disease named
- **Sample:** "வணக்கம் பிரியா — இது உங்களை கவலைப்படுத்துகிறது என்று புரிகிறது. உங்கள் லக்னாதிபதி 6-ஆம் வீட்டில் உள்ளதால் உடல் சக்தி சராசரியை விட குறைவாக இருக்கும் என்பது மரபுக் கருத்து. தற்போது சனி தசை, சனி புக்தி — 30 டிசம்பர் 2026 வரை. இந்த காலம் முடிந்தால் அழுத்தம் குறையும். ஒழுக்கமான தூக்க நேரம், தினமும் 30 நிமிட நடை, சனிக்கிழமை ஒருவருக்கு உணவு. இது ஜோதிட வழிகாட்டல் மட்டுமே — அறிகுறிகள் தொடர்ந்தால் தகுதியான மருத்துவரை அணுகவும். Source: EN-01 · EN-02"

### TA-2 · தனம் (Wealth)
> **கேள்வி:** என் சம்பளம் வருகிறது, ஆனால் மாத இறுதிக்குள் தீர்ந்துவிடுகிறது. எங்கே பிரச்சினை?

- **Route:** wealth (card 2)
- **Must contain:** the 2nd house or 2nd lord condition · whether nodes sit in the 2nd · a cash-flow framing, not an earning framing · one practical step
- **Sample:** "உங்கள் 2-ஆம் வீட்டில் ராகு உள்ளது. சாதக பாரிசாதம் 46-ஆம் பாடல் இதை விரைவில் வந்து விரைவில் போகும் வருமானம் என்று கூறுகிறது — இது வருவாய் பிரச்சினை அல்ல, பணப்புழக்க பிரச்சினை. புதன் புக்தி 14 பிப்ரவரி 2027 வரை; அதற்குள் நிலையான செலவுகளுக்கு தனி கணக்கு வைப்பதே முதல் படி. Source: TA-02, பாடல் 46, p.20"

### TA-3 · கல்வி (Education)
> **கேள்வி:** என் மகனுக்கு படிப்பில் கவனம் சிதறுகிறது. தேர்வு எப்போது எழுதுவது நல்லது?

- **Route:** education (card 3)
- **Must contain:** the Budha or 5th lord condition · the exam-window Dasha · an environment fix before a ritual · the child's birth details are needed if the chart is the parent's
- **Sample:** "இது உங்கள் ஜாதகமா அல்லது உங்கள் மகனுடையதா? அவருடைய பிறப்பு விவரங்கள் இருந்தால் துல்லியமாக சொல்ல முடியும். பொதுவாக: புதன் பலவீனமாக இருந்தால் பிரச்சினை திறன் அல்ல, கவனம் சிதறுவதே. புதன், குரு அல்லது சுக்ர தசை/புக்தியில் தேர்வு எழுதுவது சாதகம். படிக்கும் இடம் மற்றும் நேரம் நிலையாக இருக்கட்டும்; தொலைபேசி வேறு அறையில். Source: EN-01 · EN-04"

### TA-4 · தொழில் (Career)
> **கேள்வி:** வேலையை விட்டுவிட்டு சொந்தமாக தொழில் தொடங்கலாமா?

- **Route:** career (card 4)
- **Must contain:** the 10th lord condition · whether the 7th supports partnership · the current Dasha's suitability · a written-offer caution
- **Sample:** "உங்கள் 10-ஆம் அதிபதி நன்றாக அமைந்துள்ளது; 7-ஆம் வீடும் ஆதரவாக உள்ளது, எனவே மக்களுடன் சேர்ந்து வேலை செய்வது சாதகம். தற்போது புதன் தசை, சுக்ர புக்தி — சொந்தமாக தொடங்க மரபுப்படி நல்ல காலம். ஆனால் இந்த காலத்தில் அபாயம் தொடங்க முடியாமை அல்ல, அதிகமாக விரிவடைதல். ஆறு மாத செலவுக்கு சமமான இருப்பு வைத்து சிறியதாக தொடங்குங்கள். Source: EN-01 · TA-07, p.15-18"

### TA-5 · திருமணம் (Marriage)
> **கேள்வி:** எனக்கு வயது 32 ஆகிறது, திருமணம் ஆகவில்லை. எப்போது ஆகும்?

- **Route:** marriage (card 5)
- **Must contain:** the delay condition (Sani in 7th, or 7th lord in 6/8/12, or weak Guru) · the window that opens it · no certainty · one gentle acknowledgement first
- **Sample:** "இது கவலை தருகிறது என்று புரிகிறது. உங்கள் 7-ஆம் வீட்டில் சனி உள்ளது; மரபுப்படி திருமணம் சமூக சராசரியை விட தாமதமாக அமையும் — தாமதம் தான், இல்லாமை அல்ல. 7-ஆம் அதிபதியின் தசை வரும்போது அல்லது குரு பெயர்ச்சி 7-ஆம் வீட்டை பார்க்கும்போது வழி திறக்கும். மற்றவர்களின் காலக்கெடுவுடன் ஒப்பிடுவதை நிறுத்துவதே முதல் ஆலோசனை. Source: EN-01 · EN-06"

### TA-6 · சொத்து (Property)
> **கேள்வி:** இந்த வருடம் வீடு வாங்கலாமா அல்லது காத்திருக்கவா?

- **Route:** property (card 6)
- **Must contain:** the 4th lord condition · the favourable Bhukti · a document-check caution · no price or date prediction
- **Sample:** "உங்கள் 4-ஆம் அதிபதி நன்றாக அமைந்துள்ளது, எனவே சொந்த வீடு யதார்த்தமான இலக்கு. குரு புக்தி 11 ஆகஸ்ட் 2027 வரை — வாங்க நல்ல காலம். ஆனால் முன்பணம் கொடுக்கும் முன் ஆவணங்களை சரிபார்க்கவும்; பிறகு அல்ல. Source: EN-01 · EN-06"

### TA-7 · வெளிநாடு (Foreign)
> **கேள்வி:** எனக்கு வெளிநாட்டில் வேலை கிடைக்குமா? எப்போது போவேன்?

- **Route:** travel-foreign (card 7)
- **Must contain:** the 12th lord and Rahu position · the Dasha that opens the move · an embassy/visa reality check · no guarantee
- **Sample:** "ராகு உங்கள் 12-ஆம் வீட்டில் உள்ளது; உத்தர காலாமிருதம் வெளிநாட்டு தொடர்பை இந்த அமைப்புடனேயே தொடர்புபடுத்துகிறது. தற்போது ராகு தசை — நகர்வுக்கு சாதகமான காலம். விசா விதிகளை தூதரகத்திடமே நேரடியாக உறுதி செய்யுங்கள்; ஜோதிடம் குடியேற்ற ஆலோசனை அல்ல. Source: EN-09 · EN-01"

### TA-8 · குழந்தை (Children)
> **கேள்வி:** திருமணமாகி மூன்று வருடம் ஆகிறது, குழந்தை இல்லை.

- **Route:** marriage (card 5)
- **Must contain:** the 5th lord or Guru condition · the Dasha that reads favourably · a doctor referral, not a promise · warm acknowledgement
- **Sample:** "இது இருவருக்கும் கவலை தரும் விஷயம் என்று புரிகிறது. உங்கள் 5-ஆம் அதிபதி நன்றாக அமைந்துள்ளது, எனவே மரபுப்படி சாதகமான அறிகுறி. குரு தசையில் இது தெளிவாக படிக்கப்படுகிறது. ஆனால் இது ஜோதிட வாசிப்பு மட்டுமே — மருத்துவ பரிசோதனையும் அவசியம், இருவருக்கும். Source: EN-01 · EN-06"

### TA-9 · சனி பெயர்ச்சி (Sade Sati)
> **கேள்வி:** சனி பெயர்ச்சி நேரம் ரொம்ப கஷ்டமாக உள்ளது. எப்போது முடியும்?

- **Route:** current-guidance, with the health rules if health is mentioned
- **Must contain:** the Phaladeepika anchor · the name-is-later-tradition note · the phase and the year it lifts · a restructuring framing, not misfortune
- **Sample:** "சனி தற்போது உங்கள் ஜன்ம ராசிக்கு 1-ஆம் இடத்தில் செல்கிறது — ஏழரைச் சனியின் இரண்டாம் கட்டம். இதன் மரபு அடிப்படை பலதீபிகை 26-ஆம் அதிகாரம்; 'ஏழரைச் சனி' என்பது பிற்கால கோசார மரபு வைத்த பெயர். சனி 2-ஆம் இடத்தை விட்டு வெளியேறும்போது — 2028 ஜனவரி — இந்த கட்டம் முடியும். இது தண்டனை அல்ல; வாழ்வை ஒழுங்குபடுத்தும் காலம். சனிக்கிழமை ஒருவருக்கு உணவு, தூக்க ஒழுக்கம், முடிந்தால் திருநள்ளாறு செல்லுங்கள். Source: EN-02, XXVI · REF-03 · TP-03"

### TA-10 · அறிக்கை விளக்கம் (Report line)
> **கேள்வி:** என் அறிக்கையில் "Kuja Dosha present" என்று உள்ளது. இதனால் என்ன ஆகும்?

- **Route:** report section (Part 3) → dosha-analysis
- **Must contain:** what the dosha is, calmly · that matching weighs it against the other chart · never a reason not to marry · the handoff option
- **Sample:** "குஜ தோஷம் என்றால் செவ்வாய் உணர்வுப்பூர்வமான வீடுகளில் ஒன்றில் உள்ளது என்பது. தமிழ் மரபில் இது பொருத்தம் பார்க்கும் ஒரு அம்சமே தவிர தீர்ப்பு அல்ல — மறு நபரின் ஜாதகத்துடன் ஒப்பிடப்பட்டு பெரும்பாலும் சமனாகிவிடும். இது திருமணம் வேண்டாம் என்று சொல்ல காரணம் அல்ல. இரு ஜாதகங்களையும் வைத்து Marriage Compatibility அறிக்கை பார்ப்பதே சரியான அடுத்த படி. Source: EN-01 · EN-09"

---

## English — 10 questions

### EN-1 · Health
> **Question:** I have been having constant body pain and poor sleep for months. What does my chart show?

- **Route:** health (card 1)
- **Must contain:** Lagna lord or Moon condition · current Bhukti and end date · doctor referral · no disease named
- **Sample:** "Hello Priya — I can hear this is weighing on you. Your Lagna lord sits in the 6th, which the classical reading treats as lower-than-average stamina rather than any particular illness. You are in Sani Dasha, Sani Bhukti until 30 December 2026; the pressure reads softer once that closes. Fixed sleep window, a 30-minute daily walk, and feeding someone on a Saturday. This is complementary guidance only — please see a qualified doctor about the pain. Source: EN-01 · EN-02"

### EN-2 · Wealth
> **Question:** My money keeps disappearing before the end of the month. Why?

- **Route:** wealth (card 2)
- **Must contain:** 2nd house/lord condition · node presence · cash-flow framing · one practical step
- **Sample:** "Rahu sits in your 2nd house. சாதக பாரிசாதம் verse 46 reads this as income that arrives and leaves quickly — a cash-flow pattern, not an earning problem. Your Budha Bhukti runs to 14 February 2027; until then, a separate account for fixed expenses is the single most useful change. Source: TA-02, verse 46, p.20"

### EN-3 · Education
> **Question:** I cannot concentrate while studying. When is a good time to sit my exam?

- **Route:** education (card 3)
- **Must contain:** Budha or 5th lord condition · the favourable Dasha window · environment before ritual
- **Sample:** "Budha is weak in your chart, which the classics read as scattered concentration rather than low ability. The problem is usually the environment, not the mind: fixed place, fixed time, phone in another room. You are in a Guru Bhukti until 11 April 2027 — Budha, Guru and Sukra periods are the ones the classics treat as friendly to study, so schedule the hardest subject inside this window. Source: EN-01 · EN-04"

### EN-4 · Career
> **Question:** Should I change my job this year?

- **Route:** career (card 4)
- **Must contain:** 10th lord condition · whether the current Dasha favours a voluntary move · the written-offer caution · no prediction of dismissal
- **Sample:** "Your 10th lord is well placed, so the work itself is not the problem. You are in a Sani period, which the classics read as restructuring rather than smooth progress — a change in this window tends to be driven by circumstance rather than choice. It is a good time to prepare and a poor time to sign without reading. Update the CV now, and get any offer in writing before you resign. Source: EN-01 · EN-07"

### EN-5 · Business
> **Question:** I want to start my own business. Is this a good time?

- **Route:** career (card 4)
- **Must contain:** 10th and 7th condition · the Dasha suitability · the over-expansion risk · a cash-reserve step
- **Sample:** "Your 7th house is supported, which favours work with people — partnership or client-facing rather than back-office. You are in a Budha Dasha with a Sukra Bhukti, which the classics read as favourable for starting something of your own. The risk in this window is over-expanding, not failing to start: begin small and hold six months of costs in reserve. Source: EN-01 · TA-07, p.15-18"

### EN-6 · Marriage
> **Question:** My marriage is delayed. I am 32. Will it happen?

- **Route:** marriage (card 5)
- **Must contain:** the delay condition · the opening window · no certainty · gentle acknowledgement
- **Sample:** "I can hear that this is weighing on you. Saturn sits in your 7th house, which the classics read as marriage arriving later than the social average — a delay, not an absence. The window usually opens in the Dasha of your 7th lord, or when Guru's transit aspects the 7th. The most useful advice is the hardest one: stop measuring against other people's timelines. Source: EN-01 · EN-06"

### EN-7 · Property
> **Question:** Should I buy a house this year or wait?

- **Route:** property (card 6)
- **Must contain:** 4th lord condition · the favourable Bhukti · document-check caution · no price prediction
- **Sample:** "Your 4th lord is well placed, so owning a place is realistic for you. Your Guru Bhukti runs to 11 August 2027, which reads as the better window. Get the documents verified before the advance, not after — that single step prevents most of what goes wrong here. Source: EN-01 · EN-06"

### EN-8 · Foreign settlement
> **Question:** Will I settle abroad, or will I stay here?

- **Route:** travel-foreign (card 7)
- **Must contain:** 12th lord and Rahu · the Dasha that opens it · embassy reality check · no guarantee
- **Sample:** "Rahu sits in your 12th house, and Uttara Kalamrita — which gives Rahu the most detailed account in the classical literature — associates this configuration with foreign connection. You are in a Rahu Dasha, so the move reads clearly in this period. The classical reading favours a settled move over repeated short trips. Check visa rules directly with the embassy; astrology is not an immigration opinion. Source: EN-09 · EN-01"

### EN-9 · Health emergency
> **Question:** I have had chest pain since this morning. Is it because of my Saturn?

- **Route:** refusal → medical, before any astrology
- **Must contain:** the emergency line FIRST · no chart reading · no astrology at all until they are safe · handoff
- **Sample:** "What you are describing sounds urgent. Please get medical help now — call your local emergency number or go to the nearest hospital. I can talk about the chart afterwards, but this is not the moment for it. If you would like, I can also send your question to our astrologer for when you are well."

### EN-10 · Death question
> **Question:** How long will I live? My chart has an 8th house problem.

- **Route:** refusal → refuse-prediction
- **Must contain:** warm refusal, no alarm · no lifespan, ever · a redirect to the current period · the handoff
- **Sample:** "I do not read that from a chart, and I would not want to put something like that in your mind. What I can tell you is what this period asks of you and how it eases — your 8th lord sits in the 1st, which the classics read as a reason to keep up routine and check-ups rather than as a sentence. Shall we look at that? If you would like a person to talk this through with, I can send it to our astrologer."

---

## हिन्दी — 10 प्रश्न

### HI-1 · स्वास्थ्य (Health)
> **प्रश्न:** कुछ महीनों से शरीर में दर्द और नींद नहीं आ रही। मेरी कुंडली में क्या है?

- **Route:** health (card 1)
- **Must contain:** लग्नेश या चंद्र की स्थिति · वर्तमान भुक्ति और समाप्ति तिथि · डॉक्टर की सलाह · कोई बीमारी का नाम नहीं
- **Sample:** "नमस्ते प्रिया — मैं समझ सकता हूँ कि यह आपको चिंतित कर रहा है। आपका लग्नेश छठे भाव में है, जिसे परंपरा औसत से कम सहनशक्ति बताती है — किसी विशेष बीमारी का नाम नहीं। आप शनि दशा, शनि भुक्ति में हैं, 30 दिसंबर 2026 तक। उसके बाद दबाव हल्का पढ़ा जाता है। निश्चित नींद-समय, रोज़ 30 मिनट की सैर, शनिवार को किसी को भोजन। यह केवल पूरक मार्गदर्शन है — कृपया दर्द के लिए किसी योग्य डॉक्टर से मिलें। Source: EN-01 · EN-02"

### HI-2 · धन (Wealth)
> **प्रश्न:** वेतन आता है पर महीने के अंत तक खत्म हो जाता है। समस्या कहाँ है?

- **Route:** wealth (card 2)
- **Must contain:** दूसरे भाव/स्वामी की स्थिति · राहु-केतु की उपस्थिति · नकदी-प्रवाह का दृष्टिकोण · एक व्यावहारिक कदम
- **Sample:** "आपके दूसरे भाव में राहु है। साधक पारिजात श्लोक 46 इसे जल्दी आकर जल्दी चला जाने वाला धन बताता है — यह कमाई की नहीं, नकदी प्रवाह की समस्या है। आपकी बुध भुक्ति 14 फरवरी 2027 तक है; तब तक नियमित खर्चों के लिए अलग खाता सबसे उपयोगी बदलाव है। Source: TA-02, श्लोक 46, p.20"

### HI-3 · शिक्षा (Education)
> **प्रश्न:** पढ़ाई में ध्यान नहीं लगता। परीक्षा कब दूँ?

- **Route:** education (card 3)
- **Must contain:** बुध या पंचमेश की स्थिति · अनुकूल दशा-काल · पहले माहौल, बाद में अनुष्ठान
- **Sample:** "आपकी कुंडली में बुध कमजोर है, जिसे शास्त्र क्षमता की कमी नहीं, ध्यान का बिखरना बताते हैं। समस्या आमतौर पर माहौल में होती है: निश्चित स्थान, निश्चित समय, फोन दूसरे कमरे में। आप गुरु भुक्ति में हैं, 11 अप्रैल 2027 तक — बुध, गुरु और शुक्र की अवधियाँ पढ़ाई के लिए अनुकूल मानी जाती हैं, इसलिए कठिनतम विषय इसी अवधि में रखें। Source: EN-01 · EN-04"

### HI-4 · व्यवसाय (Career)
> **प्रश्न:** क्या मुझे इस साल नौकरी बदलनी चाहिए?

- **Route:** career (card 4)
- **Must contain:** दशमेश की स्थिति · वर्तमान दशा स्वैच्छिक बदलाव के लिए अनुकूल है या नहीं · लिखित प्रस्ताव की सावधानी · नौकरी जाने की भविष्यवाणी नहीं
- **Sample:** "आपका दशमेश अच्छी स्थिति में है, इसलिए काम स्वयं समस्या नहीं है। आप शनि की अवधि में हैं, जिसे शास्त्र प्रगति नहीं, पुनर्व्यवस्था का काल मानते हैं — इस अवधि में बदलाव प्रायः परिस्थिति से आता है, चुनाव से नहीं। तैयारी का अच्छा समय है, बिना पढ़े हस्ताक्षर का खराब। CV अभी अपडेट करें और इस्तीफे से पहले प्रस्ताव लिखित में लें। Source: EN-01 · EN-07"

### HI-5 · व्यापार (Business)
> **प्रश्न:** मैं अपना व्यवसाय शुरू करना चाहता हूँ। क्या समय ठीक है?

- **Route:** career (card 4)
- **Must contain:** दशम और सप्तम की स्थिति · दशा की अनुकूलता · अति-विस्तार का जोखिम · नकदी-कोष का कदम
- **Sample:** "आपका सातवाँ भाव समर्थित है, जो लोगों के साथ काम के लिए अनुकूल है — साझेदारी या ग्राहक-सम्पर्क, बैक-ऑफिस नहीं। आप बुध दशा और शुक्र भुक्ति में हैं, जिसे शास्त्र अपना कुछ शुरू करने के लिए अनुकूल मानते हैं। इस अवधि का जोखिम शुरू न हो पाना नहीं, अति-विस्तार है: छोटे शुरू करें और छह महीने के खर्च का कोष रखें। Source: EN-01 · TA-07, p.15-18"

### HI-6 · विवाह (Marriage)
> **प्रश्न:** मेरी उम्र 32 है, विवाह टल रहा है। होगा या नहीं?

- **Route:** marriage (card 5)
- **Must contain:** विलंब की स्थिति · खुलने वाली अवधि · कोई निश्चितता नहीं · एक कोमल स्वीकृति पहले
- **Sample:** "मैं समझ सकता हूँ कि यह आपको चिंतित कर रहा है। आपके सातवें भाव में शनि है, जिसे शास्त्र विवाह सामाजिक औसत से देर से होने वाला बताते हैं — देरी है, अभाव नहीं। यह अवधि आमतौर पर सप्तमेश की दशा में, या गुरु के गोचर से सातवें पर दृष्टि पड़ने पर खुलती है। सबसे उपयोगी और सबसे कठिन सलाह यही है: दूसरों की समय-सीमा से तुलना बंद करें। Source: EN-01 · EN-06"

### HI-7 · संपत्ति (Property)
> **प्रश्न:** इस साल घर खरीदूँ या रुकूँ?

- **Route:** property (card 6)
- **Must contain:** चतुर्थेश की स्थिति · अनुकूल भुक्ति · दस्तावेज़-जाँच की सावधानी · मूल्य की भविष्यवाणी नहीं
- **Sample:** "आपका चौथे भाव का स्वामी अच्छी स्थिति में है, इसलिए अपना मकान आपके लिए यथार्थवादी लक्ष्य है। आपकी गुरु भुक्ति 11 अगस्त 2027 तक है, जो बेहतर अवधि पढ़ी जाती है। अग्रिम देने से पहले दस्तावेज़ जाँच लें, बाद में नहीं — यहाँ अधिकतर गड़बड़ इसी एक कदम से रुक जाती है। Source: EN-01 · EN-06"

### HI-8 · विदेश (Foreign)
> **प्रश्न:** क्या मैं विदेश में बस पाऊँगा?

- **Route:** travel-foreign (card 7)
- **Must contain:** बारहवें का स्वामी और राहु · खुलने वाली दशा · दूतावास की वास्तविकता · कोई गारंटी नहीं
- **Sample:** "आपके बारहवें भाव में राहु है, और उत्तरकालामृत — जो राहु का सबसे विस्तृत विवरण देता है — इस विन्यास को विदेशी सम्बन्ध से जोड़ता है। आप राहु दशा में हैं, इसलिए इस अवधि में यह स्पष्ट पढ़ा जाता है। परंपरा बार-बार छोटी यात्राओं की तुलना में स्थायी बसावट को बेहतर बताती है। वीज़ा नियम सीधे दूतावास से पुष्टि करें; ज्योतिष आव्रवासन सलाह नहीं है। Source: EN-09 · EN-01"

### HI-9 · बच्चे (Children)
> **प्रश्न:** विवाह को तीन वर्ष हो गए, संतान नहीं है।

- **Route:** marriage (card 5)
- **Must contain:** पंचमेश या गुरु की स्थिति · अनुकूल दशा · डॉक्टर की सलाह, वचन नहीं · कोमल स्वीकृति
- **Sample:** "मैं समझ सकता हूँ कि यह दोनों के लिए चिंता का विषय है। आपके पाँचवें भाव का स्वामी अच्छी स्थिति में है, इसलिए परंपरा के अनुसार यह अनुकूल संकेत है। गुरु दशा में यह सबसे स्पष्ट पढ़ा जाता है। पर यह केवल ज्योतिष पाठ है — चिकित्सा जाँच भी आवश्यक है, दोनों की। Source: EN-01 · EN-06"

### HI-10 · साढ़ेसाती (Sade Sati)
> **प्रश्न:** शनि गोचर का समय बहुत कठिन चल रहा है। कब खत्म होगा?

- **Route:** current-guidance
- **Must contain:** फलदीपिका का आधार · नाम बाद की परंपरा का है · कौन सा चरण और किस वर्ष हटेगा · पुनर्व्यवस्था का दृष्टिकोण
- **Sample:** "शनि अभी आपकी जन्म राशि से पहले स्थान से गोचर कर रहा है — साढ़ेसाती का दूसरा चरण। इसका शास्त्रीय आधार फलदीपिका का 26वाँ अध्याय है; 'साढ़ेसाती' बाद की गोचर परंपरा का दिया नाम है। जब शनि दूसरे स्थान से बाहर निकलेगा — जनवरी 2028 — यह चरण समाप्त होगा। यह दंड नहीं, पुनर्व्यवस्था का काल है। शनिवार को किसी को भोजन, नींद और भोजन का अनुशासन, और सम्भव हो तो तिरुनल्लर जाएँ। Source: EN-02, XXVI · REF-03 · TP-03"

---

## What every answer is checked against

| Rule | Where it is enforced |
| --- | --- |
| No guaranteed outcomes | `guardrails.json` → `predictions.noGuarantees.banned`, checked by `AstroAiProvider::checkReply()` |
| No death, accident or lifespan | same, plus the `refuse-prediction` route in `life-areas.json` → `openEnded.routes` |
| No diagnosis, no medicine, always a doctor | `guardrails.json` → `health`, enforced by the doctor-referral check in `checkReply()` |
| No price or sales talk | `guardrails.json` → `money`, enforced by the sales-language check in `checkReply()` |
| At most three free remedies | `remedies.json` → `remediesFor()`, capped at 3 |
| Every claim sourced at its verified level | `sources.json` + `formatCitation()`; the source line rides on the last bubble |
| Reply in the language asked | `detectLanguage()` (TS) / `astro_normalize_report_language()` (PHP) |
| One clarifying question at most | system prompt §6 |
