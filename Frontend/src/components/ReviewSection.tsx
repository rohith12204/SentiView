import { useState, useEffect, useCallback } from 'react';
import {
  Star, AlertTriangle, CheckCircle, Trash2,
  ChevronDown, ChevronUp, Database, User, Filter, Zap
} from 'lucide-react';
import { fetchAllReviews, submitReview } from '../services/productApi';
import { useAuth } from '../context/AuthContext';

// ── Raw shape coming from the backend CSV rows / all_reviews endpoint ────────
interface RawReview {
  id: number | string;
  // Backend uses "review_text", not "body"
  review_text: string;
  // Backend uses reviewer name column – adjust to your CSV column name
  reviewer?: string;
  reviewer_name?: string;
  username?: string;
  user?: string;
  rating: number;
  // Backend stores title in "review_title" or "title"
  review_title?: string;
  title?: string;
  sentiment: string;
  // Backend stores 0/1 integer, not boolean
  is_fake: 0 | 1 | boolean | null;
  // Backend stores 0–100 float, not 0–1
  fake_confidence?: number | null;
  // fake_signals is a dict of { signal_name: bool } from fake_detector, or
  // a pre-serialised list of active signal names — handle both
  fake_signals?: Record<string, boolean> | string[] | null;
  review_date?: string;
  date?: string;
  created_at?: string;
  country?: string;
  verified?: boolean;
  // source is NOT in CSV rows — we derive it
  source?: 'dataset' | 'user';
}

// ── Normalised shape the component works with internally ─────────────────────
interface Review {
  id: number | string;
  source: 'dataset' | 'user';
  user: string;
  rating: number;
  title: string;
  body: string;
  sentiment: string;
  is_fake: boolean;
  fake_confidence: number | null;   // 0–100, displayed as percentage
  fake_score: number | null;        // count of active signals (computed)
  fake_signals: string[];           // human-readable signal labels
  created_at: string;
  country: string;
  verified: boolean;
}

interface Stats {
  total: number;
  user_reviews: number;
  csv_reviews: number;
  fake_count: number;
  genuine_count: number;
  fake_pct: number;
  genuine_pct: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
}

interface Props { productId: number; productName: string; }

// ── Human-readable labels for signal keys coming from fake_detector ──────────
const SIGNAL_LABELS: Record<string, string> = {
  promotional:        'Promotional',
  spam_content:       'Spam / Links',
  gift_incentive:     'Incentivized',
  rating_mismatch:    'Rating Mismatch',
  hollow_generic:     'Hollow / Generic',
  imperative_push:    'Imperative Push',
  platform_address:   'Platform Addressed',
  competitor_attack:  'Competitor Attack',
  robotic_repetition: 'Robotic Repetition',
};

