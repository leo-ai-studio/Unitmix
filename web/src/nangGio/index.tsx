/**
 * Cửa vào gói VỊ TRÍ · NẮNG · GIÓ (nhẹ — nạp cùng màn TMB / 3D). Phần nặng tải lười: hộp điều khiển (`HopNangGio`), phần 3D
 * (`moRong3DImpl`), worker giờ nắng, bộ giải gió LBM. Điểm gắn:
 *  - TMB (man/ManXepToa.tsx): `<LopNangGio2D>` con đầu của `<BanVe>`, `useNutNangGio()` vào danh sách Lớp của GocBanVe, `<HopNangGioLuoi>` trong `.noi-tren`;
 *  - 3D Toàn dự án (ve3d/MoHinh3D.tsx): `moRong` của Khung3D = `useMoRongNangGio(pa)`, nút `<NutNangGio3D>` ở thanh 3D, `<HopNangGioLuoi la3D>`.
 */
import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { luoi } from '../ui/Luoi';
import { LopNoi } from '../ui/LopNoi';
import { useManHep } from '../ui/manHep';
import type { NutHienThi } from '../ui/ThanhHienThi';
import type { MoRong3D } from '../ve3d/moRong3D';
import { datNG, layNG, useNG } from './kho';
import { taoMoRongNangGio } from './moRongVo';
import { KINH_TUYEN_TRUC } from '../tinh/nangGio/vn2000';
import { apDungTuBanVe, viecNutViTri } from './viTriTuDong';

type Lop2D = typeof import('./LopNangGio2D').LopNangGio2D;
let Lop2DDaNap: Lop2D | null = null;
/**
 * Lớp 2D (ảnh nền, phân tích, bóng đổ) — chỉ tải mã khi có thứ cần vẽ (bật ảnh nền / mở hộp / có lớp phân tích), chưa tải thì không vẽ gì
 * (không có vòng chờ trong SVG). Chunk khởi động không nặng thêm.
 */
export function LopNangGio2D(p: { pa: TrangThaiPA; tv: ThuVien | null }) {
  const can = useNG((x) => x.banDo2D || x.moHop || !!x.lop);
  const [, ve] = useState(0);
  useEffect(() => {
    if (!can || Lop2DDaNap) return;
    let huy = false;
    import('./LopNangGio2D').then((m) => { Lop2DDaNap = m.LopNangGio2D; if (!huy) ve((n) => n + 1); }).catch(() => {});
    return () => { huy = true; };
  }, [can]);
  return can && Lop2DDaNap ? h(Lop2DDaNap, p) : null;
}

const HopNangGioLuoi = luoi(() => import('./HopNangGio').then((m) => m.default), 'hop');
type PropsHop = { pa: TrangThaiPA; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; la3D?: boolean; diaDiem?: string };
/** Hộp Vị trí · Nắng · Gió — chỉ tải mã khi mở lần đầu. */
export function HopNangGioCho(p: PropsHop) {
  const mo = useNG((x) => x.moHop), hep = useManHep();
  if (!mo) return null;
  const hop = <div class={p.la3D ? 'cho-hop-ng o-3d' : 'cho-hop-ng'}><HopNangGioLuoi {...p} /></div>;
  // màn hẹp: tấm đáy ra thẳng <body> (khỏi kẹt dưới nút góc bản vẽ / lớp xếp chồng của khung giữa)
  return hep ? <LopNoi>{hop}</LopNoi> : hop;
}

