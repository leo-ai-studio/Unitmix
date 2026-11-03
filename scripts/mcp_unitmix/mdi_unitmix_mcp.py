# -*- coding: utf-8 -*-
"""MDI-unitmix-connector — máy chủ MCP cho Claude Code gọi thẳng bộ công cụ của app Unitmix (Leo AI) trên trang đang mở.

Trước đây Claude Code phải điều khiển trình duyệt, gõ JS gọi `window.unitmixTools`, kết quả bị cắt 12.000 ký tự, mỗi bước tốn
cả ảnh / chữ trang. Cầu này nối hai đầu:

    Claude Code ──stdio JSON-RPC (MCP)──► cầu ──HTTP 127.0.0.1:3043──► trang app mở với ?congCu=1&mcp=3043

Trang (web/src/troLy/congChayNgoai.ts › noiCauMcp) tự hỏi việc ở cầu (long-poll), chạy bằng cổng công cụ sẵn có (cùng hoàn tác,
cùng tự lưu, cùng kiểm "Chỉ xem" — không sửa được nếu link không có mã sửa) rồi gửi kết quả. Cầu cắt gọn kết quả theo
`max_chars` trước khi trả cho Claude, nên tốn ít token. Chỉ thư viện chuẩn Python 3.9+.

Nhiều phiên Claude Code cùng chạy: phiên đầu giữ cổng, phiên sau tự gửi việc qua phiên đầu (POST /giao, chỉ từ máy này).

Biến môi trường:
    MDI_UNITMIX_PORT      cổng, mặc định 3043
    MDI_UNITMIX_ORIGINS   nguồn trang được phép (phẩy), mặc định app Cloudflare + localhost
    MDI_UNITMIX_TIMEOUT   giây chờ trang trả lời một việc, mặc định 120
"""
from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TEN = "MDI-unitmix-connector"
PHIEN_BAN = "1.0.0"
GIAO_THUC = "2025-06-18"
CONG = int(os.environ.get("MDI_UNITMIX_PORT", "3043"))
CHO = int(os.environ.get("MDI_UNITMIX_TIMEOUT", "120"))
NGUON = {n.strip().rstrip("/") for n in os.environ.get(
    "MDI_UNITMIX_ORIGINS", "https://unitmix.nghiavt-ai1.workers.dev,https://unitmix.leo-ai.dev").split(",") if n.strip()}

VIEC: "queue.Queue[dict]" = queue.Queue()
CHO_KQ: dict[str, dict] = {}            # id → {"su_kien": Event, "kq": ...}
TRANG = {"luc": 0.0, "tt": None}        # lần trang hỏi việc gần nhất

HUONG_DAN_NOI = (
    "Chưa có trang Unitmix nào nối cầu (cổng {cong}).\n"
    "Mở app với tham số ?congCu=1&mcp={cong}, ví dụ:\n"
    "  https://unitmix.nghiavt-ai1.workers.dev/du-an/<mã>?pa=<pa>&sua=<mã sửa>&congCu=1&mcp={cong}\n"
    "(không có mã sửa thì chỉ đọc được). Trình duyệt hỏi quyền truy cập mạng cục bộ thì bấm Cho phép."
)


def _log(s: str) -> None:
    sys.stderr.write("[unitmix-mcp] " + s + "\n")
    sys.stderr.flush()


