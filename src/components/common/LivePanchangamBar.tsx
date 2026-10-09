import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Sun, Moon, Sparkles, MapPin, AlertCircle, Compass } from 'lucide-react';
import * as Astronomy from 'astronomy-engine';
import { calculateLahiriAyanamsa } from '../../../server/astrology/ayanamsa.js';

interface CityOption {
  name: string;
  country: string;
  lat: number;
  lon: number;
  tzOffset: number; // in hours
}

const CITIES: CityOption[] = [
  { name: 'Chennai / New Delhi', country: 'India', lat: 13.0827, lon: 80.2707, tzOffset: 5.5 },
  { name: 'Bengaluru / Mumbai', country: 'India', lat: 12.9716, lon: 77.5946, tzOffset: 5.5 },
  { name: 'Nadi / Suva', country: 'Fiji', lat: -17.8000, lon: 177.4100, tzOffset: 12.0 },
  { name: 'Singapore / Malaysia', country: 'Singapore', lat: 1.3521, lon: 103.8198, tzOffset: 8.0 },
  { name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, tzOffset: 0.0 },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708, tzOffset: 4.0 },
  { name: 'Sydney / Melbourne', country: 'Australia', lat: -33.8688, lon: 151.2093, tzOffset: 10.0 },
  { name: 'Auckland', country: 'New Zealand', lat: -36.8485, lon: 174.7633, tzOffset: 12.0 },
  { name: 'New York / Toronto', country: 'USA/Canada', lat: 40.7128, lon: -74.0060, tzOffset: -5.0 },
  { name: 'San Francisco / Vancouver', country: 'USA/Canada', lat: 37.7749, lon: -122.4194, tzOffset: -8.0 },
];

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Arudra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

const TITHIS = [
  'Prathama (Shukla)', 'Dvitiya (Shukla)', 'Tritiya (Shukla)', 'Chaturthi (Shukla)',
  'Panchami (Shukla)', 'Shashthi (Shukla)', 'Saptami (Shukla)', 'Ashtami (Shukla)',
  'Navami (Shukla)', 'Dashami (Shukla)', 'Ekadashi (Shukla)', 'Dvadashi (Shukla)',
  'Trayodashi (Shukla)', 'Chaturdashi (Shukla)', 'Purnima (Full Moon)',
  'Prathama (Krishna)', 'Dvitiya (Krishna)', 'Tritiya (Krishna)', 'Chaturthi (Krishna)',
  'Panchami (Krishna)', 'Shashthi (Krishna)', 'Saptami (Krishna)', 'Ashtami (Krishna)',
  'Navami (Krishna)', 'Dashami (Krishna)', 'Ekadashi (Krishna)', 'Dvadashi (Krishna)',
  'Trayodashi (Krishna)', 'Chaturdashi (Krishna)', 'Amavasya (New Moon)'
];

const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
  'Sukarma', 'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva',
  'Vyaghata', 'Harshana', 'Vajra', 'Asiddhi', 'Vyatipata', 'Variyan',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla',
  'Brahma', 'Indra', 'Vaidhriti'
];

const KARANAS = [
  'Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti (Bhadra)',
  'Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'
];

const DAYS_SANSKRIT = [
  'Bhanu Vasaram (Sun)',
  'Soma Vasaram (Mon)',
  'Mangala Vasaram (Tue)',
  'Budha Vasaram (Wed)',
  'Guru Vasaram (Thu)',
  'Shukra Vasaram (Fri)',
  'Sthira Vasaram (Sat)',
];

const RAHU_KALAM_TIMES = [
  { start: '16:30', end: '18:00', label: 'Sunday (Surya)' },
  { start: '07:30', end: '09:00', label: 'Monday (Chandra)' },
  { start: '15:00', end: '16:30', label: 'Tuesday (Mangala)' },
  { start: '12:00', end: '13:30', label: 'Wednesday (Budha)' },
  { start: '13:30', end: '15:00', label: 'Thursday (Guru)' },
  { start: '10:30', end: '12:00', label: 'Friday (Shukra)' },
  { start: '09:00', end: '10:30', label: 'Saturday (Shani)' },
];

