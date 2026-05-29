/**
 * KeywordDrilldown.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full insight panel shown when user clicks a keyword in InsightsDashboard.
 *
 * Features:
 *  - Summary metrics (mentions, sentiment %, impact level)
 *  - Sentiment distribution bar
 *  - Monthly trend chart (last 12 months)
 *  - Top positive + negative reviews
 *  - Related synonym chips
 *  - Top affected products list
 *  - Product filter dropdown (updates all sections)
 *  - Explainable AI panel (click any review to explain it)
 */

import { useEffect, useState, useCallback } from "react";
import {
  X, ChevronDown, Zap, TrendingUp, TrendingDown,
  MessageSquare, Tag, BarChart2, Lightbulb, Loader2,
} from "lucide-react";
import {
  fetchKeywordDrilldown,
  fetchKeywordProducts,
  explainReview,
} from "../services/productApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DrilldownData {
  keyword: string;
  selected_product: string;
  summary: { mentions: number; sentiment_pct: number; impact: string };
  distribution: {
    positive: number; positive_pct: number;
    neutral:  number; neutral_pct:  number;
    negative: number; negative_pct: number;
  };
  trend: Array<{ month: string; positive: number; neutral: number; negative: number; total: number }>;
  top_reviews: { positive: string; negative: string };
  related_terms: string[];
  top_products: Array<{ name: string; mentions: number; sentiment_pct: number }>;
}

interface ExplainData {
  review_text: string;
  predicted_category: string;
  confidence: number;
  influencing_words: string[];
  category_probabilities: Record<string, number>;
}

interface Props {
  keyword: string;
  onClose: () => void;
}

// ── Impact badge ──────────────────────────────────────────────────────────────

function ImpactBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    HIGH:   "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    MEDIUM: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    LOW:    "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  };
  const dot: Record<string, string> = { HIGH: "🔴", MEDIUM: "🟡", LOW: "🟢" };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${styles[level] ?? styles.MEDIUM}`}>
      {dot[level] ?? "⚪"} {level}
    </span>
  );
}

// ── Trend bar chart ───────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: DrilldownData["trend"] }) {
  if (!trend.length) return <p className="text-gray-400 text-sm">No trend data available.</p>;

  const maxTotal = Math.max(...trend.map(t => t.total), 1);

  return (
    <div className="space-y-2">
      {trend.map((t) => (
        <div key={t.month} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">{t.month.slice(0, 7)}</span>
          <div className="flex-1 flex h-5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700">
            <div
              className="bg-green-400 dark:bg-green-500 transition-all"
              style={{ width: `${(t.positive / maxTotal) * 100}%` }}
            />
            <div
              className="bg-yellow-400 dark:bg-yellow-500 transition-all"
              style={{ width: `${(t.neutral / maxTotal) * 100}%` }}
            />
            <div
              className="bg-red-400 dark:bg-red-500 transition-all"
              style={{ width: `${(t.negative / maxTotal) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right shrink-0">
            {t.total}
          </span>
        </div>
      ))}
      {/* Legend */}
      <div className="flex gap-4 pt-1">
        {[
          { color: "bg-green-400", label: "Positive" },
          { color: "bg-yellow-400", label: "Neutral" },
          { color: "bg-red-400",   label: "Negative" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Explain panel ─────────────────────────────────────────────────────────────

function ExplainPanel({ text, onClose }: { text: string; onClose: () => void }) {
  const [data, setData]     = useState<ExplainData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    explainReview(text)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [text]);

  return (
    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
          <Lightbulb className="w-4 h-4" /> AI Explanation
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Analysing...
        </div>
      )}

      {data && !loading && (
        <div className="space-y-3">
          {/* Review text */}
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{data.review_text.slice(0, 120)}"</p>

          {/* Predicted category + confidence */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Category:
              <span className="ml-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-md font-bold capitalize">
                {data.predicted_category}
              </span>
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Confidence:
              <span className="ml-1 text-indigo-600 dark:text-indigo-400 font-bold">{data.confidence}%</span>
            </span>
          </div>

          {/* Influencing words */}
          {data.influencing_words.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Key influencing words:</p>
              <div className="flex flex-wrap gap-1">
                {data.influencing_words.map((w) => (
                  <span
                    key={w}
                    className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-mono font-medium"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category probabilities */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Category probabilities:</p>
            <div className="space-y-1">
              {Object.entries(data.category_probabilities)
                .filter(([, pct]) => pct > 0)
                .map(([cat, pct]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-20 capitalize">{cat}</span>
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 dark:bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KeywordDrilldown({ keyword, onClose }: Props) {
  const [data, setData]             = useState<DrilldownData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [products, setProducts]     = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const [explainText, setExplainText]         = useState<string | null>(null);

  // Load product list once
  useEffect(() => {
    fetchKeywordProducts()
      .then((res) => setProducts(res.products ?? []))
      .catch(console.error);
  }, []);

  // Load drilldown data whenever keyword or product filter changes
  const loadDrilldown = useCallback(async () => {
    setLoading(true);
    setError("");
    setExplainText(null);
    try {
      const res = await fetchKeywordDrilldown(keyword, selectedProduct);
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e: any) {
      setError(e.message ?? "Failed to load drilldown");
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedProduct]);

  useEffect(() => { loadDrilldown(); }, [loadDrilldown]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Keyword Analysis</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 capitalize">{keyword}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Filter */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Filter by Product</p>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 transition"
            >
              <span className="truncate">
                {selectedProduct === "all" ? "All Products" : selectedProduct}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 ml-2 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
                {/* All Products option */}
                <button
                  onClick={() => { setSelectedProduct("all"); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition ${
                    selectedProduct === "all"
                      ? "text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/20"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  All Products
                </button>
                {products.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setSelectedProduct(p); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition ${
                      selectedProduct === p
                        ? "text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/20"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-6">

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-gray-400 text-sm">Loading insights...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              ❌ {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* ── 1. Summary Metrics ─────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Summary
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {data.summary.mentions.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Mentions</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {data.summary.sentiment_pct}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg Sentiment</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                    <div className="flex justify-center mb-1">
                      <ImpactBadge level={data.summary.impact} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Impact Level</p>
                  </div>
                </div>
              </section>

              {/* ── 2. Sentiment Distribution ──────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <PieIcon />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Sentiment Distribution
                  </h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Positive", pct: data.distribution.positive_pct, count: data.distribution.positive, color: "bg-green-500" },
                    { label: "Neutral",  pct: data.distribution.neutral_pct,  count: data.distribution.neutral,  color: "bg-yellow-400" },
                    { label: "Negative", pct: data.distribution.negative_pct, count: data.distribution.negative, color: "bg-red-500" },
                  ].map(({ label, pct, count, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{label}</span>
                      <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-10 text-right">{pct}%</span>
                      <span className="text-xs text-gray-400 w-12 text-right">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── 3. Trend Over Time ─────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Trend Over Time
                  </h3>
                </div>
                <TrendChart trend={data.trend} />
              </section>

              {/* ── 4. Top Reviews ─────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Top Reviews
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Positive */}
                  {data.top_reviews.positive && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">Top Positive</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        "{data.top_reviews.positive}"
                      </p>
                      <button
                        onClick={() => setExplainText(
                          explainText === data.top_reviews.positive ? null : data.top_reviews.positive
                        )}
                        className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition"
                      >
                        <Lightbulb className="w-3 h-3" />
                        {explainText === data.top_reviews.positive ? "Hide explanation" : "Explain this review"}
                      </button>
                      {explainText === data.top_reviews.positive && (
                        <ExplainPanel text={data.top_reviews.positive} onClose={() => setExplainText(null)} />
                      )}
                    </div>
                  )}

                  {/* Negative */}
                  {data.top_reviews.negative && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Top Negative</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        "{data.top_reviews.negative}"
                      </p>
                      <button
                        onClick={() => setExplainText(
                          explainText === data.top_reviews.negative ? null : data.top_reviews.negative
                        )}
                        className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition"
                      >
                        <Lightbulb className="w-3 h-3" />
                        {explainText === data.top_reviews.negative ? "Hide explanation" : "Explain this review"}
                      </button>
                      {explainText === data.top_reviews.negative && (
                        <ExplainPanel text={data.top_reviews.negative} onClose={() => setExplainText(null)} />
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* ── 5. Related Terms ───────────────────────────────────── */}
              {data.related_terms.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Related Terms
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.related_terms.map((term) => (
                      <span
                        key={term}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs font-mono font-medium"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* ── 6. Top Affected Products ───────────────────────────── */}
              {data.top_products.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Top Products — {keyword} Issues
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {data.top_products.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-5">{i + 1}</span>
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{p.name}</span>
                        <div className="flex items-center gap-2 w-28">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                p.sentiment_pct >= 60 ? "bg-green-400" :
                                p.sentiment_pct >= 40 ? "bg-yellow-400" : "bg-red-400"
                              }`}
                              style={{ width: `${p.sentiment_pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-10 text-right ${
                            p.sentiment_pct >= 60 ? "text-green-600 dark:text-green-400" :
                            p.sentiment_pct >= 40 ? "text-yellow-600 dark:text-yellow-400" :
                            "text-red-500 dark:text-red-400"
                          }`}>
                            {p.sentiment_pct}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Tiny inline pie icon to avoid importing more from lucide
function PieIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}