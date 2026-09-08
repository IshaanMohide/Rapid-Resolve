import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  Users,
  Lock,
  Unlock,
  LogOut,
  Sliders,
  SlidersHorizontal,
  X,
  Check,
  Trash2,
  FileText,
  Star,
  MessageSquare,
  ThumbsUp,
  User
} from 'lucide-react';
import SambhajiNagarMap from './SambhajiNagarMap';

// Sambhaji Nagar Ward Performance Data
const WARDS_PERFORMANCE = [
  { name: "CIDCO Wards (N-1 to N-12)", total: 342, resolved: 318, target: 320, leader: "Ward Officer Patil" },
  { name: "Kranti Chowk Central", total: 286, resolved: 274, target: 270, leader: "Ward Officer Shinde" },
  { name: "Waluj Industrial Zone", total: 231, resolved: 218, target: 210, leader: "MIDC Liaison More" },
  { name: "Garkheda & Sutgirni", total: 174, resolved: 165, target: 160, leader: "Ward Officer Kulkarni" },
  { name: "Chikalthana / Airport Road", total: 152, resolved: 144, target: 140, leader: "Ward Officer Deshmukh" },
  { name: "HUDCO & TV Centre", total: 96, resolved: 88, target: 90, leader: "Water Dept Incharge" },
  { name: "Begumpura / University", total: 78, resolved: 74, target: 75, leader: "Civic Health Officer" }
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
  { id: "QRT-01", unit: "Rapid Response Unit 01", location: "Kranti Chowk Flyover", task: "Water Pipeline Breach Isolation", status: "ON SITE" },
  { id: "TNK-04", unit: "Municipal Water Tanker 04", location: "CIDCO N-4 Sector", task: "Emergency Supply Deployment", status: "EN ROUTE" },
  { id: "PWD-02", unit: "PWD Asphalt Crew 02", location: "Jalna Road / Prozone", task: "Pothole Deep Patchwork", status: "IN PROGRESS" },
  { id: "MSD-07", unit: "MSEDCL Electrical Squad", location: "Waluj MIDC Phase 2", task: "Substation Transformer Overhaul", status: "ON SITE" },
  { id: "SAN-11", unit: "Sanitation Rapid Sweeper", location: "Garkheda Stadium Area", task: "Commercial Debris Clearance", status: "COMPLETED" },
  { id: "FIR-03", unit: "Padampura Fire Tender 03", location: "Railway Station Road", task: "Hazardous Tree Fall Clearance", status: "STANDBY" }
];

// Real-Time Municipal Alerts in Chhatrapati Sambhaji Nagar
const SAMBHAJI_NAGAR_ALERTS = [
  { time: "12:14 PM", desc: "CIDCO N-7: 300mm distribution pipe leak contained by Ward Emergency Squad", level: "MED", dept: "Water Works" },
  { time: "12:02 PM", desc: "Kranti Chowk: Traffic signal grid restored following brief voltage surge", level: "LOW", dept: "Electrical" },
  { time: "11:48 AM", desc: "Waluj MIDC Sector B: High tension line insulator inspection underway", level: "HIGH", dept: "MSEDCL" },
  { time: "11:35 AM", desc: "Jalna Road Flyover: Asphalt repair machinery deployed; single lane regulated", level: "MED", dept: "PWD Infrastructure" },
  { time: "11:10 AM", desc: "Begumpura: Drainage desilting completed near University junction", level: "LOW", dept: "Sanitation" },
  { time: "10:45 AM", desc: "TV Centre Reservoir: Inflow telemetry calibrated to 100% capacity", level: "LOW", dept: "Water Supply" },
  { time: "10:20 AM", desc: "Garkheda Sutgirni Chowk: Solid waste collection cycle 2 concluded", level: "LOW", dept: "Health Dept" },
  { time: "09:55 AM", desc: "Padampura Station Road: Emergency clearance protocol executed in 18 mins", level: "HIGH", dept: "Fire & Rescue" }
];

