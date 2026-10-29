/**
 * Đo thời gian gợi ý xếp tòa lô CT-2 (M7 Đan Phượng, dữ liệu thật trên OneDrive) — trọng số view 0 / 20 %. Chỉ chạy khi
 * UNITMIX_DO_VIEW=1 (không nằm trong cổng kiểm); UNITMIX_DO_VIEW_LAN = danh sách trọng số, mặc định "0,20,0,20".
 */
import { existsSync, readFileSync } from 'node:fs';
import { it } from 'vitest';
import * as XLSX from 'xlsx';
import { RANH_HATCH, napDxf, taoLoTuDxf } from '../dxf/napDxf';
import { apChiTieu, chonSheet, ghepLo } from '../nhap/bangChiTieu';
import { sheetTuWorkbook } from '../nhap/docExcel';
import { napThuVien } from '../thu/thuVienThat';
import { taoPAMoi } from './macDinh';
import { traLuat, type BoQuyTac } from './quyTac';
import { dienTich } from './hinhHoc';
import { goiYXepToa } from './xepToa';

const THU_MUC = 'E:/OneDrive/2025-Tan A/6.TADT-Dan Phuong-M7/01_QH/1.WIP/261019,QH moi';
const DXF = `${THU_MUC}/SDD M7 261019.dxf`;
const XLS = `${THU_MUC}/261019-Chi tieu SDĐ NOXH M7.xlsx`;

it.skipIf(!process.env.UNITMIX_DO_VIEW || !existsSync(DXF))('CT-2: thời gian gợi ý có / không view', () => {
  const tho = taoLoTuDxf(napDxf(readFileSync(DXF, 'utf-8')), { ranh: RANH_HATCH });
  const bang = chonSheet(sheetTuWorkbook(XLSX.read(readFileSync(XLS), { type: 'buffer' }), XLSX))!;
  const lo = apChiTieu(tho, bang, ghepLo(bang, tho), 'x.xlsx');
  const L = lo.find((l) => l.temDat.kyHieu === 'CT-2')!;
  const pa = { ...taoPAMoi(), lo };
  const { tv, dl } = napThuVien();
  const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
  const luat = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
  console.log(`CT-2 ${dienTich(L.ranh).toFixed(0)} m², ${L.temDat.chucNang}, lô CX: ${lo.filter((l) => /^CX/.test(l.temDat.kyHieu)).length}`);
  const lan = (process.env.UNITMIX_DO_VIEW_LAN ?? '0,20,0,20').split(',');
  for (const k of lan) {
    const c0 = process.cpuUsage(), t0 = performance.now();
    const ds = goiYXepToa({ pa, lo: L, tv, luat, cuaCan: dl.cuaCan, trongSoView: Number(k) });
    const c = process.cpuUsage(c0);
    console.log(`DO ${k}: ${(performance.now() - t0).toFixed(0)} ms tường, ${((c.user + c.system) / 1000).toFixed(0)} ms CPU · ` +
      ds.map((g) => `${g.khoa} ${g.soCan} căn view ${g.view?.toFixed(1) ?? '—'}`).join(' | '));
  }
});
