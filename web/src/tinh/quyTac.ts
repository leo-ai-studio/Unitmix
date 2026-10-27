/** Bộ quy tắc xếp căn + QCVN/PCCC (web/public/lib/quy_tac.json, sinh bằng scripts/chep_quy_tac.py từ app cũ). */

export type NhomLuat = 'qcvn01' | 'qd34' | 'qcvn04' | 'qcvn06' | 'mdi' | 'qt';
export type BuocLam = 'lo_qh' | 'chon_mau_toa' | 'xep_day_can' | 'doi_mau_can' | 'pccc' | 'ham' | 'chi_tieu';
export type ApDung = 'tm' | 'xh' | 'ca_hai';

export type Nguong = { gia_tri: number | string; don_vi: string; chieu: '<=' | '>=' | '=' | '<' | '>'; dieu_kien?: string };
export type Luat = {
  ma: string; // mã mới, vd PC-02
  id: string; // mã ổn định, vd qcvn06_deadend
  buoc: BuocLam;
  nhom: NhomLuat;
  bat_buoc: boolean;
  ten_vi: string;
  ten_en: string;
  nguon: string;
  nguong: Nguong[];
  ap_dung: ApDung;
  ma_kiem: string;
  cach_tinh: string;
  ma_cu: string[];
  thay_the_boi: string | null;
  thay_cho: string[];
  ham: string | null;
  bang?: unknown;
  yaml?: { tep: string; nhom: string; nguon: string | null; trich: string | null };
};
export type QTGoc =
  | { ma_cu: string; giu: true; luat_moi: string[] }
  | { ma_cu: string; giu: false; loai_bo: string; thay_the_boi: string | null; luat_moi: string | null; ly_do: string };
export type BoQuyTac = {
  phien_ban: number;
  buoc: { ma: BuocLam; tien_to: string; ten_vi: string; ten_en: string }[];
  luat: Luat[];
  qt_goc: QTGoc[];
  thong_ke: Record<string, unknown>;
  loai_bo: Record<string, string>;
};

let dangTai: Promise<BoQuyTac> | null = null;
/** Tải quy_tac.json (một lần cho cả phiên). */
export function taiQuyTac(): Promise<BoQuyTac> {
  dangTai ??= fetch('/lib/quy_tac.json').then((r) => r.json() as Promise<BoQuyTac>);
  dangTai.catch(() => (dangTai = null));
  return dangTai;
}

/** Luật áp cho một loại hình tòa: 'tm' lấy luật tm + ca_hai; không truyền thì lấy hết. */
const hopLoaiHinh = (l: Luat, loai?: 'tm' | 'xh') => !loai || l.ap_dung === 'ca_hai' || l.ap_dung === loai;

export type BoLoc = { nhom?: NhomLuat | NhomLuat[]; buoc?: BuocLam; loaiHinh?: 'tm' | 'xh'; batBuoc?: boolean };

/** Lọc luật, giữ thứ tự trong tệp (theo bước, bắt buộc trước). */
export function locLuat(bo: BoQuyTac, loc: BoLoc = {}): Luat[] {
  const nhom = loc.nhom == null ? null : Array.isArray(loc.nhom) ? loc.nhom : [loc.nhom];
  return bo.luat.filter(
    (l) =>
      (!nhom || nhom.includes(l.nhom)) &&
      (!loc.buoc || l.buoc === loc.buoc) &&
      hopLoaiHinh(l, loc.loaiHinh) &&
      (loc.batBuoc == null || l.bat_buoc === loc.batBuoc),
  );
}

/** Tra một luật theo id (qcvn06_deadend), mã mới (PC-02) hoặc mã cũ (QT-45 / mdi_eff). */
export function traLuat(bo: BoQuyTac, khoa: string): Luat | undefined {
  return bo.luat.find((l) => l.id === khoa || l.ma === khoa) ?? bo.luat.find((l) => l.ma_cu.includes(khoa));
}

/** Một QT cũ đi đâu: luật mới đang giữ nó, hoặc lý do bị bỏ. */
export function traQTCu(bo: BoQuyTac, ma: string): QTGoc | undefined {
  return bo.qt_goc.find((q) => q.ma_cu === ma);
}

/** Luật nhóm theo bước, theo đúng thứ tự bước làm của app mới. */
export function theoBuoc(bo: BoQuyTac, loaiHinh?: 'tm' | 'xh'): { buoc: BoQuyTac['buoc'][number]; luat: Luat[] }[] {
  return bo.buoc.map((b) => ({ buoc: b, luat: locLuat(bo, { buoc: b.ma, loaiHinh }) }));
}

/** Ngưỡng số đầu tiên khớp điều kiện (chuỗi con của `dieu_kien`); không có điều kiện thì ngưỡng số đầu tiên. */
export function nguongSo(l: Luat, dieuKien?: string): number | null {
  const ds = l.nguong.filter((n) => typeof n.gia_tri === 'number' && (!dieuKien || (n.dieu_kien ?? '').includes(dieuKien)));
  return ds.length ? (ds[0].gia_tri as number) : null;
}
