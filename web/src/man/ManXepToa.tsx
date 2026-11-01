import { moTaLo } from './theLo';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { KetQuaChiTieu } from '../tinh/chiTieu';
import { demCan, diemLechCoCau, dtTbTheoLoai } from '../tinh/coCau';
import { chanToa, dienTich, khoiDe } from '../tinh/hinhHoc';
import { hopLo, taoToaTrenLo, vungDat } from '../tinh/hopLo';
import { LOAI_CAN, type Diem, type Lo, type LoaiCan, type ThuVien, type ToaDat, type ToaMau, type TrangThaiPA } from '../tinh/kieu';
import { BanVe, khungBao, s, sPoly, type DieuKhienVe } from '../ve/BanVe';
import { nguongRun } from '../ve/camUng';
import { HopNoi } from '../ve/MenuO';
import { MucGap } from '../ui/MucGap';
import { GocBanVe } from '../ui/GocBanVe';
import { BieuTuong, NutBieuTuong } from '../ui/NutBieuTuong';
import { fmtSo } from '../ui/so';
import { SoDong } from '../ui/SoDong';
import { laCaoTang, loaiDat, MAU_DAT } from '../tinh/loaiDat';
import { BangChiTieuLo, ChonLoCaoTang, LoChiTieu, LoNhap, SucChuaLo } from './ManLo';
import { DashDanSo } from '../ui/DashDanSo';
import { KpiTmb } from '../ui/KpiTmb';
import { GoiYXepToa, LopGoiY } from '../ui/GoiYXepToa';
import {
  batDiem, batDinh, batGoc, caoToa, dichBatDinh, dichNhom, gocCanhLo, hinhToa, kichThuocToa, kiemViPham, latNhom, namTrongNhanh,
  tamNhom, toaTrongKhung, viTriNhanBan, xoayNhom, type MucBat,
} from '../tinh/thaoTacToa';
import { DsCanhBao, HopToaDo, ThanhTMB, datChonNhieu, datTuyChon, luaChon, suaNhom, useChonNhieu, useLuatTMB, useTuyChon } from './tmbThaoTac';
import { mauToa } from '../tinh/canThem';
import { canhGan } from '../tinh/thaoTacToa';
import { HopCanhLo, NhanCanhLo, datCanhChon } from './loGioiCanh';
import { HopHangLoat, LopHangLoat } from './xepHangLoat';
import { ThangMayLo } from '../ui/ThangMayLo';
import { moSoSanhMau } from '../ui/SoSanhMau';
import { ChuGiaiView, KpiView, LopViewTmb, TheViewToa, gocBacPA, nutLopView, useLopView } from './lopView';
import { nhanToa } from '../ui/nhanToa';
import { HopNangGioCho, LopNangGio2D, useNutNangGio } from '../nangGio'; // ảnh vệ tinh nền + nắng / gió (gói riêng, lớp phủ)

type Chung = {
  pa: TrangThaiPA;
  sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void;
  chiXem: boolean;
  loId: string | null;
  chonLo: (id: string) => void;
  tv: ThuVien | null;
  /** Tên dự án: đoán tỉnh để tự đặt vị trí ảnh vệ tinh nền (khỏi nhập toạ độ). */
  tenDuAn?: string;
  toaId: string | null;
  chonToa: (id: string | null) => void;
  /** Mở mặt bằng tầng của tòa để làm tiếp (bấm đúp tòa trên TMB / nút ở Thông số tòa). */
  moTang?: (id: string) => void;
  /** Mở màn Tầng tòa `toaId`, chọn ô đang dùng mẫu căn `canId` (danh sách căn sát mốc ở dân số). */
  moCan?: (toaId: string, canId: string) => void;
};

const xayO = laCaoTang;
/** Lô đang xếp: lô đã chọn nếu xây nhà ở, không thì lô nhà ở đầu tiên. */
export const loDangXep = (pa: TrangThaiPA, loId: string | null): Lo | undefined =>
  pa.lo.find((l) => l.id === loId && xayO(l)) ?? pa.lo.find(xayO);
const doiToa = (p: TrangThaiPA, id: string, fn: (x: ToaDat) => ToaDat): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? fn(x) : x)) });
const idMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const tenNgan = (m: ToaMau | undefined) => m?.ten_vi.split(' · ')[0] ?? '?';

function O({ nhan, tip, gt, donVi, onDoi, tat, buoc = 1, am = false }: { nhan: string; tip?: string; gt: number; donVi?: string; onDoi: (v: number) => void; tat: boolean; buoc?: number; am?: boolean }) {
  return (
    <label class="o-so" title={tip}>
      <span>{nhan}</span>
      <span class="o-so-nhap">
        <input type="number" value={gt} step={buoc} min={am ? undefined : 0} disabled={tat}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v) && (am || v >= 0)) onDoi(v);
          }} />
        {donVi && <small>{donVi}</small>}
      </span>
    </label>
  );
}

