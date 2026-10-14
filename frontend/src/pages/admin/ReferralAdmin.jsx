import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Gift, Trophy, Image as ImageIcon, Save, CheckCircle2, Clock } from "lucide-react";
import { tr } from "@/i18n";
import { Head, Btn, Input, Table, Modal, Field, Pill, Card, useLoad, ImgField, fmt } from "./ui";

const TABS = [
  ["config", tr("獎勵配置"), Gift],
  ["posters", tr("海報模板"), ImageIcon],
  ["records", tr("邀請記錄"), Users],
  ["leaderboard", tr("邀請排行榜"), Trophy],
];

function StatCard({ label, value, tone = "orange" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-head text-2xl font-extrabold text-${tone}-600 mt-1`}>{value}</div>
    </Card>
  );
}

function ConfigTab({ callApi }) {
  const [cfg, setCfg] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: "/admin/referral/config" }).then((r) => setCfg(r.data)), [callApi]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try { await callApi({ method: "PUT", url: "/admin/referral/config", data: cfg }); toast.success(tr("已儲存")); }
    catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  if (!cfg) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  return (
    <Card className="p-5 max-w-lg space-y-4" >
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" data-testid="ref-cfg-enabled" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="h-4 w-4 accent-orange-500" />
        {tr("啟用邀請返利活動")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("邀請人獲得積分")}><Input data-testid="ref-cfg-referrer" type="number" className="w-full" value={cfg.referrer_points} onChange={(e) => setCfg({ ...cfg, referrer_points: +e.target.value })} /></Field>
        <Field label={tr("受邀人獲得積分")}><Input data-testid="ref-cfg-referee" type="number" className="w-full" value={cfg.referee_points} onChange={(e) => setCfg({ ...cfg, referee_points: +e.target.value })} /></Field>
      </div>
      <div className="text-[11px] text-slate-400 -mt-2">{tr("受邀好友完成首次充值後，雙方各自獲得上述積分")}</div>
      <Field label={tr("海報主標題")}><Input data-testid="ref-cfg-title" className="w-full" value={cfg.poster_title} onChange={(e) => setCfg({ ...cfg, poster_title: e.target.value })} /></Field>
      <Field label={tr("海報副標題")}><Input data-testid="ref-cfg-subtitle" className="w-full" value={cfg.poster_subtitle} onChange={(e) => setCfg({ ...cfg, poster_subtitle: e.target.value })} /></Field>
      <Btn data-testid="ref-cfg-save" onClick={save}><Save className="h-4 w-4" />{tr("儲存配置")}</Btn>
    </Card>
  );
}

const emptyPoster = { name: "", image: "", image_b64: "", image_name: "poster.png", active: true, sort: 0 };

function PostersTab({ callApi }) {
  const [list, load] = useLoad(callApi, "/admin/referral/posters");
  const [edit, setEdit] = useState(null);
  const onImg = (v) => setEdit((s) => v?.startsWith("data:") ? { ...s, image_b64: v, image: "" } : { ...s, image: v, image_b64: "" });
  const save = async () => {
    try {
      const data = { ...edit };
      if (edit.id) await callApi({ method: "PUT", url: `/admin/referral/posters/${edit.id}`, data });
      else await callApi({ method: "POST", url: "/admin/referral/posters", data });
      toast.success(tr("已儲存")); setEdit(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("失敗")); }
  };
  const del = async (r) => { if (!window.confirm(tr("刪除此海報模板？"))) return; await callApi({ method: "DELETE", url: `/admin/referral/posters/${r.id}` }); load(); };
  return (
    <div>
      <Head title="" right={<Btn data-testid="ref-poster-add" onClick={() => setEdit({ ...emptyPoster })}><Plus className="h-4 w-4" />{tr("新增海報模板")}</Btn>} />
      <div className="text-xs text-slate-500 -mt-3 mb-3">{tr("上傳背景圖（建議直式 3:5，≤4M），用戶端生成海報時可從啟用的模板中選擇")}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ref-poster-grid">
        {(list || []).map((r) => (
          <Card key={r.id} data-testid={`ref-poster-${r.id}`} className={`overflow-hidden ${r.active ? "" : "opacity-50"}`}>
            <div className="aspect-[3/5] bg-slate-100"><img src={r.image} alt={r.name} className="h-full w-full object-cover" /></div>
            <div className="p-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                {r.active ? <Pill tone="emerald">{tr("啟用")}</Pill> : <Pill tone="slate">{tr("停用")}</Pill>}
              </div>
              <div className="flex gap-1.5 mt-2">
                <Btn kind="ghost" data-testid={`ref-poster-edit-${r.id}`} onClick={() => setEdit({ ...r, image_b64: "", image_name: "poster.png" })}><Pencil className="h-3.5 w-3.5" /></Btn>
                <Btn kind="danger" data-testid={`ref-poster-del-${r.id}`} onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Btn>
              </div>
            </div>
          </Card>
        ))}
        {list !== null && list.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-10">{tr("暫無海報模板")}</div>}
      </div>
      {edit && (
        <Modal testId="ref-poster-modal" title={<span className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-orange-500" />{edit.id ? tr("編輯海報模板") : tr("新增海報模板")}</span>} onClose={() => setEdit(null)}
          footer={<><Btn kind="ghost" onClick={() => setEdit(null)}>{tr("取消")}</Btn><Btn data-testid="ref-poster-save" onClick={save}>{tr("儲存")}</Btn></>}>
          <Field label={tr("模板名稱")}><Input data-testid="ref-poster-name" className="w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label={tr("背景圖（直式 3:5）")}><ImgField testId="ref-poster-img" ratio="aspect-[3/5]" value={edit.image_b64 || edit.image} onChange={onImg} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("排序（小在前）")}><Input data-testid="ref-poster-sort" type="number" className="w-full" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: +e.target.value })} /></Field>
            <label className="flex items-end gap-2 text-sm text-slate-700 pb-2"><input type="checkbox" data-testid="ref-poster-active" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-orange-500" />{tr("啟用")}</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RecordsTab({ callApi }) {
  const [q, setQ] = useState("");
  const [rewarded, setRewarded] = useState("");
  const [list, setList] = useState(null);
  const load = useCallback(() => callApi({ method: "GET", url: `/admin/referral/records?q=${encodeURIComponent(q)}&rewarded=${rewarded}` }).then((r) => setList(r.data)).catch(() => {}), [callApi, q, rewarded]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input data-testid="ref-rec-search" placeholder={tr("搜尋帳號/郵箱/手機")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="w-56" />
        <select data-testid="ref-rec-filter" value={rewarded} onChange={(e) => setRewarded(e.target.value)} className="h-9 rounded-lg bg-slate-100 px-3 text-sm outline-none">
          <option value="">{tr("全部狀態")}</option>
          <option value="yes">{tr("已發獎")}</option>
          <option value="no">{tr("未發獎")}</option>
        </select>
        <Btn kind="ghost" data-testid="ref-rec-refresh" onClick={load}>{tr("查詢")}</Btn>
      </div>
      <Table testId="ref-rec-table" cols={[tr("受邀人"), tr("邀請人"), tr("綁定時間"), tr("狀態"), tr("積分獎勵"), tr("發獎時間")]}
        empty={list === null ? tr("載入中…") : tr("暫無邀請記錄")} rows={list || []} render={(r, i) => (
          <tr key={i} data-testid={`ref-rec-row-${i}`} className="hover:bg-orange-50/30">
            <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.referee_label || "-"}</div><div className="text-[11px] text-slate-400">#{r.referee_account}</div></td>
            <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.inviter_label || "-"}</div><div className="text-[11px] text-slate-400">#{r.inviter_account}</div></td>
            <td className="px-4 py-3 text-slate-500">{fmt(r.referred_at)}</td>
            <td className="px-4 py-3">{r.rewarded ? <Pill tone="emerald"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{tr("已發獎")}</span></Pill> : <Pill tone="amber"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{tr("待首充")}</span></Pill>}</td>
            <td className="px-4 py-3 text-xs">{r.rewarded ? <span className="text-emerald-600 font-semibold">{tr("邀請人")} +{r.referrer_points} · {tr("受邀人")} +{r.referee_points}</span> : <span className="text-slate-400">-</span>}</td>
            <td className="px-4 py-3 text-slate-500">{fmt(r.rewarded_at)}</td>
          </tr>
        )} />
    </div>
  );
}

function LeaderboardTab({ callApi }) {
  const [list] = useLoad(callApi, "/admin/referral/leaderboard");
  const medal = ["bg-amber-400 text-white", "bg-slate-300 text-white", "bg-orange-300 text-white"];
  return (
    <Table testId="ref-lb-table" cols={[tr("排名"), tr("邀請人"), tr("成功邀請"), tr("累計積分")]}
      empty={list === null ? tr("載入中…") : tr("暫無排行數據")} rows={list || []} render={(r, i) => (
        <tr key={r.account} data-testid={`ref-lb-row-${i}`} className="hover:bg-amber-50/30">
          <td className="px-4 py-3"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-head font-bold text-sm ${medal[i] || "bg-slate-100 text-slate-500"}`}>{i + 1}</span></td>
          <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.label || "-"}</div><div className="text-[11px] text-slate-400">#{r.account}</div></td>
          <td className="px-4 py-3 font-head font-bold text-orange-600">{r.invited}</td>
          <td className="px-4 py-3 font-head font-bold text-amber-600">{r.points_earned}</td>
        </tr>
      )} />
  );
}

