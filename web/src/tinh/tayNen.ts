/**
 * Thao tác tay nặng chạy nền (Web Worker) — như tinh/hamNen.ts: ⟲ "thang về tự động" bắt PC-11 dò lại từ đầu (tuChinhToa không có
 * tập thang lần trước), mẫu lớn 150–400 ms trên luồng chính. Chạy nền thì bản vẽ giữ mặt bằng cũ, nút hiện vòng O `spin-o`;
 * có lượt mới (bấm lại, hoặc thao tác tay khác) thì lượt cũ bị huỷ (terminate worker, dựng worker mới cho lượt sau).
 * Không có Worker (vitest / node) thì chạy đồng bộ, kết quả y hệt (cùng hàm thuần tinh/thaoTacTay.ts).
 */
import type { DuLieuMB } from './loiThang';
import type { ThuVien, ToaDat } from './kieu';
import { thangTuDongLai, type Ctx, type KetQuaTay } from './thaoTacTay';

/** Bảng thao tác được chạy nền (tên → hàm thuần). Đối số phải chép được qua structuredClone. */
export const BANG_TAY = {
  thangTuDongLai: (c: Ctx, toa: ToaDat) => thangTuDongLai(toa, c),
} as const;
export type TenTay = keyof typeof BANG_TAY;
export type DoiSoTay<T extends TenTay> = Parameters<(typeof BANG_TAY)[T]> extends [Ctx, ...infer R] ? R : never;

/** Thư gửi worker: `tv` / `dl` chỉ gửi khi worker chưa có đúng bản này. */
export type ThuTay = { id: number; ten: TenTay; args: unknown[]; tv?: ThuVien; dl?: DuLieuMB | null };
export type ThuTayXong = { id: number; kq?: KetQuaTay; loi?: string };

export type WorkerTay = {
  postMessage: (m: ThuTay) => void;
  terminate: () => void;
  onmessage: ((e: { data: ThuTayXong }) => void) | null;
  onerror?: ((e: unknown) => void) | null;
};

/** Chạy một thao tác theo tên (dùng chung cho worker và đường đồng bộ). */
export const chayTay = (ten: TenTay, c: Ctx, args: unknown[]): KetQuaTay =>
  (BANG_TAY[ten] as (c: Ctx, ...a: unknown[]) => KetQuaTay)(c, ...args);

type Cho = { id: number; ten: TenTay; args: unknown[]; c: Ctx; xong: (r: KetQuaTay | null) => void };

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
  chay<T extends TenTay>(ten: T, c: Ctx, ...args: DoiSoTay<T>): Promise<KetQuaTay | null> {
    this.huy();
    if (!this.coWorker()) return Promise.resolve(chayTay(ten, c, args));
    return new Promise((xong) => {
      const id = ++this.soId;
      this.cho = { id, ten, args, c, xong };
      const thu: ThuTay = { id, ten, args };
      if (this.tvW !== c.tv) { thu.tv = c.tv; this.tvW = c.tv; }
      if (!this.dlCo || this.dlW !== c.dl) { thu.dl = c.dl ?? null; this.dlW = c.dl; this.dlCo = true; }
      this.worker!.postMessage(thu);
      this.bao();
    });
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

export const dieuPhoiTay = new DieuPhoiTay(taoWorkerMacDinh);
