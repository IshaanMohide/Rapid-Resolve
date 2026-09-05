import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  FileText,
  ChevronRight,
  ArrowRight,
  PhoneCall,
  Flame,
  Droplets,
  Wrench,
  AlertCircle,
  Building2,
  Calendar,
  History
} from 'lucide-react';

const API_BASE = '/api';

// Format ISO date safely
function formatDateTime(isoString) {
  if (!isoString) return 'Pending';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Pending';
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Pending';
  }
}

// Calculate remaining time against SLA deadline
function calculateSLARemaining(slaDeadline, status) {
  if (status === 'RESOLVED') {
    return { text: 'SLA Fulfilled', status: 'met', label: 'Case Resolved within SLA target' };
  }
  if (!slaDeadline) {
    return { text: '30 mins SLA', status: 'active', label: 'Active Standard SLA' };
  }
  try {
    const deadline = new Date(slaDeadline).getTime();
    const now = Date.now();
    const diffMs = deadline - now;

    if (diffMs <= 0) {
      return { text: 'SLA Breached', status: 'breached', label: 'Escalated to Chief Incident Commander' };
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0 && minutes < 30) {
      return { text: `${minutes}m remaining`, status: 'urgent', label: 'Emergency Protocol Active (<30m)' };
    }
    if (hours === 0) {
      return { text: `${minutes} mins`, status: 'active', label: 'Standard Rapid Resolve Target' };
    }
    return { text: `${hours}h ${minutes}m`, status: 'active', label: 'Municipal Triage Target' };
  } catch {
    return { text: 'Active SLA', status: 'active', label: 'Standard Target' };
  }
}

// 4-Stage Lifecycle Stepper Steps
const LIFECYCLE_STEPS = [
  {
    key: 'LOGGED',
    title: 'Report Logged & AI Triaged',
    desc: 'Incident urgency classified, municipal department assigned, SLA guarantee bound.'
  },
  {
    key: 'DISPATCHED',
    title: 'Department Dispatched',
    desc: 'Emergency protocol alerted, automated first responder notification dispatched.'
  },
  {
    key: 'IN_PROGRESS',
    title: 'On-Site Action Underway',
    desc: 'Ground crews on location; active municipal intervention and repair in progress.'
  },
  {
    key: 'RESOLVED',
    title: 'Resolved & Verified',
    desc: 'Grievance rectified, inspected on site, and closed with resolution notes.'
  }
];

function getStepIndex(status) {
  switch (status) {
    case 'OPEN':
      return 0;
    case 'DISPATCHED':
      return 1;
    case 'IN_PROGRESS':
      return 2;
    case 'RESOLVED':
      return 3;
    default:
      return 0;
  }
}

// 3-State Problem Status Helper (SOLVED, GOING ON, or NOT SOLVED)
function getProblemStatus(status) {
  if (status === 'RESOLVED') {
    return {
      key: 'SOLVED',
      label: 'SOLVED',
      description: 'The problem has been completely rectified, verified by ground staff, and closed in the municipal register.',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      dotColor: 'bg-emerald-600',
      textColor: 'text-emerald-700',
      bannerBg: 'bg-emerald-50 border-emerald-200'
    };
  }
  if (status === 'IN_PROGRESS' || status === 'DISPATCHED') {
    return {
      key: 'GOING ON',
      label: 'GOING ON',
      description: 'Field units have been dispatched and ground crew repair work is actively ongoing on location.',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
      dotColor: 'bg-amber-600 animate-pulse',
      textColor: 'text-amber-700',
      bannerBg: 'bg-amber-50 border-amber-200'
    };
  }
  return {
    key: 'NOT_SOLVED',
    label: 'NOT SOLVED',
    description: 'Complaint is registered in municipal queue. Awaiting unit dispatch and field inspection.',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
    dotColor: 'bg-rose-600',
    textColor: 'text-rose-700',
    bannerBg: 'bg-rose-50 border-rose-200'
  };
}

