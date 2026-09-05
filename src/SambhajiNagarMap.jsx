import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

// Key Municipal Wards & Response Hubs in Chhatrapati Sambhaji Nagar
export const SAMBHAJI_NAGAR_WARDS = [
  { name: "Kranti Chowk Central", lat: 19.8735, lng: 75.3283, type: "Headquarters & Police", status: "Active", alerts: 3 },
  { name: "CIDCO Wards (N-1 to N-12)", lat: 19.8789, lng: 75.3654, type: "Water & PWD Division", status: "Critical", alerts: 8 },
  { name: "Waluj MIDC Industrial Sector", lat: 19.8324, lng: 75.2285, type: "HazMat & Power Station", status: "Active", alerts: 4 },
  { name: "Garkheda & Sutgirni", lat: 19.8621, lng: 75.3412, type: "Sanitation & Drainage Hub", status: "Optimal", alerts: 2 },
  { name: "Chikalthana / Airport Road", lat: 19.8711, lng: 75.3982, type: "Street Light & Grid Control", status: "Active", alerts: 3 },
  { name: "Begumpura / University Zone", lat: 19.9015, lng: 75.3082, type: "Civic Health Sub-Centre", status: "Optimal", alerts: 1 },
  { name: "Padampura / Station Road", lat: 19.8654, lng: 75.3211, type: "Central Fire & Rescue Depot", status: "Active", alerts: 2 },
  { name: "TV Centre / HUDCO", lat: 19.9042, lng: 75.3491, type: "Water Reservoir & Supply Line", status: "Critical", alerts: 5 }
];

// Module-level persistent coordinates and zoom level so the map NEVER resets its view
let persistentCenter = [19.8762, 75.3433];
let persistentZoom = 13;