/** Panel trái màn Xếp tòa: chọn lô, thư viện mẫu tòa (hợp lô trước), tòa trên lô và thông số tòa đang chọn. */
export function XepTrai({ pa, sua, chiXem, loId, tv, toaId, chonToa, moTang }: Chung) {
  const lo = loDangXep(pa, loId);
  const [nhom, setNhom] = useState<'tm' | 'xh' | null>(null);
  const luat = useLuatTMB();
  const nhomXem = nhom ?? (lo?.temDat.chucNang === 'xh' ? 'xh' : 'tm');
  const vung = lo ? vungDat(lo) : [];
  const khoaVung = vung.map((p) => p.map((n) => n.toFixed(1)).join()).join(';');
  const dsMau = useMemo(() => {
    if (!tv || !lo) return [];
    return [...tv.toa.values()]
      .filter((m) => m.nhom === nhomXem)
      .map((m) => ({ m, ...hopLo(m, vung) }))
      .sort((a, b) => Number(b.hop) - Number(a.hop) || b.m.so_can_tang - a.m.so_can_tang);
  }, [tv, nhomXem, khoaVung]);

  if (!pa.lo.length) return <p class="dong muted">{t('xep.chuaCoLo')}</p>;
  const toaLo = lo ? pa.toa.filter((x) => x.loId === lo.id) : [];
  const toa = toaLo.find((x) => x.id === toaId);
  const tat = chiXem || !!toa?.khoa;
  const datTs = (k: keyof ToaDat) => (v: number) => toa && sua((p) => doiToa(p, toa.id, (x) => ({ ...x, [k]: v })));

  return (
    <>
      {lo && (
        <MucGap tieuDe={t('xep.goiYTieuDe')} giaiThich={t('gt.xep.goiY')} mo>
          <GoiYXepToa pa={pa} lo={lo} tv={tv} sua={sua} chiXem={chiXem} chonToa={chonToa} />
        </MucGap>
      )}
      {lo && (
        <MucGap tieuDe={t('xep.thuVien')} giaiThich={t('xep.thuVienGiaiThich')} mo={!toaLo.length}>
          <div class="dong">
            <div class="nhom-nut" role="group" aria-label={t('xep.thuVien')}>
              {(['tm', 'xh'] as const).map((k) => (
                <button type="button" title={t('gt.xep.nhom')} aria-pressed={nhomXem === k} onClick={() => setNhom(k)}>{t(k === 'tm' ? 'xep.nhomTm' : 'xep.nhomXh')}</button>
              ))}
            </div>
            {/* chỉ biểu tượng: hàng Thương mại / Nhà ở xã hội + nút chữ cũ vượt panel 270 px, xuống hai dòng */}
            <button type="button" class="nut-bt nut-so-sanh-mau" title={`${t('ssm.moNut')} — ${t('gt.ssm.moNut')}`} aria-label={t('ssm.moNut')} disabled={!tv}
              onClick={() => moSoSanhMau({ tv, nhom: nhomXem, hinh: (toa && tv?.toa.get(toa.mauId)?.nhom === nhomXem ? tv.toa.get(toa.mauId)?.hinh : null) ?? 'l' })}>
              <BieuTuong k="soSanhMau" />
            </button>
          </div>
          {!tv && <p class="dong muted">{t('lo.dangTaiThuVien')}</p>}
          {dsMau.map(({ m, hop }) => (
            <div class="the-mau" key={m.id}>
              <div>
                <b>{m.ten_vi}</b>
                <span class="muted">{t('xep.canTang').replace('{n}', String(m.so_can_tang))} · {fmtSo(m.dtxd_m2, { donVi: 'm²' })}</span>
                <span class={hop ? 'ok' : 'vuot'}>{hop ? `✓ ${t('xep.hopLo')}` : `✕ ${t('xep.khongHop')}`}</span>
              </div>
              <button type="button" class="nut-phu" title={t('gt.xep.dat')} disabled={chiXem}
                onClick={() => { const moi = taoToaTrenLo(m, lo, idMoi()); sua((p) => ({ ...p, toa: [...p.toa, moi] })); chonToa(moi.id); }}>
                {t('xep.dat')}
              </button>
            </div>
          ))}
        </MucGap>
      )}

      {lo && (
        <MucGap tieuDe={`${t('xep.toaTrenLo')} · ${toaLo.length}`} giaiThich={t('gt.xep.toaTrenLo')} mo>
          {!toaLo.length && <p class="dong muted">{t('xep.chuaCoToa')}</p>}
          {toaLo.map((x) => {
            return (
              <button type="button" key={x.id} class={`muc-lo${x.id === toaId ? ' chon' : ''}`} aria-pressed={x.id === toaId} onClick={() => chonToa(x.id)}>
                <b>{nhanToa(pa, tv, x.id, { day: true })}{x.khoa ? ` · ${t('xep.daKhoa')}` : ''}</b>
                <span>{x.soTangDe} + {x.soTangDH} T · {fmtSo(x.gocDo, { donVi: '°' })}</span>
              </button>
            );
          })}
        </MucGap>
      )}

      {toa && (
        <MucGap tieuDe={`${t('xep.thongSo')} · ${nhanToa(pa, tv, toa.id)}`} giaiThich={t('gt.xep.thongSo')} mo>
          <div class="luoi-o">
          <O nhan={t('xep.soTangDH')} tip={t('gt.xep.soTangDH')} gt={toa.soTangDH} tat={tat} onDoi={(v) => v >= 1 && datTs('soTangDH')(Math.round(v))} />
          <O nhan={t('xep.soTangDe')} tip={t('gt.xep.soTangDe')} gt={toa.soTangDe} tat={tat} onDoi={(v) => datTs('soTangDe')(Math.round(v))} />
          <O nhan={t('xep.goc')} tip={t('gt.xep.goc')} gt={toa.gocDo} donVi="°" buoc={5} am tat={tat} onDoi={(v) => datTs('gocDo')(((v % 360) + 360) % 360)} />
          <O nhan={t('xep.deOffset')} tip={t('gt.xep.deOffset')} gt={toa.deOffset} donVi="m" buoc={0.5} tat={tat} onDoi={datTs('deOffset')} />
          <O nhan={t('xep.x')} tip={t('gt.xep.x')} gt={toa.x} donVi="m" buoc={0.5} am tat={tat} onDoi={datTs('x')} />
          <O nhan={t('xep.y')} tip={t('gt.xep.y')} gt={toa.y} donVi="m" buoc={0.5} am tat={tat} onDoi={datTs('y')} />
          </div>
          <div class="dong" style={{ justifyContent: 'flex-start' }}>
            <div class="nhom-bt">
            <NutBieuTuong k="moTang" ghiChu={t('gt.xep.moTang')} tat={!moTang} onClick={() => moTang?.(toa.id)} />
            <NutBieuTuong k="nhanBan" ghiChu={t('gt.xep.nhanBan')} tat={chiXem || !tv}
              onClick={() => {
                if (!tv) return;
                // chỗ trống quanh tòa gốc: trong chỉ giới, đủ lùi LO-01, cách tòa khác ≥ cạnh dài §2.6.1
                const ban = viTriNhanBan(toa, pa, tv, luat, idMoi()).toa;
                sua((p) => ({ ...p, toa: [...p.toa, ban] }));
                chonToa(ban.id);
              }} />
            <NutBieuTuong k="lat" ghiChu={t('gt.xep.lat')} bat={!!toa.lat} tat={tat} onClick={() => sua((p) => doiToa(p, toa.id, (x) => ({ ...x, lat: !x.lat })))} />
            <NutBieuTuong k={toa.khoa ? 'moKhoa' : 'khoa'} ghiChu={t('gt.xep.khoa')} bat={!!toa.khoa} tat={chiXem} onClick={() => sua((p) => doiToa(p, toa.id, (x) => ({ ...x, khoa: !x.khoa })))} />
            <NutBieuTuong k="xoa" ghiChu={t('gt.xep.xoa')} tat={tat} onClick={() => { sua((p) => ({ ...p, toa: p.toa.filter((x) => x.id !== toa.id) })); chonToa(null); }} />
            </div>
          </div>
          <TheViewToa pa={pa} tv={tv} toaId={toa.id} />
        </MucGap>
      )}
    </>
  );
}

const duongPath = (vung: Diem[][]) => vung.map((p) => `M${p.map(s).join(' L')} Z`).join(' ');

/** Lượt kéo đang chạy (ref, không gây vẽ lại): dời / nhân bản / xoay nhóm tòa. */
type LuotKeo = {
  loai: 'dich' | 'nhan' | 'xoay';
  idBam: string;
  ids: string[];
  goc: Map<string, ToaDat>;
  p0: Diem;
  pxM: number; // px màn hình / m
  nghich: DOMMatrix;
  svg: SVGSVGElement;
  di: boolean;
  shift: boolean;
  alt: boolean;
  bam: 'xong' | 'batTat' | 'rieng'; // bấm không kéo: lựa chọn đã xử lý lúc nhấn / bật tắt tòa trong lựa chọn / chọn riêng tòa
  kq?: HienKeo;
  pCuoi: Diem;
  raf: number;
  muc: MucBat[];
  tamKhac: Diem[];
  trongCG: boolean;
  okCuoi: { dx: number; dy: number; dGoc: number };
  a0: number; // góc tay nắm lúc bấm (xoay)
  tam: Diem;
};
type HienKeo = { loai: LuotKeo['loai']; ids: string[]; dx: number; dy: number; dGoc: number; tam: Diem; dan: MucBat[]; gocTheo: number | null; chan: boolean };

