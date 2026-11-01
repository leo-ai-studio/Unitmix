/**
 * Thanh công cụ tay màn Tầng (lớp phủ trên bản vẽ — không bóp / xô khung giữa) như app cũ MDI_Unitmix_v4 (`prototype/shell.src.html`
 * ~1250: Sắp xếp căn ✥ · Thêm ▾ (căn sau / trước ô chọn, vào chỗ trống; thang bộ) · Xóa · Lật gương ⇄): mỗi thao tác chạy
 * tinh/thaoTacTay.ts (tự chỉnh XC-03/05/06/07 · PC-11 · QT-69 trong CÙNG một bước `kho.sua`), không hợp lệ thì báo lớp phủ và trả về.
 * Câu báo luôn ghi căn / tầng trước → sau; tự chỉnh gỡ căn vượt cự ly thoát nạn thì ghi căn nào + căn cứ, kèm gợi ý giữ số căn
 * (tinh/baoThaoTac.ts — chỉ gợi ý). Kéo thả bám tay 1:1 (rAF), dò hợp lệ ô đích khi chuột dừng ~120 ms (cache theo ô đích), ô đích
 * không hợp lệ tô `--warn` kèm lý do ngắn; tôn trọng prefers-reduced-motion. Chế độ chỉ xem: khoá.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { bienDongCan, type BienDongCan, type GoiYGiuCan } from '../tinh/baoThaoTac';
import { choTrong, type ChoTrong } from '../tinh/choTrong';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { mauToa } from '../tinh/canThem';
import { boCucTang, canDangDung, type BoCuc, type ViTriCan } from '../tinh/matBang';
import { datTam, dieuPhoiDo, dieuPhoiTay, goTam, hinhNhanh, layTam, ngheToaTam, phepTay, type PhepTay } from '../tinh/tayNen';
import { dsMauThem, mauThem, type Ctx, type KetQuaTay } from '../tinh/thaoTacTay';
import { demLoaiThang, matBangTang, THANG_N2, THANG_N3, type LoaiThangBo } from '../tinh/loiThang';
import { chieuCaoPCCC, gioiHanThoatNan } from '../tinh/pccc';
import { NutBieuTuong } from '../ui/NutBieuTuong';
import { soLieuTang, type ToaVe } from '../ve/MatBangTang';
import { khongDiBanVe, ngonKhiKeoO } from '../ve/camUng';
import { baoConHien, datBaoStretch } from './baoStretch';
import { layDuLieuMB, mauCuaToa } from './tuChinhTang';

type CanSo = { vt: ViTriCan; canId: string; no: number; cn: string };
/** Đoạn trống đang rê chuột trong danh sách chỗ trống (bản vẽ tô nét đứt). */
export type ChoSang = { matIdx: number; a0: number; a1: number } | null;
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
  datChoSang?: (c: ChoSang) => void;
};

const giamDong = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const tenCH = (no: number | undefined) => `CH-${String(no ?? 0).padStart(2, '0')}`;
const dd1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }); // tạo một lần, không tạo lại mỗi nhãn
const m1 = (mm: number) => dd1.format(mm / 1000);

/** Tên ô theo số CH ở mặt bằng TRƯỚC thao tác (căn bị gỡ không còn ở mặt bằng sau); không thấy thì khoá ô. */
const tenOTheo = (can: CanSo[]) => (khoa: string) => { const c = can.find((x) => x.vt.khoa === khoa); return c ? tenCH(c.no) : `${t('cc.o')} ${khoa}`; };
/** Tên thang theo mặt: "Thang bộ mặt 2". */
const tenThang = (mau: ToaVe, khoa: string) => {
  const mi = mau.mat.findIndex((m) => m.phan_tu.some((q) => q.loai === 'thang_bo' && q.khoa === khoa));
  return mi >= 0 ? `${t('cc.thang')} ${t('cc.mat')} ${mi + 1}` : t('cc.thang');
};

/** Câu biến động số căn (Việc: câu báo nói rõ số căn thay đổi). */
export function chuBienDong(bd: BienDongCan, tenO: (k: string) => string, tenOSau: (k: string) => string = tenO): string {
  let s = ' ' + t('cc.bd.so').replace('{a}', String(bd.truoc)).replace('{b}', String(bd.sau));
  if (bd.goTN.length) s += ' ' + t('cc.bd.goTN').replace('{ds}', bd.goTN.map(tenO).join(', ')).replace('{cut}', String(bd.cut)).replace('{doi}', String(bd.doi)).replace('{cc}', bd.canCu);
  if (bd.goKhit.length) s += ' ' + t('cc.bd.goKhit').replace('{ds}', bd.goKhit.map(tenO).join(', '));
  if (bd.traLai.length) s += ' ' + t('cc.bd.traLai').replace('{ds}', bd.traLai.map(tenOSau).join(', '));
  return s;
}
const chuGoiY = (g: GoiYGiuCan, tenO: (k: string) => string, mau: ToaVe) => ' ' + (g.loai === 'doiThang'
  ? t('cc.goiY.doiThang').replace('{n}', String(g.soCan)).replace('{th}', tenThang(mau, g.thang)).replace('{o}', tenO(g.sauO))
  : t('cc.goiY.tuDong').replace('{n}', String(g.soCan)).replace('{m}', String(g.soThang)));

