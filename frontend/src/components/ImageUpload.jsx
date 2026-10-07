import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { API, formatDetail } from "@/lib/api";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const toFullUrl = (url) => (url && url.startsWith("/api/") ? `${BACKEND}${url}` : url);

export const ImageUpload = ({ token, value, onChange, round = false, testid }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/admin/upload`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onChange(res.data.url);
      toast.success("图片已上传");
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={testid} className="flex items-center gap-3">
      {value ? (
        <img
          src={toFullUrl(value)}
          alt="预览"
          loading="lazy"
          decoding="async"
          className={`border border-[#D4AF37]/40 object-cover ${round ? "h-14 w-14 rounded-full" : "h-16 w-24 rounded-lg"}`}
        />
      ) : (
        <div className={`flex items-center justify-center border border-dashed border-slate-600 text-[10px] text-slate-500 ${round ? "h-14 w-14 rounded-full" : "h-16 w-24 rounded-lg"}`}>
          无图
        </div>
      )}
      <button
        type="button"
        data-testid={`${testid}-btn`}
        onClick={pick}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10 disabled:opacity-60"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "上传中…" : value ? "更换图片" : "上传图片"}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFile} data-testid={`${testid}-file-input`} />
    </div>
  );
};
