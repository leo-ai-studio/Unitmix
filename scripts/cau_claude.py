# -*- coding: utf-8 -*-
"""CẦU CLAUDE cho Leo AI — dùng tài khoản Claude (gói Pro/Max) đã đăng nhập trên máy, KHÔNG cần khoá API.

Cầu là một máy phục vụ nhỏ chỉ nghe 127.0.0.1, nói đúng giao thức Anthropic Messages (`POST /v1/messages`, có luồng SSE).
Trình duyệt dùng nguyên SDK `@anthropic-ai/sdk` với baseURL = địa chỉ cầu → vòng tác tử, 45 công cụ, Dừng, hoàn tác của Leo AI
giữ nguyên. Cầu đổi mỗi yêu cầu thành MỘT lần gọi `claude -p` (Claude Code CLI, bản chính thức, chạy bằng chính tài khoản đang
đăng nhập trên máy): không giữ khoá hay mật khẩu nào.

Công cụ của app không phải công cụ gốc của Claude Code (`--tools ""` tắt hết). Cầu đưa danh mục công cụ vào lời hệ thống và ép
đầu ra theo `--json-schema`: {"chu": "<lời nói>", "goi": [{"ten", "dau_vao"}]}. `goi` rỗng → end_turn; có → khối `tool_use`
(stop_reason = tool_use) để app chạy rồi gửi `tool_result` ở lượt sau. Mỗi lượt là một tiến trình `claude -p` độc lập
(`--no-session-persistence`): lịch sử được dựng lại thành bản ghi hội thoại trong prompt.

Chạy:   python scripts/cau_claude.py              (cổng mặc định 3032;  --port N để đổi)
Điểm cuối:
  GET  /suc-khoe    → {ok, cau, cong, phien_ban, dang_nhap, tai_khoan, xa}      (không tốn lượt AI)
  POST /v1/messages → giao thức Anthropic Messages (stream true / false); lỗi theo dạng lỗi Anthropic
  POST /dang-nhap   → mở terminal chạy `claude auth login` để NGƯỜI DÙNG tự đăng nhập (cầu không chạm mật khẩu)

An toàn: chỉ nghe 127.0.0.1; chỉ nhận yêu cầu từ trang mở bằng file:// (Origin "null"), localhost, hoặc nguồn khai ở
cau_claude.json / biến LEO_CAU_NGUON (bản app trên Cloudflare) — trang lạ ngoài Internet KHÔNG gọi được cầu. Claude chạy trong
thư mục tạm riêng (không nạp CLAUDE.md), không MCP, không Bash / Edit / Write / Web; chỉ có `Read` khi có ảnh / PDF đính kèm.
"""
import base64
import json
import os
import re
import select
import shlex
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PHIEN_BAN_CAU = 1
GOC = os.path.dirname(os.path.abspath(__file__))
GOC_DU_LIEU = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "LeoUnitmix")
GIOI_HAN_GIAY = int(os.environ.get("LEO_CAU_GIOI_HAN_GIAY") or 600)
GIOI_HAN_BODY = 25 * 1048576
TOI_DA_TAM_THOI = 3          # lỗi làm mới đăng nhập do tiến trình Claude khác: thử lại tối đa 3 lần
CHO_TAM_THOI_GIAY = float(os.environ.get("LEO_CAU_CHO_TAM_THOI") or 8)
TOI_DA_TEP_DINH_KEM = 6

# mã mô hình của Leo AI (web/src/troLy/moHinh.ts) → bí danh Claude Code (luôn trỏ bản mới nhất của dòng đó)
MO_HINH = {"claude-opus-5-5": "opus", "claude-sonnet-5-5": "sonnet", "claude-haiku-5-5": "haiku"}
MUC_NGHI = ("low", "medium", "high")
NGUON_OK = re.compile(r"^(null|https?://(localhost|127\.0\.0\.1)(:\d+)?)$")

# Đầu ra bắt buộc mỗi lượt (--json-schema)
LUOC_DO = {
    "type": "object",
    "properties": {
        "chu": {"type": "string"},
        "goi": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"ten": {"type": "string"}, "dau_vao": {"type": "object"}},
                "required": ["ten", "dau_vao"],
            },
        },
    },
    "required": ["chu", "goi"],
}

