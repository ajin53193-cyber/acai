import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2 } from "lucide-react";

export function CommissionExport({ isAdmin }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open && isAdmin) api.get("/accounts", { params: { role: "agent" } }).then((r) => setAgents(r.data)).catch(() => {}); }, [open, isAdmin]);

  const download = async () => {
    setBusy(true);
    try {
      const params = { month }; if (isAdmin) params.agent_id = agentId;
      const res = await api.get("/reports/agent-commission", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `commission_${month}.xlsx`; a.click(); URL.revokeObjectURL(url);
      toast.success("分润报表已下载"); setOpen(false);
    } catch (err) {
      let msg = err.message;
      try { msg = JSON.parse(await err.response.data.text()).detail; } catch { /* noop */ }
      toast.error(formatApiErrorDetail(msg));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="export-commission-btn" className="border-slate-700 hover:bg-slate-800"><FileSpreadsheet className="w-4 h-4 mr-1" /> 分润报表 (Excel)</Button>
      </DialogTrigger>
      <DialogContent className="glass border-slate-700" data-testid="commission-export-dialog">
        <DialogHeader><DialogTitle>导出代理分润月报</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {isAdmin && (
            <div className="space-y-1.5"><Label>代理</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger data-testid="commission-agent-select" className="bg-slate-900/60 border-slate-700"><SelectValue placeholder="选择代理" /></SelectTrigger>
                <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.email}</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div className="space-y-1.5"><Label>月份</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="commission-month-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
          <p className="text-xs text-slate-500">包含 3 个 Sheet：月度汇总、按商户明细、逐单明细</p>
        </div>
        <DialogFooter><Button onClick={download} disabled={busy || !month || (isAdmin && !agentId)} data-testid="commission-download-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "下载 .xlsx"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
