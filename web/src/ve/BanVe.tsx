import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { chayRaf, easeOutCubic, giamChuyenDong, tron } from '../ui/chuyenDong';
import type { Diem } from '../tinh/kieu';
import { batDauChum, bienDoi, kepW, laChamDup, MS_GIU, nguongRun, nhinKhiChum, nhinKhiKeo, phanLoai, zoomTu, type DiemCham, type GocChum, type NhinThay } from './camUng';

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
  /** Bấm (không kéo) lên nền bản vẽ: điểm bấm theo mét (y lên). Bấm lên phần tử con đã chặn sự kiện thì không gọi. */
  onBamNen?: (p: Diem, e: PointerEvent) => void;
  /**
   * Chọn bằng khung: `bat` = kéo nền vẽ khung thay vì di bản vẽ (chế độ cảm ứng); giữ Shift khi kéo nền cũng vẽ khung.
   * `onXong(a, b, them)` nhận hai góc theo mét; `them` = giữ Shift / Ctrl (thêm vào lựa chọn).
   */
  chonKhung?: { bat: boolean; onXong: (a: Diem, b: Diem, them: boolean) => void };
};

type CuChi =
  | { loai: 'keo'; x: number; y: number; v0: NhinThay }
  | { loai: 'khung'; x: number; y: number; them: boolean }
  | { loai: 'chum'; g: GocChum };
/** Một lượt chạm (từ ngón đầu đặt xuống tới khi nhấc hết): để nhận chạm / chạm hai lần / nhấn giữ. */
type LuotCham = { id: number; x: number; y: number; cx: number; cy: number; t: number; kieu: string; xa: number; soNgon: number; giu: boolean; hen: number };

const kep = kepW;
const MS_BAY = 240, HE_MA_SAT = 0.92, V_TOI_DA = 4; // thời gian bay (ms); quán tính ×0,92 mỗi frame 16,7 ms; vận tốc trôi tối đa (px/ms)

/** Khung nhìn trung gian: tâm nội suy tuyến tính, bề rộng theo tỷ lệ (phóng đều tay). */
export function noiSuyNhin(a: NhinThay, b: NhinThay, p: number): NhinThay {
  return { cx: tron(a.cx, b.cx, p), cy: tron(a.cy, b.cy, p), w: a.w * (b.w / a.w) ** p };
}

/** Phát sự kiện chuột giả lên phần tử dưới điểm chạm (chạm hai lần → dblclick, nhấn giữ → contextmenu): con của bản vẽ dùng lại đúng handler chuột. */
function phatChuot(loai: 'dblclick' | 'contextmenu', x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  el?.dispatchEvent(new MouseEvent(loai, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: loai === 'contextmenu' ? 2 : 0, detail: loai === 'dblclick' ? 2 : 0, view: window }));
}

/**
 * Bản vẽ SVG theo mét. Khung cố định theo ô chứa (không phình theo nội dung); thước tỷ lệ và hoa gió là lớp phủ đứng yên.
 * Chuột: kéo để di, lăn để phóng quanh con trỏ. Cảm ứng (`ve/camUng.ts`): một ngón kéo nền để dời, hai ngón chụm để phóng / thu
 * quanh điểm giữa hai ngón (bám tay 1:1: chỉ đổi CSS transform trong rAF, nhấc tay mới vẽ lại SVG); chạm = bấm, chạm hai lần = bấm đúp
 * (dblclick), nhấn giữ = menu ngữ cảnh (contextmenu) — phát lên phần tử dưới ngón để con (tòa, lô, ô căn) dùng lại handler chuột.
 */
