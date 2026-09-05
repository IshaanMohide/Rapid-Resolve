import React, { useRef, useEffect, useCallback } from 'react';

// Geographic coordinates [longitude, latitude]
export const CITY_COORDS = {
  Shanghai: [121.5, 31.2],
  Shenzhen: [114.1, 22.5],
  Beijing: [116.4, 39.9],
  Guangzhou: [113.3, 23.1],
  Chengdu: [104.1, 30.7],
  "Xi'an": [108.9, 34.3],
  Hangzhou: [120.2, 30.3],
  Wuhan: [114.3, 30.6],
  Shenyang: [123.4, 41.8],
  Harbin: [126.6, 45.8],
  Nanjing: [118.8, 32.1],
  Chongqing: [106.5, 29.6],
  Tianjin: [117.2, 39.1],
  Changsha: [113.0, 28.2],
  Suzhou: [120.6, 31.3],
  Kunming: [102.7, 25.0],
  "Hong Kong": [114.2, 22.3],
  Singapore: [103.8, 1.3],
  Tokyo: [139.7, 35.7],
  Seoul: [127.0, 37.6],
  Bangkok: [100.5, 13.8],
  Mumbai: [72.9, 19.1],
  Dubai: [55.3, 25.3],
  Moscow: [37.6, 55.8],
  Frankfurt: [8.7, 50.1],
  London: [-0.1, 51.5],
  Paris: [2.4, 48.9],
  Amsterdam: [4.9, 52.4],
  "New York": [-74.0, 40.7],
  "Los Angeles": [-118.2, 34.1],
  Chicago: [-87.6, 41.9],
  "São Paulo": [-46.6, -23.6],
  Sydney: [151.2, -33.9],
  Johannesburg: [28.0, -26.2],
  Cairo: [31.2, 30.0],
  "Mexico City": [-99.1, 19.4],
  Rotterdam: [4.5, 51.9]
};

// Simplified continent landmass poly-lines [ [lon, lat], ... ]
const CONTINENTS = [
  // North America
  [[-165, 65], [-140, 70], [-120, 70], [-80, 72], [-60, 50], [-70, 42], [-75, 35], [-80, 25], [-97, 20], [-105, 22], [-117, 32], [-124, 40], [-124, 48], [-135, 55], [-150, 60], [-165, 65]],
  // South America
  [[-75, 10], [-60, 5], [-35, -5], [-38, -13], [-42, -23], [-50, -30], [-65, -42], [-70, -55], [-75, -45], [-72, -30], [-80, -5], [-75, 10]],
  // Eurasia
  [[-10, 36], [0, 43], [10, 45], [30, 40], [35, 32], [55, 25], [60, 22], [70, 20], [80, 10], [90, 22], [105, 10], [110, 20], [120, 24], [122, 32], [130, 42], [140, 50], [170, 65], [180, 70], [140, 75], [100, 75], [60, 70], [40, 65], [25, 71], [15, 60], [5, 50], [-5, 48], [-10, 36]],
  // Africa
  [[-17, 32], [10, 37], [32, 31], [43, 12], [51, 10], [40, -5], [35, -20], [28, -34], [18, -34], [12, -15], [0, 5], [-15, 12], [-17, 32]],
  // Australia
  [[114, -22], [125, -15], [135, -12], [142, -10], [150, -22], [153, -28], [148, -38], [138, -35], [130, -32], [115, -34], [113, -26], [114, -22]],
  // UK
  [[-5, 50], [1, 52], [0, 58], [-4, 58], [-5, 50]],
  // Japan
  [[130, 32], [133, 34], [141, 38], [141, 44], [136, 35], [130, 32]]
];

