/**
 * Thao tác tay màn Tầng chạy nền (Web Worker) — như tinh/hamNen.ts. Mọi phép tay (xoá / đổi chỗ / lật căn, thêm / xoá / dời thang,
 * ⟲ thang về tự động…) chạy lại tự chỉnh; khi không giữ được tập thang cũ thì PC-11 dò lại từ đầu, mẫu lớn 150–400 ms trên luồng
 * chính. Chạy nền thì bản vẽ giữ mặt bằng tạm (phần hình học nhanh `hinhNhanh`: đổi ô, chưa tự chỉnh), thanh công cụ hiện vòng O
 * `spin-o`; có lượt mới thì lượt cũ bị huỷ (terminate worker, dựng worker mới cho lượt sau). Kết quả cuối y hệt bản đồng bộ (cùng
 * hàm thuần tinh/thaoTacTay.ts trên bản chép structuredClone). Không có Worker (vitest / node) thì chạy đồng bộ.
 */
import { goiYGiuCan, type GoiYGiuCan } from './baoThaoTac';
import { doiChoO, doiCongNang, latO } from './doiCan';
import type { DuLieuMB, LoaiThangBo } from './loiThang';
import type { ThuVien, ToaDat } from './kieu';
import type { ViTriCan } from './matBang';
import { phanTichPCCCTang, type DauVaoPCCCTang } from './pcccTang';
import { chuyenCanTay, doiChoTay, doiLoaiThangTay, doiThangTay, hanhLangTuDong, keoHanhLangTay, latTay, latThangTay, thangTuDongLai, themCanTay, themThangTay, themVaoO, xoaCanTay, xoaThangTay, type Ctx, type KetQuaTay } from './thaoTacTay';

type Tangs = number[] | null;
/** Bảng thao tác được chạy nền (tên → hàm thuần, ctx đứng đầu). Đối số phải chép được qua structuredClone. */
export const BANG_TAY = {
  thangTuDongLai: (c: Ctx, toa: ToaDat) => thangTuDongLai(toa, c),
  doiChoTay: (c: Ctx, toa: ToaDat, tangs: Tangs, a: ViTriCan, b: ViTriCan) => doiChoTay(toa, tangs, a, b, c),
  chuyenCanTay: (c: Ctx, toa: ToaDat, tangs: Tangs, a: ViTriCan, b: ViTriCan, truoc: boolean) => chuyenCanTay(toa, tangs, a, b, truoc, c),
  latTay: (c: Ctx, toa: ToaDat, tangs: Tangs, khoas: string[]) => latTay(toa, tangs, khoas, c),
  xoaCanTay: (c: Ctx, toa: ToaDat, tangs: Tangs, khoas: string[]) => xoaCanTay(toa, tangs, khoas, c),
  themCanTay: (c: Ctx, toa: ToaDat, tangs: Tangs, neo: ViTriCan, id: string, truoc: boolean) => themCanTay(toa, tangs, neo, id, c, truoc),
  themVaoO: (c: Ctx, toa: ToaDat, tangs: Tangs, vt: ViTriCan, id: string) => themVaoO(toa, tangs, vt, id, c),
  themThangTay: (c: Ctx, toa: ToaDat, mat: number, sau: string) => themThangTay(toa, mat, sau, c),
  xoaThangTay: (c: Ctx, toa: ToaDat, khoa: string) => xoaThangTay(toa, khoa, c),
  doiLoaiThangTay: (c: Ctx, toa: ToaDat, khoa: string, loai: LoaiThangBo) => doiLoaiThangTay(toa, khoa, loai, c),
  latThangTay: (c: Ctx, toa: ToaDat, khoa: string) => latThangTay(toa, khoa, c),
  doiThangTay: (c: Ctx, toa: ToaDat, khoa: string, mat: number, sau: string) => doiThangTay(toa, khoa, mat, sau, c),
  keoHanhLangTay: (c: Ctx, toa: ToaDat, i: number, dau: 0 | 1, d: number) => keoHanhLangTay(toa, i, dau, d, c),
  hanhLangTuDong: (c: Ctx, toa: ToaDat) => hanhLangTuDong(toa, c),
  /** Gợi ý giữ số căn (tinh/baoThaoTac.ts) — bọc trong object để null "không có gợi ý" khác null "bị huỷ". */
  goiYGiuCan: (c: Ctx, sau: ToaDat, goTN: string[], canTruoc: number, tang: number | null, hanMs: number) => ({ g: goiYGiuCan(sau, goTN, canTruoc, c, tang, hanMs) as GoiYGiuCan | null }),
  /** Phân tích PCCC một tầng (tinh/pcccTang.ts: hai lượt giải cửa hành lang + phủ tủ chính xác ≈ 100–300 ms) — tinh/pcccNen.ts. */
  phanTichPCCC: (c: Ctx, v: Omit<DauVaoPCCCTang, 'tv' | 'dl'>) => phanTichPCCCTang({ ...v, tv: c.tv, dl: c.dl ?? null }),
  /** Khởi động sẵn worker (chỉ chuyển thư viện / dữ liệu lõi sang, không tính gì) — `DieuPhoiTay.khoiDong`. */
  ngam: () => null,
} as const;
export type TenTay = keyof typeof BANG_TAY;
export type DoiSoTay<T extends TenTay> = Parameters<(typeof BANG_TAY)[T]> extends [Ctx, ...infer R] ? R : never;
export type KqTay<T extends TenTay> = ReturnType<(typeof BANG_TAY)[T]>;
/** Phép tay trả KetQuaTay (mọi tên trừ gợi ý, phân tích PCCC). */
export type TenPhep = Exclude<TenTay, 'goiYGiuCan' | 'phanTichPCCC' | 'ngam'>;
/** Một phép tay dạng dữ liệu (tên + đối số) — chép được sang worker, chạy đồng bộ được bằng `chayPhep`. */
export type PhepTay = { [T in TenPhep]: { ten: T; args: DoiSoTay<T> } }[TenPhep];
export const phepTay = <T extends TenPhep>(ten: T, ...args: DoiSoTay<T>): PhepTay => ({ ten, args } as unknown as PhepTay);

