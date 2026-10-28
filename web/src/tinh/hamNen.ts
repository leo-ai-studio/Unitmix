/**
 * Rải hầm trong Web Worker (de_xuat_hieu_nang mục 8 "chưa làm"): raiHamTinh mất 4,5–14 s, chạy trên luồng chính thì giao diện đứng.
 *
 * Lớp điều phối:
 * - Trúng cache `raiHam` (tinh/ham.ts, theo khoá đầu vào) thì trả ngay, không gọi worker.
 * - Chưa có thì xếp việc cho worker; trong lúc chờ, mỗi "kênh" (màn Hầm, Chi phí, 3D) nhận lại kết quả CŨ của chính nó ở lô đó
 *   (nếu có) để giữ bản vẽ / số liệu, kèm cờ `dangCho` để hiện vòng O "Đang rải hầm…".
 * - Mỗi lần kênh đọc xong (`xong()`), kênh khai lại bộ khoá nó cần. Việc không kênh nào cần nữa bị bỏ khỏi hàng; việc đang chạy
 *   mà hết người cần thì huỷ worker (terminate) và dựng worker mới cho việc kế → chỉ giữ lượt mới nhất.
 * - Không có Worker (vitest / node) thì rải đồng bộ như cũ.
 */
import { useEffect, useState } from 'preact/hooks';
import { datNhoHam, khoaRaiHam, layNhoHam, paGonChoHam, raiHamTinh, type KetQuaHam } from './ham';
import type { Lo, ThuVien, TrangThaiPA } from './kieu';

/** Thư gửi worker: `tv` chỉ gửi khi worker chưa có đúng thư viện này. */
export type ThuRai = { id: number; pa: TrangThaiPA; lo: Lo; tv?: ThuVien | null };
export type ThuXong = { id: number; kq?: KetQuaHam | null; loi?: string };

/** Phần của Worker mà lớp điều phối dùng (để giả lập trong test). */
export type WorkerGiong = {
  postMessage: (m: ThuRai) => void;
  terminate: () => void;
  onmessage: ((e: { data: ThuXong }) => void) | null;
  onerror?: ((e: unknown) => void) | null;
};

type Viec = { khoa: string; pa: TrangThaiPA; tv: ThuVien | null; lo: Lo };
type Chay = { id: number; viec: Viec };

export type PhienHam = {
  /** Kết quả cho lô: có (hoặc null = ranh rỗng) → trả; đang rải → kết quả cũ của kênh ở lô này, chưa có thì undefined. */
  lay: (pa: TrangThaiPA, tv: ThuVien | null, lo: Lo) => KetQuaHam | null | undefined;
  /** Có lô nào trong lượt đọc này đang chờ worker. */
  readonly dangCho: boolean;
  /** Khai bộ khoá kênh cần (gọi sau khi đọc xong): xếp việc mới, bỏ / huỷ việc cũ. */
  xong: () => void;
};

export class DieuPhoiHam {
  private worker: WorkerGiong | null = null;
  private tvCuaWorker: ThuVien | null | undefined = undefined;
  private chay: Chay | null = null;
  private hang = new Map<string, Viec>();
  private kenhCan = new Map<string, Set<string>>();
  private cu = new Map<string, Map<string, KetQuaHam | null>>();
  private nguoiNghe = new Set<() => void>();
  private soId = 0;
  /** Tăng mỗi khi có kết quả mới (để nhớ / dựng lại phía giao diện). */
  phienBan = 0;
  /** Số lần huỷ worker giữa chừng (test, đo). */
  soLanHuy = 0;

  constructor(private taoWorker: () => WorkerGiong | null) {}

  phien(kenh: string): PhienHam {
    const can = new Set<string>();
    const viec = new Map<string, Viec>();
    let dangCho = false;
    const cuKenh = this.cu.get(kenh) ?? new Map<string, KetQuaHam | null>();
    this.cu.set(kenh, cuKenh);
    return {
      lay: (pa, tv, lo) => {
        const khoa = khoaRaiHam(pa, lo);
        let kq = layNhoHam(tv, khoa);
        if (kq === undefined && !this.coWorker()) { // không có Worker: rải đồng bộ
          kq = raiHamTinh(pa, tv, lo);
          datNhoHam(tv, khoa, kq);
        }
        if (kq !== undefined) { cuKenh.set(lo.id, kq); return kq; }
        can.add(khoa);
        viec.set(khoa, { khoa, pa: paGonChoHam(pa, lo), tv, lo });
        dangCho = true;
        return cuKenh.get(lo.id);
      },
      get dangCho() { return dangCho; },
      xong: () => this.khai(kenh, can, viec),
    };
  }

  /** Kênh thôi dùng (gỡ màn): bỏ mọi việc chỉ kênh này cần. */
  bo(kenh: string): void {
    this.khai(kenh, new Set(), new Map());
  }

  nghe(fn: () => void): () => void {
    this.nguoiNghe.add(fn);
    return () => { this.nguoiNghe.delete(fn); };
  }

