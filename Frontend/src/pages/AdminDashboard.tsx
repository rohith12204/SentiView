import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, X, Save, Package, ShoppingBag, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const BASE_URL = 'https://sentiview-api-j728.onrender.com';

const EMPTY_FORM = {
  name: '', brand: '', model_name: '', price: '', description: '',
  image_url: '', category: 'Smartphone', stock: '10',
  ram: '', battery: '', display: '', processor: '',
  is_active: true,
  image_file: null as File | null,   // ✅ new: holds the uploaded file
};

export default function AdminDashboard() {
  const { token, isAdmin } = useAuth();
  const { setCurrentPage } = useApp();

  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── preview URL for selected image file ──
  const [imagePreview, setImagePreview] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        authFetch(`${BASE_URL}/admin/products/`, token),
        authFetch(`${BASE_URL}/admin/orders/`, token),
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (oRes.ok) setOrders(await oRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditProduct(null);
    setForm({ ...EMPTY_FORM });
    setImagePreview('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditProduct(p);
    setForm({
      name: p.name, brand: p.brand, model_name: p.model,
      price: String(p.price), description: p.description,
      image_url: p.image_url || '', category: p.category,
      stock: String(p.stock), ram: p.specs?.ram || '',
      battery: p.specs?.battery || '', display: p.specs?.display || '',
      processor: p.specs?.processor || '', is_active: p.is_active,
      image_file: null,
    });
    setImagePreview(p.image_url || ''); // show existing image as preview
    setFormError('');
    setShowForm(true);
  };

  // ── called when user picks a file ──
  const handleImageChange = (file: File | null) => {
    setForm({ ...form, image_file: file });
    if (file) {
      setImagePreview(URL.createObjectURL(file)); // local preview
    } else {
      setImagePreview('');
    }
  };

  const saveProduct = async () => {
    setFormError('');
    if (!form.name || !form.brand || !form.model_name || !form.price) {
      setFormError('Name, brand, model and price are required'); return;
    }
    setSaving(true);
    try {
      const url = editProduct
        ? `${BASE_URL}/admin/products/${editProduct.id}/`
        : `${BASE_URL}/admin/products/`;
      const method = editProduct ? 'PUT' : 'POST';

      // ✅ Use FormData so we can send file + text together
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('brand', form.brand);
      formData.append('model_name', form.model_name);
      formData.append('price', String(parseFloat(form.price)));
      formData.append('stock', String(parseInt(form.stock)));
      formData.append('description', form.description);
      formData.append('category', form.category);
      formData.append('image_url', form.image_url);
      formData.append('ram', form.ram);
      formData.append('battery', form.battery);
      formData.append('display', form.display);
      formData.append('processor', form.processor);
      formData.append('is_active', String(form.is_active));
      if (form.image_file) {
        formData.append('image', form.image_file); // ✅ attach uploaded image
      }

      const res = await authFetch(url, token, {
        method,
        body: formData,
        // ✅ Do NOT set Content-Type — browser sets multipart boundary automatically
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: number) => {
    await authFetch(`${BASE_URL}/admin/products/${id}/`, token, { method: 'DELETE' });
    setDeleteConfirm(null);
    load();
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await authFetch(`${BASE_URL}/admin/orders/${orderId}/status/`, token, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    load();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">You need admin privileges to access this page.</p>
          <button onClick={() => setCurrentPage('signin')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
            Sign In as Admin
          </button>
        </div>
      </div>
    );
  }

  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total_amount, 0);
  const activeProducts = products.filter(p => p.is_active).length;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage products and view orders</p>
          </div>
          {tab === 'products' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-medium hover:opacity-90 transition shadow-lg"
            >
              <Plus className="w-5 h-5" /> Add Product
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Package, label: 'Total Products', value: products.length, color: 'from-indigo-500 to-cyan-500' },
            { icon: CheckCircle, label: 'Active Products', value: activeProducts, color: 'from-green-500 to-emerald-500' },
            { icon: ShoppingBag, label: 'Total Orders', value: orders.length, color: 'from-orange-500 to-amber-500' },
            { icon: TrendingUp, label: 'Revenue (Paid)', value: `₹${totalRevenue.toLocaleString()}`, color: 'from-purple-500 to-pink-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={`bg-gradient-to-br ${color} rounded-2xl p-5 text-white shadow`}>
              <Icon className="w-6 h-6 mb-3 opacity-80" />
              <p className="text-sm opacity-80">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['products', 'orders'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl font-medium capitalize transition ${
                tab === t
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 animate-pulse">Loading...</div>
        ) : tab === 'products' ? (

          /* ── PRODUCTS TABLE ── */
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 overflow-hidden">
            {products.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No products yet. Click "Add Product" to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      {['Product', 'Brand', 'Price', 'Stock', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-4 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{p.brand}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400">₹{p.price.toLocaleString()}</td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-medium ${p.stock > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-red-500'}`}>
                            {p.stock > 0 ? p.stock : 'Out of stock'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(p.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : (

          /* ── ORDERS TABLE ── */
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-gray-100 dark:border-slate-700 overflow-hidden">
            {orders.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No orders yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      {['Order', 'User', 'Items', 'Total', 'Status', 'Change Status'].map((h) => (
                        <th key={h} className="px-5 py-4 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-5 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">#{o.id}</td>
                        <td className="px-5 py-4 text-sm text-gray-800 dark:text-gray-200">{o.user}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{o.items.length} item(s)</td>
                        <td className="px-5 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">₹{o.total_amount.toLocaleString()}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={o.status}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                            className="text-xs px-2 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ADD / EDIT PRODUCT MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {editProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-xl text-red-700 dark:text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Product Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. iPhone 15 Pro" span2 />
                <Field label="Brand *" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} placeholder="Apple" />
                <Field label="Model *" value={form.model_name} onChange={(v) => setForm({ ...form, model_name: v })} placeholder="15 Pro" />
                <Field label="Price (₹) *" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="99999" type="number" />
                <Field label="Stock" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} placeholder="10" type="number" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Smartphone', 'Laptop', 'Tablet', 'Smartwatch', 'Earphone', 'Other'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* ✅ Image Upload Field (replaces image URL) */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-medium hover:file:bg-indigo-100 transition"
                  />
                  {/* Image preview */}
                  {imagePreview && (
                    <div className="mt-3 relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-28 w-28 object-cover rounded-xl border border-gray-200 dark:border-slate-700"
                      />
                      <button
                        onClick={() => { handleImageChange(null); setImagePreview(''); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {/* Fallback: also allow image URL */}
                  <p className="text-xs text-gray-400 mt-2">Or paste an image URL below (optional fallback)</p>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                    className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Brief description..." span2 textarea />
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Specifications</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="RAM" value={form.ram} onChange={(v) => setForm({ ...form, ram: v })} placeholder="8GB" />
                  <Field label="Battery" value={form.battery} onChange={(v) => setForm({ ...form, battery: v })} placeholder="4000 mAh" />
                  <Field label="Display" value={form.display} onChange={(v) => setForm({ ...form, display: v })} placeholder='6.1" OLED' />
                  <Field label="Processor" value={form.processor} onChange={(v) => setForm({ ...form, processor: v })} placeholder="A17 Pro" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">Active (visible to users)</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProduct}
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : editProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-6 w-full max-w-sm text-center">
            <Trash2 className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Product?</h3>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">Cancel</button>
              <button onClick={() => deleteProduct(deleteConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', span2 = false, textarea = false }: any) {
  const cls = `w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition`;
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    delivered: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}