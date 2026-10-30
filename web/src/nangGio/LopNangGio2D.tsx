/**
 * Lớp 2D của gói Vị trí · Nắng · Gió, đặt làm con ĐẦU TIÊN của `<BanVe>` TMB (nằm dưới mọi nét):
 * - ảnh vệ tinh / bản đồ nền theo toạ độ dự án + góc Bắc (ô XYZ chỉ những ô thấy được, mức zoom theo tỷ lệ đang xem, thêm một lớp thô
 *   z − 3 lót dưới để không lộ lỗ khi ô mới chưa về; SVG `<image>`: trình duyệt giải mã ảnh ngoài luồng chính, bám tay theo transform
 *   của bản vẽ khi kéo / chụm, chỉ tính lại danh sách ô khi viewBox đổi);
 * - ảnh lớp phân tích (giờ nắng / tiện nghi gió) + đường dòng gió, số đọc dưới con trỏ;
 * - chế độ chọn điểm trên bản vẽ (khớp hai điểm) — bắt ở pha capture, không đụng thao tác TMB;
 * - dòng ghi nguồn ảnh (bắt buộc theo điều khoản) đặt trong khung bản vẽ.
 */
import { createPortal } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Diem, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { huongTia, matTroi } from '../tinh/matTroi';
import { daGiacBong } from '../tinh/nangGio/gioNang';
import { khoiPA } from '../tinh/nangGio/khoiPA';
import { chonMuc, khungLl, khungODat, oPhu, viTriPA, type ODb, type ViTri } from '../tinh/viTri';
import { datNG, layNG, useNG } from './kho';
import { anhPhanTich, docTai } from './hienThi';
import { anhTuRgba } from './mau';
import { banQuyenGoogle, mauO, type MauO } from './nguonBanDo';

type Nhin = { x: number; y: number; w: number; h: number; px: number };

function useNhin(g: { current: SVGGElement | null }): Nhin | null {
  const [n, setN] = useState<Nhin | null>(null);
  useEffect(() => {
    const svg = g.current?.ownerSVGElement;
    if (!svg) return;
    const doc = () => {
      const vb = svg.viewBox.baseVal, px = svg.clientWidth;
      if (!vb || !vb.width || !px) return;
      setN((o) => (o && o.x === vb.x && o.y === vb.y && o.w === vb.width && o.h === vb.height && o.px === px ? o : { x: vb.x, y: vb.y, w: vb.width, h: vb.height, px }));
    };
    doc();
    const mo = new MutationObserver(doc);
    mo.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(doc) : null;
    ro?.observe(svg);
    return () => { mo.disconnect(); ro?.disconnect(); };
  }, [g.current]);
  return n;
}

/** Ma trận SVG đưa hệ (Đông, −Bắc) quanh neo sang toạ độ SVG bản vẽ (x, −y). */
const maTran = (v: ViTri) => {
  const r = (v.gocBac * Math.PI) / 180, c = Math.cos(r) / v.tyLe, s = Math.sin(r) / v.tyLe;
  return `matrix(${c} ${-s} ${s} ${c} ${v.neo[0]} ${-v.neo[1]})`;
};

function OBanDo({ vt, nhin, m, doMo }: { vt: ViTri; nhin: Nhin; m: MauO; doMo: number }) {
  const ds = useMemo(() => {
    const goc: Diem[] = [[nhin.x, -nhin.y], [nhin.x + nhin.w, -nhin.y], [nhin.x, -(nhin.y + nhin.h)], [nhin.x + nhin.w, -(nhin.y + nhin.h)]];
    const k = khungLl(goc, vt, 0);
    const mpp = (nhin.w / nhin.px) * vt.tyLe / Math.min(2, Math.max(1, devicePixelRatio || 1));
    let z = chonMuc(mpp, vt.lat, 3, m.zMax), o: ODb[] = [];
    while (z > 3 && !(o = oPhu(k, z, 120)).length) z--;
    const zt = Math.max(3, z - 3), lot = oPhu(k, zt, 60);
    return { k, z, o, lot };
  }, [nhin, vt.lat, vt.lng, vt.gocBac, vt.tyLe, vt.neo[0], vt.neo[1], m]);
  const [ghi, setGhi] = useState(m.ghi);
  useEffect(() => {
    let huy = false;
    if (m.google) banQuyenGoogle(m, ds.z, ds.k).then((s) => !huy && setGhi(s)); else setGhi(m.ghi);
    datNG({ ghiNguon: m.google ? 'Google' : m.ghi });
    return () => { huy = true; };
  }, [m, ds.z, Math.round(ds.k.w * 1e3), Math.round(ds.k.n * 1e3)]);
  useEffect(() => { if (ghi !== layNG().ghiNguon) datNG({ ghiNguon: ghi }); }, [ghi]);
  const anh = (o: ODb, lot: boolean) => {
    const { tb, dn } = khungODat(o, vt), w = dn[0] - tb[0], h = tb[1] - dn[1], e = w * 0.004; // chồng 0,4 % khỏi khe
    return <image key={`${lot ? 'l' : ''}${o.z}/${o.x}/${o.y}`} href={m.url(o.z, o.x, o.y)} x={tb[0] - e} y={-tb[1] - e} width={w + 2 * e} height={h + 2 * e} preserveAspectRatio="none" />;
  };
  return (
    <g class="ng-ban-do" transform={maTran(vt)} opacity={doMo} style={{ pointerEvents: 'none' }}>
      {ds.lot.map((o) => anh(o, true))}
      {ds.o.map((o) => anh(o, false))}
    </g>
  );
}

