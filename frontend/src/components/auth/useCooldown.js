import { useEffect, useState } from "react";

// 驗證碼重發倒數（秒）；start() 開始倒數，left>0 期間按鈕停用
export const RESEND_SECONDS = 90;

export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(RESEND_SECONDS) };
}

export const sentToast = (tr, isPhone) => (isPhone ? tr("驗證碼將在 90 秒內發送至您的手機號") : tr("驗證碼將在 90 秒內發送至您的信箱"));
