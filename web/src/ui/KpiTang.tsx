import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { LOAI_CAN, type CongNangO, type LoaiCan, type Lo, type ThuVien, type ToaDat, type TrangThaiPA } from '../tinh/kieu';
import { kpiTang } from '../tinh/kpi';
import { truTCC, usePCCCTang } from '../ve/LopPCCC';
import type { BoCuc } from '../tinh/matBang';
import type { ToaMB } from '../tinh/loiThang';
import { MucGap } from './MucGap';
import { fmtSo } from './so';
import { LuoiSo, TheSo, VongKpi, pct1, useHieuSuatMin } from './TheSo';
import { NutBieuTuong } from './NutBieuTuong';
import { moSoSanhMau } from './SoSanhMau';
import { nhanToa } from './nhanToa';

const so1 = { thapPhan: 1 };
/** DT thông thủy của một loại: một mẫu → số đó; nhiều mẫu → min–max. */
const khoangDt = (a: number | null, b: number | null) => (a === null || b === null ? '—' : Math.abs(a - b) < 0.05 ? fmtSo(a, so1) : `${fmtSo(a, so1)}–${fmtSo(b, so1)}`);
const fmtNguoi = (v: number) => fmtSo(v, { thapPhan: Number.isInteger(v) ? 0 : 2 });

/**
 * Bảng KPI màn Tầng (panel phải, trên cùng) cho một mẫu tòa: 6 ô số lớn (căn / tầng · tổng căn tòa · dân số tòa · hiệu suất tầng ·
 * DTXD một sàn · DTSD một sàn) + unit mix (donut + bảng theo loại: căn, % so với mục tiêu, DT thông thủy, dân). Chi tiết từng mẫu căn
 * trong mục gập (mặc định đóng). Tính: `tinh/kpi.ts` `kpiTang`.
 */
