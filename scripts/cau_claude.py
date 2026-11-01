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
  GET  /ghep        → (chỉ máy này) {khoa, tram, noi}: mã ghép điện thoại + trạng thái nối trạm
  POST /doi-ma      → (chỉ máy này) đổi mã ghép (điện thoại cũ hết dùng), nối lại trạm

Điện thoại: điện thoại không gọi được 127.0.0.1 của máy tính → khi cau_claude.json (hoặc LEO_CAU_TRAM) khai địa chỉ app, cầu TỰ
NỐI RA trạm chuyển trên Worker của app (worker/src/tram.ts, WebSocket wss://<app>/api/tram/cau), giữ nối suốt lúc chạy, đứt thì
tự nối lại. Điện thoại gọi trạm bằng https cùng nguồn với trang, trạm chuyển yêu cầu xuống đây, cầu gọi chính nó ở 127.0.0.1 rồi gửi
kết quả lên. Không mở cổng nào, không cần terminal. Mã ghép 32 byte sinh một lần, giữ ở LeoUnitmix/ghep.json; trạm chỉ thấy
SHA-256 của mã. Từ trạm chỉ nhận /suc-khoe và /v1/messages; trạm giới hạn 30 câu/phút.

An toàn: chỉ nghe 127.0.0.1; chỉ nhận yêu cầu từ trang mở bằng file:// (Origin "null"), localhost, hoặc nguồn khai ở
cau_claude.json / biến LEO_CAU_NGUON (bản app trên Cloudflare) — trang lạ ngoài Internet KHÔNG gọi được cầu. Claude chạy trong
thư mục tạm riêng (không nạp CLAUDE.md), không MCP, không Bash / Edit / Write / Web; chỉ có `Read` khi có ảnh / PDF đính kèm.
"""
import base64
import http.client
import json
import os
import queue
import re
import secrets
import select
import shlex
import shutil
import socket
import ssl
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PHIEN_BAN_CAU = 2   # 1 = chỉ máy tính (127.0.0.1) · 2 = thêm trạm chuyển cho điện thoại
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
- Không bịa tên công cụ, không bịa kết quả công cụ.
- HÀNH ĐỘNG, đừng hỏi lại điều tự xem được: khi người dùng nhờ làm việc trên app ("xếp tòa", "đổi căn", "xem KPI"...), lượt đầu hãy GỌI công cụ
  (get_state / get_floor_plan / công cụ sửa phù hợp) thay vì trả lời bằng chữ. "Lô đang chọn" = man_hinh.lo trong <ngu_canh>; nếu rỗng thì gọi get_state.
  Chỉ hỏi lại khi thật sự thiếu thông tin mà công cụ không đọc được.
- "chu" là Markdown thật: xuống dòng bằng ký tự xuống dòng thật, KHÔNG viết hai ký tự gạch chéo + n; bảng Markdown mỗi hàng một dòng."""


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
    ng = doc_cau_hinh().get("nguon") or []
    ds = [x.rstrip("/") for x in ([ng] if isinstance(ng, str) else ng) if isinstance(x, str)]
    ds += [x.strip().rstrip("/") for x in (os.environ.get("LEO_CAU_NGUON") or "").split(",") if x.strip()]
    t = diachi_tram()
    return set(ds + ([t] if t else []))


def diachi_tram():
    """Địa chỉ app có trạm chuyển (https://<app>): LEO_CAU_TRAM hoặc cau_claude.json {"tram": …}; rỗng = không nối trạm."""
    t = os.environ.get("LEO_CAU_TRAM") or doc_cau_hinh().get("tram") or ""
    return t.strip().rstrip("/") if isinstance(t, str) else ""


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
# Windows: mỗi lần gọi claude.exe (console) sẽ bật một cửa sổ terminal nếu không đặt cờ này.
KHONG_CUA_SO = 0x08000000 if os.name == "nt" else 0


def _ghi_loi(s):
    """pythonw (chạy ngầm) không có stderr → ghi log không được làm đứt yêu cầu."""
    try:
        if sys.stderr is not None:
            sys.stderr.write(s)
    except Exception:
        pass


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


def _dung_lenh(lenh_goc, he_thong, mo_hinh, nghi, thu_muc, co_tep, luong):
    tep_ht = os.path.join(thu_muc, "he_thong.md")
    with open(tep_ht, "w", encoding="utf-8") as f:
        f.write(he_thong)
    kieu = ["--output-format", "stream-json", "--include-partial-messages", "--verbose"] if luong else ["--output-format", "json"]
    lenh = list(lenh_goc) + ["-p"] + kieu + ["--no-session-persistence", "--strict-mcp-config",
                             "--disable-slash-commands", "--system-prompt-file", tep_ht,
                             "--json-schema", json.dumps(LUOC_DO, separators=(",", ":")),
                             "--tools", "Read" if co_tep else ""]
    if co_tep:
        lenh += ["--allowedTools", "Read", "--add-dir", thu_muc]
    if mo_hinh in MO_HINH:
        lenh += ["--model", MO_HINH[mo_hinh]]
    if nghi in MUC_NGHI:
        lenh += ["--effort", nghi]
    return lenh


def _kiem_ket_qua(o, loi):
    if o.get("is_error"):
        kq = str(o.get("result") or loi or "")
        if _la_tam_thoi(kq):
            raise LoiCau(503, "tam_thoi", kq)
        raise phan_loai_loi(kq)
    return o


def chay_mot_lan(lenh_goc, he_thong, prompt, mo_hinh, nghi, thu_muc, co_tep, con_song):
    """Một lần `claude -p`. con_song() = False khi trình duyệt đã ngắt nối (bấm Dừng) → giết tiến trình."""
    lenh = _dung_lenh(lenh_goc, he_thong, mo_hinh, nghi, thu_muc, co_tep, False)
    p = subprocess.Popen(lenh, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=thu_muc, creationflags=KHONG_CUA_SO)
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
    return _kiem_ket_qua(o, loi)


class TrichChu:
    """Rút DẦN giá trị chuỗi của khoá "chu" từ JSON đang đến theo từng mảnh (input_json_delta của đầu ra có cấu trúc) —
    xử lý thoát chuỗi (\\n, \\", \\uXXXX, cặp thay thế) bị cắt ngang giữa hai mảnh. `nap(mảnh)` trả phần chữ MỚI."""
    DAU = re.compile(r'"chu"\s*:\s*"')
    THOAT = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "/": "/", "\\": "\\", '"': '"'}

    def __init__(self):
        self.buf, self.pos, self.xong = "", -1, False

    def nap(self, manh):
        if self.xong:
            return ""
        self.buf += manh
        b = self.buf
        if self.pos < 0:
            m = self.DAU.search(b)
            if not m:
                return ""
            self.pos = m.end()
        i, ra = self.pos, []
        while i < len(b):
            c = b[i]
            if c == '"':
                self.xong = True
                i += 1
                break
            if c != "\\":
                ra.append(c)
                i += 1
                continue
            if i + 1 >= len(b):
                break
            d = b[i + 1]
            if d != "u":
                ra.append(self.THOAT.get(d, d))
                i += 2
                continue
            if i + 6 > len(b):
                break
            try:
                cp = int(b[i + 2:i + 6], 16)
            except ValueError:
                cp = 0xFFFD
            if 0xD800 <= cp < 0xDC00:           # nửa đầu cặp thay thế: chờ đủ nửa sau
                if i + 12 > len(b):
                    break
                if b[i + 6:i + 8] == "\\u":
                    try:
                        thap = int(b[i + 8:i + 12], 16)
                    except ValueError:
                        thap = 0
                    if 0xDC00 <= thap < 0xE000:
                        cp = 0x10000 + ((cp - 0xD800) << 10) + (thap - 0xDC00)
                        i += 6
            ra.append(chr(cp))
            i += 6
        self.pos = i
        return "".join(ra)