/** Bản vẽ màn Xếp tòa: lô, chỉ giới, khối đế, chân tháp; chọn / kéo / xoay / nhân bản / đo tòa, cảnh báo LO-01 · LO-02 · LO-05. */
export function XepGiua({ pa, sua, chiXem, loId, chonLo, tv, toaId, chonToa, moTang, tenDuAn }: Chung) {
  const [dk, setDk] = useState<DieuKhienVe | null>(null);
  const [hien, setHien] = useState<HienKeo | null>(null);
  const [diemDo, setDiemDo] = useState<Diem[]>([]);
  const [loXem, setLoXem] = useState<string | null>(null); // lô KHÔNG xếp tòa (cây xanh, trường…) đang bấm xem thông số — không đổi lô làm việc
  const [menuToa, setMenuToa] = useState<{ id: string; x: number; y: number } | null>(null); // menu ngữ cảnh tòa (chuột phải / nhấn giữ)
  const luot = useRef<LuotKeo | null>(null);
  const hienRef = useRef<HienKeo | null>(null);
  hienRef.current = hien;
  const dsNhieu = useChonNhieu();
  const tc = useTuyChon();
  const luat = useLuatTMB();
  useLopView(); // nút Lớp › Điểm view vẽ lại khi bật / tắt
  const nutNG = useNutNangGio({ pa, sua, chiXem, tenDuAn: tenDuAn ?? '' }); // nút Lớp › Ảnh vệ tinh, Vị trí · Nắng · Gió
  const lo = loDangXep(pa, loId);
  const sel = luaChon(pa, dsNhieu, toaId);
  const toaChon = pa.toa.filter((x) => sel.includes(x.id));
  const diDuoc = toaChon.filter((x) => !x.khoa).map((x) => x.id);
  const tatCaKhoa = toaChon.length > 0 && toaChon.every((x) => x.khoa);

  const chon = (ids: string[], chinh?: string | null) => {
    datChonNhieu(ids);
    const c = chinh ?? ids[ids.length - 1] ?? null;
    chonToa(c);
    const x = pa.toa.find((q) => q.id === c);
    if (x && x.loId !== lo?.id) chonLo(x.loId);
  };

  // ---- thao tác nhóm (một bước hoàn tác mỗi lần) ----
  const xoay = (dGoc: number) => !chiXem && diDuoc.length && suaNhom(sua, diDuoc, (ds) => xoayNhom(ds, ds.length > 1 ? tamNhom(ds) : [ds[0].x, ds[0].y], dGoc));
  const dich = (dx: number, dy: number) => !chiXem && diDuoc.length && suaNhom(sua, diDuoc, (ds) => dichNhom(ds, dx, dy));
  const lat = () => !chiXem && diDuoc.length && suaNhom(sua, diDuoc, latNhom);
  const xoa = () => {
    if (chiXem || !diDuoc.length) return;
    sua((p) => ({ ...p, toa: p.toa.filter((x) => !diDuoc.includes(x.id)) }));
    chon([], null);
  };
  const khoa = () => {
    if (chiXem || !sel.length) return;
    sua((p) => ({ ...p, toa: p.toa.map((x) => (sel.includes(x.id) ? { ...x, khoa: !tatCaKhoa } : x)) }));
  };
  const nhanBan = () => {
    if (chiXem || !tv || !sel.length) return;
    let p2 = pa;
    const moi: ToaDat[] = [];
    for (const x of toaChon) {
      const { toa } = viTriNhanBan(x, p2, tv, luat, idMoi());
      moi.push(toa);
      p2 = { ...p2, toa: [...p2.toa, toa] };
    }
    sua((p) => ({ ...p, toa: [...p.toa, ...moi] }));
    chon(moi.map((x) => x.id));
  };

  // ---- phím tắt (không gõ trong ô nhập) ----
  const phimRef = useRef<(e: KeyboardEvent) => void>(() => {});
  phimRef.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (k === 'Escape') { datCanhChon(null); if (diemDo.length) setDiemDo([]); else if (tc.do) datTuyChon({ do: false }); else chon([], null); return; }
    if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); if (lo) chon(pa.toa.filter((x) => x.loId === lo.id).map((x) => x.id)); return; }
    if (chiXem || !sel.length) return;
    const b = e.shiftKey ? 1 : 0.1;
    if (ctrl && k.toLowerCase() === 'd') { e.preventDefault(); nhanBan(); }
    else if (ctrl) return;
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); xoa(); }
    else if (k === 'r' || k === 'R') xoay(e.shiftKey ? -90 : 90);
    else if (k === 'q' || k === 'Q') xoay(e.shiftKey ? 1 : 5);
    else if (k === 'e' || k === 'E') xoay(e.shiftKey ? -1 : -5);
    else if (k === 'f' || k === 'F') lat();
    else if (k === 'ArrowLeft') { e.preventDefault(); dich(-b, 0); }
    else if (k === 'ArrowRight') { e.preventDefault(); dich(b, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); dich(0, b); }
    else if (k === 'ArrowDown') { e.preventDefault(); dich(0, -b); }
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => phimRef.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  useEffect(() => () => { const l = luot.current; if (l) cancelAnimationFrame(l.raf); }, []);

  if (!pa.lo.length) return <div class="giua-man"><span>{t('xep.chuaCoLo')}</span></div>;
  const khung = khungBao(pa.lo.map((l) => l.ranh));
  const coChu = Math.max(1.2, khung ? (khung[2] - khung[0]) / 70 : 2);
  const buocM = dk?.tyLeM ?? coChu * 6; // thước tỷ lệ ≈ 1/8 khung nhìn → cỡ chữ / tay nắm gần như cố định trên màn hình
  const chuNho = Math.max(0.15, buocM * 0.045);

  // vị trí tạm khi đang kéo / xoay (chưa ghi vào PA)
  const deTam = new Map<string, ToaDat>();
  if (hien && hien.loai !== 'nhan') {
    const goc = pa.toa.filter((x) => hien.ids.includes(x.id));
    const moi = hien.loai === 'xoay' ? xoayNhom(goc, hien.tam, hien.dGoc) : dichNhom(goc, hien.dx, hien.dy);
    moi.forEach((x) => deTam.set(x.id, x));
  }
  const viTri = (x: ToaDat): ToaDat => deTam.get(x.id) ?? x;
  const toaCoMau = tv ? pa.toa.filter((x) => tv.toa.has(x.mauId)).map(viTri) : [];
  const dem = tv ? demCan(pa, tv) : {};
  const hinh = tv ? hinhToa(pa, tv, deTam) : [];
  const kiem = tv ? kiemViPham(pa, hinh, luat) : null;
  const banSao = hien?.loai === 'nhan' && tv
    ? pa.toa.filter((x) => hien.ids.includes(x.id)).map((x) => chanToa(tv.toa.get(x.mauId)!, { ...x, x: x.x + hien.dx, y: x.y + hien.dy }))
    : [];
  // kích thước tới ranh / chỉ giới / tòa gần nhất cho tòa đang kéo
  const kt = (() => {
    if (!hien || !tv) return [];
    const h = hinh.find((q) => q.toa.id === (luot.current?.idBam ?? hien.ids[0]));
    if (!h) return [];
    const F = hien.loai === 'nhan' ? chanToa(tv.toa.get(h.toa.mauId)!, { ...h.toa, x: h.toa.x + hien.dx, y: h.toa.y + hien.dy }) : h.F;
    const khac = hinh.filter((q) => hien.loai === 'nhan' || !hien.ids.includes(q.toa.id));
    return kichThuocToa(F, h.H, pa.lo.find((l) => l.id === h.toa.loId), khac, luat);
  })();

  // ---- kéo tòa / tay nắm xoay ----
  const raMet = (l: { nghich: DOMMatrix; svg: SVGSVGElement }, e: PointerEvent): Diem => {
    const q = l.svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY;
    const r = q.matrixTransform(l.nghich);
    return [r.x, -r.y];
  };
  const tinh = () => {
    const l = luot.current;
    if (!l || !tv) return;
    l.raf = 0;
    const [px, py] = l.pCuoi;
    if (l.loai === 'xoay') {
      const a = (Math.atan2(py - l.tam[1], px - l.tam[0]) * 180) / Math.PI;
      const chinh = l.goc.get(l.idBam)!;
      let dGoc = a - l.a0, theo: number | null = null;
      if (!l.alt) {
        const b = batGoc(chinh.gocDo + dGoc, gocCanhLo(pa.lo.find((q) => q.id === chinh.loId)), l.shift);
        dGoc = b.goc - chinh.gocDo; theo = b.theo;
      }
      if (tc.khoaCG) {
        const ds = [...l.goc.values()];
        const hop = xoayNhom(ds, l.tam, dGoc).every((x) => { const lo2 = pa.lo.find((q) => q.id === x.loId); return !lo2 || !l.trongCG || namTrongNhanh(chanToa(tv.toa.get(x.mauId)!, x), vungDat(lo2)); });
        if (!hop) dGoc = l.okCuoi.dGoc; else l.okCuoi = { ...l.okCuoi, dGoc };
      }
      l.kq = { loai: 'xoay', ids: l.ids, dx: 0, dy: 0, dGoc, tam: l.tam, dan: [], gocTheo: theo, chan: false };
      setHien(l.kq);
      return;
    }
    let dx = px - l.p0[0], dy = py - l.p0[1];
    let dan: MucBat[] = [];
    const chinh = l.goc.get(l.idBam)!;
    const mau = tv.toa.get(chinh.mauId)!;
    if (tc.bat && !l.alt) {
      const F = chanToa(mau, { ...chinh, x: chinh.x + dx, y: chinh.y + dy });
      const b = batDinh(F, [chinh.x + dx, chinh.y + dy], chinh.gocDo, l.muc, l.tamKhac, 8 / l.pxM);
      dx += b.dx; dy += b.dy; dan = b.dan;
    }
    let chan = false;
    if (tc.khoaCG && l.loai === 'dich' && l.trongCG) {
      const ds = [...l.goc.values()];
      const hop = (o: { dx: number; dy: number }) => dichNhom(ds, o.dx, o.dy).every((x) => {
        const lo2 = pa.lo.find((q) => q.id === x.loId);
        return !lo2 || namTrongNhanh(chanToa(tv.toa.get(x.mauId)!, x), vungDat(lo2));
      });
      const thu = [{ dx, dy }, { dx, dy: l.okCuoi.dy }, { dx: l.okCuoi.dx, dy }];
      const ok = thu.find(hop);
      if (ok) { chan = ok !== thu[0]; dx = ok.dx; dy = ok.dy; l.okCuoi = { ...l.okCuoi, dx, dy }; }
      else { dx = l.okCuoi.dx; dy = l.okCuoi.dy; chan = true; dan = []; }
    }
    l.kq = { loai: l.loai, ids: l.ids, dx, dy, dGoc: 0, tam: l.tam, dan, gocTheo: null, chan };
    setHien(l.kq);
  };
  const batDauLuot = (e: PointerEvent, loai: LuotKeo['loai'], idBam: string, ids: string[], bam: LuotKeo['bam']) => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
    const ctm = svg.getScreenCTM();
    if (!ctm || !tv) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const goc = new Map(pa.toa.filter((x) => ids.includes(x.id)).map((x) => [x.id, x]));
    const chinh = goc.get(idBam) ?? pa.toa.find((x) => x.id === idBam)!;
    const loCua = pa.lo.find((l) => l.id === chinh.loId);
    const khac = hinhToa(pa, tv).filter((h) => loai === 'nhan' || !ids.includes(h.toa.id));
    const ds = [...goc.values()];
    const tam: Diem = ds.length > 1 ? tamNhom(ds) : [chinh.x, chinh.y];
    const l: LuotKeo = {
      loai, idBam, ids, goc, nghich: ctm.inverse(), svg, pxM: ctm.a || 1, p0: [0, 0], di: false, shift: e.shiftKey, alt: e.altKey, bam,
      pCuoi: [0, 0], raf: 0, muc: dichBatDinh(loCua, khac, caoToa(chinh), luat), tamKhac: khac.map((h) => [h.toa.x, h.toa.y] as Diem),
      trongCG: ds.every((x) => { const lo2 = pa.lo.find((q) => q.id === x.loId); return !lo2 || namTrongNhanh(chanToa(tv.toa.get(x.mauId)!, x), vungDat(lo2)); }),
      okCuoi: { dx: 0, dy: 0, dGoc: 0 }, a0: 0, tam,
    };
    l.p0 = raMet(l, e); l.pCuoi = l.p0;
    l.a0 = (Math.atan2(l.p0[1] - tam[1], l.p0[0] - tam[0]) * 180) / Math.PI;
    luot.current = l;
  };
  const diLuot = (e: PointerEvent) => {
    const l = luot.current;
    if (!l) return;
    const p = raMet(l, e);
    if (!l.di) {
      if (Math.hypot(p[0] - l.p0[0], p[1] - l.p0[1]) * l.pxM < (e.pointerType === 'mouse' ? 3 : nguongRun(e.pointerType))) return; // run tay dưới 3 px (ngón 10 px) = bấm
      l.di = true;
    }
    l.pCuoi = p; l.shift = e.shiftKey; l.alt = e.altKey;
    if (!l.raf) l.raf = requestAnimationFrame(tinh);
  };
  const xongLuot = () => {
    const l = luot.current;
    luot.current = null;
    if (!l) return;
    if (l.raf) { cancelAnimationFrame(l.raf); l.raf = 0; tinh(); }
    const h = l.kq ?? hienRef.current;
    setHien(null);
    if (!l.di) {
      // bấm không kéo: Shift / Ctrl bật tắt trong lựa chọn, không thì chọn riêng tòa này
      if (l.loai === 'xoay' || l.bam === 'xong') return;
      if (l.bam === 'batTat') chon(sel.includes(l.idBam) ? sel.filter((x) => x !== l.idBam) : [...sel, l.idBam], sel.includes(l.idBam) ? sel.find((x) => x !== l.idBam) ?? null : l.idBam);
      else chon([l.idBam], l.idBam);
      return;
    }
    if (!h || chiXem) return;
    if (l.loai === 'xoay') { if (Math.abs(h.dGoc) > 1e-6) suaNhom(sua, l.ids, (ds) => xoayNhom(ds, l.tam, h.dGoc)); return; }
    if (Math.hypot(h.dx, h.dy) < 0.005) return;
    if (l.loai === 'dich') { suaNhom(sua, l.ids, (ds) => dichNhom(ds, h.dx, h.dy)); return; }
    const moi = pa.toa.filter((x) => l.ids.includes(x.id)).map((x) => ({ ...x, id: idMoi(), khoa: false, x: Math.round((x.x + h.dx) * 100) / 100, y: Math.round((x.y + h.dy) * 100) / 100 }));
    sua((p) => ({ ...p, toa: [...p.toa, ...moi] }));
    chon(moi.map((x) => x.id));
  };
  // tay nắm xoay: phía "trên" cục bộ của tòa chính, ngoài nét bao
  const tayNam = (() => {
    if (chiXem || !tv || !diDuoc.length || tc.do) return null;
    const ds = toaCoMau.filter((x) => diDuoc.includes(x.id));
    if (!ds.length) return null;
    const chinh = ds.find((x) => x.id === toaId) ?? ds[0];
    const tam: Diem = hien?.loai === 'xoay' ? hien.tam : ds.length > 1 ? tamNhom(ds) : [chinh.x, chinh.y];
    const g = (chinh.gocDo * Math.PI) / 180, up: Diem = [-Math.sin(g), Math.cos(g)];
    let r = 0;
    for (const x of ds) for (const p of chanToa(tv.toa.get(x.mauId)!, x)) r = Math.max(r, (p[0] - tam[0]) * up[0] + (p[1] - tam[1]) * up[1]);
    const L = r + buocM * 0.25;
    return { tam, dau: [tam[0] + up[0] * L, tam[1] + up[1] * L] as Diem, goc: chinh.gocDo };
  })();

  // đo: bắt vào đỉnh tòa / lô / chỉ giới
  const dinhBat = (): Diem[] => [...pa.lo.flatMap((l) => [...l.ranh, ...(l.chiGioi ?? [])]), ...hinh.flatMap((h) => h.F)];
  const bamNen = (p: Diem, e: PointerEvent) => {
    // Cảm ứng: chạm tòa CHƯA chọn để bản vẽ dời được khi kéo (không kéo nhầm tòa) — chạm không kéo thì chọn tòa / lô dưới ngón ở đây.
    if (!tc.do) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') {
        const idToa = el?.closest('[data-toa]')?.getAttribute('data-toa');
        if (idToa) { chon([idToa], idToa); return; }
      }
      // Chuột cũng chọn lô ở đây: BanVe bắt con trỏ (setPointerCapture) từ lúc nhấn nên sự kiện `click` rơi vào <svg>, không bao giờ tới <g onClick> của lô
      const idLo = el?.closest('[data-lo]')?.getAttribute('data-lo');
      const loBam = idLo ? pa.lo.find((q) => q.id === idLo) : undefined;
      if (loBam && !laCaoTang(loBam)) { setLoXem(loBam.id); chon([], null); datCanhChon(null); return; }
      if (idLo && idLo !== lo?.id) { setLoXem(null); chonLo(idLo); chon([], null); datCanhChon(null); return; }
      if (loXem) setLoXem(null);
    }
    if (tc.do) {
      const q = batDiem(p, dinhBat(), (buocM * 0.12));
      setDiemDo(diemDo.length >= 2 ? [q] : [...diemDo, q]);
      return;
    }
    // bấm cạnh lô đang chọn → khai lộ giới cạnh đó (LO-01 từng cạnh)
    const i = lo ? canhGan(lo, p, buocM * 0.06) : null;
    datCanhChon(lo && i !== null ? { loId: lo.id, i } : null);
    if (sel.length) chon([], null);
  };
  const tenToa = (id: string) => { const x = pa.toa.find((q) => q.id === id); return x ? tenNgan(tv?.toa.get(x.mauId)) + ` (${x.x.toFixed(0)}, ${x.y.toFixed(0)})` : id; };
  const m1 = (v: number) => fmtSo(v, { thapPhan: 1, donVi: 'm' });
  const nhanDoan = (a: Diem, b: Diem, chu: string, mau: string, key: string, net = true) => {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    return (
      <g key={key} style={{ pointerEvents: 'none' }}>
        {net && <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} stroke={mau} stroke-width="1.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" />}
        <text x={cx} y={-cy} text-anchor="middle" dominant-baseline="middle" font-size={chuNho} font-weight="700" fill={mau}
          stroke="var(--panel)" stroke-width={chuNho * 0.25} paint-order="stroke">{chu}</text>
      </g>
    );
  };

  return (
    <>
      <BanVe khung={khung} nhan={t('xep.banVe')} onDieuKhien={setDk} onBamNen={bamNen} gocBac={-gocBacPA(pa)}
        chonKhung={tc.do ? undefined : {
          bat: tc.khung,
          onXong: (a, b, them) => { const ids = toaTrongKhung(hinh, a, b); chon(them ? [...new Set([...sel, ...ids])] : ids); },
        }}>
        <LopNangGio2D pa={pa} tv={tv} />
        {pa.lo.flatMap((l) => l.xungQuanh).map((d, i) => (
          <polyline key={`xq${i}`} points={sPoly(d)} fill="none" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" />
        ))}
        {pa.lo.map((l) => {
          const loai = loaiDat(l), caoTang = loai === 'o_cao_tang', chonL = l.id === lo?.id;
          const [nen, vien] = MAU_DAT[loai];
          return (
            <g key={l.id} data-lo={l.id} onClick={() => !tc.do && caoTang && !chonL && (setLoXem(null), chonLo(l.id), chon([], null))} style={{ cursor: 'pointer' }}>
              <polygon points={sPoly(l.ranh)} fill={chonL ? 'var(--soft)' : caoTang ? 'var(--panel)' : nen} stroke={chonL ? 'var(--green)' : vien}
                stroke-width={chonL ? 2.5 : caoTang ? 1.6 : 1} vector-effect="non-scaling-stroke" />
              {caoTang && l.chiGioi && <polygon points={sPoly(l.chiGioi)} fill="none" stroke="var(--warn)" stroke-width="1.2" stroke-dasharray="8 5" vector-effect="non-scaling-stroke" />}
            </g>
          );
        })}
        <NhanCanhLo dsLo={pa.lo.filter(laCaoTang)} loChon={lo} coChu={coChu} />
        {tv && pa.lo.map((l) => {
          const ts = toaCoMau.filter((x) => x.loId === l.id);
          const de = khoiDe(ts.map((x) => chanToa(mauToa(tv, x)!, x)), ts.map((x) => x.deOffset));
          return de.length ? <path key={`de${l.id}`} d={duongPath(de)} fill="var(--secondary)" fill-opacity="0.25" fill-rule="nonzero" stroke="var(--secondary)" stroke-width="1" vector-effect="non-scaling-stroke" /> : null;
        })}
        {tv && toaCoMau.map((x) => {
          const mau = mauToa(tv, x)!;
          const chan = chanToa(mau, x);
          const viPham = kiem?.muc.get(x.id);
          const daChon = sel.includes(x.id);
          const soCan = Object.values(dem[x.id] ?? {}).reduce((a, b) => a + b, 0);
          return (
            <g key={x.id} class="tmb-toa" data-toa={x.id} style={{ cursor: tc.do ? 'crosshair' : chiXem || x.khoa ? 'pointer' : 'move' }}
              onDblClick={(e) => { if (tc.do) return; e.stopPropagation(); moTang?.(x.id); }}
              onContextMenu={(e) => {
                if (tc.do) return;
                e.preventDefault(); e.stopPropagation();
                if (!sel.includes(x.id)) chon([x.id], x.id);
                setMenuToa({ id: x.id, x: e.clientX, y: e.clientY });
              }}
              onPointerDown={(e) => {
                if (tc.do || e.button !== 0) return; // đo: để bản vẽ nhận bấm
                // ngón tay trên tòa chưa chọn: để bản vẽ dời (kéo) / chọn khi chạm (bamNen) — chỉ tòa đã chọn mới kéo bằng một ngón
                if (e.pointerType === 'touch' && !sel.includes(x.id)) return;
                e.stopPropagation();
                const ctrl = e.ctrlKey || e.metaKey;
                // bấm tòa ngoài lựa chọn → chọn nó ngay để kéo (Shift / Ctrl: thêm vào lựa chọn); trong lựa chọn: kéo cả nhóm,
                // bấm không kéo thì Shift / Ctrl bỏ nó khỏi lựa chọn, không thì chọn riêng nó
                let ids = sel, bam: LuotKeo['bam'] = e.shiftKey || ctrl ? 'batTat' : 'rieng';
                if (!sel.includes(x.id)) { ids = e.shiftKey || ctrl ? [...sel, x.id] : [x.id]; chon(ids, x.id); bam = 'xong'; }
                const di = pa.toa.filter((q) => ids.includes(q.id) && !q.khoa).map((q) => q.id);
                if (chiXem || x.khoa || !di.length) { batDauLuot(e, 'dich', x.id, [], bam); return; }
                batDauLuot(e, ctrl ? 'nhan' : 'dich', x.id, di, bam);
              }}
              onPointerMove={(e) => { if (luot.current?.ids.length && luot.current.loai !== 'xoay') diLuot(e); }}
              onPointerUp={() => luot.current?.loai !== 'xoay' && xongLuot()}
              onLostPointerCapture={() => { if (luot.current && luot.current.loai !== 'xoay') xongLuot(); }}>
              <polygon points={sPoly(chan)} fill={viPham === 'loi' ? 'var(--warn)' : 'var(--u-2pn)'} fill-opacity={viPham === 'loi' ? 0.35 : 0.85}
                stroke={viPham ? 'var(--warn)' : daChon ? 'var(--green)' : 'var(--ink)'} stroke-width={daChon ? 3 : viPham ? 2.5 : 1.5}
                stroke-dasharray={viPham === 'canh' ? '6 3' : undefined} vector-effect="non-scaling-stroke" />
              {daChon && viPham && <polygon points={sPoly(chan)} fill="none" stroke="var(--green)" stroke-width="1" vector-effect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />}
              <text x={x.x} y={-x.y} text-anchor="middle" font-size={coChu} font-weight="700" fill="var(--ink)" style={{ pointerEvents: 'none' }}>
                {tenNgan(mau)}{x.khoa ? ' ⊠' : ''}{x.lat ? ' ⇋' : ''}
              </text>
              <text x={x.x} y={-x.y + coChu * 1.3} text-anchor="middle" font-size={coChu * 0.8} fill="var(--ink)" style={{ pointerEvents: 'none' }}>
                {`${x.soTangDe + x.soTangDH}T · ${t('xep.tongCan').replace('{n}', String(soCan))}`}
              </text>
            </g>
          );
        })}
        {banSao.map((F, i) => (
          <polygon key={`bs${i}`} points={sPoly(F)} fill="var(--green)" fill-opacity="0.15" stroke="var(--green)" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
        ))}
        {/* vi phạm trực tiếp: LO-01 thiếu lùi, LO-02 §2.6.1 giữa tòa */}
        {kiem?.lui.map((v, i) => nhanDoan(v.a, v.b, `LO-01 c${v.canh + 1} ${m1(v.kc)} < ${m1(v.can)}`, 'var(--warn)', `lui${i}`))}
        {kiem?.cap.map((c, i) => nhanDoan(c.pa, c.pb, `§2.6.1 ${m1(c.kc)} < ${m1(c.muc === 'loi' ? c.hoi : c.dai)}`, 'var(--warn)', `cap${i}`))}
        {/* nét bắt dính + kích thước khi kéo */}
        {hien?.dan.map((m, i) => (
          <line key={`dan${i}`} x1={m.doan[0][0]} y1={-m.doan[0][1]} x2={m.doan[1][0]} y2={-m.doan[1][1]} stroke="var(--green)" stroke-width="1.2"
            stroke-dasharray={m.loai === 'truc' || m.loai === 'thang' ? '2 3' : undefined} vector-effect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
        ))}
        {kt.filter((k) => k.kc > 0.01).map((k, i) => {
          const thieu = k.can !== undefined && k.kc < k.can - 1e-6;
          return nhanDoan(k.a, k.b, m1(k.kc), thieu ? 'var(--warn)' : 'var(--green)', `kt${i}`);
        })}
        {hien?.loai === 'xoay' && tayNam && nhanDoan(tayNam.tam, tayNam.dau, `${fmtSo(tayNam.goc, { thapPhan: 1 })}°${hien.gocTheo !== null ? ' ∥' : ''}`, 'var(--green)', 'goc', false)}
        {tayNam && (
          <g class="tmb-tay-nam">
            {/* Xoay theo brand: vòng dẫn tròn quanh tâm tòa + tay nắm vòng O (vòng ngoài + chấm tâm) như vòng O logo LEO. */}
            <circle class="tmb-vong-xoay" cx={tayNam.tam[0]} cy={-tayNam.tam[1]} r={Math.hypot(tayNam.dau[0] - tayNam.tam[0], tayNam.dau[1] - tayNam.tam[1])}
              fill="none" stroke="var(--green)" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
            <line x1={tayNam.tam[0]} y1={-tayNam.tam[1]} x2={tayNam.dau[0]} y2={-tayNam.dau[1]} stroke="var(--green)" stroke-width="1.2" vector-effect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
            <circle cx={tayNam.dau[0]} cy={-tayNam.dau[1]} r={buocM * 0.012} fill="var(--green)" style={{ pointerEvents: 'none' }} />
            <circle cx={tayNam.dau[0]} cy={-tayNam.dau[1]} r={buocM * 0.032} fill="color-mix(in srgb, var(--panel) 70%, transparent)" stroke="var(--green)" stroke-width="2.2" vector-effect="non-scaling-stroke"
              style={{ cursor: 'grab' }} role="presentation"
              onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); batDauLuot(e, 'xoay', toaChon.find((x) => x.id === toaId && !x.khoa)?.id ?? diDuoc[0], diDuoc, 'xong'); }}
              onPointerMove={(e) => { if (luot.current?.loai === 'xoay') diLuot(e); }}
              onPointerUp={() => luot.current?.loai === 'xoay' && xongLuot()}
              onLostPointerCapture={() => { if (luot.current?.loai === 'xoay') xongLuot(); }}>
              <title>{t('tmb.gc.tayNam')}</title>
            </circle>
          </g>
        )}
        {/* đo khoảng cách */}
        {diemDo.map((p, i) => <circle key={`do${i}`} cx={p[0]} cy={-p[1]} r={buocM * 0.015} fill="var(--green)" style={{ pointerEvents: 'none' }} />)}
        {diemDo.length === 2 && nhanDoan(diemDo[0], diemDo[1], m1(Math.hypot(diemDo[1][0] - diemDo[0][0], diemDo[1][1] - diemDo[0][1])), 'var(--green)', 'do')}
        {!hien && <LopViewTmb pa={pa} tv={tv} coChu={coChu} toaId={toaId} />}
        <LopGoiY loId={lo?.id ?? null} tv={tv} />
        <LopHangLoat tv={tv} />
        {pa.lo.map((l) => {
          if (pa.toa.some((x) => x.loId === l.id)) return null;
          const caoTang = laCaoTang(l), xs = l.ranh.map((q) => q[0]), ys = l.ranh.map((q) => q[1]);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          return (
            <text key={`n${l.id}`} x={cx} y={-cy} text-anchor="middle" font-size={coChu * (caoTang ? 1.25 : 0.85)} font-weight={caoTang ? 700 : 500}
              fill={caoTang ? 'var(--green)' : MAU_DAT[loaiDat(l)][1]} style={{ pointerEvents: 'none' }}>{l.temDat.kyHieu}</text>
          );
        })}
      </BanVe>
      <div class="noi-tren">
        <ThanhTMB chiXem={chiXem} soChon={sel.length} coDiChuyen={diDuoc.length > 0} tatCaKhoa={tatCaKhoa} kiem={kiem}
          xoay90={() => xoay(90)} lat={lat} nhanBan={nhanBan} khoa={khoa} xoa={xoa} />
        {tc.toaDo && sel.length > 0 && (
          <HopToaDo ds={toaChon} tat={chiXem || !diDuoc.length}
            datTuyetDoi={(k, v) => suaNhom(sua, diDuoc.slice(0, 1), (ds) => ds.map((x) => ({ ...x, [k]: k === 'gocDo' ? ((v % 360) + 360) % 360 : Math.round(v * 100) / 100 })))}
            doi={(dx, dy, dg) => suaNhom(sua, diDuoc, (ds) => { const d = dichNhom(ds, dx, dy); return dg ? xoayNhom(d, d.length > 1 ? tamNhom(d) : [d[0].x, d[0].y], dg) : d; })} />
        )}
        {tc.dsCanhBao && <DsCanhBao kiem={kiem} ten={tenToa} chon={(ids) => chon(ids)} />}
        <HopCanhLo pa={pa} sua={sua} chiXem={chiXem} luat={luat} />
        <HopHangLoat pa={pa} tv={tv} sua={sua} chiXem={chiXem} luat={luat} />
        {tc.do && <p class="tmb-goi-y">{diemDo.length === 2 ? `${t('tmb.do.ketQua')} ${m1(Math.hypot(diemDo[1][0] - diemDo[0][0], diemDo[1][1] - diemDo[0][1]))} · Δx ${m1(Math.abs(diemDo[1][0] - diemDo[0][0]))} · Δy ${m1(Math.abs(diemDo[1][1] - diemDo[0][1]))}` : t('tmb.do.huongDan')}</p>}
        {hien?.chan && <p class="tmb-goi-y canh">{t('tmb.chanCG')}</p>}
        {(loXem ? pa.lo.find((q) => q.id === loXem) ?? lo : lo) && !tc.do && (() => {
          const loThe = (loXem ? pa.lo.find((q) => q.id === loXem) : undefined) ?? lo!;
          const m = moTaLo(loThe);
          return (
            <div class="the-lo-chon" role="status" aria-label={t('xep.the.tieuDe')}>
              <b>{m.kyHieu}</b>
              <span>{t(`cn.${m.chucNang}`)}</span>
              <span>{fmtSo(m.dtM2, { donVi: 'm²' })}</span>
              <span>{t('xep.the.mdxd')} {fmtSo(m.mdxdMax, { thapPhan: 1, donVi: '%' })}</span>
              <span>{t('xep.hssdd')} {fmtSo(m.hssddMax, { thapPhan: 2 })}</span>
              <span>{fmtSo(m.tangCaoMax, { donVi: t('xep.the.tang') })}</span>
              <span>{t('xep.the.danSo')} {fmtSo(m.danSoMax)}</span>
              {!laCaoTang(loThe) && <i class="muted">{t('xep.the.khongXep')}</i>}
            </div>
          );
        })()}
        <ChuGiaiView pa={pa} tv={tv} />
        <HopNangGioCho pa={pa} tv={tv} sua={sua} chiXem={chiXem} />
      </div>
      <GocBanVe zoom={dk ? { phong: () => dk.phong(), thu: () => dk.thu(), vua: () => dk.vuaKhung() } : null}
        lop={[nutLopView(), ...nutNG]} chuGiai={<ChuGiaiDat />} troGiup={t(chiXem ? 'tmb.phimChiXem' : 'tmb.phim')} />
      {menuToa && (() => {
        const dong = () => setMenuToa(null);
        const muc = (k: string, nhan: string, tat: boolean, lam: () => void) => (
          <button key={k} type="button" role="menuitem" disabled={tat} onClick={() => { lam(); dong(); }}>{nhan}</button>
        );
        const sua0 = !chiXem && diDuoc.length > 0;
        return (
          <HopNoi x={menuToa.x} y={menuToa.y} dong={dong} nhan={t('bt.menuToa')}>
            <div class="menu-o-dau">{tenToa(menuToa.id)}</div>
            {muc('mo', t('bt.moTang'), !moTang, () => moTang?.(menuToa.id))}
            {muc('xoay', `${t('bt.xoay')} 90°`, !sua0, () => xoay(90))}
            {muc('lat', t('bt.lat'), !sua0, lat)}
            {muc('nhan', t('bt.nhanBan'), chiXem || !sel.length, nhanBan)}
            {muc('khoa', t(tatCaKhoa ? 'bt.moKhoa' : 'bt.khoa'), chiXem || !sel.length, khoa)}
            {muc('xoa', t('bt.xoa'), !sua0, xoa)}
          </HopNoi>
        );
      })()}
    </>
  );
}

