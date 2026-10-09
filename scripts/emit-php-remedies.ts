/**
 * Dev harness: emit the PHP `$navagrahaMeta` full-remedy lines straight from
 * the TypeScript source of truth, so api/astrology/engine.php and
 * src/services/jathagamDoshaData.ts can never drift apart.
 */
import { NAVAGRAHA_DOSHA_DATA, NAVAGRAHA_ORDER, navagrahaRemedyText } from '../src/services/jathagamDoshaData';

const phpQuote = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

for (const key of NAVAGRAHA_ORDER) {
  const info = NAVAGRAHA_DOSHA_DATA[key];
  const line =
    `                ${phpQuote('fullRemEn')} => ${phpQuote(navagrahaRemedyText(info, 'en'))}, ` +
    `${phpQuote('fullRemTa')} => ${phpQuote(navagrahaRemedyText(info, 'ta'))}, ` +
    `${phpQuote('fullRemHi')} => ${phpQuote(navagrahaRemedyText(info, 'hi'))},`;
  console.log(`/*${key}*/`);
  console.log(line);
}
