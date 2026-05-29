import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth, authFetch } from './AuthContext';

const BASE_URL = 'https://sentiview-api-j728.onrender.com';

export interface CartItem {
  id: number;
  product: any;
  quantity: number;
  subtotal: number;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  loading: boolean;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [items, setItems]     = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCart = async () => {
    if (!isAuthenticated || !token) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await authFetch(`${BASE_URL}/cart/`, token);
      if (res.ok) setItems(await res.json());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // BUG FIX: also re-fetch when token changes (i.e. after login)
  useEffect(() => { fetchCart(); }, [isAuthenticated, token]);

  const addToCart = async (productId: number, quantity = 1) => {
    if (!token) return;
    const res = await authFetch(`${BASE_URL}/cart/add/`, token, {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity }),
    });
    if (res.ok) {
      await fetchCart();
    } else {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to add to cart');
    }
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (!token) return;
    const res = await authFetch(`${BASE_URL}/cart/${itemId}/update/`, token, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
    if (res.ok) await fetchCart();
  };

  const removeItem = async (itemId: number) => {
    if (!token) return;
    await authFetch(`${BASE_URL}/cart/${itemId}/remove/`, token, { method: 'DELETE' });
    await fetchCart();
  };

  const clearCart = async () => {
    if (!token) return;
    await authFetch(`${BASE_URL}/cart/clear/`, token, { method: 'DELETE' });
    setItems([]);
  };

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.subtotal, 0);

  return (
    <CartContext.Provider value={{
      items, totalItems, totalPrice, loading,
      addToCart, updateQuantity, removeItem, clearCart,
      refreshCart: fetchCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