/** Ghi kết quả thao tác tay vào PA (một bước hoàn tác) + báo kèm căn / tầng trước → sau; không hợp lệ thì báo lý do, không sửa. */
function apKetQua(q: PropsCongCu, ctx: Ctx, r: KetQuaTay, chuOk: (toaMoi: ToaDat) => string): boolean {
  if (!r.ok) { datBaoStretch({ loai: 'loi', chu: t(`cc.loi.${r.lyDo}`).replace('{n}', r.chiTiet ?? '') }); return false; }
  q.sua((x) => ({ ...x, toa: x.toa.map((y) => (y.id === q.toa.id ? r.toa : y)) }));
  const k0 = q.tangs?.[0] ?? null, tenO = tenOTheo(q.can);
  const bd = bienDongCan(q.toa, r.toa, ctx, k0);
  // căn được trả lại chưa có ở mặt bằng trước → đánh số CH theo mặt bằng sau
  const tenOSau = (kh: string) => {
    const m = mauToa(q.tv, r.toa) as ToaVe | undefined;
    return m ? tenOTheo(soLieuTang(mauCuaToa(r.toa, m, k0), boCucTang(r.toa, k0), q.tv).can)(kh) : tenO(kh);
  };
  // cự ly thoát nạn: CHỈ cảnh báo (app cũ nhãn cự ly đỏ) — thao tác vẫn nhận, không tự bỏ căn / dời thang
  const mauSau = mauToa(q.tv, r.toa) as ToaVe | undefined;
  const vuot = mauSau ? matBangTang(r.toa, mauSau, ctx.dl, k0).baoCao?.vuotSau ?? 0 : 0;
  const gh = gioiHanThoatNan(chieuCaoPCCC(r.toa.soTangDe, r.toa.caoDe, r.toa.soTangDH, r.toa.caoDH));
  const chuTN = vuot > 0 && !bd.goTN.length ? ' ' + t('cc.canhBaoTN').replace('{n}', String(vuot)).replace('{c}', String(gh.cut)).replace('{d}', String(gh.doi)) : '';
  const chu = chuOk(r.toa) + (r.canhBao ? t(`cc.canhBao.${r.canhBao}`) : '') + (r.chan.length ? t('cc.chan').replace('{n}', String(r.chan.length)) : '') + chuBienDong(bd, tenO, tenOSau) + chuTN;
  const nhay = bd.truoc !== bd.sau || bd.goTN.length > 0 || vuot > 0;
  const id = datBaoStretch({ loai: 'ok', chu, giuMs: nhay ? 14000 : undefined });
  // gợi ý giữ số căn (dời thang như PC-11): chạy sau khi câu báo đã hiện, có hạn thời gian; KHÔNG tự áp
  // (chạy nền như phép tay — mỗi phép thử chạy lại tự chỉnh; phép tay mới huỷ lượt gợi ý đang dò)
  if (bd.sau < bd.truoc && bd.goTN.length) {
    void dieuPhoiTay.chay('goiYGiuCan', ctx, r.toa, bd.goTN, bd.truoc, k0, 1500).then((x) => {
      if (x && baoConHien(id)) datBaoStretch({ loai: 'ok', chu: chu + (x.g ? chuGoiY(x.g, tenO, q.mau) : ' ' + t('cc.goiY.khong')), giuMs: 16000 });
    });
  }
  return true;
}

/**
 * Chạy một phép tay NỀN (tinh/tayNen.ts — tự chỉnh / PC-11 dò lại từ đầu 150–400 ms ở mẫu lớn không chặn luồng chính): bản vẽ hiện
 * ngay phần hình học nhanh (`hinhNhanh`: đổi ô, chưa tự chỉnh) làm mặt bằng tạm, thanh công cụ hiện vòng O; có kết quả cuối mà tòa
 * chưa bị sửa gì khác thì ghi (MỘT bước hoàn tác) + báo (apKetQua), không thì bỏ. Lượt mới (phép tay khác, ⟲) huỷ lượt cũ.
 * `daCo` = kết quả đã dò sẵn (kéo thả) cho đúng tòa này → ghi ngay. Trả true khi đã ghi.
 */
