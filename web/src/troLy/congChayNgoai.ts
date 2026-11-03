/**
 * Cổng chạy công cụ từ bên ngoài (trình duyệt nhúng / Playwright / Claude Code điều khiển trang): `window.unitmixTools`.
 * Gọi THẲNG bộ 45 công cụ của Leo AI trên kho thật (cùng hoàn tác, cùng tự lưu, cùng kiểm "Chỉ xem") — KHÔNG qua vòng AI,
 * nên không tốn token lời hệ thống + định nghĩa công cụ mỗi lượt.
 *
 * An toàn: chỉ bật khi mở trang với `?congCu=1` (người dùng chủ động); không có mã sửa thì công cụ sửa tự trả lỗi như cũ;
 * hộp xác nhận (xoá PA…) mặc định TỪ CHỐI, chỉ qua khi gọi kèm `{ dongY: true }`.
 *
 *   await unitmixTools.chay('get_state', {})                       → { ok, noiDung, loi }
 *   await unitmixTools.chay('apply_arrangement', {...}, { dongY: true })
 *   unitmixTools.danhSach()                                         → [{ ten, moTa, schema }]
 *
 * Cầu MCP (scripts/mcp_unitmix/mdi_unitmix_mcp.py): mở trang với `?congCu=1&mcp=3033` thì trang tự hỏi việc ở
 * http://127.0.0.1:3033 (long-poll), chạy bằng chính cổng này rồi gửi kết quả về — Claude Code gọi công cụ app như công cụ MCP gốc,
 * không phải điều khiển trình duyệt bằng JS, không bị cắt 12.000 ký tự (cầu tự cắt gọn theo yêu cầu).
 */
import { BO_CONG_CU, chayCongCu, TOI_DA_KY_TU, type KetQuaChay } from './congCu';
import type { NguCanh } from './congCu/nguCanh';

/** `toiDa`: trần ký tự kết quả (mặc định như vòng AI; 0 = không cắt). */
export type TuyChonChay = { dongY?: boolean; toiDa?: number };
export type CongNgoai = {
  phienBan: 1;
  danhSach: () => { ten: string; moTa: string; schema: unknown }[];
  chay: (ten: string, dauVao?: unknown, tuyChon?: TuyChonChay) => Promise<KetQuaChay & { ok: boolean; json?: unknown }>;
};

export function congDuocBat(tim: string): boolean {
  return new URLSearchParams(tim).get('congCu') === '1';
}

/** Cổng cầu MCP trên máy (`?mcp=3033`; `mcp=1` = cổng mặc định 3033); null = không nối. */
export function congMcp(tim: string): number | null {
  const v = new URLSearchParams(tim).get('mcp');
  if (!v) return null;
  const n = v === '1' ? 3033 : Number(v);
  return Number.isInteger(n) && n > 1024 && n < 65536 ? n : null;
}

/** Một việc cầu MCP giao cho trang. */
export type ViecMcp =
  | { id: string; loai: 'goi'; ten: string; dau_vao?: unknown; dong_y?: boolean }
  | { id: string; loai: 'nhieu'; lenh: { ten: string; dau_vao?: unknown }[]; dong_y?: boolean; dung_khi_loi?: boolean }
  | { id: string; loai: 'js'; ma: string }
  | { id: string; loai: 'danh_sach' };

/**
 * Chạy một việc của cầu MCP bằng cổng ngoài (kết quả không cắt — cầu tự cắt theo yêu cầu của Claude Code).
 * `js`: hàm async `(T) => …` chạy trong trang với T = cổng công cụ (cùng hàng đợi, cùng hoàn tác) — dùng cho phép tính / lọc gọn
 * nhiều kết quả trong trang rồi chỉ trả phần cần, đỡ token.
 */
