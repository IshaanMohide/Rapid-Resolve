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
      const overdueMins = Math.abs(Math.round(diffMs / 60000));
      const hours = Math.floor(overdueMins / 60);
      const mins = overdueMins % 60;
      return {
        text: hours > 0 ? `${hours}h ${mins}m Overdue` : `${mins}m Overdue`,
        status: 'breached',
        label: 'Escalated to Supervisory Authority'
      };
    }

    const remainingMins = Math.round(diffMs / 60000);
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;

    if (hours > 0) {
      return {
        text: `${hours}h ${mins}m remaining`,
        status: 'active',
        label: 'On Schedule for Resolution'
      };
    }
    return {
      text: `${mins} mins remaining`,
      status: mins <= 15 ? 'urgent' : 'active',
      label: mins <= 15 ? 'Priority Dispatch in Motion' : 'On Schedule for Resolution'
    };
  } catch {
    return { text: 'Active SLA', status: 'active', label: 'Guaranteed SLA' };
  }
}

// Helper to determine active step index based on ticket status
function getStepIndex(status) {
  switch (status) {
    case 'OPEN':
      return 0; // Stage 1 complete/active
    case 'DISPATCHED':
      return 1; // Stage 2 active
    case 'IN_PROGRESS':
      return 2; // Stage 3 active
    case 'RESOLVED':
      return 3; // All stages completed
    default:
      return 0;
  }
}

