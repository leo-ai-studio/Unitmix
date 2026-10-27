import { useState } from 'preact/hooks';
import { api, type DuAnApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { useDongHop } from '../ui/useDongHop';
import { tinhChiTieu } from '../tinh/chiTieu';
import { chenhChiSo, chiSoPA, giaTriCot, KHOA_SO, sapXepPA, type ChiSoPA, type KhoaSapXep, type KhoaSo } from '../tinh/diemPA';
import { LOAI_CAN, type TrangThaiPA } from '../tinh/kieu';
import { chuanHoaPA } from '../tinh/macDinh';
import { taiThuVien } from '../tinh/thuVien';
import { fmtSo } from '../ui/so';
import { baoCaoSoSanh, nhanKhoa, tenTepXls, xuatXls } from '../xuat/xuatXls';

const TOI_DA = 6;
type Muc = { id: string; ten: string; chiSo: ChiSoPA };

/** Số chữ số thập phân khi hiện từng cột. */
const thapPhan = (k: KhoaSo): number => (k === 'lech' || k === 'matDo' || (LOAI_CAN as string[]).includes(k) ? 1 : 0);
const donVi = (k: KhoaSo): string | undefined => (k === 'matDo' || (LOAI_CAN as string[]).includes(k) ? '%' : undefined);
const hienSo = (c: ChiSoPA, k: KhoaSo) => fmtSo(giaTriCot(c, k), { thapPhan: thapPhan(k), donVi: donVi(k) });
/** Chênh có dấu ±; trống thì "—". */
export function fmtChenh(v: number | null, thap = 0): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const s = fmtSo(Math.abs(v), { thapPhan: thap });
  return Math.abs(v) < Math.pow(10, -thap) / 2 ? s : `${v > 0 ? '+' : '−'}${s}`;
}

