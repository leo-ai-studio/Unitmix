import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
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
  /** Góc (độ, theo chiều kim đồng hồ) từ phía trên màn hình tới hướng Bắc; 0 khi trục y của bản vẽ chính là hướng Bắc. */
  gocBac?: number;
};

type NhinThay = { cx: number; cy: number; w: number }; // tâm (m, y đã lật) và bề rộng nhìn thấy (m); bề cao suy từ khung bản vẽ
type CuChi =
  | { loai: 'keo'; x: number; y: number; cx: number; cy: number }
  | { loai: 'chum'; d0: number; mx: number; my: number; w: number; cx: number; cy: number };

const W_TOI_THIEU = 2, W_TOI_DA = 100000;
const kep = (w: number) => Math.min(W_TOI_DA, Math.max(W_TOI_THIEU, w));

/**
 * Bản vẽ SVG theo mét. Khung cố định theo ô chứa (không phình theo nội dung); thước tỷ lệ và hoa gió là lớp phủ đứng yên.
 * Chuột: kéo để di, lăn để phóng quanh con trỏ. Cảm ứng: một ngón di, hai ngón chụm / kéo để phóng và di.
 */
export function BanVe({ khung, children, nhan, onDieuKhien, gocBac = 0 }: Props) {
  const goc = khung ?? [0, 0, 100, 60];
  const hop = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [kt, setKt] = useState({ r: 0, c: 0 }); // rộng × cao của ô chứa (px)
  const [v, setV] = useState<NhinThay>({ cx: 0, cy: 0, w: 100 });
  const vRef = useRef(v), ktRef = useRef(kt);
  vRef.current = v;
  ktRef.current = kt;
  const diem = useRef(new Map<number, { x: number; y: number }>());
  const cuChi = useRef<CuChi | null>(null);
  const khoa = khung ? khung.map((n) => n.toFixed(1)).join() : '';

  useEffect(() => {
    const el = hop.current;
    if (!el) return;
    const doKichThuoc = () => setKt({ r: el.clientWidth, c: el.clientHeight });
    doKichThuoc();
    if (typeof ResizeObserver === 'undefined') return;
    const ob = new ResizeObserver(doKichThuoc);
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const vuaKhung = (): NhinThay => {
    const { r, c } = ktRef.current.r ? ktRef.current : { r: 800, c: 500 };
    const bw = Math.max(goc[2] - goc[0], 10) * 1.15, bh = Math.max(goc[3] - goc[1], 10) * 1.15;
    return { cx: (goc[0] + goc[2]) / 2, cy: -(goc[1] + goc[3]) / 2, w: kep(Math.max(bw, (bh * r) / c)) };
  };
  const daDo = kt.r > 0 && kt.c > 0;
  useEffect(() => { if (daDo) setV(vuaKhung()); }, [khoa, daDo]);

  /** Phóng / thu hệ số k quanh điểm (px, py) trong ô chứa; điểm đó giữ nguyên vị trí trên màn hình. */
  const zoomQuanh = (k: number, px: number, py: number) => {
    const { r, c } = ktRef.current, o = vRef.current;
    if (!r || !c) return;
    const m0 = o.w / r, wx = o.cx + (px - r / 2) * m0, wy = o.cy + (py - c / 2) * m0;
    const w = kep(o.w * k), m1 = w / r;
    setV({ w, cx: wx - (px - r / 2) * m1, cy: wy - (py - c / 2) * m1 });
  };
  const tyLeM = thuocTyLe(v.w);
  useEffect(() => {
    onDieuKhien?.({
      phong: () => zoomQuanh(1 / 1.25, ktRef.current.r / 2, ktRef.current.c / 2),
      thu: () => zoomQuanh(1.25, ktRef.current.r / 2, ktRef.current.c / 2),
      vuaKhung: () => setV(vuaKhung()),
      tyLeM,
    });
  }, [tyLeM, khoa]);

  const viTri = (e: PointerEvent) => {
    const b = hop.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const batDauKeo = (id: number) => {
    const p = diem.current.get(id);
    if (p) cuChi.current = { loai: 'keo', x: p.x, y: p.y, cx: vRef.current.cx, cy: vRef.current.cy };
  };

  const h = kt.r ? (v.w * kt.c) / kt.r : 0;
  const pxMoiMet = kt.r && v.w ? kt.r / v.w : 0;
  const doDai = tyLeM * pxMoiMet;
  return (
    <div class="ban-ve" ref={hop}>
      {daDo && (
        <svg
          ref={svgRef}
          viewBox={`${v.cx - v.w / 2} ${v.cy - h / 2} ${v.w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          class="ban-ve-svg"
          style={{ cursor: cuChi.current ? 'grabbing' : 'grab' }}
          role="img"
          aria-label={nhan}
          onWheel={(e) => {
            e.preventDefault();
            const b = hop.current!.getBoundingClientRect();
            zoomQuanh(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX - b.left, e.clientY - b.top);
          }}
          onPointerDownCapture={(e) => {
            diem.current.set(e.pointerId, viTri(e));
            if (diem.current.size !== 2) return;
            // Ngón thứ hai chạm: chuyển sang chụm. Con trỏ đầu có thể đang kéo một tòa — giật lại về bản vẽ để tòa không bị kéo theo.
            const [a, b] = [...diem.current.values()], ids = [...diem.current.keys()];
            cuChi.current = { loai: 'chum', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, w: vRef.current.w, cx: vRef.current.cx, cy: vRef.current.cy };
            try { svgRef.current?.setPointerCapture(ids[0]); } catch { /* con trỏ đã hết */ }
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            if (diem.current.size !== 1) return;
            try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
            batDauKeo(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!diem.current.has(e.pointerId)) return;
            diem.current.set(e.pointerId, viTri(e));
            const g = cuChi.current, { r, c } = ktRef.current;
            if (!g || !r) return;
            if (g.loai === 'chum' && diem.current.size >= 2) {
              const [a, b] = [...diem.current.values()];
              const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              const m0 = g.w / r, wx = g.cx + (g.mx - r / 2) * m0, wy = g.cy + (g.my - c / 2) * m0; // điểm thế giới dưới trung điểm lúc bắt đầu
              const w = kep((g.w * g.d0) / d), m1 = w / r;
              setV({ w, cx: wx - (mx - r / 2) * m1, cy: wy - (my - c / 2) * m1 });
            } else if (g.loai === 'keo' && diem.current.size === 1) {
              const p = diem.current.get(e.pointerId)!, m = vRef.current.w / r;
              setV((o) => ({ ...o, cx: g.cx - (p.x - g.x) * m, cy: g.cy - (p.y - g.y) * m }));
            }
          }}
          onPointerUp={(e) => ketThuc(e.pointerId)}
          onPointerCancel={(e) => ketThuc(e.pointerId)}
        >
          {children}
        </svg>
      )}
      <div class="ban-ve-phu" aria-hidden="true">
        <div class="thuoc-ty-le" style={{ width: `${Math.max(doDai, 0)}px` }}>
          <span>{tyLeM >= 1000 ? `${tyLeM / 1000} km` : `${tyLeM} m`}</span>
        </div>
        <svg class="hoa-gio" viewBox="-32 -32 64 64" width="56" height="56">
          <g transform={`rotate(${gocBac})`}>
            <circle r="26" fill="var(--panel)" fill-opacity=".85" stroke="var(--ink)" stroke-width="1" />
            <polygon points="0,-22 6,2 0,-3 -6,2" fill="var(--ink)" />
            <polygon points="0,22 -5,2 0,6 5,2" fill="none" stroke="var(--ink)" stroke-width="1" />
            <text x="0" y="-27.5" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink)" stroke="var(--panel)" stroke-width="2.5" paint-order="stroke">{t('ve.bac')}</text>
          </g>
        </svg>
      </div>
    </div>
  );

  function ketThuc(id: number) {
    diem.current.delete(id);
    const con = [...diem.current.keys()];
    if (con.length === 1) batDauKeo(con[0]); // rời một ngón khi đang chụm: tiếp tục di bằng ngón còn lại, không giật
    else if (!con.length) cuChi.current = null;
  }
}

/** Độ dài thước tỷ lệ "đẹp" (1, 2, 5 × 10ⁿ m) cỡ 1/8 chiều rộng khung nhìn. */
export function thuocTyLe(rongM: number): number {
  const muc = rongM / 8;
  const p = 10 ** Math.floor(Math.log10(muc));
  return [1, 2, 5, 10].map((k) => k * p).find((x) => x >= muc) ?? 10 * p;
}
