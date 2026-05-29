import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import ChatBot from './components/ChatBot';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import SearchResults from './pages/SearchResults';
import InsightsDashboard from './pages/InsightsDashboard';
import CompareProducts from './pages/CompareProducts';
import TrendingProducts from './pages/TrendingProducts';
import SentimentTimeline from './pages/SentimentTimeline';
import SentimentAnalyzer from './pages/SentimentAnalyzer';
import FakeReviewChecker from './pages/FakeReviewChecker';
import FakeReviewAnalysis from './pages/FakeReviewAnalysis';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import AdminDashboard from './pages/AdminDashboard';

// ── Pages that require authentication ──
const PROTECTED_PAGES = ['cart', 'orders', 'admin'];

// ── Pages that hide Navbar ──
const NO_NAV_PAGES = ['signin', 'signup'];

function AppContent() {
  const { currentPage, setCurrentPage } = useApp();
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Show loading spinner while restoring session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading Sentiview...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    // ── Auth guard: redirect unauthenticated users ──
    if (PROTECTED_PAGES.includes(currentPage) && !isAuthenticated) {
      return <AccessDenied onSignIn={() => setCurrentPage('signin')} />;
    }

    // ── Admin guard ──
    if (currentPage === 'admin' && !isAdmin) {
      return <AccessDenied onSignIn={() => setCurrentPage('signin')} adminOnly />;
    }

    switch (currentPage) {
      case 'home':      return <Home />;
      case 'signin':    return <SignIn />;
      case 'signup':    return <SignUp />;
      case 'search':    return isAuthenticated ? <SearchResults /> : <GuestPrompt page="search" onSignIn={() => setCurrentPage('signin')} />;
      case 'insights':  return isAuthenticated ? <InsightsDashboard /> : <GuestPrompt page="insights" onSignIn={() => setCurrentPage('signin')} />;
      case 'compare':   return isAuthenticated ? <CompareProducts /> : <GuestPrompt page="compare" onSignIn={() => setCurrentPage('signin')} />;
      case 'trending':  return isAuthenticated ? <TrendingProducts /> : <GuestPrompt page="trending" onSignIn={() => setCurrentPage('signin')} />;
      case 'timeline':  return isAuthenticated ? <SentimentTimeline /> : <GuestPrompt page="timeline" onSignIn={() => setCurrentPage('signin')} />;
      case 'sentiment': return isAuthenticated ? <SentimentAnalyzer /> : <GuestPrompt page="sentiment" onSignIn={() => setCurrentPage('signin')} />;
      case 'fake':      return isAuthenticated ? (
        <div className="min-h-screen pt-24 pb-12 px-4"><div className="max-w-3xl mx-auto"><FakeReviewChecker /></div></div>
      ) : <GuestPrompt page="fake" onSignIn={() => setCurrentPage('signin')} />;
      case 'fake-analysis': return isAuthenticated ? <FakeReviewAnalysis /> : <GuestPrompt page="fake-analysis" onSignIn={() => setCurrentPage('signin')} />;
      case 'cart':      return <CartPage />;
      case 'orders':    return <OrdersPage />;
      case 'admin':     return <AdminDashboard />;
      default:          return <Home />;
    }
  };

  const showNav = !NO_NAV_PAGES.includes(currentPage);

  return (
    <>
      {showNav && <Navbar />}
      {renderPage()}
      {showNav && isAuthenticated && <ChatBot />}
    </>
  );
}

// ── Guest prompt shown when a page needs login ──
function GuestPrompt({ page, onSignIn }: { page: string; onSignIn: () => void }) {
  const { setCurrentPage } = useApp();
  const pageLabels: Record<string, string> = {
    search: 'Product Search', insights: 'Insights Dashboard',
    compare: 'Compare Products', trending: 'Trending Products',
    timeline: 'Sentiment Timeline', sentiment: 'Sentiment Analyzer', fake: 'Fake Review Detector',
    'fake-analysis': 'Fake Review Analysis',
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <span className="text-3xl">🔐</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Sign In Required</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{pageLabels[page] || page}</span> is available to signed-in users only.
          Create a free account to unlock all features.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onSignIn}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-semibold hover:opacity-90 transition shadow-lg"
          >
            Sign In
          </button>
          <button
            onClick={() => setCurrentPage('signup')}
            className="px-6 py-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            Create Account
          </button>
        </div>
        <button
          onClick={() => setCurrentPage('home')}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition underline"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

function AccessDenied({ onSignIn, adminOnly = false }: { onSignIn: () => void; adminOnly?: boolean }) {
  const { setCurrentPage } = useApp();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {adminOnly ? 'Admin Access Required' : 'Access Denied'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {adminOnly
            ? 'This page is restricted to admin users only.'
            : 'Please sign in to access this page.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={onSignIn} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">
            Sign In
          </button>
          <button onClick={() => setCurrentPage('home')} className="px-6 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition">
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
