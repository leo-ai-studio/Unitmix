import { useState } from 'preact/hooks';
import { hoiChu, xacNhan } from './HopHoi';
import { t } from '../i18n/i18n';
import { docPreset, khoTrinhDuyet, luuPreset, nhapPreset, xoaPreset, xuatPreset, type DuLieuPreset, type NhomPreset, type PhamViPreset, type Preset } from '../kho/preset';

type Props = {
  nhom: NhomPreset;
  chiXem: boolean;
  /** Chụp cấu hình hiện tại; null nếu chưa có gì để lưu (vd. chưa có lô). */
  chup: () => DuLieuPreset | null;
  /** Áp preset đã chọn. `pham` chỉ có nghĩa với preset theo cấp. */
  ap: (du: DuLieuPreset, pham: PhamViPreset) => void;
  /** Preset theo cấp: cho chọn áp vào lô đang chọn hay cả PA. */
  chonPham?: boolean;
};

/** Dòng "Preset: [chọn ▾] [Lưu]" kèm Xoá, Xuất, Nhập file JSON. Chế độ chỉ xem: không lưu / áp / xoá / nhập được. */
export function DongPreset({ nhom, chiXem, chup, ap, chonPham = false }: Props) {
  const kho = khoTrinhDuyet();
  const [ds, setDs] = useState<Preset[]>(() => (kho ? docPreset(kho, nhom) : []));
  const [chon, setChon] = useState('');
  const [pham, setPham] = useState<PhamViPreset>('lo');
  const [tin, setTin] = useState('');
  const gt = (k: string) => t(`gt.ps.${k}`);

  async function luu() {
    const du = chup();
    if (!kho || !du) return setTin(gt('khongLuuDuoc'));
    const ten = ((await hoiChu(gt('hoiTen'), chon)) ?? '').trim();
    if (!ten) return;
    if (ds.some((p) => p.ten === ten) && !(await xacNhan(gt('ghiDe').replace('{n}', ten), { nguyHiem: true }))) return;
    const moi = luuPreset(kho, nhom, ten, du);
    if (!moi) return setTin(gt('khongLuuDuoc'));
    setDs(moi);
    setChon(ten);
    setTin(gt('daLuu').replace('{n}', ten));
  }
  async function xoa() {
    if (!kho || !chon || !(await xacNhan(gt('hoiXoa').replace('{n}', chon), { nguyHiem: true }))) return;
    setDs(xoaPreset(kho, nhom, chon));
    setTin(gt('daXoa').replace('{n}', chon));
    setChon('');
  }
  function apChon(ten: string) {
    setChon(ten);
    const p = ds.find((x) => x.ten === ten);
    if (!p) return;
    ap(p.du, pham);
    setTin(gt('daAp').replace('{n}', ten));
  }
  function xuat() {
    const url = URL.createObjectURL(new Blob([xuatPreset(nhom, ds)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `unitmix-preset-${nhom}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function nhap(f: File) {
    if (!kho) return setTin(gt('khongLuuDuoc'));
    const kq = nhapPreset(kho, nhom, await f.text());
    if (kq.ok) { setDs(kq.ds); setTin(gt('daNhap').replace('{n}', String(kq.them))); }
    else setTin(gt(`loiNhap.${kq.loi}`));
  }

  return (
    <div class="preset" role="group" aria-label={gt('nhom')} title={gt(nhom === 'cap' ? 'giaiThichCap' : 'giaiThichMuc')}>
      <span class="preset-nhan">{gt('nhan')}</span>
      <select value={chon} aria-label={gt('chon')} title={gt('chon')} disabled={chiXem || !ds.length} onChange={(e) => apChon(e.currentTarget.value)}>
        <option value="">{ds.length ? gt('chonDay') : gt('chuaCo')}</option>
        {ds.map((p) => <option value={p.ten}>{p.ten}</option>)}
      </select>
      {chonPham && (
        <select value={pham} aria-label={gt('pham')} title={gt('phamGiaiThich')} disabled={chiXem} onChange={(e) => setPham(e.currentTarget.value as PhamViPreset)}>
          <option value="lo">{gt('phamLo')}</option>
          <option value="pa">{gt('phamPA')}</option>
        </select>
      )}
      <button type="button" class="nut-nho" disabled={chiXem || !kho} title={gt('luu')} onClick={luu}>{gt('luuNut')}</button>
      <button type="button" class="nut-nho" disabled={chiXem || !chon} title={gt('xoa')} aria-label={gt('xoa')} onClick={xoa}>✕</button>
      <button type="button" class="nut-nho" disabled={!ds.length} title={gt('xuat')} aria-label={gt('xuat')} onClick={xuat}>⤓</button>
      <label class={`nut-nho${chiXem || !kho ? ' tat' : ''}`} title={gt('nhap')}>
        ⤒
        <input type="file" accept=".json,application/json" class="sr-only" aria-label={gt('nhap')} disabled={chiXem || !kho}
          onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void nhap(f); }} />
      </label>
      {tin && <small class="preset-tin" role="status">{tin}</small>}
    </div>
  );
}
