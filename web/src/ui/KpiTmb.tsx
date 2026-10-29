import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { KetQuaChiTieu } from '../tinh/chiTieu';
import type { Lo, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { kpiTmb, loDuAn } from '../tinh/kpi';
import { MucGap } from './MucGap';
import { fmtSo } from './so';
import { LuoiSo, TheSo, pct1, useHieuSuatMin } from './TheSo';
import { nhanToa } from './nhanToa';

const m2 = 'm²';

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
  const kyHieu = (id: string) => pa.lo.find((l) => l.id === id)?.temDat.kyHieu ?? '';
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
      <LuoiSo>
        <TheSo id="kpi-dan-so" nhan={t('kpi.danSo')} gt={k.danSo.gt} donVi={t('ds.nguoi')} o={k.danSo} thanh tip={t('kpi.gt.danSo')}
          phu={k.danSo.nguong ? <>{pct1(k.danSo.tyLe)} · ≤ {fmtSo(k.danSo.nguong)}</> : t('kpi.chuaCoNguong')} />
        <TheSo id="kpi-so-can" nhan={t('kpi.soCan')} gt={k.soCan.gt} donVi={t('sc.can')} o={k.soCan} tip={t('kpi.gt.soCan')}
          phu={k.soCan.nguong ? <>≤ {fmtSo(k.soCan.nguong)}</> : t('kpi.trongToa').replace('{n}', String(soToa))} />
        <TheSo id="kpi-dt-san" nhan={t('kpi.dtSan')} gt={k.dtSan.gt} donVi={m2} o={k.dtSan} thanh tip={t('kpi.gt.dtSan')}
          phu={k.dtSan.nguong ? <>{pct1(k.dtSan.tyLe)} · ≤ {fmtSo(k.dtSan.nguong)}</> : null} />
        <TheSo id="kpi-dtsd" nhan={t('kpi.dtsd')} gt={k.toa.length ? k.dtsd : null} donVi={m2} tip={t('kpi.gt.dtsd')}
          phu={k.dtSan.gt ? <>{pct1(k.dtsd / k.dtSan.gt)} {t('kpi.cuaDtSan')}</> : null} />
        <TheSo id="kpi-dtxd" nhan={t('kpi.dtxd1San')} gt={k.toa.length ? k.dtxd1San : null} donVi={m2} o={k.matDo} tip={t('kpi.gt.dtxd1San')}
          phu={k.matDo.gt !== null ? <>{t('kpi.mdxd')} {fmtSo(k.matDo.gt, { thapPhan: 1 })} % · ≤ {fmtSo(k.matDo.nguong, { thapPhan: 0 })} %</> : null} />
        <TheSo id="kpi-hieu-suat" nhan={t('kpi.hieuSuat')} gt={k.hieuSuat.gt === null ? null : k.hieuSuat.gt * 100} thapPhan={1} donVi="%" o={k.hieuSuat}
          tip={t('kpi.gt.hieuSuat').replace('{n}', fmtSo(hsMin * 100))} phu={<>{t('kpi.mucTieu')} ≥ {fmtSo(hsMin * 100)} %</>} />
      </LuoiSo>
      <MucGap tieuDe={t('kpi.chiTietToa')} giaiThich={t('kpi.gt.chiTietToa')}>
        {soToa === 0 ? <p class="dong muted">{t('kpi.chuaCoToa')}</p> : (
          <div class="kpi-bang kpi-bang-toa" role="table" aria-label={t('kpi.chiTietToa')}>
            <div class="kpi-hang dau" role="row"><span>{t('xep.toa')}</span><span>{t('kpi.cot.can')}</span><span>{t('kpi.cot.dan')}</span><span>{t('kpi.cot.dtsd')}</span><span>{t('kpi.cot.hs')}</span></div>
            {k.toa.map((x) => (
              <div class="kpi-hang" role="row" key={x.toaId} title={`${tenToa(x.toaId)} · ${x.soTang} ${t('kpi.tang')} · DTXD ${fmtSo(x.dtxd1San, { thapPhan: 1 })} m²`}>
                <span>{caDuAn ? `${kyHieu(x.loId)} · ` : ''}{tenToa(x.toaId)}</span>
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