  /** Đang có việc chạy / chờ (test, đo). */
  get ban(): boolean { return !!this.chay || this.hang.size > 0; }

  private coWorker(): boolean {
    if (!this.worker) {
      this.worker = this.taoWorker();
      this.tvCuaWorker = undefined;
      if (this.worker) {
        this.worker.onmessage = (e) => this.nhan(e.data);
        this.worker.onerror = () => this.loiWorker('worker');
      }
    }
    return !!this.worker;
  }

  /** Kênh còn việc đang chờ worker (theo lần khai gần nhất) — dùng cho nơi đọc kết quả ngoài render (3D). */
  dangChoKenh(kenh: string): boolean {
    for (const k of this.kenhCan.get(kenh) ?? []) if (this.hang.has(k) || this.chay?.viec.khoa === k) return true;
    return false;
  }

  private khai(kenh: string, can: Set<string>, viec: Map<string, Viec>): void {
    const truoc = this.dangChoKenh(kenh);
    if (can.size) this.kenhCan.set(kenh, can); else this.kenhCan.delete(kenh);
    for (const [k, v] of viec) if (!this.hang.has(k) && this.chay?.viec.khoa !== k) this.hang.set(k, v);
    const conCan = new Set([...this.kenhCan.values()].flatMap((s) => [...s]));
    for (const k of [...this.hang.keys()]) if (!conCan.has(k)) this.hang.delete(k);
    if (this.chay && !conCan.has(this.chay.viec.khoa)) { // lượt cũ hết người cần: huỷ ngay, không chờ rải xong
      this.worker?.terminate();
      this.worker = null;
      this.chay = null;
      this.soLanHuy++;
    }
    this.bom();
    // kênh vừa chuyển sang chờ: báo để hiện vòng tải (không tăng phienBan → 3D không dựng lại); báo sau render hiện tại
    if (!truoc && this.dangChoKenh(kenh)) queueMicrotask(() => this.bao(false));
  }

  private bom(): void {
    if (this.chay || !this.hang.size || !this.coWorker()) return;
    const [khoa, viec] = this.hang.entries().next().value!;
    this.hang.delete(khoa);
    // trong lúc chờ có thể đã có kết quả (kênh khác / rải đồng bộ)
    if (layNhoHam(viec.tv, khoa) !== undefined) { this.bom(); return; }
    const id = ++this.soId;
    this.chay = { id, viec };
    const thu: ThuRai = { id, pa: viec.pa, lo: viec.lo };
    if (this.tvCuaWorker !== viec.tv) { thu.tv = viec.tv; this.tvCuaWorker = viec.tv; }
    this.worker!.postMessage(thu);
  }

  private nhan(m: ThuXong): void {
    const c = this.chay;
    if (!c || c.id !== m.id) return; // kết quả lượt đã huỷ: bỏ
    this.chay = null;
    if (m.loi !== undefined) { this.loiWorker(m.loi, c.viec); return; }
    datNhoHam(c.viec.tv, c.viec.khoa, m.kq ?? null);
    this.bao();
    this.bom();
  }

  /** Worker lỗi: rải đồng bộ việc đang chạy cho đúng số (hiếm), dựng worker mới cho việc sau. */
  private loiWorker(loi: string, viec = this.chay?.viec): void {
    console.error('raiHam worker:', loi);
    this.worker?.terminate();
    this.worker = null;
    this.chay = null;
    if (viec && layNhoHam(viec.tv, viec.khoa) === undefined) datNhoHam(viec.tv, viec.khoa, raiHamTinh(viec.pa, viec.tv, viec.lo));
    this.bao();
    this.bom();
  }

  private bao(coKetQua = true): void {
    if (coKetQua) this.phienBan++;
    for (const f of [...this.nguoiNghe]) f();
  }
}

const taoWorkerMacDinh = (): WorkerGiong | null => {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./raiHam.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerGiong;
  } catch {
    return null;
  }
};

export const dieuPhoiHam = new DieuPhoiHam(taoWorkerMacDinh);

/** Nghe kết quả worker để vẽ lại; gỡ màn thì bỏ việc của kênh. Trả phiên bản (đưa vào khoá nhớ / dựng lại). */
export function useNgheHam(kenh: string): number {
  const [, setDem] = useState(0);
  useEffect(() => {
    const go = dieuPhoiHam.nghe(() => setDem((d) => d + 1));
    return () => { go(); dieuPhoiHam.bo(kenh); };
  }, [kenh]);
  return dieuPhoiHam.phienBan;
}

/** Một lô cho một kênh: `kq` undefined = chưa có kết quả nào (đang rải lần đầu). */
export function useRaiHam(kenh: string, pa: TrangThaiPA, tv: ThuVien | null, lo: Lo | null | undefined): { kq: KetQuaHam | null | undefined; dangCho: boolean } {
  useNgheHam(kenh);
  const p = dieuPhoiHam.phien(kenh);
  const kq = lo ? p.lay(pa, tv, lo) : null;
  p.xong();
  return { kq, dangCho: p.dangCho };
}
