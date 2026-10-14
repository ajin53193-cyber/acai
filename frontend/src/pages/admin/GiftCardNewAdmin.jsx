import { useEffect, useState } from "react";
import { tr } from "@/i18n";
import { Head } from "./ui";
import { ProductForm, EMPTY_PRODUCT } from "./ProductsAdmin";

export function GiftCardNewAdmin({ callApi }) {
  const [cats, setCats] = useState(null);
  const [key, setKey] = useState(0);
  useEffect(() => { callApi({ method: "GET", url: "/admin/categories" }).then((r) => setCats(r.data)).catch(() => setCats([])); }, [callApi]);
  if (!cats) return <div className="text-slate-400 text-sm">{tr("載入中…")}</div>;
  return (
    <div data-testid="giftcard-new-admin">
      <Head title={tr("添加禮品卡")} sub={tr("填寫禮品卡商品資訊，儲存後將顯示於前台商品列表")} />
      <ProductForm key={key} inline title={tr("添加禮品卡")} item={{ ...EMPTY_PRODUCT, category: cats[0]?.id || "", is_giftcard: true }} cats={cats} callApi={callApi} onSaved={() => setKey((k) => k + 1)} />
    </div>
  );
}
