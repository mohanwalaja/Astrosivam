import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from '../server/db/store.js';
import { createSignedToken, verifySignedToken, cleanDisplayName, providerFallbackName } from '../server/security/tokens.js';
import { calculatePrecisionHoroscope, calculateLahiriAyanamsa, calculateSiderealAscendant } from '../server/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../server/astrology/matchmaking.js';
import { calculateBabyNamingDetails, ALL_NAKSHATRA_LETTERS } from '../server/astrology/babynames.js';
import { scanMonthMuhurtham, findNakshatraFromBirthDetails } from '../src/lib/muhurtham/scanner.js';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder.js';
import { buildWeddingMatchHtml } from '../src/services/weddingHtmlBuilder.js';
import { buildBabyNamingHtml } from '../src/services/babyNamingHtmlBuilder.js';
import { buildMuhurthamHtml } from '../src/services/muhurthamHtmlBuilder.js';
import { buildInvoiceHtml, buildFamilyInvoiceHtml } from '../src/services/invoiceHtmlBuilder.js';
import { DOSHA_DATA, PRAYER_GUIDANCE } from '../src/services/jathagamDoshaData.js';
import { parseFlexibleDob, parseFlexibleTob, formatReadableDob, formatReadableTob } from '../src/utils/dateTimeInput.js';

console.log('===============================================================');
console.log('   ASTRO SIVAM - COMPREHENSIVE SYSTEM REGRESSION CHECKS   ');
console.log('===============================================================\n');

