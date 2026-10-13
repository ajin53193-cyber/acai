import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { bjMonth } from "@/lib/format";

export function MerchantStatementExport({ user }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(bjMonth);
  const [merchants, setMerchants] = useState([]);
  const [merchantId, setMerchantId] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = user.role !== "merchant";

  useEffect(() => { if (open && pick) api.get("/accounts", { params: { role: "merchant" } }).then((r) => setMerchants(r.data)).catch(() => {}); }, [open, pick]);

  const download = async () => {
    setBusy(true);
    try {
      const params = { month }; if (pick) params.merchant_id = merchantId;
      const res = await api.get("/reports/merchant-statement", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `statement_${month}.xlsx`; a.click(); URL.revokeObjectURL(url);
      toast.success("月账单已下载"); setOpen(false);
    } catch (err) {
      let msg = err.message;
      try { msg = JSON.parse(await err.response.data.text()).detail; } catch { /* noop */ }
      toast.error(formatApiErrorDetail(msg));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="export-statement-btn" className="border-slate-700 hover:bg-slate-800"><FileText className="w-4 h-4 mr-1" /> 商户月账单 (Excel)</Button>
      </DialogTrigger>
      <DialogContent className="glass border-slate-700" data-testid="statement-export-dialog">
        <DialogHeader><DialogTitle>导出商户月账单</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {pick && (
            <div className="space-y-1.5"><Label>商户</Label>
              <Select value={merchantId} onValueChange={setMerchantId}>
                <SelectTrigger data-testid="statement-merchant-select" className="bg-slate-900/60 border-slate-700"><SelectValue placeholder="选择商户" /></SelectTrigger>
                <SelectContent>{merchants.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.email}</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div className="space-y-1.5"><Label>月份</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="statement-month-input" className="bg-slate-900/60 border-slate-700 font-mono" /></div>
          <p className="text-xs text-slate-500">包含 4 个 Sheet：月度汇总、收款明细、提现记录、余额调整</p>
        </div>
        <DialogFooter><Button onClick={download} disabled={busy || !month || (pick && !merchantId)} data-testid="statement-download-btn" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "下载 .xlsx"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
