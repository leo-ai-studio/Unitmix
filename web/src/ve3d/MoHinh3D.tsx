import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { dieuPhoiHam, useNgheHam } from '../tinh/hamNen';
import type { GocNhin, ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { chuKyMatBang } from '../tinh/loiThang';
import { boCucTang, canDangDung, nhomTang, viTriCan } from '../tinh/matBang';
import { idTepCan } from '../tinh/stretch';
import { idLoi, tai, type HinhLoi } from '../ve/hinhHocThuVien';
import type { ToaVe } from '../ve/MatBangTang';
import { dungCan, type Khoi3d } from './dungCan';
import { dungToa, type LoiHinh } from './dungToa';
import { dungDuAn } from './dungDuAn';
import { Khung3D } from './Khung3D';
import { khoi3dTheoId } from './stretch3d';

type Nap = { khoi3d: Map<string, Khoi3d | null>; loi: Map<string, LoiHinh>; xong: boolean };

/** Tải làm biếng khối 3D các mẫu căn và hình học lõi đang cần. */
export function useNap3d(canIds: string[], loiIds: string[], tv?: ThuVien | null): Nap {
  const khoa = [...new Set(canIds)].sort().join() + '|' + [...new Set(loiIds)].sort().join();
  const [kq, setKq] = useState<Nap>({ khoi3d: new Map(), loi: new Map(), xong: false });
  useEffect(() => {
    let huy = false;
    const [c, l] = khoa.split('|').map((x) => (x ? x.split(',') : []));
    setKq((o) => ({ ...o, xong: false }));
    Promise.all([
      Promise.all(c.map((id) => tai<{ khoi3d: Khoi3d | null }>(`/lib/can/${idTepCan(id)}.json`).then((j) => [id, khoi3dTheoId(id, j?.khoi3d ?? null, tv)] as const))),
      Promise.all(l.map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, { bao_tuong_mm: j?.bao_tuong_mm }] as const))),
    ]).then(([a, b]) => { if (!huy) setKq({ khoi3d: new Map(a), loi: new Map(b), xong: true }); });
    return () => { huy = true; };
  }, [khoa, tv]);
  return kq;
}

type LuuGoc = { gocLuu?: GocNhin[]; onLuuGoc?: (g: Omit<GocNhin, 'id' | 'che' | 'toaId'>) => void; onXoaGoc?: (id: string) => void };
type PropsToa = { toa: ToaDat; mau: ToaVe; mauTang?: (tang: number | null) => ToaVe; tv: ThuVien; pa: TrangThaiPA; dauThanh?: preact.ComponentChildren } & LuuGoc;


/** Tab Mô hình: 3D cả tòa đang xem (khối đế + tầng điển hình + mái + tum). */
export function MoHinhToa({ toa, mau, mauTang, tv, dauThanh, ...luu }: PropsToa) {
  // căn của mọi bố cục tầng (chung + tầng riêng); chữ ký bố cục vào khoá để dựng lại khi đổi theo tầng / công năng ô
  const canIds = useMemo(() => [...new Set(nhomTang(toa).flatMap(({ tang }) => { const bc = boCucTang(toa, tang); return viTriCan(mau, tv).map((vt) => canDangDung(vt, bc)); }))], [mau, toa.canTheo, toa.canViTri, toa.tangRieng, tv]);
  // khối lõi / thang của mọi mặt bằng tầng (thang PC-11 thêm có thể là khối khác bản vẽ)
  const loiIds = useMemo(() => [...new Set(nhomTang(toa).flatMap(({ tang }) => (mauTang?.(tang) ?? mau).mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block)))))], [mau, mauTang, toa]);
  const nap = useNap3d(canIds, loiIds, tv);
  if (!nap.xong) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>;
  const khoa = ['toa', mau.id, toa.soTangDe, toa.soTangDH, canIds.join(), JSON.stringify([toa.canTheo, toa.canViTri, toa.congNang, toa.tangRieng]), chuKyMatBang(toa)].join('|');
  return (
    <Khung3D khoa={khoa} gocBac={toa.gocDo} chinhThamSo toaNguyen dauThanh={dauThanh} {...luu} tenAnh={`Unitmix-${mau.id}`}
      tieuDe={`${mau.ten_vi.split(' · ')[0]} · ${toa.soTangDe ? toa.soTangDe + ' + ' : ''}${toa.soTangDH} ${t('m3d.tang')}`}
      dung={({ T, goc, M, G, P }) => ({ ...dungToa(T, goc, M, G, P, { mau, toa, tv, khoi3d: nap.khoi3d, loi: nap.loi, idLoi, mauTang }).canh, nen: true })} />
  );
}

