import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Diem } from '../tinh/kieu';

/** Đổi điểm CAD (m, y lên) sang toạ độ SVG (y xuống). */
export const s = ([x, y]: Diem): string => `${x},${-y}`;
export const sPoly = (p: Diem[]): string => p.map(s).join(' ');

type Khung = [number, number, number, number]; // minX, minY, maxX, maxY (m)

export function khungBao(polys: Diem[][]): Khung | null {
  const pts = polys.flat();
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export type DieuKhienVe = { phong: () => void; thu: () => void; vuaKhung: () => void; tyLeM: number };

type Props = {
  khung: Khung | null;
  children: ComponentChildren;
  nhan: string;
  onDieuKhien?: (d: DieuKhienVe) => void;
};

/** Bản vẽ SVG theo mét: kéo để di, lăn chuột để phóng, tự vừa khung khi đổi dữ liệu. */
export function BanVe({ khung, children, nhan, onDieuKhien }: Props) {
  const goc = khung ?? [0, 0, 100, 60];
  const tinhVua = () => {
    const w = Math.max(goc[2] - goc[0], 10) * 1.15, h = Math.max(goc[3] - goc[1], 10) * 1.15;
    return { cx: (goc[0] + goc[2]) / 2, cy: -(goc[1] + goc[3]) / 2, w, h };
  };
  const [v, setV] = useState(tinhVua);
  const keo = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const khoa = khung ? khung.map((n) => n.toFixed(1)).join() : '';

  useEffect(() => setV(tinhVua()), [khoa]);
  useEffect(() => {
    onDieuKhien?.({
      phong: () => setV((o) => ({ ...o, w: o.w / 1.25, h: o.h / 1.25 })),
      thu: () => setV((o) => ({ ...o, w: o.w * 1.25, h: o.h * 1.25 })),
      vuaKhung: () => setV(tinhVua()),
      tyLeM: thuocTyLe(v.w),
    });
  }, [v.w, khoa]);

  const mPerPx = () => v.w / (ref.current?.clientWidth || 1);
  return (
    <svg
      ref={ref}
      viewBox={`${v.cx - v.w / 2} ${v.cy - v.h / 2} ${v.w} ${v.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ flex: 1, width: '100%', minHeight: '320px', display: 'block', cursor: keo.current ? 'grabbing' : 'grab', touchAction: 'none', background: 'var(--panel)' }}
      role="img"
      aria-label={nhan}
      onWheel={(e) => {
        e.preventDefault();
        const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        setV((o) => ({ ...o, w: o.w * k, h: o.h * k }));
      }}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        keo.current = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy };
      }}
      onPointerMove={(e) => {
        const k = keo.current;
        if (!k) return;
        const m = mPerPx();
        setV((o) => ({ ...o, cx: k.cx - (e.clientX - k.x) * m, cy: k.cy - (e.clientY - k.y) * m }));
      }}
      onPointerUp={() => (keo.current = null)}
    >
      {children}
    </svg>
  );
}

/** Độ dài thước tỷ lệ "đẹp" (1, 2, 5 × 10ⁿ m) cỡ 1/8 chiều rộng khung nhìn. */
export function thuocTyLe(rongM: number): number {
  const muc = rongM / 8;
  const p = 10 ** Math.floor(Math.log10(muc));
  return [1, 2, 5, 10].map((k) => k * p).find((x) => x >= muc) ?? 10 * p;
}
