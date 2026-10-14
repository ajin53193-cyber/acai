import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Users, Copy, Gift, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useAuthModal } from "@/components/auth/AuthModal";
import { tr } from "@/i18n";

export default function Invite() {
  const callApi = useApi();
  const { isSignedIn } = useUser();
  const { openAuth } = useAuthModal();
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const load = () => callApi({ method: "GET", url: "/me/referral" }).then((r) => setInfo(r.data)).catch(() => {});
  useEffect(() => { if (isSignedIn) load(); }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const s = localStorage.getItem("ref_code"); if (s) setCode(s); }, []);

  const link = info ? `${window.location.origin}/?ref=${info.code}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); toast.success(tr("邀請連結已複製")); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: tr("邀請你來 gogo589"), text: tr("用我的邀請碼註冊，首充雙方都得積分！"), url: link }); } catch { /* noop */ } } else copy(); };
  const bind = async () => {
    if (!code.trim()) return toast.error(tr("請輸入邀請碼"));
    try { const r = await callApi({ method: "POST", url: "/me/referral/bind", data: { code: code.trim() } }); toast.success(r.data.message || tr("綁定成功")); localStorage.removeItem("ref_code"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || tr("綁定失敗")); }
  };

  if (!isSignedIn) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <Users className="h-12 w-12 text-orange-300" />
      <p>{tr("登入後查看你的邀請獎勵")}</p>
      <button onClick={openAuth} data-testid="invite-login-btn" className="h-10 px-6 rounded-full bg-orange-500 text-white font-semibold">{tr("登入 / 註冊")}</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-amber-400 pb-16" data-testid="invite-page">
      <div className="max-w-xl mx-auto px-4 pt-5">
        <Link to="/account" className="inline-flex items-center gap-1.5 text-white/90 text-sm font-medium hover:text-white"><ArrowLeft className="h-4 w-4" />{tr("返回帳戶")}</Link>
        <div className="text-center mt-4 text-white">
          <h1 className="font-head text-3xl font-extrabold drop-shadow flex items-center justify-center gap-2"><Users className="h-7 w-7" />{tr("邀請好友返積分")}</h1>
          <p className="text-white/90 text-sm mt-2">{info ? tr("好友用你的邀請碼註冊並完成首次充值，你得 {0} 積分、好友得 {1} 積分", info.referrer_points, info.referee_points) : "…"}</p>
        </div>

        {info && (
          <>
            <div className="bg-white rounded-2xl p-5 mt-6 shadow-lg">
              <div className="text-xs text-slate-400">{tr("我的邀請碼")}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="font-head text-2xl font-extrabold tracking-widest text-orange-600 flex-1" data-testid="invite-code">{info.code}</div>
              </div>
              <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                <input readOnly value={link} className="flex-1 bg-transparent text-xs text-slate-500 outline-none" data-testid="invite-link" />
                <button onClick={copy} data-testid="invite-copy-btn" className="h-8 px-3 rounded-lg bg-orange-100 text-orange-600 text-xs font-bold inline-flex items-center gap-1">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{tr("複製")}</button>
              </div>
              <button onClick={share} data-testid="invite-share-btn" className="mt-3 h-11 w-full rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600">{tr("分享給好友")}</button>
              <div className="grid grid-cols-2 gap-3 mt-4 text-center">
                <div className="bg-orange-50 rounded-xl py-3"><div className="font-head text-xl font-extrabold text-orange-600" data-testid="invite-count">{info.invited}</div><div className="text-[11px] text-slate-400">{tr("成功邀請")}</div></div>
                <div className="bg-amber-50 rounded-xl py-3"><div className="font-head text-xl font-extrabold text-amber-600" data-testid="invite-points">{info.points_earned}</div><div className="text-[11px] text-slate-400">{tr("累計獲得積分")}</div></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 mt-4 shadow-lg" data-testid="invite-bind-card">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2"><Gift className="h-4 w-4 text-rose-500" />{tr("填寫好友的邀請碼")}</div>
              {info.bound ? (
                <div className="text-sm text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2" data-testid="invite-bound">{tr("你已綁定邀請碼，完成首次充值即可獲得獎勵")}</div>
              ) : !info.can_bind ? (
                <div className="text-sm text-slate-400 bg-slate-50 rounded-xl px-3 py-2">{tr("你已完成過充值，無法再綁定邀請碼")}</div>
              ) : (
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={tr("輸入 8 位邀請碼")} data-testid="invite-bind-input"
                    className="flex-1 h-10 rounded-xl bg-slate-100 px-3 text-sm uppercase tracking-wider outline-none focus:ring-2 focus:ring-orange-300" maxLength={8} />
                  <button onClick={bind} data-testid="invite-bind-btn" className="h-10 px-5 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600">{tr("綁定")}</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