/** Nút trong danh sách Lớp (GocBanVe) của TMB: ảnh nền 2D + mở hộp Vị trí · Nắng · Gió. */
export function useNutNangGio(ctx?: { pa: TrangThaiPA; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; tenDuAn: string }): NutHienThi[] {
  const s = useNG((x) => ({ b: x.banDo2D, m: x.moHop }));
  // bật ảnh vệ tinh: đã có toạ độ → hiện ngay; chưa có → tự đặt từ bản vẽ (tỉnh đoán từ tên dự án, không thì Hà Nội) — hộp Vị trí chỉ mở khi
  // không tự đặt được hoặc để người dùng kiểm tra tỉnh; không bắt nhập toạ độ.
  const bam = () => {
    if (layNG().banDo2D) { datNG({ banDo2D: false }); return; }
    if (!ctx) { datNG({ banDo2D: true, moHop: true, tab: 'viTri' as const }); return; }
    const r = viecNutViTri(ctx.pa, false, ctx.tenDuAn, ctx.chiXem);
    if (r.viec === 'bat') datNG({ banDo2D: true });
    else if (r.viec === 'tuDat') { ctx.sua(() => r.pa); datNG({ banDo2D: true, banDo3D: true }); }
    else {
      const moi = ctx.chiXem ? null : apDungTuBanVe(ctx.pa, KINH_TUYEN_TRUC[0].ktt);
      if (moi) { ctx.sua(() => moi); datNG({ banDo2D: true, banDo3D: true, moHop: true, tab: 'viTri' as const }); }
      else datNG({ banDo2D: true, moHop: true, tab: 'viTri' as const });
    }
  };
  return [
    { khoa: 'banDo', nhan: t('ng.lop.banDo'), bat: s.b, onClick: bam },
    { khoa: 'nangGio', nhan: t('ng.lop.nangGio'), bat: s.m, onClick: () => datNG({ moHop: !layNG().moHop }) },
  ];
}

/** Mục "Ảnh vệ tinh nền" trong menu Lớp của 3D (GocBanVe của Khung3D) — bật / tắt tức thì (đổi visible, không tải lại). */
export function useNutNangGio3D(): NutHienThi[] {
  const b = useNG((x) => x.banDo3D);
  return [{ khoa: 'banDo', nhan: t('ng.lop.banDo'), bat: b, onClick: () => datNG({ banDo3D: !layNG().banDo3D }) }];
}

/**
 * Nút "Hướng nắng" / "Hướng gió" trên thanh 3D: bật / tắt tức thì từng lớp có hướng.
 * Hướng nắng = đường mặt trời (vòng B Đ N T, quỹ đạo, chấm giờ). Hướng gió = lớp gió (tiện nghi + đường dòng); chưa có kết quả gió thì
 * bấm mở hộp tab Gió để chạy phân tích (chưa có gì để hiện).
 */
export const chuyenNang = () => datNG({ duongMT: !layNG().duongMT });
export function chuyenGio() {
  const g = layNG();
  if (g.lop === 'gio') datNG({ lop: null });
  else if (g.gio.kq) datNG({ lop: 'gio', hien3D: true, dongGio: true });
  else datNG({ moHop: true, tab: 'gio' });
}

/** Nút mở hộp Vị trí · Nắng · Gió ở thanh công cụ 3D. */
export function NutNangGio3D() {
  const m = useNG((x) => x.moHop);
  return (
    <span class="nhom-3d" role="group" aria-label={t('ng.tieuDe')}>
      <button type="button" aria-pressed={m} title={t('ng.tieuDe')} onClick={() => datNG({ moHop: !layNG().moHop, tab: layNG().tab === 'viTri' ? 'nang' : layNG().tab })}>☀ {t('ng.nutNgan')}</button>
    </span>
  );
}

/** Gói mở rộng 3D cho Khung3D: phần thân nạp lười ở lần gắn đầu; PA đọc qua ref (đổi PA không tạo lại khung). */
export function useMoRongNangGio(pa: TrangThaiPA): MoRong3D {
  const ref = useRef(pa);
  ref.current = pa;
  // đổi toạ độ / góc Bắc (sửa ở hộp) → báo kho để phần 3D đặt lại mặt trời, ảnh nền, đường mặt trời
  const khoaVT = JSON.stringify(pa.viTri ?? null) + '|' + (pa.huongView?.gocBac ?? 0);
  useEffect(() => { datNG({}); }, [khoaVT]);
  return useMemo(() => taoMoRongNangGio(() => ref.current), []);
}