# ------------------------------------------------------------------ máy phục vụ cho trang
class XuLy(BaseHTTPRequestHandler):
    server_version = "MDIUnitmixMCP/" + PHIEN_BAN

    def log_message(self, fmt, *a):  # im lặng: stdout là kênh MCP
        pass

    def _nguon(self):
        n = self.headers.get("Origin")
        if n is None:
            return None
        n = n.rstrip("/")
        if n in NGUON or n.startswith("http://localhost") or n.startswith("http://127.0.0.1"):
            return n
        return False

    def _dau(self, ma, nguon, kieu=None, dai=None):
        self.send_response(ma)
        if nguon:
            self.send_header("Access-Control-Allow-Origin", nguon)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        if kieu:
            self.send_header("Content-Type", kieu)
        if dai is not None:
            self.send_header("Content-Length", str(dai))

    def _json(self, ma, o, nguon):
        b = json.dumps(o, ensure_ascii=False).encode("utf-8")
        self._dau(ma, nguon, "application/json; charset=utf-8", len(b))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        n = self._nguon()
        self._dau(204 if n is not False else 403, n or None)
        self.end_headers()

    def do_GET(self):
        n = self._nguon()
        if n is False:
            return self._json(403, {"loi": "nguồn không được phép"}, None)
        u = urllib.parse.urlparse(self.path)
        if u.path == "/suc-khoe":
            return self._json(200, {"ok": True, "cau": TEN, "phien_ban": PHIEN_BAN, "trang": _trang_tt()}, n)
        if u.path != "/viec":
            return self._json(404, {"loi": "không có"}, n)
        tt = urllib.parse.parse_qs(u.query).get("tt", [None])[0]
        try:
            TRANG["tt"] = json.loads(tt) if tt else TRANG["tt"]
        except ValueError:
            pass
        TRANG["luc"] = time.time()
        try:
            v = VIEC.get(timeout=20)
        except queue.Empty:
            self._dau(204, n)
            self.end_headers()
            return
        TRANG["luc"] = time.time()
        self._json(200, v, n)

    def do_POST(self):
        n = self._nguon()
        if n is False:
            return self._json(403, {"loi": "nguồn không được phép"}, None)
        dai = int(self.headers.get("Content-Length") or 0)
        try:
            o = json.loads(self.rfile.read(dai).decode("utf-8") or "{}")
        except ValueError:
            return self._json(400, {"loi": "JSON hỏng"}, n)
        if self.path == "/xong":
            c = CHO_KQ.get(o.get("id"))
            if c:
                c["kq"] = o
                c["su_kien"].set()
            TRANG["luc"] = time.time()
            return self._json(200, {"ok": True}, n)
        if self.path == "/giao" and n is None:  # phiên Claude Code khác trên máy này gửi việc qua phiên giữ cổng
            try:
                return self._json(200, giao_tai_cho(o.get("viec") or {}, float(o.get("cho") or CHO)), None)
            except LoiCau as e:
                return self._json(200, {"loi": str(e)}, None)
        return self._json(404, {"loi": "không có"}, n)


class LoiCau(Exception):
    pass


def _trang_tt():
    tuoi = time.time() - TRANG["luc"]
    return {"noi": tuoi < 30, "giay_truoc": round(tuoi, 1) if TRANG["luc"] else None, "thong_tin": TRANG["tt"]}


def giao_tai_cho(viec: dict, cho: float) -> dict:
    """Đưa việc vào hàng đợi của trang, chờ kết quả."""
    if time.time() - TRANG["luc"] > 30:
        raise LoiCau(HUONG_DAN_NOI.format(cong=CONG))
    viec = dict(viec, id=uuid.uuid4().hex)
    c = {"su_kien": threading.Event(), "kq": None}
    CHO_KQ[viec["id"]] = c
    VIEC.put(viec)
    try:
        if not c["su_kien"].wait(cho):
            raise LoiCau("Trang không trả lời sau %ds — có thể app đang treo (vòng tính lâu / nhiều tòa sát nhau). "
                         "Tải lại trang (giữ ?congCu=1&mcp=%d) rồi gọi lại; việc đã gửi có thể đã chạy một phần." % (cho, CONG))
        return c["kq"] or {}
    finally:
        CHO_KQ.pop(viec["id"], None)


MAY_CHU = {"che_do": None}   # "chu" = giữ cổng; "khach" = gửi qua phiên khác


def khoi_dong_may_chu():
    try:
        s = ThreadingHTTPServer(("127.0.0.1", CONG), XuLy)
    except OSError:
        MAY_CHU["che_do"] = "khach"
        _log("cổng %d đã có cầu khác giữ — gửi việc qua đó" % CONG)
        return
    MAY_CHU["che_do"] = "chu"
    threading.Thread(target=s.serve_forever, daemon=True).start()
    _log("nghe http://127.0.0.1:%d" % CONG)


def giao(viec: dict, cho: float = CHO) -> dict:
    if MAY_CHU["che_do"] == "chu":
        return giao_tai_cho(viec, cho)
    b = json.dumps({"viec": viec, "cho": cho}).encode("utf-8")
    try:
        with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:%d/giao" % CONG, b, {"Content-Type": "application/json"}),
                                    timeout=cho + 10) as r:
            o = json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, OSError):
        khoi_dong_may_chu()  # phiên giữ cổng đã tắt → thử giữ cổng
        if MAY_CHU["che_do"] == "chu":
            return giao_tai_cho(viec, cho)
        raise LoiCau("Không nối được cầu ở cổng %d." % CONG)
    if "loi" in o and len(o) == 1:
        raise LoiCau(o["loi"])
    return o


