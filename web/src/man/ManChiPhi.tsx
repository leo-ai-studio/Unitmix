import { t, useLang } from '../i18n/i18n';
import { apPreset, chupPreset } from '../kho/preset';
import type { KetQuaChiTieu } from '../tinh/chiTieu';
import { diemLechPA } from '../tinh/diemPA';
import { NHOM_CHI_PHI, tinhDuToan, tinhKhoiLuong, type DuToan, type KhoiLuong } from '../tinh/duToan';
import { LOAI_CAN, type ChiPhiPA, type GiaBan, type ThuVien, type TrangThaiPA, type TyLeChiPhi } from '../tinh/kieu';
import { chuanHoaChiPhi, DIEU_CHINH_MAX, DIEU_CHINH_MIN } from '../tinh/macDinh';
import { dieuPhoiHam, useNgheHam } from '../tinh/hamNen';
import { tinhTaiChinh, type TaiChinh } from '../tinh/taiChinh';
import { MucGap } from '../ui/MucGap';
import { DongPreset } from '../ui/Preset';
import { fmtSo } from '../ui/so';
import { SoDong } from '../ui/SoDong';

type Props = { pa: TrangThaiPA; tv: ThuVien | null; kq: KetQuaChiTieu | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean };
type KetQuaCP = { cp: ChiPhiPA; kl: KhoiLuong; dt: DuToan; tc: TaiChinh; lech: number | null; dangRai: boolean };

// PA là bất biến (mỗi lần sửa ra đối tượng mới): nhớ kết quả theo PA để panel giữa và panel phải không tính hai lần.
// Hầm rải trong Web Worker (tinh/hamNen.ts, kênh 'chiPhi'): đang rải thì lô đó giữ số rải cũ (hoặc ước theo DT) và báo `dangRai`;
// rải xong `phienBan` tăng → tính lại.
const nho = new WeakMap<TrangThaiPA, { tv: ThuVien; v: number; kq: KetQuaCP }>();
export function ketQua(pa: TrangThaiPA, tv: ThuVien, kqCT: KetQuaChiTieu | null): KetQuaCP {
  const v = dieuPhoiHam.phienBan;
  const co = nho.get(pa);
  if (co && co.tv === tv && co.v === v) return co.kq;
  const cp = chuanHoaChiPhi(pa.chiPhi);
  const ph = dieuPhoiHam.phien('chiPhi');
  const kl = tinhKhoiLuong(pa, tv, true, ph.lay);
  ph.xong();
  const dt = tinhDuToan(kl, cp);
  const lech = kqCT ? diemLechPA(pa, kqCT) : null;
  const kq = { cp, kl, dt, tc: tinhTaiChinh(pa, tv, kl, dt, lech), lech, dangRai: ph.dangCho };
  nho.set(pa, { tv, v, kq });
  return kq;
}

const trieu = (v: number | null | undefined) => (v === null || v === undefined ? v : v / 1e6);
const ty = (v: number | null | undefined) => (v === null || v === undefined ? v : v / 1e9);

/** Ô nhập số tạm: đổi khi rời ô / Enter; giá trị hỏng thì bỏ qua. Tooltip luôn ghi "số tạm, chờ chốt". */
function ONhapSo({ gt, onDoi, tat, buoc = 1, min, max, nhan }: { gt: number; onDoi: (v: number) => void; tat: boolean; buoc?: number; min?: number; max?: number; nhan: string }) {
  return (
    <input class="cp-o" type="number" value={gt} step={buoc} min={min} max={max} disabled={tat} aria-label={nhan} title={`${nhan} — ${t('chiPhi.soTam')}`}
      onChange={(e) => {
        const v = Number(e.currentTarget.value);
        if (e.currentTarget.value.trim() !== '' && Number.isFinite(v)) onDoi(min !== undefined || max !== undefined ? Math.min(max ?? v, Math.max(min ?? v, v)) : v);
      }} />
  );
}

/** Ô số tính ra (không sửa), tooltip "số tạm". */
const OSo = ({ v, thapPhan = 0, donVi }: { v: number | null | undefined; thapPhan?: number; donVi?: string }) => (
  <td class="so" title={t('chiPhi.soTam')}><SoDong value={v} thapPhan={thapPhan} donVi={donVi} /></td>
);

