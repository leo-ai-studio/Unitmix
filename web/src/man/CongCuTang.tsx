/**
 * Thanh công cụ tay màn Tầng (lớp phủ trên bản vẽ — không bóp / xô khung giữa) như app cũ MDI_Unitmix_v4 (`prototype/shell.src.html`
 * ~1250: Sắp xếp căn ✥ · Thêm ▾ (căn / thang bộ) · Xóa · Lật gương ⇄): mỗi thao tác chạy tinh/thaoTacTay.ts (tự chỉnh XC-03/05/06/07 ·
 * PC-11 · QT-69 trong CÙNG một bước `kho.sua`), không hợp lệ thì báo lớp phủ và trả về. Kéo thả bám tay 1:1 (rAF), bóng xem trước ô
 * đích, tôn trọng prefers-reduced-motion. Chế độ chỉ xem: khoá.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { canDangDung, type BoCuc, type ViTriCan } from '../tinh/matBang';
import { doiChoTay, doiThangTay, latTay, mauThem, thangTuDongLai, themCanTay, themThangTay, xoaCanTay, xoaThangTay, type Ctx, type KetQuaTay } from '../tinh/thaoTacTay';
import { NutBieuTuong } from '../ui/NutBieuTuong';
import type { ToaVe } from '../ve/MatBangTang';
import { datBaoStretch } from './baoStretch';
import { layDuLieuMB } from './tuChinhTang';

type CanSo = { vt: ViTriCan; canId: string; no: number; cn: string };
export type PropsCongCu = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  tv: ThuVien;
  toa: ToaDat;
  mau: ToaVe;
  bc: BoCuc;
  can: CanSo[];
  tangs: number[] | null;
  /** Ô căn đang chọn (chính + chọn thêm) và thang đang chọn. */
  dsO: string[];
  thangKhoa: string | null;
  chonThang: (khoa: string | null) => void;
  chonCan: (khoa: string | null) => void;
  keoBat: boolean;
  datKeoBat: (b: boolean) => void;
  hienHL: boolean;
  datHienHL: (b: boolean) => void;
};

const giamDong = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const tenCH = (no: number | undefined) => `CH-${String(no ?? 0).padStart(2, '0')}`;

/** Chạy một thao tác tay: thành công thì ghi vào PA (một bước hoàn tác) + báo; không thì báo lý do, không sửa. */
function useChay(p: PropsCongCu) {
  return (op: (c: Ctx) => KetQuaTay, chuOk: (toaMoi: ToaDat) => string): boolean => {
    if (p.chiXem) return false;
    const dl = layDuLieuMB();
    if (!dl) { datBaoStretch({ loai: 'loi', chu: t('cc.loi.chuaTai') }); return false; }
    const r = op({ tv: p.tv, dl });
    if (!r.ok) { datBaoStretch({ loai: 'loi', chu: t(`cc.loi.${r.lyDo}`).replace('{n}', r.chiTiet ?? '') }); return false; }
    p.sua((q) => ({ ...q, toa: q.toa.map((x) => (x.id === p.toa.id ? r.toa : x)) }));
    datBaoStretch({ loai: 'ok', chu: chuOk(r.toa) + (r.canhBao ? t(`cc.canhBao.${r.canhBao}`) : '') + (r.chan.length ? t('cc.chan').replace('{n}', String(r.chan.length)) : '') });
    return true;
  };
}

/** Số thang / số căn một tầng sau thao tác (đọc mặt bằng đã tự chỉnh lưu trong tòa). */
const soThangToa = (x: ToaDat) => x.matBang?.thangBo.length ?? 0;
const soCanTang = (x: ToaDat, tang: number | null) => {
  const mb = (tang !== null ? x.tangRieng?.[tang]?.matBang : undefined) ?? x.matBang;
  return mb?.baoCao?.soCan ?? 0;
};

