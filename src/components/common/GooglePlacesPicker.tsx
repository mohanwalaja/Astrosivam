import React, { useState, useEffect, useRef, useId } from 'react';
import {
  MapPin,
  Search,
  Crosshair,
  Check,
  Globe,
  Map as MapIcon,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Compass,
  Navigation
} from 'lucide-react';
import L from 'leaflet';
import {
  estimateTimezoneOffset,
  LocationData
} from '../../data/worldwideLocations';
import {
  formatUtcOffset,
  getCurrentTimezoneOffset,
  getTimeZoneIdForCoordinates
} from '../../lib/timezone';
import { isVerifiedBirthLocation } from '../../utils/birthDetails';

export type { LocationData };

const displayCurrentOffset = (location: LocationData): string => {
  const timeZoneId = location.timeZoneId ||
    getTimeZoneIdForCoordinates(location.latitude, location.longitude);
  const currentOffset = timeZoneId ? getCurrentTimezoneOffset(timeZoneId) : null;
  return formatUtcOffset(currentOffset ?? location.timezoneOffsetHours);
};

interface GooglePlacesPickerProps {
  value?: LocationData | null;
  onChange: (location: LocationData | null) => void;
  label?: string;
  required?: boolean;
}

export const GooglePlacesPicker: React.FC<GooglePlacesPickerProps> = ({
  value,
  onChange,
  label = 'Birth Place (Global Location)',
  required = false
}) => {
  const inputId = `location-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [query, setQuery] = useState(value?.placeName || '');
  const previousSelectedPlace = useRef(value?.placeName || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<LocationData[]>([]);

  // Map Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState<LocationData>(
    value && value.latitude !== undefined && value.placeName
      ? value
      : {
          placeName: 'Chennai, Tamil Nadu, India',
          country: 'India',
          latitude: 13.0827,
          longitude: 80.2707,
          timezoneOffsetHours: 5.5,
          timeZoneId: 'Asia/Kolkata'
        }
  );
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync saved/selected values while keeping an in-progress search editable.
  useEffect(() => {
    const selectedPlace = value?.placeName || '';
    if (selectedPlace && selectedPlace !== query) {
      setQuery(selectedPlace);
    } else if (!selectedPlace && previousSelectedPlace.current && query === previousSelectedPlace.current) {
      setQuery('');
    }
    previousSelectedPlace.current = selectedPlace;
  }, [value?.placeName, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Worldwide Multi-Engine Geocoding Search
  useEffect(() => {
    if (!query || query.trim().length < 2 || value?.placeName === query) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    let isCurrentSearch = true;
    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      const cleanQ = query.trim();

      try {
        // 1. First search in Photon Komoot
        const photonRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQ)}&limit=8`
        );
        
        let results: LocationData[] = [];

        if (photonRes.ok) {
          const pData = await photonRes.json();
          if (pData.features && pData.features.length > 0) {
            results = pData.features.map((feat: any) => {
              const props = feat.properties || {};
              const coords = feat.geometry.coordinates;
              const lng = Number(coords[0].toFixed(4));
              const lat = Number(coords[1].toFixed(4));
              const name = props.name || '';
              const city = props.city || props.town || props.village || props.district || '';
              const state = props.state || '';
              const country = props.country || 'Global';

              const parts: string[] = [];
              if (name) parts.push(name);
              if (city && city !== name) parts.push(city);
              if (state && state !== name && state !== city) parts.push(state);
              if (country && country !== 'Global' && !parts.includes(country)) parts.push(country);

              const placeName = parts.length > 0 ? parts.join(', ') : props.name || cleanQ;
              const tz = estimateTimezoneOffset(lat, lng, country);

              return {
                placeName,
                country,
                latitude: lat,
                longitude: lng,
                timezoneOffsetHours: tz,
                timeZoneId: getTimeZoneIdForCoordinates(lat, lng) ?? undefined,
                state: state || undefined,
                city: city || name || undefined
              };
            });
          }
        }

        // 2. Fallback to OpenStreetMap Nominatim
        if (results.length === 0) {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              cleanQ
            )}&format=json&addressdetails=1&limit=6`
          );
          if (nomRes.ok) {
            const nData = await nomRes.json();
            results = nData.map((item: any) => {
              const lat = Number(parseFloat(item.lat).toFixed(4));
              const lng = Number(parseFloat(item.lon).toFixed(4));
              const addr = item.address || {};
              const locality =
                addr.village ||
                addr.suburb ||
                addr.neighbourhood ||
                addr.town ||
                addr.city ||
                addr.county ||
                item.name;
              const state = addr.state || '';
              const country = addr.country || 'Global';
              const nameParts = [locality, state, country].filter(Boolean).join(', ');
              const tz = estimateTimezoneOffset(lat, lng, country);

              return {
                placeName: nameParts || item.display_name.split(',').slice(0, 3).join(', '),
                country,
                latitude: lat,
                longitude: lng,
                timezoneOffsetHours: tz,
                timeZoneId: getTimeZoneIdForCoordinates(lat, lng) ?? undefined,
                state: state || undefined,
                city: locality || undefined
              };
            });
          }
        }

        if (isCurrentSearch) setOnlineResults(results);
      } catch (err) {
        if (isCurrentSearch) console.warn('Geocoding search warning:', err);
      } finally {
        if (isCurrentSearch) setIsSearchingOnline(false);
      }
    }, 250);

    return () => {
      isCurrentSearch = false;
      clearTimeout(timer);
    };
  }, [query, isOpen, value?.placeName]);

  const handleSelectResult = (loc: LocationData) => {
    setQuery(loc.placeName);
    onChange(loc);
    setIsOpen(false);
  };

  // GPS Auto-Detect
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        let detectedPlaceName = `GPS Location (${lat}, ${lng})`;
        let detectedCountry = 'Detected Location';
        let detectedState = '';
        let detectedCity = '';

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            detectedCity =
              addr.village || addr.suburb || addr.town || addr.city || addr.county || '';
            detectedState = addr.state || '';
            detectedCountry = addr.country || 'Detected Location';
            if (detectedCity || detectedState) {
              detectedPlaceName = [detectedCity, detectedState, detectedCountry].filter(Boolean).join(', ');
            }
          }
        } catch (e) {
          console.warn('Reverse geocode error:', e);
        }

        const tzHours = estimateTimezoneOffset(lat, lng, detectedCountry);
        const detectedLocation: LocationData = {
          placeName: detectedPlaceName,
          country: detectedCountry,
          latitude: lat,
          longitude: lng,
          timezoneOffsetHours: tzHours,
          timeZoneId: getTimeZoneIdForCoordinates(lat, lng) ?? undefined,
          state: detectedState || undefined,
          city: detectedCity || undefined
        };

        setQuery(detectedLocation.placeName);
        onChange(detectedLocation);
        setIsLocating(false);
        setIsOpen(false);
      },
      err => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        alert('Could not automatically determine GPS location. Please type your location in the search box or select on Map.');
      }
    );
  };

  // Open Interactive Map Modal
  const openMapPicker = () => {
    setTempLocation(
      value && value.latitude !== undefined && value.placeName
        ? value
        : {
            placeName: 'Chennai, Tamil Nadu, India',
            country: 'India',
            latitude: 13.0827,
            longitude: 80.2707,
            timezoneOffsetHours: 5.5,
            timeZoneId: 'Asia/Kolkata'
          }
    );
    setMapSearchQuery(query.trim());
    setIsMapModalOpen(true);
    setIsOpen(false);
  };

  // Leaflet Map logic inside modal
  useEffect(() => {
    if (!isMapModalOpen || !mapContainerRef.current) return;

    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #020617; border: 2.5px solid #ffffff; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.5); font-size: 17px; font-weight: bold;">
          📍
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const initialLat = tempLocation.latitude ?? 13.0827;
    const initialLng = tempLocation.longitude ?? 80.2707;

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: customIcon,
    }).addTo(map);
    markerInstanceRef.current = marker;

    const reverseGeocode = async (lat: number, lng: number) => {
      const formattedLat = Number(lat.toFixed(4));
      const formattedLng = Number(lng.toFixed(4));
      setIsReverseGeocoding(true);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${formattedLat}&lon=${formattedLng}&format=json`
        );
        let place = `Location (${formattedLat}, ${formattedLng})`;
        let country = 'Global';
        let state = '';
        let city = '';

        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};
          city =
            addr.village || addr.suburb || addr.town || addr.city || addr.county || '';
          state = addr.state || '';
          country = addr.country || 'Global';
          if (city || state) {
            place = [city, state, country].filter(Boolean).join(', ');
          } else if (data.display_name) {
            place = data.display_name.split(',').slice(0, 3).join(', ');
          }
        }

        const tz = estimateTimezoneOffset(formattedLat, formattedLng, country);
        setTempLocation({
          placeName: place,
          country,
          latitude: formattedLat,
          longitude: formattedLng,
          timezoneOffsetHours: tz,
          timeZoneId: getTimeZoneIdForCoordinates(formattedLat, formattedLng) ?? undefined,
          state: state || undefined,
          city: city || undefined
        });
      } catch (err) {
        console.warn('Reverse geocoding error:', err);
      } finally {
        setIsReverseGeocoding(false);
      }
    };

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    marker.on('dragend', (e: any) => {
      const { lat, lng } = e.target.getLatLng();
      reverseGeocode(lat, lng);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    };
  }, [isMapModalOpen]);

  // Search within Map Modal
  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim() || !mapInstanceRef.current || !markerInstanceRef.current) return;

    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(mapSearchQuery)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates;
          const props = data.features[0].properties || {};
          const country = props.country || 'Global';
          const place = [props.name, props.city, props.state, country].filter(Boolean).join(', ');
          const tz = estimateTimezoneOffset(lat, lng, country);

          mapInstanceRef.current.setView([lat, lng], 13);
          markerInstanceRef.current.setLatLng([lat, lng]);

          setTempLocation({
            placeName: place,
            country,
            latitude: Number(lat.toFixed(4)),
            longitude: Number(lng.toFixed(4)),
            timezoneOffsetHours: tz,
            timeZoneId: getTimeZoneIdForCoordinates(lat, lng) ?? undefined,
            state: props.state || undefined,
            city: props.city || props.name || undefined
          });
        }
      }
    } catch (err) {
      console.warn('Map search error:', err);
    }
  };

  const confirmMapLocation = () => {
    onChange(tempLocation);
    setQuery(tempLocation.placeName);
    setIsMapModalOpen(false);
  };

  const isLocationVerified = isVerifiedBirthLocation(value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Top Header Bar with Actions */}
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
        <label htmlFor={inputId} className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>{label}</span> {required && <span className="text-rose-500">*</span>}
        </label>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openMapPicker}
            className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2.5 py-1 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Pick location directly on Interactive Map"
          >
            <MapIcon className="w-3 h-3 text-indigo-500" />
            <span>Map Pinpoint</span>
          </button>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded-xl border border-amber-200/80 dark:border-amber-800/80 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Detect current device GPS"
          >
            <Crosshair className={`w-3 h-3 ${isLocating ? 'animate-spin text-amber-500' : 'text-amber-600 dark:text-amber-400'}`} />
            <span>{isLocating ? 'Locating...' : 'GPS Auto'}</span>
          </button>
        </div>
      </div>

      {/* Global Quick Search Input Box */}
      <div className="relative">
        <div className="relative flex items-center bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/50 focus-within:border-amber-500 dark:focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-500/15 rounded-2xl shadow-xs transition-all duration-200 overflow-hidden">
          <div className="pl-3.5 pr-2 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>

          <input
            id={inputId}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck="false"
            value={query}
            onChange={e => {
              const nextQuery = e.target.value;
              setQuery(nextQuery);
              if (value?.placeName && nextQuery !== value.placeName) onChange(null);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.length >= 2 || onlineResults.length > 0) {
                setIsOpen(true);
              }
            }}
            placeholder="Search birth city, town, village, or district worldwide..."
            className="w-full py-3.5 pr-20 bg-transparent text-slate-900 dark:text-white text-base sm:text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none touch-manipulation"
          />

          {/* Right Status / Quick Actions */}
          <div className="absolute right-3 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setOnlineResults([]);
                  setIsOpen(false);
                  if (value) onChange(null);
                }}
                className="w-6 h-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {isSearchingOnline ? (
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            ) : isLocationVerified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" /> Mapped
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modern Verified Location Coordinates Card */}
      {isLocationVerified && (
        <div className="mt-2.5 p-3.5 bg-gradient-to-r from-amber-50/70 via-slate-50 to-white dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900 border border-amber-500/30 dark:border-amber-500/20 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                <span>{value.placeName}</span>
                {value.country && (
                  <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                    {value.country}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap font-mono">
                <span>Lat: <strong>{value.latitude}°</strong></span>
                <span>•</span>
                <span>Long: <strong>{value.longitude}°</strong></span>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400 font-sans font-semibold">
                  Offset: {displayCurrentOffset(value)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openMapPicker}
            className="text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 font-bold shrink-0 self-start sm:self-center flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/20 transition-all cursor-pointer"
          >
            <span>Adjust on Map</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Worldwide Live Results Dropdown Panel */}
      {isOpen && (query.length >= 2 || onlineResults.length > 0) && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-1 duration-150 max-h-[340px] overflow-y-auto">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Worldwide Matching Places ({onlineResults.length})</span>
            </span>
            {isSearchingOnline && (
              <span className="text-[10.5px] text-slate-400 lowercase font-normal flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" /> searching...
              </span>
            )}
          </div>

          {onlineResults.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {onlineResults.map((loc, idx) => (
                <button
                  key={`res-${idx}`}
                  type="button"
                  onClick={() => handleSelectResult(loc)}
                  className="w-full text-left px-4 py-3 hover:bg-amber-500/10 dark:hover:bg-amber-500/15 flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                        {loc.placeName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {loc.country} • Lat: {loc.latitude}° • Lng: {loc.longitude}° • Offset {displayCurrentOffset(loc)}
                      </div>
                    </div>
                  </div>
                  {value?.placeName === loc.placeName && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 ml-2 shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : !isSearchingOnline ? (
            <div className="text-center py-6 px-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                No matching place found for &ldquo;{query}&rdquo;.
              </p>
              <button
                type="button"
                onClick={openMapPicker}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Pinpoint Exact Village on Map</span>
              </button>
            </div>
          ) : null}

          {/* Quick Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={openMapPicker}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5" /> Pick Exact Village on Map
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Interactive Leaflet Map Modal */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col h-[560px] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Pinpoint Exact Birth Village or Area on Map
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Click anywhere on map or drag the amber marker to lock coordinates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Map Search Form */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <form onSubmit={handleMapSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={mapSearchQuery}
                    onChange={e => setMapSearchQuery(e.target.value)}
                    placeholder="Search village, taluk, town, temple, or city..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-semibold"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Find
                </button>
              </form>
            </div>

            {/* Leaflet Map Canvas */}
            <div className="relative flex-1 bg-slate-100 dark:bg-slate-950">
              <div ref={mapContainerRef} className="w-full h-full" />
              {isReverseGeocoding && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl border border-slate-700">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Detecting exact area & coordinates...</span>
                </div>
              )}
            </div>

            {/* Modal Footer with Selected Coordinates and Confirm */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{tempLocation.placeName}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Lat: <strong>{tempLocation.latitude}°</strong> • Long: <strong>{tempLocation.longitude}°</strong> • Offset {displayCurrentOffset(tempLocation)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMapLocation}
                  disabled={isReverseGeocoding}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:cursor-wait disabled:opacity-60"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Use This Location</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
