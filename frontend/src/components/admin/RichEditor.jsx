import { useMemo, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ image_b64: r.result, image_name: f.name }); r.readAsDataURL(f); });

export function RichEditor({ value, onChange, onUpload, placeholder, testId }) {
  const ref = useRef(null);
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link", "image"],
        ["clean"],
      ],
      handlers: {
        image() {
          const input = document.createElement("input");
          input.type = "file"; input.accept = "image/*";
          input.onchange = async () => {
            const f = input.files?.[0]; if (!f) return;
            const url = await onUpload(await readFile(f));
            if (!url) return;
            const q = ref.current?.getEditor(); if (!q) return;
            const range = q.getSelection(true);
            q.insertEmbed(range.index, "image", url);
            q.setSelection(range.index + 1);
          };
          input.click();
        },
      },
    },
  }), [onUpload]);

  return (
    <div data-testid={testId} className="rich-editor bg-white rounded-lg border border-slate-200 overflow-hidden [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-200 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[260px] [&_.ql-editor]:text-sm">
      <ReactQuill ref={ref} theme="snow" value={value || ""} onChange={onChange} modules={modules} placeholder={placeholder} />
    </div>
  );
}