export function BanVe({ khung, children, nhan, onDieuKhien, gocBac = 0, onBamNen, chonKhung }: Props) {
  const goc = khung ?? [0, 0, 100, 60];
  const hop = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [kt, setKt] = useState({ r: 0, c: 0 }); // rộng × cao của ô chứa (px)
  const [v, setV] = useState<NhinThay>({ cx: 0, cy: 0, w: 100 });
  const vRef = useRef(v), ktRef = useRef(kt);
  const daVe = useRef(v); // khung nhìn SVG đang vẽ (viewBox); khác vRef khi đang bám tay bằng transform
  if (daVe.current !== v) { daVe.current = v; vRef.current = v; }
  ktRef.current = kt;
  const rafTay = useRef(0);
  const luotCham = useRef<LuotCham | null>(null);
  const chamTruoc = useRef<DiemCham | null>(null); // lần chạm trước (nhận chạm hai lần)
  const kieuTro = useRef('mouse');
  const diem = useRef(new Map<number, { x: number; y: number }>());
  const cuChi = useRef<CuChi | null>(null);
  const bay = useRef<() => void>(() => {}); // huỷ hoạt ảnh bay đang chạy
  const dich = useRef<NhinThay | null>(null); // đích của lần bay đang chạy (bấm Phóng liên tiếp thì cộng dồn)
  const troi = useRef(0); // rAF quán tính
  const rafV = useRef(0), chuaV = useRef<NhinThay | null>(null);
  const mau = useRef<{ x: number; y: number; t: number }[]>([]); // vài điểm kéo cuối để tính vận tốc
  const khoaTruoc = useRef('');
  const [hcn, setHcn] = useState<[number, number, number, number] | null>(null); // khung chọn đang kéo (px trong ô chứa)
  const batDauNen = useRef<{ x: number; y: number; xa: number } | null>(null); // điểm bấm nền + quãng đã đi xa nhất (px) để nhận "bấm"
  /** Điểm px trong ô chứa → mét (y lên) theo khung nhìn hiện tại. */
  const raMet = (px: number, py: number): Diem => {
    const { r, c } = ktRef.current, o = vRef.current, m = o.w / (r || 1);
    return [o.cx + (px - r / 2) * m, -(o.cy + (py - c / 2) * m)];
  };
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
  /** viewBox của khung nhìn n theo ô chứa hiện tại. */
  const hopNhin = (n: NhinThay) => {
    const { r, c } = ktRef.current, hh = r ? (n.w * c) / r : 0;
    return `${n.cx - n.w / 2} ${n.cy - hh / 2} ${n.w} ${hh}`;
  };
  /** Bám tay (kéo / chụm / quán tính): ghi ref, mỗi frame chỉ đổi CSS transform của SVG — không vẽ lại cây SVG. */
  const datTay = (n: NhinThay) => {
    vRef.current = n;
    if (rafTay.current) return;
    rafTay.current = requestAnimationFrame(() => {
      rafTay.current = 0;
      const el = svgRef.current, r = ktRef.current.r;
      if (!el || !r) return;
      const { tx, ty, s } = bienDoi(daVe.current, vRef.current, r);
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    });
  };
  /** Nhấc tay: vẽ lại SVG theo khung nhìn cuối (đặt viewBox ngay trên DOM để toạ độ màn hình ↔ mét đúng liền), bỏ transform. */
  const chot = () => {
    cancelAnimationFrame(rafTay.current); rafTay.current = 0;
    const n = vRef.current, el = svgRef.current;
    if (n === daVe.current) { if (el) el.style.transform = ''; return; }
    if (el) { el.setAttribute('viewBox', hopNhin(n)); el.style.transform = ''; }
    daVe.current = n;
    setV(n);
  };
  /** Dừng mọi hoạt ảnh (bay, quán tính): chạm / kéo / chụm / lăn mới phải bám tay ngay. */
  const huyDong = () => {
    bay.current(); bay.current = () => {}; dich.current = null;
    chuaV.current = null;
    cancelAnimationFrame(troi.current); troi.current = 0;
    chot();
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
    if (p) cuChi.current = { loai: 'keo', x: p.x, y: p.y, v0: vRef.current };
  };
  /** Thả tay khi đang kéo nhanh: trôi tiếp rồi chậm dần (×0,92 mỗi frame). */
  const troiTiep = (luc: number) => {
    const m = mau.current, b = m[m.length - 1];
    mau.current = [];
    if (!b || m.length < 2 || giamChuyenDong() || luc - b.t > 60) return chot(); // dừng tay trước khi thả thì không trôi
    const a = m.find((x) => x !== b && b.t - x.t <= 100) ?? m[0], dt = b.t - a.t;
    if (dt <= 0) return chot();
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const toc = Math.hypot(vx, vy);
    if (toc < 0.15) return chot();
    if (toc > V_TOI_DA) { vx *= V_TOI_DA / toc; vy *= V_TOI_DA / toc; }
    let truoc = performance.now();
    const buoc = (now: number) => {
      const d = Math.min(now - truoc, 50), f = HE_MA_SAT ** (d / 16.7);
      truoc = now; vx *= f; vy *= f;
      if (Math.hypot(vx, vy) < 0.02 || !ktRef.current.r) { troi.current = 0; chot(); return; }
      datTay(nhinKhiKeo(vRef.current, vx * d, vy * d, ktRef.current.r));
      troi.current = requestAnimationFrame(buoc);
    };
    troi.current = requestAnimationFrame(buoc);
  };

  /** Nhấn giữ một ngón đủ lâu không đi: dừng dời bản vẽ, mở menu ngữ cảnh của phần tử dưới ngón; nhấc tay không tính là bấm. */
  const nhanGiu = (l: LuotCham) => {
    if (luotCham.current !== l || l.soNgon > 1 || l.xa > nguongRun(l.kieu) || !diem.current.has(l.id)) return;
    l.giu = true;
    cuChi.current = null; mau.current = [];
    chot();
    // nhấc tay sau nhấn giữ trình duyệt vẫn phát click — trúng mục menu vừa mở ngay dưới ngón. Nuốt đúng một click đó (ở cửa sổ),
    // bỏ nuốt khi có lần đặt ngón mới hoặc quá 1,5 s.
    const thoi = () => { removeEventListener('click', nuot, true); removeEventListener('pointerdown', thoi, true); clearTimeout(hen); };
    const nuot = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); thoi(); };
    const hen = window.setTimeout(thoi, 1500);
    addEventListener('click', nuot, true);
    addEventListener('pointerdown', thoi, true);
    chamTruoc.current = null;
    navigator.vibrate?.(12);
    phatChuot('contextmenu', l.cx, l.cy);
  };
  /** Cảm ứng: trình duyệt cũng tự phát contextmenu (giữ) / dblclick (chạm hai lần) — bỏ bản gốc, chỉ giữ bản do BanVe phát cho khỏi mở hai lần. */
  const chanGoc = (e: Event) => {
    if (e.isTrusted && kieuTro.current !== 'mouse') { e.preventDefault(); e.stopPropagation(); }
  };

  const h = kt.r ? (v.w * kt.c) / kt.r : 0;
  const pxMoiMet = kt.r && v.w ? kt.r / v.w : 0;
  const doDai = tyLeM * pxMoiMet;
  return (
    <div class="ban-ve" ref={hop} onContextMenuCapture={chanGoc} onDblClickCapture={chanGoc}>
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
            kieuTro.current = e.pointerType;
            const p = viTri(e);
            diem.current.set(e.pointerId, p);
            if (diem.current.size === 1) {
              // lượt chạm mới: hẹn nhấn giữ (ngón / bút) — đứng yên đủ lâu thì mở menu ngữ cảnh của phần tử dưới ngón
              const l: LuotCham = { id: e.pointerId, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, t: e.timeStamp, kieu: e.pointerType, xa: 0, soNgon: 1, giu: false, hen: 0 };
              if (e.pointerType !== 'mouse') l.hen = window.setTimeout(() => nhanGiu(l), MS_GIU);
              clearTimeout(luotCham.current?.hen);
              luotCham.current = l;
            }
            if (diem.current.size !== 2) return;
            // Ngón thứ hai chạm: chuyển sang chụm. Con trỏ đầu có thể đang kéo một tòa — giật lại về bản vẽ để tòa không bị kéo theo.
            if (luotCham.current) { luotCham.current.soNgon = 2; clearTimeout(luotCham.current.hen); }
            const [a, b] = [...diem.current.values()], ids = [...diem.current.keys()];
            cuChi.current = { loai: 'chum', g: batDauChum(vRef.current, a, b) };
            batDauNen.current = null;
            try { svgRef.current?.setPointerCapture(ids[0]); } catch { /* con trỏ đã hết */ }
            e.stopPropagation();
          }}
          onPointerMoveCapture={(e) => {
            const l = luotCham.current;
            if (!l || l.id !== e.pointerId) return;
            const p = viTri(e);
            l.xa = Math.max(l.xa, Math.hypot(p.x - l.x, p.y - l.y));
            if (l.xa > nguongRun(l.kieu)) clearTimeout(l.hen);
            // đã nhấn giữ (menu đang mở): ngón đi tiếp không kéo tòa / căn, không dời bản vẽ
            if (l.giu) e.stopPropagation();
          }}
          onPointerUpCapture={(e) => {
            const l = luotCham.current;
            if (!l || l.id !== e.pointerId) return;
            clearTimeout(l.hen);
            if (l.giu || l.kieu === 'mouse') return;
            const p = viTri(e), nay = { x: p.x, y: p.y, t: e.timeStamp };
            if (phanLoai(l, nay, l.xa, l.soNgon, l.kieu) !== 'cham') { chamTruoc.current = null; return; }
            if (laChamDup(chamTruoc.current, nay)) {
              chamTruoc.current = null;
              const x = e.clientX, y = e.clientY;
              setTimeout(() => phatChuot('dblclick', x, y), 0); // sau click của lần chạm thứ hai, như chuột
            } else chamTruoc.current = nay;
          }}
          onPointerDown={(e) => {
            if (diem.current.size !== 1) return;
            try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
            const p0 = viTri(e);
            batDauNen.current = { x: p0.x, y: p0.y, xa: 0 };
            if (chonKhung && (chonKhung.bat || e.shiftKey) && e.button === 0) {
              cuChi.current = { loai: 'khung', x: p0.x, y: p0.y, them: e.shiftKey || e.ctrlKey || e.metaKey };
              setHcn([p0.x, p0.y, p0.x, p0.y]);
              return;
            }
            batDauKeo(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!diem.current.has(e.pointerId)) return;
            diem.current.set(e.pointerId, viTri(e));
            const g = cuChi.current, { r, c } = ktRef.current;
            const bn = batDauNen.current, pm = diem.current.get(e.pointerId)!;
            if (bn) bn.xa = Math.max(bn.xa, Math.hypot(pm.x - bn.x, pm.y - bn.y));
            if (!g || !r) return;
            if (g.loai === 'khung') { setHcn([g.x, g.y, pm.x, pm.y]); return; }
            if (g.loai === 'chum' && diem.current.size >= 2) {
              const [a, b] = [...diem.current.values()];
              datTay(nhinKhiChum(g.g, a, b, r, c));
            } else if (g.loai === 'keo' && diem.current.size === 1) {
              const p = diem.current.get(e.pointerId)!;
              mau.current = [...mau.current.slice(-3), { x: p.x, y: p.y, t: e.timeStamp }];
              datTay(nhinKhiKeo(g.v0, p.x - g.x, p.y - g.y, r));
            }
          }}
          onPointerUp={(e) => {
            const g = cuChi.current, bn = batDauNen.current, p = diem.current.get(e.pointerId) ?? viTri(e);
            batDauNen.current = null;
            if (g?.loai === 'khung') {
              setHcn(null);
              cuChi.current = null; diem.current.delete(e.pointerId);
              if (Math.hypot(p.x - g.x, p.y - g.y) >= 4) chonKhung?.onXong(raMet(g.x, g.y), raMet(p.x, p.y), g.them);
              else onBamNen?.(raMet(p.x, p.y), e);
              return;
            }
            if (g?.loai === 'keo' && bn && bn.xa <= nguongRun(e.pointerType) && diem.current.size === 1 && !luotCham.current?.giu) onBamNen?.(raMet(p.x, p.y), e);
            ketThuc(e.pointerId, e.timeStamp);
          }}
          onPointerCancel={(e) => { if (cuChi.current?.loai === 'khung') { setHcn(null); cuChi.current = null; } batDauNen.current = null; ketThuc(e.pointerId); }}
        >
          {children}
        </svg>
      )}
      {hcn && (
        <div class="ban-ve-khung-chon" aria-hidden="true"
          style={{ left: `${Math.min(hcn[0], hcn[2])}px`, top: `${Math.min(hcn[1], hcn[3])}px`, width: `${Math.abs(hcn[2] - hcn[0])}px`, height: `${Math.abs(hcn[3] - hcn[1])}px` }} />
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
      if (keo && luc !== undefined) troiTiep(luc); else chot();
    }
  }
}

/** Độ dài thước tỷ lệ "đẹp" (1, 2, 5 × 10ⁿ m) cỡ 1/8 chiều rộng khung nhìn. */
export function thuocTyLe(rongM: number): number {
  const muc = rongM / 8;
  const p = 10 ** Math.floor(Math.log10(muc));
  return [1, 2, 5, 10].map((k) => k * p).find((x) => x >= muc) ?? 10 * p;
}