export function ReferralAdmin({ callApi }) {
  const [tab, setTab] = useState("config");
  const [stats, setStats] = useState(null);
  useEffect(() => { callApi({ method: "GET", url: "/admin/referral/stats" }).then((r) => setStats(r.data)).catch(() => {}); }, [callApi]);
  return (
    <div data-testid="referral-admin">
      <Head title={tr("邀請返利管理")} sub={tr("配置邀請獎勵、海報模板，查看邀請記錄與排行榜")} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label={tr("綁定邀請數")} value={stats?.total_bound ?? "—"} tone="orange" />
        <StatCard label={tr("已發獎人數")} value={stats?.total_rewarded ?? "—"} tone="emerald" />
        <StatCard label={tr("邀請人數")} value={stats?.total_inviters ?? "—"} tone="sky" />
        <StatCard label={tr("已發放積分")} value={stats?.points_granted ?? "—"} tone="amber" />
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} data-testid={`ref-tab-${k}`} onClick={() => setTab(k)}
            className={`h-9 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${tab === k ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {tab === "config" && <ConfigTab callApi={callApi} />}
      {tab === "posters" && <PostersTab callApi={callApi} />}
      {tab === "records" && <RecordsTab callApi={callApi} />}
      {tab === "leaderboard" && <LeaderboardTab callApi={callApi} />}
    </div>
  );
}
