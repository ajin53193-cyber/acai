import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { X, MapPin, Crown, Users, Headset, Lock } from "lucide-react";
import { API } from "@/lib/api";
import { useSettings } from "@/lib/useSettings";
import { getVisitorId } from "@/lib/source";

const track = (projectId, type) => {
  axios.post(`${API}/projects/${projectId}/events`, { type, visitor_id: getVisitorId() }).catch(() => {});
};

/** 项目卡片点击后的「进群查看」提示弹窗（首页 / 项目中心共用） */
export const ProjectGateModal = ({ project, onClose }) => {
  const { chat, copy } = useSettings();
  const pc = copy.projects;
  const groupLink = chat.welcome_group_link || "/tutorials/join-group";

  useEffect(() => {
    if (project) track(project.id, "open");
  }, [project]);

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          data-testid="project-gate-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#060B18]/85 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card w-full max-w-md overflow-hidden rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-44">
              <img src={project.image} alt={project.title} decoding="async" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1730] via-[#0A1228]/40 to-transparent" />
              <button
                data-testid="project-modal-close-btn"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full border border-amber-500/30 bg-[#060B18]/70 p-2 text-[#E5C158] backdrop-blur-sm transition-colors hover:bg-[#D4AF37]/20"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-2 text-xs">
                  {project.featured && (
                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FFE896] to-[#D4AF37] px-3 py-1 font-black text-[#060B18]">
                      <Crown size={11} /> 主打
                    </span>
                  )}
                  <span className="rounded-full border border-amber-500/40 bg-[#060B18]/75 px-3 py-1 text-[#E5C158] backdrop-blur-sm">{project.category}</span>
                  <span className="flex items-center gap-1 text-slate-300"><MapPin size={12} className="text-[#D4AF37]" />{project.region}</span>
                </div>
                <h3 className="mt-2 font-display text-xl font-black text-slate-50">{project.title}</h3>
              </div>
            </div>
            <div className="p-6 text-center sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-[#E5C158]">
                <Lock size={22} />
              </div>
              <h4 className="mt-4 font-display text-lg font-bold text-gold-gradient" data-testid="project-gate-title">{pc.gate_title}</h4>
              <p className="mt-3 text-sm leading-relaxed text-slate-300" data-testid="project-gate-desc">{pc.gate_desc}</p>
              <div className="mt-7 grid gap-3">
                <Link
                  to={groupLink}
                  data-testid="project-gate-group-btn"
                  onClick={() => track(project.id, "group")}
                  className="flex items-center justify-center gap-2 rounded-full bg-gold-gradient py-3.5 text-sm font-bold text-[#060B18] shadow-[0_0_24px_rgba(212,175,55,0.4)] transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,232,150,0.6)]"
                >
                  <Users size={16} /> {pc.gate_btn}
                </Link>
                <button
                  type="button"
                  data-testid="project-gate-chat-btn"
                  onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("hy:open-chat")); }}
                  className="flex items-center justify-center gap-2 rounded-full border border-amber-500/40 py-3 text-sm font-medium text-[#E5C158] transition-colors hover:bg-[#D4AF37]/10"
                >
                  <Headset size={15} /> {pc.gate_secondary_btn}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
