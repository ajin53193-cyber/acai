import json
import time
import urllib.request

BASE = "http://localhost:8001/api"
SID = f"test-stats-{int(time.time())}"


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

# 1. 触发一次二维码推送
req("POST", "/chat/start", {"session_id": SID, "name": "统计测试"})
req("POST", f"/chat/{SID}/messages", {"text": "怎么合作"})
time.sleep(1)

# 2. 验证 qr-stats 统计接口
stats = req("GET", "/admin/chat/qr-stats", token=token)
assert stats["total"] >= 1, f"total 应>=1, 实际 {stats}"
assert stats["today"] >= 1, f"today 应>=1, 实际 {stats}"
assert len(stats["daily"]) == 14, "daily 应为 14 天"
assert stats["daily"][-1]["count"] >= 1, "今天的柱状图应有计数"
print(f"✅ 二维码推送统计: 今日 {stats['today']} 次, 累计 {stats['total']} 次, 14天柱状图正常")

# 3. 验证更换二维码时自动记录上传时间
settings = req("GET", "/settings")
old_qr = settings["chat"]["qr_image"]
settings["chat"]["qr_image"] = old_qr + "?v=2"  # 模拟换码
req("PUT", "/admin/settings", settings, token=token)
s2 = req("GET", "/settings")
stamped = s2["chat"].get("qr_updated_at", "")
assert stamped, "换码后 qr_updated_at 应被打上时间戳"
print(f"✅ 换码自动记录上传时间: {stamped}")

# 4. 再次保存但不换码 → 时间戳应保持不变
req("PUT", "/admin/settings", s2, token=token)
s3 = req("GET", "/settings")
assert s3["chat"]["qr_updated_at"] == stamped, "未换码时时间戳不应被覆盖"
print("✅ 未换码时时间戳保持不变")

# 5. 恢复二维码为正常值
s3["chat"]["qr_image"] = old_qr
req("PUT", "/admin/settings", s3, token=token)
s4 = req("GET", "/settings")
assert s4["chat"]["qr_image"] == old_qr and s4["chat"]["qr_updated_at"], "恢复失败"
print("✅ 二维码已恢复为正常路径，时间戳保留")
print("\n全部后端测试通过")
