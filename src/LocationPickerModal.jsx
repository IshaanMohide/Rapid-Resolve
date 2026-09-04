import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Check, X, Compass, Loader2, Sparkles } from 'lucide-react';

const PRESETS = [
  { name: 'Sector 5, Civic Zone', lat: 19.8762, lng: 75.3433 },
  { name: 'Shivaji Square, Sector 8', lat: 19.8820, lng: 75.3500 },
  { name: 'Ring Road Bypass', lat: 19.8690, lng: 75.3380 },
  { name: 'Industrial Area Zone 2', lat: 19.8910, lng: 75.3620 },
  { name: 'Medical City Hospital', lat: 19.8850, lng: 75.3350 }
];

export default function LocationPickerModal({
  isOpen,
  onClose,
  initialCoords = { lat: 19.8762, lng: 75.3433 },
  initialLocationName = 'Sector 5, Civic Zone',
  onConfirm
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [coords, setCoords] = useState(initialCoords);
  const [locationName, setLocationName] = useState(initialLocationName);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCoords(initialCoords || { lat: 19.8762, lng: 75.3433 });
      setLocationName(initialLocationName || 'Sector 5, Civic Zone');
    }
  }, [isOpen, initialCoords, initialLocationName]);

  // Leaflet map lifecycle
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Small delay to ensure modal DOM is mounted and visible for accurate Leaflet dimensions
    const initTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const startLat = coords?.lat || 19.8762;
      const startLng = coords?.lng || 75.3433;

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 14,
        zoomControl: true
      });
      mapInstanceRef.current = map;

      // Clean OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Custom pulsing pin for picked location
      const pinIcon = L.divIcon({
        className: 'picker-geo-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
            <div style="position: absolute; width: 28px; height: 28px; background: rgba(59, 130, 246, 0.4); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 18px; height: 18px; background: #2563eb; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([startLat, startLng], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);
      markerRef.current = marker;

      // Drag handler
      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        updateSelectedPoint(newPos.lat, newPos.lng);
      });

      // Map click handler (Click anywhere to drop / move pin)
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        updateSelectedPoint(lat, lng);
      });

      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Update position and reverse-geocode
  const updateSelectedPoint = async (lat, lng) => {
    setCoords({ lat, lng });
    setIsGeocoding(true);

    try {
      // Free OpenStreetMap Nominatim reverse geocoder
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'en' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          // Format friendly short address
          const addr = data.address || {};
          const shortName = [
            addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood,
            addr.city_district || addr.city || addr.town || addr.county
          ].filter(Boolean).join(', ');

          if (shortName) {
            setLocationName(shortName);
            return;
          }
          setLocationName(data.display_name.split(',').slice(0, 3).join(','));
          return;
        }
      }
    } catch {
      // Fallback gracefully to smart coordinate-based label
    } finally {
      setIsGeocoding(false);
    }

    // Heuristic label fallback
    setLocationName(`Pin Location [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
  };

  // Preset button selection
  const handleSelectPreset = (preset) => {
    setCoords({ lat: preset.lat, lng: preset.lng });
    setLocationName(preset.name);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([preset.lat, preset.lng], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([preset.lat, preset.lng]);
      }
    }
  };

  // Browser GPS geolocation
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          }
        }
        updateSelectedPoint(latitude, longitude);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation failed:', err.message);
        alert('Could not access current GPS location. Please click directly on the map.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm({
        name: locationName.trim() || `Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
        lat: Number(coords.lat.toFixed(6)),
        lng: Number(coords.lng.toFixed(6))
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/90 border-b border-slate-700/80 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Select Incident Location on Map</span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                  GPS Live
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Click anywhere on the map or drag the pin to set the exact coordinates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset quick buttons & GPS Locate */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <span className="text-slate-400 text-[11px] font-medium whitespace-nowrap">City Presets:</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className="bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 px-2.5 py-1 rounded-lg whitespace-nowrap text-[11px] transition"
              >
                {p.name.split(',')[0]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 px-2.5 py-1 rounded-lg text-xs font-medium transition"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{isLocating ? 'Locating...' : 'My GPS'}</span>
          </button>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[320px] sm:min-h-[380px] bg-slate-950">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs text-slate-300 shadow-lg pointer-events-none flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>Lat: <b>{coords.lat.toFixed(4)}</b></span>
            <span>Lng: <b>{coords.lng.toFixed(4)}</b></span>
          </div>
        </div>

        {/* Selected Location Details & Edit Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Location Label / Street Description</span>
              {isGeocoding && (
                <span className="text-[11px] text-blue-400 flex items-center gap-1 font-normal">
                  <Loader2 className="w-3 h-3 animate-spin" /> Resolving address...
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="E.g., Crossroad near Metro Station, Sector 4..."
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Use Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
