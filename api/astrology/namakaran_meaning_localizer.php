<?php
/**
 * Localizes the meaning printed under a name on page 2 of the Vedic Namakaran
 * report for the language the customer ordered in.
 *
 * The curated English => [Tamil, Hindi] glossary lives in the generated
 * file namakaran_meanings.php (source of truth: data/namakaran_meaning_glossary.tsv,
 * generator: scripts/build_namakaran_glossary.mjs). Every meaning of the
 * shipped name bank is covered there, so a shipped name is never translated
 * word by word. The word glossary below is only a safety net for an older or
 * custom order that stored a meaning outside the bank, and the transliterator
 * handles any leftover proper noun, so a Tamil or Hindi report can never print
 * English text in its meaning line.
 */
require_once __DIR__ . '/namakaran_meanings.php';

if (!function_exists('astro_localize_namakaran_meaning')) {
    function astro_localize_namakaran_meaning($meaning, string $language): string {
        $english = trim((string) $meaning);
        $language = strtolower(trim($language));
        if (!in_array($language, ['en', 'ta', 'hi'], true)) {
            $language = 'en';
        }
        if ($language === 'en') return $english;
        if ($english === '') return $language === 'ta' ? 'பொருள் குறிப்பிடப்படவில்லை' : 'अर्थ उपलब्ध नहीं';

        // 1. The curated glossary — the only path a shipped name bank entry takes.
        $glossary = function_exists('astro_namakaran_meaning_glossary') ? astro_namakaran_meaning_glossary() : [];
        $entry = $glossary[strtolower($english)] ?? null;
        if (is_array($entry) && trim((string) ($entry[$language] ?? '')) !== '') {
            return trim((string) $entry[$language]);
        }

        // 2. Safety net for meanings outside the bank: word by word, then a
        //    phonetic transliteration for anything the word list does not hold.
        static $words = [
        'ta' => [
            'of'=>'இன்','the'=>'','a'=>'','an'=>'','and'=>'மற்றும்','with'=>'உடன்','from'=>'இருந்து','one'=>'ஒருவர்','lord'=>'இறைவன்','goddess'=>'தேவி','god'=>'இறைவன்','divine'=>'தெய்வீக','shiva'=>'சிவன்','murugan'=>'முருகன்','krishna'=>'கிருஷ்ணர்','vishnu'=>'விஷ்ணு','rama'=>'ராமர்','lakshmi'=>'லட்சுமி','parvati'=>'பார்வதி','durga'=>'துர்கா','ganesha'=>'விநாயகர்','saraswati'=>'சரஸ்வதி','sun'=>'சூரியன்','moon'=>'நிலவு','light'=>'ஒளி','bright'=>'பிரகாசமான','radiant'=>'ஒளிமிகு','wealth'=>'செல்வம்','virtue'=>'நல்லொழுக்கம்','prosperity'=>'செழிப்பு','grace'=>'அருள்','beauty'=>'அழகு','beautiful'=>'அழகான','charming'=>'கவர்ச்சியான','handsome'=>'அழகான','graceful'=>'கம்பீரமான','lovely'=>'அழகிய','sweet'=>'இனிய','pleasant'=>'இனிமையான','fragrance'=>'நறுமணம்','flower'=>'மலர்','jasmine'=>'மல்லிகை','lotus'=>'தாமரை','star'=>'நட்சத்திரம்','zodiac'=>'ராசி','river'=>'நதி','water'=>'நீர்','earth'=>'பூமி','world'=>'உலகம்','universe'=>'பிரபஞ்சம்','ocean'=>'கடல்','cloud'=>'மேகம்','clouds'=>'மேகங்கள்','king'=>'மன்னன்','queen'=>'ராணி','prince'=>'இளவரசன்','princess'=>'இளவரசி','woman'=>'பெண்','girl'=>'பெண்','boy'=>'சிறுவன்','son'=>'மகன்','daughter'=>'மகள்','mother'=>'தாய்','young'=>'இளம்','youthful'=>'இளமையான','noble'=>'மேன்மையான','gentle'=>'மென்மையான','pure'=>'தூய்மையான','sacred'=>'புனித','good'=>'நல்ல','wise'=>'ஞானமிக்க','intelligent'=>'புத்திசாலியான','knowledge'=>'அறிவு','wisdom'=>'ஞானம்','courage'=>'தைரியம்','brave'=>'வீரமான','warrior'=>'போர்வீரர்','victory'=>'வெற்றி','victorious'=>'வெற்றியாளர்','fame'=>'புகழ்','glory'=>'பெருமை','success'=>'வெற்றி','peaceful'=>'அமைதியான','calm'=>'சாந்தமான','life'=>'வாழ்வு','vitality'=>'உயிர்சக்தி','joy'=>'மகிழ்ச்சி','happiness'=>'மகிழ்ச்சி','love'=>'அன்பு','affection'=>'பாசம்','beloved'=>'அன்புக்குரிய','friend'=>'நண்பர்','friendship'=>'நட்பு','companion'=>'துணைவர்','leader'=>'தலைவர்','guide'=>'வழிகாட்டி','writing'=>'எழுத்து','written'=>'எழுதப்பட்ட','script'=>'எழுத்து','author'=>'ஆசிரியர்','master'=>'வல்லுநர்','arts'=>'கலைகள்','art'=>'கலை','music'=>'இசை','melody'=>'மெட்டு','song'=>'பாடல்','poem'=>'கவிதை','poetry'=>'கவிதை','devotional'=>'பக்தி','worship'=>'வழிபாடு','prayer'=>'பிரார்த்தனை','offering'=>'அர்ப்பணம்','blessing'=>'ஆசீர்வாதம்','teacher'=>'குரு','guru'=>'குரு','sage'=>'முனிவர்','ascetic'=>'துறவி','scholar'=>'அறிஞர்','learned'=>'அறிவாளர்','wish'=>'விருப்பம்','desire'=>'ஆசை','destiny'=>'விதி','fate'=>'தலைவிதி','future'=>'எதிர்காலம்','dawn'=>'விடியல்','morning'=>'காலை','night'=>'இரவு','breeze'=>'தென்றல்','wind'=>'காற்று','rain'=>'மழை','season'=>'பருவம்','spring'=>'வசந்தம்','golden'=>'தங்கம் போன்ற','gold'=>'தங்கம்','red'=>'சிவப்பு','blue'=>'நீலம்','white'=>'வெள்ளை','green'=>'பச்சை','precious'=>'விலைமதிப்பற்ற','gem'=>'ரத்தினம்','jewel'=>'ரத்தினம்','pearl'=>'முத்து','small'=>'சிறிய','little'=>'சிறிய','full'=>'நிறைந்த','part'=>'பகுதி','complete'=>'முழுமையான','whole'=>'முழுமை','unique'=>'தனித்துவமான','matchless'=>'இணையற்ற','immortal'=>'அழிவற்ற','eternal'=>'நித்திய','constant'=>'நிலையான','natural'=>'இயற்கையான','modest'=>'அடக்கமான','humble'=>'பணிவான','kind'=>'கருணையுள்ள','generous'=>'தாராளமான','compassionate'=>'கருணையுள்ள','patience'=>'பொறுமை','steady'=>'நிலையான','clever'=>'புத்திசாலியான','skilled'=>'திறமையான','talent'=>'திறன்','bestower'=>'வழங்குபவர்','giver'=>'வழங்குபவர்','protector'=>'பாதுகாவலர்','destroyer'=>'அழிப்பவர்','creator'=>'படைப்பாளர்','sustainer'=>'காப்பவர்','preserver'=>'காப்பவர்','ruler'=>'ஆட்சியாளர்','chief'=>'தலைவர்','spear'=>'வேல்','bridge'=>'பாலம்','hill'=>'மலை','mountain'=>'மலை','eyes'=>'கண்கள்','eyed'=>'கண்கள் கொண்ட','sight'=>'பார்வை','soul'=>'ஆன்மா','spirit'=>'உயிர்','heart'=>'இதயம்','mind'=>'மனம்','ring'=>'மோதிரம்','anklet'=>'கொலுசு','leaf'=>'இலை','petal'=>'மலரிதழ்','creeper'=>'கொடி','garden'=>'தோட்டம்','bird'=>'பறவை','swan'=>'அன்னம்','deer'=>'மான்','fish'=>'மீன்','peacock'=>'மயில்','rose'=>'ரோஜா','liberation'=>'முக்தி','salvation'=>'இரட்சிப்பு','union'=>'ஒன்றிணைவு','meeting'=>'சந்திப்பு','unity'=>'ஒற்றுமை','harmony'=>'நல்லிணக்கம்','progress'=>'முன்னேற்றம்','growth'=>'வளர்ச்சி','excellence'=>'சிறப்பு','enthusiasm'=>'உற்சாகம்','truth'=>'உண்மை','truthful'=>'உண்மையானவர்','faith'=>'நம்பிக்கை','trust'=>'நம்பிக்கை','humility'=>'பணிவு','modesty'=>'அடக்கம்','conduct'=>'நடத்தை','nature'=>'இயல்பு','first'=>'முதல்','primordial'=>'ஆதி','three'=>'மூன்று','two'=>'இரண்டு','thousand'=>'ஆயிரம்','hundred'=>'நூறு','fourth'=>'நான்காவது','ancient'=>'பண்டைய','famous'=>'புகழ்பெற்ற','revered'=>'மதிப்பிற்குரிய','special'=>'சிறப்பு','distinct'=>'தனித்துவமான','north'=>'வடக்கு','east'=>'கிழக்கு','day'=>'நாள்','rising'=>'உதயமான','awakened'=>'விழித்த','focused'=>'ஒருமுகமான','attentive'=>'கவனமான','desired'=>'விரும்பிய','superior'=>'மேலான','only'=>'ஒரே','soft'=>'மென்மையான','fine'=>'நுணுக்கமான','deep'=>'ஆழமான','pleased'=>'மகிழ்ந்த','fortune'=>'அதிர்ஷ்டம்','honour'=>'மரியாதை','honourable'=>'மரியாதைக்குரிய','fragrant'=>'நறுமணம் கொண்ட','pleasing'=>'இனிமையான','fond'=>'பற்றுள்ள','forms'=>'வடிவங்கள்','feet'=>'திருவடிகள்','fair'=>'நியாயமான','freedom'=>'சுதந்திரம்','liberty'=>'விடுதலை','eloquent'=>'சொல்வளம் மிக்க','furrow'=>'வரப்பு','fortunate'=>'அதிர்ஷ்டமான','blessed'=>'ஆசீர்வதிக்கப்பட்ட','playful'=>'விளையாட்டுத்தனமான','joyful'=>'மகிழ்ச்சியான','blissful'=>'ஆனந்தமான','conqueror'=>'வெற்றியாளர்','gods'=>'தேவர்கள்','wished'=>'விரும்பிய','child'=>'குழந்தை','lineage'=>'வம்சம்','family'=>'குடும்பம்','forest'=>'காடு','field'=>'வயல்','fresh'=>'புத்துணர்வான','smiling'=>'புன்னகை கொண்ட','cheerful'=>'மகிழ்ச்சியான','friendly'=>'நட்பான','chieftain'=>'குறுநிலத் தலைவர்','dimple'=>'கன்னக்குழி','fort'=>'கோட்டை','wife'=>'மனைவி','kartikeya'=>'கார்த்திகேயர்','reflection'=>'சிந்தனை','form'=>'வடிவம்','feather'=>'இறகு','flowers'=>'மலர்கள்','gardener'=>'தோட்டக்காரர்','happy'=>'மகிழ்ச்சியான','tranquillity'=>'அமைதி','delightful'=>'மகிழ்வூட்டும்','efficient'=>'திறமையான','able'=>'திறன் கொண்ட','fierce'=>'உக்கிரமான','butter'=>'வெண்ணெய்','dedicated'=>'அர்ப்பணிப்பான','offered'=>'அர்ப்பணிக்கப்பட்ட','unconquered'=>'வெல்லப்படாத','new'=>'புதிய','prosperous'=>'செழிப்பான','fire'=>'நெருப்பு','successful'=>'வெற்றிகரமான','achieved'=>'சாதித்த','festival'=>'விழா','softly'=>'மெதுவாக','humming'=>'முணுமுணுப்பு','perfected'=>'முழுமை பெற்ற','perfection'=>'முழுமை','attainment'=>'அடைதல்','flame'=>'சுடர்','crest'=>'சிகரம்','taste'=>'சுவை','refined'=>'செம்மையான'
        ],
        'hi' => [
            'of'=>'का','the'=>'','a'=>'एक','an'=>'एक','and'=>'और','with'=>'के साथ','from'=>'से','one'=>'एक','lord'=>'भगवान','goddess'=>'देवी','god'=>'ईश्वर','divine'=>'दिव्य','shiva'=>'शिव','murugan'=>'मुरुगन','krishna'=>'कृष्ण','vishnu'=>'विष्णु','rama'=>'राम','lakshmi'=>'लक्ष्मी','parvati'=>'पार्वती','durga'=>'दुर्गा','ganesha'=>'गणेश','saraswati'=>'सरस्वती','sun'=>'सूर्य','moon'=>'चंद्रमा','light'=>'प्रकाश','bright'=>'उज्ज्वल','radiant'=>'तेजस्वी','wealth'=>'धन','virtue'=>'सद्गुण','prosperity'=>'समृद्धि','grace'=>'कृपा','beauty'=>'सौंदर्य','beautiful'=>'सुंदर','charming'=>'आकर्षक','handsome'=>'सुंदर','graceful'=>'गरिमामय','lovely'=>'मनोहर','sweet'=>'मधुर','pleasant'=>'सुखद','fragrance'=>'सुगंध','flower'=>'फूल','jasmine'=>'चमेली','lotus'=>'कमल','star'=>'तारा','zodiac'=>'राशिचक्र','river'=>'नदी','water'=>'जल','earth'=>'पृथ्वी','world'=>'संसार','universe'=>'ब्रह्मांड','ocean'=>'समुद्र','cloud'=>'बादल','clouds'=>'बादल','king'=>'राजा','queen'=>'रानी','prince'=>'राजकुमार','princess'=>'राजकुमारी','woman'=>'स्त्री','girl'=>'लड़की','boy'=>'बालक','son'=>'पुत्र','daughter'=>'पुत्री','mother'=>'माता','young'=>'युवा','youthful'=>'युवा','noble'=>'श्रेष्ठ','gentle'=>'कोमल','pure'=>'शुद्ध','sacred'=>'पवित्र','good'=>'अच्छा','wise'=>'ज्ञानी','intelligent'=>'बुद्धिमान','knowledge'=>'ज्ञान','wisdom'=>'बुद्धि','courage'=>'साहस','brave'=>'वीर','warrior'=>'योद्धा','victory'=>'विजय','victorious'=>'विजयी','fame'=>'यश','glory'=>'गौरव','success'=>'सफलता','peaceful'=>'शांत','calm'=>'स्थिर','life'=>'जीवन','vitality'=>'जीवनशक्ति','joy'=>'आनंद','happiness'=>'खुशी','love'=>'प्रेम','affection'=>'स्नेह','beloved'=>'प्रिय','friend'=>'मित्र','friendship'=>'मित्रता','companion'=>'साथी','leader'=>'नेता','guide'=>'मार्गदर्शक','writing'=>'लेखन','written'=>'लिखित','script'=>'लिपि','author'=>'लेखक','master'=>'आचार्य','arts'=>'कलाएँ','art'=>'कला','music'=>'संगीत','melody'=>'धुन','song'=>'गीत','poem'=>'कविता','poetry'=>'काव्य','devotional'=>'भक्ति','worship'=>'पूजा','prayer'=>'प्रार्थना','offering'=>'अर्पण','blessing'=>'आशीर्वाद','teacher'=>'गुरु','guru'=>'गुरु','sage'=>'ऋषि','ascetic'=>'संन्यासी','scholar'=>'विद्वान','learned'=>'विद्वान','wish'=>'इच्छा','desire'=>'अभिलाषा','destiny'=>'भाग्य','fate'=>'नियति','future'=>'भविष्य','dawn'=>'प्रभात','morning'=>'सुबह','night'=>'रात','breeze'=>'समीर','wind'=>'हवा','rain'=>'वर्षा','season'=>'ऋतु','spring'=>'वसंत','golden'=>'स्वर्णिम','gold'=>'सोना','red'=>'लाल','blue'=>'नीला','white'=>'सफेद','green'=>'हरा','precious'=>'अनमोल','gem'=>'रत्न','jewel'=>'रत्न','pearl'=>'मोती','small'=>'छोटा','little'=>'नन्हा','full'=>'भरपूर','part'=>'अंश','complete'=>'पूर्ण','whole'=>'संपूर्ण','unique'=>'अद्वितीय','matchless'=>'बेजोड़','immortal'=>'अमर','eternal'=>'शाश्वत','constant'=>'स्थिर','natural'=>'प्राकृतिक','modest'=>'विनम्र','humble'=>'नम्र','kind'=>'दयालु','generous'=>'उदार','compassionate'=>'करुणामय','patience'=>'धैर्य','steady'=>'दृढ़','clever'=>'चतुर','skilled'=>'कुशल','talent'=>'प्रतिभा','bestower'=>'देने वाला','giver'=>'दाता','protector'=>'रक्षक','destroyer'=>'नाश करने वाला','creator'=>'सृजनकर्ता','sustainer'=>'पालनकर्ता','preserver'=>'संरक्षक','ruler'=>'शासक','chief'=>'मुखिया','spear'=>'भाला','bridge'=>'सेतु','hill'=>'पहाड़ी','mountain'=>'पर्वत','eyes'=>'आँखें','eyed'=>'नेत्रों वाला','sight'=>'दृष्टि','soul'=>'आत्मा','spirit'=>'जीव','heart'=>'हृदय','mind'=>'मन','ring'=>'अंगूठी','anklet'=>'पायल','leaf'=>'पत्ता','petal'=>'पंखुड़ी','creeper'=>'लता','garden'=>'बगीचा','bird'=>'पक्षी','swan'=>'हंस','deer'=>'हिरण','fish'=>'मछली','peacock'=>'मोर','rose'=>'गुलाब','liberation'=>'मोक्ष','salvation'=>'मुक्ति','union'=>'मिलन','meeting'=>'भेंट','unity'=>'एकता','harmony'=>'सामंजस्य','progress'=>'प्रगति','growth'=>'विकास','excellence'=>'उत्कृष्टता','enthusiasm'=>'उत्साह','truth'=>'सत्य','truthful'=>'सत्यवादी','faith'=>'विश्वास','trust'=>'भरोसा','humility'=>'विनम्रता','modesty'=>'शालीनता','conduct'=>'आचरण','nature'=>'स्वभाव','first'=>'प्रथम','primordial'=>'आदिम','three'=>'तीन','two'=>'दो','thousand'=>'हजार','hundred'=>'सौ','fourth'=>'चौथा','ancient'=>'प्राचीन','famous'=>'प्रसिद्ध','revered'=>'पूज्य','special'=>'विशेष','distinct'=>'अलग','north'=>'उत्तर','east'=>'पूर्व','day'=>'दिन','rising'=>'उगता','awakened'=>'जागृत','focused'=>'एकाग्र','attentive'=>'सजग','desired'=>'वांछित','superior'=>'श्रेष्ठ','only'=>'एकमात्र','soft'=>'मृदु','fine'=>'सुंदर','deep'=>'गहरा','pleased'=>'प्रसन्न','fortune'=>'सौभाग्य','honour'=>'सम्मान','honourable'=>'सम्मानित','fragrant'=>'सुगंधित','pleasing'=>'सुखद','fond'=>'अनुरक्त','forms'=>'रूप','feet'=>'चरण','fair'=>'सुंदर','freedom'=>'स्वतंत्रता','liberty'=>'स्वाधीनता','eloquent'=>'वाक्पटु','furrow'=>'हल की रेखा','fortunate'=>'भाग्यशाली','blessed'=>'धन्य','playful'=>'चंचल','joyful'=>'आनंदित','blissful'=>'आनंदमय','conqueror'=>'विजेता','gods'=>'देवता','wished'=>'वांछित','child'=>'बच्चा','lineage'=>'वंश','family'=>'परिवार','forest'=>'वन','field'=>'क्षेत्र','fresh'=>'ताज़ा','smiling'=>'मुस्कुराता हुआ','cheerful'=>'प्रसन्न','friendly'=>'मित्रवत','chieftain'=>'सरदार','dimple'=>'गाल का गड्ढा','fort'=>'दुर्ग','wife'=>'पत्नी','kartikeya'=>'कार्तिकेय','reflection'=>'चिंतन','form'=>'रूप','feather'=>'पंख','flowers'=>'फूल','gardener'=>'माली','happy'=>'खुश','tranquillity'=>'शांति','delightful'=>'आनंदमय','efficient'=>'कुशल','able'=>'सक्षम','fierce'=>'उग्र','butter'=>'मक्खन','dedicated'=>'समर्पित','offered'=>'अर्पित','unconquered'=>'अजेय','new'=>'नया','prosperous'=>'समृद्ध','fire'=>'अग्नि','successful'=>'सफल','achieved'=>'सिद्ध','festival'=>'उत्सव','softly'=>'धीरे','humming'=>'गुनगुनाहट','perfected'=>'सिद्ध','perfection'=>'पूर्णता','attainment'=>'प्राप्ति','flame'=>'ज्योति','crest'=>'शिखर','taste'=>'स्वाद','refined'=>'परिष्कृत'
        ]
        ];


        $wordsForLanguage = $words[$language] ?? $words['ta'];
        $parts = preg_split("/([A-Za-z]+(?:'s)?|[^A-Za-z]+)/", $english, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
        $out = '';
        foreach ($parts as $part) {
            if (!preg_match('/^[A-Za-z]/', $part)) {
                $out .= str_replace('&', $language === 'ta' ? ' மற்றும் ' : ' और ', $part);
                continue;
            }
            $lower = strtolower($part);
            if (array_key_exists($lower, $wordsForLanguage)) {
                $out .= $wordsForLanguage[$lower];
                continue;
            }
            if (substr($lower, -2) === "'s") {
                $root = substr($lower, 0, -2);
                $rootValue = $wordsForLanguage[$root] ?? $root;
                if ($rootValue === $root && class_exists('AstroReportViews')) {
                    $rootValue = $language === 'ta'
                        ? AstroReportViews::transliterateToTamil($root)
                        : AstroReportViews::transliterateToHindi($root);
                }
                $out .= $language === 'ta' ? $rootValue . 'ன்' : $rootValue . ' का';
                continue;
            }
            if (class_exists('AstroReportViews')) {
                $out .= $language === 'ta'
                    ? AstroReportViews::transliterateToTamil($part)
                    : AstroReportViews::transliterateToHindi($part);
            } else {
                $out .= $language === 'ta' ? 'பெயர்' : 'नाम';
            }
        }
        $out = preg_replace('/\s+([,;:)])/u', '$1', $out);
        $out = preg_replace('/([(])\s+/u', '$1', $out);
        $localized = trim((string) preg_replace('/\s{2,}/u', ' ', (string) $out));
        // Never leak an English fragment into a Tamil or Hindi-only meaning line.
        return trim((string) preg_replace('/[A-Za-z]+/u', $language === 'ta' ? 'பொருள்' : 'अर्थ', $localized));
    }
}
