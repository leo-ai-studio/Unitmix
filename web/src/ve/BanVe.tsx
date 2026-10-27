import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { chayRaf, easeOutCubic, giamChuyenDong, tron } from '../ui/chuyenDong';
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
const MS_BAY = 240, HE_MA_SAT = 0.92, V_TOI_DA = 4; // thời gian bay (ms); quán tính ×0,92 mỗi frame 16,7 ms; vận tốc trôi tối đa (px/ms)

/** Khung nhìn trung gian: tâm nội suy tuyến tính, bề rộng theo tỷ lệ (phóng đều tay). */
export function noiSuyNhin(a: NhinThay, b: NhinThay, p: number): NhinThay {
  return { cx: tron(a.cx, b.cx, p), cy: tron(a.cy, b.cy, p), w: a.w * (b.w / a.w) ** p };
}

/** Phóng / thu hệ số k quanh điểm (px, py) trong ô r × c; điểm đó giữ nguyên vị trí trên màn hình. */
function zoomTu(o: NhinThay, r: number, c: number, k: number, px: number, py: number): NhinThay {
  const m0 = o.w / r, wx = o.cx + (px - r / 2) * m0, wy = o.cy + (py - c / 2) * m0;
  const w = kep(o.w * k), m1 = w / r;
  return { w, cx: wx - (px - r / 2) * m1, cy: wy - (py - c / 2) * m1 };
}

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
  const bay = useRef<() => void>(() => {}); // huỷ hoạt ảnh bay đang chạy
  const dich = useRef<NhinThay | null>(null); // đích của lần bay đang chạy (bấm Phóng liên tiếp thì cộng dồn)
  const troi = useRef(0); // rAF quán tính
  const rafV = useRef(0), chuaV = useRef<NhinThay | null>(null);
  const mau = useRef<{ x: number; y: number; t: number }[]>([]); // vài điểm kéo cuối để tính vận tốc
  const khoaTruoc = useRef('');
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
  /** Gán khung nhìn ngay (dùng trong hoạt ảnh). */
  const ganV = (n: NhinThay) => { vRef.current = n; setV(n); };
  /** Gán theo tay: ghi ref ngay, gộp setV một lần mỗi frame. */
  const datV = (n: NhinThay) => {
    vRef.current = n; chuaV.current = n;
    if (!rafV.current) rafV.current = requestAnimationFrame(() => { rafV.current = 0; if (chuaV.current) setV(chuaV.current); });
  };
  /** Dừng mọi hoạt ảnh (bay, quán tính): chạm / kéo / chụm / lăn mới phải bám tay ngay. */
  const huyDong = () => {
    bay.current(); bay.current = () => {}; dich.current = null;
    chuaV.current = null;
    cancelAnimationFrame(troi.current); troi.current = 0;
  };
  const bayToi = (d: NhinThay) => {
    huyDong();
    const a = vRef.current;
    dich.current = d;
    bay.current = chayRaf(MS_BAY, easeOutCubic, (p) => ganV(noiSuyNhin(a, d, p)), () => { dich.current = null; });
  };
  useEffect(() => () => { huyDong(); cancelAnimationFrame(rafV.current); }, []);
  useEffect(() => {
    if (!daDo) return;
    if (khoaTruoc.current && khoaTruoc.current !== khoa) bayToi(vuaKhung()); else ganV(vuaKhung()); // lần đầu có khung thì nhảy thẳng
    khoaTruoc.current = khoa;
  }, [khoa, daDo]);

  /** Lăn chuột: phóng / thu ngay quanh con trỏ (bám tay, không hoạt ảnh). */
  const zoomQuanh = (k: number, px: number, py: number) => {
    const { r, c } = ktRef.current;
    if (!r || !c) return;
    huyDong();
    datV(zoomTu(vRef.current, r, c, k, px, py));
  };
  /** Nút Phóng / Thu: bay tới đích, tính từ đích đang bay nếu có. */
  const zoomNut = (k: number) => {
    const { r, c } = ktRef.current;
    if (r && c) bayToi(zoomTu(dich.current ?? vRef.current, r, c, k, r / 2, c / 2));
  };
  const tyLeM = thuocTyLe(v.w);
  useEffect(() => {
    onDieuKhien?.({
      phong: () => zoomNut(1 / 1.25),
      thu: () => zoomNut(1.25),
      vuaKhung: () => bayToi(vuaKhung()),
      tyLeM,
    });
  }, [tyLeM, khoa]);

  const viTri = (e: PointerEvent) => {
    const b = hop.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const batDauKeo = (id: number) => {
    const p = diem.current.get(id);
    mau.current = [];
    if (p) cuChi.current = { loai: 'keo', x: p.x, y: p.y, cx: vRef.current.cx, cy: vRef.current.cy };
  };
  /** Thả tay khi đang kéo nhanh: trôi tiếp rồi chậm dần (×0,92 mỗi frame). */
  const troiTiep = (luc: number) => {
    const m = mau.current, b = m[m.length - 1];
    mau.current = [];
    if (!b || m.length < 2 || giamChuyenDong() || luc - b.t > 60) return; // dừng tay trước khi thả thì không trôi
    const a = m.find((x) => x !== b && b.t - x.t <= 100) ?? m[0], dt = b.t - a.t;
    if (dt <= 0) return;
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const toc = Math.hypot(vx, vy);
    if (toc < 0.15) return;
    if (toc > V_TOI_DA) { vx *= V_TOI_DA / toc; vy *= V_TOI_DA / toc; }
    let truoc = performance.now();
    const buoc = (now: number) => {
      const d = Math.min(now - truoc, 50), f = HE_MA_SAT ** (d / 16.7);
      truoc = now; vx *= f; vy *= f;
      if (Math.hypot(vx, vy) < 0.02 || !ktRef.current.r) { troi.current = 0; return; }
      const o = vRef.current, mm = o.w / ktRef.current.r;
      ganV({ ...o, cx: o.cx - vx * d * mm, cy: o.cy - vy * d * mm });
      troi.current = requestAnimationFrame(buoc);
    };
    troi.current = requestAnimationFrame(buoc);
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
            // Chuột cuộn theo dòng / trang (deltaMode 1 / 2) quy ra px; kẹp để một nấc không phóng vọt.
            const dy = Math.max(-100, Math.min(100, e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1)));
            zoomQuanh(Math.exp(dy * 0.0015), e.clientX - b.left, e.clientY - b.top);
          }}
          onPointerDownCapture={(e) => {
            huyDong();
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
              datV({ w, cx: wx - (mx - r / 2) * m1, cy: wy - (my - c / 2) * m1 });
            } else if (g.loai === 'keo' && diem.current.size === 1) {
              const p = diem.current.get(e.pointerId)!, m = vRef.current.w / r;
              mau.current = [...mau.current.slice(-3), { x: p.x, y: p.y, t: e.timeStamp }];
              datV({ ...vRef.current, cx: g.cx - (p.x - g.x) * m, cy: g.cy - (p.y - g.y) * m });
            }
          }}
          onPointerUp={(e) => ketThuc(e.pointerId, e.timeStamp)}
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

  function ketThuc(id: number, luc?: number) {
    const keo = cuChi.current?.loai === 'keo';
    diem.current.delete(id);
    const con = [...diem.current.keys()];
    if (con.length === 1) batDauKeo(con[0]); // rời một ngón khi đang chụm: tiếp tục di bằng ngón còn lại, không giật
    else if (!con.length) {
      cuChi.current = null;
      if (keo && luc !== undefined) troiTiep(luc);
    }
  }
}

/** Độ dài thước tỷ lệ "đẹp" (1, 2, 5 × 10ⁿ m) cỡ 1/8 chiều rộng khung nhìn. */
export function thuocTyLe(rongM: number): number {
  const muc = rongM / 8;
  const p = 10 ** Math.floor(Math.log10(muc));
  return [1, 2, 5, 10].map((k) => k * p).find((x) => x >= muc) ?? 10 * p;
}
