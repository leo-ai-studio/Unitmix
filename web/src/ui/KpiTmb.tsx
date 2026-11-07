import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { KetQuaChiTieu } from '../tinh/chiTieu';
import type { Lo, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { kpiTmb, loDuAn } from '../tinh/kpi';
import { MucGap } from './MucGap';
import { fmtSo } from './so';
import { LuoiSo, TheSo, pct1, useHieuSuatMin } from './TheSo';
import { nhanToa } from './nhanToa';

/**
 * Bảng KPI Tổng mặt bằng (panel phải, trên cùng): 6 ô số lớn — dân số · số căn · tổng DT sàn XD · tổng DT sàn sử dụng · DTXD một sàn ·
 * hiệu suất; theo lô đang chọn hoặc cả dự án (công tắc). Chi tiết theo tòa trong mục gập (mặc định đóng). Tính: `tinh/kpi.ts`.
 */
export function KpiTmb({ pa, tv, lo, kq }: { pa: TrangThaiPA; tv: ThuVien | null; lo: Lo; kq: KetQuaChiTieu | null }) {
  const [caDuAn, setCaDuAn] = useState(false);
  const hsMin = useHieuSuatMin();
  const dsLo = useMemo(() => loDuAn(pa), [pa.lo]);
  const k = useMemo(() => (tv && kq ? kpiTmb(pa, tv, kq, caDuAn ? dsLo : [lo.id], hsMin) : null), [pa, tv, kq, caDuAn, dsLo, lo.id, hsMin]);
  if (!k) return null;
  const tenToa = (id: string) => nhanToa(pa, tv, id, { lo: caDuAn });
  const soToa = k.toa.length;
  return (
    <section class="kpi kpi-tmb" aria-label={t('kpi.tmb.tieuDe')}>
      <div class="kpi-dau">
        <h3>{t('kpi.tmb.tieuDe')}</h3>
        <div class="kpi-pham-vi" role="radiogroup" aria-label={t('kpi.phamVi')}>
          <button type="button" role="radio" aria-checked={!caDuAn} class={!caDuAn ? 'chon' : ''} onClick={() => setCaDuAn(false)}>{t('kpi.lo')} {lo.temDat.kyHieu}</button>
          <button type="button" role="radio" aria-checked={caDuAn} class={caDuAn ? 'chon' : ''} onClick={() => setCaDuAn(true)}
            title={t('kpi.duAnGt').replace('{n}', String(dsLo.length))}>{t('kpi.duAn')} · {dsLo.length}</button>
        </div>
      </div>
      <LuoiSo cot3>
        <TheSo id="kpi-dan-so" nhan={t('kpi.danSo')} gt={k.danSo.gt} o={k.danSo} tip={t('kpi.gt.danSo')}
          phu={k.danSo.nguong ? <>≤ {fmtSo(k.danSo.nguong)}</> : null} />
        <TheSo id="kpi-so-can" nhan={t('kpi.n.soCan')} gt={k.soCan.gt} o={k.soCan} tip={t('kpi.gt.soCan')}
          phu={k.soCan.nguong ? <>≤ {fmtSo(k.soCan.nguong)}</> : null} />
        <TheSo id="kpi-dt-san" nhan={t('kpi.n.gfa')} gt={k.dtSan.gt} o={k.dtSan} tip={t('kpi.gt.dtSan')}
          phu={k.dtSan.nguong ? <>≤ {fmtSo(k.dtSan.nguong)}</> : null} />
        <TheSo id="kpi-dtsd" nhan={t('kpi.n.dtsd')} gt={k.toa.length ? k.dtsd : null} tip={t('kpi.gt.dtsd')} />
        <TheSo id="kpi-dtxd" nhan={t('kpi.n.dtxd')} gt={k.toa.length ? k.dtxd1San : null} o={k.matDo} tip={t('kpi.gt.dtxd1San')}
          phu={k.matDo.nguong !== null ? <>{t('kpi.mdxd')} ≤{fmtSo(k.matDo.nguong, { thapPhan: 0 })}%</> : null} />
        <TheSo id="kpi-hieu-suat" nhan={t('kpi.hieuSuat')} gt={k.hieuSuat.gt === null ? null : k.hieuSuat.gt * 100} thapPhan={1} donVi="%"
          tip={t('kpi.gt.hieuSuat').replace('{n}', fmtSo(hsMin * 100))} />
      </LuoiSo>
      <MucGap tieuDe={t('kpi.chiTietToa')} giaiThich={t('kpi.gt.chiTietToa')}>
        {soToa === 0 ? <p class="dong muted">{t('kpi.chuaCoToa')}</p> : (
          <div class="kpi-bang kpi-bang-toa" role="table" aria-label={t('kpi.chiTietToa')}>
            <div class="kpi-hang dau" role="row"><span>{t('xep.toa')}</span><span>{t('kpi.cot.can')}</span><span>{t('kpi.cot.dan')}</span><span>{t('kpi.cot.dtsd')}</span><span>{t('kpi.cot.hs')}</span></div>
            {k.toa.map((x) => (
              <div class="kpi-hang" role="row" key={x.toaId} title={`${tenToa(x.toaId)} · ${x.soTang} ${t('kpi.tang')} · DTXD ${fmtSo(x.dtxd1San, { thapPhan: 1 })} m²`}>
                <span>{tenToa(x.toaId)}</span>
                <span>{fmtSo(x.soCan)}</span><span>{fmtSo(x.dan)}</span><span>{fmtSo(x.dtsd)}</span>
                <span class={x.hieuSuat !== null && x.hieuSuat < hsMin ? 'kpi-warn' : ''}>{pct1(x.hieuSuat)}</span>
              </div>
            ))}
          </div>
        )}
        <p class="kpi-ghi">{t('kpi.dinhNghia')}</p>
      </MucGap>
    </section>
  );
}
