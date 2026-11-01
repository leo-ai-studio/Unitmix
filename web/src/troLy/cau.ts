/**
 * Cầu Claude (scripts/cau_claude.py): Leo AI dùng TÀI KHOẢN Claude đã đăng nhập trên máy, không cần khoá API.
 * Cầu nghe ở 127.0.0.1 và nói đúng giao thức Anthropic Messages → SDK chỉ đổi baseURL (khachThat.ts).
 * Điện thoại không tới được 127.0.0.1 của máy tính: cầu tự nối ra trạm chuyển trên Worker (worker/src/tram.ts); điện thoại ghép MỘT lần
 * bằng link có mã (`#ghep=…`) rồi gọi qua trạm (taoFetchTram) — SDK vẫn thấy cùng giao thức Messages.
 * Module này: địa chỉ cầu + mã ghép (lưu trình duyệt này), dò sức khoẻ cầu, mở đăng nhập, và chọn nguồn gọi Claude.
 */
export const CAU_MAC_DINH = 'http://127.0.0.1:3032';
const KHOA_CAU = 'unitmix.leoAi.cau';

export type NguonChon = 'tu_dong' | 'cau' | 'chung' | 'rieng';
export type NguonDung = 'cau' | 'chung' | 'rieng';
export const DS_NGUON: NguonChon[] = ['tu_dong', 'cau', 'chung', 'rieng'];

export type TrangThaiCau = {
  /** 'may' = cầu ở 127.0.0.1 của máy này; 'tram' = qua trạm chuyển (điện thoại đã ghép) */
  qua: 'may' | 'tram';
  /** có lệnh `claude` trên máy */
  ok: boolean;
  /** true / false; null = chưa rõ */
  dangNhap: boolean | null;
  /** email · gói (vd "a@b.c · max"); rỗng nếu không có */
  taiKhoan: string;
  phienBan: string | null;
};

const doc = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const ghi = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* chặn lưu: chỉ trong phiên */ } };

export const docDiaChiCau = (): string => (doc(KHOA_CAU) ?? CAU_MAC_DINH).replace(/\/+$/, '');
export const ghiDiaChiCau = (u: string | null) => ghi(KHOA_CAU, u?.trim() ? u.trim().replace(/\/+$/, '') : null);

type SucKhoe = { ok?: boolean; dang_nhap?: boolean | null; tai_khoan?: Record<string, string>; phien_ban?: string | null };
const tuSucKhoe = (j: SucKhoe, qua: TrangThaiCau['qua']): TrangThaiCau => {
  const tk = j.tai_khoan ?? {};
  return {
    qua,
    ok: !!j.ok,
    dangNhap: typeof j.dang_nhap === 'boolean' ? j.dang_nhap : null,
    taiKhoan: [tk.email ?? tk.emailAddress ?? tk.organizationName, tk.subscriptionType].filter(Boolean).join(' · '),
    phienBan: j.phien_ban ?? null,
  };
};

/**
 * Dò cầu (GET /suc-khoe, không tốn lượt AI): trước hết cầu trên máy này; không có mà trình duyệt đã ghép điện thoại thì hỏi qua trạm.
 * null = không trả lời (cầu chưa chạy / bị chặn / máy tính tắt).
 */
export async function kiemCau(url: string = docDiaChiCau(), ms = 1500, goi: typeof fetch = fetch): Promise<TrangThaiCau | null> {
  const ac = new AbortController();
  const h = setTimeout(() => ac.abort(), ms);
  try {
    const r = await goi(`${url}/suc-khoe`, { signal: ac.signal, cache: 'no-store' });
    if (r.ok) return tuSucKhoe((await r.json()) as SucKhoe, 'may');
  } catch { /* chưa có cầu ở máy này → thử trạm */ } finally { clearTimeout(h); }
  const khoa = docMaGhep();
  if (!khoa) return null;
  try {
    const r = await taoFetchTram(khoa, goi)('/_cau/suc-khoe', { signal: AbortSignal.timeout(Math.max(ms, 6000)) });
    return r.ok ? tuSucKhoe((await r.json()) as SucKhoe, 'tram') : null;
  } catch { return null; }
}