export default function CommandCenter({
  activeTab = 'admin',
  onTabChange = () => {},
  tickets = [],
  onResolveTicket = () => {},
  onOverrideTicket = () => {},
  onDeleteTicket = () => {},
  isAdminAuthenticated = false,
  onAdminLogin = () => {},
  onAdminLogout = () => {}
}) {
  const categoryChartRef = useRef(null);
  const velocityChartRef = useRef(null);
  const turnaroundChartRef = useRef(null);
  const chartInstances = useRef({});
  const navigate = useNavigate();

  const [selectedWard, setSelectedWard] = useState(null);

  // Login Form States (if not authenticated)
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Filter and Search for Admin Ticket Queue
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Override Modal state
  const [editingTicket, setEditingTicket] = useState(null);
  const [overrideUrgency, setOverrideUrgency] = useState('MEDIUM');
  const [overrideDepartment, setOverrideDepartment] = useState('Roads & Infrastructure');
  const [overrideStatus, setOverrideStatus] = useState('OPEN');

  // Citizen Feedback Inspection Modal State
  const [feedbackModalTicket, setFeedbackModalTicket] = useState(null);
  const [ticketFeedbackList, setTicketFeedbackList] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const openFeedbackModal = async (ticket) => {
    setFeedbackModalTicket(ticket);
    setLoadingFeedback(true);
    try {
      const res = await axios.get(`/api/tickets/${ticket.id}/feedback`);
      if (res.data?.success) {
        setTicketFeedbackList(res.data.feedback || []);
      }
    } catch (err) {
      console.error('Failed to load feedback for ticket:', err);
      setTicketFeedbackList([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleSelectWard = useCallback((name) => {
    setSelectedWard(name);
  }, []);

  // Handle Login submission
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!adminIdInput.trim() || !adminPasswordInput.trim()) {
      setLoginError('Please enter both Admin ID and Password');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const success = await onAdminLogin(adminIdInput.trim(), adminPasswordInput.trim());
      if (!success) {
        setLoginError('Invalid credentials. Use ID: admin and PW: rapidresolve2026');
      }
    } catch (err) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // ECharts Initializations
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    // 1. Civic Category Donut Chart
    if (categoryChartRef.current) {
      let chart = echarts.getInstanceByDom(categoryChartRef.current);
      if (!chart) {
        chart = echarts.init(categoryChartRef.current);
      }
      chartInstances.current.category = chart;
      chart.setOption({
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
      let chart = echarts.getInstanceByDom(velocityChartRef.current);
      if (!chart) {
        chart = echarts.init(velocityChartRef.current);
      }
      chartInstances.current.velocity = chart;
      chart.setOption({
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
      let chart = echarts.getInstanceByDom(turnaroundChartRef.current);
      if (!chart) {
        chart = echarts.init(turnaroundChartRef.current);
      }
      chartInstances.current.turnaround = chart;
      chart.setOption({
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

    const handleResize = () => {
      Object.values(chartInstances.current).forEach(c => c && c.resize());
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      Object.values(chartInstances.current).forEach(c => {
        try {
          if (c && !c.isDisposed()) c.dispose();
        } catch {
          // ignore
        }
      });
      chartInstances.current = {};
    };
  }, [isAdminAuthenticated]);

  // Filtered tickets in Admin Queue
  const filteredTickets = useMemo(() => {
    const list = Array.isArray(tickets) ? tickets : [];
    return list.filter((t) => {
      const matchUrgency = urgencyFilter === 'ALL' || t.urgency === urgencyFilter;
      const matchSearch =
        !searchFilter.trim() ||
        String(t.id).includes(searchFilter.trim()) ||
        (t.description || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
        (t.department || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
        (t.location_name || '').toLowerCase().includes(searchFilter.toLowerCase());
      return matchUrgency && matchSearch;
    });
  }, [tickets, urgencyFilter, searchFilter]);

  const openOverride = (ticket) => {
    setEditingTicket(ticket);
    setOverrideUrgency(ticket.urgency || 'MEDIUM');
    setOverrideDepartment(ticket.department || 'Roads, Bridges & Infrastructure');
    setOverrideStatus(ticket.status || 'OPEN');
  };

  const saveOverride = () => {
    if (!editingTicket) return;
    onOverrideTicket({
      ...editingTicket,
      urgency: overrideUrgency,
      department: overrideDepartment,
      status: overrideStatus
    });
    setEditingTicket(null);
  };

  // IF NOT AUTHENTICATED: Show clean light login card
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 anim-fade-in">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 anim-scale-in">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
              <Lock className="w-7 h-7" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-center text-slate-900 mb-1">
            Admin Command Center Access
          </h2>
          <p className="text-xs text-center text-slate-500 mb-6">
            Chhatrapati Sambhaji Nagar Municipal Corporation (CSNMC)
          </p>

          {loginError && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-none" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Commander ID
              </label>
              <input
                type="text"
                value={adminIdInput}
                onChange={(e) => setAdminIdInput(e.target.value)}
                placeholder="Enter admin ID (e.g. admin)"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Passcode
              </label>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              <span>Unlock Command Center</span>
            </button>
          </form>

          {/* Demo Credentials Helper Chip */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Default Municipal Credentials:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAdminIdInput('admin'); setAdminPasswordInput('rapidresolve2026'); }}
                className="text-[11px] font-mono bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-3 py-1 rounded-lg transition font-semibold"
              >
                Auto-fill: admin / rapidresolve2026
              </button>
            </div>
            <button
              type="button"
              onClick={() => onTabChange('citizen')}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium mt-2 transition"
            >
              ← Return to Citizen Desk
            </button>
            <a
              href="/"
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition block mt-1"
            >
              ← Go to Public Citizen Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // IF AUTHENTICATED: Show Unified Admin Command Center
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
                  Admin Command Center
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Unified Municipal Deck & Incident Override Console (CSNMC)
              </p>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => { onTabChange('citizen'); navigate('/'); }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-slate-500" />
              <span>Citizen AI Desk</span>
            </button>
            <button
              onClick={() => { onTabChange('track'); navigate('/'); }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Track Complaint</span>
            </button>
            <button
              onClick={() => onTabChange('admin')}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition bg-white text-sky-700 shadow-sm border border-slate-200 flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin Command Center</span>
            </button>
          </div>

          {/* Commander Badge & Logout */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700 hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Commander: <b>admin</b></span>
            </div>
            <button
              onClick={onAdminLogout}
              className="bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
              title="Logout from Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Top 5-Card Municipal KPI Bar */}
      <section className="px-4 lg:px-8 py-4 max-w-[1780px] w-full mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="csn-kpi anim-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="label">Active Grievances</div>
            <div className="val">{tickets.length || 48}<u>cases</u></div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Live queue tracking
            </div>
          </div>

          <div className="csn-kpi anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <div className="label">Critical Triage</div>
            <div className="val text-rose-600">
              {tickets.filter(t => t.urgency === 'CRITICAL').length || 3}<u>urgent</u>
            </div>
            <div className="text-xs font-semibold text-rose-600 flex items-center gap-1 mt-1">
              <Flame className="w-3 h-3" /> Target SLA: 30 mins
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">SLA Compliance</div>
            <div className="val text-sky-700">98.6%</div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Above Target 95%
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">Verified Solved Today</div>
            <div className="val text-emerald-700">
              {tickets.filter(t => t.status === 'RESOLVED').length + 140}<u>solved</u>
            </div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-1">
              <span>All 9 municipal divisions</span>
            </div>
          </div>

          <div className="csn-kpi">
            <div className="label">Active Patrol Units</div>
            <div className="val text-indigo-700">18<u>teams</u></div>
            <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1 mt-1">
              <Truck className="w-3 h-3" /> 94% on-site readiness
            </div>
          </div>
        </div>
      </section>

      {/* Main 3-Column Municipal Command Deck */}
      <div className="px-4 lg:px-8 pb-6 max-w-[1780px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Ward Performance & Category Breakdown (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
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
                      <div className="bg-sky-600 h-full rounded-full" style={{ width: `${pct}%` }} />
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

          <div className="csn-card h-64">
            <div className="csn-card-head">
              <h2>Civic Grievance Distribution</h2>
            </div>
            <div className="flex-1 w-full p-2" ref={categoryChartRef} />
          </div>

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
                tickets={tickets}
                selectedWard={selectedWard}
                onSelectWard={handleSelectWard}
              />
            </div>
          </div>

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
                  <div className="text-[11px] text-slate-500 mt-0.5">{unit.task}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="csn-card h-64">
            <div className="csn-card-head">
              <h2>Live Municipal Dispatch Stream</h2>
              <span className="badge-info">Realtime</span>
            </div>
            <div className="p-3 flex-1 overflow-hidden relative">
              <div className="csn-alert-lane">
                {SAMBHAJI_NAGAR_ALERTS.concat(SAMBHAJI_NAGAR_ALERTS).map((alert, idx) => (
                  <div key={idx} className={`csn-alert-item ${alert.level === 'HIGH' ? 'critical' : ''}`}>
                    <span className="font-mono text-[11px] text-slate-500">{alert.time}</span>
                    <span className="flex-1 text-[11.5px] font-medium text-slate-800 truncate">
                      {alert.desc}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        alert.level === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {alert.dept}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Admin Live Incident Queue & Triage Management */}
      <section className="px-4 lg:px-8 pb-12 max-w-[1780px] w-full mx-auto">
        <div className="csn-card">
          <div className="csn-card-head justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h2>Municipal Incident Triage & Override Queue</h2>
              <span className="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {filteredTickets.length} Complaints
              </span>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search by ID, keyword, dept..."
                  className="bg-slate-50 border border-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 text-slate-900 outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setUrgencyFilter(lvl)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      urgencyFilter === lvl
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Incident Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Urgency</th>
                  <th className="py-3 px-4">Problem Status</th>
                  <th className="py-3 px-4">Department & Category</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Citizen Feedback</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                      No complaints match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => {
                    const isSolved = t.status === 'RESOLVED';
                    const isGoingOn = t.status === 'IN_PROGRESS' || t.status === 'DISPATCHED';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          #{t.id}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] uppercase ${
                              t.urgency === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : t.urgency === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : t.urgency === 'MEDIUM'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] uppercase flex items-center gap-1 w-max ${
                              isSolved
                                ? 'bg-emerald-100 text-emerald-800'
                                : isGoingOn
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSolved
                                  ? 'bg-emerald-600'
                                  : isGoingOn
                                  ? 'bg-amber-600 animate-pulse'
                                  : 'bg-rose-600'
                              }`}
                            />
                            {isSolved ? 'SOLVED' : isGoingOn ? 'GOING ON' : 'NOT SOLVED'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{t.department || 'Municipal Works'}</div>
                          <div className="text-[11px] text-slate-500">{t.category}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {t.location_name || 'Civic Zone'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={t.description}>
                          {t.description}
                        </td>
                        <td className="py-3 px-4">
                          {t.feedback_count > 0 ? (
                            <button
                              onClick={() => openFeedbackModal(t)}
                              className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[11px] transition shadow-xs hover:scale-105 active:scale-95"
                              title="Click to view citizen feedback & comments"
                            >
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{t.avg_rating}</span>
                              <span className="text-amber-700 font-normal">({t.feedback_count})</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No feedback yet</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openOverride(t)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                              title="Human-in-the-Loop Override"
                            >
                              Override
                            </button>
                            {!isSolved && (
                              <button
                                onClick={() => onResolveTicket(t)}
                                className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold transition"
                                title="Mark Verified Solved"
                              >
                                Resolve
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteTicket(t.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="Remove Complaint"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Human-in-the-Loop Override Modal */}
      {editingTicket && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900">Incident Override #{editingTicket.id}</h3>
              </div>
              <button
                onClick={() => setEditingTicket(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Urgency Level
                </label>
                <select
                  value={overrideUrgency}
                  onChange={(e) => setOverrideUrgency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 outline-none"
                >
                  <option value="CRITICAL">CRITICAL (Emergency Response)</option>
                  <option value="HIGH">HIGH (Priority)</option>
                  <option value="MEDIUM">MEDIUM (Normal SLA)</option>
                  <option value="LOW">LOW (Standard)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Municipal Department
                </label>
                <select
                  value={overrideDepartment}
                  onChange={(e) => setOverrideDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 outline-none"
                >
                  <option value="Water Supply & Drainage">Water Supply & Drainage</option>
                  <option value="Roads, Bridges & Infrastructure">Roads, Bridges & Infrastructure</option>
                  <option value="Electrical & Power Grid">Electrical & Power Grid</option>
                  <option value="Solid Waste & Sanitation">Solid Waste & Sanitation</option>
                  <option value="Public Health & Safety">Public Health & Safety</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resolution Status
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 outline-none"
                >
                  <option value="OPEN">OPEN (Not Solved)</option>
                  <option value="IN_PROGRESS">IN PROGRESS (Going On)</option>
                  <option value="DISPATCHED">DISPATCHED (Field Unit On Site)</option>
                  <option value="RESOLVED">RESOLVED (Problem Solved)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setEditingTicket(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveOverride}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition shadow-sm"
                >
                  Save Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Feedback Inspection Modal */}
      {feedbackModalTicket && (
        <div className="fixed inset-0 z-[999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 anim-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 anim-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-600 fill-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Citizen Feedback — Complaint #{feedbackModalTicket.id}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {feedbackModalTicket.department} • {feedbackModalTicket.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFeedbackModalTicket(null);
                  setTicketFeedbackList([]);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Reported Complaint
              </div>
              <div>{feedbackModalTicket.description}</div>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {loadingFeedback ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : ticketFeedbackList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No feedback reviews recorded yet for this complaint.
                </div>
              ) : (
                ticketFeedbackList.map((fb, idx) => (
                  <div
                    key={fb.id || idx}
                    className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold">
                          {fb.user_name ? fb.user_name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-900">
                            {fb.user_name || 'Anonymous Citizen'}
                          </span>
                          {fb.user_email && (
                            <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                              ({fb.user_email})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-amber-200 px-2 py-0.5 rounded-md">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                        <span className="text-xs font-bold text-amber-900">{fb.rating}/5</span>
                      </div>
                    </div>
                    {fb.comment && (
                      <p className="text-xs text-slate-700 italic pl-8">
                        "{fb.comment}"
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400 pl-8">
                      Submitted on: {new Date(fb.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setFeedbackModalTicket(null);
                  setTicketFeedbackList([]);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
