/**
 * ASTRO SIVAM — Local Astrology Preview Calculator
 * ================================================
 *
 * Client-side calculation engine for report previews and sample reports.
 * Uses the high-precision TypeScript astrology modules (astronomy, matchmaking,
 * babynames, muhurtham scanner) which have verified mathematical parity with
 * the cPanel PHP engine.
 *
 * Ensures instant, reliable calculation in the browser, development server,
 * and edge environments without failing if the PHP API is unreachable or
 * returning non-JSON hosting responses.
 */

import { calculatePrecisionHoroscope } from '../lib/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../lib/astrology/matchmaking.js';
import { calculateBabyNamingDetails } from '../lib/astrology/babynames.js';
import {
  scanMonthMuhurtham,
  describePersonForMuhurtham,
  MUHURTHAM_ALGORITHM_VERSION,
  type MuhurthamPersonDetails,
  type PersonInput
} from '../lib/muhurtham/scanner.js';
import { ServiceType } from '../types';

export function calculateLocalAstrology(
  serviceType: ServiceType | string,
  payload: Record<string, any>
): any {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid calculation payload.');
  }

  switch (serviceType) {
    case 'MARRIAGE_COMPATIBILITY': {
      return calculateWeddingCompatibility(payload);
    }

    case 'BABY_NAMING': {
      return calculateBabyNamingDetails(payload);
    }

    case 'MUHURTHAM': {
      const devotee = payload.name || payload.devoteeName || 'User';
      const eventKey = payload.eventKey || payload.muhurthamScan?.eventKey || 'wedding';
      const selectedMonth =
        payload.selectedMonth ||
        payload.muhurthamScan?.selectedMonth ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 3).padStart(2, '0')}`;

      // If a precomputed scan exists on the payload, use its verified scan data
      if (payload.muhurthamScan && Array.isArray(payload.muhurthamScan.months)) {
        return {
          muhurthamAlgorithmVersion: payload.muhurthamScan.muhurthamAlgorithmVersion ?? MUHURTHAM_ALGORITHM_VERSION,
          devoteeName: devotee,
          dob: payload.dob || '',
          tob: payload.tob || '',
          birthPlace: payload.birthPlace || '',
          country: payload.country || '',
          latitude: payload.latitude,
          longitude: payload.longitude,
          timezoneOffsetHours: payload.timezoneOffsetHours,
          timeZoneId: payload.timeZoneId || '',
          muhurthamPlace: payload.muhurthamPlace || payload.birthPlace || '',
          muhurthamCountry: payload.muhurthamCountry || payload.country || '',
          muhurthamLatitude: payload.muhurthamLatitude ?? payload.latitude,
          muhurthamLongitude: payload.muhurthamLongitude ?? payload.longitude,
          muhurthamTimezoneOffsetHours: payload.muhurthamTimezoneOffsetHours ?? payload.timezoneOffsetHours,
          muhurthamTimeZoneId: (payload.muhurthamTimeZoneId ?? payload.timeZoneId) || '',
          eventKey,
          eventTitleEn: payload.eventTitleEn || 'Subha Muhurtham',
          eventTitleTa: payload.eventTitleTa || '',
          eventTitleHi: payload.eventTitleHi || '',
          selectedMonth,
          months: payload.muhurthamScan.months,
          persons: payload.muhurthamScan.persons || [],
          muhurthamScan: payload.muhurthamScan
        };
      }

      // Compute Muhurtham scan from payload parameters
      const [targetYear, targetMonth] = selectedMonth.split('-').map(Number);
      const targetDate = new Date(targetYear || new Date().getFullYear(), (targetMonth || 1) - 1, 1);
      const scanLocation = {
        placeName: payload.muhurthamPlace || payload.birthPlace || 'Chennai',
        latitude: Number(payload.muhurthamLatitude ?? payload.latitude ?? 13.0827),
        longitude: Number(payload.muhurthamLongitude ?? payload.longitude ?? 80.2707),
        timezoneOffsetHours: Number(payload.muhurthamTimezoneOffsetHours ?? payload.timezoneOffsetHours ?? 5.5),
        timeZoneId: payload.muhurthamTimeZoneId ?? payload.timeZoneId
      };

      const personDetails: MuhurthamPersonDetails[] = [];
      if (payload.dob && payload.tob && payload.birthPlace) {
        const p1 = describePersonForMuhurtham(payload.bride ? 'groom' : 'self', devotee, {
          dob: payload.dob,
          tob: payload.tob,
          birthPlace: payload.birthPlace,
          latitude: Number(payload.latitude ?? scanLocation.latitude),
          longitude: Number(payload.longitude ?? scanLocation.longitude),
          timezoneOffsetHours: Number(payload.timezoneOffsetHours ?? scanLocation.timezoneOffsetHours)
        });
        if (p1) personDetails.push(p1);
      }

      if (payload.bride && typeof payload.bride === 'object') {
        const p2 = describePersonForMuhurtham('bride', payload.bride.name || 'Bride', {
          dob: payload.bride.dob,
          tob: payload.bride.tob,
          birthPlace: payload.bride.birthPlace || payload.birthPlace,
          latitude: Number(payload.bride.latitude ?? scanLocation.latitude),
          longitude: Number(payload.bride.longitude ?? scanLocation.longitude),
          timezoneOffsetHours: Number(payload.bride.timezoneOffsetHours ?? scanLocation.timezoneOffsetHours)
        });
        if (p2) personDetails.push(p2);
      }

      const scanPersons: PersonInput[] = personDetails.map(person => ({
        role: person.role,
        nakshatraIndex: person.nakshatraIndex,
        rasiNumber: person.rasiNumber
      }));

      const months = Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + index - 2, 1);
        return scanMonthMuhurtham(
          monthDate.getFullYear(),
          monthDate.getMonth() + 1,
          scanLocation,
          eventKey,
          { persons: scanPersons, birthDate: payload.dob, skipPastDates: true }
        );
      });

      return {
        muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
        devoteeName: devotee,
        dob: payload.dob || '',
        tob: payload.tob || '',
        birthPlace: payload.birthPlace || '',
        country: payload.country || '',
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezoneOffsetHours: payload.timezoneOffsetHours,
        timeZoneId: payload.timeZoneId || '',
        muhurthamPlace: scanLocation.placeName,
        muhurthamCountry: payload.muhurthamCountry || payload.country || '',
        muhurthamLatitude: scanLocation.latitude,
        muhurthamLongitude: scanLocation.longitude,
        muhurthamTimezoneOffsetHours: scanLocation.timezoneOffsetHours,
        muhurthamTimeZoneId: scanLocation.timeZoneId || '',
        eventKey,
        selectedMonth,
        months,
        persons: personDetails
      };
    }

    case 'BIRTH_JATHAGAM':
    default: {
      const name = payload.name || payload.devoteeName || 'User';
      const dob = payload.dob || '';
      const tob = payload.tob || '';
      const birthPlace = payload.birthPlace || '';
      const lat = Number(payload.latitude);
      const lng = Number(payload.longitude);
      const tzOffset = Number(payload.timezoneOffsetHours);
      const country = payload.country || '';
      const gender = payload.gender || 'M';

      return calculatePrecisionHoroscope(name, dob, tob, birthPlace, lat, lng, tzOffset, country, gender);
    }
  }
}