def suc_khoe() -> dict:
    if MAY_CHU["che_do"] == "chu":
        return _trang_tt()
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/suc-khoe" % CONG, timeout=5) as r:
            return json.loads(r.read().decode("utf-8")).get("trang", {})
    except (urllib.error.URLError, OSError):
        return {"noi": False}


# ------------------------------------------------------------------ công cụ MCP
def _cat(s: str, toi_da: int) -> str:
    if toi_da and len(s) > toi_da:
        return s[:toi_da] + "… [cắt bớt %d / %d ký tự — tăng max_chars, lọc hẹp hơn (lot_ids…) hoặc dùng unitmix_run_js để chỉ lấy phần cần]" % (len(s) - toi_da, len(s))
    return s


def _ket(o: dict) -> dict:
    if o.get("loi"):
        raise LoiCau("Trang báo lỗi: " + str(o["loi"]))
    return o.get("ket_qua")


CONG_CU = [
    {"name": "unitmix_status",
     "description": "Kiểm cầu: có trang Unitmix nào đang nối không, dự án / PA / chế độ (sua_duoc / chi_xem). Không tốn lượt app.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "unitmix_list_tools",
     "description": "Danh sách công cụ của app (tên + mô tả một dòng). Truyền `ten` để lấy mô tả + schema đầy đủ của một công cụ.",
     "inputSchema": {"type": "object", "properties": {"ten": {"type": "string"}}}},
    {"name": "unitmix_call",
     "description": "Gọi một công cụ app (get_state, get_kpi, update_tower, change_units, check_rules…) trên PA đang mở. "
                    "Phép sửa ghi thật vào PA (một bước hoàn tác, tự lưu). dong_y=true để qua hộp xác nhận (xoá PA…). "
                    "get_state mặc định chỉ lô cao tầng; dùng lot_ids để đọc hẹp.",
     "inputSchema": {"type": "object", "properties": {
         "ten": {"type": "string"}, "dau_vao": {"type": "object"}, "dong_y": {"type": "boolean"},
         "max_chars": {"type": "integer", "description": "cắt kết quả (mặc định 6000; 0 = không cắt)"}}, "required": ["ten"]}},
    {"name": "unitmix_call_many",
     "description": "Gọi nhiều công cụ tuần tự trong MỘT lượt (đỡ khứ hồi): lenh = [{ten, dau_vao}]. Trả mỗi lệnh ok + kết quả cắt "
                    "max_chars_each (mặc định 400). Dừng ở lệnh lỗi đầu tiên trừ khi stop_on_error=false.",
     "inputSchema": {"type": "object", "properties": {
         "lenh": {"type": "array", "items": {"type": "object", "properties": {"ten": {"type": "string"}, "dau_vao": {"type": "object"}}, "required": ["ten"]}},
         "dong_y": {"type": "boolean"}, "stop_on_error": {"type": "boolean"}, "max_chars_each": {"type": "integer"}}, "required": ["lenh"]}},
    {"name": "unitmix_run_js",
     "description": "Chạy một hàm async JS trong trang: `async (T) => { … }` với T.chay(ten, dau_vao, {dongY, toiDa:0}) → {ok, noiDung, json} "
                    "và T.danhSach(). Dùng để lặp / lọc / tổng hợp nhiều kết quả NGAY TRONG TRANG rồi chỉ trả số cần (đỡ token nhất). "
                    "Có thể fetch('/api/du-an/<mã>/pa/<id>') để đọc PA đầy đủ từ máy chủ. Trả giá trị JSON được.",
     "inputSchema": {"type": "object", "properties": {
         "ma": {"type": "string", "description": "mã hàm, ví dụ: async (T) => (await T.chay('get_kpi',{scope:'project'})).json"},
         "max_chars": {"type": "integer"}, "timeout_s": {"type": "integer"}}, "required": ["ma"]}},
]


