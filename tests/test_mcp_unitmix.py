# -*- coding: utf-8 -*-
"""Cầu MCP Unitmix (scripts/mcp_unitmix/mdi_unitmix_mcp.py): JSON-RPC stdio + trang giả hỏi việc qua HTTP."""
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

CAU = os.path.join(os.path.dirname(__file__), "..", "scripts", "mcp_unitmix", "mdi_unitmix_mcp.py")


def _cong_trong():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _mo(cong):
    env = dict(os.environ, MDI_UNITMIX_PORT=str(cong), MDI_UNITMIX_TIMEOUT="5")
    env.pop("PYTHONIOENCODING", None)
    return subprocess.Popen([sys.executable, CAU], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            env=env, text=True, encoding="utf-8")


def _rpc(p, i, m, params=None):
    p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": i, "method": m, "params": params or {}}) + "\n")
    p.stdin.flush()
    return json.loads(p.stdout.readline())


def _chu(r):
    return r["result"]["content"][0]["text"]


def _trang_gia(cong, so_viec):
    """Trang giả: hỏi việc, trả kết quả theo loại."""
    def chay():
        xong = 0
        while xong < so_viec:
            u = "http://127.0.0.1:%d/viec?tt=%s" % (cong, urllib.parse.quote(json.dumps({"du_an": "thu", "pa": "pa-1"})))
            with urllib.request.urlopen(u, timeout=30) as r:
                if r.status != 200:
                    continue
                v = json.loads(r.read())
            kq = {"danh_sach": [{"ten": "get_state", "moTa": "Đọc trạng thái"}],
                  "goi": {"ok": True, "noi_dung": "Đ" * 9000},
                  "nhieu": [{"ten": "get_state", "ok": True, "noi_dung": "x"}, {"ten": "khong_co", "ok": False, "noi_dung": "Không có"}],
                  "js": {"so_lo": 22}}[v["loai"]]
            b = json.dumps({"id": v["id"], "ket_qua": kq, "loi": None}).encode()
            urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:%d/xong" % cong, b, {"Content-Type": "text/plain"}), timeout=10)
            xong += 1
    t = threading.Thread(target=chay, daemon=True)
    t.start()
    return t


def test_khong_co_trang_thi_huong_dan_noi():
    cong = _cong_trong()
    p = _mo(cong)
    try:
        assert _rpc(p, 1, "initialize", {"protocolVersion": "2025-06-18"})["result"]["serverInfo"]["name"] == "MDI-unitmix-connector"
        assert {t["name"] for t in _rpc(p, 2, "tools/list")["result"]["tools"]} >= {"unitmix_status", "unitmix_call", "unitmix_run_js"}
        assert "?congCu=1&mcp=%d" % cong in _chu(_rpc(p, 3, "tools/call", {"name": "unitmix_status", "arguments": {}}))
        r = _rpc(p, 4, "tools/call", {"name": "unitmix_call", "arguments": {"ten": "get_state"}})
        assert r["result"].get("isError") is True
    finally:
        p.kill()


def test_trang_noi_thi_chay_va_cat_gon():
    cong = _cong_trong()
    p = _mo(cong)
    try:
        _rpc(p, 1, "initialize")
        _trang_gia(cong, 4)
        time.sleep(0.5)
        assert json.loads(_chu(_rpc(p, 2, "tools/call", {"name": "unitmix_status", "arguments": {}})))["noi"] is True
        assert "get_state — Đọc trạng thái" in _chu(_rpc(p, 3, "tools/call", {"name": "unitmix_list_tools", "arguments": {}}))
        s = _chu(_rpc(p, 4, "tools/call", {"name": "unitmix_call", "arguments": {"ten": "get_state", "max_chars": 100}}))
        assert s.startswith("Đ" * 100) and "cắt bớt 8900 / 9000" in s
        s = _chu(_rpc(p, 5, "tools/call", {"name": "unitmix_call_many", "arguments": {"lenh": [{"ten": "get_state"}, {"ten": "khong_co"}, {"ten": "get_state"}]}}))
        assert "2. khong_co LỖI" in s and "1 lệnh chưa chạy" in s
        assert json.loads(_chu(_rpc(p, 6, "tools/call", {"name": "unitmix_run_js", "arguments": {"ma": "async (T) => 1"}}))) == {"so_lo": 22}
    finally:
        p.kill()
