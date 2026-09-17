import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Database, Activity, RefreshCw, Zap, Shield, CheckCircle2,
  AlertTriangle, Radio, Server, Layers, Clock, ArrowUpRight, Cpu
} from 'lucide-react';
import { safeString } from './utils.js';

const API_BASE = '/api';

export default function RealtimeDBModal({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pingMs, setPingMs] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected', 'connecting', 'offline'
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    fetchData();
    measurePing();

    // Connect to live SSE real-time stream
    try {
      const es = new EventSource(`${API_BASE}/realtime/events`);
      eventSourceRef.current = es;

      es.addEventListener('connected', (e) => {
        setConnectionStatus('connected');
        try {
          const data = JSON.parse(e.data);
          if (data.dbStats) setStats(data.dbStats);
        } catch {}
      });

      es.addEventListener('db_change', (e) => {
        try {
          const change = JSON.parse(e.data);
          setHistory((prev) => [change, ...prev.slice(0, 49)]);
          // Refresh statistics whenever data changes
          fetchStatsSilently();
        } catch (err) {
          console.error('Error handling live db_change in modal:', err);
        }
      });

      es.onerror = () => {
        setConnectionStatus('connecting');
      };
    } catch {
      setConnectionStatus('offline');
    }

    const interval = setInterval(() => {
      fetchStatsSilently();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/realtime/stats`, { timeout: 4000 }),
        axios.get(`${API_BASE}/realtime/history`, { timeout: 4000 })
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.stats) {
        setStats(statsRes.value.data.stats);
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('offline');
      }

      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value.data?.events)) {
        setHistory(historyRes.value.data.events);
      }
    } catch (err) {
      console.warn('Realtime DB fetch error:', err);
      setConnectionStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatsSilently = async () => {
    try {
      const res = await axios.get(`${API_BASE}/realtime/stats`, { timeout: 3000 });
      if (res.data?.stats) {
        setStats(res.data.stats);
        setConnectionStatus('connected');
      }
    } catch {
      // Keep existing
    }
  };

  const measurePing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await axios.post(`${API_BASE}/realtime/ping`, {}, { timeout: 3000 });
      const elapsed = Math.round(performance.now() - start);
      setPingMs(elapsed);
      setConnectionStatus('connected');
    } catch {
      setPingMs(null);
      setConnectionStatus('offline');
    } finally {
      setIsPinging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 anim-fade-in">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden anim-scale-in text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Real-Time Database Inspector
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400 animate-ping'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`} />
                  {connectionStatus === 'connected' ? 'LIVE SYNC' : connectionStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                SQLite 3 WAL Reactive Engine • Event-Driven Pub/Sub • Bidirectional SSE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={measurePing}
              disabled={isPinging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 border border-slate-700 transition"
              title="Test roundtrip database latency"
            >
              <Zap className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{pingMs !== null ? `${pingMs}ms` : 'Ping'}</span>
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Table Metrics Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Live Database Tables
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Engine: {stats?.engine || 'SQLite WAL (Reactive)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-slate-400">Total Tickets</div>
                <div className="text-2xl font-black text-white mt-1">
                  {stats?.tables?.tickets ?? '—'}
                </div>
                <div className="text-[10px] text-amber-400 mt-1 font-medium">
                  {stats?.tables?.openTickets ?? 0} active / {stats?.tables?.criticalTickets ?? 0} critical
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-slate-400">Registered Citizens</div>
                <div className="text-2xl font-black text-sky-400 mt-1">
                  {stats?.tables?.users ?? '—'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  users table
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-slate-400">Citizen Reviews</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {stats?.tables?.feedback ?? '—'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  Synced to CSV
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-slate-400">Active SSE Clients</div>
                <div className="text-2xl font-black text-indigo-400 mt-1">
                  {stats?.activeSSEClients ?? 1}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  Connected browsers
                </div>
              </div>
            </div>
          </div>

          {/* Engine Technical Specifications */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Storage Mode</span>
                <span className="font-mono text-slate-200 font-semibold">WAL (Write-Ahead Logging)</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Concurrency</span>
                <span className="font-mono text-emerald-400 font-semibold">Non-blocking Multi-reader</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Database File Size</span>
                <span className="font-mono text-slate-200 font-semibold">{stats?.storage?.dbSizeKB ? `${stats.storage.dbSizeKB} KB` : 'Active'}</span>
              </div>
            </div>
          </div>

          {/* Real-Time Live Transaction Log Stream */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Live Real-Time Event Stream (Reactive Bus)
              </h3>
              <span className="text-[11px] text-emerald-400/80 font-mono">
                Listening for INSERT / UPDATE / DELETE
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs max-h-60 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <div className="text-slate-500 text-center py-6 text-xs font-sans">
                  No mutations captured in current session yet. Create an account, submit a ticket, or add feedback to observe live events!
                </div>
              ) : (
                history.map((evt, idx) => {
                  const isInsert = evt.type === 'INSERT';
                  const isUpdate = evt.type === 'UPDATE';
                  const isDelete = evt.type === 'DELETE';
                  const badgeColor = isInsert
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60'
                    : isUpdate
                    ? 'bg-amber-950 text-amber-400 border-amber-700/60'
                    : 'bg-rose-950 text-rose-400 border-rose-700/60';

                  const timeStr = evt.timestamp
                    ? new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Just now';

                  return (
                    <div
                      key={evt.id || idx}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start gap-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${badgeColor}`}>
                          {evt.type}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {evt.table}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-xs truncate">
                          {safeString(evt.summary || JSON.stringify(evt.record))}
                        </p>
                      </div>

                      <span className="text-[10px] text-slate-500 flex-shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeStr}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 border-t border-slate-800 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Database Status: <strong>Operational (Normal)</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
