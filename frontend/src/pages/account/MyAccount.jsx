import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, Tag, Box, OrangeBtn } from "./AccountLayout";
import { BindPhoneDialog } from "./BindPhoneDialog";
import { tr } from "@/i18n";

const field = "w-full h-8 md:h-12 rounded-full bg-slate-100 md:bg-white px-3 md:px-5 text-xs md:text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
const TYPES = [tr("微信"), "Telegram", "WhatsApp", "LINE", "QQ"];

export default function MyAccount() {
  const callApi = useApi();
  const { user } = useUser();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ name: "", gender: "male", contact_type: tr("微信"), contact: "" });
  const [pw, setPw] = useState({ cur: "", n1: "", n2: "" });
  const [saving, setSaving] = useState(false);
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    callApi({ method: "GET", url: "/me/profile" }).then((r) => {
      setInfo(r.data);
      const p = r.data.profile || {};
      setForm({ name: p.name || r.data.email || "", gender: p.gender || "male", contact_type: p.contact_type || tr("微信"), contact: p.contact || "" });
    }).catch(() => {});
  }, [callApi]);

  const saveProfile = async () => {
    setSaving(true);
    try { await callApi({ method: "PUT", url: "/me/profile", data: form }); toast.success(tr("已儲存")); } catch { toast.error(tr("儲存失敗")); }
    setSaving(false);
  };

  const savePassword = async () => {
    if (!pw.n1 || pw.n1.length < 8) return toast.error(tr("新密碼至少 8 位"));
    if (pw.n1 !== pw.n2) return toast.error(tr("兩次輸入的新密碼不一致"));
    try {
      if (user.passwordEnabled) await user.updatePassword({ currentPassword: pw.cur, newPassword: pw.n1, signOutOfOtherSessions: false });
      else await user.updatePassword({ newPassword: pw.n1 });
      toast.success(tr("密碼已更新")); setPw({ cur: "", n1: "", n2: "" });
    } catch (e) { toast.error(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || tr("密碼更新失敗")); }
  };

  const email = user?.primaryEmailAddress?.emailAddress;
  const phone = user?.primaryPhoneNumber?.phoneNumber;
  const google = user?.externalAccounts?.some((a) => a.provider === "google");
  const Row = ({ label, children }) => <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 min-h-11 py-1"><span className="w-16 md:w-20 shrink-0">{label}</span>{children}</div>;
  const Hint = ({ children }) => <span className="text-slate-400 text-xs">{children}</span>;
  const Label = ({ children }) => <span className="w-16 md:w-20 shrink-0 text-[13px] md:text-sm text-slate-600 whitespace-nowrap">{children}</span>;

  return (
    <Panel title={tr("我的帳戶")} testId="my-account-page">
      {binding && <BindPhoneDialog onClose={() => setBinding(false)} />}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
        <Box>
          <Tag>{tr("帳戶基礎資訊")}</Tag>
          <div className="mt-4 pl-2 max-md:pl-0 max-md:mt-0">
            <Row label={tr("帳戶ID：")}>
              <span className="text-slate-800 font-medium" data-testid="account-no">{info?.account_no || "—"}</span>
            </Row>
            <Row label={tr("信箱：")}>
              <span className="text-slate-800 truncate">{email || tr("未綁定")}</span><Hint>{tr("（可用於登入）")}</Hint>
            </Row>
          </div>
        </Box>
        <Box>
          <Tag>{tr("帳戶綁定訊息")}</Tag>
          <div className="mt-4 pl-2 max-md:pl-0 max-md:mt-0">
            <Row label={tr("手機號：")}>
              {phone ? (
                <>
                  <span className="text-slate-800 font-medium" data-testid="account-phone">{phone}</span>
                  <button data-testid="bind-phone-change" className="rounded-full bg-orange-50 text-orange-500 text-xs px-3 py-1 hover:bg-orange-100" onClick={() => setBinding(true)}>{tr("更換")}</button>
                </>
              ) : (
                <button data-testid="bind-phone-btn" className="rounded-full bg-orange-50 text-orange-500 text-sm px-4 py-1 hover:bg-orange-100" onClick={() => setBinding(true)}>{tr("綁定手機號")}</button>
              )}
              <Hint>{tr("（綁定後，可使用手機號碼登錄）")}</Hint>
            </Row>
            <Row label="Google：">
              <span className="text-slate-800">{google ? tr("已綁定") : tr("未綁定")}</span><Hint>{tr("（綁定後，可使用Google登錄）")}</Hint>
            </Row>
          </div>
        </Box>
        <Box>
          <Tag>{tr("個人聯絡資訊")}</Tag>
          <div className="mt-5 space-y-3 md:space-y-4 pl-2 max-md:pl-0 max-md:mt-0">
            <div className="flex items-center gap-3"><Label>{tr("姓名：")}</Label><input data-testid="profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} /></div>
            <div className="flex items-center gap-3"><Label>{tr("性別：")}</Label>
              <div className="flex items-center gap-6 md:gap-8">
                {[["male", tr("男")], ["female", tr("女")]].map(([v, l]) => (
                  <button key={v} data-testid={`profile-gender-${v}`} onClick={() => setForm({ ...form, gender: v })} className="flex items-center gap-1.5 md:gap-2 text-[13px] md:text-sm">
                    <span className={`h-4 w-4 md:h-5 md:w-5 rounded-full flex items-center justify-center ${form.gender === v ? "text-orange-500" : "bg-slate-200 text-white"}`}><Check className="h-3 w-3 md:h-4 md:w-4" strokeWidth={3} /></span>
                    <span className={form.gender === v ? "text-orange-500" : "text-slate-700"}>{l}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3"><Label>{tr("聯絡方式：")}</Label>
              <div className="relative shrink-0">
                <select data-testid="profile-contact-type" value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} className="h-8 md:h-12 w-[88px] md:w-auto appearance-none rounded-full bg-slate-100 md:bg-white pl-3 md:pl-5 pr-6 md:pr-10 text-xs md:text-sm outline-none">
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 md:right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
              </div>
              <input data-testid="profile-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder={tr("請輸入聯絡方式")} className={field + " min-w-0"} />
            </div>
            <div className="text-center pt-1 md:pt-2"><OrangeBtn data-testid="profile-save" onClick={saveProfile} disabled={saving} className="max-md:h-9 max-md:px-8 max-md:text-[13px]">{tr("儲存")}</OrangeBtn></div>
          </div>
        </Box>
        <Box>
          <Tag>{tr("帳戶密碼修改")}</Tag>
          <div className="mt-5 space-y-2.5 md:space-y-3 pl-2 max-md:pl-0 max-md:mt-0">
            {user?.passwordEnabled && <input data-testid="pw-current" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} placeholder={tr("請輸入舊密碼")} className={field} />}
            <div className="text-[11px] md:text-xs text-slate-400 pl-4 md:pl-5">{tr("如忘記密碼，請於登入視窗點擊「忘記密碼」找回")}</div>
            <input data-testid="pw-new" type="password" value={pw.n1} onChange={(e) => setPw({ ...pw, n1: e.target.value })} placeholder={tr("請輸入新密碼")} className={field} />
            <input data-testid="pw-confirm" type="password" value={pw.n2} onChange={(e) => setPw({ ...pw, n2: e.target.value })} placeholder={tr("請再次輸入新密碼")} className={field} />
            <div className="text-center pt-2 md:pt-4"><OrangeBtn data-testid="pw-save" onClick={savePassword} className="max-md:h-9 max-md:px-8 max-md:text-[13px]">{tr("儲存")}</OrangeBtn></div>
          </div>
        </Box>
      </div>
    </Panel>
  );
}
