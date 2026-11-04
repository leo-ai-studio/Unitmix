/**
 * ĐO + KÍCH THƯỚC (DIM) trên bản vẽ — dùng chung TMB · Tầng · Hầm (tinh/kichThuoc.ts): bắt điểm kiểu CAD (đỉnh · giao · trung điểm ·
 * vuông góc · gần nhất · lưới, Shift = khoá ngang / đứng), kích thước thẳng / ngang / đứng / góc đặt được (hai điểm + điểm thứ ba
 * chọn chỗ đặt đường kích thước, như CAD và Architechtures), kích thước liên tục, lưu theo phạm vi trong PA (hoàn tác được).
 * Lớp phủ SVG ở toạ độ mét (y lên → vẽ y âm như các lớp khác của BanVe), không bắt chuột; thanh chọn kiểu / bắt điểm là popover dưới nút Đo.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { NutBieuTuong } from '../ui/NutBieuTuong';
import { batDiemDo, CAU_HINH_BAT, hinhKichThuoc, lechTuDiem, type CauHinhBat, type KetQuaBatDo, type KichThuoc, type LoaiKichThuoc, type NguonBat } from '../tinh/kichThuoc';
import type { Diem, TrangThaiPA } from '../tinh/kieu';

// ---------- tuỳ chọn dùng chung (lưu ở trình duyệt) ----------
type TuyChonDo = { kieu: LoaiKichThuoc; cfg: CauHinhBat; lienTuc: boolean };
const KHOA = 'unitmix.do.v1';
const doc = (): TuyChonDo => {
  try {
    const v = JSON.parse(localStorage.getItem(KHOA) ?? '{}') as Partial<TuyChonDo>;
    return { kieu: ['thang', 'ngang', 'dung', 'goc'].includes(v.kieu as string) ? v.kieu! : 'thang', cfg: { ...CAU_HINH_BAT, ...(v.cfg ?? {}), ortho: false }, lienTuc: v.lienTuc === true };
  } catch { return { kieu: 'thang', cfg: { ...CAU_HINH_BAT }, lienTuc: false }; }
};
let tc: TuyChonDo = typeof localStorage === 'undefined' ? { kieu: 'thang', cfg: { ...CAU_HINH_BAT }, lienTuc: false } : doc();
const nghe = new Set<() => void>();
export const datTuyChonDo = (p: Partial<TuyChonDo>) => {
  tc = { ...tc, ...p };
  try { localStorage.setItem(KHOA, JSON.stringify(tc)); } catch { /* chặn lưu */ }
  nghe.forEach((f) => f());
};
export function useTuyChonDo(): TuyChonDo {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tc;
}

