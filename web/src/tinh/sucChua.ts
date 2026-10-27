import { dienTich } from './hinhHoc';
import type { Lo } from './kieu';

export type SucChua = {
  dtLo: number | null;
  dtxdMax: number | null;
  dtxdThapMax: number | null;
  dtSanMax: number | null;
  soCanUoc: number | null;
  choDoCan: number | null;
  choXeMayCan: number | null;
  cayXanhCan: number | null;
};

/** "Trần" của lô theo chỉ tiêu QH: DTXD (đế, tháp) và DT sàn tối đa, số căn (theo bảng hoặc ước theo dân số), chỗ đỗ và cây xanh cần. */
export function sucChua(lo: Lo): SucChua {
  const ct = lo.temDat.chiTieu;
  const dtLo = lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0;
  if (dtLo <= 0) return { dtLo: null, dtxdMax: null, dtxdThapMax: null, dtSanMax: null, soCanUoc: null, choDoCan: null, choXeMayCan: null, cayXanhCan: null };
  // Lô không phải đất ở (dịch vụ, cây xanh, giáo dục…) không có căn, nên không ước số căn và chỗ đỗ theo căn.
  const datO = lo.temDat.chucNang !== 'khac';
  // Bảng QH có ghi số căn thì dùng số đó; không thì ước từ dân số.
  const soCanUoc = !datO ? null : ct.soCanMax !== null ? ct.soCanMax : ct.nguoiMoiCan > 0 ? Math.floor(ct.danSoMax / ct.nguoiMoiCan) : null;
  const tron = (v: number) => Math.round(v * 100) / 100;
  return {
    dtLo: tron(dtLo),
    dtxdMax: tron((dtLo * ct.matDoMax) / 100),
    dtxdThapMax: ct.matDoThapMax === null ? null : tron((dtLo * ct.matDoThapMax) / 100),
    dtSanMax: tron(dtLo * ct.hssddMax),
    soCanUoc,
    choDoCan: soCanUoc === null ? null : Math.ceil(soCanUoc * ct.choDoOtoMoiCan),
    choXeMayCan: soCanUoc === null ? null : Math.ceil(soCanUoc * ct.choXeMayMoiCan),
    cayXanhCan: tron((dtLo * ct.cayXanhMin) / 100),
  };
}