def chay_luong(lenh_goc, he_thong, prompt, mo_hinh, nghi, thu_muc, co_tep, con_song, khi_chu):
    """Như chay_mot_lan nhưng đọc `stream-json`: chữ của "chu" gọi khi_chu(mảnh) NGAY khi Claude viết ra (chữ chạy dần)."""
    lenh = _dung_lenh(lenh_goc, he_thong, mo_hinh, nghi, thu_muc, co_tep, True)
    p = subprocess.Popen(lenh, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=thu_muc, creationflags=KHONG_CUA_SO)
    hang, loi_buf = queue.Queue(), []

    def ghi_vao():
        try:
            p.stdin.write(prompt.encode("utf-8"))
            p.stdin.close()
        except OSError:
            pass

    def doc_ra():
        try:
            for dong in p.stdout:
                hang.put(dong)
        finally:
            hang.put(None)

    def doc_loi():
        try:
            loi_buf.append(p.stderr.read())
        except OSError:
            pass
    for f in (ghi_vao, doc_ra, doc_loi):
        threading.Thread(target=f, daemon=True).start()
    trich, o, han = TrichChu(), None, time.time() + GIOI_HAN_GIAY
    while True:
        try:
            dong = hang.get(timeout=0.3)
        except queue.Empty:
            dong = b""
        if not con_song():
            p.kill()
            raise LoiCau(499, "da_huy", "Người dùng đã dừng.")
        if time.time() > han:
            p.kill()
            raise LoiCau(504, "timeout_error", "Claude Code chạy quá %d giây." % GIOI_HAN_GIAY)
        if dong is None:
            break
        if not dong.strip():
            continue
        try:
            e = json.loads(dong.decode("utf-8", "replace"))
        except ValueError:
            continue
        if e.get("type") == "stream_event":
            ev = e.get("event") or {}
            if ev.get("type") == "content_block_start":
                trich = TrichChu()     # mỗi khối mới (vd. công cụ Read) tách riêng
            d = ev.get("delta") or {}
            if ev.get("type") == "content_block_delta" and d.get("type") == "input_json_delta":
                moi = trich.nap(d.get("partial_json") or "")
                if moi:
                    khi_chu(moi)
        elif e.get("type") == "result":
            o = e
    try:
        p.wait(timeout=10)
    except subprocess.TimeoutExpired:
        p.kill()
    loi = (loi_buf[0] if loi_buf else b"").decode("utf-8", "replace").strip()
    if o is None:
        raise phan_loai_loi(loi or "Claude Code không trả kết quả")
    return _kiem_ket_qua(o, loi)


