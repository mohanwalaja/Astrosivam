import { transliterateToTamil } from '../../services/indicTransliteration';

/** First written Tamil syllable, including its vowel sign (not just a prefix). */
export function firstTamilSound(text: string): string {
  return text.normalize('NFC').trim().match(/^[\u0B85-\u0BB9][\u0BBE-\u0BCD\u0BD7]?/u)?.[0] || '';
}
export function nameMatchesPada(name: string, soundTa: string): boolean {
  const first = firstTamilSound(transliterateToTamil(name));
  return Boolean(first && soundTa.split('/').some(sound => first === firstTamilSound(sound)));
}
export function nameFingerprint(name: string): string {
  return transliterateToTamil(name).normalize('NFC').trim().toLowerCase();
}
export function firstNameSound(name: string): string {
  return /[\u0B80-\u0BFF]/u.test(name) ? firstTamilSound(name) : (name.trim().match(/^[^aeiou]*[aeiou]/i)?.[0] || name.trim().slice(0, 1));
}
