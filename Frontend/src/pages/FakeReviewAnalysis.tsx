import { useState, useEffect } from 'react';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2,
  Smile, Meh, Frown, BarChart2, Search, RefreshCw,
  Database, User, Zap, Star, ChevronDown, ChevronUp,
  Info
} from 'lucide-react';
import { fetchProducts, fetchAllReviews, detectFakeReview } from '../services/productApi';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// Raw shape returned by the backend all_reviews endpoint
interface RawReview {
  id: number | string;
  review_text?: string;
  body?: string;
  reviewer?: string;
  reviewer_name?: string;
  username?: string;
  user?: string;
  rating: number;
  review_title?: string;
  title?: string;
  sentiment: string;
  is_fake: 0 | 1 | boolean | null;
  fake_confidence?: number | null;
  fake_signals?: Record<string, boolean> | string[] | null;
  review_date?: string;
  date?: string;
  created_at?: string;
  country?: string;
  verified?: boolean;
  source?: 'dataset' | 'user';
}

// Normalised shape the component works with
interface Review {
  id: number | string;
  source: 'dataset' | 'user';
  user: string;
  rating: number;
  title: string;
  body: string;
  sentiment: string;
  is_fake: boolean;
  fake_confidence: number | null;
  fake_score: number | null;
  fake_signals: string[];
  created_at: string;
  country: string;
  verified: boolean;
}

interface Analysis {
  product: string;
  stats: Stats;
  reviews: Review[];
}

interface SingleResult {
  is_fake: boolean;
  confidence: number;
  label: string;
  fake_type: string | null;
  reasons: string[];
  risk_score: number;
  signals: Record<string, boolean>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_SHOWN = 8;

const SIGNAL_LABELS: Record<string, string> = {
  promotional:        'Promotional Language',
  spam_content:       'Spam / Contact Info',
  gift_incentive:     'Gift / Incentive',
  rating_mismatch:    'Rating–Sentiment Mismatch',
  hollow_generic:     'Hollow Generic Review',
  imperative_push:    'Imperative Push Language',
  platform_address:   'Platform-Addressed Review',
  competitor_attack:  'Competitor Attack / Troll',
  robotic_repetition: 'Robotic Repetition',
  genuine_signals:    'Genuine Experience Signals',
};

// ─── Normalise raw backend row → internal Review shape ───────────────────────
// Mirrors the same logic in ReviewSection.tsx so behaviour is consistent.
function normaliseReview(raw: RawReview): Review {
  const user =
    raw.user ??
    raw.reviewer ??
    raw.reviewer_name ??
    raw.username ??
    'Anonymous';

  const body = raw.review_text ?? raw.body ?? '';
  const title = raw.title ?? raw.review_title ?? '';
  const is_fake = raw.is_fake === 1 || raw.is_fake === true;
  const fake_confidence = raw.fake_confidence != null ? raw.fake_confidence : null;

  // fake_signals can be either a dict or an array of active key strings
  let fake_signals: string[] = [];
  if (Array.isArray(raw.fake_signals)) {
    fake_signals = raw.fake_signals.map((k) => SIGNAL_LABELS[k] ?? k);
  } else if (raw.fake_signals && typeof raw.fake_signals === 'object') {
    fake_signals = Object.entries(raw.fake_signals)
      .filter(([, v]) => v === true)
      .map(([k]) => SIGNAL_LABELS[k] ?? k);
  }

  const fake_score = is_fake ? fake_signals.length : null;
  const source = raw.source ?? 'dataset';
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

const DonutRing = ({ fake, genuine }: { fake: number; genuine: number }) => {
  const r = 52, cx = 64, cy = 64, circ = 2 * Math.PI * r;
  const genDash  = (genuine / 100) * circ;
  const fakeDash = (fake / 100) * circ;
  return (
    <svg viewBox="0 0 128 128" className="w-36 h-36">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#34d399" strokeWidth="14"
        strokeDasharray={`${genDash} ${circ - genDash}`} strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth="14"
        strokeDasharray={`${fakeDash} ${circ - fakeDash}`}
        strokeDashoffset={`${-genDash}`}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x="50%" y="48%" dominantBaseline="middle" textAnchor="middle"
        fontSize="18" fontWeight="bold" fill="currentColor"
        className="fill-gray-900 dark:fill-white">
        {fake}%
      </text>
      <text x="50%" y="63%" dominantBaseline="middle" textAnchor="middle"
        fontSize="8" fill="#9ca3af">Fake</text>
    </svg>
  );
};

const SentimentBar = ({
  label, pctVal, color, icon: Icon,
}: { label: string; pctVal: number; color: string; icon: any }) => (
  <div className="flex items-center gap-3">
    <Icon size={15} className={color} />
    <span className="text-xs w-16 text-gray-600 dark:text-gray-200">{label}</span>
    <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-600 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
        style={{ width: `${pctVal}%`, transition: 'width 1s ease' }}
      />
    </div>
    <span className="text-xs font-semibold text-gray-700 dark:text-white w-10 text-right">{pctVal}%</span>
  </div>
);

const sentimentBadge = (s: string) => ({
  Positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  Neutral:  'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-200',
  Negative: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
}[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-200');

const SignalPills = ({ signals }: { signals: string[] }) => {
  if (!signals?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {signals.map((sig, i) => (
        <span key={i}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                     bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200
                     border border-amber-200 dark:border-amber-700">
          <Zap size={9} />{sig}
        </span>
      ))}
    </div>
  );
};

const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={10} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-500'} />
    ))}
  </span>
);

