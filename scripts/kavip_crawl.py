import json, os, re, sys, time, html as htmlmod
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from nuxt_decode import decode_nuxt

OUT = "/app/scripts/kavip_data.json"
H = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Content-Type": "application/json", "Accept": "application/json",
    "languageid": "9", "currency": "USD", "clientid": "2615", "siteid": "2615",
    "Referer": "https://www.kavip.com/zh-tw", "firstreferer": "https://www.kavip.com",
}
API = "https://www.kavip.com/pro-api"
S = requests.Session()


def api(path, body=None):
    for i in range(3):
        try:
            r = S.post(f"{API}{path}", headers=H, json=body, timeout=30) if body is not None else S.get(f"{API}{path}", headers=H, timeout=30)
            return r.json()["data"]
        except Exception as e:
            time.sleep(1 + i)
    return None


def list_products():
    cats = api("/openapi/product/category")
    products = {}
    for c in cats:
        page = 1
        while True:
            d = api("/openapi/product/all", {"siteCategoryCode": c["categoryCode"], "pager": {"pageNum": page, "pageSize": 300}})
            rows = (d or {}).get("rows") or []
            for r in rows:
                r["categoryCode"] = c["categoryCode"]
                products.setdefault(str(r["productId"]), r)
            if len(rows) < 300:
                break
            page += 1
        print("category", c["categoryCode"], c["categoryName"], (d or {}).get("total"), flush=True)
    return cats, products


def fetch_detail(pid):
    url = f"https://www.kavip.com/zh-tw/detail/{pid}"
    for i in range(3):
        try:
            r = S.get(url, headers={"User-Agent": H["User-Agent"], "Accept-Language": "zh-TW"}, timeout=40)
            if r.status_code != 200:
                time.sleep(1 + i); continue
            d = decode_nuxt(r.text)
            data = d.get("data", {})
            pd = data.get(f"product-detail-{pid}")
            if not pd:
                return pid, None
            cm = data.get(f"comment-list-{pid}-1") or {}
            rows = (((cm.get("data") or {}).get("dataList") or {}).get("rows")) or []
            return pid, {
                "productName": pd.get("productName"), "productSubtitle": pd.get("productSubtitle"), "productDesc": pd.get("productDesc"),
                "productAliasName": pd.get("productAliasName"), "pcImage": pd.get("pcImage"), "wapImage": pd.get("wapImage"),
                "productContent": pd.get("productContent"), "categoryCode": pd.get("siteProductCategoryCode"), "categoryName": pd.get("siteCategoryName"),
                "supportBuyNumber": pd.get("supportBuyNumber"), "limitBuyNumber": pd.get("limitBuyNumber"),
                "specCategoryList": [{"id": s.get("specCategoryId"), "name": s.get("specCategoryName")} for s in (pd.get("specCategoryList") or []) if isinstance(s, dict)],
                "specs": [{"specId": s.get("specId"), "name": s.get("specName"), "salePrice": s.get("salePrice"), "specialPrice": s.get("specialPrice"),
                           "badge": s.get("badgeText"), "currency": s.get("saleCurrency"), "specCategoryId": s.get("specCategoryId"), "specCategoryName": s.get("specCategoryName"),
                           "todayLimitBuy": s.get("todayLimitBuy")} for s in (pd.get("specList") or []) if isinstance(s, dict)],
                "delivery": [{"code": x.get("deliveryCompCode"), "name": x.get("compName"), "required": x.get("inputRequired"), "placeholder": x.get("inputPlaceholder"),
                              "tips": x.get("inputTips"), "type": x.get("compType"), "options": [o.get("label") or o.get("value") for o in (x.get("selectDataSource") or []) if isinstance(o, dict)]}
                             for x in (pd.get("productDeliveryList") or []) if isinstance(x, dict)],
                "comments": [{"score": c.get("commentScore"), "text": c.get("commentText"), "user": c.get("userAccount"), "time": c.get("commentTime")} for c in rows if isinstance(c, dict)],
                "commentCount": ((cm.get("data") or {}).get("count")), "commentScore": ((cm.get("data") or {}).get("score")),
            }
        except Exception as e:
            time.sleep(1 + i)
    return pid, None


def main():
    state = json.load(open(OUT)) if os.path.exists(OUT) else {}
    if "products" not in state:
        cats, products = list_products()
        state = {"categories": cats, "products": products, "details": {}}
        json.dump(state, open(OUT, "w"), ensure_ascii=False)
    todo = [pid for pid in state["products"] if pid not in state["details"]]
    print("total products", len(state["products"]), "todo", len(todo), flush=True)
    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(fetch_detail, pid) for pid in todo]
        for f in as_completed(futs):
            pid, det = f.result()
            state["details"][pid] = det
            done += 1
            if done % 50 == 0:
                json.dump(state, open(OUT, "w"), ensure_ascii=False)
                print("progress", done, "/", len(todo), flush=True)
    json.dump(state, open(OUT, "w"), ensure_ascii=False)
    ok = sum(1 for v in state["details"].values() if v)
    print("DONE details ok", ok, "failed", len(state["details"]) - ok, flush=True)


if __name__ == "__main__":
    main()
