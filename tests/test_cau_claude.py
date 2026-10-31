"""Cầu Claude (scripts/cau_claude.py): giao thức Messages + SSE, đổi công cụ ↔ JSON, lỗi, nguồn, Dừng — bằng Claude Code giả."""
import http.client
import json
import os
import sys
import threading
import time
from pathlib import Path

import pytest

GOC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(GOC / "scripts"))
import cau_claude as cau  # noqa: E402

GIA = [sys.executable, str(Path(__file__).with_name("fake_claude.py"))]
CONG_CU = [{"name": "get_state", "description": "Đọc trạng thái", "input_schema": {"type": "object", "properties": {"x": {"type": "number"}}}}]
THAN = {"model": "claude-sonnet-5-5", "max_tokens": 100, "stream": True, "system": [{"type": "text", "text": "LỜI HỆ THỐNG"}],
        "tools": CONG_CU, "output_config": {"effort": "low"}, "messages": [{"role": "user", "content": "xem dự án"}]}


@pytest.fixture
def may(monkeypatch, tmp_path):
    monkeypatch.setenv("FAKE_GHI", str(tmp_path / "ghi.jsonl"))
    monkeypatch.setattr(cau, "CHO_TAM_THOI_GIAY", 0.01)
    sv = cau.tao_may_chu(0, GIA)
    threading.Thread(target=sv.serve_forever, daemon=True).start()
    yield sv.server_address[1], tmp_path / "ghi.jsonl"
    sv.shutdown()
    sv.server_close()


def goi(cong, duong, than=None, nguon=None, phuong_thuc=None):
    c = http.client.HTTPConnection("127.0.0.1", cong, timeout=60)
    h = {"Content-Type": "application/json", **({"Origin": nguon} if nguon else {})}
    c.request(phuong_thuc or ("POST" if than is not None else "GET"), duong, json.dumps(than) if than is not None else None, h)
    r = c.getresponse()
    return r.status, r.getheader("Content-Type") or "", r.read().decode("utf-8")


def sse(chu):
    return [(b.split("\n")[0][7:], json.loads(b.split("\n")[1][6:])) for b in chu.strip().split("\n\n")]


def test_luong_chu_dung_thu_tu_sse(may, monkeypatch):
    cong, ghi = may
    monkeypatch.setenv("FAKE_KICH_BAN", "chu")
    ma, kieu, chu = goi(cong, "/v1/messages?beta=true", THAN)
    assert ma == 200 and kieu.startswith("text/event-stream")
    ev = sse(chu)
    assert [e[0] for e in ev][:2] == ["message_start", "content_block_start"] and [e[0] for e in ev][-3:] == ["content_block_stop", "message_delta", "message_stop"]
    assert "".join(e[1]["delta"]["text"] for e in ev if e[0] == "content_block_delta") == "Xin chào " * 20
    md = [e for e in ev if e[0] == "message_delta"][0][1]
    assert md["delta"]["stop_reason"] == "end_turn" and md["usage"]["output_tokens"] == 7
    assert ev[0][1]["message"]["usage"]["cache_read_input_tokens"] == 50 and ev[0][1]["message"]["model"] == "claude-sonnet-5-5"


def test_goi_cong_cu_thanh_tool_use_va_bo_ten_la(may, monkeypatch):
    cong, _ = may
    monkeypatch.setenv("FAKE_KICH_BAN", "goi")
    ev = sse(goi(cong, "/v1/messages", THAN)[2])
    bat_dau = [e[1]["content_block"] for e in ev if e[0] == "content_block_start"]
    assert [b["type"] for b in bat_dau] == ["text", "tool_use"] and bat_dau[1]["name"] == "get_state" and bat_dau[1]["id"].startswith("toolu_")
    assert json.loads("".join(e[1]["delta"]["partial_json"] for e in ev if e[1].get("delta", {}).get("type") == "input_json_delta")) == {"x": 1}
    assert [e for e in ev if e[0] == "message_delta"][0][1]["delta"]["stop_reason"] == "tool_use"
    chu = "".join(e[1]["delta"]["text"] for e in ev if e[1].get("delta", {}).get("type") == "text_delta")
    assert "khong_co" in chu   # công cụ không có trong danh sách: bị bỏ, có ghi chú


def test_khong_stream_tra_tin_nhan_day_du(may, monkeypatch):
    cong, _ = may
    monkeypatch.setenv("FAKE_KICH_BAN", "chu")
    ma, kieu, chu = goi(cong, "/v1/messages", {**THAN, "stream": False})
    m = json.loads(chu)
    assert ma == 200 and m["type"] == "message" and m["stop_reason"] == "end_turn" and m["content"][0]["type"] == "text"