/** Biểu đồ vòng cơ cấu căn (% theo loại), màu theo loại căn. */
function VongCoCau({ pct }: { pct: Record<string, number> }) {
  const r = 15.915; // chu vi ≈ 100
  let daQua = 0;
  return (
    <svg viewBox="0 0 42 42" width="96" height="96" role="img" aria-label={t('xep.coCau')}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" stroke-width="7" />
      {LOAI_CAN.map((k) => {
        const v = pct[k] ?? 0;
        const c = <circle key={k} cx="21" cy="21" r={r} fill="none" stroke={`var(--u-${k})`} stroke-width="7"
          stroke-dasharray={`${v} ${100 - v}`} stroke-dashoffset={25 - daQua} />;
        daQua += v;
        return v > 0 ? c : null;
      })}
    </svg>
  );
}

const coCauRongNull = (): Record<LoaiCan, number | null> => ({ stu: null, '1pn': null, '2pn': null, '2pnp': null, '3pn': null });

/** Panel phải màn Xếp tòa: chỉ tiêu lô, diện tích hai cột, cơ cấu căn theo tòa so với mục tiêu. */
export function XepPhai({ pa, loId, tv, toaId, chonToa, kq, sua, chiXem, moCan }: Chung & { kq: KetQuaChiTieu | null }) {
  const lo = loDangXep(pa, loId);
  if (!lo) return null;
  const r = kq?.theoLo[lo.id];
  const toaLo = pa.toa.filter((x) => x.loId === lo.id);
  const dem = tv ? demCan(pa, tv) : {};
  const dtLo = lo.ranh.length >= 3 ? dienTich(lo.ranh) : 0;
  const mucTieu = lo.temDat.coCauMucTieu;
  const dtTb = tv ? dtTbTheoLoai(pa, tv, lo.id) : coCauRongNull();
  const pct = r?.coCauPct ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
  const m2 = { donVi: 'm²' };
  const cot = { gridTemplateColumns: `1.3fr repeat(${LOAI_CAN.length}, 1fr) 1fr` };
  return (
    <>
      <BangChiTieuLo dong={r?.dong ?? []} mo={false} />
      <DashDanSo pa={pa} tv={tv} lo={lo} sua={sua} chiXem={chiXem} moCan={moCan} />
      <MucGap tieuDe={`${t('xep.dtLo')} · ${lo.temDat.kyHieu}`} giaiThich={t('gt.xep.dtLo')}>
        <div class="dong bang-ct dau"><span /><span>{t('xep.xayDung')}</span><span>{t('xep.tinhHSSDD')}</span></div>
        <div class="dong bang-ct"><span>{t('sc.dtLo')}</span><span>{fmtSo(dtLo, m2)}</span><span>{fmtSo(dtLo, m2)}</span></div>
        <div class="dong bang-ct"><span>{t('xep.dtDe')} / {t('xep.dtSan')}</span><span><SoDong value={r && toaLo.length ? r.dtDe : null} {...m2} /></span><span><SoDong value={r && toaLo.length ? r.dtSanTinhHSSDD : null} {...m2} /></span></div>
        {r && toaLo.length > 0 && (['thap', 'de', 'apMai', 'hamTinh', 'hamTru', 'oKyThuat'] as const).map((k) => (
          <div class="dong bang-ct muted" key={k} title={t('heSo.canCu')}>
            <span>· {t(`dtSan.${k}`)}</span><span /><span>{k === 'hamTru' || k === 'oKyThuat' ? `(${fmtSo(r.dtSanChiTiet[k], m2)})` : fmtSo(r.dtSanChiTiet[k], m2)}</span>
          </div>
        ))}
        <div class="dong bang-ct"><span>{t('xep.matDo')} / {t('xep.hssdd')}</span>
          <span>{fmtSo(r && toaLo.length && dtLo ? (r.dtDe / dtLo) * 100 : null, { thapPhan: 1, donVi: '%' })}</span>
          <span>{fmtSo(r && toaLo.length && dtLo ? r.dtSanTinhHSSDD / dtLo : null, { thapPhan: 2 })}</span>
        </div>
      </MucGap>
      <MucGap tieuDe={t('xep.coCau')} giaiThich={t('gt.xep.coCau')} mo>
        <div class="dong" style={{ alignItems: 'center' }}>
          <VongCoCau pct={pct} />
          <div style={{ flex: 1 }}>
            {LOAI_CAN.map((k) => (
              <div class="dong" style={{ padding: '1px 0' }} key={k}>
                <span><i class="o-mau" style={{ background: `var(--u-${k})` }} /> {t(`loai.${k}`)}</span>
                <b>{fmtSo(pct[k], { thapPhan: 1, donVi: '%' })}</b>
              </div>
            ))}
          </div>
        </div>
        <div class="bang-co-cau" role="table" aria-label={t('xep.coCau')}>
          <div class="dong bang-cc dau" style={cot} role="row"><span>{t('xep.toa')}</span>{LOAI_CAN.map((k) => <span key={k}>{t(`loai.${k}`)}</span>)}<span>{t('xep.tong')}</span></div>
          {toaLo.map((x) => {
            const d = dem[x.id] ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
            return (
              <button type="button" class={`dong bang-cc${x.id === toaId ? ' chon' : ''}`} style={cot} role="row" key={x.id} onClick={() => chonToa(x.id)}>
                <span>{nhanToa(pa, tv, x.id)}</span>
                {LOAI_CAN.map((k) => <span key={k}>{fmtSo(d[k])}</span>)}
                <b>{fmtSo(LOAI_CAN.reduce((a, k) => a + d[k], 0))}</b>
              </button>
            );
          })}
          <div class="dong bang-cc tong" style={cot} role="row"><span>{t('xep.tong')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(r?.coCau[k] ?? 0)}</span>)}<b>{fmtSo(r?.soCan ?? 0)}</b></div>
          <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.tyLe')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(pct[k], { thapPhan: 1 })}</span>)}<span>100</span></div>
          <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.mucTieu')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(mucTieu[k], { thapPhan: 1 })}</span>)}<span /></div>
          {lo.temDat.deBai && Object.keys(lo.temDat.deBai.dtCan).length > 0 && (
            <>
              <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.dtDeBai')}</span>{LOAI_CAN.map((k) => <span key={k}>{fmtSo(lo.temDat.deBai!.dtCan[k] ?? null, { thapPhan: 1 })}</span>)}<span>m²</span></div>
              <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.dtDat')}</span>
                {LOAI_CAN.map((k) => {
                  const muc = lo.temDat.deBai!.dtCan[k], dat = dtTb[k];
                  const lech = muc && dat !== null ? Math.abs(dat - muc) > pa.nguong.dtCanM2 : false;
                  return <span key={k} class={dat === null || !muc ? '' : lech ? 'vuot' : 'ok'}>{fmtSo(dat, { thapPhan: 1 })}</span>;
                })}
                <span>m²</span>
              </div>
            </>
          )}
          <div class="dong bang-cc" style={cot} role="row"><span>{t('xep.lech')}</span>
            {LOAI_CAN.map((k) => {
              const l = (r?.soCan ? pct[k] : 0) - mucTieu[k];
              return <span key={k} class={Math.abs(l) > pa.nguong.coCauDiem ? 'vuot' : 'ok'}>{r?.soCan ? `${l > 0 ? '+' : ''}${fmtSo(l, { thapPhan: 1 })}` : '—'}</span>;
            })}
            <span />
          </div>
        </div>
        <div class="dong"><span>{t('xep.diemLech')}</span><b>{r?.soCan ? fmtSo(diemLechCoCau(pct, mucTieu), { thapPhan: 1 }) : '—'}</b></div>
      </MucGap>
    </>
  );
}

