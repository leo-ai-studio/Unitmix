import { useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { LopNoi } from '../ui/LopNoi';
import { fmtSo } from '../ui/so';
import { useDongHop } from '../ui/useDongHop';
import { taiVeTep } from '../xuat/taiTep';
import { BANG_MAU_IN, DS_TRINH_BAY, TC_MAC_DINH, docTuyChon, luuTuyChon, type TuyChonBC } from '../xuat/pdf/tuyChonIn';
import { KIEU_MB } from '../ve/kieuMb';
import { LOAI_CAN } from '../tinh/kieu';

type Nhom = 'pdf' | '3d';
type Props = { nhom: Nhom; pa: TrangThaiPA; tv: ThuVien; tenDuAn: string; tenPA: string; toaDangXem: string | null; dong: () => void };

/** Tuỳ chọn báo cáo: kiểu, bảng màu, trang, lớp; phần nét và khung nằm ở Nâng cao. Mọi thay đổi lưu ngay trên máy. */
function TuyChonBaoCao({ tc, doi }: { tc: TuyChonBC; doi: (v: TuyChonBC) => void }) {
  const hop = (nhom: 'trang' | 'lop', k: string) => (
    <label key={k}>
      <input type="checkbox" checked={(tc[nhom] as Record<string, boolean>)[k]} onChange={(e) => doi({ ...tc, [nhom]: { ...tc[nhom], [k]: e.currentTarget.checked } })} /> {t(`xt.${nhom}.${k}`)}
    </label>
  );
  return (
    <div class="tc-pdf">
      <p class="tc-nhan">{t('xt.trinhBay')}</p>
      <div class="tc-chon">{DS_TRINH_BAY.map((k) => <button type="button" key={k} aria-pressed={tc.trinhBay === k} onClick={() => doi({ ...tc, trinhBay: k })}>{t(`xt.tb.${k}`)}</button>)}</div>
      <p class="tc-nhan">{t('xt.bangMau')}</p>
      <div class="tc-chon">{BANG_MAU_IN.map((k) => (
        <button type="button" key={k} aria-pressed={tc.bangMau === k} onClick={() => doi({ ...tc, bangMau: k })}>
          <span class="tc-mau">{LOAI_CAN.map((l) => <i key={l} style={{ background: KIEU_MB[k].u[l] }} />)}</span>{t(`xt.mau.${k}`)}
        </button>
      ))}</div>
      <p class="tc-nhan">{t('xt.trangIn')}</p>
      <div class="tc-luoi">{(['tmb', 'chiTieu', 'matBang'] as const).map((k) => hop('trang', k))}</div>
      <p class="tc-nhan">{t('xt.lopIn')}</p>
      <div class="tc-luoi">{Object.keys(TC_MAC_DINH.lop).map((k) => hop('lop', k))}</div>
      <details>
        <summary>{t('xt.nangCao')}</summary>
        <label class="o-chon"><span>{t('xt.net.day')}</span>
          <input type="range" min={0.4} max={2.5} step={0.1} value={tc.net.day} onChange={(e) => doi({ ...tc, net: { ...tc.net, day: Number(e.currentTarget.value) } })} /><b>{fmtSo(tc.net.day, { thapPhan: 1 })}×</b></label>
        <label class="o-chon"><span>{t('xt.coChu')}</span>
          <input type="range" min={0.8} max={1.4} step={0.05} value={tc.coChu} onChange={(e) => doi({ ...tc, coChu: Number(e.currentTarget.value) })} /><b>{Math.round(tc.coChu * 100)}%</b></label>
        {(['mauTuong', 'mauToa', 'mauRanh', 'mauChiGioi'] as const).map((k) => (
          <label class="o-chon" key={k}><span>{t(`xt.net.${k}`)}</span>
            <input type="color" value={tc.net[k] ?? ({ mauTuong: '#635b5a', mauToa: '#8fb3ad', mauRanh: '#174f52', mauChiGioi: '#174f52' })[k]} onChange={(e) => doi({ ...tc, net: { ...tc.net, [k]: e.currentTarget.value } })} />
            <button type="button" class="nut-phu" disabled={!tc.net[k]} onClick={() => doi({ ...tc, net: { ...tc.net, [k]: null } })}>{t('xt.theoMau')}</button>
          </label>
        ))}
        <label class="o-chon"><span>{t('xt.khungTmb')}</span>
          <select value={tc.khungTmb} onChange={(e) => doi({ ...tc, khungTmb: e.currentTarget.value === 'du_an' ? 'du_an' : 'lo_co_toa' })}>
            <option value="lo_co_toa">{t('xt.khung.lo')}</option><option value="du_an">{t('xt.khung.duAn')}</option>
          </select></label>
        <button type="button" class="nut-phu" onClick={() => doi(TC_MAC_DINH)}>{t('xt.datLai')}</button>
      </details>
    </div>
  );
}

/**
 * Hộp "Xuất PDF" / "Xuất 3D · BIM": PDF mở hộp in của trình duyệt (chọn Lưu thành PDF); 3D tải tệp .dae (SketchUp) hoặc .ifc (Revit).
 * Bộ dựng nặng (three, mặt bằng in) tải lười khi bấm — không vào gói chính.
 */
export function HopXuatTaiLieu({ nhom, pa, tv, tenDuAn, tenPA, toaDangXem, dong }: Props) {
  const { lop, dongMem } = useDongHop(dong);
  const [dang, setDang] = useState<string | null>(null);
  const [tin, setTin] = useState<{ loai: 'xong' | 'loi'; chu: string } | null>(null);
  const [chiToa, setChiToa] = useState(false);
  const [tc, datTc] = useState<TuyChonBC>(docTuyChon);
  const doiTc = (v: TuyChonBC) => { datTc(v); luuTuyChon(v); };

  const chay = async (khoa: string, viec: () => Promise<string>) => {
    if (dang) return;
    setDang(khoa); setTin(null);
    try { setTin({ loai: 'xong', chu: await viec() }); }
    catch (e) { setTin({ loai: 'loi', chu: (e as Error).message === 'khong-co-toa' ? t('xt.khongToa') : t('xt.loi').replace('{m}', (e as Error).message) }); }
    finally { setDang(null); }
  };
  const pdf = (loai: 'bao-cao' | 'salekit' | 'hdmb') => chay(loai, async () => {
    const { xuatPdf } = await import('../xuat/pdf/inPdf');
    const n = await xuatPdf(loai, pa, tv, { tenDuAn, tenPA, baoCao: tc });
    return t('xt.xongPdf').replace('{n}', String(n));
  });
  const xemTruoc = () => chay('xem', async () => {
    const { xemTruocPdf } = await import('../xuat/pdf/inPdf');
    const n = await xemTruocPdf('bao-cao', pa, tv, { tenDuAn, tenPA, baoCao: tc });
    return t('xt.xongXem').replace('{n}', String(n));
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
              <details class="tc-pdf-mo" open>
                <summary>{t('xt.tuyChon')}</summary>
                <TuyChonBaoCao tc={tc} doi={doiTc} />
                <button type="button" class="nut-phu" disabled={!!dang} aria-busy={dang === 'xem'} onClick={() => void xemTruoc()}>{t('xt.xemTruoc')}</button>
              </details>
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
