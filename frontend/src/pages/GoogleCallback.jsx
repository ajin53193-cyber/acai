import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import { publicApi } from "@/lib/api";
import { tr } from "@/i18n";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function GoogleCallback() {
  const { signIn, isLoaded } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    ran.current = true;
    const q = new URLSearchParams(window.location.search);
    const back = sessionStorage.getItem("g_oauth_return") || "/";
    (async () => {
      try {
        if (q.get("error")) throw new Error(tr("已取消 Google 登入"));
        if (!q.get("code") || q.get("state") !== sessionStorage.getItem("g_oauth_state")) throw new Error(tr("登入狀態無效，請重新嘗試"));
        const r = await publicApi.post("/auth/email/google", { code: q.get("code"), redirect_uri: window.location.origin + "/auth/google" });
        await signIn(r.data.token);
        toast.success(r.data.is_new ? tr("註冊成功") : tr("登入成功"));
        navigate(back.startsWith("/auth/") ? "/" : back, { replace: true });
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || tr("Google 登入失敗"));
      } finally {
        sessionStorage.removeItem("g_oauth_state");
        sessionStorage.removeItem("g_oauth_return");
      }
    })();
  }, [isLoaded, signIn, navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6" data-testid="google-callback">
      {error ? (
        <>
          <div className="text-slate-700 font-semibold" data-testid="google-callback-error">{error}</div>
          <button onClick={() => navigate("/", { replace: true })} className="h-10 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold">{tr("返回首頁")}</button>
        </>
      ) : (
        <>
          <span className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
          <div className="text-slate-500 text-sm">{tr("正在透過 Google 登入…")}</div>
        </>
      )}
    </div>
  );
}
