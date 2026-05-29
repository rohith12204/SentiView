import { Star, TrendingUp, Filter, Search, ShoppingCart, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const STORE_URL = 'http://127.0.0.1:8000/api/store';
const BRANDS = ['All', 'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Sony', 'Motorola'];

export default function TrendingProducts() {
  const { setSearchQuery, setCurrentPage } = useApp();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();

  const [products, setProducts] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'sentiment' | 'rating' | 'name' | 'price'>('sentiment');
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [minSentiment, setMinSentiment] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${STORE_URL}/products/`)
      .then(r => r.ok ? r.json() : [])
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const dynamicBrands = ['All', ...Array.from(new Set(products.map((p: any) => p.brand).filter(Boolean)))];
  const brandList = dynamicBrands.length > 2 ? dynamicBrands : BRANDS;

  const filtered = [...products]
    .filter(p => {
      const name = (p.name || `${p.brand} ${p.model}`).toLowerCase();
      return (
        (brandFilter === 'All' || p.brand === brandFilter) &&
        (p.avg_rating ?? 0) >= minRating &&
        (p.sentiment_score ?? 0) >= minSentiment &&
        name.includes(searchText.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (sortBy === 'sentiment') return (b.sentiment_score ?? 0) - (a.sentiment_score ?? 0);
      if (sortBy === 'rating')    return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      if (sortBy === 'price')     return (a.price ?? 0) - (b.price ?? 0);
      return (a.name || '').localeCompare(b.name || '');
    });

  const handleAddToCart = async (product: any) => {
    if (!isAuthenticated) { setCurrentPage('signin'); return; }
    try {
      await addToCart(product.id, 1);
      setAddedIds(prev => new Set(prev).add(product.id));
      setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(product.id); return s; }), 2000);
    } catch (err: any) { alert(err.message); }
  };

  const viewProduct = (name: string) => { setSearchQuery(name); setCurrentPage('search'); };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {[...Array(8)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-slate-800 rounded-2xl h-80 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-8 h-8 text-rose-500" />
              {/* ✅ FIX: Heading text — dark:text-white for full visibility */}
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-300">Trending Products</h1>
            </div>
            {/* ✅ FIX: Subtext — dark:text-gray-300 instead of dark:text-gray-400 */}
            <p className="text-gray-500 dark:text-gray-300">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* ✅ FIX: Filter icon — dark:text-gray-300 */}
            <Filter className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            {/* ✅ FIX: Sort select — dark:text-white */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="sentiment">Sort: Sentiment</option>
              <option value="rating">Sort: Rating</option>
              <option value="price">Sort: Price ↑</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Filter Sidebar */}
          <div className="lg:w-60 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 p-6 sticky top-24 space-y-6">
              {/* ✅ FIX: Sidebar heading — dark:text-white */}
              <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>

              <div>
                {/* ✅ FIX: All sidebar labels — dark:text-gray-300 */}
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 mb-2 uppercase tracking-wide">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-400" />
                  {/* ✅ FIX: Input text — dark:text-white, placeholder color improved */}
                  <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                    placeholder="Filter products..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 mb-2 uppercase tracking-wide">Brand</label>
                <div className="flex flex-wrap gap-2">
                  {brandList.map(b => (
                    <button key={b} onClick={() => setBrandFilter(b)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        brandFilter === b
                          ? 'bg-indigo-600 text-white'
                          /* ✅ FIX: Inactive brand buttons — dark:text-gray-200 */
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {/* ✅ FIX: Range label — dark:text-gray-300 */}
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 mb-2 uppercase tracking-wide">
                  Min Rating: <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{minRating > 0 ? `${minRating}★` : 'Any'}</span>
                </label>
                <input type="range" min={0} max={5} step={0.5} value={minRating}
                  onChange={e => setMinRating(Number(e.target.value))} className="w-full accent-indigo-600" />
                {/* ✅ FIX: Range min/max labels — dark:text-gray-400 */}
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-400 mt-1"><span>0</span><span>5★</span></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 mb-2 uppercase tracking-wide">
                  Min Sentiment: <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{minSentiment > 0 ? `${minSentiment}%` : 'Any'}</span>
                </label>
                <input type="range" min={0} max={100} step={5} value={minSentiment}
                  onChange={e => setMinSentiment(Number(e.target.value))} className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-400 mt-1"><span>0%</span><span>100%</span></div>
              </div>

              <button onClick={() => { setBrandFilter('All'); setMinRating(0); setMinSentiment(0); setSearchText(''); }}
                className="w-full text-xs text-indigo-600 dark:text-indigo-400 hover:underline text-center py-1">
                Reset Filters
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            {filtered.length === 0 ? (
              /* ✅ FIX: Empty state — dark:text-gray-400 */
              <div className="text-center py-20 text-gray-400 dark:text-gray-400">No products match your filters.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map(product => {
                  const displayName = product.name || `${product.brand} ${product.model}`;
                  const isAdded = addedIds.has(product.id);
                  const hasScore = product.sentiment_score != null;
                  const hasRating = product.avg_rating != null;

                  return (
                    <div key={product.id}
                      className="group bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col">

                      {/* Image */}
                      <div className="relative cursor-pointer" onClick={() => viewProduct(displayName)}>
                        <img
                          src={product.image_url}
                          alt={displayName}
                          className="w-full h-44 object-cover bg-gray-100 dark:bg-slate-700"
                          onError={e => {
                            (e.target as HTMLImageElement).src =
                              `https://placehold.co/300x180/6366f1/ffffff?text=${encodeURIComponent(product.model || product.name)}`;
                          }}
                        />
                        {/* Price badge */}
                        <div className="absolute top-3 left-3 px-2 py-1 bg-green-600/90 text-white text-xs rounded-lg font-semibold backdrop-blur-sm">
                          ₹{Number(product.price).toLocaleString()}
                        </div>
                        {/* Sentiment badge */}
                        {hasScore && (
                          <div className="absolute top-3 right-3 px-2 py-1 bg-indigo-600/90 text-white text-xs rounded-lg font-semibold backdrop-blur-sm">
                            {product.sentiment_score}%
                          </div>
                        )}
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <div className="cursor-pointer flex-1" onClick={() => viewProduct(displayName)}>
                          {/* ✅ FIX: Product name — dark:text-white */}
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate">{displayName}</h3>
                          {/* ✅ FIX: Brand name — dark:text-gray-300 */}
                          <p className="text-sm text-gray-500 dark:text-gray-300 mb-3">{product.brand}</p>

                          <div className="flex items-center gap-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                hasRating && i < Math.round(product.avg_rating)
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            ))}

                            <span className="ml-1 text-sm text-gray-500 dark:text-gray-200">
                              {hasRating ? Number(product.avg_rating).toFixed(2) : 'N/A'}
                            </span>
                          </div>
                          {/* Sentiment bar */}
                          <div className="mb-3">
                            {/* ✅ FIX: "Sentiment" label row — dark:text-gray-300 */}
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-300 mb-1">
                              <span>Sentiment</span>
                              <span className={`font-semibold ${hasScore ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {hasScore ? `${product.sentiment_score}%` : 'N/A'}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full">
                              {hasScore && (
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                                  style={{ width: `${product.sentiment_score}%` }} />
                              )}
                            </div>
                          </div>

                          {/* ✅ FIX: Aspect mini scores — dark:text-gray-300 for clear visibility */}
                          <div className="grid grid-cols-3 gap-1 text-xs text-center text-gray-500 dark:text-gray-300 mb-4">
                            <div>📷 {product.camera_score != null ? `${product.camera_score}%` : '—'}</div>
                            <div>🔋 {product.battery_score != null ? `${product.battery_score}%` : '—'}</div>
                            <div>⚡ {product.performance_score != null ? `${product.performance_score}%` : '—'}</div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {/* ✅ FIX: View Insights button — dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 */}
                          <button onClick={() => viewProduct(displayName)}
                            className="flex-1 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition">
                            View Insights
                          </button>
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={isAdded || product.stock === 0}
                            className={`flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                              isAdded
                                ? 'bg-green-500 text-white'
                                : product.stock === 0
                                  /* ✅ FIX: Out of stock — dark:text-gray-400 */
                                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-400 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-90'
                            }`}
                          >
                            {isAdded ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                            {isAdded ? 'Added' : product.stock === 0 ? 'Out' : 'Add'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}