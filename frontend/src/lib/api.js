import axios from "axios";
import { requestStepUp } from "./stepup";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error;
    const detail = response?.data?.detail;
    if (response && response.status === 428 && detail && detail.step_up && config && (config.__su || 0) < 6) {
      try {
        const { opCode, totpCode } = await requestStepUp({ needOp: detail.need_op_code, needTotp: detail.need_totp, error: detail.error });
        config.__su = (config.__su || 0) + 1;
        config.headers = { ...(config.headers || {}) };
        if (opCode) config.headers["X-Op-Code"] = opCode;
        if (totpCode) config.headers["X-Op-Totp"] = totpCode;
        return api(config);
      } catch (e) {
        return Promise.reject(error);
      }
    }
    if (response && response.status === 403 && detail && detail.op_code_required) {
      toast.error(detail.msg, {
        action: { label: "去设置", onClick: () => { window.location.href = "/security"; } },
      });
    }
    return Promise.reject(error);
  }
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "操作失败，请重试";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  if (detail && typeof detail.error === "string") return detail.error;
  return String(detail);
}

export default api;
