import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

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

export default function SambhajiNagarMap({
  tickets = [],
  selectedWard = null,
  onSelectWard = () => {}
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const [activeIncidentCount, setActiveIncidentCount] = useState(0);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // Initialize map centered at Chhatrapati Sambhaji Nagar
      const map = L.map(mapContainerRef.current, {
        center: [19.8762, 75.3433],
        zoom: 13,
        scrollWheelZoom: true,
        zoomControl: true
      });
      mapInstanceRef.current = map;

      // Clean Light Tile Layer (CartoDB Positron / OSM Light)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      // 1. Render Municipal Ward Markers
      SAMBHAJI_NAGAR_WARDS.forEach((w) => {
        const isCritical = w.status === 'Critical';
        const color = isCritical ? '#e11d48' : '#0284c7';

        const wardIcon = L.divIcon({
          className: 'csn-ward-pin',
          html: `
            <div style="
              position: relative;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                position: absolute;
                inset: 0;
                background: ${color};
                opacity: 0.25;
                border-radius: 50%;
                animation: ${isCritical ? 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' : 'none'};
              "></div>
              <div style="
                width: 14px;
                height: 14px;
                background: ${color};
                border: 2.5px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
              "></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const m = L.marker([w.lat, w.lng], { icon: wardIcon }).addTo(markersGroup);

        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 190px;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
              ${w.name}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">
              ${w.type}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <span style="color: #475569;">Active Reports:</span>
              <span style="font-weight: 700; color: ${isCritical ? '#e11d48' : '#0284c7'};">
                ${w.alerts} incidents
              </span>
            </div>
          </div>
        `;
        m.bindPopup(popupContent);

        m.on('click', () => {
          onSelectWard(w.name);
        });
      });

      // 2. Render Incident Grievances from Tickets
      const safeTickets = Array.isArray(tickets) && tickets.length > 0 ? tickets : [
        { id: 4821, description: "Main 400mm water pipe rupture near TV Centre road", urgency: "CRITICAL", category: "Water Supply", latitude: 19.9042, longitude: 75.3491, department: "Water Supply & Drainage" },
        { id: 4822, description: "Deep pothole cluster and asphalt cave-in near flyover", urgency: "HIGH", category: "Roads & Bridges", latitude: 19.8789, longitude: 75.3654, department: "Roads & Infrastructure" },
        { id: 4823, description: "High-voltage transformer tripping in MIDC Phase 2", urgency: "HIGH", category: "Electrical & Grid", latitude: 19.8324, longitude: 75.2285, department: "Electrical & Streetlights" },
        { id: 4824, description: "Overflowing garbage dump yard creating road block", urgency: "MEDIUM", category: "Sanitation", latitude: 19.8621, longitude: 75.3412, department: "Solid Waste Management" },
        { id: 4820, description: "Major drainage unclogging completed and verified", urgency: "LOW", status: "RESOLVED", category: "Public Health", latitude: 19.8735, longitude: 75.3283, department: "Public Health" }
      ];

      setActiveIncidentCount(safeTickets.length);

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
              width: ${isCritical ? '22px' : '18px'};
              height: ${isCritical ? '22px' : '18px'};
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid #ffffff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="transform: rotate(45deg); font-size: 9px; font-weight: 900; color: #ffffff;">!</span>
            </div>
          `,
          iconSize: isCritical ? [22, 22] : [18, 18],
          iconAnchor: isCritical ? [11, 22] : [9, 18]
        });

        const marker = L.marker([lat, lng], { icon: incidentIcon }).addTo(markersGroup);

        const popupHtml = `
          <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <b style="font-size: 13px; color: #0f172a;">Incident #${t.id}</b>
              <span style="font-size: 10px; font-weight: 800; background: ${pinColor}15; color: ${pinColor}; border: 1px solid ${pinColor}40; padding: 1px 6px; border-radius: 4px;">
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

      // Invalidate size on mount to prevent partial render
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

    } catch (err) {
      console.error('Error rendering Sambhaji Nagar map:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tickets, onSelectWard]);

  // Pan to selected ward if chosen
  useEffect(() => {
    if (selectedWard && mapInstanceRef.current) {
      const w = SAMBHAJI_NAGAR_WARDS.find(x => x.name === selectedWard);
      if (w) {
        mapInstanceRef.current.flyTo([w.lat, w.lng], 14.5, { duration: 1.2 });
      }
    }
  }, [selectedWard]);

  const handleQuickZoom = (wardName) => {
    const w = SAMBHAJI_NAGAR_WARDS.find(x => x.name.includes(wardName));
    if (w && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([w.lat, w.lng], 15, { duration: 1.2 });
      onSelectWard(w.name);
    }
  };

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([19.8762, 75.3433], 13, { duration: 1 });
      onSelectWard(null);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm flex flex-col">
      {/* Top HUD Overlay Banner */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg px-3.5 py-2 shadow-sm pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-ping" />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-800">
            Chhatrapati Sambhaji Nagar Radar
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
          19.8762° N · 75.3433° E · Central Grid
        </div>
      </div>

      {/* Ward Quick Selector Chips */}
      <div className="absolute top-3 right-3 z-[400] flex flex-wrap gap-1.5 max-w-sm justify-end pointer-events-auto">
        {['Kranti Chowk', 'CIDCO', 'Waluj', 'Garkheda'].map((wName) => (
          <button
            key={wName}
            onClick={() => handleQuickZoom(wName)}
            className="text-[11px] font-semibold bg-white/95 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 px-2.5 py-1 rounded shadow-sm transition"
          >
            {wName}
          </button>
        ))}
        <button
          onClick={handleResetView}
          className="text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-2 py-1 rounded shadow-sm transition flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Leaflet Map Target */}
      <div
        ref={mapContainerRef}
        className="w-full flex-1"
        style={{ minHeight: '340px' }}
      />

      {/* Bottom Status Bar */}
      <div className="bg-white border-t border-slate-200 px-3.5 py-2 flex items-center justify-between text-xs text-slate-600 z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <b className="text-slate-800">Critical:</b> 4
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <b className="text-slate-800">In Progress:</b> 6
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <b className="text-slate-800">Solved:</b> 28
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Updated Live via CSNMC Telemetry
        </div>
      </div>
    </div>
  );
}
