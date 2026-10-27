import { diemLechCoCau, phanTram } from './coCau';
import { LOAI_CAN, type CanMau, type LoaiCan, type ThuVien } from './kieu';
import { canDangDung, congNangTai, doanCan, matDaDon, ungVienDoi, viTriCan, type BoCuc, type ToaCoMat } from './matBang';
import { thoatNan, type ToaPCCC } from './pccc';
import { tachMa } from './stretch';

export type KetQuaToiUu = {
  /** Đổi căn theo vị trí sau tối ưu (chỉ các vị trí khác với đổi theo mẫu `canTheo`). */
  canViTri: Record<string, string>;
  diemTruoc: number;
  diemSau: number;
  soDoi: number;
  /** Số căn đổi sang mẫu khác bề ngang / STRETCH (đã dồn khít trong đoạn). */
  soDoiRong: number;
  /** Số căn vượt cự ly thoát nạn trước / sau (null khi không kiểm được PCCC). */
  pcccTruoc: number | null;
  pcccSau: number | null;
};

export type TuyChonToiUu = {
  /** Cho phép đổi mẫu khác bề ngang + STRETCH (DC-04), dồn khít trong đoạn giữa hai mốc (XC-04). Mặc định bật như app cũ. */
  doiBeNgang?: boolean;
  /** Chiều cao PCCC (m, `chieuCaoPCCC`): có thì không nhận phép đổi tạo căn vượt cự ly thoát nạn mới (PC-01…03). */
  chieuCaoPCCC?: number;
  /** Tim cửa căn chuẩn hoá theo mặt tiền, khoá = ma_goc của mẫu gốc (`tinhCuaCan`); thiếu thì 0,5. */
  cuaCan?: Record<string, number>;
  /** DT thông thủy đề bài KD theo loại (m²): có thì cộng 0,2 × |DT TB − DT KD| như điểm cân bằng app cũ (`diemPA`). */
  dtDeBai?: Partial<Record<LoaiCan, number>>;
};

/** Tim cửa của căn biến thể STRETCH: điểm cửa bên phải đường cắt dời theo mức kéo. */
function cuaBienThe(c: CanMau, cuaCan: Record<string, number>, tv: ThuVien): number | undefined {
  if (!c.stretchGoc) return cuaCan[c.ma_goc];
  const g = tv.can.get(c.stretchGoc.id), dx = g && cuaCan[g.ma_goc];
  if (!g || dx === undefined || !g.stretch) return undefined;
  const X = dx * g.rong_mm;
  return (X > g.stretch.x_mm ? X + c.stretchGoc.st : X) / c.rong_mm;
}

/**
 * Tối ưu cơ cấu một tầng điển hình (DC-05 · QT-79 app cũ, leo dốc: mỗi bước lấy phép đổi giảm điểm nhiều nhất, dừng khi hết).
 * Phép đổi: (1) mẫu cùng nhóm, cùng bề ngang, cùng vị trí giữa/góc; (2) khi `doiBeNgang` (mặc định): hai căn GIỮA trong cùng
 * đoạn (giữa hai mốc lõi / thang / góc) đổi cùng lúc sang mẫu khác bề ngang hoặc biến thể STRETCH sao cho tổng bề ngang đoạn
 * không đổi — dồn khít (XC-04), không khe, không đè, hình tòa giữ nguyên. Căn góc chỉ đổi cùng bề ngang.
 * Có `chieuCaoPCCC` thì phép đổi làm thêm căn vượt cự ly thoát nạn bị bỏ. Ô đổi công năng không đếm, không đổi.
 */
