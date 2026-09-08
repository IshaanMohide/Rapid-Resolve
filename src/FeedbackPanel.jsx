import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Star, Send, MessageSquare, AlertTriangle, CheckCircle2,
  ThumbsUp, User, FileText
} from 'lucide-react';
import { safeString } from './utils.js';

const API_BASE = '/api';

function formatFeedbackDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  } catch {
    return '';
  }
}

function StarRating({ rating, onRate, interactive = true, size = 'md' }) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={`transition-all duration-200 ${
            interactive ? 'cursor-pointer hover:scale-125 active:scale-95' : 'cursor-default'
          }`}
        >
          <Star
            className={`${sizeClass} transition-all duration-200 ${
              star <= (hovered || rating)
                ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                : 'text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPanel({ ticketId, ticketStatus }) {
  const [feedbackList, setFeedbackList] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchFeedback = async () => {
    if (!ticketId) return;
    try {
      const res = await axios.get(`${API_BASE}/tickets/${ticketId}/feedback`, { timeout: 4000 });
      if (res.data?.success) {
        setFeedbackList(res.data.feedback || []);
        setAvgRating(res.data.avgRating);
        setTotalFeedback(res.data.total || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch feedback:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [ticketId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newRating === 0) {
      setError('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let userId = null;
      try {
        const userStr = sessionStorage.getItem('rapidresolve_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          userId = user.id;
        }
      } catch {}

      const res = await axios.post(`${API_BASE}/tickets/${ticketId}/feedback`, {
        rating: newRating,
        comment: newComment.trim() || undefined,
        user_id: userId
      }, { timeout: 5000 });

      if (res.data?.success) {
        setSubmitSuccess(true);
        setNewRating(0);
        setNewComment('');
        fetchFeedback();
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
    } catch (err) {
      const raw = err.response?.data?.error || err.response?.data || err.message;
      setError(safeString(raw, 'Failed to submit feedback.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden anim-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Customer Feedback</h3>
            <p className="text-[11px] text-slate-500">Rate your experience with this complaint resolution</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {avgRating !== null && (
            <div className="flex items-center gap-2 bg-white border border-amber-200 px-3 py-1.5 rounded-xl">
              <StarRating rating={Math.round(avgRating)} interactive={false} size="sm" />
              <span className="text-xs font-bold text-amber-800">{avgRating}</span>
              <span className="text-[10px] text-slate-500">({totalFeedback})</span>
            </div>
          )}
          <a
            href="/api/feedback/export"
            download="RapidResolve_Customer_Feedback.csv"
            className="inline-flex items-center gap-1 bg-white hover:bg-amber-100/60 border border-amber-200 text-amber-900 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition shadow-2xs hover:scale-105"
            title="Download feedback records spreadsheet (Excel / CSV)"
          >
            <FileText className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Excel / CSV</span>
          </a>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Submit Feedback Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
              Your Rating
            </label>
            <StarRating rating={newRating} onRate={setNewRating} interactive={true} size="lg" />
            {newRating > 0 && (
              <span className="text-[11px] text-amber-700 font-semibold mt-1 inline-block anim-fade-in">
                {newRating === 1 ? 'Poor' : newRating === 2 ? 'Fair' : newRating === 3 ? 'Good' : newRating === 4 ? 'Very Good' : 'Excellent!'}
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
              Comment <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your experience with the resolution process..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition resize-none"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 anim-fade-in">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{safeString(error)}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 anim-fade-in-up">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Thank you! Your feedback has been recorded.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || newRating === 0}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Submit Feedback</span>
          </button>
        </form>

        {/* Existing Feedback List */}
        {feedbackList.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5" />
              Previous Feedback ({feedbackList.length})
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {feedbackList.map((fb, idx) => (
                <div
                  key={fb.id || idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 anim-fade-in-up hover:border-slate-300 transition"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-bold">
                        {fb.user_name && typeof fb.user_name === 'string' ? fb.user_name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                      </div>
                      <span className="text-xs font-semibold text-slate-800">
                        {safeString(fb.user_name, 'Anonymous Citizen')}
                      </span>
                    </div>
                    <StarRating rating={Number(fb.rating) || 5} interactive={false} size="sm" />
                  </div>
                  {fb.comment && (
                    <p className="text-xs text-slate-600 leading-relaxed pl-8">
                      "{safeString(fb.comment)}"
                    </p>
                  )}
                  <div className="text-[10px] text-slate-400 pl-8">
                    {formatFeedbackDate(fb.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
