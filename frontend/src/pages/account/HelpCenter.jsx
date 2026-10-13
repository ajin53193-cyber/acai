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
      <SubTabs tabs={KINDS} value={kind} onChange={(k) => { setKind(k); setTopic(""); }} testPrefix="help-kind" />
      <div className="text-center font-semibold text-slate-800 mb-5">{kind === "restock" ? "請選擇缺貨商品類型" : kind === "complaint" ? "請選擇投訴內容" : "請選擇建議內容"}</div>
      <div className="flex flex-wrap gap-4 mb-6">
        {TOPICS[kind].map((t) => (
          <button key={t} data-testid={`help-topic-${t}`} onClick={() => setTopic(t)} className={`h-12 px-8 rounded-full text-sm font-medium transition-colors ${topic === t ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-orange-50"}`}>{t}</button>
        ))}
      </div>
      <div className="relative">
        <textarea data-testid="help-content" value={content} onChange={(e) => setContent(e.target.value.slice(0, 2000))} placeholder={kind === "restock" ? "請描述您需要的商品名稱、面額與區服" : "說點什麼吧"} rows={10} className="w-full rounded-2xl bg-slate-100 p-5 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400 resize-y" />
        <span className="absolute right-5 bottom-4 text-xs text-slate-400">{content.length}/2000</span>
      </div>
      <div className="mt-6 flex items-center gap-3 text-sm">
        <span className="text-slate-700"><span className="text-red-500 mr-1">*</span>聯繫資訊：</span>
        <input data-testid="help-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="請輸入郵箱/QQ/微信號" className="h-12 w-full max-w-xl rounded-full bg-slate-100 px-5 outline-none focus:ring-2 focus:ring-orange-300" />
      </div>
      <div className="text-center mt-12"><OrangeBtn data-testid="help-submit" onClick={submit} disabled={sending}>{sending ? "提交中…" : "提交"}</OrangeBtn></div>
    </Panel>
  );
}
