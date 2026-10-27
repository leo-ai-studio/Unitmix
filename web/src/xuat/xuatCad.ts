/**
 * Xuất mặt bằng tầng điển hình ra CAD, hai đường như app cũ (docs: cad/tai_lieu/QUY_TRINH_XUAT_CAD.md):
 *  · `.scr`  — phiếu lệnh AutoCAD: SAVEAS, INSUNITS mm, attach XREF mẫu căn / lõi từ thư viện `cad/xref` theo đường dẫn TƯƠNG ĐỐI,
 *              cắt XCLIP theo mô-đun căn, vẽ nét bao DTXD. Chạy trong AutoCAD (lệnh SCRIPT) → ra `.dwg` ghép XREF.
 *  · `.dxf`  — một tệp đứng một mình: mỗi mẫu căn là một BLOCK (hình học nhúng, mm), mỗi vị trí là một INSERT (xoay / lật gương).
 * Hàm thuần, toàn bộ chữ trong tệp là ASCII (tệp .scr / .dxf đọc theo bảng mã hệ thống).
 */
import type { CongNangO, Diem, ThuVien } from '../tinh/kieu';
import { canDangDung, congNangTai, viTriCan, type BoCuc, type NetVe, type ToaCoMat } from '../tinh/matBang';

export const LE_CLIP_MM = 1200;
/** Thư mục thư viện XREF mặc định, tương đối so với thư mục đặt bản vẽ ghép. */
export const THU_VIEN_XREF_MAC_DINH = './xref';

export type DuLieuXuat = {
  mau: ToaCoMat & { duong_bao: Diem[]; hanhlang_ve?: Diem[][] };
  /** Bố cục MỘT tầng (dùng `boCucTang(toa, tang)`): đổi căn và công năng ô. */
  toa: BoCuc;
  tv: ThuVien;
  /** Tên bản vẽ đích (không đuôi). */
  ten: string;
  /** Thư mục thư viện XREF (chứa x-canho-bt, x-thang); đường dẫn tương đối. */
  goc: string;
  /** Nét vẽ chuẩn hoá của các mẫu căn đang dùng (cần cho khung căn V và cho DXF). */
  hinh: Map<string, NetVe[]>;
  /** Hình học lõi (mm cục bộ) theo tên block. */
  loi?: Map<string, { paths: NetVe[] }>;
};

const rad = (d: number) => (d * Math.PI) / 180;
/** Bỏ dấu, chỉ giữ ASCII in được: tên tệp và chú thích. */
export const asciiHoa = (s: string): string => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7E]/g, '-');
const f4 = (v: number) => (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4);
const dgBo = (p: string) => p.replace(/\/+$/, '');

/** Đường dẫn tương đối tới tệp thư viện của một phần tử trên mặt tòa; null nếu không có tệp. */
export function duongXref(loai: string, ten: string, goc: string): string | null {
  if (!ten) return null;
  return loai === 'can' ? `${dgBo(goc)}/x-canho-bt/${ten}.dwg` : `${dgBo(goc)}/x-thang/${ten}.dwg`;
}

/** Một lượt chèn XREF trên mặt bằng. */
export type LuotChen = { loai: string; ten: string; x: number; y: number; rot: number; sx: number; sy: number; sau: number; rong: number; khung?: [number, number, number, number] | null; no?: string };

/** Khung cắt cục bộ của căn có nét `khung` (căn góc tòa V): ô module HỢP khung bao của nét khung. */
export function khungCatCan(ve: NetVe[] | undefined, rong: number, sau: number): [number, number, number, number] | null {
  const k = ve?.find((n) => n.cat === 'khung' && n.pts.length >= 3);
  if (!k) return null;
  let b: [number, number, number, number] = [0, 0, rong, sau];
  for (const [x, y] of k.pts) b = [Math.min(b[0], x * rong), Math.min(b[1], y * sau), Math.max(b[2], x * rong), Math.max(b[3], y * sau)];
  return b;
}

