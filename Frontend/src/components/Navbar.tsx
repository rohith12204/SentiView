import { useState } from 'react';
import {
  Home, Search, TrendingUp, GitCompare, LineChart, BarChart3,
  Moon, Sun, Menu, X, ShoppingCart, LogOut, User, Shield, Package, ShieldAlert
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { currentPage, setCurrentPage } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { id: 'home',          label: 'Home',               icon: Home },
    { id: 'search',        label: 'Search Product',      icon: Search },
    { id: 'trending',      label: 'Trending',            icon: TrendingUp },
    { id: 'compare',       label: 'Compare',             icon: GitCompare },
    { id: 'timeline',      label: 'Sentiment Over Time', icon: LineChart },
    { id: 'insights',      label: 'Dashboard',           icon: BarChart3 },
    { id: 'fake-analysis', label: 'Fake Review Analysis',icon: ShieldAlert },
  ];

  const handleNav = (id: string) => {
    setCurrentPage(id as any);
    setMenuOpen(false);
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setCurrentPage('home');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/50 px-5 py-3 transition-all duration-200">
          <div className="flex items-center justify-between">

            {/* ── Logo ── */}
            <button onClick={() => handleNav('home')} className="flex items-center space-x-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Sentiview
              </span>
            </button>

            {/* ── Desktop nav links ── */}
            <div className="hidden lg:flex items-center space-x-0.5">
              {navItems.map(({ id, label, icon: Icon }) => {
                const isActive = currentPage === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleNav(id)}
                    className={`relative px-3 py-2 rounded-xl transition-all duration-200 flex items-center space-x-1.5 text-sm font-medium ${
                      isActive
                        ? 'text-indigo-600 dark:text-cyan-400'
                        : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                    {isActive && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Right controls ── */}
            <div className="flex items-center space-x-2">

              {/* Dark mode */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light'
                  ? <Moon className="w-5 h-5 text-gray-600" />
                  : <Sun className="w-5 h-5 text-gray-300" />}
              </button>

              {isAuthenticated ? (
                <>
                  {/* Cart icon with badge */}
                  <button
                    onClick={() => handleNav('cart')}
                    className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    title="My Cart"
                  >
                    <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    {totalItems > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-indigo-600 to-cyan-600 text-white text-xs rounded-full flex items-center justify-center font-bold shadow">
                        {totalItems > 9 ? '9+' : totalItems}
                      </span>
                    )}
                  </button>

                  {/* User menu */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                        {(user?.name || user?.username || '?')[0].toUpperCase()}
                      </div>
                      <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-20 truncate">
                        {user?.name || user?.username}
                      </span>
                    </button>

                    {userMenuOpen && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                        {/* Dropdown */}
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50">
                          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                            {isAdmin && (
                              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-md text-xs font-medium">
                                <Shield className="w-3 h-3" /> Admin
                              </span>
                            )}
                          </div>

                          <div className="py-1">
                            <MenuItem icon={Package} label="My Orders" onClick={() => { handleNav('orders'); }} />
                            {isAdmin && (
                              <MenuItem icon={Shield} label="Admin Dashboard" onClick={() => { handleNav('admin'); }} highlight />
                            )}
                            <div className="border-t border-gray-100 dark:border-slate-800 mt-1 pt-1">
                              <MenuItem icon={LogOut} label="Sign Out" onClick={handleLogout} danger />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setCurrentPage('signin')}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}

              {/* Hamburger — mobile */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                {menuOpen
                  ? <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  : <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
              </button>
            </div>
          </div>

          {/* ── Mobile dropdown ── */}
          {menuOpen && (
            <div className="lg:hidden mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 space-y-1">
              {navItems.map(({ id, label, icon: Icon }) => {
                const isActive = currentPage === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleNav(id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                );
              })}

              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => handleNav('cart')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="text-sm font-medium">Cart</span>
                    </div>
                    {totalItems > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full font-bold">{totalItems}</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleNav('orders')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                  >
                    <Package className="w-4 h-4" />
                    <span className="text-sm font-medium">My Orders</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleNav('admin')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                    >
                      <Shield className="w-4 h-4" />
                      <span className="text-sm font-medium">Admin Dashboard</span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setCurrentPage('signin'); setMenuOpen(false); }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-medium text-sm mt-2"
                >
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function MenuItem({ icon: Icon, label, onClick, highlight = false, danger = false }: {
  icon: any; label: string; onClick: () => void; highlight?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : highlight
          ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
