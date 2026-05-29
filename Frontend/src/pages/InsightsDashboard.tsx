/**
 * InsightsDashboard.tsx  (updated)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from original:
 *  - Top Keywords section now loads from /api/analytics/keyword-impact/
 *  - Each keyword shows: mentions, sentiment %, impact badge
 *  - Clicking a keyword opens the KeywordDrilldown side panel
 *  - Drilldown panel handles product filtering + XAI internally
 */

import { TrendingUp, BarChart3, PieChart, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useEffect, useState } from "react";
import { fetchDashboard, fetchKeywordImpact } from "../services/productApi";
import KeywordDrilldown from "./KeywordDrilldown";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KeywordItem {
  keyword:        string;
  mentions:       number;
  sentiment_pct:  number;
  positive_count: number;
  neutral_count:  number;
  negative_count: number;
  impact:         string;
}


// ── Impact badge (inline, matches KeywordDrilldown style) ─────────────────────

function ImpactBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    HIGH:   "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    MEDIUM: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400",
    LOW:    "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
  };
  const dot: Record<string, string> = { HIGH: "🔴", MEDIUM: "🟡", LOW: "🟢" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${styles[level] ?? styles.MEDIUM}`}>
      {dot[level] ?? "⚪"} {level}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InsightsDashboard() {
  const { setSearchQuery, setCurrentPage } = useApp();

  // Dashboard KPI data
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Keyword impact data
  const [keywords, setKeywords]           = useState<KeywordItem[]>([]);
  const [keywordsLoading, setKwLoading]   = useState(true);

  // Drilldown state
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  // Load dashboard KPIs
  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => setError("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  // Load keyword impact list
  useEffect(() => {
    fetchKeywordImpact()
      .then(setKeywords)
      .catch(console.error)
      .finally(() => setKwLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-xl">❌ {error || "Failed to load dashboard"}</p>
      </div>
    );
  }

  const { kpis, sentiment_distribution, top_products } = data;
  const {
    total_products: totalProducts,
    avg_sentiment:  avgSentiment,
    total_reviews:  totalReviews,
    model_accuracy: accuracy,
  } = kpis;

  const viewProduct = (productName: string) => {
    setSearchQuery(productName);
    setCurrentPage("search");
  };

  // Donut chart math
  const total         = sentiment_distribution.positive + sentiment_distribution.neutral + sentiment_distribution.negative;
  const circumference = 251.2;
  const positiveArc   = (sentiment_distribution.positive / total) * circumference;
  const neutralArc    = (sentiment_distribution.neutral  / total) * circumference;
  const negativeArc   = (sentiment_distribution.negative / total) * circumference;

  const kpiCards = [
    { icon: BarChart3,  label: "Total Products",  value: totalProducts,       gradient: "from-indigo-500 to-cyan-500" },
    { icon: TrendingUp, label: "Avg Sentiment",   value: `${avgSentiment}%`,  gradient: "from-green-500 to-emerald-500" },
    { icon: Users,      label: "Total Reviews",   value: totalReviews,        gradient: "from-orange-500 to-rose-500" },
    { icon: PieChart,   label: "Model Accuracy",  value: `${accuracy}%`,      gradient: "from-purple-500 to-pink-500" },
  ];

  const legendItems = [
    { color: "#10b981", label: "Positive", count: sentiment_distribution.positive },
    { color: "#f59e0b", label: "Neutral",  count: sentiment_distribution.neutral  },
    { color: "#ef4444", label: "Negative", count: sentiment_distribution.negative },
  ];

  return (
    <>
      <div className="min-h-screen pt-24 pb-12 px-4 bg-gray-50 dark:bg-slate-950 transition-colors">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Insights Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Real-time sentiment analytics across all products
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpiCards.map(({ icon: Icon, label, value, gradient }) => (
              <div key={label} className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-lg`}>
                <Icon className="w-6 h-6 mb-3 opacity-80" />
                <p className="text-sm font-medium text-white/80 mb-1">{label}</p>
                <p className="text-3xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Middle grid */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">

            {/* Donut chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Sentiment Distribution
              </h2>
              <div className="relative w-48 h-48 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke="#ef4444" strokeWidth="20"
                    strokeDasharray={`${negativeArc} ${circumference}`} />
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke="#f59e0b" strokeWidth="20"
                    strokeDasharray={`${neutralArc} ${circumference}`}
                    strokeDashoffset={`-${negativeArc}`} />
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke="#10b981" strokeWidth="20"
                    strokeDasharray={`${positiveArc} ${circumference}`}
                    strokeDashoffset={`-${negativeArc + neutralArc}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Reviews</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {legendItems.map(({ color, label, count }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── UPDATED: Keyword Impact List ── */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Keyword Impact
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">Click any keyword to explore</p>
              </div>

              {keywordsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-6">
                  <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                  Loading keywords...
                </div>
              ) : (
                <div className="space-y-2">
                  {keywords.map((k) => (
                    <button
                      key={k.keyword}
                      onClick={() => setActiveKeyword(k.keyword)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 rounded-xl transition-all group text-left"
                    >
                      {/* Keyword name */}
                      <span className="w-24 font-semibold text-sm text-gray-800 dark:text-gray-200 capitalize group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {k.keyword}
                      </span>

                      {/* Mentions */}
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-20">
                        {k.mentions.toLocaleString()} mentions
                      </span>

                      {/* Sentiment bar */}
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              k.sentiment_pct >= 65 ? "bg-green-400" :
                              k.sentiment_pct >= 45 ? "bg-yellow-400" : "bg-red-400"
                            }`}
                            style={{ width: `${k.sentiment_pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-9 text-right">
                          {k.sentiment_pct}%
                        </span>
                      </div>

                      {/* Impact badge */}
                      <div className="shrink-0">
                        <ImpactBadge level={k.impact} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Top Products by Sentiment
            </h2>
            <div className="space-y-3">
              {top_products.map((p: any, index: number) => (
                <div
                  key={index}
                  onClick={() => viewProduct(p.name)}
                  className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    index === 0 ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400" :
                    index === 1 ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" :
                    index === 2 ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" :
                    "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
                  }`}>
                    {index + 1}
                  </div>

                  <span className="flex-1 font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {p.name}
                  </span>

                  <div className="hidden sm:flex items-center gap-3 w-40">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                        style={{ width: `${p.sentiment}%` }}
                      />
                    </div>
                  </div>

                  <span className={`text-sm font-bold shrink-0 ${
                    p.sentiment >= 70 ? "text-green-600 dark:text-green-400" :
                    p.sentiment >= 40 ? "text-yellow-600 dark:text-yellow-400" :
                    "text-red-500 dark:text-red-400"
                  }`}>
                    {p.sentiment}%
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Keyword Drilldown Panel (slides in from right) ── */}
      {activeKeyword && (
        <KeywordDrilldown
          keyword={activeKeyword}
          onClose={() => setActiveKeyword(null)}
        />
      )}
    </>
  );
}