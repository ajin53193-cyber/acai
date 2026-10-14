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
          account_field_label: product.account_field_label,
          spec_id: spec.id,
          spec_label: spec.label,
          badge: spec.badge || "",
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

  const addCombo = (combo) => {
    setItems((prev) => {
      const next = prev.map((i) => ({ ...i }));
      (combo.items || []).forEach((ci) => {
        const k = `combo_${combo.id}__${ci.product_id}__${ci.spec_id}`;
        const ex = next.find((i) => i.key === k);
        if (ex) ex.quantity += ci.quantity;
        else next.push({ key: k, product_id: ci.product_id, product_name: ci.product_name, image: ci.image, spec_id: ci.spec_id, spec_label: ci.spec_label, badge: "", unit_price_usd: ci.price_usd || 0, quantity: ci.quantity, combo_id: combo.id, combo_title: combo.title });
      });
      return next;
    });
  };

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotalUsd = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, addCombo, updateQty, removeItem, clear, count, subtotalUsd, open, setOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}
