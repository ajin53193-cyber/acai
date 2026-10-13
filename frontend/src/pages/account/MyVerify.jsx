import { useEffect, useRef, useState } from "react";
import { Award, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, OrangeBtn, SubTabs } from "./AccountLayout";

const STATUS = { pending: "待完善", reviewing: "審核中", approved: "審核通過", rejected: "審核拒絕" };
const DOC_TYPES = ["護照", "駕照", "學生證", "身分證ID卡", "其他"];
const CARD_TYPES = ["信用卡", "金融卡", "PayPal"];

function EmptyState() {
  return (
    <div className="py-20 flex flex-col items-center text-slate-500" data-testid="verify-empty">
      <div className="relative h-40 w-36 rounded-xl bg-orange-100/80 border-4 border-orange-50 flex flex-col items-center justify-center gap-2">
        <span className="font-head text-orange-300 text-lg font-black">gogo589</span>
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-20 rounded-full bg-orange-200" />)}
        <span className="absolute -left-4 -top-2 h-3 w-3 rounded-full bg-orange-400" />
        <span className="absolute -right-3 bottom-6 h-2.5 w-2.5 rounded-full bg-amber-400" />
      </div>
      <div className="mt-6 text-lg">無數據</div>
    </div>
  );
}

export default function MyVerify() {
  const callApi = useApi();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
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
    if (f.size > 2 * 1024 * 1024) return toast.error("圖片大小需在 2M 以內");
    const r = new FileReader();
    r.onload = () => setImg({ name: f.name, data: r.result });
    r.readAsDataURL(f);
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("請輸入姓名");
    if (!img) return toast.error("請上傳證件圖片");
    setSubmitting(true);
    try {
      await callApi({ method: "POST", url: "/me/verifications", data: { kind, doc_type: docType, name, image_b64: img.data, image_name: img.name } });
      toast.success("已提交，審核中");
      setAdding(false); setName(""); setImg(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "提交失敗"); }
    setSubmitting(false);
  };

  const shown = list.filter((v) => filter === "all" || v.status === filter);
  const types = kind === "identity" ? DOC_TYPES : CARD_TYPES;

  if (adding) {
    return (
      <Panel title="我的認證" testId="verify-form-page" right={<button data-testid="verify-back" onClick={() => setAdding(false)} className="h-10 px-5 rounded-full border border-orange-400 text-orange-500 text-sm hover:bg-orange-50">返回我的認證</button>}>
        <div className="rounded-2xl bg-[#FFF6EC] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.5px,transparent_1.5px)] [background-size:14px_14px] p-6 sm:p-10">
          <div className="flex items-center gap-6">
            <Award className="h-20 w-20 text-amber-400" strokeWidth={1.3} />
            <div>
              <div className="font-bold text-slate-900 text-base">為了帳戶安全，您需要完成實名身份認證</div>
              <div className="text-sm text-slate-500 mt-2">完成認證，可提升系統出貨額度，享有極速出貨</div>
              <div className="text-sm text-slate-500 mt-1">完成認證，提升帳戶信譽度，避免消費二次審核</div>
            </div>
          </div>
          <div className="mt-8 bg-slate-50/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-8 mb-6">
              {[["identity", "身份認證"], ["card", "金融卡"]].map(([k, l]) => (
                <button key={k} data-testid={`verify-kind-${k}`} onClick={() => { setKind(k); setDocType(k === "identity" ? DOC_TYPES[0] : CARD_TYPES[0]); }} className={`relative text-base font-medium pb-1 ${kind === k ? "text-orange-500" : "text-slate-700"}`}>
                  {l}{kind === k && <span className="absolute left-0 right-0 -top-7 mx-auto h-1 w-10 rounded-b-full bg-orange-500" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="w-20 text-slate-600">證件類型：</span>
              {types.map((t) => (
                <button key={t} data-testid={`verify-doctype-${t}`} onClick={() => setDocType(t)} className="flex items-center gap-2">
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center ${docType === t ? "text-orange-500" : "bg-slate-200 text-white"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
                  <span className={docType === t ? "text-orange-500" : "text-slate-700"}>{t}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-6 text-sm"><span className="w-20 text-slate-600">姓名：</span>
              <input data-testid="verify-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="請輸入姓名" className="w-full max-w-lg h-12 rounded-full bg-white px-5 outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div className="flex items-start gap-4 mt-6 text-sm"><span className="w-20 text-slate-600 pt-2">上傳圖片：</span>
              <div className="flex flex-col lg:flex-row gap-6 flex-1">
                <button data-testid="verify-upload" onClick={() => fileRef.current?.click()} className="w-full max-w-lg h-44 rounded-2xl bg-white flex items-center justify-center overflow-hidden hover:bg-orange-50/40">
                  {img ? <img src={img.data} alt="doc" className="h-full w-full object-contain" /> : <Plus className="h-12 w-12 text-slate-300" strokeWidth={1.5} />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="verify-file-input" />
                <ol className="text-xs text-slate-500 space-y-2 leading-relaxed">
                  <li>1. 不支持中國大陸身份證件進行認證；</li>
                  <li className="text-orange-500">2. 請手持身份證件拍照，須露臉；</li>
                  <li>3. 證件必須是清晰彩色原件電子版，可以是數位拍攝的照片；</li>
                  <li>4. 如認證PayPal身分，請填寫PayPal帳單姓名、上傳PAYPAL帳單明細圖；</li>
                  <li>5. 支援格式：JPG，PNG，GIF，BMP；</li>
                  <li>6. 大小限制：2M以內。</li>
                </ol>
              </div>
            </div>
            <div className="text-center mt-8"><OrangeBtn data-testid="verify-submit" onClick={submit} disabled={submitting}>{submitting ? "提交中…" : "提交"}</OrangeBtn></div>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="我的認證" testId="verify-page" right={<div className="flex items-center gap-3 text-sm text-orange-500"><span>您還需要認證其他身分？</span><button data-testid="verify-add" onClick={() => setAdding(true)} className="h-10 px-5 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600">點擊新增</button></div>}>
      <SubTabs tabs={[["all", "全部"], ...Object.entries(STATUS)]} value={filter} onChange={setFilter} testPrefix="verify-filter" />
      {shown.length === 0 ? <EmptyState /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {shown.map((v) => (
            <div key={v.id} data-testid={`verify-item-${v.id}`} className="rounded-2xl bg-slate-50 p-5 text-sm">
              <div className="flex items-center justify-between"><span className="font-semibold text-slate-800">{v.kind === "identity" ? "身份認證" : "金融卡"} · {v.doc_type}</span>
                <span className={`rounded-full px-3 py-0.5 text-xs ${v.status === "approved" ? "bg-emerald-50 text-emerald-600" : v.status === "rejected" ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-500"}`}>{STATUS[v.status]}</span></div>
              <div className="mt-2 text-slate-600">姓名：{v.name}</div>
              <div className="mt-1 text-xs text-slate-400">{v.created_at?.slice(0, 19).replace("T", " ")}</div>
              {v.admin_note && <div className="mt-2 text-xs text-slate-500">備註：{v.admin_note}</div>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
