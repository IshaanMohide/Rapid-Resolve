import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function EmergencyMap({ tickets = [] }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Initialize map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [19.8762, 75.3433],
        zoom: 13,
        scrollWheelZoom: true
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      return () => clearTimeout(timer);
    } catch (err) {
      console.error('Failed to initialize EmergencyMap:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers without destroying the map
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

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

      // Steady, non-blinking marker pin
      const markerIcon = L.divIcon({
        className: 'custom-geo-pin',
        html: `
          <div style="
            background: ${color};
            width: ${isCritical ? '16px' : '12px'};
            height: ${isCritical ? '16px' : '12px'};
            border-radius: 50%;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: isCritical ? [16, 16] : [12, 12],
        iconAnchor: isCritical ? [8, 8] : [6, 6]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(markersLayerRef.current);

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; color: #0f172a; min-width: 180px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: #0f172a;">#${t.id}</span>
            <span style="font-size: 10px; font-weight: 700; background: ${color}20; color: ${color}; border: 1px solid ${color}50; padding: 1px 6px; border-radius: 4px;">
              ${t.urgency}
            </span>
          </div>
          <div style="font-size: 12px; font-weight: 500; color: #334155; margin-bottom: 4px;">
            ${t.description}
          </div>
          <div style="font-size: 11px; color: #64748b;">
            <div><b>Dept:</b> ${t.department || 'Municipal Works'}</div>
            <div><b>Location:</b> ${t.location_name || 'Chhatrapati Sambhaji Nagar'}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
    });
  }, [tickets]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: '320px', width: '100%', height: '100%' }}
    />
  );
}
