import { useState, useEffect } from 'react';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2,
  Smile, Meh, Frown, BarChart2, Search, RefreshCw, Info,
  Database, User
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

interface Review {
  id: number | string;
  source: 'dataset' | 'user';
  user: string;
  rating: number;
  title: string;
  body: string;
  sentiment: string;
  is_fake: boolean | null;
  fake_confidence: number | null;
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
        strokeDasharray={`${fakeDash} ${circ - fakeDash}`} strokeDashoffset={-genDash}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x="50%" y="48%" dominantBaseline="middle" textAnchor="middle"
        fontSize="18" fontWeight="bold" className="fill-gray-900 dark:fill-gray-100">{fake}%</text>
      <text x="50%" y="63%" dominantBaseline="middle" textAnchor="middle"
        fontSize="8" fill="#9ca3af">Fake</text>
    </svg>
  );
};

const SentimentBar = ({ label, pctVal, color, icon: Icon }: { label: string; pctVal: number; color: string; icon: any }) => (
  <div className="flex items-center gap-3">
    <Icon size={15} className={color} />
    <span className="text-xs w-16 text-gray-600 dark:text-gray-400">{label}</span>
    <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
        style={{ width: `${pctVal}%`, transition: 'width 1s ease' }} />
    </div>
    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-10 text-right">{pctVal}%</span>
  </div>
);