export function ThanhCongCuTang(p: PropsCongCu) {
  const { chiXem, toa, tangs, dsO, thangKhoa, can, bc } = p;
  const chay = useChay(p);
  const [moThem, setMoThem] = useState(false);
  const k0 = tangs?.[0] ?? null;
  const oChinh = can.find((c) => c.vt.khoa === dsO[0]);
  const coChon = !!oChinh || !!thangKhoa;
  const ghi = (k: string) => `${t(`cc.${k}Gt`)}${chiXem ? ' · ' + t('cc.chiXem') : ''}`;
  const tenO = (khoa: string) => { const c = can.find((x) => x.vt.khoa === khoa); return c ? tenCH(c.no) : t('cc.thang'); };

  const themCan = () => {
    setMoThem(false);
    if (!oChinh) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    const id = mauThem(p.tv, canDangDung(oChinh.vt, bc));
    if (chay((c) => themCanTay(toa, tangs, oChinh.vt, id, c),
      (x) => t('cc.ok.themCan').replace('{c}', p.tv.can.get(id)?.ten_vi ?? id).replace('{o}', tenCH(oChinh.no)).replace('{n}', String(soCanTang(x, k0))))) p.chonCan(null);
  };
  const themThang = () => {
    setMoThem(false);
    const thang = thangKhoa ? p.mau.mat.flatMap((m, mi) => m.phan_tu.filter((q) => q.loai === 'thang_bo' && q.khoa === thangKhoa).map(() => mi))[0] : undefined;
    const mat = oChinh ? oChinh.vt.matIdx : thang;
    const sau = oChinh ? oChinh.vt.khoa : thangKhoa;
    if (mat === undefined || !sau) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    chay((c) => themThangTay(toa, mat, sau, c), (x) => t('cc.ok.themThang').replace('{o}', tenO(sau)).replace('{n}', String(soThangToa(x))));
  };
  const xoa = () => {
    if (chiXem) return;
    if (thangKhoa) {
      if (chay((c) => xoaThangTay(toa, thangKhoa, c), (x) => t('cc.ok.xoaThang').replace('{n}', String(soThangToa(x))))) p.chonThang(null);
      return;
    }
    if (!dsO.length) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    if (chay((c) => xoaCanTay(toa, tangs, dsO, c), (x) => t('cc.ok.xoaCan').replace('{n}', String(dsO.length)).replace('{m}', String(soCanTang(x, k0))))) p.chonCan(null);
  };
  const lat = () => {
    if (!dsO.length) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    chay((c) => latTay(toa, tangs, dsO, c), () => t('cc.ok.lat').replace('{n}', String(dsO.length)));
  };

  // phím Delete: xoá ô / thang đang chọn (như app cũ)
  const xoaRef = useRef(xoa);
  xoaRef.current = xoa;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      xoaRef.current();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  return (
    <div class="thanh-cc-tang" role="toolbar" aria-label={t('cc.nhom')}>
      <span class="nhom-bt">
        <NutBieuTuong k="sapXep" bat={p.keoBat} tat={chiXem} ghiChu={ghi('sapXep')} onClick={() => p.datKeoBat(!p.keoBat)} />
        <span class="cc-them">
          <NutBieuTuong k="them" bat={moThem} tat={chiXem} ghiChu={ghi('them')} onClick={() => setMoThem(!moThem)} />
          {moThem && (
            <span class="cc-menu-them nhom-bt" role="menu">
              <NutBieuTuong k="themCan" tat={chiXem || !oChinh} ghiChu={ghi('themCan')} onClick={themCan} />
              <NutBieuTuong k="themThang" tat={chiXem || !coChon} ghiChu={ghi('themThang')} onClick={themThang} />
            </span>
          )}
        </span>
        <NutBieuTuong k="xoa" tat={chiXem || !coChon} ghiChu={ghi('xoa')} onClick={xoa} />
        <NutBieuTuong k="lat" tat={chiXem || !dsO.length} ghiChu={ghi('lat')} onClick={lat}>{dsO.length > 1 ? <span>{dsO.length}</span> : null}</NutBieuTuong>
      </span>
      <span class="nhom-bt">
        <NutBieuTuong k="hanhLang" bat={p.hienHL} ghiChu={ghi('hanhLang')} onClick={() => p.datHienHL(!p.hienHL)} />
        <NutBieuTuong k="thangTuDong" tat={chiXem || !toa.thangTay} ghiChu={ghi('thangTuDong')}
          onClick={() => chay((c) => thangTuDongLai(toa, c), () => t('cc.ok.tuDong'))} />
      </span>
    </div>
  );
}

type Keo = { loai: 'o' | 'thang'; khoa: string; x0: number; y0: number; w: number; h: number; nhan: string };

/**
 * Kéo thả đổi chỗ (bật ✥): nhấn trên ô căn / ô thang rồi kéo — bóng bám tay 1:1 (rAF), ô đích tô xanh nét đứt (bóng xem trước);
 * thả lên ô khác thì đổi chỗ / dời thang; thả ra ngoài / không hợp lệ thì báo và bóng trượt về chỗ cũ (giảm chuyển động: về ngay).
 */