/** Danh sách lượt chèn của tầng điển hình: căn theo mẫu đang dùng, lõi / thang bộ giữ nguyên. */
export function danhSachChen(d: DuLieuXuat): LuotChen[] {
  const vts = new Map(viTriCan(d.mau, d.tv, d.toa).map((v) => [v.khoa, v]));
  const kq: LuotChen[] = [];
  d.mau.mat.forEach((m, mi) => {
    m.phan_tu.forEach((q, i) => {
      if (q.loai === 'can') {
        const vt = vts.get(`${mi}:${i}`);
        if (!vt) return;
        if (congNangTai(vt.khoa, d.toa) !== 'can') return; // ô đổi công năng: không chèn XREF căn
        const id = canDangDung(vt, d.toa), c = d.tv.can.get(id);
        if (!c) return;
        const rong = vt.a1 - vt.a0;
        kq.push({ loai: 'can', ten: c.ma_goc, x: q.x, y: q.y, rot: q.rot, sx: q.sx < 0 ? -1 : 1, sy: 1, rong, sau: vt.sau, khung: khungCatCan(d.hinh.get(id), rong, vt.sau), no: id });
      } else {
        kq.push({ loai: q.loai, ten: q.block, x: q.x, y: q.y, rot: q.rot, sx: q.sx, sy: q.sy, rong: q.rong_mm, sau: q.sau_mm ?? 0 });
      }
    });
  });
  return kq;
}

/** Lớp khung + nhãn ô đổi công năng (SHCĐ, kỹ thuật, thương mại, trống). */
export const LOP_CONG_NANG = 'MDI-CONG-NANG';
const TEN_CONG_NANG: Record<Exclude<CongNangO, 'can'>, string> = { shcd: 'SHCD', ky_thuat: 'KY THUAT', thuong_mai: 'THUONG MAI', trong: 'O TRONG' };
export type OCongNang = { cn: Exclude<CongNangO, 'can'>; goc: Diem[]; x: number; y: number; ten: string; dt: string };

/** Các ô đổi công năng của tầng: khung 4 góc (mm, thế giới), tâm, tên ASCII và DT thông thủy của ô (như tính trong congNang.ts). */
export function oCongNang(d: DuLieuXuat): OCongNang[] {
  const kq: OCongNang[] = [];
  for (const vt of viTriCan(d.mau, d.tv)) {
    const cn = congNangTai(vt.khoa, d.toa);
    if (cn === 'can') continue;
    const dt = d.tv.can.get(canDangDung(vt, d.toa))?.dt_tt_m2;
    kq.push({
      cn, goc: vt.goc, x: vt.goc.reduce((a, p) => a + p[0], 0) / 4, y: vt.goc.reduce((a, p) => a + p[1], 0) / 4,
      ten: TEN_CONG_NANG[cn], dt: dt !== undefined && Number.isFinite(dt) ? `${dt.toFixed(1)} m2` : '-',
    });
  }
  return kq;
}

/** Lệnh LISP cắt XCLIP quanh mô-đun căn (lề 1200 mm). Căn song song trục: hình chữ nhật theo trục thế giới; lệch trục: xoay UCS cho khớp. */
export function lenhXclip(it: LuotChen): string | null {
  if (it.loai !== 'can' || !it.rong || !it.sau) return null;
  const kb = it.khung ?? [0, 0, it.rong, it.sau], le = LE_CLIP_MM;
  const t = rad(it.rot), u = [Math.cos(t), Math.sin(t)], nn = [-Math.sin(t), Math.cos(t)];
  const P2 = (x: number, y: number) => `'(${f4(x)} ${f4(y)} 0.0)`;
  const rotDeg = ((it.rot % 360) + 360) % 360;
  if (Math.abs(rotDeg % 90) <= 1e-6) {
    const g = (lx: number, ly: number): Diem => [it.x + it.sx * lx * u[0] + ly * nn[0], it.y + it.sx * lx * u[1] + ly * nn[1]];
    const q = [g(kb[0] - le, kb[1] - le), g(kb[2] + le, kb[1] - le), g(kb[2] + le, kb[3] + le), g(kb[0] - le, kb[3] + le)];
    return `(command "_.XCLIP" (entlast) "" "_N" "_R" ${P2(Math.min(...q.map((w) => w[0])), Math.min(...q.map((w) => w[1])))} ${P2(Math.max(...q.map((w) => w[0])), Math.max(...q.map((w) => w[1])))})`;
  }
  const xp = [it.x + it.sx * u[0], it.y + it.sx * u[1]], yp = [it.x + nn[0], it.y + nn[1]];
  return `(progn (command "_.UCS" ${P2(it.x, it.y)} ${P2(xp[0], xp[1])} ${P2(yp[0], yp[1])}) (command "_.XCLIP" (entlast) "" "_N" "_R" ${P2(kb[0] - le, kb[1] - le)} ${P2(kb[2] + le, kb[3] + le)}) (command "_.UCS" "_World"))`;
}

