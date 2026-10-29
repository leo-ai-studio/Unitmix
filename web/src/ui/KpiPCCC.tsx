import { t } from '../i18n/i18n';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import type { ToaMB } from '../tinh/loiThang';
import type { BoCuc } from '../tinh/matBang';
import type { KetQuaPCCCTang, MucPC } from '../tinh/pcccTang';
import { usePCCCTang } from '../ve/LopPCCC';
import { MucGap } from './MucGap';
import { fmtSo } from './so';

/** Bọc cho panel phải màn Tầng: tự phân tích (dùng chung kết quả nhớ với lớp vẽ) + nút đưa tủ về tự đặt. */
export function KhoiPCCC({ pa, tv, toa, mau, bc, chiXem, datToa }: {
  pa: TrangThaiPA; tv: ThuVien; toa: ToaDat; mau: ToaMB; bc: BoCuc; chiXem: boolean; datToa: (fn: (x: ToaDat) => ToaDat) => void;
}) {
  const kq = usePCCCTang(pa, tv, toa, mau, bc);
  return <KpiPCCC kq={kq} chiXem={chiXem} coTay={!!toa.tuPCCCTay?.length} veTuDong={() => datToa((x) => ({ ...x, tuPCCCTay: undefined }))}
    coCncTay={!!toa.cncTay} cncVeTuDong={() => datToa((x) => ({ ...x, cncTay: undefined }))} />;
}

const LOP: Record<MucPC, string> = { ok: 'ok', canh_bao: 'canh-bao', vuot: 'vuot', khong_ap: 'muted' };
const so1 = { thapPhan: 1 };

/**
 * Khối PCCC + thang máy ở panel phải màn Tầng (dưới KPI): mỗi dòng một luật — giá trị / ngưỡng, mức, căn cứ (tooltip) — và danh sách
 * cảnh báo. Mọi mục chỉ CẢNH BÁO, không chặn thao tác trên mặt bằng. Số liệu: tinh/pcccTang.ts.
 */
