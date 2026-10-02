import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Clock, Mail, Send, Headset } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { API, formatDetail } from "@/lib/api";
import { useSettings } from "@/lib/useSettings";

const TYPES = ["项目合作", "团长合作", "资源对接", "其他"];

export default function Contact() {
  const { contact } = useSettings();
  const [form, setForm] = useState({ name: "", phone: "", city: "", inquiry_type: "项目合作", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast.error("请填写姓名、联系电话和留言内容");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/contact`, form);
      toast.success("提交成功，客服将尽快与您联系");
      setForm({ name: "", phone: "", city: "", inquiry_type: "项目合作", message: "" });
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60 focus:shadow-[0_0_16px_rgba(212,175,55,0.15)]";

  return (
    <main className="pt-28" data-testid="contact-page">
      <section className="grid-texture relative overflow-hidden pb-16 pt-10">
        <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#1E3A8A]/25 blur-[130px]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-16">
          <Reveal>
            <h1 className="font-display text-3xl font-black tracking-tight text-gold-gradient sm:text-4xl lg:text-5xl">
              联系我们
            </h1>
            <p className="mt-4 text-base text-slate-400 sm:text-lg">客服团队为您提供项目合作咨询</p>
          </Reveal>

          <div className="mt-12 grid gap-8 lg:grid-cols-5">
            <Reveal delay={0.1} className="lg:col-span-2">
              <div className="glass-card flex h-full flex-col rounded-3xl p-8 sm:p-10" data-testid="contact-info-card">
                <h2 className="font-display text-xl font-bold text-gold-gradient">联系方式</h2>
                <div className="mt-3 h-px w-12 bg-gold-gradient" />
                <ul className="mt-8 flex-1 space-y-6 text-sm">
                  <li className="flex items-center gap-4" data-testid="contact-hours">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#E5C158]"><Clock size={18} /></span>
                    <div><div className="text-slate-400">工作时间</div><div className="mt-0.5 font-bold text-slate-100">{contact.hours}</div></div>
                  </li>
                  <li className="flex items-center gap-4" data-testid="contact-email">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#E5C158]"><Mail size={18} /></span>
                    <div><div className="text-slate-400">邮箱</div><div className="mt-0.5 font-bold text-slate-100">{contact.email}</div></div>
                  </li>
                </ul>
                <a
                  href="#message-form"
                  data-testid="contact-online-consult-btn"
                  className="mt-10 flex items-center justify-center gap-2 rounded-full border border-[#D4AF37] py-3.5 text-sm font-medium text-[#FFE896] transition-all duration-300 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_24px_rgba(212,175,55,0.25)]"
                >
                  <Headset size={16} /> 在线咨询
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="lg:col-span-3">
              <form
                id="message-form"
                onSubmit={submit}
                className="glass-card rounded-3xl p-8 sm:p-10"
                data-testid="contact-form"
              >
                <h2 className="font-display text-xl font-bold text-gold-gradient">在线留言</h2>
                <div className="mt-3 h-px w-12 bg-gold-gradient" />
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs tracking-widest text-slate-400">姓名 *</label>
                    <input data-testid="contact-form-name-input" value={form.name} onChange={set("name")} placeholder="请输入您的姓名" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-widest text-slate-400">联系电话 *</label>
                    <input data-testid="contact-form-phone-input" value={form.phone} onChange={set("phone")} placeholder="请输入手机号码" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-widest text-slate-400">所在城市</label>
                    <input data-testid="contact-form-city-input" value={form.city} onChange={set("city")} placeholder="例如：杭州" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-widest text-slate-400">咨询类型</label>
                    <select
                      data-testid="contact-form-type-select"
                      value={form.inquiry_type}
                      onChange={set("inquiry_type")}
                      className={`${inputCls} appearance-none`}
                    >
                      {TYPES.map((t) => <option key={t} value={t} className="bg-[#0A1228]">{t}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs tracking-widest text-slate-400">留言内容 *</label>
                    <textarea
                      data-testid="contact-form-message-textarea"
                      value={form.message}
                      onChange={set("message")}
                      rows={5}
                      placeholder="请描述您的合作需求或想咨询的问题…"
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="contact-form-submit-btn"
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient py-4 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.35)] transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,232,150,0.55)] active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:px-14"
                >
                  <Send size={16} /> {submitting ? "提交中…" : "提交咨询"}
                </button>
                <p className="mt-5 text-xs text-slate-500">
                  咨询信息将进入后台管理系统，由客服人员及时跟进处理。
                </p>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
