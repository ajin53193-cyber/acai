import { useState } from "react";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, OrangeBtn, SubTabs } from "./AccountLayout";

const KINDS = [["suggestion", "用戶建議"], ["complaint", "投訴"], ["restock", "缺貨登記"]];
const TOPICS = {
  suggestion: ["網站功能", "缺貨登記", "售前服務", "售後服務", "產品推薦", "其他建議"],
  complaint: ["客服態度", "發貨延遲", "充值錯誤", "退款問題", "其他投訴"],
  restock: ["遊戲", "直播", "社交", "影音", "點卡", "其他"],
};

export default function HelpCenter() {
  const callApi = useApi();
  const { user } = useUser();
  const [kind, setKind] = useState("suggestion");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!topic) return toast.error("請選擇內容類型");
    if (!content.trim()) return toast.error("請輸入內容");
    if (!contact.trim()) return toast.error("請填寫聯繫資訊");
    setSending(true);
    try { await callApi({ method: "POST", url: "/me/feedback", data: { kind, topic, content, contact } }); toast.success("已提交，我們會盡快處理"); setContent(""); setTopic(""); }
    catch (e) { toast.error(e.response?.data?.detail || "提交失敗"); }
    setSending(false);
  };

  return (
    <Panel title="幫助中心" testId="help-page">
      <div className="max-md:bg-white max-md:rounded-2xl max-md:shadow-[0_6px_20px_-12px_rgba(232,121,42,0.35)] max-md:px-4 max-md:pb-6 max-md:overflow-hidden">
      <div className="md:hidden flex items-center justify-between -mx-4 px-4 pt-1 mb-4" data-testid="help-kind-tabs-mobile">
        {KINDS.map(([k, l]) => (
          <button key={k} data-testid={`help-kind-m-${k}`} onClick={() => { setKind(k); setTopic(""); }} className={`relative py-3 text-[15px] font-medium ${kind === k ? "text-orange-500" : "text-slate-700"}`}>
            {l}{kind === k && <span className="absolute left-0 right-0 top-0 h-[3px] rounded-b-full bg-orange-500" />}
          </button>
        ))}
      </div>
      <div className="max-md:hidden"><SubTabs tabs={KINDS} value={kind} onChange={(k) => { setKind(k); setTopic(""); }} testPrefix="help-kind" /></div>
      <div className="md:text-center font-semibold text-slate-800 mb-3 md:mb-5 text-[15px] md:text-base">{kind === "restock" ? "請選擇缺貨商品類型" : kind === "complaint" ? "請選擇投訴內容" : "請選擇建議內容"}</div>
      <div className="flex flex-wrap gap-2 md:gap-4 mb-5 md:mb-6">
        {TOPICS[kind].map((t) => (
          <button key={t} data-testid={`help-topic-${t}`} onClick={() => setTopic(t)} className={`h-9 md:h-12 px-3.5 md:px-8 rounded-full text-[13px] md:text-sm font-medium transition-colors ${topic === t ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-orange-50"}`}>{t}</button>
        ))}
      </div>
      <div className="relative">
        <textarea data-testid="help-content" value={content} onChange={(e) => setContent(e.target.value.slice(0, 2000))} placeholder={kind === "restock" ? "請描述您需要的商品名稱、面額與區服" : "說點什麼吧"} rows={7} className="w-full rounded-2xl bg-slate-100 p-4 md:p-5 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400 resize-y" />
        <span className="absolute right-4 md:right-5 bottom-3 md:bottom-4 text-xs text-slate-400">{content.length}/2000</span>
      </div>
      <div className="mt-4 md:mt-6 flex items-center gap-2 md:gap-3 text-sm">
        <span className="text-slate-700 shrink-0 whitespace-nowrap"><span className="text-red-500 mr-1">*</span>聯繫資訊：</span>
        <input data-testid="help-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="請輸入郵箱/QQ/微信號" className="h-10 md:h-12 w-full max-w-xl min-w-0 rounded-full bg-slate-100 px-4 md:px-5 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400" />
      </div>
      <div className="text-center mt-6 md:mt-12"><OrangeBtn data-testid="help-submit" onClick={submit} disabled={sending} className="max-md:h-11 max-md:px-14 max-md:text-sm">{sending ? "提交中…" : "提交"}</OrangeBtn></div>
      </div>
    </Panel>
  );
}