// ── Normalise a raw API row into the internal Review shape ───────────────────
function normaliseReview(raw: RawReview): Review {
  // 1. Resolve display name (try multiple possible column names)
  const user =
    raw.user ??
    raw.reviewer ??
    raw.reviewer_name ??
    raw.username ??
    'Anonymous';

  // 2. Resolve review body
  const body = raw.review_text ?? '';

  // 3. Resolve title
  const title = raw.title ?? raw.review_title ?? '';

  // 4. is_fake: backend sends 0/1 integer; coerce to boolean
  const is_fake = raw.is_fake === 1 || raw.is_fake === true;

  // 5. fake_confidence: backend sends 0–100; keep as-is for display
  //    (the OLD component multiplied by 100 thinking it was 0–1 — remove that)
  const fake_confidence =
    raw.fake_confidence != null ? raw.fake_confidence : null;

  // 6. fake_signals: backend may send either
  //      a) dict: { hollow_generic: true, spam_content: false, … }
  //      b) list of active key strings: ["hollow_generic", "spam_content"]
  //    Normalise to human-readable string[]
  let fake_signals: string[] = [];
  if (Array.isArray(raw.fake_signals)) {
    // Case (b): already a list of key strings
    fake_signals = raw.fake_signals.map(
      (k) => SIGNAL_LABELS[k] ?? k
    );
  } else if (raw.fake_signals && typeof raw.fake_signals === 'object') {
    // Case (a): dict — keep only truthy entries
    fake_signals = Object.entries(raw.fake_signals)
      .filter(([, v]) => v === true)
      .map(([k]) => SIGNAL_LABELS[k] ?? k);
  }

  // 7. fake_score: count of active signals (not in backend, computed here)
  const fake_score = is_fake ? fake_signals.length : null;

  // 8. source: CSV rows won't have this field; default to 'dataset'
  const source = raw.source ?? 'dataset';

  // 9. created_at: try multiple column names
  const created_at = raw.created_at ?? raw.review_date ?? raw.date ?? '';

  return {
    id: raw.id,
    source,
    user,
    rating: raw.rating ?? 0,
    title,
    body,
    sentiment: raw.sentiment ?? 'Neutral',
    is_fake,
    fake_confidence,
    fake_score,
    fake_signals,
    created_at,
    country: raw.country ?? '',
    verified: raw.verified ?? false,
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────

const StarRating = ({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => !readonly && onChange?.(s)}
        className={`transition ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
      >
        <Star
          size={readonly ? 13 : 22}
          className={s <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
        />
      </button>
    ))}
  </div>
);

const sentimentClass = (s: string) =>
  ({
    Positive:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    Negative:
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  }[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300');

// ── Main component ───────────────────────────────────────────────────────────

export default function ReviewSection({ productId, productName }: Props) {
  const { user, isAuthenticated, token } = useAuth();

  const [reviews, setReviews]   = useState<Review[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showAll, setShowAll]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [filterShow, setFilterShow]           = useState('all');

  // Form
  const [rating, setRating]           = useState(0);
  const [title, setTitle]             = useState('');
  const [body, setBody]               = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async () => {
    if (!productName) return; // safety check
  
    setLoading(true);
  
    try {
      // ✅ CLEAN NAME (CRITICAL)
      const cleanName = productName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
  
      console.log("Fetching reviews for:", cleanName);
  
      const data = await fetchAllReviews(productId, {
        name: cleanName,           // ✅ FIXED
        sentiment: filterSentiment,
        show: filterShow,
      });
  
      // ✅ NORMALISE DATA
      const rawRows: RawReview[] = data.reviews ?? [];
  
      console.log("Reviews received:", rawRows.length);
  
      setReviews(rawRows.map(normaliseReview));
      setStats(data.stats ?? null);
  
    } catch (err) {
      console.error("Failed to load reviews:", err);
  
      setReviews([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [
    productId,
    productName,        // ✅ CRITICAL FIX
    filterSentiment,
    filterShow
  ]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!rating)      { setSubmitError('Please select a star rating.'); return; }
    if (!body.trim()) { setSubmitError('Please write a review.'); return; }
    if (!token)       { setSubmitError('You must be signed in.'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      await submitReview(productId, { rating, title, body }, token);
      setRating(0); setTitle(''); setBody('');
      setShowForm(false);
      await load();
    } catch {
      setSubmitError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // FIX: apply client-side filters so the dropdown actually works.
  // The backend all_reviews endpoint does not filter by sentiment/show params,
  // so we filter the normalised reviews array here instead.
  const visibleReviews = reviews.filter(r => {
    if (filterSentiment !== 'all' && r.sentiment !== filterSentiment) return false;
    if (filterShow === 'genuine' && r.is_fake) return false;
    if (filterShow === 'fake'    && !r.is_fake) return false;
    return true;
  });

  return (
    <div className="mt-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Customer Reviews
          </h3>
          {stats && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {/* {stats.total} reviews */}
            </p>
          )}
        </div>
        {isAuthenticated && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Stats bar */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Positive',       pct: stats.positive_pct, color: 'bg-emerald-500' },
            { label: 'Negative',       pct: stats.negative_pct, color: 'bg-rose-500'    },
            { label: 'Neutral',        pct: stats.neutral_pct,  color: 'bg-slate-400'   },
            { label: 'Suspected Fake', pct: stats.fake_pct,     color: 'bg-amber-500'   },
          ].map(({ label, pct, color }) => (
            <div
              key={label}
              className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700 shadow-sm"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{pct}%</p>
              <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <Filter size={14} className="text-gray-400" />
        <select
          value={filterSentiment}
          onChange={(e) => { setFilterSentiment(e.target.value); setShowAll(false); }}
          className="text-xs px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="all">All Sentiment</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
          <option value="Negative">Negative</option>
        </select>
        <select
          value={filterShow}
          onChange={(e) => { setFilterShow(e.target.value); setShowAll(false); }}
          className="text-xs px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="all">All Reviews</option>
          <option value="genuine">Genuine Only</option>
          <option value="fake">Suspected Fake</option>
        </select>
        {(filterSentiment !== 'all' || filterShow !== 'all') && (
          <button
            onClick={() => { setFilterSentiment('all'); setFilterShow('all'); }}
            className="text-xs text-indigo-500 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Write Review Form */}
      {showForm && (
        <div className="bg-indigo-50 dark:bg-slate-800/60 border border-indigo-100 dark:border-slate-700 rounded-2xl p-5 mb-5">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Your Review for <span className="text-indigo-600">{productName}</span>
          </h4>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rating *
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title (optional)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarise your experience"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Review *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="What did you like or dislike?"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
          {submitError && <p className="text-sm text-rose-600 mb-3">{submitError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
            <button
              onClick={() => { setShowForm(false); setSubmitError(''); }}
              className="px-5 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <Star size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No reviews match the current filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleReviews.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                r.is_fake
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10'
                  : r.source === 'user'
                  ? 'border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-900/10'
                  : 'border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-800/60'
              }`}
            >
              <div className="flex items-start gap-3">

                {/* Source icon */}
                <div
                  className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                    r.source === 'user'
                      ? 'bg-indigo-100 dark:bg-indigo-900/40'
                      : 'bg-gray-100 dark:bg-slate-700'
                  }`}
                >
                  {r.source === 'user'
                    ? <User size={12} className="text-indigo-600 dark:text-indigo-400" />
                    : <Database size={12} className="text-gray-500 dark:text-gray-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  {/* Top row */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {r.user}
                    </span>
                    {r.country && (
                      <span className="text-xs text-gray-400">{r.country}</span>
                    )}
                    <StarRating value={r.rating} readonly />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentClass(r.sentiment)}`}>
                      {r.sentiment}
                    </span>

                    {/* Fake / Genuine badge */}
                    {r.is_fake ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <AlertTriangle size={10} /> Suspected Fake
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <CheckCircle size={10} /> Genuine
                      </span>
                    )}
                  </div>

                  {/* Title + body */}
                  {r.title && (
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-0.5">
                      {r.title}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {r.body}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span>{r.created_at ? r.created_at.split('T')[0] : ''}</span>
                    {r.verified && <span className="text-emerald-500">✓ Verified</span>}
                    {r.is_fake && r.fake_confidence !== null && (
                      <span className="text-amber-500">
                        {/* fake_confidence is already 0–100 from backend — display directly */}
                        Fake confidence: {Math.round(r.fake_confidence ?? 0)}%
                        {r.fake_score != null && ` · ${r.fake_score} signal${r.fake_score !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>

                  {/* Active signal tags */}
                  {r.is_fake && r.fake_signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.fake_signals.map((sig: string, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                                     bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300
                                     border border-amber-200 dark:border-amber-800/40"
                        >
                          <Zap size={8} />{sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete button for own reviews */}
                {isAuthenticated && r.source === 'user' && user?.username === r.user && (
                  <button
                    onClick={async () => {
                      if (!token || !confirm('Delete your review?')) return;
                      const { deleteReview } = await import('../services/productApi');
                      await deleteReview(productId, r.id as number, token);
                      await load();
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-500 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {reviews.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {showAll
                ? <><ChevronUp size={16} /> Show less</>
                : <><ChevronDown size={16} /> Show all  reviews</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}