function useChay(p: PropsCongCu) {
  const pRef = useRef(p);
  pRef.current = p;
  return (ph: PhepTay, chuOk: (toaMoi: ToaDat) => string, daCo?: KetQuaTay): Promise<boolean> => {
    const q = pRef.current;
    if (q.chiXem) return Promise.resolve(false);
    const dl = layDuLieuMB();
    if (!dl) { datBaoStretch({ loai: 'loi', chu: t('cc.loi.chuaTai') }); return Promise.resolve(false); }
    const ctx = { tv: q.tv, dl }, goc = q.toa;
    if (daCo) { dieuPhoiTay.huy(); datTam(goc, null); return Promise.resolve(apKetQua(q, ctx, daCo, chuOk)); }
    const maTam = datTam(goc, hinhNhanh(ph));
    return dieuPhoiTay.chayPhep(ph, ctx).then((r) => {
      goTam(maTam);
      const q2 = pRef.current;
      if (!r || q2.toa !== goc) return false; // bị huỷ (lượt mới), hoặc tòa đã đổi trong lúc chờ
      return apKetQua(q2, ctx, r, chuOk);
    });
  };
}

/**
 * Co kéo đầu hành lang (ve/TayHanhLang.tsx thả tay nắm): chạy NỀN phép `keoHanhLangTay` như mọi phép tay (một bước hoàn tác, câu báo
 * căn / tầng + cảnh báo cự ly). `d` = tổng độ dời đầu đó so với tự động (mm); 0 = về tự động.
 */
export function useKeoHanhLang(p: PropsCongCu) {
  const chay = useChay(p);
  return (i: number, dau: 0 | 1, d: number) => {
    void chay(phepTay('keoHanhLangTay', p.toa, i, dau, d), () => (d === 0 ? t('cc.ok.hanhLangTuDong')
      : t('cc.ok.hanhLang').replace('{d}', `${d > 0 ? '+' : '−'}${m1(Math.abs(d))} m`)));
  };
}

/** Mặt bằng tạm của tòa `toa` trong lúc phép tay chạy nền (null = vẽ tòa như trong PA). */
export function useToaTam(toa: ToaDat): ToaDat | null {
  const [, ve] = useState(0);
  useEffect(() => ngheToaTam(() => ve((n) => n + 1)), []);
  return layTam(toa);
}

/**
 * Chạy NỀN thao tác nặng (tinh/tayNen.ts — ⟲ thang về tự động: PC-11 dò lại từ đầu 150–400 ms ở mẫu lớn): bản vẽ giữ mặt bằng cũ,
 * nút hiện vòng O; xong mà tòa chưa bị sửa gì khác thì ghi như thao tác thường, không thì bỏ. Bấm lại / thao tác khác huỷ lượt cũ.
 */
function useChayNen(p: PropsCongCu) {
  const pRef = useRef(p);
  pRef.current = p;
  const [, ve] = useState(0);
  useEffect(() => dieuPhoiTay.nghe(() => ve((n) => n + 1)), []);
  // rời màn / đổi tòa: huỷ lượt đang chạy của tòa này
  useEffect(() => () => dieuPhoiTay.huy(), [p.toa.id]);
  const chay = (ten: 'thangTuDongLai', chuOk: (toaMoi: ToaDat) => string): void => {
    const q = pRef.current;
    if (q.chiXem) return;
    const dl = layDuLieuMB();
    if (!dl) { datBaoStretch({ loai: 'loi', chu: t('cc.loi.chuaTai') }); return; }
    const ctx = { tv: q.tv, dl }, goc = q.toa;
    datTam(goc, null);
    void dieuPhoiTay.chay(ten, ctx, goc).then((r) => {
      const q2 = pRef.current;
      if (!r || q2.toa !== goc) return; // bị huỷ, hoặc tòa đã đổi trong lúc chờ
      apKetQua(q2, ctx, r, chuOk);
    });
  };
  return { chay, dang: dieuPhoiTay.tenDangChay };
}