export async function chayViecMcp(cong: CongNgoai, v: ViecMcp): Promise<unknown> {
  if (v.loai === 'danh_sach') return cong.danhSach();
  if (v.loai === 'goi') { const r = await cong.chay(v.ten, v.dau_vao ?? {}, { dongY: v.dong_y, toiDa: 0 }); return { ok: r.ok, noi_dung: r.noiDung }; }
  if (v.loai === 'nhieu') {
    const ra: { ten: string; ok: boolean; noi_dung: string }[] = [];
    for (const l of v.lenh) {
      const r = await cong.chay(l.ten, l.dau_vao ?? {}, { dongY: v.dong_y, toiDa: 0 });
      ra.push({ ten: l.ten, ok: r.ok, noi_dung: r.noiDung });
      if (!r.ok && v.dung_khi_loi !== false) break;
    }
    return ra;
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const ham = new Function('T', `return (${v.ma})(T);`) as (T: CongNgoai) => unknown;
  return await ham(cong);
}

/** Vòng hỏi việc ở cầu MCP; trả hàm dừng. Cầu chưa chạy thì thử lại mỗi 3 giây (không làm phiền trang). */
export function noiCauMcp(cong: CongNgoai, congSo: number, thongTin: () => Record<string, unknown>): () => void {
  let dung = false;
  const goc = `http://127.0.0.1:${congSo}`;
  const nghi = (ms: number) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    while (!dung) {
      try {
        const r = await fetch(`${goc}/viec?tt=${encodeURIComponent(JSON.stringify(thongTin()))}`, { cache: 'no-store' });
        if (r.status !== 200) { if (r.status !== 204) await nghi(3000); continue; }
        const v = (await r.json()) as ViecMcp;
        let ket: unknown, loi: string | null = null;
        try { ket = await chayViecMcp(cong, v); } catch (e) { loi = e instanceof Error ? e.message : String(e); }
        await fetch(`${goc}/xong`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: v.id, ket_qua: ket ?? null, loi }) });
      } catch { await nghi(3000); }
    }
  })();
  return () => { dung = true; };
}

export function taoCongNgoai(ng: NguCanh): CongNgoai {
  // hàng đợi: mỗi lần một lệnh (công cụ sửa kho tuần tự, tránh hai lệnh chen nhau giữa chừng await)
  let hang: Promise<unknown> = Promise.resolve();
  return {
    phienBan: 1,
    danhSach: () => BO_CONG_CU.map((c) => ({ ten: c.ten, moTa: c.moTa, schema: c.schema })),
    chay(ten, dauVao = {}, tuyChon = {}) {
      const chayMot = async () => {
        const ngTrong: NguCanh = { ...ng, xacNhan: tuyChon.dongY ? async () => true : async () => false };
        const kq = await chayCongCu(ten, dauVao, ngTrong, tuyChon.toiDa ?? TOI_DA_KY_TU);
        let json: unknown;
        try { json = JSON.parse(kq.noiDung); } catch { /* chữ thường */ }
        return { ...kq, ok: !kq.loi, json };
      };
      const p = hang.then(chayMot, chayMot);
      hang = p.catch(() => undefined);
      return p;
    },
  };
}

/** Gắn / gỡ vào window. Trả hàm gỡ. */
export function baoCongNgoai(ng: NguCanh, tim = typeof location === 'undefined' ? '' : location.search): () => void {
  if (!congDuocBat(tim) || typeof window === 'undefined') return () => undefined;
  const cong = taoCongNgoai(ng);
  (window as unknown as { unitmixTools?: CongNgoai }).unitmixTools = cong;
  const so = congMcp(tim);
  const dungMcp = so ? noiCauMcp(cong, so, () => ({ du_an: ng.duAn.ma, ten: ng.duAn.ten, pa: ng.duAn.paId, ten_pa: ng.duAn.tenPA, che_do: ng.chiXem() ? 'chi_xem' : 'sua_duoc' })) : () => undefined;
  return () => { dungMcp(); const w = window as unknown as { unitmixTools?: CongNgoai }; if (w.unitmixTools === cong) delete w.unitmixTools; };
}