function LopAnh() {
  const s = useNG((t) => ({ lop: t.lop, hien2D: t.hien2D, kqN: t.nang.kq, kqG: t.gio.kq, gioXem: t.gioXem, dongGio: t.dongGio }));
  const a = s.hien2D ? anhPhanTich() : null;
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!a) { setUrl(''); return; }
    let huy = false, u = '';
    anhTuRgba(a.rgba, a.luoi.nx, a.luoi.ny).then((x) => { u = x; if (huy) URL.revokeObjectURL(x); else setUrl(x); });
    return () => { huy = true; if (u) setTimeout(() => URL.revokeObjectURL(u), 1000); };
  }, [a?.rgba]);
  if (!a || !url) return null;
  const L = a.luoi;
  const dong = s.lop === 'gio' && s.dongGio && s.kqG ? s.kqG.dong : [];
  return (
    <g class="ng-phan-tich" style={{ pointerEvents: 'none' }}>
      <image href={url} x={L.x0} y={-(L.y0 + L.ny * L.buoc)} width={L.nx * L.buoc} height={L.ny * L.buoc} preserveAspectRatio="none" style={{ imageRendering: 'auto' }} />
      {dong.length > 0 && (
        <g fill="none" stroke="var(--ink)" stroke-opacity="0.55" stroke-width="1" vector-effect="non-scaling-stroke">
          {dong.map((d, i) => <polyline key={i} points={d.map(([x, y]) => `${x},${-y}`).join(' ')} vector-effect="non-scaling-stroke" />)}
        </g>
      )}
    </g>
  );
}