export function useKeoTay(p: PropsCongCu) {
  const chay = useChay(p);
  const [keo, setKeo] = useState<Keo | null>(null);
  const [oDich, setODich] = useState<string | null>(null);
  const bong = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pRef = useRef(p);
  pRef.current = p;

  const batDau = (e: PointerEvent) => {
    const q = pRef.current;
    if (!q.keoBat || q.chiXem || e.button !== 0 || e.shiftKey) return;
    const el = (e.target as Element | null)?.closest?.('[data-o],[data-thang]');
    if (!el) return;
    e.stopPropagation(); // không kéo di bản vẽ
    const khoaO = el.getAttribute('data-o'), khoaT = el.getAttribute('data-thang');
    const b = el.getBoundingClientRect();
    const c = khoaO ? q.can.find((x) => x.vt.khoa === khoaO) : undefined;
    const k: Keo = { loai: khoaO ? 'o' : 'thang', khoa: (khoaO ?? khoaT)!, x0: e.clientX, y0: e.clientY,
      w: Math.min(240, Math.max(96, b.width)), h: Math.min(140, Math.max(40, b.height)),
      nhan: c ? `${tenCH(c.no)} · ${q.tv.can.get(c.canId)?.ten_vi.split(' · ')[0] ?? ''}` : t('cc.thang') };
    let dangKeo = false, dich: string | null = null, x = e.clientX, y = e.clientY;
    const ve = () => {
      raf.current = 0;
      if (bong.current) bong.current.style.transform = `translate(${x - k.w / 2}px, ${y - k.h / 2}px)`;
    };
    const di = (ev: PointerEvent) => {
      x = ev.clientX; y = ev.clientY;
      if (!dangKeo && Math.hypot(x - k.x0, y - k.y0) < 5) return;
      if (!dangKeo) { dangKeo = true; setKeo(k); }
      if (!raf.current) raf.current = requestAnimationFrame(ve);
      const duoi = document.elementFromPoint(x, y)?.closest?.('[data-o],[data-thang]');
      const moi = duoi ? (duoi.getAttribute('data-o') ?? duoi.getAttribute('data-thang')) : null;
      const hop = moi && moi !== k.khoa && !(k.loai === 'thang' && duoi?.hasAttribute('data-thang')) ? moi : null;
      if (hop !== dich) { dich = hop; setODich(hop); }
    };
    const tha = () => {
      window.removeEventListener('pointermove', di);
      window.removeEventListener('pointerup', tha);
      window.removeEventListener('pointercancel', tha);
      cancelAnimationFrame(raf.current); raf.current = 0;
      setODich(null);
      if (!dangKeo) return;
      const ok = dich ? thucHien(k, dich) : (datBaoStretch({ loai: 'loi', chu: t('cc.loi.thaNgoai') }), false);
      if (ok || giamDong() || !bong.current) { setKeo(null); return; }
      // trả về: bóng trượt về chỗ cũ rồi tắt
      const el2 = bong.current;
      el2.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1)';
      el2.style.transform = `translate(${k.x0 - k.w / 2}px, ${k.y0 - k.h / 2}px)`;
      setTimeout(() => setKeo(null), 200);
    };
    window.addEventListener('pointermove', di);
    window.addEventListener('pointerup', tha);
    window.addEventListener('pointercancel', tha);
  };

  const thucHien = (k: Keo, dich: string): boolean => {
    const q = pRef.current, toa = q.toa;
    const cO = (kh: string) => q.can.find((x) => x.vt.khoa === kh);
    const a = k.loai === 'o' ? cO(k.khoa) : undefined, b = cO(dich);
    if (a && b) return chay((c) => doiChoTay(toa, q.tangs, a.vt, b.vt, c), () => t('cc.ok.doiCho').replace('{a}', tenCH(a.no)).replace('{b}', tenCH(b.no)));
    if (k.loai === 'thang' && b) return chay((c) => doiThangTay(toa, k.khoa, b.vt.matIdx, b.vt.khoa, c), () => t('cc.ok.doiThang').replace('{o}', tenCH(b.no)));
    if (a && !b) return chay((c) => doiThangTay(toa, dich, a.vt.matIdx, a.vt.khoa, c), () => t('cc.ok.doiThang').replace('{o}', tenCH(a.no)));
    datBaoStretch({ loai: 'loi', chu: t('cc.loi.thaNgoai') });
    return false;
  };

  const bongKeo = keo && (
    <div ref={bong} class="bong-keo" aria-hidden="true"
      style={{ width: `${keo.w}px`, height: `${keo.h}px`, transform: `translate(${keo.x0 - keo.w / 2}px, ${keo.y0 - keo.h / 2}px)` }}>
      <span>{keo.nhan}</span>
      <small>{oDich ? t('cc.thaVao').replace('{o}', q2(oDich)) : t('cc.keo')}</small>
    </div>
  );
  function q2(kh: string) { const c = p.can.find((x) => x.vt.khoa === kh); return c ? tenCH(c.no) : t('cc.thang'); }
  return { batDau, oDich, oKeo: keo?.khoa ?? null, bongKeo };
}
