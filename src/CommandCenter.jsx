import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import {
  ShieldAlert,
  Radio,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Zap,
  TrendingUp,
  RefreshCw,
  Search,
  Truck,
  Users
} from 'lucide-react';
import SambhajiNagarMap from './SambhajiNagarMap';

// Sambhaji Nagar Ward Performance Data
const WARDS_PERFORMANCE = [
  { name: "CIDCO Wards (N-1 to N-12)", total: 342, resolved: 318, target: 320, leader: "Ward Officer Patil", hub: "CIDCO Wards (N-1 to N-12)" },
  { name: "Kranti Chowk Central", total: 286, resolved: 274, target: 270, leader: "Ward Officer Shinde", hub: "Kranti Chowk Central" },
  { name: "Waluj Industrial Zone", total: 231, resolved: 218, target: 210, leader: "MIDC Liaison More", hub: "Waluj MIDC Industrial Sector" },
  { name: "Garkheda & Sutgirni", total: 174, resolved: 165, target: 160, leader: "Ward Officer Kulkarni", hub: "Garkheda & Sutgirni" },
  { name: "Chikalthana / Airport Road", total: 152, resolved: 144, target: 140, leader: "Ward Officer Deshmukh", hub: "Chikalthana / Airport Road" },
  { name: "HUDCO & TV Centre", total: 96, resolved: 88, target: 90, leader: "Water Dept Incharge", hub: "TV Centre / HUDCO" },
  { name: "Begumpura / University", total: 78, resolved: 74, target: 75, leader: "Civic Health Officer", hub: "Begumpura / University Zone" }
];

// Municipal Category Mix in Chhatrapati Sambhaji Nagar
const CIVIC_CATEGORIES = [
  { name: "Water Supply & Drainage", value: 384 },
  { name: "Roads & Pothole Repair", value: 292 },
  { name: "Electrical & Streetlights", value: 210 },
  { name: "Solid Waste & Sanitation", value: 168 },
  { name: "Public Health & Safety", value: 94 }
];

// Active Patrol and Field Units in Chhatrapati Sambhaji Nagar
const FIELD_UNITS = [
  { id: "QRT-01", unit: "Rapid Response Unit 01", location: "Kranti Chowk Flyover", task: "Water Pipeline Breach Isolation", status: "ON SITE", type: "urgent" },
  { id: "TNK-04", unit: "Municipal Water Tanker 04", location: "CIDCO N-4 Sector", task: "Emergency Supply Deployment", status: "EN ROUTE", type: "active" },
  { id: "PWD-02", unit: "PWD Asphalt Crew 02", location: "Jalna Road / Prozone", task: "Pothole Deep Patchwork", status: "IN PROGRESS", type: "active" },
  { id: "MSD-07", unit: "MSEDCL Electrical Squad", location: "Waluj MIDC Phase 2", task: "Substation Transformer Overhaul", status: "ON SITE", type: "active" },
  { id: "SAN-11", unit: "Sanitation Rapid Sweeper", location: "Garkheda Stadium Area", task: "Commercial Debris Clearance", status: "COMPLETED", type: "solved" },
  { id: "FIR-03", unit: "Padampura Fire Tender 03", location: "Railway Station Road", task: "Hazardous Tree Fall Clearance", status: "STANDBY", type: "standby" }
];

// Real-Time Municipal Alerts in Chhatrapati Sambhaji Nagar
const SAMBHAJI_NAGAR_ALERTS = [
  { time: "11:52 AM", desc: "CIDCO N-7: 300mm distribution pipe leak contained by Ward Emergency Squad", level: "MED", dept: "Water Works" },
  { time: "11:40 AM", desc: "Kranti Chowk: Traffic signal grid restored following brief voltage surge", level: "LOW", dept: "Electrical" },
  { time: "11:28 AM", desc: "Waluj MIDC Sector B: High tension line insulator inspection underway", level: "HIGH", dept: "MSEDCL" },
  { time: "11:15 AM", desc: "Jalna Road Flyover: Asphalt repair machinery deployed; single lane regulated", level: "MED", dept: "PWD Infrastructure" },
  { time: "10:55 AM", desc: "Begumpura: Drainage desilting completed near University junction", level: "LOW", dept: "Sanitation" },
  { time: "10:30 AM", desc: "TV Centre Reservoir: Inflow telemetry calibrated to 100% capacity", level: "LOW", dept: "Water Supply" },
  { time: "10:12 AM", desc: "Garkheda Sutgirni Chowk: Solid waste collection cycle 2 concluded", level: "LOW", dept: "Health Dept" },
  { time: "09:45 AM", desc: "Padampura Station Road: Emergency clearance protocol executed in 18 mins", level: "HIGH", dept: "Fire & Rescue" }
];