def goi_cong_cu(ten: str, a: dict) -> str:
    if ten == "unitmix_status":
        tt = suc_khoe()
        if not tt.get("noi"):
            return HUONG_DAN_NOI.format(cong=CONG)
        return json.dumps(tt, ensure_ascii=False)
    if ten == "unitmix_list_tools":
        ds = _ket(giao({"loai": "danh_sach"}))
        if a.get("ten"):
            c = next((x for x in ds if x.get("ten") == a["ten"]), None)
            return json.dumps(c, ensure_ascii=False) if c else "Không có công cụ %s." % a["ten"]
        return "\n".join("%s — %s" % (x["ten"], (x.get("moTa") or "")[:110]) for x in ds)
    if ten == "unitmix_call":
        kq = _ket(giao({"loai": "goi", "ten": a["ten"], "dau_vao": a.get("dau_vao") or {}, "dong_y": bool(a.get("dong_y"))}))
        s = kq.get("noi_dung", "")
        return ("" if kq.get("ok") else "LỖI: ") + _cat(s, int(a.get("max_chars", 6000)))
    if ten == "unitmix_call_many":
        kq = _ket(giao({"loai": "nhieu", "lenh": a["lenh"], "dong_y": bool(a.get("dong_y")),
                        "dung_khi_loi": a.get("stop_on_error", True) is not False}, CHO * 3))
        n = int(a.get("max_chars_each", 400))
        dong = ["%d. %s %s %s" % (i + 1, x["ten"], "OK" if x["ok"] else "LỖI", _cat(x.get("noi_dung", ""), n)) for i, x in enumerate(kq)]
        if len(kq) < len(a["lenh"]):
            dong.append("(dừng sau lệnh lỗi; %d lệnh chưa chạy)" % (len(a["lenh"]) - len(kq)))
        return "\n".join(dong)
    if ten == "unitmix_run_js":
        kq = _ket(giao({"loai": "js", "ma": a["ma"]}, float(a.get("timeout_s") or CHO)))
        s = kq if isinstance(kq, str) else json.dumps(kq, ensure_ascii=False, separators=(",", ":"))
        return _cat(s, int(a.get("max_chars", 6000)))
    raise LoiCau("Không có công cụ %s" % ten)


# ------------------------------------------------------------------ JSON-RPC stdio
_KHOA_GUI = threading.Lock()


def _gui(o: dict) -> None:
    with _KHOA_GUI:  # tools/call trả từ luồng riêng
        sys.stdout.write(json.dumps(o, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def xu_ly(m: dict):
    pp, ma = m.get("method"), m.get("id")
    if pp == "initialize":
        return {"protocolVersion": (m.get("params") or {}).get("protocolVersion", GIAO_THUC),
                "capabilities": {"tools": {}}, "serverInfo": {"name": TEN, "version": PHIEN_BAN},
                "instructions": "Gọi công cụ app Unitmix trên trang đang mở (?congCu=1&mcp=%d). Bắt đầu bằng unitmix_status. "
                                "Ưu tiên unitmix_run_js / unitmix_call_many cho việc lặp nhiều tòa / nhiều lô để đỡ token." % CONG}
    if pp == "tools/list":
        return {"tools": CONG_CU}
    if pp == "tools/call":
        p = m.get("params") or {}
        try:
            return {"content": [{"type": "text", "text": goi_cong_cu(p.get("name"), p.get("arguments") or {})}]}
        except LoiCau as e:
            return {"content": [{"type": "text", "text": str(e)}], "isError": True}
        except Exception as e:  # noqa: BLE001 — trả lỗi cho Claude, không sập cầu
            return {"content": [{"type": "text", "text": "Lỗi cầu: %s" % e}], "isError": True}
    if pp == "ping":
        return {}
    if ma is None:
        return None  # thông báo (notifications/*)
    raise KeyError(pp)


def main():
    # Windows: ống stdio mặc định cp1252 → chữ Việt làm sập cầu
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    khoi_dong_may_chu()
    for dong in sys.stdin:
        dong = dong.strip()
        if not dong:
            continue
        try:
            m = json.loads(dong)
        except ValueError:
            continue
        ma = m.get("id")

        def chay(m=m, ma=ma):
            try:
                kq = xu_ly(m)
                if ma is not None:
                    _gui({"jsonrpc": "2.0", "id": ma, "result": kq})
            except KeyError as e:
                if ma is not None:
                    _gui({"jsonrpc": "2.0", "id": ma, "error": {"code": -32601, "message": "Không có phương thức %s" % e}})

        # tools/call có thể chờ trang lâu → luồng riêng để ping / list không bị chặn
        (threading.Thread(target=chay, daemon=True).start() if m.get("method") == "tools/call" else chay())


if __name__ == "__main__":
    main()
