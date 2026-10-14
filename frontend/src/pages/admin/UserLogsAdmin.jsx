import { useState } from "react";
import { Search, X } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Card, Btn, Table, fmt, useLoad, Pill } from "./ui";

const TYPES = [["", tr("全部")], ["order", tr("訂單")], ["topup", tr("充值")], ["wallet", tr("錢包")], ["points", tr("積分")], ["ban", tr("封禁")], ["profile", tr("資料")]];
const TYPE_TONE = { order: "sky", topup: "emerald", wallet: "orange", points: "amber", ban: "red", profile: "violet" };
const TYPE_LABEL = { order: tr("訂單"), topup: tr("充值"), wallet: tr("錢包"), points: tr("積分"), ban: tr("封禁"), profile: tr("資料") };

export function UserLogsAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState({ q: "", type: "" });
  const [logs, load] = useLoad(callApi, `/admin/user-logs?type=${query.type}&q=${encodeURIComponent(query.q)}`); // eslint-disable-line

  return (
    <div data-testid="userlogs-admin">
      <Head title={tr("用戶日誌")} sub={tr("記錄用戶下單、充值、錢包、積分、封禁等關鍵行為")} />
      <Card className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" /><input data-testid="userlogs-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQuery({ q, type })} placeholder={tr("行為 / 詳情 / 用戶")} className="w-full h-9 rounded-lg bg-slate-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-300" /></div>
          <Btn data-testid="userlogs-search-btn" onClick={() => setQuery({ q, type })}>{tr("查詢")}</Btn>
          {(query.q || query.type) && <button data-testid="userlogs-clear" onClick={() => { setQ(""); setType(""); setQuery({ q: "", type: "" }); }} className="h-9 px-3 rounded-lg text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"><X className="h-3.5 w-3.5" />{tr("重置")}</button>}
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {TYPES.map(([k, l]) => <button key={k || "all"} data-testid={`userlogs-type-${k || "all"}`} onClick={() => { setType(k); setQuery({ q, type: k }); }} className={`h-8 px-3 rounded-lg text-xs font-semibold ${type === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>)}
          </div>
        </div>
      </Card>
      <Table testId="userlogs-table" cols={[tr("時間"), tr("用戶"), tr("類型"), tr("行為"), tr("詳情")]} empty={logs === null ? tr("載入中…") : tr("暫無日誌")} rows={logs || []} render={(r) => (
        <tr key={r.id} data-testid={`userlog-row-${r.id}`} className="hover:bg-slate-50">
          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
          <td className="px-4 py-3"><div className="text-slate-800 truncate max-w-[160px]">{r.user_label}</div><div className="text-[10px] text-slate-400 font-mono">{r.account_no}</div></td>
          <td className="px-4 py-3"><Pill tone={TYPE_TONE[r.type] || "slate"}>{TYPE_LABEL[r.type] || r.type}</Pill></td>
          <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">{r.action}</td>
          <td className="px-4 py-3 text-slate-500">{r.detail}</td>
        </tr>
      )} />
    </div>
  );
}
