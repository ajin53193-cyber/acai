import json
import time
import urllib.request

BASE = "http://localhost:8001/api"
SID = f"test-live-{int(time.time())}"


def req(method, path, payload=None, token=None):
    r = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        method=method,
    )
    return json.load(urllib.request.urlopen(r))


token = req("POST", "/admin/login", {"username": "admin", "password": "Heying@2026"})["token"]
print("✅ 管理员登录")

# ===== 活码系统 =====
s = req("GET", "/settings")
chat = s["chat"]
assert len(chat["qr_codes"]) == 1, f"应已迁移出 1 个群码, 实际 {len(chat['qr_codes'])}"
assert chat["qr_codes"][0]["label"] == "1群"
print("✅ 旧单码自动迁移为多码列表（1群）")

# 添加 2群 并启用、停用 1群 → qr_image 应同步为 2群
img1 = chat["qr_codes"][0]["image"]
chat["qr_codes"].append({"image": img1 + "?g2", "label": "2群", "uploaded_at": "", "active": True})
chat["qr_codes"][0]["active"] = False
req("PUT", "/admin/settings", s, token=token)
s2 = req("GET", "/settings")
c2 = s2["chat"]
assert c2["qr_image"] == img1 + "?g2", f"qr_image 应同步为 2群, 实际 {c2['qr_image']}"
assert c2["qr_codes"][1]["uploaded_at"], "新加的 2群 应自动打上传时间"
assert c2["qr_codes"][0]["uploaded_at"], "1群 的上传时间应保留"
print(f"✅ 启用 2群后 qr_image 自动同步；2群上传时间 {c2['qr_codes'][1]['uploaded_at'][:16]}")

# 全部停用 → qr_image 置空（停止推送）
c2["qr_codes"][1]["active"] = False
s2["chat"] = c2
req("PUT", "/admin/settings", s2, token=token)
s3 = req("GET", "/settings")
assert s3["chat"]["qr_image"] == "", "全部停用后 qr_image 应为空"
print("✅ 全部停用后二维码推送自动关闭")

# 恢复：启用 1群
c3 = s3["chat"]
c3["qr_codes"][0]["active"] = True
c3["qr_codes"][0]["image"] = img1  # 还原 1群 图片
c3["qr_codes"] = [c3["qr_codes"][0]]  # 删掉测试用的 2群
s3["chat"] = c3
req("PUT", "/admin/settings", s3, token=token)
s4 = req("GET", "/settings")
assert s4["chat"]["qr_image"] == img1 and len(s4["chat"]["qr_codes"]) == 1
print("✅ 已恢复为 1群 启用状态")

# ===== 来源追踪 =====
req("POST", "/track", {"path": "/", "source": "pyq"})
req("POST", "/track", {"path": "/cooperation", "source": "pyq"})
today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))
ov = req("GET", f"/admin/stats/overview?date={today}", token=token)
src_names = [x["name"] for x in ov.get("sources", [])]
assert "pyq" in src_names or "直接访问" in src_names, f"来源统计缺失: {src_names}"
print(f"✅ 访问来源统计: {ov.get('sources')}")

# 客服会话来源
req("POST", "/chat/start", {"session_id": SID, "name": "渠道测试", "source": "gzh"})
req("POST", f"/chat/{SID}/messages", {"text": "怎么合作"})
time.sleep(1)
sessions = req("GET", "/admin/chat/sessions", token=token)["sessions"]
mine = next((x for x in sessions if x["id"] == SID), None)
assert mine and mine.get("source") == "gzh", f"会话来源未记录: {mine}"
print("✅ 客服会话已记录来源 gzh（公众号）")

# 二维码推送带群标签
stats = req("GET", "/admin/chat/qr-stats", token=token)
bi = stats.get("by_image", [])
assert bi and bi[0]["count"] >= 1 and "label" in bi[0], f"by_image 缺失: {bi}"
print(f"✅ 推送按群码统计: {bi[0]['label'] or '（无标签）'} 推送 {bi[0]['count']} 次")

print("\n全部测试通过")
