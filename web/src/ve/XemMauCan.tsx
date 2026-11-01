import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { CanMau } from '../tinh/kieu';
import { nhanMauCan } from '../tinh/doiCan';
import type { NetVe } from '../tinh/matBang';
import { taiVeCan } from './hinhHocThuVien';
import { KIEU_MB, NET, NET_NOI_THAT, type KieuMb } from './kieuMb';

const d = (pts: [number, number][]) => 'M' + pts.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L');

/**
 * Cửa sổ nhỏ xem mặt bằng một mẫu căn (nét tường / cửa / nội thất theo kiểu bản vẽ đang dùng) để chọn đổi căn.
 * Hình theo toạ độ chuẩn hoá của tệp mẫu (x · rộng, y · sâu); `guong` = ô đang lật gương thì xem đúng chiều ô.
 */
export function XemMauCan({ can, kieu, noiThat, guong, dangDung, chiXem, chon, dong }: {
  can: CanMau; kieu: KieuMb; noiThat: boolean; guong: boolean; dangDung: boolean; chiXem: boolean; chon: () => void; dong: () => void;
}) {
  const [ve, setVe] = useState<NetVe[] | null>(null);
  // cửa sổ nằm gọn một góc, kéo (chuột / cảm ứng) ở thanh tiêu đề để dời đi chỗ khác
  const hop = useRef<HTMLDivElement>(null);
  const [vt, setVt] = useState<{ x: number; y: number } | null>(null);
  const keo = useRef<{ dx: number; dy: number } | null>(null);
  const batDau = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || !hop.current) return;
    const b = hop.current.getBoundingClientRect();
    keo.current = { dx: e.clientX - b.left, dy: e.clientY - b.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const dichChuyen = (e: PointerEvent) => {
    const k = keo.current, b = hop.current?.getBoundingClientRect();
    if (!k || !b) return;
    setVt({ x: Math.max(4, Math.min(e.clientX - k.dx, innerWidth - b.width - 4)), y: Math.max(4, Math.min(e.clientY - k.dy, innerHeight - b.height - 4)) });
  };
  useEffect(() => {
    let huy = false;
    setVe(null);
    taiVeCan(can.id, noiThat).then((v) => { if (!huy) setVe(v); });
    return () => { huy = true; };
  }, [can.id, noiThat]);
  const K = KIEU_MB[kieu];
  const W = can.rong_mm, H = can.sau_mm;
  const nhom = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of ve ?? []) {
      if (!NET[n.cat] || n.pts.length < 2 || (!noiThat && NET_NOI_THAT.has(n.cat))) continue;
      const pts = n.pts.map(([x, y]): [number, number] => [(guong ? 1 - x : x) * W, (1 - y) * H]); // y lên → SVG y xuống
      (m.get(n.cat) ?? m.set(n.cat, []).get(n.cat)!).push(d(pts));
    }
    return [...m];
  }, [ve, guong, W, H, noiThat]);
  const le = Math.round(Math.max(W, H) * 0.06);
  return (
    <div ref={hop} class="xem-mau-can" role="dialog" aria-label={nhanMauCan(can)} style={vt ? { left: `${vt.x}px`, top: `${vt.y}px`, right: 'auto' } : undefined}>
      <div class="xem-mau-dau" onPointerDown={batDau} onPointerMove={dichChuyen} onPointerUp={() => { keo.current = null; }} onPointerCancel={() => { keo.current = null; }}>
        <b>{nhanMauCan(can)}</b>
        <button type="button" class="nut-phu" aria-label={t('oc.doiCan.dong')} title={t('oc.doiCan.dong')} onClick={dong}>✕</button>
      </div>
      <svg viewBox={`${-le} ${-le} ${W + 2 * le} ${H + 2 * le}`} role="img" aria-label={can.ten_vi}>
        <rect x="0" y="0" width={W} height={H} fill={K.u[can.loai]} fill-opacity={K.doDac} />
        {nhom.map(([cat, ds]) => {
          const n = NET[cat];
          return <path key={cat} d={ds.join('')} fill="none" stroke={K[n.mau]} stroke-width={n.w} stroke-opacity={n.o} stroke-dasharray={n.d} stroke-linejoin="round" vector-effect="non-scaling-stroke" />;
        })}
        {!ve && <text x={W / 2} y={H / 2} text-anchor="middle" font-size={H / 12} fill="var(--muted)">…</text>}
      </svg>
      <div class="xem-mau-tt muted">
        {(W / 1000).toFixed(1)} × {(H / 1000).toFixed(1)} m · {t('oc.doiCan.dtTT')} {can.dt_tt_m2.toFixed(1)} m²
      </div>
      <button type="button" class="nut-chinh" disabled={chiXem || dangDung} onClick={chon}>{dangDung ? t('oc.doiCan.dangDung') : t('oc.doiCan.chon')}</button>
    </div>
  );
}