export default function ComplaintTracker({
  initialTicketId = '',
  onSwitchToReport = null,
  knownTickets = []
}) {
  const [searchId, setSearchId] = useState(initialTicketId ? String(initialTicketId) : '');
  const [activeTicket, setActiveTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Local storage for recent complaint searches
  const [recentTicketIds, setRecentTicketIds] = useState(() => {
    try {
      const saved = localStorage.getItem('rapidresolve_citizen_tickets');
      return saved ? JSON.parse(saved) : [4820, 4821, 4823];
    } catch {
      return [4820, 4821, 4823];
    }
  });

  useEffect(() => {
    if (initialTicketId) {
      setSearchId(String(initialTicketId));
      fetchTicketById(initialTicketId);
    } else {
      // Default to in-progress ticket for immediate preview
      fetchTicketById('4821');
    }
  }, [initialTicketId]);

  const fetchTicketById = async (idToFetch) => {
    const cleanId = String(idToFetch).replace(/^#/, '').trim();
    if (!cleanId) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await axios.get(`${API_BASE}/tickets/${cleanId}`, { timeout: 4000 });
      if (res.data?.success && res.data.ticket) {
        setActiveTicket(res.data.ticket);
        saveToRecentTickets(res.data.ticket.id);
      } else {
        setErrorMessage(res.data?.error || `Complaint #${cleanId} was not found.`);
        setActiveTicket(null);
      }
    } catch (err) {
      // Fallback: search known local tickets
      const numericId = parseInt(cleanId, 10);
      const localMatch = knownTickets.find((t) => t.id === numericId);
      if (localMatch) {
        setActiveTicket(localMatch);
        saveToRecentTickets(localMatch.id);
      } else {
        setErrorMessage(
          err.response?.data?.error ||
            `Complaint #${cleanId} could not be located in the municipal records. Please verify the ticket number.`
        );
        setActiveTicket(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    fetchTicketById(searchId);
  };

  const saveToRecentTickets = (id) => {
    try {
      const num = Number(id);
      setRecentTicketIds((prev) => {
        const filtered = prev.filter((item) => item !== num);
        const updated = [num, ...filtered].slice(0, 8);
        localStorage.setItem('rapidresolve_citizen_tickets', JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore storage error
    }
  };

  const handleCopyTicket = () => {
    if (!activeTicket) return;
    navigator.clipboard.writeText(
      `Chhatrapati Sambhaji Nagar Complaint #${activeTicket.id}: ${activeTicket.category} (${activeTicket.status}) - ${activeTicket.location_name}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStep = activeTicket ? getStepIndex(activeTicket.status) : 0;
  const slaInfo = activeTicket
    ? calculateSLARemaining(activeTicket.sla_deadline, activeTicket.status)
    : null;
  const problemStatus = activeTicket ? getProblemStatus(activeTicket.status) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Light Search Banner */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-blue-50 border border-sky-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-sky-100 border border-sky-300 text-sky-800 px-3 py-1 rounded-full text-xs font-bold mb-3 uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-sky-700" />
                <span>Citizen Public Tracking Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
                Track Complaint & Live Status
              </h1>
              <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
                Chhatrapati Sambhaji Nagar Municipal Corporation. Enter your ticket reference number to verify whether the problem is <b>SOLVED</b>, <b>GOING ON</b>, or <b>NOT SOLVED</b>.
              </p>
            </div>

            {onSwitchToReport && (
              <button
                onClick={onSwitchToReport}
                className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition shadow-xs self-start"
              >
                <span>Report New Issue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter Ticket ID (e.g. 4820, 4821, 4823)..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchId.trim()}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 whitespace-nowrap"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Track Incident</span>
            </button>
          </form>

          {/* Status Sample Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 flex items-center gap-1 font-bold">
              <History className="w-3.5 h-3.5 text-slate-400" />
              Sample Status:
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchId('4820');
                fetchTicketById(4820);
              }}
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>#4820: SOLVED</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchId('4821');
                fetchTicketById(4821);
              }}
              className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              <span>#4821: GOING ON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchId('4823');
                fetchTicketById(4823);
              }}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>#4823: NOT SOLVED</span>
            </button>

            {/* Other recently tracked ticket IDs */}
            {recentTicketIds.filter(id => ![4820, 4821, 4823].includes(id)).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSearchId(String(id));
                  fetchTicketById(id);
                }}
                className={`px-2.5 py-1 rounded-lg border font-mono transition ${
                  activeTicket?.id === id
                    ? 'bg-sky-100 border-sky-300 text-sky-800 font-bold'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                #{id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-900">Complaint Not Found</div>
            <p className="text-xs text-rose-700">{errorMessage}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Tip: Click sample buttons above to inspect <b className="text-slate-700 font-mono">4820</b> or <b className="text-slate-700 font-mono">4821</b>.
            </p>
          </div>
        </div>
      )}

      {/* Active Ticket Status Display */}
      {activeTicket && (
        <div className="space-y-6">
          {/* Main Status Header Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap justify-between items-start gap-4 pb-5 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Ticket #{activeTicket.id}
                  </h2>

                  {/* 3-State Problem Status Badge (SOLVED, GOING ON, or NOT SOLVED) */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs ${
                      problemStatus.badgeBg
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${problemStatus.dotColor}`} />
                    <span>STATUS: {problemStatus.label}</span>
                  </span>

                  {/* Urgency Badge */}
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                      activeTicket.urgency === 'CRITICAL'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : activeTicket.urgency === 'HIGH'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : activeTicket.urgency === 'MEDIUM'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {activeTicket.urgency} Urgency
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-medium line-clamp-2 pt-1">
                  "{activeTicket.description}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTicket}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  title="Copy complaint details"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchTicketById(activeTicket.id)}
                  disabled={loading}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  title="Check live status update"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* 3-State Problem Resolution Visual Pillar Overview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
                    Municipal Problem Status:
                  </span>
                  <span className={`text-xs px-3 py-0.5 rounded-full font-black uppercase tracking-wider border ${problemStatus.badgeBg}`}>
                    ● {problemStatus.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
                  <span>Real-time Municipal Status Guarantee</span>
                </div>
              </div>

              {/* 3 Side-by-Side Status Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. NOT SOLVED */}
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    problemStatus.key === 'NOT_SOLVED'
                      ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-sm ring-2 ring-rose-200'
                      : 'bg-white border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${problemStatus.key === 'NOT_SOLVED' ? 'bg-rose-600' : 'bg-slate-300'}`} />
                      NOT SOLVED
                    </span>
                    {problemStatus.key === 'NOT_SOLVED' && (
                      <span className="text-[10px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded-full">
                        ACTIVE STATE
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Complaint registered in municipal queue. Awaiting crew deployment.
                  </p>
                </div>

                {/* 2. GOING ON */}
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    problemStatus.key === 'GOING_ON'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-sm ring-2 ring-amber-200'
                      : 'bg-white border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${problemStatus.key === 'GOING_ON' ? 'bg-amber-600 animate-pulse' : 'bg-slate-300'}`} />
                      GOING ON
                    </span>
                    {problemStatus.key === 'GOING_ON' && (
                      <span className="text-[10px] bg-amber-600 text-white font-black px-1.5 py-0.2 rounded-full">
                        ACTIVE STATE
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Field units dispatched. Repair crews actively operating on site.
                  </p>
                </div>

                {/* 3. SOLVED */}
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    problemStatus.key === 'SOLVED'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-sm ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${problemStatus.key === 'SOLVED' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                      SOLVED
                    </span>
                    {problemStatus.key === 'SOLVED' && (
                      <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full">
                        ACTIVE STATE
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Grievance rectified and inspected by municipal supervisor.
                  </p>
                </div>
              </div>
            </div>

            {/* 4-Stage Lifecycle Stepper */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Resolution Lifecycle Timeline
                </span>
                <span className="text-xs font-bold text-sky-700">
                  Stage {currentStep + 1} of 4: {LIFECYCLE_STEPS[currentStep].title}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {LIFECYCLE_STEPS.map((step, idx) => {
                  const isPast = idx < currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div
                      key={step.key}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-sky-50 border-sky-400 text-sky-950 shadow-xs ring-1 ring-sky-200'
                          : isPast
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-5 h-5 rounded-full font-mono text-xs font-bold flex items-center justify-center bg-white border border-slate-200">
                          {isPast ? <Check className="w-3 h-3 text-emerald-600" /> : idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isCurrent
                              ? 'bg-sky-600 text-white'
                              : isPast
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isCurrent ? 'Current' : isPast ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                      <div className="font-bold text-xs mb-1">{step.title}</div>
                      <p className="text-[11px] leading-snug">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deterministic SLA Timer Box */}
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-900">Deterministic SLA Guarantee</div>
                  <div className="text-xs text-slate-600">{slaInfo.label}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black font-mono text-sky-800">{slaInfo.text}</div>
                <div className="text-[11px] text-slate-500">
                  Target Deadline: {formatDateTime(activeTicket.sla_deadline)}
                </div>
              </div>
            </div>

            {/* Incident Intelligence Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Municipal Department
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {activeTicket.department || 'Municipal Works'}
                </div>
                <div className="text-xs text-slate-600">{activeTicket.category}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Incident Location
                </div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  {activeTicket.location_name || 'Chhatrapati Sambhaji Nagar'}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {activeTicket.latitude?.toFixed(4)}, {activeTicket.longitude?.toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
