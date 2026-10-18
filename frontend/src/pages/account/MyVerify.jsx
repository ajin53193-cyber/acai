import { useEffect, useRef, useState } from "react";
import { fmtBJ, bjToday } from "@/lib/bjtime";
import { Check, Plus, ShieldCheck, CreditCard, ChevronLeft } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, OrangeBtn, SubTabs } from "./AccountLayout";
import { tr } from "@/i18n";

const STATUS = { pending: tr("待完善"), reviewing: tr("審核中"), approved: tr("審核通過"), rejected: tr("審核拒絕") };
const DOC_TYPES = [tr("護照"), tr("駕照"), tr("學生證"), tr("身分證ID卡"), tr("其他")];
const CARD_TYPES = [tr("信用卡"), tr("金融卡"), "PayPal"];

function EmptyState() {
  return (
    <div className="py-20 flex flex-col items-center text-slate-500" data-testid="verify-empty">
      <div className="relative h-40 w-36 rounded-xl bg-orange-100/80 border-4 border-orange-50 flex flex-col items-center justify-center gap-2">
        <span className="font-head text-orange-300 text-lg font-black">gogo589</span>
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-20 rounded-full bg-orange-200" />)}
        <span className="absolute -left-4 -top-2 h-3 w-3 rounded-full bg-orange-400" />
        <span className="absolute -right-3 bottom-6 h-2.5 w-2.5 rounded-full bg-amber-400" />
      </div>
      <div className="mt-6 text-lg">{tr("無數據")}</div>
    </div>
  );
}

