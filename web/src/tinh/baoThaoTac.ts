/**
 * Biến động số căn sau một thao tác tay màn Tầng (công cụ `CongCuTang`): lật / xoá / dời thang… chạy lại tự chỉnh nên có thể gỡ căn
 * vượt cự ly thoát nạn (app cũ giamCanThoatNan · PC-11 · QT-24) hoặc trả lại căn đã gỡ — số căn / tầng nhảy. Câu báo phải nói căn /
 * tầng trước → sau, căn nào bị gỡ và căn cứ (QCVN 06:2022 Bảng G.1 / A.3.1.7 theo chiều cao PCCC — `gioiHanThoatNan`). Kèm gợi ý giữ
 * số căn (dời thang bộ như PC-11, hoặc thang về tự động) — chỉ GỢI Ý, không tự làm thay người dùng.
 */
import { mauToa } from './canThem';
import type { ThayDoiTuDong, ToaDat } from './kieu';
import { matBangCua, matBangTang, mauHieuDung, type ToaMB } from './loiThang';
import { boCucTang, congNangTai, viTriCan } from './matBang';
import { chieuCaoPCCC, gioiHanThoatNan } from './pccc';
import { doiThangTay, thangTuDongLai, type Ctx } from './thaoTacTay';

export type BienDongCan = {
  /** Số căn / tầng trước → sau (tầng đang xem). */
  truoc: number;
  sau: number;
  /** Ô căn tự chỉnh vừa gỡ vì vượt cự ly thoát nạn (bỏ / đổi phòng KT) — khoá ô. */
  goTN: string[];
  /** Ô căn khít đoạn kẹp (XC-05) vừa bỏ. */
  goKhit: string[];
  /** Ô căn tự chỉnh trả lại (lần trước gỡ, nay hết vượt). */
  traLai: string[];
  /** Ngưỡng thoát nạn đang áp (m) và căn cứ. */
  cut: number;
  doi: number;
  canCu: string;
};

const GO = new Set(['bo', 'ky_thuat']);
/** Ô bị tự chỉnh gỡ (công năng bỏ / phòng KT) ở tầng `tang`: bản ghi của tầng đó và của bố cục chung (tầng riêng kế thừa). */
const oGo = (ds: ThayDoiTuDong[] | undefined, tang: number | null) =>
  new Set((ds ?? []).filter((d) => d.truong === 'congNang' && GO.has(d.moi) && (d.tang === tang || d.tang === null)).map((d) => d.khoa));

/**
 * Số căn một tầng theo mặt bằng đã tự chỉnh lưu trong tòa. PA chưa có mặt bằng lưu (`ToaDat.matBang` chưa có — thao tác tay đầu
 * tiên) thì mặt bằng mặc định không có báo cáo: đếm căn trên mặt bằng hiệu dụng đang vẽ (mẫu thư viện + bố cục tầng), không lấy 0.
 */
export function soCanTang(toa: ToaDat, c: Ctx, tang: number | null): number {
  const mau = mauToa(c.tv, toa) as ToaMB | undefined;
  if (!mau) return 0;
  const so = matBangTang(toa, mau, c.dl, tang).baoCao?.soCan;
  if (so !== undefined) return so;
  const bc = boCucTang(toa, tang);
  return viTriCan(mauHieuDung(toa, mau, c.dl, tang), c.tv, bc).filter((v) => congNangTai(v.khoa, bc) === 'can').length;
}

export function bienDongCan(truoc: ToaDat, sau: ToaDat, c: Ctx, tang: number | null): BienDongCan {
  const a = oGo(truoc.tuDong, tang), b = oGo(sau.tuDong, tang);
  const mau = mauToa(c.tv, sau) as ToaMB | undefined;
  const khit = new Set((mau ? matBangTang(sau, mau, c.dl, tang).baoCao?.khitKep?.bo ?? [] : []).map((x) => x.khoa));
  const moi = [...b].filter((k) => !a.has(k)).sort();
  const g = gioiHanThoatNan(chieuCaoPCCC(sau.soTangDe, sau.caoDe, sau.soTangDH, sau.caoDH));
  return {
    truoc: soCanTang(truoc, c, tang), sau: soCanTang(sau, c, tang),
    goTN: moi.filter((k) => !khit.has(k)), goKhit: moi.filter((k) => khit.has(k)), traLai: [...a].filter((k) => !b.has(k)).sort(),
    cut: g.cut, doi: g.doi, canCu: g.canCu,
  };
}

export type GoiYGiuCan = { loai: 'tuDong'; soCan: number; soThang: number } | { loai: 'doiThang'; thang: string; sauO: string; soCan: number };

/**
 * Tìm cách giữ số căn khi thao tác làm tự chỉnh gỡ căn thoát nạn: (1) dời một thang bộ tới cạnh căn bị gỡ (như PC-11 chuyển thang);
 * (2) thang đặt tay về tự động (PC-11 tự chọn chỗ, có thể thêm lại thang). Mỗi phép thử chạy lại tự chỉnh (~0,3 s) nên có hạn `hanMs`; hết hạn thì
 * dừng. Trả phương án đầu tiên đạt số căn ≥ `canTruoc`, không có thì null. Không sửa gì.
 */
export function goiYGiuCan(sau: ToaDat, goTN: string[], canTruoc: number, c: Ctx, tang: number | null, hanMs = 1500): GoiYGiuCan | null {
  if (!goTN.length || soCanTang(sau, c, tang) >= canTruoc) return null;
  const t0 = performance.now(), het = () => performance.now() - t0 > hanMs;
  const mau = mauToa(c.tv, sau) as ToaMB | undefined;
  if (!mau) return null;
  const tuDong = (): GoiYGiuCan | null => {
    if (!sau.thangTay) return null;
    const r = thangTuDongLai(sau, c);
    return r.ok && soCanTang(r.toa, c, tang) >= canTruoc ? { loai: 'tuDong', soCan: soCanTang(r.toa, c, tang), soThang: matBangCua(r.toa, mau, c.dl).thangBo.length } : null;
  };
  const thang = matBangCua(sau, mau, c.dl).thangBo;
  for (const khoa of goTN.slice(0, 2)) {
    const [mi, i] = khoa.split(':').map(Number);
    // ô căn kề căn bị gỡ trên cùng mặt (thang đứng sau ô kề phía trước, hoặc sau chính ô kề phía sau)
    const ke = [`${mi}:${i - 1}`, `${mi}:${i + 1}`].filter((k) => mau.mat[mi]?.phan_tu[Number(k.split(':')[1])]?.loai === 'can');
    const ds = [...thang].sort((x, y) => Number(y.matIdx === mi) - Number(x.matIdx === mi));
    for (const th of ds) for (const k of ke) {
      if (het()) return tuDong();
      const r = doiThangTay(sau, th.khoa, mi, k, c);
      if (r.ok && soCanTang(r.toa, c, tang) >= canTruoc) return { loai: 'doiThang', thang: th.khoa, sauO: k, soCan: soCanTang(r.toa, c, tang) };
    }
  }
  return tuDong();
}