export default function CommandCenter({
  activeTab = 'command',
  onTabChange = () => {}
}) {
  const categoryChartRef = useRef(null);
  const velocityChartRef = useRef(null);
  const turnaroundChartRef = useRef(null);
  const resourceChartRef = useRef(null);
  const chartInstances = useRef({});

  // Clock state
  const [clockTime, setClockTime] = useState({ t: '', d: '' });
  const [selectedWard, setSelectedWard] = useState(null);

  // Digital Clock updates
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime({
        t: now.toLocaleTimeString('en-US', { hour12: true }),
        d: now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        })
      });
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // ECharts Initializations
  useEffect(() => {
    // 1. Civic Category Donut Chart
    if (categoryChartRef.current) {
      if (!chartInstances.current.category) {
        chartInstances.current.category = echarts.init(categoryChartRef.current);
      }
      chartInstances.current.category.setOption({
        animation: true,
        tooltip: {
          trigger: 'item',
          backgroundColor: '#ffffff',
          borderColor: '#e2e8f0',
          textStyle: { color: '#0f172a', fontSize: 12 }
        },
        series: [{
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: '#ffffff', borderWidth: 2.5, borderRadius: 4 },
          color: ['#0284c7', '#059669', '#6366f1', '#d97706', '#0d9488'],
          label: {
            color: '#334155',
            fontSize: 11,
            formatter: '{b}\n{d}%',
            lineHeight: 14
          },
          data: CIVIC_CATEGORIES
        }]
      }, true);
    }

    // 2. Weekly Resolution Velocity Line/Bar Chart
    if (velocityChartRef.current) {
      if (!chartInstances.current.velocity) {
        chartInstances.current.velocity = echarts.init(velocityChartRef.current);
      }
      chartInstances.current.velocity.setOption({
        animation: true,
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#ffffff',
          borderColor: '#e2e8f0',
          textStyle: { color: '#0f172a', fontSize: 12 }
        },
        legend: {
          top: 0,
          right: 0,
          itemWidth: 12,
          itemHeight: 4,
          textStyle: { color: '#64748b', fontSize: 11 }
        },
        grid: { left: 32, right: 12, top: 28, bottom: 20 },
        xAxis: {
          type: 'category',
          data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#64748b', fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
          axisLabel: { color: '#64748b', fontSize: 11 }
        },
        series: [
          {
            name: 'Reported',
            type: 'bar',
            barWidth: 8,
            itemStyle: { borderRadius: [3, 3, 0, 0], color: '#93c5fd' },
            data: [42, 58, 46, 62, 54, 38, 29]
          },
          {
            name: 'Resolved',
            type: 'bar',
            barWidth: 8,
            itemStyle: { borderRadius: [3, 3, 0, 0], color: '#059669' },
            data: [40, 56, 45, 60, 53, 37, 28]
          }
        ]
      }, true);
    }

    // 3. Department Turnaround Velocity (Bar Chart)
    if (turnaroundChartRef.current) {
      if (!chartInstances.current.turnaround) {
        chartInstances.current.turnaround = echarts.init(turnaroundChartRef.current);
      }
      chartInstances.current.turnaround.setOption({
        animation: true,
        grid: { left: 8, right: 36, top: 6, bottom: 6, containLabel: true },
        xAxis: { type: 'value', axisLine: { show: false }, splitLine: { show: false }, axisLabel: { show: false } },
        yAxis: {
          type: 'category',
          data: ['Public Health', 'Sanitation', 'Streetlights', 'Roads/PWD', 'Water Supply'].reverse(),
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#334155', fontSize: 11 }
        },
        series: [{
          type: 'bar',
          barWidth: 10,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#0284c7' },
              { offset: 1, color: '#38bdf8' }
            ])
          },
          label: { show: true, position: 'right', color: '#64748b', fontSize: 11, formatter: '{c} hrs' },
          data: [1.8, 2.2, 2.5, 3.4, 4.1].reverse()
        }]
      }, true);
    }

    // 4. Resource Allocation Gauge/Bar
    if (resourceChartRef.current) {
      if (!chartInstances.current.resource) {
        chartInstances.current.resource = echarts.init(resourceChartRef.current);
      }
      chartInstances.current.resource.setOption({
        animation: true,
        grid: { left: 34, right: 12, top: 22, bottom: 20 },
        xAxis: {
          type: 'category',
          data: ['Water Tanks', 'Ambulance', 'PWD Trucks', 'Disaster Van', 'Sweepers'],
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#64748b', fontSize: 10.5 }
        },
        yAxis: {
          type: 'value',
          max: 100,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
          axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' }
        },
        series: [{
          name: 'Fleet Deployed',
          type: 'bar',
          barWidth: 14,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (params) => {
              const colors = ['#0284c7', '#e11d48', '#d97706', '#059669', '#6366f1'];
              return colors[params.dataIndex % colors.length];
            }
          },
          data: [88, 95, 76, 92, 84]
        }]
      }, true);
    }

    const handleResize = () => {
      Object.values(chartInstances.current).forEach(c => c && c.resize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="csn-command-container">
      {/* Top Municipal Navigation Header */}
      <header className="csn-top-header px-4 lg:px-8 py-3.5">
        <div className="max-w-[1780px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & City Seal */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-md shadow-sky-500/20 text-white">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg lg:text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Chhatrapati Sambhaji Nagar
                </h1>
                <span className="bg-sky-100 border border-sky-300 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Smart City Command
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Municipal Corporation (CSNMC) · Real-Time Emergency Dispatch & Civic Operations
              </p>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => onTabChange('command')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'command'
                  ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-sky-600" />
              <span>Smart City Deck</span>
            </button>
            <button
              onClick={() => onTabChange('citizen')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'citizen'
                  ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-sky-600" />
              <span>Citizen AI Desk</span>
            </button>
            <button
              onClick={() => onTabChange('track')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'track'
                  ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-sky-600" />
              <span>Track Complaint</span>
            </button>
          </div>

          {/* Live Beacon & Clock */}
          <div className="flex items-center gap-4">
            <div className="live-beacon">
              <span className="live-beacon-dot" />
              <span>TELEMETRY LIVE</span>
            </div>
            <div className="text-right font-mono hidden sm:block">
              <div className="text-sm font-bold text-slate-800 tracking-tight">
                {clockTime.t || '12:00:00 PM'}
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                {clockTime.d || 'Chhatrapati Sambhaji Nagar'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Top 5-Card Municipal KPI Bar */}
      <section className="px-4 lg:px-8 py-4 max-w-[1780px] w-full mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="csn-kpi">
            <div className="label">Active Grievances</div>
            <div className="val">48<u>cases</u></div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> 8.4% faster resolution
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">Critical Emergency Triage</div>
            <div className="val text-rose-600">3<u>urgent</u></div>
            <div className="text-xs font-semibold text-rose-600 flex items-center gap-1 mt-1">
              <Flame className="w-3 h-3" /> Average SLA: 24 mins
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">SLA Compliance Rate</div>
            <div className="val text-sky-700">98.6%</div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Above Target 95.0%
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">Verified Solved Today</div>
            <div className="val text-emerald-700">142<u>solved</u></div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-1">
              <span>All 9 municipal divisions</span>
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">Active Field Patrols</div>
            <div className="val text-indigo-700">18<u>teams</u></div>
            <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1 mt-1">
              <Truck className="w-3 h-3" /> 94% on-site readiness
            </div>
          </div>
        </div>
      </section>

      {/* Main 3-Column Municipal Command Deck */}
      <main className="px-4 lg:px-8 pb-8 max-w-[1780px] w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Ward Performance & Category Breakdown (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Ward-wise Resolution Performance */}
          <div className="csn-card flex-1">
            <div className="csn-card-head">
              <h2>Ward Resolution Attainment</h2>
              <span className="badge-info">CSNMC Zones</span>
            </div>
            <div className="p-3.5 space-y-3">
              {WARDS_PERFORMANCE.map((ward, idx) => {
                const pct = Math.round((ward.resolved / ward.total) * 100);
                const isSelected = selectedWard === ward.name;
                return (
                  <div
                    key={ward.name}
                    onClick={() => setSelectedWard(ward.name)}
                    className={`p-2 rounded-lg cursor-pointer transition ${
                      isSelected ? 'bg-sky-50 border border-sky-300' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 font-mono text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {ward.name}
                      </span>
                      <span className="font-mono font-bold text-sky-700">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-600 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                      <span>{ward.leader}</span>
                      <span>{ward.resolved}/{ward.total} solved</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Civic Issue Category Mix */}
          <div className="csn-card h-64">
            <div className="csn-card-head">
              <h2>Civic Grievance Distribution</h2>
            </div>
            <div className="flex-1 w-full p-2" ref={categoryChartRef} />
          </div>

          {/* Department Turnaround Velocity */}
          <div className="csn-card h-56">
            <div className="csn-card-head">
              <h2>SLA Turnaround Speed</h2>
              <span className="badge-info">Hours Avg</span>
            </div>
            <div className="flex-1 w-full p-2" ref={turnaroundChartRef} />
          </div>
        </div>

        {/* Center Column: Chhatrapati Sambhaji Nagar Map & Velocity Graph (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Main Geo-Intelligence Radar Map */}
          <div className="csn-card flex-1 min-h-[440px] flex flex-col">
            <div className="csn-card-head justify-between">
              <h2>
                Chhatrapati Sambhaji Nagar Incident Radar
                {selectedWard && (
                  <span className="ml-2 text-xs text-sky-700 font-semibold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    Focused: {selectedWard}
                  </span>
                )}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Live Geolocation Telemetry
              </span>
            </div>
            <div className="flex-1 p-2">
              <SambhajiNagarMap
                selectedWard={selectedWard}
                onSelectWard={(name) => setSelectedWard(name)}
              />
            </div>
          </div>

          {/* Weekly Intake vs Resolution Velocity */}
          <div className="csn-card h-64">
            <div className="csn-card-head">
              <h2>Weekly Intake vs Resolution Velocity</h2>
              <span className="badge-info">Past 7 Days</span>
            </div>
            <div className="flex-1 w-full p-2" ref={velocityChartRef} />
          </div>
        </div>

        {/* Right Column: Active Field Units & Live Ticker (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Active Field Response Units */}
          <div className="csn-card flex-1">
            <div className="csn-card-head">
              <h2>Active Response Units</h2>
              <span className="badge-info">{FIELD_UNITS.length} active</span>
            </div>
            <div className="p-3 divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
              {FIELD_UNITS.map((unit) => (
                <div key={unit.id} className="py-2.5 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <b className="text-slate-800">{unit.unit}</b>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        unit.status === 'ON SITE'
                          ? 'bg-rose-100 text-rose-700'
                          : unit.status === 'EN ROUTE'
                          ? 'bg-amber-100 text-amber-700'
                          : unit.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {unit.status}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-slate-600 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {unit.location}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {unit.task}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Ward Emergency Alerts Marquee */}
          <div className="csn-card h-64">
            <div className="csn-card-head">
              <h2>Live Municipal Dispatch Stream</h2>
              <span className="badge-info">Realtime</span>
            </div>
            <div className="p-3 flex-1 overflow-hidden relative">
              <div className="csn-alert-lane">
                {SAMBHAJI_NAGAR_ALERTS.concat(SAMBHAJI_NAGAR_ALERTS).map((alert, idx) => (
                  <div
                    key={idx}
                    className={`csn-alert-item ${alert.level === 'HIGH' ? 'critical' : ''}`}
                  >
                    <span className="font-mono text-[11px] text-slate-500">{alert.time}</span>
                    <span className="flex-1 text-[11.5px] font-medium text-slate-800 truncate">
                      {alert.desc}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        alert.level === 'HIGH'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {alert.dept}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Municipal Resource Allocation */}
          <div className="csn-card h-56">
            <div className="csn-card-head">
              <h2>Fleet Readiness Deployment</h2>
              <span className="badge-info">Active Assets</span>
            </div>
            <div className="flex-1 w-full p-2" ref={resourceChartRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
