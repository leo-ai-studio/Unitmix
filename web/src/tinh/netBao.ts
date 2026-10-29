/**
 * Nét bao DTXD bo theo ô (app cũ MDI_Unitmix_v4 `duongBao0`, shell.src.html ~8458): nét bao CAD của mẫu `P0` trừ phần sàn MẤT
 * (ô có ở mặt bằng gốc mà không còn — nở 700 mm rồi trừ lại ô còn lại + hành lang, để nét bao không để viền quanh chỗ trống), cộng
 * phần sàn MỚI (ô mọc thêm + mảnh sàn hiện có nằm ngoài nét bao mà chạm phần mọc thêm). Lấy đa giác lớn nhất, bỏ đỉnh trùng /
 * thẳng hàng. Hình học bằng Clipper (số nguyên mm).
 */
import ClipperLib from 'clipper-lib';
import type { Diem } from './kieu';

type Path = ClipperLib.IntPoint[];
const toPath = (p: Diem[]): Path => p.map(([x, y]) => ({ X: Math.round(x), Y: Math.round(y) }));
const toDiem = (p: Path): Diem[] => p.map((q) => [q.X, q.Y]);

function chay(loai: number, a: Path[], b: Path[] = []): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const kq: Path[] = [];
  c.Execute(loai, kq, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return kq;
}
const hop = (a: Path[]) => chay(ClipperLib.ClipType.ctUnion, a);
const tru = (a: Path[], b: Path[]) => (b.length ? chay(ClipperLib.ClipType.ctDifference, a, b) : hop(a));
function no(paths: Path[], d: number): Path[] {
  const o = new ClipperLib.ClipperOffset(4, 0.25);
  o.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const kq: Path[] = [];
  o.Execute(kq, d);
  return kq;
}
const dt = (p: Path) => Math.abs(ClipperLib.Clipper.Area(p));
/** Phần có diện tích đáng kể (bỏ mảnh vụn < 0,05 m² do sai số CAD). */
const lon = (ps: Path[]) => ps.filter((p) => dt(p) > 5e4);
type Hop = [number, number, number, number];
const hopBao = (p: Path): Hop => [Math.min(...p.map((q) => q.X)), Math.min(...p.map((q) => q.Y)), Math.max(...p.map((q) => q.X)), Math.max(...p.map((q) => q.Y))];
const cham = (a: Hop, b: Hop) => a[0] <= b[2] + 10 && b[0] <= a[2] + 10 && a[1] <= b[3] + 10 && b[1] <= a[3] + 10;

/** Nửa khe được đóng khi gom nét bao (mm): khe tường ≤ 400 mm giữa hai ô vẫn là một khối sàn. */
const DONG_KHE_MM = 250;
/** Nới phần sàn mất (mm) — dung sai "tường nhô" app cũ dùng ở mọi kiểm nét bao. */
export const NOI_MAT_MM = 700;

/**
 * `P0` nét bao gốc của mẫu; `o0` / `o1` ô đặc (căn, thang, dải lõi) ở mặt bằng gốc / hiện tại; `hl` dải hành lang hiện tại (không
 * bị trừ khỏi nét bao). Trả nét bao mới, hoặc null khi không dựng được (giữ cách nối cũ).
 */
export function netBaoTheoO(P0: Diem[], o0: Diem[][], o1: Diem[][], hl: Diem[][]): Diem[] | null {
  if (P0.length < 3) return null;
  const A1 = hop(o1.filter((p) => p.length >= 3).map(toPath));
  const HL = hl.filter((p) => p.length >= 3).map(toPath);
  // ô đổi (dời / đổi mẫu / bỏ / thêm): so từng ô — ô mới phủ chỗ ô cũ khác (vd căn góc dời vào chỗ hốc của căn cũ) vẫn là sàn mới
  const khoa = (p: Diem[]) => p.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(';');
  const k0 = new Set(o0.map(khoa)), k1 = new Set(o1.map(khoa));
  const doi0 = o0.filter((p) => p.length >= 3 && !k1.has(khoa(p))).map(toPath), doi1 = o1.filter((p) => p.length >= 3 && !k0.has(khoa(p))).map(toPath);
  const mat0 = doi0.length ? lon(tru(hop(doi0), A1)) : [], moi = doi1.length ? lon(hop(doi1)) : [];
  if (!mat0.length && !moi.length) return P0;
  const mat = mat0.length ? tru(no(mat0, NOI_MAT_MM), [...A1, ...HL]) : [];
  const nen = tru([toPath(P0)], mat);
  // mảnh sàn hiện có nằm ngoài nét bao mà chạm phần mọc thêm (lan dần)
  const ngoai = lon(tru(A1, nen)), mo = moi.map(hopBao), chon: Path[] = [];
  for (let doi = true; doi;) {
    doi = false;
    for (const p of ngoai) {
      if (chon.includes(p)) continue;
      const b = hopBao(p);
      if (mo.some((m) => cham(m, b))) { chon.push(p); mo.push(b); doi = true; }
    }
  }
  // đóng khe ≤ 2 × 250 mm (khe tường giữa ô thang và căn, XC-02 ≤ 400 mm): không để nét bao tách rời một ô thang / căn
  const kq = no(no(hop([...nen, ...moi, ...chon]), DONG_KHE_MM), -DONG_KHE_MM);
  // đa giác lớn nhất (lỗ thủng / mảnh rời bỏ như app cũ)
  const ngoaiCung = [...kq].sort((a, b) => dt(b) - dt(a))[0];
  if (!ngoaiCung || ngoaiCung.length < 3) return null;
  return toDiem(ngoaiCung);
}
