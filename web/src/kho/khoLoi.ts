import type { TrangThaiPA } from '../tinh/kieu';

export const GIOI_HAN_HOAN_TAC = 100;

/**
 * Lõi thuần của kho PA (dùng chung cho `useKho` và trợ lý Leo AI / test): sửa = một bước hoàn tác, hoàn tác / làm lại,
 * luôn đọc bản PA MỚI NHẤT (hai lần sửa liền trong một nhịp — vd Leo AI gọi nhiều công cụ một lượt — không đè nhau).
 */
export type KhoLoi = {
  lay: () => TrangThaiPA;
  /** Trả true khi có thay đổi (đã ghi một bước hoàn tác); phép sửa không đổi gì thì không ghi bước rỗng. */
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => boolean;
  hoanTac: () => boolean;
  lamLai: () => boolean;
  soBuoc: () => { truoc: number; sau: number };
};

export function taoKhoLoi(ban: TrangThaiPA, ap: (moi: TrangThaiPA) => void): KhoLoi {
  let pa = ban;
  let truoc: TrangThaiPA[] = [];
  let sau: TrangThaiPA[] = [];
  const dat = (moi: TrangThaiPA) => { pa = moi; ap(moi); };
  return {
    lay: () => pa,
    sua(fn) {
      const moi = fn(pa);
      // Phép sửa không đổi gì (vd đổi căn bị chặn vì không vừa ô) thì không ghi bước hoàn tác rỗng.
      if (moi === pa || JSON.stringify(moi) === JSON.stringify(pa)) return false;
      truoc = [...truoc.slice(-GIOI_HAN_HOAN_TAC + 1), pa];
      sau = [];
      dat(moi);
      return true;
    },
    hoanTac() {
      const p = truoc.pop();
      if (!p) return false;
      sau.push(pa);
      dat(p);
      return true;
    },
    lamLai() {
      const p = sau.pop();
      if (!p) return false;
      truoc.push(pa);
      dat(p);
      return true;
    },
    soBuoc: () => ({ truoc: truoc.length, sau: sau.length }),
  };
}
