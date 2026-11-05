/**
 * In ra PDF bằng hộp thoại in của trình duyệt ("Lưu thành PDF"), như app cũ MDI_Unitmix_v4 (`xuatPDF`): dựng các trang in vào một
 * nút `#in-pdf` ngoài app, CSS `@media print` ẩn mọi thứ khác, khổ giấy đặt bằng `@page` tên (a3n / a4n / a4d) nên một tệp trộn được
 * khổ ngang / dọc. Hình là vector (SVG) nên PDF sắc nét, chữ chọn / tìm được. Dọn sạch sau khi hộp in đóng.
 */
import { render } from 'preact';
import type { VNode } from 'preact';
import { docKieuMb, type KieuMb } from '../../ve/kieuMb';
import type { ThuVien, TrangThaiPA } from '../../tinh/kieu';
import { chuanBiIn, type DuLieuIn } from './duLieuIn';
import { CSS_PHONG_IN } from './phongIn';
import { BaoCaoIn } from './TrangIn';
import { HdmbIn, SalekitIn } from './TrangBanHang';

export type LoaiPdf = 'bao-cao' | 'salekit' | 'hdmb';

const CSS = `
#in-pdf { display: none; }
@page a3n { size: 420mm 297mm; margin: 0; }
@page a3d { size: 297mm 420mm; margin: 0; }
@page a4n { size: 297mm 210mm; margin: 0; }
@page a4d { size: 210mm 297mm; margin: 0; }
@media print {
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; margin: 0 !important; }
  body > *:not(#in-pdf) { display: none !important; }
  #in-pdf { display: block !important; position: static !important; }
  #in-pdf .trang-in { break-after: page; page-break-after: always; }
  #in-pdf .trang-in:last-child { break-after: auto; page-break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
#in-pdf, #in-pdf * { box-sizing: border-box; }
#in-pdf { font-family: 'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif; color: #292d2d; }
#in-pdf .trang-in { position: relative; display: flex; flex-direction: column; overflow: hidden; background: #fff; padding: 11mm 13mm 9mm; }
#in-pdf .a3n { width: 420mm; height: 297mm; page: a3n; }
#in-pdf .a3d { width: 297mm; height: 420mm; page: a3d; }
#in-pdf .a4n { width: 297mm; height: 210mm; page: a4n; padding: 9mm 11mm 7mm; }
#in-pdf .a4d { width: 210mm; height: 297mm; page: a4d; padding: 9mm 11mm 7mm; }
#in-pdf .in-dau { display: flex; align-items: center; gap: 4mm; padding-bottom: 3mm; border-bottom: 0.6mm solid #174f52; margin-bottom: 4mm; flex: none; }
#in-pdf .in-dau img { height: 11mm; }
#in-pdf .in-dau h1 { margin: 0; font-size: 6mm; color: #174f52; line-height: 1.15; font-weight: 700; }
#in-pdf .in-dau p { margin: 0.6mm 0 0; font-size: 3.2mm; color: #6b7373; }
#in-pdf .in-dau .in-so { margin-left: auto; font-size: 3.4mm; color: #6b7373; }
#in-pdf .a4n .in-dau h1, #in-pdf .a4d .in-dau h1 { font-size: 4.6mm; }
#in-pdf .a4n .in-dau img, #in-pdf .a4d .in-dau img { height: 8mm; }
#in-pdf .in-than { flex: 1; min-height: 0; display: flex; }
#in-pdf .in-chan { flex: none; display: flex; justify-content: space-between; margin-top: 3mm; padding-top: 1.5mm; border-top: 0.2mm solid #d9dcda; font-size: 2.8mm; color: #8a9494; }
#in-pdf .in-hai-cot { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) 132mm; gap: 7mm; }
#in-pdf .in-hai-cot > aside { min-width: 0; overflow: hidden; display: flex; flex-direction: column; gap: 3mm; }
#in-pdf .in-hai-cot.mb { grid-template-columns: minmax(0, 1fr) 156mm; }
#in-pdf .in-bang td.ch { min-width: 34mm; }
#in-pdf .in-hai-cot.can { grid-template-columns: minmax(0, 1fr) 100mm; }
#in-pdf .in-khung-ve { min-width: 0; min-height: 0; border: 0.2mm solid #e5e8e6; display: flex; align-items: center; justify-content: center; padding: 2mm; }
#in-pdf .in-mb, #in-pdf .in-tmb { width: 100%; height: 100%; display: block; }
#in-pdf .in-key { height: 62mm; flex: none; border: 0.2mm solid #e5e8e6; padding: 1mm; }
#in-pdf h2 { margin: 0; font-size: 4mm; color: #174f52; font-weight: 700; }
#in-pdf h3 { margin: 0 0 1.5mm; font-size: 4mm; color: #174f52; } #in-pdf h3 small { font-size: 3mm; font-weight: 400; color: #6b7373; margin-left: 2mm; }
#in-pdf .in-bang { width: 100%; border-collapse: collapse; font-size: 3.1mm; }
#in-pdf .in-bang th { text-align: left; background: #eef2f0; color: #174f52; font-weight: 600; padding: 1.2mm 1.8mm; border-bottom: 0.3mm solid #174f52; }
#in-pdf .in-bang td { padding: 1mm 1.8mm; border-bottom: 0.15mm solid #dfe3e1; vertical-align: top; }
#in-pdf .in-bang .so { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
#in-pdf .in-bang tfoot td { border-top: 0.3mm solid #174f52; font-weight: 600; }
#in-pdf .in-bang .ch { font-size: 2.7mm; color: #4b5555; }
#in-pdf .in-bang.nho { font-size: 2.7mm; } #in-pdf .in-bang.nho td { padding: 0.5mm 1.4mm; } #in-pdf .in-bang.nho th { padding: 0.8mm 1.4mm; }
#in-pdf .in-bang .muc-vuot td { background: #fdecea; color: #8a1f17; } #in-pdf .in-bang .muc-canh_bao td { background: #fff6e0; }
#in-pdf .in-bang .lech { color: #8a1f17; font-weight: 600; }
#in-pdf .in-bang caption { caption-side: top; text-align: center; font-weight: 700; font-size: 4.2mm; color: #174f52; padding-bottom: 1.5mm; }
#in-pdf .in-um th, #in-pdf .in-tong-hop th { background: #bcd7ec; color: #0f2a3a; border: 0.15mm solid #5e7a8a; text-align: center; }
#in-pdf .in-um td, #in-pdf .in-tong-hop td { border: 0.15mm solid #9aa8ae; }
#in-pdf .in-um td small { color: #33404a; font-size: 2.6mm; }
#in-pdf .in-um tfoot .noi td { font-weight: 700; } #in-pdf .in-um .thang td { font-size: 2.8mm; font-style: italic; }
#in-pdf .in-bang .do { color: #d21f1f; font-weight: 700; } #in-pdf .in-bang .vang { background: #ffe94d; font-weight: 700; color: #b01212; }
#in-pdf .in-tong-hop { font-size: 3.6mm; } #in-pdf .in-tong-hop th.giua.tong { background: #ffe9a8; } #in-pdf .in-tong-hop .pa { font-weight: 700; color: #1a3f9c; }
#in-pdf .in-ghi { margin: 0; font-size: 3mm; color: #5a6464; }
#in-pdf .sw.ranh { border: none; border-top: 0.6mm dashed #d21f1f; height: 0; vertical-align: 0.8mm; }
#in-pdf .sw { display: inline-block; width: 3.4mm; height: 3.4mm; border: 0.2mm solid #7a8585; margin-right: 1.6mm; vertical-align: -0.6mm; }
#in-pdf .sw.lon { width: 6mm; height: 6mm; } #in-pdf .sw.net { border: none; border-top: 0.4mm dashed #2b52c4; height: 0; vertical-align: 0.8mm; }
#in-pdf .in-so-lieu { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
#in-pdf .in-so-lieu div { border: 0.2mm solid #dfe3e1; border-left: 1mm solid #174f52; padding: 1.5mm 2.5mm; }
#in-pdf .in-so-lieu dt { font-size: 2.8mm; color: #6b7373; } #in-pdf .in-so-lieu dd { margin: 0; font-size: 5mm; font-weight: 700; color: #022b1e; }
#in-pdf .in-chu-giai { margin: 0; padding: 0; list-style: none; font-size: 3.1mm; display: grid; gap: 1.2mm; }
#in-pdf .in-chu-giai.lon li { display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 2mm; } #in-pdf .in-chu-giai.lon span:last-child { color: #4b5555; font-size: 2.8mm; }
#in-pdf .in-luoi-lo { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(118mm, 1fr)); gap: 5mm; align-content: start; }
#in-pdf .in-hang-lo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5mm; } #in-pdf .in-hai-the { display: grid; grid-template-columns: 1fr 1.45fr; gap: 5mm; align-items: start; }
#in-pdf .in-luoi-lo.rong { grid-template-columns: repeat(auto-fill, minmax(176mm, 1fr)); }
#in-pdf .in-bang td:first-child { white-space: nowrap; }
#in-pdf .in-the { border: 0.2mm solid #dfe3e1; padding: 2.5mm 3mm; break-inside: avoid; }
#in-pdf .in-hdmb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3mm; }
#in-pdf .in-hdmb .in-khung-ve { flex: 1; }
#in-pdf .in-bang-hai { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; align-items: start; } #in-pdf .in-bang-hai h2 { margin-bottom: 1.5mm; font-size: 3.4mm; }
#in-pdf .in-ky { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; height: 24mm; }
#in-pdf .in-ky div { display: flex; flex-direction: column; align-items: center; } #in-pdf .in-ky b { font-size: 3.2mm; } #in-pdf .in-ky span { font-size: 2.6mm; color: #8a9494; }
#in-pdf .a4d .in-bang-hai { grid-template-columns: 1fr; }
/* ---- SALEKIT (mẫu HH1, app cũ) ---- */
#in-pdf .sk { padding: 12mm; display: grid; gap: 8px; font-family: 'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif; color: #2F5D5A; font-size: 11px; }
#in-pdf .sk-tang { grid-template-rows: auto auto minmax(0, 1fr) auto; }
#in-pdf .sk-can { grid-template-rows: auto auto minmax(0, 1fr) auto auto; gap: 10px; }
#in-pdf .skhd { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; color: #F47B20; font-weight: 700; font-size: 15px; letter-spacing: .02em; text-transform: uppercase; }
#in-pdf .skti { display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }
#in-pdf .skti h1 { margin: 0; font-size: 50px; line-height: 1; font-weight: 500; letter-spacing: .01em; font-family: 'Bahnschrift', 'Bahnschrift Condensed', 'Arial Narrow', 'Be Vietnam Pro', sans-serif; font-stretch: 75%; color: #2F5D5A; text-transform: uppercase; }
#in-pdf .skti .cap { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; padding-bottom: 6px; }
#in-pdf .skdt { border-collapse: collapse; margin: 6px 0 0; width: auto; font-size: 13px; }
#in-pdf .skdt th { background: #2F5D5A; color: #fff; font-weight: 700; text-align: left; padding: 3px 12px 3px 14px; border: 0; text-transform: uppercase; letter-spacing: .01em; }
#in-pdf .skdt td { border: 0; padding: 3px 12px; background: #E9C4AB; color: #222; font-variant-numeric: tabular-nums; min-width: 84px; }
#in-pdf .skdt tr:nth-child(even) td { background: #FCE9D3; }
#in-pdf .skplan { min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
#in-pdf .skplan .in-mb { max-width: 100%; max-height: 100%; width: 100%; height: 100%; }
#in-pdf .skve { min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
#in-pdf .skve .in-can { width: 100%; height: 100%; }
#in-pdf .skft { display: grid; grid-template-columns: 1.25fr 1fr; gap: 30px; align-items: end; }
#in-pdf .skgc h2 { margin: 0 0 5px; padding: 0; border: 0; font-size: 22px; font-weight: 500; letter-spacing: .02em; font-family: 'Bahnschrift', 'Bahnschrift Condensed', 'Arial Narrow', 'Be Vietnam Pro', sans-serif; font-stretch: 75%; text-transform: uppercase; color: #2F5D5A; }
#in-pdf .skgc { display: flex; gap: 26px; align-items: flex-start; flex-wrap: wrap; }
#in-pdf .sksw { display: grid; grid-template-columns: auto auto; gap: 4px 10px; align-items: center; font-size: 10.5px; }
#in-pdf .sksw svg { display: block; width: 74px; height: 15px; } #in-pdf .sksw.sktem { gap: 0 10px; } #in-pdf .sksw.sktem svg { height: 18px; }
#in-pdf .skfn { font-size: 9px; line-height: 1.5; color: #6B7B7A; } #in-pdf .skfn p { margin: 0 0 3px; }
#in-pdf .skkp { display: flex; flex-direction: column; gap: 3px; } #in-pdf .skkp .lab { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
#in-pdf .skkp .kp { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; height: 50mm; }
#in-pdf .skkp .kp > div { min-height: 0; flex: 1; display: flex; justify-content: center; width: 100%; }
#in-pdf .skkp .kp svg { width: auto; height: 100%; max-width: 100%; }
/* ---- HỢP ĐỒNG MUA BÁN (A4, app cũ) ---- */
#in-pdf .hd-mb { padding: 10mm; display: grid; gap: 5px; font-family: 'Roboto', 'Segoe UI', Arial, sans-serif; color: #0B1B2E; font-size: 9.5px; }
#in-pdf .hd-tang, #in-pdf .hd-mau { grid-template-rows: auto minmax(0, 1fr) auto; }
#in-pdf .hd-mb .hd { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0B1B2E; padding-bottom: 5px; }
#in-pdf .hd-mb .hd h1 { margin: 0; font-size: 14px; letter-spacing: -.01em; } #in-pdf .hd-mb .hd .mt { font-size: 11px; color: #5B6B7C; margin-top: 2px; }
#in-pdf .hd-mb .hd .dd { margin-left: auto; text-align: right; font-size: 10px; color: #5B6B7C; line-height: 1.5; }
#in-pdf .hd-mb .plan { min-height: 0; border: 1px solid #B9C7D6; padding: 4px; display: flex; align-items: flex-start; justify-content: center; overflow: hidden; background: #fff; }
#in-pdf .hd-mb .plan .in-mb { width: 100%; height: 100%; }
#in-pdf .hd-mb .ft2 { display: flex; flex-direction: column; gap: 4px; }
#in-pdf .hd-mb .chuthich { font-size: 8px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; } #in-pdf .hd-mb .swh { width: 26px; height: 9px; vertical-align: middle; margin-right: 4px; }
#in-pdf .hd-mb .note { margin-top: 8px; padding: 4px 7px; background: #EDF3F9; border-left: 3px solid #0A6BC4; font-size: 7.6px; line-height: 1.35; }
#in-pdf .hd-mb .note ul { columns: 2; column-gap: 14px; margin: 2px 0 0; padding-left: 16px; } #in-pdf .hd-mb .note li { margin: 1px 0; }
#in-pdf .hd-mb .ky { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 4px; } #in-pdf .hd-mb .ky div { text-align: center; font-size: 10px; }
#in-pdf .hd-mb .ky span { display: block; height: 34px; border-bottom: 1px solid #0B1B2E; margin-top: 4px; }
#in-pdf .hd-mb .typepg { display: flex; gap: 8px; min-height: 0; overflow: hidden; }
#in-pdf .hd-mb .tpdraw { flex: 1.3; min-width: 0; border: 1px solid #B9C7D6; padding: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
#in-pdf .hd-mb .tpdraw .in-can { width: 100%; height: 100%; }
#in-pdf .hd-mb .tpside { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
#in-pdf .hd-mb .tpkey { border: 1px solid #B9C7D6; padding: 4px; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; } #in-pdf .hd-mb .tpkey svg { width: 100%; height: 100%; }
#in-pdf .hd-mb table { width: 100%; border-collapse: collapse; font-size: 8.5px; flex: 0 0 auto; }
#in-pdf .hd-mb th, #in-pdf .hd-mb td { border: 1px solid #B9C7D6; padding: 2px 4px; text-align: left; vertical-align: middle; }
#in-pdf .hd-mb .tpside td:first-child { color: #5B6B7C; width: 42%; } #in-pdf .hd-mb tr:nth-child(even) td { background: #F4F7FA; }
`;

