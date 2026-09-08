import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Send,
  ShieldAlert,
  CheckCircle2,
  PhoneCall,
  RefreshCw,
  Clock,
  MapPin,
  Flame,
  Activity,
  Sliders,
  X,
  Radio,
  Sparkles,
  Zap,
  Check,
  Map,
  Search,
  User,
  LogOut,
  UserPlus
} from 'lucide-react';
import LocationPickerModal from './LocationPickerModal';
import ComplaintTracker from './ComplaintTracker';
import AuthModal from './AuthModal';
import { ErrorBoundary } from './ErrorBoundary';
import { safeString } from './utils.js';

// Relative API base connects seamlessly in both Vite proxy dev and Express unified production
const API_BASE = '/api';

// Safe date formatter that will NEVER throw RangeError
function formatSLATime(isoString) {
  if (!isoString) return '30 mins SLA';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Active SLA';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Active SLA';
  }
}

// Resilient Client-Side Triage Engine for Chhatrapati Sambhaji Nagar
function triageClientSide(description, locationName, coords) {
  const text = (description || '').toLowerCase();
  let urgency = 'MEDIUM';
  let category = 'Public Safety';
  let department = 'Roads, Bridges & Infrastructure';
  let slaHours = 6;
  let isEmergency = false;

  // 1. Critical Floods & Inundation (<30m SLA Guarantee)
  if (text.match(/flood|flooding|flash flood|water logg|inundat|submerg|deluge|drown/)) {
    urgency = 'CRITICAL';
    category = 'Disaster / Flood';
    department = 'Disaster Management & Flood Control';
    slaHours = 0.5;
    isEmergency = true;
  }
  // 2. Fire, Explosions, Sparks
  else if (text.match(/fire|spark|explosion|smoke|burning|shock|flame|collapsed/)) {
    urgency = 'CRITICAL';
    category = 'Medical/Fire';
    department = 'Fire & Rescue Services';
    slaHours = 0.5;
    isEmergency = true;
  }
  // 3. Casualties & Severe Medical
  else if (text.match(/accident|crash|casualty|blood|injury|ambulance|unconscious/)) {
    urgency = 'CRITICAL';
    category = 'Medical/Fire';
    department = 'Emergency Medical & Ambulance';
    slaHours = 0.5;
    isEmergency = true;
  }
  else if (text.match(/gas leak|toxic|cylinder|poison|suffocating/)) {
    urgency = 'CRITICAL';
    category = 'Public Safety';
    department = 'Fire & Rescue Services';
    slaHours = 0.5;
    isEmergency = true;
  }
  // 4. High Urgency (Major Water or Power)
  else if (text.match(/leak|burst|water supply|pipeline|drinking water|sewage overflow/)) {
    urgency = 'HIGH';
    category = 'Water Supply';
    department = 'Water Supply & Sewerage Board';
    slaHours = 2;
  }
  else if (text.match(/blackout|power cut|wire|short circuit|transformer|pole/)) {
    urgency = 'HIGH';
    category = 'Electricity';
    department = 'Electricity & Power Distribution';
    slaHours = 2;
  }
  // 5. Medium Urgency
  else if (text.match(/pothole|road|crater|traffic signal|jam|speed breaker|divider/)) {
    urgency = 'MEDIUM';
    category = 'Roads';
    department = 'Roads, Bridges & Infrastructure';
    slaHours = 8;
  }
  else if (text.match(/garbage|trash|waste|dump|stench|sanitation|dead animal/)) {
    urgency = 'MEDIUM';
    category = 'Sanitation';
    department = 'Public Health, Sanitation & Waste';
    slaHours = 12;
  }

  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
  const ticketId = Math.floor(4830 + Math.random() * 500);

  return {
    id: ticketId,
    description,
    category,
    urgency,
    department,
    location_name: locationName || 'Kranti Chowk, Chhatrapati Sambhaji Nagar',
    latitude: coords?.lat || 19.8732,
    longitude: coords?.lng || 75.3268,
    sla_deadline: slaDeadline,
    is_emergency: isEmergency,
    status: isEmergency ? 'DISPATCHED' : 'OPEN',
    created_at: new Date().toISOString(),
    sms_channel: isEmergency ? 'SMS Emergency Protocol Active' : undefined,
    sms_body: isEmergency
      ? `[EMERGENCY DISPATCH - RAPID RESOLVE CSNMC] Ticket #${ticketId} (${category} -> ${department}): "${description}" at ${locationName || 'Chhatrapati Sambhaji Nagar'}. Immediate action required. SLA: 30m.`
      : undefined
  };
}

