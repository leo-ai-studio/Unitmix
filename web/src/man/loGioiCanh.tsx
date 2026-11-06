/**
 * Lộ giới từng cạnh lô trên Tổng mặt bằng (LO-01 · QCVN 01:2021/BXD §2.6.2 Bảng 2.7; app cũ "Bề rộng đường tiếp giáp" `tm_rong` +
 * ô sửa một cạnh QT-122): bấm cạnh lô đang chọn → hộp lớp phủ khai giáp đường + bề rộng lộ giới (m); cạnh giáp đường hiện nhãn bề
 * rộng trên bản vẽ. Mọi thay đổi qua `sua` (hoàn tác được). Khoảng lùi tra từ quy_tac.json (`luiBang27`), không chép số.
 */
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { Diem, Lo, TrangThaiPA } from '../tinh/kieu';
import { boCanhDuong, caoToa, datCanhDuong } from '../tinh/thaoTacToa';
import { coCanhDuong, luiBang27, RONG_DUONG_MAC_DINH, rongCanh, type LuatXep } from '../tinh/xepToa';
import { fmtSo } from '../ui/so';
import { NhapChot } from '../ui/NhapChot';

// ---- cạnh đang khai (cấp module) ----
let canhChon: { loId: string; i: number } | null = null;
const nghe = new Set<() => void>();
export const datCanhChon = (c: { loId: string; i: number } | null) => { canhChon = c; nghe.forEach((f) => f()); };
export function useCanhChon() {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return canhChon;
}

const doiLo = (p: TrangThaiPA, id: string, fn: (l: Lo) => Lo): TrangThaiPA => ({ ...p, lo: p.lo.map((l) => (l.id === id ? fn(l) : l)) });

/** Nhãn bề rộng lộ giới các cạnh (lô đang chọn: mọi cạnh, kể cả mặc định; lô khác: chỉ cạnh đã khai giáp đường) + cạnh đang khai. */
export function NhanCanhLo({ dsLo, loChon, coChu }: { dsLo: Lo[]; loChon: Lo | undefined; coChu: number }) {
  const c = useCanhChon();
  return (
    <g class="lop-lo-gioi" style={{ pointerEvents: 'none' }}>
      {dsLo.flatMap((lo) => {
        const chon = lo.id === loChon?.id, khai = coCanhDuong(lo);
        if (!chon && !khai) return [];
        const R = lo.ranh, n = R.length;
        // hướng ra ngoài lô: dấu diện tích
        const dt = R.reduce((s, p, k) => s + p[0] * R[(k + 1) % n][1] - R[(k + 1) % n][0] * p[1], 0);
        return R.map((a, i) => {
          const b = R[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (L < coChu * 3) return null;
          const r = rongCanh(lo, i);
          if (!chon && r === null) return null;
          const nx = (dt > 0 ? b[1] - a[1] : a[1] - b[1]) / L, ny = (dt > 0 ? a[0] - b[0] : b[0] - a[0]) / L;
          const m: Diem = [(a[0] + b[0]) / 2 + nx * coChu * 0.9, (a[1] + b[1]) / 2 + ny * coChu * 0.9];
          const dangChon = c?.loId === lo.id && c.i === i;
          const chu = r === null ? t('lg.khongDuong') : (khai ? t('lg.nhan') : t('lg.nhanMacDinh')).replace('{r}', fmtSo(r, { thapPhan: Number.isInteger(r) ? 0 : 1 }));
          const mau = r === null ? 'var(--muted)' : khai ? 'var(--green)' : 'var(--secondary)';
          return (
            <g key={`${lo.id}-${i}`}>
              {dangChon && <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} stroke="var(--green)" stroke-width="5" stroke-opacity="0.6" vector-effect="non-scaling-stroke" />}
              {(chon || r !== null) && (
                <text x={m[0]} y={-m[1]} text-anchor="middle" dominant-baseline="middle" font-size={coChu * 0.7} font-weight={dangChon ? 700 : 600} fill={mau}
                  stroke="var(--panel)" stroke-width={coChu * 0.18} paint-order="stroke">{chu}</text>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}

/** Hộp khai một cạnh lô (lớp phủ `.noi-tren`). */
export function HopCanhLo({ pa, sua, chiXem, luat }: { pa: TrangThaiPA; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; luat: LuatXep | null }) {
  const c = useCanhChon();
  const lo = c ? pa.lo.find((l) => l.id === c.loId) : undefined;
  if (!c || !lo || c.i >= lo.ranh.length) return null;
  const i = c.i, a = lo.ranh[i], b = lo.ranh[(i + 1) % lo.ranh.length];
  const r = rongCanh(lo, i), khai = coCanhDuong(lo);
  const toaLo = pa.toa.filter((x) => x.loId === lo.id);
  const H = toaLo.length ? Math.max(...toaLo.map(caoToa)) : null;
  const lui = luat && H !== null ? (r === null ? 0 : luiBang27(luat.lo01, r, H)) : null;
  const datR = (v: number | null) => !chiXem && sua((p) => doiLo(p, lo.id, (l) => datCanhDuong(l, i, v)));
  return (
    <div class="tmb-lo-gioi" role="group" aria-label={t('lg.tieuDe')}>
      <div class="hl-dau">
        <b title={t('gt.lg.tieuDe')}>{t('lg.canh').replace('{i}', String(i + 1)).replace('{lo}', lo.temDat.kyHieu)}</b>
        <span class="muted">{t('lg.dai').replace('{d}', fmtSo(Math.hypot(b[0] - a[0], b[1] - a[1]), { thapPhan: 1 }))}</span>
        <button type="button" class="hl-dong" title={t('hl.dong')} aria-label={t('hl.dong')} onClick={() => datCanhChon(null)}>✕</button>
      </div>
      <label class="lg-dong" title={t('gt.lg.giapDuong')}>
        <input type="checkbox" aria-label={t('lg.giapDuong')} checked={r !== null} disabled={chiXem} onChange={(e) => datR(e.currentTarget.checked ? RONG_DUONG_MAC_DINH : null)} />
        {t('lg.giapDuong')}
      </label>
      <label class="lg-dong" title={t('gt.lg.rong')}>
        <span>{t('lg.rong')}</span>
        <NhapChot type="number" aria-label={t('lg.rong')} min={1} step={0.5} value={r ?? ''} disabled={chiXem || r === null}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => { const v = Number(e.currentTarget.value.replace(',', '.')); if (Number.isFinite(v) && v > 0) datR(v); }} />
        <small>m</small>
      </label>
      <p class="muted hl-ghi" title={t('gt.lg.tieuDe')}>
        {lui === null ? t('lg.luiChuaToa') : t('lg.lui').replace('{l}', fmtSo(lui, { thapPhan: 1 })).replace('{h}', fmtSo(H, { thapPhan: 1 }))}
        {!khai && ` · ${t('lg.chuaKhai')}`}
      </p>
      <div class="hl-nut">
        <button type="button" class="nut-phu" disabled={chiXem || !khai} title={t('gt.lg.boKhai')} onClick={() => sua((p) => doiLo(p, lo.id, boCanhDuong))}>{t('lg.boKhai')}</button>
      </div>
    </div>
  );
}