// ------------------------------------------------------------------ ghép điện thoại qua trạm chuyển
const KHOA_GHEP = 'unitmix.leoAi.ghep';
export const docMaGhep = (): string | null => { const k = doc(KHOA_GHEP); return k && /^[A-Za-z0-9_-]{32,100}$/.test(k) ? k : null; };
export const ghiMaGhep = (k: string | null) => ghi(KHOA_GHEP, k);
export const linkGhep = (khoa: string, goc: string = location.origin) => `${goc}/#ghep=${khoa}`;

/** Mở app bằng link `…/#ghep=<mã>` → lưu mã (một lần), xoá khỏi thanh địa chỉ để mã không nằm trong lịch sử. Trả true nếu vừa ghép. */
export function nhanMaGhepTuLink(): boolean {
  try {
    const m = /^#ghep=([A-Za-z0-9_-]{32,100})$/.exec(location.hash);
    if (!m) return false;
    ghiMaGhep(m[1]);
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  } catch { return false; }
}

/** Lấy mã ghép từ chuỗi người dùng dán: cả link `…/#ghep=<mã>` lẫn mã trần (iPhone: link mở ở Safari không vào được app đã thêm màn hình chính → dán tay). */
export function docMaGhepTuChuoi(s: string): string | null {
  const m = /(?:ghep=)?([A-Za-z0-9_-]{32,100})\s*$/.exec((s ?? '').trim());
  return m ? m[1] : null;
}

/** Máy cảm ứng / màn nhỏ (điện thoại, máy tính bảng): không cài được cầu ở đây, chỉ ghép với máy tính. */
export const laDienThoai = (): boolean => { try { return matchMedia('(pointer: coarse)').matches || innerWidth < 768; } catch { return false; } };

/** Mã ghép + trạng thái trạm của cầu trên máy này (chỉ cầu cục bộ trả; trạm không bao giờ trả). */
export async function docGhepCuaMay(url: string = docDiaChiCau(), goi: typeof fetch = fetch): Promise<{ khoa: string; tram: string; noi: string } | null> {
  try {
    const r = await goi(`${url}/ghep`, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as { khoa: string; tram: string; noi: string }) : null;
  } catch { return null; }
}

/** Đổi mã ghép (điện thoại cũ hết dùng). */
export async function doiMaGhep(url: string = docDiaChiCau(), goi: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await goi(`${url}/doi-ma`, { method: 'POST', body: '{}' });
    return r.ok ? ((await r.json()) as { khoa: string }).khoa : null;
  } catch { return null; }
}

/** Địa chỉ giả cho SDK khi đi qua trạm — fetch dưới đây bỏ qua, chỉ lấy đuôi đường dẫn. */
export const GOC_TRAM = '/_cau';

/**
 * fetch cho SDK / dò cầu khi đi qua trạm chuyển: POST /api/tram/hoi → chờ ≤ 25 s mỗi lần, chưa xong thì GET /kq lặp lại → trả Response
 * giống cầu trả (JSON hoặc luồng SSE đã gom đủ). Lỗi của trạm đổi sang dạng lỗi Anthropic để loiTiengViet hiểu.
 */
