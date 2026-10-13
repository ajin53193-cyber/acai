import { useNavigate } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { tr } from "@/i18n";

export default function CartDrawer() {
  const { items, open, setOpen, updateQty, removeItem, subtotalUsd } = useCart();
  const { format } = useCurrency();
  const navigate = useNavigate();

  const checkout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0" data-testid="cart-drawer">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 font-head">
            <ShoppingBag className="h-5 w-5 text-orange-500" /> {tr("購物車")} ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <ShoppingBag className="h-12 w-12" />
            <p className="text-sm">{tr("購物車是空的")}</p>
            <button
              onClick={() => setOpen(false)}
              className="text-orange-500 text-sm font-semibold"
            >
              {tr("去逛逛 →")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {items.map((i) => (
                <div
                  key={i.key}
                  data-testid={`cart-item-${i.key}`}
                  className="flex gap-3 bg-slate-50 rounded-xl p-2.5"
                >
                  <img src={i.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{i.product_name}</div>
                    <div className="text-xs text-slate-500">{i.spec_label}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                        <button
                          data-testid={`cart-dec-${i.key}`}
                          onClick={() => updateQty(i.key, i.quantity - 1)}
                          className="p-1.5 text-slate-500 hover:text-orange-500"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 text-sm font-semibold w-8 text-center">{i.quantity}</span>
                        <button
                          data-testid={`cart-inc-${i.key}`}
                          onClick={() => updateQty(i.key, i.quantity + 1)}
                          className="p-1.5 text-slate-500 hover:text-orange-500"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-head font-bold text-orange-500 text-sm">
                        {format(i.unit_price_usd * i.quantity)}
                      </span>
                    </div>
                  </div>
                  <button
                    data-testid={`cart-remove-${i.key}`}
                    onClick={() => removeItem(i.key)}
                    className="text-slate-300 hover:text-red-500 self-start"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{tr("小計")}</span>
                <span className="font-head font-extrabold text-xl text-slate-900">
                  {format(subtotalUsd)}
                </span>
              </div>
              <button
                data-testid="cart-checkout-btn"
                onClick={checkout}
                className="w-full h-12 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors"
              >
                {tr("前往結賬")}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