const SO_DIEM: Record<LoaiKichThuoc, number> = { thang: 2, ngang: 2, dung: 2, goc: 3 };
const idMoi = () => `kt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const MAU_DO = 'var(--green, #1f6f68)';

type Props = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  /** phạm vi lưu kích thước: 'tmb' · 'ham' · 'tang:<id tòa>' */
  phamVi: string;
  /** nguồn bắt điểm (mét, y lên) — gọi mỗi lần bấm / rê chuột, nên tính nhẹ */
  nguon: () => NguonBat;
  bat: boolean;
  tat: () => void;
  /** kích cỡ bản vẽ (m): suy ra ngưỡng bắt và cỡ chữ */
  keoDai: number;
};

/** Móc đo: trả hàm bấm / rê chuột cho BanVe, lớp phủ SVG và trạng thái. */
export function useDoKichThuoc(p: Props) {
  const opt = useTuyChonDo();
  const [dang, setDang] = useState<Diem[]>([]);
  const [tro, setTro] = useState<KetQuaBatDo | null>(null);
  const [shift, setShift] = useState(false);
  const ds = p.pa.kichThuoc?.[p.phamVi] ?? [];
  const nguongM = Math.max(0.15, p.keoDai * 0.008), coChu = Math.max(0.3, Math.min(2.5, p.keoDai * 0.016));
  const can = SO_DIEM[opt.kieu];
  const cho = dang.length === can; // đủ điểm đo, đang chờ điểm đặt đường kích thước
  const ref = useRef({ dang, opt, nguon: p.nguon, tro });
  ref.current = { dang, opt, nguon: p.nguon, tro };

  const luu = (k: KichThuoc) => p.sua((x) => ({ ...x, kichThuoc: { ...(x.kichThuoc ?? {}), [p.phamVi]: [...(x.kichThuoc?.[p.phamVi] ?? []), k] } }));
  const xoa = (id: string) => p.sua((x) => {
    const con = (x.kichThuoc?.[p.phamVi] ?? []).filter((k) => k.id !== id), kt = { ...(x.kichThuoc ?? {}) };
    if (con.length) kt[p.phamVi] = con; else delete kt[p.phamVi];
    return { ...x, kichThuoc: Object.keys(kt).length ? kt : undefined };
  });
  const xoaHet = () => p.sua((x) => { const kt = { ...(x.kichThuoc ?? {}) }; delete kt[p.phamVi]; return { ...x, kichThuoc: Object.keys(kt).length ? kt : undefined }; });

  const batTai = (q: Diem, sh = shift): KetQuaBatDo => batDiemDo(q, p.nguon(), { ...opt.cfg, ortho: sh }, nguongM, dang.length ? dang[dang.length - 1] : null);
  const hoanTat = (diem: Diem[], lech: number) => {
    luu({ id: idMoi(), loai: opt.kieu, p: diem, lech });
    // liên tục: điểm cuối của kích thước này là điểm đầu của kích thước kế (chỉ thẳng / ngang / đứng)
    setDang(opt.lienTuc && opt.kieu !== 'goc' ? [diem[diem.length - 1]] : []);
  };
  const onBamNen = (q: Diem, e?: PointerEvent): boolean => {
    if (!p.bat || p.chiXem) return false;
    const kq = batTai(q, !!e?.shiftKey || shift);
    if (!cho) {
      const moi = [...dang, kq.p];
      setDang(moi);
    } else {
      hoanTat(dang, lechTuDiem(opt.kieu, dang, kq.p));
    }
    return true;
  };
  const onTroDi = (q: Diem | null) => { if (!p.bat) return; setTro(q ? batTai(q) : null); };

  // phím: Esc huỷ điểm đang đặt (lần nữa thoát đo), Enter đặt mặc định, Shift khoá ngang / đứng
  useEffect(() => {
    if (!p.bat) { setDang([]); setTro(null); return; }
    const xuong = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShift(true);
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      const r = ref.current;
      if (e.key === 'Escape') { e.preventDefault(); if (r.dang.length) setDang([]); else p.tat(); }
      else if (e.key === 'Enter' && r.dang.length === SO_DIEM[r.opt.kieu]) {
        e.preventDefault();
        const mau = r.dang;
        luu({ id: idMoi(), loai: r.opt.kieu, p: mau, lech: r.opt.kieu === 'goc' ? 0 : 0.6 });
        setDang(r.opt.lienTuc && r.opt.kieu !== 'goc' ? [mau[mau.length - 1]] : []);
      }
    };
    const len = (e: KeyboardEvent) => { if (e.key === 'Shift') setShift(false); };
    window.addEventListener('keydown', xuong); window.addEventListener('keyup', len);
    return () => { window.removeEventListener('keydown', xuong); window.removeEventListener('keyup', len); };
  }, [p.bat, p.phamVi]);
  useEffect(() => { setDang([]); }, [opt.kieu]);

  // kích thước đang đặt (xem trước)
  const xemTruoc: KichThuoc | null = useMemo(() => {
    if (!p.bat || !tro) return null;
    if (cho) return { id: 'xem', loai: opt.kieu, p: dang, lech: lechTuDiem(opt.kieu, dang, tro.p) };
    return null;
  }, [p.bat, tro, cho, dang, opt.kieu]);

  const veKt = (k: KichThuoc, mau: string, xem = false) => {
    const h = hinhKichThuoc(k, coChu * 0.4), m = coChu * 0.5;
    const y = (q: Diem): [number, number] => [q[0], -q[1]];
    const tamGiac = (dinh: Diem, huong: Diem) => {
      const lui: Diem = [dinh[0] - huong[0] * m, dinh[1] - huong[1] * m], n: Diem = [-huong[1] * m * 0.3, huong[0] * m * 0.3];
      return [dinh, [lui[0] + n[0], lui[1] + n[1]], [lui[0] - n[0], lui[1] - n[1]]].map((q) => y(q as Diem).join(',')).join(' ');
    };
    const nhan = h.nhan;
    return (
      <g key={k.id} class={`do-kt${xem ? ' xem' : ''}`} data-kt={k.id} style={{ pointerEvents: 'none' }}>
        {h.chan.map(([a, b], i) => <line key={`c${i}`} x1={y(a)[0]} y1={y(a)[1]} x2={y(b)[0]} y2={y(b)[1]} stroke={mau} stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.8" />)}
        {h.duong && <line x1={y(h.duong[0])[0]} y1={y(h.duong[0])[1]} x2={y(h.duong[1])[0]} y2={y(h.duong[1])[1]} stroke={mau} stroke-width="1.4" vector-effect="non-scaling-stroke" />}
        {h.cung.length > 1 && <polyline points={h.cung.map((q) => y(q).join(',')).join(' ')} fill="none" stroke={mau} stroke-width="1.4" vector-effect="non-scaling-stroke" />}
        {h.mui.map((mu, i) => <polygon key={`m${i}`} points={tamGiac(mu.dinh, mu.huong)} fill={mau} />)}
        <text x={y(nhan.p)[0]} y={y(nhan.p)[1]} transform={`rotate(${-nhan.goc} ${y(nhan.p)[0]} ${y(nhan.p)[1]})`} text-anchor="middle" dominant-baseline="text-after-edge"
          font-size={coChu} font-weight="700" fill={mau} stroke="var(--panel, #fff)" stroke-width={coChu * 0.22} paint-order="stroke">{nhan.chu}</text>
      </g>
    );
  };
  const diemBat = tro && p.bat ? tro : null;
  const lop = (
    <g class="lop-do-kt" style={{ pointerEvents: 'none' }}>
      {ds.map((k) => veKt(k, MAU_DO))}
      {xemTruoc && veKt(xemTruoc, 'var(--warn, #b45309)', true)}
      {p.bat && dang.length > 0 && (
        <g>
          {dang.map((q, i) => <circle key={i} cx={q[0]} cy={-q[1]} r={coChu * 0.22} fill={MAU_DO} />)}
          {!cho && diemBat && <line x1={dang[dang.length - 1][0]} y1={-dang[dang.length - 1][1]} x2={diemBat.p[0]} y2={-diemBat.p[1]} stroke="var(--warn, #b45309)" stroke-width="1.2" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" />}
          {dang.length === 2 && opt.kieu === 'goc' && <line x1={dang[1][0]} y1={-dang[1][1]} x2={dang[0][0]} y2={-dang[0][1]} stroke={MAU_DO} stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.6" />}
        </g>
      )}
      {diemBat && (
        <g>
          <rect x={diemBat.p[0] - coChu * 0.28} y={-diemBat.p[1] - coChu * 0.28} width={coChu * 0.56} height={coChu * 0.56} fill="none" stroke={diemBat.loai ? 'var(--warn, #b45309)' : MAU_DO} stroke-width="1.6" vector-effect="non-scaling-stroke" />
          {diemBat.loai && (
            <text x={diemBat.p[0] + coChu * 0.45} y={-diemBat.p[1] - coChu * 0.45} font-size={coChu * 0.62} fill="var(--warn, #b45309)" stroke="var(--panel, #fff)" stroke-width={coChu * 0.16} paint-order="stroke">{t(`do.bat.${diemBat.loai}`)}</text>
          )}
        </g>
      )}
      {p.bat && !p.chiXem && <rect x={-1e5} y={-1e5} width={2e5} height={2e5} fill="transparent" style={{ pointerEvents: 'all', cursor: 'crosshair' }} />}
    </g>
  );
  const huongDan = !p.bat ? '' : dang.length === 0 ? t('do.goi.diem1') : cho ? t('do.goi.dat') : opt.kieu === 'goc' ? t('do.goi.goc') : t('do.goi.diem2');
  return { onBamNen, onTroDi, lop, ds, xoa, xoaHet, huongDan, dangDo: p.bat, dang, soKt: ds.length };
}

type NutProps = { bat: boolean; onBat: () => void; chiXem: boolean; ds: KichThuoc[]; xoa: (id: string) => void; xoaHet: () => void; huongDan: string };
const KIEU: LoaiKichThuoc[] = ['thang', 'ngang', 'dung', 'goc'];
const LOAI_BAT: (keyof CauHinhBat)[] = ['dinh', 'giao', 'trung', 'vuong', 'gan', 'luoi'];

/** Nút Đo + popover (kiểu kích thước, bắt điểm, danh sách kích thước đã đặt) — đặt trong thanh công cụ của bản vẽ. */
export function NutDoKichThuoc({ bat, onBat, chiXem, ds, xoa, xoaHet, huongDan }: NutProps) {
  const opt = useTuyChonDo();
  return (
    <span class="nut-do-kt">
      <NutBieuTuong k="do" ghiChu={t('do.nut')} bat={bat} tat={chiXem && !ds.length} onClick={onBat}>
        {ds.length > 0 && <span class="tmb-dem">{ds.length}</span>}
      </NutBieuTuong>
      {bat && (
        <div class="thanh-do" role="group" aria-label={t('do.nut')}>
          <div class="nhom-nut" role="group" aria-label={t('do.kieu')}>
            {KIEU.map((k) => <button key={k} type="button" aria-pressed={opt.kieu === k} onClick={() => datTuyChonDo({ kieu: k })}>{t(`do.kieu.${k}`)}</button>)}
          </div>
          <div class="do-bat" role="group" aria-label={t('do.bat')}>
            {LOAI_BAT.map((k) => (
              <label key={k} class="o-tg"><input type="checkbox" checked={!!opt.cfg[k]} onChange={(e) => datTuyChonDo({ cfg: { ...opt.cfg, [k]: e.currentTarget.checked } })} />{t(`do.bat.${k}`)}</label>
            ))}
            <label class="o-tg"><input type="checkbox" checked={opt.lienTuc} onChange={(e) => datTuyChonDo({ lienTuc: e.currentTarget.checked })} />{t('do.lienTuc')}</label>
          </div>
          <p class="muted do-goi-y">{huongDan} · {t('do.phim')}</p>
          {ds.length > 0 && (
            <ul class="do-ds">
              {ds.map((k) => <li key={k.id}><span>{t(`do.kieu.${k.loai}`)} · {hinhKichThuoc(k).nhan.chu}</span>{!chiXem && <button type="button" aria-label={t('do.xoa')} onClick={() => xoa(k.id)}>×</button>}</li>)}
            </ul>
          )}
          {ds.length > 0 && !chiXem && <button type="button" class="nut-phu" onClick={xoaHet}>{t('do.xoaHet')}</button>}
        </div>
      )}
    </span>
  );
}
