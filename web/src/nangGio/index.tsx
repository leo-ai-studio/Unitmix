/**
 * Cửa vào gói VỊ TRÍ · NẮNG · GIÓ (nhẹ — nạp cùng màn TMB / 3D). Phần nặng tải lười: hộp điều khiển (`HopNangGio`), phần 3D
 * (`moRong3DImpl`), worker giờ nắng, bộ giải gió LBM. Điểm gắn:
 *  - TMB (man/ManXepToa.tsx): `<LopNangGio2D>` con đầu của `<BanVe>`, `useNutNangGio()` vào danh sách Lớp của GocBanVe, `<HopNangGioLuoi>` trong `.noi-tren`;
 *  - 3D Toàn dự án (ve3d/MoHinh3D.tsx): `moRong` của Khung3D = `useMoRongNangGio(pa)`, nút `<NutNangGio3D>` ở thanh 3D, `<HopNangGioLuoi la3D>`.
 */
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { luoi } from '../ui/Luoi';
import type { NutHienThi } from '../ui/ThanhHienThi';
import type { GanMoRong, MoRong3D } from '../ve3d/moRong3D';
import type { CanhDung } from '../ve3d/Khung3D';
import { datNG, layNG, useNG } from './kho';

export { LopNangGio2D } from './LopNangGio2D';

const HopNangGioLuoi = luoi(() => import('./HopNangGio').then((m) => m.default), 'hop');
type PropsHop = { pa: TrangThaiPA; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; la3D?: boolean };
/** Hộp Vị trí · Nắng · Gió — chỉ tải mã khi mở lần đầu. */
export function HopNangGioCho(p: PropsHop) {
  const mo = useNG((x) => x.moHop);
  return mo ? <div class={p.la3D ? 'cho-hop-ng o-3d' : 'cho-hop-ng'}><HopNangGioLuoi {...p} /></div> : null;
}

/** Nút trong danh sách Lớp (GocBanVe) của TMB: ảnh nền 2D + mở hộp Vị trí · Nắng · Gió. */
export function useNutNangGio(): NutHienThi[] {
  const s = useNG((x) => ({ b: x.banDo2D, m: x.moHop }));
  return [
    { khoa: 'banDo', nhan: t('ng.lop.banDo'), bat: s.b, onClick: () => datNG({ banDo2D: !layNG().banDo2D, ...(layNG().banDo2D ? {} : { moHop: true, tab: 'viTri' as const }) }) },
    { khoa: 'nangGio', nhan: t('ng.lop.nangGio'), bat: s.m, onClick: () => datNG({ moHop: !layNG().moHop }) },
  ];
}

/** Nút ở thanh công cụ 3D. */
export function NutNangGio3D() {
  const s = useNG((x) => ({ m: x.moHop, b: x.banDo3D }));
  return (
    <span class="nhom-3d" role="group" aria-label={t('ng.tieuDe')}>
      <button type="button" aria-pressed={s.b} title={t('ng.nen.3d')} onClick={() => datNG({ banDo3D: !layNG().banDo3D })}>{t('ng.lop.banDo3D')}</button>
      <button type="button" aria-pressed={s.m} title={t('ng.tieuDe')} onClick={() => datNG({ moHop: !layNG().moHop, tab: layNG().tab === 'viTri' ? 'nang' : layNG().tab })}>☀ {t('ng.nutNgan')}</button>
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
  return useMemo<MoRong3D>(() => ({
    gan(c) {
      let impl: GanMoRong | null = null, huy = false, canh: CanhDung | null = null;
      import('./moRong3DImpl').then((m) => {
        if (huy) return;
        impl = m.gan(c, () => ref.current);
        if (canh) impl.canhMoi?.(canh);
        c.capNang();
      }).catch(() => {});
      return {
        canhMoi(cn) { canh = cn; impl?.canhMoi?.(cn); },
        nang: (g) => impl?.nang?.(g) ?? null,
        huy() { huy = true; impl?.huy(); },
      };
    },
  }), []);
}
