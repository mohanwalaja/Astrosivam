# Birth Jathagam page 3 — Birth Stone, Lucky Colour, Lucky Numbers

Page 3 (Short Summary) of the Birth Jathagam now carries a **Lucky Indicators**
card directly under the person card, in all three report languages and in both
renderers (browser/jsPDF preview and the PHP mPDF download).

| Row | Driven by | Boxes |
| --- | --- | --- |
| ஜென்ம நட்சத்திரப்படி / By Janma Nakshatra | nakshatra lord (Vimshottari) | நட்சத்திரக் கல் (birth stone) · அதிர்ஷ்ட நிறம் · அதிர்ஷ்ட எண்கள் (3 numbers) |

Only the nakshatra-based row is printed (the rasi-lord row was removed on
request; the rasi-lord table remains in the data module for reference).

## Tamil source research

Every indicator is a property of a **graha**; the native receives it through the
nakshatra lord and the rasi lord. The sources below were cross-checked and agree:

| Graha | கல் (stone) | நிறம் (colour) | எண்கள் | graha number |
| --- | --- | --- | --- | --- |
| சூரியன் | மாணிக்கம் | சிவப்பு | 1, 5, 7 | 1 |
| சந்திரன் | முத்து | வெள்ளை | 2, 3, 9 | 2 |
| செவ்வாய் | பவளம் | இளஞ்சிவப்பு | 3, 6, 9 | 9 |
| புதன் | மரகதம் | பச்சை | 1, 5, 8 | 5 |
| குரு | புஷ்பராகம் | மஞ்சள் | 2, 3, 9 | 3 |
| சுக்கிரன் | வைரம் | வெள்ளை | 3, 6, 8 | 6 |
| சனி | நீலம் | கருநீலம் / கருப்பு | 5, 6, 8 | 8 |
| ராகு | கோமேதகம் | கருப்பு | 1, 4, 7 | 4 |
| கேது | வைடூரியம் | சிவப்பு கலந்த பல நிறங்கள் | 5, 7, 9 | 7 |

- Samayam Tamil — *நட்சத்திரத்திற்கேற்ற அதிர்ஷ்ட தெய்வம், அதிர்ஷ்ட எண், அதிர்ஷ்ட நிறம்*
  (27 nakshatras grouped by lord: stone, colour, numbers).
- Samayam Tamil — *27 நட்சத்திரங்களுக்கு உரிய அதிர்ஷ்ட கல், ரத்தினங்கள்* (one stone per
  nakshatra; identical to the lord's Navaratna).
- livingastro.blogspot.com — *27 நட்சத்திரத்தின் குறிப்புகள்* (same colour / number sets).
- SwasthikTv — *12 ராசிகளின் நிறங்கள்* (rasi colour follows the rasi lord).
- Zee News Tamil — *உங்கள் ராசிக்கு ஏற்ற ரத்தினம்* (rasi stone = rasi lord's gem).
- Samayam Tamil — *எண்களும் அவற்றிற்குரிய கிரகங்கள்* (சூரியன் 1 … செவ்வாய் 9).

## Code

- `src/services/jathagamLuckyData.ts` — the table, lord resolution and
  `resolveLuckyIndicators()` (unreadable index / rasi → "N/A", never fabricated).
- `src/services/jathagamHtmlBuilder.ts` — page-3 card `#summary-lucky` + CSS; the
  existing `fitJathagamSummaryText` budget covers it, compact pages print a
  one-line caution.
- `api/astrology/pdf_mpdf_reports.php` — `jathagamLuckyProfiles()`,
  `jathagamLuckyText()`, `resolveJathagamLuckyIndicators()` and the mPDF card.
- `tests/jathagam-lucky-indicators.test.ts` — freezes the table, the lord cycle,
  N/A handling, the page-3 HTML in en/ta/hi and the PHP mirror.
