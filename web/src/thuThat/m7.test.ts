/**
 * Thử bằng dữ liệu thật dự án M7 Đan Phượng (bản QH 19/10/2026). Chỉ chạy trên máy có OneDrive dự án;
 * máy khác (CI) tự bỏ qua. Dữ liệu dự án không đưa vào repo.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RANH_HATCH, napDxf, taoLoTuDxf } from '../dxf/napDxf';
import { dienTich } from '../tinh/hinhHoc';
import type { ChucNang, Lo } from '../tinh/kieu';
import { taoPAMoi } from '../tinh/macDinh';
import { sucChua } from '../tinh/sucChua';

const THU_MUC = 'E:/OneDrive/2025-Tan A/6.TADT-Dan Phuong-M7/01_QH/1.WIP/261019,QH moi';
const DXF = `${THU_MUC}/SDD M7 261019.dxf`;
const RA = process.env.UNITMIX_THU_RA; // nơi ghi trạng thái PA để nạp vào app (tuỳ chọn)

/** Chỉ tiêu thật, sheet "@ 261019-Chỉ tiêu M7" của 261019-Chi tieu SDĐ NOXH M7.xlsx (theo nhóm đất). */
const NHOM: Partial<Record<ChucNang, { dtDat: number; matDoDe: number; hssdd: number; tangCao: number; soCan: number; danSo: number; cayXanh: number }>> = {
  xh: { dtDat: 86142.5, matDoDe: 21.6, hssdd: 2.4, tangCao: 12, soCan: 2810, danSo: 5396, cayXanh: 20 },
  tm: { dtDat: 21534.0, matDoDe: 47.5, hssdd: 8.5, tangCao: 28, soCan: 2184, danSo: 3952, cayXanh: 20 },
};

describe.skipIf(!existsSync(DXF))('dữ liệu thật M7 Đan Phượng', () => {
  // Bản vẽ M7 tô lô NOXH bằng lớp "Nhà ở chung cư" (CT-…) và lô thương mại bằng lớp "Đất hỗn hợp" (HH-…).
  // Tên lớp không phân biệt được NOXH với thương mại, nên người dùng sửa chức năng ở mục Tem đất; ở đây làm thay bước đó.
  const lo = taoLoTuDxf(napDxf(readFileSync(DXF, 'utf-8')), { ranh: RANH_HATCH }).map((l) => {
    const cn: ChucNang | null = l.temDat.kyHieu.startsWith('CT-') ? 'xh' : l.temDat.kyHieu.startsWith('HH-') ? 'tm' : null;
    return cn ? { ...l, temDat: { ...l.temDat, chucNang: cn } } : l;
  });
  const dt = (l: Lo) => dienTich(l.ranh);

  it('đọc được các lô và in bảng lô', () => {
    expect(lo.length).toBeGreaterThan(5);
    console.log(lo.map((l) => `LO ${l.temDat.kyHieu} ${l.temDat.chucNang} ${dt(l).toFixed(1)}`).join('\n'));
  });

  it('tổng DT lô đất ở theo nhóm khớp bảng chỉ tiêu (lệch ≤ 1 %)', () => {
    for (const [cn, g] of Object.entries(NHOM)) {
      const tong = lo.filter((l) => l.temDat.chucNang === cn).reduce((a, l) => a + dt(l), 0);
      console.log(`${cn}: DXF ${tong.toFixed(1)} m² / bảng ${g!.dtDat} m² (lệch ${(((tong - g!.dtDat) / g!.dtDat) * 100).toFixed(2)} %)`);
      expect(Math.abs(tong - g!.dtDat) / g!.dtDat).toBeLessThan(0.01);
    }
  });

  it('áp chỉ tiêu thật vào từng lô (dân số chia theo tỷ lệ DT) và xuất PA', () => {
    const pa = taoPAMoi();
    pa.lo = lo.map((l) => {
      const g = NHOM[l.temDat.chucNang];
      if (!g) return l;
      const tyLe = dt(l) / g.dtDat;
      return {
        ...l,
        temDat: {
          ...l.temDat,
          chiTieu: {
            ...l.temDat.chiTieu,
            matDoMax: g.matDoDe,
            hssddMax: g.hssdd,
            tangCaoMax: g.tangCao,
            danSoMax: Math.round(g.danSo * tyLe),
            nguoiMoiCan: Math.round((g.danSo / g.soCan) * 100) / 100,
            cayXanhMin: g.cayXanh,
          },
        },
      };
    });
    const soCanUoc = pa.lo.filter((l) => NHOM[l.temDat.chucNang]).reduce((a, l) => a + (sucChua(l).soCanUoc ?? 0), 0);
    console.log(`Số căn ước theo dân số (cộng các lô ở): ${soCanUoc} / bảng ${NHOM.xh!.soCan + NHOM.tm!.soCan}`);
    expect(Math.abs(soCanUoc - (NHOM.xh!.soCan + NHOM.tm!.soCan))).toBeLessThan(60);
    if (RA) writeFileSync(RA, JSON.stringify(pa));
  });
});
