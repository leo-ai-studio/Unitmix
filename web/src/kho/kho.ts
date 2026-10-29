import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api';
import type { TrangThaiPA } from '../tinh/kieu';
import type { CheDo, TrangThaiLuu } from '../ui/ThanhTren';
import { taoBoLuu } from './luu';
import { taoKhoLoi } from './khoLoi';

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

  const boLuuRef = useRef(boLuu);
  boLuuRef.current = boLuu;
  // Lõi thuần (kho/khoLoi.ts): luôn sửa trên bản mới nhất, cùng ngăn hoàn tác cho giao diện lẫn trợ lý Leo AI.
  const [loi] = useState(() => taoKhoLoi(ban, (moi) => {
    setPA(moi);
    boLuuRef.current.thayDoi(moi, tinhTomTat.current?.(moi) ?? {});
  }));
  const cheDoRef = useRef(cheDo);
  cheDoRef.current = cheDo;

  return {
    pa,
    cheDo,
    datCheDo: (c: CheDo) => setCheDo(duocSua ? c : 'chi_xem'),
    trangThaiLuu: duocSua ? trangThaiLuu : undefined,
    sua(fn: (p: TrangThaiPA) => TrangThaiPA) {
      if (cheDoRef.current === 'chi_xem') return;
      loi.sua(fn);
    },
    hoanTac() {
      if (cheDoRef.current === 'chi_xem') return;
      loi.hoanTac();
    },
    lamLai() {
      if (cheDoRef.current === 'chi_xem') return;
      loi.lamLai();
    },
    /** Cho trợ lý Leo AI: bản PA mới nhất, sửa có trả kết quả, số bước hoàn tác, chế độ hiện tại. */
    loi,
    layCheDo: () => cheDoRef.current,
    /** Ctrl+S: ghi ngay, không chờ debounce. */
    luuNgay: () => void boLuu.luuNgay(),
    conChuaLuu: () => boLuu.conChuaLuu(),
    nhapCu,
  };
}