const sentimentClass = (s: string) => ({
  Positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Neutral:  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Negative: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}[s] ?? 'bg-slate-100 text-slate-600');

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FakeReviewAnalysis() {
  const [tab, setTab] = useState<'product' | 'single'>('product');

  // Product tab
  const [products, setProducts]         = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [analysis, setAnalysis]         = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError]     = useState('');

  // Single tab
  const [singleText, setSingleText]     = useState('');
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const [checkingOne, setCheckingOne]   = useState(false);

  // Load products once on mount
  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => {}).finally(() => setProductsLoaded(true));
  }, []);

  const runProductAnalysis = async () => {
    if (!selectedId) { setAnalysisError('Please select a product.'); return; }
    setAnalysisError('');
    setLoadingAnalysis(true);
    try {
      // Use all-reviews endpoint — merges CSV + user reviews with fake detection
      const data = await fetchAllReviews(selectedId, { limit: 60, show: 'all' });
      setAnalysis(data);
    } catch {
      setAnalysisError('Could not load reviews for this product.');
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const runSingleCheck = async () => {
    if (!singleText.trim()) return;
    setCheckingOne(true);
    setSingleResult(null);
    try {
      const res = await detectFakeReview(singleText);
      setSingleResult({ is_fake: res.is_fake, confidence: res.confidence });
    } catch { setSingleResult(null); }
    finally   { setCheckingOne(false); }
  };

  const confidenceColor = (c: number) =>
    c >= 0.7 ? 'text-rose-600' : c >= 0.4 ? 'text-amber-500' : 'text-emerald-500';

  // Derived from analysis
  const fakeReviews    = analysis?.reviews.filter(r => r.is_fake)    ?? [];
  const genuineReviews = analysis?.reviews.filter(r => !r.is_fake)   ?? [];
  const ratingDist     = analysis?.reviews.reduce<Record<string,number>>((acc, r) => {
    const k = String(r.rating); acc[k] = (acc[k] ?? 0) + 1; return acc;
  }, {}) ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-rose-500 rounded-2xl flex items-center justify-center shadow">
              <ShieldAlert size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fake Review Analysis</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Detect suspicious reviews from our dataset + user submissions, with full sentiment breakdown.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-1 w-fit shadow-sm">
          {[
            { id: 'product', label: 'Product Analysis', icon: BarChart2 },
            { id: 'single',  label: 'Check a Review',   icon: Search },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition ${
                tab === id ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* ── Product Analysis Tab ── */}
        {tab === 'product' && (
          <div>
            {/* Product selector */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select a Product</label>
              <div className="flex gap-3 flex-wrap">
                <select value={selectedId ?? ''} onChange={e => setSelectedId(Number(e.target.value) || null)}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">— Choose a product —</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={runProductAnalysis} disabled={loadingAnalysis || !selectedId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2">
                  {loadingAnalysis ? <RefreshCw size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                  Analyse
                </button>
              </div>
              {analysisError && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Info size={13} />{analysisError}
                </p>
              )}
            </div>

            {/* Results */}
            {analysis && (
              <div className="space-y-5">

                {/* Source info banner */}
                <div className="flex items-center gap-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl px-5 py-3 text-sm">
                  <Database size={16} className="text-indigo-500 shrink-0" />
                  <span className="text-indigo-700 dark:text-indigo-300">
                    <span className="font-semibold">{analysis.stats.csv_reviews}</span> reviews from dataset
                  </span>
                  <span className="text-indigo-300 dark:text-indigo-600">+</span>
                  <User size={16} className="text-indigo-500 shrink-0" />
                  <span className="text-indigo-700 dark:text-indigo-300">
                    <span className="font-semibold">{analysis.stats.user_reviews}</span> user-submitted reviews
                  </span>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Reviews',   value: analysis.stats.total,          color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20'  },
                    { label: 'Genuine',          value: analysis.stats.genuine_count,  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Suspected Fake',   value: analysis.stats.fake_count,     color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20'    },
                    { label: 'Fake Rate',         value: `${analysis.stats.fake_pct}%`, color: analysis.stats.fake_pct > 30 ? 'text-rose-600' : 'text-amber-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} rounded-2xl p-4`}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Donut + Sentiment side by side */}
                <div className="grid sm:grid-cols-2 gap-5">

                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm flex flex-col items-center">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 self-start">Authenticity Split</h3>
                    <DonutRing fake={analysis.stats.fake_pct} genuine={analysis.stats.genuine_pct} />
                    <div className="flex gap-6 mt-4 text-sm">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <div className="w-3 h-3 rounded-full bg-emerald-400" /> Genuine {analysis.stats.genuine_pct}%
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <div className="w-3 h-3 rounded-full bg-amber-400" /> Fake {analysis.stats.fake_pct}%
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Sentiment Breakdown</h3>
                    <div className="space-y-4">
                      <SentimentBar label="Positive" pctVal={analysis.stats.positive_pct} color="text-emerald-500" icon={Smile} />
                      <SentimentBar label="Neutral"  pctVal={analysis.stats.neutral_pct}  color="text-slate-400"   icon={Meh} />
                      <SentimentBar label="Negative" pctVal={analysis.stats.negative_pct} color="text-rose-500"    icon={Frown} />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Positive', pct: analysis.stats.positive_pct, c: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
                        { label: 'Neutral',  pct: analysis.stats.neutral_pct,  c: 'text-slate-600 bg-slate-50 dark:bg-slate-700' },
                        { label: 'Negative', pct: analysis.stats.negative_pct, c: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' },
                      ].map(({ label, pct, c }) => (
                        <div key={label} className={`rounded-xl p-2 ${c}`}>
                          <p className="text-lg font-bold">{pct}%</p>
                          <p className="text-xs font-medium mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rating distribution */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Rating Distribution</h3>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count  = ratingDist[String(star)] ?? 0;
                      const pctVal = analysis.stats.total > 0 ? Math.round(count / analysis.stats.total * 100) : 0;
                      return (
                        <div key={star} className="flex items-center gap-3 text-sm">
                          <span className="w-6 text-right text-gray-600 dark:text-gray-400">{star}★</span>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${star >= 4 ? 'bg-amber-400' : star === 3 ? 'bg-slate-400' : 'bg-rose-400'}`}
                              style={{ width: `${pctVal}%` }} />
                          </div>
                          <span className="w-10 text-right text-gray-500 dark:text-gray-400">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Suspected Fake Reviews */}
                {fakeReviews.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/40 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle size={18} className="text-amber-600" />
                      <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                        Suspected Fake Reviews ({fakeReviews.length})
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {fakeReviews.slice(0, 8).map(r => (
                        <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {r.source === 'user'
                                ? <User size={11} className="text-indigo-500" />
                                : <Database size={11} className="text-gray-400" />}
                              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{r.user}</span>
                              {r.country && <span className="text-xs text-gray-400">{r.country}</span>}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentClass(r.sentiment)}`}>{r.sentiment}</span>
                            </div>
                            <span className="text-xs text-amber-600 font-semibold">
                              Confidence: {Math.round((r.fake_confidence ?? 0) * 100)}%
                            </span>
                          </div>
                          {r.title && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{r.title}</p>}
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{r.body}</p>
                        </div>
                      ))}
                      {fakeReviews.length > 8 && (
                        <p className="text-xs text-center text-amber-600">+ {fakeReviews.length - 8} more suspected fake reviews</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Genuine sample */}
                {genuineReviews.length > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Sample Genuine Reviews ({genuineReviews.length} total)
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {genuineReviews.slice(0, 5).map(r => (
                        <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {r.source === 'user'
                              ? <User size={11} className="text-indigo-500" />
                              : <Database size={11} className="text-gray-400" />}
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{r.user}</span>
                            {r.country && <span className="text-xs text-gray-400">{r.country}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentClass(r.sentiment)}`}>{r.sentiment}</span>
                            {r.verified && <span className="text-xs text-emerald-500">✓ Verified</span>}
                          </div>
                          {r.title && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{r.title}</p>}
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ── Single Review Check Tab ── */}
        {tab === 'single' && (
          <div className="max-w-2xl">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Paste a Review</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Our heuristic engine analyses the text and flags potential fake signals.
              </p>
              <textarea value={singleText} onChange={e => setSingleText(e.target.value)} rows={5}
                placeholder="Paste any review text here..."
                className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mb-4" />
              <button onClick={runSingleCheck} disabled={checkingOne || !singleText.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow">
                {checkingOne ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                Analyse Review
              </button>

              {singleResult && (
                <div className={`mt-6 rounded-2xl p-5 border ${singleResult.is_fake
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40'
                  : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    {singleResult.is_fake
                      ? <AlertTriangle size={22} className="text-amber-600" />
                      : <CheckCircle2 size={22} className="text-emerald-600" />}
                    <div>
                      <p className={`font-bold text-lg ${singleResult.is_fake ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {singleResult.is_fake ? '⚠️ Suspected Fake Review' : '✅ Likely Genuine Review'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Confidence score: <span className={`font-semibold ${confidenceColor(singleResult.confidence)}`}>
                          {Math.round(singleResult.confidence * 100)}%
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Low risk</span><span>High risk</span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${
                        singleResult.confidence >= 0.7 ? 'bg-rose-500'
                        : singleResult.confidence >= 0.4 ? 'bg-amber-500'
                        : 'bg-emerald-500'}`}
                        style={{ width: `${Math.round(singleResult.confidence * 100)}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    {[
                      { range: '0–39%', label: 'Likely genuine', c: 'border-emerald-100 dark:border-emerald-900/40', t: 'text-emerald-600' },
                      { range: '40–69%', label: 'Suspicious',     c: 'border-amber-100 dark:border-amber-900/40',   t: 'text-amber-500'  },
                      { range: '70–100%', label: 'Likely fake',   c: 'border-rose-100 dark:border-rose-900/40',     t: 'text-rose-500'   },
                    ].map(({ range, label, c, t }) => (
                      <div key={range} className={`bg-white dark:bg-slate-800 rounded-xl p-2 border ${c}`}>
                        <p className={`font-semibold ${t}`}>{range}</p>
                        <p>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 p-4 text-sm text-indigo-700 dark:text-indigo-300">
              <p className="font-semibold mb-1">How detection works</p>
              <p className="opacity-80 leading-relaxed">
                The engine checks 13 signals: spam phrases ("buy now", "100% guaranteed"), excessive exclamation marks,
                ALL CAPS words, very short reviews, repeated words, stacked superlatives, incentivised review language,
                and more. Score ≥ 0.5 = suspected fake.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}