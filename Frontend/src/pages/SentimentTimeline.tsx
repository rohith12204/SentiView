import { useState, useEffect } from 'react';
import { LineChart as LineChartIcon, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { fetchProducts, fetchSentimentTrend } from '../services/productApi';

interface TrendPoint {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
}

export default function SentimentTimeline() {
  const [products, setProducts]           = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [trendData, setTrendData]         = useState<TrendPoint[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingTrend, setLoadingTrend]   = useState(false);
  const [error, setError]                 = useState('');

  // Load product list
  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setProducts(data);
        if (data.length > 0) {
          // BUG FIX: send full "Brand Model" name so backend can match it properly
          const first = `${data[0].brand} ${data[0].model}`.replace(/\s+/g, ' ').trim();
          setSelectedProduct(first);
        }
      })
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Load trend when product changes
  useEffect(() => {
    if (!selectedProduct) return;
    setLoadingTrend(true);
    setError('');
    fetchSentimentTrend(selectedProduct)
      .then((res) => setTrendData(res.trend || []))
      .catch(() => setError('Failed to load trend data'))
      .finally(() => setLoadingTrend(false));
  }, [selectedProduct]);

  const avgPositive =
    trendData.length > 0
      ? Math.round(trendData.reduce((s, d) => s + d.positive, 0) / trendData.length)
      : 0;

  const isImproving =
    trendData.length >= 2
      ? trendData[trendData.length - 1].positive > trendData[0].positive
      : true;

  const peakMonth =
    trendData.length > 0
      ? trendData.reduce((max, d) => (d.positive > max.positive ? d : max), trendData[0]).month
      : '—';

  const maxVal = trendData.length > 0
    ? Math.max(...trendData.flatMap((d) => [d.positive, d.neutral, d.negative]))
    : 100;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <LineChartIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-300">Sentiment Over Time</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Track how product sentiment evolves month by month</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">

          {/* Sidebar product list */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/50 p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Select Product</h3>

              {loadingProducts ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {products.map((prod) => {
                    // BUG FIX: always send "Brand Model" as the full name to the API
                    const fullName = `${prod.brand} ${prod.model}`.replace(/\s+/g, ' ').trim();
                    const isActive = selectedProduct === fullName;
                    return (
                      <button
                        key={fullName}
                        onClick={() => setSelectedProduct(fullName)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg'
                            : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-medium text-sm truncate">{prod.model}</div>
                        <div className={`text-xs mt-0.5 ${isActive ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                          {prod.brand}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 pt-5 border-t border-gray-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBreakdown}
                    onChange={(e) => setShowBreakdown(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show full breakdown</span>
                </label>
              </div>
            </div>
          </div>

          {/* Chart + insight cards */}
          <div className="lg:col-span-3 space-y-6">

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/50 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedProduct || '—'}</h2>
                  <p className="text-gray-600 dark:text-gray-400">6-month sentiment trend</p>
                </div>
                {avgPositive > 0 && (
                  <div className="text-right">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{avgPositive}%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Avg Positive</div>
                  </div>
                )}
              </div>

              {loadingTrend ? (
                <div className="h-64 flex items-center justify-center text-gray-500 animate-pulse text-lg">
                  Loading trend data...
                </div>
              ) : error ? (
                <div className="h-64 flex items-center justify-center text-red-500">{error}</div>
              ) : trendData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">No trend data available</div>
              ) : (
                <>
                  <div className="relative h-72 mb-4">
                    <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-400">
                      {['100%', '75%', '50%', '25%', '0%'].map((label) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="w-8 text-right">{label}</span>
                          <div className="flex-1 border-t border-gray-100 dark:border-slate-800" />
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 pl-12 pb-6 flex items-end justify-around gap-2">
                      {trendData.map((data) => (
                        <div key={data.month} className="flex-1 flex flex-col items-center group relative">
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl z-20 whitespace-nowrap">
                            <div className="font-semibold mb-1">{data.month}</div>
                            <div className="text-green-400">✅ {data.positive}%</div>
                            {showBreakdown && (
                              <>
                                <div className="text-gray-300">➖ {data.neutral}%</div>
                                <div className="text-red-400">❌ {data.negative}%</div>
                              </>
                            )}
                          </div>

                          {showBreakdown ? (
                            <div className="w-full flex items-end justify-center gap-0.5 mb-2" style={{ height: '200px' }}>
                              <div
                                className="flex-1 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all duration-500"
                                style={{ height: `${(data.positive / maxVal) * 200}px` }}
                              />
                              <div
                                className="flex-1 bg-gradient-to-t from-gray-400 to-gray-300 rounded-t transition-all duration-500"
                                style={{ height: `${(data.neutral / maxVal) * 200}px` }}
                              />
                              <div
                                className="flex-1 bg-gradient-to-t from-rose-500 to-red-400 rounded-t transition-all duration-500"
                                style={{ height: `${(data.negative / maxVal) * 200}px` }}
                              />
                            </div>
                          ) : (
                            <div className="w-3/4 mb-2" style={{ height: '200px', display: 'flex', alignItems: 'flex-end' }}>
                              <div
                                className="w-full bg-gradient-to-t from-indigo-600 to-cyan-500 rounded-t transition-all duration-500 group-hover:opacity-80"
                                style={{ height: `${(data.positive / 100) * 200}px` }}
                              />
                            </div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400">{data.month}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-6 mt-2">
                    {showBreakdown ? (
                      <>
                        <LegendItem color="from-green-500 to-emerald-400" label="Positive" />
                        <LegendItem color="from-gray-400 to-gray-300" label="Neutral" />
                        <LegendItem color="from-rose-500 to-red-400" label="Negative" />
                      </>
                    ) : (
                      <LegendItem color="from-indigo-600 to-cyan-500" label="Positive Sentiment" />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Insight Cards */}
            {!loadingTrend && trendData.length > 0 && (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="text-sm opacity-80 mb-2">Average Positive</div>
                  <div className="text-4xl font-bold mb-1">{avgPositive}%</div>
                  <div className="text-sm opacity-70">Over {trendData.length} months</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="text-sm opacity-80 mb-2">Trend Direction</div>
                  <div className="text-4xl font-bold mb-1 flex items-center gap-2">
                    {isImproving
                      ? <TrendingUp className="w-8 h-8" />
                      : <TrendingDown className="w-8 h-8" />}
                  </div>
                  <div className="text-sm opacity-70">{isImproving ? 'Improving' : 'Declining'}</div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="text-sm opacity-80 mb-2">Peak Month</div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-6 h-6" />
                    <span className="text-2xl font-bold">{peakMonth}</span>
                  </div>
                  <div className="text-sm opacity-70">Highest sentiment</div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded bg-gradient-to-br ${color}`} />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </div>
  );
}
