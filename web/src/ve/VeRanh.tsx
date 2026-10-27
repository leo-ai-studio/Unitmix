import { useEffect, useRef, useState } from 'preact/hooks';
import { batDiemRanh, dongRanhVe } from '../tinh/ham';
import type { Diem } from '../tinh/kieu';
import { s, sPoly } from './BanVe';

const BK_BAT_PX = 10, NGUONG_BAM_PX = 5; // bán kính bắt điểm; kéo quá ngưỡng này thì là di bản vẽ, không phải bấm

type Props = {
  /** Đang vẽ ranh mới (bấm đỉnh). */
  dangVe: boolean;
  pts: Diem[];
  con: Diem | null;
  /** Đỉnh ranh lô / chỉ giới để bắt điểm. */
  nut: Diem[];
  /** Ranh hầm đã cố định trong PA (null = theo lô): cho kéo đỉnh để sửa. */
  ranh: Diem[] | null;
  coChu: number;
  chiXem: boolean;
  onCon: (p: Diem | null) => void;
  onBam: (p: Diem) => void;
  onSuaRanh: (r: Diem[]) => void;
};

/** Lớp vẽ tay ranh hầm trong `BanVe` (con của SVG): bấm đỉnh, bắt điểm, xem trước cạnh; kéo đỉnh ranh cố định. Không cần sửa `BanVe`: nghe sự kiện trên chính SVG cha. */
export function VeRanh({ dangVe, pts, con, nut, ranh, coChu, chiXem, onCon, onBam, onSuaRanh }: Props) {
  const gRef = useRef<SVGGElement>(null);
  const [keo, setKeo] = useState<{ i: number; p: Diem } | null>(null);
  const keoRef = useRef(keo);
  keoRef.current = keo;
  const moiRef = useRef({ pts, nut, onCon, onBam });
  moiRef.current = { pts, nut, onCon, onBam };

  /** Toạ độ bản vẽ (m, y lên) của con trỏ và bán kính bắt điểm (m) theo tỷ lệ đang phóng. */
  const doi = (svg: SVGSVGElement, e: PointerEvent) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(m.inverse());
    return { p: [q.x, -q.y] as Diem, bk: BK_BAT_PX / Math.max(Math.hypot(m.a, m.b), 1e-9) };
  };
  const bat = (p: Diem, bk: number, bo?: Diem): Diem => {
    const ds = moiRef.current.pts.length >= 3 ? [moiRef.current.pts[0], ...moiRef.current.nut] : moiRef.current.nut;
    return batDiemRanh(p, bo ? ds.filter((q) => q !== bo) : ds, bk) ?? p;
  };

  useEffect(() => {
    const svg = gRef.current?.ownerSVGElement;
    if (!svg || !dangVe) return;
    let dau: { x: number; y: number } | null = null;
    const xuong = (e: PointerEvent) => { dau = e.button === 0 ? { x: e.clientX, y: e.clientY } : null; };
    const len = (e: PointerEvent) => {
      const o = doi(svg, e);
      if (o) moiRef.current.onCon(bat(o.p, o.bk));
    };
    const len2 = (e: PointerEvent) => {
      const d = dau;
      dau = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > NGUONG_BAM_PX) return;
      const o = doi(svg, e);
      if (o) moiRef.current.onBam(bat(o.p, o.bk));
    };
    const roi = () => moiRef.current.onCon(null);
    svg.addEventListener('pointerdown', xuong);
    svg.addEventListener('pointermove', len);
    svg.addEventListener('pointerup', len2);
    svg.addEventListener('pointerleave', roi);
    const cu = svg.style.cursor;
    return () => {
      svg.removeEventListener('pointerdown', xuong);
      svg.removeEventListener('pointermove', len);
      svg.removeEventListener('pointerup', len2);
      svg.removeEventListener('pointerleave', roi);
      svg.style.cursor = cu;
    };
  }, [dangVe]);

  const dsDinh = dangVe ? pts : [];
  const dinhCuoi = dsDinh[dsDinh.length - 1];
  const r = coChu * 0.45;
  const nhan = (a: Diem, b: Diem, k: string) => (
    <text key={k} x={(a[0] + b[0]) / 2} y={-(a[1] + b[1]) / 2 - r * 1.2} text-anchor="middle" font-size={coChu * 0.75} class="ve-ranh-dai">{Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(2)}</text>
  );
  const sua = !dangVe && !chiXem && ranh ? ranh : null;
  const hienSua = sua && keo ? sua.map((q, i) => (i === keo.i ? keo.p : q)) : sua;

  return (
    <g class="ham-ve ve-ranh" ref={gRef}>
      {dangVe && dsDinh.length > 0 && (
        <>
          <polyline class="ve-ranh-net" points={dsDinh.map(s).join(' ')} vector-effect="non-scaling-stroke" />
          {con && <polyline class="ve-ranh-tam" points={`${s(dinhCuoi)} ${s(con)}${dsDinh.length >= 3 ? ` ${s(dsDinh[0])}` : ''}`} vector-effect="non-scaling-stroke" />}
          {dsDinh.slice(1).map((q, i) => nhan(dsDinh[i], q, `d${i}`))}
          {con && nhan(dinhCuoi, con, 'dc')}
          {dsDinh.map((q, i) => <circle key={i} class={i === 0 ? 've-ranh-dinh dau' : 've-ranh-dinh'} cx={q[0]} cy={-q[1]} r={i === 0 ? r * 1.3 : r} vector-effect="non-scaling-stroke" />)}
        </>
      )}
      {dangVe && con && <circle class="ve-ranh-bat" cx={con[0]} cy={-con[1]} r={r * 1.6} vector-effect="non-scaling-stroke" />}
      {hienSua && (
        <>
          {keo && <polygon class="ve-ranh-tam" points={sPoly(hienSua)} vector-effect="non-scaling-stroke" />}
          {hienSua.map((q, i) => (
            <circle key={i} class="ve-ranh-dinh sua" cx={q[0]} cy={-q[1]} r={r * 1.2} vector-effect="non-scaling-stroke"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* con trỏ đã hết */ }
                setKeo({ i, p: sua![i] });
              }}
              onPointerMove={(e) => {
                const k = keoRef.current, svg = (e.currentTarget as SVGElement).ownerSVGElement;
                if (!k || k.i !== i || !svg) return;
                const o = doi(svg, e);
                if (o) setKeo({ i, p: batDiemRanh(o.p, nut, o.bk) ?? o.p });
              }}
              onPointerUp={() => {
                const k = keoRef.current;
                setKeo(null);
                if (!k || k.i !== i) return;
                const moi = dongRanhVe(sua!.map((q, j) => (j === i ? k.p : q)));
                if (moi) onSuaRanh(moi.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]));
              }}
              onPointerCancel={() => setKeo(null)} />
          ))}
        </>
      )}
    </g>
  );
}
