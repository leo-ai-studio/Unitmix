# -*- coding: utf-8 -*-
"""Claude Code giả cho tests/test_cau_claude.py: cùng giao diện dòng lệnh mà scripts/cau_claude.py gọi.
Kịch bản chọn bằng FAKE_KICH_BAN; ghi tham số + stdin + lời hệ thống ra FAKE_GHI để test kiểm."""
import json
import os
import sys

a = sys.argv[1:]
if a[:1] == ["--version"]:
    print("2.1.314 (Claude Code)")
    sys.exit(0)
if a[:2] == ["auth", "status"]:
    print(json.dumps({"loggedIn": os.environ.get("FAKE_KICH_BAN") != "chua_dang_nhap", "authMethod": "claude.ai", "email": "a@b.c", "subscriptionType": "max"}))
    sys.exit(0)

stdin = sys.stdin.buffer.read().decode("utf-8")
he_thong = ""
if "--system-prompt-file" in a:
    he_thong = open(a[a.index("--system-prompt-file") + 1], encoding="utf-8").read()
if os.environ.get("FAKE_GHI"):
    with open(os.environ["FAKE_GHI"], "a", encoding="utf-8") as f:
        f.write(json.dumps({"args": a, "stdin": stdin, "he_thong": he_thong}, ensure_ascii=False) + "\n")

kb = os.environ.get("FAKE_KICH_BAN", "chu")
dem = os.environ.get("FAKE_DEM")
if kb == "tam_thoi" and dem:
    n = int(open(dem).read() or 0) if os.path.exists(dem) else 0
    open(dem, "w").write(str(n + 1))
    if n < 1:
        print(json.dumps({"type": "result", "is_error": True, "result": "OAuth token refresh failed: another Claude Code process is refreshing (usually transient)"}))
        sys.exit(0)

usage = {"input_tokens": 3, "output_tokens": 7, "cache_creation_input_tokens": 100, "cache_read_input_tokens": 50}
if kb == "chua_dang_nhap":
    print(json.dumps({"type": "result", "is_error": True, "result": "Invalid API key · Please run /login"}))
elif kb == "han_muc":
    print(json.dumps({"type": "result", "is_error": True, "result": "Claude usage limit reached. Your limit will reset at 5pm."}))
elif kb == "goi":
    print(json.dumps({"type": "result", "is_error": False, "usage": usage, "structured_output": {
        "chu": "Đang xem.", "goi": [{"ten": "get_state", "dau_vao": {"x": 1}}, {"ten": "khong_co", "dau_vao": {}}]}}))
elif kb == "treo":
    import time
    time.sleep(60)
else:
    print(json.dumps({"type": "result", "is_error": False, "usage": usage, "structured_output": {"chu": "Xin chào " * 20, "goi": []}}))