/** Vòng O của app, in vào ảnh nền in? Không — chỉ chờ ảnh / font của trang in sẵn sàng. */
async function choTaiNguyen(goc: HTMLElement): Promise<void> {
  await Promise.all(['400', '500', '600', '700'].flatMap((w) => [document.fonts?.load(`${w} 12px "Be Vietnam Pro"`, 'Việt'), document.fonts?.load(`${w} 12px "Roboto"`, 'Việt')]));
  await document.fonts?.ready;
  await Promise.all([...goc.querySelectorAll('img')].map((i) => (i.complete ? Promise.resolve() : new Promise<void>((x) => { i.onload = i.onerror = () => x(); }))));
  await new Promise<void>((x) => requestAnimationFrame(() => requestAnimationFrame(() => x())));
}

export type TuyChonIn = { tenDuAn: string; tenPA: string; kieu?: KieuMb; khongIn?: boolean };

/** Kiểu tô mặt bằng cho tài liệu bán hàng: đang chọn kiểu salekit thì giữ, kiểu LEO thì dùng Galia. */
const kieuSalekit = (k?: KieuMb): KieuMb => { const c = k ?? docKieuMb(); return c === 'leo' ? 'sk_galia' : c; };

const TEN_TEP: Record<LoaiPdf, string> = { 'bao-cao': 'Bao-cao-phuong-an', salekit: 'Salekit', hdmb: 'HDMB-mat-bang-tang' };
const tenAn = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Dựng tài liệu vào `#in-pdf`. Trả hàm gỡ + số trang + tên tệp gợi ý (hộp in dùng tiêu đề trang làm tên tệp PDF). */
export async function dungTaiLieuIn(loai: LoaiPdf, pa: TrangThaiPA, tv: ThuVien, o: TuyChonIn): Promise<{ goi: () => void; soTrang: number; ten: string; goc: HTMLElement; d: DuLieuIn }> {
  const noiThat = loai !== 'bao-cao';
  const d = await chuanBiIn(pa, tv, { tenDuAn: o.tenDuAn, tenPA: o.tenPA, noiThat });
  const goc = document.createElement('div');
  goc.id = 'in-pdf';
  const css = document.createElement('style');
  css.id = 'in-pdf-css';
  css.textContent = CSS_PHONG_IN + CSS;
  document.head.appendChild(css);
  document.body.appendChild(goc);
  const kieu = kieuSalekit(o.kieu);
  const cay: VNode = loai === 'bao-cao' ? <BaoCaoIn d={d} /> : loai === 'salekit' ? <SalekitIn d={d} kieu={kieu} /> : <HdmbIn d={d} />;
  render(cay, goc);
  const ten = `${TEN_TEP[loai]}_${tenAn(o.tenDuAn)}`;
  const tieuDeCu = document.title;
  document.title = ten;
  await choTaiNguyen(goc);
  const goi = () => { render(null, goc); goc.remove(); css.remove(); document.title = tieuDeCu; };
  return { goi, soTrang: goc.querySelectorAll('.trang-in').length, ten, goc, d };
}

/** Xuất PDF: dựng, mở hộp in (chọn "Lưu thành PDF"), dọn khi in xong / huỷ. Trả số trang. */
export async function xuatPdf(loai: LoaiPdf, pa: TrangThaiPA, tv: ThuVien, o: TuyChonIn): Promise<number> {
  const k = await dungTaiLieuIn(loai, pa, tv, o);
  if (o.khongIn) return k.soTrang;
  await new Promise<void>((xong) => {
    const ket = () => { window.removeEventListener('afterprint', ket); k.goi(); xong(); };
    window.addEventListener('afterprint', ket);
    window.print();
    // trình duyệt không bắn afterprint (một số bản nhúng): dọn sau 5 phút để khỏi treo nút in
    setTimeout(ket, 300000);
  });
  return k.soTrang;
}
