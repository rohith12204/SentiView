import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, Plus, X, Search, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { compareProducts, fetchProducts } from '../services/productApi';

export default function CompareProducts() {
  const { selectedProducts, setSelectedProducts } = useApp();

  const [compareList, setCompareList] = useState<string[]>(selectedProducts.slice(0, 3));
  const [data, setData]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // Picker state
  const [pickerQuery, setPickerQuery]     = useState('');
  const [showPicker, setShowPicker]       = useState(false);
  const [allProducts, setAllProducts]     = useState<any[]>([]);
  const [pickerResults, setPickerResults] = useState<any[]>([]);

  // Load store products for the picker
  useEffect(() => {
    fetchProducts()
      .then((list: any[]) => {
        setAllProducts(list);
        setPickerResults(list);
      })
      .catch(console.error);
  }, []);

  // Filter picker on query
  useEffect(() => {
    if (!pickerQuery.trim()) {
      setPickerResults(allProducts);
      return;
    }
    const q = pickerQuery.toLowerCase();
    setPickerResults(
      allProducts.filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q)
      )
    );
  }, [pickerQuery, allProducts]);

  // Fetch comparison when ≥ 2 products selected
  useEffect(() => {
    if (compareList.length < 2) { setData([]); return; }
    setLoading(true);
    setError('');
    compareProducts(compareList)
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch(() => setError('Failed to load comparison. Please try again.'))
      .finally(() => setLoading(false));
  }, [compareList]);

  const addProduct = (name: string) => {
    if (compareList.includes(name) || compareList.length >= 3) return;
    const updated = [...compareList, name];
    setCompareList(updated);
    setSelectedProducts(updated);
    setShowPicker(false);
    setPickerQuery('');
  };

  const removeProduct = (name: string) => {
    const updated = compareList.filter((p) => p !== name);
    setCompareList(updated);
    setSelectedProducts(updated);
  };

  // ✅ Fixed: correctly highlight the winner
  const winnerColor = (score: number, allScores: number[]) => {
    const max = Math.max(...allScores);
    if (allScores.every(s => s === allScores[0])) return 'text-gray-500';       // all equal
    return score === max ? 'text-green-600 dark:text-green-400 font-extrabold' : 'text-gray-500 dark:text-gray-400';
  };

  const barColor = (score: number, allScores: number[]) => {
    const max = Math.max(...allScores);
    if (allScores.every(s => s === allScores[0])) return 'from-indigo-400 to-cyan-400';
    return score === max ? 'from-green-500 to-emerald-400' : 'from-indigo-300 to-cyan-300';
  };

  const aspects = ['Camera', 'Battery', 'Performance', 'Design', 'Display'];
  const cols = data.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Compare Products</h1>
          <p className="text-gray-500 dark:text-gray-400">AI-powered side-by-side sentiment comparison</p>
        </div>

        {/* ── Product Selector ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Select Products to Compare
            <span className="ml-2 text-sm font-normal text-gray-400">({compareList.length}/3)</span>
          </h2>

          <div className="flex flex-wrap gap-3 items-center">
            {compareList.map((name) => (
              <div key={name}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-xl"
              >
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{name}</span>
                <button onClick={() => removeProduct(name)} className="text-indigo-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {compareList.length < 3 && (
              <div className="relative">
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-400 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>

                {showPicker && (
                  <div className="absolute left-0 top-12 w-80 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 dark:border-slate-800">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          autoFocus
                          type="text"
                          value={pickerQuery}
                          onChange={(e) => setPickerQuery(e.target.value)}
                          placeholder="Search product..."
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {pickerResults.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No products found</p>
                      ) : (
                        pickerResults.map((p: any) => {
                          const name = p.name;
                          const already = compareList.includes(name);
                          return (
                            <button
                              key={p.id}
                              onClick={() => addProduct(name)}
                              disabled={already}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0 ${
                                already
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-slate-800/50'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="font-medium">{name}</span>
                              {already && <span className="ml-2 text-xs text-indigo-400">(added)</span>}
                              {p.price && (
                                <span className="block text-xs text-gray-400 mt-0.5">
                                  ₹{Number(p.price).toLocaleString('en-IN')}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Waiting */}
        {compareList.length < 2 && !loading && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            <div className="text-5xl mb-4">⚡</div>
            <p className="text-lg font-medium">Add at least 2 products to start comparing</p>
            <p className="text-sm mt-1">You can compare up to 3 products at once</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading comparison data…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ── Comparison Results ── */}
        {!loading && !error && data.length >= 2 && (
          <>
            {/* Overview cards */}
            <div className={`grid gap-5 ${cols}`}>
              {data.map((p, i) => {
                const sentimentScores = data.map(d => d.sentiment);
                const ratingScores   = data.map(d => d.avg_rating);
                return (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                    {/* Product name */}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 leading-snug">{p.name}</h2>

                    {/* Sentiment */}
                    <div className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500">Sentiment Score</span>
                        <span className={`text-sm ${winnerColor(p.sentiment, sentimentScores)}`}>
                          {p.sentiment}%
                          {p.sentiment === Math.max(...sentimentScores) && data.some(d => d.sentiment !== p.sentiment) && (
                            <span className="ml-1 text-green-500">🏆</span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${barColor(p.sentiment, sentimentScores)}`}
                          style={{ width: `${p.sentiment}%`, transition: 'width 1s ease' }}
                        />
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-500">Avg Rating</span>
                      <span className={`text-sm ${winnerColor(p.avg_rating, ratingScores)}`}>
                        ⭐ {p.avg_rating}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aspect Comparison */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Aspect Comparison</h2>
              <div className="space-y-6">
                {aspects.map((aspect) => {
                  const scores = data.map((p) => p.aspects?.[aspect] ?? 0);
                  return (
                    <div key={aspect}>
                      <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">{aspect}</p>
                      <div className={`grid gap-4 ${cols}`}>
                        {data.map((p, i) => {
                          const score = p.aspects?.[aspect] ?? 0;
                          return (
                            <div key={i}>
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-gray-500 truncate max-w-[70%]">
                                  {p.name.split(' ').slice(-2).join(' ')}
                                </span>
                                <span className={`text-xs ${winnerColor(score, scores)}`}>
                                  {score}%
                                  {score === Math.max(...scores) && scores.some(s => s !== score) && (
                                    <span className="ml-1">↑</span>
                                  )}
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${barColor(score, scores)}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pros & Cons */}
            <div className={`grid gap-5 ${cols}`}>
              {data.map((p, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 leading-snug">{p.name}</h3>

                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2 text-green-600 dark:text-green-400">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="font-semibold text-sm">Pros</span>
                    </div>
                    <ul className="space-y-2">
                      {(p.pros || []).slice(0, 3).map((pro: string, j: number) => (
                        <li key={j} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-green-500 shrink-0 mt-0.5">✅</span>
                          <span className="line-clamp-2">{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
                      <ThumbsDown className="w-4 h-4" />
                      <span className="font-semibold text-sm">Cons</span>
                    </div>
                    <ul className="space-y-2">
                      {(p.cons || []).slice(0, 3).map((con: string, j: number) => (
                        <li key={j} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-rose-500 shrink-0 mt-0.5">❌</span>
                          <span className="line-clamp-2">{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}