/** Hộp so sánh tối đa 6 phương án của một dự án: chọn → dải thẻ, thẻ chênh so với PA gốc, bảng chi tiết, xuất XLS. */
export function SoSanhPA({ ma, da, dong }: { ma: string; da: DuAnApi; dong: () => void }) {
  const { lop, dongMem } = useDongHop(dong);
  useLang();
  const [chon, setChon] = useState<string[]>(() => da.phuong_an.slice(0, 2).map((p) => p.id));
  const [ds, setDs] = useState<Muc[] | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState(false);
  const [goc, setGoc] = useState('');
  const [chonSo, setChonSo] = useState('');
  const [khoa, setKhoa] = useState<KhoaSapXep>('lech');
  const [giam, setGiam] = useState(false);


  function bat(id: string) {
    setChon((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < TOI_DA ? [...c, id] : c));
  }
  async function soSanh() {
    setDangTai(true);
    setLoi(false);
    try {
      const [tv, pas] = await Promise.all([taiThuVien(), Promise.all(chon.map((id) => api.docPA(ma, id)))]);
      const kq = pas.map((p) => {
        const pa = chuanHoaPA(p.trang_thai as TrangThaiPA);
        return { id: p.id, ten: p.ten, chiSo: chiSoPA(pa, tinhChiTieu(pa, tv)) };
      });
      setDs(kq);
      setGoc(kq[0].id);
      setChonSo(kq[1]?.id ?? kq[0].id);
    } catch {
      setLoi(true);
    } finally {
      setDangTai(false);
    }
  }

  const sapXep = ds ? sapXepPA(ds, khoa, giam) : [];
  const g = ds?.find((x) => x.id === goc), c = ds?.find((x) => x.id === chonSo);
  const chenh = g && c ? chenhChiSo(c.chiSo, g.chiSo) : null;
  const tot = ds ? sapXepPA(ds, 'lech')[0] : null;

  return (
    <div class={`hop-thoai${lop}`} role="dialog" aria-modal="true" aria-labelledby="tieu-de-ss" onClick={(e) => { if (e.target === e.currentTarget) dongMem(); }}>
      <div class="hop-rong so-sanh">
        <div class="ss-dau">
          <h2 id="tieu-de-ss">{t('ss.tieuDe')} · {da.ten}</h2>
          <button type="button" class="nut-phu" onClick={dongMem}>{t('ss.dong')}</button>
        </div>

        {!ds ? (
          <>
            <p class="muted" style={{ margin: 0 }}>{t('ss.chonMoTa').replace('{n}', String(TOI_DA))}</p>
            <div class="ss-ds">
              {da.phuong_an.map((p) => {
                const bat_ = chon.includes(p.id);
                const tt = p.tom_tat;
                return (
                  <label class={`ss-chon${bat_ ? ' bat' : ''}`} key={p.id}>
                    <input type="checkbox" checked={bat_} disabled={!bat_ && chon.length >= TOI_DA} onChange={() => bat(p.id)} />
                    <b>{p.ten}</b>
                    <span class="so">{t('xls.tongCan')}: <b>{fmtSo(tt.soCan ?? null)}</b></span>
                    <span class="so">{t('duAn.dtSan')}: <b>{fmtSo(tt.dtSan ?? null, { donVi: 'm²' })}</b></span>
                    {LOAI_CAN.map((l) => {
                      const tong = LOAI_CAN.reduce((a, k) => a + (tt.coCau?.[k] ?? 0), 0);
                      return <span class="so" key={l}>{t(`loai.${l}`)}: <b>{tong > 0 ? fmtSo(((tt.coCau?.[l] ?? 0) / tong) * 100, { thapPhan: 0, donVi: '%' }) : '—'}</b></span>;
                    })}
                  </label>
                );
              })}
            </div>
            {loi && <p class="vuot" role="alert" style={{ margin: 0 }}>{t('soan.loiMang')}</p>}
            <div class="ss-chan">
              <span class="muted">{t('ss.daChon').replace('{n}', String(chon.length)).replace('{m}', String(TOI_DA))}</span>
              <button type="button" class="nut-chinh" disabled={chon.length < 2 || dangTai} onClick={soSanh}>{dangTai ? t('soan.dangTai') : t('ss.soSanh')}</button>
            </div>
          </>
        ) : (
          <>
            <div class="ss-cong-cu">
              <button type="button" class="nut-phu" onClick={() => setDs(null)}>{t('ss.chonLai')}</button>
              <label>{t('ss.sapXepTheo')}
                <select value={khoa} onChange={(e) => setKhoa(e.currentTarget.value as KhoaSapXep)}>
                  <option value="ten">{t('duAn.tenPA')}</option>
                  {KHOA_SO.map((k) => <option value={k} key={k}>{nhanKhoa(k)}</option>)}
                </select>
              </label>
              <button type="button" class="nut-phu" aria-pressed={giam} onClick={() => setGiam(!giam)}>{giam ? t('ss.giam') : t('ss.tang')}</button>
              <span style={{ flex: 1 }} />
              <button type="button" class="nut-chinh" onClick={() => xuatXls(baoCaoSoSanh(sapXep, Math.max(0, sapXep.findIndex((x) => x.id === goc)), da.ten), tenTepXls(da.ten, t('xls.sheetSoSanh')))}>{t('xuat.xls')}</button>
            </div>

            <div class="ss-dai" role="list">
              {sapXep.map((x) => (
                <article class={`ss-the${x.id === goc ? ' goc' : ''}${x.id === tot?.id && x.chiSo.lech !== null ? ' tot' : ''}`} role="listitem" key={x.id}>
                  <h3>{x.ten}{x.id === goc && <small> · {t('xls.paGoc')}</small>}</h3>
                  <dl>
                    <dt>{t('xls.diemLech')}</dt><dd>{hienSo(x.chiSo, 'lech')}</dd>
                    <dt>{t('xls.tongCan')}</dt><dd>{hienSo(x.chiSo, 'soCan')}</dd>
                    <dt>{t('duAn.dtSan')}</dt><dd>{fmtSo(x.chiSo.dtSan, { donVi: 'm²' })}</dd>
                    <dt>{t('dong.matDo')}</dt><dd>{hienSo(x.chiSo, 'matDo')}</dd>
                    <dt>{t('dong.tangCao')}</dt><dd>{hienSo(x.chiSo, 'tangCao')}</dd>
                    <dt>{t('xls.soVuot')}</dt><dd class={x.chiSo.soLuatVuot > 0 ? 'vuot' : ''}>{hienSo(x.chiSo, 'soLuatVuot')}</dd>
                  </dl>
                  <div class="ss-thanh" aria-label={t('ss.coCau')}>
                    {LOAI_CAN.map((l) => <span key={l} class={`l-${l}`} style={{ flexGrow: x.chiSo.coCauPct[l] || 0 }} title={`${t(`loai.${l}`)} ${hienSo(x.chiSo, l)}`} />)}
                  </div>
                </article>
              ))}
            </div>

            <section class="ss-chenh" aria-label={t('ss.chenhTieuDe')}>
              <div class="ss-cong-cu">
                <b>{t('ss.chenhTieuDe')}</b>
                <label>{t('ss.paChon')}
                  <select value={chonSo} onChange={(e) => setChonSo(e.currentTarget.value)}>{ds.map((x) => <option value={x.id} key={x.id}>{x.ten}</option>)}</select>
                </label>
                <label>{t('xls.paGoc')}
                  <select value={goc} onChange={(e) => setGoc(e.currentTarget.value)}>{ds.map((x) => <option value={x.id} key={x.id}>{x.ten}</option>)}</select>
                </label>
              </div>
              <div class="ss-luoi-chenh">
                {KHOA_SO.map((k) => (
                  <div key={k}><span>{nhanKhoa(k)}</span><b>{chenh ? fmtChenh(chenh[k], thapPhan(k)) : '—'}</b></div>
                ))}
              </div>
            </section>

            <div class="ss-bang-bao">
              <table class="ss-bang">
                <thead><tr><th>{t('xls.chiSo')}</th>{sapXep.map((x) => <th key={x.id}>{x.ten}</th>)}</tr></thead>
                <tbody>
                  {KHOA_SO.map((k) => (
                    <tr key={k}><th scope="row">{nhanKhoa(k)}</th>{sapXep.map((x) => <td key={x.id}>{hienSo(x.chiSo, k)}</td>)}</tr>
                  ))}
                  {LOAI_CAN.map((l) => (
                    <tr key={'sl' + l}><th scope="row">{t('xls.soCan')} {t(`loai.${l}`)}</th>{sapXep.map((x) => <td key={x.id}>{fmtSo(x.chiSo.coCau[l])}</td>)}</tr>
                  ))}
                  <tr><th scope="row">{t('dong.danSo')}</th>{sapXep.map((x) => <td key={x.id}>{fmtSo(x.chiSo.danSo)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