export function toiUuCoCau(mau: ToaCoMat, toa: BoCuc, tv: ThuVien, mucTieu: Record<LoaiCan, number>, opt: TuyChonToiUu = {}): KetQuaToiUu {
  const doiBeNgang = opt.doiBeNgang ?? true;
  const vts = viTriCan(mau, tv);
  const hienTai = vts.map((vt) => canDangDung(vt, toa));
  const laCan = vts.map((vt) => congNangTai(vt.khoa, toa) === 'can');
  const rong = (id: string) => tv.can.get(id)?.rong_mm ?? 0;
  const diemCoCau = (ds: string[]) => {
    const dem = Object.fromEntries(LOAI_CAN.map((k) => [k, 0])) as Record<LoaiCan, number>;
    ds.forEach((id, i) => { const c = laCan[i] && tv.can.get(id); if (c) dem[c.loai]++; });
    return diemLechCoCau(phanTram(dem), mucTieu);
  };
  // điểm dùng khi leo dốc: lệch cơ cấu (+ lệch DT đề bài) + phạt rất nhỏ cho mỗi 100 mm STRETCH (ưu tiên mẫu gốc)
  const diem = (ds: string[]) => {
    let d = diemCoCau(ds);
    if (opt.dtDeBai) {
      const tong: Partial<Record<LoaiCan, [number, number]>> = {};
      ds.forEach((id, i) => { const c = laCan[i] && tv.can.get(id); if (c) { const x = (tong[c.loai] ??= [0, 0]); x[0] += c.dt_tt_m2; x[1]++; } });
      const lech = LOAI_CAN.flatMap((k) => (opt.dtDeBai![k] && tong[k] ? [Math.abs(tong[k]![0] / tong[k]![1] - opt.dtDeBai![k]!)] : []));
      if (lech.length) d += (0.2 * lech.reduce((a, b) => a + b, 0)) / lech.length;
    }
    return d + ds.reduce((a, id) => a + Math.abs(tachMa(id).st) / 100, 0) * 1e-3;
  };

  // ---- PCCC: số căn vượt cự ly thoát nạn (đồ thị hành lang app cũ, pccc.ts) trên mặt đã dồn khít ----
  const coPCCC = opt.chieuCaoPCCC !== undefined && Array.isArray((mau as unknown as ToaPCCC).truc);
  const vuotPCCC = (ds: string[]): Set<number> | null => {
    if (!coPCCC) return null;
    const canViTri = Object.fromEntries(vts.map((v, i) => [v.khoa, ds[i]]));
    const mat = matDaDon(mau, { canTheo: {}, canViTri }, tv);
    const cuaCan: Record<string, number> = {};
    for (const id of new Set(ds)) { const c = tv.can.get(id), x = c && opt.cuaCan && cuaBienThe(c, opt.cuaCan, tv); if (c && x !== undefined) cuaCan[c.ma_goc] = x; }
    try {
      const kq = thoatNan({ ...(mau as unknown as ToaPCCC), mat }, { cuaCan, chieuCaoPCCC: opt.chieuCaoPCCC! });
      return new Set(kq.can.filter((c) => c.vuot).map((c) => c.so));
    } catch {
      return null;
    }
  };
  const vuotTruoc = vuotPCCC(hienTai);
  const hopPCCC = (ds: string[]) => {
    if (!vuotTruoc) return true;
    const v = vuotPCCC(ds);
    return !v || [...v].every((so) => vuotTruoc.has(so));
  };

  // ---- ứng viên ----
  const doan = doiBeNgang ? doanCan(vts) : [];
  // ứng viên khác bề ngang: mẫu giữa cùng nhóm, cùng chiều sâu (gồm biến thể STRETCH); căn góc / căn khung V không đổi bề ngang
  const ungVienRong = vts.map((vt, i) => {
    const g = tv.can.get(vt.canGocId);
    if (!doiBeNgang || !laCan[i] || !g || g.vi_tri !== 'giua') return new Map<number, string[]>();
    const m = new Map<number, string[]>();
    for (const c of tv.can.values()) {
      if (c.nhom !== g.nhom || c.sau_mm !== g.sau_mm || c.vi_tri !== 'giua') continue;
      (m.get(c.rong_mm) ?? m.set(c.rong_mm, []).get(c.rong_mm)!).push(c.id);
    }
    return m;
  });

  const diemTruoc = diemCoCau(hienTai);
  let cur = diem(hienTai);
  for (let buoc = 0; buoc < 300; buoc++) {
    const nuoc: { doi: [number, string][]; d: number }[] = [];
    const thu = (doi: [number, string][]) => {
      const ds = hienTai.slice();
      for (const [i, id] of doi) ds[i] = id;
      const d = diem(ds);
      if (d < cur - 1e-9) nuoc.push({ doi, d });
    };
    // (1) cùng bề ngang với căn đang dùng (tính lại mỗi bước: căn có thể đã đổi bề ngang ở bước trước)
    hienTai.forEach((id, i) => {
      if (!laCan[i]) return;
      const cung = ungVienRong[i].get(rong(id)) ?? ungVienDoi(id, tv, true).map((c) => c.id);
      for (const moi of cung) if (moi !== id) thu([[i, moi]]);
    });
    for (const dn of doan) {
      const ds = dn.ds.filter((i) => ungVienRong[i].size);
      for (const i of ds) {
        for (const [w, ids] of ungVienRong[i]) {
          const chenh = w - rong(hienTai[i]);
          if (!chenh) continue;
          for (const j of ds) {
            if (j === i) continue;
            const bu = ungVienRong[j].get(rong(hienTai[j]) - chenh);
            if (!bu) continue;
            for (const a of ids) for (const b of bu) thu([[i, a], [j, b]]);
          }
        }
      }
    }
    if (!nuoc.length) break;
    nuoc.sort((x, y) => x.d - y.d);
    // phép đổi tốt nhất còn giữ PCCC (thử tối đa 20 phép mỗi bước)
    const tot = nuoc.slice(0, 20).find((n) => {
      const ds = hienTai.slice();
      for (const [i, id] of n.doi) ds[i] = id;
      return hopPCCC(ds);
    });
    if (!tot) break;
    for (const [i, id] of tot.doi) hienTai[i] = id;
    cur = tot.d;
  }

  const canViTri: Record<string, string> = {};
  let soDoi = 0, soDoiRong = 0;
  vts.forEach((vt, i) => {
    if (hienTai[i] !== (toa.canTheo[vt.canGocId] ?? vt.canGocId)) canViTri[vt.khoa] = hienTai[i];
    if (hienTai[i] !== canDangDung(vt, toa)) soDoi++;
    if (rong(hienTai[i]) !== rong(vt.canGocId)) soDoiRong++;
  });
  const sau = vuotPCCC(hienTai);
  return { canViTri, diemTruoc, diemSau: diemCoCau(hienTai), soDoi, soDoiRong, pcccTruoc: vuotTruoc?.size ?? null, pcccSau: sau?.size ?? null };
}
