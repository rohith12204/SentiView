import { useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, X, CheckCircle, Package } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth, authFetch } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const BASE_URL = 'https://sentiview-api-j728.onrender.com';

const DUMMY_CARDS = [
  { label: 'Visa ending 4242', icon: '💳' },
  { label: 'Mastercard ending 5555', icon: '💳' },
  { label: 'UPI / Net Banking', icon: '🏦' },
];

export default function CartPage() {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart, loading } = useCart();
  const { token, user } = useAuth();
  const { setCurrentPage } = useApp();

  const [showPayment, setShowPayment] = useState(false);
  const [selectedCard, setSelectedCard] = useState(0);
  const [cardName, setCardName] = useState('');
  const [paying, setPaying] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  const handleCheckout = async () => {
    if (!cardName.trim()) { alert('Please enter name on card'); return; }
    setPaying(true);
    try {
      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 1800));
      const res = await authFetch(`${BASE_URL}/checkout/`, token, {
        method: 'POST',
        body: JSON.stringify({ payment_method: 'card' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrderSuccess(data);
      setShowPayment(false);
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 p-10">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Payment Successful!</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Your order has been placed successfully.</p>

            <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-5 text-left mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Order ID</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">#{orderSuccess.order.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transaction</span>
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{orderSuccess.transaction_id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount Paid</span>
                <span className="font-bold text-green-600">₹{orderSuccess.order.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className="text-green-600 font-semibold capitalize">{orderSuccess.order.status}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCurrentPage('home')}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-semibold hover:opacity-90 transition"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => setCurrentPage('orders')}
                className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition"
              >
                My Orders
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            My Cart {totalItems > 0 && <span className="text-indigo-600">({totalItems})</span>}
          </h1>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-2">Your cart is empty</h2>
            <p className="text-gray-400 dark:text-gray-500 mb-6">Browse products and add items to your cart.</p>
            <button
              onClick={() => setCurrentPage('trending')}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-medium hover:opacity-90 transition"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">

            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 p-5 flex gap-4 items-center">
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-xl shrink-0 bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{item.product.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.product.brand}</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">₹{item.product.price.toLocaleString()}</p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-200 transition"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-800 dark:text-gray-200">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-200 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-800 dark:text-gray-200">₹{item.subtotal.toLocaleString()}</p>
                    <button onClick={() => removeItem(item.id)} className="mt-1 text-red-400 hover:text-red-600 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 p-6 sticky top-24">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">Order Summary</h2>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Items ({totalItems})</span>
                    <span>₹{totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Shipping</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex justify-between font-bold text-gray-900 dark:text-gray-100 text-lg">
                    <span>Total</span>
                    <span>₹{totalPrice.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <CreditCard className="w-5 h-5" />
                  Proceed to Pay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── PAYMENT MODAL ── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Secure Payment</h2>
                  <p className="text-xs text-gray-500">🔒 Demo — no real charges</p>
                </div>
              </div>
              <button onClick={() => setShowPayment(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Amount */}
              <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/30 dark:to-cyan-900/30 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Amount to Pay</span>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">₹{totalPrice.toLocaleString()}</span>
              </div>

              {/* Payment method selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Payment Method</label>
                <div className="space-y-2">
                  {DUMMY_CARDS.map((card, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        selectedCard === i
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="card"
                        checked={selectedCard === i}
                        onChange={() => setSelectedCard(i)}
                        className="accent-indigo-600"
                      />
                      <span className="text-lg">{card.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{card.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Name on card */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name on Card</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder={user?.name || 'Your Name'}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-gray-100 transition"
                />
              </div>

              {/* Dummy card number display */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Card Number</div>
                <div className="font-mono text-gray-600 dark:text-gray-400 text-sm tracking-widest">•••• •••• •••• 4242</div>
                <div className="flex gap-6 mt-2">
                  <div>
                    <div className="text-xs text-gray-400">Expiry</div>
                    <div className="font-mono text-sm text-gray-600 dark:text-gray-400">12/28</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">CVV</div>
                    <div className="font-mono text-sm text-gray-600 dark:text-gray-400">•••</div>
                  </div>
                </div>
              </div>

              {/* Pay button */}
              <button
                onClick={handleCheckout}
                disabled={paying}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Processing payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ₹{totalPrice.toLocaleString()}
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-400">
                🔒 This is a demo. No real payment is processed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