def hoi_claude(lenh_goc, body, thu_muc, con_song, khi_chu=None):
    he_thong = lap_he_thong(body.get("system"), body.get("tools"))
    prompt, tep = dung_ban_ghi(body.get("messages"), thu_muc)
    nghi = (body.get("output_config") or {}).get("effort")
    for lan in range(TOI_DA_TAM_THOI + 1):
        try:
            if khi_chu is not None:
                return chay_luong(lenh_goc, he_thong, prompt, body.get("model"), nghi, thu_muc, bool(tep), con_song, khi_chu)
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
    if "\n" not in chu and "\\n" in chu:   # mô hình đôi khi ghi chữ \n thay vì xuống dòng thật
        chu = chu.replace("\\n", "\n")
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


# ------------------------------------------------------------------ trạm chuyển cho điện thoại
TEP_GHEP = os.path.join(GOC_DU_LIEU, "ghep.json")
NOI = {"trang_thai": "chua", "loi": "", "luc": 0}   # chua · dang_noi · da_noi · loi
_KHOA_GUI = threading.Lock()
_NOI_LAI = threading.Event()
HIEN_WS = [None]    # nối đang mở — /doi-ma đóng ngay để nối lại bằng mã mới
DUONG_TRAM_OK = {("GET", "/suc-khoe"), ("POST", "/v1/messages")}
VIEC = {}           # mã lượt → kết nối đang chờ cầu trả lời (đóng kết nối = bấm Dừng → con_song() thấy EOF → giết claude -p)
CONG_HIEN_TAI = [0]