/** Thư gửi worker: `tv` / `dl` chỉ gửi khi worker chưa có đúng bản này. */
export type ThuTay = { id: number; ten: TenTay; args: unknown[]; tv?: ThuVien; dl?: DuLieuMB | null };
export type ThuTayXong = { id: number; kq?: unknown; loi?: string };

export type WorkerTay = {
  postMessage: (m: ThuTay) => void;
  terminate: () => void;
  onmessage: ((e: { data: ThuTayXong }) => void) | null;
  onerror?: ((e: unknown) => void) | null;
};

/** Chạy một thao tác theo tên (dùng chung cho worker và đường đồng bộ). */
export const chayTay = (ten: TenTay, c: Ctx, args: unknown[]): unknown =>
  (BANG_TAY[ten] as (c: Ctx, ...a: unknown[]) => unknown)(c, ...args);
/** Chạy đồng bộ một phép tay (bản chuẩn để so kết quả nền). */
export const chayPhep = (ph: PhepTay, c: Ctx): KetQuaTay => chayTay(ph.ten, c, ph.args) as KetQuaTay;

/**
 * Phần hình học nhanh của phép (đổi ô trong bố cục, CHƯA tự chỉnh — vài ms): bản vẽ hiện ngay trong lúc chờ kết quả nền. Phép thang
 * (thêm / xoá / dời / đổi loại, ⟲) không có phần nhanh → null (giữ mặt bằng cũ).
 */
export function hinhNhanh(ph: PhepTay): ToaDat | null {
  switch (ph.ten) {
    case 'doiChoTay': { const [toa, tangs, a, b] = ph.args; return a.khoa === b.khoa ? null : doiChoO(toa, tangs, a, b); }
    case 'latTay': { const [toa, tangs, khoas] = ph.args; return khoas.length ? latO(toa, tangs, khoas) : null; }
    case 'xoaCanTay': { const [toa, tangs, khoas] = ph.args; return khoas.length ? doiCongNang(toa, tangs, khoas, 'bo') : null; }
    case 'themVaoO': { const [toa, tangs, vt] = ph.args; return doiCongNang(toa, tangs, [vt.khoa], 'can'); }
    default: return null;
  }
}

type Cho = { id: number; ten: TenTay; args: unknown[]; c: Ctx; xong: (r: unknown) => void };

export class DieuPhoiTay {
  private worker: WorkerTay | null = null;
  private tvW: ThuVien | undefined;
  private dlW: DuLieuMB | null | undefined;
  private dlCo = false;
  private cho: Cho | null = null;
  private soId = 0;
  private nguoiNghe = new Set<() => void>();
  /** Số lượt bị huỷ giữa chừng (test, đo). */
  soLanHuy = 0;

  constructor(private taoWorker: () => WorkerTay | null) {}

  /** Có lượt đang chạy nền. */
  get dangChay(): boolean { return !!this.cho; }
  /** Tên thao tác đang chạy nền (để nút hiện vòng O). */
  get tenDangChay(): TenTay | null { return this.cho?.ten ?? null; }

  /**
   * Chạy `ten` với đối số `args`. Lượt cũ còn chạy thì bị huỷ (promise của nó trả null). Không có Worker → chạy đồng bộ, trả ngay.
   */
  chay<T extends TenTay>(ten: T, c: Ctx, ...args: DoiSoTay<T>): Promise<KqTay<T> | null> {
    this.huy();
    if (!this.coWorker()) return Promise.resolve(chayTay(ten, c, args) as KqTay<T>);
    return new Promise((xong) => {
      const id = ++this.soId;
      this.cho = { id, ten, args, c, xong: xong as (r: unknown) => void };
      const thu: ThuTay = { id, ten, args };
      if (this.tvW !== c.tv) { thu.tv = c.tv; this.tvW = c.tv; }
      if (!this.dlCo || this.dlW !== c.dl) { thu.dl = c.dl ?? null; this.dlW = c.dl; this.dlCo = true; }
      this.worker!.postMessage(thu);
      this.bao();
    });
  }

