import re, json, sys

def decode_nuxt(html):
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    arr = json.loads(m.group(1))
    memo = {}
    def rev(i):
        if i in memo: return memo[i]
        v = arr[i]
        if isinstance(v, (int, float)) and not isinstance(v, bool) and False: pass
        if isinstance(v, list):
            if len(v) >= 1 and isinstance(v[0], str) and v[0] in ("Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef"):
                memo[i] = None
                r = rev(v[1]) if len(v) > 1 and isinstance(v[1], int) else None
                memo[i] = r; return r
            if len(v) >= 1 and isinstance(v[0], str) and v[0] in ("Date", "Set", "Map", "RegExp", "BigInt", "null", "undefined", "NaN"):
                memo[i] = None; return None
            memo[i] = []
            out = memo[i]
            for x in v:
                out.append(rev(x) if isinstance(x, int) else x)
            return out
        if isinstance(v, dict):
            memo[i] = {}
            out = memo[i]
            for k, x in v.items():
                out[k] = rev(x) if isinstance(x, int) else x
            return out
        memo[i] = v
        return v
    return rev(0)

def find(obj, pred, path="", acc=None):
    if acc is None: acc = []
    if isinstance(obj, dict):
        if pred(obj): acc.append((path, obj))
        for k, v in obj.items(): find(v, pred, f"{path}.{k}", acc)
    elif isinstance(obj, list):
        for i, v in enumerate(obj): find(v, pred, f"{path}[{i}]", acc)
    return acc

if __name__ == "__main__":
    html = open(sys.argv[1]).read()
    d = decode_nuxt(html)
    hits = find(d, lambda o: "specName" in o and "salePrice" in o)
    print(len(hits))
    for p, o in hits[:3]:
        print(p, {k: o[k] for k in ("specId","productId","specName","salePrice","specialPrice","badgeText","saleCurrency") if k in o})
    prods = find(d, lambda o: "productName" in o or "goodsName" in o)
    for p, o in prods[:2]:
        print(p, list(o.keys())[:40])
