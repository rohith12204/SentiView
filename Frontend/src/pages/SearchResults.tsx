import { ChevronRight, ThumbsUp, ThumbsDown, Cpu, Battery, Camera, Smartphone, Star, ShoppingCart, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useEffect, useState } from 'react';
import { fetchProductDetails, fetchSummary, fetchCustomersSay } from '../services/productApi';
import ReviewSection from '../components/ReviewSection';

const STORE_URL = 'https://sentiview-api-j728.onrender.com/api/store';

export default function SearchResults() {
  const { searchQuery, setSelectedProducts, setCurrentPage } = useApp();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [storeProduct, setStoreProduct] = useState<any>(null);
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [customersSay, setCustomersSay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (!searchQuery) { setError('No search query provided.'); setLoading(false); return; }

    const loadData = async () => {
      try {
        setLoading(true); setError(''); setDebugInfo('');

        const productData = await fetchProductDetails(searchQuery);
        if (!productData || (!productData.model && !productData.brand)) {
          throw new Error(`fetchProductDetails returned empty data for "${searchQuery}"`);
        }
        setProduct(productData);

        // ✅ Fetch all store products — used for match + recommendations
        let storeList: any[] = [];
        try {
          const storeRes = await fetch(`${STORE_URL}/products/`);
          if (storeRes.ok) {
            storeList = await storeRes.json();

            // Match current product
            const fullName = `${productData.brand} ${productData.model}`.toLowerCase();
            const match = storeList.find((s: any) =>
              s.name?.toLowerCase().includes(productData.model?.toLowerCase()) ||
              s.name?.toLowerCase() === fullName
            );
            setStoreProduct(match || null);

            // ✅ Recommendations from store — already have image_url, price, sentiment
            const recs = storeList
              .filter((s: any) =>
                !s.name?.toLowerCase().includes(productData.model?.toLowerCase())
              )
              .slice(0, 3);
            setRecommendations(recs);
          }
        } catch (storeErr) {
          console.warn('Store product fetch failed:', storeErr);
          setStoreProduct(null);
          setRecommendations([]);
        }

        // AI summary (non-fatal)
        try {
          const sum = await fetchSummary(searchQuery);
          setSummary(sum?.summary || '');
        } catch { setSummary(''); }

        // Customers Say summary (non-fatal)
        try {
          const cs = await fetchCustomersSay(searchQuery);
          setCustomersSay(cs || null);
        } catch { setCustomersSay(null); }

      } catch (err: any) {
        console.error('SearchResults error:', err);
        setDebugInfo(err?.message || String(err));
        setError('Product not found. Please try a different search.');
      } finally { setLoading(false); }
    };

    loadData();
  }, [searchQuery]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) { setCurrentPage('signin'); return; }
    if (!storeProduct) return;
    setAddError('');
    try {
      await addToCart(storeProduct.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err: any) { setAddError(err.message || 'Failed to add to cart'); }
  };

  const aspectIcons: Record<string, any> = { Camera, Battery, Performance: Cpu };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">
          Loading AI insights for <strong>{searchQuery}</strong>…
        </p>
      </div>
    </div>
  );

  if (error || !product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <div className="text-5xl">🔍</div>
      <p className="text-xl text-red-500 text-center">{error || 'Product not found'}</p>
      <p className="text-sm text-gray-400">
        Search query: <code className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">{searchQuery}</code>
      </p>
      {debugInfo && (
        <div className="max-w-lg w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold mb-2">
            <AlertCircle className="w-4 h-4" /> Debug info
          </div>
          <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">{debugInfo}</pre>
        </div>
      )}
      <button onClick={() => setCurrentPage('home')}
        className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
        Back to Home
      </button>
    </div>
  );

  const aspects = [
    { aspect: 'Camera',      score: product.camera_score ?? 0 },
    { aspect: 'Battery',     score: product.battery_score ?? 0 },
    { aspect: 'Performance', score: product.performance_score ?? 0 },
  ];
  const sentimentColor = product.sentiment_score >= 70
    ? 'text-green-600'
    : product.sentiment_score >= 40
    ? 'text-yellow-500'
    : 'text-red-500';

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <button onClick={() => setCurrentPage('home')} className="hover:text-indigo-600 transition">Home</button>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-gray-800 dark:text-gray-200">{product.model}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* ── LEFT PANEL ── */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700 sticky top-24">
              <img
                src={storeProduct?.image_url || product?.image_url || ''}
                alt={product.model}
                className="w-full h-56 object-cover rounded-xl mb-5 bg-gray-100 dark:bg-slate-800"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    `https://placehold.co/300x240/6366f1/ffffff?text=${encodeURIComponent(product.model)}`;
                }}
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{product.model}</h1>
              <p className="text-gray-500 mb-1">{product.brand}</p>
              {storeProduct?.price && (
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-3">
                  ₹{Number(storeProduct.price).toLocaleString()}
                </p>
              )}

              <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${
                      i < Math.floor(product.trusted_rating ?? 0)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    }`} />
                  ))}
                  <span className="text-sm text-gray-500 ml-1">{product.avg_rating ?? 'N/A'}</span>
                </div>
                {product.sentiment_score != null ? (
                  <span className={`text-2xl font-bold ${sentimentColor}`}>{product.sentiment_score}%</span>
                ) : (
                  <span className="text-sm text-gray-400 italic">No score</span>
                )}
              </div>

              <div className="flex flex-col ml-1">
                <div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Genuine Review rating : {product.trusted_rating ?? 'N/A'}
                  </span>
                </div>
                <div>
                  
                Original rating : {product.original_rating && (
                  <span className="text-xs text-gray-400 line-through">
                    {product.original_rating} 
                  </span> 
                
              )}</div>
              </div>
              {/* Specs */}
              {storeProduct?.specs && Object.values(storeProduct.specs).some(Boolean) && (
                <div className="mb-4 space-y-1.5 text-sm">
                  {[
                    ['RAM', storeProduct.specs.ram],
                    ['Battery', storeProduct.specs.battery],
                    ['Display', storeProduct.specs.display],
                    ['Processor', storeProduct.specs.processor],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>{k}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{v}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {storeProduct && (
                  <>
                    <button
                      onClick={handleAddToCart}
                      disabled={added || storeProduct.stock === 0}
                      className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                        added
                          ? 'bg-green-500 text-white'
                          : storeProduct.stock === 0
                          ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-90 shadow-lg'
                      }`}
                    >
                      {added ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                      {added ? 'Added to Cart!' : storeProduct.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    {addError && <p className="text-red-500 text-xs text-center">{addError}</p>}
                    {storeProduct.stock > 0 && storeProduct.stock <= 5 && (
                      <p className="text-orange-500 text-xs text-center">Only {storeProduct.stock} left!</p>
                    )}
                  </>
                )}
                <button
                  onClick={() => { setSelectedProducts([product.model]); setCurrentPage('compare'); }}
                  className="w-full py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                >
                  Compare with Others
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* AI Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">🤖 AI Review Summary</h2>
              {summary
                ? <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
                : <p className="text-gray-400 italic">AI summary unavailable.</p>
              }
            </div>

            {/* Aspect Analysis */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">Aspect-Based Analysis</h2>
              <div className="space-y-5">
                {aspects.map(a => {
                  const Icon = aspectIcons[a.aspect] || Smartphone;
                  const bar = a.score >= 70
                    ? 'from-green-500 to-emerald-400'
                    : a.score >= 40
                    ? 'from-yellow-400 to-orange-400'
                    : 'from-red-500 to-rose-400';
                  return (
                    <div key={a.aspect}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                          <Icon className="w-5 h-5" />{a.aspect}
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{a.score}%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${bar} rounded-full transition-all duration-700`}
                          style={{ width: `${a.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pros & Cons */}
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: 'What People Love', icon: ThumbsUp, color: 'text-green-500', items: product.pros, prefix: '✅' },
                { title: 'Common Complaints', icon: ThumbsDown, color: 'text-red-500', items: product.cons, prefix: '❌' },
              ].map(({ title, icon: Icon, color, items, prefix }) => (
                <div key={title} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow border border-gray-100 dark:border-slate-700">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                    <Icon className={`w-5 h-5 ${color}`} />{title}
                  </h3>
                  {!items?.length
                    ? <p className="text-gray-400 text-sm italic">No data available.</p>
                    : (
                      <ul className="space-y-2">
                        {items.map((t: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="shrink-0">{prefix}</span><span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              ))}
            </div>

            {/* ── YOU MIGHT ALSO LIKE ── */}
            {recommendations.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow border border-gray-100 dark:border-slate-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 text-lg">You Might Also Like</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {recommendations.map(rec => {
                    const rName = rec.name || `${rec.brand} ${rec.model}`;
                    return (
                      <div
                        key={rec.id || rec.model}
                        onClick={() => { setSelectedProducts([product.model, rec.model]); setCurrentPage('compare'); }}
                        className="bg-gray-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200 transition overflow-hidden"
                      >
                        {/* ✅ Product image */}
                        <img
                          src={rec.image_url}
                          alt={rName}
                          className="w-full h-32 object-cover bg-gray-100 dark:bg-slate-700"
                          onError={e => {
                            (e.target as HTMLImageElement).src =
                              `https://placehold.co/300x180/6366f1/ffffff?text=${encodeURIComponent(rec.model || rec.name)}`;
                          }}
                        />
                        <div className="p-4">
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{rName}</h4>

                          {/* Price */}
                          {rec.price && (
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                              ₹{Number(rec.price).toLocaleString()}
                            </p>
                          )}

                          {/* Sentiment */}
                          <p className="text-xs text-gray-500 mt-1">
                            Sentiment: {rec.sentiment_score != null ? `${rec.sentiment_score}%` : 'N/A'}
                          </p>
                          {rec.sentiment_score != null && (
                            <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mt-2">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${rec.sentiment_score}%` }}
                              />
                            </div>
                          )}

                          {/* Rating */}
                          {rec.avg_rating != null && (
                            <div className="flex items-center gap-1 mt-2">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs text-gray-500">{rec.avg_rating}</span>
                            </div>
                          )}

                          <p className="text-xs text-indigo-500 mt-2 font-medium">Compare →</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Customers Say (Amazon-style summary) ── */}
            {customersSay && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow border border-gray-100 dark:border-slate-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span>💬</span> Customers Say
                </h2>

                {/* Summary paragraph */}
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/40">
                  {customersSay.summary}
                </p>

                {/* Aspect breakdown */}
                {customersSay.aspects?.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                      What customers mention most
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {customersSay.aspects.slice(0, 8).map((a: any) => (
                        <div key={a.aspect} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">{a.aspect}</p>
                          <div className="flex items-center gap-1 mb-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              a.trend === 'positive' ? 'bg-emerald-500'
                              : a.trend === 'negative' ? 'bg-rose-500'
                              : 'bg-amber-400'
                            }`} />
                            <span className={`text-xs font-medium capitalize ${
                              a.trend === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
                              : a.trend === 'negative' ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                            }`}>{a.trend}</span>
                          </div>
                          <p className="text-xs text-gray-400">{a.mention_count} mentions</p>
                          <div className="mt-1.5 h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                a.trend === 'positive' ? 'bg-emerald-500'
                                : a.trend === 'negative' ? 'bg-rose-500'
                                : 'bg-amber-400'
                              }`}
                              style={{ width: `${a.sentiment_pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Positive & Negative quotes */}
                {(customersSay.quotes?.positive || customersSay.quotes?.negative) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {customersSay.quotes?.positive && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-4">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">✅ What customers love</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">"{customersSay.quotes.positive}"</p>
                      </div>
                    )}
                    {customersSay.quotes?.negative && (
                      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40 rounded-xl p-4">
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide mb-2">⚠️ Common concerns</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">"{customersSay.quotes.negative}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Customer Reviews ── */}
            {storeProduct?.id && (
              <div className="mt-6 bg-white dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                <ReviewSection productId={storeProduct.id} productName={storeProduct.name || product.model} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}