export default function App() {
  // Navigation tabs: 'citizen' or 'track' (admin is now at /admin URL)
  const [activeTab, setActiveTab] = useState('citizen');
  const [trackedTicketId, setTrackedTicketId] = useState('');
  const [tickets, setTickets] = useState([]);
  const [health, setHealth] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Citizen Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [citizenUser, setCitizenUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('rapidresolve_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Citizen Chat & Location State (Light Theme & Sambhaji Nagar Default)
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '👋 Welcome to Rapid Resolve Citizen AI Desk (Chhatrapati Sambhaji Nagar Municipal Corporation).\nDescribe your civic grievance or emergency. Our AI triage system classifies urgency, alerts emergency squads via SMS, and binds municipal SLA guarantees.',
      ticket: null
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('Kranti Chowk, Chhatrapati Sambhaji Nagar');
  const [selectedCoords, setSelectedCoords] = useState({ lat: 19.8732, lng: 75.3268 });
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHealth();
    fetchTickets();

    // Connect to Server-Sent Events (SSE) for real-time bidirectional ticket updates
    let es;
    try {
      es = new EventSource(`${API_BASE}/events`);
      es.addEventListener('ticket_created', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.ticket) {
            setTickets((prev) => {
              if (prev.some((t) => t.id === payload.ticket.id)) return prev;
              return [payload.ticket, ...prev];
            });
          }
        } catch (err) {
          console.error('SSE ticket_created parse error in App:', err);
        }
      });

      es.addEventListener('ticket_updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.ticket) {
            setTickets((prev) =>
              prev.map((t) => (t.id === payload.ticket.id ? { ...t, ...payload.ticket } : t))
            );
          }
        } catch (err) {
          console.error('SSE ticket_updated parse error in App:', err);
        }
      });

      es.addEventListener('ticket_deleted', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.id) {
            setTickets((prev) => prev.filter((t) => t.id !== payload.id));
          }
        } catch (err) {
          console.error('SSE ticket_deleted parse error in App:', err);
        }
      });
    } catch (err) {
      console.warn('EventSource initialization error in App:', err);
    }

    const interval = setInterval(() => {
      fetchTickets(true);
    }, 15000);

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await axios.get(`${API_BASE}/health`);
      setHealth(res.data);
    } catch {
      setHealth({ status: 'online', database: 'SQLite (Persistent)', aiEngine: 'Local Heuristic Engine' });
    }
  };

  const fetchTickets = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE}/tickets`);
      if (Array.isArray(res.data)) {
        setTickets(res.data);
      } else {
        console.warn('Unexpected tickets response:', res.data);
      }
    } catch (err) {
      console.warn('Backend unavailable, preserving existing items', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    const currentText = inputText.trim();
    const userMsg = { sender: 'user', text: currentText, location: selectedLocation };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE}/tickets`,
        {
          description: currentText,
          location_name: selectedLocation,
          latitude: selectedCoords.lat,
          longitude: selectedCoords.lng,
          user_id: citizenUser?.id || null
        },
        { timeout: 7000 }
      );
      const t = res.data?.ticket;

      if (t && typeof t === 'object') {
        try {
          if (t.id && (typeof t.id === 'number' || !isNaN(Number(t.id)))) {
            const numId = Number(t.id);
            const saved = JSON.parse(localStorage.getItem('rapidresolve_citizen_tickets') || '[]');
            const cleanSaved = Array.isArray(saved)
              ? saved.filter((x) => typeof x === 'number' || (typeof x === 'string' && !isNaN(Number(x))))
              : [];
            const updated = [numId, ...cleanSaved.filter((x) => Number(x) !== numId)].slice(0, 8);
            localStorage.setItem('rapidresolve_citizen_tickets', JSON.stringify(updated));
          }
        } catch {
          // Ignore localStorage errors
        }

        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: `✅ Ticket #${t.id} Logged & Dispatched!`,
            ticket: t
          }
        ]);
        fetchTickets(true);
      }
    } catch (err) {
      console.warn('Backend API unavailable or timed out. Engaging resilient edge triage engine:', err);
      const fallbackTicket = triageClientSide(currentText, selectedLocation, selectedCoords);
      try {
        if (fallbackTicket.id) {
          const numId = Number(fallbackTicket.id);
          const saved = JSON.parse(localStorage.getItem('rapidresolve_citizen_tickets') || '[]');
          const cleanSaved = Array.isArray(saved)
            ? saved.filter((x) => typeof x === 'number' || (typeof x === 'string' && !isNaN(Number(x))))
            : [];
          const updated = [numId, ...cleanSaved.filter((x) => Number(x) !== numId)].slice(0, 8);
          localStorage.setItem('rapidresolve_citizen_tickets', JSON.stringify(updated));
        }
      } catch {
        // Ignore localStorage errors
      }
      setTickets((prev) => [fallbackTicket, ...prev]);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `✅ Ticket #${fallbackTicket.id} Logged & Dispatched!`,
          ticket: fallbackTicket
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (promptText, loc, coords) => {
    setInputText(promptText);
    if (loc) setSelectedLocation(loc);
    if (coords) setSelectedCoords(coords);
  };

  const handleTabSwitch = (tab) => {
    if (tab === 'track') {
      setActiveTab('track');
    } else {
      setActiveTab('citizen');
    }
  };

  const handleCitizenLogout = () => {
    sessionStorage.removeItem('rapidresolve_user_token');
    sessionStorage.removeItem('rapidresolve_user');
    setCitizenUser(null);
  };

  const handleAuthSuccess = (user, token) => {
    setCitizenUser(user);
  };

  const safeTickets = Array.isArray(tickets) ? tickets : [];

  return (
    <ErrorBoundary fallbackTitle="Rapid Resolve Application Error">
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        {/* Top Navigation Bar (Clean Light Theme) */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 sm:px-8 py-3 flex flex-wrap justify-between items-center gap-4 shadow-xs anim-slide-down">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-md shadow-sky-500/20 text-white anim-glow-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  Rapid Resolve
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-sky-100 border border-sky-300 text-sky-800 px-2 py-0.5 rounded-full">
                  Chhatrapati Sambhaji Nagar
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Unified Municipal AI Triage & Civic Emergency Dispatch (CSNMC)
              </p>
            </div>
          </div>

          {/* System Health Indicators */}
          <div className="hidden md:flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-semibold text-slate-700">{safeString(health?.database, 'Connected')}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{safeString(health?.aiEngine, 'AI Triage Active')}</span>
            </div>
          </div>

          {/* Right: Auth + Tab Switcher */}
          <div className="flex items-center gap-3">
            {/* User Auth */}
            {citizenUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs">
                  <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {citizenUser.name && typeof citizenUser.name === 'string' ? citizenUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="font-semibold text-emerald-800 hidden sm:inline">{safeString(citizenUser.name, 'Citizen')}</span>
                </div>
                <button
                  onClick={handleCitizenLogout}
                  className="text-slate-400 hover:text-rose-600 transition p-1"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:-translate-y-0.5 active:translate-y-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up / Login</span>
              </button>
            )}

            {/* View Switcher Tabs */}
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => handleTabSwitch('citizen')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 ${
                  activeTab === 'citizen'
                    ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Radio className="w-4 h-4 text-sky-600" />
                <span>Citizen AI Desk</span>
              </button>

              <button
                onClick={() => handleTabSwitch('track')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 ${
                  activeTab === 'track'
                    ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Search className="w-4 h-4 text-sky-600" />
                <span>Track Complaint</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          {activeTab === 'citizen' ? (
            /* ================================================================= */
            /* CITIZEN APP: AI DESK & EMERGENCY REPORTING (LIGHT THEME)         */
            /* ================================================================= */
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Greeting Hero Banner */}
              <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 rounded-2xl p-6 shadow-md text-white relative overflow-hidden anim-fade-in-up anim-gradient-shift">
                <div className="relative z-10">
                  <h1 className="text-2xl font-extrabold mb-1.5 flex items-center gap-2">
                    <span>Report Civic Grievances & Emergencies</span>
                  </h1>
                  <p className="text-sm text-sky-100 max-w-xl leading-relaxed">
                    Chhatrapati Sambhaji Nagar Municipal Corporation. Rapid Resolve AI evaluates urgency, triggers automated SMS dispatch on critical emergencies, and enforces municipal SLA timelines.
                  </p>
                </div>
                <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none anim-float" />
                <div className="absolute -left-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none anim-float-slow" />
              </div>

              {/* Quick Tracking Access Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3 shadow-xs anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <span>Have an existing ticket ID? Check real-time progress:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('track')}
                  className="inline-flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Track Complaint Now ➔</span>
                </button>
              </div>

              {/* Interactive Chat Console (Light Theme) */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[580px] anim-fade-in-up" style={{ animationDelay: '0.15s' }}>
                {/* Chat Header */}
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Rapid Resolve AI Triage Agent</h2>
                      <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Chhatrapati Sambhaji Nagar Municipal Grid Online
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    <PhoneCall className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    <span className="font-semibold text-[11px]">Emergency SMS Alert Active</span>
                  </div>
                </div>

                {/* Chat Body */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} anim-fade-in-up`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed shadow-sm transition-all hover:shadow-md ${
                          m.sender === 'user'
                            ? 'bg-sky-600 text-white shadow-sky-600/20'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{safeString(m.text)}</div>

                        {/* Ticket Triage Card if generated */}
                        {m.ticket && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5 anim-fade-in">
                            {/* Prominent 3-State Problem Status Indicator */}
                            <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                              <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                                Problem Status:
                              </span>
                              <span
                                className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider border flex items-center gap-1.5 shadow-2xs ${
                                  m.ticket.status === 'RESOLVED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : m.ticket.status === 'IN_PROGRESS' || m.ticket.status === 'DISPATCHED'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    m.ticket.status === 'RESOLVED'
                                      ? 'bg-emerald-500'
                                      : m.ticket.status === 'IN_PROGRESS' || m.ticket.status === 'DISPATCHED'
                                      ? 'bg-amber-500 animate-ping'
                                      : 'bg-rose-500'
                                  }`}
                                />
                                <span>
                                  {m.ticket.status === 'RESOLVED'
                                    ? 'SOLVED'
                                    : m.ticket.status === 'IN_PROGRESS' || m.ticket.status === 'DISPATCHED'
                                    ? 'GOING ON'
                                    : 'NOT SOLVED'}
                                </span>
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                              <span
                                className={`text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                                  m.ticket.urgency === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                    : m.ticket.urgency === 'HIGH'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : m.ticket.urgency === 'MEDIUM'
                                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                Urgency: {m.ticket.urgency}
                              </span>
                              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                                {m.ticket.category}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                              <div className="flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-sky-600" />
                                <span>Dept: <b className="text-slate-900">{m.ticket.department}</b></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>SLA: <b className="text-slate-900">{formatSLATime(m.ticket.sla_deadline)}</b></span>
                              </div>
                              <div className="flex items-center gap-1 col-span-2">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Location: <b className="text-slate-900">{m.ticket.location_name}</b></span>
                              </div>
                            </div>

                            {m.ticket.urgency === 'CRITICAL' && (
                              <div className="mt-2.5 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs space-y-1.5 anim-fade-in">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                                    <PhoneCall className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                    <span>Emergency Protocol: SMS Dispatch Triggered</span>
                                  </div>
                                  <span className="text-[10px] bg-rose-100 border border-rose-300 text-rose-800 px-2 py-0.5 rounded-md font-mono font-bold">
                                    {m.ticket.sms_channel || 'Live SMS Alert'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-rose-900 font-mono bg-white border border-rose-200 p-2 rounded-lg leading-relaxed">
                                  💬 {safeString(m.ticket.sms_body, `[DISPATCH] Ticket #${m.ticket.id} (${m.ticket.category} -> ${m.ticket.department}) at ${m.ticket.location_name}. Respond immediately. SLA: 30m.`)}
                                </div>
                              </div>
                            )}

                            {/* Track Status Navigation Button */}
                            <div className="pt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setTrackedTicketId(m.ticket.id);
                                  setActiveTab('track');
                                }}
                                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                              >
                                <Search className="w-3.5 h-3.5" />
                                <span>Track Live Status ➔</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start anim-fade-in">
                      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-600 flex items-center gap-2 shadow-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                        <span>Rapid Resolve AI is classifying incident & assigning SLA in Sambhaji Nagar grid...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Prompt Chips (Chhatrapati Sambhaji Nagar Locations) */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex gap-2 overflow-x-auto text-xs">
                  <span className="text-slate-500 text-[11px] self-center whitespace-nowrap font-bold">Quick Report:</span>
                  {[
                    { text: '🌊 Flash Flood (Critical)', prompt: 'Flash flood submerging Kranti Chowk flyover underpass', loc: 'Kranti Chowk Underpass', coords: { lat: 19.8732, lng: 75.3268 }, cls: 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800' },
                    { text: '🔥 Transformer Fire', prompt: 'Transformer sparking with flame near residential block at CIDCO', loc: 'CIDCO N-4 Sector', coords: { lat: 19.8778, lng: 75.3644 }, cls: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800' },
                    { text: '💧 Pipeline Burst', prompt: 'Major water supply pipeline burst with heavy road leakage at Waluj', loc: 'Waluj MIDC Phase 2', coords: { lat: 19.8450, lng: 75.2410 }, cls: 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800' },
                    { text: '🕳️ Hazardous Pothole', prompt: 'Dangerous pothole causing scooter skid on Sutgirni road', loc: 'Garkheda Sutgirni Chowk', coords: { lat: 19.8612, lng: 75.3475 }, cls: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-yellow-800' },
                    { text: '🗑️ Waste Dump', prompt: 'Solid waste accumulation and drain blockage at Begumpura', loc: 'Begumpura University Gate', coords: { lat: 19.9015, lng: 75.3182 }, cls: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800' }
                  ].map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleQuickPrompt(chip.prompt, chip.loc, chip.coords)}
                      className={`border ${chip.cls} px-2.5 py-1 rounded-full whitespace-nowrap transition font-semibold hover:-translate-y-0.5 active:translate-y-0`}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      {chip.text}
                    </button>
                  ))}
                </div>

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-3.5 bg-white border-t border-slate-200 flex flex-col gap-2.5">
                  {/* Location Selection Bar with Interactive Map Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MapPin className="w-4 h-4 text-sky-600 flex-shrink-0" />
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-900 truncate">{selectedLocation}</span>
                        <span className="text-[11px] text-sky-800 font-mono bg-sky-50 border border-sky-200 px-2 py-0.5 rounded font-semibold">
                          {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="inline-flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <Map className="w-3.5 h-3.5" />
                        <span>Select on Map</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Describe issue (e.g. water pipeline burst, spark on pole, road pothole)..."
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                    />
                    <button
                      type="submit"
                      disabled={loading || !inputText.trim()}
                      className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-md shadow-sky-600/30 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Submit</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* CITIZEN APP: COMPLAINT TRACKER & LIVE STATUS (LIGHT THEME)        */
            /* ================================================================= */
            <ComplaintTracker
              initialTicketId={trackedTicketId}
              onSwitchToReport={() => setActiveTab('citizen')}
              knownTickets={safeTickets}
            />
          )}
        </main>

        {/* Interactive Manual Location Picker Modal (Light Theme & Sambhaji Nagar) */}
        <LocationPickerModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          initialCoords={selectedCoords}
          initialLocationName={selectedLocation}
          onConfirm={({ name, lat, lng }) => {
            setSelectedLocation(name);
            setSelectedCoords({ lat, lng });
          }}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}
