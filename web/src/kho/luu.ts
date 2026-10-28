import type { TrangThaiLuu } from '../ui/ThanhTren';

export type KhoLuuTru = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Nhap = { trangThai: unknown; tomTat: unknown };

type TuyChon = {
  ghi: (trangThai: unknown, tomTat: unknown) => Promise<void>;
  kho: KhoLuuTru;
  khoaNhap: string;
  duocGhi: boolean;
  khiDoi: (t: TrangThaiLuu) => void;
  choMs?: number;
};

export type BoLuu = {
  /** Báo có thay đổi; gom các thay đổi liên tiếp trong `choMs` thành một lần ghi. */
  thayDoi(trangThai: unknown, tomTat: unknown): void;
  /** Bản nháp còn lại ở máy từ lần trước chưa lưu được (nếu có). */
  layNhap(): Nhap | null;
  /** Ghi ngay (Ctrl+S): bỏ chờ debounce; bản ghi lỗi lần trước cũng gửi lại. */
  luuNgay(): Promise<void>;
  /** Còn thay đổi chưa lên máy chủ (đang chờ, đang ghi hoặc lần ghi trước lỗi) — cảnh báo khi đóng tab. */
  conChuaLuu(): boolean;
  huy(): void;
};

/** Tự lưu: gom thay đổi, ghi lên máy chủ, giữ bản nháp ở máy khi ghi lỗi. Không có quyền sửa thì không làm gì. */
export function taoBoLuu({ ghi, kho, khoaNhap, duocGhi, khiDoi, choMs = 800 }: TuyChon): BoLuu {
  let hen: ReturnType<typeof setTimeout> | null = null;
  let choGhi: Nhap | null = null;
  let dangGhi = false;
  let banLoi: Nhap | null = null; // bản ghi lỗi gần nhất (nháp vẫn ở máy); Ctrl+S gửi lại

  const datNhap = (n: Nhap) => {
    try {
      kho.setItem(khoaNhap, JSON.stringify(n));
    } catch {
      /* hết chỗ lưu ở máy: vẫn thử ghi lên máy chủ */
    }
  };

  async function chay(): Promise<void> {
    hen = null;
    if (dangGhi || !choGhi) return;
    const ban = choGhi;
    choGhi = null;
    dangGhi = true;
    khiDoi('dang_luu');
    try {
      await ghi(ban.trangThai, ban.tomTat);
      banLoi = null;
      if (!choGhi) {
        kho.removeItem(khoaNhap);
        khiDoi('da_luu');
      }
    } catch {
      banLoi = ban;
      khiDoi('chua_luu_duoc');
    } finally {
      dangGhi = false;
      if (choGhi && !hen) hen = setTimeout(chay, choMs);
    }
  }

  return {
    thayDoi(trangThai, tomTat) {
      if (!duocGhi) return;
      choGhi = { trangThai, tomTat };
      datNhap(choGhi);
      if (hen) clearTimeout(hen);
      hen = setTimeout(chay, choMs);
    },
    layNhap() {
      try {
        const s = kho.getItem(khoaNhap);
        return s ? (JSON.parse(s) as Nhap) : null;
      } catch {
        return null;
      }
    },
    luuNgay() {
      if (!duocGhi) return Promise.resolve();
      if (hen) clearTimeout(hen);
      hen = null;
      if (!choGhi && banLoi) choGhi = banLoi;
      return chay();
    },
    conChuaLuu() {
      return duocGhi && (!!choGhi || dangGhi || !!banLoi);
    },
    huy() {
      if (hen) clearTimeout(hen);
      hen = null;
    },
  };
}