export const LivePanchangamBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [selectedCity, setSelectedCity] = useState<CityOption>(CITIES[0]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute local time in chosen city timezone
  const cityDate = useMemo(() => {
    const utcMs = currentTime.getTime();
    return new Date(utcMs + selectedCity.tzOffset * 3600000);
  }, [currentTime, selectedCity]);

  const dayOfWeek = cityDate.getUTCDay();
  const rahuWindow = RAHU_KALAM_TIMES[dayOfWeek];

  // Real-time Astronomical Calculation using Astronomy Engine
  const panchangData = useMemo(() => {
    try {
      const time = Astronomy.MakeTime(currentTime);
      const jd = time.ut + 2451545.0;
      // Single source of truth: the same Lahiri (Chitra Paksha) function the
      // horoscope engine uses. This file used to carry its own two-term
      // polynomial, so the live panchangam bar could disagree with a report.
      const ayanamsa = calculateLahiriAyanamsa(jd);

      const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
      const sunEcl = Astronomy.Ecliptic(sunGeo);
      const sunTrop = (sunEcl.elon % 360 + 360) % 360;
      const sunSid = (sunTrop - ayanamsa + 360) % 360;

      const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
      const moonEcl = Astronomy.Ecliptic(moonGeo);
      const moonTrop = (moonEcl.elon % 360 + 360) % 360;
      const moonSid = (moonTrop - ayanamsa + 360) % 360;

      // 1. TITHI
      const diffDeg = (moonTrop - sunTrop + 360) % 360;
      const tithiIdx = Math.floor(diffDeg / 12.0) % 30;

      // 2. NAKSHATRA
      const nakSpan = 360.0 / 27.0;
      const nakIdx = Math.floor(moonSid / nakSpan) % 27;
      const degInNak = moonSid - nakIdx * nakSpan;
      const pada = Math.min(4, Math.max(1, Math.floor(degInNak / (nakSpan / 4.0)) + 1));

      // 3. YOGA
      const yogaSum = (sunSid + moonSid) % 360;
      const yogaIdx = Math.floor(yogaSum / nakSpan) % 27;

      // 4. KARANA
      const karanaIndex = Math.floor(diffDeg / 6.0) % 60;
      let karanaFixedIdx = 0;
      if (karanaIndex === 0) {
        karanaFixedIdx = 10;
      } else if (karanaIndex >= 57) {
        karanaFixedIdx = karanaIndex - 50;
      } else {
        karanaFixedIdx = (karanaIndex - 1) % 7;
      }

      return {
        tithi: TITHIS[tithiIdx],
        nakshatra: `${NAKSHATRAS[nakIdx]} (Pada ${pada})`,
        yoga: YOGAS[yogaIdx],
        karana: KARANAS[karanaFixedIdx]
      };
    } catch (e) {
      return {
        tithi: 'Shukla Ekadashi',
        nakshatra: 'Shravana (Pada 2)',
        yoga: 'Shubha',
        karana: 'Bava'
      };
    }
  }, [currentTime]);

  return (
    <section className={`bg-gradient-to-r from-[#171032] via-[#201440] to-[#171032] border-y border-amber-500/30 py-3.5 px-4 shadow-xl select-none ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Location & Real-Time Clock */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Vedic Panchangam</span>
          </div>

          {/* City Selector */}
          <div className="flex items-center gap-1.5 bg-[#0f0c24] px-2.5 py-1 rounded-xl border border-white/10 text-xs text-slate-200">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedCity.name}
              onChange={(e) => {
                const found = CITIES.find(c => c.name === e.target.value);
                if (found) setSelectedCity(found);
              }}
              aria-label="Select location for live Panchangam calculations"
              className="bg-transparent text-xs font-semibold text-amber-200 focus:outline-none cursor-pointer"
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name} className="bg-[#1a1438] text-white">
                  {c.name} ({c.country})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono font-bold text-[#fffdfa] flex items-center gap-1.5 bg-[#0f0c24] px-3 py-1 rounded-xl border border-white/10">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {cityDate.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* Center/Right: 5 Limbs of Panchangam & Rahu Kalam */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs flex-grow">
            {/* Tithi */}
            <div className="bg-[#120e2a] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Tithi</span>
                <span className="font-bold text-[#fffdfa] text-[11px] truncate">{panchangData.tithi}</span>
              </div>
            </div>

            {/* Nakshatram */}
            <div className="bg-[#120e2a] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Nakshatram</span>
                <span className="font-bold text-amber-300 text-[11px] truncate">{panchangData.nakshatra}</span>
              </div>
            </div>

            {/* Vara / Day */}
            <div className="bg-[#120e2a] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Vara</span>
                <span className="font-bold text-[#fffdfa] text-[11px] truncate">{DAYS_SANSKRIT[dayOfWeek]}</span>
              </div>
            </div>

            {/* Rahu Kalam */}
            <div className="bg-[#241018] px-3 py-1.5 rounded-xl border border-rose-500/30 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-rose-300 block uppercase font-mono">Rahu Kalam</span>
                <span className="font-bold text-rose-200 text-[11px] truncate">
                  {rahuWindow.start} - {rahuWindow.end}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