export default function InteractiveGlobe({
  markers = [],
  routes = [],
  selectedHub = null,
  onSelectHub = () => {},
  isAutoTour = true
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    rotX: 0.35,          // latitude tilt
    rotY: -1.9,          // longitude rotation (starts facing East Asia)
    targetRotX: 0.35,
    targetRotY: -1.9,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    velX: 0,
    velY: 0.0018,        // auto-spin speed
    particles: [],
    radius: 180,
    centerX: 200,
    centerY: 200,
    hoveredMarker: null
  });

  // Focus on selected city
  useEffect(() => {
    if (selectedHub && CITY_COORDS[selectedHub]) {
      const [lon, lat] = CITY_COORDS[selectedHub];
      const targetY = -(lon * Math.PI) / 180 - Math.PI / 2;
      const targetX = (lat * Math.PI) / 180;
      stateRef.current.targetRotY = targetY;
      stateRef.current.targetRotX = Math.max(-0.8, Math.min(0.8, targetX));
    }
  }, [selectedHub]);

  // Spherical projection helper: transforms (lon, lat) to 2D canvas (x, y, visible, z)
  const project = useCallback((lon, lat, rotX, rotY, radius, cx, cy) => {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lon * Math.PI) / 180;

    // 3D coordinates on unit sphere
    let x = Math.cos(phi) * Math.sin(lambda);
    let y = Math.sin(phi);
    let z = Math.cos(phi) * Math.cos(lambda);

    // Rotate around Y axis (longitude)
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Rotate around X axis (latitude tilt)
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const visible = z2 > 0;
    const screenX = cx + x1 * radius;
    const screenY = cy - y2 * radius;

    return { x: screenX, y: screenY, visible, z: z2 };
  }, []);

  // Initialize photon particles along routes
  useEffect(() => {
    const parts = [];
    routes.forEach((r, idx) => {
      const c1 = CITY_COORDS[r.from];
      const c2 = CITY_COORDS[r.to];
      if (c1 && c2) {
        parts.push({
          from: r.from,
          to: r.to,
          c1,
          c2,
          progress: (idx * 0.15) % 1,
          speed: 0.004 + (idx % 3) * 0.002,
          level: r.level || 'normal'
        });
      }
    });
    stateRef.current.particles = parts;
  }, [routes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      stateRef.current.centerX = rect.width / 2;
      stateRef.current.centerY = rect.height / 2;
      stateRef.current.radius = Math.min(rect.width, rect.height) * 0.44;
    };
    resize();
    window.addEventListener('resize', resize);

    // Main render loop
    const render = () => {
      const s = stateRef.current;
      const { centerX: cx, centerY: cy, radius: r } = s;

      // Smooth rotation dampening / auto tour
      if (!s.isDragging) {
        if (selectedHub) {
          // Smoothly interpolate towards selected hub
          s.rotX += (s.targetRotX - s.rotX) * 0.06;
          s.rotY += (s.targetRotY - s.rotY) * 0.06;
        } else if (isAutoTour) {
          s.rotY += s.velY;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Atmosphere Radial Glow Behind Sphere
      const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.35);
      glowGrad.addColorStop(0, 'rgba(73, 179, 255, 0.16)');
      glowGrad.addColorStop(0.6, 'rgba(73, 179, 255, 0.04)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base Sphere Ocean Body
      const oceanGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      oceanGrad.addColorStop(0, 'rgba(18, 49, 79, 0.95)');
      oceanGrad.addColorStop(0.75, 'rgba(11, 23, 40, 0.98)');
      oceanGrad.addColorStop(1, 'rgba(5, 11, 20, 1)');
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = oceanGrad;
      ctx.fill();

      // 3. Graticule Lines (Latitude & Longitude Grid)
      ctx.strokeStyle = 'rgba(73, 179, 255, 0.1)';
      ctx.lineWidth = 0.8;

      // Parallels (Latitudes: -60 to 60 step 30)
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 6) {
          const pt = project(lon, lat, s.rotX, s.rotY, r, cx, cy);
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      }

      // Meridians (Longitudes: -180 to 180 step 30)
      for (let lon = -180; lon <= 180; lon += 30) {
        ctx.beginPath();
        let first = true;
        for (let lat = -85; lat <= 85; lat += 5) {
          const pt = project(lon, lat, s.rotX, s.rotY, r, cx, cy);
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      }

      // 4. Continents & Landmass Contours
      ctx.strokeStyle = 'rgba(76, 154, 218, 0.45)';
      ctx.fillStyle = 'rgba(22, 50, 78, 0.35)';
      ctx.lineWidth = 1.2;

      CONTINENTS.forEach((poly) => {
        ctx.beginPath();
        let hasVisible = false;
        let first = true;

        for (let i = 0; i < poly.length; i++) {
          const [lon, lat] = poly[i];
          const pt = project(lon, lat, s.rotX, s.rotY, r, cx, cy);
          if (pt.visible) {
            hasVisible = true;
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        if (hasVisible) {
          ctx.stroke();
          ctx.fill();
        }
      });

      // 5. Great Circle Flight / Dispatch Arcs
      routes.forEach((route) => {
        const c1 = CITY_COORDS[route.from];
        const c2 = CITY_COORDS[route.to];
        if (!c1 || !c2) return;

        const p1 = project(c1[0], c1[1], s.rotX, s.rotY, r, cx, cy);
        const p2 = project(c2[0], c2[1], s.rotX, s.rotY, r, cx, cy);

        // Draw arc with intermediate curve if at least one end is visible
        if (p1.visible || p2.visible) {
          const midLon = (c1[0] + c2[0]) / 2;
          const midLat = (c1[1] + c2[1]) / 2;
          // Curve elevation above sphere surface
          const pMid = project(midLon, midLat, s.rotX, s.rotY, r * 1.14, cx, cy);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.quadraticCurveTo(pMid.x, pMid.y, p2.x, p2.y);
          ctx.strokeStyle = route.level === 'warn' ? 'rgba(255, 181, 71, 0.65)' : 'rgba(73, 179, 255, 0.55)';
          ctx.lineWidth = route.from === selectedHub || route.to === selectedHub ? 2.2 : 1.2;
          ctx.stroke();
        }
      });

      // 6. Photon Light Pulses along Routes
      s.particles.forEach((part) => {
        part.progress = (part.progress + part.speed) % 1;
        const curLon = part.c1[0] + (part.c2[0] - part.c1[0]) * part.progress;
        const curLat = part.c1[1] + (part.c2[1] - part.c1[1]) * part.progress;
        const elevation = 1 + Math.sin(part.progress * Math.PI) * 0.12;

        const pt = project(curLon, curLat, s.rotX, s.rotY, r * elevation, cx, cy);
        if (pt.visible) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, part.level === 'warn' ? 3.5 : 2.8, 0, Math.PI * 2);
          ctx.fillStyle = part.level === 'warn' ? '#ffb547' : '#ffffff';
          ctx.shadowColor = part.level === 'warn' ? '#ffb547' : '#49b3ff';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // End sphere clipping
      ctx.restore();

      // 7. Outer Sphere Limb Glow & Specular Accent
      const rimGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      rimGrad.addColorStop(0, 'rgba(143, 208, 255, 0.85)');
      rimGrad.addColorStop(0.5, 'rgba(73, 179, 255, 0.2)');
      rimGrad.addColorStop(1, 'rgba(18, 49, 79, 0.5)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // 8. City Hub Markers & Beacons
      markers.forEach((m) => {
        const coords = CITY_COORDS[m.city];
        if (!coords) return;
        const pt = project(coords[0], coords[1], s.rotX, s.rotY, r, cx, cy);
        if (!pt.visible) return;

        const isSel = m.city === selectedHub;
        const isHover = m.city === s.hoveredMarker;
        const isWarn = m.level === 'warn';

        // Outer pulsing ring
        const ringColor = isWarn ? 'rgba(255, 181, 71, 0.4)' : isSel ? 'rgba(63, 208, 164, 0.5)' : 'rgba(73, 179, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isSel ? 9 : 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner solid core
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isSel ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isWarn ? '#ffb547' : isSel ? '#3fd0a4' : '#49b3ff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = isSel || isHover ? 12 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label on selected or hovered or key hubs
        if (isSel || isHover || pt.z > 0.55) {
          ctx.font = isSel ? 'bold 12px "JetBrains Mono", monospace' : '10px "Inter", sans-serif';
          ctx.fillStyle = isSel ? '#ffffff' : 'rgba(232, 238, 247, 0.85)';
          ctx.fillText(m.city, pt.x + 8, pt.y + 3);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [project, markers, routes, selectedHub, isAutoTour]);

  // Mouse interaction handlers (drag to rotate & click to select)
  const handleMouseDown = (e) => {
    stateRef.current.isDragging = true;
    stateRef.current.lastMouseX = e.clientX;
    stateRef.current.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e) => {
    const s = stateRef.current;
    if (s.isDragging) {
      const dx = e.clientX - s.lastMouseX;
      const dy = e.clientY - s.lastMouseY;
      s.rotY += dx * 0.007;
      s.rotX = Math.max(-0.85, Math.min(0.85, s.rotX + dy * 0.007));
      s.lastMouseX = e.clientX;
      s.lastMouseY = e.clientY;
    } else {
      // Check hover on markers
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      let found = null;

      for (let m of markers) {
        const coords = CITY_COORDS[m.city];
        if (coords) {
          const pt = project(coords[0], coords[1], s.rotX, s.rotY, s.radius, s.centerX, s.centerY);
          if (pt.visible) {
            const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
            if (dist < 12) {
              found = m.city;
              break;
            }
          }
        }
      }
      s.hoveredMarker = found;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = found ? 'pointer' : s.isDragging ? 'grabbing' : 'grab';
      }
    }
  };

  const handleMouseUp = (e) => {
    const s = stateRef.current;
    if (s.isDragging) {
      const moved = Math.hypot(e.clientX - s.lastMouseX, e.clientY - s.lastMouseY);
      s.isDragging = false;

      // If barely moved, treat as click
      if (moved < 5) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        for (let m of markers) {
          const coords = CITY_COORDS[m.city];
          if (coords) {
            const pt = project(coords[0], coords[1], s.rotX, s.rotY, s.radius, s.centerX, s.centerY);
            if (pt.visible) {
              const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
              if (dist < 14) {
                onSelectHub(m.city, m.v);
                return;
              }
            }
          }
        }
      }
    }
  };

  return (
    <canvas
      id="earth"
      ref={canvasRef}
      style={{ cursor: 'grab', width: '100%', height: '100%', display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { stateRef.current.isDragging = false; }}
    />
  );
}
