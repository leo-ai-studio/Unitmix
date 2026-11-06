/**
 * Xếp hàng loạt nhiều lô ở màn Tổng mặt bằng (app cũ "▦ Xếp hàng loạt" `tm_hl`): hộp lớp phủ trong `.noi-tren` (khung giữa không
 * đổi) — tick lô, chạy gợi ý MT-05 lần lượt từng lô (lô lớn trước, lô sau giữ §2.6.1 tới tòa lô trước), thanh tiến độ + Dừng, bảng
 * kết quả từng lô (chọn phương án nào áp phương án đó), "Áp dụng cả lượt" = một `sua` (một bước hoàn tác). Lớp xem trước nét đứt
 * trên bản vẽ. Trạng thái cấp module (không lưu vào PA), như GoiYXepToa.
 */
import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { chanToa } from '../tinh/hinhHoc';
import type { Lo, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { laCaoTang } from '../tinh/loaiDat';
import { taiQuyTac, traLuat } from '../tinh/quyTac';
import { apHangLoat, loXepDuoc, thuTuLo, xepHangLoatNen, xungDotCheo, type KetQuaLo } from '../tinh/xepHangLoat';
import type { LuatXep } from '../tinh/xepToa';
import { sPoly } from '../ve/BanVe';
import { taiCuaCan } from '../ve/hinhHocThuVien';
import { fmtSo } from '../ui/so';
import { BangPhuongAn } from '../ui/BangPhuongAn';
import { HinhGoiY } from '../ui/GoiYXepToa';
import { DS_LOAI_NHA, loaiNhaCuaLo, type LoaiNhaO } from '../tinh/loaiNha';
import { useCheDoXep } from '../ui/GoiYXepToa';
import { viTriPA } from '../tinh/viTri';
import { huongGioDuAn } from '../nangGio/taiGio';
import type { CheDoBoCuc, UuTienXep } from '../tinh/xepToa';

type TrangThai = {
  mo: boolean;
  chonLo: string[] | null; // null = mặc định mọi lô xếp được
  thuTu: string[]; // id lô theo thứ tự chạy
  kq: KetQuaLo[];
  chay: boolean;
  tienDo: number;
  dangLo: string | null;
  dung: boolean;
  ms: number | null;
  loi: string | null;
  khoa: string | null; // chữ ký đầu vào lúc chạy
  daAp: string | null;
  moBang: boolean;
};
let tt: TrangThai = { mo: false, chonLo: null, thuTu: [], kq: [], chay: false, tienDo: 0, dangLo: null, dung: false, ms: null, loi: null, khoa: null, daAp: null, moBang: false };
const nghe = new Set<() => void>();
const dat = (p: Partial<TrangThai>) => { tt = { ...tt, ...p }; nghe.forEach((f) => f()); };
export function useHangLoat(): TrangThai {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tt;
}
export const batTatHangLoat = () => dat({ mo: !tt.mo });

/** Chữ ký đầu vào: ranh, lộ giới cạnh, chỉ tiêu các lô, tòa ngoài lượt — đổi thì kết quả cũ hết hiệu lực. */
const khoaVao = (pa: TrangThaiPA, ids: string[]) =>
  JSON.stringify([pa.lo.map((l) => [l.id, l.ranh, l.chiGioi, l.canhDuong ?? null, l.temDat.chucNang, l.temDat.chiTieu, l.temDat.coCauMucTieu]), pa.toa.filter((x) => !ids.includes(x.loId)).map((x) => [x.mauId, x.x, x.y, x.gocDo, x.soTangDH])]);

let lanChay = 0;
let huy = false;
async function chay(pa: TrangThaiPA, tv: ThuVien, ids: string[], cheDo: CheDoBoCuc, uuTien: UuTienXep, tuViTri = 0) {
  const lan = ++lanChay;
  huy = false;
  const thuTu = tuViTri > 0 ? tt.thuTu.map((id) => pa.lo.find((l) => l.id === id)!).filter(Boolean) : thuTuLo(pa, ids);
  const truoc = tuViTri > 0 ? tt.kq.slice(0, tuViTri) : [];
  dat({ chay: true, tienDo: 0, dangLo: null, dung: false, loi: null, daAp: null, thuTu: thuTu.map((l) => l.id), kq: truoc, khoa: khoaVao(pa, thuTu.map((l) => l.id)) });
  try {
    const [bo, cuaTm, cuaXh, gio] = await Promise.all([taiQuyTac(), taiCuaCan(tv, 'tm'), taiCuaCan(tv, 'xh'), huongGioDuAn(viTriPA(pa))]);
    const lo01 = traLuat(bo, 'LO-01'), lo02 = traLuat(bo, 'LO-02');
    if (!lo01 || !lo02) throw new Error('LO-01 / LO-02');
    const t0 = performance.now();
    const r = await xepHangLoatNen(
      { pa, tv, luat: { lo01, lo02 }, lo: thuTu, truoc, cuaCan: (lo: Lo) => (lo.temDat.chucNang === 'xh' ? cuaXh : cuaTm), cheDo, uuTien, huongGio: gio?.ds },
      (x) => lan === lanChay && dat({ tienDo: (x.lo + x.phan) / x.tongLo, dangLo: x.loId }),
      () => huy || lan !== lanChay,
    );
    if (lan === lanChay) dat({ kq: r.kq, chay: false, dung: r.dung, tienDo: r.dung ? tt.tienDo : 1, dangLo: null, ms: performance.now() - t0 });
  } catch (e) {
    if (lan === lanChay) dat({ chay: false, loi: String((e as Error).message ?? e) });
  }
}

const idMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const tenMau = (tv: ThuVien, id: string) => tv.toa.get(id)?.ten_vi.split(' · ')[0] ?? id;

/** Hộp Xếp hàng loạt (lớp phủ). */
export function HopHangLoat({ pa, tv, sua, chiXem, luat }: { pa: TrangThaiPA; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; luat: LuatXep | null }) {
  const s = useHangLoat();
  const [cheDo, uuTien] = useCheDoXep();
  if (!s.mo) return null;
  const dsLo = pa.lo.filter(laCaoTang);
  const chon = s.chonLo ?? dsLo.filter(loXepDuoc).map((l) => l.id);
  const doiChon = (id: string) => dat({ chonLo: chon.includes(id) ? chon.filter((x) => x !== id) : [...chon, id] });
  const duoc = dsLo.filter(loXepDuoc), loTheoLoai = (l: LoaiNhaO) => duoc.filter((x) => loaiNhaCuaLo(x) === l).map((x) => x.id);
  const loaiCo = DS_LOAI_NHA.filter((l) => loTheoLoai(l).length);
  const duChon = (ids: string[]) => ids.length > 0 && ids.every((id) => chon.includes(id));
  const doiNhom = (ids: string[]) => dat({ chonLo: duChon(ids) ? chon.filter((x) => !ids.includes(x)) : [...new Set([...chon, ...ids])] });
  const cu = s.khoa !== null && !s.chay && s.kq.length > 0 && s.khoa !== khoaVao(pa, s.thuTu);
  const xd = tv && luat && s.kq.length && !s.chay ? xungDotCheo(pa, s.kq, tv, luat) : new Map<string, { loi: number; canh: number }>();
  const kyHieu = (id: string) => pa.lo.find((l) => l.id === id)?.temDat.kyHieu ?? id;
  const coAp = s.kq.some((r) => r.chon !== null);
  const tong = s.kq.reduce((a, r) => { const g = r.chon === null ? null : r.ds[r.chon]; return g ? { toa: a.toa + g.toa.length, can: a.can + g.soCan } : a; }, { toa: 0, can: 0 });
  const apDung = () => {
    if (chiXem || !coAp) return;
    sua((p) => apHangLoat(p, s.kq, idMoi));
    dat({ daAp: t('hl.daAp').replace('{t}', fmtSo(tong.toa)).replace('{c}', fmtSo(tong.can)) });
  };
  const chonPA = (i: number, v: string) => {
    const kq = s.kq.map((r, k) => (k === i ? { ...r, chon: v === '' ? null : Number(v) } : r));
    dat({ kq, daAp: null });
  };
  return (
    <div class="tmb-hang-loat" role="dialog" aria-label={t('hl.tieuDe')}>
      <div class="hl-dau">
        <b title={t('gt.hl.tieuDe')}>{t('hl.tieuDe')}</b>
        <button type="button" class="hl-dong" title={t('hl.dong')} aria-label={t('hl.dong')} onClick={() => { huy = true; dat({ mo: false }); }}>✕</button>
      </div>
      <p class="muted hl-ghi">{t('gt.hl.tieuDe')}</p>
      <div class="goi-y-kieu" role="group" aria-label={t('hl.chonNhanh')}>
        <button type="button" aria-pressed={duChon(duoc.map((l) => l.id))} disabled={s.chay} onClick={() => doiNhom(duoc.map((l) => l.id))}>{t('hl.tatCa')} · {duoc.length}</button>
        {loaiCo.map((l) => <button type="button" key={l} aria-pressed={duChon(loTheoLoai(l))} disabled={s.chay} onClick={() => doiNhom(loTheoLoai(l))}>{t(`cn.${l}`)} · {loTheoLoai(l).length}</button>)}
      </div>
      <div class="hl-lo" role="group" aria-label={t('hl.chonLo')}>
        {dsLo.map((l) => {
          const duoc = loXepDuoc(l);
          return (
            <label key={l.id} title={duoc ? t('hl.loTip') : t('xep.goiYCanChiTieu')} class={duoc ? '' : 'muted'}>
              <input type="checkbox" aria-label={l.temDat.kyHieu} checked={duoc && chon.includes(l.id)} disabled={!duoc || s.chay} onChange={() => doiChon(l.id)} />
              {l.temDat.kyHieu}
            </label>
          );
        })}
      </div>
      <div class="hl-nut">
        {!s.chay
          ? <button type="button" class="nut-chinh" disabled={!tv || !chon.length} title={t('gt.hl.chay')} onClick={() => tv && void chay(pa, tv, chon, cheDo, uuTien)}>{t('hl.chay')}</button>
          : <button type="button" class="nut-phu" title={t('gt.hl.dung')} onClick={() => { huy = true; }}>{t('hl.dung')}</button>}
        {s.kq.length > 0 && !s.chay && <button type="button" class="nut-chinh" disabled={chiXem || !coAp || cu} title={t('gt.hl.apDung')} onClick={apDung}>{t('hl.apDung')}</button>}
        {s.kq.some((r) => r.ds.length) && !s.chay && <button type="button" class="nut-phu" title={t('gt.xep.bangPa')} onClick={() => dat({ moBang: true })}>{t('xep.bangPa')}</button>}
      </div>
      {(s.chay || s.tienDo > 0) && (
        <div class="hl-tien-do" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.tienDo * 100)}>
          <i style={{ width: `${Math.round(s.tienDo * 100)}%` }} />
        </div>
      )}
      {s.chay && <p class="muted hl-ghi"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{t('hl.dangChay').replace('{lo}', s.dangLo ? kyHieu(s.dangLo) : '…').replace('{i}', String(s.dangLo ? s.thuTu.indexOf(s.dangLo) + 1 : 1)).replace('{n}', String(s.thuTu.length)).replace('{p}', fmtSo(s.tienDo * 100, { donVi: '%' }))}</p>}
      {!s.chay && s.ms !== null && (s.kq.length > 0 || s.dung) && <p class="muted hl-ghi">{t('hl.xong').replace('{n}', String(s.kq.length)).replace('{s}', fmtSo(s.ms / 1000, { thapPhan: 1 }))}{s.dung ? ` · ${t('hl.daDung')}` : ''}</p>}
      {s.loi && <p class="vuot hl-ghi">{s.loi}</p>}
      {cu && <p class="canh-bao hl-ghi">{t('hl.cu')}</p>}
      {s.kq.length > 0 && tv && (
        <table class="hl-bang">
          <thead><tr><th>{t('hl.lo')}</th><th>{t('hl.phuongAn')}</th><th title={t('gt.xep.goiYCan')}>{t('hl.can')}</th><th title={t('xep.matDo')}>{t('xep.goiYMatDo')}</th><th title={t('gt.hl.xungDot')}>§2.6.1</th></tr></thead>
          <tbody>
            {s.kq.map((r, i) => {
              const g = r.chon === null ? null : r.ds[r.chon];
              const x = xd.get(r.loId);
              return (
                <Fragment key={r.loId}>
                <tr>
                  <td><b>{kyHieu(r.loId)}</b></td>
                  <td>
                    <select value={r.chon === null ? '' : String(r.chon)} disabled={s.chay} aria-label={t('hl.phuongAn')} title={t('gt.hl.phuongAn')} onChange={(e) => chonPA(i, e.currentTarget.value)}>
                      {r.ds.map((p, k) => <option key={p.khoa} value={String(k)}>{`${k + 1}. ${p.mau.map(([m, n]) => `${n} × ${tenMau(tv, m)}`).join(' + ')} · ${1 + p.soTangDH} T`}</option>)}
                      <option value="">{r.ds.length ? t('hl.giuNguyen') : t('hl.khongCo')}</option>
                    </select>
                  </td>
                  <td>{g ? fmtSo(g.soCan) : '—'}</td>
                  <td>{g ? fmtSo(g.matDo, { thapPhan: 1, donVi: '%' }) : '—'}</td>
                  <td class={x?.loi ? 'vuot' : x?.canh ? 'canh-bao' : 'ok'}>
                    {x ? `${x.loi + x.canh}` : '✓'}
                    {x && (
                      <button type="button" class="hl-lai" title={t('gt.hl.chayLai')} aria-label={t('hl.chayLai')} disabled={s.chay || !tv}
                        onClick={() => tv && void chay(pa, tv, chon, cheDo, uuTien, i)}>↻</button>
                    )}
                  </td>
                </tr>
                {r.ds.length > 0 && (
                  <tr class="hl-hinh"><td colSpan={5}>
                    {r.ds.map((p, k) => {
                      const loR = pa.lo.find((l) => l.id === r.loId);
                      return loR && <button type="button" key={p.khoa} aria-pressed={r.chon === k} title={`${k + 1}. ${t(`xep.kieu.${p.kieu}`)}`} aria-label={`${kyHieu(r.loId)} ${k + 1}`} disabled={s.chay} onClick={() => chonPA(i, String(k))}><HinhGoiY lo={loR} g={p} tv={tv} /></button>;
                    })}
                  </td></tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot><tr><td>{t('xep.tong')}</td><td>{t('hl.tongToa').replace('{n}', fmtSo(tong.toa))}</td><td>{fmtSo(tong.can)}</td><td /><td /></tr></tfoot>
        </table>
      )}
      {s.daAp && <p class="ok hl-ghi">{s.daAp}</p>}
      {s.moBang && tv && (
        <BangPhuongAn tieuDe={t('hl.bangTieuDe')} tv={tv} chiXem={chiXem} dong={() => dat({ moBang: false })}
          nhom={s.kq.flatMap((r, i) => { const loR = pa.lo.find((l) => l.id === r.loId); return loR && r.ds.length ? [{ khoa: r.loId, tieuDe: loR.temDat.kyHieu, lo: loR, ds: r.ds, chon: r.chon, onChon: (k: number) => chonPA(i, String(k)), nhanChon: t('hl.chonPa') }] : []; })} />
      )}
    </div>
  );
}

/** Lớp xem trước trên bản vẽ: tòa của phương án đang chọn mọi lô trong lượt, nét đứt (chưa áp). */
export function LopHangLoat({ tv }: { tv: ThuVien | null }) {
  const s = useHangLoat();
  if (!s.mo || !tv || !s.kq.length || s.daAp) return null;
  return (
    <g class="lop-hang-loat" pointer-events="none">
      {s.kq.flatMap((r) => {
        const g = r.chon === null ? null : r.ds[r.chon];
        return g ? g.toa.map((x, i) => {
          const m = tv.toa.get(x.mauId);
          return m ? <polygon key={`${r.loId}-${i}`} points={sPoly(chanToa(m, x))} fill="var(--green)" fill-opacity="0.12" stroke="var(--green)" stroke-width="2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke" /> : null;
        }) : [];
      })}
    </g>
  );
}