GIAO_THUC = """

# GIAO THỨC TRẢ LỜI (bắt buộc, ưu tiên hơn mọi chỉ dẫn định dạng ở trên)
Bạn đang chạy qua một cầu: KHÔNG có công cụ gốc nào của Claude Code. Công cụ của app là danh sách "CÔNG CỤ CỦA APP" ở cuối.
Mỗi lượt bạn trả MỘT đối tượng JSON {"chu": "...", "goi": [{"ten": "...", "dau_vao": {...}}]}:
- chu: lời nói với người dùng (Markdown). Có thể là chuỗi rỗng khi lượt này chỉ gọi công cụ.
- goi: các công cụ cần gọi trong lượt này; [] khi đã xong. Chỉ dùng đúng tên có trong danh sách, dau_vao đúng schema của công cụ.
  Có thể gọi nhiều công cụ độc lập trong cùng một lượt; app chạy lần lượt rồi gửi kết quả ở lượt sau.
- Hội thoại bên dưới ghi lại các lượt trước: "→ GỌI ten {...}" là công cụ bạn đã gọi, "← KẾT QUẢ ten: ..." là kết quả app trả về.
  Chỉ nói đã làm xong việc gì sau khi THẤY kết quả công cụ tương ứng. Khi đã xong: goi = [] và chu = tóm tắt cho người dùng.
- Không bịa tên công cụ, không bịa kết quả công cụ."""


def tim_lenh_claude():
    """Biến LEO_CLAUDE_BIN (cho phép nhiều từ, vd thử bằng 'python fake.py') → PATH → chỗ bộ cài chính thức / npm đặt."""
    e = os.environ.get("LEO_CLAUDE_BIN")
    if e:
        return shlex.split(e, posix=(os.name != "nt"))
    c = shutil.which("claude") or shutil.which("claude.cmd")
    if c:
        return [c]
    for p in (os.path.join(os.path.expanduser("~"), ".local", "bin", "claude.exe"),
              os.path.join(os.environ.get("APPDATA", ""), "npm", "claude.cmd")):
        if os.path.isfile(p):
            return [p]
    return None


def doc_cau_hinh():
    for d in (GOC, GOC_DU_LIEU):
        try:
            with open(os.path.join(d, "cau_claude.json"), encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            continue
    return {}


def nguon_cho_phep():
    """Nguồn khai thêm (bản app trên Cloudflare): cau_claude.json {"nguon": ["https://…"]} và/hoặc LEO_CAU_NGUON="a,b"."""
    ds = [x.rstrip("/") for x in (doc_cau_hinh().get("nguon") or []) if isinstance(x, str)]
    ds += [x.strip().rstrip("/") for x in (os.environ.get("LEO_CAU_NGUON") or "").split(",") if x.strip()]
    return set(ds)


# ------------------------------------------------------------------ dựng prompt
def _chu_khoi(c):
    """Nội dung tool_result: chuỗi hoặc danh sách khối text."""
    if isinstance(c, str):
        return c
    return "\n".join(b.get("text", "") for b in c or [] if isinstance(b, dict) and b.get("type") == "text")


def lap_he_thong(he_thong, tools):
    """Lời hệ thống của app + giao thức + danh mục công cụ (JSON gọn, một công cụ một dòng)."""
    if isinstance(he_thong, list):
        he_thong = "\n\n".join(b.get("text", "") for b in he_thong if isinstance(b, dict))
    ra = [str(he_thong or "").strip(), GIAO_THUC.strip(), "\n# CÔNG CỤ CỦA APP"]
    for t in tools or []:
        ra.append(json.dumps({"ten": t.get("name"), "mo_ta": t.get("description", ""), "schema": t.get("input_schema", {})},
                             ensure_ascii=False, separators=(",", ":")))
    return "\n".join(ra)


def dung_ban_ghi(messages, thu_muc):
    """Lịch sử Anthropic → bản ghi văn bản. Trả (chữ, [đường dẫn tệp đính kèm đã ghi]). Khối thinking bị bỏ."""
    dong, tep, ten_cong_cu = [], [], {}
    for m in messages or []:
        vai = "NGƯỜI DÙNG" if m.get("role") == "user" else "TRỢ LÝ"
        nd = m.get("content")
        if isinstance(nd, str):
            dong.append("[%s]\n%s" % (vai, nd))
            continue
        phan = []
        for b in nd or []:
            kieu = b.get("type")
            if kieu == "text" and b.get("text"):
                phan.append(b["text"])
            elif kieu == "tool_use":
                ten_cong_cu[b.get("id")] = b.get("name")
                phan.append("→ GỌI %s %s" % (b.get("name"), json.dumps(b.get("input", {}), ensure_ascii=False, separators=(",", ":"))))
            elif kieu == "tool_result":
                ten = ten_cong_cu.get(b.get("tool_use_id"), "?")
                phan.append("← %s %s: %s" % ("LỖI" if b.get("is_error") else "KẾT QUẢ", ten, _chu_khoi(b.get("content"))))
            elif kieu in ("image", "document"):
                nguon = b.get("source") or {}
                if nguon.get("type") != "base64" or len(tep) >= TOI_DA_TEP_DINH_KEM:
                    phan.append("[tệp đính kèm không đọc được]")
                    continue
                duoi = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
                        "application/pdf": ".pdf"}.get(nguon.get("media_type"), ".bin")
                p = os.path.join(thu_muc, "tep_%d%s" % (len(tep) + 1, duoi))
                with open(p, "wb") as f:
                    f.write(base64.b64decode(nguon.get("data") or ""))
                tep.append(p)
                phan.append("[tệp đính kèm — đọc bằng công cụ Read: %s]" % p)
        if phan:
            dong.append("[%s]\n%s" % (vai, "\n".join(phan)))
    dong.append("[LƯỢT CỦA BẠN]\nTrả đối tượng JSON theo giao thức.")
    return "\n\n".join(dong), tep


