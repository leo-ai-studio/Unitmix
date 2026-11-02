import { useEffect } from 'preact/hooks';
import { t } from '../i18n/i18n';

/** Tên tầng hiển thị: số tầng thật = số tầng đế + thứ tự tầng điển hình (k = 1..soTangDH). */
export const tenTang = (soTangDe: number, k: number) => t('oc.tr.tang').replace('{n}', String(soTangDe + k));

/** Nhãn phạm vi đang áp: bố cục chung, hoặc danh sách tầng gọn (vd. "Tầng 5–7, 9"). */
export function nhanPhamVi(tangs: number[] | null, soTangDe: number): string {
  if (!tangs?.length) return t('oc.tr.chungNgan');
  const ds = [...tangs].sort((a, b) => a - b).map((k) => soTangDe + k);
  const doan: string[] = [];
  for (let i = 0; i < ds.length; ) {
    let j = i;
    while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++;
    doan.push(j > i ? `${ds[i]}–${ds[j]}` : String(ds[i]));
    i = j + 1;
  }
  return t('oc.tr.tang').replace('{n}', doan.join(', '));
}

type Props = {
  soTangDH: number;
  soTangDe: number;
  /** null = mọi tầng điển hình (bố cục chung). */
  tangs: number[] | null;
  datTangs: (v: number[] | null) => void;
  /** Tầng đang có bố cục riêng (đánh chấm). */
  coRieng: number[];
  /** Tầng có mục tiêu cơ cấu riêng. */
  coCauRieng: number[];
};

// Kênh chọn tầng từ ngoài (menu tầng trên thanh trên): ô ChonTang đang gắn nhận lệnh; chưa gắn (đang ở TMB) thì giữ lệnh chờ,
// ô gắn vào là áp. Trạng thái chọn tầng nằm trong màn Tầng, thanh trên chỉ gửi lệnh qua đây.
let datNgoai: ((v: number[] | null) => void) | null = null;
let lenhCho: { v: number[] | null } | null = null;
/** Chọn tầng điển hình đang xem từ ngoài màn Tầng: null = bố cục chung, [k] = tầng điển hình thứ k. */
export function chonTangNgoai(v: number[] | null) {
  if (datNgoai) datNgoai(v);
  else lenhCho = { v };
}

/** Ô chọn tầng áp dụng (L10): mặc định mọi tầng điển hình; hoặc bấm chọn từng tầng (Shift: chọn dải). */
export function ChonTang({ soTangDH, soTangDe, tangs, datTangs, coRieng, coCauRieng }: Props) {
  useEffect(() => {
    datNgoai = datTangs;
    if (lenhCho) { const { v } = lenhCho; lenhCho = null; datTangs(v); }
    return () => { if (datNgoai === datTangs) datNgoai = null; };
  });
  const ds = Array.from({ length: soTangDH }, (_, i) => i + 1);
  const chon = new Set(tangs ?? []);
  const bam = (k: number, e: MouseEvent) => {
    const cu = tangs ?? [];
    if (e.shiftKey && cu.length) {
      const a = cu[cu.length - 1], [lo, hi] = a < k ? [a, k] : [k, a];
      datTangs([...new Set([...cu, ...ds.filter((x) => x >= lo && x <= hi)])].sort((p, q) => p - q));
      return;
    }
    const moi = chon.has(k) ? cu.filter((x) => x !== k) : [...cu, k].sort((p, q) => p - q);
    datTangs(moi.length ? moi : null);
  };
  return (
    <div class="chon-tang">
      <label class="o-tg"><input type="radio" name="tang-ap" checked={!tangs} onChange={() => datTangs(null)} /><span>{t('oc.tr.chung')}</span></label>
      <label class="o-tg"><input type="radio" name="tang-ap" checked={!!tangs} onChange={() => datTangs([soTangDH])} /><span>{t('oc.tr.chonTang')}</span></label>
      {tangs && <div class="luoi-tang" role="group" aria-label={t('oc.tr.tieuDe')} title={t('oc.tr.ghiChu')}>
        {ds.map((k) => (
          <button type="button" key={k} aria-pressed={chon.has(k)} class={`${coRieng.includes(k) ? 'rieng' : ''}${coCauRieng.includes(k) ? ' cc-rieng' : ''}`}
            title={tenTang(soTangDe, k)} onClick={(e) => bam(k, e)}>{soTangDe + k}</button>
        ))}
      </div>}
    </div>
  );
}
