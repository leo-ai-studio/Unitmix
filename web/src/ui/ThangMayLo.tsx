import { t } from '../i18n/i18n';
import { mauToa } from '../tinh/canThem';
import type { Lo, ThuVien, TrangThaiPA } from '../tinh/kieu';
import type { ToaMB } from '../tinh/loiThang';
import { coMat } from '../tinh/matBang';
import { thangMayToa } from '../tinh/pcccTang';
import { layDuLieuMB, mauCuaToa, useDuLieuMB } from '../man/tuChinhTang';
import { MucGap } from './MucGap';
import { fmtSo } from './so';

/**
 * TMB · panel phải: thang máy từng tòa của lô — có (giếng trong lõi, QT-64) / cần (QCVN 04:2021 2.4.1 · 2.4.2, QT-94 lấy cách cho
 * ít thang hơn), thang máy chữa cháy khi H PCCC > 50 m (QCVN 06 6.13 · QCVN 04 2.4.3). Chỉ cảnh báo.
 */
export function ThangMayLo({ pa, tv, lo, chonToa, toaId }: { pa: TrangThaiPA; tv: ThuVien | null; lo: Lo; chonToa: (id: string) => void; toaId: string | null }) {
  useDuLieuMB(tv, pa);
  const dl = layDuLieuMB();
  if (!tv) return null;
  const ds = pa.toa.filter((x) => x.loId === lo.id && tv.toa.has(x.mauId)).map((x) => {
    const m = mauToa(tv, x);
    const mau = m && coMat(m) ? mauCuaToa(x, m as unknown as ToaMB) : null;
    return { x, ten: m?.ten_vi.split(' · ')[0] ?? '?', k: thangMayToa(pa, tv, x, mau, dl) };
  });
  if (!ds.length) return null;
  const thieu = ds.filter((d) => d.k.muc !== 'ok').length;
  return (
    <MucGap tieuDe={`${t('pc.tmb.tieuDe')}${thieu ? ` · ${t('pc.tmb.thieu').replace('{n}', String(thieu))}` : ''}`} giaiThich={t('pc.tmb.gt')} mo>
      <div class="bang-co-cau pc-tmb" role="table" aria-label={t('pc.tmb.tieuDe')}>
        <div class="dong bang-cc dau" role="row"><span>{t('xep.toa')}</span><span>{t('pc.tmb.co')}</span><span>{t('pc.tmb.can')}</span><span>{t('pc.tmb.canThang')}</span><span>{t('pc.tmb.tmcc')}</span></div>
        {ds.map(({ x, ten, k }) => (
          <button type="button" key={x.id} class={`dong bang-cc${x.id === toaId ? ' chon' : ''}`} role="row" onClick={() => chonToa(x.id)}
            title={t('pc.gt.thangMay').replace('{t}', String(k.theoTang)).replace('{c}', String(k.theoCan)).replace('{d}', k.theoDan === null ? '—' : String(k.theoDan))
              + ` · ${fmtSo(k.soCan)} ${t('sc.can')} · ${fmtSo(k.dan)} ${t('ds.nguoi')}${k.thieuHinh ? ` · ${t('pc.theoTen')}` : ''}`}>
            <span>{ten}</span>
            <b class={k.muc === 'ok' ? 'ok' : 'vuot'}>{fmtSo(k.co)}</b>
            <span>{fmtSo(k.can)}</span>
            <span>{k.canMoiThang === null ? '—' : fmtSo(k.canMoiThang, { thapPhan: 1 })}</span>
            <span title={`H ${fmtSo(k.H, { thapPhan: 1 })} m`}>{k.tmcc ? t('pc.tmb.can1') : '—'}</span>
          </button>
        ))}
      </div>
      <p class="dong muted" style={{ margin: 0 }}>{t('pc.tmb.ghiChu')}</p>
    </MucGap>
  );
}
