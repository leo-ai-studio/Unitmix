import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { CAU_TAO_MAC_DINH, type ThuVien, type ToaDat, type ToaMau, type TrangThaiPA } from '../tinh/kieu';
import { kiemQCVN04, type IdKiem, type TrangThaiTuanThu } from '../tinh/qcvn04';
import { taiQuyTac, traLuat } from '../tinh/quyTac';
import { fmtSo } from './so';
import { NhapChot } from './NhapChot';

type Props = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  toa: ToaDat;
  mau: ToaMau;
  tv: ThuVien;
};

const THU_TU: TrangThaiTuanThu[] = ['vuot', 'canh_bao', 'chua_du_du_lieu', 'dat'];
const NHAN_TT: Record<string, string> = { dat: 'ok', canh_bao: 'canh-bao', vuot: 'vuot', chua_du_du_lieu: 'chua-du' };

/** Thế {khoa} trong câu i18n bằng tham số; số được định dạng, thiếu thì "—". */
const the = (mau: string, tham: Record<string, number | string>) =>
  mau.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = tham[k];
    if (v === undefined || v === null || v === '') return '—';
    return typeof v === 'number' ? fmtSo(v, { thapPhan: Number.isInteger(v) ? 0 : 2 }) : v;
  });

const doiToa = (p: TrangThaiPA, id: string, fn: (x: ToaDat) => ToaDat): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? fn(x) : x)) });

/** Panel "Tuân thủ": kết quả QCVN 04 của tòa đang xem + ô nhập các thông số tuỳ chọn mà luật cần. */
export function BangTuanThu({ pa, sua, chiXem, toa, mau, tv }: Props) {
  const kq = useMemo(() => kiemQCVN04(pa, toa, mau, tv), [pa.cauTao, toa, mau, tv]);
  const [ma, setMa] = useState<Record<string, string>>({});
  useEffect(() => {
    let huy = false;
    taiQuyTac().then((bo) => {
      if (huy) return;
      const m: Record<string, string> = {};
      for (const k of kq) { const l = traLuat(bo, k.id); if (l) m[k.id] = l.ma; }
      setMa(m);
    }).catch(() => {});
    return () => { huy = true; };
  }, []);

  const hien = kq.filter((k) => k.trangThai !== 'bo_qua').sort((a, b) => THU_TU.indexOf(a.trangThai) - THU_TU.indexOf(b.trangThai));
  const dem = (s: TrangThaiTuanThu) => kq.filter((k) => k.trangThai === s).length;
  const day = pa.cauTao?.daySanTranM ?? CAU_TAO_MAC_DINH.daySanTranM;
  const nv = toa.nhanVien;
  const sTa = (fn: (x: ToaDat) => ToaDat) => sua((q) => doiToa(q, toa.id, fn));
  const soHoacBo = (v: string) => { const n = Number(v); return v !== '' && Number.isFinite(n) && n >= 0 ? n : null; };

  return (
    <>
      <p class="dong muted tt-tom" role="status" style={{ margin: 0 }}>
        {the(t('tt.tomTat'), { a: dem('dat'), b: dem('canh_bao'), c: dem('vuot'), d: dem('chua_du_du_lieu') })}
      </p>
      <ul class="tt-ds">
        {hien.map((k) => (
          <li key={k.id} class={`tt-dong tt-${NHAN_TT[k.trangThai]}`}>
            <div class="tt-dau">
              <b>{ma[k.id] ? `${ma[k.id]} · ` : ''}{t(`tt.${k.id}.ten`)}</b>
              <span class={`tt-the ${NHAN_TT[k.trangThai] === 'chua-du' ? 'muted' : NHAN_TT[k.trangThai]}`}>{t(`tt.tt.${k.trangThai}`)}</span>
            </div>
            <p>{the(t(`tt.${k.id}.${k.trangThai}`), k.tham)}</p>
            <small class="muted">{k.canCu}</small>
          </li>
        ))}
      </ul>
      <p class="dong tt-nho muted" style={{ margin: 0 }}>{t('tt.thongSo')}</p>
      <label class="o-so" title={t('tt.daySanTranGhi')}>
        <span>{t('tt.daySanTran')}</span>
        <span class="o-so-nhap">
          <NhapChot type="number" value={day} step={0.05} min={0} disabled={chiXem}
            onChange={(e) => { const v = soHoacBo(e.currentTarget.value); if (v !== null) sua((q) => ({ ...q, cauTao: { daySanTranM: v } })); }} />
        </span>
      </label>
      <label class="o-chon">
        <span>{t('tt.thangBangCa')}</span>
        <select disabled={chiXem} value={toa.thangBangCa === undefined ? '' : toa.thangBangCa ? '1' : '0'}
          onChange={(e) => { const v = e.currentTarget.value; sTa((x) => ({ ...x, thangBangCa: v === '' ? undefined : v === '1' })); }}>
          <option value="">{t('tt.chuaKhai')}</option>
          <option value="1">{t('tt.co')}</option>
          <option value="0">{t('tt.khong')}</option>
        </select>
      </label>
      <label class="o-so">
        <span>{t('tt.nhanVien')}</span>
        <span class="o-so-nhap">
          <NhapChot type="number" value={nv?.so ?? ''} placeholder="—" step={1} min={0} disabled={chiXem}
            onChange={(e) => { const v = soHoacBo(e.currentTarget.value); sTa((x) => ({ ...x, nhanVien: v === null ? undefined : { so: v, dtM2: x.nhanVien?.dtM2 ?? 0 } })); }} />
        </span>
      </label>
      <label class="o-so">
        <span>{t('tt.dtNhanVien')}</span>
        <span class="o-so-nhap">
          <NhapChot type="number" value={nv?.dtM2 ?? ''} placeholder="—" step={1} min={0} disabled={chiXem || !nv}
            onChange={(e) => { const v = soHoacBo(e.currentTarget.value); if (v !== null) sTa((x) => ({ ...x, nhanVien: { so: x.nhanVien?.so ?? 0, dtM2: v } })); }} />
        </span>
      </label>
    </>
  );
}

export type { IdKiem };
