import { t } from '../i18n/i18n';
import { tinhHamSo, type KetQuaHamSo } from '../tinh/ham';
import { PHAN_HAM_MAC_DINH, type ThongSoHam, type ThuVien, type TrangThaiPA } from '../tinh/kieu';
import { chuanHoaHam } from '../tinh/macDinh';
import { MucGap } from '../ui/MucGap';
import { fmtSo } from '../ui/so';
import { ChonLoCaoTang } from './ManLo';
import { loDangXep } from './ManXepToa';
import type { HamDayDu } from '../tinh/ham';
import { NhapChot } from '../ui/NhapChot';

export type ChungHam = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  loId: string | null;
  chonLo: (id: string) => void;
  tv: ThuVien | null;
  /** Giữ cho khung soạn thảo (không còn xem từng tầng hầm). */
  tangHam: number;
  chonTangHam: (n: number) => void;
};

const suaHam = (sua: ChungHam['sua'], f: (h: HamDayDu) => Partial<ThongSoHam>) =>
  sua((p) => {
    const h = chuanHoaHam(p.ham);
    return { ...p, ham: { ...h, ...f(h) } };
  });

/** Ô số có chặn min / max (min theo quy chuẩn ghi trong `goiY`). `choTrong`: để trống = tự tính (null). */
function ONhap({ nhan, gt, donVi, onDoi, tat, buoc = 0.1, min = 0, max, goiY, choTrong = false }: {
  nhan: string; gt: number | null; donVi?: string; onDoi: (v: number | null) => void; tat: boolean;
  buoc?: number; min?: number; max?: number; goiY?: string; choTrong?: boolean;
}) {
  return (
    <label class="o-so" title={goiY}>
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <NhapChot type="number" value={gt ?? ''} step={buoc} min={min} max={max} disabled={tat} placeholder={choTrong ? t('ham.tu') : undefined}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            if (raw === '' && choTrong) return onDoi(null);
            const v = Number(raw);
            if (raw === '' || !Number.isFinite(v)) { e.currentTarget.value = gt === null ? '' : String(gt); return; }
            const kep = Math.max(min, max === undefined ? v : Math.min(max, v));
            if (kep !== v) e.currentTarget.value = String(kep);
            onDoi(kep);
          }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

function OTich({ nhan, bat, onDoi, tat, goiY }: { nhan: string; bat: boolean; onDoi: (v: boolean) => void; tat: boolean; goiY?: string }) {
  return (
    <label class="o-tich" title={goiY}>
      <input type="checkbox" checked={bat} disabled={tat} onChange={(e) => onDoi(e.currentTarget.checked)} />
      <span>{nhan}</span>
    </label>
  );
}


/** Số hầm của lô đang chọn (tính nhẹ, đồng bộ): ranh hầm, DTXD hầm, số chỗ đỗ theo hệ số / QCVN. */
const dungHam = (pa: TrangThaiPA, tv: ThuVien | null, loId: string | null) => {
  const lo = loDangXep(pa, loId);
  return { lo, ks: lo ? tinhHamSo(pa, tv, lo) : null };
};

/** Panel trái màn Hầm: lô, số tầng, ranh (lùi), tỷ lệ đỗ xe. */
export function HamTrai({ pa, sua, chiXem, loId, chonLo, tv, tangHam, chonTangHam }: ChungHam) {
  const { lo, ks } = dungHam(pa, tv, loId);
  const h = chuanHoaHam(pa.ham);
  const ph = pa.phanHam ?? PHAN_HAM_MAC_DINH;
  const tat = chiXem;
  const so = (k: keyof ThongSoHam) => (v: number | null) => suaHam(sua, () => ({ [k]: v }));
  return (
    <>
      <ChonLoCaoTang pa={pa} loId={lo?.id ?? null} chonLo={chonLo} />
      {lo && !pa.toa.some((x) => x.loId === lo.id) && <p class="ham-ghi-chu">{t('ham.chuaCoToa')}</p>}

      <MucGap tieuDe={t('ham.mucTang')} mo>
        <ONhap nhan={t('ham.soTang')} gt={h.soTang} buoc={1} min={1} max={6} tat={tat} onDoi={(v) => { so('soTang')(Math.round(v ?? 1)); if (tangHam > (v ?? 1)) chonTangHam(Math.round(v ?? 1)); }} />
        <ONhap nhan={t('ham.caoTang')} gt={h.caoTang} donVi="m" buoc={0.05} min={2} tat={tat} onDoi={so('caoTang')} />
        <ONhap nhan={t('ham.dayKetCau')} gt={h.dayKetCau} donVi="m" buoc={0.05} tat={tat} onDoi={so('dayKetCau')} />
        <div class="dong"><span>{t('ham.thongThuy')}</span><b class={h.caoTang - h.dayKetCau < 2 ? 'vuot' : 'ok'}>{fmtSo(h.caoTang - h.dayKetCau, { thapPhan: 2, donVi: 'm' })}</b></div>
      </MucGap>

      <MucGap tieuDe={t('ham.mucRanh')} giaiThich={t('ham.ranhGiaiThich')} mo>
        <ONhap nhan={t(lo?.chiGioi ? 'ham.luiChiGioi' : 'ham.luiRanh')} gt={h.lui} donVi="m" buoc={0.5} tat={tat || !!h.ranh} onDoi={so('lui')} />
        <p class="ham-ghi-chu">{h.ranh ? t('ham.ranhCoDinh') : t('ham.ranhTheoLo')} · {fmtSo(ks?.dtSanTang ?? null, { donVi: 'm²' })}</p>
        {h.ranh && <div class="dong" style={{ justifyContent: 'flex-start' }}><button type="button" class="nut-phu" disabled={tat} onClick={() => suaHam(sua, () => ({ ranh: null }))}>{t('ham.ranhBoCoDinh')}</button></div>}
      </MucGap>

      <MucGap tieuDe={t('ham.so.mucDoXe')} giaiThich={t('ham.so.doXeGiaiThich')} mo>
        <ONhap nhan={t('phanHam.doXe')} gt={Math.round(ph.doXe * 1000) / 10} donVi="%" buoc={1} min={10} max={100} tat={tat}
          onDoi={(v) => sua((p) => ({ ...p, phanHam: { ...(p.phanHam ?? PHAN_HAM_MAC_DINH), doXe: Math.min(1, Math.max(0.1, (v ?? 75) / 100)) } }))} />
        <ONhap nhan={t('ham.dtXeMay')} gt={h.dtXeMay ?? null} donVi="m²" buoc={10} choTrong goiY={t('ham.dtXeMayGoiY')} tat={tat} onDoi={so('dtXeMay')} />
        <OTich nhan={t('ham.garaCoKhi')} bat={h.garaCoKhi} goiY="QCVN 04:2021/BXD 2.2.17.1 d)" tat={tat} onDoi={(v) => suaHam(sua, () => ({ garaCoKhi: v }))} />
      </MucGap>
    </>
  );
}

const nhanDu = (co: number, can: number) => (can <= 0 ? '' : co >= can ? 'ok' : 'vuot');

function BangDoXe({ ks }: { ks: KetQuaHamSo }) {
  const { theoHeSo: hs, theoQcvn: q, khaNang: kn } = ks;
  const dong = (nhan: string, heSo: number, qc: number, co: number) => (
    <div class="ham-kiem" style={{ gridTemplateColumns: '0.9fr 1fr 1fr 1fr' }}>
      <span>{nhan}</span><span>{fmtSo(heSo)}</span><span>{fmtSo(qc)}</span><span class={nhanDu(co, Math.max(heSo, qc))}>{fmtSo(co)}</span>
    </div>
  );
  return (
    <MucGap tieuDe={t('ham.so.mucCho')} mo>
      <div class="ham-kiem dau" style={{ gridTemplateColumns: '0.9fr 1fr 1fr 1fr' }}>
        <span /><span title={t('ham.so.heSoGt')}>{t('ham.so.theoHeSo')}</span><span title={t('ham.so.qcvnGt')}>{t('ham.so.theoQcvn')}</span><span title={t('ham.so.khaNangGt')}>{t('ham.so.khaNang')}</span>
      </div>
      {dong(t('ham.choOto'), hs.oto, q.oto, kn.oto)}
      {dong(t('ham.xeMay'), hs.xeMay, q.xeMay, kn.xeMay)}
      <p class="ham-ghi-chu">{t('ham.so.ghiChuCho').replace('{hs}', fmtSo(hs.hsOto, { thapPhan: 2 })).replace('{hx}', fmtSo(hs.hsXeMay, { thapPhan: 2 }))}</p>
    </MucGap>
  );
}

/** Giữa: tóm tắt DTXD hầm + bảng số chỗ đỗ. Không có mặt bằng hầm (layout chưa hoàn thiện — nhánh feat/ham-layout). */
export function HamGiua({ pa, loId, tv }: ChungHam) {
  const { lo, ks } = dungHam(pa, tv, loId);
  if (!lo) return <div class="giua-man"><span>{t('xep.chuaCoLo')}</span></div>;
  if (!ks) return <div class="giua-man"><span>{t('ham.ranhRong')}</span></div>;
  const m2 = { donVi: 'm²' };
  return (
    <div class="ham-so">
      <MucGap tieuDe={`${t('ham.so.mucDt')} · ${lo.temDat.kyHieu}`} mo>
        <div class="dong"><span>{t('ham.so.dtRanh')}</span><b>{fmtSo(ks.dtSanTang, m2)}</b></div>
        <div class="dong"><span>{t('ham.soTang')}</span><b>{fmtSo(ks.soTang)}</b></div>
        <div class="dong"><span>{t('ham.so.dtXd')}</span><b>{`${fmtSo(ks.soTang)} × ${fmtSo(ks.dtSanTang, m2)} = ${fmtSo(ks.dtXdHam, m2)}`}</b></div>
      </MucGap>
      <BangDoXe ks={ks} />
      {ks.soCan === 0 && <p class="ham-ghi-chu">{t('ham.chuaCoCan')}</p>}
      <p class="ham-ghi-chu">{t('ham.so.ghiChuLayout')}</p>
    </div>
  );
}

/** Phải: số liệu đầu vào và cách tính. */
export function HamPhai({ pa, loId, tv }: ChungHam) {
  const { lo, ks } = dungHam(pa, tv, loId);
  if (!lo || !ks) return null;
  const m2 = { donVi: 'm²' };
  const q = ks.theoQcvn;
  return (
    <>
      <MucGap tieuDe={t('ham.mucSoLieu')} mo>
        <div class="dong"><span>{t('ham.soCan')}</span><b>{fmtSo(ks.soCan)}</b></div>
        <div class="dong"><span>{t('ham.dtsd')}</span><b>{fmtSo(ks.dtsd, m2)}</b></div>
        <div class="dong"><span>{t('ham.dtSanHam')}</span><b>{`${ks.soTang} × ${fmtSo(ks.dtSanTang, m2)}`}</b></div>
      </MucGap>
      <MucGap tieuDe={t('ham.so.mucQcvn')} mo>
        <div class="dong"><span>{t('ham.dtDoXeYeuCau')}</span><b>{fmtSo(ks.soCan ? q.dtTong : null, m2)}</b></div>
        <div class="dong"><span>{t('ham.so.dtXeMayYc')}</span><b>{fmtSo(ks.soCan ? q.dtXeMay : null, m2)}</b></div>
        <div class="dong"><span>{t('ham.so.dtOtoYc')}</span><b>{fmtSo(ks.soCan ? q.dtOto : null, m2)}</b></div>
        {ks.noxh && <p class="ham-ghi-chu">{t('ham.noxh60')}</p>}
        <p class="ham-ghi-chu">{t('ham.so.qcvnCach')}</p>
      </MucGap>
      <MucGap tieuDe={t('ham.so.mucKhaNang')} mo>
        <div class="dong"><span>{t('ham.so.dtDoXeCo')}</span><b>{fmtSo(ks.khaNang.dtDoXe, m2)} ({fmtSo(ks.khaNang.tyLeDoXe * 100, { donVi: '%' })})</b></div>
        <p class="ham-ghi-chu">{t('ham.so.khaNangCach')}</p>
      </MucGap>
    </>
  );
}
