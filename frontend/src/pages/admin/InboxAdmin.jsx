import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { API } from "@/lib/api";

const STATUSES = ["待跟进", "跟进中", "已完成"];

export default function InboxAdmin({ token, onUnauthorized }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/inquiries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInquiries(res.data);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized();
      else toast.error("加载留言失败");
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(
        `${API}/admin/inquiries/${id}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInquiries((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
      toast.success("状态已更新");
    } catch {
      toast.error("更新失败");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500" data-testid="admin-inbox-count">共 {inquiries.length} 条咨询留言</p>
        <button
          data-testid="admin-refresh-btn"
          onClick={load}
          className="flex items-center gap-2 rounded-full border border-amber-500/25 px-5 py-2.5 text-sm text-[#E5C158] transition-colors hover:bg-amber-500/10"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
      </div>

      {inquiries.length === 0 && !loading ? (
        <div className="glass-card rounded-3xl py-20 text-center text-sm text-slate-500" data-testid="admin-inbox-empty">
          暂无留言，访客提交咨询后将显示在这里
        </div>
      ) : (
        <div className="space-y-5" data-testid="admin-inbox-list">
          {inquiries.map((q, i) => (
            <div key={q.id} className="glass-card rounded-2xl p-6" data-testid={`admin-inquiry-${i}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-lg font-bold text-slate-50">{q.name}</span>
                    <span className="rounded-full border border-amber-500/30 px-3 py-0.5 text-xs text-[#E5C158]">{q.inquiry_type}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {q.phone} {q.city ? `· ${q.city}` : ""} · {new Date(q.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                <select
                  data-testid={`admin-inquiry-status-${i}`}
                  value={q.status}
                  onChange={(e) => updateStatus(q.id, e.target.value)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium outline-none ${
                    q.status === "已完成"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : q.status === "跟进中"
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-amber-500/40 bg-amber-500/10 text-[#E5C158]"
                  }`}
                >
                  {STATUSES.map((s) => <option key={s} value={s} className="bg-[#0A1228]">{s}</option>)}
                </select>
              </div>
              <p className="mt-4 rounded-xl border border-amber-500/10 bg-[#060B18]/60 p-4 text-sm leading-relaxed text-slate-300">
                {q.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