export function ThanhCongCuTang(p: PropsCongCu) {
  const { chiXem, toa, tangs, dsO, thangKhoa, can, bc } = p;
  const chay = useChay(p);
  const nen = useChayNen(p);
  const [moThem, setMoThem] = useState(false);
  const [moCho, setMoCho] = useState(false);
  const [mauChon, setMauChon] = useState<string | null>(null);
  const k0 = tangs?.[0] ?? null;
  const oChinh = can.find((c) => c.vt.khoa === dsO[0]);
  const coChon = !!oChinh || !!thangKhoa;
  const ghi = (k: string) => `${t(`cc.${k}Gt`)}${chiXem ? ' · ' + t('cc.chiXem') : ''}`;
  const tenO = (khoa: string) => { const c = can.find((x) => x.vt.khoa === khoa); return c ? tenCH(c.no) : t('cc.thang'); };
  const soCanSau = (x: ToaDat) => { const dl = layDuLieuMB(); return dl ? bienDongCan(x, x, { tv: p.tv, dl }, k0).sau : 0; };

  // mẫu căn chọn được cho "Thêm căn" sau / trước ô chọn: căn giữa cùng nhóm, chiều sâu; mặc định cùng mẫu (mauThem)
  const canChon = oChinh ? canDangDung(oChinh.vt, bc) : null;
  const dsMau = useMemo(() => (canChon ? dsMauThem(p.tv, canChon) : []), [p.tv, canChon]);
  const macDinh = canChon ? mauThem(p.tv, canChon) : null;
  const mauDung = mauChon && dsMau.some((x) => x.id === mauChon) ? mauChon : macDinh;
  useEffect(() => setMauChon(null), [canChon]);

  // chỗ trống (khe, đầu dãy hở, ô trống / ô đã xoá) — tính khi mở danh sách (không chạy tự chỉnh)
  const dsCho = useMemo<ChoTrong[]>(() => {
    if (!moThem) return [];
    const dl = layDuLieuMB();
    return dl ? choTrong(toa, p.tv, dl, k0) : [];
  }, [moThem, toa, p.tv, k0]);
  const sang = (c: ChoTrong | null) => p.datChoSang?.(c && !c.daXoa ? { matIdx: c.matIdx, a0: c.a0, a1: c.a1 } : null);
  useEffect(() => () => p.datChoSang?.(null), []);

  const dong = () => { setMoThem(false); setMoCho(false); sang(null); };
  const themCan = (truoc: boolean) => {
    dong();
    if (!oChinh || !mauDung) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    const id = mauDung;
    const ten = p.tv.can.get(id)?.ten_vi ?? id;
    // ô đang chọn là ô trống / phòng KT…: đặt căn vào chính ô
    if (oChinh.cn !== 'can') {
      void chay(phepTay('themVaoO', toa, tangs, oChinh.vt, id), () => t('cc.ok.themVaoO').replace('{c}', ten).replace('{o}', tenCH(oChinh.no))).then((ok) => ok && p.chonCan(null));
      return;
    }
    void chay(phepTay('themCanTay', toa, tangs, oChinh.vt, id, truoc),
      (x) => t(truoc ? 'cc.ok.themTruoc' : 'cc.ok.themCan').replace('{c}', ten).replace('{o}', tenCH(oChinh.no)).replace('{n}', String(soCanSau(x)))).then((ok) => ok && p.chonCan(null));
  };
  const themCho = (cho: ChoTrong, id: string) => {
    dong();
    const ten = p.tv.can.get(id)?.ten_vi ?? id;
    void chay(cho.loai === 'o' ? phepTay('themVaoO', toa, tangs, cho.neo, id) : phepTay('themCanTay', toa, tangs, cho.neo, id, cho.truoc),
      () => t('cc.ok.themCho').replace('{c}', ten).replace('{r}', m1(cho.rong)).replace('{m}', String(cho.matIdx + 1)));
  };
  const themThang = () => {
    dong();
    const thang = thangKhoa ? p.mau.mat.flatMap((m, mi) => m.phan_tu.filter((q) => q.loai === 'thang_bo' && q.khoa === thangKhoa).map(() => mi))[0] : undefined;
    const mat = oChinh ? oChinh.vt.matIdx : thang;
    const sau = oChinh ? oChinh.vt.khoa : thangKhoa;
    if (mat === undefined || !sau) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    void chay(phepTay('themThangTay', toa, mat, sau), (x) => t('cc.ok.themThang').replace('{o}', tenO(sau)).replace('{n}', String(x.matBang?.thangBo.length ?? 0)));
  };
  const xoa = () => {
    if (chiXem) return;
    if (thangKhoa) {
      void chay(phepTay('xoaThangTay', toa, thangKhoa), (x) => t('cc.ok.xoaThang').replace('{n}', String(x.matBang?.thangBo.length ?? 0))).then((ok) => ok && p.chonThang(null));
      return;
    }
    if (!dsO.length) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    void chay(phepTay('xoaCanTay', toa, tangs, dsO), () => t('cc.ok.xoaCan').replace('{n}', String(dsO.length))).then((ok) => ok && p.chonCan(null));
  };
  // loại thang đang chọn (QT-63): N3 | N2 — tòa luôn giữ ít nhất một N2 + một N3
  const loaiChon = thangKhoa ? p.mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai === 'thang_bo' && q.khoa === thangKhoa).map((q) => q.block))[0] : undefined;
  const doiLoai = (l: LoaiThangBo) => {
    if (!thangKhoa || l === loaiChon) return;
    const ten = tenThang(p.mau, thangKhoa);
    void chay(phepTay('doiLoaiThangTay', toa, thangKhoa, l), (x) => {
      const d = demLoaiThang(x.matBang?.thangBo ?? []);
      return t('cc.ok.doiLoai').replace('{th}', ten).replace('{l}', l === THANG_N2 ? 'N2' : 'N3').replace('{n2}', String(d.n2)).replace('{n3}', String(d.n3));
    });
  };
  const lat = () => {
    if (thangKhoa && !dsO.length) {
      const ten = tenThang(p.mau, thangKhoa);
      void chay(phepTay('latThangTay', toa, thangKhoa), () => t('cc.ok.latThang').replace('{th}', ten));
      return;
    }
    if (!dsO.length) { datBaoStretch({ loai: 'loi', chu: t('cc.chonTruoc') }); return; }
    void chay(phepTay('latTay', toa, tangs, dsO), () => t('cc.ok.lat').replace('{n}', String(dsO.length)));
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

  const tenLoaiCho = (c: ChoTrong) => t(c.loai === 'o' ? (c.daXoa ? 'cc.cho.daXoa' : 'cc.cho.oTrong') : `cc.cho.${c.loai}`);
  return (
    <div class="thanh-cc-tang" role="toolbar" aria-label={t('cc.nhom')}>
      <span class="nhom-bt">
        <NutBieuTuong k="sapXep" bat={p.keoBat} tat={chiXem} ghiChu={ghi('sapXep')} onClick={() => p.datKeoBat(!p.keoBat)} />
        <span class="cc-them">
          <NutBieuTuong k="them" bat={moThem} tat={chiXem} ghiChu={ghi('them')} onClick={() => (moThem ? dong() : setMoThem(true))} />
          {moThem && (
            <span class="cc-menu-them" role="menu">
              <span class="nhom-bt">
                <NutBieuTuong k="themCan" tat={chiXem || !oChinh} ghiChu={ghi('themCan')} onClick={() => themCan(false)} />
                <NutBieuTuong k="themTruoc" tat={chiXem || !oChinh || oChinh.cn !== 'can'} ghiChu={ghi('themTruoc')} onClick={() => themCan(true)} />
                <NutBieuTuong k="themCho" bat={moCho} tat={chiXem || !dsCho.length} ghiChu={ghi('themCho')} onClick={() => setMoCho(!moCho)}>
                  {dsCho.length ? <span>{dsCho.length}</span> : null}
                </NutBieuTuong>
                <NutBieuTuong k="themThang" tat={chiXem || !coChon} ghiChu={ghi('themThang')} onClick={themThang} />
              </span>
              {oChinh && dsMau.length > 0 && (
                <label class="cc-mau" title={t('cc.mauGt')}>
                  <span>{t('cc.mau')}</span>
                  <select value={mauDung ?? ''} disabled={chiXem} onChange={(e) => setMauChon(e.currentTarget.value)}>
                    {dsMau.map((m) => <option key={m.id} value={m.id}>{m.ten_vi}</option>)}
                  </select>
                </label>
              )}
              {moCho && (
                <ul class="cc-cho-trong" aria-label={t('cc.cho.nhom')} onMouseLeave={() => sang(null)}>
                  {dsCho.map((c) => {
                    const ms = dsMauThem(p.tv, c.canKe, c.rong, c.loai === 'o' ? c.neo.canGocId : undefined).slice(0, 4);
                    return (
                      <li key={`${c.loai}${c.matIdx}:${Math.round(c.a0)}`} onMouseEnter={() => sang(c)}>
                        <span class="cc-cho-ten">{tenLoaiCho(c)} · {t('cc.mat')} {c.matIdx + 1} · {m1(c.rong)} m</span>
                        {ms.length
                          ? ms.map((m) => (
                            <button key={m.id} type="button" class="nut-phu" disabled={chiXem} title={t('cc.cho.datGt')} onClick={() => themCho(c, m.id)}>
                              {m.ten_vi.split(' · ')[0]} {m1(m.rong_mm)}
                            </button>
                          ))
                          : <span class="muted">{t('cc.cho.khongMau')}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </span>
          )}
        </span>
        <NutBieuTuong k="xoa" tat={chiXem || !coChon} ghiChu={ghi('xoa')} onClick={xoa} />
        <NutBieuTuong k="lat" tat={chiXem || (!dsO.length && !thangKhoa)} ghiChu={ghi('lat')} onClick={lat}>{dsO.length > 1 ? <span>{dsO.length}</span> : null}</NutBieuTuong>
      </span>
      {thangKhoa && (loaiChon === THANG_N2 || loaiChon === THANG_N3) && (
        <span class="nhom-bt cc-loai-thang" role="group" aria-label={t('cc.loaiThang')} title={t('cc.loaiThangGt')}>
          {([THANG_N3, THANG_N2] as const).map((l) => (
            <button key={l} type="button" class={`nut-bt${loaiChon === l ? ' bat' : ''}`} aria-pressed={loaiChon === l} disabled={chiXem}
              onClick={() => doiLoai(l)}>{l === THANG_N2 ? 'N2' : 'N3'}</button>
          ))}
        </span>
      )}
      <span class="nhom-bt">
        <NutBieuTuong k="hanhLang" bat={p.hienHL} ghiChu={ghi('hanhLang')} onClick={() => p.datHienHL(!p.hienHL)} />
        <NutBieuTuong k="thangTuDong" tat={chiXem || !toa.thangTay} ghiChu={ghi('thangTuDong')}
          onClick={() => nen.chay('thangTuDongLai', () => t('cc.ok.tuDong'))}>
          {nen.dang === 'thangTuDongLai' && <img class="spin-o cc-dang-do" src="/brand/leo_ai_o.png" alt={t('cc.dangTuDong')} />}
        </NutBieuTuong>
      </span>
      {nen.dang && nen.dang !== 'thangTuDongLai' && nen.dang !== 'goiYGiuCan' && (
        <span class="cc-dang-chay" role="status" title={t('cc.dangChay')}><img class="spin-o" src="/brand/leo_ai_o.png" alt={t('cc.dangChay')} /></span>
      )}
    </div>
  );
}

type Keo = { loai: 'o' | 'thang'; khoa: string; x0: number; y0: number; w: number; h: number; nhan: string };
/** Kết quả dò ô đích lúc rê: 'dang' = chờ chuột dừng / đang dò; 'cham' = dò quá hạn, kiểm khi thả. */
type Do = { dich: string; tt: 'dang' | 'ok' | 'loi' | 'cham'; chu?: string };

/** Dò ô đích khi chuột dừng (ms) và hạn một lần dò (ms): lần dò quá hạn thì thôi dò trong lượt kéo này, kiểm khi thả. */
export const DO_DUNG_MS = 120;
export const DO_HAN_MS = 900;

/**
 * Kéo thả đổi chỗ (bật ✥): nhấn trên ô căn / ô thang rồi kéo — bóng bám tay 1:1 (rAF), ô đích tô xanh nét đứt (bóng xem trước);
 * chuột dừng ~120 ms trên ô đích thì chạy thử tự chỉnh (cache theo ô đích): không hợp lệ thì ô đích tô `--warn` + lý do ngắn.
 * Thả lên ô khác thì đổi chỗ / dời thang (dùng lại kết quả đã dò); thả ra ngoài / không hợp lệ thì báo và bóng trượt về chỗ cũ.
 */
export function useKeoTay(p: PropsCongCu) {
  const chay = useChay(p);
  const [keo, setKeo] = useState<Keo | null>(null);
  const [oDich, setODich] = useState<string | null>(null);
  const [doKq, setDoKq] = useState<Do | null>(null);
  const bong = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pRef = useRef(p);
  pRef.current = p;

  /** Phép thao tác ứng với thả ô `k` lên `dich` (hàm thuần, chưa ghi) + câu báo khi thành công. */
  const phep = (k: Keo, dich: string): { ph: PhepTay; chu: () => string } | null => {
    const q = pRef.current, toa = q.toa;
    const cO = (kh: string) => q.can.find((x) => x.vt.khoa === kh);
    const a = k.loai === 'o' ? cO(k.khoa) : undefined, b = cO(dich);
    if (a && b) return { ph: phepTay('doiChoTay', toa, q.tangs, a.vt, b.vt), chu: () => t('cc.ok.doiCho').replace('{a}', tenCH(a.no)).replace('{b}', tenCH(b.no)) };
    if (k.loai === 'thang' && b) return { ph: phepTay('doiThangTay', toa, k.khoa, b.vt.matIdx, b.vt.khoa), chu: () => t('cc.ok.doiThang').replace('{o}', tenCH(b.no)) };
    if (a && !b) return { ph: phepTay('doiThangTay', toa, dich, a.vt.matIdx, a.vt.khoa), chu: () => t('cc.ok.doiThang').replace('{o}', tenCH(a.no)) };
    return null;
  };

  /** Lượt kéo căn đang theo dõi (ngón / chuột đã nhấn trên ô): id con trỏ + huỷ (ngón thứ hai chạm → chụm của bản vẽ). */
  const phien = useRef<{ id: number; huy: () => void } | null>(null);
  const batDau = (e: PointerEvent) => {
    const q = pRef.current;
    const nx = ngonKhiKeoO(phien.current?.id ?? null, e.pointerId, e.pointerType);
    if (nx === 'chum') { phien.current?.huy(); return; } // ngón thứ hai: huỷ kéo căn, để BanVe chụm (không chặn sự kiện)
    if (nx === 'bo') return;
    // ngón không phải ngón đầu của lượt chạm (ngón đầu đặt ngoài ô, đang dời / chụm bản vẽ): không bắt đầu kéo căn
    if (e.pointerType !== 'mouse' && !e.isPrimary) return;
    if (!q.keoBat || q.chiXem || e.button !== 0 || e.shiftKey) return;
    const el = (e.target as Element | null)?.closest?.('[data-o],[data-thang]');
    if (!el) return;
    // không kéo di bản vẽ: chuột thì chặn hẳn; ngón / bút thì để bản vẽ ghi nhận ngón (ngón thứ hai chụm được) mà không dời theo
    if (e.pointerType === 'mouse') e.stopPropagation(); else khongDiBanVe.add(e);
    const khoaO = el.getAttribute('data-o'), khoaT = el.getAttribute('data-thang');
    const b = el.getBoundingClientRect();
    const c = khoaO ? q.can.find((x) => x.vt.khoa === khoaO) : undefined;
    const k: Keo = { loai: khoaO ? 'o' : 'thang', khoa: (khoaO ?? khoaT)!, x0: e.clientX, y0: e.clientY,
      w: Math.min(240, Math.max(96, b.width)), h: Math.min(140, Math.max(40, b.height)),
      nhan: c ? `${tenCH(c.no)} · ${q.tv.can.get(c.canId)?.ten_vi.split(' · ')[0] ?? ''}` : t('cc.thang') };
    let dangKeo = false, dich: string | null = null, x = e.clientX, y = e.clientY;
    // dò hợp lệ: cache theo ô đích trong lượt kéo (cho đúng tòa lúc bắt đầu kéo); hẹn chạy NỀN khi chuột dừng (worker dò riêng,
    // dò ô mới huỷ lượt dò ô cũ) — luồng chính không bị chặn, bóng vẫn bám tay
    const toaKeo = q.toa;
    const cache = new Map<string, KetQuaTay>();
    let hen: ReturnType<typeof setTimeout> | undefined, cham = false;
    let dangDo: { d: string; hua: Promise<KetQuaTay | null> } | null = null;
    const baoDo = (d: string) => {
      const r = cache.get(d);
      if (!r) { setDoKq({ dich: d, tt: cham ? 'cham' : 'dang' }); return; }
      if (!r.ok) { setDoKq({ dich: d, tt: 'loi', chu: t(`cc.ngan.${r.lyDo}`).replace('{n}', r.chiTiet ?? '') }); return; }
      const dl = layDuLieuMB(), qq = pRef.current;
      const bd = dl ? bienDongCan(qq.toa, r.toa, { tv: qq.tv, dl }, qq.tangs?.[0] ?? null) : null;
      setDoKq({ dich: d, tt: 'ok', chu: bd && (bd.truoc !== bd.sau || bd.goTN.length) ? t('cc.ngan.bd').replace('{a}', String(bd.truoc)).replace('{b}', String(bd.sau)) : undefined });
    };
    const doThu = (d: string) => {
      hen = undefined;
      if (cache.has(d) || cham || d !== dich) return;
      const ph = phep(k, d), dl = layDuLieuMB();
      if (!ph || !dl || pRef.current.toa !== toaKeo) return;
      const t0 = performance.now();
      const hua = dieuPhoiDo.chayPhep(ph.ph, { tv: pRef.current.tv, dl });
      dangDo = { d, hua };
      void hua.then((r) => {
        if (dangDo?.hua === hua) dangDo = null;
        if (!r) return; // bị huỷ: rê sang ô khác / thả
        cache.set(d, r);
        if (performance.now() - t0 > DO_HAN_MS) cham = true; // dò quá lâu: thôi dò lúc rê, kiểm khi thả
        if (d === dich && phien.current?.id === e.pointerId) baoDo(d);
      });
    };
    const ve = () => {
      raf.current = 0;
      if (bong.current) bong.current.style.transform = `translate(${x - k.w / 2}px, ${y - k.h / 2}px)`;
    };
    const di = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      x = ev.clientX; y = ev.clientY;
      if (!dangKeo && Math.hypot(x - k.x0, y - k.y0) < 5) return;
      if (!dangKeo) { dangKeo = true; setKeo(k); }
      if (!raf.current) raf.current = requestAnimationFrame(ve);
      const duoi = document.elementFromPoint(x, y)?.closest?.('[data-o],[data-thang]');
      const moi = duoi ? (duoi.getAttribute('data-o') ?? duoi.getAttribute('data-thang')) : null;
      const hop = moi && moi !== k.khoa && !(k.loai === 'thang' && duoi?.hasAttribute('data-thang')) ? moi : null;
      if (hop !== dich) {
        dich = hop; setODich(hop);
        if (hop) baoDo(hop); else setDoKq(null);
      }
      // chuột còn di thì hoãn phép dò nặng tới khi dừng ~120 ms
      clearTimeout(hen);
      if (hop && !cache.has(hop) && !cham) { const d = hop; hen = setTimeout(() => doThu(d), DO_DUNG_MS); }
    };
    const go = () => {
      window.removeEventListener('pointermove', di);
      window.removeEventListener('pointerup', tha);
      window.removeEventListener('pointercancel', tha);
      cancelAnimationFrame(raf.current); raf.current = 0;
      clearTimeout(hen);
      setODich(null); setDoKq(null);
      if (phien.current?.id === e.pointerId) phien.current = null;
    };
    const tha = (ev?: PointerEvent) => {
      if (ev && ev.pointerId !== e.pointerId) return; // ngón khác nhấc lên: không phải lượt này
      go();
      if (!dangKeo) return;
      const ph = dich ? phep(k, dich) : null;
      const dung = pRef.current.toa === toaKeo;
      const daDo = dich && dung ? cache.get(dich) : undefined;
      const choDo = dich && dung && dangDo?.d === dich ? dangDo.hua : null;
      if (!choDo) dieuPhoiDo.huy();
      const xong = (ok: boolean) => {
        if (ok || giamDong() || !bong.current) { setKeo(null); return; }
        // trả về: bóng trượt về chỗ cũ rồi tắt
        const el2 = bong.current;
        el2.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1)';
        el2.style.transform = `translate(${k.x0 - k.w / 2}px, ${k.y0 - k.h / 2}px)`;
        setTimeout(() => setKeo(null), 200);
      };
      if (!ph) { datBaoStretch({ loai: 'loi', chu: t('cc.loi.thaNgoai') }); xong(false); return; }
      // đã dò xong ô đích → ghi ngay; đang dò dở → chờ lượt dò đó (không dò lại); chưa dò → chạy nền như phép tay
      if (daDo) { void chay(ph.ph, ph.chu, daDo).then(xong); return; }
      setDoKq({ dich: dich!, tt: 'dang' }); setODich(dich);
      const ketQua = choDo
        ? choDo.then((r) => (r && pRef.current.toa === toaKeo ? chay(ph.ph, ph.chu, r) : chay(ph.ph, ph.chu)))
        : chay(ph.ph, ph.chu);
      void ketQua.then((ok) => { setODich(null); setDoKq(null); xong(ok); });
    };
    window.addEventListener('pointermove', di);
    window.addEventListener('pointerup', tha);
    window.addEventListener('pointercancel', tha);
    // ngón thứ hai chạm (chụm): bỏ lượt kéo, bóng tắt ngay, không đổi chỗ / không báo
    phien.current = { id: e.pointerId, huy: () => { go(); dieuPhoiDo.huy(); dangKeo = false; setKeo(null); } };
  };

  const loiDich = !!doKq && doKq.tt === 'loi' && doKq.dich === oDich;
  const phu = (() => {
    if (!oDich) return t('cc.keo');
    const tha = t('cc.thaVao').replace('{o}', q2(oDich));
    if (!doKq || doKq.dich !== oDich) return tha;
    if (doKq.tt === 'loi') return `✕ ${doKq.chu}`;
    if (doKq.tt === 'ok') return `✓ ${tha}${doKq.chu ? ' · ' + doKq.chu : ''}`;
    return `${tha} · ${t(doKq.tt === 'cham' ? 'cc.doCham' : 'cc.dangDo')}`;
  })();
  const bongKeo = keo && (
    <div ref={bong} class={`bong-keo${loiDich ? ' loi' : ''}`} aria-hidden="true"
      style={{ width: `${keo.w}px`, height: `${keo.h}px`, transform: `translate(${keo.x0 - keo.w / 2}px, ${keo.y0 - keo.h / 2}px)` }}>
      <span>{keo.nhan}</span>
      <small>{phu}</small>
    </div>
  );
  function q2(kh: string) { const c = p.can.find((x) => x.vt.khoa === kh); return c ? tenCH(c.no) : t('cc.thang'); }
  return { batDau, oDich, oKeo: keo?.khoa ?? null, dichLoi: loiDich, bongKeo };
}
