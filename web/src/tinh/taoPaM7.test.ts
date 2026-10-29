/**
 * Sinh PA thử cỡ thật (M7 Đan Phượng: lô từ DXF + bảng chỉ tiêu, xếp hàng loạt MT-05 mọi lô ở) → JSON để nạp vào API local làm dự án
 * đo hiệu năng phân tích view. Chỉ chạy khi UNITMIX_TAO_M7=<đường dẫn tệp ra> (không nằm trong cổng kiểm). In thời gian view.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import * as XLSX from 'xlsx';
import { RANH_HATCH, napDxf, taoLoTuDxf } from '../dxf/napDxf';
import { apChiTieu, chonSheet, ghepLo } from '../nhap/bangChiTieu';
import { sheetTuWorkbook } from '../nhap/docExcel';
import { napThuVien } from '../thu/thuVienThat';
import { danhGiaViewPA } from './huongView';
import { taoPAMoi } from './macDinh';
import { traLuat, type BoQuyTac } from './quyTac';
import { paVoiChon, thuTuLo, xepHangLoat } from './xepHangLoat';

const THU_MUC = 'E:/OneDrive/2025-Tan A/6.TADT-Dan Phuong-M7/01_QH/1.WIP/261019,QH moi';
const DXF = `${THU_MUC}/SDD M7 261019.dxf`;
const XLS = `${THU_MUC}/261019-Chi tieu SDĐ NOXH M7.xlsx`;

it.skipIf(!process.env.UNITMIX_TAO_M7 || !existsSync(DXF))('M7: xếp hàng loạt → JSON', () => {
  const tho = taoLoTuDxf(napDxf(readFileSync(DXF, 'utf-8')), { ranh: RANH_HATCH });
  const bang = chonSheet(sheetTuWorkbook(XLSX.read(readFileSync(XLS), { type: 'buffer' }), XLSX))!;
  const lo = apChiTieu(tho, bang, ghepLo(bang, tho), 'x.xlsx');
  const pa0 = { ...taoPAMoi(), lo };
  const { tv, dl } = napThuVien();
  const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
  const luat = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
  const ds = thuTuLo(pa0, lo.map((l) => l.id));
  const t0 = performance.now();
  const kq = xepHangLoat({ pa: pa0, tv, luat, lo: ds, cuaCan: () => dl.cuaCan, soGoiY: 1 });
  let n = 0;
  const pa = paVoiChon(pa0, kq.map((r) => ({ ...r, chon: r.ds.length ? 0 : null })), () => `t${(++n).toString(36)}`);
  console.log(`M7: ${lo.length} lô, xếp ${ds.length} lô → ${pa.toa.length} tòa (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  for (const nt of [0, 40]) {
    const t1 = performance.now();
    const k = danhGiaViewPA(pa, tv, { nhieuTang: nt });
    console.log(`view nhieuTang=${nt}: ${(performance.now() - t1).toFixed(0)} ms · ${k.can.length} mặt căn · ${k.can.reduce((s, d) => s + (d.bang?.tong.length ?? 0), 0)} ô`);
  }
  writeFileSync(process.env.UNITMIX_TAO_M7!, JSON.stringify(pa));
}, 600_000);
