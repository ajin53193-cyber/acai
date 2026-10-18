import { useCallback, useEffect, useState } from "react";
import { Trash2, Search, Upload, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { tr } from "@/i18n";
import { Head, Card, Btn, Input, Field, Table, Pill, fmt } from "./ui";

export function GiftCardPoolAdmin({ callApi }) {
  const [q, setQ] = useState("");
  const [unmatched, setUnmatched] = useState(false);
  const [data, setData] = useState({ rows: [], total: 0, unmatched: 0 });
  const [lines, setLines] = useState("");
  const [note, setNote] = useState("");
  const [cfg, setCfg] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/giftcard/numbers", params: { q, unmatched: unmatched ? "1" : "", size: 200 } }).then((r) => setData(r.data)).catch(() => toast.error(tr("載入失敗"))), [callApi, q, unmatched]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { callApi({ method: "GET", url: "/admin/giftcard/settings" }).then((r) => setCfg(r.data)).catch(() => {}); }, [callApi]);
  const add = async () => {
    if (!lines.trim()) return toast.error(tr("請輸入號碼"));
    try { const r = await callApi({ method: "POST", url: "/admin/giftcard/numbers", data: { lines, note } }); toast.success(tr("新增 {0} 筆 · 重複略過 {1} 筆", r.data.added, r.data.skipped)); setLines(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("新增失敗")); }
  };
  const saveCfg = async (patch) => { const next = { ...cfg, ...patch }; setCfg(next); try { const r = await callApi({ method: "PUT", url: "/admin/giftcard/settings", data: { auto_review_enabled: !!next.auto_review_enabled, auto_delay_min: +next.auto_delay_min, auto_delay_max: +next.auto_delay_max } }); setCfg(r.data); toast.success(tr("已儲存")); } catch { toast.error(tr("儲存失敗")); } };
  const del = async (n) => { if (!window.confirm(tr("確定刪除號碼 {0}？", n.raw || n.key))) return; await callApi({ method: "DELETE", url: `/admin/giftcard/numbers/${n.id}` }); load(); };
  const clearUnmatched = async () => { if (!window.confirm(tr("將刪除所有從未命中（hitCount=0）的號碼，包括剛錄入尚未使用的，確定？"))) return; const r = await callApi({ method: "DELETE", url: "/admin/giftcard/numbers/unmatched" }); toast.success(tr("已清理 {0} 筆", r.data.deleted)); load(); };
  return (
    <div data-testid="giftcard-pool-admin">
      <Head title={tr("號碼庫")} sub={tr("允許自動通過的白名單：用戶提交轉贈資料時，系統將填寫的號碼標準化（去空白、轉小寫）後與號碼庫精確比對；命中則排定隨機延遲後自動完成並生成交易號，未命中轉人工。")} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <Field label={tr("批量新增號碼（支持空格、換行、逗號、分號分隔；建議錄純數字並與用戶填寫格式一致）")}>
            <textarea data-testid="gcp-lines" rows={5} className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-orange-300" value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"98777777 61234567\n91234567,92345678"} />
          </Field>
          <div className="flex items-center gap-2 mt-2"><Input data-testid="gcp-note" className="flex-1" placeholder={tr("備註（選填，如：批次說明）")} value={note} onChange={(e) => setNote(e.target.value)} /><Btn data-testid="gcp-add" onClick={add}><Upload className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("加入號碼庫")}</Btn></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3"><span className="text-sm font-semibold text-slate-700">{tr("禮品卡自動審核")}</span>{cfg && <Switch data-testid="gcp-auto-enabled" checked={!!cfg.auto_review_enabled} onCheckedChange={(v) => saveCfg({ auto_review_enabled: v })} />}</div>
          <div className="text-xs text-slate-500 mb-2">{tr("自動完成延遲區間（分鐘）")}<span className="text-slate-400">{tr("，顧客端固定顯示 90 秒倒計時，訂單會在此區間內隨機提前完成")}</span></div>
          {cfg && <div className="flex items-center gap-2 text-sm"><Input data-testid="gcp-delay-min" type="number" step="0.5" min="0.5" max="1.5" className="w-20" value={cfg.auto_delay_min} onChange={(e) => setCfg({ ...cfg, auto_delay_min: e.target.value })} /> ~ <Input data-testid="gcp-delay-max" type="number" step="0.5" min="0.5" max="1.5" className="w-20" value={cfg.auto_delay_max} onChange={(e) => setCfg({ ...cfg, auto_delay_max: e.target.value })} /><Btn data-testid="gcp-delay-save" kind="ghost" onClick={() => saveCfg({})}>{tr("儲存")}</Btn></div>}
          <div className="text-[11px] text-slate-400 mt-2">{tr("關閉自動審核後不比對號碼庫，所有訂單直接轉人工。")}</div>
        </Card>
      </div>
      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" /><Input data-testid="gcp-search" className="w-64" placeholder={tr("搜尋號碼 / 備註")} value={q} onChange={(e) => setQ(e.target.value)} />
        <button data-testid="gcp-filter-unmatched" onClick={() => setUnmatched(!unmatched)} className={`h-8 px-3 rounded-lg text-xs font-semibold ${unmatched ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>{tr("只看未命中")} ({data.unmatched})</button>
        <Btn data-testid="gcp-clear-unmatched" kind="ghost" onClick={clearUnmatched}><Trash2 className="h-4 w-4 inline -mt-0.5 mr-1" />{tr("一鍵清理未命中")}</Btn>
        <span className="text-xs text-slate-400 ml-auto">{tr("共 {0} 個號碼", data.total)}</span>
      </Card>
      <Card className="overflow-hidden">
        <Table testId="gcp-table" cols={[tr("號碼（標準化）"), tr("原文"), tr("備註"), tr("命中次數"), tr("最近命中"), tr("錄入時間 / 錄入人"), ""]} rows={data.rows} empty={tr("號碼庫為空")} render={(n) => (
          <tr key={n.id} data-testid={`gcp-row-${n.id}`} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{n.key}</td><td className="px-4 py-2.5 font-mono text-xs text-slate-500">{n.raw}</td><td className="px-4 py-2.5 text-slate-500 text-xs max-w-[220px] truncate">{n.note || "-"}</td>
            <td className="px-4 py-2.5"><Pill tone={n.hitCount ? "emerald" : "slate"}>{n.hitCount || 0}</Pill></td>
            <td className="px-4 py-2.5 text-xs text-slate-400">{n.lastHitAt ? fmt(n.lastHitAt) : "-"}</td>
            <td className="px-4 py-2.5 text-xs text-slate-400">{fmt(n.createdAt)}<br />{n.addedBy}</td>
            <td className="px-4 py-2.5"><button data-testid={`gcp-del-${n.id}`} onClick={() => del(n)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
          </tr>
        )} />
      </Card>
    </div>
  );
}

const TABS = [["", "全部"], ["need_info", "待填資料"], ["processing", "系統轉贈中"], ["auto_failed", "自動轉贈失敗·待重填"], ["manual", "未命中·待人工"], ["completed", "已完成"], ["redeemed", "已核銷"], ["cancelled", "已取消"]];
const stateOf = (o) => o.redeemed ? ["已核銷", "violet"] : o.status === "completed" ? ["已完成", "emerald"] : o.status === "cancelled" ? ["已取消", "slate"] : o.status === "processing" ? (o.gift_manual ? ["未命中·待人工", "red"] : ["系統轉贈中", "amber"]) : o.status === "paid" ? (o.gift_auto_failed && o.info_submitted === false ? ["自動轉贈失敗·待重填", "red"] : o.info_rejected ? ["已駁回·待重填", "red"] : (o.info_submitted === false || !Object.keys(o.delivery_info || {}).length) ? ["待填資料", "sky"] : ["已付款·待人工", "amber"]) : [o.status, "slate"];
const infoText = (o) => Object.values(o.delivery_info || {}).flatMap((d) => Object.entries(d || {})).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("，") || "-";

export function GiftCardOrdersAdmin({ callApi }) {
  const [status, setStatus] = useState(() => { const s = sessionStorage.getItem("gco-status") || ""; sessionStorage.removeItem("gco-status"); return s; });
  const [q, setQ] = useState("");
  const [data, setData] = useState({ rows: [], counts: {} });
  const [sel, setSel] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/giftcard/orders", params: { status, q } }).then((r) => { setData(r.data); setSel([]); }).catch(() => toast.error(tr("載入失敗"))), [callApi, status, q]);
  useEffect(() => { load(); }, [load]);
  const [ask, setAsk] = useState(null);
  const ACT_UI = {
    cancel: { title: tr("取消訂單"), desc: tr("將取消 {0} 筆訂單，款項退回用戶餘額並恢復庫存。取消原因會顯示在用戶的訂單詳情中。"), label: tr("取消原因（用戶可見）"), presets: [tr("號碼有誤且無法聯繫到您，款項已退回餘額"), tr("該帳號暫不支持轉贈，款項已退回餘額"), tr("庫存不足，款項已退回餘額"), tr("應您的要求取消訂單")], confirm: tr("確認取消並退款"), danger: true },
    reject: { title: tr("駁回充值資料"), desc: tr("用戶需重新填寫轉贈帳號，不退款。駁回原因會顯示給用戶。"), label: tr("駁回原因（用戶可見）"), presets: [tr("轉贈帳號有誤，請重新填寫"), tr("帳號未開通 AlipayHK，請更換帳號"), tr("帳號格式不正確，請填寫 8 位手機號")], confirm: tr("確認駁回"), danger: true },
    supplement: { title: tr("補號並重審"), desc: tr("將把這些訂單填寫的號碼加入號碼庫並重新自動審核。"), label: "", presets: [], confirm: tr("確認補號"), danger: false },
  };
  const act = (kind, ids) => {
    if (!ids.length) return toast.error(tr("請先勾選訂單"));
    if (ACT_UI[kind]) return setAsk({ kind, ids, reason: ACT_UI[kind].presets[0] || "" });
    run(kind, ids, "");
  };
  const run = async (kind, ids, reason) => {
    try { const r = await callApi({ method: "POST", url: `/admin/giftcard/orders/${kind}`, data: { ids, reason } }); toast.success(tr("已處理 {0} 筆", r.data.done)); setAsk(null); load(); window.dispatchEvent(new Event("admin-badge-refresh")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("操作失敗")); }
  };
  const allIds = data.rows.map((o) => o.id);
  return (
    <div data-testid="giftcard-orders-admin">
      {ask && (() => { const u = ACT_UI[ask.kind]; return (
        <Dialog open onOpenChange={() => setAsk(null)}>
          <DialogContent className="max-w-md bg-white rounded-3xl" data-testid="gco-act-dialog">
            <DialogHeader><DialogTitle className="font-head text-lg">{u.title}</DialogTitle><DialogDescription className="text-slate-500">{u.desc.replace("{0}", ask.ids.length)}</DialogDescription></DialogHeader>
            {u.label && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600">{u.label}</div>
                <div className="flex flex-wrap gap-1.5">{u.presets.map((t) => <button key={t} data-testid="gco-act-preset" onClick={() => setAsk({ ...ask, reason: t })} className={`rounded-full px-3 py-1 text-xs ${ask.reason === t ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"}`}>{t}</button>)}</div>
                <textarea data-testid="gco-act-reason" value={ask.reason} onChange={(e) => setAsk({ ...ask, reason: e.target.value })} rows={3} className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300" placeholder={tr("輸入原因…")} />
              </div>
            )}
            <DialogFooter className="gap-2">
              <Btn kind="ghost" onClick={() => setAsk(null)}>{tr("返回")}</Btn>
              <Btn data-testid="gco-act-confirm" kind={u.danger ? "danger" : undefined} onClick={() => { if (u.label && !ask.reason.trim()) return toast.error(tr("請填寫原因")); run(ask.kind, ask.ids, ask.reason.trim()); }}>{u.confirm}</Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ); })()}
      <Head title={tr("禮品卡訂單管理")} sub={tr("未命中號碼庫的訂單需人工完成（自動生成交易號）/ 駁回（用戶重填，不退款）/ 取消（退款並恢復庫存）。支持多選批量操作。")} />
      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        {TABS.map(([k, l]) => <button key={k} data-testid={`gco-tab-${k || "all"}`} onClick={() => setStatus(k)} className={`h-8 px-3 rounded-lg text-xs font-semibold ${status === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tr(l)}{k && data.counts[k] ? ` (${data.counts[k]})` : ""}</button>)}
        <div className="ml-auto flex items-center gap-2"><Input data-testid="gco-search" className="w-64" placeholder={tr("訂單號 / 交易號 / 帳號 / 信箱")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </Card>
      <Card className="p-3 mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">{tr("已選 {0} 筆", sel.length)}</span>
        <Btn data-testid="gco-bulk-complete" onClick={() => act("complete", sel)}>{tr("批量完成")}</Btn>
        <Btn data-testid="gco-bulk-supplement" kind="ghost" onClick={() => act("supplement", sel)}>{tr("補號並重審")}</Btn>
        <Btn data-testid="gco-bulk-reject" kind="ghost" onClick={() => act("reject", sel)}>{tr("批量駁回")}</Btn>
        <Btn data-testid="gco-bulk-cancel" kind="ghost" onClick={() => act("cancel", sel)}>{tr("取消訂單")}</Btn>
      </Card>
      <Card className="overflow-hidden">
        <Table testId="gco-table" stickyLast cols={[<input key="all" type="checkbox" checked={sel.length > 0 && sel.length === allIds.length} onChange={(e) => setSel(e.target.checked ? allIds : [])} className="h-4 w-4 accent-orange-500" />, tr("訂單號 / 時間"), tr("用戶"), tr("商品"), tr("轉贈資料"), tr("金額"), tr("交易號"), tr("狀態"), tr("操作")]} rows={data.rows} empty={tr("暫無禮品卡訂單")} render={(o) => {
          const [lbl, tone] = stateOf(o);
          return (
            <tr key={o.id} data-testid={`gco-row-${o.id}`} className="hover:bg-slate-50 align-top">
              <td className="px-4 py-3"><input type="checkbox" checked={sel.includes(o.id)} onChange={(e) => setSel(e.target.checked ? [...sel, o.id] : sel.filter((x) => x !== o.id))} className="h-4 w-4 accent-orange-500" /></td>
              <td className="px-4 py-3 whitespace-nowrap"><div className="font-mono text-xs font-semibold text-slate-800">{o.order_no}</div><div className="text-[11px] text-slate-400">{fmt(o.created_at)}</div>{o.gift_dispatch_at && o.status === "processing" && <div className="text-[10px] text-amber-600">{tr("預計完成")} {fmt(o.gift_dispatch_at)}</div>}{o.matchedKey && <div className="text-[10px] text-emerald-600">{tr("命中")} {o.matchedKey}</div>}</td>
              <td className="px-4 py-3 whitespace-nowrap"><div className="font-head font-bold text-xs text-slate-800">{o.account_no}</div><div className="text-[11px] text-slate-400 truncate max-w-[150px]">{o.user_email}</div></td>
              <td className="px-4 py-3 min-w-[170px]">{(o.items || []).map((i, k) => <div key={k} className="text-xs"><span className="text-slate-800">{i.product_name}</span><br /><span className="text-slate-400">{i.spec_label} ×{i.quantity}</span></div>)}</td>
              <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] min-w-[150px] break-all">{infoText(o)}{o.info_rejected && o.status === "paid" && <div className="text-[10px] text-red-500 mt-1">{tr("駁回：{0}", o.info_reject_reason)}</div>}{o.status === "processing" && o.gift_manual && <div className="text-[10px] text-red-600 font-semibold mt-1" data-testid={`gco-manual-hint-${o.id}`}>{o.gift_auto_failed ? tr("用戶已重新提交帳號 · 請人工轉贈後點「完成」") : tr("待人工轉贈 · 完成後點「完成」")}{o.info_submitted_at && <span className="text-slate-400 font-normal"> {fmt(o.info_submitted_at)}</span>}</div>}</td>
              <td className="px-4 py-3 whitespace-nowrap font-semibold text-orange-600">USD {(+o.total_usd || 0).toFixed(2)}</td>
              <td className="px-4 py-3">{(o.gift_trade_nos || []).length === 0 ? <span className="text-xs text-slate-400">-</span> : o.gift_trade_nos.map((g, i) => <div key={i} className="font-mono text-[11px] text-violet-700" data-testid={`gco-trade-${o.id}-${i}`}>{g.trade_no}</div>)}</td>
              <td className="px-4 py-3 whitespace-nowrap"><Pill tone={tone}>{tr(lbl)}</Pill></td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button data-testid={`gco-open-${o.id}`} onClick={() => setDetailId(o.id)} className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"><FileSearch className="h-3.5 w-3.5" />{tr("詳情 / 操作")}</button>
              </td>
            </tr>
          );
        }} />
      </Card>
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="gco-detail-dialog">
          {(() => {
            const o = data.rows.find((x) => x.id === detailId);
            if (!o) return null;
            const [lbl, tone] = stateOf(o);
            const close = () => setDetailId(null);
            const Info = ({ label, children }) => (
              <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-[13px] text-slate-500 shrink-0">{label}</span>
                <span className="text-[13px] text-slate-800 text-right break-all">{children}</span>
              </div>
            );
            return (
              <div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] text-white/70">{tr("訂單號 / 時間")}</div>
                      <div className="font-mono text-sm font-bold truncate">{o.order_no}</div>
                      <div className="text-[11px] text-white/60 mt-0.5">{fmt(o.created_at)}</div>
                    </div>
                    <Pill tone={tone}>{tr(lbl)}</Pill>
                  </div>
                </div>
                <div className="px-5 py-3 max-h-[46vh] overflow-y-auto">
                  <Info label={tr("帳戶ID")}><b>{o.account_no}</b></Info>
                  {o.user_email && <Info label={tr("用戶")}>{o.user_email}</Info>}
                  <Info label={tr("商品")}>{(o.items || []).map((i) => `${i.product_name} ${i.spec_label}×${i.quantity}`).join("、")}</Info>
                  <Info label={tr("轉贈資料")}>{infoText(o)}</Info>
                  <Info label={tr("金額")}><b className="text-orange-600">USD {(+o.total_usd || 0).toFixed(2)}</b></Info>
                  {(o.gift_trade_nos || []).length > 0 && <Info label={tr("交易號")}><div className="space-y-0.5">{o.gift_trade_nos.map((g, i) => <div key={i} className="font-mono text-[12px] text-violet-700">{g.trade_no}</div>)}</div></Info>}
                  {o.matchedKey && <Info label={tr("命中號碼")}><span className="text-emerald-600 font-mono">{o.matchedKey}</span></Info>}
                  {o.gift_dispatch_at && o.status === "processing" && <Info label={tr("預計完成")}>{fmt(o.gift_dispatch_at)}</Info>}
                  {o.info_rejected && o.info_reject_reason && <Info label={tr("駁回原因")}><span className="text-red-500">{o.info_reject_reason}</span></Info>}
                  {o.status === "processing" && o.gift_manual && <div className="mt-2 text-[12px] text-red-600 font-semibold">{o.gift_auto_failed ? tr("用戶已重新提交帳號 · 請人工轉贈後點「完成」") : tr("待人工轉贈 · 完成後點「完成」")}</div>}
                </div>
                {["paid", "processing"].includes(o.status) && (
                  <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2 justify-end bg-slate-50/60">
                    <button data-testid={`gco-complete-${o.id}`} onClick={() => { close(); act("complete", [o.id]); }} className="text-xs h-8 px-3 rounded-lg bg-emerald-500 text-white font-semibold">{tr("完成")}</button>
                    <button data-testid={`gco-reject-${o.id}`} onClick={() => { close(); act("reject", [o.id]); }} className="text-xs h-8 px-3 rounded-lg bg-amber-500 text-white">{tr("駁回")}</button>
                    {o.gift_manual && <button data-testid={`gco-supplement-${o.id}`} onClick={() => { close(); act("supplement", [o.id]); }} className="text-xs h-8 px-3 rounded-lg bg-violet-600 text-white">{tr("補號重審")}</button>}
                    <button data-testid={`gco-cancel-${o.id}`} onClick={() => { close(); act("cancel", [o.id]); }} className="text-xs h-8 px-3 rounded-lg border border-red-300 text-red-600 bg-white">{tr("取消")}</button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