def doc_khoa(moi=False):
    """Mã ghép 32 byte: sinh một lần, giữ ở ghep.json (moi=True: đổi mã, điện thoại cũ hết dùng)."""
    if not moi:
        try:
            with open(TEP_GHEP, encoding="utf-8") as f:
                k = json.load(f).get("khoa")
            if isinstance(k, str) and re.fullmatch(r"[A-Za-z0-9_-]{32,100}", k):
                return k
        except (OSError, ValueError):
            pass
    k = secrets.token_urlsafe(32)
    os.makedirs(GOC_DU_LIEU, exist_ok=True)
    with open(TEP_GHEP, "w", encoding="utf-8") as f:
        json.dump({"khoa": k, "tao": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
    return k


class WS:
    """WebSocket khách tối giản (RFC 6455) bằng thư viện chuẩn — Python nhúng của bộ cài không có gói ngoài."""

    def __init__(self, url, dau):
        u = urllib.parse.urlsplit(url)
        an = u.scheme == "wss"
        s = socket.create_connection((u.hostname, u.port or (443 if an else 80)), timeout=20)
        if an:
            s = ssl.create_default_context().wrap_socket(s, server_hostname=u.hostname)
        k = base64.b64encode(os.urandom(16)).decode()
        yc = ("GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
              "Sec-WebSocket-Version: 13\r\nUser-Agent: LeoCauClaude/%d\r\n" % (u.path or "/", u.netloc, k, PHIEN_BAN_CAU))
        yc += "".join("%s: %s\r\n" % kv for kv in dau.items()) + "\r\n"
        s.sendall(yc.encode())
        ra = b""
        while b"\r\n\r\n" not in ra:
            c = s.recv(4096)
            if not c:
                raise OSError("trạm đóng nối khi bắt tay")
            ra += c
        dong, _, du = ra.partition(b"\r\n\r\n")
        dong0 = dong.split(b"\r\n")[0].decode("latin-1")
        if " 101 " not in dong0 + " ":
            raise OSError("trạm trả " + dong0)
        self.s, self.du = s, du
        s.settimeout(None)

    def _doc(self, n):
        while len(self.du) < n:
            c = self.s.recv(65536)
            if not c:
                raise OSError("trạm đóng nối")
            self.du += c
        r, self.du = self.du[:n], self.du[n:]
        return r

    def gui(self, chu, op=1):
        b = chu.encode("utf-8") if isinstance(chu, str) else chu
        n = len(b)
        dau = bytes([0x80 | op])
        if n < 126:
            dau += bytes([0x80 | n])
        elif n < 65536:
            dau += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            dau += bytes([0x80 | 127]) + struct.pack(">Q", n)
        mn = os.urandom(4)
        with _KHOA_GUI:
            self.s.sendall(dau + mn + bytes(x ^ mn[i % 4] for i, x in enumerate(b)))

    def nhan(self):
        """Chuỗi văn bản tiếp theo; tự đáp ping; None khi trạm đóng."""
        manh = b""
        while True:
            b0, b1 = self._doc(2)
            op, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._doc(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._doc(8))[0]
            mn = self._doc(4) if b1 & 0x80 else None
            d = self._doc(n)
            if mn:
                d = bytes(x ^ mn[i % 4] for i, x in enumerate(d))
            if op == 8:
                return None
            if op == 9:
                self.gui(d, 10)
                continue
            if op == 10:
                continue
            manh = d if op in (1, 2) else manh + d
            if b0 & 0x80:
                return manh.decode("utf-8", "replace")

    def dong(self):
        for f in (lambda: self.gui(b"", 8), self.s.close):
            try:
                f()
            except OSError:
                pass


def huy_viec(ma):
    """Điện thoại bấm Dừng: đóng kết nối của lượt đó → máy phục vụ thấy ngắt nối và giết `claude -p`."""
    c = VIEC.pop(ma, None)
    if c is None:
        return False
    try:
        if c.sock:
            c.sock.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass
    try:
        c.close()
    except OSError:
        pass
    return True


def xu_ly_viec(ws, v, tram, cong):
    """Một yêu cầu từ điện thoại: gọi chính cầu này ở 127.0.0.1 (đủ kiểm tra như máy tính), gửi kết quả lên trạm."""
    ma_http, than, loai = 502, json.dumps({"type": "error", "error": {"type": "api_error", "message": "cầu lỗi khi chuyển"}}), "application/json"
    ma = v.get("ma")
    try:
        duong, la_hoi = v.get("duong"), v.get("duong") == "/v1/messages"
        if (("POST" if la_hoi else "GET"), duong) not in DUONG_TRAM_OK:
            raise ValueError("đường lạ")
        c = http.client.HTTPConnection("127.0.0.1", cong, timeout=GIOI_HAN_GIAY + 60)
        VIEC[ma] = c
        try:
            c.request("POST" if la_hoi else "GET", duong, body=(v.get("than") or "{}").encode("utf-8") if la_hoi else None,
                      headers={"Content-Type": "application/json", "Origin": tram, "X-Leo-Qua-Tram": "1"})
            r = c.getresponse()
            ma_http, than, loai = r.status, r.read().decode("utf-8", "replace"), r.getheader("Content-Type", "application/json")
        finally:
            VIEC.pop(ma, None)
            c.close()
    except Exception as e:
        than = json.dumps({"type": "error", "error": {"type": "api_error", "message": "cầu lỗi khi chuyển: %s" % e}}, ensure_ascii=False)
    try:
        ws.gui(json.dumps({"ma": ma, "ma_http": ma_http, "than": than, "loai": loai}, ensure_ascii=False))
    except OSError:
        pass


def chay_tram(tram, cong, khoa_ham=doc_khoa):
    """Giữ nối tới trạm suốt lúc cầu chạy; đứt / lỗi → chờ 5 s … 5 phút rồi nối lại."""
    url = re.sub(r"^http", "ws", tram) + "/api/tram/cau"
    cho = 5
    while True:
        NOI.update(trang_thai="dang_noi")
        ws, dung = None, threading.Event()
        try:
            ws = WS(url, {"X-Leo-Khoa": khoa_ham(), "Origin": tram})
            HIEN_WS[0] = ws
            NOI.update(trang_thai="da_noi", loi="", luc=time.time())
            print("[cau] Đã nối trạm điện thoại %s" % tram)
            cho = 5

            def nhip(w=ws):
                while not dung.wait(30):
                    try:
                        w.gui("ping")
                    except OSError:
                        return
            threading.Thread(target=nhip, daemon=True).start()
            while True:
                t = ws.nhan()
                if t is None:
                    break
                if t == "pong":
                    continue
                try:
                    v = json.loads(t)
                except ValueError:
                    continue
                if v.get("huy"):
                    huy_viec(v["huy"])
                    continue
                threading.Thread(target=xu_ly_viec, args=(ws, v, tram, cong), daemon=True).start()
            NOI.update(trang_thai="dang_noi", loi="trạm đóng nối")
        except Exception as e:
            if not _NOI_LAI.is_set():
                NOI.update(trang_thai="loi", loi=str(e)[:200])
                print("[cau] Chưa nối được trạm điện thoại (%s) — thử lại sau %d giây" % (e, cho))
        finally:
            dung.set()
            HIEN_WS[0] = None
            if ws:
                ws.dong()
        if _NOI_LAI.is_set():
            _NOI_LAI.clear()
            continue
        time.sleep(cho)
        cho = min(cho * 2, 300)


# ------------------------------------------------------------------ máy phục vụ
class XuLy(BaseHTTPRequestHandler):
    server_version = "LeoCauClaude/%d" % PHIEN_BAN_CAU
    lenh_claude = None     # đặt trong main() / test
    _tt_dn = {"luc": 0, "kq": {}}

    def log_message(self, fmt, *a):
        _ghi_loi("[cau] " + (fmt % a) + "\n")

    def _nguon(self):
        n = self.headers.get("Origin")
        if n is None or NGUON_OK.match(n) or n.rstrip("/") in nguon_cho_phep():
            return n
        _ghi_loi("[cau] TỪ CHỐI nguồn %s — không phải file:// / localhost / nguồn khai ở cau_claude.json (LEO_CAU_NGUON)\n" % n)
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
        duong = self.path.split("?")[0]
        if duong == "/ghep" and self.headers.get("X-Leo-Qua-Tram") != "1":   # mã ghép chỉ trả cho trang trên chính máy này
            return self._json(200, {"khoa": doc_khoa(), "tram": diachi_tram(), "noi": NOI["trang_thai"], "loi_noi": NOI["loi"]}, nguon)
        if duong != "/suc-khoe":
            return self._json(404, {"loi": "không có"}, nguon)
        self._json(200, self.suc_khoe(), nguon)

    def suc_khoe(self):
        lenh, tt = self.lenh_claude, XuLy._tt_dn
        ra = {"ok": bool(lenh), "cau": PHIEN_BAN_CAU, "cong": self.server.server_address[1], "phien_ban": None,
              "dang_nhap": None, "tai_khoan": {}, "xa": self.headers.get("X-Leo-Qua-Tram") == "1", "tram": NOI["trang_thai"]}
        if not lenh:
            return ra
        if time.time() - tt["luc"] > 20:   # `claude auth status` không tốn lượt AI nhưng tốn ~0,5 s → nhớ 20 s
            try:
                pb = subprocess.run(lenh + ["--version"], capture_output=True, timeout=30, creationflags=KHONG_CUA_SO).stdout.decode().strip()
                a = json.loads(subprocess.run(lenh + ["auth", "status", "--json"], capture_output=True, timeout=30,
                                              cwd=tempfile.gettempdir(), creationflags=KHONG_CUA_SO).stdout.decode("utf-8", "replace") or "{}")
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
        if duong == "/doi-ma" and self.headers.get("X-Leo-Qua-Tram") != "1":
            k = doc_khoa(moi=True)
            _NOI_LAI.set()   # đóng nối cũ (mã cũ) → vòng chay_tram nối lại NGAY bằng mã mới
            w = HIEN_WS[0]
            if w:
                try:
                    w.s.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
            return self._json(200, {"khoa": k}, nguon)
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
        luong = {"mo": False, "chu": "", "id": "msg_" + uuid.uuid4().hex[:24]}
        co_luong = bool(body.get("stream"))

        def ghi_sse(ten, du):
            self.wfile.write(("event: %s\ndata: %s\n\n" % (ten, json.dumps(du, ensure_ascii=False))).encode("utf-8"))
            self.wfile.flush()

        def khi_chu(manh):
            """Chữ của "chu" đến dần: lần đầu mở luồng SSE (tới lúc đó lỗi vẫn trả được mã HTTP đúng), rồi đẩy từng mảnh."""
            try:
                if not luong["mo"]:
                    luong["mo"] = True
                    self._dau(200, nguon, "text/event-stream; charset=utf-8")
                    self.send_header("request-id", "req_" + uuid.uuid4().hex[:16])
                    self.end_headers()
                    dau = tin_nhan_day_du(body, [], None, {"input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0})
                    dau["id"] = luong["id"]
                    ghi_sse("message_start", {"type": "message_start", "message": dau})
                    ghi_sse("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}})
                luong["chu"] += manh
                ghi_sse("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": manh}})
            except OSError:
                pass   # trình duyệt ngắt nối: con_song() sẽ thấy và giết claude

        try:
            o = hoi_claude(self.lenh_claude, body, thu_muc, self.con_song, khi_chu if co_luong else None)
            msg = tin_nhan_day_du(body, *ra_tin_nhan(o, body))
            msg["id"] = luong["id"]
        except LoiCau as e:
            if e.kieu == "da_huy":
                return
            if luong["mo"]:       # đã phát chữ rồi: không còn đổi được mã HTTP → sự kiện error trong luồng
                try:
                    ghi_sse("error", {"type": "error", "error": {"type": e.kieu, "message": e.chu}})
                except OSError:
                    pass
                return
            return self._loi(e, nguon)
        finally:
            shutil.rmtree(thu_muc, ignore_errors=True)
        if not co_luong:
            return self._json(200, msg, nguon, {"request-id": "req_" + uuid.uuid4().hex[:16]})
        if luong["mo"]:
            try:
                cuoi = next((b["text"] for b in msg["content"] if b["type"] == "text"), "")
                if cuoi.startswith(luong["chu"]) and len(cuoi) > len(luong["chu"]):     # phần cầu nối thêm (vd. ghi chú công cụ lạ)
                    ghi_sse("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": cuoi[len(luong["chu"]):]}})
                ghi_sse("content_block_stop", {"type": "content_block_stop", "index": 0})
                chi_so = 1
                for b in msg["content"]:
                    if b["type"] != "tool_use":
                        continue
                    ghi_sse("content_block_start", {"type": "content_block_start", "index": chi_so, "content_block": {"type": "tool_use", "id": b["id"], "name": b["name"], "input": {}}})
                    ghi_sse("content_block_delta", {"type": "content_block_delta", "index": chi_so, "delta": {"type": "input_json_delta", "partial_json": json.dumps(b["input"], ensure_ascii=False)}})
                    ghi_sse("content_block_stop", {"type": "content_block_stop", "index": chi_so})
                    chi_so += 1
                ghi_sse("message_delta", {"type": "message_delta", "delta": {"stop_reason": msg["stop_reason"], "stop_sequence": None}, "usage": msg["usage"]})
                ghi_sse("message_stop", {"type": "message_stop"})
            except OSError:
                pass
            return
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
    tram = diachi_tram()
    if tram:
        threading.Thread(target=chay_tram, args=(tram, cong), daemon=True).start()
        print("Trạm điện thoại: %s · mã ghép ở %s" % (tram, TEP_GHEP))
    else:
        print("Trạm điện thoại: (chưa khai — thêm {\"tram\": \"https://<app>\"} vào cau_claude.json)")
    if lenh:
        try:
            tk = json.loads(subprocess.run(lenh + ["auth", "status", "--json"], capture_output=True, timeout=30,
                                           cwd=tempfile.gettempdir(), creationflags=KHONG_CUA_SO).stdout.decode("utf-8", "replace") or "{}")
            print("Claude Code: " + ("đã đăng nhập" if tk.get("loggedIn") else "CHƯA ĐĂNG NHẬP — chạy `claude auth login`"))
        except Exception as e:
            print("Claude Code: không đọc được trạng thái đăng nhập (%s)" % e)
    try:
        sv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
