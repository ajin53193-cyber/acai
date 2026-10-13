import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Panel, SubTabs } from "./AccountLayout";
import { useWallet, BalanceBanner, TxRow } from "./MyWallet";
import { tr } from "@/i18n";

const TABS = [["all", tr("全部")], ["in", tr("入帳")], ["out", tr("支出")]];

export default function WalletTransactions() {
  const { data } = useWallet();
  const [tab, setTab] = useState("all");
  const shown = data.transactions.filter((t) => tab === "all" || (tab === "in" ? t.amount_usd >= 0 : t.amount_usd < 0));
  return (
    <Panel title={tr("交易紀錄")} testId="wallet-transactions-page" right={<Link to="/account/wallet" data-testid="wallet-back" className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-500"><ChevronLeft className="h-4 w-4" />{tr("返回錢包")}</Link>}>
      <BalanceBanner data={data} />
      <div className="mt-6 rounded-2xl bg-slate-50 p-6" data-testid="wallet-transactions">
        <SubTabs tabs={TABS} value={tab} onChange={setTab} testPrefix="tx-tab" />
        {shown.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm" data-testid="wallet-empty">{tr("尚無交易紀錄")}</div>
        ) : (
          <div className="divide-y divide-slate-200/70">{shown.map((t) => <TxRow key={t.id} t={t} />)}</div>
        )}
      </div>
    </Panel>
  );
}