const confidenceColor = (c: number) =>
  c >= 70  ? 'text-rose-600 dark:text-rose-400'
  : c >= 40 ? 'text-amber-500 dark:text-amber-300'
  : 'text-emerald-600 dark:text-emerald-400';

const confidenceBgClass = (c: number) =>
  c >= 70  ? 'bg-rose-500'
  : c >= 40 ? 'bg-amber-500'
  : 'bg-emerald-500';

// ─── Review Card ─────────────────────────────────────────────────────────────

function ReviewCard({ r, isFake }: { r: Review; isFake: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${
      isFake
        ? 'bg-white dark:bg-slate-800 border-amber-100 dark:border-amber-800/40'
        : 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-800/40'
    }`}>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {r.source === 'user'
            ? <User size={11} className="text-indigo-400" />
            : <Database size={11} className="text-gray-400 dark:text-gray-500" />}
          <span className="font-semibold text-sm text-gray-900 dark:text-white">{r.user}</span>
          {r.country && <span className="text-xs text-gray-400">{r.country}</span>}
          <Stars rating={r.rating} />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentBadge(r.sentiment)}`}>
            {r.sentiment}
          </span>
          {!isFake && r.verified && (
            <span className="text-xs text-emerald-500 dark:text-emerald-400">✓ Verified</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            r.source === 'user'
              ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
          }`}>
            {r.source === 'user' ? 'User' : 'User'}
          </span>
        </div>
        {isFake && r.fake_confidence !== null && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
            {Math.round(r.fake_confidence ?? 0)}% confidence
          </span>
        )}
      </div>
      {r.title && <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-1">{r.title}</p>}
      {/* FIX: render r.body (normalised field), not r.review_text */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{r.body}</p>
      {r.created_at && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          {r.created_at.split('T')[0] || r.created_at}
        </p>
      )}
      {isFake && <SignalPills signals={r.fake_signals} />}
    </div>
  );
}

// ─── Expandable Review List ───────────────────────────────────────────────────

function ReviewList({ reviews, isFake, emptyText }: {
  reviews: Review[];
  isFake: boolean;
  emptyText?: string;
}) {
  const [shown, setShown] = useState(INITIAL_SHOWN);
  const visible   = reviews.slice(0, shown);
  const remaining = reviews.length - shown;
  const allShown  = shown >= reviews.length;

  if (reviews.length === 0) {
    return emptyText ? <p className="text-sm text-gray-400 italic text-center py-4">{emptyText}</p> : null;
  }

  return (
    <div className="space-y-3">
      {visible.map(r => <ReviewCard key={r.id} r={r} isFake={isFake} />)}

      {reviews.length > INITIAL_SHOWN && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {!allShown && (
            <>
              <button
                onClick={() => setShown(s => Math.min(s + 10, reviews.length))}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  isFake
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                }`}
              >
                <ChevronDown size={15} />
                Show 10 more
                <span className="opacity-60 font-normal">({remaining} left)</span>
              </button>
              <button
                onClick={() => setShown(reviews.length)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                           bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300
                           hover:bg-indigo-200 transition"
              >
                Show all {reviews.length}
              </button>
            </>
          )}
          {allShown && reviews.length > INITIAL_SHOWN && (
            <button
              onClick={() => setShown(INITIAL_SHOWN)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                         bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300
                         hover:bg-gray-200 transition"
            >
              <ChevronUp size={15} />
              Show less
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-center text-gray-400 dark:text-gray-500">
        Showing {Math.min(shown, reviews.length)} of {reviews.length} {isFake ? 'suspected fake' : 'genuine'} reviews
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FakeReviewAnalysis() {
  const [tab, setTab] = useState<'product' | 'single'>('product');

  const [products, setProducts]             = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [selectedId, setSelectedId]         = useState<number | null>(null);
  const [analysis, setAnalysis]             = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError]   = useState('');
  const [reviewTab, setReviewTab]           = useState<'all' | 'fake' | 'genuine'>('all');

  const [singleText, setSingleText]     = useState('');
  const [singleRating, setSingleRating] = useState<number>(0);
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const [checkingOne, setCheckingOne]   = useState(false);

  // ── Load product list from store API ──────────────────────────────────────
  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setProductsLoaded(true));
  }, []);

  // ── Product analysis ──────────────────────────────────────────────────────
  const runProductAnalysis = async () => {
    if (!selectedId) { setAnalysisError('Please select a product.'); return; }
    setAnalysisError('');
    setLoadingAnalysis(true);
    setAnalysis(null);
    setReviewTab('all');

    try {
      const selectedProduct = products.find(p => p.id === selectedId);

      // FIX: strip brand prefix variants — store product name is e.g. "Google Pixel 7a"
      // The analytics all_reviews endpoint matches against `brand + " " + model` from the CSV.
      // Pass the full store product name as-is; the backend does a `.str.contains()` match.
      const productName = selectedProduct?.name ?? '';

      const data = await fetchAllReviews(selectedId, {
        name: productName,
        limit: 10000,
        show: 'all',
      });

      // FIX: normalise raw backend rows → internal Review shape so r.body / r.user etc. work
      const rawRows: RawReview[] = data.reviews ?? [];
      const normalisedReviews: Review[] = rawRows.map(normaliseReview);

      // Re-compute stats from normalised data (stats from backend should already be correct,
      // but we override counts to match what is actually displayed)
      const stats: Stats = data.stats ?? {
        total: normalisedReviews.length,
        user_reviews: 0,
        csv_reviews: normalisedReviews.length,
        fake_count: 0,
        genuine_count: normalisedReviews.length,
        fake_pct: 0,
        genuine_pct: 100,
        positive_pct: 0,
        neutral_pct: 0,
        negative_pct: 0,
      };

      setAnalysis({
        product: productName,
        stats,
        reviews: normalisedReviews,
      });
    } catch (err) {
      console.error('runProductAnalysis error:', err);
      setAnalysisError('Could not load reviews. Make sure the backend is running.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // ── Single review check ───────────────────────────────────────────────────
  const runSingleCheck = async () => {
    if (!singleText.trim()) return;
    setCheckingOne(true);
    setSingleResult(null);
    try {
      const res = await detectFakeReview(singleText, singleRating > 0 ? singleRating : undefined);
      setSingleResult({
        is_fake:    res.is_fake,
        confidence: res.confidence,       // already 0–100, no ×100 needed
        label:      res.label ?? (res.is_fake ? 'Fake' : 'Genuine'),
        fake_type:  res.fake_type ?? null,
        reasons:    res.reasons ?? [],
        risk_score: res.risk_score ?? 0,
        signals:    res.signals ?? {},
      });
    } catch {
      setSingleResult(null);
    } finally {
      setCheckingOne(false);
    }
  };

  const allReviews     = analysis?.reviews ?? [];
  const fakeReviews    = allReviews.filter(r => r.is_fake);
  const genuineReviews = allReviews.filter(r => !r.is_fake);

  const countTriggeredSignals = (signals: Record<string, boolean>) =>
    Object.entries(signals).filter(([k, v]) => v && k !== 'genuine_signals').length;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
              <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Fake Review Analysis</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-300">
            Risk score ≥ 40 → flagged as fake.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {(['product', 'single'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}>
              {t === 'product' ? 'Product Analysis' : 'Single Review Check'}
            </button>
          ))}
        </div>

        {/* ── Tab: Product Analysis ── */}
        {tab === 'product' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Select a Product</h3>
              {!productsLoaded ? (
                <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />
              ) : (
                <div className="flex gap-3 flex-wrap">
                  <select value={selectedId ?? ''}
                    onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 min-w-48 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl
                               bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm">
                    <option value="">— choose a product —</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button onClick={runProductAnalysis} disabled={!selectedId || loadingAnalysis}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50
                               text-white text-sm font-semibold rounded-xl transition flex items-center gap-2">
                    {loadingAnalysis
                      ? <><RefreshCw size={14} className="animate-spin" /> Analysing…</>
                      : <><Search size={14} /> Analyse Reviews</>}
                  </button>
                </div>
              )}
              {analysisError && <p className="text-sm text-rose-500 dark:text-rose-400 mt-3">{analysisError}</p>}
            </div>

            {loadingAnalysis && (
              <div className="space-y-4 animate-pulse">
                <div className="h-24 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-2xl" />)}
                </div>
                <div className="h-40 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
              </div>
            )}

            {analysis && !loadingAnalysis && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Results for <span className="text-amber-600 dark:text-amber-400">{analysis.product}</span>
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Reviews',  value: analysis.stats.total,          color: 'text-indigo-500 dark:text-indigo-400' },
                    { label: 'Suspected Fake', value: analysis.stats.fake_count,     color: 'text-amber-600 dark:text-amber-400'  },
                    { label: 'Genuine',        value: analysis.stats.genuine_count,  color: 'text-emerald-600 dark:text-emerald-400'},
                    { label: 'Fake %',         value: `${analysis.stats.fake_pct}%`, color: 'text-rose-500 dark:text-rose-400'   },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">{label}</p>
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm flex flex-col items-center justify-center">
                    <DonutRing fake={analysis.stats.fake_pct} genuine={analysis.stats.genuine_pct} />
                    <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                        Genuine {analysis.stats.genuine_pct}%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                        Fake {analysis.stats.fake_pct}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <BarChart2 size={16} className="text-indigo-500" /> Sentiment Breakdown
                    </h4>
                    <div className="space-y-3">
                      <SentimentBar label="Positive" pctVal={analysis.stats.positive_pct} color="text-emerald-500" icon={Smile} />
                      <SentimentBar label="Neutral"  pctVal={analysis.stats.neutral_pct}  color="text-slate-400"   icon={Meh}   />
                      <SentimentBar label="Negative" pctVal={analysis.stats.negative_pct} color="text-rose-500"    icon={Frown} />
                    </div>
                  </div>
                </div>

                {/* All Reviews panel with tabs */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-gray-100 dark:border-slate-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      All Reviews
                      <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
                        ({allReviews.length} total)
                      </span>
                    </h3>
                    <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 self-start sm:self-auto">
                      {([
                        { key: 'all',     label: `All (${allReviews.length})` },
                        { key: 'genuine', label: `✅ Genuine (${genuineReviews.length})` },
                        { key: 'fake',    label: `⚠️ Fake (${fakeReviews.length})` },
                      ] as const).map(({ key, label }) => (
                        <button key={key} onClick={() => setReviewTab(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            reviewTab === key
                              ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-5">
                    {reviewTab === 'all' && (
                      <ReviewList reviews={allReviews} isFake={false} emptyText="No reviews found." />
                    )}
                    {reviewTab === 'fake' && (
                      fakeReviews.length === 0
                        ? <p className="text-sm text-center text-gray-400 italic py-6">No suspected fake reviews found.</p>
                        : (
                          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50">
                              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                              <span className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                                {fakeReviews.length} Suspected Fake Reviews
                              </span>
                            </div>
                            <div className="p-4">
                              <ReviewList reviews={fakeReviews} isFake={true} />
                            </div>
                          </div>
                        )
                    )}
                    {reviewTab === 'genuine' && (
                      genuineReviews.length === 0
                        ? <p className="text-sm text-center text-gray-400 italic py-6">No genuine reviews found.</p>
                        : (
                          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/50">
                              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                              <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                                {genuineReviews.length} Genuine Reviews
                              </span>
                            </div>
                            <div className="p-4">
                              <ReviewList reviews={genuineReviews} isFake={false} />
                            </div>
                          </div>
                        )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Single Review Check ── */}
        {tab === 'single' && (
          <div className="max-w-2xl">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Paste a Review</h3>

              <textarea value={singleText} onChange={e => setSingleText(e.target.value)} rows={5}
                placeholder="Paste any product review here…"
                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl
                           bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           text-sm resize-none mb-4" />

              {/* Optional star rating */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-300">Star rating :</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setSingleRating(singleRating === s ? 0 : s)}
                      className="transition hover:scale-110">
                      <Star size={20} className={s <= singleRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                    </button>
                  ))}
                </div>
                {singleRating > 0 && (
                  <button onClick={() => setSingleRating(0)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    clear
                  </button>
                )}
              </div>

              <button onClick={runSingleCheck} disabled={!singleText.trim() || checkingOne}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50
                           text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
                {checkingOne
                  ? <><RefreshCw size={14} className="animate-spin" /> Analysing…</>
                  : <><Search size={14} /> Analyse Review</>}
              </button>

              {/* ── Single check result ── */}
              {singleResult && (() => {
                const confPct  = Math.round(singleResult.confidence);
                const riskPct  = Math.round(singleResult.risk_score);
                const sigCount = countTriggeredSignals(singleResult.signals);

                // Active fake signal keys (exclude genuine_signals)
                const activeFakeKeys = Object.entries(singleResult.signals)
                  .filter(([k, v]) => v && k !== 'genuine_signals')
                  .map(([k]) => k);

                const genuineActive = singleResult.signals['genuine_signals'] === true;

                return (
                  <div className={`mt-6 rounded-2xl p-5 border ${
                    singleResult.is_fake
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700'
                  }`}>

                    {/* Verdict */}
                    <div className="flex items-start gap-3 mb-4">
                      {singleResult.is_fake
                        ? <AlertTriangle size={22} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        : <CheckCircle2  size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className={`font-bold text-lg ${
                            singleResult.is_fake
                              ? 'text-amber-700 dark:text-amber-200'
                              : 'text-emerald-700 dark:text-emerald-200'
                          }`}>
                            {singleResult.is_fake ? '⚠️ Suspected Fake Review' : '✅ Likely Genuine Review'}
                          </p>
                          {singleResult.fake_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium
                                             bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300
                                             border border-amber-200 dark:border-amber-700">
                              {singleResult.fake_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-300">
                          Confidence:&nbsp;
                          <span className={`font-semibold ${confidenceColor(confPct)}`}>
                            {confPct}%
                          </span>
                          &nbsp;·&nbsp;Risk score:&nbsp;
                          <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {riskPct}/100
                          </span>
                          {sigCount > 0 && (
                            <>&nbsp;·&nbsp;<span className="font-semibold text-amber-600 dark:text-amber-400">{sigCount} signal{sigCount !== 1 ? 's' : ''} triggered</span></>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="mb-5">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-300 mb-1">
                        <span>Confidence Level Low</span>
                        <span>Confidence Level High</span>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${confidenceBgClass(confPct)}`}
                          style={{ width: `${confPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0%</span>
                        <span className={`font-semibold ${confidenceColor(confPct)}`}>{confPct}%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* ── Signal breakdown ── */}
                    {activeFakeKeys.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-amber-500" />
                          Triggered fake signals ({activeFakeKeys.length}):
                        </p>
                        <div className="space-y-1.5">
                          {activeFakeKeys.map(key => {
                            // Find matching reason string for this signal
                            const matchedReason = singleResult.reasons.find(r =>
                              r.toLowerCase().includes(key.replace(/_/g, ' ').split(' ')[0])
                            );
                            return (
                              <div key={key}
                                className="flex items-start gap-2 p-2.5 rounded-lg
                                           bg-amber-50 dark:bg-amber-950/30
                                           border border-amber-200 dark:border-amber-800/50">
                                <Zap size={11} className="mt-0.5 shrink-0 text-amber-500" />
                                <div>
                                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    {SIGNAL_LABELS[key] ?? key}
                                  </p>
                                  {matchedReason && (
                                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                                      {matchedReason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Genuine signal indicator */}
                    {genuineActive && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg
                                      bg-emerald-50 dark:bg-emerald-950/30
                                      border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            Genuine Experience Signals
                          </p>
                          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                            Review contains real usage patterns (time references, specific features, personal experience)
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>

            {/* How it works */}
            <div className="mt-5 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 p-5 text-sm text-indigo-700 dark:text-indigo-300">
              <p className="font-semibold mb-3 flex items-center gap-2">
                <Info size={14} /> How the 9-signal pipeline works
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5 text-xs opacity-90">
                {[
                  { key: 'promotional',        desc: 'Promo language — discount codes, buy now, referral links' },
                  { key: 'spam_content',        desc: 'Spam / Contact info — URLs, emails, phone numbers, social handles' },
                  { key: 'gift_incentive',      desc: 'Gift / Incentive — "got this free", "sponsored", "pr sample"' },
                  { key: 'rating_mismatch',     desc: 'Rating–Sentiment mismatch — 1★ + positive text / 5★ + negative text' },
                  { key: 'hollow_generic',      desc: 'Hollow generic positive — superlatives, no real usage detail' },
                  { key: 'imperative_push',     desc: 'Imperative push language — "must buy", "just go for it"' },
                  { key: 'platform_address',    desc: 'Platform-addressed — "thank you Amazon", short bot pattern' },
                  { key: 'competitor_attack',   desc: 'Competitor attack / Troll — short 1★ with no real experience' },
                  { key: 'robotic_repetition',  desc: 'Robotic repetition — repeated words or excessive superlatives' },
                ].map(({ key, desc }) => (
                  <div key={key} className="flex items-start gap-1.5">
                    <Zap size={9} className="mt-0.5 shrink-0" />
                    <span><strong>{SIGNAL_LABELS[key]}:</strong> {desc}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 font-semibold">Risk score ≥ 40 / 100 → Suspected Fake</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}