import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api';
import type { TrangThaiPA } from '../tinh/kieu';
import type { CheDo, TrangThaiLuu } from '../ui/ThanhTren';
import { taoBoLuu } from './luu';

const GIOI_HAN_HOAN_TAC = 100;

type Mo = {
  ma: string; paId: string; tenPA: string; maSua: string | null; duocSua: boolean; ban: TrangThaiPA;
  /** Tóm tắt gửi kèm mỗi lần lưu (hiện ở danh sách PA); không có (chưa tải thư viện) thì gửi {}. */
  tomTat?: (pa: TrangThaiPA) => unknown;
};

/** Trạng thái PA đang mở: sửa, hoàn tác/làm lại, chế độ sửa, tự lưu. */
export function useKho({ ma, paId, tenPA, maSua, duocSua, ban, tomTat }: Mo) {
  const tinhTomTat = useRef(tomTat);
  tinhTomTat.current = tomTat;
  const [pa, setPA] = useState<TrangThaiPA>(ban);
  const [cheDo, setCheDo] = useState<CheDo>(duocSua ? 'tu_dong' : 'chi_xem');
  const [trangThaiLuu, setLuu] = useState<TrangThaiLuu>('da_luu');
  const truoc = useRef<TrangThaiPA[]>([]);
  const sau = useRef<TrangThaiPA[]>([]);

  const boLuu = useMemo(
    () =>
      taoBoLuu({
        ghi: (tt, tomTat) => api.ghiPA(ma, paId, maSua!, tenPA, tt, tomTat).then(() => undefined),
        kho: localStorage,
        khoaNhap: `unitmix.nhap.${ma}.${paId}`,
        duocGhi: duocSua && !!maSua,
        khiDoi: setLuu,
      }),
    [ma, paId, maSua, duocSua, tenPA],
  );
  useEffect(() => () => boLuu.huy(), [boLuu]);
  // Bản nháp còn lại từ lần mở trước: chỉ đọc một lần lúc mở PA, không đọc lại khi đang sửa.
  const [nhapCu] = useState(() => boLuu.layNhap());

  const ap = (moi: TrangThaiPA) => {
    setPA(moi);
    boLuu.thayDoi(moi, tinhTomTat.current?.(moi) ?? {});
  };

  return {
    pa,
    cheDo,
    datCheDo: (c: CheDo) => setCheDo(duocSua ? c : 'chi_xem'),
    trangThaiLuu: duocSua ? trangThaiLuu : undefined,
    sua(fn: (p: TrangThaiPA) => TrangThaiPA) {
      if (cheDo === 'chi_xem') return;
      const moi = fn(pa);
      // Phép sửa không đổi gì (vd đổi căn bị chặn vì không vừa ô) thì không ghi bước hoàn tác rỗng.
      if (moi === pa || JSON.stringify(moi) === JSON.stringify(pa)) return;
      truoc.current = [...truoc.current.slice(-GIOI_HAN_HOAN_TAC + 1), pa];
      sau.current = [];
      ap(moi);
    },
    hoanTac() {
      const p = truoc.current.pop();
      if (!p || cheDo === 'chi_xem') return;
      sau.current.push(pa);
      ap(p);
    },
    lamLai() {
      const p = sau.current.pop();
      if (!p || cheDo === 'chi_xem') return;
      truoc.current.push(pa);
      ap(p);
    },
    nhapCu,
  };
}
