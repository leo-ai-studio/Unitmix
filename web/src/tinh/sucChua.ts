import { dienTich } from './hinhHoc';
import type { Lo } from './kieu';

export type SucChua = {
  dtLo: number | null;
  dtxdMax: number | null;
  dtSanMax: number | null;
  soCanUoc: number | null;
  choDoCan: number | null;
  choXeMayCan: number | null;
  cayXanhCan: number | null;
};

/** "Trần" của lô theo chỉ tiêu QH: DTXD và DT sàn tối đa, số căn ước theo dân số, chỗ đỗ và cây xanh cần. */
export function sucChua(lo: Lo): SucChua {
  const ct = lo.temDat.chiTieu;
  const dtLo = lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0;
  if (dtLo <= 0) return { dtLo: null, dtxdMax: null, dtSanMax: null, soCanUoc: null, choDoCan: null, choXeMayCan: null, cayXanhCan: null };
  // Lô không phải đất ở (dịch vụ, cây xanh, giáo dục…) không có căn, nên không ước số căn và chỗ đỗ theo căn.
  const datO = lo.temDat.chucNang !== 'khac';
  const soCanUoc = datO && ct.nguoiMoiCan > 0 ? Math.floor(ct.danSoMax / ct.nguoiMoiCan) : null;
  const tron = (v: number) => Math.round(v * 100) / 100;
  return {
    dtLo: tron(dtLo),
    dtxdMax: tron((dtLo * ct.matDoMax) / 100),
    dtSanMax: tron(dtLo * ct.hssddMax),
    soCanUoc,
    choDoCan: soCanUoc === null ? null : Math.ceil(soCanUoc * ct.choDoOtoMoiCan),
    choXeMayCan: soCanUoc === null ? null : Math.ceil(soCanUoc * ct.choXeMayMoiCan),
    cayXanhCan: tron((dtLo * ct.cayXanhMin) / 100),
  };
}
