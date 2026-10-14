import { tr } from "@/i18n";
import { Head, Card } from "./ui";

export function GiftCardPlaceholder({ title }) {
  return (
    <div data-testid="giftcard-placeholder">
      <Head title={title} />
      <Card className="p-10 text-center text-sm text-slate-400">{tr("此模組待配置")}</Card>
    </div>
  );
}