/** Nội dung tab Chi phí ở panel giữa: dự toán, hiệu quả tài chính, khối lượng theo lô / tòa. Cuộn trong khung, không đổi kích thước khung. */
export function ChiPhiGiua({ pa, tv, kq, sua, chiXem }: Props) {
  useLang();
  useNgheHam('chiPhi');
  if (!tv) return <div class="chi-phi"><p class="muted">{t('chiPhi.dangTai')}</p></div>;
  const { cp, kl, dt, tc, lech, dangRai } = ketQua(pa, tv, kq);
  const suaCP = (f: (c: ChiPhiPA) => ChiPhiPA) => sua((p) => ({ ...p, chiPhi: f(chuanHoaChiPhi(p.chiPhi)) }));
  const suaTyLe = (k: keyof TyLeChiPhi) => (v: number) => suaCP((c) => ({ ...c, tyLe: { ...c.tyLe, [k]: v } }));
  const suaBan = (k: Exclude<keyof GiaBan, 'can'>) => (v: number) => suaCP((c) => ({ ...c, ban: { ...c.ban, [k]: v } }));
  const lop: [keyof TyLeChiPhi, number][] = [['qlda', dt.qlda], ['tuVan', dt.tuVan], ['khac', dt.khac]];
  const thongSoBan: [Exclude<keyof GiaBan, 'can'>, number, number?, number?][] = [
    ['tangMoiTang', 0.1], ['soTangThap', 1, 0], ['tangThap', 0.5], ['tangTren', 0.5],
    ['oTo', 1_000_000, 0], ['xeMay', 1_000_000, 0], ['thuongMai', 1_000_000, 0], ['tyLeBanDe', 1, 0, 100],
    ['phatLech', 0.05, 0], ['banHang', 0.1, 0, 100], ['chiPhiDat', 1_000_000_000, 0],
  ];

  return (
    <div class="chi-phi">
      <header class="cp-dau">
        <h2>{t('chiPhi.tieuDe')}</h2>
        <p class="cp-canh-bao" role="note">{t('chiPhi.canhBao')}</p>
        <p class="muted cp-ghi">{t('chiPhi.ghiChuND')}</p>
        <p class="muted cp-ghi">{t('chiPhi.nguonDonGia')}</p>
        {dangRai && <p class="muted cp-ghi" role="status"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px', verticalAlign: '-2px', marginRight: '6px' }} />{t('ham.dangRai')}</p>}
        <DongPreset nhom="chiPhi" chiXem={chiXem} chup={() => chupPreset('chiPhi', pa, null)} ap={(du) => sua((p) => apPreset('chiPhi', p, du, 'pa', null))} />
      </header>

      <section>
        <h3>{t('chiPhi.mucDuToan')}</h3>
        <div class="cp-bao">
          <table class="cp-bang">
            <thead>
              <tr><th>{t('chiPhi.hangMuc')}</th><th>{t('chiPhi.donVi')}</th><th>{t('chiPhi.khoiLuong')}</th><th>{t('chiPhi.donGia')}</th><th>{t('chiPhi.thanhTien')}</th></tr>
            </thead>
            {NHOM_CHI_PHI.map((n) => (
              <tbody key={n}>
                <tr class="cp-nhom">
                  <th colSpan={3}>{t(`chiPhi.nhom.${n}`)}</th>
                  <td colSpan={2} title={t('chiPhi.gtDieuChinh')}>
                    <label class="cp-dc">{t('chiPhi.dieuChinh')}
                      <ONhapSo gt={cp.dieuChinh[n]} buoc={1} min={DIEU_CHINH_MIN} max={DIEU_CHINH_MAX} tat={chiXem} nhan={t('chiPhi.dieuChinh')}
                        onDoi={(v) => suaCP((c) => ({ ...c, dieuChinh: { ...c.dieuChinh, [n]: v } }))} />
                    </label>
                  </td>
                </tr>
                {dt.dong.filter((d) => d.nhom === n).map((d) => (
                  <tr key={d.khoa}>
                    <th>{t(`chiPhi.dong.${d.khoa}`)}</th>
                    <td>{d.donVi === 'thang' ? t('chiPhi.dv.thang') : d.donVi}</td>
                    <OSo v={d.kl} />
                    <td class="so"><ONhapSo gt={cp.donGia[d.khoa]} buoc={10_000} min={0} tat={chiXem} nhan={t(`chiPhi.dong.${d.khoa}`)}
                      onDoi={(v) => suaCP((c) => ({ ...c, donGia: { ...c.donGia, [d.khoa]: v } }))} /></td>
                    <OSo v={trieu(d.thanhTien)} />
                  </tr>
                ))}
                <tr>
                  <th>{t('chiPhi.khac')}</th><td /><td />
                  <td class="so"><ONhapSo gt={cp.khac[n]} buoc={1_000_000} tat={chiXem} nhan={`${t('chiPhi.khac')} · ${t(`chiPhi.nhom.${n}`)}`}
                    onDoi={(v) => suaCP((c) => ({ ...c, khac: { ...c.khac, [n]: v } }))} /></td>
                  <OSo v={trieu(dt.nhom[n].khac)} />
                </tr>
                <tr class="cp-cong"><th colSpan={4}>{`${t('chiPhi.congNhom')}: ${t(`chiPhi.nhom.${n}`)}`}</th><OSo v={trieu(dt.nhom[n].tong)} /></tr>
              </tbody>
            ))}
            <tbody>
              <tr class="cp-cong"><th colSpan={4}>{t('chiPhi.coSo')}</th><OSo v={trieu(dt.xd + dt.tb)} /></tr>
              {lop.map(([k, v]) => (
                <tr key={k}>
                  <th>{t(`chiPhi.lop.${k}`)}</th><td>%</td><td />
                  <td class="so">
                    {k === 'qlda' && (
                      <label class="cp-tt38" title={t('chiPhi.qldaTT38Ghi')}>
                        <input type="checkbox" checked={cp.qldaTT38} disabled={chiXem} onChange={(e) => suaCP((c) => ({ ...c, qldaTT38: e.currentTarget.checked }))} />
                        {t('chiPhi.qldaTT38')}
                      </label>
                    )}
                    <ONhapSo gt={k === 'qlda' && cp.qldaTT38 ? Math.round(dt.tlQlda * 1000) / 1000 : cp.tyLe[k]} buoc={0.1} min={0} max={100}
                      tat={chiXem || (k === 'qlda' && cp.qldaTT38)} nhan={t(`chiPhi.lop.${k}`)} onDoi={suaTyLe(k)} />
                  </td>
                  <OSo v={trieu(v)} />
                </tr>
              ))}
              <tr class="cp-cong"><th colSpan={4}>{t('chiPhi.truocDuPhong')}</th><OSo v={trieu(dt.truocDuPhong)} /></tr>
              {([['duPhongKL', dt.duPhongKL], ['duPhongTruotGia', dt.duPhongTruotGia]] as const).map(([k, v]) => (
                <tr key={k}>
                  <th>{t(`chiPhi.lop.${k}`)}</th><td>%</td><td />
                  <td class="so"><ONhapSo gt={cp.tyLe[k]} buoc={0.1} min={0} max={100} tat={chiXem} nhan={t(`chiPhi.lop.${k}`)} onDoi={suaTyLe(k)} /></td>
                  <OSo v={trieu(v)} />
                </tr>
              ))}
              <tr class="cp-tong"><th colSpan={4}>{t('chiPhi.tongMuc')}</th><OSo v={trieu(dt.tongMuc)} /></tr>
              <tr><th colSpan={3}>{t('chiPhi.suatM2')}</th><OSo v={dt.suatM2} donVi="đ" /><td /></tr>
              <tr><th colSpan={3}>{t('chiPhi.suatCan')}</th><OSo v={trieu(dt.suatCan)} donVi={t('chiPhi.trDong')} /><td /></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>{t('chiPhi.mucTaiChinh')}</h3>
        <div class="cp-bao">
          <table class="cp-bang">
            <thead><tr><th>{t('chiPhi.loaiCan')}</th><th>{t('chiPhi.soCan')}</th><th>{t('chiPhi.dtTT')}</th><th>{t('chiPhi.giaBan')}</th><th>{t('chiPhi.doanhThu')}</th></tr></thead>
            <tbody>
              {LOAI_CAN.map((l) => (
                <tr key={l}>
                  <th>{t(`loai.${l}`)}</th>
                  <OSo v={tc.theoLoai[l].soCan} />
                  <OSo v={tc.theoLoai[l].dtTT} />
                  <td class="so"><ONhapSo gt={cp.ban.can[l]} buoc={500_000} min={0} tat={chiXem} nhan={`${t('chiPhi.giaBan')} · ${t(`loai.${l}`)}`}
                    onDoi={(v) => suaCP((c) => ({ ...c, ban: { ...c.ban, can: { ...c.ban.can, [l]: v } } }))} /></td>
                  <OSo v={trieu(tc.theoLoai[l].doanhThu)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>{t('chiPhi.thongSoBan')}</h4>
        <div class="cp-luoi">
          {thongSoBan.map(([k, buoc, min, max]) => (
            <label key={k}><span>{t(`chiPhi.${k}`)}</span>
              <ONhapSo gt={cp.ban[k]} buoc={buoc} min={min} max={max} tat={chiXem} nhan={t(`chiPhi.${k}`)} onDoi={suaBan(k)} />
            </label>
          ))}
        </div>
        <div class="cp-bao">
          <table class="cp-bang cp-ket">
            <tbody>
              <tr><th>{t('chiPhi.dtCan')}</th><OSo v={trieu(tc.doanhThuCan)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.dtOto')}<small>{` · ${fmtSo(kl.tong.soChoOto)} ${t('chiPhi.kl.oto').toLowerCase()}`}</small></th><OSo v={trieu(tc.doanhThuOto)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.dtXeMay')}<small>{` · ${fmtSo(kl.tong.soXeMay)} ${t('chiPhi.kl.xeMay').toLowerCase()}`}</small></th><OSo v={trieu(tc.doanhThuXeMay)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.dtTM')}</th><OSo v={trieu(tc.doanhThuTM)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.phat')}<small>{` · ${t('chiPhi.diemLech')} ${fmtSo(lech, { thapPhan: 1 })} → ${fmtSo(tc.tyLePhat * 100, { thapPhan: 2, donVi: '%' })}`}</small></th><OSo v={trieu(tc.phatLech ? -tc.phatLech : 0)} donVi={t('chiPhi.trDong')} /></tr>
              <tr class="cp-cong"><th>{t('chiPhi.doanhThuRong')}</th><OSo v={trieu(tc.doanhThu)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.tongMuc')}</th><OSo v={trieu(tc.tongMuc)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.chiPhiDat')}</th><OSo v={trieu(tc.chiPhiDat)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.chiPhiBan')}</th><OSo v={trieu(tc.chiPhiBan)} donVi={t('chiPhi.trDong')} /></tr>
              <tr class="cp-cong"><th>{t('chiPhi.tongChiPhi')}</th><OSo v={trieu(tc.tongChiPhi)} donVi={t('chiPhi.trDong')} /></tr>
              <tr class={`cp-tong${tc.loiNhuan < 0 ? ' am' : ''}`}><th>{t('chiPhi.loiNhuan')}</th><OSo v={trieu(tc.loiNhuan)} donVi={t('chiPhi.trDong')} /></tr>
              <tr><th>{t('chiPhi.bienLN')}</th><OSo v={tc.bienLN} thapPhan={1} donVi="%" /></tr>
              <tr><th>{t('chiPhi.giaBQ')}</th><OSo v={tc.giaBQ} /></tr>
              <tr><th>{t('chiPhi.giaHoaVon')}</th><OSo v={tc.giaHoaVon} /></tr>
            </tbody>
          </table>
        </div>
        {kl.tong.tongCan === 0 && <p class="muted">{t('chiPhi.chuaCoCan')}</p>}
      </section>

      <section>
        <h3>{t('chiPhi.mucKhoiLuong')}</h3>
        <div class="cp-bao">
          <table class="cp-bang cp-kl">
            <thead>
              <tr>
                {['loToa', 'sanDH', 'soTang', 'thap', 'de', 'apMai', 'can', 'dtTT', 'matNgoai', 'thang', 'ham', 'oto', 'xeMay', 'kho', 'san'].map((k) => <th key={k}>{t(`chiPhi.kl.${k}`)}</th>)}
              </tr>
            </thead>
            {kl.lo.filter((l) => l.toa.length).map((l) => (
              <tbody key={l.loId}>
                <tr class="cp-nhom">
                  <th title={t(`chiPhi.nguonHam.${l.nguonHam}`)}>{l.kyHieu}</th>
                  <td /><td /><td /><OSo v={l.dtDe} /><td /><td /><td /><OSo v={l.dtMatNgoaiDe} /><td />
                  <OSo v={l.dtHam} /><OSo v={l.soChoOto} /><OSo v={l.soXeMay} /><OSo v={l.soKho} /><OSo v={l.dtSan} />
                </tr>
                {l.toa.map((x) => (
                  <tr key={x.toaId}>
                    <th class="cp-toa">{tv.toa.get(x.mauId)?.ten_vi ?? x.mauId}</th>
                    <OSo v={x.dtSanDH} /><OSo v={x.soTangDH} /><OSo v={x.dtThap} /><OSo v={x.dtDe} /><OSo v={x.dtApMai} />
                    <OSo v={x.tongCan} /><OSo v={x.dtTT} /><OSo v={x.dtMatNgoai} /><OSo v={x.soThang} />
                    <td /><td /><td /><td /><td />
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p class="muted cp-ghi">{t('chiPhi.thangGhiChu')}</p>
        <p class="muted cp-ghi">{kl.lo.filter((l) => l.toa.length).map((l) => `${l.kyHieu}: ${t(`chiPhi.nguonHam.${l.nguonHam}`)}`).join(' · ')}</p>
      </section>
    </div>
  );
}

/** Panel phải khi đang ở tab Chi phí: tóm tắt tổng mức, doanh thu, lợi nhuận (số tạm). */
export function ChiPhiPhai({ pa, tv, kq }: Pick<Props, 'pa' | 'tv' | 'kq'>) {
  useLang();
  useNgheHam('chiPhi.phai'); // chỉ nghe để vẽ lại; việc rải do kênh 'chiPhi' (panel giữa) khai
  if (!tv) return <p class="muted" style={{ padding: '12px' }}>{t('chiPhi.dangTai')}</p>;
  const { dt, tc } = ketQua(pa, tv, kq);
  const dong = (nhan: string, v: number | null | undefined, donVi: string, thapPhan = 2) => (
    <div class="dong" title={t('chiPhi.soTam')}><span>{nhan}</span><b><SoDong value={v} thapPhan={thapPhan} donVi={donVi} /></b></div>
  );
  return (
    <MucGap tieuDe={t('chiPhi.tomTat')} giaiThich={t('chiPhi.canhBao')} mo>
      <p class="cp-canh-bao nho">{t('chiPhi.canhBao')}</p>
      {dong(t('chiPhi.tongMuc'), ty(dt.tongMuc), t('chiPhi.tyDong'))}
      {dong(t('chiPhi.suatM2'), trieu(dt.suatM2), t('chiPhi.trDong'), 2)}
      {dong(t('chiPhi.suatCan'), ty(dt.suatCan), t('chiPhi.tyDong'), 2)}
      {dong(t('chiPhi.doanhThuRong'), ty(tc.doanhThu), t('chiPhi.tyDong'))}
      {dong(t('chiPhi.tongChiPhi'), ty(tc.tongChiPhi), t('chiPhi.tyDong'))}
      {dong(t('chiPhi.loiNhuan'), ty(tc.loiNhuan), t('chiPhi.tyDong'))}
      {dong(t('chiPhi.bienLN'), tc.bienLN, '%', 1)}
      {dong(t('chiPhi.giaBQ'), trieu(tc.giaBQ), t('chiPhi.trDong'), 1)}
      {dong(t('chiPhi.giaHoaVon'), trieu(tc.giaHoaVon), t('chiPhi.trDong'), 1)}
    </MucGap>
  );
}