def test_dong_lenh_va_ban_ghi(may, monkeypatch):
    cong, ghi = may
    monkeypatch.setenv("FAKE_KICH_BAN", "chu")
    ls = [{"role": "user", "content": "đổi căn"},
          {"role": "assistant", "content": [{"type": "thinking", "thinking": "BI MAT", "signature": "s"}, {"type": "text", "text": "ok"},
                                            {"type": "tool_use", "id": "toolu_1", "name": "get_state", "input": {"a": 1}}]},
          {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_1", "content": "5 tòa"},
                                       {"type": "tool_result", "tool_use_id": "toolu_x", "content": [{"type": "text", "text": "hỏng"}], "is_error": True}]}]
    goi(cong, "/v1/messages", {**THAN, "model": "claude-haiku-5-5", "messages": ls})
    d = json.loads(ghi.read_text(encoding="utf-8").splitlines()[0])
    a = d["args"]
    assert a[a.index("--model") + 1] == "haiku" and a[a.index("--effort") + 1] == "low" and a[a.index("--tools") + 1] == ""
    assert "--no-session-persistence" in a and "--strict-mcp-config" in a and "--allowedTools" not in a
    assert "LỜI HỆ THỐNG" in d["he_thong"] and "GIAO THỨC" in d["he_thong"] and '"ten":"get_state"' in d["he_thong"]
    assert "→ GỌI get_state" in d["stdin"] and "← KẾT QUẢ get_state: 5 tòa" in d["stdin"] and "← LỖI ?: hỏng" in d["stdin"]
    assert "BI MAT" not in d["stdin"]   # khối thinking không vào bản ghi


def test_anh_dinh_kem_bat_read(may, monkeypatch):
    import base64
    cong, ghi = may
    monkeypatch.setenv("FAKE_KICH_BAN", "chu")
    anh = {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(b"x").decode()}}
    goi(cong, "/v1/messages", {**THAN, "messages": [{"role": "user", "content": [anh, {"type": "text", "text": "xem"}]}]})
    d = json.loads(ghi.read_text(encoding="utf-8").splitlines()[0])
    assert d["args"][d["args"].index("--tools") + 1] == "Read" and "--add-dir" in d["args"] and "tep_1.png" in d["stdin"]


@pytest.mark.parametrize("kich_ban,ma_http,kieu", [("chua_dang_nhap", 401, "authentication_error"), ("han_muc", 429, "rate_limit_error")])
def test_loi_theo_dang_anthropic(may, monkeypatch, kich_ban, ma_http, kieu):
    cong, _ = may
    monkeypatch.setenv("FAKE_KICH_BAN", kich_ban)
    ma, _, chu = goi(cong, "/v1/messages", THAN)
    assert ma == ma_http and json.loads(chu)["error"]["type"] == kieu


def test_loi_tam_thoi_thu_lai(may, monkeypatch, tmp_path):
    cong, ghi = may
    monkeypatch.setenv("FAKE_KICH_BAN", "tam_thoi")
    monkeypatch.setenv("FAKE_DEM", str(tmp_path / "dem"))
    assert goi(cong, "/v1/messages", {**THAN, "stream": False})[0] == 200
    assert len(ghi.read_text(encoding="utf-8").splitlines()) == 2


def test_mo_hinh_la_va_nguon_la(may):
    cong, _ = may
    assert goi(cong, "/v1/messages", {**THAN, "model": "gpt-9"})[0] == 400
    assert goi(cong, "/v1/messages", THAN, nguon="https://trang-la.example")[0] == 403
    assert goi(cong, "/v1/messages", THAN, nguon="http://localhost:5173")[0] == 200


def test_nguon_khai_them(may, monkeypatch):
    cong, _ = may
    monkeypatch.setenv("LEO_CAU_NGUON", "https://unitmix.example.workers.dev/")
    assert goi(cong, "/suc-khoe", nguon="https://unitmix.example.workers.dev")[0] == 200


def test_suc_khoe(may, monkeypatch):
    cong, _ = may
    monkeypatch.setenv("FAKE_KICH_BAN", "chu")
    ma, _, chu = goi(cong, "/suc-khoe")
    j = json.loads(chu)
    assert ma == 200 and j["ok"] and j["dang_nhap"] is True and j["tai_khoan"]["subscriptionType"] == "max" and j["cau"] == cau.PHIEN_BAN_CAU


def test_dung_giua_chung_giet_tien_trinh(may, monkeypatch):
    import socket
    cong, ghi = may
    monkeypatch.setenv("FAKE_KICH_BAN", "treo")
    s = socket.create_connection(("127.0.0.1", cong))
    b = json.dumps(THAN).encode()
    s.sendall(b"POST /v1/messages HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n" % len(b) + b)
    t0 = time.time()
    while not (ghi.exists() and ghi.read_text()) and time.time() - t0 < 15:
        time.sleep(0.1)
    s.close()   # như SDK khi bấm Dừng
    time.sleep(1.5)
    import subprocess
    ps = subprocess.run(["pgrep", "-f", "fake_claude.py"], capture_output=True, text=True).stdout.strip()
    assert ps == ""   # tiến trình giả đang ngủ 60 s phải đã bị giết
