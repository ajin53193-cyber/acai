"""Wrap Traditional-Chinese UI strings in t() across frontend source. Idempotent-ish: skips strings already inside t(...)."""
import re, sys, glob, json, os

ROOT = "/app/frontend/src"
CJK = re.compile(r"[\u4e00-\u9fff]")
SKIP_DIRS = ("/components/ui/", "/i18n/")


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def convert_template(src: str) -> str:
    """`文字 ${x} 文字` -> t("文字 {0} 文字", x)"""
    out, i, n = [], 0, len(src)
    while i < n:
        if src[i] == "`":
            j, parts, exprs, depth, buf = i + 1, [], [], 0, []
            ok = False
            while j < n:
                c = src[j]
                if c == "\\":
                    buf.append(src[j:j + 2]); j += 2; continue
                if c == "$" and j + 1 < n and src[j + 1] == "{":
                    parts.append("".join(buf)); buf = []
                    k, depth = j + 2, 1
                    while k < n and depth:
                        if src[k] == "{": depth += 1
                        elif src[k] == "}": depth -= 1
                        k += 1
                    exprs.append(src[j + 2:k - 1]); j = k; continue
                if c == "`":
                    parts.append("".join(buf)); ok = True; j += 1; break
                buf.append(c); j += 1
            lit = src[i:j]
            text = "".join(parts)
            if ok and CJK.search(text) and "\n" not in lit and not src[max(0, i - 2):i].endswith("t("):
                key = ""
                for idx, p in enumerate(parts):
                    key += p
                    if idx < len(exprs): key += "{%d}" % idx
                args = ", ".join(exprs)
                out.append('t("%s"%s)' % (esc(key), (", " + args) if args else ""))
            else:
                out.append(lit)
            i = j
        else:
            out.append(src[i]); i += 1
    return "".join(out)


STR_RE = re.compile(r'(?P<pre>[=:(,\[?{\s]|\breturn\s|&&\s|\|\|\s)(?P<q>["\'])(?P<s>(?:[^"\'\\\n]|\\.)*?)(?P=q)')


def convert_strings(src: str) -> str:
    def rep(m):
        s = m.group("s")
        if not CJK.search(s):
            return m.group(0)
        pre = m.group("pre")
        start = m.start()
        before = src[max(0, start - 3):start + len(pre)]
        if before.endswith("t("):
            return m.group(0)
        q = m.group("q")
        inner = s if q == '"' else s.replace('\\"', '"').replace('"', '\\"').replace("\\'", "'")
        call = 't("%s")' % inner
        # JSX attribute: name="..." -> name={t("...")}
        if pre == "=" and re.search(r"[A-Za-z0-9_-]$", src[max(0, start - 1):start]):
            return "={%s}" % call
        return pre + call
    return STR_RE.sub(rep, src)


TEXT_RE = re.compile(r"(?P<open>[>}])(?P<ws1>\s*)(?P<text>[^<>{}\n]*?[\u4e00-\u9fff][^<>{}\n]*?)(?P<ws2>\s*)(?P<close>[<{])")
BAD = re.compile(r'["\'`()=;?]|&&|\|\||//')


def convert_text(src: str) -> str:
    def rep(m):
        text = m.group("text")
        if BAD.search(text):
            return m.group(0)
        return "%s%s{t(\"%s\")}%s%s" % (m.group("open"), m.group("ws1"), esc(text), m.group("ws2"), m.group("close"))
    prev = None
    while prev != src:
        prev = src
        src = TEXT_RE.sub(rep, src)
    return src


def process(path: str) -> bool:
    src = open(path, encoding="utf-8").read()
    if not CJK.search(src):
        return False
    new = convert_template(src)
    new = convert_strings(new)
    new = convert_text(new)
    if new == src:
        return False
    if "from \"@/i18n\"" not in new:
        lines = new.split("\n")
        idx = 0
        for i, l in enumerate(lines):
            if l.startswith("import "):
                idx = i
        # handle multi-line import ending later
        j = idx
        while j < len(lines) and not re.search(r"from\s+['\"].*['\"];?\s*$", lines[j]):
            j += 1
        lines.insert(j + 1, 'import { t } from "@/i18n";')
        new = "\n".join(lines)
    open(path, "w", encoding="utf-8").write(new)
    return True


def extract_keys():
    keys = set()
    for f in glob.glob(ROOT + "/**/*.js*", recursive=True):
        if any(d in f for d in SKIP_DIRS):
            continue
        s = open(f, encoding="utf-8").read()
        for m in re.finditer(r'tr\("((?:[^"\\]|\\.)*)"', s):
            keys.add(json.loads('"' + m.group(1) + '"'))
    return sorted(keys)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "keys":
        ks = extract_keys()
        json.dump(ks, open("/app/scripts/i18n_keys.json", "w"), ensure_ascii=False, indent=0)
        print(len(ks), "keys")
    else:
        changed = 0
        for f in glob.glob(ROOT + "/**/*.js*", recursive=True):
            if any(d in f for d in SKIP_DIRS):
                continue
            if process(f):
                changed += 1; print("changed", f)
        print(changed, "files changed")