/** Chú giải màu loại đất trên TMB. */
function ChuGiaiDat() {
  const ds = ['o_cao_tang', 'cay_xanh', 'mat_nuoc', 'giao_duc', 'cong_cong', 'hon_hop', 'ha_tang'] as const;
  return (
    <div class="chu-giai-dat" aria-label={t('dat.chuGiai')}>
      {ds.map((k) => <span key={k}><i style={{ background: MAU_DAT[k][0], borderColor: MAU_DAT[k][1] }} />{t(`dat.${k}`)}</span>)}
    </div>
  );
}

/** Panel trái bước Tổng mặt bằng: nhập liệu một hàng, chọn lô cao tầng, tòa trên lô; chỉ tiêu lô gập dưới cùng. */
export function TmbTrai(p: Chung) {
  const lo = loDangXep(p.pa, p.loId);
  return (
    <>
      <LoNhap {...p} />
      <ChonLoCaoTang pa={p.pa} loId={lo?.id ?? null} chonLo={(id) => { p.chonLo(id); p.chonToa(null); }} />
      {lo && <XepTrai {...p} loId={lo.id} />}
      <LoChiTieu pa={p.pa} sua={p.sua} chiXem={p.chiXem} lo={lo} />
    </>
  );
}

/** Panel phải bước Tổng mặt bằng: chỉ tiêu lô đạt / mục tiêu, cơ cấu theo tòa; sức chứa gập. */
export function TmbPhai(p: Chung & { kq: KetQuaChiTieu | null }) {
  const lo = loDangXep(p.pa, p.loId);
  if (!lo) return null;
  return (
    <>
      <KpiTmb pa={p.pa} tv={p.tv} lo={lo} kq={p.kq} />
      <KpiView pa={p.pa} tv={p.tv} lo={lo} sua={p.sua} chiXem={p.chiXem} toaId={p.toaId} chonToa={p.chonToa} />
      <XepPhai {...p} />
      <ThangMayLo pa={p.pa} tv={p.tv} lo={lo} chonToa={p.chonToa} toaId={p.toaId} />
      <SucChuaLo lo={lo} />
    </>
  );
}
