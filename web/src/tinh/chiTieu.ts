import { canThucTe, congCoCau, demCan, phanTram } from './coCau';
import { chanToa, dienTich, dtVung, hopDienTich, khoiDe } from './hinhHoc';
import type { LoaiCan, ThuVien, TrangThaiPA } from './kieu';

export type MucDo = 'ok' | 'canh_bao' | 'vuot';
export type DongChiTieu = {
  khoa: 'matDo' | 'matDoThap' | 'dtSan' | 'tangCao' | 'tangDe' | 'tangCanHo' | 'soCan' | 'danSo' | 'choDo' | 'cayXanh';
  dat: number | null;
  mucTieu: number | null;
  chieu: '<=' | '>=';
  chenh: number | null;
  muc: MucDo;
};
export type KetQuaLo = {
  dtLo: number;
  dtDe: number;
  dtSanTinhHSSDD: number;
  soCan: number;
  coCau: Record<LoaiCan, number>;
  coCauPct: Record<LoaiCan, number>;
  dong: DongChiTieu[];
};
export type KetQuaChiTieu = {
  theoLo: Record<string, KetQuaLo>;
  tong: { soCan: number; danSo: number; dtSanTinhHSSDD: number; coCau: Record<LoaiCan, number>; coCauPct: Record<LoaiCan, number> };
};

const SAT_NGUONG = 0.03; // trong 3 % so với giới hạn thì cảnh báo

function dong(khoa: DongChiTieu['khoa'], dat: number | null, mucTieu: number | null, chieu: '<=' | '>='): DongChiTieu {
  if (dat === null || mucTieu === null || !Number.isFinite(dat)) return { khoa, dat, mucTieu, chieu, chenh: null, muc: 'ok' };
  const chenh = dat - mucTieu;
  const vuot = chieu === '<=' ? chenh > 1e-9 : chenh < -1e-9;
  const sat = Math.abs(chenh) <= Math.abs(mucTieu) * SAT_NGUONG;
  return { khoa, dat, mucTieu, chieu, chenh, muc: vuot ? 'vuot' : sat ? 'canh_bao' : 'ok' };
}

/** Chỉ tiêu từng lô và tổng dự án. Hàm thuần: không đọc gì ngoài PA và thư viện. */
export function tinhChiTieu(pa: TrangThaiPA, tv: ThuVien): KetQuaChiTieu {
  const dem = demCan(pa, tv);
  const theoLo: Record<string, KetQuaLo> = {};
  let dtSanTong = 0;
  for (const lo of pa.lo) {
    const ct = lo.temDat.chiTieu;
    const dtLo = lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0;
    const toaLo = pa.toa.filter((t) => t.loId === lo.id && tv.toa.has(t.mauId));
    const chan = toaLo.map((t) => chanToa(tv.toa.get(t.mauId)!, t));
    const de = khoiDe(chan, toaLo.map((t) => t.deOffset));
    const dtDe = dtVung(de);

    let dtSan = 0;
    for (let i = 0; i < toaLo.length; i++) {
      const t = toaLo[i], mau = tv.toa.get(t.mauId)!;
      const dtCanTang = Object.entries(mau.co_cau).reduce((a, [g, n]) => a + n * (tv.can.get(canThucTe(g, t.canTheo))?.dt_tim_m2 ?? 0), 0);
      const dtChanThap = dienTich(chan[i]);
      dtSan += t.soTangDH * (pa.heSo.can * dtCanTang + pa.heSo.chung * Math.max(0, dtChanThap - dtCanTang));
    }
    // Sàn đế: mỗi tòa góp số tầng đế của nó trên phần đế mang tên nó (chia đều phần đế theo tỷ lệ chân tháp).
    const tongChan = chan.reduce((a, p) => a + dienTich(p), 0);
    for (let i = 0; i < toaLo.length; i++) {
      const tyLe = tongChan > 0 ? dienTich(chan[i]) / tongChan : 0;
      dtSan += pa.heSo.thuongMai * toaLo[i].soTangDe * dtDe * tyLe;
    }
    dtSanTong += dtSan;

    const coCau = congCoCau(toaLo.map((t) => dem[t.id]));
    const soCan = Object.values(coCau).reduce((a, b) => a + b, 0);
    const coToa = toaLo.length > 0;
    const coDat = dtLo > 0;
    const tangCao = coToa ? Math.max(...toaLo.map((t) => t.soTangDe + t.soTangDH + (t.coApMai ? 1 : 0))) : null;
    const maxTang = (f: (t: (typeof toaLo)[number]) => number) => (coToa ? Math.max(...toaLo.map(f)) : null);
    theoLo[lo.id] = {
      dtLo, dtDe, dtSanTinhHSSDD: dtSan, soCan, coCau, coCauPct: phanTram(coCau),
      dong: [
        dong('matDo', coDat && coToa ? (dtDe / dtLo) * 100 : null, ct.matDoMax, '<='),
        ...(ct.matDoThapMax !== null ? [dong('matDoThap', coDat && coToa ? (hopDienTich(chan) / dtLo) * 100 : null, ct.matDoThapMax, '<=')] : []),
        dong('dtSan', coToa ? dtSan : null, coDat ? ct.hssddMax * dtLo : null, '<='),
        dong('tangCao', tangCao, ct.tangCaoMax, '<='),
        ...(ct.tangDe !== null ? [dong('tangDe', maxTang((t) => t.soTangDe), ct.tangDe, '<=')] : []),
        ...(ct.tangCanHo !== null ? [dong('tangCanHo', maxTang((t) => t.soTangDH), ct.tangCanHo, '<=')] : []),
        ...(ct.soCanMax !== null ? [dong('soCan', coToa ? soCan : null, ct.soCanMax, '<=')] : []),
        dong('danSo', coToa ? soCan * ct.nguoiMoiCan : null, ct.danSoMax, '<='),
        dong('choDo', null, coToa ? Math.ceil(soCan * ct.choDoOtoMoiCan) : null, '>='),
        dong('cayXanh', null, coDat ? (dtLo * ct.cayXanhMin) / 100 : null, '>='),
      ],
    };
  }
  const coCau = congCoCau(Object.values(theoLo).map((k) => k.coCau));
  const soCan = Object.values(coCau).reduce((a, b) => a + b, 0);
  const danSo = pa.lo.reduce((a, lo) => a + (theoLo[lo.id]?.soCan ?? 0) * lo.temDat.chiTieu.nguoiMoiCan, 0);
  return { theoLo, tong: { soCan, danSo, dtSanTinhHSSDD: dtSanTong, coCau, coCauPct: phanTram(coCau) } };
}
