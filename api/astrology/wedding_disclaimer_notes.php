<?php
/**
 * Shared Marriage Matching disclaimer copy (page 2) for the PHP renderers.
 *
 * The disclaimer is legally significant wording, so it lives in ONE asset
 * (wedding_disclaimer_notes.json) that is consumed by:
 *   - api/astrology/pdf_mpdf_reports.php   (server-side mPDF export)
 *   - src/services/weddingDisclaimerNotes.ts (browser preview + html2canvas PDF)
 *   - src/lib/astrology/pdfGenerator.ts     (PHP PDF renderer)
 *
 * Paragraphs may contain **bold** emphasis markers; browser/mPDF renderers
 * convert them to <strong>. The legacy plain-PHP PDF writer has been removed.
 */
class WeddingDisclaimerNotes
{
    /**
     * @return array{pageSubtitle:string,title:string,heading:string,paragraphs:string[]}
     */
    public static function build(string $lang = 'en'): array
    {
        static $translations = null;
        if ($translations === null) {
            $path = __DIR__ . '/wedding_disclaimer_notes.json';
            $translations = is_file($path) ? json_decode((string) file_get_contents($path), true) : [];
        }
        if (!is_array($translations['en'] ?? null) || !is_array($translations['en']['paragraphs'] ?? null)) {
            // Do not ship a report without the disclaimer if a partial
            // deployment omitted the translation asset: fall back to English
            // (the same wording the JSON carries) and log the incident.
            error_log('Marriage Matching disclaimer translations are unavailable; using the English fallback.');
            return self::englishFallback();
        }
        $copy = $translations[$lang] ?? $translations['en'];
        $paragraphs = array_values(array_filter(array_map('strval', (array) ($copy['paragraphs'] ?? []))));
        if (!count($paragraphs)) {
            return self::englishFallback();
        }
        return [
            'pageSubtitle' => (string) ($copy['pageSubtitle'] ?? 'Marriage Matching - Important Note & Disclaimer'),
            'title' => (string) ($copy['title'] ?? 'DISCLAIMER'),
            'heading' => (string) ($copy['heading'] ?? 'Marriage Matching - Important Note'),
            'paragraphs' => $paragraphs,
        ];
    }

    /**
     * Escape the copy for HTML while turning **markers** into <strong>.
     */
    public static function rich(string $text): string
    {
        $escaped = htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
        return preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $escaped) ?? $escaped;
    }

    /** Strip the **markers** for renderers that cannot style inline runs. */
    public static function plain(string $text): string
    {
        return str_replace('**', '', (string) $text);
    }

    /**
     * Last-resort English copy. KEEP IN SYNC with the "en" block of
     * wedding_disclaimer_notes.json.
     */
    private static function englishFallback(): array
    {
        return [
            'pageSubtitle' => 'Marriage Matching - Important Note & Disclaimer',
            'title' => 'DISCLAIMER',
            'heading' => 'Marriage Matching - Important Note',
            'paragraphs' => [
                'This Marriage Matching Report is primarily intended for couples considering an **Arranged Marriage**, where the prospective bride and groom may not have had the opportunity to know each other personally or understand each other deeply before marriage.',
                'In an arranged marriage, both families may be introducing the prospective bride and groom to each other with limited prior personal knowledge. Therefore, traditional Vedic astrology-based marriage matching can serve as a supplementary guide by examining factors such as the **Ten Poruthams (Dasa Porutham)**, **Kuja Dosha (Sevvai Dosham)**, and other relevant astrological considerations.',
                'In a **Love Marriage**, or where the bride and groom already know each other well, they may already have personal understanding of each other\'s personality, habits, values, expectations, lifestyle, and family circumstances. Therefore, the role and relevance of traditional horoscope matching may differ in such circumstances.',
                'The results and interpretations provided in this report are based on **traditional Vedic astrology principles** and should be considered as astrological guidance only.',
                'Marriage is an important life decision and should not be based solely on horoscope matching. **Mutual understanding, compatibility, character, communication, shared values, life goals, family circumstances, and the free and informed consent of both individuals** should also be carefully considered.',
                '**This report is intended as a supplementary source of astrological guidance and should not be considered the sole or final basis for making a marriage decision.**',
            ],
        ];
    }
}
