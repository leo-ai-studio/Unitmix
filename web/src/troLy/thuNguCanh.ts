/** Ngữ cảnh công cụ Leo AI cho test (Node): thư viện thật, luật thật, một dự án hai lô, một tòa đã tự chỉnh. */
import { readFileSync } from 'node:fs';
import { taoKhoLoi } from '../kho/khoLoi';
import { napThuVien } from '../thu/thuVienThat';
import { taoToaTrenLo } from '../tinh/hopLo';
import type { ChiTieuQH, Lo, TrangThaiPA } from '../tinh/kieu';
import { tuChinhToa, type ToaMB } from '../tinh/loiThang';
import { taoPAMoi } from '../tinh/macDinh';
import { traLuat, type BoQuyTac } from '../tinh/quyTac';
import type { NguCanh, TrangThaiUi } from './congCu/nguCanh';

export function taoNguCanhThu(tuy: { chiXem?: boolean; xacNhan?: boolean } = {}) {
  const { tv, dl } = napThuVien();
  const bo = JSON.parse(readFileSync(new URL('../../public/lib/quy_tac.json', import.meta.url), 'utf8')) as BoQuyTac;
  const luat = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
  const ct: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
  const lo = (id: string, x0: number, w: number, h: number): Lo => ({
    id, ranh: [[x0, 0], [x0 + w, 0], [x0 + w, h], [x0, h]], chiGioi: null, xungQuanh: [],
    temDat: { kyHieu: id, chucNang: 'tm', chiTieu: ct, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } },
  });
  const mau = [...tv.toa.values()].find((m) => m.nhom === 'tm' && 'mat' in m)!;
  const pa: TrangThaiPA = { ...taoPAMoi(), lo: [lo('A', 0, 120, 100), lo('B', 140, 160, 100)], toa: [tuChinhToa(taoToaTrenLo(mau, lo('A', 0, 120, 100), 't1'), mau as unknown as ToaMB, tv, dl)] };
  const kho = taoKhoLoi(pa, () => {});
  let ui: TrangThaiUi = { buoc: 'tmb', xem: 'mat_bang', loId: 'A', toaId: 't1', canKhoa: null, tangs: null, tangHam: 1 };
  const hoi: string[] = [];
  const ng: NguCanh = {
    kho, chiXem: () => !!tuy.chiXem, tv: () => tv, dl: async () => dl, luat: async () => luat, cuaCan: async () => dl.cuaCan,
    duAn: { ma: 'thu', ten: 'Dự án thử', paId: 'pa-1', tenPA: 'PA 1', dsPA: () => [{ id: 'pa-1', ten: 'PA 1' }], coMaSua: true },
    ui: { lay: () => ui, dat: (p) => { ui = { ...ui, ...p }; } },
    xacNhan: async (c) => { hoi.push(c); return tuy.xacNhan ?? true; },
  };
  return { ng, kho, tv, dl, mau, hoi, layUi: () => ui };
}