  /**
   * Dựng sẵn worker + chuyển thư viện / dữ liệu lõi sang khi mở màn Tầng, để phép tay đầu tiên (kéo đầu hành lang…) không phải chờ
   * nạp module worker + chép thư viện lúc thả tay. Đang có lượt chạy thì thôi (worker đã nóng); lượt thật sau đó dùng chung worker.
   */
  khoiDong(c: Ctx): void {
    if (this.cho || !this.coWorker()) return;
    const thu: ThuTay = { id: 0, ten: 'ngam', args: [] };
    if (this.tvW !== c.tv) { thu.tv = c.tv; this.tvW = c.tv; }
    if (!this.dlCo || this.dlW !== c.dl) { thu.dl = c.dl ?? null; this.dlW = c.dl; this.dlCo = true; }
    if (thu.tv !== undefined || thu.dl !== undefined) this.worker!.postMessage(thu);
  }

  /** Chạy một phép tay (PhepTay) — như `chay`. */
  chayPhep(ph: PhepTay, c: Ctx): Promise<KetQuaTay | null> {
    return (this.chay as (t: TenTay, c: Ctx, ...a: unknown[]) => Promise<KetQuaTay | null>)(ph.ten, c, ...ph.args);
  }

  /** Huỷ lượt đang chạy (thao tác khác bắt đầu, rời màn): worker bị terminate, promise lượt đó trả null. */
  huy(): void {
    const c = this.cho;
    if (!c) return;
    this.cho = null;
    this.worker?.terminate();
    this.worker = null;
    this.soLanHuy++;
    c.xong(null);
    this.bao();
  }

  nghe(fn: () => void): () => void {
    this.nguoiNghe.add(fn);
    return () => { this.nguoiNghe.delete(fn); };
  }

  private coWorker(): boolean {
    if (!this.worker) {
      this.worker = this.taoWorker();
      this.tvW = undefined; this.dlW = undefined; this.dlCo = false;
      if (this.worker) {
        this.worker.onmessage = (e) => this.nhan(e.data);
        this.worker.onerror = () => this.loi('worker');
      }
    }
    return !!this.worker;
  }

  private nhan(m: ThuTayXong): void {
    const c = this.cho;
    if (!c || c.id !== m.id) return; // kết quả lượt đã huỷ: bỏ
    if (m.loi !== undefined) { this.loi(m.loi); return; }
    this.cho = null;
    c.xong(m.kq ?? null);
    this.bao();
  }

  /** Worker lỗi: chạy đồng bộ lượt đang chờ cho đúng kết quả (hiếm), dựng worker mới cho lượt sau. */
  private loi(loi: string): void {
    console.error('thao tác nền:', loi);
    const c = this.cho;
    this.worker?.terminate();
    this.worker = null;
    this.cho = null;
    if (c) c.xong(chayTay(c.ten, c.c, c.args));
    this.bao();
  }

  private bao(): void { for (const f of [...this.nguoiNghe]) f(); }
}

const taoWorkerMacDinh = (): WorkerTay | null => {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./thaoTay.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerTay;
  } catch {
    return null;
  }
};

/** Phép tay ghi vào PA (một lượt một lúc; lượt mới huỷ lượt cũ) + gợi ý giữ số căn sau câu báo. */
export const dieuPhoiTay = new DieuPhoiTay(taoWorkerMacDinh);
/** Dò hợp lệ ô đích khi rê kéo thả (worker riêng: dò không huỷ phép đang ghi, phép ghi không huỷ lượt dò). */
export const dieuPhoiDo = new DieuPhoiTay(taoWorkerMacDinh);

// ---- mặt bằng tạm trong lúc chờ (bản vẽ màn Tầng đọc) ----
export type ToaTam = { id: number; goc: ToaDat; toa: ToaDat };
let tam: ToaTam | null = null, soTam = 0;
const ngheTam = new Set<() => void>();
/** Đặt mặt bằng tạm cho tòa `goc` (null = bỏ); trả mã để chỉ chính lượt đó gỡ được (`goTam`). */
export function datTam(goc: ToaDat, toa: ToaDat | null): number {
  const id = ++soTam;
  tam = toa ? { id, goc, toa } : null;
  ngheTam.forEach((f) => f());
  return id;
}
/** Gỡ mặt bằng tạm của lượt `id` (lượt khác đã đặt tạm mới thì giữ). */
export function goTam(id: number): void {
  if (tam?.id !== id) return;
  tam = null;
  ngheTam.forEach((f) => f());
}
/** Mặt bằng tạm của tòa `toa` (chỉ khi tòa trong PA vẫn đúng bản gốc của lượt chờ). */
export const layTam = (toa: ToaDat): ToaDat | null => (tam && tam.goc === toa ? tam.toa : null);
export const ngheToaTam = (fn: () => void): (() => void) => { ngheTam.add(fn); return () => { ngheTam.delete(fn); }; };
