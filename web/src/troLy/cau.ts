/**
 * Cầu Claude (scripts/cau_claude.py): Leo AI dùng TÀI KHOẢN Claude đã đăng nhập trên máy, không cần khoá API.
 * Cầu nghe ở 127.0.0.1 và nói đúng giao thức Anthropic Messages → SDK chỉ đổi baseURL (khachThat.ts).
 * Module này: địa chỉ cầu (lưu trình duyệt này), dò sức khoẻ cầu, mở đăng nhập, và chọn nguồn gọi Claude.
 */
export const CAU_MAC_DINH = 'http://127.0.0.1:3032';
const KHOA_CAU = 'unitmix.leoAi.cau';

export type NguonChon = 'tu_dong' | 'cau' | 'chung' | 'rieng';
export type NguonDung = 'cau' | 'chung' | 'rieng';
export const DS_NGUON: NguonChon[] = ['tu_dong', 'cau', 'chung', 'rieng'];

export type TrangThaiCau = {
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

/** Dò cầu (GET /suc-khoe, không tốn lượt AI). null = cầu không trả lời (chưa chạy / bị chặn). */
export async function kiemCau(url: string = docDiaChiCau(), ms = 1500, goi: typeof fetch = fetch): Promise<TrangThaiCau | null> {
  const ac = new AbortController();
  const h = setTimeout(() => ac.abort(), ms);
  try {
    const r = await goi(`${url}/suc-khoe`, { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: boolean; dang_nhap?: boolean | null; tai_khoan?: Record<string, string>; phien_ban?: string | null };
    const tk = j.tai_khoan ?? {};
    return {
      ok: !!j.ok,
      dangNhap: typeof j.dang_nhap === 'boolean' ? j.dang_nhap : null,
      taiKhoan: [tk.email ?? tk.emailAddress ?? tk.organizationName, tk.subscriptionType].filter(Boolean).join(' · '),
      phienBan: j.phien_ban ?? null,
    };
  } catch { return null; } finally { clearTimeout(h); }
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
