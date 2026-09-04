import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function EmergencyMap({ tickets = [] }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up any existing map instance on container
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // Default center: Civic Zone Sector 5
      const map = L.map(mapContainerRef.current, {
        center: [19.8762, 75.3433],
        zoom: 13,
        scrollWheelZoom: true
      });
      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Safe tickets array
      const safeList = Array.isArray(tickets) ? tickets : [];

      safeList.forEach((t) => {
        const lat = parseFloat(t.latitude) || 19.8762;
        const lng = parseFloat(t.longitude) || 75.3433;

        const isCritical = t.urgency === 'CRITICAL' || t.is_emergency;
        const color = isCritical
          ? '#ef4444'
          : t.urgency === 'HIGH'
          ? '#f97316'
          : t.urgency === 'MEDIUM'
          ? '#eab308'
          : '#10b981';

        // Custom HTML Marker Pin
        const markerIcon = L.divIcon({
          className: 'custom-geo-pin',
          html: `
            <div style="
              background: ${color};
              width: ${isCritical ? '18px' : '14px'};
              height: ${isCritical ? '18px' : '14px'};
              border-radius: 50%;
              border: 2px solid #ffffff;
              box-shadow: 0 0 ${isCritical ? '12px #ef4444' : '6px rgba(0,0,0,0.5)'};
              ${isCritical ? 'animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;' : ''}
            "></div>
          `,
          iconSize: isCritical ? [18, 18] : [14, 14],
          iconAnchor: isCritical ? [9, 9] : [7, 7]
        });

        const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);

        // Dark-styled popup
        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; color: #f8fafc; min-width: 180px; padding: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 6px;">
              <span style="font-weight: 800; font-size: 13px; color: #ffffff;">#${t.id}</span>
              <span style="font-size: 10px; font-weight: 700; background: ${color}25; color: ${color}; border: 1px solid ${color}60; padding: 1px 6px; border-radius: 4px;">
                ${t.urgency}
              </span>
            </div>
            <div style="font-size: 12px; font-weight: 500; color: #e2e8f0; margin-bottom: 6px;">
              ${t.description}
            </div>
            <div style="font-size: 11px; color: #94a3b8; display: flex; flex-direction: column; gap: 2px;">
              <div><b>Category:</b> ${t.category}</div>
              <div><b>Dept:</b> ${t.department || 'Municipal Works'}</div>
              <div><b>Location:</b> ${t.location_name || 'Civic Zone'}</div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
      });

      // Force size invalidation when tab becomes active or layout finishes
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      return () => clearTimeout(timer);
    } catch (err) {
      console.error('Failed to initialize Leaflet Map:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tickets]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: '320px', width: '100%', height: '100%' }}
    />
  );
}