# ------------------------------------------------------------------ gọi claude -p
class LoiCau(Exception):
    def __init__(self, ma_http, kieu, chu):
        super().__init__(chu)
        self.ma_http, self.kieu, self.chu = ma_http, kieu, chu


def _la_tam_thoi(t):
    """Lỗi làm mới OAuth do tiến trình Claude Code KHÁC chạy cùng lúc — không phải hết phiên đăng nhập."""
    t = t.lower()
    return "another claude code process" in t or "usually transient" in t


def phan_loai_loi(chu):
    t = chu.lower()
    if any(k in t for k in ("authenticate", "oauth", "/login", "not logged", "log in", "login", "invalid api key")):
        return LoiCau(401, "authentication_error", "Claude Code chưa đăng nhập hoặc phiên hết hạn — chạy `claude auth login` "
                      "(hoặc bấm Đăng nhập trong Cài đặt Leo AI). " + chu[:300])
    if any(k in t for k in ("rate limit", "rate_limit", "quota", "usage limit", "overloaded")):
        return LoiCau(429, "rate_limit_error", chu[:400])
    return LoiCau(500, "api_error", chu[:600])


def chay_mot_lan(lenh_goc, he_thong, prompt, mo_hinh, nghi, thu_muc, co_tep, con_song):
    """Một lần `claude -p`. con_song() = False khi trình duyệt đã ngắt nối (bấm Dừng) → giết tiến trình."""
    tep_ht = os.path.join(thu_muc, "he_thong.md")
    with open(tep_ht, "w", encoding="utf-8") as f:
        f.write(he_thong)
    lenh = list(lenh_goc) + ["-p", "--output-format", "json", "--no-session-persistence", "--strict-mcp-config",
                             "--disable-slash-commands", "--system-prompt-file", tep_ht,
                             "--json-schema", json.dumps(LUOC_DO, separators=(",", ":")),
                             "--tools", "Read" if co_tep else ""]
    if co_tep:
        lenh += ["--allowedTools", "Read", "--add-dir", thu_muc]
    if mo_hinh in MO_HINH:
        lenh += ["--model", MO_HINH[mo_hinh]]
    if nghi in MUC_NGHI:
        lenh += ["--effort", nghi]
    p = subprocess.Popen(lenh, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=thu_muc)
    ket = {}

    def doc():
        ket["ra"], ket["loi"] = p.communicate(prompt.encode("utf-8"))
    th = threading.Thread(target=doc, daemon=True)
    th.start()
    han = time.time() + GIOI_HAN_GIAY
    while th.is_alive():
        th.join(0.5)
        if not con_song():
            p.kill()
            raise LoiCau(499, "da_huy", "Người dùng đã dừng.")
        if time.time() > han:
            p.kill()
            raise LoiCau(504, "timeout_error", "Claude Code chạy quá %d giây." % GIOI_HAN_GIAY)
    ra = (ket.get("ra") or b"").decode("utf-8", "replace").strip()
    loi = (ket.get("loi") or b"").decode("utf-8", "replace").strip()
    try:
        o = json.loads(ra.splitlines()[-1] if ra else "{}")
    except ValueError:
        raise phan_loai_loi(ra or loi or "Claude Code không trả JSON")
    if o.get("is_error"):
        kq = str(o.get("result") or loi or "")
        if _la_tam_thoi(kq):
            raise LoiCau(503, "tam_thoi", kq)
        raise phan_loai_loi(kq)
    return o


