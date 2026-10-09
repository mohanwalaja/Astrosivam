<?php
require_once __DIR__ . '/../branding.php';
/**
 * ASTRO SIVAM - Server-side Report HTML Views & mPDF Exporter (Single-Source Architecture)
 *
 * Single-Source Architecture:
 * 1. AstroReportViews produces the 100% exact full HTML document string for all 4 services
 *    (Birth Jathagam 3-pages, Marriage Compatibility 1-page, Baby Naming 2-pages, Subha Muhurtham calendar) across English, Tamil, and Hindi.
 * 2. AstroMpdfReports::convertHtmlToPdf takes that exact HTML string and renders a high-definition PDF with mPDF.
 */

// Load Composer autoloader (mPDF and dependencies in public_html/vendor/)
if (is_file(__DIR__ . '/../../vendor/autoload.php')) {
    require_once __DIR__ . '/../../vendor/autoload.php';
}

require_once __DIR__ . '/mpdf_fontconfig.php';
require_once __DIR__ . '/muhurtham_report_notes.php';
require_once __DIR__ . '/wedding_disclaimer_notes.php';

if (!function_exists('astro_report_normalize_language')) {
    /** Local builder boundary: trust only the supported BCP-47 report language tags. */
    function astro_report_normalize_language($value): string {
        if (function_exists('astro_normalize_report_language')) {
            return astro_normalize_report_language($value);
        }
        if (!is_string($value)) return 'en';
        $language = strtolower(trim($value));
        return in_array($language, ['en', 'ta', 'hi'], true) ? $language : 'en';
    }
}

class AstroReportViews {

    /**
     * The Birth Jathagam is a STRICT three-sheet document. The total lives here
     * once - mirroring JATHAGAM_PAGE_COUNT in src/services/jathagamHtmlBuilder.ts
     * - so the three page headers can never disagree, and a fourth sheet can
     * never be introduced without this number changing too.
     */
    public const JATHAGAM_PAGE_TOTAL = 3;

    public static function e($str): string {
        return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
    }

    /**
     * THE date-of-birth format used in every report PDF: DD/MM/YYYY
     * (e.g. "27/07/1990"). Accepts ISO YYYY-MM-DD (optionally with a time
     * suffix), YYYY/MM/DD, or an already day-first DD-MM-YYYY value.
     * Anything unrecognised is returned unchanged (or $fallback when empty).
     */
    public static function birthDate($value, string $fallback = ''): string {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') { return $fallback; }
        if (preg_match('/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:$|[T\s])/', $raw, $m)) {
            return str_pad($m[3], 2, '0', STR_PAD_LEFT) . '/' . str_pad($m[2], 2, '0', STR_PAD_LEFT) . '/' . $m[1];
        }
        if (preg_match('/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/', $raw, $m)) {
            return str_pad($m[1], 2, '0', STR_PAD_LEFT) . '/' . str_pad($m[2], 2, '0', STR_PAD_LEFT) . '/' . $m[3];
        }
        return $raw;
    }

    private static function validRasiNumber($value): ?int {
        if (!is_numeric($value) || (float) $value !== (float) (int) $value || (int) $value < 1 || (int) $value > 12) {
            return null;
        }
        return (int) $value;
    }

    private static function rasiNameForNumber($value, string $lang): string {
        static $names = [
            1 => ['en' => 'Mesham (Aries)', 'ta' => 'மேஷம்', 'hi' => 'मेष'],
            2 => ['en' => 'Rishabam (Taurus)', 'ta' => 'ரிஷபம்', 'hi' => 'वृषभ'],
            3 => ['en' => 'Mithunam (Gemini)', 'ta' => 'மிதுனம்', 'hi' => 'मिथुन'],
            4 => ['en' => 'Kadagam (Cancer)', 'ta' => 'கடகம்', 'hi' => 'कर्क'],
            5 => ['en' => 'Simham (Leo)', 'ta' => 'சிம்மம்', 'hi' => 'सिंह'],
            6 => ['en' => 'Kanni (Virgo)', 'ta' => 'கன்னி', 'hi' => 'कन्या'],
            7 => ['en' => 'Thulam (Libra)', 'ta' => 'துலாம்', 'hi' => 'तुला'],
            8 => ['en' => 'Viruchigam (Scorpio)', 'ta' => 'விருச்சிகம்', 'hi' => 'वृश्चिक'],
            9 => ['en' => 'Dhanusu (Sagittarius)', 'ta' => 'தனுசு', 'hi' => 'धनु'],
            10 => ['en' => 'Magaram (Capricorn)', 'ta' => 'மகரம்', 'hi' => 'मकर'],
            11 => ['en' => 'Kumbam (Aquarius)', 'ta' => 'கும்பம்', 'hi' => 'कुंभ'],
            12 => ['en' => 'Meenam (Pisces)', 'ta' => 'மீனம்', 'hi' => 'मीन'],
        ];
        $rasiNumber = self::validRasiNumber($value);
        return $rasiNumber !== null ? ($names[$rasiNumber][$lang] ?? 'N/A') : 'N/A';
    }

    public static function firstTamilSound(string $text): string {
        preg_match('/^[\x{0B85}-\x{0BB9}][\x{0BBE}-\x{0BCD}\x{0BD7}]?/u', trim($text), $matches);
        return $matches[0] ?? '';
    }

    public static function nameMatchesPada(string $name, string $sound): bool {
        $first = self::firstTamilSound(self::transliterateToTamil($name));
        foreach (explode('/', $sound) as $option) {
            if ($first !== '' && $first === self::firstTamilSound($option)) return true;
        }
        return false;
    }

    public static function transliterateToTamil(string $name): string {
        $trimmed = trim($name);
        $lower = strtolower(preg_replace('/[^a-zA-Z]/', '', $trimmed));
        if ($lower === '') return $trimmed;

        static $map = [
            'dushyant' => 'துஷ்யந்த்',
            'revathi' => 'ரேவதி',
            'renuka' => 'ரேணுகா',
            'renugadevi' => 'ரேணுகாதேவி',
            'rethika' => 'ரேதிகா',
            'rekha' => 'ரேகா',
            'reva' => 'ரேவா',
            'rohini' => 'ரோஹிணி',
            'roshini' => 'ரோஷினி',
            'roshni' => 'ரோஷ்னி',
            'rohita' => 'ரோஹிதா',
            'tapan' => 'தபன்',
            'rochak' => 'ரோசக்',
            'reet' => 'ரீத்',
            'roshika' => 'ரோஷிகா',
            'ronika' => 'ரோனிகா',
            'romil' => 'ரோமில்',
            'ronit' => 'ரோனித்',
            'ronak' => 'ரோனக்',
            'rajesh' => 'ராஜேஷ்',
            'rakesh' => 'ரகேஷ்',
            'ramesh' => 'ரமேஷ்',
            'rupesh' => 'ரூபேஷ்',
            'rudhran' => 'ருத்ரன்', 'rudra' => 'ருத்ரா', 'rudramoorthy' => 'ருத்ரமூர்த்தி',
            'rupan' => 'ரூபன்', 'rukesh' => 'ருகேஷ்', 'raman' => 'ராமன்', 'rama' => 'ராமர்', 'ram' => 'ராம்',
            'ravichandran' => 'ரவிச்சந்திரன்', 'ramachandran' => 'ராமச்சந்திரன்',
            'rithik' => 'ரித்திக்', 'rethinavel' => 'ரத்தினவேல்', 'rethik' => 'ரேத்திக்',
            'renjith' => 'ரேஞ்சித்', 'revanth' => 'ரேவந்த்', 'rajan' => 'ராஜன்',
            'ramakrishnan' => 'ராமகிருஷ்ணன்', 'rajarajan' => 'ராஜராஜன்',
            'rithish' => 'ரித்தீஷ்', 'rohan' => 'ரோஹன்', 'rohit' => 'ரோஹித்',
            'rohith' => 'ரோஹித்', 'roshan' => 'ரோஷன்', 'rohinthan' => 'ரோஹிந்தன்',
            'raghav' => 'ராகவ்', 'raghavan' => 'ராகவன்', 'rajendran' => 'ராஜேந்திரன்',
            'raam' => 'ராம்', 'rishikesan' => 'ரிஷிகேசன்', 'rishikesh' => 'ரிஷிகேஷ்',
            'rishi' => 'ரிஷி', 'reyansh' => 'ரேயான்ஷ்', 'revansh' => 'ரேவான்ஷ்',
            'rahul' => 'ராகுல்', 'ravi' => 'ரவி', 'ritvik' => 'ரித்விக்',
            'ridhaan' => 'ரிதான்', 'ritul' => 'ரிதுல்', 'ranveer' => 'ரன்வீர்',
            'rishabh' => 'ரிஷப்', 'tharun' => 'தருண்', 'tarun' => 'தருண்',
            'thangaraj' => 'தங்கராஜ்', 'thangavel' => 'தங்கவேல்', 'thamizharasan' => 'தமிழரசன்',
            'dhanasekaran' => 'தனசேகரன்', 'dharanidharan' => 'தரணிதரன்',
            'thavamani' => 'தவமணி', 'thamodaran' => 'தாமோதரன்', 'thayumanavan' => 'தாயுமானவன்',
            'dhanush' => 'தனுஷ்', 'dheeraj' => 'தீரஜ்', 'dhiraj' => 'திராஜ்',
            'danish' => 'டேனிஷ்', 'dheeman' => 'தீமன்', 'dhir' => 'தீர்',
            'theerth' => 'தீர்த்', 'aarav' => 'ஆரவ்', 'aditya' => 'ஆதித்யா',
            'ananya' => 'அனன்யா', 'anushka' => 'அனுஷ்கா', 'akshay' => 'அக்ஷய்',
            'arjun' => 'அர்ஜுன்', 'abhay' => 'அபய்', 'arnav' => 'அர்ணவ்',
            'anirudh' => 'அனிருத்', 'aryan' => 'ஆர்யன்', 'advait' => 'அத்வைத்',
            'akhil' => 'அகில்', 'ansh' => 'அன்ஷ்', 'amit' => 'அமித்',
            'aanya' => 'ஆனியா', 'aaradhya' => 'ஆராத்யா', 'aditi' => 'அதிதி',
            'akshara' => 'அக்ஷரா', 'anika' => 'அனிகா', 'aadya' => 'ஆத்யா',
            'avni' => 'அவனி', 'amrita' => 'அமிர்தா', 'aisha' => 'ஆயிஷா',
            'arul' => 'அருள்', 'anbu' => 'அன்பு', 'azhagan' => 'அழகன்',
            'aadhavan' => 'ஆதவன்', 'amudhan' => 'அமுதன்', 'amudha' => 'அமுதா',
            'arivazhagan' => 'அறிவழகன்', 'anbarasan' => 'அன்பரசன்', 'arulmozhi' => 'அருள்மொழி',
            'anjali' => 'அஞ்சலி', 'aarthi' => 'ஆர்த்தி', 'abinaya' => 'அபிநயா',
            'anitha' => 'அனிதா', 'aruna' => 'அருணா', 'aadhira' => 'ஆதிரா',
            'anbarasi' => 'அன்பரசி', 'agalya' => 'அகல்யா', 'anusiya' => 'அனுசியா',
            'ilango' => 'இளங்கோ', 'ilamaran' => 'இளமாறன்', 'ilavarasan' => 'இளவரசன்',
            'iniyan' => 'இனியன்', 'ilakkiyan' => 'இலக்கியன்', 'isaiarasu' => 'இசையரசு',
            'ilayarasan' => 'இளையரசன்', 'iniya' => 'இனியா', 'ilakkiya' => 'இலக்கியா',
            'ilamathi' => 'இளமதி', 'inbavalli' => 'இன்பவள்ளி', 'isaiyarasi' => 'இசையரசி',
            'udhay' => 'உதய்', 'udhayan' => 'உதயன்', 'uthaman' => 'உத்தமன்',
            'ulaganathan' => 'உலகநாதன்', 'udhayakumar' => 'உதயகுமார்',
            'umamaheswari' => 'உமாமகேஸ்வரி', 'uma' => 'உமா', 'usha' => 'உஷா',
            'ezhilarasan' => 'எழிலரசன்', 'elango' => 'இளங்கோ', 'ezhilan' => 'எழிலன்',
            'eesan' => 'ஈசன்', 'ezhil' => 'எழில்', 'ezhilarasi' => 'எழிலரசி',
            'eeswari' => 'ஈஸ்வரி', 'elavarasi' => 'இளவரசி', 'oviyan' => 'ஓவியன்', 'oviya' => 'ஓவியா',
            'vasanthan' => 'வசந்தன்', 'valavan' => 'வளவன்', 'vaanavan' => 'வானவன்',
            'varadhan' => 'வரதன்', 'vaithianathan' => 'வைத்தியநாதன்', 'vasanthakumar' => 'வசந்தகுமார்',
            'vallavan' => 'வல்லவன்', 'vasudevan' => 'வாசுதேவன்', 'varadharajan' => 'வரதராஜன்',
            'vallinayagam' => 'வள்ளிநாயகம்', 'vaishnavi' => 'வைஷ்ணவி', 'vasanthi' => 'வசந்தி',
            'valli' => 'வள்ளி', 'vasundhari' => 'வசுந்தரி', 'vaanathi' => 'வானதி',
            'vaijayanthi' => 'வைஜெயந்தி', 'valarmathi' => 'வளர்மதி', 'veeramani' => 'வீரமணி',
            'veeran' => 'வீரன்', 'vignesh' => 'விக்னேஷ்', 'vigneshwaran' => 'விக்னேஸ்வரன்',
            'vijayan' => 'விஜயன்', 'veerapandian' => 'வீரபாண்டியன்', 'vidhya' => 'வித்யா',
            'viswanathan' => 'விஸ்வநாதன்', 'vijayakumar' => 'விஜயகுமார்',
            'senthil' => 'செந்தில்', 'selvan' => 'செல்வன்', 'selvam' => 'செல்வம்',
            'sekaran' => 'சேகரன்', 'sethupathi' => 'சேதுபதி', 'senthilvelan' => 'செந்தில்வேலன்',
            'selvakumar' => 'செல்வகுமார்', 'sekar' => 'சேகர்', 'senthamilan' => 'செந்தமிழன்',
            'sedhuraman' => 'சேதுராமன்', 'seetha' => 'சீதா', 'selvi' => 'செல்வி',
            'selvarani' => 'செல்வராணி', 'seethalakshmi' => 'சீதாலட்சுமி', 'senthamarai' => 'செந்தாமரை',
            'selvarasi' => 'செல்வரசி', 'somasundaram' => 'சோமசுந்தரம்', 'chozhan' => 'சோழன்',
            'somanathan' => 'சோமநாதன்', 'chokkalingam' => 'சொக்கலிங்கம்', 'somasundar' => 'சோமசுந்தர்',
            'solaippan' => 'சோலைப்பன்', 'chozharasan' => 'சோழரசன்', 'sobana' => 'சோபனா',
            'sornambika' => 'சொர்ணாம்பிகா', 'sundaram' => 'சுந்தரம்', 'subramanian' => 'சுப்பிரமணியன்',
            'suriyan' => 'சூரியன்', 'suresh' => 'சுரேஷ்', 'sureshkumar' => 'சுரேஷ்குமார்',
            'sudharshan' => 'சுதர்ஷன்', 'sutharsan' => 'சுதர்சன்', 'suganthan' => 'சுகந்தன்',
            'suganya' => 'சுகன்யா', 'sudha' => 'சுதா', 'sumathi' => 'சுமதி',
            'sundari' => 'சுந்தரி', 'sujatha' => 'சுஜாதா', 'sukirtha' => 'சுகிர்தா',
            'supriya' => 'சுப்ரியா', 'sunitha' => 'சுனிதா', 'suvetha' => 'சுவேதா',
            'subiksha' => 'சுபிக்ஷா', 'lavanyan' => 'லாவண்யன்', 'lakshmanan' => 'லக்ஷ்மணன்',
            'lalithan' => 'லலிதன்', 'lakshminarayanan' => 'லக்ஷ்மிநாராயணன்', 'lakshan' => 'லக்ஷன்',
            'lavanya' => 'லாவண்யா', 'lakshmi' => 'லட்சுமி', 'laxmi' => 'லட்சுமி',
            'lalitha' => 'லலிதா', 'lakshana' => 'லக்ஷணா', 'lakshmipriya' => 'லக்ஷ்மிப்ரியா',
            'lalithambal' => 'லலிதாம்பாள்', 'karthik' => 'கார்த்திக்', 'karthika' => 'கார்த்திகா',
            'karthikeyan' => 'கார்த்திகேயன்', 'kavitha' => 'கவிதா', 'kamal' => 'கமல்',
            'kamalan' => 'கமலன்', 'kavin' => 'கவின்', 'kaviyarasan' => 'கவியரசன்',
            'kannan' => 'கண்ணன்', 'krishnan' => 'கிருஷ்ணன்', 'krishna' => 'கிருஷ்ணா',
            'ganesh' => 'கணேஷ்', 'ganesha' => 'கணேஷா', 'shiva' => 'சிவா',
            'siva' => 'சிவா', 'murugan' => 'முருகன்', 'thirumavalavan' => 'திருமாவளவன்',
            'vishnu' => 'விஷ்ணு', 'vijay' => 'விஜய்', 'vikram' => 'விக்ரம்',
            'vihaan' => 'விஹான்', 'vivaan' => 'விவான்'
        ];
        if (isset($map[$lower])) {
            return $map[$lower];
        }

        static $suffixes = [
            ['moorthy', 'மூர்த்தி'], ['murthy', 'மூர்த்தி'], ['murthi', 'மூர்த்தி'],
            ['nathan', 'நாதன்'], ['rajan', 'ராஜன்'], ['kumar', 'குமார்'],
            ['kumaran', 'குமரன்'], ['swamy', 'சாமி'], ['sami', 'சாமி'],
            ['priya', 'பிரியா'], ['lakshmi', 'லட்சுமி'], ['laxmi', 'லட்சுமி'],
            ['vathi', 'வதி'], ['wathi', 'வதி'], ['rani', 'ராணி'],
            ['devi', 'தேவி'], ['shree', 'ஸ்ரீ'], ['sri', 'ஸ்ரீ'],
            ['velan', 'வேலன்'], ['vel', 'வேல்'], ['ammal', 'அம்மாள்'],
            ['dharan', 'தரன்'], ['sekaran', 'சேகரன்'], ['arasan', 'அரசன்'],
            ['arasu', 'அரசு'], ['mani', 'மணி'], ['valli', 'வள்ளி'],
            ['mathi', 'மதி'], ['selvi', 'செல்வி'], ['selvan', 'செல்வன்'],
            ['chandran', 'சந்திரன்'], ['krishnan', 'கிருஷ்ணன்'], ['raman', 'ராமன்'],
            ['lingam', 'லிங்கம்'], ['pathi', 'பதி']
        ];
        foreach ($suffixes as [$suffix, $rep]) {
            if (str_ends_with($lower, $suffix)) {
                $prefix = substr($lower, 0, -strlen($suffix));
                if ($prefix !== '') {
                    return self::transliterateToTamil($prefix) . $rep;
                }
            }
        }

        static $consonants = [
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

        static $vowelInitial = [
            'aa' => 'ஆ', 'a' => 'அ', 'ee' => 'ஈ', 'ii' => 'ஈ', 'i' => 'இ',
            'oo' => 'ஊ', 'uu' => 'ஊ', 'u' => 'உ', 'ai' => 'ஐ', 'ay' => 'ஐ',
            'ae' => 'ஏ', 'ea' => 'ஏ', 'e' => 'எ', 'oa' => 'ஓ', 'oh' => 'ஓ', 'o' => 'ஒ',
            'au' => 'ஔ', 'ou' => 'ஔ', 'ow' => 'ஔ'
        ];

        static $vowelSigns = [
            'aa' => 'ா', 'a' => '', 'ee' => 'ீ', 'ii' => 'ீ', 'i' => 'ி',
            'oo' => 'ூ', 'uu' => 'ூ', 'u' => 'ு', 'ai' => 'ை', 'ay' => 'ை',
            'ae' => 'ே', 'ea' => 'ே', 'e' => 'ெ', 'oa' => 'ோ', 'oh' => 'ோ', 'o' => 'ொ',
            'au' => 'ௌ', 'ou' => 'ௌ', 'ow' => 'ௌ'
        ];

        static $vowelList = ['aa', 'ai', 'ay', 'au', 'ou', 'ow', 'ee', 'ii', 'oo', 'uu', 'ae', 'ea', 'oa', 'oh', 'a', 'i', 'u', 'e', 'o'];

        $out = '';
        $i = 0;
        $len = strlen($lower);

        foreach ($vowelList as $v) {
            if (str_starts_with($lower, $v)) {
                $out .= $vowelInitial[$v] ?? '';
                $i += strlen($v);
                break;
            }
        }

        while ($i < $len) {
            $cFound = '';
            $cTamil = '';
            $sub = substr($lower, $i);
            foreach ($consonants as [$token, $tam]) {
                if (str_starts_with($sub, $token)) {
                    $cFound = $token;
                    $cTamil = $tam;
                    break;
                }
            }

            if ($cFound !== '') {
                $i += strlen($cFound);
                $vFound = '';
                $vSign = '';
                $subAfter = substr($lower, $i);
                foreach ($vowelList as $v) {
                    if (str_starts_with($subAfter, $v)) {
                        $vFound = $v;
                        $vSign = $vowelSigns[$v] ?? '';
                        break;
                    }
                }

                if ($cFound === 'n' && $i >= $len) {
                    $out .= 'ன்';
                } elseif ($cFound === 'm' && $i >= $len) {
                    $out .= 'ம்';
                } elseif ($cFound === 'r' && $i >= $len) {
                    $out .= 'ர்';
                } elseif ($cFound === 'l' && $i >= $len) {
                    $out .= 'ல்';
                } elseif ($cFound === 's' && $i >= $len) {
                    $out .= 'ஸ்';
                } elseif ($cFound === 'sh' && $i >= $len) {
                    $out .= 'ஷ்';
                } elseif ($cFound === 'th' && $i >= $len) {
                    $out .= 'த்';
                } elseif ($cFound === 'k' && $i >= $len) {
                    $out .= 'க்';
                } elseif ($vFound === '') {
                    if (str_ends_with($cTamil, '்')) {
                        $out .= $cTamil;
                    } else {
                        $out .= $cTamil . '்';
                    }
                } else {
                    $i += strlen($vFound);
                    if (str_ends_with($cTamil, '்')) {
                        $out .= mb_substr($cTamil, 0, -1, 'UTF-8') . $vSign;
                    } else {
                        $out .= $cTamil . $vSign;
                    }
                }
            } else {
                $ch = $lower[$i];
                if (isset($vowelInitial[$ch])) {
                    $out .= $vowelInitial[$ch];
                } else {
                    $out .= $ch;
                }
                $i++;
            }
        }

        return $out !== '' ? $out : $trimmed;
    }

    public static function transliterateToHindi(string $name): string {
        $trimmed = trim($name);
        $lower = strtolower(preg_replace('/[^a-zA-Z]/', '', $trimmed));
        if ($lower === '') return $trimmed;

        static $map = [
            'rudhran' => 'रुद्रन', 'rudra' => 'रुद्र', 'rudramoorthy' => 'रुद्रमूर्ति',
            'rupan' => 'रूपन', 'rukesh' => 'रुकेश', 'raman' => 'रामन', 'rama' => 'राम', 'ram' => 'राम',
            'ravichandran' => 'रविचंद्रन', 'ramachandran' => 'रामचंद्रन',
            'rithik' => 'ऋतिक', 'rethinavel' => 'रत्नवेल', 'rethik' => 'रेतिक',
            'renjith' => 'रंजीत', 'revanth' => 'रेवंत', 'rajan' => 'राजन',
            'ramakrishnan' => 'रामकृष्णन', 'rajarajan' => 'राजराजन',
            'rithish' => 'रितीश', 'rohan' => 'रोहन', 'rohit' => 'रोहित',
            'rohith' => 'रोहित', 'roshan' => 'रोशन', 'rohinthan' => 'रोहिंतन',
            'raghav' => 'राघव', 'raghavan' => 'राघवन', 'rajendran' => 'राजेंद्रन',
            'raam' => 'राम', 'rishikesan' => 'ऋषिकेश', 'rishikesh' => 'ऋषिकेश',
            'rishi' => 'ऋषि', 'reyansh' => 'रेयांश', 'revansh' => 'रेवांश',
            'rahul' => 'राहुल', 'ravi' => 'रवि', 'ritvik' => 'ऋत्विक',
            'ridhaan' => 'रिधान', 'ritul' => 'रितुल', 'ranveer' => 'रणवीर',
            'rishabh' => 'ऋषभ', 'tharun' => 'तरुण', 'tarun' => 'तरुण',
            'thangaraj' => 'तंगराज', 'thangavel' => 'तंगवेल', 'thamizharasan' => 'तमिळरसन',
            'dhanasekaran' => 'धनशेखरन', 'dharanidharan' => 'धरणीधरन',
            'thavamani' => 'तवमणि', 'thamodaran' => 'दामोदरन', 'thayumanavan' => 'तायुमानवन',
            'dhanush' => 'धनुष', 'dheeraj' => 'धीरज', 'dhiraj' => 'धीरज',
            'danish' => 'दानिश', 'dheeman' => 'धीमान', 'dhir' => 'धीर',
            'theerth' => 'तीर्थ', 'aarav' => 'आरव', 'aditya' => 'आदित्य',
            'ananya' => 'अनन्या', 'anushka' => 'अनुष्का', 'akshay' => 'अक्षय',
            'arjun' => 'अर्जुन', 'abhay' => 'अभय', 'arnav' => 'अर्णव',
            'anirudh' => 'अनिरुद्ध', 'aryan' => 'आर्यन', 'advait' => 'अद्वैत',
            'akhil' => 'अखिल', 'ansh' => 'अंश', 'amit' => 'अमित',
            'aanya' => 'आन्या', 'aaradhya' => 'आराध्या', 'aditi' => 'अदिति',
            'akshara' => 'अक्षरा', 'anika' => 'अनिका', 'aadya' => 'आद्या',
            'avni' => 'अवनी', 'amrita' => 'अमृता', 'aisha' => 'आयशा',
            'karthik' => 'कार्तिक', 'karthika' => 'कार्तिका', 'karthikeyan' => 'कार्तिकेयन',
            'lakshmi' => 'लक्ष्मी', 'laxmi' => 'लक्ष्मी', 'vishnu' => 'विष्णु',
            'ganesh' => 'गणेश', 'shiva' => 'शिव', 'suresh' => 'सुरेश',
            'senthil' => 'सेंथिल', 'selvan' => 'सेल्वन', 'vijay' => 'विजय',
            'vikram' => 'विक्रम', 'vihaan' => 'विहान', 'vivaan' => 'विवान',
            'lavanya' => 'लावण्या'
        ];
        if (isset($map[$lower])) {
            return $map[$lower];
        }

        static $consonantsHi = [
            ['karth', 'कार्थ'], ['krish', 'कृष'], ['shree', 'श्री'], ['sri', 'श्री'],
            ['ksh', 'क्ष'], ['gy', 'ज्ञ'], ['tr', 'त्र'], ['chh', 'छ'], ['ch', 'च'],
            ['shh', 'ष'], ['sh', 'श'], ['th', 'थ'], ['dh', 'ध'], ['kh', 'ख'],
            ['gh', 'घ'], ['jh', 'झ'], ['bh', 'भ'], ['ph', 'फ'], ['ng', 'ं'],
            ['k', 'क'], ['g', 'ग'], ['c', 'च'], ['s', 'स'], ['j', 'ज'],
            ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['b', 'ब'],
            ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'],
            ['w', 'व'], ['h', 'ह'], ['z', 'ज़'], ['f', 'फ़']
        ];

        static $vowelInitialHi = [
            'aa' => 'आ', 'a' => 'अ', 'ee' => 'ई', 'ii' => 'ई', 'i' => 'इ',
            'oo' => 'ऊ', 'uu' => 'ऊ', 'u' => 'उ', 'ai' => 'ऐ', 'ay' => 'ऐ',
            'ae' => 'ए', 'ea' => 'ए', 'e' => 'ए', 'oa' => 'ओ', 'oh' => 'ओ', 'o' => 'ओ',
            'au' => 'औ', 'ou' => 'औ', 'ow' => 'औ', 'ri' => 'ऋ'
        ];

        static $vowelSignsHi = [
            'aa' => 'ा', 'a' => '', 'ee' => 'ी', 'ii' => 'ी', 'i' => 'ि',
            'oo' => 'ू', 'uu' => 'ू', 'u' => 'ु', 'ai' => 'ै', 'ay' => 'ै',
            'ae' => 'े', 'ea' => 'े', 'e' => 'े', 'oa' => 'ो', 'oh' => 'ो', 'o' => 'ो',
            'au' => 'ौ', 'ou' => 'ौ', 'ow' => 'ौ', 'ri' => 'ृ'
        ];

        static $vowelListHi = ['aa', 'ai', 'ay', 'au', 'ou', 'ow', 'ee', 'ii', 'oo', 'uu', 'ae', 'ea', 'oa', 'oh', 'ri', 'a', 'i', 'u', 'e', 'o'];

        $out = '';
        $i = 0;
        $len = strlen($lower);

        foreach ($vowelListHi as $v) {
            if (str_starts_with($lower, $v)) {
                $out .= $vowelInitialHi[$v] ?? '';
                $i += strlen($v);
                break;
            }
        }

        while ($i < $len) {
            $cFound = '';
            $cHi = '';
            $sub = substr($lower, $i);
            foreach ($consonantsHi as [$token, $dev]) {
                if (str_starts_with($sub, $token)) {
                    $cFound = $token;
                    $cHi = $dev;
                    break;
                }
            }

            if ($cFound !== '') {
                $i += strlen($cFound);
                $vFound = '';
                $vSign = '';
                $subAfter = substr($lower, $i);
                foreach ($vowelListHi as $v) {
                    if (str_starts_with($subAfter, $v)) {
                        $vFound = $v;
                        $vSign = $vowelSignsHi[$v] ?? '';
                        break;
                    }
                }

                if ($vFound === '') {
                    if ($i >= $len) {
                        $out .= $cHi;
                    } else {
                        $out .= $cHi . '्';
                    }
                } else {
                    $i += strlen($vFound);
                    $out .= $cHi . $vSign;
                }
            } else {
                $ch = $lower[$i];
                if (isset($vowelInitialHi[$ch])) {
                    $out .= $vowelInitialHi[$ch];
                } else {
                    $out .= $ch;
                }
                $i++;
            }
        }

        return $out !== '' ? $out : $trimmed;
    }

    /**
     * Master single-source dispatcher: returns the exact HTML for any service type
     */
    public static function renderFullReportHtml($order, $result): string {
        $serviceType = $order['service_type'] ?? $order['serviceType'] ?? 'BIRTH_JATHAGAM';
        if ($serviceType === 'MARRIAGE_COMPATIBILITY') {
            return self::generateWeddingMatchingHtml($order, $result);
        } elseif ($serviceType === 'BABY_NAMING') {
            return self::generateBabyNamingHtml($order, $result);
        } elseif ($serviceType === 'MUHURTHAM') {
            return self::generateMuhurthamHtml($order, $result);
        } else {
            return self::generateBirthJathagamHtml($order, $result);
        }
    }

    /** Shared CSS matching browser preview design and mPDF engine */
    public static function sharedCss($lang): string {
        $fontFam = ($lang === 'ta')
            ? 'notosanstamil, nototamil, balootamil, notosans, sans-serif'
            : (($lang === 'hi')
                ? 'notosansdevanagari, notodevanagari, yatraone, notosans, sans-serif'
                : 'notosans, cinzel, sans-serif');

        return <<<CSS
    @page { margin: 6mm 8mm 10mm; }
    body { font-family: {$fontFam}; color: #2b1d14; font-size: 9.5px; line-height: 1.35; background: #fffdf9; margin: 0; padding: 0; }
    
    .report-page-break { page-break-after: always; }
    .report-card, .rasi-chart-table, .dosha-section, .dosha-card, .life-card, .panel, .sheet, table, table.rasi-table, table.details-grid, table.data-table, table.life-grid { page-break-inside: avoid; }

    .sheet { background: #fdfaf6; border: 1.5px solid #c9962c; border-radius: 4px; padding: 6mm 7mm 7mm; position: relative; margin-bottom: 2mm; box-sizing: border-box; }

    .header-lockup { width: 100%; text-align: center; page-break-inside: avoid; margin: 0; }
    .header-logo { width: 58px; height: 58px; max-width: 58px; max-height: 58px; display: block; margin: 0 auto 1mm; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
    .header-brand { font-size: 16px; font-weight: bold; color: #7d1233; letter-spacing: 0.5px; text-align: center; line-height: 1.2; }
    .header-sub { font-size: 10.5px; color: #0b7a5a; font-weight: bold; margin-top: 0.5mm; text-align: center; }
    .header-contact { font-size: 8.5px; color: #64748b; margin-top: 0.5mm; text-align: center; font-weight: bold; }
    .header-extra { font-size: 8px; color: #64748b; margin-top: 0.4mm; text-align: center; font-weight: bold; }
    .header-reference { font-size: 7.5px; color: #64748b; margin-top: 0.6mm; text-align: center; font-weight: bold; }
    .header-page-tag { color: #7d1233; font-weight: bold; }
    .header-order-ref { margin-left: 2mm; color: #64748b; }
    table.modern-divider { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 1.2mm 0 3mm; }
    table.modern-divider td { height: 0.6mm; padding: 0; border: 0; }

    .panel { background: #fffdf7; border: 1.2px solid #c9962c; border-radius: 4px; padding: 2.5mm 3.5mm; margin-bottom: 2.5mm; }
    .panel-title { font-size: 10.5px; font-weight: bold; color: #7a1f1f; border-bottom: 1px dotted #a67c1f; padding-bottom: 1mm; margin-bottom: 2mm; }

    /* Page 2 - Marriage Matching disclaimer (shared localized copy).
       Sized so the panel fills the whole sheet instead of leaving half a page
       blank: generous type, a centred reading column and even paragraph gaps. */
    .disclaimer-panel { background: #fffdf7; padding: 4mm 5mm; }
    .disclaimer-title { font-size: 13px; font-weight: bold; color: #7a1f1f; text-align: center; border-bottom: 1px dotted #a67c1f; padding-bottom: 2mm; }
    .disclaimer-heading { font-size: 11.5px; font-weight: bold; color: #2d5a3d; text-align: center; margin: 2mm 0 2.5mm; }
    .disclaimer-para { font-size: 11px; line-height: 1.9; color: #2b1d14; margin: 0 0 4mm; text-align: left; overflow-wrap: anywhere; }
    .disclaimer-para:last-child { margin-bottom: 0; }
    .disclaimer-para strong { color: #7a1f1f; font-weight: bold; }

    /* Page 2 - attestation / signature block */
    .attestation { border: 1px solid #e8d9b8; border-top: 3px solid #7a1f1f; border-radius: 4px; background: #fffdf7; padding: 4mm 5mm; margin-top: 2.5mm; }
    .attestation-title { font-size: 12px; font-weight: bold; color: #7a1f1f; letter-spacing: 0.8px; text-align: center; text-transform: uppercase; border-bottom: 1px dotted #a67c1f; padding-bottom: 2mm; }
    .attestation-grid { width: 100%; border-collapse: collapse; margin-top: 3mm; }
    .attestation-grid td { vertical-align: top; padding: 0; }
    .attest-item { margin-bottom: 2.5mm; }
    .attest-lbl { color: #a67c1f; font-weight: bold; font-size: 8.5px; display: block; margin-bottom: 0.5mm; }
    .attest-val { color: #2b1d14; font-weight: bold; font-size: 10.5px; }
    .attestation-sign { text-align: left; padding-left: 4mm !important; border-left: 1px dashed #e8d9b8; }
    .signature-rule { border-bottom: 1px solid #7a1f1f; height: 6mm; }
    .signatory-label { font-size: 9.5px; font-weight: bold; color: #2b1d14; }
    .signatory-desk { font-size: 9px; font-weight: bold; color: #a67c1f; margin-top: 0.5mm; }

    table.details-grid { width: 100%; border-collapse: collapse; font-size: 9px; }
    table.details-grid td { padding: 1mm 2mm; vertical-align: top; width: 50%; }
    .det-box { background: #fdf8ee; border: 1px solid #e8d9b8; border-radius: 3px; padding: 1mm 2.2mm; }
    .det-lbl { color: #a67c1f; font-weight: bold; font-size: 8px; display: block; margin-bottom: 0.2mm; }
    .det-val { color: #2b1d14; font-weight: bold; font-size: 9.5px; }

    /* South Indian Rasi Chart 4x4 Grid */
    table.rasi-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.rasi-table tr { height: 11.5mm; }
    table.rasi-table td { border: 1.2px solid #a67c1f; vertical-align: top; text-align: center; height: 11.5mm; max-height: 11.5mm; padding: 0.7mm; background: #fffdf7; width: 25%; min-width: 25%; max-width: 25%; overflow: hidden; box-sizing: border-box; }
    .rasi-sign-title { font-size: 7px; color: #6a4c28; font-weight: bold; border-bottom: 0.5px dotted #c9962c; padding-bottom: 0.3mm; margin-bottom: 0.5mm; display: block; line-height: 1.15; }
    .rasi-planets { font-size: 7.5px; color: #1e293b; font-weight: bold; line-height: 1.15; margin-top: 0.3mm; }
    .planet-name { color: #1e293b; font-size: 7.5px; font-weight: bold; display: inline-block; margin: 0.2mm 0.5mm; background: none; border: none; padding: 0; }
    .planet-name.lagna { color: #dc2626; font-size: 8px; font-weight: 900; background: none; border: none; padding: 0; }
    .rasi-center-om { background: #fdf8ee; color: #7a1f1f; font-size: 12px; font-weight: bold; vertical-align: middle; text-align: center; height: 23mm !important; }
    .rasi-center-om span { font-size: 7px; color: #a67c1f; }

    .mini-note { font-size: 7px; color: #6b5b4a; line-height: 1.2; margin: 0.3mm 0 0; }

    table.data-table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 2mm; }
    table.data-table th { background: #7a1f1f; color: #ffffff; font-size: 8.5px; font-weight: bold; padding: 1.5mm 2mm; text-align: left; }
    table.data-table td { padding: 1.2mm 2mm; border-bottom: 1px dotted #e8d9b8; vertical-align: top; }
    table.data-table tr:nth-child(even) td { background: #fdfaf5; }
    /* Marriage Compatibility: the 10 Poruthams table is the body of page 1, so
       its rows are spaced to carry the sheet down to the footer instead of
       leaving the lower half of the page blank. */
    table.wedding-poruthams td { padding: 3mm 2.5mm; vertical-align: middle; }
    table.wedding-poruthams th { padding: 2mm 2.5mm; }

    /* Two dosha cards per row: the same cards, half the vertical space. */
    table.dosha-pair-grid { width: 100%; border-collapse: separate; border-spacing: 2mm 0; table-layout: fixed; }
    table.dosha-pair-grid td.dosha-cell { width: 50%; vertical-align: top; padding: 0; }
    table.dosha-pair-grid .dosha-card { margin-bottom: 1.6mm; }
    .dosha-card { border-left: 4px solid #7a1f1f; background: #fffdf7; border-top: 1.2px solid #c9962c; border-right: 1.2px solid #c9962c; border-bottom: 1.2px solid #c9962c; border-radius: 4px; padding: 1.6mm 3mm; margin-bottom: 1.6mm; }
    .dosha-badge { font-size: 8px; font-weight: bold; padding: 0.5mm 2mm; border-radius: 3px; display: inline-block; }
    .badge-clean { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .badge-moderate { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .badge-afflicted { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .badge-cancelled { background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .rule-note { font-size: 6.4px; color: #475569; margin-top: 0.4mm; line-height: 1.22; }
    .planet-dignity { font-size: 6.8px; color: #334155; }
    .dosha-desc { font-size: 8.5px; color: #2b1d14; line-height: 1.4; margin-top: 0.6mm; }

    /* Page 2 Life Cards Grid.
       Item 7: every card is sized to its own content. mPDF grows a row to its
       tallest cell, so no row height is ever forced here — that is the PHP
       equivalent of the browser report's `grid-auto-rows: auto` + content-sized
       fitter. Shorter cards simply end early instead of being stretched. */
    table.life-grid { width: 100%; border-collapse: separate; border-spacing: 2.5mm; margin-bottom: 2mm; }
    table.life-grid td.life-card p { margin-top: 1mm; }
    .life-disclaimer { font-size: 7.5px; line-height: 1.25; color: #6b5b4a; text-align: center; margin: 0 0 1.5mm; overflow-wrap: anywhere; }
    table.life-grid td.life-card { width: 47%; background: #fffdf7; border: 1.2px solid #c9962c; border-radius: 4px; padding: 2.5mm 3.2mm; vertical-align: top; min-width: 0; }
    .life-card-badge { font-size: 9.5px; font-weight: bold; background: #fdf3e0; color: #a67c1f; border: 1px solid #e8d9b8; border-radius: 3px; padding: 0.4mm 1.6mm; display: inline-block; max-width: 100%; white-space: normal; overflow-wrap: anywhere; text-align: right; line-height: 1.2; }
    .life-card-badge.badge-caution { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .life-card p { font-size: 11.5px; color: #2b1d14; line-height: 1.4; margin: 1mm 0 0; overflow-wrap: anywhere; }

    .closing-quote { font-style: italic; font-size: 8.5px; line-height: 1.3; color: #2d5a3d; text-align: center; font-weight: bold; margin: 1.2mm 0; }
    .navagraha-intro { font-size: 8.5px; line-height: 1.35; margin: 0 0 2mm; }
    .navagraha-section-title { color: #7a1f1f; font-size: 9.5px; font-weight: bold; border-bottom: 1px dotted #a67c1f; padding-bottom: 1mm; margin: 1mm 0 1.5mm; }
    .navagraha-reason { font-size: 8.5px; line-height: 1.35; margin: 0 0 1.2mm; }
    .navagraha-reason strong { color: #7a1f1f; }

    /* Page 3 second half: complete Navagraha reference for all nine grahas.
       Only universal actions are listed (prayer focus, weekday, colour,
       charity, conduct) - no ritual recitation and no temple pilgrimage -
       because most Astro Sivam users live outside India. */
    .navagraha-note { font-size: 7.8px; line-height: 1.25; color: #6b5b4a; margin: 0 0 0.8mm; overflow-wrap: anywhere; }
    .navagraha-intro { font-size: 8px; line-height: 1.25; color: #2b1d14; margin: 0 0 0.8mm; overflow-wrap: anywhere; }
    .navagraha-subsection { color: #2d5a3d; font-size: 9px; font-weight: bold; margin: 1mm 0 0.5mm; }
    ul.navagraha-list { list-style: none; margin: 0 0 1.2mm; padding: 0; }
    ul.navagraha-list li { font-size: 8px; line-height: 1.28; color: #2b1d14; padding-left: 3.5mm; position: relative; margin-bottom: 0.6mm; overflow-wrap: anywhere; }
    ul.navagraha-list li::marker { content: ""; }
    ul.navagraha-list li strong { color: #7a1f1f; }
    .navagraha-closing { font-style: italic; font-size: 8px; line-height: 1.3; color: #2d5a3d; font-weight: bold; text-align: center; margin: 0.8mm 0 0; }
    /* Item 7: the Navagraha table is the reference table of the remedies page,
       so it is set at the same 10px floor as the browser HTML report instead of
       the old 7.4px/6.8px that was unreadable once printed. */
    table.navagraha-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 1.5mm; }
    table.navagraha-table th { background: #7a1f1f; color: #ffffff; font-size: 10px; font-weight: bold; padding: 0.4mm 1mm; text-align: left; border: 1px solid #7a1f1f; line-height: 1.12; }
    /* 10px type with tighter cell padding and line spacing keeps the nine-row
       reference table at the height the old 7.4px table used to occupy. */
    table.navagraha-table td { padding: 0.25mm 1mm; border: 1px solid #e8d9b8; vertical-align: top; line-height: 1.12; color: #2b1d14; overflow-wrap: anywhere; }
    table.navagraha-table tr.even td { background: #fdfaf5; }
    table.navagraha-table td:first-child { color: #7a1f1f; font-weight: bold; }
    table.navagraha-table td.col-day { font-weight: bold; }
    table.navagraha-table tr.is-flagged td { background: #fef3c7; font-weight: bold; }

    .footer { text-align: center; border-top: 1.2px solid #c9962c; padding-top: 1.5mm; font-size: 8px; color: #a67c1f; margin-top: 2mm; }
    .footer .brand { color: #7a1f1f; font-weight: bold; font-size: 8.5px; }
CSS;
    }

    public static function topHeader(string $title, string $subtitle, string $orderNumber, int $page, int $total, string $lang, string $meta = '', bool $slashPageLabel = false): string {
        // $slashPageLabel: the Birth Jathagam states "Page x / 3" (the form the
        // change request asks for). The other reports keep their existing
        // "Page x of y" wording, so this stays opt-in.
        $brandText = trim($title) === 'ASTRO SIVAM' ? 'ASTRO SIVAM - OFFICIAL VEDIC REPORT' : $title;
        $brand = self::e($brandText);
        $s = self::e($subtitle);
        $o = self::e($orderNumber);
        $pageStr = ($lang === 'ta') ? "பக்கம் {$page} / {$total}" : (($lang === 'hi') ? "पृष्ठ {$page} / {$total}" : ($slashPageLabel ? "Page {$page} / {$total}" : "Page {$page} of {$total}"));
        $metaHtml = trim($meta) !== '' ? '<div class="header-extra">' . self::e($meta) . '</div>' : '';
        $orderHtml = trim($orderNumber) !== '' ? '<span class="header-order-ref">#' . $o . '</span>' : '';

        // Root-relative URL on purpose: this same HTML string is served to a
        // browser by the admin "preview HTML" route (a raw server path can never
        // be loaded by a browser) AND is converted to PDF by convertHtmlToPdf(),
        // which rewrites it to a verified absolute filesystem path.
        $logoSrc = astro_logo_url();
        $logoTag = '<img src="' . $logoSrc . '" class="header-logo" alt="ASTRO SIVAM" />';

        return <<<HTML
<div class="header-lockup">
  {$logoTag}
  <div class="header-brand">{$brand}</div>
  <div class="header-sub">{$s}</div>
  <div class="header-contact">astrosivam.com &bull; admin@astrosivam.com</div>
  {$metaHtml}
  <div class="header-reference"><span class="header-page-tag">{$pageStr}</span>{$orderHtml}</div>
</div>
<table class="modern-divider"><tr>
  <td style="width:17%;background:#edd1d9;"></td><td style="width:16%;background:#cf8e9f;"></td>
  <td style="width:15%;background:#7d1233;"></td><td style="width:4%;background:#a85a14;"></td>
  <td style="width:15%;background:#7d1233;"></td><td style="width:16%;background:#cf8e9f;"></td>
  <td style="width:17%;background:#edd1d9;"></td>
</tr></table>
HTML;
    }

    public static function footerBand(string $lang): string {
        $msg = ($lang === 'ta')
            ? 'ஆஸ்ட்ரோ சிவம் பாரம்பரிய வேத கணிப்பகம் &bull; சமஸ்கிருத வேத வித்வான்களால் சான்றளிக்கப்பட்டது &bull; astrosivam.com'
            : (($lang === 'hi')
                ? 'एस्ट्रो शिवम वैदिक पंचांग एवं ज्योतिष संस्थान &bull; संस्कृत विद्वानों द्वारा प्रमाणित &bull; astrosivam.com'
                : 'ASTRO SIVAM Precision Vedic Ephemeris &bull; Certified by Sanskrit Scholars Board &bull; astrosivam.com');

        return <<<HTML
<div class="footer">
  <span class="brand">ASTRO SIVAM</span> &bull; {$msg}
</div>
HTML;
    }

    // =====================================================================
    // BIRTH JATHAGAM - 3 FULL PAGES HTML
    // =====================================================================
    public static function generateBirthJathagamHtml($order, $result): string {
        $lang = astro_report_normalize_language($order['language'] ?? 'en');
        $isTa = ($lang === 'ta');
        $isHi = ($lang === 'hi');

        $rasiNamesByNumber = [
            1 => ['en' => 'Mesham (Aries)', 'ta' => 'மேஷம்', 'hi' => 'मेष', 'lordEn' => 'Mars', 'lordTa' => 'செவ்வாய்', 'lordHi' => 'मंगल'],
            2 => ['en' => 'Rishabam (Taurus)', 'ta' => 'ரிஷபம்', 'hi' => 'वृषभ', 'lordEn' => 'Venus', 'lordTa' => 'சுக்கிரன்', 'lordHi' => 'शुक्र'],
            3 => ['en' => 'Mithunam (Gemini)', 'ta' => 'மிதுனம்', 'hi' => 'मिथुन', 'lordEn' => 'Mercury', 'lordTa' => 'புதன்', 'lordHi' => 'बुध'],
            4 => ['en' => 'Kadagam (Cancer)', 'ta' => 'கடகம்', 'hi' => 'कर्क', 'lordEn' => 'Moon', 'lordTa' => 'சந்திரன்', 'lordHi' => 'चंद्र'],
            5 => ['en' => 'Simham (Leo)', 'ta' => 'சிம்மம்', 'hi' => 'सिंह', 'lordEn' => 'Sun', 'lordTa' => 'சூரியன்', 'lordHi' => 'सूर्य'],
            6 => ['en' => 'Kanni (Virgo)', 'ta' => 'கன்னி', 'hi' => 'कन्या', 'lordEn' => 'Mercury', 'lordTa' => 'புதன்', 'lordHi' => 'बुध'],
            7 => ['en' => 'Thulam (Libra)', 'ta' => 'துலாம்', 'hi' => 'तुला', 'lordEn' => 'Venus', 'lordTa' => 'சுக்கிரன்', 'lordHi' => 'शुक्र'],
            8 => ['en' => 'Viruchigam (Scorpio)', 'ta' => 'விருச்சிகம்', 'hi' => 'वृश्चिक', 'lordEn' => 'Mars', 'lordTa' => 'செவ்வாய்', 'lordHi' => 'मंगल'],
            9 => ['en' => 'Dhanusu (Sagittarius)', 'ta' => 'தனுசு', 'hi' => 'धनु', 'lordEn' => 'Jupiter', 'lordTa' => 'குரு', 'lordHi' => 'गुरु'],
            10 => ['en' => 'Magaram (Capricorn)', 'ta' => 'மகரம்', 'hi' => 'मकर', 'lordEn' => 'Saturn', 'lordTa' => 'சனி', 'lordHi' => 'शनि'],
            11 => ['en' => 'Kumbam (Aquarius)', 'ta' => 'கும்பம்', 'hi' => 'कुंभ', 'lordEn' => 'Saturn', 'lordTa' => 'சனி', 'lordHi' => 'शनि'],
            12 => ['en' => 'Meenam (Pisces)', 'ta' => 'மீனம்', 'hi' => 'मीन', 'lordEn' => 'Jupiter', 'lordTa' => 'குரு', 'lordHi' => 'गुरु'],
        ];
        $normalizeRasiNumber = static function ($value) {
            return is_numeric($value) && (float) $value === (float) (int) $value && (int) $value >= 1 && (int) $value <= 12
                ? (int) $value
                : null;
        };
        $lagnaRasiNum = $normalizeRasiNumber($result['lagnaRasi'] ?? null);
        $chandraRasiNum = $normalizeRasiNumber($result['chandraRasi'] ?? null);
        $lagnaRasiInfo = $lagnaRasiNum !== null ? ($rasiNamesByNumber[$lagnaRasiNum] ?? null) : null;
        $chandraRasiInfo = $chandraRasiNum !== null ? ($rasiNamesByNumber[$chandraRasiNum] ?? null) : null;

        $orderNumber = $order['order_number'] ?? $order['orderNumber'] ?? 'ORD-JATHAGAM';
        $name = self::e($result['devoteeName'] ?? $result['nativeName'] ?? ($order['user_name'] ?? 'User'));
        $dob = self::e(self::birthDate($result['dob'] ?? '', 'N/A'));
        $tob = self::e($result['tob'] ?? 'N/A');
        $placeRaw = trim((string) ($result['birthPlace'] ?? ''));
        $countryRaw = trim((string) ($result['country'] ?? ''));
        $placeParts = array_values(array_filter(array_map('trim', explode(',', $placeRaw))));
        $placeTail = $placeParts ? end($placeParts) : '';
        $placeDisplay = $placeRaw;
        if ($placeDisplay !== '' && $countryRaw !== '' && stripos($placeTail, $countryRaw) === false) {
            $placeDisplay .= ', ' . $countryRaw;
        } elseif ($placeDisplay === '' && $countryRaw !== '') {
            $placeDisplay = $countryRaw;
        }
        if ($placeDisplay === '') {
            $placeDisplay = $isTa ? 'குறிப்பிடப்படவில்லை' : ($isHi ? 'उल्लेख नहीं किया गया' : 'Not provided');
        }
        $place = self::e($placeDisplay);

        $rasiName = self::e($chandraRasiInfo[$lang] ?? 'N/A');
        $rasiLord = self::e($chandraRasiInfo[$lang === 'ta' ? 'lordTa' : ($lang === 'hi' ? 'lordHi' : 'lordEn')] ?? 'N/A');

        $nakName = self::e(
            $isTa ? ($result['nakshatram']['nameTa'] ?? $result['janmaNakshatraTa'] ?? 'N/A')
            : ($isHi ? ($result['nakshatram']['nameHi'] ?? $result['janmaNakshatraHi'] ?? 'N/A')
            : ($result['nakshatram']['name'] ?? $result['janmaNakshatraEn'] ?? 'N/A'))
        );
        $pada = self::e($result['nakshatram']['pada'] ?? $result['janmaPada'] ?? 'N/A');

        $lagnaRasi = self::e($lagnaRasiInfo[$lang] ?? 'N/A');
        $lagnaLord = self::e($lagnaRasiInfo[$lang === 'ta' ? 'lordTa' : ($lang === 'hi' ? 'lordHi' : 'lordEn')] ?? 'N/A');

        // Retain the current-period summary for page-2 Current Guidance; it is
        // intentionally not displayed in the page-1 particulars or chart row.
        $dasha = $result['dasha'] ?? [];
        $dashaMajor = $isTa ? ($dasha['currentLordTa'] ?? $dasha['currentLord'] ?? 'N/A') : ($isHi ? ($dasha['currentLordHi'] ?? $dasha['currentLord'] ?? 'N/A') : ($dasha['currentLord'] ?? 'N/A'));
        $dashaSub = $isTa ? ($dasha['subLordTa'] ?? $dasha['subLord'] ?? 'N/A') : ($isHi ? ($dasha['subLordHi'] ?? $dasha['subLord'] ?? 'N/A') : ($dasha['subLord'] ?? 'N/A'));
        $dashaPeriod = self::e($dasha['period'] ?? 'N/A');
        $currentDasha = self::e("{$dashaMajor} - {$dashaSub} ({$dashaPeriod})");

        // ---------------- PAGE 1: Particulars + Rasi/Navamsa Charts + Doshas ----------------
        $chartHouses = [
            'Pisces' => 12, 'Aries' => 1, 'Taurus' => 2, 'Gemini' => 3,
            'Cancer' => 4, 'Leo' => 5, 'Virgo' => 6, 'Libra' => 7,
            'Scorpio' => 8, 'Sagittarius' => 9, 'Capricorn' => 10, 'Aquarius' => 11,
        ];
        $signDisplayNames = [
            'Pisces' => $isTa ? 'மீனம்' : ($isHi ? 'मीन' : 'Pisces'),
            'Aries' => $isTa ? 'மேஷம்' : ($isHi ? 'मेष' : 'Aries'),
            'Taurus' => $isTa ? 'ரிஷபம்' : ($isHi ? 'वृषभ' : 'Taurus'),
            'Gemini' => $isTa ? 'மிதுனம்' : ($isHi ? 'मिथुन' : 'Gemini'),
            'Cancer' => $isTa ? 'கடகம்' : ($isHi ? 'कर्क' : 'Cancer'),
            'Leo' => $isTa ? 'சிம்மம்' : ($isHi ? 'सिंह' : 'Leo'),
            'Virgo' => $isTa ? 'கன்னி' : ($isHi ? 'कन्या' : 'Virgo'),
            'Libra' => $isTa ? 'துலாம்' : ($isHi ? 'तुला' : 'Libra'),
            'Scorpio' => $isTa ? 'விருச்சிகம்' : ($isHi ? 'वृश्चिक' : 'Scorpio'),
            'Sagittarius' => $isTa ? 'தனுசு' : ($isHi ? 'धनु' : 'Sagittarius'),
            'Capricorn' => $isTa ? 'மகரம்' : ($isHi ? 'मकर' : 'Capricorn'),
            'Aquarius' => $isTa ? 'கும்பம்' : ($isHi ? 'कुंभ' : 'Aquarius'),
        ];
        // Short tags for planets in chart. Keys are the engine's graha values
        // (the lowercase Graha enum: sun, moon, ...). They were capitalised before,
        // so no planet ever matched and the Hindi chart lost every placement.
        $grahaTags = [
            'sun' => $isTa ? 'சூ' : ($isHi ? 'सू' : 'Su'),
            'moon' => $isTa ? 'சந்' : ($isHi ? 'चं' : 'Mo'),
            'mars' => $isTa ? 'செவ்' : ($isHi ? 'मं' : 'Ma'),
            'mercury' => $isTa ? 'பு' : ($isHi ? 'बु' : 'Me'),
            'jupiter' => $isTa ? 'குரு' : ($isHi ? 'गु' : 'Ju'),
            'venus' => $isTa ? 'சுக்' : ($isHi ? 'शु' : 'Ve'),
            'saturn' => $isTa ? 'சனி' : ($isHi ? 'श' : 'Sa'),
            'rahu' => $isTa ? 'ரா' : ($isHi ? 'रा' : 'Ra'),
            'ketu' => $isTa ? 'கே' : ($isHi ? 'के' : 'Ke'),
        ];

        $chartPlanetPositions = is_array($result['planetPositions'] ?? null) ? $result['planetPositions'] : [];
        $planetsByRasi = [];
        foreach ($chartPlanetPositions as $p) {
            if (!is_array($p)) { continue; }
            $rasiRaw = $p['rasi'] ?? $p['rasiNumber'] ?? null;
            if (!is_numeric($rasiRaw) || (float) $rasiRaw !== (float) (int) $rasiRaw || (int) $rasiRaw < 1 || (int) $rasiRaw > 12) {
                continue;
            }
            $r = (int) $rasiRaw;
            $gKey = $p['graha'] ?? $p['nameEn'] ?? '';
            $tag = $grahaTags[strtolower((string) $gKey)] ?? ($isTa ? ($p['nameTa'] ?? '') : ($isHi ? ($p['nameHi'] ?? '') : $gKey));
            if (trim((string) $tag) !== '') {
                $planetsByRasi[$r][] = '<span class="planet-name">' . self::e($tag) . '</span>';
            }
        }
        $lagnaTag = '<span class="planet-name lagna">' . ($isTa ? 'லக்' : ($isHi ? 'लग्न' : 'Lag')) . '</span>';

        $signOrder = [
            ['Pisces','Aries','Taurus','Gemini'],
            ['Aquarius', null, null, 'Cancer'],
            ['Capricorn', null, null, 'Leo'],
            ['Sagittarius','Scorpio','Libra','Virgo'],
        ];
        // Item 7: the same 4x4 South-Indian grid serves the Rasi chart and the
        // Navamsa (D9) confirmation chart. A closure keeps the two grids from
        // drifting apart (cell order, Lagna marker, center label).
        $buildRasiRows = function ($planetsForGrid, $lagnaRasiForGrid, $lagnaTagForGrid, $centerSubLabel) use ($signOrder, $chartHouses, $signDisplayNames, $isTa, $isHi) {
            $rowsHtml = '';
            foreach ($signOrder as $ri => $row) {
                $rowsHtml .= '<tr>';
                foreach ($row as $ci => $sign) {
                    if ($ri === 1 && $ci === 1) {
                        $centerOm = $isTa ? 'ஓம்' : ($isHi ? 'ॐ' : 'OM');
                        $rowsHtml .= '<td class="rasi-center-om" colspan="2" rowspan="2">' . $centerOm . '<br><span>ASTRO SIVAM</span><br><span>' . $centerSubLabel . '</span></td>';
                    } elseif ($ri === 1 && $ci === 2) {
                        continue;
                    } elseif ($ri === 2 && ($ci === 1 || $ci === 2)) {
                        continue;
                    } elseif ($sign === null) {
                        continue;
                    } else {
                        $rasiNum = $chartHouses[$sign];
                        $pList = $planetsForGrid[$rasiNum] ?? [];
                        if ($lagnaRasiForGrid !== null && $rasiNum === $lagnaRasiForGrid) {
                            array_unshift($pList, $lagnaTagForGrid);
                        }
                        $pStr = implode('', $pList);
                        $signLabel = $signDisplayNames[$sign] ?? $sign;
                        $rowsHtml .= '<td><span class="rasi-sign-title">' . self::e($signLabel) . '</span><div class="rasi-planets">' . $pStr . '</div></td>';
                    }
                }
                $rowsHtml .= '</tr>';
            }
            return $rowsHtml;
        };
        $chartRows = $buildRasiRows($planetsByRasi, $lagnaRasiNum, $lagnaTag, ($isTa ? 'ராசி கட்டம்' : ($isHi ? 'राशि चक्र' : 'RASI CHAKRA')));

        // Item 7: Navamsa (D9) grouping. The engine's own navamsaRasi wins when
        // the payload carries it (the TypeScript engine sends one per graha); the PHP
        // engine does not, so the same rule the TypeScript engine uses is applied to
        // the same sidereal longitude: padaOverall = floor(lon / 3°20′),
        // navamsa rasi = padaOverall % 12 + 1. Never a fabricated sign.
        $navamsaPlanetsByRasi = [];
        $navamsaTagged = 0;
        foreach ($chartPlanetPositions as $p) {
            if (!is_array($p)) { continue; }
            $navRasi = $normalizeRasiNumber($p['navamsaRasi'] ?? null);
            $totalLonForNavamsa = null;
            if (is_numeric($p['totalDegrees'] ?? null)) {
                $totalLonForNavamsa = fmod((float) $p['totalDegrees'] + 360.0, 360.0);
            } else {
                $rasiForNavamsa = $normalizeRasiNumber($p['rasi'] ?? $p['rasiNumber'] ?? null);
                $degreesForNavamsa = $p['degrees'] ?? null;
                if ($rasiForNavamsa !== null && is_numeric($degreesForNavamsa) && is_finite((float) $degreesForNavamsa)) {
                    $totalLonForNavamsa = fmod((($rasiForNavamsa - 1) * 30.0) + (float) $degreesForNavamsa, 360.0);
                    if ($totalLonForNavamsa < 0) { $totalLonForNavamsa += 360.0; }
                }
            }
            if ($navRasi === null && $totalLonForNavamsa !== null) {
                $navRasi = ((int) floor($totalLonForNavamsa / (360.0 / 108.0)) % 12) + 1;
            }
            if ($navRasi === null) { continue; }
            $gKey = $p['graha'] ?? $p['nameEn'] ?? '';
            $tag = $grahaTags[strtolower((string) $gKey)] ?? ($isTa ? ($p['nameTa'] ?? '') : ($isHi ? ($p['nameHi'] ?? '') : $gKey));
            if (trim((string) $tag) === '') { continue; }
            $navamsaPlanetsByRasi[$navRasi][] = '<span class="planet-name">' . self::e($tag) . '</span>';
            $navamsaTagged++;
        }
        $navamsaLagnaRasi = $normalizeRasiNumber($result['lagnaNavamsaRasi'] ?? null);
        if ($navamsaLagnaRasi === null && $lagnaRasiNum !== null) {
            $lagnaDegreesForNavamsa = $result['lagnaDegrees'] ?? null;
            if (is_numeric($lagnaDegreesForNavamsa) && (float) $lagnaDegreesForNavamsa >= 0 && (float) $lagnaDegreesForNavamsa < 30) {
                $lagnaTotalForNavamsa = (($lagnaRasiNum - 1) * 30.0) + (float) $lagnaDegreesForNavamsa;
                $navamsaLagnaRasi = ((int) floor($lagnaTotalForNavamsa / (360.0 / 108.0)) % 12) + 1;
            }
        }
        $navamsaLagnaTag = '<span class="planet-name lagna">' . ($isTa ? 'லக்' : ($isHi ? 'लग्न' : 'Lag')) . '</span>';
        $navamsaRows = $navamsaTagged > 0
            ? $buildRasiRows($navamsaPlanetsByRasi, $navamsaLagnaRasi, $navamsaLagnaTag, ($isTa ? 'நவாம்சம் D9' : ($isHi ? 'नवांश D9' : 'NAVAMSA D9')))
            : '';
        $navamsaCardTitle = $isTa ? 'நவாம்ச கட்டம் (Navamsa D9)' : ($isHi ? 'नवांश चक्र (Navamsa D9)' : 'Navamsa Chart (D9)');
        $navamsaBlockHtml = $navamsaRows !== ''
            ? '<table class="rasi-table">' . $navamsaRows . '</table>'
            : '<p class="mini-note">' . ($isTa ? 'நவாம்ச நிலை தகவல் கிடைக்கவில்லை; N/A.' : ($isHi ? 'नवांश स्थिति उपलब्ध नहीं; N/A।' : 'Navamsa positions unavailable; N/A.')) . '</p>';

        $chartCardTitle = $isTa ? 'ராசி கட்டம் (Rasi Chart)' : ($isHi ? 'राशि चक्र (Rasi Chakra)' : 'Rasi Chart (Chakra)');
        $rasiNavamsaRowHtml = <<<HTML
<table style="width:100%; margin-bottom:2mm;"><tr>
  <td style="width:49%; vertical-align:top;">
    <div class="panel">
      <div class="panel-title">{$chartCardTitle}</div>
      <table class="rasi-table">{$chartRows}</table>
    </div>
  </td>
  <td style="width:2%;"></td>
  <td style="width:49%; vertical-align:top;">
    <div class="panel">
      <div class="panel-title">{$navamsaCardTitle}</div>
      {$navamsaBlockHtml}
    </div>
  </td>
</tr></table>
HTML;

        $planetsList = $chartPlanetPositions;
        $doshasList = is_array($result['doshas'] ?? null) ? $result['doshas'] : [];
        $hasGuruDosha = false;
        foreach ($doshasList as $d) {
            if (!is_array($d)) { continue; }
            $nameStr = ($d['nameEn'] ?? '') . ($d['nameTa'] ?? '') . ($d['nameHi'] ?? '');
            if (stripos($nameStr, 'Guru Chandala') !== false || stripos($nameStr, 'குரு சண்டாள') !== false || stripos($nameStr, 'गुरु चांडाल') !== false) {
                $hasGuruDosha = true;
                break;
            }
        }

        if (!$hasGuruDosha) {
            $jupiterSign = null; $rahuSign = null; $ketuSign = null;
            foreach ($planetsList as $p) {
                if (!is_array($p)) { continue; }
                $pId = strtolower((string) ($p['graha'] ?? $p['nameEn'] ?? $p['key'] ?? ''));
                $pSign = $normalizeRasiNumber($p['rasi'] ?? $p['rasiNumber'] ?? null);
                if (stripos($pId, 'guru') !== false || stripos($pId, 'jup') !== false) { $jupiterSign = $pSign; }
                if (stripos($pId, 'rahu') !== false) { $rahuSign = $pSign; }
                if (stripos($pId, 'ketu') !== false) { $ketuSign = $pSign; }
            }
            $guruSignsAvailable = $jupiterSign !== null && $rahuSign !== null && $ketuSign !== null;
            $isGuruAfflicted = $guruSignsAvailable
                ? ($jupiterSign === $rahuSign || $jupiterSign === $ketuSign || (($jupiterSign + 6) % 12 ?: 12) === $rahuSign || (($jupiterSign + 6) % 12 ?: 12) === $ketuSign)
                : null;

            $doshasList[] = [
                'nameEn' => 'Guru Chandala Dosha',
                'nameTa' => 'குரு சண்டாள தோஷம் (Guru Chandala)',
                'nameHi' => 'गुरु चांडाल दोष',
                'isPresent' => $isGuruAfflicted,
                'severityEn' => $isGuruAfflicted === null ? 'N/A' : ($isGuruAfflicted ? 'Moderate' : 'Clean / Favourable'),
                'severityTa' => $isGuruAfflicted === null ? 'N/A' : ($isGuruAfflicted ? 'மிதமான தோஷம்' : 'சுப நிலை (தோஷம் இல்லை)'),
                'severityHi' => $isGuruAfflicted === null ? 'N/A' : ($isGuruAfflicted ? 'मध्यम' : 'शुभ स्थिति (दोष रहित)'),
                'descriptionEn' => $isGuruAfflicted === null ? 'Jupiter, Rahu or Ketu sign data is unavailable; Guru Chandala Dosha is not assessed.' : ($isGuruAfflicted ? 'Jupiter (Guru) is conjunct or aspected by shadow planets Rahu/Ketu, forming Guru Chandala Dosha. Lord Dakshinamurthy and Shiva worship recommended.' : 'No trigger was found under this limited sign-level rule; this does not establish that Jupiter is free from other afflictions.'),
                'descriptionTa' => $isGuruAfflicted === null ? 'குரு, ராகு அல்லது கேதுவின் ராசித் தகவல் கிடைக்கவில்லை; குரு சண்டாள தோஷம் மதிப்பிடப்படவில்லை.' : ($isGuruAfflicted ? 'சுப கிரகமான குரு பகவானும் சாயா கிரகமான ராகு/கேதுவும் ஒரே ராசியில் இணைவு அல்லது பார்வையில் உள்ளதால் குரு சண்டாள தோஷம் உருவாகிறது. ஸ்ரீ தட்சிணாமூர்த்தி மற்றும் சிவ வழிபாடு மூலம் குருவின் பரிபூரண சுப யோகம் உண்டாகும்.' : 'இந்த வரையறுக்கப்பட்ட ராசி விதியில் குறியீடு இல்லை; இதனால் குருவுக்கு வேறு பாதிப்புகள் இல்லை என உறுதிப்படுத்த முடியாது.'),
                'descriptionHi' => $isGuruAfflicted === null ? 'गुरु, राहु या केतु की राशि-संबंधी जानकारी उपलब्ध नहीं है; गुरु चांडाल दोष का आकलन नहीं हुआ।' : ($isGuruAfflicted ? 'शुभ ग्रह गुरु एवं छाया ग्रह राहु/केतु की युति अथवा दृष्टि के कारण गुरु चांडाल दोष का प्रभाव है।' : 'इस सीमित राशि-आधारित नियम में संकेत नहीं मिला; इससे अन्य ग्रह-दोषों की अनुपस्थिति सिद्ध नहीं होती।'),
                'traditionalRemedyEn' => 'Pray to Lord Dakshinamurthy or Lord Shiva.',
                'traditionalRemedyTa' => 'தட்சிணாமூர்த்தி அல்லது சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
                'traditionalRemedyHi' => 'भगवान दक्षिणामूर्ति या भगवान शिव का नाम लेकर प्रार्थना करें。',
            ];
        }

        $doshaCardsHtml = '';
        $baseDoshas = array_values(array_filter($doshasList, static function ($d) {
            return is_array($d) && empty($d['isNavagrahaAfflictionIndicator']);
        }));
        foreach (array_slice($baseDoshas, 0, 4) as $d) {
            $dName = $isTa ? ($d['nameTa'] ?? $d['nameEn'] ?? '') : ($isHi ? ($d['nameHi'] ?? $d['nameEn'] ?? '') : ($d['nameEn'] ?? ''));
            $dSev = $isTa ? ($d['severityTa'] ?? $d['severityEn'] ?? '') : ($isHi ? ($d['severityHi'] ?? $d['severityEn'] ?? '') : ($d['severityEn'] ?? ''));
            $dDesc = $isTa ? ($d['descriptionTa'] ?? $d['descriptionEn'] ?? '') : ($isHi ? ($d['descriptionHi'] ?? $d['descriptionEn'] ?? '') : ($d['descriptionEn'] ?? ''));
            // Item 2: the badge speaks the Kuja verdict (none / present /
            // present-cancelled) instead of the old boolean severity.
            if (!empty($d['verdict'])) {
                $dSev = $isTa ? ($d['verdictLabelTa'] ?? $dSev) : ($isHi ? ($d['verdictLabelHi'] ?? $dSev) : ($d['verdictLabelEn'] ?? $dSev));
            }
            // Item 5: the fuller ancestral remedy travels with the Pitru card.
            $extendedRemedy = $isTa ? ($d['extendedRemedyTa'] ?? '') : ($isHi ? ($d['extendedRemedyHi'] ?? '') : ($d['extendedRemedyEn'] ?? ''));
            if ($extendedRemedy !== '' && !empty($d['strength']) && $d['strength'] !== 'none') {
                $dDesc .= ' ' . $extendedRemedy;
            }
            
            $badgeClass = 'badge-clean';
            if (!array_key_exists('isPresent', $d) || $d['isPresent'] === null || trim((string) $dSev) === 'N/A') {
                $badgeClass = 'badge-na';
            } elseif (stripos($dSev, 'Afflicted') !== false || stripos($dSev, 'Severe') !== false || stripos($dSev, 'தோஷம்') !== false || stripos($dSev, 'दोष') !== false) {
                $badgeClass = 'badge-afflicted';
            } elseif (stripos($dSev, 'Moderate') !== false || stripos($dSev, 'மத்திமம்') !== false || stripos($dSev, 'मध्यम') !== false) {
                $badgeClass = 'badge-moderate';
            }
            if (($d['verdict'] ?? '') === 'present-cancelled') {
                $badgeClass = 'badge-cancelled';
            }

            $doshaCardsHtml .= <<<HTML
<div class="dosha-card">
  <table style="width:100%; border-collapse:collapse; margin:0 0 1.2mm;">
    <tr>
      <td style="font-weight:bold; color:#7a1f1f; font-size:9.5px; vertical-align:middle; text-align:left;">{$dName}</td>
      <td style="text-align:right; vertical-align:middle; width:35%;"><span class="dosha-badge {$badgeClass}">{$dSev}</span></td>
    </tr>
  </table>
  <div class="dosha-desc">{$dDesc}</div>
</div>
HTML;
        }

        // The Navagraha Affliction Indicators card is no longer printed on page
        // 1. The screening rules themselves stay in the engine (and surface in
        // the Short Summary planet read), so only this page-1 card was dropped.

        // Items 3/6/7a: the Neecha Bhanga cancellation, the yoga notes (Sarala,
        // own-sign Saturn and the 9th lord in the 8th read as a caution) and any
        // Graha Yuddha pair in one compact card, small text with one line per
        // note, so the certified page-1 layout stays inside three physical pages.
        $yogaNoteLines = [];
        $yogaFirstSentence = static function (string $text): string {
            $text = trim($text);
            if ($text === '') { return ''; }
            $parts = preg_split('/\.\s|।/u', $text, 2);
            return trim((string) ($parts[0] ?? $text));
        };
        foreach ((array) ($result['yogas'] ?? []) as $yogaNote) {
            if (!is_array($yogaNote)) { continue; }
            $yName = $isTa ? ($yogaNote['nameTa'] ?? '') : ($isHi ? ($yogaNote['nameHi'] ?? '') : ($yogaNote['nameEn'] ?? ''));
            $yDesc = $isTa ? ($yogaNote['descriptionTa'] ?? '') : ($isHi ? ($yogaNote['descriptionHi'] ?? '') : ($yogaNote['descriptionEn'] ?? ''));
            // The engine's yoga names already say what the yoga is and carry
            // their own caution wording, so the compact line names the yoga.
            $yLine = trim($yName);
            $yDetail = $yogaFirstSentence($yDesc);
            if ($yDetail !== '' && strlen($yDetail) <= 70) {
                // Only add the detail when it is not just the name reworded.
                $nameWords = array_values(array_filter(
                    preg_split('/[^\p{L}\p{N}]+/u', $yName) ?: [],
                    static function ($word) { return strlen($word) >= 6; }
                ));
                $shared = 0;
                foreach ($nameWords as $nameWord) {
                    if (stripos($yDetail, $nameWord) !== false) { $shared += 1; }
                }
                $mostlySame = $nameWords !== [] && ($shared / count($nameWords)) >= 0.6;
                if (!$mostlySame) { $yLine = trim($yLine . ' — ' . $yDetail); }
            }
            if ($yLine !== '') { $yogaNoteLines[] = $yLine; }
        }
        foreach ((array) ($result['grahaYuddha'] ?? []) as $yuddha) {
            if (!is_array($yuddha)) { continue; }
            $wName = $isTa ? ($yuddha['planetANameTa'] ?? '') . ' / ' . ($yuddha['planetBNameTa'] ?? '') : ($isHi ? ($yuddha['planetANameHi'] ?? '') . ' / ' . ($yuddha['planetBNameHi'] ?? '') : ($yuddha['planetANameEn'] ?? '') . ' / ' . ($yuddha['planetBNameEn'] ?? ''));
            $wDesc = $isTa ? ($yuddha['descriptionTa'] ?? '') : ($isHi ? ($yuddha['descriptionHi'] ?? '') : ($yuddha['descriptionEn'] ?? ''));
            $wSep = number_format((float) ($yuddha['separationDegrees'] ?? 0), 2, '.', '') . '°';
            $wWinner = $isTa ? ($yuddha['winnerNameTa'] ?? '') : ($isHi ? ($yuddha['winnerNameHi'] ?? '') : ($yuddha['winnerNameEn'] ?? ''));
            $wLabel = $isTa ? 'வெற்றி' : ($isHi ? 'विजेता' : 'winner');
            $wLine = trim(($isTa ? 'கிரக யுத்தம் (Graha Yuddha): ' : ($isHi ? 'ग्रह युद्ध (Graha Yuddha): ' : 'Graha Yuddha: ')) . $wName . ' (' . $wSep . ')'
                . ($wWinner !== '' ? ' — ' . $wLabel . ': ' . $wWinner : ''));
            if ($wLine !== '') { $yogaNoteLines[] = $wLine; }
        }
        foreach ((array) ($result['planetPositions'] ?? []) as $positionNow) {
            if (!is_array($positionNow) || empty($positionNow['dignity']['isNeechaBhanga'])) { continue; }
            $nbText = $isTa ? ($positionNow['dignity']['neechaBhangaTa'] ?? '') : ($isHi ? ($positionNow['dignity']['neechaBhangaHi'] ?? '') : ($positionNow['dignity']['neechaBhangaEn'] ?? ''));
            if (trim((string) $nbText) === '') { continue; }
            $nbGraha = $isTa ? ($positionNow['nameTa'] ?? '') : ($isHi ? ($positionNow['nameHi'] ?? '') : ($positionNow['nameEn'] ?? ''));
            $nbShort = preg_split('/\.\s/u', trim((string) $nbText), 2);
            $yogaNoteLines[] = ($nbGraha !== '' ? $nbGraha . ': ' : '') . trim((string) (($nbShort[0] ?? $nbText))) . '.';
        }
        if ($yogaNoteLines !== []) {
            $yogaCardsHtml = '<div class="dosha-card" style="padding:1.2mm 2mm; margin-top:1mm;"><table style="width:100%; border-collapse:collapse; margin:0 0 0.8mm;"><tr><td style="font-weight:bold; color:#7a1f1f; font-size:9.5px; text-align:left;">'
                . self::e($isTa ? 'யோகங்கள், நீச பங்க & கிரக யுத்தம்' : ($isHi ? 'योग, नीच भंग एवं ग्रह युद्ध' : 'Yogas, Neecha Bhanga & Graha Yuddha'))
                . '</td><td style="text-align:right; width:35%;"><span class="dosha-badge badge-clean">' . count($yogaNoteLines) . '</span></td></tr></table>';
            foreach ($yogaNoteLines as $yogaLine) {
                $yogaCardsHtml .= '<div class="rule-note">' . self::e($yogaLine) . '</div>';
            }
            // The card goes on the life-card sheet: page 1 is already full on
            // charts with many dosha cards, and the yoga notes belong with the
            // predictions. The three-page contract is unchanged.
            $yogaNotesCardHtml = $yogaCardsHtml . '</div>';
        }

        $p1Sub = $isTa ? 'ஜாதக கணிப்பு அறிக்கை (Birth Jathagam)' : ($isHi ? 'जन्म कुंडली रिपोर्ट (Birth Horoscope)' : 'Certified Vedic Horoscope &amp; Ephemeris');
        $panelDevoteeTitle = $isTa ? 'ஜாதகர் விவரங்கள்' : ($isHi ? 'जातक जन्म विवरण (Birth Particulars)' : 'User Particulars');
        $lblPName = $isTa ? 'பெயர்:' : ($isHi ? 'नाम:' : 'Name:');
        $lblPDob = $isTa ? 'பிறந்த தேதி & நேரம்:' : ($isHi ? 'जन्म तिथि एवं समय:' : 'DOB &amp; Time:');
        $lblPPlace = $isTa ? 'பிறந்த இடம் & நாடு:' : ($isHi ? 'जन्म स्थान:' : 'Birth Place:');
        $lblPLagna = $isTa ? 'லக்னம்:' : ($isHi ? 'लग्न:' : 'Lagna (Ascendant):');
        $lblPRasi = $isTa ? 'ராசி & அதிபதி:' : ($isHi ? 'राशि एवं स्वामी:' : 'Janma Rasi &amp; Lord:');
        $lblPNak = $isTa ? 'நட்சத்திரம் & பாதம்:' : ($isHi ? 'नक्षत्र एवं पद:' : 'Janma Nakshatra:');
        $lblPAyanNode = $isTa ? 'அயனாம்சம் / ராகு நிலை:' : ($isHi ? 'अयनांश / राहु नोड:' : 'Ayanamsa / Rahu Node:');

        // Item 5: the report states which ayanamsa and which lunar-node
        // convention produced the chart, so a reader can reproduce Rahu/Ketu.
        // MEAN is the classical default (always retrograde, BPHS/dasha work);
        // TRUE is the modern osculating node. The seven classical grahas are
        // identical under both conventions.
        $ayanamsaValueForReport = $result['ayanamsa'] ?? null;
        $ayanamsaValueText = (is_numeric($ayanamsaValueForReport) && is_finite((float) $ayanamsaValueForReport))
            ? number_format((float) $ayanamsaValueForReport, 4) . '&deg;'
            : 'N/A';
        $ayanamsaModeForReport = strtoupper((string) ($result['ayanamsaMode'] ?? 'TRUE')) === 'MEAN' ? 'MEAN' : 'TRUE';
        $ayanamsaText = $ayanamsaValueText . ' Lahiri Chitra Paksha (' . ($ayanamsaModeForReport === 'MEAN' ? 'mean' : 'true') . ')';
        $nodeTypeConfigured = $result['nodeType'] ?? (class_exists('AstroEngine') ? AstroEngine::nodeType() : 'MEAN');
        $nodeTypeForReport = strtoupper((string) $nodeTypeConfigured) === 'TRUE' ? 'TRUE' : 'MEAN';
        $nodeTypeText = $nodeTypeForReport === 'TRUE'
            ? ($isTa ? 'உண்மை நிலை (True node)' : ($isHi ? 'सच्चा नोड (True node)' : 'True node (osculating)'))
            : ($isTa ? 'சராசரி நிலை (Mean node)' : ($isHi ? 'औसत नोड (Mean node)' : 'Mean node (classical)'));

        $doshaSecTitle = $isTa ? 'தோஷ பரிசீலனை' : ($isHi ? 'दोष विश्लेषण' : 'Dosha Analysis');

        // Keep the chart pair as the only astrology-chart row on page 1; the
        // full planetary and Dasha values remain available to page-2 predictions.
        $doshaCardChunks = array_values(array_filter(
            preg_split('/(?=<div class="dosha-card">)/', $doshaCardsHtml) ?: [],
            static fn($chunk) => trim((string) $chunk) !== ''
        ));
        if (count($doshaCardChunks) > 1) {
            $doshaCardsHtml = '<table class="dosha-pair-grid">';
            for ($doshaChunkIndex = 0; $doshaChunkIndex < count($doshaCardChunks); $doshaChunkIndex += 2) {
                $doshaCardsHtml .= '<tr><td class="dosha-cell">' . $doshaCardChunks[$doshaChunkIndex] . '</td><td class="dosha-cell">'
                    . ($doshaCardChunks[$doshaChunkIndex + 1] ?? '') . '</td></tr>';
            }
            $doshaCardsHtml .= '</table>';
        }

        $page1Html = self::topHeader('ASTRO SIVAM', $p1Sub, $orderNumber, 1, self::JATHAGAM_PAGE_TOTAL, $lang, '', true);
        $page1Html .= <<<HTML
<div class="panel">
  <div class="panel-title">{$panelDevoteeTitle}</div>
  <table class="details-grid">
    <tr>
      <td><div class="det-box"><span class="det-lbl">{$lblPName}</span><span class="det-val">{$name}</span></div></td>
      <td><div class="det-box"><span class="det-lbl">{$lblPRasi}</span><span class="det-val">{$rasiName} ({$rasiLord})</span></div></td>
    </tr>
    <tr>
      <td><div class="det-box"><span class="det-lbl">{$lblPDob}</span><span class="det-val">{$dob} at {$tob}</span></div></td>
      <td><div class="det-box"><span class="det-lbl">{$lblPNak}</span><span class="det-val">{$nakName}, Pada {$pada}</span></div></td>
    </tr>
    <tr>
      <td><div class="det-box"><span class="det-lbl">{$lblPPlace}</span><span class="det-val">{$place}</span></div></td>
      <td><div class="det-box"><span class="det-lbl">{$lblPLagna}</span><span class="det-val">{$lagnaRasi} ({$lagnaLord})</span></div></td>
    </tr>
    <tr>
      <td colspan="2"><div class="det-box"><span class="det-lbl">{$lblPAyanNode}</span><span class="det-val">{$ayanamsaText}<br>{$nodeTypeText}</span></div></td>
    </tr>
  </table>
</div>

{$rasiNavamsaRowHtml}
<div class="panel">
  <div class="panel-title">{$doshaSecTitle}</div>
  {$doshaCardsHtml}
</div>
HTML;

        // ---------------- PAGE 2: 8 Life Guidance Cards ----------------
        // Rebuild the same whole-sign house-lord indicators used by the Node/
        // browser report. The legacy PHP summary is intentionally not used here:
        // it was generic, categorical, and could disagree with the chart.
        $p2Sub = $isTa ? 'ஜாதக வாழ்க்கை வழிகாட்டல்' : ($isHi ? 'कुंडली जीवन मार्गदर्शन' : 'Astrological Life Guidance');
        $planetPositionsForLife = is_array($result['planetPositions'] ?? null) ? $result['planetPositions'] : [];
        $bhavaByGrahaForLife = [];
        $rasiByGrahaForLife = [];
        $flagsByGrahaForLife = [];
        $longitudeByGrahaForLife = [];
        $dignityByGrahaForLife = [];
        foreach ($planetPositionsForLife as $p) {
            if (!is_array($p)) { continue; }
            $grahaKey = strtolower((string)($p['graha'] ?? ''));
            if ($grahaKey === '') {
                $nameKey = strtolower((string)($p['nameEn'] ?? ''));
                foreach (['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as $candidate) {
                    if (strpos($nameKey, $candidate) !== false) { $grahaKey = $candidate; break; }
                }
            }
            if ($grahaKey === '') { continue; }
            $bhavaValue = $normalizeRasiNumber($p['bhavaNumber'] ?? $p['house'] ?? null);
            if ($bhavaValue !== null) { $bhavaByGrahaForLife[$grahaKey] = $bhavaValue; }
            $flagsByGrahaForLife[$grahaKey] = [
                'isCombust' => !empty($p['isCombust']),
                'isRetrograde' => !empty($p['isRetrograde']),
            ];
            $rasiRaw = $p['rasi'] ?? $p['rasiNumber'] ?? null;
            if ($rasiRaw === null && isset($p['rasiIdx'])) {
                $rasiIdxRaw = $p['rasiIdx'];
                if (is_numeric($rasiIdxRaw) && (float) $rasiIdxRaw === (float) (int) $rasiIdxRaw && (int) $rasiIdxRaw >= 0 && (int) $rasiIdxRaw <= 11) {
                    $rasiRaw = (int) $rasiIdxRaw + 1;
                }
            }
            $rasiValue = $normalizeRasiNumber($rasiRaw);
            if ($rasiValue !== null) { $rasiByGrahaForLife[$grahaKey] = $rasiValue; }
            // Items 2/3 need the graha's longitude (10° conjunction orb) and its
            // dignity. Prefer the engine's own totalDegrees, else rebuild it from
            // the rasi + degrees the same way the TypeScript engine does.
            $totalDegreesForLife = null;
            if (is_numeric($p['totalDegrees'] ?? null)) {
                $totalDegreesForLife = fmod((float) $p['totalDegrees'] + 360.0, 360.0);
            } elseif ($rasiValue !== null) {
                $degreesForLife = $p['degrees'] ?? null;
                if (is_numeric($degreesForLife) && is_finite((float) $degreesForLife)) {
                    $totalDegreesForLife = fmod((($rasiValue - 1) * 30.0) + (float) $degreesForLife, 360.0);
                }
            }
            if ($totalDegreesForLife !== null) {
                if ($totalDegreesForLife < 0) { $totalDegreesForLife += 360.0; }
                $longitudeByGrahaForLife[$grahaKey] = $totalDegreesForLife;
            }
            $dignityByGrahaForLife[$grahaKey] = is_array($p['dignity'] ?? null) ? $p['dignity'] : null;
        }
        $rasiLordsForLife = [1 => 'mars', 2 => 'venus', 3 => 'mercury', 4 => 'moon', 5 => 'sun', 6 => 'mercury', 7 => 'venus', 8 => 'mars', 9 => 'jupiter', 10 => 'saturn', 11 => 'saturn', 12 => 'jupiter'];
        $lordNamesEnForLife = ['mars' => 'Mars', 'venus' => 'Venus', 'mercury' => 'Mercury', 'moon' => 'Moon', 'sun' => 'Sun', 'jupiter' => 'Jupiter', 'saturn' => 'Saturn', 'rahu' => 'Rahu', 'ketu' => 'Ketu'];
        $lordNamesTaForLife = ['mars' => 'செவ்வாய்', 'venus' => 'சுக்கிரன்', 'mercury' => 'புதன்', 'moon' => 'சந்திரன்', 'sun' => 'சூரியன்', 'jupiter' => 'குரு', 'saturn' => 'சனி', 'rahu' => 'ராகு', 'ketu' => 'கேது'];
        $lordNamesHiForLife = ['mars' => 'मंगल', 'venus' => 'शुक्र', 'mercury' => 'बुध', 'moon' => 'चंद्र', 'sun' => 'सूर्य', 'jupiter' => 'गुरु', 'saturn' => 'शनि', 'rahu' => 'राहु', 'ketu' => 'केतु'];
        // Item 4: Neecha rasi of the seven classical grahas only. Rahu and Ketu
        // are deliberately absent: the classical texts contradict each other
        // (Rahu=Scorpio/Ketu=Taurus in one school, Sagittarius/Gemini in
        // another), and the shared dignity engine reports the nodes as
        // 'not-applicable'. The old table invented Rahu-in-Scorpio and
        // Ketu-in-Taurus, so a card could call a node debilitated while the
        // Navagraha table said the nodes have no sign dignity.
        $debilitationRasiForLife = ['sun' => 7, 'moon' => 8, 'mars' => 4, 'mercury' => 12, 'jupiter' => 10, 'venus' => 6, 'saturn' => 1];
        // Item 3a: exaltation (uchcha) and own sign (swakshetra) rasis, the same
        // two tables src/lib/astrology/dignity.ts uses.
        $exaltationRasiForLife = ['sun' => 1, 'moon' => 2, 'mars' => 10, 'mercury' => 6, 'jupiter' => 4, 'venus' => 12, 'saturn' => 7];
        $ownSignsForLife = ['sun' => [5], 'moon' => [4], 'mars' => [1, 8], 'mercury' => [3, 6], 'jupiter' => [9, 12], 'venus' => [2, 7], 'saturn' => [10, 11]];
        $naturalMaleficsForLife = ['mars' => true, 'saturn' => true, 'rahu' => true, 'ketu' => true];
        // Item 2: a malefic counts as conjunct only inside this orb (degrees),
        // never merely by sharing a rasi.
        $lifeConjunctionOrbDeg = 10.0;
        $lifeIsDebilitated = function ($grahaKey, $rasiNum, $dignityRow) use ($debilitationRasiForLife) {
            if (is_array($dignityRow) && array_key_exists('isDebilitated', $dignityRow)) {
                return !empty($dignityRow['isDebilitated']);
            }
            return isset($debilitationRasiForLife[$grahaKey]) && $rasiNum === $debilitationRasiForLife[$grahaKey];
        };
        $lifeIsDignified = function ($grahaKey, $rasiNum, $dignityRow) use ($exaltationRasiForLife, $ownSignsForLife) {
            if (is_array($dignityRow) && array_key_exists('isExalted', $dignityRow)) {
                return !empty($dignityRow['isExalted']) || !empty($dignityRow['isOwnSign']);
            }
            return (($exaltationRasiForLife[$grahaKey] ?? null) === $rasiNum)
                || in_array($rasiNum, $ownSignsForLife[$grahaKey] ?? [], true);
        };
        $lifeLongitude = function ($grahaKey) use ($longitudeByGrahaForLife) {
            return array_key_exists($grahaKey, $longitudeByGrahaForLife) ? (float) $longitudeByGrahaForLife[$grahaKey] : null;
        };
        $lagnaRasiForLife = $normalizeRasiNumber($result['lagnaRasi'] ?? null);
        $getLifePlacement = function ($houseNum) use ($lagnaRasiForLife, $rasiLordsForLife, $bhavaByGrahaForLife, $rasiByGrahaForLife, $flagsByGrahaForLife, $naturalMaleficsForLife, $lifeConjunctionOrbDeg, $lifeIsDebilitated, $lifeIsDignified, $lifeLongitude, $dignityByGrahaForLife, $isTa, $isHi, $lordNamesEnForLife, $lordNamesTaForLife, $lordNamesHiForLife) {
            $unavailable = [
                'lordGraha' => null,
                'bhava' => null,
                'isAvailable' => false,
                'isOwnSign' => null,
                'isDusthana' => null,
                'isDebilitated' => null,
                'isCombust' => null,
                'isRetrograde' => null,
                'isChallenging' => false,
                'reason' => '',
            ];
            if (!is_int($lagnaRasiForLife) || $lagnaRasiForLife < 1 || $lagnaRasiForLife > 12 ||
                !is_int($houseNum) || $houseNum < 1 || $houseNum > 12) {
                return $unavailable;
            }
            $targetSign = (($lagnaRasiForLife - 1 + ($houseNum - 1)) % 12) + 1;
            $lordGraha = $rasiLordsForLife[$targetSign] ?? null;
            if ($lordGraha === null) { return $unavailable; }
            $bhava = $bhavaByGrahaForLife[$lordGraha] ?? null;
            $placedSign = $rasiByGrahaForLife[$lordGraha] ?? null;
            if (!is_int($bhava) || $bhava < 1 || $bhava > 12 || !is_int($placedSign) || $placedSign < 1 || $placedSign > 12) {
                return $unavailable;
            }

            $isDusthana = in_array($bhava, [6, 8, 12], true);
            $isDebilitated = $lifeIsDebilitated($lordGraha, $placedSign, $dignityByGrahaForLife[$lordGraha] ?? null);
            $isDignifiedLord = $lifeIsDignified($lordGraha, $placedSign, $dignityByGrahaForLife[$lordGraha] ?? null);
            $isCombust = !empty($flagsByGrahaForLife[$lordGraha]['isCombust']);
            $isRetrograde = !empty($flagsByGrahaForLife[$lordGraha]['isRetrograde']);
            // Item 2: degree-based orb, not sign-sharing. Item 3b: a debilitated
            // malefic is in its weakest state, so it is not a strong malefic.
            $strongMaleficNames = [];
            $weakMaleficNames = [];
            $lordLongitude = $lifeLongitude($lordGraha);
            if ($lordLongitude !== null) {
                foreach ($bhavaByGrahaForLife as $g => $gBhava) {
                    if ($g === $lordGraha || empty($naturalMaleficsForLife[$g])) { continue; }
                    $maleficLongitude = $lifeLongitude($g);
                    if ($maleficLongitude === null) { continue; }
                    $separation = abs($maleficLongitude - $lordLongitude);
                    if ($separation > 180.0) { $separation = 360.0 - $separation; }
                    if ($separation > $lifeConjunctionOrbDeg) { continue; }
                    $maleficName = $isTa ? ($lordNamesTaForLife[$g] ?? $g) : ($isHi ? ($lordNamesHiForLife[$g] ?? $g) : ($lordNamesEnForLife[$g] ?? $g));
                    if ($lifeIsDebilitated($g, $rasiByGrahaForLife[$g] ?? null, $dignityByGrahaForLife[$g] ?? null)) {
                        $weakMaleficNames[] = $maleficName;
                    } else {
                        $strongMaleficNames[] = $maleficName;
                    }
                }
            }
            // Item 3a: an exalted / own-sign lord offsets exactly ONE malefic
            // conjunction; the rest still count.
            $dignityOffsetCount = ($isDignifiedLord && !empty($strongMaleficNames)) ? 1 : 0;
            $offsetMaleficNames = array_slice($strongMaleficNames, 0, $dignityOffsetCount);
            $conjunctNames = array_slice($strongMaleficNames, $dignityOffsetCount, 2);
            $reasons = [];
            if ($isDusthana) { $reasons[] = $isTa ? ($bhava . '-ஆம் சவாலான பாவத்தில்') : ($isHi ? (self::houseOrdinalHi($bhava) . ' चुनौतीपूर्ण भाव में') : ('placed in a challenging ' . self::houseOrdinalEn($bhava) . ' house')); }
            if ($isDebilitated) { $reasons[] = $isTa ? 'நீச நிலையில்' : ($isHi ? 'नीच राशि में' : 'debilitated'); }
            if ($isCombust) { $reasons[] = $isTa ? 'சூரியனுக்கு அருகில் அஸ்தமன நிலையில்' : ($isHi ? 'सूर्य के निकट अस्त' : 'combust/too close to Sun'); }
            if (!empty($conjunctNames)) { $reasons[] = $isTa ? ($lifeConjunctionOrbDeg . '°-க்குள் ' . implode('/', $conjunctNames) . ' சேர்க்கையுடன்') : ($isHi ? ($lifeConjunctionOrbDeg . '° के भीतर ' . implode('/', $conjunctNames) . ' के साथ') : ('joined within ' . $lifeConjunctionOrbDeg . '° with ' . implode('/', $conjunctNames))); }
            if (!empty($offsetMaleficNames)) { $reasons[] = $isTa ? ('உச்ச/சொந்த ராசி அதிபதி ஒரு பாவச் சேர்க்கையை ஈடுசெய்கிறார் (' . implode('/', $offsetMaleficNames) . ')') : ($isHi ? ('उच्च/स्वराशि का स्वामी एक पाप-युति की भरपाई करता है (' . implode('/', $offsetMaleficNames) . ')') : ('exalted/own-sign lord offsets one malefic conjunction (' . implode('/', $offsetMaleficNames) . ')')); }
            if (!empty($weakMaleficNames)) { $reasons[] = $isTa ? (implode('/', $weakMaleficNames) . ' நீச நிலையில் உள்ளதால் வலுவான பாவ கிரகமாகக் கணக்கிடப்படவில்லை') : ($isHi ? (implode('/', $weakMaleficNames) . ' नीच होने से प्रबल पाप ग्रह नहीं माना गया') : (implode('/', $weakMaleficNames) . ' is debilitated, so not counted as a strong malefic')); }
            if ($isRetrograde) { $reasons[] = $isTa ? 'வக்கிரமாக இருப்பதால் பொறுமை தேவை' : ($isHi ? 'वक्री होने से धैर्य आवश्यक' : 'retrograde, requiring review and patience'); }
            return [
                'lordGraha' => $lordGraha,
                'bhava' => $bhava,
                'isAvailable' => true,
                'isOwnSign' => (($rasiLordsForLife[$placedSign] ?? '') === $lordGraha),
                'isDusthana' => $isDusthana,
                'isDebilitated' => $isDebilitated,
                'isDignifiedLord' => $isDignifiedLord,
                'isCombust' => $isCombust,
                'isRetrograde' => $isRetrograde,
                'isChallenging' => $isDusthana || $isDebilitated || $isCombust || !empty($conjunctNames),
                'reason' => implode(', ', $reasons),
            ];
        };
        $lifeLordName = function ($placement) use ($isTa, $isHi, $lordNamesEnForLife, $lordNamesTaForLife, $lordNamesHiForLife) {
            $key = $placement['lordGraha'] ?? null;
            if ($key === null) return 'N/A';
            return $isTa ? ($lordNamesTaForLife[$key] ?? 'N/A') : ($isHi ? ($lordNamesHiForLife[$key] ?? 'N/A') : ($lordNamesEnForLife[$key] ?? 'N/A'));
        };
        $lifeBadge = function ($houseNum, $placement) use ($isTa, $isHi) {
            if (empty($placement['isAvailable'])) {
                return $isTa ? ($houseNum . '-ஆம் அதிபதி → N/A') : ($isHi ? (self::houseOrdinalHi($houseNum) . ' भाव का स्वामी → N/A') : (self::houseOrdinalEn($houseNum) . ' lord → N/A'));
            }
            $suffix = !empty($placement['isChallenging']) ? ($isTa ? ' ⚠ கவனம்' : ($isHi ? ' ⚠ सावधान' : ' ⚠ Caution')) : ($isTa ? ' ✓ பலம்' : ($isHi ? ' ✓ बल' : ' ✓ Strength'));
            return $isTa ? ($houseNum . '-ஆம் அதிபதி → ' . $placement['bhava'] . '-ஆம் பாவம்' . $suffix) : ($isHi ? (self::houseOrdinalHi($houseNum) . ' भाव का स्वामी → ' . self::houseOrdinalHi($placement['bhava']) . ' भाव' . $suffix) : (self::houseOrdinalEn($houseNum) . ' lord → ' . self::houseOrdinalEn($placement['bhava']) . ' house' . $suffix));
        };
        $lifeStatus = function ($placement) use ($isTa, $isHi, $lifeLordName) {
            if (empty($placement['isAvailable'])) return 'N/A';
            if (!empty($placement['reason'])) { return $placement['reason']; }
            return $isTa ? ($lifeLordName($placement) . ' ஆதரவு நிலையில்') : ($isHi ? ($lifeLordName($placement) . ' सहायक स्थिति में') : ($lifeLordName($placement) . ' in a supportive placement'));
        };
        $lifePos = function ($placement) use ($isTa, $isHi, $lifeLordName) {
            if (empty($placement['isAvailable'])) return 'N/A';
            return $isTa ? ($lifeLordName($placement) . ' ' . $placement['bhava'] . '-ஆம் பாவத்தில்') : ($isHi ? ($lifeLordName($placement) . ' ' . self::houseOrdinalHi($placement['bhava']) . ' भाव में') : ($lifeLordName($placement) . ' in the ' . self::houseOrdinalEn($placement['bhava']) . ' house'));
        };

        // Item 6: natural karakas and the role houses, named on the same cards
        // as the browser report — Venus (marriage), Jupiter (wealth), the 11th lord
        // (income/Labha) and the 6th lord (health/Roga). A missing graha yields
        // '' so a card never invents a placement.
        $reportNamesForLife = [
            'sun' => $isTa ? 'சூரியன்' : ($isHi ? 'सूर्य' : 'Surya'),
            'moon' => $isTa ? 'சந்திரன்' : ($isHi ? 'चंद्र' : 'Chandra'),
            'mars' => $isTa ? 'செவ்வாய்' : ($isHi ? 'मंगल' : 'Mangal'),
            'mercury' => $isTa ? 'புதன்' : ($isHi ? 'बुध' : 'Budha'),
            'jupiter' => $isTa ? 'குரு' : ($isHi ? 'गुरु' : 'Guru'),
            'venus' => $isTa ? 'சுக்கிரன்' : ($isHi ? 'शुक्र' : 'Sukra'),
            'saturn' => $isTa ? 'சனி' : ($isHi ? 'शनि' : 'Sani'),
            'rahu' => $isTa ? 'ராகு' : ($isHi ? 'राहु' : 'Rahu'),
            'ketu' => $isTa ? 'கேது' : ($isHi ? 'केतु' : 'Ketu'),
        ];
        $karakaLineForLife = function ($grahaKey, $roleTa, $roleHi, $roleEn) use ($bhavaByGrahaForLife, $rasiByGrahaForLife, $dignityByGrahaForLife, $reportNamesForLife, $rasiNamesByNumber, $lang, $isTa, $isHi) {
            $bhavaForKaraka = $bhavaByGrahaForLife[$grahaKey] ?? null;
            if (!is_int($bhavaForKaraka) || $bhavaForKaraka < 1 || $bhavaForKaraka > 12) { return ''; }
            $karakaName = $reportNamesForLife[$grahaKey] ?? $grahaKey;
            $rasiNumForKaraka = $rasiByGrahaForLife[$grahaKey] ?? null;
            $karakaRasiLabel = ($rasiNumForKaraka !== null && isset($rasiNamesByNumber[$rasiNumForKaraka]))
                ? $rasiNamesByNumber[$rasiNumForKaraka][$lang] : '';
            $karakaDignity = $dignityByGrahaForLife[$grahaKey] ?? null;
            $karakaDignityText = '';
            if (is_array($karakaDignity)) {
                $karakaDignityLabel = $isTa ? ($karakaDignity['statusTa'] ?? '') : ($isHi ? ($karakaDignity['statusHi'] ?? '') : ($karakaDignity['statusEn'] ?? ''));
                if (is_string($karakaDignityLabel) && $karakaDignityLabel !== ''
                    && !preg_match('/^(Neutral|சம நிலை|सामान्य स्थिति)/u', $karakaDignityLabel)) {
                    $karakaDignityText = ' (' . $karakaDignityLabel . ')';
                }
            }
            $karakaPlace = $isTa ? ($bhavaForKaraka . '-ஆம் பாவத்தில்') : ($isHi ? (self::houseOrdinalHi($bhavaForKaraka) . ' भाव में') : ('in the ' . self::houseOrdinalEn($bhavaForKaraka) . ' house'));
            $karakaRole = $isTa ? $roleTa : ($isHi ? $roleHi : $roleEn);
            return ' ' . $karakaRole . ': ' . $karakaName . ' ' . $karakaPlace . $karakaDignityText . ($karakaRasiLabel !== '' ? ' — ' . $karakaRasiLabel : '') . '.';
        };
        $lifeLordRoleLine = function ($houseNum, $roleTa, $roleHi, $roleEn) use ($getLifePlacement, $lifePos, $isTa, $isHi) {
            $placementForRole = $getLifePlacement($houseNum);
            if (empty($placementForRole['isAvailable'])) { return ''; }
            $roleState = !empty($placementForRole['isChallenging'])
                ? ($isTa ? 'கவனம் தேவை' : ($isHi ? 'ध्यान आवश्यक' : 'needs attention'))
                : ($isTa ? 'ஆதரவு நிலை' : ($isHi ? 'सहायक स्थिति' : 'supportive'));
            $roleName = $isTa ? $roleTa : ($isHi ? $roleHi : $roleEn);
            return ' ' . $roleName . ': ' . $lifePos($placementForRole) . ' — ' . $roleState . '.';
        };
        $venusLineForLife = $karakaLineForLife('venus', 'திருமண காரகன் சுக்கிரன்', 'विवाह कारक शुक्र', 'Venus, karaka of marriage');
        $jupiterLineForLife = $karakaLineForLife('jupiter', 'தன காரகன் குரு', 'धन कारक गुरु', 'Jupiter, karaka of wealth');
        $incomeLordLineForLife = $lifeLordRoleLine(11, '11-ஆம் அதிபதி (வருமானம்/லாபம்)', '11वें भाव का स्वामी (आय/लाभ)', '11th lord (income/Labha)');
        $healthLordLineForLife = $lifeLordRoleLine(6, '6-ஆம் அதிபதி (ஆரோக்கியம்/ரோகம்)', 'छठे भाव का स्वामी (स्वास्थ्य/रोग)', '6th lord (health/Roga)');

        $h1Life = $getLifePlacement(1); $h2Life = $getLifePlacement(2); $h4Life = $getLifePlacement(4); $h5Life = $getLifePlacement(5);
        $h7Life = $getLifePlacement(7); $h9Life = $getLifePlacement(9); $h10Life = $getLifePlacement(10);
        // Item 1: the running Mahadasa lord is resolved from the engine's Graha
        // ENUM key (dashaPeriods[].mahadashaLord, e.g. 'venus'/'saturn'), never
        // from the display text — the report labels those two "Sukra"/"Sani"
        // while the dasha block says "Venus"/"Saturn". Only older payloads
        // without dashaPeriods fall back to a name -> key lookup.
        $dashaPeriodsForLife = is_array($result['dashaPeriods'] ?? null) ? $result['dashaPeriods'] : [];
        $currentDashaLordKeyForLife = null;
        $dashaPeriodStartForLife = '';
        foreach ($dashaPeriodsForLife as $periodForLife) {
            if (is_array($periodForLife) && !empty($periodForLife['isCurrent'])) {
                $currentDashaLordKeyForLife = strtolower((string) ($periodForLife['mahadashaLord'] ?? ''));
                $dashaPeriodStartForLife = (string) ($periodForLife['startDate'] ?? '');
                break;
            }
        }
        if (($currentDashaLordKeyForLife === null || $currentDashaLordKeyForLife === '') && is_array($result['dasha'] ?? null)) {
            $dashaNameToKeyForLife = [
                'surya' => 'sun', 'sun' => 'sun', 'chandra' => 'moon', 'moon' => 'moon',
                'mangal' => 'mars', 'mars' => 'mars', 'budha' => 'mercury', 'mercury' => 'mercury',
                'guru' => 'jupiter', 'jupiter' => 'jupiter', 'sukra' => 'venus', 'venus' => 'venus',
                'sani' => 'saturn', 'saturn' => 'saturn', 'rahu' => 'rahu', 'ketu' => 'ketu',
            ];
            $dashaLordNameRaw = strtolower(trim((string) ($result['dasha']['currentLord'] ?? '')));
            $currentDashaLordKeyForLife = $dashaNameToKeyForLife[$dashaLordNameRaw] ?? null;
        }
        if ($currentDashaLordKeyForLife === '') { $currentDashaLordKeyForLife = null; }
        $dashaPlacementAvailableForLife = $currentDashaLordKeyForLife !== null
            && isset($bhavaByGrahaForLife[$currentDashaLordKeyForLife])
            && is_int($bhavaByGrahaForLife[$currentDashaLordKeyForLife]);
        $dashaIsChallengingForLife = $dashaPlacementAvailableForLife
            ? (in_array($bhavaByGrahaForLife[$currentDashaLordKeyForLife], [6, 8, 12], true)
                || !empty($flagsByGrahaForLife[$currentDashaLordKeyForLife]['isCombust'])
                || !empty($flagsByGrahaForLife[$currentDashaLordKeyForLife]['isRetrograde']))
            : null;
        $dashaLordNameForLife = $currentDashaLordKeyForLife !== null
            ? ($isTa ? ($lordNamesTaForLife[$currentDashaLordKeyForLife] ?? null) : ($isHi ? ($lordNamesHiForLife[$currentDashaLordKeyForLife] ?? null) : ($lordNamesEnForLife[$currentDashaLordKeyForLife] ?? null)))
            : null;
        $dashaLabelForLife = $dashaLordNameForLife !== null
            ? ($isTa ? ($dashaLordNameForLife . ' மகாதிசை' . ($dashaPeriodStartForLife !== '' ? ' (' . $dashaPeriodStartForLife . ' முதல்)' : ''))
                : ($isHi ? ($dashaLordNameForLife . ' महादशा' . ($dashaPeriodStartForLife !== '' ? ' (' . $dashaPeriodStartForLife . ' से)' : ''))
                : ($dashaLordNameForLife . ' Mahadasa' . ($dashaPeriodStartForLife !== '' ? ' (from ' . $dashaPeriodStartForLife . ')' : ''))))
            : ($currentDasha ?: ($isTa ? 'நடப்பு தசை' : ($isHi ? 'वर्तमान दशा' : 'Current dasha')));
        // Items 4/6/7b: the 9th lord in the 8th is a caution (never "நன்மை /
        // Good"), Sarala / own-sign Saturn are named, Kendradhipati is quoted by
        // the Career and Marriage cards, and a Mahadasa change inside 12 months
        // is always announced.
        $ninthLordInEighthNow = false;
        $saralaYogaNow = null;
        $saturnOwnYogaNow = null;
        foreach ((array) ($result['yogas'] ?? []) as $yogaNote) {
            if (!is_array($yogaNote)) { continue; }
            if (($yogaNote['code'] ?? '') === 'NINTH_LORD_IN_EIGHTH') { $ninthLordInEighthNow = true; }
            if (($yogaNote['code'] ?? '') === 'SARALA') { $saralaYogaNow = $yogaNote; }
            if (($yogaNote['code'] ?? '') === 'SATURN_OWN_SIGN') { $saturnOwnYogaNow = $yogaNote; }
        }
        $fortuneLeadTa = $ninthLordInEighthNow ? 'கவனம்' : 'நன்மை';
        $fortuneLeadHi = $ninthLordInEighthNow ? 'सावधानी' : 'शुभ';
        $fortuneLeadEn = $ninthLordInEighthNow ? 'Caution' : 'Good';
        $fortuneCautionTa = $ninthLordInEighthNow ? ' 9-ஆம் அதிபதி 8-ஆம் பாவத்தில் உள்ளதால் இது நன்மையாகக் கணக்கிடப்படவில்லை; பாக்கியம் முயற்சி, தாமதம் அல்லது ஆராய்ச்சி வழியே வரும்.' : '';
        $fortuneCautionHi = $ninthLordInEighthNow ? ' नवमेश अष्टम भाव में होने से इसे शुभ नहीं माना गया; भाग्य परिश्रम, विलंब या शोध से मिलता है।' : '';
        $fortuneCautionEn = $ninthLordInEighthNow ? ' The 9th lord sits in the 8th house, so this is read as a caution rather than a benefit: fortune arrives through effort, delay or research.' : '';
        $yogaExtraTa = ($saralaYogaNow ? ' ' . ($saralaYogaNow['nameTa'] ?? '') . '.' : '') . ($saturnOwnYogaNow ? ' ' . ($saturnOwnYogaNow['nameTa'] ?? '') . '.' : '');
        $yogaExtraHi = ($saralaYogaNow ? ' ' . ($saralaYogaNow['nameHi'] ?? '') . '.' : '') . ($saturnOwnYogaNow ? ' ' . ($saturnOwnYogaNow['nameHi'] ?? '') . '.' : '');
        $yogaExtraEn = ($saralaYogaNow ? ' ' . ($saralaYogaNow['nameEn'] ?? '') . '.' : '') . ($saturnOwnYogaNow ? ' ' . ($saturnOwnYogaNow['nameEn'] ?? '') . '.' : '');
        $kendraCareerNoteTa = '';
        $kendraCareerNoteHi = '';
        $kendraCareerNoteEn = '';
        $kendraMarriageNoteTa = '';
        $kendraMarriageNoteHi = '';
        $kendraMarriageNoteEn = '';
        foreach ((array) ($result['kendradhipati'] ?? []) as $kendraEntry) {
            if (!is_array($kendraEntry)) { continue; }
            $kendraHouses = array_map('intval', (array) ($kendraEntry['houses'] ?? []));
            if (in_array(10, $kendraHouses, true)) {
                $kendraCareerNoteTa = ' ' . ($kendraEntry['descriptionTa'] ?? '');
                $kendraCareerNoteHi = ' ' . ($kendraEntry['descriptionHi'] ?? '');
                $kendraCareerNoteEn = ' ' . ($kendraEntry['descriptionEn'] ?? '');
            }
            if (in_array(7, $kendraHouses, true)) {
                $kendraMarriageNoteTa = ' ' . ($kendraEntry['descriptionTa'] ?? '');
                $kendraMarriageNoteHi = ' ' . ($kendraEntry['descriptionHi'] ?? '');
                $kendraMarriageNoteEn = ' ' . ($kendraEntry['descriptionEn'] ?? '');
            }
        }
        $nextMahadasaReport = is_array($result['dasha']['nextMahadasa'] ?? null) ? $result['dasha']['nextMahadasa'] : [];
        $dashaNoticeTa = !empty($nextMahadasaReport['within12Months']) ? (string) ($nextMahadasaReport['noticeTa'] ?? '') : '';
        $dashaNoticeHi = !empty($nextMahadasaReport['within12Months']) ? (string) ($nextMahadasaReport['noticeHi'] ?? '') : '';
        $dashaNoticeEn = !empty($nextMahadasaReport['within12Months']) ? (string) ($nextMahadasaReport['noticeEn'] ?? '') : '';

        $lifeCardsData = [
            [
                'title' => $isTa ? 'ஆரோக்கியம் & நல்வாழ்வு' : ($isHi ? 'स्वास्थ्य एवं आरोग्य' : 'Health & Vitality'),
                'badge' => $lifeBadge(1, $h1Life), 'caution' => $h1Life['isChallenging'],
                'text' => $isTa
                    ? 'நன்மை: லக்னாதிபதி ' . $lifePos($h1Life) . ' இருப்பதால் உடல் சக்தி மேம்பட முயற்சி, உணவு ஒழுக்கம் உதவும். கவனம்: ' . $lifeStatus($h1Life) . '; பலவீனம் இருந்தால் உடல் வலி, சோர்வு, தோல்/வயிறு எரிச்சல் போன்ற சிறு தொந்தரவுகள் வரலாம். அறிகுறிகள் இருந்தால் மருத்துவரை அணுகவும்.' . $healthLordLineForLife
                    : ($isHi ? 'शुभ: लग्नेश ' . $lifePos($h1Life) . ' होने से ऊर्जा संभालने में दिनचर्या, आहार और व्यायाम सहायक रहेंगे। सावधानी: ' . $lifeStatus($h1Life) . '; कमजोरी हो तो शरीर-दर्द, थकान, त्वचा/पेट की परेशानी हो सकती है। लक्षण हों तो डॉक्टर से मिलें।' . $healthLordLineForLife : 'Good: Lagna lord ' . $lifePos($h1Life) . ' supports vitality when routine, diet, and movement are maintained. Caution: ' . $lifeStatus($h1Life) . '; if weak, body pain, fatigue, skin irritation or stomach sensitivity may trouble you. Seek medical care for symptoms.' . $healthLordLineForLife),
            ],
            [
                'title' => $isTa ? 'தனம் & நிதி நிலை' : ($isHi ? 'धन एवं संपत्ति' : 'Wealth & Finance'),
                'badge' => $lifeBadge(2, $h2Life), 'caution' => $h2Life['isChallenging'],
                'text' => $isTa
                    ? 'நன்மை: தனாதிபதி ' . $lifePos($h2Life) . ' இருப்பதால் சேமிப்பு, குடும்ப ஆதரவு, வருமான திட்டம் பலன் தரலாம். கவனம்: ' . $lifeStatus($h2Life) . '; செலவு அதிகரிப்பு, கடன் அழுத்தம் அல்லது பணம் தாமதம் வரலாம். பட்ஜெட் அவசியம்.' . $jupiterLineForLife . $incomeLordLineForLife
                    : ($isHi ? 'शुभ: धनेश ' . $lifePos($h2Life) . ' बचत, परिवार-सहयोग और आय-योजना में मदद दे सकता है। सावधानी: ' . $lifeStatus($h2Life) . '; खर्च, कर्ज-दबाव या पैसा अटकना दिख सकता है। बजट रखें।' . $jupiterLineForLife . $incomeLordLineForLife : 'Good: 2nd lord ' . $lifePos($h2Life) . ' can support savings, family resources, and income planning. Caution: ' . $lifeStatus($h2Life) . '; watch for higher expenses, debt pressure, or delayed payments. Keep a budget.' . $jupiterLineForLife . $incomeLordLineForLife),
            ],
            [
                'title' => $isTa ? 'கல்வி & அறிவுத்திறன்' : ($isHi ? 'शिक्षा एवं बौद्धिकता' : 'Education & Intellect'),
                'badge' => $lifeBadge(5, $h5Life), 'caution' => $h5Life['isChallenging'],
                'text' => $isTa
                    ? 'நன்மை: 5-ஆம் அதிபதி ' . $lifePos($h5Life) . ' இருப்பதால் நினைவாற்றல், படைப்பாற்றல், தேர்வு தயாரிப்பு மேம்படலாம். கவனம்: ' . $lifeStatus($h5Life) . '; கவனம் சிதறல், மறதி, பாடத்தில் இடைவேளை வரலாம். தினசரி திட்டம் தேவை.'
                    : ($isHi ? 'शुभ: पंचमेश ' . $lifePos($h5Life) . ' स्मरण-शक्ति, रचनात्मकता और परीक्षा-तैयारी में सहायक हो सकता है। सावधानी: ' . $lifeStatus($h5Life) . '; ध्यान भटकना, भूलना या पढ़ाई में रुकावट आ सकती है। दैनिक योजना रखें।' : 'Good: 5th lord ' . $lifePos($h5Life) . ' can help memory, creativity, and exam preparation. Caution: ' . $lifeStatus($h5Life) . '; concentration breaks, forgetfulness, or study gaps may occur. Use a daily study plan.'),
            ],
            [
                'title' => $isTa ? 'தொழில் & உத்தியோகம்' : ($isHi ? 'व्यवसाय एवं आजीविका' : 'Career & Profession'),
                'badge' => $lifeBadge(10, $h10Life), 'caution' => $h10Life['isChallenging'],
                'text' => $isTa
                    ? 'நன்மை: 10-ஆம் அதிபதி ' . $lifePos($h10Life) . ' இருப்பதால் பொறுப்பு, பெயர், திறன் வளர்ச்சி வாய்ப்பு உண்டு. கவனம்: ' . $lifeStatus($h10Life) . '; வேலை தாமதம், மேலதிகாரி உராய்வு, திட்ட மாற்றம் வரலாம். ஆவணங்களையும் காலக்கெடுவையும் கவனிக்கவும்.' . $kendraCareerNoteTa
                    : ($isHi ? 'शुभ: दशमेश ' . $lifePos($h10Life) . ' जिम्मेदारी, पहचान और कौशल-विकास में मदद दे सकता है। सावधानी: ' . $lifeStatus($h10Life) . '; काम में देरी, वरिष्ठों से मतभेद या योजना-बदलाव हो सकता है। दस्तावेज़ और समय-सीमा संभालें।' . $kendraCareerNoteHi : 'Good: 10th lord ' . $lifePos($h10Life) . ' can support responsibility, recognition, and skill growth. Caution: ' . $lifeStatus($h10Life) . '; delays, friction with seniors, or project changes may arise. Watch documents and deadlines.' . $kendraCareerNoteEn),
            ],
            [
                'title' => $isTa ? 'திருமணம் & உறவு' : ($isHi ? 'विवाह एवं सम्बंध' : 'Marriage & Relations'),
                'badge' => $lifeBadge(7, $h7Life), 'caution' => $h7Life['isChallenging'],
                'text' => $isTa
                    ? 'நன்மை: 7-ஆம் அதிபதி ' . $lifePos($h7Life) . ' இருப்பதால் துணை/கூட்டாண்மை ஆதரவு கிடைக்கலாம். கவனம்: ' . $lifeStatus($h7Life) . '; தவறான புரிதல், தாமதம், வாக்குவாதம் வரலாம். மெதுவாக பேசுவது நல்லது.' . $venusLineForLife . $kendraMarriageNoteTa
                    : ($isHi ? 'शुभ: सप्तमेश ' . $lifePos($h7Life) . ' जीवनसाथी/साझेदारी से सहयोग दे सकता है। सावधानी: ' . $lifeStatus($h7Life) . '; गलतफहमी, देरी या बहस हो सकती है। शांत संवाद रखें।' . $venusLineForLife . $kendraMarriageNoteHi : 'Good: 7th lord ' . $lifePos($h7Life) . ' can support spouse/partner cooperation. Caution: ' . $lifeStatus($h7Life) . '; misunderstanding, delay, or arguments may occur. Use patient communication.' . $venusLineForLife . $kendraMarriageNoteEn),
            ],
            [
                'title' => $isTa ? 'வீடு, நிலம் & சொத்து' : ($isHi ? 'भूमि, भवन एवं संपत्ति' : 'Property & Real Estate'),
                'badge' => $lifeBadge(4, $h4Life), 'caution' => $h4Life['isChallenging'],
                'text' => $isTa
                    ? 'நன்மை: 4-ஆம் அதிபதி ' . $lifePos($h4Life) . ' இருப்பதால் வீட்டு வசதி, வாகனம், மன அமைதி மேம்படலாம். கவனம்: ' . $lifeStatus($h4Life) . '; வீடு/நில ஆவண தாமதம், பழுது செலவு, குடும்ப மனஅழுத்தம் வரலாம். சரிபார்ப்பு அவசியம்.'
                    : ($isHi ? 'शुभ: चतुर्थेश ' . $lifePos($h4Life) . ' घर-सुख, वाहन और मानसिक शांति में मदद दे सकता है। सावधानी: ' . $lifeStatus($h4Life) . '; संपत्ति कागज़, मरम्मत खर्च या घरेलू तनाव आ सकता है। जाँच ज़रूरी है।' : 'Good: 4th lord ' . $lifePos($h4Life) . ' can support home comfort, vehicle matters, and peace of mind. Caution: ' . $lifeStatus($h4Life) . '; property-document delays, repair expenses, or family stress may arise. Verify carefully.'),
            ],
            [
                'title' => $isTa ? 'பயணம் & அதிர்ஷ்டம்' : ($isHi ? 'विदेश यात्रा एवं भाग्य' : 'Travel & Global Fortune'),
                'badge' => $lifeBadge(9, $h9Life), 'caution' => $h9Life['isChallenging'],
                'text' => $isTa
                    ? $fortuneLeadTa . ': 9-ஆம் அதிபதி ' . $lifePos($h9Life) . ' இருப்பதால் குரு அருள், பயணம், உயர் கற்றல் வாய்ப்பு கிடைக்கலாம். கவனம்: ' . $lifeStatus($h9Life) . '; பயண தாமதம், விசா/ஆவண பிரச்சனை, வழிகாட்டி மாற்றம் வரலாம். முன்கூட்டியே திட்டமிடவும்.' . $fortuneCautionTa . $yogaExtraTa
                    : ($isHi ? $fortuneLeadHi . ': नवमेश ' . $lifePos($h9Life) . ' गुरु-कृपा, यात्रा और उच्च शिक्षा के अवसर दे सकता है। सावधानी: ' . $lifeStatus($h9Life) . '; यात्रा देरी, वीज़ा/कागज़ समस्या या मार्गदर्शन बदल सकता है। पहले से योजना करें।' . $fortuneCautionHi . $yogaExtraHi : $fortuneLeadEn . ': 9th lord ' . $lifePos($h9Life) . ' can support blessings, travel, and higher learning. Caution: ' . $lifeStatus($h9Life) . '; travel delays, visa/document issues, or mentor changes may happen. Plan early.' . $fortuneCautionEn . $yogaExtraEn),
            ],
            [
                'title' => $isTa ? 'தற்போதைய வழிகாட்டல்' : ($isHi ? 'ज्योतिषीय मार्गदर्शन' : 'Current Guidance'),
                'badge' => $dashaIsChallengingForLife === null
                    ? 'N/A'
                    : ($dashaIsChallengingForLife
                        ? ($isTa ? 'நடப்பு ஆண்டு ⚠ கவனம்' : ($isHi ? 'आगामी वर्ष ⚠ सावधान' : 'Upcoming Year ⚠ Caution'))
                        : ($isTa ? 'நடப்பு ஆண்டு ✓ வாய்ப்பு' : ($isHi ? 'आगामी वर्ष ✓ अवसर' : 'Upcoming Year ✓ Opportunity'))),
                'caution' => $dashaIsChallengingForLife === true,
                'text' => $isTa ? 'ஜென்ம ராசி மற்றும் ' . $dashaLabelForLife . '.' . ($dashaNoticeTa !== '' ? ' ' . $dashaNoticeTa : '') . ' நன்மை: பழைய முயற்சிகளை முடித்து ஆன்மீக தெளிவு பெறலாம். கவனம்: அடுத்த 12 மாதங்களில் அவசர முடிவு, ஆரோக்கிய அலட்சியம், தேவையற்ற செலவு தவிர்க்கவும்.' : ($isHi ? 'जन्म राशि और ' . $dashaLabelForLife . '।' . ($dashaNoticeHi !== '' ? ' ' . $dashaNoticeHi : '') . ' शुभ: पुराने कार्य पूरे करके आध्यात्मिक स्पष्टता मिल सकती है। सावधानी: अगले 12 महीनों में जल्दबाज़ निर्णय, स्वास्थ्य-लापरवाही और अनावश्यक खर्च से बचें।' : 'Janma Rasi and ' . $dashaLabelForLife . '.' . ($dashaNoticeEn !== '' ? ' ' . $dashaNoticeEn : '') . ' Good: the next 12 months can help complete pending efforts and improve spiritual clarity. Caution: avoid rushed decisions, health neglect, and unnecessary spending.'),
            ],
        ];

        $lifePlacementsForCards = [$h1Life, $h2Life, $h5Life, $h10Life, $h7Life, $h4Life, $h9Life];
        $lifeHouseNumbersForCards = [1, 2, 5, 10, 7, 4, 9];
        $unavailableLifeText = $isTa
            ? 'தேவையான கிரக நிலை கிடைக்கவில்லை (N/A); இந்த ஜாதகத்திற்கான வழிகாட்டலைத் தீர்மானிக்க முடியாது.'
            : ($isHi ? 'आवश्यक ग्रह स्थिति उपलब्ध नहीं (N/A); इस कुंडली के लिए मार्गदर्शन निर्धारित नहीं किया जा सकता।' : 'Required planetary placement unavailable (N/A); chart-specific guidance cannot be determined.');
        foreach ($lifePlacementsForCards as $index => $placement) {
            if (!empty($placement['isAvailable'])) { continue; }
            $lifeCardsData[$index]['badge'] = $lifeBadge($lifeHouseNumbersForCards[$index], $placement);
            $lifeCardsData[$index]['caution'] = false;
            $lifeCardsData[$index]['text'] = $unavailableLifeText;
        }

        $lifeDisclaimer = $isTa ? 'பாரம்பரிய ஜோதிடக் குறியீடுகள் மட்டுமே; மருத்துவம், நிதி, சட்டம் அல்லது உறவு ஆலோசனை அல்ல.' : ($isHi ? 'पारंपरिक ज्योतिषीय संकेत मात्र; यह चिकित्सा, वित्त, कानूनी या संबंध सलाह नहीं है।' : 'Traditional Jyotisha indicators only; not medical, financial, legal, or relationship advice.');
        $lifeCardsHtml = '<table class="life-grid">';
        for ($i = 0; $i < count($lifeCardsData); $i += 2) {
            $lifeCardsHtml .= '<tr>';
            for ($j = 0; $j < 2; $j++) {
                $card = $lifeCardsData[$i + $j] ?? null;
                if (!$card) { $lifeCardsHtml .= '<td></td>'; continue; }
                $badgeClass = !empty($card['caution']) ? 'life-card-badge badge-caution' : 'life-card-badge';
                $cardHeader = '<table style="width:100%; border-collapse:collapse; margin-bottom:1.5mm; border-bottom:1px dotted #a67c1f; padding-bottom:1mm;"><tr><td style="font-size:12px; font-weight:bold; color:#7a1f1f; vertical-align:top; text-align:left; width:58%;">' . self::e($card['title']) . '</td><td style="text-align:right; vertical-align:top; width:42%;"><span class="' . $badgeClass . '">' . self::e($card['badge']) . '</span></td></tr></table>';
                $lifeCardsHtml .= '<td class="life-card">' . $cardHeader . '<p>' . self::e($card['text']) . '</p></td>';
            }
            $lifeCardsHtml .= '</tr>';
        }
        $lifeCardsHtml .= '</table>';

        $page2Html = self::topHeader('ASTRO SIVAM', $p2Sub, $orderNumber, 2, self::JATHAGAM_PAGE_TOTAL, $lang, '', true);
        $page2Html .= '<div class="life-disclaimer">' . self::e($lifeDisclaimer) . '</div>' . $lifeCardsHtml;

        // ---------------- PAGE 3: Short Summary (one A4, always) ----------------
        // Plain-language readback of pages 1 and 2. The supportive / needs-care
        // lists come from the ONE shared rule (classifyJathagamPlanetsForSummary,
        // mirrored from src/services/jathagamPlanetSummary.ts), and the remedies
        // come from the Navagraha reference data (deity / weekday / charity) plus
        // the additive lamp-oil and mantra fields. Everything is drawn from the
        // computed chart; nothing is hardcoded, and the page is laid out in
        // tables only, because mPDF has no flexbox or grid.
        $summary = self::classifyJathagamPlanetsForSummary($result, $lang);
        $summaryTexts = self::jathagamSummaryText($lang);
        $summaryText = $summaryTexts['text'];
        $summaryLabels = $summaryTexts['labels'];
        $summaryRemedyData = self::jathagamSummaryRemedyData();
        $isCompact = !empty($summary['compact']);

        $summaryPlanetNameRaw = static function (string $key) use ($summaryRemedyData, $lang): string {
            return (string) ($summaryRemedyData[$key]['name'][$lang] ?? $key);
        };
        $summaryPlanetName = static function (string $key) use ($summaryPlanetNameRaw): string {
            return self::e($summaryPlanetNameRaw($key));
        };

        $padaText = ($pada === '' || $pada === 'N/A')
            ? 'N/A'
            : ($isTa ? "{$pada}-ஆம் பாதம்" : ($isHi ? "पाद {$pada}" : "Pada {$pada}"));

        $summaryCell = static function (string $label, string $value, int $span = 1): string {
            return '<td class="summary-cell"' . ($span === 2 ? ' colspan="2"' : '') . '>'
                . '<div class="summary-detail-label">' . self::e($label) . '</div>'
                . '<div class="summary-detail-value">' . $value . '</div></td>';
        };
        $summaryDetailsHtml = '<table class="summary-details"><tr>'
            . $summaryCell($isTa ? 'பெயர்' : ($isHi ? 'नाम' : 'Name'), $name)
            . $summaryCell($isTa ? 'பிறந்த தேதி' : ($isHi ? 'जन्म तिथि' : 'Birth Date'), $dob)
            . $summaryCell($isTa ? 'பிறந்த நேரம்' : ($isHi ? 'जन्म समय' : 'Birth Time'), $tob)
            . $summaryCell($isTa ? 'பிறந்த இடம்' : ($isHi ? 'जन्म स्थान' : 'Birth Place'), $place)
            . '</tr><tr>'
            . $summaryCell($isTa ? 'லக்னம்' : ($isHi ? 'लग्न' : 'Lagna'), $lagnaRasi)
            . $summaryCell($isTa ? 'ராசி' : ($isHi ? 'राशि' : 'Rasi'), $rasiName)
            . $summaryCell($isTa ? 'நட்சத்திரம்' : ($isHi ? 'नक्षत्र' : 'Nakshatra'), $nakName . ' — ' . self::e($padaText), 2)
            . '</tr></table>';

        $summaryGoodCells = '';
        foreach ($summary['supportive'] as $planet) {
            $summaryGoodCells .= '<td class="summary-planet">'
                . '<div class="summary-planet-name">' . $summaryPlanetName((string) $planet['key']) . '</div>'
                . '<div class="summary-planet-note">'
                . self::e((string) ($summaryRemedyData[$planet['key']]['support'][$lang] ?? '')) . '</div></td>';
        }
        $summaryGoodHtml = $summaryGoodCells === ''
            ? '<div class="summary-empty">' . self::e($summaryText['noSupportPlanet']) . '</div>'
            : '<table class="summary-good"><tr>' . $summaryGoodCells . '</tr></table>';

        $summaryCareRows = '';
        foreach ($summary['needsCare'] as $planet) {
            if ($isCompact) {
                $remedyCell = '<div class="summary-care-compact">' . self::e((string) $planet['compactLine']) . '</div>';
            } else {
                $remedyCell = '<div class="summary-care-line"><span class="summary-care-label">'
                        . self::e($summaryLabels['worship']) . '</span> ' . self::e((string) $planet['worship']) . '</div>'
                    . '<div class="summary-care-line"><span class="summary-care-label">'
                        . self::e($summaryLabels['lamp']) . '</span> ' . self::e((string) $planet['lamp']) . '</div>'
                    . '<div class="summary-care-line"><span class="summary-care-label">'
                        . self::e($summaryLabels['donation']) . '</span> ' . self::e((string) $planet['donation']) . '</div>'
                    . '<div class="summary-care-line"><span class="summary-care-label">'
                        . self::e($summaryLabels['mantra']) . '</span> ' . self::e((string) $planet['mantra']) . '</div>';
            }
            $summaryCareRows .= '<tr><td class="summary-care-planet">' . $summaryPlanetName((string) $planet['key'])
                . '</td><td>' . self::e((string) $planet['difficulties']) . '</td><td>' . $remedyCell . '</td></tr>';
        }
        if ($summaryCareRows === '') {
            $summaryCareRows = '<tr><td colspan="3" class="summary-empty">' . self::e($summaryText['noCarePlanet']) . '</td></tr>';
        }
        $summaryCareHtml = '<table class="summary-care"><colgroup>'
            . '<col style="width:17%" /><col style="width:33%" /><col style="width:50%" /></colgroup><thead><tr>'
            . '<th>' . self::e($summaryText['tablePlanet']) . '</th>'
            . '<th>' . self::e($summaryText['tableDifficulties']) . '</th>'
            . '<th>' . self::e($summaryText['tableRemedies']) . '</th>'
            . '</tr></thead><tbody>' . $summaryCareRows . '</tbody></table>';
        // A chart with a placement the rule could not read must never look
        // "all clean": the page says so instead of implying a clear chart.
        if (empty($summary['assessmentComplete'])) {
            $summaryCareHtml .= '<div class="summary-empty summary-incomplete">'
                . self::e((string) ($summary['incompleteNote'] ?? $summaryText['assessmentIncomplete'])) . '</div>';
        }

        $summarySupportNames = [];
        foreach ($summary['supportive'] as $planet) {
            $summarySupportNames[] = $summaryPlanetNameRaw((string) $planet['key']);
        }
        $summaryCareNames = [];
        foreach ($summary['needsCare'] as $planet) {
            $summaryCareNames[] = $summaryPlanetNameRaw((string) $planet['key']);
        }
        // Pick the sentence form that stays grammatical when a side is empty.
        $summaryLeadTemplate = $summarySupportNames === []
            ? (string) $summaryText['summaryLeadNoSupport']
            : ($summaryCareNames === []
                ? (string) $summaryText['summaryLeadNoCare']
                : (string) $summaryText['summaryLead']);
        $summaryLead = str_replace(
            ['{supportive}', '{care}'],
            [implode(', ', $summarySupportNames), implode(', ', $summaryCareNames)],
            $summaryLeadTemplate
        );
        $summarySentences = implode(' ', array_values(array_filter(
            [
                $summaryLead,
                (string) $summaryText['summaryRemedy'],
                $isCompact ? (string) $summaryText['compactModeNote'] : ''
            ],
            static function ($part) {
                return trim((string) $part) !== '';
            }
        )));

        $page3Html = self::topHeader('ASTRO SIVAM', $summaryText['subtitle'], $orderNumber, 3, self::JATHAGAM_PAGE_TOTAL, $lang, '', true);
        $page3Html .= '<div class="summary-card">'
            . '<div class="summary-card-title">' . self::e($summaryText['detailsTitle']) . '</div>'
            . $summaryDetailsHtml . '</div>';
        // Lucky indicators (birth stone / colour / numbers) from the nakshatra
        // lord and the Chandra rasi lord — mirrored from
        // src/services/jathagamLuckyData.ts (Tamil Ratna Sastra convention).
        $luckyText = self::jathagamLuckyText($lang);
        $lucky = self::resolveJathagamLuckyIndicators(
            $result['janmaNakshatraIndex'] ?? ($result['nakshatram']['index'] ?? null),
            $chandraRasiNum,
            $lang
        );
        $luckyCell = static function (string $label, string $value): string {
            return '<td class="summary-cell lucky-cell">'
                . '<div class="summary-detail-label">' . self::e($label) . '</div>'
                . '<div class="summary-detail-value lucky-value">' . self::e($value) . '</div></td>';
        };
        $luckyRow = static function (string $head, string $sub, array $cells) use ($luckyCell): string {
            $html = '<div class="lucky-row-head">' . self::e($head)
                . ' <span class="lucky-row-sub">' . self::e($sub) . '</span></div>'
                . '<table class="summary-details lucky-grid"><tr>';
            foreach ($cells as $cell) {
                $html .= $luckyCell($cell[0], $cell[1]);
            }
            return $html . '</tr></table>';
        };
        $page3Html .= '<div class="summary-card lucky" id="summary-lucky">'
            . '<div class="summary-card-title lucky">' . self::e($luckyText['title']) . '</div>'
            . $luckyRow(
                $luckyText['nakshatraRow'],
                html_entity_decode($nakName, ENT_QUOTES, 'UTF-8') . ' · ' . $luckyText['lord'] . ': ' . $lucky['nakshatraLordName'],
                [
                    [$luckyText['birthStone'], $lucky['birthStone']],
                    [$luckyText['luckyColour'], $lucky['luckyColour']],
                    [$luckyText['luckyNumbers'], $lucky['luckyNumbers']],
                ]
            )
            . $luckyRow(
                $luckyText['rasiRow'],
                html_entity_decode($rasiName, ENT_QUOTES, 'UTF-8') . ' · ' . $luckyText['lord'] . ': ' . $lucky['rasiLordName'],
                [
                    [$luckyText['rasiStone'], $lucky['rasiStone']],
                    [$luckyText['rasiColour'], $lucky['rasiColour']],
                    [$luckyText['rasiNumber'], $lucky['rasiNumber']],
                ]
            )
            . '<p class="lucky-note">' . self::e($isCompact ? $luckyText['noteShort'] : $luckyText['note']) . '</p></div>';
        $page3Html .= '<div class="summary-card good">'
            . '<div class="summary-card-title good">' . self::e($summaryText['supportiveTitle']) . '</div>'
            . $summaryGoodHtml . '</div>';
        $page3Html .= '<div class="summary-card care">'
            . '<div class="summary-card-title care">' . self::e($summaryText['careTitle']) . '</div>'
            . $summaryCareHtml . '</div>';
        $page3Html .= '<div class="summary-card">'
            . '<div class="summary-card-title">' . self::e($summaryText['summaryTitle']) . '</div>'
            . '<p class="summary-short">' . self::e($summarySentences) . '</p>'
            . '<p class="summary-short">' . self::e($summaryText['dailyHabit']) . '</p></div>';
        $page3Html .= '<div class="summary-reassurance">' . self::e($summaryText['reassurance']) . '</div>';

        $css = self::sharedCss($lang) . self::birthSummaryCss();
        return '<!DOCTYPE html><html lang="' . self::e($lang) . '"><head><meta charset="UTF-8"><title>ASTRO SIVAM - Birth Jathagam Report</title><style>' . $css . '</style></head><body>'
            . '<div class="sheet">' . $page1Html . self::footerBand($lang) . '</div><pagebreak />'
            . '<div class="sheet">' . $page2Html . ($yogaNotesCardHtml ?? '') . self::footerBand($lang) . '</div><pagebreak />'
            . '<div class="sheet' . ($isCompact ? ' is-compact' : '') . '" id="birth-summary-sheet">' . $page3Html . self::footerBand($lang) . '</div>'
            . '</body></html>';
    }

    /**
     * Page-3-only styles for the Birth Jathagam Short Summary (mPDF).
     *
     * mPDF has no flexbox or grid, so the summary is laid out in tables, and
     * every rule stays local to #birth-summary-sheet so the other reports and
     * pages 1-2 are untouched. Text never drops below 10.5px - the readability
     * floor shared with the HTML builder and the jsPDF renderer - and that
     * floor includes the table's muted header line, so all three renderers
     * agree on the smallest size the Short Summary is allowed to use.
     *
     * Type sizes stay at the proven 3-page budget: mPDF cannot measure leftover
     * space the way fitJathagamSummaryText does in the browser, and enlarging
     * here spills a fourth physical page (Tamil/Hindi wrap). Compact mode
     * (5 to 9 flagged grahas) keeps the same 10.5px floor.
     */
    public static function birthSummaryCss(): string
    {
        return <<<CSS
    #birth-summary-sheet { padding: 5.5mm 7mm 5.5mm; }
    #birth-summary-sheet .summary-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.4mm 2mm; margin-bottom: 1.6mm; page-break-inside: avoid; }
    #birth-summary-sheet .summary-card-title { font-size: 14px; font-weight: bold; color: #7a1230; border-bottom: 0.6px solid #e5e7eb; padding-bottom: 0.5mm; margin-bottom: 1mm; }
    #birth-summary-sheet .summary-card.good { background: #f2fbf6; border-color: #bfe6d3; }
    #birth-summary-sheet .summary-card.care { background: #fffaf0; border-color: #f1d9a6; }
    #birth-summary-sheet .summary-card-title.good { color: #0f6b4a; border-bottom-color: #bfe6d3; }
    #birth-summary-sheet .summary-card-title.care { color: #92400e; border-bottom-color: #f1d9a6; }
    #birth-summary-sheet table.summary-details { width: 100%; border-collapse: separate; border-spacing: 0.8mm 0.8mm; table-layout: fixed; }
    #birth-summary-sheet table.summary-details td.summary-cell { background: #ffffff; border: 0.6px solid #e5e7eb; border-radius: 4px; padding: 0.7mm 1mm; vertical-align: top; }
    #birth-summary-sheet .summary-detail-label { font-size: 10.5px; color: #6b7280; line-height: 1.3; }
    #birth-summary-sheet .summary-detail-value { font-size: 11.5px; font-weight: bold; color: #1f2937; line-height: 1.35; word-wrap: break-word; }
    #birth-summary-sheet table.summary-good { width: 100%; border-collapse: separate; border-spacing: 0.8mm 0; table-layout: fixed; }
    #birth-summary-sheet td.summary-planet { background: #ffffff; border: 0.6px solid #bfe6d3; border-radius: 4px; padding: 0.8mm 1mm; vertical-align: top; }
    #birth-summary-sheet .summary-planet-name { font-size: 13px; font-weight: bold; color: #0f6b4a; line-height: 1.3; }
    #birth-summary-sheet .summary-planet-note { font-size: 11.5px; color: #1f2937; line-height: 1.45; }
    #birth-summary-sheet table.summary-care { width: 100%; border-collapse: collapse; table-layout: fixed; }
    #birth-summary-sheet table.summary-care th { background: #ffffff; color: #6b7280; font-size: 10.5px; font-weight: bold; text-align: left; border: 0.6px solid #f1d9a6; padding: 0.5mm 0.9mm; }
    #birth-summary-sheet table.summary-care td { border: 0.6px solid #f1d9a6; padding: 0.7mm 0.9mm; vertical-align: top; font-size: 11px; line-height: 1.45; color: #1f2937; word-wrap: break-word; }
    #birth-summary-sheet td.summary-care-planet { font-weight: bold; color: #7a1230; font-size: 13px; line-height: 1.3; }
    #birth-summary-sheet .summary-care-label { font-weight: bold; color: #92400e; }
    #birth-summary-sheet .summary-empty { color: #0f6b4a; font-size: 11.5px; font-weight: bold; line-height: 1.45; }
    #birth-summary-sheet .summary-care-compact { color: #1f2937; }
    #birth-summary-sheet .summary-incomplete { color: #92400e; font-size: 10.5px; line-height: 1.45; font-weight: normal; }
    #birth-summary-sheet .summary-short { font-size: 11.5px; line-height: 1.5; color: #1f2937; margin: 0; }
    #birth-summary-sheet .summary-short + .summary-short { margin-top: 0.6mm; }
    #birth-summary-sheet .summary-reassurance { background: #f8f9fb; border: 0.6px solid #e5e7eb; border-left: 2.5px solid #7a1230; border-radius: 4px; padding: 1mm 1.4mm; font-size: 11px; line-height: 1.5; color: #1f2937; }
    #birth-summary-sheet .summary-card.lucky { background: #fffbeb; border-color: #f3e0a6; }
    #birth-summary-sheet .summary-card-title.lucky { color: #8a5a00; border-bottom-color: #f3e0a6; }
    #birth-summary-sheet .lucky-row-head { font-size: 10.5px; font-weight: bold; color: #8a5a00; line-height: 1.35; margin-top: 0.6mm; }
    #birth-summary-sheet .lucky-row-sub { color: #6b7280; font-weight: normal; }
    #birth-summary-sheet table.lucky-grid td.lucky-cell { border-color: #f3e0a6; }
    #birth-summary-sheet .lucky-value { color: #7a1230; }
    #birth-summary-sheet .lucky-note { font-size: 10.5px; line-height: 1.4; color: #4b5563; margin: 0.6mm 0 0; }
    #birth-summary-sheet.is-compact .lucky-row-sub { display: none; }
    #birth-summary-sheet.is-compact .lucky-row-head { margin-top: 0.3mm; }
    #birth-summary-sheet.is-compact .summary-card { padding: 1.1mm 1.6mm; margin-bottom: 1.3mm; }
    #birth-summary-sheet.is-compact table.summary-care td { font-size: 10.5px; padding: 0.5mm 0.8mm; line-height: 1.4; }
    #birth-summary-sheet.is-compact .summary-detail-value { font-size: 11px; }
    #birth-summary-sheet.is-compact .summary-planet-note { font-size: 11px; }
    #birth-summary-sheet.is-compact .summary-short { font-size: 11px; line-height: 1.45; }
    #birth-summary-sheet.is-compact .summary-reassurance { font-size: 10.5px; line-height: 1.45; }
CSS;
    }

    /**
     * Lucky-indicator data for the Birth Jathagam page 3 — mirror of
     * src/services/jathagamLuckyData.ts. Every indicator belongs to a GRAHA:
     * the native receives it through the janma nakshatra lord (birth stone,
     * lucky colour, three lucky numbers) and the Chandra rasi lord (rasi
     * stone, rasi colour, rasi number). Tamil sources: Samayam Tamil (27
     * nakshatra lucky god/number/colour/stone; 27 nakshatra gems; graha
     * numbers), livingastro 27 நட்சத்திரக் குறிப்புகள், SwasthikTv 12 ராசி நிறங்கள்,
     * Zee News Tamil ராசிக்கு ஏற்ற ரத்தினம். Keep both copies in sync.
     */
    public static function jathagamLuckyProfiles(): array
    {
        return [
            'sun' => [
                'name' => ['en' => 'Surya (Sun)', 'ta' => 'சூரியன்', 'hi' => 'सूर्य'],
                'stone' => ['en' => 'Ruby (Manikkam)', 'ta' => 'மாணிக்கம்', 'hi' => 'माणिक्य (रूबी)'],
                'colour' => ['en' => 'Red', 'ta' => 'சிவப்பு', 'hi' => 'लाल'],
                'number' => 1, 'luckyNumbers' => [1, 5, 7],
            ],
            'moon' => [
                'name' => ['en' => 'Chandra (Moon)', 'ta' => 'சந்திரன்', 'hi' => 'चंद्र'],
                'stone' => ['en' => 'Pearl (Muthu)', 'ta' => 'முத்து', 'hi' => 'मोती'],
                'colour' => ['en' => 'White', 'ta' => 'வெள்ளை', 'hi' => 'सफ़ेद'],
                'number' => 2, 'luckyNumbers' => [2, 3, 9],
            ],
            'mars' => [
                'name' => ['en' => 'Chevvai (Mars)', 'ta' => 'செவ்வாய்', 'hi' => 'मंगल'],
                'stone' => ['en' => 'Red Coral (Pavalam)', 'ta' => 'பவளம்', 'hi' => 'मूंगा'],
                'colour' => ['en' => 'Light red / Pink', 'ta' => 'இளஞ்சிவப்பு', 'hi' => 'हल्का लाल / गुलाबी'],
                'number' => 9, 'luckyNumbers' => [3, 6, 9],
            ],
            'mercury' => [
                'name' => ['en' => 'Budha (Mercury)', 'ta' => 'புதன்', 'hi' => 'बुध'],
                'stone' => ['en' => 'Emerald (Maragatham)', 'ta' => 'மரகதம்', 'hi' => 'पन्ना'],
                'colour' => ['en' => 'Green', 'ta' => 'பச்சை', 'hi' => 'हरा'],
                'number' => 5, 'luckyNumbers' => [1, 5, 8],
            ],
            'jupiter' => [
                'name' => ['en' => 'Guru (Jupiter)', 'ta' => 'குரு', 'hi' => 'गुरु'],
                'stone' => ['en' => 'Yellow Sapphire (Pushparagam)', 'ta' => 'புஷ்பராகம்', 'hi' => 'पुखराज'],
                'colour' => ['en' => 'Yellow', 'ta' => 'மஞ்சள்', 'hi' => 'पीला'],
                'number' => 3, 'luckyNumbers' => [2, 3, 9],
            ],
            'venus' => [
                'name' => ['en' => 'Sukra (Venus)', 'ta' => 'சுக்கிரன்', 'hi' => 'शुक्र'],
                'stone' => ['en' => 'Diamond (Vairam)', 'ta' => 'வைரம்', 'hi' => 'हीरा'],
                'colour' => ['en' => 'White', 'ta' => 'வெள்ளை', 'hi' => 'सफ़ेद'],
                'number' => 6, 'luckyNumbers' => [3, 6, 8],
            ],
            'saturn' => [
                'name' => ['en' => 'Sani (Saturn)', 'ta' => 'சனி', 'hi' => 'शनि'],
                'stone' => ['en' => 'Blue Sapphire (Neelam)', 'ta' => 'நீலம்', 'hi' => 'नीलम'],
                'colour' => ['en' => 'Dark blue / Black', 'ta' => 'கருநீலம் / கருப்பு', 'hi' => 'गहरा नीला / काला'],
                'number' => 8, 'luckyNumbers' => [5, 6, 8],
            ],
            'rahu' => [
                'name' => ['en' => 'Rahu', 'ta' => 'ராகு', 'hi' => 'राहु'],
                'stone' => ['en' => 'Hessonite (Gomedhagam)', 'ta' => 'கோமேதகம்', 'hi' => 'गोमेद'],
                'colour' => ['en' => 'Black / Smoky', 'ta' => 'கருப்பு', 'hi' => 'काला / धुएँ जैसा'],
                'number' => 4, 'luckyNumbers' => [1, 4, 7],
            ],
            'ketu' => [
                'name' => ['en' => 'Ketu', 'ta' => 'கேது', 'hi' => 'केतु'],
                'stone' => ['en' => "Cat's Eye (Vaiduryam)", 'ta' => 'வைடூரியம்', 'hi' => 'लहसुनिया (वैदूर्य)'],
                'colour' => ['en' => 'Red with mixed colours', 'ta' => 'சிவப்பு கலந்த பல நிறங்கள்', 'hi' => 'लाल व मिश्रित रंग'],
                'number' => 7, 'luckyNumbers' => [5, 7, 9],
            ],
        ];
    }

    public static function jathagamLuckyText(string $lang): array
    {
        $all = [
            'en' => [
                'title' => 'Lucky Indicators — Birth Stone, Colour & Numbers',
                'nakshatraRow' => 'By Janma Nakshatra', 'rasiRow' => 'By Chandra Rasi', 'lord' => 'Lord',
                'birthStone' => 'Birth Stone', 'rasiStone' => 'Rasi Stone',
                'luckyColour' => 'Lucky Colour', 'rasiColour' => 'Rasi Colour',
                'luckyNumbers' => 'Lucky Numbers', 'rasiNumber' => 'Rasi Number',
                'note' => 'As per Tamil Ratna Sastra the stone, colour and numbers follow the nakshatra lord and the rasi lord. A gem should be worn only after a personal consultation; the colour and numbers can be used freely in daily life.',
                'noteShort' => 'Wear a gem only after a personal consultation; colour and numbers may be used freely.',
                'unavailable' => 'N/A',
            ],
            'ta' => [
                'title' => 'அதிர்ஷ்டக் குறிப்புகள் — ராசிக் கல், நிறம், எண்',
                'nakshatraRow' => 'ஜென்ம நட்சத்திரப்படி', 'rasiRow' => 'சந்திர ராசிப்படி', 'lord' => 'அதிபதி',
                'birthStone' => 'நட்சத்திரக் கல்', 'rasiStone' => 'ராசிக் கல்',
                'luckyColour' => 'அதிர்ஷ்ட நிறம்', 'rasiColour' => 'ராசி நிறம்',
                'luckyNumbers' => 'அதிர்ஷ்ட எண்கள்', 'rasiNumber' => 'ராசி எண்',
                'note' => 'தமிழ் ரத்ன சாஸ்திரப்படி கல், நிறம், எண் ஆகியவை நட்சத்திர அதிபதி மற்றும் ராசி அதிபதியைப் பொறுத்து அமைகின்றன. ரத்தினக் கல்லை தனிப்பட்ட ஆலோசனைக்குப் பின்னரே அணிய வேண்டும்; நிறத்தையும் எண்களையும் அன்றாட வாழ்வில் தாராளமாகப் பயன்படுத்தலாம்.',
                'noteShort' => 'ரத்தினக் கல்லை ஆலோசனைக்குப் பின்னரே அணியவும்; நிறம், எண்களைத் தாராளமாகப் பயன்படுத்தலாம்.',
                'unavailable' => 'கிடைக்கவில்லை',
            ],
            'hi' => [
                'title' => 'शुभ संकेत — जन्म रत्न, रंग व अंक',
                'nakshatraRow' => 'जन्म नक्षत्र के अनुसार', 'rasiRow' => 'चंद्र राशि के अनुसार', 'lord' => 'स्वामी',
                'birthStone' => 'जन्म रत्न', 'rasiStone' => 'राशि रत्न',
                'luckyColour' => 'शुभ रंग', 'rasiColour' => 'राशि रंग',
                'luckyNumbers' => 'शुभ अंक', 'rasiNumber' => 'राशि अंक',
                'note' => 'तमिल रत्न शास्त्र के अनुसार रत्न, रंग और अंक नक्षत्र स्वामी तथा राशि स्वामी से निर्धारित होते हैं। रत्न केवल व्यक्तिगत परामर्श के बाद ही धारण करें; रंग और अंक दैनिक जीवन में सहज रूप से अपनाए जा सकते हैं।',
                'noteShort' => 'रत्न केवल परामर्श के बाद धारण करें; रंग और अंक सहज रूप से अपनाएँ।',
                'unavailable' => 'उपलब्ध नहीं',
            ],
        ];
        return $all[$lang] ?? $all['en'];
    }

    /** Vimshottari nakshatra-lord cycle from Aswini (0-based index). */
    public static function jathagamNakshatraLord($index): ?string
    {
        if (!is_numeric($index)) return null;
        $n = (int) $index;
        if ((float) $index !== (float) $n || $n < 0 || $n > 26) return null;
        $cycle = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];
        return $cycle[$n % 9];
    }

    /** Rasi lord for a 1-based rasi number. */
    public static function jathagamRasiLordKey($rasi): ?string
    {
        if (!is_numeric($rasi)) return null;
        $n = (int) $rasi;
        if ((float) $rasi !== (float) $n || $n < 1 || $n > 12) return null;
        $lords = [1 => 'mars', 2 => 'venus', 3 => 'mercury', 4 => 'moon', 5 => 'sun', 6 => 'mercury',
            7 => 'venus', 8 => 'mars', 9 => 'jupiter', 10 => 'saturn', 11 => 'saturn', 12 => 'jupiter'];
        return $lords[$n];
    }

    /**
     * Resolve the page-3 lucky indicators. Unreadable inputs never fabricate a
     * stone — the language's "N/A" is printed instead (same rule as Node).
     */
    public static function resolveJathagamLuckyIndicators($janmaNakshatraIndex, $chandraRasi, string $lang): array
    {
        $text = self::jathagamLuckyText($lang);
        $profiles = self::jathagamLuckyProfiles();
        $nakLord = self::jathagamNakshatraLord($janmaNakshatraIndex);
        $rasiLord = self::jathagamRasiLordKey($chandraRasi);
        $nak = $nakLord !== null ? ($profiles[$nakLord] ?? null) : null;
        $rasi = $rasiLord !== null ? ($profiles[$rasiLord] ?? null) : null;
        $pick = static function ($record) use ($lang, $text): string {
            if (!is_array($record)) return (string) $text['unavailable'];
            return (string) ($record[$lang] ?? $record['en'] ?? $text['unavailable']);
        };
        return [
            'nakshatraLord' => $nakLord,
            'rasiLord' => $rasiLord,
            'nakshatraLordName' => $nak ? $pick($nak['name']) : (string) $text['unavailable'],
            'rasiLordName' => $rasi ? $pick($rasi['name']) : (string) $text['unavailable'],
            'birthStone' => $nak ? $pick($nak['stone']) : (string) $text['unavailable'],
            'luckyColour' => $nak ? $pick($nak['colour']) : (string) $text['unavailable'],
            'luckyNumbers' => $nak ? implode(', ', $nak['luckyNumbers']) : (string) $text['unavailable'],
            'rasiStone' => $rasi ? $pick($rasi['stone']) : (string) $text['unavailable'],
            'rasiColour' => $rasi ? $pick($rasi['colour']) : (string) $text['unavailable'],
            'rasiNumber' => $rasi ? (string) $rasi['number'] : (string) $text['unavailable'],
        ];
    }

    /**
     * English house ordinals: 1st / 2nd / 3rd - never "1th" / "2th" / "3th".
     */
    public static function houseOrdinalEn($n): string
    {
        $n = (int)$n;
        $map = [1 => '1st', 2 => '2nd', 3 => '3rd', 4 => '4th', 5 => '5th', 6 => '6th',
                7 => '7th', 8 => '8th', 9 => '9th', 10 => '10th', 11 => '11th', 12 => '12th'];
        return $map[$n] ?? ($n . 'th');
    }

    /**
     * Hindi house ordinals: the first three houses use their own words, so a
     * generic "वें" suffix would read wrong for भाव 1-3.
     */
    public static function houseOrdinalHi($n): string
    {
        $n = (int)$n;
        $map = [1 => 'पहले', 2 => 'दूसरे', 3 => 'तीसरे', 4 => 'चौथे', 5 => 'पांचवें', 6 => 'छठे',
                7 => 'सातवें', 8 => 'आठवें', 9 => 'नौवें', 10 => 'दसवें', 11 => 'ग्यारहवें', 12 => 'बारहवें'];
        return $map[$n] ?? ($n . 'वें');
    }

    /**
     * Render one bulleted list for the Navagraha guidance panel.
     *
     * mPDF has only partial support for CSS list markers, so the bullet is
     * emitted as a literal character inside a plain block element - that way
     * the browser preview and the mPDF output look identical.
     *
     * @param array<int, array{0: string, 1: string}> $items [heading, text] pairs
     */
    public static function navagrahaBullets(array $items): string
    {
        $html = '';
        foreach ($items as $item) {
            $html .= '<div class="navagraha-reason">&bull; <strong>'
                . self::e((string)($item[0] ?? '')) . ':</strong> '
                . self::e((string)($item[1] ?? '')) . '</div>';
        }
        return $html;
    }


    // =====================================================================
    // BIRTH JATHAGAM - PAGE 3 (SHORT SUMMARY)
    //
    // Generated by `npx tsx scripts/emit-php-summary.ts` from
    // src/services/jathagamDoshaData.ts and src/services/jathagamPlanetSummary.ts.
    // Do not hand-edit: regenerate instead, and re-run the parity fixture
    // (tests/fixtures/jathagam-summary-parity.json) on both stacks.
    //
    // The Short Summary is a plain-language readback of pages 1 and 2. Its
    // supportive / needs-care lists come from ONE named rule mirrored from
    // src/services/jathagamPlanetSummary.ts, and every remedy line reuses the
    // report's existing Navagraha material (deity, weekday, charity) plus the
    // additive lamp-oil and mantra fields. No second remedy system exists.
    // =====================================================================

    /**
     * Per-graha page-3 material. `name`/`deity`/`day`/`charity` are the
     * existing Navagraha reference entries; `lamp`/`mantra`/`donation`/
     * `support`/`difficulties` are the additive Short Summary fields.
     */
    public static function jathagamSummaryRemedyData(): array
    {
        return [
            'sun' => [
                'name' => [
                    'en' => 'Surya',
                    'ta' => 'சூரியன்',
                    'hi' => 'सूर्य',
                ],
                'deity' => [
                    'en' => 'Lord Surya, the Sun God',
                    'ta' => 'சூரிய பகவான்',
                    'hi' => 'भगवान सूर्य',
                ],
                'day' => [
                    'en' => 'Sunday',
                    'ta' => 'ஞாயிறு',
                    'hi' => 'रविवार',
                ],
                'charity' => [
                    'en' => 'Wheat, jaggery, red cloth or copper',
                    'ta' => 'கோதுமை, வெல்லம், சிவப்புத் துணி',
                    'hi' => 'गेहूँ, गुड़, लाल वस्त्र',
                ],
                'lamp' => [
                    'en' => 'Sesame oil lamp',
                    'ta' => 'நல்லெண்ணெய் விளக்கு',
                    'hi' => 'तिल के तेल का दीपक',
                ],
                'donation' => [
                    'en' => 'Wheat or jaggery',
                    'ta' => 'கோதுமை அல்லது வெல்லம்',
                    'hi' => 'गेहूँ या गुड़',
                ],
                'mantra' => [
                    'en' => 'Om Suryaya Namah',
                    'ta' => 'ஓம் சூரியாய நம:',
                    'hi' => 'ॐ सूर्याय नमः',
                ],
                'support' => [
                    'en' => 'Respect and recognition, a steady position',
                    'ta' => 'மரியாதை, அங்கீகாரம், நிலையான நிலை',
                    'hi' => 'सम्मान, पहचान और स्थिर स्थान',
                ],
                'difficulties' => [
                    'en' => 'Work pressure, ego clashes, distance from father or elders',
                    'ta' => 'வேலை அழுத்தம், தந்தை அல்லது முதியோரிடமிருந்து விலகல்',
                    'hi' => 'कार्यभार, पिता या बड़ों से दूरी',
                ]
            ],
            'moon' => [
                'name' => [
                    'en' => 'Chandra',
                    'ta' => 'சந்திரன்',
                    'hi' => 'चंद्र',
                ],
                'deity' => [
                    'en' => 'Lord Shiva',
                    'ta' => 'சிவபெருமான்',
                    'hi' => 'भगवान शिव',
                ],
                'day' => [
                    'en' => 'Monday',
                    'ta' => 'திங்கள்',
                    'hi' => 'सोमवार',
                ],
                'charity' => [
                    'en' => 'Rice, milk, sugar or white cloth',
                    'ta' => 'அரிசி, பால், சர்க்கரை, வெள்ளைத் துணி',
                    'hi' => 'चावल, दूध, चीनी या सफेद वस्त्र',
                ],
                'lamp' => [
                    'en' => 'Ghee lamp',
                    'ta' => 'நெய் விளக்கு',
                    'hi' => 'घी का दीपक',
                ],
                'donation' => [
                    'en' => 'Rice or milk',
                    'ta' => 'அரிசி அல்லது பால்',
                    'hi' => 'चावल या दूध',
                ],
                'mantra' => [
                    'en' => 'Om Chandraya Namah',
                    'ta' => 'ஓம் சந்திராய நம:',
                    'hi' => 'ॐ चन्द्राय नमः',
                ],
                'support' => [
                    'en' => 'Calm mind, family happiness, care for others',
                    'ta' => 'அமைதியான மனம், குடும்ப மகிழ்ச்சி, பிறரைக் கவனிக்கும் தன்மை',
                    'hi' => 'शांत मन, पारिवारिक सुख और परवाह करने का भाव',
                ],
                'difficulties' => [
                    'en' => 'Worry, mood swings, disturbed sleep',
                    'ta' => 'கவலை, மன ஏற்ற இறக்கம், தூக்கமின்மை',
                    'hi' => 'चिंता, मन का उतार-चढ़ाव, नींद की गड़बड़ी',
                ]
            ],
            'mars' => [
                'name' => [
                    'en' => 'Mangal',
                    'ta' => 'செவ்வாய்',
                    'hi' => 'मंगल',
                ],
                'deity' => [
                    'en' => 'Lord Murugan (Karthikeya) or Lord Hanuman',
                    'ta' => 'முருகன் (கார்த்திகேயன்) அல்லது அனுமன்',
                    'hi' => 'भगवान कार्तिकेय या हनुमान जी',
                ],
                'day' => [
                    'en' => 'Tuesday',
                    'ta' => 'செவ்வாய்',
                    'hi' => 'मंगलवार',
                ],
                'charity' => [
                    'en' => 'Red lentils, jaggery or red cloth',
                    'ta' => 'சிவப்புப் பயறு, வெல்லம், சிவப்புத் துணி',
                    'hi' => 'लाल दाल, गुड़ या लाल वस्त्र',
                ],
                'lamp' => [
                    'en' => 'Sesame oil lamp',
                    'ta' => 'நல்லெண்ணெய் விளக்கு',
                    'hi' => 'तिल के तेल का दीपक',
                ],
                'donation' => [
                    'en' => 'Toor dal or jaggery',
                    'ta' => 'துவரம் பருப்பு அல்லது வெல்லம்',
                    'hi' => 'अरहर दाल या गुड़',
                ],
                'mantra' => [
                    'en' => 'Om Angarakaya Namah',
                    'ta' => 'ஓம் அங்காரகாய நம:',
                    'hi' => 'ॐ अंगारकाय नमः',
                ],
                'support' => [
                    'en' => 'Courage, hard work, property and siblings',
                    'ta' => 'தைரியம், கடின உழைப்பு, சொத்து, சகோதர உறவு',
                    'hi' => 'साहस, परिश्रम, संपत्ति और भाई-बहन',
                ],
                'difficulties' => [
                    'en' => 'Anger, hasty decisions, delays in marriage',
                    'ta' => 'கோபம், அவசர முடிவுகள், திருமணத் தாமதம்',
                    'hi' => 'क्रोध, जल्दबाज़ी के निर्णय, विवाह में देरी',
                ]
            ],
            'mercury' => [
                'name' => [
                    'en' => 'Budha',
                    'ta' => 'புதன்',
                    'hi' => 'बुध',
                ],
                'deity' => [
                    'en' => 'Lord Vishnu or Lord Ganesha',
                    'ta' => 'மகா விஷ்ணு அல்லது விநாயகர்',
                    'hi' => 'भगवान विष्णु या भगवान गणेश',
                ],
                'day' => [
                    'en' => 'Wednesday',
                    'ta' => 'புதன்',
                    'hi' => 'बुधवार',
                ],
                'charity' => [
                    'en' => 'Green gram (mung beans), green cloth or books',
                    'ta' => 'பச்சைப் பயறு, பச்சைத் துணி, நூல்கள்',
                    'hi' => 'हरी मूँग, हरा वस्त्र या पुस्तकें',
                ],
                'lamp' => [
                    'en' => 'Ghee lamp',
                    'ta' => 'நெய் விளக்கு',
                    'hi' => 'घी का दीपक',
                ],
                'donation' => [
                    'en' => 'Green gram',
                    'ta' => 'பச்சைப் பயறு',
                    'hi' => 'हरी मूँग',
                ],
                'mantra' => [
                    'en' => 'Om Budhaya Namah',
                    'ta' => 'ஓம் புதாய நம:',
                    'hi' => 'ॐ बुधाय नमः',
                ],
                'support' => [
                    'en' => 'Education, speech, business sense',
                    'ta' => 'கல்வி, பேச்சுத் திறன், வியாபார நுண்ணறிவு',
                    'hi' => 'शिक्षा, वाणी और व्यापार की समझ',
                ],
                'difficulties' => [
                    'en' => 'Confusion in decisions, speech issues, delay in studies',
                    'ta' => 'முடிவில் குழப்பம், பேச்சுப் பிரச்சினை, கல்வித் தாமதம்',
                    'hi' => 'निर्णय में उलझन, वाणी की समस्या, पढ़ाई में विलंब',
                ]
            ],
            'jupiter' => [
                'name' => [
                    'en' => 'Guru',
                    'ta' => 'குரு',
                    'hi' => 'गुरु',
                ],
                'deity' => [
                    'en' => 'Lord Brihaspati or Lord Dakshinamurthy',
                    'ta' => 'குரு பகவான் அல்லது தட்சிணாமூர்த்தி',
                    'hi' => 'भगवान बृहस्पति या दक्षिणामूर्ति',
                ],
                'day' => [
                    'en' => 'Thursday',
                    'ta' => 'வியாழன்',
                    'hi' => 'गुरुवार',
                ],
                'charity' => [
                    'en' => 'Chickpeas, turmeric, bananas, yellow cloth or books',
                    'ta' => 'கொண்டைக்கடலை, மஞ்சள், வாழைப்பழம், மஞ்சள் துணி',
                    'hi' => 'चना, हल्दी, केले, पीला वस्त्र',
                ],
                'lamp' => [
                    'en' => 'Ghee lamp',
                    'ta' => 'நெய் விளக்கு',
                    'hi' => 'घी का दीपक',
                ],
                'donation' => [
                    'en' => 'Chickpeas or turmeric',
                    'ta' => 'கொண்டைக்கடலை அல்லது மஞ்சள்',
                    'hi' => 'चना या हल्दी',
                ],
                'mantra' => [
                    'en' => 'Om Gurave Namah',
                    'ta' => 'ஓம் குரவே நம:',
                    'hi' => 'ॐ गुरवे नमः',
                ],
                'support' => [
                    'en' => 'Wisdom, good guidance, children and growth',
                    'ta' => 'ஞானம், நல்ல வழிகாட்டல், பிள்ளை பேறு, வளர்ச்சி',
                    'hi' => 'बुद्धि, अच्छा मार्गदर्शन, संतान और विकास',
                ],
                'difficulties' => [
                    'en' => 'Missed guidance, unwanted expenses, delay in good things',
                    'ta' => 'வழிகாட்டல் தவறுதல், தேவையற்ற செலவு, நல்லவை தாமதம்',
                    'hi' => 'मार्गदर्शन की कमी, अनावश्यक खर्च, शुभ कार्यों में देरी',
                ]
            ],
            'venus' => [
                'name' => [
                    'en' => 'Sukra',
                    'ta' => 'சுக்கிரன்',
                    'hi' => 'शुक्र',
                ],
                'deity' => [
                    'en' => 'Goddess Maha Lakshmi',
                    'ta' => 'மகா லட்சுமி',
                    'hi' => 'माँ महालक्ष्मी',
                ],
                'day' => [
                    'en' => 'Friday',
                    'ta' => 'வெள்ளி',
                    'hi' => 'शुक्रवार',
                ],
                'charity' => [
                    'en' => 'Rice, yoghurt, white sweets or white cloth',
                    'ta' => 'அரிசி, தயிர், வெள்ளை இனிப்பு, வெள்ளைத் துணி',
                    'hi' => 'चावल, दही, सफेद मिठाई या सफेद वस्त्र',
                ],
                'lamp' => [
                    'en' => 'Ghee lamp',
                    'ta' => 'நெய் விளக்கு',
                    'hi' => 'घी का दीपक',
                ],
                'donation' => [
                    'en' => 'Rice or white sweets',
                    'ta' => 'அரிசி அல்லது வெள்ளை இனிப்பு',
                    'hi' => 'चावल या सफेद मिठाई',
                ],
                'mantra' => [
                    'en' => 'Om Shukraya Namah',
                    'ta' => 'ஓம் சுக்கிராய நம:',
                    'hi' => 'ॐ शुक्राय नमः',
                ],
                'support' => [
                    'en' => 'Comfort, good relationships, art and beauty',
                    'ta' => 'வசதி, நல்ல உறவு, கலை மற்றும் அழகு',
                    'hi' => 'सुख-सुविधा, अच्छे संबंध, कला और सौंदर्य',
                ],
                'difficulties' => [
                    'en' => 'Family misunderstandings, money waste, health of spouse',
                    'ta' => 'குடும்பத் தவறான புரிதல், பண விரயம், துணைவர் உடல்நலம்',
                    'hi' => 'पारिवारिक गलतफहमी, धन की बर्बादी, जीवनसाथी का स्वास्थ्य',
                ]
            ],
            'saturn' => [
                'name' => [
                    'en' => 'Sani',
                    'ta' => 'சனி',
                    'hi' => 'शनि',
                ],
                'deity' => [
                    'en' => 'Lord Shani or Lord Hanuman',
                    'ta' => 'சனி பகவான் அல்லது அனுமன்',
                    'hi' => 'भगवान शनि या हनुमान जी',
                ],
                'day' => [
                    'en' => 'Saturday',
                    'ta' => 'சனி',
                    'hi' => 'शनिवार',
                ],
                'charity' => [
                    'en' => 'Black sesame seeds, sesame oil (nallennai), iron, black cloth or warm blankets',
                    'ta' => 'கருப்பு எள்ளு, நல்லெண்ணெய், இரும்பு, போர்வைகள்',
                    'hi' => 'काले तिल, तिल का तेल, लोहा, कंबल',
                ],
                'lamp' => [
                    'en' => 'Sesame oil lamp',
                    'ta' => 'நல்லெண்ணெய் விளக்கு',
                    'hi' => 'तिल के तेल का दीपक',
                ],
                'donation' => [
                    'en' => 'Black sesame or iron',
                    'ta' => 'கருப்பு எள்ளு அல்லது இரும்பு',
                    'hi' => 'काले तिल या लोहा',
                ],
                'mantra' => [
                    'en' => 'Om Shanaye Namah',
                    'ta' => 'ஓம் சனைச்சராய நம:',
                    'hi' => 'ॐ शनैश्चराय नमः',
                ],
                'support' => [
                    'en' => 'Discipline, long-term success, service to others',
                    'ta' => 'ஒழுக்கம், நீண்டகால வெற்றி, சேவை உணர்வு',
                    'hi' => 'अनुशासन, दीर्घकालिक सफलता, सेवा का भाव',
                ],
                'difficulties' => [
                    'en' => 'Slow progress, worry about money, misunderstandings',
                    'ta' => 'மெதுவான முன்னேற்றம், பணக் கவலை, தவறான புரிதல்கள்',
                    'hi' => 'धीमी प्रगति, धन की चिंता, गलतफहमियाँ',
                ]
            ],
            'rahu' => [
                'name' => [
                    'en' => 'Rahu',
                    'ta' => 'ராகு',
                    'hi' => 'राहु',
                ],
                'deity' => [
                    'en' => 'Goddess Durga or Lord Bhairava',
                    'ta' => 'துர்க்கை அல்லது பைரவர்',
                    'hi' => 'माँ दुर्गा या भगवान भैरव',
                ],
                'day' => [
                    'en' => 'Saturday',
                    'ta' => 'சனி',
                    'hi' => 'शनिवार',
                ],
                'charity' => [
                    'en' => 'Black gram, coconut, sesame seeds or warm blankets',
                    'ta' => 'கருப்பு உளுந்து, தேங்காய், எள், போர்வைகள்',
                    'hi' => 'काला उड़द, नारियल, तिल के बीज, कंबल',
                ],
                'lamp' => [
                    'en' => 'Sesame oil lamp',
                    'ta' => 'நல்லெண்ணெய் விளக்கு',
                    'hi' => 'तिल के तेल का दीपक',
                ],
                'donation' => [
                    'en' => 'Black gram or coconut',
                    'ta' => 'கருப்பு உளுந்து அல்லது தேங்காய்',
                    'hi' => 'काला उड़द या नारियल',
                ],
                'mantra' => [
                    'en' => 'Om Rahave Namah',
                    'ta' => 'ஓம் ராஹவே நம:',
                    'hi' => 'ॐ राहवे नमः',
                ],
                'support' => [
                    'en' => 'Courage to try new things, foreign links',
                    'ta' => 'புதிய முயற்சிகளுக்குத் தைரியம், வெளிநாட்டுத் தொடர்பு',
                    'hi' => 'नए प्रयासों का साहस, विदेश से जुड़ाव',
                ],
                'difficulties' => [
                    'en' => 'Confusion, greed, unwanted changes',
                    'ta' => 'குழப்பம், பேராசை, தேவையற்ற மாற்றங்கள்',
                    'hi' => 'भ्रम, लोभ, अनावश्यक बदलाव',
                ]
            ],
            'ketu' => [
                'name' => [
                    'en' => 'Ketu',
                    'ta' => 'கேது',
                    'hi' => 'केतु',
                ],
                'deity' => [
                    'en' => 'Lord Ganesha',
                    'ta' => 'விநாயகர்',
                    'hi' => 'भगवान गणेश',
                ],
                'day' => [
                    'en' => 'Tuesday or Saturday',
                    'ta' => 'செவ்வாய் அல்லது சனி',
                    'hi' => 'मंगलवार या शनिवार',
                ],
                'charity' => [
                    'en' => 'Sesame seeds, horse gram or warm blankets',
                    'ta' => 'எள்ளு, கொள்ளு, போர்வைகள்',
                    'hi' => 'तिल, कुल्थी, कंबल',
                ],
                'lamp' => [
                    'en' => 'Ghee lamp',
                    'ta' => 'நெய் விளக்கு',
                    'hi' => 'घी का दीपक',
                ],
                'donation' => [
                    'en' => 'Horse gram or sesame',
                    'ta' => 'கொள்ளு அல்லது எள்ளு',
                    'hi' => 'कुल्थी या तिल',
                ],
                'mantra' => [
                    'en' => 'Om Ketave Namah',
                    'ta' => 'ஓம் கேதவே நம:',
                    'hi' => 'ॐ केतवे नमः',
                ],
                'support' => [
                    'en' => 'Detachment, spiritual growth, deep insight',
                    'ta' => 'பற்றின்மை, ஆன்மிக வளர்ச்சி, ஆழ்ந்த உணர்வு',
                    'hi' => 'वैराग्य, आध्यात्मिक विकास, गहरी समझ',
                ],
                'difficulties' => [
                    'en' => 'Sudden doubts, loneliness, health of ancestors',
                    'ta' => 'திடீர் சந்தேகம், தனிமை, முன்னோர் உடல்நலம்',
                    'hi' => 'अचानक संदेह, अकेलापन, पितरों का स्वास्थ्य',
                ]
            ],
        ];
    }

    /**
     * Every fixed page-3 string, three languages. The renderer selects `$lang`,
     * so a missing translation cannot silently fall back.
     */
    public static function jathagamSummaryText(string $lang): array
    {
        $lang = in_array($lang, ['en', 'ta', 'hi'], true) ? $lang : 'en';
        $text = [
            'subtitle' => [
                'en' => 'Birth Chart Summary - Simple Explanation',
                'ta' => 'ஜாதக சுருக்கம் - எளிய விளக்கம்',
                'hi' => 'जन्म कुंडली सारांश - सरल व्याख्या',
            ],
            'detailsTitle' => [
                'en' => 'Your Details',
                'ta' => 'உங்கள் விவரங்கள்',
                'hi' => 'आपका विवरण',
            ],
            'supportiveTitle' => [
                'en' => 'Planets Supporting You',
                'ta' => 'உங்களுக்கு ஆதரவாக இருக்கும் கிரகங்கள்',
                'hi' => 'आपके सहायक ग्रह',
            ],
            'careTitle' => [
                'en' => 'Planets Needing Extra Care',
                'ta' => 'கூடுதல் கவனம் தேவையான கிரகங்கள்',
                'hi' => 'विशेष ध्यान देने योग्य ग्रह',
            ],
            'summaryTitle' => [
                'en' => 'In Short',
                'ta' => 'சுருக்கமாக',
                'hi' => 'संक्षेप में',
            ],
            'tablePlanet' => [
                'en' => 'Planet',
                'ta' => 'கிரகம்',
                'hi' => 'ग्रह',
            ],
            'tableDifficulties' => [
                'en' => 'Possible difficulties',
                'ta' => 'சாத்தியமான கஷ்டங்கள்',
                'hi' => 'संभावित कठिनाइयाँ',
            ],
            'tableRemedies' => [
                'en' => 'Remedies',
                'ta' => 'பரிகாரங்கள்',
                'hi' => 'उपाय',
            ],
            'noCarePlanet' => [
                'en' => 'No planet is flagged in your chart',
                'ta' => 'எந்தக் கிரகமும் கவனம் தேவை என்று குறிக்கப்படவில்லை',
                'hi' => 'आपकी कुंडली में किसी ग्रह पर विशेष ध्यान का संकेत नहीं है',
            ],
            'noSupportPlanet' => [
                'en' => 'No single planet stands out as specially supportive in this chart',
                'ta' => 'இந்த ஜாதகத்தில் சிறப்பாக ஆதரவாக இருக்கும் ஒரு கிரகம் தனியாக இல்லை',
                'hi' => 'इस कुंडली में कोई एक ग्रह विशेष रूप से सहायक के रूप में सामने नहीं आता',
            ],
            'assessmentIncomplete' => [
                'en' => 'Dosha assessment is incomplete (N/A) because required planetary placements are unavailable; no remedy or clean-status conclusion is inferred.',
                'ta' => 'தேவையான கிரக நிலை கிடைக்காததால் தோஷ மதிப்பீடு முழுமையில்லை (N/A); பரிகாரம் அல்லது இல்லாமை குறித்து முடிவு செய்யப்படவில்லை.',
                'hi' => 'आवश्यक ग्रह स्थिति उपलब्ध न होने से दोष-मूल्यांकन अधूरा है (N/A); उपाय या दोष-रहित होने का निष्कर्ष नहीं निकाला गया।',
            ],
            'reassurance' => [
                'en' => 'No planet is "bad". This is guidance, not a reason for fear. For decisions about health, money or law, please also consult a qualified professional.',
                'ta' => 'எந்த கிரகமும் \'கெட்டது\' அல்ல. இது பயப்படுவதற்காக அல்ல, வழிகாட்டுதலுக்காக மட்டுமே. உடல்நலம், பணம், சட்டம் தொடர்பான முடிவுகளுக்கு தகுந்த நிபுணரையும் அணுகுங்கள்.',
                'hi' => 'कोई भी ग्रह "बुरा" नहीं होता। यह डरने के लिए नहीं, मार्गदर्शन के लिए है। स्वास्थ्य, धन या कानून से जुड़े निर्णयों के लिए योग्य विशेषज्ञ से भी परामर्श करें।',
            ],
            'summaryLead' => [
                'en' => 'In your chart, {supportive} support you, while {care} need extra care.',
                'ta' => 'உங்கள் ஜாதகத்தில் {supportive} ஆதரவாக உள்ளன; {care} கூடுதல் கவனம் தேவை.',
                'hi' => 'आपकी कुंडली में {supportive} सहायक हैं, {care} को विशेष ध्यान चाहिए।',
            ],
            'summaryLeadNoSupport' => [
                'en' => 'In your chart, no single planet stands out as specially supportive, while {care} need extra care.',
                'ta' => 'உங்கள் ஜாதகத்தில் சிறப்பாக ஆதரவாக இருக்கும் கிரகம் தனியாக இல்லை; {care} கூடுதல் கவனம் தேவை.',
                'hi' => 'आपकी कुंडली में कोई एक ग्रह विशेष रूप से सहायक सामने नहीं आता, जबकि {care} को विशेष ध्यान चाहिए।',
            ],
            'summaryLeadNoCare' => [
                'en' => 'In your chart, {supportive} support you, and no planet needs extra care.',
                'ta' => 'உங்கள் ஜாதகத்தில் {supportive} ஆதரவாக உள்ளன; எந்தக் கிரகத்திற்கும் கூடுதல் கவனம் தேவையில்லை.',
                'hi' => 'आपकी कुंडली में {supportive} सहायक हैं, और किसी ग्रह को विशेष ध्यान की आवश्यकता नहीं है।',
            ],
            'summaryRemedy' => [
                'en' => 'The remedies are simple and can be done at home; chant the mantra 11 times with faith.',
                'ta' => 'பரிகாரங்கள் எளிமையானவை; மந்திரத்தை 11 முறை நம்பிக்கையுடன் சொல்லுங்கள்.',
                'hi' => 'उपाय सरल हैं; मंत्र को 11 बार श्रद्धा से जपें।',
            ],
            'summaryFaith' => [
                'en' => '',
                'ta' => '',
                'hi' => '',
            ],
            'dailyHabit' => [
                'en' => 'Every day: five minutes of morning prayer, respect elders, and help those in need.',
                'ta' => 'தினமும்: காலையில் ஐந்து நிமிட பிரார்த்தனை, மூத்தோரை மதித்தல், தேவைப்படுவோருக்கு உதவுதல்.',
                'hi' => 'प्रतिदिन: सुबह पाँच मिनट प्रार्थना, बड़ों का सम्मान, और ज़रूरतमंदों की सहायता.',
            ],
            'compactModeNote' => [
                'en' => '',
                'ta' => 'தினமும் ஒரு விளக்கு ஏற்றி, கிரகத்தின் பெயரைச் சொல்லி வணங்குங்கள்.',
                'hi' => 'प्रतिदिन एक दीपक जलाएँ और ग्रह का नाम लेकर प्रार्थना करें।',
            ],
        ];
        $labels = [
            'worship' => [
                'en' => 'Worship',
                'ta' => 'வழிபாடு',
                'hi' => 'पूजा',
            ],
            'lamp' => [
                'en' => 'Lamp',
                'ta' => 'தீபம்',
                'hi' => 'दीपक',
            ],
            'donation' => [
                'en' => 'Donation',
                'ta' => 'தானம்',
                'hi' => 'दान',
            ],
            'mantra' => [
                'en' => 'Mantra',
                'ta' => 'மந்திரம்',
                'hi' => 'मंत्र',
            ],
        ];
        $outText = [];
        foreach ($text as $key => $values) { $outText[$key] = $values[$lang] ?? ''; }
        $outLabels = [];
        foreach ($labels as $key => $values) { $outLabels[$key] = $values[$lang] ?? ''; }
        return ['text' => $outText, 'labels' => $outLabels];
    }

    /**
     * The ONE Birth Jathagam page-3 rule, mirrored statement-for-statement
     * from src/services/jathagamPlanetSummary.ts::classifyJathagamPlanetsForSummary().
     *
     * Same dignity tables (src/lib/astrology/dignity.ts == AstroEngine::planetDignityTable()),
     * same houses, same 10-degree conjunction orb, same scoring, same ordering.
     * tests/fixtures/jathagam-summary-parity.json holds the outputs both stacks
     * must reproduce.
     *
     * @return array{supportive: list<array{key: string, house: ?int, support: string}>,
     *               needsCare: list<array<string, mixed>>, compact: bool,
     *               assessedCount: int, assessmentComplete: bool, incompleteNote: string}
     */
    public static function classifyJathagamPlanetsForSummary($result, string $lang): array
    {
        $lang = in_array($lang, ['en', 'ta', 'hi'], true) ? $lang : 'en';
        $data = self::jathagamSummaryRemedyData();
        $summaryText = self::jathagamSummaryText($lang);

        // Classical dignity tables, value-for-value with src/lib/astrology/dignity.ts.
        $signLords = [1 => 'mars', 2 => 'venus', 3 => 'mercury', 4 => 'moon', 5 => 'sun', 6 => 'mercury', 7 => 'venus', 8 => 'mars', 9 => 'jupiter', 10 => 'saturn', 11 => 'saturn', 12 => 'jupiter'];
        $exaltationSign = ['sun' => 1, 'moon' => 2, 'mars' => 10, 'mercury' => 6, 'jupiter' => 4, 'venus' => 12, 'saturn' => 7];
        $ownSigns = ['sun' => [5], 'moon' => [4], 'mars' => [1, 8], 'mercury' => [3, 6], 'jupiter' => [9, 12], 'venus' => [2, 7], 'saturn' => [10, 11]];
        $signExaltedBy = [1 => 'sun', 2 => 'moon', 4 => 'jupiter', 6 => 'mercury', 7 => 'saturn', 10 => 'mars', 12 => 'venus'];
        $challengingHouses = [6, 8, 12];
        $supportiveHouses = [1, 4, 5, 7, 9, 10, 11];
        $lordSupportiveHouses = [1, 2, 4, 5, 7, 9, 10, 11];
        $malefics = ['mars', 'saturn', 'rahu', 'ketu'];
        $nodeDebilitation = ['rahu' => 8, 'ketu' => 2];
        $conjunctionOrb = 10;
        $supportiveLimit = 3;
        $compactThreshold = 5;

        $validRasi = static function ($value): bool {
            return $value !== null && $value !== '' && is_numeric($value)
                && (float) $value == (int) $value && (int) $value >= 1 && (int) $value <= 12;
        };

        $positions = [];
        foreach ((array) ($result['planetPositions'] ?? []) as $position) {
            if (!is_array($position) || !isset($position['graha'], $position['rasi'])) continue;
            $key = (string) $position['graha'];
            if (!isset($data[$key]) || !$validRasi($position['rasi'])) continue;
            $positions[] = $position;
        }
        $lagnaRasi = $validRasi($result['lagnaRasi'] ?? null) ? (int) $result['lagnaRasi'] : null;
        $lagnaLord = $lagnaRasi === null ? null : ($signLords[$lagnaRasi] ?? null);

        // Neecha Bhanga, as dignity.ts defines it: the graha exalted in the
        // occupied sign, or the dispositor, conjunct the graha or in a kendra.
        $neechaBhangaHolds = static function (string $graha, int $rasi) use ($lagnaRasi, $positions, $signExaltedBy, $signLords): bool {
            if ($lagnaRasi === null) return false;
            $rasiByGraha = [];
            foreach ($positions as $p) { $rasiByGraha[(string) $p['graha']] = (int) $p['rasi']; }
            $kendra = [1, 4, 7, 10];
            $houseFrom = static function (int $target, int $reference): int {
                return (($target - $reference + 12) % 12) + 1;
            };
            $exaltationGraha = $signExaltedBy[$rasi] ?? null;
            if ($exaltationGraha !== null && isset($rasiByGraha[$exaltationGraha])) {
                if ($exaltationGraha !== $graha && $rasiByGraha[$exaltationGraha] === $rasi) return true;
                if (in_array($houseFrom($rasiByGraha[$exaltationGraha], $lagnaRasi), $kendra, true)) return true;
            }
            $dispositor = $signLords[$rasi] ?? null;
            if ($dispositor !== null && $dispositor !== $graha && isset($rasiByGraha[$dispositor])) {
                if (in_array($houseFrom($rasiByGraha[$dispositor], $lagnaRasi), $kendra, true)) return true;
            }
            return false;
        };

        $supportive = [];
        $needsCare = [];
        $orderIndex = array_flip(['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu']);

        foreach (['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as $key) {
            $position = null;
            foreach ($positions as $p) { if ((string) $p['graha'] === $key) { $position = $p; break; } }
            if ($position === null) continue;
            $rasi = (int) $position['rasi'];
            $house = isset($position['bhavaNumber']) && $validRasi($position['bhavaNumber']) ? (int) $position['bhavaNumber'] : null;

            $classicalDebilitation = isset($exaltationSign[$key]) ? (($exaltationSign[$key] - 1 + 6) % 12) + 1 : null;
            $nodeDebilitationSign = $nodeDebilitation[$key] ?? null;
            $isDebilitated = $classicalDebilitation === $rasi || $nodeDebilitationSign === $rasi;
            $isExalted = ($exaltationSign[$key] ?? null) === $rasi;
            $isOwnSign = in_array($rasi, $ownSigns[$key] ?? [], true);
            $isChallengingHouse = $house !== null && in_array($house, $challengingHouses, true);
            $conjunctMalefic = false;
            foreach ($positions as $other) {
                $otherKey = (string) $other['graha'];
                if ($otherKey === $key || !in_array($otherKey, $malefics, true)) continue;
                if ($house === null || !isset($other['bhavaNumber']) || !$validRasi($other['bhavaNumber'])) continue;
                if ((int) $other['bhavaNumber'] !== $house) continue;
                $a = isset($position['degrees']) && is_numeric($position['degrees']) ? (float) $position['degrees'] : null;
                $b = isset($other['degrees']) && is_numeric($other['degrees']) ? (float) $other['degrees'] : null;
                if ($a === null || $b === null) { $conjunctMalefic = true; break; } // same house, no degrees: classical reading
                $separation = abs($a - $b);
                if (min($separation, 30 - $separation) <= $conjunctionOrb) { $conjunctMalefic = true; break; }
            }
            $isCombust = !empty($position['isCombust']) && !$isExalted && !$isOwnSign;
            $isSupportiveHouse = $house !== null && in_array($house, $supportiveHouses, true);
            $isLagnaLord = $lagnaLord !== null && $lagnaLord === $key;
            $lordInSupportiveHouse = $isLagnaLord && $house !== null && in_array($house, $lordSupportiveHouses, true);
            $neechaBhangaApplies = ($isDebilitated && $classicalDebilitation !== null)
                ? $neechaBhangaHolds($key, $rasi)
                : false;

            $careScore = 0;
            if ($isDebilitated) { $careScore += $neechaBhangaApplies ? 1 : 2; }
            if ($isCombust) { $careScore += 1; }
            if ($isChallengingHouse) { $careScore += 1; }
            if ($conjunctMalefic) { $careScore += 1; }
            if ($isLagnaLord && $isChallengingHouse) { $careScore += 1; }

            $supportScore = 0;
            if ($isExalted) { $supportScore += 3; }
            if ($isOwnSign) { $supportScore += 2; }
            if ($lordInSupportiveHouse) { $supportScore += 2; }
            if ($isSupportiveHouse) { $supportScore += 1; }

            if ($careScore > 0) {
                $worship = $data[$key]['deity'][$lang] . ' · ' . $data[$key]['day'][$lang];
                $lamp = (string) ($data[$key]['lamp'][$lang] ?? '');
                $donation = (string) ($data[$key]['donation'][$lang] ?? '');
                $mantra = (string) ($data[$key]['mantra'][$lang] ?? '');
                $compactParts = [explode(' · ', $worship)[0], $data[$key]['day'][$lang], $lamp, $donation, $mantra];
                $compactParts = array_values(array_filter($compactParts, static function ($part) { return trim((string) $part) !== ''; }));
                $needsCare[] = [
                    'key' => $key,
                    'house' => $house,
                    'score' => $careScore,
                    'difficulties' => (string) ($data[$key]['difficulties'][$lang] ?? ''),
                    'worship' => $worship,
                    'lamp' => $lamp,
                    'donation' => $donation,
                    'mantra' => $mantra,
                    'compactLine' => implode(' · ', $compactParts)
                ];
                continue;
            }

            if ($supportScore > 0) {
                $supportive[] = ['key' => $key, 'house' => $house, 'score' => $supportScore];
            }
        }

        $assessedCount = 0;
        foreach (['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as $key) {
            foreach ($positions as $p) { if ((string) $p['graha'] === $key) { $assessedCount++; break; } }
        }
        $assessmentComplete = $assessedCount >= count(['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu']);

        $sortScoreFirst = static function (array $a, array $b) use ($orderIndex): int {
            return $b['score'] - $a['score'] ?: $orderIndex[$a['key']] - $orderIndex[$b['key']];
        };
        usort($needsCare, $sortScoreFirst);
        usort($supportive, $sortScoreFirst);

        $supportiveOut = [];
        foreach (array_slice($supportive, 0, $supportiveLimit) as $entry) {
            $supportiveOut[] = [
                'key' => $entry['key'],
                'house' => $entry['house'],
                'support' => (string) ($data[$entry['key']]['support'][$lang] ?? '')
            ];
        }
        $needsCareOut = [];
        foreach ($needsCare as $entry) {
            $needsCareOut[] = [
                'key' => $entry['key'],
                'house' => $entry['house'],
                'difficulties' => $entry['difficulties'],
                'worship' => $entry['worship'],
                'lamp' => $entry['lamp'],
                'donation' => $entry['donation'],
                'mantra' => $entry['mantra'],
                'compactLine' => $entry['compactLine']
            ];
        }

        return [
            'supportive' => $supportiveOut,
            'needsCare' => $needsCareOut,
            'compact' => count($needsCareOut) >= $compactThreshold,
            'assessedCount' => $assessedCount,
            'assessmentComplete' => $assessmentComplete,
            'incompleteNote' => $summaryText['text']['assessmentIncomplete']
        ];
    }


    // =====================================================================
    // NAVAGRAHA REFERENCE MATERIAL (RETAINED)
    //
    // The Navagraha guidance prose and the nine-row reference table are the
    // report's Navagraha reference data. Page 3 is the Short Summary now, so
    // nothing in this report prints them any more - they are kept, not
    // deleted, as the PHP twin of NAVAGRAHA_GUIDANCE / NAVAGRAHA_DOSHA_DATA
    // and the exported Navagraha builders in src/services/jathagamDoshaData.ts
    // and src/services/jathagamHtmlBuilder.ts, and the Short Summary draws its
    // remedies from the same material through
    // jathagamSummaryRemedyData() / classifyJathagamPlanetsForSummary().
    //
    // REVIEW: unchanged from the original page-3 text - no review needed.
    // =====================================================================

    /**
     * Guidance prose for the Navagraha panel, raw (unescaped) per language.
     */
    public static function navagrahaGuidanceData(string $lang): array
    {
        $isTa = ($lang === 'ta');
        $isHi = ($lang === 'hi');
        if ($isTa) {
            $navGuidance = [
                'title' => 'நவக்கிரகங்கள்',
                'intro' => 'நவக்கிரகங்கள் என்பவர்கள் சூரியன், சந்திரன், செவ்வாய், புதன், குரு, சுக்கிரன், சனி, ராகு மற்றும் கேது ஆகிய ஒன்பது கிரகங்கள் ஆவர். இவர்கள் நமக்குக் கஷ்டங்களைத் தருவதில்லை; மாறாக, நாம் செய்த முன்வினைப் பயன்களை (கர்மா) அனுபவிக்க உதவும் நடுநிலையான நீதிபதிகளாக மட்டுமே செயல்படுகிறார்கள்.',
                'reasonsTitle' => 'கஷ்டங்கள் தருவதன் காரணங்கள்',
                'reasons' => [
                    ['கர்ம வினைப் பயன்', 'முற்பிறவிகளிலும் இப்பிறவியிலும் செய்த பாவ, புண்ணிய கணக்குகளின்படியே கிரகங்கள் பலன்களைத் தருகின்றன.'],
                    ['தண்டனை அல்ல, திருத்தம்', 'தவறுகளை உணர்ந்து திருத்திக் கொள்வதற்காகவே கஷ்டங்கள் வருகின்றன.'],
                    ['அகந்தையை அழித்தல்', 'பேராசை, தலைக்கனம், அகந்தையை அடக்கி இறைவனிடம் சரணடைய வைக்கும்.'],
                    ['ஆத்ம வளர்ச்சி', 'இக்கட்டான சூழ்நிலைகள் பொறுமையையும் மனப்பக்குவத்தையும் உண்டாக்குகின்றன.'],
                ],
                'waysTitle' => 'கிரக தோஷங்களை எதிர்கொள்ளும் வழிகள்',
                'ways' => [
                    ['இறை வழிபாடு', 'கிரகத்திற்குரிய அதிதேவதைகளை வழிபடுவது கஷ்டங்களைக் குறைக்கும்.'],
                    ['தான தர்மங்கள்', 'ஏழைகள், விலங்குகளுக்கு உணவு அளிப்பது கர்ம வினையைக் குறைக்கும்.'],
                    ['பாரம்பரிய பக்தி முறைகள்', 'மன அமைதிக்கான வழிபாடு கஷ்டங்களை எதிர்கொள்ளும் வலிமையைத் தரும்.'],
                    ['நன்னடத்தை', 'நேர்மையான வாழ்க்கை கிரகங்களின் தீய தாக்கத்திலிருந்து காக்கும்.'],
                ],
                'closing' => 'வாழ்க்கையில் வரும் கஷ்டங்கள் அனைத்தும் தற்காலிகமானவையே. அவை நம்மைப் புடம் போட்ட தங்கமாக மாற்றுவதற்கே தவிர, அழிப்பதற்காக அல்ல.',
            ];
        } elseif ($isHi) {
            $navGuidance = [
                'title' => 'नवग्रह',
                'intro' => 'नवग्रह नौ ग्रह हैं — सूर्य, चंद्र, मंगल, बुध, गुरु, शुक्र, शनि, राहु और केतु। वे हमें स्वयं कष्ट नहीं देते; बल्कि वे निष्पक्ष न्यायाधीशों की भाँति केवल इतना करते हैं कि हम अपने पूर्वकर्मों (कर्म) के फलों का अनुभव कर सकें।',
                'reasonsTitle' => 'नवग्रह कष्ट क्यों देते हैं',
                'reasons' => [
                    ['कर्मफल', 'पूर्वजन्मों और इस जन्म में किए गए पाप-पुण्य के हिसाब के अनुसार ही ग्रह फल देते हैं।'],
                    ['दंड नहीं, सुधार', 'कष्ट इसलिए आते हैं कि हम अपनी गलतियों को पहचानें और सुधार करें।'],
                    ['अहंकार का नाश', 'लोभ, हठ और अहंकार को वश में करके वे हमें ईश्वर की शरण में ले जाते हैं।'],
                    ['आत्मिक विकास', 'कठिन परिस्थितियाँ धैर्य और मन की परिपक्वता उत्पन्न करती हैं।'],
                ],
                'waysTitle' => 'ग्रह दोषों से निपटने के उपाय',
                'ways' => [
                    ['ईश्वर की आराधना', 'ग्रह के अधिदेवता की आराधना करने से कष्ट कम होते हैं।'],
                    ['सेवा और परोपकार', 'निर्धनों को और पशुओं को भोजन देने से कर्म-भार कम होता है।'],
                    ['पारंपरिक भक्ति', 'मन को शांत करने वाली आराधना कष्ट सहने की शक्ति देती है।'],
                    ['सदाचार', 'ईमानदार जीवन ग्रहों के प्रतिकूल प्रभाव से रक्षा करता है।'],
                ],
                'closing' => 'जीवन में आने वाले सभी कष्ट अस्थायी हैं। वे हमें तपाये हुए सोने की भाँति बदलने के लिए आते हैं, नष्ट करने के लिए नहीं।',
            ];
        } else {
            $navGuidance = [
                'title' => 'The Navagrahas',
                'intro' => 'The Navagrahas are the nine grahas: Surya (Sun), Chandra (Moon), Mangal (Mars), Budha (Mercury), Guru (Jupiter), Shukra (Venus), Shani (Saturn), Rahu and Ketu. They do not bring us hardship of their own accord; rather, they act only as impartial judges who help us experience the results of our own past actions (karma).',
                'reasonsTitle' => 'Why the Navagrahas Bring Difficulties',
                'reasons' => [
                    ['Fruits of Karma', 'The grahas deliver results exactly according to the account of wrong and meritorious deeds accumulated in past lives and in this life.'],
                    ['Correction, Not Punishment', 'Hardships come so that we recognise our mistakes and correct ourselves.'],
                    ['Dissolving the Ego', 'They subdue greed, stubbornness and ego, and lead us to surrender to the Divine.'],
                    ['Growth of the Soul', 'Difficult circumstances build patience and maturity of mind.'],
                ],
                'waysTitle' => 'Ways to Face Planetary Doshas',
                'ways' => [
                    ['Worship of God', 'Worshipping the presiding deity of the graha reduces hardship.'],
                    ['Charity', 'Feeding the poor and feeding animals lightens the burden of karma.'],
                    ['Traditional Devotion', 'Worship that calms the mind gives the strength to face hardship.'],
                    ['Good Conduct', 'An honest life protects you from the adverse influence of the grahas.'],
                ],
                'closing' => 'All hardships in life are temporary. They exist to change us into gold tested in fire — not to destroy us.',
            ];
        }
        return $navGuidance;
    }

    /**
     * Renders the Navagraha guidance panel (mirrors buildNavagrahaGuidanceHtml()).
     */
    public static function navagrahaGuidanceHtml(string $lang): string
    {
        $navGuidance = self::navagrahaGuidanceData($lang);
        return '<p class="navagraha-intro">' . self::e($navGuidance['intro']) . '</p>'
            . '<div class="navagraha-section-title">' . self::e($navGuidance['reasonsTitle']) . '</div>'
            . self::navagrahaBullets($navGuidance['reasons'])
            . '<div class="navagraha-section-title">' . self::e($navGuidance['waysTitle']) . '</div>'
            . self::navagrahaBullets($navGuidance['ways'])
            . '<div class="navagraha-closing">' . self::e($navGuidance['closing']) . '</div>';
    }

    /**
     * The nine-row reference table: [key, aliases, name, prayer focus, weekday,
     * colour, charity, everyday conduct], the last six ordered [en, ta, hi].
     */
    public static function navagrahaReferenceTableData(): array
    {
        $navagrahaRows = [
            ['sun', ['surya', 'sun'],
                ['Surya (Sun)', 'சூரியன் (Surya)', 'सूर्य (Surya)'],
                ['Lord Surya, the Sun God', 'சூரிய பகவான்', 'भगवान सूर्य'],
                ['Sunday', 'ஞாயிறு', 'रविवार'],
                ['Red or copper', 'சிவப்பு அல்லது செம்பு நிறம்', 'लाल या ताम्र'],
                ['Wheat, jaggery, red cloth or copper', 'கோதுமை, வெல்லம், சிவப்புத் துணி', 'गेहूँ, गुड़, लाल वस्त्र'],
                ['Offer clean water to the rising sun in the morning, and honour your father and elders', 'காலையில் எழும் சூரியனுக்குத் தூய நீர் வழங்கி வணங்குங்கள்; தந்தையையும் மூத்தோரையும் மதியுங்கள்', 'उगते सूर्य को शुद्ध जल अर्पित करें, और पिता तथा वृद्धों का सम्मान करें']],
            ['moon', ['chandra', 'moon'],
                ['Chandra (Moon)', 'சந்திரன் (Chandra)', 'चंद्र (Chandra)'],
                ['Lord Shiva', 'சிவபெருமான்', 'भगवान शिव'],
                ['Monday', 'திங்கள்', 'सोमवार'],
                ['White or silver', 'வெள்ளை அல்லது வெள்ளி நிறம்', 'सफेद या चाँदी'],
                ['Rice, milk, sugar or white cloth', 'அரிசி, பால், சர்க்கரை, வெள்ளைத் துணி', 'चावल, दूध, चीनी या सफेद वस्त्र'],
                ['Care for your mother and keep a calm, regular daily routine', 'தாயைக் கவனித்துக் கொள்ளுங்கள்; அமைதியான ஒழுங்கான நாள்வழக்கத்தைக் கடைப்பிடியுங்கள்', 'माता की सेवा करें और शांत, नियमित दिनचर्या रखें']],
            ['mars', ['mangala', 'mangal', 'mars', 'kuja', 'chevvai'],
                ['Mangala (Mars)', 'செவ்வாய் (Mangal)', 'मंगल (Mangal)'],
                ['Lord Murugan (Karthikeya) or Lord Hanuman', 'முருகன் (கார்த்திகேயன்) அல்லது அனுமன்', 'भगवान कार्तिकेय या हनुमान जी'],
                ['Tuesday', 'செவ்வாய்', 'मंगलवार'],
                ['Red', 'சிவப்பு', 'लाल'],
                ['Red lentils, jaggery or red cloth', 'சிவப்புப் பயறு, வெல்லம், சிவப்புத் துணி', 'लाल दाल, गुड़ या लाल वस्त्र'],
                ['Control anger and impatience, and keep cordial relations with your brothers and sisters', 'கோபத்தையும் பொறுமையின்மையையும் கட்டுப்படுத்துங்கள்; சகோதரர்களுடன் நல்லுறவைப் பேணுங்கள்', 'क्रोध और अधीरता पर नियंत्रण रखें, और भाइयों-बहनों से सौहार्द रखें']],
            ['mercury', ['budha', 'mercury'],
                ['Budha (Mercury)', 'புதன் (Budha)', 'बुध (Budha)'],
                ['Lord Vishnu or Lord Ganesha', 'மகா விஷ்ணு அல்லது விநாயகர்', 'भगवान विष्णु या भगवान गणेश'],
                ['Wednesday', 'புதன்', 'बुधवार'],
                ['Green', 'பச்சை', 'हरा'],
                ['Green gram (mung beans), green cloth or books', 'பச்சைப் பயறு, பச்சைத் துணி, நூல்கள்', 'हरी मूँग, हरा वस्त्र या पुस्तकें'],
                ['Speak the truth and avoid deceit or careless speech', 'உண்மையே பேசுங்கள்; வஞ்சகத்தையும் சிந்தியாத பேச்சையும் தவிருங்கள்', 'सत्य बोलें और छल तथा असावधान वाणी से बचें']],
            ['jupiter', ['guru', 'jupiter', 'brihaspati'],
                ['Guru (Jupiter)', 'குரு (Guru)', 'गुरु (Guru)'],
                ['Lord Brihaspati or Lord Dakshinamurthy', 'குரு பகவான் அல்லது தட்சிணாமூர்த்தி', 'भगवान बृहस्पति या दक्षिणामूर्ति'],
                ['Thursday', 'வியாழன்', 'गुरुवार'],
                ['Yellow', 'மஞ்சள்', 'पीला'],
                ['Chickpeas, turmeric, bananas, yellow cloth or books', 'கொண்டைக்கடலை, மஞ்சள், வாழைப்பழம், மஞ்சள் துணி', 'चना, हल्दी, केले, पीला वस्त्र'],
                ['Honour your teachers and elders, and set ego aside', 'ஆசிரியர்களையும் மூத்தோரையும் மதியுங்கள்; அகந்தையை விடுங்கள்', 'गुरुओं और वृद्धों का सम्मान करें, और अहंकार त्यागें']],
            ['venus', ['shukra', 'sukra', 'venus'],
                ['Shukra (Venus)', 'சுக்கிரன் (Shukra)', 'शुक्र (Shukra)'],
                ['Goddess Maha Lakshmi', 'மகா லட்சுமி', 'माँ महालक्ष्मी'],
                ['Friday', 'வெள்ளி', 'शुक्रवार'],
                ['White or cream', 'வெள்ளை அல்லது வெண்மை', 'सफेद या क्रीम'],
                ['Rice, yoghurt, white sweets or white cloth', 'அரிசி, தயிர், வெள்ளை இனிப்பு, வெள்ளைத் துணி', 'चावल, दही, सफेद मिठाई या सफेद वस्त्र'],
                ['Treat women with respect and keep your home and surroundings clean', 'பெண்களை மதியுங்கள்; வீட்டையும் சுற்றுப்புறத்தையும் தூய்மையாக வையுங்கள்', 'स्त्रियों का सम्मान करें और घर तथा परिवेश को स्वच्छ रखें']],
            ['saturn', ['shani', 'sani', 'saturn'],
                ['Shani (Saturn)', 'சனி (Shani)', 'शनि (Shani)'],
                ['Lord Shani or Lord Hanuman', 'சனி பகவான் அல்லது அனுமன்', 'भगवान शनि या हनुमान जी'],
                ['Saturday', 'சனி', 'शनिवार'],
                ['Black or dark blue', 'கருப்பு அல்லது அடர் நீலம்', 'काला या गहरा नीला'],
                ['Black sesame seeds, sesame oil (nallennai), iron, black cloth or warm blankets', 'கருப்பு எள்ளு, நல்லெண்ணெய், இரும்பு, போர்வைகள்', 'काले तिल, तिल का तेल, लोहा, कंबल'],
                ['Serve the poor, the elderly and the disabled, and stay patient and disciplined', 'ஏழைகள், முதியோர், மாற்றுத்திறனாளிகளுக்கு உதவுங்கள்; பொறுமையும் ஒழுக்கமும் கடைப்பிடியுங்கள்', 'निर्धनों, वृद्धों और दिव्यांगों की सेवा करें, और धैर्य तथा अनुशासन रखें']],
            ['rahu', ['rahu'],
                ['Rahu', 'ராகு (Rahu)', 'राहु (Rahu)'],
                ['Goddess Durga or Lord Bhairava', 'துர்க்கை அல்லது பைரவர்', 'माँ दुर्गा या भगवान भैरव'],
                ['Saturday', 'சனி', 'शनिवार'],
                ['Blue or smoky grey', 'நீலம் அல்லது புகைச் சாம்பல்', 'नीला या धुँआरा स्लेटी'],
                ['Black gram, coconut, sesame seeds or warm blankets', 'கருப்பு உளுந்து, தேங்காய், எள், போர்வைகள்', 'काला उड़द, नारियल, तिल के बीज, कंबल'],
                ['Avoid addictions and deception, and live an honest, open life', 'பழக்க அடிமைத்தனத்தையும் வஞ்சகத்தையும் தவிருங்கள்; நேர்மையான திறந்த வாழ்வை வாழுங்கள்', 'व्यसनों और छल से बचें, और ईमानदार, खुला जीवन जिएँ']],
            ['ketu', ['ketu'],
                ['Ketu', 'கேது (Ketu)', 'केतु (Ketu)'],
                ['Lord Ganesha', 'விநாயகர்', 'भगवान गणेश'],
                ['Tuesday or Saturday', 'செவ்வாய் அல்லது சனி', 'मंगलवार या शनिवार'],
                ['Grey or multi-coloured', 'சாம்பல் அல்லது பல்நிறம்', 'स्लेटी या बहुरंगी'],
                ['Sesame seeds, horse gram or warm blankets', 'எள்ளு, கொள்ளு, போர்வைகள்', 'तिल, कुल्थी, कंबल'],
                ['Feed and care for stray dogs, set aside time for quiet reflection, and avoid needless conflict', 'தெரு நாய்களுக்கு உணவளித்துக் கவனியுங்கள்; அமைதியான சிந்தனைக்கு நேரம் ஒதுக்குங்கள்; தேவையற்ற சண்டைகளைத் தவிருங்கள்', 'आवारा कुत्तों को भोजन दें और उनकी देखभाल करें, शांत चिंतन के लिए समय निकालें, और अनावश्यक विवाद से बचें']],
        ];
        return $navagrahaRows;
    }

    /**
     * Column headings, table title, note and closing line (raw strings).
     */
    public static function navagrahaReferenceText(string $lang): array
    {
        $isTa = ($lang === 'ta');
        $isHi = ($lang === 'hi');
        $navHead = $isTa
            ? ['கிரகம்', 'வழிபாடு', 'நாள்', 'நிறம்', 'கொடைப் பொருள்', 'அன்றாட நடத்தை']
            : ($isHi
                ? ['ग्रह', 'आराधना', 'वार', 'रंग', 'सहायता सामग्री', 'दैनिक आचरण']
                : ['Graha', 'Prayer focus', 'Day', 'Colour', 'Give in charity', 'Everyday conduct']);
        $navTableTitle = ($isTa ? 'நவக்கிரக விவர அட்டவணை' : ($isHi ? 'नवग्रह विवरण सारणी' : 'Navagraha Reference Table'));
        $navagrahaNote = ($isTa
            ? 'நவக்கிரகங்கள்: சூரியன், சந்திரன், செவ்வாய், புதன், குரு, சுக்கிரன், சனி, ராகு மற்றும் கேது. ஒன்பது கிரகங்களுக்குமான பாரம்பரிய வழிபாடு, நாள், நிறம், கொடை மற்றும் அன்றாட நடத்தை கீழே உள்ள அட்டவணையில். இவை பொதுவான பரிந்துரைகள், எனவே நீங்கள் எங்கு வாழ்ந்தாலும் பின்பற்றலாம். ஜோதிட மரபுகளின்படி விளக்கங்கள் மாறுபடலாம்.'
            : ($isHi
                ? 'नवग्रह: सूर्य, चंद्र, मंगल, बुध, गुरु, शुक्र, शनि, राहु और केतु। नीचे की तालिका में नौ ग्रहों के लिए पारंपरिक आराधना, वार, रंग, सहायता सामग्री और दैनिक आचरण दिया गया है। ये सामान्य सुझाव हैं, इसलिए आप इन्हें कहीं भी अपना सकते हैं। ज्योतिषीय परंपराओं के अनुसार व्याख्याएँ भिन्न हो सकती हैं।'
                : 'The Navagrahas are the nine grahas: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu. The table below gives the traditional prayer focus, weekday, colour, charity items and everyday conduct for each one. These are general suggestions, so they can be followed anywhere in the world. Interpretations vary by tradition.'));
        $navClosing = ($isTa
            ? 'மேலே உள்ளவை பாரம்பரிய பக்தி சார்ந்த பரிந்துரைகள் மட்டுமே; உறுதியான பலனை உறுதி செய்யாது. குறிப்பிட்ட பொருள்கள் கிடைக்காவிட்டால் அதே நிறத்திலான அல்லது அதே வகையான பொருள்களை வழங்கலாம்.'
            : ($isHi
                ? 'ऊपर दिए गए सुझाव पारंपरिक भक्ति-आधारित हैं; वे किसी निश्चित परिणाम की गारंटी नहीं देते। यदि कोई विशेष वस्तु उपलब्ध न हो, तो उसी रंग या प्रकार की कोई अन्य वस्तु दी जा सकती है।'
                : 'These are traditional devotional suggestions only and do not guarantee a particular result. If a listed item is hard to find where you live, anything of the same colour or kind may be given instead.'));
        return ['head' => $navHead, 'tableTitle' => $navTableTitle, 'note' => $navagrahaNote, 'closing' => $navClosing];
    }

    /**
     * Renders the reference table (mirrors buildNavagrahaReferenceTableHtml()).
     * $flaggedGrahaKeys highlights the grahas a chart flagged, by their keys.
     */
    public static function navagrahaReferenceTableHtml(string $lang, array $flaggedGrahaKeys = []): string
    {
        $li = ($lang === 'ta') ? 1 : (($lang === 'hi') ? 2 : 0);
        $navagrahaRows = self::navagrahaReferenceTableData();
        $navagrahaRowsHtml = '';
        $rowIndex = 0;
        foreach ($navagrahaRows as $row) {
            $isFlagged = isset($flaggedGrahaKeys[$row[0]]);
            $rowClass = $isFlagged ? 'is-flagged' : (($rowIndex % 2 === 1) ? 'even' : '');
            $classAttr = $rowClass !== '' ? ' class="' . $rowClass . '"' : '';
            $navagrahaRowsHtml .= '<tr' . $classAttr . '>'
                . '<td>' . self::e($row[2][$li]) . '</td>'
                . '<td>' . self::e($row[3][$li]) . '</td>'
                . '<td class="col-day">' . self::e($row[4][$li]) . '</td>'
                . '<td>' . self::e($row[5][$li]) . '</td>'
                . '<td>' . self::e($row[6][$li]) . '</td>'
                . '<td>' . self::e($row[7][$li]) . '</td>'
                . '</tr>';
            $rowIndex++;
        }
        $navHead = self::navagrahaReferenceText($lang)['head'];
        return '<table class="navagraha-table">'
            . '<colgroup><col style="width:13%" /><col style="width:19%" /><col style="width:11%" /><col style="width:12%" /><col style="width:21%" /><col style="width:24%" /></colgroup>'
            . '<thead><tr>'
            . '<th>' . self::e($navHead[0]) . '</th>'
            . '<th>' . self::e($navHead[1]) . '</th>'
            . '<th>' . self::e($navHead[2]) . '</th>'
            . '<th>' . self::e($navHead[3]) . '</th>'
            . '<th>' . self::e($navHead[4]) . '</th>'
            . '<th>' . self::e($navHead[5]) . '</th>'
            . '</tr></thead><tbody>' . $navagrahaRowsHtml . '</tbody></table>';
    }


    // =====================================================================
    // MARRIAGE COMPATIBILITY - 1 PAGE HTML
    // =====================================================================
    public static function generateWeddingMatchingHtml($order, $result): string {
        $lang = astro_report_normalize_language($order['language'] ?? 'en');
        $isTa = ($lang === 'ta');
        $isHi = ($lang === 'hi');

        $orderNumber = $order['order_number'] ?? $order['orderNumber'] ?? 'ORD-WEDDING';
        $groom = is_array($result['groom'] ?? null) ? $result['groom'] : [];
        $bride = is_array($result['bride'] ?? null) ? $result['bride'] : [];
        $groomName = self::e($result['groomName'] ?? $groom['nativeName'] ?? 'Groom (Varan)');
        $brideName = self::e($result['brideName'] ?? $bride['nativeName'] ?? 'Bride (Kanya)');

        $groomRasi = self::e(self::rasiNameForNumber($result['groomRasi'] ?? $groom['chandraRasi'] ?? null, $lang));
        $groomNak = self::e($isTa ? ($result['groomNakshatraNameTa'] ?? $groom['nakshatram']['nameTa'] ?? 'N/A') : ($isHi ? ($result['groomNakshatraNameHi'] ?? $groom['nakshatram']['nameHi'] ?? 'N/A') : ($result['groomNakshatraNameEn'] ?? $groom['nakshatram']['name'] ?? 'N/A')));
        $brideRasi = self::e(self::rasiNameForNumber($result['brideRasi'] ?? $bride['chandraRasi'] ?? null, $lang));
        $brideNak = self::e($isTa ? ($result['brideNakshatraNameTa'] ?? $bride['nakshatram']['nameTa'] ?? 'N/A') : ($isHi ? ($result['brideNakshatraNameHi'] ?? $bride['nakshatram']['nameHi'] ?? 'N/A') : ($result['brideNakshatraNameEn'] ?? $bride['nakshatram']['name'] ?? 'N/A')));
        $groomLagna = self::e(self::rasiNameForNumber($groom['lagnaRasi'] ?? $result['groomLagnaRasi'] ?? null, $lang));
        $brideLagna = self::e(self::rasiNameForNumber($bride['lagnaRasi'] ?? $result['brideLagnaRasi'] ?? null, $lang));
        $brideMarsHouseValue = $result['brideMarsHouse'] ?? null;
        $groomMarsHouseValue = $result['groomMarsHouse'] ?? null;
        $brideMarsHouse = self::e(is_numeric($brideMarsHouseValue) && (float) $brideMarsHouseValue === (float) (int) $brideMarsHouseValue && (int) $brideMarsHouseValue >= 1 && (int) $brideMarsHouseValue <= 12 ? 'House ' . (int) $brideMarsHouseValue : 'N/A');
        $groomMarsHouse = self::e(is_numeric($groomMarsHouseValue) && (float) $groomMarsHouseValue === (float) (int) $groomMarsHouseValue && (int) $groomMarsHouseValue >= 1 && (int) $groomMarsHouseValue <= 12 ? 'House ' . (int) $groomMarsHouseValue : 'N/A');

        $groomDob = self::e(self::birthDate($result['groomDob'] ?? $groom['dob'] ?? '', 'N/A'));
        $groomTob = self::e($result['groomTob'] ?? $groom['tob'] ?? 'N/A');
        $groomPlace = self::e($result['groomPlace'] ?? 'N/A');
        $brideDob = self::e(self::birthDate($result['brideDob'] ?? $bride['dob'] ?? '', 'N/A'));
        $brideTob = self::e($result['brideTob'] ?? $bride['tob'] ?? 'N/A');
        $bridePlace = self::e($result['bridePlace'] ?? 'N/A');

        $scoreRaw = $result['totalPointsEarned'] ?? $result['score'] ?? null;
        $maxScoreRaw = $result['maxPossiblePoints'] ?? $result['maxScore'] ?? null;
        $percentRaw = $result['matchPercentage'] ?? $result['percentage'] ?? null;
        $score = self::e(is_numeric($scoreRaw) && (float) $scoreRaw >= 0 ? (string) $scoreRaw : 'N/A');
        $maxScore = self::e(is_numeric($maxScoreRaw) && (float) $maxScoreRaw > 0 ? (string) $maxScoreRaw : 'N/A');
        $scorePercentForMeter = is_numeric($percentRaw)
            ? (float) $percentRaw
            : (is_numeric($scoreRaw) && is_numeric($maxScoreRaw) && (float) $maxScoreRaw > 0
                ? ((float) $scoreRaw / (float) $maxScoreRaw) * 100.0
                : null);
        $scorePercentForMeter = $scorePercentForMeter !== null && is_finite($scorePercentForMeter)
            ? max(0.0, min(100.0, $scorePercentForMeter))
            : null;
        $scoreMeterPercent = $scorePercentForMeter === null ? 'N/A' : (rtrim(rtrim(number_format($scorePercentForMeter, 1, '.', ''), '0'), '.') . '%');
        $scoreMeterWidth = $scorePercentForMeter === null ? '0%' : number_format($scorePercentForMeter, 1, '.', '') . '%';
        $scoreMeterValue = $scorePercentForMeter === null ? 0 : round($scorePercentForMeter, 1);

        $matchedCountRaw = $result['totalPoruthamsMatched'] ?? $result['matchedCount'] ?? null;
        $matchedCountValue = null;
        if (is_numeric($matchedCountRaw) && (float) $matchedCountRaw >= 0 && (float) $matchedCountRaw <= 10 && floor((float) $matchedCountRaw) === (float) $matchedCountRaw) {
            $matchedCountValue = (int) $matchedCountRaw;
        } else {
            $matchRows = is_array($result['poruthams'] ?? null) ? $result['poruthams'] : [];
            if (count($matchRows) === 10) {
                $rowsCanBeCounted = true;
                $matchedCountValue = 0;
                foreach ($matchRows as $matchRow) {
                    $rowStatus = strtoupper(trim((string) ($matchRow['status'] ?? '')));
                    $rowPoints = $matchRow['pointsEarned'] ?? $matchRow['points'] ?? null;
                    $statusCanBeCounted = in_array($rowStatus, ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'], true);
                    $pointsCanBeCounted = is_numeric($rowPoints);
                    if (!$statusCanBeCounted && !$pointsCanBeCounted) {
                        $rowsCanBeCounted = false;
                        break;
                    }
                    if ($statusCanBeCounted ? in_array($rowStatus, ['UTTHAMAM', 'MADHYAMAM'], true) : (float) $rowPoints > 0) {
                        $matchedCountValue++;
                    }
                }
                if (!$rowsCanBeCounted) {
                    $matchedCountValue = null;
                }
            }
        }
        $matchedCountDisplay = $matchedCountValue === null ? 'N/A' : (string) $matchedCountValue;

        $verdictStatus = strtoupper(trim((string) ($result['verdictStatus'] ?? '')));
        $ratingTier = in_array($verdictStatus, ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'], true) ? $verdictStatus : null;
        $legacyVerdict = strtolower((string) ($result['overallVerdictEn'] ?? $result['verdict'] ?? ''));
        $legacyPercent = is_numeric($percentRaw)
            ? (float) $percentRaw
            : (is_numeric($scoreRaw) && is_numeric($maxScoreRaw) && (float) $maxScoreRaw > 0
                ? ((float) $scoreRaw / (float) $maxScoreRaw) * 100.0
                : null);
        if ($ratingTier === null) {
            if (preg_match('/not recommended|not compatible|not good|porundh/', $legacyVerdict)) {
                $ratingTier = 'PORUNDHADHU';
            } elseif (preg_match('/madhyam|moderate|acceptable|remed(y|ies)/', $legacyVerdict)) {
                $ratingTier = 'MADHYAMAM';
            } elseif (preg_match('/utthama|uttama|highly recommended|auspicious/', $legacyVerdict)) {
                $ratingTier = 'UTTHAMAM';
            } elseif ($legacyPercent !== null) {
                $ratingTier = $legacyPercent >= 70 ? 'UTTHAMAM' : ($legacyPercent >= 50 ? 'MADHYAMAM' : 'PORUNDHADHU');
            }
        }
        if ($ratingTier === 'UTTHAMAM') {
            $verdictText = $isTa ? 'இந்த மதிப்பீட்டின்படி நல்ல பொருத்தம்.' : ($isHi ? 'इस आकलन के अनुसार अच्छा मेल है।' : 'Good match based on this assessment.');
        } elseif ($ratingTier === 'MADHYAMAM') {
            $verdictText = $isTa ? 'ஏற்றுக்கொள்ளத்தக்க பொருத்தம்; பரிகாரங்களைப் பரிசீலிக்கலாம்.' : ($isHi ? 'स्वीकार्य मेल; उपायों पर विचार किया जा सकता है।' : 'Acceptable match; remedies may be considered.');
        } elseif ($ratingTier === 'PORUNDHADHU') {
            $verdictText = $isTa
                ? 'இந்த மதிப்பீட்டின்படி பரிந்துரைக்கப்படவில்லை; நிபுணர் ஆலோசனை பெறவும்.'
                : ($isHi
                    ? 'इस आकलन के अनुसार अनुशंसित नहीं; विशेषज्ञ सलाह लें।'
                    : 'Not recommended on this assessment; seek expert review.');
        } else {
            $verdictText = 'N/A';
        }
        $finalVerdictLabel = $isTa ? 'இறுதிப் பரிந்துரை' : ($isHi ? 'अंतिम अनुशंसा' : 'FINAL RECOMMENDATION');
        $finalVerdictText = $verdictText;
        $finalVerdictClass = $ratingTier === null ? 'final-verdict-unavailable' : ($ratingTier === 'UTTHAMAM' ? 'final-verdict-good' : ($ratingTier === 'MADHYAMAM' ? 'final-verdict-moderate' : 'final-verdict-not-good'));
        $finalVerdictColor = $ratingTier === null ? '#475569' : ($ratingTier === 'UTTHAMAM' ? '#166534' : ($ratingTier === 'MADHYAMAM' ? '#92400e' : '#991b1b'));
        $finalVerdictBackground = $ratingTier === null ? '#f1f5f9' : ($ratingTier === 'UTTHAMAM' ? '#ecfdf5' : ($ratingTier === 'MADHYAMAM' ? '#fffbeb' : '#fef2f2'));
        $finalVerdictBorder = $ratingTier === null ? '#cbd5e1' : ($ratingTier === 'UTTHAMAM' ? '#86efac' : ($ratingTier === 'MADHYAMAM' ? '#fcd34d' : '#fca5a5'));
        if ($ratingTier === 'UTTHAMAM') {
            $meterBadgeText = $isTa ? 'உத்தமம்' : ($isHi ? 'उत्तम' : 'Utthamam');
            $meterBadgeStyle = 'background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;';
            $meterFillColor = '#059669';
        } elseif ($ratingTier === 'MADHYAMAM') {
            $meterBadgeText = $isTa ? 'மத்திமம்' : ($isHi ? 'मध्यम' : 'Madhyamam');
            $meterBadgeStyle = 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;';
            $meterFillColor = '#d97706';
        } elseif ($ratingTier === 'PORUNDHADHU') {
            $meterBadgeText = $isTa ? 'பொருந்தாது' : ($isHi ? 'अनुशंसित नहीं' : 'Not Recommended');
            $meterBadgeStyle = 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;';
            $meterFillColor = '#be123c';
        } else {
            $meterBadgeText = 'N/A';
            $meterBadgeStyle = 'background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;';
            $meterFillColor = '#94a3b8';
        }

        $sevvay = is_array($result['sevvayDosham'] ?? null) ? $result['sevvayDosham'] : [];
        $groomDoshaStatus = self::e($isTa ? ($sevvay['groomDoshamSeverityTa'] ?? 'N/A') : ($isHi ? ($sevvay['groomDoshamSeverityHi'] ?? 'N/A') : ($sevvay['groomDoshamSeverityEn'] ?? 'N/A')));
        $brideDoshaStatus = self::e($isTa ? ($sevvay['brideDoshamSeverityTa'] ?? 'N/A') : ($isHi ? ($sevvay['brideDoshamSeverityHi'] ?? 'N/A') : ($sevvay['brideDoshamSeverityEn'] ?? 'N/A')));
        // Keep the profile placement and its simple status in sync.
        $groomMarsHouse .= ' (' . $groomDoshaStatus . ')';
        $brideMarsHouse .= ' (' . $brideDoshaStatus . ')';

        // The first page uses a concise summary. Prefer the engine's structured
        // Samyam code, then fall back to the assessed statuses when available.
        $doshaBalanceCode = strtoupper(trim((string) ($sevvay['doshaSamyamStatus'] ?? '')));
        if (!in_array($doshaBalanceCode, ['BALANCED', 'MINOR_IMBALANCE', 'IMBALANCE'], true)) {
            if ((($sevvay['brideDoshaStatus'] ?? '') === 'DOSHA_MILD' && ($sevvay['isGroomHasDosham'] ?? null) === false) ||
                (($sevvay['groomDoshaStatus'] ?? '') === 'DOSHA_MILD' && ($sevvay['isBrideHasDosham'] ?? null) === false)) {
                $doshaBalanceCode = 'MINOR_IMBALANCE';
            } elseif (is_bool($sevvay['isBalanced'] ?? null)) {
                $doshaBalanceCode = $sevvay['isBalanced'] ? 'BALANCED' : 'IMBALANCE';
            } elseif (is_bool($sevvay['isBrideHasDosham'] ?? null) && is_bool($sevvay['isGroomHasDosham'] ?? null)) {
                $doshaBalanceCode = $sevvay['isBrideHasDosham'] === $sevvay['isGroomHasDosham'] ? 'BALANCED' : 'IMBALANCE';
            } else {
                $doshaBalanceCode = 'UNKNOWN';
            }
        }
        $doshaNotAssessed = $isTa ? 'கிடைக்கவில்லை (N/A)' : ($isHi ? 'उपलब्ध नहीं (N/A)' : 'Not assessed');
        $doshaBalance = $doshaBalanceCode === 'BALANCED'
            ? ($isTa ? 'சமநிலை' : ($isHi ? 'संतुलित' : 'Balanced'))
            : ($doshaBalanceCode === 'MINOR_IMBALANCE'
                ? ($isTa ? 'சிறிய சமனின்மை' : ($isHi ? 'मामूली असंतुलन' : 'Minor imbalance'))
                : ($doshaBalanceCode === 'IMBALANCE'
                    ? ($isTa ? 'சமநிலை இல்லை' : ($isHi ? 'असंतुलन' : 'Imbalance'))
                    : $doshaNotAssessed));
        $doshaGuidance = $doshaBalanceCode === 'BALANCED'
            ? ($isTa ? 'செவ்வாய் தோஷக் கண்ணோட்டத்தில் சமநிலை உள்ளது; இது முழுத் திருமணப் பரிந்துரை அல்ல.' : ($isHi ? 'मंगल दोष की दृष्टि से संतुलन है; यह समग्र विवाह अनुशंसा नहीं है।' : 'Kuja Dosha is balanced; this does not determine overall compatibility.'))
            : ($doshaBalanceCode === 'MINOR_IMBALANCE'
                ? ($isTa ? 'சிறிய சமனின்மை உள்ளது; எளிய பரிகாரங்களுக்கு ஜோதிடரிடம் ஆலோசனை பெறவும்.' : ($isHi ? 'मामूली असंतुलन है; सरल उपायों के लिए ज्योतिषी से सलाह लें।' : 'A mild imbalance is indicated; ask an astrologer about simple remedies.'))
                : ($doshaBalanceCode === 'IMBALANCE'
                    ? ($isTa ? 'செவ்வாய் தோஷ சமநிலை இல்லை; பரிகாரங்களுக்கு நிபுணர் ஆலோசனை பெறவும்.' : ($isHi ? 'मंगल दोष में असंतुलन है; उपायों के लिए विशेषज्ञ सलाह लें।' : 'A Kuja Dosha imbalance is indicated; seek expert guidance on remedies.'))
                    : ($isTa ? 'கிடைத்த ஜாதகத் தகவல்களால் செவ்வாய் தோஷத்தை மதிப்பிட முடியவில்லை.' : ($isHi ? 'उपलब्ध जन्म विवरण से मंगल दोष का आकलन नहीं हो सका।' : 'Kuja Dosha could not be assessed from the available chart data.'))));
        $doshaTitle = $isTa ? 'செவ்வாய் தோஷச் சுருக்கம்' : ($isHi ? 'मंगल दोष सारांश' : 'Kuja (Mars) Dosha Summary');
        $lblDoshaBride = $isTa ? 'பெண்' : ($isHi ? 'वधू' : 'Bride');
        $lblDoshaGroom = $isTa ? 'ஆண்' : ($isHi ? 'वर' : 'Groom');
        $lblDoshaBalance = $isTa ? 'தோஷ சமநிலை' : ($isHi ? 'दोष संतुलन' : 'Dosha Balance');
        $lblDoshaGuidance = $isTa ? 'செவ்வாய் வழிகாட்டல்' : ($isHi ? 'मंगल मार्गदर्शन' : 'Kuja Guidance');
        $lblVisualMeter = $isTa ? 'பொருத்த ஒத்திசைவு அளவுகோல்' : ($isHi ? 'विवाह अनुकूलता मीटर' : 'Visual Compatibility Meter');
        $lblMeterPoints = $isTa ? 'புள்ளிகள்' : ($isHi ? 'अंक' : 'Points');
        $lblPoruthamsMatched = $isTa ? 'பொருத்தங்கள் பொருந்தின' : ($isHi ? 'गुण मेल खाते हैं' : 'Poruthams matched');
        $lblRajju = $isTa ? 'ரஜ்ஜு நிலை' : ($isHi ? 'रज्जु स्थिति' : 'Rajju status');
        $rajjuMatch = $result['rajjuMatch'] ?? null;
        $rajjuStatusText = !is_bool($rajjuMatch)
            ? 'N/A'
            : ($rajjuMatch
                ? ($isTa ? 'பொருத்துகிறது (சுபம்)' : ($isHi ? 'शुभ मेल' : 'Auspicious match'))
                : ($isTa ? 'ரஜ்ஜு தட்டுப்படுகிறது' : ($isHi ? 'अशुभ' : 'Afflicted')));
        $rajjuStatusColor = !is_bool($rajjuMatch) ? '#64748b' : ($rajjuMatch ? '#047857' : '#be123c');

        $rows = '';
        $idx = 1;
        foreach (($result['poruthams'] ?? []) as $p) {
            $pName = $isTa ? ($p['nameTa'] ?? $p['nameEn'] ?? '') : ($isHi ? ($p['nameHi'] ?? $p['nameEn'] ?? '') : ($p['nameEn'] ?? ''));
            $earnedRaw = array_key_exists('pointsEarned', $p) ? $p['pointsEarned'] : null;
            // A genuine zero is a present score. Only null/empty means "fall
            // back" to the legacy `points` field or render N/A.
            if ($earnedRaw === null || $earnedRaw === '') {
                $earnedRaw = $p['points'] ?? null;
            }
            $maxRaw = $p['maxPoints'] ?? null;
            $hasEarned = $earnedRaw !== null && $earnedRaw !== '' && is_numeric($earnedRaw) && (float) $earnedRaw >= 0;
            $hasMaximum = $maxRaw !== null && $maxRaw !== '' && is_numeric($maxRaw) && (float) $maxRaw > 0;
            $pts = ($hasEarned ? (string) $earnedRaw : 'N/A') . ' / ' . ($hasMaximum ? (string) $maxRaw : 'N/A');
            $status = $isTa ? ($p['statusTa'] ?? $p['status'] ?? 'N/A') : ($isHi ? ($p['statusHi'] ?? $p['status'] ?? 'N/A') : ($p['status'] ?? 'N/A'));
            $expl = $isTa ? ($p['explanationTa'] ?? $p['explanationEn'] ?? '') : ($isHi ? ($p['explanationHi'] ?? $p['explanationEn'] ?? '') : ($p['explanationEn'] ?? ''));

            $rows .= '<tr><td>' . $idx . '</td><td><b>' . self::e($pName) . '</b></td><td>' . self::e($pts) . '</td><td>' . self::e($status) . '</td><td>' . self::e($expl) . '</td></tr>';
            $idx++;
        }

        $headerSub = $isTa ? 'திருமணப் பொருத்த அறிக்கை (10 திருமணப் பொருத்தங்கள்)' : ($isHi ? 'विवाह कुंडली मिलान (10 गुण मिलान)' : 'Marriage Compatibility (10 Poruthams Report)');
        $lblGroom = $isTa ? 'வரன் (ஆண்) விவரம்' : ($isHi ? 'वर का विवरण' : 'GROOM DETAILS');
        $lblBride = $isTa ? 'கன்னிகை (பெண்) விவரம்' : ($isHi ? 'कन्या का विवरण' : 'BRIDE DETAILS');
        $thP = $isTa ? 'பொருத்தம்' : ($isHi ? 'गुण / कूट' : 'Porutham');
        $thPts = $isTa ? 'மதிப்பெண்' : ($isHi ? 'अंक' : 'Points');
        $thSt = $isTa ? 'நிலை' : ($isHi ? 'स्थिति' : 'Status');
        $thExp = $isTa ? 'விளக்கம் & பலன்' : ($isHi ? 'विवरण एवं फल' : 'Explanation');

        $body = self::topHeader('ASTRO SIVAM', $headerSub, $orderNumber, 1, 2, $lang);
        $body .= <<<HTML
<div class="panel" style="padding:3.5mm 4mm;">
  <table style="width:100%; font-size:10px; line-height:1.5;"><tr>
    <td style="width:48%; vertical-align:top;">
      <div style="color:#7a1f1f; font-size:10.5px; font-weight:bold; margin-bottom:1.5mm;">{$lblGroom}</div>
      <div style="margin-bottom:1mm;">Name: <b>{$groomName}</b></div>
      <div style="margin-bottom:1mm;">DOB: {$groomDob} ({$groomTob})</div>
      <div style="margin-bottom:1mm;">Place: {$groomPlace}</div>
      <div style="margin-bottom:1mm;">Rasi: <b>{$groomRasi}</b> &bull; Star: <b>{$groomNak}</b></div>
      <div>Lagna: <b>{$groomLagna}</b> &bull; Mars: <b>{$groomMarsHouse}</b></div>
    </td>
    <td style="width:4%; border-left:1px solid #e8d9b8;"></td>
    <td style="width:48%; vertical-align:top;">
      <div style="color:#7a1f1f; font-size:10.5px; font-weight:bold; margin-bottom:1.5mm;">{$lblBride}</div>
      <div style="margin-bottom:1mm;">Name: <b>{$brideName}</b></div>
      <div style="margin-bottom:1mm;">DOB: {$brideDob} ({$brideTob})</div>
      <div style="margin-bottom:1mm;">Place: {$bridePlace}</div>
      <div style="margin-bottom:1mm;">Rasi: <b>{$brideRasi}</b> &bull; Star: <b>{$brideNak}</b></div>
      <div>Lagna: <b>{$brideLagna}</b> &bull; Mars: <b>{$brideMarsHouse}</b></div>
    </td>
  </tr></table>
</div>

<table class="wedding-overview-grid" cellpadding="0" cellspacing="0" style="width:100%; table-layout:fixed; border-collapse:collapse; margin:2mm 0 2.5mm;">
  <tr>
    <td style="width:50%; vertical-align:top; padding:0 1.2mm 0 0;">
      <div class="panel" style="padding:3mm; margin:0; border:1px solid #e2e8f0; background:#ffffff; border-radius:4px;">
        <table style="width:100%; border-collapse:collapse; margin-bottom:1mm;">
          <tr>
            <td style="font-size:9.5px; line-height:1.25; color:#7a1f1f; font-weight:bold; vertical-align:middle;">{$lblVisualMeter}</td>
            <td style="text-align:right; vertical-align:middle; white-space:nowrap;"><span style="display:inline-block; font-size:7px; line-height:1.2; font-weight:bold; border-radius:12px; padding:0.8mm 1.6mm; {$meterBadgeStyle}">{$meterBadgeText}</span></td>
          </tr>
        </table>
        <div style="font-size:15px; line-height:1.2; color:#0f172a; font-weight:bold; margin-bottom:1.2mm;">
          {$score} / {$maxScore}<span style="font-size:8px; color:#64748b; font-weight:normal;"> {$lblMeterPoints}</span>
          <span style="float:right; font-size:9px; color:#334155;">{$scoreMeterPercent}</span>
        </div>
        <div role="meter" aria-label="{$lblVisualMeter}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{$scoreMeterValue}" aria-valuetext="{$scoreMeterPercent}" style="width:100%; height:2.5mm; overflow:hidden; border-radius:20px; background:#e2e8f0; margin-bottom:1.2mm;">
          <div style="width:{$scoreMeterWidth}; height:2.5mm; background:{$meterFillColor}; border-radius:20px;"></div>
        </div>
        <div style="font-size:8px; line-height:1.35; color:#475569; margin-bottom:0.8mm;"><b>{$matchedCountDisplay} / 10</b> {$lblPoruthamsMatched}</div>
        <div style="font-size:8px; line-height:1.35; color:#475569;">{$lblRajju}: <b style="color:{$rajjuStatusColor};">{$rajjuStatusText}</b></div>
      </div>
    </td>
    <td style="width:50%; vertical-align:top; padding:0 0 0 1.2mm;">
      <div class="panel" style="padding:3mm; margin:0; border:1px solid #e8d9b8; border-left:3px solid #7a1f1f; background:#f8fafc; border-radius:4px;">
        <div class="panel-title" style="font-size:9.5px; line-height:1.25; border-bottom:0; padding:0; margin:0 0 1.2mm;">{$doshaTitle}</div>
        <table style="width:100%; border-collapse:separate; border-spacing:1mm 0; table-layout:fixed; font-size:8px; line-height:1.3; margin:0 -1mm 1mm;">
          <tr>
            <td style="width:50%; vertical-align:top; padding:1.2mm 1.5mm; border:1px solid #e8d9b8; background:#fffdf7;">
              <div style="font-size:7px; color:#64748b; font-weight:bold; text-transform:uppercase; margin-bottom:0.6mm;">{$lblDoshaBride}</div>
              <div style="font-weight:bold; color:#2b1d14;">{$brideDoshaStatus}</div>
            </td>
            <td style="width:50%; vertical-align:top; padding:1.2mm 1.5mm; border:1px solid #e8d9b8; background:#fffdf7;">
              <div style="font-size:7px; color:#64748b; font-weight:bold; text-transform:uppercase; margin-bottom:0.6mm;">{$lblDoshaGroom}</div>
              <div style="font-weight:bold; color:#2b1d14;">{$groomDoshaStatus}</div>
            </td>
          </tr>
        </table>
        <div style="display:block; padding:0.9mm 1.5mm; border:1px solid #e8d9b8; background:#fffdf7; font-size:8px; line-height:1.25; margin-bottom:1mm;">
          <span style="color:#64748b; font-weight:bold;">{$lblDoshaBalance}:</span> <b style="color:#2b1d14;">{$doshaBalance}</b>
        </div>
        <div style="border-top:1px solid #e8d9b8; padding-top:1mm; font-size:7.8px; line-height:1.3; color:#4b3d28;">
          <b style="color:#7a1f1f;">{$lblDoshaGuidance}:</b> {$doshaGuidance}
        </div>
      </div>
    </td>
  </tr>
</table>

<table class="data-table" style="font-size:9.5px;">
  <thead><tr><th width="26" style="padding:2mm 2.5mm;">#</th><th style="padding:2mm 2.5mm;">{$thP}</th><th width="52" style="padding:2mm 2.5mm;">{$thPts}</th><th width="70" style="padding:2mm 2.5mm;">{$thSt}</th><th style="padding:2mm 2.5mm;">{$thExp}</th></tr></thead>
  <tbody>{$rows}</tbody>
</table>

<div class="panel {$finalVerdictClass}" role="status" style="text-align:center; background:{$finalVerdictBackground}; border:1px solid {$finalVerdictBorder}; margin-top:1mm; margin-bottom:1mm; padding:3mm 4mm;">
  <div style="font-size:9.5px; font-weight:bold; letter-spacing:0.5px; color:{$finalVerdictColor};">{$finalVerdictLabel}</div>
  <div style="font-size:13px; line-height:1.25; font-weight:bold; color:{$finalVerdictColor}; margin-top:0.8mm;">{$finalVerdictText}</div>
</div>
HTML;

        // ---------------------------------------------------------------------
        // Page 2 - Marriage Matching disclaimer, in the language the order was
        // placed in. Shared copy so the mPDF email, the admin preview and the
        // browser export always print exactly the same wording.
        // ---------------------------------------------------------------------
        $disclaimer = WeddingDisclaimerNotes::build($lang);
        // Tamil and Devanagari set wider than Latin, so each language gets its own
        // reading column and type size: the panel fills the sheet without ever
        // spilling onto a third page.
        $disclaimerParaStyle = $isTa
            ? 'font-size:11.5px; line-height:1.9; margin:0 0 4mm;'
            : ($isHi
                ? 'font-size:13.5px; line-height:1.95; margin:0 0 4.5mm;'
                : 'font-size:13px; line-height:1.95; margin:0 0 4.5mm;');
        $disclaimerPanelStyle = $isTa ? 'width:100%;' : ($isHi ? 'width:148mm;' : 'width:155mm;');
        $disclaimerParagraphs = '';
        foreach ($disclaimer['paragraphs'] as $paragraph) {
            $disclaimerParagraphs .= '<p class="disclaimer-para" style="' . $disclaimerParaStyle . '">' . WeddingDisclaimerNotes::rich($paragraph) . '</p>';
        }
        $disclaimerTitle = self::e($disclaimer['title']);
        $disclaimerHeading = self::e($disclaimer['heading']);
        $disclaimerBody = self::topHeader('ASTRO SIVAM', $disclaimer['pageSubtitle'], $orderNumber, 2, 2, $lang);
        $disclaimerBody .= <<<HTML
<div class="panel disclaimer-panel" style="{$disclaimerPanelStyle} margin:0 auto;">
  <div class="disclaimer-title">{$disclaimerTitle}</div>
  <div class="disclaimer-heading">{$disclaimerHeading}</div>
  {$disclaimerParagraphs}
</div>
HTML;

        // ---------------------------------------------------------------------
        // Page 2 - attestation block. Closes the sheet with the report
        // reference, the issue date and the authorised signature line so the
        // disclaimer no longer ends half a page above the footer.
        // ---------------------------------------------------------------------
        $attestTitle = $isTa ? 'சான்றளிக்கப்பட்டது &amp; உறுதிப்படுத்தப்பட்டது' : ($isHi ? 'प्रमाणित एवं अभिप्रमाणित' : 'CERTIFIED &amp; ATTESTED');
        $lblReference = $isTa ? 'குறிப்பு எண்' : ($isHi ? 'संदर्भ क्रमांक' : 'Reference');
        $lblIssuedOn = $isTa ? 'வழங்கப்பட்ட நாள்' : ($isHi ? 'जारी तिथि' : 'Issued On');
        $lblPreparedFor = $isTa ? 'இவர்களுக்காக' : ($isHi ? 'हेतु तैयार' : 'Prepared For');
        $lblSignatory = $isTa ? 'அங்கீகரிக்கப்பட்டவர்' : ($isHi ? 'अधिकृत हस्ताक्षरकर्ता' : 'Authorised Signatory');
        $signatoryDesk = $isTa ? 'ASTRO SIVAM வேத ஆய்வு மையம்' : ($isHi ? 'ASTRO SIVAM वैदिक अनुसंधान केंद्र' : 'ASTRO SIVAM Vedic Research Desk');
        $issueTimeZoneId = trim((string) ($result['generatedAtTimeZoneId'] ?? date_default_timezone_get()));
        try {
            $issueTimeZone = new DateTimeZone($issueTimeZoneId !== '' ? $issueTimeZoneId : date_default_timezone_get());
        } catch (Throwable $error) {
            $issueTimeZone = new DateTimeZone(date_default_timezone_get());
        }
        try {
            $generatedAtValue = trim((string) ($result['generatedAt'] ?? ''));
            $issueDate = new DateTimeImmutable($generatedAtValue !== '' ? $generatedAtValue : 'now', $issueTimeZone);
        } catch (Throwable $error) {
            $issueDate = new DateTimeImmutable('now', $issueTimeZone);
        }
        $issuedOn = self::e($issueDate->setTimezone($issueTimeZone)->format('d M Y, H:i T'));
        $referenceNo = self::e((string) $orderNumber);
        $attestation = <<<HTML
<div class="attestation">
  <div class="attestation-title">{$attestTitle}</div>
  <table class="attestation-grid"><tr>
    <td style="width:58%;">
      <div class="attest-item"><span class="attest-lbl">{$lblReference}</span><span class="attest-val">{$referenceNo}</span></div>
      <div class="attest-item"><span class="attest-lbl">{$lblIssuedOn}</span><span class="attest-val">{$issuedOn}</span></div>
      <div class="attest-item" style="margin-bottom:0;"><span class="attest-lbl">{$lblPreparedFor}</span><span class="attest-val">{$brideName} &#9792; &amp; {$groomName} &#9794;</span></div>
    </td>
    <td class="attestation-sign" style="width:42%;">
      <div class="signature-rule"></div>
      <div class="signatory-label">{$lblSignatory}</div>
      <div class="signatory-desk">{$signatoryDesk}</div>
    </td>
  </tr></table>
</div>
HTML;
        $disclaimerBody .= $attestation;

        $css = self::sharedCss($lang);
        return '<!DOCTYPE html><html lang="' . self::e($lang) . '"><head><meta charset="UTF-8"><title>ASTRO SIVAM - Marriage Compatibility Report</title><style>' . $css . '</style></head><body>'
            . '<div class="sheet">' . $body . self::footerBand($lang) . '</div><pagebreak />'
            . '<div class="sheet">' . $disclaimerBody . self::footerBand($lang) . '</div>'
            . '</body></html>';
    }

    // =====================================================================
    // MUHURTHAM - SUBHA MUHURTHAM SIX-MONTH CALENDAR
    // Layout: exactly 2 pages.
    //   page 1: devotee details + every recommended date of the six-month scan
    //   page 2: calendar rows that overflowed (upper half) + the calculation
    //             system guide (lower half)
    // Mirrors src/services/muhurthamHtmlBuilder.ts so the browser preview,
    // the admin preview and the emailed mPDF are byte-identical.
    // =====================================================================
    public static function generateMuhurthamHtml($order, $result): string {
        $lang = astro_report_normalize_language($order['language'] ?? 'en');
        $isTa = ($lang === 'ta');
        $isHi = ($lang === 'hi');

        if (!is_array($result)) {
            $result = [];
        }
        if (empty($result['months']) && class_exists('AstroEngine')) {
            $input = $order['input_payload'] ?? [];
            if (!is_array($input)) {
                $input = json_decode((string) $input, true) ?: [];
            }
            if (!empty($input['muhurthamScan'])) {
                try {
                    $result = AstroEngine::calculateMuhurtham($input);
                } catch (\Throwable $e) {
                    error_log('Muhurtham recalculation failed: ' . $e->getMessage());
                }
            }
        }

        $months = [];
        if (!empty($result['months']) && is_array($result['months'])) {
            $months = $result['months'];
        } else {
            foreach (['prevMonth', 'chosenMonth', 'nextMonth'] as $legacyKey) {
                if (!empty($result[$legacyKey]['days']) && is_array($result[$legacyKey]['days'])) {
                    $months[] = $result[$legacyKey];
                }
            }
        }

        $rules = class_exists('AstroEngine') ? AstroEngine::getMuhurthamRules() : [];
        $eventKey = (string) ($result['eventKey'] ?? 'wedding');
        $event = is_array($rules[$eventKey] ?? null) ? $rules[$eventKey] : [];
        // Date calendar plus a compact ceremony-specific selection guide.
        $weekdayNamesByLang = [
            'en' => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            'ta' => ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
            'hi' => ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार']
        ];
        $weekdayNames = $isTa ? $weekdayNamesByLang['ta'] : ($isHi ? $weekdayNamesByLang['hi'] : $weekdayNamesByLang['en']);

        $eventTitle = $isTa
            ? ($result['eventTitleTa'] ?? $event['titleTa'] ?? 'சுப முகூர்த்தம்')
            : ($isHi
                ? ($result['eventTitleHi'] ?? $event['titleHi'] ?? 'शुभ मुहूर्त')
                : ($result['eventTitleEn'] ?? $event['titleEn'] ?? 'Subha Muhurtham'));

        $eventDescription = $isTa
            ? ($result['eventDescriptionTa'] ?? $event['descriptionTa'] ?? '')
            : ($isHi
                ? ($result['eventDescriptionHi'] ?? $event['descriptionHi'] ?? '')
                : ($result['eventDescriptionEn'] ?? $event['descriptionEn'] ?? ''));

        $windowLabel = $isTa
            ? ($result['windowLabelTa'] ?? 'தேர்ந்தெடுத்த மாதத்திற்கு முன் 2 மாதங்கள் + தேர்ந்தெடுத்த மாதம் மற்றும் அதற்குப் பின் 3 மாதங்கள்')
            : ($isHi
                ? ($result['windowLabelHi'] ?? 'चुने हुए महीने से पहले 2 महीने + चयनित माह और उसके बाद के 3 महीने')
                : ($result['windowLabelEn'] ?? '2 months before the selected month + the selected month and the following 3 months'));

        $devoteeName = self::e($result['devoteeName'] ?? ($order['user_name'] ?? 'User'));
        $dob = self::e(self::birthDate($result['dob'] ?? '', '—'));
        $tob = self::e($result['tob'] ?? '—');
        $birthPlaceRaw = trim((string) ($result['birthPlace'] ?? '—'));
        $countryRaw = trim((string) ($result['country'] ?? ''));
        $birthPlace = self::e($countryRaw && stripos($birthPlaceRaw, $countryRaw) === false ? $birthPlaceRaw . ', ' . $countryRaw : $birthPlaceRaw);
        $muhurthamPlaceRaw = trim((string) ($result['muhurthamPlace'] ?? 'the selected place'));
        $muhurthamCountryRaw = trim((string) ($result['muhurthamCountry'] ?? ''));
        $muhurthamPlace = self::e($muhurthamCountryRaw && stripos($muhurthamPlaceRaw, $muhurthamCountryRaw) === false
            ? $muhurthamPlaceRaw . ', ' . $muhurthamCountryRaw
            : $muhurthamPlaceRaw);

        // Both charts of a wedding, exactly as the browser and Node builders
        // print them: name, birth details and their own Nakshatra / Rasi / Lagna.
        $persons = [];
        foreach ((array) ($result['persons'] ?? []) as $person) {
            if (!is_array($person)) { continue; }
            $role = (string) ($person['role'] ?? 'self');
            if (!in_array($role, ['bride', 'groom', 'child', 'mother', 'self'], true)) { $role = 'self'; }
            $personStar = $isTa
                ? ($person['nakshatraNameTa'] ?? $person['nakshatraNameEn'] ?? '')
                : ($isHi ? ($person['nakshatraNameHi'] ?? $person['nakshatraNameEn'] ?? '') : ($person['nakshatraNameEn'] ?? ''));
            $personRasi = $isTa
                ? ($person['rasiNameTa'] ?? $person['rasiNameEn'] ?? '')
                : ($isHi ? ($person['rasiNameHi'] ?? $person['rasiNameEn'] ?? '') : ($person['rasiNameEn'] ?? ''));
            $personLagna = $isTa
                ? ($person['lagnaNameTa'] ?? $person['lagnaNameEn'] ?? '')
                : ($isHi ? ($person['lagnaNameHi'] ?? $person['lagnaNameEn'] ?? '') : ($person['lagnaNameEn'] ?? ''));
            $persons[] = [
                'role' => $role,
                'name' => (string) ($person['name'] ?? ''),
                'dob' => self::birthDate($person['dob'] ?? ''),
                'tob' => (string) ($person['tob'] ?? ''),
                'place' => (string) ($person['birthPlace'] ?? ''),
                'star' => (string) $personStar,
                'rasi' => (string) $personRasi,
                'lagna' => (string) $personLagna
            ];
        }
        $bridePerson = null; $groomPerson = null;
        foreach ($persons as $person) {
            if ($person['role'] === 'bride' && $bridePerson === null) { $bridePerson = $person; }
            if ($person['role'] === 'groom' && $groomPerson === null) { $groomPerson = $person; }
        }
        $singlePersonMode = !($bridePerson && $groomPerson);
        // The window line is the real covered range ("07 Oct 2026 – 31 Mar 2027").
        $windowRange = class_exists('AstroEngine') ? AstroEngine::muhurthamWindowRange($months) : '';
        if ($windowRange !== '') { $windowLabel = $windowRange; }

        $t = [
            'docTitle' => $isTa ? 'சுப முகூர்த்த அறிக்கை' : ($isHi ? 'शुभ मुहूर्त रिपोर्ट' : 'Subha Muhurtham Report'),
            'datesTitle' => $isTa ? 'பரிந்துரைக்கப்பட்ட முகூர்த்த தேதிகள் - ஆறு மாதங்கள்' : ($isHi ? 'अनुशंसित मुहूर्त तिथियाँ - छह माह' : 'RECOMMENDED MUHURTHAM DATES - SIX MONTHS'),
            'datesSub' => $isTa ? 'தேதி · கிழமை · நட்சத்திரம் (சூரிய உதயம்) · நல்ல நேரம்' : ($isHi ? 'दिनांक · वार · नक्षत्र (सूर्योदय) · शुभ समय' : 'Date · Weekday · Nakshatra (at sunrise) · Nalla Neram'),
            'continued' => $isTa ? '1-வது பக்கத்தின் தொடர்ச்சி' : ($isHi ? 'पृष्ठ 1 से जारी' : 'Continued from page 1'),
            'certified' => $isTa ? 'சான்றளித்தவர்: ASTRO SIVAM' : ($isHi ? 'प्रमाणित: ASTRO SIVAM' : 'Certified by ASTRO SIVAM'),
            'page1' => $isTa ? 'பக்கம் 1 / 2' : ($isHi ? 'पृष्ठ 1 / 2' : 'Page 1 of 2'),
            'page2Fixed' => $isTa ? 'பக்கம் 2 / 2' : ($isHi ? 'पृष्ठ 2 / 2' : 'Page 2 of 2'),
            'secParticulars' => $isTa ? 'பயனர் விவரம்' : ($isHi ? 'उपयोगकर्ता विवरण' : 'USER PARTICULARS'),
            'lblName' => $isTa ? 'பெயர்' : ($isHi ? 'नाम' : 'NAME'),
            'lblDob' => $isTa ? 'பிறந்த தேதி' : ($isHi ? 'जन्म तिथि' : 'DATE OF BIRTH'),
            'lblTob' => $isTa ? 'பிறந்த நேரம்' : ($isHi ? 'जन्म समय' : 'TIME OF BIRTH'),
            'lblPlace' => $isTa ? 'முகூர்த்த இடம் (உள்ளூர் நேரம்)' : ($isHi ? 'मुहूर्त स्थान (स्थानीय समय)' : 'MUHURTHAM LOCATION (LOCAL TIMES)'),
            'lblBirthPlace' => $isTa ? 'ஜன்ம நட்சத்திரத்திற்கான பிறந்த இடம்' : ($isHi ? 'जन्म नक्षत्र हेतु जन्म स्थान' : 'Birth place for Janma Nakshatra'),
            'lblBest' => $isTa ? 'உத்தமம்' : ($isHi ? 'उत्तम' : 'BEST'),
            'lblGood' => $isTa ? 'சுபம்' : ($isHi ? 'शुभ' : 'GOOD'),
            'lblDate' => $isTa ? 'தேதி' : ($isHi ? 'तिथि' : 'DATE'),
            'lblDay' => $isTa ? 'கிழமை' : ($isHi ? 'वार' : 'DAY'),
            'lblStar' => $isTa ? 'நட்சத்திரம்' : ($isHi ? 'नक्षत्र' : 'STAR'),
            'lblNalla' => $isTa ? 'நல்ல நேரம்' : ($isHi ? 'शुभ समय' : 'NALLA NERAM'),
            'lblGrade' => $isTa ? 'தரம்' : ($isHi ? 'श्रेणी' : 'GRADE'),
            'lblNoDays' => $isTa ? 'இந்த மாதத்தில் சிறந்த அல்லது சுப தேதிகள் இல்லை.' : ($isHi ? 'इस माह में कोई BEST या GOOD तिथि नहीं मिली।' : 'No BEST or GOOD dates in this month.'),
            'secCouple' => $isTa ? 'மணமகன் & மணமகள் விவரங்கள்' : ($isHi ? 'वर एवं वधू विवरण' : 'BRIDE & GROOM PARTICULARS'),
            'lblStar' => $isTa ? 'ஜன்ம நட்சத்திரம்' : ($isHi ? 'जन्म नक्षत्र' : 'JANMA NAKSHATRA'),
            'lblRasi' => $isTa ? 'ராசி' : ($isHi ? 'राशि' : 'RASI'),
            'lblLagna' => $isTa ? 'லக்னம்' : ($isHi ? 'लग्न' : 'LAGNA'),
            'lblBride' => $isTa ? 'மணமகள்' : ($isHi ? 'वधू' : 'BRIDE'),
            'lblGroom' => $isTa ? 'மணமகன்' : ($isHi ? 'वर' : 'GROOM'),
            'singlePersonNote' => $isTa
                ? 'ஒருவரின் விவரங்கள் மட்டும் பயன்படுத்தப்பட்டன — சந்திராஷ்டமம் மற்றும் தாரா பலம் இந்த ஒருவரின் ஜாதகத்திற்கு மட்டுமே சரிபார்க்கப்பட்டது.'
                : ($isHi
                    ? 'केवल एक व्यक्ति का विवरण उपयोग किया गया है — चंद्राष्टम और तारा बल केवल इसी जातक की कुंडली से जाँचे गए हैं।'
                    : 'Only one person\'s details were used - Chandrashtama and Tara Bala were checked for that single chart alone.'),
            'lblReference' => $isTa ? 'குறிப்பு எண்' : ($isHi ? 'संदर्भ क्रमांक' : 'REFERENCE'),
            'lblIssuedOn' => $isTa ? 'வழங்கப்பட்ட நாள்' : ($isHi ? 'जारी तिथि' : 'ISSUED ON'),
            'lblPreparedFor' => $isTa ? 'இவர்களுக்காக' : ($isHi ? 'हेतु तैयार' : 'PREPARED FOR'),
            'lblSignatory' => $isTa ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : ($isHi ? 'अधिकृत हस्ताक्षरकर्ता' : 'AUTHORISED SIGNATORY'),
            'signatoryDesk' => $isTa ? 'ASTRO SIVAM வேத ஆய்வு மையம்' : ($isHi ? 'ASTRO SIVAM वैदिक अनुसंधान केंद्र' : 'ASTRO SIVAM Vedic Research Desk')
        ];

        // =====================================================================
        // TWO-PAGE LAYOUT - dates plus a compact selection guide on page 2
        // Mirrors src/services/muhurthamHtmlBuilder.ts and Node jsPDF generator
        // =====================================================================
        $page1BudgetMm = 160;   // date rows share A4 space below the centered cover header
        $page2BudgetMm = 78;    // keep continuation dates above the guide + authorisation block on page 2
        $densityTiers = [
            ['fontPx' => 9.4, 'padMm' => 1.5],
            ['fontPx' => 8.6, 'padMm' => 1.15],
            ['fontPx' => 7.8, 'padMm' => 0.9],
            ['fontPx' => 7.1, 'padMm' => 0.7],
            ['fontPx' => 6.5, 'padMm' => 0.55],
            ['fontPx' => 6.0, 'padMm' => 0.4]
        ];
        $hasPersonalNotes = false;   // set once the rows are built, below
        $muhurthamRowHeight = function ($fontPx, $padMm) use (&$hasPersonalNotes) {
            return $fontPx * 0.3528 * 1.5 + $padMm * 2 + 0.3 + ($hasPersonalNotes ? $fontPx * 0.3528 * 1.5 : 0);
        };

        $monthBlocks = [];
        foreach ($months as $monthIndex => $month) {
            $monthLabel = $isTa
                ? ($month['monthNameTa'] ?? $month['monthNameEn'] ?? '')
                : ($isHi ? ($month['monthNameHi'] ?? $month['monthNameEn'] ?? '') : ($month['monthNameEn'] ?? ''));
            $monthLabel = (string) $monthLabel;
            $rows = [];
            $bestInMonth = 0;
            $recommendedInMonth = 0;
            foreach ((array) ($month['days'] ?? []) as $day) {
                if (!is_array($day)) { continue; }
                $grade = strtoupper((string) ($day['grade'] ?? ''));
                if ($grade !== 'BEST' && $grade !== 'GOOD') { continue; }
                $recommendedInMonth++;
                if ($grade === 'BEST') { $bestInMonth++; }
                $dateStr = substr((string) ($day['date'] ?? ''), 0, 10);
                $dayNum = $dateStr;
                $weekday = (string) ($day['dayOfWeekName' . ($isTa ? 'Ta' : ($isHi ? 'Hi' : 'En'))] ?? '');
                $ts = strtotime($dateStr . ' UTC');
                if ($ts !== false) {
                    $dayNum = (string) (int) gmdate('j', $ts);
                    if ($weekday === '') { $weekday = $weekdayNames[(int) gmdate('w', $ts)]; }
                }
                $star = $isTa
                    ? ($day['nakshatraNameTa'] ?? $day['nakshatraNameEn'] ?? '')
                    : ($isHi ? ($day['nakshatraNameHi'] ?? $day['nakshatraNameEn'] ?? '') : ($day['nakshatraNameEn'] ?? ''));
                $isPersonal = self::isPersonalMuhurthamDay($day);
                $rows[] = [
                    'kind' => 'date',
                    'isPersonal' => $isPersonal,
                    'isBest' => ($grade === 'BEST'),
                    'dayNum' => $dayNum,
                    'weekday' => (string) $weekday,
                    'star' => (string) $star,
                    'nalla' => self::muhurthamNallaCompactLabel($day['nallaNeram'] ?? []),
                    'grade' => self::muhurthamGradeLabel($grade, $lang),
                    // Small per-date line proving the Chandrashtama / Tara Bala
                    // check ran for each person (mirrors the browser builder).
                    'note' => (string) ($isTa
                        ? ($day['personalNoteTa'] ?? $day['personalNoteEn'] ?? '')
                        : ($isHi ? ($day['personalNoteHi'] ?? $day['personalNoteEn'] ?? '') : ($day['personalNoteEn'] ?? '')))
                ];
            }
            $bandCounts = $recommendedInMonth
                ? ($bestInMonth . ' ' . $t['lblBest'] . '  ·  ' . ($recommendedInMonth - $bestInMonth) . ' ' . $t['lblGood'])
                : $t['lblNoDays'];
            if (count($rows) === 0) {
                $rows[] = ['kind' => 'note', 'text' => $t['lblNoDays']];
            }
            $monthBlocks[] = ['label' => $monthLabel, 'counts' => $bandCounts, 'rows' => $rows, 'recommended' => $recommendedInMonth];
        }

        $calendarRows = [];
        foreach ($monthBlocks as $blockIndex => $block) {
            $calendarRows[] = ['kind' => 'band', 'block' => $blockIndex, 'label' => $block['label'], 'counts' => $block['counts']];
            foreach ($block['rows'] as $row) {
                $row['block'] = $blockIndex;
                $calendarRows[] = $row;
            }
        }

        // When any date carries the ♥ mark, page 1 shows a one-line text legend
        // explaining how heart-marked dates differ from the other good dates.
        $hasPersonalDates = false;
        foreach ($calendarRows as $calendarRow) {
            if (!empty($calendarRow['isPersonal'])) { $hasPersonalDates = true; break; }
        }
        // Reserve the legend's height so date rows never overflow page 1.
        $effectivePage1BudgetMm = $page1BudgetMm - ($hasPersonalDates ? 11 : 0);
        if (!$singlePersonMode) { $effectivePage1BudgetMm -= 12; }
        // Every recommended row carries the per-date Chandrashtama / Tara Bala
        // line; reserve its height so no row is clipped.
        $hasPersonalNotes = false;
        foreach ($calendarRows as $calendarRow) {
            if (!empty($calendarRow['note'])) { $hasPersonalNotes = true; break; }
        }

        $density = $densityTiers[count($densityTiers) - 1];
        foreach ($densityTiers as $tier) {
            $tierRowHeight = $muhurthamRowHeight($tier['fontPx'], $tier['padMm']);
            $tierCapacity = (int) floor($effectivePage1BudgetMm / $tierRowHeight) + (int) floor($page2BudgetMm / $tierRowHeight) - 2;
            if ($tierCapacity >= count($calendarRows)) { $density = $tier; break; }
        }
        $rowHeightMm = $muhurthamRowHeight($density['fontPx'], $density['padMm']);
        if (count($calendarRows) * $rowHeightMm > ($effectivePage1BudgetMm + $page2BudgetMm)) {
            // Very wide scans: shrink instead of dropping any recommended date.
            $scale = (($effectivePage1BudgetMm + $page2BudgetMm) * 0.97) / (count($calendarRows) * $rowHeightMm);
            $density['fontPx'] = $density['fontPx'] * $scale;
            $density['padMm'] = $density['padMm'] * $scale;
            $rowHeightMm = $rowHeightMm * $scale;
        }
        $page1Capacity = max(4, (int) floor($effectivePage1BudgetMm / $rowHeightMm) - 1);
        $page2Capacity = max(0, (int) floor($page2BudgetMm / $rowHeightMm));
        $page1Rows = array_slice($calendarRows, 0, $page1Capacity);
        $page2Rows = array_slice($calendarRows, $page1Capacity);
        $page1Count = count($page1Rows);
        if ($page1Count > 1 && $page1Rows[$page1Count - 1]['kind'] === 'band' && count($page2Rows) > 0) {
            $orphan = array_pop($page1Rows);
            array_unshift($page2Rows, $orphan);
            $page1Count--;
        }
        $datesContinueOnPage2 = count($page2Rows) > 0;
        if ($datesContinueOnPage2 && $page2Rows[0]['kind'] !== 'band' && count($page2Rows) < $page2Capacity) {
            $carriedBlock = intval($page2Rows[0]['block']);
            $startedOnPage1 = false;
            foreach ($page1Rows as $row) {
                if (intval($row['block']) === $carriedBlock) { $startedOnPage1 = true; break; }
            }
            if ($startedOnPage1) {
                array_unshift($page2Rows, [
                    'kind' => 'band',
                    'block' => $carriedBlock,
                    'label' => $monthBlocks[$carriedBlock]['label'] . ' (' . $t['continued'] . ')',
                    'counts' => $monthBlocks[$carriedBlock]['counts']
                ]);
            }
        }

        $cellPad = number_format($density['padMm'], 2, '.', '');
        $cellFontPt = $density['fontPx'] * 0.75;
        $cellFont = number_format($cellFontPt, 2, '.', '');
        $bandFont = number_format($density['fontPx'] * 0.75 * 0.94, 2, '.', '');
        $renderCalendarTable = function ($rows) use ($cellPad, $cellFont, $cellFontPt, $bandFont, $t) {
            $html = '<table class="six-month-cal">';
            // Column widths mirror MUHURTHAM_DATE_COLUMN_RATIOS: the Nalla Neram
            // column is the widest because a row can carry three time windows.
            $html .= '<thead><tr>'
                . '<th style="width:19%;font-size:' . $cellFont . 'pt;padding:' . $cellPad . 'mm 1mm;">' . self::e($t['lblDate'] . ' / ' . $t['lblDay']) . '</th>'
                . '<th style="width:21%;font-size:' . $cellFont . 'pt;padding:' . $cellPad . 'mm 1mm;">' . self::e($t['lblStar']) . '</th>'
                . '<th style="width:46%;font-size:' . $cellFont . 'pt;padding:' . $cellPad . 'mm 1mm;">' . self::e($t['lblNalla']) . '</th>'
                . '<th style="width:14%;font-size:' . $cellFont . 'pt;padding:' . $cellPad . 'mm 1mm;">' . self::e($t['lblGrade']) . '</th>'
                . '</tr></thead><tbody>';
            foreach ($rows as $row) {
                if ($row['kind'] === 'band') {
                    $html .= '<tr class="cal-band"><td colspan="4" style="font-size:' . $bandFont . 'pt;padding:' . number_format($cellPad * 0.85, 2, '.', '') . 'mm 1mm;">'
                        . '<span class="band-label">' . self::e($row['label']) . '</span>'
                        . '<span class="band-counts">' . self::e($row['counts']) . '</span></td></tr>';
                    continue;
                }
                if ($row['kind'] === 'note') {
                    $html .= '<tr class="cal-note"><td colspan="4" style="font-size:' . $cellFont . 'pt;padding:' . $cellPad . 'mm 1mm;">' . self::e($row['text']) . '</td></tr>';
                    continue;
                }
                $rowClass = $row['isBest'] ? 'cal-best' : 'cal-good';
                $isPersonalRow = !empty($row['isPersonal']);
                if ($isPersonalRow) { $rowClass .= ' cal-personal'; }
                $personalBg = $isPersonalRow ? 'background:#fff1f2;' : '';
                $gradeClass = $row['isBest'] ? 'grade-best' : 'grade-good';
                // A three-window Nalla Neram line is wider than the column at the
                // larger densities: step that one cell down (same 80% floor as the
                // browser builders) so it cannot print across the grade cell.
                $timeLength = function_exists('mb_strlen') ? mb_strlen($row['nalla']) : strlen($row['nalla']);
                $timeScale = self::muhurthamTimeFontScale($timeLength, $cellFontPt);
                $timeFont = number_format($cellFontPt * $timeScale, 3, '.', '');
                $html .= '<tr class="' . $rowClass . '" style="font-size:' . $cellFont . 'pt;">'
                    . '<td class="cal-date" style="' . $personalBg . ($isPersonalRow ? 'border-left:1.2mm solid #9f1239;' : '') . 'padding:' . $cellPad . 'mm 1mm;"><b>' . self::e($row['dayNum']) . '</b> <span class="cal-weekday">' . self::e($row['weekday']) . '</span></td>'
                    . '<td class="cal-star" style="' . $personalBg . 'padding:' . $cellPad . 'mm 1mm;">' . ($isPersonalRow ? '<span class="personal-mark">&#9829;</span> ' : '') . self::e($row['star'])
                        . (!empty($row['note']) ? '<span class="cal-personal-note">' . self::e($row['note']) . '</span>' : '') . '</td>'
                    . '<td class="cal-time" style="' . $personalBg . 'padding:' . $cellPad . 'mm 1mm;font-size:' . $timeFont . 'pt;">' . self::e($row['nalla']) . '</td>'
                    . '<td class="cal-grade" style="' . $personalBg . 'padding:' . $cellPad . 'mm 0.5mm;"><span class="grade-pill ' . $gradeClass . '">' . self::e($row['grade']) . '</span></td>'
                    . '</tr>';
            }
            return $html . '</tbody></table>';
        };

        $clip = function ($text, $max) {
            $text = trim((string) $text);
            if (function_exists('mb_strlen') && function_exists('mb_substr')) {
                if (mb_strlen($text) <= $max) { return $text; }
                return rtrim(mb_substr($text, 0, $max)) . '…';
            }
            if (strlen($text) <= $max) { return $text; }
            return rtrim(substr($text, 0, $max)) . '...';
        };

        $orderNumberSafe = trim((string) ($order['order_number'] ?? $order['orderNumber'] ?? ''));
        $totalRecommendedDates = 0;
        foreach ($monthBlocks as $block) { $totalRecommendedDates += $block['recommended']; }

        $recommendedDatesLabel = $isTa ? 'பரிந்துரைக்கப்பட்ட தேதிகள்' : ($isHi ? 'अनुशंसित तिथियाँ' : 'recommended dates');
        $coverMeta = $eventTitle . ' • ' . $totalRecommendedDates . ' ' . $recommendedDatesLabel;
        $coverHeader = self::topHeader('ASTRO SIVAM', $t['docTitle'], $orderNumberSafe, 1, 2, $lang, $coverMeta);

        $page1DatesHtml = $renderCalendarTable($page1Rows);

        // Build the shared notes early: page 1 needs the ♥ legend copy from it.
        $notes = MuhurthamReportNotes::build($result, $event, $lang);
        $personalDatesNoteHtml = $hasPersonalDates
            ? '<div class="personal-dates-note">' . self::e($notes['personalMarkNote']) . '</div>'
            : '';

        $cover = '<div class="sheet muhurtham-sheet report-page-break">'
            . $coverHeader
            . '<div class="muhurtham-hero"><div class="hero-event">' . self::e($eventTitle) . '</div><div class="hero-window">' . self::e($windowLabel) . '</div></div>'
            . '<div class="sec-head"><span class="sec-no">01</span>' . ($singlePersonMode ? $t['secParticulars'] : $t['secCouple']) . '</div>'
            . ($singlePersonMode
                ? '<table class="details-grid">'
                    . '<tr><td class="lbl">' . $t['lblName'] . '</td><td>' . $devoteeName . '</td><td class="lbl">' . $t['lblDob'] . '</td><td>' . $dob . '</td></tr>'
                    . '<tr><td class="lbl">' . $t['lblTob'] . '</td><td>' . $tob . '</td><td class="lbl">' . $t['lblPlace'] . '</td><td><strong>' . $muhurthamPlace . '</strong><br><span class="muhurtham-location-note">' . $t['lblBirthPlace'] . ': ' . $birthPlace . '</span></td></tr>'
                    . (!empty($persons[0])
                        ? '<tr><td class="lbl">' . $t['lblStar'] . '</td><td>' . self::e($persons[0]['star']) . ' · ' . $t['lblRasi'] . ': ' . self::e($persons[0]['rasi']) . '</td><td class="lbl">' . $t['lblLagna'] . '</td><td>' . self::e($persons[0]['lagna']) . '</td></tr>'
                        : '')
                    . '</table>'
                    . (count($persons) < 2 ? '<div class="single-person-note">' . self::e($t['singlePersonNote']) . '</div>' : '')
                : '<table class="couple-grid">'
                    . '<tr><td class="person-cell">' . self::muhurthamPersonCell($bridePerson, $t['lblBride'], $t) . '</td>'
                    . '<td class="person-cell">' . self::muhurthamPersonCell($groomPerson, $t['lblGroom'], $t) . '</td></tr>'
                    . '</table>'
                    . '<div class="couple-place">' . $t['lblPlace'] . ': <strong>' . $muhurthamPlace . '</strong> · <span class="muhurtham-location-note">' . $t['lblBirthPlace'] . ': ' . $birthPlace . '</span></div>')
            . ($eventDescription !== '' ? '<div class="event-desc">' . self::e($eventDescription) . '</div>' : '')
            . '<div class="sec-head"><span class="sec-no">02</span>' . self::e($t['datesTitle']) . '<span class="sec-note">' . self::e($t['datesSub']) . '</span></div>'
            . $personalDatesNoteHtml
            . $page1DatesHtml
            . self::footerBand($lang)
            . '</div>';

        // ---- Page 2 - date continuation, then the selection guide ----
        $checksHeading = (string) ($notes['checksHeading'] ?? '');
        $checksText = (string) ($notes['checksText'] ?? '');
        $selectionGuide = '<div class="muhurtham-selection-notes">'
            . '<h2>' . self::e($notes['title']) . '</h2>'
            // The paragraph that names every check is always present, so the
            // heading can never render with no body under it.
            . (($checksHeading !== '' || $checksText !== '')
                ? '<p><b>' . self::e($checksHeading) . '</b><br/>' . self::e($checksText) . '</p>'
                : '')
            . (!empty($notes['weekdayText'])
                ? '<p><b>' . self::e($notes['weekdayHeading']) . '</b><br/>' . self::e($notes['weekdayText']) . '</p>'
                : '')
            . '<p><b>' . self::e($notes['selectionHeading']) . '</b><br/>'
            . ($notes['summaryText'] !== '' ? '<span class="selection-counts">' . self::e($notes['summaryText']) . '</span><br/>' : '')
            . self::e($notes['selectionText']) . '</p></div>';
        $upperHalf = '';
        if ($datesContinueOnPage2) {
            $upperHalf = '<div class="sec-head"><span class="sec-no">02</span>' . self::e($t['datesTitle'])
                . '<span class="sec-note">' . self::e($t['continued']) . '</span></div>'
                . $renderCalendarTable($page2Rows);
        } else {
            $upperHalf = '<div class="sec-head"><span class="sec-no">02</span>' . self::e($t['datesTitle']) . '</div>'
                . '<div style="text-align:center; padding:12mm 4mm; color:#64748b; font-weight:bold;">✓ All ' . $totalRecommendedDates . ' recommended dates are listed on page 1.</div>';
        }

        // A table-cell height is a minimum in mPDF, unlike unsupported
        // min-height on divs. 6mm page margin + 6mm sheet padding + 104mm
        // upper content + 3mm guide margin puts the guide at 119mm on A4; that
        // leaves room for the three-paragraph explanation plus the
        // authorisation block on the same sheet.
        // Longer continuations expand the cell and keep the guide below dates.
        $secondPage = '<div class="sheet muhurtham-sheet">'
            . '<table class="muhurtham-page2-upper"><tr><td style="height:100mm;padding:0;vertical-align:top;">'
            . self::topHeader('ASTRO SIVAM', $t['docTitle'] . ' - ' . $t['continued'], $orderNumberSafe, 2, 2, $lang, $eventTitle . ' • Clean dates only')
            . $upperHalf
            . '</td></tr></table>'
            . $selectionGuide
            . self::muhurthamAttestation($result, $t, $orderNumberSafe, $singlePersonMode, $bridePerson, $groomPerson, $devoteeName)
            . self::footerBand($lang)
            . '</div>';

        $muhurthamCss = '
    .muhurtham-sheet { page-break-inside: auto; }
    table.muhurtham-page2-upper { width:100%; border-collapse:collapse; margin:0; }
    .muhurtham-selection-notes { page-break-inside: avoid; margin-top: 2.4mm; border: 0.5px solid #e2e8f0; border-left: 2px solid #c9962c; border-radius: 3px; background: #fffaf0; padding: 2.4mm 3.4mm; color: #334155; font-size: 14.4px; line-height: 1.36; }
    .muhurtham-selection-notes h2 { color: #7a1f1f; font-size: 16.5px; font-weight: bold; margin: 0; line-height: 1.28; }
    .muhurtham-selection-notes p { margin: 1.6mm 0 0; }
    .muhurtham-selection-notes b { color: #7a1f1f; font-size: 15px; }
    .muhurtham-selection-notes .selection-counts { color: #166534; font-weight: bold; }
    .muhurtham-hero { background: #fdf3e0; border: 1.5px solid #c9962c; border-radius: 4px; padding: 2mm 3mm; text-align: center; margin-bottom: 2.5mm; }
    .muhurtham-hero .hero-event { font-size: 12.5px; font-weight: bold; color: #7a1f1f; }
    .muhurtham-hero .hero-window { font-size: 8.6px; color: #2d5a3d; font-weight: bold; margin-top: 0.8mm; }
    .details-grid .lbl { background: #fdf3e0; color: #7a1f1f; font-weight: bold; width: 15%; }
    table.couple-grid { width: 100%; border-collapse: separate; border-spacing: 2mm 0; margin: 0 0 1.5mm; }
    .person-cell { width: 50%; vertical-align: top; background: #fdfaf2; border: 0.4px solid #e5d9c5; border-radius: 2px; padding: 1.6mm 2.4mm; }
    .person-role { color: #a67c1f; font-size: 7.2px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; }
    .person-name { color: #7a1f1f; font-size: 11px; font-weight: bold; }
    .person-meta { color: #334155; font-size: 7.6px; }
    .person-astro { color: #2b1d14; font-size: 8px; font-weight: bold; }
    .person-astro .lbl-mini { color: #64748b; font-weight: normal; }
    .person-place { color: #64748b; font-size: 7px; }
    .couple-place { margin: 0 0 1.6mm; color: #334155; font-size: 7.6px; }
    .single-person-note { margin: 1.2mm 0 0; background: #fffbeb; border: 0.4px solid #fde68a; border-left: 1.2mm solid #c9962c; padding: 1.1mm 2mm; color: #78350f; font-size: 7.6px; font-weight: bold; }
    .muhurtham-auth { width: 100%; border-collapse: collapse; margin-top: 3mm; border: 0.4px solid #c9962c; background: #fffdf5; }
    .muhurtham-auth td { padding: 1.6mm 2.6mm; vertical-align: middle; }
    .muhurtham-auth .auth-label { color: #a67c1f; font-size: 6.6px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
    .muhurtham-auth .auth-value { color: #7a1f1f; font-size: 8px; font-weight: bold; }
    .muhurtham-auth .signature-rule { border-top: 0.4px solid #64748b; width: 26mm; margin: 0 auto; }
    .muhurtham-auth .signatory-label { color: #64748b; font-size: 6.6px; text-align: center; }
    .muhurtham-auth .signatory-desk { color: #7a1f1f; font-size: 7.6px; font-weight: bold; text-align: center; }
    .muhurtham-location-note { display:inline-block; margin-top:0.8mm; color:#64748b; font-size:7px; font-weight:normal; }
    .sec-note { float: right; font-size: 7.4px; color: #6b5540; font-weight: normal; letter-spacing: 0; text-transform: none; }
    table.six-month-cal { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
    .six-month-cal th { background: #7a1f1f; color: #fff; text-align: left; font-weight: bold; letter-spacing: 0.3px; border: 0.4px solid #7a1f1f; }
    .six-month-cal td { border-bottom: 0.4px solid #e8d9b8; color: #2b1d14; vertical-align: middle; line-height: 1.15; overflow: hidden; }
    .six-month-cal .cal-band td { background: #fdf3e0; border-top: 0.6px solid #c9962c; border-bottom: 0.6px solid #c9962c; }
    .six-month-cal .band-label { color: #7a1f1f; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
    .six-month-cal .band-counts { float: right; color: #166534; font-weight: bold; }
    .six-month-cal .cal-best { background: #f4fbf7; }
    .personal-mark { color: #be123c; font-weight: bold; }
    /* One-line text legend explaining the ♥ mark; no extra panel or feature. */
    .personal-dates-note { margin: 1mm 0 1.4mm; background: #fff1f2; border: 0.4px solid #fecdd3; border-left: 1.2mm solid #be123c; padding: 1.2mm 2mm; color: #7a1f1f; font-size: 8.4px; font-weight: bold; line-height: 1.4; }
    .six-month-cal .cal-good { background: #fffdf7; }
    .six-month-cal .cal-date b { color: #7a1f1f; font-size: 1.42em; }
    .six-month-cal .cal-weekday { color: #a67c1f; font-weight: bold; overflow: hidden; text-overflow: ellipsis; }
    .six-month-cal .cal-star { color: #7a1f1f; overflow: hidden; text-overflow: ellipsis; }
    .six-month-cal .cal-personal-note { display: block; color: #64748b; font-size: 0.82em; font-weight: normal; line-height: 1.15; }
    .six-month-cal .cal-time { color: #2b1d14; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .six-month-cal .cal-grade { text-align: center; overflow: hidden; }
    .six-month-cal .cal-note td { background: #f8fafc; color: #64748b; font-style: italic; text-align: center; }
    .grade-pill { display: inline-block; font-size: 0.92em; font-weight: bold; padding: 0.2mm 1mm; border-radius: 2px; white-space: nowrap; overflow: hidden; max-width: 100%; }
    .grade-best { background: #166534; color: #fff; }
    .grade-good { background: #d1fae5; color: #166534; border: 0.4px solid #166534; }
    .method-cert { border: 0.5px dashed #c9962c; border-radius: 3px; background: #fdf3e0; color: #7a1f1f; font-size: 7.2px; font-weight: bold; padding: 0.9mm 1.6mm; margin-top: 1.2mm; text-align: center; letter-spacing: 0.3px; }
        ';

        $css = self::sharedCss($lang) . $muhurthamCss;

        return '<!DOCTYPE html><html lang="' . self::e($lang) . '"><head><meta charset="UTF-8"><title>ASTRO SIVAM - Subha Muhurtham Report</title><style>' . $css . '</style></head><body>'
            . $cover . $secondPage
            . '</body></html>';
    }

    /** Compact "6:35 – 8:01 AM · 9:27 – 10:52 AM" label so every Nalla Neram
     *  window fits on one table row (the six-month calendar has to stay on 2 pages). */
    private static function muhurthamNallaCompactLabel($windows): string {
        if (!is_array($windows) || count($windows) === 0) { return '—'; }
        $labels = [];
        foreach ($windows as $window) {
            if (is_array($window)) {
                $start = self::muhurthamCompactClock($window['start'] ?? '');
                $end = self::muhurthamCompactClock($window['end'] ?? '');
                if ($start !== '' && $end !== '') {
                    $sameMeridiem = (substr($start, -2) === substr($end, -2));
                    $labels[] = $sameMeridiem ? (substr($start, 0, -3) . ' – ' . $end) : ($start . ' – ' . $end);
                    continue;
                }
                $labels[] = trim(((string) ($window['start'] ?? '')) . ' – ' . ((string) ($window['end'] ?? '')), ' –');
                continue;
            }
            $labels[] = trim((string) $window);
        }
        $labels = array_values(array_filter($labels, function ($label) { return $label !== ''; }));
        return count($labels) ? implode(' · ', $labels) : '—';
    }

    /**
     * Mirrors muhurthamTimeFontScale() in src/services/muhurthamHtmlBuilder.ts: a
     * Nalla Neram line that is wider than its 46% column is printed smaller (down to
     * 80%) instead of printing across the grade cell. $fontPt is the typographic size
     * of the row font; the printable width is 188mm x 46% minus the cell padding, the
     * clock gap and the clock glyph.
     */
    private static function muhurthamTimeFontScale($textLength, $fontPt) {
        $textLength = (float) $textLength;
        $fontPt = (float) $fontPt;
        if ($textLength <= 0 || $fontPt <= 0) { return 1.0; }
        $textWidthMm = 188 * 0.46 - 2 - 4;
        $capacity = $textWidthMm / (0.62 * $fontPt * 0.3528);
        if ($textLength <= $capacity) { return 1.0; }
        return max(0.8, $capacity / $textLength);
    }

    /** BEST/GOOD date with auspicious Tara Balam and no Chandrashtama for every person
     *  (mirrors isPersonalMuhurthamDay() in src/services/muhurthamHtmlBuilder.ts). */
    private static function isPersonalMuhurthamDay($day): bool {
        $grade = strtoupper((string) ($day['grade'] ?? ''));
        if ($grade !== 'BEST' && $grade !== 'GOOD') { return false; }
        $checks = array_values(array_filter((array) ($day['personalChecks'] ?? []), 'is_array'));
        if (count($checks) === 0) { return false; }
        foreach ($checks as $c) {
            if (empty($c['isTaraAuspicious']) || !empty($c['isChandrashtama']) || !empty($c['isJanmaNakshatra'])) { return false; }
        }
        return true;
    }

    /**
     * One bride/groom card: name, birth details and their own Janma Nakshatra,
     * Rasi and Lagna (mirrors the browser builder's person card).
     */
    private static function muhurthamPersonCell($person, string $roleLabel, array $t): string {
        if (!is_array($person)) { return ''; }
        $meta = trim($person['dob'] . ($person['tob'] !== '' ? ' · ' . self::muhurthamClock($person['tob']) : ''));
        return '<div class="person-role">' . self::e($roleLabel) . '</div>'
            . '<div class="person-name">' . self::e($person['name'] !== '' ? $person['name'] : '—') . '</div>'
            . '<div class="person-meta">' . self::e($meta) . '</div>'
            . '<div class="person-astro"><span class="lbl-mini">' . self::e($t['lblStar']) . '</span> ' . self::e($person['star'] !== '' ? $person['star'] : '—')
            . ' · <span class="lbl-mini">' . self::e($t['lblRasi']) . '</span> ' . self::e($person['rasi'] !== '' ? $person['rasi'] : '—')
            . ($person['lagna'] !== '' ? ' · <span class="lbl-mini">' . self::e($t['lblLagna']) . '</span> ' . self::e($person['lagna']) : '')
            . '</div>'
            . ($person['place'] !== '' ? '<div class="person-place">' . self::e($person['place']) . '</div>' : '');
    }

    /** 12-hour clock for a person's birth time ("02:00 AM"). */
    private static function muhurthamClock($value): string {
        if (!preg_match('/^(\d{1,2}):(\d{2})/', trim((string) $value), $m)) { return (string) $value; }
        $hour = intval($m[1]);
        return (($hour % 12) ?: 12) . ':' . $m[2] . ' ' . ($hour >= 12 ? 'PM' : 'AM');
    }

    /**
     * Authorisation block: reference number, issued-on, prepared-for and the
     * signatory desk — the same block the marriage report prints.
     */
    private static function muhurthamAttestation($result, array $t, string $orderNumber, bool $singlePersonMode, $bridePerson, $groomPerson, string $devoteeName): string {
        $generatedAt = (string) ($result['generatedAt'] ?? '');
        $timeZoneId = (string) ($result['muhurthamTimeZoneId'] ?? '');
        $issuedOn = self::muhurthamIssuedOn($generatedAt !== '' ? $generatedAt : 'now', $timeZoneId);
        $stamp = date('Ymd', $generatedAt !== '' ? (int) strtotime($generatedAt) : time());
        $referenceNo = $orderNumber !== '' ? $orderNumber : 'ASTRO-MUH-' . $stamp;
        $preparedFor = $singlePersonMode
            ? $devoteeName
            : self::e(trim((string) ($bridePerson['name'] ?? '')) . ' & ' . trim((string) ($groomPerson['name'] ?? '')));
        return '<table class="muhurtham-auth"><tr>'
            . '<td style="width:24%;"><div class="auth-label">' . self::e($t['lblReference']) . '</div><div class="auth-value">' . self::e($referenceNo) . '</div></td>'
            . '<td style="width:30%;"><div class="auth-label">' . self::e($t['lblIssuedOn']) . '</div><div class="auth-value">' . self::e($issuedOn) . '</div></td>'
            . '<td style="width:26%;"><div class="auth-label">' . self::e($t['lblPreparedFor']) . '</div><div class="auth-value">' . $preparedFor . '</div></td>'
            . '<td style="width:20%;"><div class="signature-rule"></div><div class="signatory-label">' . self::e($t['lblSignatory']) . '</div><div class="signatory-desk">' . self::e($t['signatoryDesk']) . '</div></td>'
            . '</tr></table>';
    }

    /** THE report date format: "07 Oct 2026" (mirrors formatReportDate() in the builders). */
    public static function muhurthamReportDate($value): string {
        $iso = substr(trim((string) $value), 0, 10);
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $iso, $m)) { return $iso; }
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return $m[3] . ' ' . $months[intval($m[2]) - 1] . ' ' . $m[1];
    }

    /** Issued-on stamp in the report timezone, matching the marriage report. */
    public static function muhurthamIssuedOn($value, string $timeZoneId = ''): string {
        $timestamp = strtotime((string) $value);
        if ($timestamp === false) { $timestamp = time(); }
        try {
            $zone = $timeZoneId !== '' ? new \DateTimeZone($timeZoneId) : new \DateTimeZone(date_default_timezone_get());
            $date = new \DateTime('@' . $timestamp);
            $date->setTimezone($zone);
            return $date->format('d M Y, H:i T');
        } catch (\Throwable $e) {
            return gmdate('d M Y, H:i', $timestamp) . ' UTC';
        }
    }

    private static function muhurthamCompactClock($value): string {
        if (preg_match('/^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i', trim((string) $value), $match)) {
            return intval($match[1]) . ':' . $match[2] . ' ' . strtoupper($match[3]) . 'M';
        }
        return '';
    }

    private static function muhurthamGradeClass($grade): string {
        $grade = strtoupper((string) $grade);
        if ($grade === 'BEST') { return 'grade-best'; }
        if ($grade === 'GOOD') { return 'grade-good'; }
        if ($grade === 'AVOID') { return 'grade-avoid'; }
        return 'grade-fair';
    }

    private static function muhurthamGradeLabel($grade, $lang): string {
        $grade = strtoupper((string) $grade);
        $map = [
            'BEST' => ['BEST', 'உத்தமம்', 'उत्तम'],
            'GOOD' => ['GOOD', 'சுபம்', 'शुभ'],
            'FAIR' => ['FAIR', 'மிதமான்', 'सामान्य'],
            'AVOID' => ['AVOID', 'விலக்கு', 'वर्जित']
        ];
        $row = $map[$grade] ?? $map['FAIR'];
        return $lang === 'ta' ? $row[1] : ($lang === 'hi' ? $row[2] : $row[0]);
    }

    private static function muhurthamWindowListLabel($windows): string {
        return self::muhurthamNallaCompactLabel($windows);
    }

    // =====================================================================
    // BABY NAMING - 2 PAGE HTML
    // =====================================================================
    /**
     * Normalize cached page-2 entries and attach all three meaning variants.
     *
     * The English meaning is the source value and is always re-localized from
     * the curated glossary, so an order whose cached Tamil/Hindi text was
     * written by an older (word-by-word) localizer prints the corrected text
     * without a database migration. A cached localized meaning is only kept
     * when the entry carries no English meaning at all.
     */
    private static function localizeNamakaranColumns($columns): array {
        $columns = is_array($columns) ? $columns : [];
        foreach ($columns as &$column) {
            if (!is_array($column)) { continue; }
            foreach (['south', 'north'] as $side) {
                $entries = is_array($column[$side] ?? null) ? $column[$side] : [];
                foreach ($entries as &$entry) {
                    if (!is_array($entry)) { continue; }
                    $english = trim((string) ($entry['meaningEn'] ?? $entry['meaning'] ?? ''));
                    $entry['meaning'] = $entry['meaning'] ?? $english;
                    $entry['meaningEn'] = $english;
                    if ($english === '') {
                        continue;
                    }
                    if (class_exists('AstroEngine')) {
                        $entry['meaningTa'] = AstroEngine::localizeNamakaranMeaning($english, 'ta');
                        $entry['meaningHi'] = AstroEngine::localizeNamakaranMeaning($english, 'hi');
                    } else {
                        $entry['meaningTa'] = $english;
                        $entry['meaningHi'] = $english;
                    }
                }
                $column[$side] = $entries;
            }
        }
        unset($column, $entry);
        return $columns;
    }

    public static function generateBabyNamingHtml($order, $result): string {
        $lang = astro_report_normalize_language($order['language'] ?? 'en');
        $isTa = ($lang === 'ta');
        $isHi = ($lang === 'hi');

        // A stored report created before the 108-pada fix must never be
        // rendered with Ashwini's Chu/Che/Cho/La fallback. Recalculate it
        // from the original birth details before generating a preview/PDF.
        if (class_exists('AstroEngine') && !AstroEngine::isCurrentBabyNamingResult($result)) {
            $input = $order['input_payload'] ?? [];
            if (!is_array($input)) {
                $input = json_decode((string) $input, true) ?: [];
            }
            if (!empty($input)) {
                $result = AstroEngine::calculateBabyNaming($input);
            }
        }

        $orderNumber = $order['order_number'] ?? $order['orderNumber'] ?? 'ORD-BABY';
        $genderCode = strtoupper((string) ($result['gender'] ?? 'M')) === 'F' ? 'F' : 'M';
        $gender = self::e($genderCode === 'M' ? ($isTa ? 'ஆண் குழந்தை' : ($isHi ? 'बालक' : 'Baby Boy')) : ($isTa ? 'பெண் குழந்தை' : ($isHi ? 'बालिका' : 'Baby Girl')));
        $babyName = self::e($result['babyName'] ?? ($genderCode === 'M' ? 'Baby Boy' : 'Baby Girl'));

        $nakshatraLetters = is_array($result['nakshatraLetters'] ?? null) ? $result['nakshatraLetters'] : [];
        $rajjuTable = json_decode(file_get_contents(__DIR__ . '/rajju.json'), true, 512, JSON_THROW_ON_ERROR);
        $starIndex = intval($nakshatraLetters['nakshatraIndex'] ?? 0);
        if ($starIndex < 1 || $starIndex > 27) throw new RuntimeException('Invalid naming Nakshatra');
        $rajjuGroup = $rajjuTable['groups'][$starIndex - 1];
        foreach (['En' => 'en', 'Ta' => 'ta', 'Hi' => 'hi'] as $suffix => $language) {
            $nakshatraLetters['rajju' . $suffix] = $rajjuTable[$language][$rajjuGroup];
        }
        $padas = is_array($nakshatraLetters['padas'] ?? null) ? $nakshatraLetters['padas'] : [];
        $verifiedPadas = [];
        foreach ($padas as $padaInfo) {
            if (!is_array($padaInfo)) { continue; }
            $padaRaw = $padaInfo['padaNumber'] ?? null;
            if (!is_numeric($padaRaw) || (float) $padaRaw !== (float) (int) $padaRaw) { continue; }
            $padaNumber = (int) $padaRaw;
            if ($padaNumber >= 1 && $padaNumber <= 4 && !empty($padaInfo['letterEn'])) {
                $verifiedPadas[$padaNumber] = $padaInfo;
            }
        }
        ksort($verifiedPadas);
        if (array_keys($verifiedPadas) !== [1, 2, 3, 4]) {
            throw new RuntimeException('Cannot render Baby Naming report without all four verified birth-star padas.');
        }
        $padas = array_values($verifiedPadas);
        $birthPadaRaw = $result['janmaPada'] ?? $nakshatraLetters['pada'] ?? null;
        if (!is_numeric($birthPadaRaw) || (float) $birthPadaRaw !== (float) (int) $birthPadaRaw || (int) $birthPadaRaw < 1 || (int) $birthPadaRaw > 4) {
            throw new RuntimeException('Cannot render Baby Naming report without a verified birth pada.');
        }
        $birthPada = (int) $birthPadaRaw;
        $primaryPada = null;
        foreach ($padas as $padaInfo) {
            if ((int) $padaInfo['padaNumber'] === $birthPada) {
                $primaryPada = $padaInfo;
                break;
            }
        }
        if (!is_array($primaryPada) || empty($primaryPada['letterEn'])) {
            throw new RuntimeException('Cannot render Baby Naming report without the birth-pada syllable.');
        }
        $savedChandraRasi = self::validRasiNumber($result['chandraRasi'] ?? null);
        $padaChandraRasi = self::validRasiNumber($primaryPada['rasi'] ?? null);
        $resolvedChandraRasi = $savedChandraRasi !== null && $padaChandraRasi !== null && $savedChandraRasi !== $padaChandraRasi
            ? null
            : ($savedChandraRasi ?? $padaChandraRasi);
        $rasi = self::e(self::rasiNameForNumber($resolvedChandraRasi, $lang));
        $nak = self::e($isTa ? ($nakshatraLetters['nakshatraNameTa'] ?? $result['janmaNakshatraTa'] ?? 'N/A') : ($isHi ? ($nakshatraLetters['nakshatraNameHi'] ?? 'N/A') : ($nakshatraLetters['nakshatraNameEn'] ?? $result['janmaNakshatraEn'] ?? 'N/A')));
        $pada = self::e($birthPada);
        $dob = self::e(self::birthDate($result['dob'] ?? '', 'N/A'));
        $tob = self::e($result['tob'] ?? 'N/A');
        $birthPlaceRaw = trim((string) ($result['birthPlace'] ?? 'N/A'));
        $countryRaw = trim((string) ($result['country'] ?? ''));
        $birthPlace = self::e($countryRaw && stripos($birthPlaceRaw, $countryRaw) === false ? $birthPlaceRaw . ', ' . $countryRaw : $birthPlaceRaw);

        $lagna = self::e(self::rasiNameForNumber($result['lagnaRasi'] ?? null, $lang));
        $lord = self::e($isTa ? ($nakshatraLetters['lordTa'] ?? 'N/A') : ($isHi ? ($nakshatraLetters['lordHi'] ?? 'N/A') : ($nakshatraLetters['lordEn'] ?? 'N/A')));
        $gana = self::e($isTa ? ($nakshatraLetters['ganaTa'] ?? 'N/A') : ($isHi ? ($nakshatraLetters['ganaHi'] ?? 'N/A') : ($nakshatraLetters['ganaEn'] ?? 'N/A')));
        $yoni = self::e($isTa ? ($nakshatraLetters['yoniTa'] ?? 'N/A') : ($isHi ? ($nakshatraLetters['yoniHi'] ?? 'N/A') : ($nakshatraLetters['yoniEn'] ?? 'N/A')));
        $rajju = self::e($isTa ? ($nakshatraLetters['rajjuTa'] ?? 'N/A') : ($isHi ? ($nakshatraLetters['rajjuHi'] ?? 'N/A') : ($nakshatraLetters['rajjuEn'] ?? 'N/A')));

        $syllableList = is_array($result['suggestedSyllables'] ?? null)
            ? $result['suggestedSyllables']
            : (is_array($result['startingSyllables'] ?? null) ? $result['startingSyllables'] : array_map(function ($p) { return $p['letterEn'] ?? ''; }, $padas));
        $syllableList = array_values(array_filter($syllableList, function ($sound) { return trim((string) $sound) !== ''; }));
        $syllables = self::e(implode(', ', $syllableList));
        $primarySyllable = self::e($isTa ? ($primaryPada['letterTa'] ?? '') : ($isHi ? ($primaryPada['letterHi'] ?? '') : ($primaryPada['letterEn'] ?? '')));
        $primaryTransliteration = self::e($primaryPada['letterEn'] ?? '');

        $padaRows = '';
        foreach ($padas as $padaInfo) {
            $isBirthPada = intval($padaInfo['padaNumber'] ?? 0) === $birthPada;
            $sound = $isTa ? ($padaInfo['letterTa'] ?? '') : ($isHi ? ($padaInfo['letterHi'] ?? '') : ($padaInfo['letterEn'] ?? ''));
            $rasiForPada = self::rasiNameForNumber((($starIndex - 1) * 4 + intval($padaInfo['padaNumber']) - 1) % 12 + 1, $lang);
            $padaLabel = ($isTa ? 'பாதம் ' : ($isHi ? 'पाद ' : 'Pada ')) . intval($padaInfo['padaNumber'] ?? 0);
            $badge = $isBirthPada
                ? ' <span class="mini-badge">' . ($isTa ? 'ஜன்ம பாதம்' : ($isHi ? 'जन्म पाद' : 'JANMA PADA')) . '</span>'
                : '';
            $rowStyle = $isBirthPada ? ' class="birth-row"' : '';
            $padaRows .= '<tr' . $rowStyle . '><td><b>' . self::e($padaLabel) . '</b>' . $badge . '</td><td><b>' . self::e($sound) . '</b> <span class="translit">(' . self::e($padaInfo['letterEn'] ?? '') . ')</span></td><td>' . self::e($rasiForPada) . '</td></tr>';
        }
        if ($padaRows === '') {
            $padaRows = '<tr><td colspan="3">' . ($isTa ? 'இந்த பதிவுக்கு பாத அக்ஷரங்கள் இல்லை.' : ($isHi ? 'इस रिकॉर्ड हेतु पाद अक्षर उपलब्ध नहीं हैं।' : 'No pada syllables are available for this record.')) . '</td></tr>';
        }

        $nameRows = '';
        $idx = 1;
        foreach (($result['suggestedNames'] ?? []) as $n) {
            $nName = $isTa ? ($n['nameTa'] ?? $n['nameEn'] ?? '') : ($isHi ? ($n['nameHi'] ?? $n['nameEn'] ?? '') : ($n['nameEn'] ?? ''));
            $nMeaning = $isTa ? ($n['meaningTa'] ?? $n['meaningEn'] ?? '') : ($isHi ? ($n['meaningHi'] ?? $n['meaningEn'] ?? '') : ($n['meaningEn'] ?? ''));
            $nameRows .= '<tr><td class="name-cell">' . self::e($nName) . '</td><td class="sound-cell">' . self::e($n['startingLetter'] ?? '') . '</td><td>' . self::e($nMeaning) . '</td></tr>';
            $idx++;
        }
        $namesSection = $nameRows === '' ? '' : '<div class="sec-head"><span class="sec-no">06</span>' . ($isTa ? 'பரிந்துரைக்கப்பட்ட பெயர்கள்' : ($isHi ? 'सुझावित नाम' : 'SUGGESTED SACRED NAMES')) . '</div><table class="data-table names-table"><thead><tr><th width="30%">' . ($isTa ? 'பரிந்துரை பெயர்' : ($isHi ? 'सुझावित नाम' : 'SUGGESTED NAME')) . '</th><th width="22%">' . ($isTa ? 'ஒலி' : ($isHi ? 'ध्वनि' : 'SOUND')) . '</th><th>' . ($isTa ? 'பொருள்' : ($isHi ? 'अर्थ' : 'MEANING')) . '</th></tr></thead><tbody>' . $nameRows . '</tbody></table>';

        // ── Localized labels ──
        $invocation = $isTa ? '|| ॐ விநாயகாய நமஃ ||' : ($isHi ? '|| ॐ श्री गणेशाय नमः ||' : '|| Om Sri Ganeshaya Namah ||');
        $brandTagline = $isTa ? 'வேத ஜோதிடம் • பஞ்சாங்கம் • நாமகரண சேவைகள்' : ($isHi ? 'वैदिक ज्योतिष • पंचांग • नामकरण सेवाएं' : 'VEDIC ASTROLOGY &bull; PANCHANGAM &bull; NAMAKARAN SERVICES');
        $docTitle = $isTa ? 'வேத நாமகரண அறிக்கை' : ($isHi ? 'वैदिक नामकरण रिपोर्ट' : 'Vedic Namakaran Report');
        $docSubtitle = $isTa ? 'குழந்தை பெயர் சூட்டு சான்றிதழ் — ஜன்ம நட்சத்திரம் & சுப அக்ஷரங்கள்' : ($isHi ? 'शिशु नामकरण प्रमाणपत्र — जन्म नक्षत्र एवं शुभ अक्षर' : 'Certified Baby Naming Dossier &mdash; Janma Nakshatra &amp; Auspicious Syllables');
        $lblReportNo = $isTa ? 'அறிக்கை எண்' : ($isHi ? 'रिपोर्ट सं.' : 'REPORT NO');
        $lblIssueDate = $isTa ? 'வழங்கிய தேதி' : ($isHi ? 'जारी तिथि' : 'ISSUE DATE');
        $lblLanguage = $isTa ? 'மொழி' : ($isHi ? 'भाषा' : 'LANGUAGE');
        $langName = $isTa ? 'தமிழ்' : ($isHi ? 'हिन्दी' : 'English');
        $sec1 = $isTa ? 'குழந்தை விபரம்' : ($isHi ? 'शिशु का विवरण' : 'BABY PARTICULARS');
        $sec2 = $isTa ? 'ஜோதிட கணிப்புகள்' : ($isHi ? 'ज्योतिषीय गणना' : 'ASTROLOGICAL COORDINATES');
        $sec3 = $isTa ? 'சுப நாமகரண அக்ஷரம்' : ($isHi ? 'शुभ नामकरण अक्षर' : 'PRIMARY NAMING SYLLABLE');
        $sec4 = $isTa ? 'நட்சத்திர பாத அக்ஷரங்கள்' : ($isHi ? 'नक्षत्र पाद अक्षर' : 'NAKSHATRA PADA SYLLABLES');
        $sec5 = $isTa ? 'வேத குணநலன்கள்' : ($isHi ? 'वैदिक गुण' : 'VEDIC GUNAM & VIRTUES');

        $lblBabyName = $isTa ? 'குழந்தையின் பெயர்' : ($isHi ? 'शिशु का नाम' : 'BABY NAME');
        $lblGender = $isTa ? 'பாலினம்' : ($isHi ? 'लिंग' : 'GENDER');
        $lblDob = $isTa ? 'பிறந்த தேதி' : ($isHi ? 'जन्म तिथि' : 'DATE OF BIRTH');
        $lblTob = $isTa ? 'பிறந்த நேரம்' : ($isHi ? 'जन्म समय' : 'TIME OF BIRTH');
        $lblPlace = $isTa ? 'பிறந்த இடம்' : ($isHi ? 'जन्म स्थान' : 'PLACE OF BIRTH');
        $lblLagna = $isTa ? 'லக்னம்' : ($isHi ? 'लग्न' : 'LAGNAM (ASCENDANT)');
        $lblNak = $isTa ? 'ஜன்ம நட்சத்திரம்' : ($isHi ? 'जन्म नक्षत्र' : 'JANMA NAKSHATRA');
        $lblPada = $isTa ? 'பாதம்' : ($isHi ? 'पाद / चरण' : 'JANMA PADA');
        $lblRasi = $isTa ? 'சந்திர ராசி' : ($isHi ? 'चंद्र राशि' : 'CHANDRA RASI (MOON)');
        $lblLord = $isTa ? 'நட்சத்திர அதிபதி' : ($isHi ? 'नक्षत्र स्वामी' : 'NAKSHATRA LORD');
        $lblGana = $isTa ? 'கணம்' : ($isHi ? 'गण' : 'GANA');
        $lblYoni = $isTa ? 'யோனி' : ($isHi ? 'योनि' : 'YONI');
        $lblRajju = $isTa ? 'ரஜ்ஜு' : ($isHi ? 'रज्जु' : 'RAJJU');

        $heroTitle = $isTa ? 'ஜன்ம பாதத்தின் முதன்மை சுப ஒலி' : ($isHi ? 'जन्म पाद का प्रमुख शुभ ध्वनि' : 'PRIMARY AUSPICIOUS SOUND FOR THE JANMA PADA');
        $heroDesc = $isTa
            ? "வேத வானியல் கணிதப்படி, {$nak} நட்சத்திரம் {$pada}-ம் பாதத்தில் பிறந்த குழந்தைக்கு இந்த ஒலியில் தொடங்கும் பெயர்கள் சிறப்பு."
            : ($isHi
                ? "वैदिक गणना के अनुसार, {$nak} नक्षत्र के {$pada} चरण में जन्मे शिशु हेतु इस ध्वनि से आरंभ नाम शुभ एवं अनुकूल हैं।"
                : "Names beginning with this sound are recommended for a baby born in {$nak} Nakshatra, Pada {$pada}.");
        $thPada = $isTa ? 'பாதம்' : ($isHi ? 'पाद' : 'PADA (QUARTER)');
        $thSound = $isTa ? 'சுப ஆரம்ப ஒலி' : ($isHi ? 'शुभ प्रारंभिक ध्वनि' : 'AUSPICIOUS STARTING SOUND');
        $thRasi = $isTa ? 'தொடர்புடைய ராசி' : ($isHi ? 'संबंधित राशि' : 'CORRESPONDING RASI');

        $certText = $isTa
            ? "இவ்வறிக்கை {$babyName} குழந்தையின் ஜன்ம நட்சத்திரம், சுப அக்ஷரங்கள் லஹிரி அயனாம்ச முறைப்படி கணிக்கப்பட்டதை உறுதிப்படுத்துகிறது. வழங்கப்பட்ட பெயர் அடையாளத்திற்காக மட்டுமே; அது பிறந்த பாத ஒலிக்குப் பொருந்துவதாகச் சான்றளிக்கப்படவில்லை."
            : ($isHi
                ? "यह रिपोर्ट {$babyName} के जन्म नक्षत्र और शुभ नामाक्षरों की गणना प्रमाणित करती है। दिया गया नाम केवल पहचान के लिए है; जन्म-पाद की ध्वनि से उसका मेल प्रमाणित नहीं है।"
                : "This report certifies the computed Janma Nakshatra and naming syllables for {$babyName}. The supplied name is for identification only, not a certified birth-pada name match.");
        $signRole = $isTa ? 'அங்கீகரிக்கப்பட்ட ஜோதிடர்' : ($isHi ? 'अधिकृत ज्योतिषी' : 'AUTHORIZED ASTROLOGER');
        $footerLabel = $isTa ? 'அதிகாரப்பூர்வ வேத நாமகரண அறிக்கை' : ($isHi ? 'आधिकारिक वैदिक नामकरण रिपोर्ट' : 'Official Vedic Namakaran Report');

        $virtue1 = $isTa ? 'பிரகாசமான உயிர்த்திருவும் அறிவும் — கூர்மையான பார்வை, உயர்ந்த மன சுறுசுறுப்பு.' : ($isHi ? 'तेजस्वी ओज एवं बुद्धि — तीक्ष्ण बुद्धि, सूक्ष्म दृष्टि एवं उत्तम स्वभाव।' : 'Radiant Vitality &amp; Intellect — keen observational clarity, mental agility and noble presence.');
        $virtue2 = $isTa ? 'கருணை & தர்ம நெறி — உண்மை, ஈகை, வலிய அற உணர்வு.' : ($isHi ? 'करुणा एवं धर्म — सत्यनिष्ठा, उदारता एवं नैतिक बल।' : 'Compassion &amp; Dharma Alignment — truthfulness, generosity and strong moral grounding.');
        $virtue3 = $isTa ? 'சுப பெய் அதிர்வுகள் — நாமகரண ஒலி நீண்ட ஆயுள், வெற்றி, ஆன்மீக பாதுகாப்பு.' : ($isHi ? 'शुभ नाम-कंपन — नामाक्षर दीर्घायु, सफलता एवं आध्यात्मिक सुरक्षा देते हैं।' : 'Auspicious Name Vibrations — the namakshara sound harmonizes longevity, success and spiritual protection.');
        $virtue4 = $isTa ? 'குடும்ப சுப வளர்ச்சி — ஜன்ம பாத அக்ஷரங்கள் ஆரோக்கியம், பாசம், சுப ஆரம்பங்கள்.' : ($isHi ? 'पारिवारिक मंगल वृद्धि — जन्म पाद अक्षर स्वास्थ्य, स्नेह एवं शुभ आरंभ देते हैं।' : 'Family Blessing &amp; Growth — janma pada syllables support healthy development, affection and auspicious beginnings.');

        $issued = new DateTimeImmutable($result['generatedAt'] ?? 'now');
        $issued = $issued->setTimezone(new DateTimeZone('Asia/Kolkata'));
        $certId = self::e($order['order_number'] ?? $order['orderNumber'] ?? ('ASTRO-NAME-' . $issued->format('Ymd')));
        $issueDate = $issued->format('d M Y, H:i') . ' IST';
        $verifiedLabel = $isTa ? 'கணிப்பு சரிபார்க்கப்பட்டது' : ($isHi ? 'गणना सत्यापित' : 'CALCULATION VERIFIED');
        $rawName = trim($result['babyName'] ?? '');
        preg_match('/^[^aeiou]*[aeiou]/i', $rawName, $firstLatin);
        $firstSound = self::e(preg_match('/[\x{0B80}-\x{0BFF}]/u', $rawName) ? self::firstTamilSound($rawName) : ($firstLatin[0] ?? substr($rawName, 0, 1)));
        $birthSound = self::e($primaryPada['letterEn']);
        $matches = self::nameMatchesPada($rawName, $primaryPada['letterTa']);
        $nameCheck = $isTa ? "பெயரின் முதல் ஒலி ({$firstSound}) ஜன்ம பாத ஒலிக்கு ({$birthSound}) " . ($matches ? 'பொருந்துகிறது' : 'பொருந்தவில்லை')
            : ($isHi ? "नाम की पहली ध्वनि ({$firstSound}) जन्म पाद ({$birthSound}) से " . ($matches ? 'मेल खाती है' : 'मेल नहीं खाती')
            : "Name's first sound ({$firstSound}) " . ($matches ? 'matches' : 'does not match') . " the birth-pada sound ({$birthSound}).");
        $thRasi = $isTa ? 'நவாம்சம்' : ($isHi ? 'नवांश' : 'Navamsa');
        $signRole = $isTa ? 'அங்கீகரிக்கப்பட்டவர்' : ($isHi ? 'अधिकृत हस्ताक्षरकर्ता' : 'Authorised Signatory');


        // ── PAGE 2: South & North Indian name suggestions ─────────────────────
        // Stored results carry `nameSuggestions`; orders saved before page 2
        // existed are completed here so every delivered report has it.
        $suggestionColumns = AstroEngine::getBabyNameSuggestionsByPada($padas, $genderCode);
        // Orders saved before localized meanings were added only have the
        // English `meaning` value. Normalize both fresh and legacy columns
        // before the page-2 HTML is assembled.
        $suggestionColumns = self::localizeNamakaranColumns($suggestionColumns);

        // Reserve a full sheet for the lists, not a compact table at the top.
        // Shared row counts align both styles, even when one list is shorter.
        $totalNameRows = 0;
        foreach ($suggestionColumns as $column) {
            $totalNameRows += max(1, (int) ceil(max(count($column['south'] ?? []), count($column['north'] ?? [])) / 2));
        }
        $nameRowHeight = number_format(186 / max(1, $totalNameRows), 3, '.', '');

        $suggestionNameSize = $totalNameRows > 28 ? 11.5 : ($totalNameRows > 22 ? 12.5 : 14);
        $suggestionMeaningSize = $totalNameRows > 22 ? 8.5 : 9.5;

        // ── mPDF-safe scoped styles for the redesigned certificate ──
        $babyCss = <<<CSS
    body { background: #ffffff; color: #2d241c; }
    .bn-frame { border: 1.2px solid #b3862e; padding: 5mm 6mm 4mm; background: #fdfaf4; }
    .bn-invocation { text-align: center; font-size: 8.5px; color: #8c6a1e; font-weight: bold; letter-spacing: 1px; margin-bottom: 2mm; }
    .bn-brand { text-align: center; font-size: 19px; color: #7a2129; font-weight: bold; letter-spacing: 2px; line-height: 1.15; }
    .bn-tagline { text-align: center; font-size: 8px; color: #8c6a1e; font-weight: bold; letter-spacing: 0.8px; margin-top: 0.8mm; }
    .bn-orn { border-top: 1px solid #b3862e; margin: 2mm 30mm; }
    .bn-title-band { background: #fdfaf4; border-top: 1px solid #cbbb89; border-bottom: 1px solid #cbbb89; padding: 2.4mm 3mm; text-align: center; margin: 2mm 0 3mm; }
    .bn-doc-title { font-size: 15px; color: #5c1720; font-weight: bold; line-height: 1.2; }
    .bn-doc-sub { font-size: 9px; color: #5c5044; font-weight: bold; margin-top: 0.8mm; }
    .bn-doc-meta { font-size: 7.5px; color: #8a7c6c; font-weight: bold; margin-top: 1.2mm; letter-spacing: 0.3px; }
    .bn-doc-meta b { color: #7a2129; }

    .sec-head { font-size: 9.5px; font-weight: bold; color: #7a2129; letter-spacing: 0.8px; margin: 2.5mm 0 1.5mm; padding-bottom: 0.8mm; border-bottom: 1px solid #e5d9c5; }
    .sec-no { display: inline-block; background: #7a2129; color: #ffffff; font-size: 7.5px; padding: 0.4mm 1.4mm; margin-right: 1.6mm; border-radius: 2px; }

    table.bn-details { width: 100%; border-collapse: collapse; margin-bottom: 2.5mm; }
    table.bn-details td { border: 1px solid #e5d9c5; padding: 1.4mm 2.2mm; vertical-align: top; }
    .bn-lbl { background: #f6efe1; color: #8c6a1e; font-size: 7px; font-weight: bold; letter-spacing: 0.5px; width: 21%; }
    .bn-val { background: #ffffff; color: #2d241c; font-size: 9px; font-weight: bold; width: 29%; }

    .bn-syllable { background: #f7efdd; border: 1px solid #b3862e; padding: 3mm 4mm; margin-bottom: 2.5mm; }
    .bn-hero-kicker { font-size: 7px; color: #8c6a1e; font-weight: bold; letter-spacing: 0.8px; }
    .bn-hero-line { font-size: 15px; color: #5c1720; font-weight: bold; margin-top: 1mm; }
    .bn-hero-alt { font-size: 8.5px; color: #5c5044; font-weight: bold; margin-top: 0.5mm; }
    .bn-hero-desc { font-size: 8.2px; color: #5c5044; margin-top: 1.2mm; line-height: 1.4; }

    table.data-table th { background: #f6efe1; color: #7a2129; border-bottom: 1px solid #cbbb89; font-size: 7.6px; letter-spacing: 0.6px; }
    table.data-table td { padding: 1.4mm 2.2mm; }
    .translit { font-size: 7.5px; color: #8a7c6c; font-weight: bold; }
    .mini-badge { background: #b3862e; color: #ffffff; font-size: 6.2px; padding: 0.3mm 1.4mm; margin-left: 1.2mm; border-radius: 2px; letter-spacing: 0.4px; }
    tr.birth-row td { background: #f7efdd !important; color: #5c1720; font-weight: bold; }
    .name-cell { color: #7a2129; font-weight: bold; }
    .sound-cell { color: #5c5044; font-weight: bold; }

    table.bn-virtues { width: 100%; border-collapse: collapse; margin-bottom: 2.5mm; }
    table.bn-virtues td { border: 1px solid #e5d9c5; padding: 1.5mm 2.2mm; font-size: 8.4px; color: #5c5044; vertical-align: top; width: 50%; background: #fdfaf4; }
    .virtue-no { color: #2e6b4f; font-weight: bold; margin-right: 1.2mm; }

    .bn-cert { font-size: 7.8px; color: #5c5044; line-height: 1.45; margin-top: 1mm; }
    .bn-meta { font-size: 7px; color: #8a7c6c; font-weight: bold; margin-top: 1mm; }
    .bn-meta b { color: #7a2129; }
    table.bn-sign { width: 100%; margin-top: 2mm; }
    .bn-sign-line { border-bottom: 1px solid #8a7c6c; height: 5mm; width: 40mm; }
    .bn-sign-name { font-size: 7.8px; color: #2d241c; font-weight: bold; }
    .bn-sign-role { font-size: 6.8px; color: #8a7c6c; font-weight: bold; letter-spacing: 0.4px; }
    .bn-seal { border: 1.5px dashed #b3862e; border-radius: 50%; width: 17mm; height: 17mm; text-align: center; vertical-align: middle; background: #f7efdd; }
    .bn-seal-title { font-size: 8px; color: #7a2129; font-weight: bold; line-height: 1.1; }
    .bn-seal-sub { font-size: 5.8px; color: #8c6a1e; font-weight: bold; }
    .bn-footer-bar { border-top: 1px solid #b3862e; margin-top: 2mm; padding-top: 1mm; font-size: 7.2px; color: #8a7c6c; }
    .bn-footer-bar b { color: #7a2129; letter-spacing: 0.8px; }
    .bn-doc-hint { font-size: 7.2px; color: #5c5044; margin-top: 1.4mm; line-height: 1.35; }

    /* ── Page 2: South & North Indian name suggestions (mPDF tables) ── */
    .bn-sug-title-band { padding: 1.8mm 3mm; margin: 2mm 0; }
    table.sug-cols { width: 100%; border-collapse: separate; border-spacing: 2.4mm 0; margin-top: 1mm; }
    td.sug-col { width: 50%; vertical-align: top; border: 1px solid #e5d9c5; padding: 1.6mm 1.8mm 2mm; background: #fffdf9; }
    .sug-col-head { font-size: 11px; font-weight: bold; color: #ffffff; padding: 1.1mm 1mm; text-align: center; letter-spacing: 0.3px; margin-bottom: 1.6mm; }
    .sug-col-head.sug-south { background-color: #2e6b4f; }
    .sug-col-head.sug-north { background-color: #7a2129; }
    .sug-block { margin-bottom: 1.5mm; }
    table.sug-head { width: 100%; border-bottom: 0.6px dashed #e5d9c5; margin-bottom: 0.9mm; }
    td.sug-chip { width: 9mm; text-align: center; background-color: #f7efdd; border: 0.6px solid #cbbb89; color: #5c1720; font-size: 14px; font-weight: bold; }
    .sug-sound-cell { font-size: 9.5px; color: #7a2129; font-weight: bold; padding-left: 1.4mm; line-height: 1.1; }
    .sug-rasi { font-size: 8px; color: #8a7c6c; font-weight: bold; }
    td.sug-pada { font-size: 8px; color: #8a7c6c; font-weight: bold; letter-spacing: 0.3px; white-space: nowrap; }
    table.sug-names { width: 100%; border-collapse: collapse; }
    td.sug-cell { width: 50%; font-family: notosans, sans-serif; font-size: 8.5px; color: #2d241c; padding: 0.6mm 1mm; vertical-align: top; line-height: 1.3; }
    .sug-nm { font-size: {$suggestionNameSize}px; font-weight: bold; color: #2d241c; }
    .sug-mn { font-family: notosans, notosanstamil, notosansdevanagari, sans-serif; font-size: {$suggestionMeaningSize}px; color: #8a7c6c; }
    .sug-empty { font-size: 10px; color: #8a7c6c; font-style: italic; }
    .sug-note { font-size: 8.5px; color: #8a7c6c; text-align: center; margin-top: 1.6mm; line-height: 1.3; }
CSS;

        $logoTag = '<img src="' . astro_logo_url() . '" style="width:38px; height:38px; border-radius:50%; margin-left:8mm;" alt="ASTRO SIVAM" />';

        $padaWord = $isTa ? 'பாதம்' : ($isHi ? 'पाद' : 'PADA');
        $southTitle = $isTa ? 'தென்னிந்திய பாணி பெயர்கள்' : ($isHi ? 'दक्षिण भारतीय शैली के नाम' : 'SOUTH INDIAN STYLE NAMES');
        $northTitle = $isTa ? 'வடஇந்திய பாணி பெயர்கள்' : ($isHi ? 'उत्तर भारतीय शैली के नाम' : 'NORTH INDIAN STYLE NAMES');
        $sugDocTitle = $isTa ? 'பெயர் பரிந்துரைகள்' : ($isHi ? 'नाम सुझाव' : 'NAME SUGGESTIONS');
        $sugDocSub = $isTa
            ? 'தென்னிந்திய & வடஇந்திய பாணி — நட்சத்திர பாத ஒலிகளுக்கான பெயர்கள்'
            : ($isHi
                ? 'दक्षिण भारतीय एवं उत्तर भारतीय शैली — नक्षत्र पाद ध्वनियों हेतु नाम'
                : 'South &amp; North Indian Styles &mdash; Names for Every Pada Syllable');
        $southBlocks = '';
        $northBlocks = '';
        foreach ($suggestionColumns as $column) {
            $chip = self::e($column['soundTa'] ?? '');
            $sound = self::e($isTa ? ($column['soundTa'] ?? '') : ($isHi ? ($column['soundHi'] ?? '') : ($column['soundEn'] ?? '')));
            $columnRasi = self::e($isTa
                ? ($column['rasiTa'] ?? '')
                : ($isHi ? ($column['rasiHi'] ?? '') : ($column['rasiEn'] ?? '')));
            $isBirthSection = intval($column['padaNumber'] ?? 0) === $birthPada;
            $padaLabel = ($isBirthSection ? '★ ' : '') . self::e($padaWord . ' ' . intval($column['padaNumber'] ?? 0));
            $rowCount = max(1, (int) ceil(max(count($column['south'] ?? []), count($column['north'] ?? [])) / 2));
            $renderList = function ($names) use ($rowCount, $nameRowHeight, $isTa, $isHi) {
                $cells = is_array($names) ? array_values($names) : [];
                $rows = '';
                for ($i = 0; $i < $rowCount; $i++) {
                    $rows .= '<tr>';
                    for ($col = 0; $col < 2; $col++) {
                        $entry = $cells[$i * 2 + $col] ?? null;
                        $rows .= '<td class="sug-cell" style="height:' . $nameRowHeight . 'mm;">';
                        if ($entry !== null) {
                            $rawName = $entry['name'] ?? '';
                            if ($isTa) {
                                $taName = self::transliterateToTamil($rawName);
                                $nameHtml = '<span class="sug-nm-ta" style="font-family:notosanstamil,sans-serif; color:#7d1233; font-weight:bold;">' . self::e($taName) . '</span>';
                            } elseif ($isHi) {
                                $hiName = self::transliterateToHindi($rawName);
                                $nameHtml = '<span class="sug-nm-hi" style="font-family:notosansdevanagari,sans-serif; color:#7d1233; font-weight:bold;">' . self::e($hiName) . '</span>';
                            } else {
                                $nameHtml = '<span class="sug-nm" style="font-weight:bold;">' . self::e($rawName) . '</span>';
                            }
                            $meaning = $isTa
                                ? ($entry['meaningTa'] ?? '')
                                : ($isHi ? ($entry['meaningHi'] ?? '') : ($entry['meaningEn'] ?? $entry['meaning'] ?? ''));
                            $rows .= $nameHtml . '<br/><span class="sug-mn">' . self::e($meaning) . '</span>';
                        } elseif (empty($cells) && $i === 0 && $col === 0) {
                            $rows .= '<span class="sug-empty">&#8212;</span>';
                        }
                        $rows .= '</td>';
                    }
                    $rows .= '</tr>';
                }
                return '<table class="sug-names" width="100%">' . $rows . '</table>';
            };

            $head = '<table class="sug-head" width="100%"><tr>'
                . '<td class="sug-chip" width="9mm">' . $chip . '</td>'
                . '<td class="sug-sound-cell"><span class="sug-sound">' . $sound . '</span>'
                . ($columnRasi !== '' ? '<br/><span class="sug-rasi">' . $columnRasi . '</span>' : '')
                . '</td>'
                . '<td class="sug-pada" align="right">' . $padaLabel . '</td>'
                . '</tr></table>';

            $southBlocks .= '<div class="sug-block"' . ($isBirthSection ? ' style="background:#fff7e0;border-left:2px solid #c9962c;"' : '') . '>' . $head . $renderList($column['south'] ?? []) . '</div>';
            $northBlocks .= '<div class="sug-block"' . ($isBirthSection ? ' style="background:#fff7e0;border-left:2px solid #c9962c;"' : '') . '>' . $head . $renderList($column['north'] ?? []) . '</div>';
        }

        $exactSoundNote = $isTa
            ? 'கொடுக்கப்பட்ட நான்கு பாத ஒலிகளுடன் சரியாகப் பொருந்தும் பெயர்கள் மட்டுமே காட்டப்படுகின்றன; சில ஒலிகளுக்கு பெயர்கள் குறைவாக இருக்கலாம்.'
            : ($isHi
                ? 'केवल दिए गए चार पाद स्वरों से ठीक मेल खाने वाले नाम दिखाए गए हैं; कुछ स्वरों के लिए नाम कम हो सकते हैं।'
                : 'Only exact matches to the four listed pada sounds are shown; some sounds may have fewer names.');

        $suggestionsPage = '';
        if ($southBlocks !== '' || $northBlocks !== '') {
            $suggestionsPage = '<pagebreak />'
                . '<div class="bn-frame" id="namakaran-page-2">'
                . '<table style="width:100%; margin-bottom:1mm;"><tr>'
                . '<td style="width:72px; vertical-align:middle; text-align:left;">' . $logoTag . '</td>'
                . '<td style="vertical-align:middle;"><div class="bn-brand">ASTRO SIVAM</div>'
                . '<div class="bn-tagline">' . $brandTagline . '</div></td>'
                . '<td style="width:62px;"></td></tr></table>'
                . '<div class="bn-title-band bn-sug-title-band">'
                . '<div class="bn-doc-title">' . $sugDocTitle . '</div>'
                . '<div class="bn-doc-sub">' . $sugDocSub . '</div>'
                . '<div class="bn-doc-meta"><b>' . $babyName . '</b> &nbsp;&bull;&nbsp; ' . $nak . ', Pada ' . $pada
                . ' &nbsp;&bull;&nbsp; ' . $gender . ' &nbsp;&bull;&nbsp; <b>' . $lblReportNo . ':</b> ' . $certId . '</div>'
                . '</div>'
                . '<table class="sug-cols" width="100%"><tr>'
                . '<td class="sug-col" width="50%" valign="top">'
                . '<div class="sug-col-head sug-south">' . $southTitle . '</div>' . $southBlocks . '</td>'
                . '<td class="sug-col" width="50%" valign="top">'
                . '<div class="sug-col-head sug-north">' . $northTitle . '</div>' . $northBlocks . '</td>'
                . '</tr></table>'
                . '<div class="sug-note">' . $exactSoundNote . '</div>'
                . '<div class="bn-footer-bar"><b>ASTRO SIVAM</b> &nbsp;&bull;&nbsp; ' . $footerLabel
                . ' &nbsp;&bull;&nbsp; admin@astrosivam.com</div>'
                . '</div>';
        }

        $body = <<<HTML
<div class="bn-frame">

  <div class="bn-invocation">{$invocation}</div>
  <table style="width:100%; margin-bottom:1mm;"><tr>
    <td style="width:72px; vertical-align:middle; text-align:left;">{$logoTag}</td>
    <td style="vertical-align:middle;">
      <div class="bn-brand">ASTRO SIVAM</div>
      <div class="bn-tagline">{$brandTagline}</div>
    </td>
    <td style="width:62px;"></td>
  </tr></table>
  <div class="bn-orn"></div>

  <div class="bn-title-band">
    <div class="bn-doc-title">{$docTitle}</div>
    <div class="bn-doc-sub">{$docSubtitle}</div>
    <div class="bn-doc-meta"><b>{$lblReportNo}:</b> {$certId} &nbsp;&bull;&nbsp; <b>{$lblIssueDate}:</b> {$issueDate} &nbsp;&bull;&nbsp; <b>{$lblLanguage}:</b> {$langName}</div>
  </div>

  <div class="sec-head"><span class="sec-no">01</span>{$sec1} / {$sec2}</div>
  <table class="bn-details">
    <tr>
      <td class="bn-lbl">{$lblBabyName}</td><td class="bn-val">{$babyName} ({$gender})</td>
      <td class="bn-lbl">{$lblNak}</td><td class="bn-val">{$nak}, Pada {$pada}</td>
    </tr>
    <tr>
      <td class="bn-lbl">{$lblDob}</td><td class="bn-val">{$dob}</td>
      <td class="bn-lbl">{$lblPada}</td><td class="bn-val">Pada {$pada}</td>
    </tr>
    <tr>
      <td class="bn-lbl">{$lblTob}</td><td class="bn-val">{$tob}</td>
      <td class="bn-lbl">{$lblRasi}</td><td class="bn-val">{$rasi}</td>
    </tr>
    <tr>
      <td class="bn-lbl">{$lblPlace}</td><td class="bn-val">{$birthPlace}</td>
      <td class="bn-lbl">{$lblLagna}</td><td class="bn-val">{$lagna}</td>
    </tr>
    <tr>
      <td class="bn-lbl">{$lblLord}</td><td class="bn-val">{$lord}</td>
      <td class="bn-lbl">{$lblGana} / {$lblYoni}</td><td class="bn-val">{$gana} / {$yoni}</td>
    </tr>
    <tr>
      <td class="bn-lbl">{$lblRajju}</td><td class="bn-val">{$rajju}</td>
      <td class="bn-lbl"></td><td class="bn-val"></td>
    </tr>
  </table>

  <div class="sec-head"><span class="sec-no">02</span>{$sec3}</div>
  <div class="bn-syllable">
    <div class="bn-hero-kicker">{$heroTitle}</div>
    <div class="bn-hero-line">{$primarySyllable}</div>
    <div class="bn-hero-alt">{$primaryTransliteration}</div>
    <div class="bn-hero-desc">{$heroDesc}</div>
  </div>

  <div class="sec-head"><span class="sec-no">03</span>{$sec4}</div>
  <div style="font-size:9px; color:#7a2129; font-weight:bold; margin-bottom:1.5mm;">{$syllables}</div>
  <table class="data-table">
    <thead><tr><th width="30%">{$thPada}</th><th width="40%">{$thSound}</th><th>{$thRasi}</th></tr></thead>
    <tbody>{$padaRows}</tbody>
  </table>

  <div class="sec-head"><span class="sec-no">04</span>{$sec5}</div>
  <table class="bn-virtues">
    <tr>
<td><span class="virtue-no">1.</span>{$virtue1}</td>
<td><span class="virtue-no">2.</span>{$virtue2}</td>
    </tr>
    <tr>
<td><span class="virtue-no">3.</span>{$virtue3}</td>
<td><span class="virtue-no">4.</span>{$virtue4}</td>
    </tr>
  </table>

  {$namesSection}

  <table class="bn-sign"><tr>
    <td style="width:58%; vertical-align:top;">
      <div class="bn-cert">{$certText}</div><div class="bn-cert"><b>✓ {$verifiedLabel}</b><br/>{$nameCheck}</div>
      <div class="bn-meta"><b>{$lblReportNo}:</b> {$certId} &nbsp;&bull;&nbsp; <b>{$lblIssueDate}:</b> {$issueDate} &nbsp;&bull;&nbsp; astrosivam.com</div>
    </td>
    <td style="width:24%; vertical-align:top; text-align:center;">
      <div class="bn-sign-line"></div>
      <div class="bn-sign-name">ASTRO SIVAM — Vedic Research Desk</div>
      <div class="bn-sign-role">{$signRole}</div>
    </td>
    <td style="width:18%; vertical-align:top; text-align:center;">
      <div class="bn-seal">
        <div class="bn-seal-title">ASTRO<br/>SIVAM</div>
        <div class="bn-seal-sub">{$verifiedLabel}</div>
      </div>
    </td>
  </tr></table>

  <div class="bn-footer-bar"><b>ASTRO SIVAM</b> &nbsp;&bull;&nbsp; {$footerLabel} &nbsp;&bull;&nbsp; admin@astrosivam.com</div>

</div>
HTML;

        $css = self::sharedCss($lang) . $babyCss;
        // Page 1 = the certificate, page 2 = the South & North Indian name lists.
        return '<!DOCTYPE html><html lang="' . self::e($lang) . '"><head><meta charset="UTF-8"><title>ASTRO SIVAM - Baby Naming Certificate</title><style>' . $css . '</style></head><body>'
            . $body . self::footerBand($lang)
            . $suggestionsPage
            . '</body></html>';
    }
}

class AstroMpdfReports {

    public static function isAvailable(): bool {
        if (class_exists('\Mpdf\Mpdf')) {
            return true;
        }
        return function_exists('astroEnsureMpdfAutoload') ? astroEnsureMpdfAutoload() : false;
    }

    /**
     * mPDF 8.x cannot shape the shipped modern Noto Indic fonts: Tamil uses
     * MarkGlyphSets and Devanagari also uses GSUB lookup type 5 / format 3.
     * Its bundled FreeSerif supports both scripts with OTL enabled. This is
     * still an embedded, shaped Unicode vector font, not a degraded PDF path.
     * Browser previews retain their Noto fonts; only mPDF uses this stack.
     */
    public static function pdfFontStack(string $lang): string {
        return astro_report_normalize_language($lang) === 'en'
            ? 'notosans, cinzel, sans-serif'
            : 'freeserif';
    }

    /** Converts the report HTML to PDF, retaining all content and Indic shaping. */
    public static function convertHtmlToPdf(string $html, string $lang = 'ta'): string {
        $lang = astro_report_normalize_language($lang);
        $fontDir = function_exists('astroMpdfFontDir') ? astroMpdfFontDir() : __DIR__ . '/fonts';
        if (!is_dir($fontDir)) {
            $fontDir = __DIR__ . '/fonts';
        }
        $fontDirs = [];
        $fontData = [];

        if (class_exists('\Mpdf\Config\ConfigVariables')) {
            $defaultConfig = (new \Mpdf\Config\ConfigVariables())->getDefaults();
            $fontDirs = $defaultConfig['fontDir'] ?? [];
        }
        if (class_exists('\Mpdf\Config\FontVariables')) {
            $defaultFontConfig = (new \Mpdf\Config\FontVariables())->getDefaults();
            $fontData = $defaultFontConfig['fontdata'] ?? [];
        }

        // Register custom TrueType fonts from api/astrology/fonts/ with OTL and Kashida for Indic scripts
        $customFontData = function_exists('astroMpdfFontData') ? astroMpdfFontData() : [
            'nototamil' => [
                'R' => 'NotoSansTamil-Regular.ttf',
                'M' => 'NotoSansTamil-Medium.ttf',
                'SB' => 'NotoSansTamil-SemiBold.ttf',
                'B' => 'NotoSansTamil-Bold.ttf',
                'useOTL' => 0xFF,
                'useKashida' => 75,
            ],
            'notodevanagari' => [
                'R' => 'NotoSansDevanagari-Regular.ttf',
                'M' => 'NotoSansDevanagari-Medium.ttf',
                'SB' => 'NotoSansDevanagari-SemiBold.ttf',
                'B' => 'NotoSansDevanagari-Bold.ttf',
                'useOTL' => 0xFF,
                'useKashida' => 75,
            ],
            'notosanstamil' => [
                'R' => 'NotoSansTamil-Regular.ttf',
                'M' => 'NotoSansTamil-Medium.ttf',
                'SB' => 'NotoSansTamil-SemiBold.ttf',
                'B' => 'NotoSansTamil-Bold.ttf',
                'useOTL' => 0xFF,
                'useKashida' => 75,
            ],
            'notosansdevanagari' => [
                'R' => 'NotoSansDevanagari-Regular.ttf',
                'M' => 'NotoSansDevanagari-Medium.ttf',
                'SB' => 'NotoSansDevanagari-SemiBold.ttf',
                'B' => 'NotoSansDevanagari-Bold.ttf',
                'useOTL' => 0xFF,
                'useKashida' => 75,
            ],
            'notosans' => [
                'R' => 'NotoSans-Regular.ttf',
                'M' => 'NotoSans-Medium.ttf',
                'SB' => 'NotoSans-SemiBold.ttf',
                'B' => 'NotoSans-Bold.ttf',
            ],
            'balootamil' => [
                'R' => 'BalooThambi2-SemiBold.ttf',
                'B' => 'BalooThambi2-Bold.ttf',
                'useOTL' => 0xFF,
                'useKashida' => 75,
            ],
            'cinzel' => [
                'R' => 'Cinzel-SemiBold.ttf',
                'B' => 'Cinzel-Bold.ttf',
            ],
            'yatraone' => [
                'R' => 'YatraOne-Regular.ttf',
                'useOTL' => 0xFF,
                'useKashida' => 75,
            ],
        ];

        // Filter out missing font files defensively to prevent mPDF throw exceptions
        $registeredFonts = [];
        foreach ($customFontData as $fontKey => $fontDef) {
            $validDef = [];
            foreach ($fontDef as $key => $val) {
                if (in_array($key, ['R', 'B', 'I', 'BI', 'M', 'SB'])) {
                    if (is_file($fontDir . '/' . $val)) {
                        $validDef[$key] = $val;
                    }
                } else {
                    $validDef[$key] = $val;
                }
            }
            if (isset($validDef['R'])) {
                $registeredFonts[$fontKey] = $validDef;
            }
        }

        // mPDF ignores CSS !important and inline Baby Naming name styles can
        // still select a Noto alias. Map those aliases as well as the default
        // to a compatible font, without changing the HTML served to browsers.
        // FreeSerif's regular face covers Tamil; its bold/italic faces do not.
        // Leaving only R lets mPDF synthesize emphasis without losing glyphs.
        if (isset($fontData['freeserif'])) {
            unset($fontData['freeserif']['B'], $fontData['freeserif']['I'], $fontData['freeserif']['BI']);
            foreach (['notosanstamil', 'nototamil', 'balootamil', 'notosansdevanagari', 'notodevanagari'] as $family) {
                $registeredFonts[$family] = $fontData['freeserif'];
            }
        }

        // Absolute Path Image Resolution for mPDF
        $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/') : '';
        if (empty($docRoot)) {
            $docRoot = realpath(__DIR__ . '/../../public') ?: realpath(__DIR__ . '/../..');
        }

        if (!empty($docRoot)) {
            $html = str_replace('src="/', 'src="' . $docRoot . '/', $html);
        }

        // Convert logo image paths to verified absolute filesystem paths for reliable rendering
        // astro_logo_path() probes every deployment layout, including the copy
        // bundled inside /api/assets that is always deployed with the PHP API.
        // Previously only repo-relative paths were checked, so on cPanel (where
        // the logo lives in public_html/ and __DIR__/../../public does not
        // exist) this stayed null and mPDF fell back to fetching the logo over
        // HTTP - which usually fails, producing report PDFs with no logo.
        $validLogoPath = astro_logo_path();

        $logoPattern = '/src=["\'][^"\']*(astrosivam_logo\.(?:jpg|jpeg|png))["\']/i';
        if ($validLogoPath !== '') {
            $html = preg_replace($logoPattern, 'src="' . $validLogoPath . '"', $html);
        } else {
            // Last resort: point at the public URL so mPDF at least has a
            // chance to fetch it, instead of pointing at a doc-root path that
            // does not exist and rendering an empty box.
            $html = preg_replace($logoPattern, 'src="' . astro_logo_absolute_url() . '"', $html);
        }

        // Set the compatible font before constructing mPDF: it loads/shapes
        // default_font immediately, before a later CSS override could help.
        $fontStack = self::pdfFontStack($lang);
        $defaultFont = $lang === 'en' ? 'notosans' : 'freeserif';

        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 5,
            'margin_right' => 5,
            'margin_top' => 5,
            'margin_bottom' => 5,
            'tempDir' => function_exists('astroMpdfTempDir') ? astroMpdfTempDir() : sys_get_temp_dir(),
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'useSubstitutions' => true,
            'fontDir' => !empty($fontDirs) ? array_merge($fontDirs, [$fontDir]) : [$fontDir],
            'fontdata' => $fontData + $registeredFonts,
            'default_font' => $defaultFont,
        ]);

        // Inject mandatory PDF styling into the <head> of HTML string before passing to WriteHTML
        $injectedPdfStyle = '<style>
            * {
                box-sizing: border-box;
            }
            body, table, td, th, div, p, span, h1, h2, h3, h4, h5, h6, b, strong, i, em, li, ul {
                font-family: ' . $fontStack . ' !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            body {
                background-color: #fffdf9 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .report-page-break {
                page-break-after: always;
            }
            .report-card, .rasi-chart-table, .dosha-section, .dosha-card, .life-card, .panel, .sheet, table, table.rasi-table, table.details-grid, table.data-table, table.life-grid {
                page-break-inside: avoid;
            }
            .sheet {
                background-color: #fdfaf6 !important;
                border: 1.5px solid #c9962c !important;
                page-break-inside: avoid;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            /* The summary sheet is a fixed third page: its spacing is owned by
               the shared stylesheet so the HTML preview and the PDF agree, and
               it must never grow (the one-A4 contract) - margin-bottom stays at
               zero here, and the cards keep their breaks inside themselves. */
            #birth-summary-sheet {
                margin-bottom: 0;
            }
            #birth-summary-sheet .summary-card,
            #birth-summary-sheet .summary-reassurance {
                page-break-inside: avoid;
            }
            .header-table {
                page-break-inside: avoid;
            }
            img, .header-logo {
                image-rendering: -webkit-optimize-contrast;
                max-width: 100%;
            }
            .rasi-grid, .rasi-cell, .rasi-cell-corner, .rasi-center, .panel, .badge, .status-pill, .footer, .header-table, .data-table, .data-table th, .data-table td,
            .summary-card, .summary-planet, .summary-cell, .summary-reassurance, .summary-care th {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            table {
                border-collapse: collapse;
            }
        </style>';

        if (stripos($html, '</head>') !== false) {
            $html = str_ireplace('</head>', $injectedPdfStyle . '</head>', $html);
        } else {
            $html = $injectedPdfStyle . $html;
        }

        $mpdf->WriteHTML($html);
        return $mpdf->Output('', 'S');
    }

    public static function generateBirthJathagamPdf($order, $result): string {
        $html = AstroReportViews::generateBirthJathagamHtml($order, $result);
        return self::convertHtmlToPdf($html, $order['language'] ?? 'ta');
    }

    public static function generateWeddingMatchingPdf($order, $result): string {
        $html = AstroReportViews::generateWeddingMatchingHtml($order, $result);
        return self::convertHtmlToPdf($html, $order['language'] ?? 'ta');
    }

    public static function generateBabyNamingPdf($order, $result): string {
        $html = AstroReportViews::generateBabyNamingHtml($order, $result);
        return self::convertHtmlToPdf($html, $order['language'] ?? 'ta');
    }
}