/** Lớp 2D (đặt trong `<BanVe>`). Không có gì bật thì không vẽ gì, không nghe sự kiện. */
export function LopNangGio2D({ pa, tv }: { pa: TrangThaiPA; tv: ThuVien | null }) {
  const g = useRef<SVGGElement>(null);
  const s = useNG((t) => ({ banDo2D: t.banDo2D, doMo: t.doMo, nguon: t.nguon, chonDiem: t.chonDiem, lop: t.lop, ghi: t.ghiNguon, A: t.diemA, B: t.diemB, moHop: t.moHop, tab: t.tab, bong: t.bong2D }));
  const nhin = useNhin(g);
  const vt = viTriPA(pa);
  const [m, setM] = useState<MauO | null>(null);
  useEffect(() => { let huy = false; mauO(s.nguon).then((x) => !huy && setM(x)); return () => { huy = true; }; }, [s.nguon]);
  const svg = g.current?.ownerSVGElement ?? null;
  // điểm SVG → mét bản vẽ
  const raMet = (e: PointerEvent): Diem | null => {
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, -p.y];
  };
  // chọn điểm (khớp hai điểm): bắt pointerdown pha capture trên svg, chặn TMB nhận
  useEffect(() => {
    if (!svg || !s.chonDiem) return;
    const bat = (e: PointerEvent) => {
      const p = raMet(e);
      if (!p) return;
      e.stopPropagation(); e.preventDefault();
      const k = layNG().chonDiem;
      datNG(k === 'a' ? { diemA: [+p[0].toFixed(2), +p[1].toFixed(2)], chonDiem: null } : { diemB: [+p[0].toFixed(2), +p[1].toFixed(2)], chonDiem: null });
    };
    svg.addEventListener('pointerdown', bat, true);
    svg.style.cursor = 'crosshair';
    return () => { svg.removeEventListener('pointerdown', bat, true); svg.style.cursor = ''; };
  }, [svg, s.chonDiem]);
  // số đọc dưới con trỏ (chuột): rAF, không chặn sự kiện
  useEffect(() => {
    if (!svg || !s.lop) return;
    let cho = 0, e0: PointerEvent | null = null;
    const di = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) { if (layNG().docSo) datNG({ docSo: null }); return; }
      e0 = e;
      if (cho) return;
      cho = requestAnimationFrame(() => {
        cho = 0;
        const p = e0 && raMet(e0), chu = p ? docTai(p) : null, r = svg.getBoundingClientRect();
        datNG({ docSo: chu && e0 ? { x: e0.clientX - r.left, y: e0.clientY - r.top, chu } : null });
      });
    };
    const roi = () => datNG({ docSo: null });
    svg.addEventListener('pointermove', di);
    svg.addEventListener('pointerleave', roi);
    return () => { cancelAnimationFrame(cho); svg.removeEventListener('pointermove', di); svg.removeEventListener('pointerleave', roi); };
  }, [svg, s.lop]);
  const coBanDo = s.banDo2D && vt.coToaDo && m && nhin;
  const coPhanTich = !!s.lop || (s.moHop && s.tab === 'nang' && s.bong);
  // ô đất tô đặc che ảnh nền / lớp phân tích (nằm dưới): làm trong bớt nền ô đất khi có lớp (CSS styles/nang-gio.css)
  useEffect(() => {
    if (!svg) return;
    svg.classList.toggle('co-ban-do', !!coBanDo);
    svg.classList.toggle('co-phan-tich', coPhanTich);
    return () => { svg.classList.remove('co-ban-do', 'co-phan-tich'); };
  }, [svg, !!coBanDo, coPhanTich]);
  const hop = svg?.parentElement;
  const dauDiem = (p: Diem | null, nhan: string) => p && (
    <g key={nhan} style={{ pointerEvents: 'none' }}>
      <circle cx={p[0]} cy={-p[1]} r={nhin ? (nhin.w / nhin.px) * 6 : 1} fill="var(--warn)" stroke="var(--panel)" stroke-width="2" vector-effect="non-scaling-stroke" />
      <text x={p[0]} y={-p[1]} dx={nhin ? (nhin.w / nhin.px) * 9 : 1} font-size={nhin ? (nhin.w / nhin.px) * 13 : 3} font-weight="700" fill="var(--warn)" stroke="var(--panel)" stroke-width={nhin ? (nhin.w / nhin.px) * 3 : 0.5} paint-order="stroke">{nhan}</text>
    </g>
  );
  return (
    <g ref={g} class="lop-nang-gio">
      {coBanDo && <OBanDo vt={vt} nhin={nhin} m={m} doMo={s.doMo} />}
      <LopAnh />
      {s.moHop && s.tab === 'nang' && s.bong && tv && <Bong2D pa={pa} tv={tv} />}
      {s.moHop && dauDiem(s.A, 'A')}
      {s.moHop && dauDiem(s.B, 'B')}
      {hop && (coBanDo || s.lop) && createPortal(<GhiVaDoc coBanDo={!!coBanDo} />, hop)}
    </g>
  );
}

function GhiVaDoc({ coBanDo }: { coBanDo: boolean }) {
  const s = useNG((t) => ({ ghi: t.ghiNguon, doc: t.docSo }));
  return (
    <>
      {coBanDo && s.ghi && <div class="ng-ghi-nguon" role="note">{s.ghi}</div>}
      {s.doc && <div class="ng-doc-so" style={{ left: `${s.doc.x + 14}px`, top: `${s.doc.y + 14}px` }}>{s.doc.chu}</div>}
    </>
  );
}

/** Bóng đổ của các khối lúc giờ / ngày đang chọn (hoạt ảnh giờ chạy thì vẽ lại theo — vài chục đa giác, rẻ). */
function Bong2D({ pa, tv }: { pa: TrangThaiPA; tv: ThuVien }) {
  const s = useNG((t) => ({ ngay: t.ngay, luc: t.luc }), true); // gộp theo khung: kéo / ▶ giờ vẽ bóng tối đa một lần / khung
  const khoi = useMemo(() => khoiPA(pa, tv), [pa.lo, pa.toa, tv]);
  const vt = viTriPA(pa);
  const m = matTroi(vt.lat, vt.lng, s.ngay, s.luc);
  const ds = daGiacBong(khoi, huongTia(m, vt.gocBac));
  if (!ds.length) return null;
  return (
    <g class="ng-bong" opacity="0.42" style={{ pointerEvents: 'none' }}>
      {ds.map((p, i) => <polygon key={i} points={p.map(([x, y]) => `${x},${-y}`).join(' ')} fill="#1d2433" />)}
    </g>
  );
}
