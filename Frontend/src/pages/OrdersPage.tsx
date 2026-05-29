import { useEffect, useState } from 'react';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const BASE_URL = 'https://sentiview-api-j728.onrender.com';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    shipped: 'bg-blue-100 text-blue-700',
    delivered: 'bg-indigo-100 text-indigo-700',
    cancelled: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function OrdersPage() {
  const { token } = useAuth();
  const { setCurrentPage } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    authFetch(`${BASE_URL}/orders/`, token)
      .then((r) => r.json())
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center animate-pulse text-gray-400">Loading orders...</div>;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Package className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Orders</h1>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No orders yet.</p>
            <button onClick={() => setCurrentPage('trending')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
              Browse Products
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Order #{order.id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={order.status} />
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{order.total_amount.toLocaleString()}</span>
                    {expanded === order.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {expanded === order.id && (
                  <div className="border-t border-gray-100 dark:border-slate-800 p-5 space-y-3">
                    {order.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{item.product_name} × {item.quantity}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">₹{item.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex justify-between text-sm">
                      <span className="text-gray-500">Transaction ID</span>
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{order.transaction_id}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