export default function MyVerify() {
  const callApi = useApi();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const { setHideNav } = useOutletContext() || {};
  useEffect(() => { setHideNav?.(adding); return () => setHideNav?.(false); }, [adding, setHideNav]);
  const [kind, setKind] = useState("identity");
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [name, setName] = useState("");
  const [img, setImg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const load = () => callApi({ method: "GET", url: "/me/verifications" }).then((r) => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, [callApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error(tr("圖片大小需在 2M 以內"));
    const r = new FileReader();
    r.onload = () => setImg({ name: f.name, data: r.result });
    r.readAsDataURL(f);
  };

  const submit = async () => {
    if (!name.trim()) return toast.error(tr("請輸入姓名"));
    if (!img) return toast.error(tr("請上傳證件圖片"));
    setSubmitting(true);
    try {
      await callApi({ method: "POST", url: "/me/verifications", data: { kind, doc_type: docType, name, image_b64: img.data, image_name: img.name } });
      toast.success(tr("已提交，審核中"));
      setAdding(false); setName(""); setImg(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || tr("提交失敗")); }
    setSubmitting(false);
  };

  const shown = list.filter((v) => filter === "all" || v.status === filter);
  const types = kind === "identity" ? DOC_TYPES : CARD_TYPES;

  if (adding) {
    return (
      <Panel title={tr("我的認證")} testId="verify-form-page" right={<button data-testid="verify-back" onClick={() => setAdding(false)} className="h-8 md:h-10 px-4 md:px-5 rounded-full border border-orange-400 text-orange-500 text-xs md:text-sm hover:bg-orange-50 whitespace-nowrap">{tr("返回我的認證")}</button>} hideHeaderOnMobile>
        <button data-testid="verify-back-mobile" onClick={() => setAdding(false)} className="md:hidden -mt-1 mb-1 flex items-center gap-0.5 text-sm text-slate-500"><ChevronLeft className="h-4 w-4" />{tr("返回")}</button>
        <div className="rounded-2xl md:bg-[#FFF6EC] md:[background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] md:[background-size:14px_14px] md:p-10">
          <div className="flex max-md:flex-col items-center gap-3 md:gap-6 max-md:text-center max-md:pt-4 max-md:pb-6">
            <img src="/banners/verify-badge.png" alt="" className="h-36 md:h-24 w-auto" />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-[15px] md:text-base leading-snug">{tr("為了帳戶安全，您需要完成實名身份認證")}</div>
              <div className="text-xs md:text-sm text-slate-500 mt-3 md:mt-2 leading-relaxed">{tr("完成認證，可提升系統出貨額度，享有極速出貨")}</div>
              <div className="text-xs md:text-sm text-slate-500 mt-1.5 md:mt-1 leading-relaxed">{tr("完成認證，提升帳戶信譽度，避免消費二次審核")}</div>
            </div>
          </div>
          <div className="mt-4 md:mt-8 bg-white md:bg-slate-50/80 rounded-2xl p-5 md:p-8 max-md:shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)] max-md:overflow-hidden">
            <div className="flex items-center gap-8 mb-5 md:mb-6">
              {[["identity", tr("身份認證")], ["card", tr("金融卡")]].map(([k, l]) => (
                <button key={k} data-testid={`verify-kind-${k}`} onClick={() => { setKind(k); setDocType(k === "identity" ? DOC_TYPES[0] : CARD_TYPES[0]); }} className={`relative text-[15px] md:text-base font-medium pb-1 ${kind === k ? "text-orange-500" : "text-slate-700"}`}>
                  {l}{kind === k && <span className="absolute left-0 right-0 -top-5 md:-top-7 mx-auto h-1 w-full md:w-10 rounded-b-full bg-orange-500" />}
                </button>
              ))}
            </div>
            <div className="flex items-start gap-3 md:gap-4 text-sm">
              <span className="hidden md:block w-20 shrink-0 text-slate-600 text-sm pt-1.5">{tr("證件類型：")}</span>
              <div className="flex flex-wrap gap-x-6 gap-y-3 md:gap-4">
              {types.map((t) => (
                <button key={t} data-testid={`verify-doctype-${t}`} onClick={() => setDocType(t)} className="flex items-center gap-2 text-[15px] md:text-sm">
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center ${docType === t ? "text-orange-500" : "bg-slate-200 text-white"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
                  <span className={docType === t ? "text-orange-500" : "text-slate-700"}>{t}</span>
                </button>
              ))}
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4 mt-5 md:mt-6 text-sm"><span className="hidden md:block w-20 shrink-0 text-slate-600 text-sm">{tr("姓名：")}</span>
              <input data-testid="verify-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("請輸入姓名")} className="w-full max-w-lg h-12 rounded-full bg-slate-100 md:bg-white px-5 text-sm outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div className="flex max-md:flex-col md:items-start gap-2 md:gap-4 mt-5 md:mt-6 text-sm"><span className="md:w-20 shrink-0 text-slate-600 text-sm md:pt-2">{tr("上傳圖片：")}</span>
              <div className="flex flex-col lg:flex-row gap-3 md:gap-6 flex-1 min-w-0">
                <button data-testid="verify-upload" onClick={() => fileRef.current?.click()} className="w-full max-w-lg h-32 md:h-44 rounded-2xl bg-slate-100 md:bg-white flex items-center justify-center overflow-hidden hover:bg-orange-50/40">
                  {img ? <img src={img.data} alt="doc" className="h-full w-full object-contain" /> : <Plus className="h-12 w-12 text-slate-300" strokeWidth={1.5} />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="verify-file-input" />
                <ol className="text-[11px] md:text-xs text-slate-500 space-y-1 md:space-y-2 leading-relaxed">
                  <li>{tr("1. 不支持中國大陸身份證件進行認證；")}</li>
                  <li className="text-orange-500">{tr("2. 請手持身份證件拍照，須露臉；")}</li>
                  <li>{tr("3. 證件必須是清晰彩色原件電子版，可以是數位拍攝的照片；")}</li>
                  <li>{tr("4. 如認證PayPal身分，請填寫PayPal帳單姓名、上傳PAYPAL帳單明細圖；")}</li>
                  <li>{tr("5. 支援格式：JPG，PNG，GIF，BMP；")}</li>
                  <li>{tr("6. 大小限制：2M以內。")}</li>
                </ol>
              </div>
            </div>
            <div className="text-center mt-6 md:mt-8"><OrangeBtn data-testid="verify-submit" onClick={submit} disabled={submitting} className="max-md:h-10 max-md:px-10 max-md:text-sm">{submitting ? tr("提交中…") : tr("提交")}</OrangeBtn></div>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={tr("我的認證")} testId="verify-page" right={<div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-orange-500 shrink-0"><span className="hidden sm:inline">{tr("您還需要認證其他身分？")}</span><button data-testid="verify-add" onClick={() => setAdding(true)} className="h-8 md:h-10 px-4 md:px-5 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 whitespace-nowrap">{tr("點擊新增")}</button></div>}>
      <p className="sm:hidden -mt-2 mb-3 px-1 text-xs text-orange-500">{tr("您還需要認證其他身分？點擊右上角新增")}</p>
      <SubTabs tabs={[["all", tr("全部")], ...Object.entries(STATUS)]} value={filter} onChange={setFilter} testPrefix="verify-filter" />
      {shown.length === 0 ? <EmptyState /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {shown.map((v) => (
            <div key={v.id} data-testid={`verify-item-${v.id}`} className="rounded-2xl bg-slate-50 max-md:bg-white max-md:shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)] p-4 md:p-5 text-sm flex gap-3">
              <span className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${v.status === "approved" ? "bg-emerald-50 text-emerald-500" : v.status === "rejected" ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-500"}`}>{v.kind === "identity" ? <ShieldCheck className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</span>
              <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800 truncate">{v.kind === "identity" ? tr("身份認證") : tr("金融卡")} · {v.doc_type}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] md:text-xs ${v.status === "approved" ? "bg-emerald-50 text-emerald-600" : v.status === "rejected" ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-500"}`}>{STATUS[v.status]}</span></div>
              <div className="mt-1.5 text-[13px] md:text-sm text-slate-600">{tr("姓名：")}{v.name}</div>
              <div className="mt-1 text-[11px] md:text-xs text-slate-400">{fmtBJ(v.created_at, "minute")}</div>
              {v.admin_note && <div className="mt-2 rounded-lg bg-slate-50 md:bg-white px-2.5 py-1.5 text-[11px] md:text-xs text-slate-500">{tr("備註：")}{v.admin_note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
