import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { Panel, Tag, Box, OrangeBtn } from "./AccountLayout";
import { BindPhoneDialog } from "./BindPhoneDialog";

const field = "w-full h-12 rounded-full bg-white px-5 text-sm outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400";
const TYPES = ["微信", "Telegram", "WhatsApp", "LINE", "QQ"];

export default function MyAccount() {
  const callApi = useApi();
  const { user } = useUser();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ name: "", gender: "male", contact_type: "微信", contact: "" });
  const [pw, setPw] = useState({ cur: "", n1: "", n2: "" });
  const [saving, setSaving] = useState(false);
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    callApi({ method: "GET", url: "/me/profile" }).then((r) => {
      setInfo(r.data);
      const p = r.data.profile || {};
      setForm({ name: p.name || r.data.email || "", gender: p.gender || "male", contact_type: p.contact_type || "微信", contact: p.contact || "" });
    }).catch(() => {});
  }, [callApi]);

  const saveProfile = async () => {
    setSaving(true);
    try { await callApi({ method: "PUT", url: "/me/profile", data: form }); toast.success("已儲存"); } catch { toast.error("儲存失敗"); }
    setSaving(false);
  };

  const savePassword = async () => {
    if (!pw.n1 || pw.n1.length < 8) return toast.error("新密碼至少 8 位");
    if (pw.n1 !== pw.n2) return toast.error("兩次輸入的新密碼不一致");
    try {
      if (user.passwordEnabled) await user.updatePassword({ currentPassword: pw.cur, newPassword: pw.n1, signOutOfOtherSessions: false });
      else await user.updatePassword({ newPassword: pw.n1 });
      toast.success("密碼已更新"); setPw({ cur: "", n1: "", n2: "" });
    } catch (e) { toast.error(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || "密碼更新失敗"); }
  };

  const email = user?.primaryEmailAddress?.emailAddress;
  const phone = user?.primaryPhoneNumber?.phoneNumber;
  const google = user?.externalAccounts?.some((a) => a.provider === "google");
  const Row = ({ label, children }) => <div className="flex items-center gap-3 text-sm text-slate-600 h-11 whitespace-nowrap"><span className="w-20 shrink-0">{label}</span>{children}</div>;
  const Hint = ({ children }) => <span className="text-slate-400 text-xs hidden sm:inline">{children}</span>;
  const Label = ({ children }) => <span className="w-20 shrink-0 text-sm text-slate-600 whitespace-nowrap">{children}</span>;

  return (
    <Panel title="我的帳戶" testId="my-account-page">
      {binding && <BindPhoneDialog onClose={() => setBinding(false)} />}
      <div className="grid lg:grid-cols-2 gap-5">
        <Box>
          <Tag>帳戶基礎資訊</Tag>
          <div className="mt-4 pl-2">
            <Row label="帳戶ID：">
              <span className="text-slate-800 font-medium" data-testid="account-no">{info?.account_no || "—"}</span>
            </Row>
            <Row label="信箱：">
              <span className="text-slate-800 truncate">{email || "未綁定"}</span><Hint>（可用於登入）</Hint>
            </Row>
          </div>
        </Box>
        <Box>
          <Tag>帳戶綁定訊息</Tag>
          <div className="mt-4 pl-2">
            <Row label="手機號：">
              {phone ? (
                <>
                  <span className="text-slate-800 font-medium" data-testid="account-phone">{phone}</span>
                  <button data-testid="bind-phone-change" className="rounded-full bg-orange-50 text-orange-500 text-xs px-3 py-1 hover:bg-orange-100" onClick={() => setBinding(true)}>更換</button>
                </>
              ) : (
                <button data-testid="bind-phone-btn" className="rounded-full bg-orange-50 text-orange-500 text-sm px-4 py-1 hover:bg-orange-100" onClick={() => setBinding(true)}>綁定手機號</button>
              )}
              <Hint>（綁定後，可使用手機號碼登錄）</Hint>
            </Row>
            <Row label="Google：">
              <span className="text-slate-800">{google ? "已綁定" : "未綁定"}</span><Hint>（綁定後，可使用Google登錄）</Hint>
            </Row>
          </div>
        </Box>
        <Box>
          <Tag>個人聯絡資訊</Tag>
          <div className="mt-5 space-y-4 pl-2">
            <div className="flex items-center gap-3"><Label>姓名：</Label><input data-testid="profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} /></div>
            <div className="flex items-center gap-3"><Label>性別：</Label>
              <div className="flex items-center gap-8">
                {[["male", "男"], ["female", "女"]].map(([v, l]) => (
                  <button key={v} data-testid={`profile-gender-${v}`} onClick={() => setForm({ ...form, gender: v })} className="flex items-center gap-2 text-sm">
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center ${form.gender === v ? "text-orange-500" : "bg-slate-200 text-white"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
                    <span className={form.gender === v ? "text-orange-500" : "text-slate-700"}>{l}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3"><Label>聯絡方式：</Label>
              <div className="relative shrink-0">
                <select data-testid="profile-contact-type" value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} className="h-12 appearance-none rounded-full bg-white pl-5 pr-10 text-sm outline-none">
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              </div>
              <input data-testid="profile-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="請輸入聯絡方式" className={field + " min-w-0"} />
            </div>
            <div className="text-center pt-2"><OrangeBtn data-testid="profile-save" onClick={saveProfile} disabled={saving}>儲存</OrangeBtn></div>
          </div>
        </Box>
        <Box>
          <Tag>帳戶密碼修改</Tag>
          <div className="mt-5 space-y-3 pl-2">
            {user?.passwordEnabled && <input data-testid="pw-current" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} placeholder="請輸入舊密碼" className={field} />}
            <div className="text-xs text-slate-400 pl-5">如忘記密碼，請於登入視窗點擊「忘記密碼」找回</div>
            <input data-testid="pw-new" type="password" value={pw.n1} onChange={(e) => setPw({ ...pw, n1: e.target.value })} placeholder="請輸入新密碼" className={field} />
            <input data-testid="pw-confirm" type="password" value={pw.n2} onChange={(e) => setPw({ ...pw, n2: e.target.value })} placeholder="請再次輸入新密碼" className={field} />
            <div className="text-center pt-4"><OrangeBtn data-testid="pw-save" onClick={savePassword}>儲存</OrangeBtn></div>
          </div>
        </Box>
      </div>
    </Panel>
  );
}