export function KpiPCCC({ kq, coTay, veTuDong, coCncTay = false, cncVeTuDong, chiXem }: {
  kq: KetQuaPCCCTang | null; coTay: boolean; veTuDong: () => void; coCncTay?: boolean; cncVeTuDong?: () => void; chiXem: boolean;
}) {
  if (!kq) return <MucGap tieuDe={t('pc.tieuDe')} mo><p class="dong muted" style={{ margin: 0 }}>{t('pc.dangTai')}</p></MucGap>;
  const tm = kq.thangMay, cc = kq.tmcc, hc = kq.hongCho, tu = kq.tu, hl = kq.hanhLang, tn = kq.thoatNan;
  const dong = (id: string, nhan: string, gt: string, muc: MucPC, tip: string) => (
    <div class="dong pc-dong" id={id} title={tip}><span>{nhan}</span><b class={LOP[muc]}>{gt}</b></div>
  );
  // tủ như luật qcvn06_52_hong_nuoc app cũ: N vị trí (a tủ đôi · b cụm 2 hộp · c tủ đơn) · tia / điểm · R 18 m đo thẳng
  const dem = (l: string) => tu.tu.filter((x) => x.loai === l).length;
  const loaiTu = [['doi', 'pc.tuDoi'], ['cum', 'pc.tuCum'], ['don', 'pc.tuDon']].filter(([l]) => dem(l)).map(([l, k]) => `${dem(l)} ${t(k)}`).join(' · ');
  const thieuTu = [...tu.thieu.map((n) => `CH-${String(n).padStart(2, '0')}`), ...(tu.thieuHL ? ['HL'] : [])];
  const quet = hl.cua.filter((x) => !x.sach);
  const truDT = tu.truDT.reduce((a, x) => a + x.m2, 0);
  return (
    <MucGap tieuDe={`${t('pc.tieuDe')} · H ${fmtSo(kq.H, so1)} m`} giaiThich={t('pc.gt.tieuDe')} mo>
      {dong('pc-thang-may', t('pc.thangMay'), `${fmtSo(tm.co)} / ${fmtSo(tm.can)}`, tm.muc,
        t('pc.gt.thangMay').replace('{t}', String(tm.theoTang)).replace('{c}', String(tm.theoCan)).replace('{d}', tm.theoDan === null ? '—' : String(tm.theoDan))
        + (tm.canMoiThang !== null ? ` · ${fmtSo(tm.canMoiThang, so1)} ${t('pc.canMoiThang')}` : '')
        + (tm.danMoiThang !== null ? ` · ${fmtSo(tm.danMoiThang, so1)} ${t('pc.danMoiThang')}` : '')
        + (tm.thieuHinh ? ` · ${t('pc.theoTen')}` : ''))}
      {dong('pc-tmcc', t('pc.tmccDong'), !cc.batBuoc ? t('pc.khongBatBuoc') : cc.chon.length ? `${cc.chon.length} · ${fmtSo(cc.xaNhat, so1)} / ${cc.r} m` : t('pc.chuaCo'),
        cc.muc, t('pc.gt.tmcc').replace('{r}', String(cc.r)).replace('{c}', cc.canCu))}
      {dong('pc-hong-cho', t('pc.hongCho'), !hc.apDung ? t('pc.khongBatBuoc') : `${fmtSo(hc.xaNhat, so1)} / ${hc.nguong} m`, hc.muc, t('pc.gt.hongCho'))}
      {dong('pc-tu', t('pc.tu'), `${fmtSo(tu.tu.length)} ${t('pc.viTri')} · ${fmtSo(tu.hop)} ${t('pc.hop')}${thieuTu.length ? ` · ${t('pc.thieu').replace('{n}', String(thieuTu.length))}` : ''}`,
        tu.muc, `${loaiTu || '—'} · ${tu.can} ${t('pc.tiaDiem')} · R ${tu.r} m ${t('pc.doThang')} · ${t('pc.bang11').replace('{n}', String(tu.soTia)).replace('{d}', tu.dong)}`
        + ` · ${t(tu.tay ? 'pc.tuTay' : 'pc.tuTuDat')}${thieuTu.length ? ` · ${t('pc.thieuDs')}: ${thieuTu.join(', ')}` : ''} · ${t('pc.gt.tu')}`)}
      {tu.truDT.length > 0 && dong('pc-tu-tru', t('pc.tuTru'), `${tu.truDT.length} ${t('pc.can')} · −${fmtSo(truDT, { thapPhan: 2 })} m²`, 'ok',
        tu.truDT.map((x) => `${x.so} → CH-${String(x.can).padStart(2, '0')} ${x.kieu} −${x.m2.toFixed(4)} m²`).join(' · ') + ` · ${t('pc.gt.tuTru')}`)}
      {coTay && <div class="dong"><button type="button" class="nut-phu" id="pc-tu-ve" disabled={chiXem} onClick={veTuDong}>{t('pc.tuVeTuDong')}</button></div>}
      {dong('pc-hanh-lang', t('pc.hanhLang'), `${fmtSo(hl.cua.length)} ${t('pc.cua')} · ${fmtSo(Math.max(0, ...hl.khoang), so1)} / ${hl.gioiHan} m`, hl.muc,
        `${t('pc.khoangDs')}: ${hl.khoang.map((x) => fmtSo(x, so1)).join(' · ')} m · ${t(hl.tay ? 'pc.cncTay' : 'pc.tuTuDat')} · `
        + t('pc.gt.hanhLang').replace('{m}', String(hl.gioiHan)).replace('{c}', hl.canCu) + (hl.hutKhoi ? ` ${t('pc.gt.hutKhoi')}` : ''))}
      {hl.cua.length > 0 && dong('pc-cnc-quet', t('pc.cncQuet'), quet.length ? `${quet.length} ${t('pc.cua')}: ${quet.map((x) => x.so).join(', ')}` : t('pc.cncSach'),
        quet.length ? 'canh_bao' : 'ok', t('pc.gt.cncQuet'))}
      {coCncTay && cncVeTuDong && <div class="dong"><button type="button" class="nut-phu" id="pc-cnc-ve" disabled={chiXem} onClick={cncVeTuDong}>{t('pc.cncVeTuDong')}</button></div>}
      {dong('pc-thoat-nan', t('pc.thoatNan'), tn.soVuot ? t('pc.canVuot').replace('{n}', String(tn.soVuot)) : `${fmtSo(tn.maxTravel, so1)} m`, tn.soVuot ? 'canh_bao' : 'ok',
        `${tn.canCu} · ${t('pc.gt.thoatNan').replace('{c}', String(tn.cut)).replace('{d}', String(tn.doi))}`)}
      {kq.canhBao.length > 0 && (
        <ul class="pc-canh-bao" role="status">
          {kq.canhBao.map((c) => {
            let s = t(c.khoa);
            for (const [k, v] of Object.entries(c.so ?? {})) s = s.split(`{${k}}`).join(String(v));
            return <li key={c.id} class={LOP[c.muc]}>{s}</li>;
          })}
        </ul>
      )}
      <p class="dong muted" style={{ margin: 0 }}>{t('pc.ghiChu')}</p>
    </MucGap>
  );
}
