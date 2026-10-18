import { useState } from "react";
import { Gift, ListOrdered } from "lucide-react";
import { tr } from "@/i18n";
import { OrdersAdmin } from "@/pages/admin/OrdersAdmin";
import { GiftCardOrdersAdmin } from "@/pages/admin/GiftCardPoolAdmin";

const TABS = [["gift", tr("禮品卡訂單"), Gift], ["all", tr("全部訂單"), ListOrdered]];

export function OrdersHubAdmin({ callApi, defaultTab = "gift" }) {
  const [tab, setTab] = useState(() => { sessionStorage.removeItem("orders-hub-tab"); return defaultTab; });
  return (
    <div data-testid="orders-hub-admin">
      <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4" data-testid="orders-hub-tabs">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} data-testid={`orders-hub-tab-${k}`} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${tab === k ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            <Icon className="h-4 w-4" />{l}
          </button>
        ))}
      </div>
      {tab === "gift" ? <GiftCardOrdersAdmin callApi={callApi} /> : <OrdersAdmin callApi={callApi} />}
    </div>
  );
}
