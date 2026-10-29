/**
 * Phân tích PCCC màn Tầng chạy nền (Web Worker dùng chung tệp thaoTay.worker.ts, tên `phanTichPCCC`): một lượt gồm hai lần giải cửa
 * hành lang (cửa lý tưởng → tủ né cửa → cửa thật) + bài phủ tủ chính xác — 100–300 ms trên mẫu lớn, không được chạy trên luồng
 * chính khi sửa tầng. Luồng chính giữ bộ nhớ kết quả theo mặt bằng (pcccTang `daNhoPCCC`); lượt đang chạy KHÔNG bị huỷ (worker giữ
 * thư viện đã gửi), lượt mới đến lúc bận thì chờ — chỉ giữ lượt mới nhất. Không có Worker (vitest / node) thì chạy đồng bộ.
 */
import type { ThuVien } from './kieu';
import type { DuLieuMB } from './loiThang';
import { daNhoPCCC, ghiNhoPCCC, khoaPCCCTang, phanTichPCCCTang, type DauVaoPCCCTang, type KetQuaPCCCTang } from './pcccTang';
import type { ThuTay, ThuTayXong, WorkerTay } from './tayNen';

type Viec = { mau: object; khoa: string; v: DauVaoPCCCTang };

class NenPCCC {
  private worker: WorkerTay | null = null;
  private tvW: ThuVien | undefined;
  private dlW: DuLieuMB | null | undefined;
  private dlCo = false;
  private soId = 0;
  private dangChay: (Viec & { id: number }) | null = null;
  private cho: Viec | null = null;
  private nghe = new Set<() => void>();
  private khongWorker = false;

  /** Kết quả đã có (nhớ) của `v`, hoặc null — khi null thì đã xếp lượt chạy nền; xong sẽ báo người nghe. */
  lay(v: DauVaoPCCCTang): KetQuaPCCCTang | null {
    const khoa = khoaPCCCTang(v), co = daNhoPCCC(v.mau, khoa);
    if (co) return co;
    if (!this.coWorker()) return phanTichPCCCTang(v);
    if (this.dangChay && this.dangChay.mau === v.mau && this.dangChay.khoa === khoa) return null;
    this.cho = { mau: v.mau, khoa, v };
    this.chayTiep();
    return null;
  }

  ngheXong(fn: () => void): () => void { this.nghe.add(fn); return () => { this.nghe.delete(fn); }; }
  get ban(): boolean { return !!this.dangChay; }

  private chayTiep(): void {
    if (this.dangChay || !this.cho) return;
    const c = this.cho;
    this.cho = null;
    if (daNhoPCCC(c.mau, c.khoa)) { this.bao(); return this.chayTiep(); }
    const id = ++this.soId;
    this.dangChay = { ...c, id };
    const { tv, dl, ...con } = c.v;
    const thu: ThuTay = { id, ten: 'phanTichPCCC', args: [con] };
    if (this.tvW !== tv) { thu.tv = tv; this.tvW = tv; }
    if (!this.dlCo || this.dlW !== dl) { thu.dl = dl ?? null; this.dlW = dl; this.dlCo = true; }
    this.worker!.postMessage(thu);
  }

  private coWorker(): boolean {
    if (this.khongWorker) return false;
    if (!this.worker) {
      if (typeof Worker === 'undefined') { this.khongWorker = true; return false; }
      try {
        this.worker = new Worker(new URL('./thaoTay.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerTay;
      } catch { this.khongWorker = true; return false; }
      this.tvW = undefined; this.dlW = undefined; this.dlCo = false;
      this.worker.onmessage = (e) => this.nhan(e.data);
      this.worker.onerror = () => this.loi('worker');
    }
    return true;
  }

  private nhan(m: ThuTayXong) {
    const c = this.dangChay;
    if (!c || c.id !== m.id) return;
    this.dangChay = null;
    if (m.loi !== undefined) { this.loi(m.loi, c); return; }
    if (m.kq) ghiNhoPCCC(c.mau, c.khoa, m.kq as KetQuaPCCCTang);
    this.bao();
    this.chayTiep();
  }

  /** Worker lỗi: tính đồng bộ lượt đó cho đúng kết quả, dựng worker mới cho lượt sau. */
  private loi(loi: string, c?: Viec | null) {
    console.error('PCCC nền:', loi);
    this.worker?.terminate();
    this.worker = null;
    const viec = c ?? this.dangChay;
    this.dangChay = null;
    if (viec) { try { ghiNhoPCCC(viec.mau, viec.khoa, phanTichPCCCTang(viec.v)); } catch { /* bỏ */ } }
    this.bao();
    this.chayTiep();
  }

  private bao() { for (const f of [...this.nghe]) f(); }
}

export const nenPCCC = new NenPCCC();
