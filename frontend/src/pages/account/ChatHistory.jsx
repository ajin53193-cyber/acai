import { useCallback, useEffect, useState } from "react";
import { fmtBJ, bjToday } from "@/lib/bjtime";
import { Headphones, MessageCircle, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { openService } from "@/components/ServiceWidget";
import { Panel, SubTabs, OrangeBtn } from "./AccountLayout";
import { tr } from "@/i18n";

const TABS = [["all", tr("全部")], ["open", tr("進行中")], ["handled", tr("已結束")]];
const fmtTime = (s) => (s ? fmtBJ(s, "minute") : "-");

export default function ChatHistory() {
  const callApi = useApi();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const load = useCallback(() => callApi({ method: "GET", url: `/me/chat/sessions?guest_id=${localStorage.getItem("chat_guest_id") || ""}` }).then((r) => setItems(r.data)).catch(() => {}), [callApi]);
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);
  const shown = items.filter((s) => tab === "all" || s.status === tab);
  return (
    <Panel title={tr("客服對話")} testId="chat-history-page" right={<OrangeBtn data-testid="chat-history-new" onClick={() => openService()} className="h-9 px-5 text-sm flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{tr("聯繫客服")}</OrangeBtn>}>
      <div className="rounded-2xl bg-slate-50 p-4 sm:p-6" data-testid="chat-history">
        <SubTabs tabs={TABS} value={tab} onChange={setTab} testPrefix="chat-tab" />
        {shown.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm" data-testid="chat-history-empty"><Headphones className="h-10 w-10 mx-auto text-slate-300 mb-3" />{tr("尚無客服對話")}<div className="mt-3"><button onClick={() => openService()} className="text-orange-500 font-semibold">{tr("立即聯繫客服 ›")}</button></div></div>
        ) : (
          <div className="divide-y divide-slate-200/70">
            {shown.map((s) => (
              <button key={s.id} data-testid={`chat-history-${s.id}`} onClick={() => openService(s)} className="w-full text-left py-4 first:pt-2 flex items-center gap-3 hover:bg-white/60 rounded-xl px-2 -mx-2 transition-colors">
                <span className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${s.status === "open" ? "bg-orange-100 text-orange-500" : "bg-slate-200 text-slate-500"}`}><Headphones className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-semibold text-slate-800 text-sm">{tr("線上客服")}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.status === "open" ? "bg-orange-100 text-orange-500" : "bg-slate-100 text-slate-500"}`}>{s.status === "open" ? tr("進行中") : tr("已結束")}</span>{s.unread_user > 0 && <span data-testid={`chat-history-unread-${s.id}`} className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{s.unread_user}</span>}<span className="ml-auto text-[11px] text-slate-400 shrink-0">{fmtTime(s.last_at)}</span></div>
                  <div className="text-xs text-slate-500 truncate mt-1">{s.last_sender === "admin" ? tr("[客服] ") : tr("[我] ")}{s.last_message}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