export function KpiTang({ pa, tv, toa, mau, bc, lo, tang, can, mucTieu, nguongLech, tenTang, canChon }: {
  pa: TrangThaiPA; tv: ThuVien; toa: ToaDat; mau: unknown; bc: BoCuc; lo: Lo | undefined; tang: number | null;
  can: { canId: string; cn: CongNangO }[]; mucTieu: Record<LoaiCan, number>; nguongLech: number; tenTang: string; canChon?: ComponentChildren;
}) {
  const hsMin = useHieuSuatMin();
  const k0 = useMemo(() => kpiTang(pa, tv, toa, lo, tang, can, mucTieu, hsMin), [pa, tv, toa, lo, tang, can, mucTieu, hsMin]);
  // DTSD một sàn trừ phần tường xây sau lưng tủ PCCC của các căn (QT-77g, như app cũ)
  const truDt = [...truTCC(usePCCCTang(pa, tv, toa, mau as ToaMB, bc)).values()].reduce((a, x) => a + x, 0);
  const k = truDt ? { ...k0, dtsd: k0.dtsd - truDt } : k0;
  const ten = nhanToa(pa, tv, toa.id); // "V4 · 2" khi lô có hai tòa cùng mẫu
  const dsLoai = LOAI_CAN.filter((l) => k.theoLoai[l].nToa > 0 || k.theoLoai[l].mucTieu > 0);
  const tenCan = (id: string) => tv.can.get(id)?.ten_vi ?? id;
  const tenNgan = (id: string) => tenCan(id).split(' · ')[0];
  return (
    <section class="kpi kpi-tang" aria-label={t('kpi.tang.tieuDe')}>
      <div class="kpi-dau">
        <h3>{t('kpi.tang.tieuDe')} · {ten}</h3>
        <span class="kpi-tang-ten">{tenTang}</span>
        {/* so sánh mẫu tòa cùng họ với tòa đang xem (không đặt lên TMB) — ui/SoSanhMau.tsx */}
        <NutBieuTuong k="soSanhMau" ghiChu={t('gt.ssm.moNut')}
          onClick={() => { const m = tv.toa.get(toa.mauId); if (m) moSoSanhMau({ tv, nhom: m.nhom, hinh: m.hinh }); }} />
      </div>
      <LuoiSo cot3>
        <TheSo id="kpi-can-tang" nhan={t('kpi.n.canTang')} gt={k.soCanTang} tip={`${t('kpi.gt.canTang')}
× ${fmtSo(k.soTang)} ${t('kpi.tang')}`} />
        <TheSo id="kpi-can-toa" nhan={t('kpi.n.canToa')} gt={k.soCanToa} tip={k.soCanToa !== k.soCanTang * k.soTang ? `${t('kpi.gt.canToa')}
${t('kpi.coTangRieng')}` : t('kpi.gt.canToa')} />
        <TheSo id="kpi-dan-toa" nhan={t('kpi.danSo')} gt={k.danToa}
          tip={k.soCanToa ? `${t('kpi.gt.danToa')}
${fmtSo(k.danToa / k.soCanToa, { thapPhan: 2 })} ${t('kpi.nguoiCan')}` : t('kpi.gt.danToa')} />
        <TheSo id="kpi-hs-tang" nhan={t('kpi.hieuSuat')} gt={k.hieuSuat.gt === null ? null : k.hieuSuat.gt * 100} thapPhan={1} donVi="%"
          tip={`${t('kpi.gt.hieuSuat').replace('{n}', fmtSo(hsMin * 100))}
${t('kpi.caToa')} ${pct1(k.hieuSuatToa)}`} />
        <TheSo id="kpi-dtxd-san" nhan={t('kpi.n.dtxd')} gt={k.dtxd} thapPhan={1} tip={t('kpi.gt.dtxdTang')} />
        <TheSo id="kpi-dtsd-san" nhan={t('kpi.n.dtsd')} gt={k.dtsd} thapPhan={1}
          tip={truDt ? `${t('kpi.gt.dtsdTang')}
${t('tang.truTcc').replace('{m}', fmtSo(truDt, { thapPhan: 2 }))}` : t('kpi.gt.dtsdTang')} />
      </LuoiSo>

      <div class="kpi-mix">
        <div class="kpi-mix-dau">
          <VongKpi nhan={t('kpi.unitMix')} so={fmtSo(k.soCanTang)} chu={t('kpi.canTangNgan')}
            phan={LOAI_CAN.map((l) => ({ mau: `var(--u-${l})`, v: k.theoLoai[l].pct, ten: t(`loai.${l}`) }))} />
          <div class="kpi-mix-tom">
            <b>{t('kpi.unitMix')}</b>
            {dsLoai.map((l) => {
              const x = k.theoLoai[l], lech = x.lech !== null && Math.abs(x.lech) > nguongLech;
              return (
                <div class="kpi-mix-dong" key={l}>
                  <span><i class="o-mau" style={{ background: `var(--u-${l})` }} /> {t(`loai.${l}`)}</span>
                  <b class={lech ? 'kpi-warn' : ''}>{fmtSo(x.pct, so1)} %</b>
                  <small class="muted">/ {fmtSo(x.mucTieu, { thapPhan: 0 })}</small>
                </div>
              );
            })}
          </div>
        </div>
        <div class="kpi-bang kpi-bang-loai" role="table" aria-label={t('kpi.unitMix')}>
          <div class="kpi-hang dau" role="row">
            <span>{t('kpi.cot.loai')}</span><span title={t('kpi.gt.cotCan')}>{t('kpi.cot.canTangToa')}</span>
            <span title={t('kpi.gt.cotLech')}>{t('kpi.cot.lech')}</span><span title={t('kpi.gt.cotDt')}>{t('kpi.cot.dtTt')}</span><span>{t('kpi.cot.dan')}</span>
          </div>
          {dsLoai.map((l) => {
            const x = k.theoLoai[l], lech = x.lech !== null && Math.abs(x.lech) > nguongLech;
            return (
              <div class="kpi-hang" role="row" key={l}>
                <span><i class="o-mau" style={{ background: `var(--u-${l})` }} /> {t(`loai.${l}`)}</span>
                <span>{fmtSo(x.nTang)}<small> / {fmtSo(x.nToa)}</small></span>
                <span class={lech ? 'kpi-warn' : 'kpi-ok'}>{x.lech === null ? '—' : `${x.lech > 0 ? '+' : ''}${fmtSo(x.lech, so1)}`}</span>
                <span class="dt" title={x.dtBq !== null ? `${t('kpi.bq')} ${fmtSo(x.dtBq, so1)} m²` : undefined}>{khoangDt(x.dtMin, x.dtMax)}{x.dtBq !== null && x.dtMin !== x.dtMax ? <small> {t('kpi.bq')} {fmtSo(x.dtBq, so1)}</small> : null}</span>
                <span>{fmtSo(x.danToa)}</span>
              </div>
            );
          })}
          <div class="kpi-hang tong" role="row">
            <span>{t('xep.tong')}</span><span>{fmtSo(k.soCanTang)}<small> / {fmtSo(k.soCanToa)}</small></span><span />
            <span>{k.soCanTang ? fmtSo(k.dtsd / k.soCanTang, so1) : '—'}<small> {t('kpi.bq')}</small></span><span>{fmtSo(k.danToa)}</span>
          </div>
        </div>
      </div>

      {canChon}
      <MucGap tieuDe={t('kpi.chiTietMau')} giaiThich={t('kpi.gt.chiTietMau')}>
        <div class="kpi-bang kpi-bang-mau" role="table" aria-label={t('kpi.chiTietMau')}>
          <div class="kpi-hang dau" role="row"><span>{t('tang.mauCan')}</span><span>{t('kpi.cot.canTangToa')}</span><span>{t('kpi.cot.dtTt')}</span><span>{t('kpi.cot.nguoiCan')}</span><span>{t('kpi.cot.dan')}</span></div>
          {k.mau.filter((m) => m.nToa > 0 || m.nTang > 0).map((m) => (
            <div class="kpi-hang" role="row" key={m.canId} title={tenCan(m.canId)}>
              <span><i class="o-mau" style={{ background: `var(--u-${m.loai})` }} /> {tenNgan(m.canId)}</span>
              <span>{fmtSo(m.nTang)}<small> / {fmtSo(m.nToa)}</small></span>
              <span>{fmtSo(m.dt, { thapPhan: 2 })}</span>
              <span>{fmtNguoi(m.nguoiMoiCan)}</span>
              <span>{fmtSo(m.nToa * m.nguoiMoiCan)}</span>
            </div>
          ))}
        </div>
        <p class="kpi-ghi">{t('kpi.dinhNghia')}</p>
      </MucGap>
    </section>
  );
}
