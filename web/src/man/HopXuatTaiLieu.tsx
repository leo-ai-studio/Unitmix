import { useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { LopNoi } from '../ui/LopNoi';
import { fmtSo } from '../ui/so';
import { useDongHop } from '../ui/useDongHop';
import { taiVeTep } from '../xuat/taiTep';

type Nhom = 'pdf' | '3d';
type Props = { nhom: Nhom; pa: TrangThaiPA; tv: ThuVien; tenDuAn: string; tenPA: string; toaDangXem: string | null; dong: () => void };

/**
 * Hộp "Xuất PDF" / "Xuất 3D · BIM": PDF mở hộp in của trình duyệt (chọn Lưu thành PDF); 3D tải tệp .dae (SketchUp) hoặc .ifc (Revit).
 * Bộ dựng nặng (three, mặt bằng in) tải lười khi bấm — không vào gói chính.
 */
export function HopXuatTaiLieu({ nhom, pa, tv, tenDuAn, tenPA, toaDangXem, dong }: Props) {
  const { lop, dongMem } = useDongHop(dong);
  const [dang, setDang] = useState<string | null>(null);
  const [tin, setTin] = useState<{ loai: 'xong' | 'loi'; chu: string } | null>(null);
  const [chiToa, setChiToa] = useState(false);

  const chay = async (khoa: string, viec: () => Promise<string>) => {
    if (dang) return;
    setDang(khoa); setTin(null);
    try { setTin({ loai: 'xong', chu: await viec() }); }
    catch (e) { setTin({ loai: 'loi', chu: (e as Error).message === 'khong-co-toa' ? t('xt.khongToa') : t('xt.loi').replace('{m}', (e as Error).message) }); }
    finally { setDang(null); }
  };
  const pdf = (loai: 'bao-cao' | 'salekit' | 'hdmb') => chay(loai, async () => {
    const { xuatPdf } = await import('../xuat/pdf/inPdf');
    const n = await xuatPdf(loai, pa, tv, { tenDuAn, tenPA });
    return t('xt.xongPdf').replace('{n}', String(n));
  });
  const mo3d = (loai: 'dae-du-an' | 'dae-cong-trinh' | 'ifc') => chay(loai, async () => {
    const { xuat3d } = await import('../xuat/xuat3d');
    const r = await xuat3d(loai, { pa, tv, tenDuAn, chiToa: chiToa && toaDangXem ? [toaDangXem] : undefined });
    taiVeTep(r.noiDung, r.tenTep, r.mime);
    return t('xt.xong').replace('{ten}', r.tenTep).replace('{n}', String(r.soToa)).replace('{tg}', fmtSo(Math.round(r.soTamGiac / 1000)));
  });

  const khoi = (khoa: string, ten: string, moTa: string, bam: () => void) => (
    <div class="khoi-xuat" key={khoa}>
      <b>{ten}</b>
      <span class="muted">{moTa}</span>
      <button type="button" class="nut-chinh" disabled={!!dang} aria-busy={dang === khoa} onClick={bam}>
        {dang === khoa ? <><img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px', verticalAlign: '-2px', marginRight: '6px' }} />{t('xt.dangDung')}</> : t('xt.xuat')}
      </button>
    </div>
  );

  return (
    <LopNoi>
      <div class={`hop-3d${lop}`} role="dialog" aria-modal="true" aria-label={t(`xt.tieuDe.${nhom}`)} onClick={(e) => { if (e.target === e.currentTarget) dongMem(); }}>
        <div class="hop-xuat">
          <button type="button" class="dong-hop" onClick={dongMem} aria-label={t('m3d.dong')}>×</button>
          <h3>{t(`xt.tieuDe.${nhom}`)}</h3>
          {nhom === 'pdf' ? (
            <>
              <p class="muted">{t('xt.pdf.huongDan')}</p>
              {khoi('bao-cao', t('xt.pdf.bc'), t('xt.pdf.bcMoTa'), () => void pdf('bao-cao'))}
              {khoi('salekit', t('xt.pdf.sk'), t('xt.pdf.skMoTa'), () => void pdf('salekit'))}
              {khoi('hdmb', t('xt.pdf.hd'), t('xt.pdf.hdMoTa'), () => void pdf('hdmb'))}
            </>
          ) : (
            <>
              <p class="muted">{t('xt.skpGhiChu')}</p>
              {toaDangXem && (
                <label class="o-chon"><span>{t('xt.phamVi')}</span>
                  <select value={chiToa ? 'toa' : 'moi'} onChange={(e) => setChiToa(e.currentTarget.value === 'toa')}>
                    <option value="moi">{t('xt.moiToa')}</option>
                    <option value="toa">{t('xt.toaDangXem')}</option>
                  </select>
                </label>
              )}
              {khoi('dae-du-an', t('xt.3d.tmb'), t('xt.3d.tmbMoTa'), () => void mo3d('dae-du-an'))}
              {khoi('dae-cong-trinh', t('xt.3d.ct'), t('xt.3d.ctMoTa'), () => void mo3d('dae-cong-trinh'))}
              {khoi('ifc', t('xt.3d.ifc'), t('xt.3d.ifcMoTa'), () => void mo3d('ifc'))}
            </>
          )}
          {tin && <p class={tin.loai === 'loi' ? 'canh-bao' : 'muted'} role="status">{tin.chu}</p>}
        </div>
      </div>
    </LopNoi>
  );
}