/** Phiếu `.scr` ghép XREF thành bản vẽ `.dwg` (mm). Mỗi phần tử mảng là một dòng. */
export function taoScr(d: DuLieuXuat): string {
  const L: string[] = [];
  const say = (s: string) => L.push(';; ' + asciiHoa(s));
  const ds = danhSachChen(d), tenDwg = asciiHoa(d.ten) + '.dwg';
  say('PHIEU LAP GHEP MAT BANG TU XREF - MDIUnitmix');
  say(`mau toa   : ${d.mau.id}`);
  const oc = oCongNang(d);
  say(`so luot   : ${ds.length} (${ds.filter((x) => x.loai === 'can').length} can)`);
  if (oc.length) say(`o cong nang: ${oc.length} (khung + nhan tren lop ${LOP_CONG_NANG}, khong chen XREF can)`);
  say(`thu vien  : ${d.goc} (duong dan TUONG DOI theo thu muc ban ve)`);
  say(`xuat ra   : ${tenDwg}`);
  say('CACH DUNG : dat tep .scr nay canh thu muc thu vien XREF; mo AutoCAD > lenh SCRIPT > chon tep .scr.');
  say('');
  L.push('FILEDIA', '0', 'EXPERT', '5', 'CMDDIA', '0');
  // LƯU TRƯỚC KHI ATTACH: đường dẫn tương đối được giải theo thư mục bản vẽ chủ.
  L.push('_SAVEAS', '', `"${tenDwg}"`);
  L.push('INSUNITS', '4', 'MEASUREMENT', '1', 'XCLIPFRAME', '0', 'GRIDMODE', '0', 'OSMODE', '0', 'ATTREQ', '0');
  for (const [ten, mau] of [['MDI-BAO', 1], ['MDI-HANHLANG', 30], ['MDI-NHAN', 2], ['MDI-XREF', 8]] as const) L.push('_-LAYER', '_M', ten, '_C', String(mau), ten, '');
  if (oc.length) L.push('_-LAYER', '_M', LOP_CONG_NANG, '_C', '5', LOP_CONG_NANG, '');
  L.push('_-LAYER', '_S', 'MDI-XREF', '');
  const thieu: string[] = [];
  let ncat = 0;
  for (const it of ds) {
    const p = duongXref(it.loai, it.ten, d.goc);
    if (!p) { thieu.push(it.ten); continue; }
    say(`${it.loai} - ${it.ten}`);
    L.push('_-XREF', '_A', `"${p}"`, `${f4(it.x)},${f4(it.y)}`, f4(it.sx), f4(it.sy), f4(it.rot));
    const c = lenhXclip(it);
    if (c) { L.push(c); ncat++; }
  }
  say(`da XCLIP ${ncat} luot chen theo mo-dun + le ${LE_CLIP_MM} mm`);
  if (thieu.length) say('!! THIEU DUONG DAN: ' + [...new Set(thieu)].join(' '));
  if (d.mau.duong_bao.length > 2) {
    say('net bao dien tich san');
    L.push('_-LAYER', '_S', 'MDI-BAO', '', '_.PLINE', ...d.mau.duong_bao.map((p) => `${f4(p[0])},${f4(p[1])}`), '_C');
  }
  if (oc.length) {
    say('o doi cong nang: khung + gach cheo + nhan');
    L.push('_-LAYER', '_S', LOP_CONG_NANG, '');
    for (const o of oc) {
      const g = o.goc.map((p) => `${f4(p[0])},${f4(p[1])}`);
      L.push('_.PLINE', ...g, '_C');
      L.push('_.LINE', g[0], g[2], '', '_.LINE', g[1], g[3], '');
      L.push('_.TEXT', '_J', '_MC', `${f4(o.x)},${f4(o.y + CAO_CHU_NHAN_MM * 0.7)}`, String(CAO_CHU_NHAN_MM), '0', o.ten);
      L.push('_.TEXT', '_J', '_MC', `${f4(o.x)},${f4(o.y - CAO_CHU_NHAN_MM * 0.7)}`, String(CAO_CHU_NHAN_MM), '0', o.dt);
    }
  }
  L.push('_.ZOOM', '_E', '_QSAVE');
  return L.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------------------------------------------- DXF

/** Lớp CAD theo loại nét của thư viện. */
export const LOP_THEO_NET: Record<string, [string, number]> = {
  wall: ['A-WALL', 7], door: ['A-DOOR', 3], rail: ['A-RAIL', 4], equip: ['A-EQPM', 8], furn: ['A-FURN', 8], hidd: ['A-HIDD', 8],
  detail: ['A-DETL', 9], tim: ['A-TIM', 5], space: ['A-SPACE', 2], khung: ['MDI-KHUNG', 6],
};

type Dong = [number, string | number];
const nhom = (...d: Dong[]): string => d.map(([k, v]) => `${k}\r\n${typeof v === 'number' ? (Number.isInteger(v) ? v : f4(v)) : v}`).join('\r\n') + '\r\n';
const diemDxf = (p: Diem): Dong[] => [[10, +p[0].toFixed(4)], [20, +p[1].toFixed(4)], [30, 0]];
function polyDxf(lop: string, pts: Diem[], dong: boolean): string {
  let s = nhom([0, 'POLYLINE'], [8, lop], [66, 1], [70, dong ? 1 : 0]);
  for (const p of pts) s += nhom([0, 'VERTEX'], [8, lop], ...diemDxf(p));
  return s + nhom([0, 'SEQEND'], [8, lop]);
}
/** Lớp nhãn phòng: tên mẫu căn + DT thông thủy đặt ở tâm mỗi căn. */
export const LOP_NHAN_CAN = 'MDI-NHAN-CAN';
export const CAO_CHU_NHAN_MM = 250;
export type NhanCan = { x: number; y: number; ten: string; dt: string };

/** Nhãn ở tâm từng căn của tầng điển hình (toạ độ thế giới, mm). Chữ ASCII: bỏ dấu, DT thông thủy làm tròn 0,1 m². */
export function nhanCanDxf(d: DuLieuXuat): NhanCan[] {
  const kq: NhanCan[] = [];
  for (const it of danhSachChen(d)) {
    const c = it.loai === 'can' && it.no ? d.tv.can.get(it.no) : undefined;
    if (!c) continue;
    const t = rad(it.rot), lx = it.sx * (it.rong / 2), ly = it.sau / 2;
    kq.push({
      x: it.x + lx * Math.cos(t) - ly * Math.sin(t),
      y: it.y + lx * Math.sin(t) + ly * Math.cos(t),
      ten: asciiHoa(c.ten_vi.split(' · ')[0]).trim() || asciiHoa(c.id),
      dt: Number.isFinite(c.dt_tt_m2) ? `${c.dt_tt_m2.toFixed(1)} m2` : '-',
    });
  }
  return kq;
}
/** Một TEXT căn giữa (R12: nhóm 72 = 1, 73 = 2 và điểm căn 11/21/31). */
const textDxf = (lop: string, x: number, y: number, chu: string): string =>
  nhom([0, 'TEXT'], [8, lop], ...diemDxf([x, y]), [40, CAO_CHU_NHAN_MM], [1, chu], [72, 1], [11, +x.toFixed(4)], [21, +y.toFixed(4)], [31, 0], [73, 2]);
const khoiTen = (id: string) => 'CAN_' + id.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

/** Tệp DXF R12 ASCII, đơn vị mm: nét bao DTXD, hành lang, mỗi mẫu căn một BLOCK (nét đã nhân rộng × sâu) + INSERT, lõi / thang bộ là nét rời. */
export function taoDxf(d: DuLieuXuat): string {
  const lops = new Map<string, number>([['MDI-BAO', 1], ['MDI-HANHLANG', 30], ['MDI-NHAN', 2], ['MDI-LOI', 8], [LOP_NHAN_CAN, 3]]);
  const oc = oCongNang(d);
  if (oc.length) lops.set(LOP_CONG_NANG, 5);
  for (const [l, c] of Object.values(LOP_THEO_NET)) lops.set(l, c);
  let s = nhom([0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1009'], [9, '$INSUNITS'], [70, 4], [9, '$MEASUREMENT'], [70, 1], [0, 'ENDSEC']);
  s += nhom([0, 'SECTION'], [2, 'TABLES'], [0, 'TABLE'], [2, 'LAYER'], [70, lops.size]);
  for (const [l, c] of lops) s += nhom([0, 'LAYER'], [2, l], [70, 0], [62, c], [6, 'CONTINUOUS']);
  s += nhom([0, 'ENDTAB'], [0, 'ENDSEC']);

  const ds = danhSachChen(d), dungRoi = new Set<string>();
  s += nhom([0, 'SECTION'], [2, 'BLOCKS']);
  for (const it of ds) {
    if (it.loai !== 'can' || !it.no || dungRoi.has(it.no)) continue;
    dungRoi.add(it.no);
    s += nhom([0, 'BLOCK'], [8, '0'], [2, khoiTen(it.no)], [70, 0], ...diemDxf([0, 0]));
    for (const n of d.hinh.get(it.no) ?? []) {
      const lop = LOP_THEO_NET[n.cat]?.[0];
      if (!lop || n.pts.length < 2) continue;
      s += polyDxf(lop, n.pts.map(([x, y]): Diem => [x * it.rong, y * it.sau]), false);
    }
    s += nhom([0, 'ENDBLK'], [8, '0']);
  }
  s += nhom([0, 'ENDSEC']);

  s += nhom([0, 'SECTION'], [2, 'ENTITIES']);
  if (d.mau.duong_bao.length > 2) s += polyDxf('MDI-BAO', d.mau.duong_bao, true);
  for (const h of d.mau.hanhlang_ve ?? []) if (h.length > 2) s += polyDxf('MDI-HANHLANG', h, true);
  for (const it of ds) {
    if (it.loai === 'can' && it.no) {
      s += nhom([0, 'INSERT'], [8, '0'], [2, khoiTen(it.no)], ...diemDxf([it.x, it.y]), [41, it.sx], [42, 1], [50, +it.rot.toFixed(4)]);
    } else {
      const g = d.loi?.get(it.ten);
      const c = Math.cos(rad(it.rot)), sn = Math.sin(rad(it.rot));
      for (const n of g?.paths ?? []) {
        if (n.pts.length < 2) continue;
        s += polyDxf('MDI-LOI', n.pts.map(([x, y]): Diem => [it.x + x * it.sx * c - y * it.sy * sn, it.y + x * it.sx * sn + y * it.sy * c]), false);
      }
    }
  }
  for (const n of nhanCanDxf(d)) {
    s += textDxf(LOP_NHAN_CAN, n.x, n.y + CAO_CHU_NHAN_MM * 0.7, n.ten);
    s += textDxf(LOP_NHAN_CAN, n.x, n.y - CAO_CHU_NHAN_MM * 0.7, n.dt);
  }
  for (const o of oc) {
    s += polyDxf(LOP_CONG_NANG, o.goc, true) + polyDxf(LOP_CONG_NANG, [o.goc[0], o.goc[2]], false) + polyDxf(LOP_CONG_NANG, [o.goc[1], o.goc[3]], false);
    s += textDxf(LOP_CONG_NANG, o.x, o.y + CAO_CHU_NHAN_MM * 0.7, o.ten);
    s += textDxf(LOP_CONG_NANG, o.x, o.y - CAO_CHU_NHAN_MM * 0.7, o.dt);
  }
  s += nhom([0, 'ENDSEC'], [0, 'EOF']);
  return s;
}
