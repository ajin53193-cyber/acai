import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Upload, Loader2, Link2 } from "lucide-react";
import { API, formatDetail } from "@/lib/api";

const inputCls =
  "w-full rounded-xl border border-amber-500/15 bg-[#060B18]/70 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4AF37]/60";

export const VideoUpload = ({ token, value, onChange, testid }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      toast.error("视频不能超过 60MB，建议先压缩或粘贴外部视频链接");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/admin/upload-video`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (ev) => setProgress(ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0),
      });
      onChange(res.data.url);
      toast.success("视频已上传");
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={testid} className="space-y-2">
      <div className="flex items-center gap-2">
        <Link2 size={14} className="shrink-0 text-slate-500" />
        <input
          data-testid={`${testid}-url-input`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="粘贴视频链接（MP4 直链 / 腾讯视频 / B 站播放器地址），或点右侧上传"
          className={inputCls}
        />
        <button
          type="button"
          data-testid={`${testid}-btn`}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs text-[#E5C158] transition-colors hover:bg-amber-500/10 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? `${progress}%` : "上传视频"}
        </button>
        <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={onFile} data-testid={`${testid}-file-input`} />
      </div>
      <p className="text-[11px] text-slate-500">上传支持 MP4 / WEBM / MOV，单个不超过 60MB；更大的视频建议上传到腾讯视频或 B 站后粘贴播放地址</p>
    </div>
  );
};