def hoi_claude(lenh_goc, body, thu_muc, con_song):
    he_thong = lap_he_thong(body.get("system"), body.get("tools"))
    prompt, tep = dung_ban_ghi(body.get("messages"), thu_muc)
    nghi = (body.get("output_config") or {}).get("effort")
    for lan in range(TOI_DA_TAM_THOI + 1):
        try:
            return chay_mot_lan(lenh_goc, he_thong, prompt, body.get("model"), nghi, thu_muc, bool(tep), con_song)
        except LoiCau as e:
            if e.kieu == "tam_thoi" and lan < TOI_DA_TAM_THOI:
                time.sleep(CHO_TAM_THOI_GIAY)
                continue
            if e.kieu == "tam_thoi":
                e = LoiCau(529, "overloaded_error", "Claude Code đang làm mới đăng nhập — bấm gửi lại sau ít giây.")
            raise e


# ------------------------------------------------------------------ kết quả CLI → tin nhắn Anthropic
def ra_tin_nhan(o, body):
    """Kết quả `claude -p` → (content[], stop_reason, usage) theo Messages API."""
    dau_ra = o.get("structured_output")
    if not isinstance(dau_ra, dict):
        try:
            dau_ra = json.loads(str(o.get("result") or ""))
        except ValueError:
            dau_ra = {"chu": str(o.get("result") or ""), "goi": []}
    if not isinstance(dau_ra, dict):
        dau_ra = {"chu": str(dau_ra), "goi": []}
    ten_ok = {t.get("name") for t in body.get("tools") or []}
    noi_dung, bo = [], []
    chu = str(dau_ra.get("chu") or "")
    for g in dau_ra.get("goi") or []:
        if not isinstance(g, dict) or g.get("ten") not in ten_ok or not isinstance(g.get("dau_vao", {}), dict):
            bo.append(str(g.get("ten") if isinstance(g, dict) else g))
            continue
        noi_dung.append({"type": "tool_use", "id": "toolu_" + uuid.uuid4().hex[:24], "name": g["ten"], "input": g.get("dau_vao", {})})
    if bo:
        chu += ("\n\n" if chu else "") + "_(Cầu bỏ qua công cụ không có trong danh sách: %s)_" % ", ".join(bo)
    if chu.strip() or not noi_dung:
        noi_dung.insert(0, {"type": "text", "text": chu})
    u = o.get("usage") or {}
    usage = {k: int(u.get(k) or 0) for k in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")}
    return noi_dung, "tool_use" if any(b["type"] == "tool_use" for b in noi_dung) else "end_turn", usage


def tin_nhan_day_du(body, noi_dung, dung, usage):
    return {"id": "msg_" + uuid.uuid4().hex[:24], "type": "message", "role": "assistant", "model": body.get("model"),
            "content": noi_dung, "stop_reason": dung, "stop_sequence": None, "usage": usage}


def su_kien_sse(msg):
    """Tin nhắn đầy đủ → chuỗi sự kiện SSE đúng thứ tự của Messages API (chữ chia mảnh ~48 ký tự cho SDK ghép lại)."""
    u0 = dict(msg["usage"], output_tokens=0)
    yield "message_start", {"type": "message_start", "message": dict(msg, content=[], stop_reason=None, usage=u0)}
    for i, b in enumerate(msg["content"]):
        if b["type"] == "text":
            yield "content_block_start", {"type": "content_block_start", "index": i, "content_block": {"type": "text", "text": ""}}
            t = b["text"]
            for j in range(0, len(t), 48):
                yield "content_block_delta", {"type": "content_block_delta", "index": i, "delta": {"type": "text_delta", "text": t[j:j + 48]}}
        else:
            yield "content_block_start", {"type": "content_block_start", "index": i,
                                          "content_block": {"type": "tool_use", "id": b["id"], "name": b["name"], "input": {}}}
            yield "content_block_delta", {"type": "content_block_delta", "index": i,
                                          "delta": {"type": "input_json_delta", "partial_json": json.dumps(b["input"], ensure_ascii=False)}}
        yield "content_block_stop", {"type": "content_block_stop", "index": i}
    yield "message_delta", {"type": "message_delta", "delta": {"stop_reason": msg["stop_reason"], "stop_sequence": None},
                            "usage": {"output_tokens": msg["usage"]["output_tokens"]}}
    yield "message_stop", {"type": "message_stop"}


# ------------------------------------------------------------------ máy phục vụ
class XuLy(BaseHTTPRequestHandler):
    server_version = "LeoCauClaude/%d" % PHIEN_BAN_CAU
    lenh_claude = None     # đặt trong main() / test
    _tt_dn = {"luc": 0, "kq": {}}

    def log_message(self, fmt, *a):
        sys.stderr.write("[cau] " + (fmt % a) + "\n")

    def _nguon(self):
        n = self.headers.get("Origin")
        if n is None or NGUON_OK.match(n) or n.rstrip("/") in nguon_cho_phep():
            return n
        sys.stderr.write("[cau] TỪ CHỐI nguồn %s — không phải file:// / localhost / nguồn khai ở cau_claude.json (LEO_CAU_NGUON)\n" % n)
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

    def _json(self, ma, o, nguon, them=None):
        b = json.dumps(o, ensure_ascii=False).encode("utf-8")
        self._dau(ma, nguon, "application/json; charset=utf-8", len(b))
        for k, v in (them or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(b)

    def _loi(self, e, nguon):
        # x-should-retry: false → SDK không tự gọi lại (mỗi lần gọi lại là thêm một lượt claude -p vô ích)
        self._json(e.ma_http if e.ma_http != 499 else 400,
                   {"type": "error", "error": {"type": e.kieu, "message": e.chu}}, nguon, {"x-should-retry": "false"})

    def con_song(self):
        """Trình duyệt còn nối? (bấm Dừng → SDK đóng kết nối → socket đọc được EOF)"""
        try:
            r, _, _ = select.select([self.connection], [], [], 0)
            return not (r and self.connection.recv(1, socket.MSG_PEEK) == b"")
        except (OSError, ValueError):
            return False

    def do_OPTIONS(self):
        nguon = self._nguon()
        if nguon is False:
            self.send_response(403)
            self.end_headers()
            return
        self._dau(204, nguon)
        self.end_headers()

    def do_GET(self):
        nguon = self._nguon()
        if nguon is False:
            return self._json(403, {"loi": "nguồn không được phép"}, None)
        if self.path.split("?")[0] != "/suc-khoe":
            return self._json(404, {"loi": "không có"}, nguon)
        self._json(200, self.suc_khoe(), nguon)

    def suc_khoe(self):
        lenh, tt = self.lenh_claude, XuLy._tt_dn
        ra = {"ok": bool(lenh), "cau": PHIEN_BAN_CAU, "cong": self.server.server_address[1], "phien_ban": None,
              "dang_nhap": None, "tai_khoan": {}, "xa": self.headers.get("X-Leo-Qua-Tram") == "1"}
        if not lenh:
            return ra
        if time.time() - tt["luc"] > 20:   # `claude auth status` không tốn lượt AI nhưng tốn ~0,5 s → nhớ 20 s
            try:
                pb = subprocess.run(lenh + ["--version"], capture_output=True, timeout=30).stdout.decode().strip()
                a = json.loads(subprocess.run(lenh + ["auth", "status", "--json"], capture_output=True, timeout=30,
                                              cwd=tempfile.gettempdir()).stdout.decode("utf-8", "replace") or "{}")
                tt["kq"] = {"phien_ban": pb, "dang_nhap": bool(a.get("loggedIn")),
                            "tai_khoan": {k: a.get(k) for k in ("authMethod", "email", "emailAddress", "organizationName", "subscriptionType") if a.get(k)}}
                tt["luc"] = time.time()
            except Exception:
                tt["kq"] = {}
        ra.update(tt["kq"])
        return ra

    def do_POST(self):
        nguon = self._nguon()
        if nguon is False:
            return self._json(403, {"loi": "nguồn không được phép"}, None)
        duong = self.path.split("?")[0]
        if duong == "/dang-nhap":
            if not self.lenh_claude:
                return self._json(200, {"loi": "chưa cài Claude Code", "ma": "khong_co_cli"}, nguon)
            if os.name == "nt":
                subprocess.Popen(["cmd", "/c", "start", "Claude Code - dang nhap", "cmd", "/k"] + self.lenh_claude + ["auth", "login"])
            else:
                subprocess.Popen(["x-terminal-emulator", "-e"] + self.lenh_claude + ["auth", "login"])
            XuLy._tt_dn["luc"] = 0
            return self._json(200, {"ok": True}, nguon)
        if duong != "/v1/messages":
            return self._json(404, {"loi": "không có"}, nguon)
        n = int(self.headers.get("Content-Length") or 0)
        if n > GIOI_HAN_BODY:
            return self._loi(LoiCau(413, "request_too_large", "Yêu cầu quá lớn (tệp đính kèm quá nặng)."), nguon)
        try:
            body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except ValueError:
            return self._loi(LoiCau(400, "invalid_request_error", "Thân yêu cầu không phải JSON."), nguon)
        if body.get("model") not in MO_HINH or not isinstance(body.get("messages"), list):
            return self._loi(LoiCau(400, "invalid_request_error", "Thiếu messages hoặc mô hình không được hỗ trợ: %s" % body.get("model")), nguon)
        if not self.lenh_claude:
            return self._loi(LoiCau(503, "chua_cai_claude", "Máy chưa cài Claude Code — chạy bộ cài cầu AI."), nguon)
        thu_muc = tempfile.mkdtemp(prefix="leo_cau_")
        try:
            o = hoi_claude(self.lenh_claude, body, thu_muc, self.con_song)
            msg = tin_nhan_day_du(body, *ra_tin_nhan(o, body))
        except LoiCau as e:
            if e.kieu == "da_huy":
                return
            return self._loi(e, nguon)
        finally:
            shutil.rmtree(thu_muc, ignore_errors=True)
        if not body.get("stream"):
            return self._json(200, msg, nguon, {"request-id": "req_" + uuid.uuid4().hex[:16]})
        self._dau(200, nguon, "text/event-stream; charset=utf-8")
        self.send_header("request-id", "req_" + uuid.uuid4().hex[:16])
        self.end_headers()
        try:
            for ten, du in su_kien_sse(msg):
                self.wfile.write(("event: %s\ndata: %s\n\n" % (ten, json.dumps(du, ensure_ascii=False))).encode("utf-8"))
            self.wfile.flush()
        except OSError:
            pass


def tao_may_chu(cong, lenh_claude):
    XuLy.lenh_claude = lenh_claude
    XuLy._tt_dn = {"luc": 0, "kq": {}}
    return ThreadingHTTPServer(("127.0.0.1", cong), XuLy)


def main():
    cong = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else int(os.environ.get("LEO_CAU_CONG") or 3032)
    lenh = tim_lenh_claude()
    try:
        sv = tao_may_chu(cong, lenh)
    except OSError as e:   # cầu khác đang chạy → thoát êm, không để hai cầu
        print("Cổng %d đang bận (%s) — đã có cầu chạy, thoát" % (cong, e))
        return
    print("Cầu Claude cho Leo AI · http://127.0.0.1:%d · claude = %s" % (cong, " ".join(lenh) if lenh else "KHÔNG TÌM THẤY"))
    print("Nguồn được phép: file:// · localhost" + "".join(" · " + n for n in sorted(nguon_cho_phep())))
    if lenh:
        try:
            tk = json.loads(subprocess.run(lenh + ["auth", "status", "--json"], capture_output=True, timeout=30,
                                           cwd=tempfile.gettempdir()).stdout.decode("utf-8", "replace") or "{}")
            print("Claude Code: " + ("đã đăng nhập" if tk.get("loggedIn") else "CHƯA ĐĂNG NHẬP — chạy `claude auth login`"))
        except Exception as e:
            print("Claude Code: không đọc được trạng thái đăng nhập (%s)" % e)
    try:
        sv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