export default function ComplaintTracker({
  initialTicketId = '',
  onSwitchToReport,
  knownTickets = []
}) {
  const [searchId, setSearchId] = useState(initialTicketId ? String(initialTicketId) : '');
  const [activeTicket, setActiveTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentTicketIds, setRecentTicketIds] = useState([]);

  // Load recent tickets saved in browser localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rapidresolve_citizen_tickets');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          setRecentTicketIds(ids);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // If initialTicketId changes (e.g. from clicking "Track Status" on a chat card)
  useEffect(() => {
    if (initialTicketId) {
      setSearchId(String(initialTicketId));
      fetchTicketById(initialTicketId);
    }
  }, [initialTicketId]);

  const fetchTicketById = async (idToFetch) => {
    const cleanId = String(idToFetch).replace(/^#/, '').trim();
    if (!cleanId) {
      setErrorMessage('Please enter a valid Ticket ID number.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await axios.get(`${API_BASE}/tickets/${cleanId}`, { timeout: 6000 });
      if (res.data?.success && res.data.ticket) {
        setActiveTicket(res.data.ticket);
        saveToRecentTickets(res.data.ticket.id);
      } else {
        setErrorMessage(res.data?.error || `Complaint #${cleanId} was not found.`);
        setActiveTicket(null);
      }
    } catch (err) {
      // Fallback: check local knownTickets if backend is unreachable
      const numericId = parseInt(cleanId, 10);
      const localMatch = knownTickets.find((t) => t.id === numericId);
      if (localMatch) {
        setActiveTicket(localMatch);
        saveToRecentTickets(localMatch.id);
      } else {
        setErrorMessage(
          err.response?.data?.error ||
            `Complaint #${cleanId} could not be located. Please verify the ticket number.`
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
      // Ignore error
    }
  };

  const handleCopyTicket = () => {
    if (!activeTicket) return;
    navigator.clipboard.writeText(
      `Rapid Resolve Complaint #${activeTicket.id}: ${activeTicket.category} (${activeTicket.status}) - ${activeTicket.location_name}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStep = activeTicket ? getStepIndex(activeTicket.status) : 0;
  const slaInfo = activeTicket
    ? calculateSLARemaining(activeTicket.sla_deadline, activeTicket.status)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/70 border border-blue-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-900/60 border border-blue-500/40 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                <span>Citizen Public Tracking Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-white mb-2">
                Track Complaint & Live Status
              </h1>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                Enter your municipal reference number to inspect real-time triage status, assigned field units, deterministic SLA guarantees, and resolution logs.
              </p>
            </div>

            {onSwitchToReport && (
              <button
                onClick={onSwitchToReport}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition self-start"
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
                placeholder="Enter Ticket ID (e.g. 4821, 4822, 4820)..."
                className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchId.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 whitespace-nowrap"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Track Incident</span>
            </button>
          </form>

          {/* Quick Recent / Seed Ticket Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <History className="w-3 h-3 text-slate-400" />
              Recent Cases:
            </span>
            {recentTicketIds.length > 0 ? (
              recentTicketIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSearchId(String(id));
                    fetchTicketById(id);
                  }}
                  className={`px-2.5 py-1 rounded-lg border font-mono transition ${
                    activeTicket?.id === id
                      ? 'bg-blue-600/30 border-blue-500/60 text-blue-300 font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  #{id}
                </button>
              ))
            ) : (
              <>
                {[4821, 4822, 4823, 4820].map((sampleId) => (
                  <button
                    key={sampleId}
                    type="button"
                    onClick={() => {
                      setSearchId(String(sampleId));
                      fetchTicketById(sampleId);
                    }}
                    className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg font-mono transition"
                  >
                    #{sampleId}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/80 border border-red-700/60 text-red-200 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-red-300">Complaint Not Found</div>
            <p className="text-xs text-red-200/90">{errorMessage}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tip: Try searching sample ticket numbers like <code className="text-blue-300 font-mono">4821</code> or <code className="text-blue-300 font-mono">4820</code>.
            </p>
          </div>
        </div>
      )}

      {/* Active Ticket Status Display */}
      {activeTicket && (
        <div className="space-y-6">
          {/* Main Status Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-wrap justify-between items-start gap-4 pb-5 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black font-display text-white tracking-tight">
                    Ticket #{activeTicket.id}
                  </h2>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      activeTicket.status === 'RESOLVED'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                        : activeTicket.status === 'DISPATCHED'
                        ? 'bg-red-950/90 text-red-300 border-red-500/50 animate-pulse'
                        : activeTicket.status === 'IN_PROGRESS'
                        ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                        : 'bg-blue-950/90 text-blue-300 border-blue-500/50'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeTicket.status === 'RESOLVED'
                          ? 'bg-emerald-400'
                          : activeTicket.status === 'DISPATCHED'
                          ? 'bg-red-400 animate-ping'
                          : activeTicket.status === 'IN_PROGRESS'
                          ? 'bg-amber-400'
                          : 'bg-blue-400'
                      }`}
                    />
                    <span>{activeTicket.status || 'OPEN'}</span>
                  </span>

                  {/* Urgency Badge */}
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                      activeTicket.urgency === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : activeTicket.urgency === 'HIGH'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                        : activeTicket.urgency === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}
                  >
                    {activeTicket.urgency} Urgency
                  </span>
                </div>
                <p className="text-sm text-slate-300 font-medium line-clamp-2 pt-1">
                  "{activeTicket.description}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTicket}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                  title="Copy complaint details"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchTicketById(activeTicket.id)}
                  disabled={loading}
                  className="bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                  title="Check live status update"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* SLA Alert Box */}
            <div
              className={`p-4 rounded-xl border flex flex-wrap justify-between items-center gap-3 ${
                slaInfo?.status === 'met'
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                  : slaInfo?.status === 'breached'
                  ? 'bg-red-950/60 border-red-700/60 text-red-200'
                  : slaInfo?.status === 'urgent'
                  ? 'bg-orange-950/50 border-orange-700/50 text-orange-200'
                  : 'bg-blue-950/40 border-blue-700/40 text-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    slaInfo?.status === 'met'
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : slaInfo?.status === 'breached'
                      ? 'bg-red-900/60 text-red-300'
                      : 'bg-blue-900/60 text-blue-300'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Deterministic SLA Guarantee:</div>
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    <span>{slaInfo?.text}</span>
                    <span className="text-xs font-normal text-slate-400">
                      ({slaInfo?.label})
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 text-right">
                <div>Target Deadline:</div>
                <div className="font-semibold text-slate-200">
                  {formatDateTime(activeTicket.sla_deadline)}
                </div>
              </div>
            </div>

            {/* 4-Step Interactive Lifecycle Stepper */}
            <div className="pt-2">
              <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-6 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Complaint Resolution Lifecycle</span>
              </h3>

              <div className="relative">
                {/* Desktop Stepper */}
                <div className="hidden md:grid grid-cols-4 gap-4 relative">
                  {/* Connecting Progress Line */}
                  <div className="absolute top-5 left-8 right-8 h-1 bg-slate-800 -z-0">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 transition-all duration-500"
                      style={{
                        width:
                          currentStep === 0
                            ? '12%'
                            : currentStep === 1
                            ? '38%'
                            : currentStep === 2
                            ? '70%'
                            : '100%'
                      }}
                    />
                  </div>

                  {/* Step 1 */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        currentStep >= 0
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/40'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Report Logged</div>
                      <div className="text-[11px] text-slate-400">AI Triage & Urgency Set</div>
                      <div className="text-[10px] text-blue-400 font-mono mt-0.5">
                        {formatDateTime(activeTicket.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        currentStep >= 1
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/40'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {currentStep >= 1 ? <Check className="w-5 h-5" /> : <PhoneCall className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Department Dispatched</div>
                      <div className="text-[11px] text-slate-400">Field Unit Alerted</div>
                      {activeTicket.sms_channel && (
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                          SMS Sent
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        currentStep >= 2
                          ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-600/40'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {currentStep >= 3 ? <Check className="w-5 h-5" /> : <Wrench className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">On-Site Action</div>
                      <div className="text-[11px] text-slate-400">Crews Active on Location</div>
                      {activeTicket.status === 'IN_PROGRESS' && (
                        <div className="text-[10px] text-amber-400 font-semibold mt-0.5 animate-pulse">
                          ● Work In Progress
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        currentStep >= 3
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/40'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Resolved & Closed</div>
                      <div className="text-[11px] text-slate-400">SLA Fulfilled & Verified</div>
                      {activeTicket.resolved_at && (
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                          {formatDateTime(activeTicket.resolved_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Stepper (Vertical) */}
                <div className="md:hidden space-y-4 border-l-2 border-slate-800 ml-4 pl-4">
                  <div className="relative">
                    <span
                      className={`absolute -left-[25px] top-0.5 w-4 h-4 rounded-full border-2 ${
                        currentStep >= 0
                          ? 'bg-blue-600 border-blue-400'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                    <div className="text-xs font-bold text-white">1. Report Logged & AI Triaged</div>
                    <div className="text-[11px] text-slate-400">Priority and SLA determined</div>
                    <div className="text-[10px] text-blue-400 font-mono">
                      {formatDateTime(activeTicket.created_at)}
                    </div>
                  </div>

                  <div className="relative">
                    <span
                      className={`absolute -left-[25px] top-0.5 w-4 h-4 rounded-full border-2 ${
                        currentStep >= 1
                          ? 'bg-blue-600 border-blue-400'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                    <div className="text-xs font-bold text-white">2. Department Dispatched</div>
                    <div className="text-[11px] text-slate-400">
                      Transferred to {activeTicket.department}
                    </div>
                  </div>

                  <div className="relative">
                    <span
                      className={`absolute -left-[25px] top-0.5 w-4 h-4 rounded-full border-2 ${
                        currentStep >= 2
                          ? 'bg-amber-600 border-amber-400'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                    <div className="text-xs font-bold text-white">3. On-Site Action</div>
                    <div className="text-[11px] text-slate-400">
                      Field teams deploying corrective measures
                    </div>
                  </div>

                  <div className="relative">
                    <span
                      className={`absolute -left-[25px] top-0.5 w-4 h-4 rounded-full border-2 ${
                        currentStep >= 3
                          ? 'bg-emerald-600 border-emerald-400'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                    <div className="text-xs font-bold text-white">4. Resolved & Verified</div>
                    <div className="text-[11px] text-slate-400">
                      {activeTicket.status === 'RESOLVED'
                        ? 'Inspection passed and case archived'
                        : 'Awaiting resolution'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resolution Notes (if marked resolved) */}
            {activeTicket.status === 'RESOLVED' && (
              <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4 text-xs text-emerald-200 space-y-1.5">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Command Resolution Verification:</span>
                </div>
                <p className="text-slate-300 leading-relaxed italic">
                  "{activeTicket.resolution_notes || 'Incident inspected and confirmed resolved by municipal field supervisors.'}"
                </p>
                {activeTicket.resolved_at && (
                  <div className="text-[11px] text-emerald-400/90 pt-1">
                    Resolved on: {formatDateTime(activeTicket.resolved_at)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detailed Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department & Routing Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Municipal Jurisdiction</span>
              </div>
              <div className="text-base font-bold text-white">
                {activeTicket.department || 'Municipal Works'}
              </div>
              <div className="text-xs text-slate-400">
                Category:{' '}
                <span className="text-slate-200 font-medium bg-slate-800 px-2 py-0.5 rounded">
                  {activeTicket.category || 'General Civic Grievance'}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Emergency Protocol:{' '}
                <span
                  className={`font-semibold ${
                    activeTicket.is_emergency ? 'text-red-400' : 'text-slate-300'
                  }`}
                >
                  {activeTicket.is_emergency ? 'Active (<30m SLA Protocol)' : 'Standard Civic SLA'}
                </span>
              </div>
            </div>

            {/* Geolocation Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Reported Incident Location</span>
              </div>
              <div className="text-base font-bold text-white truncate">
                {activeTicket.location_name || 'Civic Zone Marker'}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>GPS Pin:</span>
                <span className="text-blue-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {Number(activeTicket.latitude || 19.8762).toFixed(4)},{' '}
                  {Number(activeTicket.longitude || 75.3433).toFixed(4)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Logged: {formatDateTime(activeTicket.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* When no ticket is active yet */}
      {!activeTicket && !errorMessage && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Track Any Complaint by Reference Number</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Every civic grievance filed with Rapid Resolve receives a unique tracking number. Enter your number above to view real-time field progress.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchId('4821');
                fetchTicketById(4821);
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2 rounded-xl transition"
            >
              Demo: Track #4821 (In Progress)
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchId('4820');
                fetchTicketById(4820);
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3.5 py-2 rounded-xl transition"
            >
              Demo: Track #4820 (Resolved)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
