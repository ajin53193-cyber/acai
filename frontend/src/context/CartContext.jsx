import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("gt_cart") || "[]");
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("gt_cart", JSON.stringify(items));
  }, [items]);

  const key = (pid, sid) => `${pid}__${sid}`;

  const addItem = (product, spec, quantity = 1) => {
    setItems((prev) => {
      const k = key(product.id, spec.id);
      const existing = prev.find((i) => i.key === k);
      if (existing) {
        return prev.map((i) => (i.key === k ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [
        ...prev,
        {
          key: k,
          product_id: product.id,
          product_name: product.name,
          image: product.image,
          spec_id: spec.id,
          spec_label: spec.label,
          unit_price_usd: spec.price_usd,
          quantity,
        },
      ];
    });
  };

  const updateQty = (k, quantity) =>
    setItems((prev) => prev.map((i) => (i.key === k ? { ...i, quantity: Math.max(1, quantity) } : i)));
  const removeItem = (k) => setItems((prev) => prev.filter((i) => i.key !== k));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotalUsd = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQty, removeItem, clear, count, subtotalUsd, open, setOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}