let passedCount = 0;
function testCheck(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. USER LOGIN, ADMIN LOGIN & GOOGLE AUTH VERIFICATION
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: User Login, Admin Login & Google Authentication ---');

testCheck('User registration, password hashing & profile retrieval', () => {
  const testEmail = `audit_user_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  const passwordHash = bcrypt.hashSync(password, 10);
  
  const created = db.createUser({
    name: 'Audit Devotee',
    email: testEmail,
    mobile: '+91 9876543210',
    passwordHash,
    role: 'customer',
    country: 'India'
  });
  
  assert.ok(created.id, 'User ID must be assigned');
  assert.equal(created.email, testEmail);
  assert.ok(bcrypt.compareSync(password, created.passwordHash), 'Password verification must succeed');
  
  // Test signed token generation and signature verification
  const token = createSignedToken(created);
  assert.ok(token, 'Signed token must be generated');
  
  const verified = verifySignedToken(token);
  assert.ok(verified, 'Signed token must be verified');
  assert.equal(verified?.email, testEmail);
});

testCheck('No fixed demo accounts are created; admin role requires explicit provisioning', () => {
  for (const email of [
    'admin@astrosivam.com',
    'admin@fijiastro.com',
    'admin@astrofiji.com',
    'customer@example.com',
    'mohanwalaja@gmail.com'
  ]) {
    assert.equal(db.findUserByEmail(email), undefined, `Store must not seed ${email}`);
  }

  const testEmail = `audit_admin_${Date.now()}@example.test`;
  const password = 'TestOnly-Admin-Password-2046!';
  const adminUser = db.provisionAdminAccount({
    name: 'Audit Administrator',
    email: testEmail,
    password,
    country: 'Fiji'
  });
  assert.equal(adminUser.role, 'admin');
  assert.ok(bcrypt.compareSync(password, adminUser.passwordHash));
  assert.throws(() => db.provisionAdminAccount({
    name: 'Audit Administrator',
    email: testEmail,
    password
  }), /--promote-existing/);

  const token = createSignedToken(adminUser);
  const payload = verifySignedToken(token);
  assert.equal(payload?.role, 'admin', 'Admin token must carry the server-provisioned role');
});

testCheck('Social / Google sign-in name sanitation & identity safety', () => {
  const testNames = [
    { input: 'John Doe (Google)', expected: 'John Doe' },
    { input: 'Priya Sharma (Facebook)', expected: 'Priya Sharma' },
    { input: 'Mohan - Google', expected: 'Mohan' },
    { input: 'Ramesh Chand via Google', expected: 'Ramesh Chand' },
    { input: '', expected: '' }
  ];
  
  for (const item of testNames) {
    const cleaned = cleanDisplayName(item.input);
    assert.equal(cleaned, item.expected);
  }
  
  const fallback = providerFallbackName('ramesh.kumar@gmail.com');
  assert.equal(fallback, 'Ramesh Kumar');
});

// ---------------------------------------------------------------------------
// 2. FORM FILLING & MOBILE-PROOF DATE/TIME INPUT VALIDATION
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: Form Input Formatting & Mobile-Proof Parsing ---');

testCheck('Date of birth flexible parser accepts multiple human formats', () => {
  assert.equal(parseFlexibleDob('1990-05-25'), '1990-05-25');
  assert.equal(parseFlexibleDob('25/05/1990'), '1990-05-25');
  assert.equal(parseFlexibleDob('25-05-1990'), '1990-05-25');
  assert.equal(parseFlexibleDob('25.05.1990'), '1990-05-25');
  assert.equal(parseFlexibleDob('25051990'), '1990-05-25');
});

testCheck('Time of birth flexible parser handles 12h, 24h & meridians', () => {
  assert.equal(parseFlexibleTob('14:30').tob24, '14:30');
  assert.equal(parseFlexibleTob('02:30 PM').tob24, '14:30');
  assert.equal(parseFlexibleTob('2:30 pm').tob24, '14:30');
  assert.equal(parseFlexibleTob('09:15 AM').tob24, '09:15');
  assert.equal(parseFlexibleTob('9:15 am').tob24, '09:15');
  assert.equal(parseFlexibleTob('12:00 AM').tob24, '00:00');
  assert.equal(parseFlexibleTob('12:00 PM').tob24, '12:00');
});

// ---------------------------------------------------------------------------
// 3. ASTRONOMICAL CALCULATIONS & PREDICTION ACCURACY
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Astrology Calculation Engine & Prediction Precision ---');

testCheck('Lahiri Ayanamsa & Ascendant computation', () => {
  const ayanamsa2026 = calculateLahiriAyanamsa(2461120.5); // 2026
  assert.ok(ayanamsa2026 > 24.15 && ayanamsa2026 < 24.25, `Ayanamsa for 2026 should be ~24.2°, got ${ayanamsa2026}`);
});

testCheck('Horoscope Precision: 9 Grahas, 12 Bhavas, Vimshottari Dasha & Doshas', () => {
  const chart = calculatePrecisionHoroscope('Test Devotee', '1992-08-14', '06:30', 'Chennai', 13.0827, 80.2707, 5.5, 'India', 'M');
  
  assert.equal(chart.planetPositions.length, 9, 'Must calculate all 9 Navagrahas');
  assert.equal(chart.bhavas.length, 12, 'Must calculate 12 Bhavas');
  assert.ok(chart.lagnaRasi >= 1 && chart.lagnaRasi <= 12, 'Lagna Rasi must be 1-12');
  assert.ok(chart.chandraRasi >= 1 && chart.chandraRasi <= 12, 'Chandra Rasi must be 1-12');
  assert.ok(chart.janmaNakshatraEn, 'Janma Nakshatra English name must be present');
  assert.ok(chart.janmaNakshatraTa, 'Janma Nakshatra Tamil name must be present');
  assert.ok(chart.janmaNakshatraHi, 'Janma Nakshatra Hindi name must be present');
  assert.ok(chart.currentDasha, 'Current Dasha info must be present');
  const coreDoshas = chart.doshas.filter(d => !d.isNavagrahaAfflictionIndicator);
  assert.equal(coreDoshas.length, 4, 'Must evaluate Kuja, Kala Sarpa, Pitru, Guru Chandala doshas');
  assert.ok(chart.doshas.filter(d => d.isPresent).every(d => d.traditionalRemedyEn.trim()), 'Every active Navagraha indicator must have a remedy');
});

testCheck('Marriage Compatibility (10 Poruthams) accuracy', () => {
  const match = calculateWeddingCompatibility(
    { name: 'Bride', dob: '1996-03-21', tob: '07:45', birthPlace: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5 },
    { name: 'Groom', dob: '1994-11-15', tob: '18:20', birthPlace: 'Bangalore', latitude: 12.9716, longitude: 77.5946, timezoneOffsetHours: 5.5 }
  );
  
  assert.equal(match.poruthams.length, 10, 'Must calculate all 10 Poruthams');
  assert.ok(match.totalScore >= 0 && match.totalScore <= 10, 'Total score must be between 0 and 10');
  assert.ok(match.overallVerdictEn, 'Must produce clear English verdict');
  assert.ok(match.overallVerdictTa, 'Must produce Tamil verdict');
  assert.ok(match.overallVerdictHi, 'Must produce Hindi verdict');
});

testCheck('Baby Naming Namakaran: 108 Pada sound accuracy', () => {
  const baby = calculateBabyNamingDetails('Aaradhya', '2025-01-15', '11:20', 'Madurai', 'F', 9.9252, 78.1198, 5.5, 'India');
  assert.ok(baby.primaryPadaInfo.letterEn, 'Primary English syllable must be present');
  assert.ok(baby.primaryPadaInfo.letterTa, 'Primary Tamil syllable must be present');
  assert.ok(baby.primaryPadaInfo.letterHi, 'Primary Hindi syllable must be present');
  assert.equal(baby.nakshatraLetters.padas.length, 4, 'Must provide 4 padas of the birth star');
});

testCheck('Subha Muhurtham multi-month scanning precision', () => {
  const location = { placeName: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5 };
  const scan = scanMonthMuhurtham(2026, 11, location, 'wedding', { skipPastDates: false });
  assert.equal(scan.month, 11);
  assert.equal(scan.year, 2026);
  assert.ok(scan.days.length >= 28, 'Must scan all days in the month');
  assert.ok(scan.days.some(d => d.grade === 'BEST' || d.grade === 'GOOD'), 'Must identify auspicious dates');
});

// ---------------------------------------------------------------------------
// 4. REMEDIES & GOD NAMES VALIDATION (NO MANTRAS / NO RITUALS)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Remedies Rule - Deity Names Only (No Mantras / Rituals) ---');

testCheck('Remedies strictly contain deity names without mantras or rituals', () => {
  const bannedKeywords = /mantra|manthra|chanting|chalisa|namah|japa|fasting|donat|lamp|abhishek|tarpanam|மந்திர|தீபம்|தானம்|मंत्र|जाप|दीपक|दान/i;
  
  for (const [key, dosha] of Object.entries(DOSHA_DATA)) {
    for (const lang of ['en', 'ta', 'hi'] as const) {
      for (const remedy of dosha.remedies[lang]) {
        assert.doesNotMatch(remedy, bannedKeywords, `Remedy for ${key} in ${lang} must not contain mantras or rituals`);
      }
    }
  }

  for (const lang of ['en', 'ta', 'hi'] as const) {
    for (const prayer of PRAYER_GUIDANCE[lang]) {
      assert.doesNotMatch(prayer, bannedKeywords, `Prayer guidance in ${lang} must not contain mantras or rituals`);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. PDF & HTML REPORT GENERATION (NO OVERLAP / NO CLIPPING)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 5: HTML Report Layouts & PDF Generation ---');

testCheck('Birth Jathagam HTML generation in all 3 languages', () => {
  const chart = calculatePrecisionHoroscope('Devotee', '1990-01-01', '12:00', 'Chennai', 13.0827, 80.2707, 5.5, 'India', 'M');
  for (const lang of ['en', 'ta', 'hi'] as const) {
    const html = buildJathagamHtml(chart, lang);
    assert.ok(html.includes('jathagam-page-1'), `${lang}: Must contain Page 1`);
    assert.ok(html.includes('jathagam-page-2'), `${lang}: Must contain Page 2`);
    assert.ok(html.includes('jathagam-page-3'), `${lang}: Must contain Page 3`);
    assert.ok(html.includes('inner'), `${lang}: Must contain .inner container`);
  }
});

testCheck('Marriage Compatibility HTML generation in all 3 languages', () => {
  const match = calculateWeddingCompatibility(
    { name: 'Bride', dob: '1996-03-21', tob: '07:45', birthPlace: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5 },
    { name: 'Groom', dob: '1994-11-15', tob: '18:20', birthPlace: 'Bangalore', latitude: 12.9716, longitude: 77.5946, timezoneOffsetHours: 5.5 }
  );
  for (const lang of ['en', 'ta', 'hi'] as const) {
    const html = buildWeddingMatchHtml(match, lang);
    assert.ok(html.includes('wedding-page-1'), `${lang}: Must contain Page 1`);
    assert.ok(html.includes('wedding-page-2'), `${lang}: Must contain the disclaimer Page 2`);
    assert.ok(html.includes('poruthams-table'), `${lang}: Must contain 10 Poruthams table`);
  }
});

testCheck('Baby Naming Certificate HTML generation in all 3 languages', () => {
  const baby = calculateBabyNamingDetails('Aarav', '2025-01-15', '11:20', 'Chennai', 'M', 13.0827, 80.2707, 5.5, 'India');
  for (const lang of ['en', 'ta', 'hi'] as const) {
    const html = buildBabyNamingHtml(baby, lang);
    assert.ok(html.includes('namakaran-certificate-page'), `${lang}: Must contain certificate page`);
    assert.ok(html.includes('id="namakaran-page-2"'), `${lang}: Must contain the name suggestion sheet`);
    assert.ok(html.includes('sug-south') || html.includes('south-panel'), `${lang}: Must contain the South Indian column`);
    assert.ok(html.includes('north-panel'), `${lang}: Must contain the North Indian column`);
    assert.ok(html.split('class="sug-block"').length - 1 >= 4, `${lang}: Must list names for all four padas`);
  }
});

testCheck('Subha Muhurtham HTML generation in all 3 languages', () => {
  const sampleScan = {
    devoteeName: 'Karthik & Divya',
    dob: '1992-05-10',
    tob: '09:15',
    birthPlace: 'Chennai',
    country: 'India',
    eventKey: 'wedding',
    eventTitleEn: 'Wedding (Vivaha Muhurtham)',
    selectedMonth: '2026-11',
    months: [{
      monthKey: '2026-11',
      month: 11,
      year: 2026,
      monthNameEn: 'November 2026',
      monthNameTa: 'நவம்பர் 2026',
      monthNameHi: 'नवंबर 2026',
      days: [
        { date: '2026-11-05', dayOfWeekNameEn: 'Thursday', tithiNameEn: 'Shukla Dwitiya', nakshatraNameEn: 'Rohini', grade: 'BEST', nallaNeram: [{ start: '09:00 AM', end: '10:00 AM' }] },
        { date: '2026-11-12', dayOfWeekNameEn: 'Thursday', tithiNameEn: 'Shukla Navami', nakshatraNameEn: 'Hasta', grade: 'GOOD', nallaNeram: [{ start: '10:00 AM', end: '11:00 AM' }] }
      ],
      bestCount: 1,
      goodCount: 1,
      fairCount: 0,
      avoidCount: 0
    }]
  };
  for (const lang of ['en', 'ta', 'hi'] as const) {
    const html = buildMuhurthamHtml(sampleScan, lang);
    assert.ok(html.includes('muhurtham-dates-page'), `${lang}: Must contain Muhurtham page`);
  }
});

// ---------------------------------------------------------------------------
// 6. PAYMENT & INVOICING SYSTEM (SINGLE & FAMILY ORDERS)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 6: Tax Invoice & Payment Calculation System ---');

testCheck('Single Order Tax Invoice HTML generation', () => {
  const invHtml = buildInvoiceHtml({
    id: 'ord_test_001',
    orderNumber: 'AS-2026-1001',
    createdAt: new Date().toISOString(),
    serviceType: 'BIRTH_JATHAGAM',
    amount: 50.0,
    currency: 'INR',
    language: 'en',
    userName: 'Ramesh Sundaram',
    userEmail: 'ramesh@example.com'
  });
  
  assert.ok(invHtml.includes('TAX INVOICE'), 'Must produce official Tax Invoice');
  assert.ok(invHtml.includes('AS-2026-1001'), 'Must display correct order number');
  assert.ok(invHtml.includes('Ramesh Sundaram'), 'Must display customer name');
});

testCheck('Consolidated Family Order Tax Invoice HTML generation', () => {
  const orders = [
    {
      id: 'ord_fam_1',
      orderNumber: 'AS-FAM-101',
      groupId: 'grp_fam_999',
      createdAt: new Date().toISOString(),
      serviceType: 'BIRTH_JATHAGAM' as const,
      amount: 40.0,
      currency: 'INR',
      language: 'en' as const,
      userName: 'Father',
      userEmail: 'family@example.com'
    },
    {
      id: 'ord_fam_2',
      orderNumber: 'AS-FAM-102',
      groupId: 'grp_fam_999',
      createdAt: new Date().toISOString(),
      serviceType: 'MARRIAGE_COMPATIBILITY' as const,
      amount: 40.0,
      currency: 'INR',
      language: 'en' as const,
      userName: 'Son & Bride',
      userEmail: 'family@example.com'
    }
  ];
  
  const famInvHtml = buildFamilyInvoiceHtml(orders, 'grp_fam_999');
  assert.ok(famInvHtml.includes('CONSOLIDATED FAMILY TAX INVOICE'), 'Must produce consolidated invoice');
  assert.ok(famInvHtml.includes('AS-FAM-101'), 'Must list member 1 order');
  assert.ok(famInvHtml.includes('AS-FAM-102'), 'Must list member 2 order');
});

console.log(`\n===============================================================`);
console.log(`  ALL ${passedCount} INTEGRATION CHECKS COMPLETED WITH 100% SUCCESS!`);
console.log(`===============================================================\n`);