/** 3D một căn hộ theo mẫu căn trong thư viện. */
export function MoHinhCan({ canId, ten, tv }: { canId: string; ten: string; tv?: ThuVien | null }) {
  const nap = useNap3d([canId], [], tv);
  if (!nap.xong) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>;
  const d = nap.khoi3d.get(canId);
  if (!d) return <div class="giua-man"><span>{t('m3d.chuaCoDuLieu')}</span></div>;
  return (
    <Khung3D khoa={'can|' + canId} chinhThamSo tieuDe={ten} tenAnh={`Unitmix-${canId}`}
      dung={({ T, goc, M, G, P }) => {
        dungCan(T, d, P, M, goc, G);
        const K = 0.001, bb = d.bb, cx = ((bb[0] + bb[2]) / 2) * K, cz = -((bb[1] + bb[3]) / 2) * K;
        const co = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * K;
        return { tam: [cx, (P.tang - P.san) * K * 0.3, cz], coCanh: co, cao: (P.tang - P.san) * K };
      }} />
  );
}

type PropsChinh = { pa: TrangThaiPA; tv: ThuVien; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; toa: ToaDat | null; mau: ToaVe | null; mauTang?: (tang: number | null) => ToaVe; tenDuAn: string };

/** Tab 3D: chọn Toàn dự án (ô đất, cây xanh, mặt nước, khối tòa) hoặc Công trình (tòa đang chọn, chi tiết từng căn); góc nhìn lưu trong PA. */
export function MoHinhChinh({ pa, tv, sua, chiXem, toa, mau, mauTang, tenDuAn }: PropsChinh) {
  const [che, setChe] = useState<'du_an' | 'toa'>('du_an');
  const [hienHam, setHienHam] = useState(true);
  const vHam = useNgheHam('3d'); // hầm rải trong Web Worker: có kết quả mới thì dựng lại (khoaNhe)
  const xem = che === 'toa' && toa && mau ? 'toa' : 'du_an';
  const gocLuu = (pa.gocNhin ?? []).filter((g) => g.che === xem && (xem === 'du_an' || g.toaId === toa?.id));
  const luu: LuuGoc = {
    gocLuu,
    onLuuGoc: chiXem ? undefined : (g) => sua((p) => ({ ...p, gocNhin: [...(p.gocNhin ?? []), { ...g, id: `g-${Date.now().toString(36)}`, che: xem, toaId: xem === 'toa' ? toa?.id : undefined }] })),
    onXoaGoc: chiXem ? undefined : (id) => sua((p) => ({ ...p, gocNhin: (p.gocNhin ?? []).filter((g) => g.id !== id) })),
  };
  const nut = (
    <span class="nhom-3d chon-che" role="group" aria-label={t('m3d.che')}>
      <button type="button" aria-pressed={xem === 'du_an'} onClick={() => setChe('du_an')}>{t('m3d.duAn')}</button>
      <button type="button" aria-pressed={xem === 'toa'} disabled={!toa} onClick={() => setChe('toa')}>{t('m3d.congTrinh')}</button>
    </span>
  );
  const nutHam = (
    <span class="nhom-3d" role="group" aria-label={t('m3d.ham')}>
      <button type="button" aria-pressed={hienHam} title={t('m3d.hamGiaiThich')} onClick={() => setHienHam(!hienHam)}>{t('m3d.ham')}</button>
      {hienHam && dieuPhoiHam.dangChoKenh('3d') && <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 8px' }}><img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '14px', height: '14px' }} />{t('ham.dangRai')}</span>}
    </span>
  );
  if (xem === 'toa' && toa && mau) return <MoHinhToa pa={pa} tv={tv} toa={toa} mau={mau} mauTang={mauTang} dauThanh={nut} {...luu} />;
  const khoa = ['du_an', pa.lo.length, pa.toa.map((x) => [x.id, x.mauId, x.x, x.y, x.gocDo, x.lat ? 1 : 0, x.soTangDe, x.soTangDH, x.deOffset].join(',')).join(';'), toa?.id ?? ''].join('|');
  return (
    <Khung3D khoa={khoa} khoaNhe={String(hienHam) + JSON.stringify(pa.ham) + '|' + vHam} toaNguyen dauThanh={<>{nut}{nutHam}</>} {...luu} tieuDe={tenDuAn} tenAnh={`Unitmix-${tenDuAn}`}
      gocBac={0} dung={({ T, goc, M, kieu }) => dungDuAn(T, goc, M, kieu, pa, tv, toa?.id ?? null, hienHam)} />
  );
}
