/**
 * Dựng ngữ cảnh công cụ Leo AI từ trình soạn (man/SoanThao.tsx `TrinhSoan`): kho thật, state chọn thật (setter của SoanThao +
 * chọn tầng `chonTangNgoai` như dải cấp), API dự án / PA, xuất tệp, giao diện DOM. `phu` là ref cập nhật mỗi lần vẽ lại.
 */
import { api } from '../api';
import type { DuAnApi } from '../api';
import type { KhoLoi } from '../kho/khoLoi';
import { tangDangXem } from '../man/ManTang';
import { choDuLieuMB } from '../man/tuChinhTang';
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { chuanHoaPA, taoPAMoi } from '../tinh/macDinh';
import { taiQuyTac, traLuat } from '../tinh/quyTac';
import { chonTangNgoai } from '../ui/ChonTang';
import { t } from '../i18n/i18n';
import { taiCuaCan } from '../ve/hinhHocThuVien';
import type { NguCanh, PAtrongDA, TrangThaiUi } from './congCu/nguCanh';
import { bamUi, chupUi, datUi } from './uiDom';

export type PhuSoan = {
  ma: string; da: DuAnApi; paId: string; tenPA: string; maSua: string | null;
  loi: KhoLoi; layCheDo: () => string; tv: ThuVien | null;
  ui: TrangThaiUi;
  datBuoc: (b: TrangThaiUi['buoc']) => void; datXem: (x: TrangThaiUi['xem']) => void;
  datLo: (id: string | null) => void; datToa: (id: string | null) => void; datCan: (k: string | null) => void; datTangHam: (n: number) => void;
  xuatXls?: () => Promise<void>; moCad?: () => void;
};

export function taoNguCanhSoan(phu: { current: PhuSoan }, xacNhan: { current: (c: string) => Promise<boolean> }): NguCanh {
  let cho: Partial<TrangThaiUi> = {};
  let veLan = phu.current; // phu.current đổi = đã vẽ lại → bỏ phần chờ
  const thuc = (): TrangThaiUi => {
    const p = phu.current;
    if (p !== veLan) { veLan = p; cho = {}; }
    const toaId = cho.toaId !== undefined ? cho.toaId : p.ui.toaId;
    return { ...p.ui, tangs: tangDangXem(toaId), ...cho };
  };
  const dsPA: PAtrongDA[] = phu.current.da.phuong_an.map((x) => ({ id: x.id, ten: x.ten }));
  const maSua = () => { const m = phu.current.maSua; if (!m) throw new Error(t('leo.loi.canMaSua')); return m; };
  let luat: ReturnType<typeof taiLuat> | null = null;
  const taiLuat = () => taiQuyTac().then((bo) => { const lo01 = traLuat(bo, 'LO-01'), lo02 = traLuat(bo, 'LO-02'); return lo01 && lo02 ? { lo01, lo02 } : null; });

  return {
    kho: phu.current.loi,
    chiXem: () => phu.current.layCheDo() === 'chi_xem',
    tv: () => phu.current.tv,
    dl: (pa: TrangThaiPA) => (phu.current.tv ? choDuLieuMB(pa, phu.current.tv) : Promise.resolve(null)),
    luat: () => (luat ??= taiLuat().catch(() => null)),
    cuaCan: (nhom) => (phu.current.tv ? taiCuaCan(phu.current.tv, nhom) : Promise.resolve({})),
    duAn: {
      get ma() { return phu.current.ma; }, get ten() { return phu.current.da.ten; }, get paId() { return phu.current.paId; }, get tenPA() { return phu.current.tenPA; },
      dsPA: () => dsPA, get coMaSua() { return !!phu.current.maSua; },
    },
    ui: {
      lay: thuc,
      dat: (p) => {
        const d = phu.current;
        if (p.loId !== undefined) d.datLo(p.loId);
        if (p.toaId !== undefined) d.datToa(p.toaId);
        if (p.canKhoa !== undefined) d.datCan(p.canKhoa);
        if (p.tangs !== undefined) chonTangNgoai(p.tangs);
        if (p.tangHam !== undefined) d.datTangHam(p.tangHam);
        if (p.buoc) d.datBuoc(p.buoc);
        if (p.xem) d.datXem(p.xem);
        cho = { ...cho, ...p };
      },
    },
    paApi: {
      nhanBan: async (id) => { const r = await api.nhanBan(phu.current.ma, id, maSua()); dsPA.push({ id: r.id, ten: `${dsPA.find((x) => x.id === id)?.ten ?? id} (bản sao)` }); return r.id; },
      doiTen: async (id, ten) => { await api.doiTenPA(phu.current.ma, id, maSua(), ten); const x = dsPA.find((q) => q.id === id); if (x) x.ten = ten; },
      xoa: async (id) => { await api.xoaPA(phu.current.ma, id, maSua()); dsPA.splice(dsPA.findIndex((q) => q.id === id), 1); },
      taoMoi: async (ten) => { const id = `pa-${Math.random().toString(36).slice(2, 8)}`; await api.ghiPA(phu.current.ma, id, maSua(), ten, taoPAMoi(), {}); dsPA.push({ id, ten }); return id; },
      doc: async (id) => { const r = await api.docPA(phu.current.ma, id); return { ten: r.ten, pa: chuanHoaPA(r.trang_thai as TrangThaiPA) }; },
      mo: (id) => location.assign(`/du-an/${encodeURIComponent(phu.current.ma)}?pa=${encodeURIComponent(id)}`),
    },
    xuat: {
      xls: async () => { const f = phu.current.xuatXls; if (!f) throw new Error(t('leo.loi.chuaXuat')); await f(); },
      moCad: () => { const f = phu.current.moCad; if (!f) return false; f(); return true; },
    },
    xacNhan: (c) => xacNhan.current(c),
    dom: { chup: (v) => chupUi(v), bam: (id) => bamUi(id, (c) => xacNhan.current(c)), datGiaTri: (id, v) => datUi(id, v) },
    vuaKhung: () => {
      const b = [...document.querySelectorAll<HTMLButtonElement>('.panel-giua button')].find((x) => x.getAttribute('aria-label') === t('bt.vuaKhung'));
      if (!b) return false;
      b.click();
      return true;
    },
  };
}
