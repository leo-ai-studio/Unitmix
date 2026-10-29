import { t } from '../i18n/i18n';
import { lamTronKhai, quyTacApDung } from '../tinh/danSo';
import type { GiaiDoan, KhaiDanSo as Khai, KhuVuc, LoaiHinh, Lo, TrangThaiPA } from '../tinh/kieu';
import { laCaoTang } from '../tinh/loaiDat';
import { dsTinhChon, LOAI_HINH } from '../tinh/quyTacDanSo';
import { fmtSo } from './so';

/** Tỉnh trọng điểm (HN, TP.HCM, An Giang, Hưng Yên) đứng đầu danh sách. */
const dsTinh = dsTinhChon();

type Props = { lo: Lo; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean };

const doiKhai = (p: TrangThaiPA, id: string, k: Khai | undefined): TrangThaiPA => ({
  ...p,
  lo: p.lo.map((l) => {
    if (l.id !== id) return l;
    const { danSo: _bo, ...td } = l.temDat;
    return { ...l, temDat: k ? { ...td, danSo: k } : td };
  }),
});

/**
 * Khai tỉnh / thành, loại hình, giai đoạn (và khu vực đô thị / nông thôn khi QĐ phân biệt) để tính dân số từng căn theo QĐ tỉnh.
 * Chưa khai = hệ số chung.
 */
export function KhaiDanSo({ lo, sua, chiXem }: Props) {
  const k = lo.temDat.danSo;
  const qt = quyTacApDung(lo);
  const lt = lamTronKhai(lo);
  const dat = (v: Khai | undefined) => sua((p) => doiKhai(p, lo.id, v));
  const apMoiLo = () => sua((p) => ({ ...p, lo: p.lo.map((l) => (laCaoTang(l) && k ? { ...l, temDat: { ...l.temDat, danSo: { ...k } } } : l)) }));
  return (
    <div class="khai-dan-so" role="group" aria-label={t('ds.khai.tieuDe')}>
      <label class="o-chon" title={t('gt.ds.khai.tinh')}><span>{t('ds.khai.tinh')}</span>
        <select value={k?.tinh ?? ''} disabled={chiXem}
          onChange={(e) => { const v = e.currentTarget.value; dat(v ? { giaiDoan: 'cp', ...k, tinh: v } : undefined); }}>
          <option value="">{t('ds.khai.chuaKhai')}</option>
          <optgroup label={t('ds.khai.nhomTrongDiem')}>
            {dsTinh.trongDiem.map((q) => <option value={q.id} key={q.id}>{t(`ds.tinh.${q.id}`)}</option>)}
          </optgroup>
          <optgroup label={t('ds.khai.nhomKhac')}>
            {dsTinh.khac.map((q) => <option value={q.id} key={q.id}>{t(`ds.tinh.${q.id}`)}</option>)}
          </optgroup>
        </select>
      </label>
      {k && (
        <>
          <label class="o-chon" title={t('gt.ds.khai.loaiHinh')}><span>{t('ds.khai.loaiHinh')}</span>
            <select value={k.loaiHinh ?? ''} disabled={chiXem}
              onChange={(e) => { const v = e.currentTarget.value as LoaiHinh | ''; const { loaiHinh: _b, ...r } = k; dat(v ? { ...r, loaiHinh: v } : r); }}>
              <option value="">{t('ds.khai.theoLo')}</option>
              {LOAI_HINH.map((lh) => <option value={lh} key={lh}>{t(`ds.lh.${lh}`)}</option>)}
            </select>
          </label>
          <label class="o-chon" title={t('gt.ds.khai.giaiDoan')}><span>{t('ds.khai.giaiDoan')}</span>
            <select value={k.giaiDoan} disabled={chiXem} onChange={(e) => dat({ ...k, giaiDoan: e.currentTarget.value as GiaiDoan })}>
              <option value="qh">{t('ds.gd.qh')}</option>
              <option value="cp">{t('ds.gd.cp')}</option>
            </select>
          </label>
          {qt?.khuVuc.phanBiet && (
            <label class="o-chon" title={t('gt.ds.khai.khuVuc')}><span>{t('ds.khai.khuVuc')}</span>
              <select value={qt.khuVuc.ap} disabled={chiXem} onChange={(e) => dat({ ...k, khuVuc: e.currentTarget.value as KhuVuc })}>
                <option value="doThi">{t('ds.kv.doThi')}</option>
                <option value="nongThon">{t('ds.kv.nongThon')}</option>
              </select>
            </label>
          )}
          {qt?.bq && (
            <label class="o-chon" title={qt.bq.dieu}><span>{t('ds.khai.cach')}</span>
              <select value={k.cach ?? 'bang'} disabled={chiXem} onChange={(e) => dat({ ...k, cach: e.currentTarget.value as 'bang' | 'bq' })}>
                <option value="bang">{t('ds.cach.bang')}</option>
                <option value="bq">{t('ds.cach.bq').replace('{n}', fmtSo(qt.bq.so, { thapPhan: 1 }))}</option>
              </select>
            </label>
          )}
          <div class="ds-lam-tron">
            <label class="o-tg" title={t('gt.ds.khai.lamTron')}>
              <input type="checkbox" disabled={chiXem} checked={lt.bat} onChange={(e) => dat({ ...k, lamTron: { ...lt, bat: e.currentTarget.checked } })} />
              <span>{t('ds.khai.lamTron')}</span>
            </label>
            <label class="o-so" title={t('gt.ds.khai.dungSai')}>
              <span>{t('ds.khai.dungSai')}</span>
              <span class="o-so-nhap">
                <input type="number" min="0" max="5" step="0.1" value={lt.dungSai} disabled={chiXem}
                  onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v) && v >= 0 && v <= 5) dat({ ...k, lamTron: { ...lt, dungSai: Math.round(v * 100) / 100 } }); }} />
                <small>m²</small>
              </span>
            </label>
          </div>
          <p class="dong muted ds-khai-ghi" title={qt?.ap?.ghiChu ?? ''}>
            {qt?.ap?.qd ?? t('ds.fallback')}
            {qt?.ap?.kieu && ` · ${t('ds.kieu').replace('{k}', qt.ap.kieu)}`}
            {qt?.khai?.theo && ` · ${t('ds.theoTinh').replace('{t}', t(`ds.tinh.${qt.khai.theo}`))}`}
            {qt?.ap && !qt.ap.daDoiChieu && qt.ap.qd && ` · ${t('ds.chuaDoiChieu')}`}
            {qt?.tam && <b class="canh-bao"> · {t('ds.tam')}</b>}
          </p>
          {!chiXem && <button type="button" class="nut-phu" title={t('gt.ds.khai.apMoiLo')} onClick={apMoiLo}>{t('ds.khai.apMoiLo')}</button>}
        </>
      )}
    </div>
  );
}
