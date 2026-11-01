import type { ToaDat, TrangThaiPA } from './kieu';

/** Phạm vi áp dụng phép sửa cơ cấu căn ở màn Tầng: chỉ tòa đang sửa · mọi tòa CÙNG MẪU trong lô · mọi tòa cùng mẫu cả dự án. */
export type PhamViSua = 'toa' | 'lo' | 'duAn';

/** Các trường bố cục / mặt bằng tầng của tòa (mọi thứ người dùng sửa ở màn Tầng); mặt bằng chỉ có nghĩa giữa các tòa CÙNG mẫu. */
const TRUONG_BO_CUC = ['canTheo', 'canViTri', 'congNang', 'latO', 'canThem', 'loi', 'matBang', 'tuChinhMB', 'giamCanTN', 'thangLien', 'tuDong',
  'thangTay', 'hanhLangTay', 'loaiThang', 'duongBao', 'dtxdM2', 'tuPCCCTay', 'cncTay'] as const;

const bocBoCuc = (t: ToaDat): string => JSON.stringify([...TRUONG_BO_CUC.map((k) => t[k] ?? null), t.tangRieng ?? null]);

/** Tòa nhận phép sửa của `nguon`: cùng mẫu, không phải chính nó, không khoá; `lo` thì cùng lô. */
export const toaNhanSua = (pa: Pick<TrangThaiPA, 'toa'>, nguon: ToaDat, pv: PhamViSua): ToaDat[] =>
  pv === 'toa' ? [] : pa.toa.filter((x) => x.id !== nguon.id && x.mauId === nguon.mauId && !x.khoa && (pv === 'duAn' || x.loId === nguon.loId));

/**
 * Sau một phép sửa `truoc` → `sau` ở màn Tầng: nếu ĐÚNG MỘT tòa đổi bố cục thì chép bố cục đó sang các tòa nhận sửa theo `pv`
 * (cùng mẫu, trong lô / cả dự án). Tầng riêng chỉ chép những tầng tòa nhận có (≤ số tầng điển hình của nó). Trả PA mới + số tòa đã áp thêm.
 * Phép sửa nhiều tòa cùng lúc (tối ưu hàng loạt…) hoặc `pv = 'toa'` thì giữ nguyên.
 */
export function lanTruyenBoCuc(truoc: TrangThaiPA, sau: TrangThaiPA, pv: PhamViSua): { pa: TrangThaiPA; them: number } {
  if (pv === 'toa' || truoc === sau) return { pa: sau, them: 0 };
  const cu = new Map(truoc.toa.map((x) => [x.id, x]));
  const doi = sau.toa.filter((x) => { const c = cu.get(x.id); return !!c && bocBoCuc(c) !== bocBoCuc(x); });
  if (doi.length !== 1) return { pa: sau, them: 0 };
  const nguon = doi[0], ds = new Map(toaNhanSua(sau, nguon, pv).map((x) => [x.id, x]));
  if (!ds.size) return { pa: sau, them: 0 };
  const tangRieng = (soTang: number) => {
    const e = Object.entries(nguon.tangRieng ?? {}).filter(([k]) => Number(k) <= soTang);
    return e.length ? Object.fromEntries(e) : undefined;
  };
  const chep = (x: ToaDat): ToaDat => {
    const moi: ToaDat = { ...x };
    for (const k of TRUONG_BO_CUC) { if (nguon[k] === undefined) delete moi[k]; else (moi as Record<string, unknown>)[k] = structuredClone(nguon[k]); }
    const tr = tangRieng(x.soTangDH);
    if (tr) moi.tangRieng = structuredClone(tr); else delete moi.tangRieng;
    return moi;
  };
  return { pa: { ...sau, toa: sau.toa.map((x) => (ds.has(x.id) ? chep(x) : x)) }, them: ds.size };
}
