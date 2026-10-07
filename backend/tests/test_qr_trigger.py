import json
import time
import urllib.request

BASE = "http://localhost:8001/api"
SID = f"test-qr-{int(time.time())}"


def post(path, payload):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.load(urllib.request.urlopen(req))


def get(path):
    return json.load(urllib.request.urlopen(BASE + path))


def qr_count():
    msgs = get(f"/chat/{SID}/messages")["messages"]
    qr = [m for m in msgs if m.get("image") and m["sender"] == "admin"]
    return qr, msgs


post("/chat/start", {"session_id": SID, "name": "测试"})

print("--- 测试1: 发送「怎么合作」---")
post(f"/chat/{SID}/messages", {"text": "怎么合作"})
time.sleep(1)
qr, _ = qr_count()
print("✅ 收到二维码消息" if qr else "❌ 没有二维码消息")
if qr:
    print("   文案:", qr[-1]["text"][:60])
    print("   图片:", qr[-1]["image"][:70])

print("--- 测试2: 紧接着发送「怎么加入」（应去重）---")
post(f"/chat/{SID}/messages", {"text": "怎么加入"})
time.sleep(1)
qr, _ = qr_count()
print(f"   二维码消息总数: {len(qr)}", "✅ 去重成功" if len(qr) == 1 else "❌ 重复发送")

print("--- 测试3: 发送「你们平台成立多久了」（不应触发）---")
post(f"/chat/{SID}/messages", {"text": "你们平台成立多久了"})
time.sleep(1)
qr, _ = qr_count()
print(f"   二维码消息总数: {len(qr)}", "✅ 未误触发" if len(qr) == 1 else "❌ 误触发")

print("--- 测试4: 等待 AI 回复（验证与二维码推送共存）---")
for i in range(15):
    time.sleep(3)
    _, msgs = qr_count()
    ai = [m for m in msgs if m["sender"] == "admin" and m.get("via") == "ai" and not m.get("image")]
    if ai:
        print(f"✅ AI 回复（{(i + 1) * 3}s）:", ai[-1]["text"][:60])
        break
else:
    print("❌ AI 未回复")