export function taoFetchTram(khoa: string, goi: typeof fetch = fetch): typeof fetch {
  const H = { 'X-Leo-Khoa': khoa, 'content-type': 'application/json' };
  const loi = (ma: number, kieu: string, chu: string) => new Response(JSON.stringify({ type: 'error', error: { type: kieu, message: chu } }), { status: ma, headers: { 'content-type': 'application/json', 'x-should-retry': 'false' } });
  const KIEU: Record<string, string> = { sai_khoa: 'ma_ghep_sai', may_tat: 'may_tat', rate_limited: 'rate_limit_error', qua_lon: 'request_too_large', het_han: 'api_error' };
  const tuTram = async (r: Response) => { const j = (await r.json().catch(() => ({}))) as { loi?: string; ma?: string }; return loi(r.status, KIEU[j.ma ?? ''] ?? 'api_error', j.loi ?? `Trạm trả lỗi ${r.status}`); };
  return async (input, init) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const duong = u.includes('/suc-khoe') ? '/suc-khoe' : '/v1/messages';
    const signal = init?.signal ?? undefined;
    // mã lượt do điện thoại tự sinh: bấm Dừng thì báo trạm huỷ NGAY (cầu giết claude -p), không đợi trạm trả mã
    const ma = crypto.randomUUID();
    if (duong === '/v1/messages') signal?.addEventListener('abort', () => { void goi(`/api/tram/huy?ma=${ma}`, { method: 'POST', headers: H, keepalive: true }).catch(() => undefined); }, { once: true });
    const r = await goi('/api/tram/hoi', { method: 'POST', headers: H, signal, body: JSON.stringify({ ma, duong, than: duong === '/suc-khoe' ? null : (init?.body as string) ?? '{}' }) });
    if (!r.ok) return tuTram(r);
    let j = (await r.json()) as { ma?: string; ma_http?: number; than?: string; loai?: string };
    while (!j.ma_http) {
      if (!j.ma) return loi(502, 'api_error', 'Trạm trả dữ liệu không hợp lệ.');
      const k = await goi(`/api/tram/kq?ma=${j.ma}`, { headers: H, signal });
      if (k.status === 204) continue; // còn đang chạy
      if (!k.ok) return tuTram(k);
      j = (await k.json()) as typeof j;
    }
    return new Response(j.than ?? '', { status: j.ma_http, headers: { 'content-type': j.loai ?? 'application/json', 'x-should-retry': 'false' } });
  };
}

/**
 * Tệp .bat của bộ cài (chỉ chữ không dấu): tải cầu + bộ cài từ chính địa chỉ app về %LOCALAPPDATA%\LeoUnitmix\cau rồi chạy bộ cài với
 * -Goc <địa chỉ app> (cầu biết nguồn nào được gọi, và nối trạm chuyển cho điện thoại). Địa chỉ nhúng lúc bấm tải nên luôn đúng app đang mở.
 */
export function taoBoCaiBat(goc: string = location.origin): string {
  const g = goc.replace(/\/+$/, '').replace(/[^A-Za-z0-9:/._~-]/g, '');
  return [
    '@echo off', 'title Cai Cau AI - LEO Unitmix',
    `set "GOC=${g.startsWith('https://') ? g : ''}"`, 'set "DICH=%LOCALAPPDATA%\\LeoUnitmix\\cau"', 'if not exist "%DICH%" mkdir "%DICH%"',
    'echo Dang tai cau AI tu %GOC% ...',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'Stop\'; foreach ($t in \'cau_claude.py\',\'cai_cau_ai.ps1\') { Invoke-WebRequest -UseBasicParsing -Uri (\'%GOC%/cau/\' + $t) -OutFile (Join-Path \'%DICH%\' $t) }"',
    'if errorlevel 1 ( echo Khong tai duoc cau AI tu %GOC% - kiem tra mang roi chay lai. & pause & exit /b 1 )',
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%DICH%\\cai_cau_ai.ps1" -Goc "%GOC%"', '',
  ].join('\r\n');
}

/** Nhờ cầu mở terminal `claude auth login` — người dùng tự đăng nhập, cầu không chạm mật khẩu. */
export async function moDangNhapCau(url: string = docDiaChiCau()): Promise<boolean> {
  try { return (await fetch(`${url}/dang-nhap`, { method: 'POST', body: '{}' })).ok; } catch { return false; }
}

/** Cầu dùng được = có lệnh claude VÀ đã đăng nhập (chưa rõ đăng nhập thì vẫn thử). */
export const cauDungDuoc = (c: TrangThaiCau | null): boolean => !!c && c.ok && c.dangNhap !== false;

/**
 * Chọn nguồn gọi Claude. Tự động: khoá riêng (người dùng đã tự dán) → tài khoản Claude qua cầu → khoá chung của máy chủ.
 * Chọn tay một nguồn thì luôn dùng nguồn đó (hỏng thì báo lỗi, không lặng lẽ đổi sang nguồn tốn tiền).
 */
export function chonNguon(chon: NguonChon, co: { khoaRieng: boolean; cau: boolean }): NguonDung {
  if (chon !== 'tu_dong') return chon;
  if (co.khoaRieng) return 'rieng';
  return co.cau ? 'cau' : 'chung';
}
