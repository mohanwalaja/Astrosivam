/**
 * Mobile birth-details entry — render smoke tests.
 *
 * Visitors on phones reported they could not enter a date of birth or a birth
 * time at all: the native <input type="date"> / <input type="time"> widgets do
 * not open (or cannot be typed into) in several mobile browsers, and
 * <input type="month"> does not exist in iOS Safari. Every service form now uses
 * the shared fields below, which render as a plain text input with a numeric
 * keyboard plus an in-app calendar / clock sheet and quick-select dropdowns.
 *
 * These assertions render the components to static markup so a regression that
 * reintroduces a native picker (or drops the numeric keyboard) fails the build.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BirthDateField,
  BirthTimeField,
  MonthField
} from '../src/components/common/BirthDateTimeFields';
import {
  formatDobInputWhileTyping,
  parseFlexibleDob,
  formatTobInputWhileTyping,
  parseFlexibleTob,
  parseTobInputWhileTyping
} from '../src/utils/dateTimeInput';

console.log('=====================================================');
console.log('     MOBILE BIRTH DATE & TIME FIELD VERIFICATION      ');
console.log('=====================================================\n');

let failedTests = 0;
function assert(desc: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log('  [PASS]', desc);
  } else {
    console.error('  [FAIL]', desc, extra ? JSON.stringify(extra) : '');
    failedTests++;
  }
}

const noop = () => {};

const emptyDate = renderToStaticMarkup(<BirthDateField value="" onChange={noop} theme="dark" />);
const filledDate = renderToStaticMarkup(
  <BirthDateField value="1990-08-15" onChange={noop} theme="light" size="sm" label="Date of Birth" />
);
const emptyTime = renderToStaticMarkup(<BirthTimeField value="" onChange={noop} theme="dark" />);
const filledTime = renderToStaticMarkup(<BirthTimeField value="21:30" onChange={noop} theme="light" />);
const month = renderToStaticMarkup(<MonthField value="2026-11" onChange={noop} theme="dark" min="2026-09" />);

const all = [emptyDate, filledDate, emptyTime, filledTime, month].join('\n');

console.log('TEST 1: The fields are typeable on a phone');
assert('date field is a text input (never type="date")', emptyDate.includes('type="text"') && !all.includes('type="date"'));
assert('time field is a text input (never type="time")', emptyTime.includes('type="text"') && !all.includes('type="time"'));
assert('month picker uses selects (never type="month")', month.includes('<select') && !all.includes('type="month"'));
assert('both fields request the numeric keyboard', /inputMode="numeric"/i.test(emptyDate) && /inputMode="numeric"/i.test(emptyTime));
assert('both fields are 16px+ on mobile so iOS never zooms the page', emptyDate.includes('text-base') && emptyTime.includes('text-base'));
assert('touch-manipulation is applied (no 300ms tap delay / double-tap zoom)', emptyDate.includes('touch-manipulation'));

console.log('\nTEST 2: Values round-trip in the formats the engine expects');
assert('ISO date is displayed as DD/MM/YYYY', filledDate.includes('value="15/08/1990"'));
assert('the stored ISO value is confirmed back to the visitor', filledDate.includes('✓ 15 Aug 1990 (1990-08-15)'));
assert('24-hour time is displayed as 12-hour', filledTime.includes('value="09:30"'));
assert('the 24-hour value stays visible for verification', filledTime.includes('24-hr: 21:30'));
assert('the month field confirms YYYY-MM', month.includes('(2026-11)'));

console.log('\nTEST 3: Every fallback entry route is rendered');
assert('calendar sheet button is present', emptyDate.includes('Open calendar for'));
assert('clock sheet button is present', emptyTime.includes('Open clock for'));
assert('quick-select dropdowns are offered for the date', emptyDate.includes('Quick select'));
assert('AM / PM toggle is present for the time', emptyTime.includes('>AM<') && emptyTime.includes('>PM<'));
assert('the unknown-time shortcut falls back to noon', emptyTime.includes('12:00 PM'));
assert('time field explains numeric-keypad entry', emptyTime.includes('Type digits (e.g. 0930), select AM/PM, or tap Pick'));
assert('month picker lists all twelve months', month.includes('January') && month.includes('December'));

console.log('\nTEST 4: Live typing and year entry sequence checks');
// Simulating typing sequence: "15" -> "15/08" -> user enters year "1990"
let cur = '1';
cur = formatDobInputWhileTyping(cur);
assert('typing 1 -> "1"', cur === '1');
cur = formatDobInputWhileTyping(cur + '5');
assert('typing 15 -> "15"', cur === '15');
cur = formatDobInputWhileTyping(cur + '0');
assert('typing 150 -> "15/0"', cur === '15/0');
cur = formatDobInputWhileTyping(cur + '8');
assert('typing 15/08 -> "15/08"', cur === '15/08');
// Crucial check: user types 1 after 15/08
cur = formatDobInputWhileTyping(cur + '1');
assert('typing year 1 after 15/08 -> "15/08/1"', cur === '15/08/1');
cur = formatDobInputWhileTyping(cur + '9');
assert('typing year 9 -> "15/08/19"', cur === '15/08/19');
cur = formatDobInputWhileTyping(cur + '9');
assert('typing year 9 -> "15/08/199"', cur === '15/08/199');
cur = formatDobInputWhileTyping(cur + '0');
assert('typing year 0 -> "15/08/1990"', cur === '15/08/1990');
assert('parsed completed DOB -> "1990-08-15"', parseFlexibleDob(cur) === '1990-08-15');

// Additional typing variations
assert('continuous digits 15081990 -> 15/08/1990', formatDobInputWhileTyping('15081990') === '15/08/1990');
assert('single digit day/month 5/8/1985 -> 5/8/1985', formatDobInputWhileTyping('5/8/1985') === '5/8/1985');
assert('parsed 5/8/1985 -> 1985-08-05', parseFlexibleDob('5/8/1985') === '1985-08-05');
assert('pasted ISO 1995-12-25 -> 1995-12-25', parseFlexibleDob('1995-12-25') === '1995-12-25');
assert('pasted dotted 25.12.1995 -> 1995-12-25', parseFlexibleDob('25.12.1995') === '1995-12-25');

console.log('\nTEST 5: Birth time remains editable through numeric-keyboard typing');
const simulateTypedTime = (digits: string, initialPeriod: 'AM' | 'PM') => {
  let text = '';
  let period = initialPeriod;
  let parsed: ReturnType<typeof parseTobInputWhileTyping> = null;

  for (const digit of digits) {
    const raw = text + digit;
    const formatted = formatTobInputWhileTyping(raw);
    parsed = parseTobInputWhileTyping(raw, period);
    if (parsed) {
      text = parsed.display12;
      period = parsed.period;
    } else {
      text = formatted;
    }
  }

  return { text, parsed };
};

const typed1230Pm = simulateTypedTime('1230', 'PM');
assert('typing 1230 keeps the incomplete 12:3 instead of changing it to 01:23',
  parseTobInputWhileTyping('123', 'PM') === null);
assert('typing 1230 with PM resolves to 12:30', typed1230Pm.parsed?.tob24 === '12:30');
assert('completed 1230 entry remains displayed as 12:30', typed1230Pm.text === '12:30');
const typed1030Pm = simulateTypedTime('1030', 'PM');
assert('typing 1030 with PM resolves to 22:30', typed1030Pm.parsed?.tob24 === '22:30');
const typed0930Pm = simulateTypedTime('0930', 'PM');
assert('typing 0930 with PM resolves to 21:30', typed0930Pm.parsed?.tob24 === '21:30');
assert('pasted 9:30 PM keeps its explicit period',
  parseTobInputWhileTyping('9:30 PM', 'AM')?.tob24 === '21:30');

console.log('=====================================================');
if (failedTests === 0) {
  console.log('  ALL MOBILE INPUT TESTS PASSED!                     ');
} else {
  console.error('  FAILURES DETECTED: ' + failedTests + ' failed tests! ');
  process.exit(1);
}
console.log('=====================================================\n');
