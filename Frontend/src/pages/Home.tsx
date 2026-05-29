import { Search, TrendingUp, ArrowRight, Sparkles, ShoppingCart, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useState, useEffect, useRef } from 'react';
import { searchProducts } from '../services/productApi';

const STORE_URL = 'http://127.0.0.1:8000/api/store';

export default function Home() {
  const { setCurrentPage, setSearchQuery } = useApp();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const suggestRef = useRef<HTMLDivElement>(null);

  // Fetch trending store products (already enriched with analytics on the backend)
  useEffect(() => {
    fetch(`${STORE_URL}/products/`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setProducts(data.slice(0, 4)))
      .catch(console.error);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (value: string) => {
    if (!value.trim()) return;
    setSearchQuery(value);
    setCurrentPage('search');
    setShowSuggestions(false);
  };

  const handleInputChange = async (value: string) => {
    setQuery(value);
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const results = await searchProducts(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch { setSuggestions([]); }
  };

  const handleAddToCart = async (product: any) => {
    if (!isAuthenticated) { setCurrentPage('signin'); return; }
    try {
      await addToCart(product.id, 1);
      setAddedIds(prev => new Set(prev).add(product.id));
      setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(product.id); return s; }), 2000);
    } catch (err: any) { alert(err.message); }
  };

  const quickChips = ['iPhone 15 Pro', 'Galaxy S23 Ultra', 'Pixel 8 Pro'];

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="relative z-10 max-w-7xl mx-auto px-4">

        {/* ── HERO ── */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-full text-indigo-700 dark:text-dark-indigo-300 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Product Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
            Discover Real Insights<br />Behind Every Product
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Sentiview uses advanced NLP to analyse thousands of reviews and surface what people <em>actually</em> think — so you can buy smarter.
          </p>

          {/* Search */}
          <div ref={suggestRef} className="max-w-3xl mx-auto mb-8 relative">
            <div className="relative flex items-center">
              <Search className="absolute left-5 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text" value={query}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search any product (e.g. iPhone 15 Pro)"
                className="w-full pl-14 pr-32 py-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button onClick={() => handleSearch(query)}
                className="absolute right-3 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 text-sm">
                Search
              </button>
            </div>
            {showSuggestions && (
              <div className="absolute w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 mt-2 rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map((item, i) => (
                  <button key={i} onMouseDown={() => handleSearch(item.name)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-indigo-50 dark:hover:bg-slate-800 text-left transition-colors">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-800 dark:text-gray-200">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Chips */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {quickChips.map(item => (
              <button key={item} onClick={() => handleSearch(item)}
                className="px-5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-300 transition-all duration-200">
                {item}
              </button>
            ))}
          </div>

          <button onClick={() => setCurrentPage('trending')}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
            Explore Sentiments <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* ── TRENDING PRODUCTS ── */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-rose-500" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Trending Products</h2>
            </div>
            <button onClick={() => setCurrentPage('trending')}
              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-sm">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {products.length === 0 ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-slate-800 rounded-2xl h-64 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => {
                const displayName = product.name || `${product.brand} ${product.model}`;
                const isAdded = addedIds.has(product.id);
                const hasScore = product.sentiment_score != null;

                return (
                  <div key={product.id}
                    className="group bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">

                    {/* Image */}
                    <div className="relative cursor-pointer" onClick={() => handleSearch(displayName)}>
                      <img
                        src={product.image_url}
                        alt={displayName}
                        className="w-full h-40 object-cover bg-gray-100 dark:bg-slate-800"
                        onError={e => {
                          (e.target as HTMLImageElement).src =
                            `https://placehold.co/300x180/6366f1/ffffff?text=${encodeURIComponent(product.model)}`;
                        }}
                      />
                      {/* Price badge */}
                      <div className="absolute top-3 left-3 px-2 py-1 bg-green-600/90 text-white text-xs rounded-lg font-semibold backdrop-blur-sm">
                        ₹{Number(product.price).toLocaleString()}
                      </div>
                      {/* Sentiment badge — only when data exists */}
                      {hasScore && (
                        <div className="absolute top-3 right-3 px-2 py-1 bg-indigo-600/90 text-white text-xs rounded-lg font-semibold backdrop-blur-sm">
                          {product.sentiment_score}%
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <div className="cursor-pointer flex-1" onClick={() => handleSearch(displayName)}>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate mb-1">{displayName}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          ⭐ {product.avg_rating != null ? product.avg_rating : 'N/A'}
                        </p>

                        {hasScore ? (
                          <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full mb-3">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                              style={{ width: `${product.sentiment_score}%` }} />
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic mb-3">No sentiment data yet</p>
                        )}
                      </div>

                      {/* Add to Cart */}
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={isAdded || product.stock === 0}
                        className={`w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                          isAdded ? 'bg-green-500 text-white' :
                          product.stock === 0 ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed' :
                          'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-90'
                        }`}
                      >
                        {isAdded ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                        {isAdded ? 'Added!' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