function SambhajiNagarMapComponent({
  tickets = [],
  selectedWard = null,
  onSelectWard = () => {}
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const wardLayerRef = useRef(null);
  const ticketLayerRef = useRef(null);
  const lastDimensionsRef = useRef({ width: 0, height: 0 });
  const onSelectWardRef = useRef(onSelectWard);
  onSelectWardRef.current = onSelectWard;

  // 1. Initialize Leaflet Map ONCE on mount with anti-flicker & persistent settings
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      // Clean up any residual leaflet DOM ID before initialization
      if (mapContainerRef.current._leaflet_id) {
        delete mapContainerRef.current._leaflet_id;
      }

      const map = L.map(mapContainerRef.current, {
        center: persistentCenter,
        zoom: persistentZoom,
        minZoom: 10,
        maxZoom: 18,
        zoomSnap: 1,
        zoomDelta: 1,
        scrollWheelZoom: true,
        zoomControl: false,
        preferCanvas: true
      });
      mapInstanceRef.current = map;

      // Track pan and zoom so user position is NEVER lost or reset
      map.on('moveend zoomend', () => {
        try {
          const c = map.getCenter();
          persistentCenter = [c.lat, c.lng];
          persistentZoom = map.getZoom();
        } catch {
          // ignore
        }
      });

      // High-performance OpenStreetMap layer with subdomains
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 9,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      // Separate layers for static wards and dynamic tickets
      const wardLayer = L.layerGroup().addTo(map);
      const ticketLayer = L.layerGroup().addTo(map);
      wardLayerRef.current = wardLayer;
      ticketLayerRef.current = ticketLayer;

      // Render Static Ward Markers (Clean, Steady SVG, No Blinking)
      SAMBHAJI_NAGAR_WARDS.forEach((w) => {
        const isCritical = w.status === 'Critical';
        const color = isCritical ? '#e11d48' : '#0284c7';

        const wardIcon = L.divIcon({
          className: 'csn-ward-pin',
          html: `
            <div style="
              position: relative;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            ">
              <div style="
                position: absolute;
                inset: 0;
                background: ${color};
                opacity: 0.2;
                border-radius: 50%;
              "></div>
              <div style="
                width: 12px;
                height: 12px;
                background: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 1px 4px rgba(0,0,0,0.25);
              "></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([w.lat, w.lng], { icon: wardIcon }).addTo(wardLayer);

        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 190px; color: #0f172a;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
              ${w.name}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">
              ${w.type}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <span style="color: #475569;">Active Reports:</span>
              <span style="font-weight: 800; color: ${isCritical ? '#e11d48' : '#0284c7'};">
                ${w.alerts} cases
              </span>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectWardRef.current) {
            onSelectWardRef.current(w.name);
          }
        });
      });

      // Record initial container dimensions
      if (mapContainerRef.current) {
        lastDimensionsRef.current = {
          width: mapContainerRef.current.clientWidth,
          height: mapContainerRef.current.clientHeight
        };
      }

      // Staggered dimension settle to guarantee tiles load when DOM is painted
      const timer1 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      }, 50);

      const timer2 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      }, 250);

      const timer3 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      }, 600);

      // Single proper cleanup
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (err) {
      console.error('Failed to initialize Leaflet Map:', err);
    }
  }, []);

  // 2. Update Incident Pins in-place without touching tiles or map center
  useEffect(() => {
    if (!ticketLayerRef.current) return;

    ticketLayerRef.current.clearLayers();

    const safeTickets = Array.isArray(tickets) && tickets.length > 0 ? tickets : [
      { id: 4821, description: "Main 400mm water pipe rupture near TV Centre road", urgency: "CRITICAL", category: "Water Supply", latitude: 19.9042, longitude: 75.3491, department: "Water Supply & Drainage" },
      { id: 4822, description: "Deep pothole cluster and asphalt cave-in near flyover", urgency: "HIGH", category: "Roads & Bridges", latitude: 19.8789, longitude: 75.3654, department: "Roads & Infrastructure" },
      { id: 4823, description: "High-voltage transformer tripping in MIDC Phase 2", urgency: "HIGH", category: "Electrical & Grid", latitude: 19.8324, longitude: 75.2285, department: "Electrical & Streetlights" },
      { id: 4824, description: "Overflowing garbage dump yard creating road block", urgency: "MEDIUM", category: "Sanitation", latitude: 19.8621, longitude: 75.3412, department: "Solid Waste Management" },
      { id: 4820, description: "Major drainage unclogging completed and verified", urgency: "LOW", status: "RESOLVED", category: "Public Health", latitude: 19.8735, longitude: 75.3283, department: "Public Health" }
    ];

    safeTickets.forEach((t) => {
      const lat = parseFloat(t.latitude) || 19.8762;
      const lng = parseFloat(t.longitude) || 75.3433;

      const isResolved = t.status === 'RESOLVED';
      const isCritical = t.urgency === 'CRITICAL' || t.is_emergency;
      const pinColor = isResolved ? '#059669' : isCritical ? '#e11d48' : t.urgency === 'HIGH' ? '#d97706' : '#0284c7';

      const incidentIcon = L.divIcon({
        className: 'csn-incident-pin',
        html: `
          <div style="
            background: ${pinColor};
            width: ${isCritical ? '20px' : '16px'};
            height: ${isCritical ? '20px' : '16px'};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-size: 9px; font-weight: 900; color: #ffffff;">!</span>
          </div>
        `,
        iconSize: isCritical ? [20, 20] : [16, 16],
        iconAnchor: isCritical ? [10, 20] : [8, 16]
      });

      const marker = L.marker([lat, lng], { icon: incidentIcon }).addTo(ticketLayerRef.current);

      const popupHtml = `
        <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 200px; color: #0f172a;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <b style="font-size: 13px; color: #0f172a;">Incident #${t.id}</b>
            <span style="font-size: 10px; font-weight: 800; background: ${pinColor}18; color: ${pinColor}; border: 1px solid ${pinColor}40; padding: 1px 6px; border-radius: 4px;">
              ${isResolved ? 'SOLVED' : t.urgency || 'ACTIVE'}
            </span>
          </div>
          <div style="font-size: 12px; color: #334155; margin-bottom: 6px; line-height: 1.35;">
            ${t.description}
          </div>
          <div style="font-size: 11px; color: #64748b;">
            <b>Dept:</b> ${t.department || 'Municipal Works'}
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
    });
  }, [tickets]);

  // 3. Pan to selected ward only when user explicitly chooses a ward
  useEffect(() => {
    if (selectedWard && mapInstanceRef.current) {
      const w = SAMBHAJI_NAGAR_WARDS.find((x) => x.name === selectedWard);
      if (w) {
        persistentCenter = [w.lat, w.lng];
        persistentZoom = 15;
        mapInstanceRef.current.setView([w.lat, w.lng], 15, { animate: true });
      }
    }
  }, [selectedWard]);

  // 4. Smart resize handler: ONLY triggers invalidateSize if element dimensions ACTUALLY changed
  useEffect(() => {
    let resizeTimer = null;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!mapContainerRef.current || !mapInstanceRef.current) return;
        const currentWidth = mapContainerRef.current.clientWidth;
        const currentHeight = mapContainerRef.current.clientHeight;

        // If dimensions haven't changed (e.g. wheel zoom or scroll), DO NOT reset or invalidate
        if (
          Math.abs(currentWidth - lastDimensionsRef.current.width) > 4 ||
          Math.abs(currentHeight - lastDimensionsRef.current.height) > 4
        ) {
          lastDimensionsRef.current = { width: currentWidth, height: currentHeight };
          mapInstanceRef.current.invalidateSize({ pan: false, debounceMoveEvents: true });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleQuickZoom = (wardName) => {
    const w = SAMBHAJI_NAGAR_WARDS.find((x) => x.name.includes(wardName));
    if (w && mapInstanceRef.current) {
      persistentCenter = [w.lat, w.lng];
      persistentZoom = 15;
      mapInstanceRef.current.setView([w.lat, w.lng], 15, { animate: true });
      if (onSelectWardRef.current) {
        onSelectWardRef.current(w.name);
      }
    }
  };

  const handleResetView = () => {
    persistentCenter = [19.8762, 75.3433];
    persistentZoom = 13;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([19.8762, 75.3433], 13, { animate: true });
    }
    if (onSelectWardRef.current) {
      onSelectWardRef.current(null);
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm flex flex-col bg-slate-100"
      style={{ height: '420px', minHeight: '380px' }}
    >
      {/* Top Left Title Overlay (Steady Indicator) */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Chhatrapati Sambhaji Nagar Radar
          </span>
        </div>
        <div className="text-[10.5px] font-mono text-slate-500 mt-0.5">
          19.8762° N · 75.3433° E · Municipal Grid
        </div>
      </div>

      {/* Top Right Ward Quick Selector Chips */}
      <div className="absolute top-3 right-3 z-[400] flex flex-wrap gap-1.5 max-w-xs sm:max-w-md justify-end pointer-events-auto">
        {['Kranti Chowk', 'CIDCO', 'Waluj', 'Garkheda'].map((wName) => (
          <button
            key={wName}
            type="button"
            onClick={() => handleQuickZoom(wName)}
            className="text-[11px] font-semibold bg-white/95 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 px-2.5 py-1 rounded-md shadow-sm transition"
          >
            {wName}
          </button>
        ))}
        <button
          type="button"
          onClick={handleResetView}
          className="text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-2 py-1 rounded-md shadow-sm transition flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Custom Zoom Buttons */}
      <div className="absolute bottom-12 right-3 z-[400] flex flex-col gap-1 pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-7 h-7 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-sm text-slate-700 font-bold flex items-center justify-center transition"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-7 h-7 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-sm text-slate-700 font-bold flex items-center justify-center transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Leaflet Map Target DOM with explicit height */}
      <div
        ref={mapContainerRef}
        className="w-full flex-1 min-h-0"
        style={{ width: '100%', minHeight: '340px' }}
      />

      {/* Bottom Status Legend */}
      <div className="bg-white border-t border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <b className="text-slate-800">Critical Emergency</b>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <b className="text-slate-800">In Progress</b>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <b className="text-slate-800">Solved</b>
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500 hidden sm:block">
          OpenStreetMap · CSNMC Municipal Spatial Server
        </div>
      </div>
    </div>
  );
}

const SambhajiNagarMap = React.memo(SambhajiNagarMapComponent);
export default SambhajiNagarMap;
