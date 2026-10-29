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
  return <KpiPCCC kq={kq} chiXem={chiXem} coTay={!!toa.tuPCCCTay?.length} veTuDong={() => datToa((x) => ({ ...x, tuPCCCTay: undefined }))} />;
}

const LOP: Record<MucPC, string> = { ok: 'ok', canh_bao: 'canh-bao', vuot: 'vuot', khong_ap: 'muted' };
const so1 = { thapPhan: 1 };

/**
 * Khối PCCC + thang máy ở panel phải màn Tầng (dưới KPI): mỗi dòng một luật — giá trị / ngưỡng, mức, căn cứ (tooltip) — và danh sách
 * cảnh báo. Mọi mục chỉ CẢNH BÁO, không chặn thao tác trên mặt bằng. Số liệu: tinh/pcccTang.ts.
 */
export function KpiPCCC({ kq, coTay, veTuDong, chiXem }: { kq: KetQuaPCCCTang | null; coTay: boolean; veTuDong: () => void; chiXem: boolean }) {
  if (!kq) return <MucGap tieuDe={t('pc.tieuDe')} mo><p class="dong muted" style={{ margin: 0 }}>{t('pc.dangTai')}</p></MucGap>;
  const tm = kq.thangMay, cc = kq.tmcc, hc = kq.hongCho, tu = kq.tu, hl = kq.hanhLang, tn = kq.thoatNan;
  const dong = (id: string, nhan: string, gt: string, muc: MucPC, tip: string) => (
    <div class="dong pc-dong" id={id} title={tip}><span>{nhan}</span><b class={LOP[muc]}>{gt}</b></div>
  );
  const demCua = (l: string) => kq.cuaNC.filter((x) => x.loai === l).length;
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
      {dong('pc-tu', t('pc.tu'), `${fmtSo(tu.viTri.length)} · ${tu.loai === 'cum' ? t('pc.tuCum') : t('pc.tuDon')}${tu.thieu.length ? ` · ${t('pc.thieu').replace('{n}', String(tu.thieu.length))}` : ''}`,
        tu.muc, t('pc.gt.tu') + ` · ${t(tu.tuDat ? 'pc.tuTuDat' : 'pc.tuTay')}`)}
      {coTay && <div class="dong"><button type="button" class="nut-phu" id="pc-tu-ve" disabled={chiXem} onClick={veTuDong}>{t('pc.tuVeTuDong')}</button></div>}
      {dong('pc-hanh-lang', t('pc.hanhLang'), `${fmtSo(hl.cua.length)} ${t('pc.cua')} · ${fmtSo(Math.max(0, ...hl.khoang), so1)} / ${hl.gioiHan} m`, hl.muc,
        t('pc.gt.hanhLang').replace('{m}', String(hl.gioiHan)).replace('{c}', hl.canCu) + (hl.hutKhoi ? ` ${t('pc.gt.hutKhoi')}` : ''))}
      {dong('pc-thoat-nan', t('pc.thoatNan'), tn.soVuot ? t('pc.canVuot').replace('{n}', String(tn.soVuot)) : `${fmtSo(tn.maxTravel, so1)} m`, tn.soVuot ? 'canh_bao' : 'ok',
        `${tn.canCu} · ${t('pc.gt.thoatNan').replace('{c}', String(tn.cut)).replace('{d}', String(tn.doi))}`)}
      {dong('pc-cua-nc', t('pc.cuaNC'), `${demCua('thang')} · ${demCua('can')} · ${demCua('tmcc')} · ${demCua('rac')}`, 'ok', t('pc.gt.cuaNC'))}
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
