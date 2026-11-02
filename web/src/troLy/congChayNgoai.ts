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
 */
import { BO_CONG_CU, chayCongCu, type KetQuaChay } from './congCu';
import type { NguCanh } from './congCu/nguCanh';

export type TuyChonChay = { dongY?: boolean };
export type CongNgoai = {
  phienBan: 1;
  danhSach: () => { ten: string; moTa: string; schema: unknown }[];
  chay: (ten: string, dauVao?: unknown, tuyChon?: TuyChonChay) => Promise<KetQuaChay & { ok: boolean; json?: unknown }>;
};

export function congDuocBat(tim: string): boolean {
  return new URLSearchParams(tim).get('congCu') === '1';
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
        const kq = await chayCongCu(ten, dauVao, ngTrong);
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
  return () => { const w = window as unknown as { unitmixTools?: CongNgoai }; if (w.unitmixTools === cong) delete w.unitmixTools; };
}
