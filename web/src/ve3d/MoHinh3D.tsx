import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { canDangDung, viTriCan } from '../tinh/matBang';
import { idLoi, tai, type HinhLoi } from '../ve/hinhHocThuVien';
import type { ToaVe } from '../ve/MatBangTang';
import { dungCan, type Khoi3d } from './dungCan';
import { dungToa, type LoiHinh } from './dungToa';
import { Khung3D } from './Khung3D';

type Nap = { khoi3d: Map<string, Khoi3d | null>; loi: Map<string, LoiHinh>; xong: boolean };

/** Tải làm biếng khối 3D các mẫu căn và hình học lõi đang cần. */
export function useNap3d(canIds: string[], loiIds: string[]): Nap {
  const khoa = [...new Set(canIds)].sort().join() + '|' + [...new Set(loiIds)].sort().join();
  const [kq, setKq] = useState<Nap>({ khoi3d: new Map(), loi: new Map(), xong: false });
  useEffect(() => {
    let huy = false;
    const [c, l] = khoa.split('|').map((x) => (x ? x.split(',') : []));
    setKq((o) => ({ ...o, xong: false }));
    Promise.all([
      Promise.all(c.map((id) => tai<{ khoi3d: Khoi3d | null }>(`/lib/can/${id}.json`).then((j) => [id, j?.khoi3d ?? null] as const))),
      Promise.all(l.map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, { bao_tuong_mm: j?.bao_tuong_mm }] as const))),
    ]).then(([a, b]) => { if (!huy) setKq({ khoi3d: new Map(a), loi: new Map(b), xong: true }); });
    return () => { huy = true; };
  }, [khoa]);
  return kq;
}

type PropsToa = { toa: ToaDat; mau: ToaVe; tv: ThuVien; pa: TrangThaiPA };

/** Tab Mô hình: 3D cả tòa đang xem (khối đế + tầng điển hình + mái + tum). */
export function MoHinhToa({ toa, mau, tv }: PropsToa) {
  const canIds = useMemo(() => viTriCan(mau, tv).map((vt) => canDangDung(vt, toa)), [mau, toa.canTheo, toa.canViTri, tv]);
  const loiIds = useMemo(() => mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block))), [mau]);
  const nap = useNap3d(canIds, loiIds);
  if (!nap.xong) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>;
  const khoa = ['toa', mau.id, toa.soTangDe, toa.soTangDH, canIds.join()].join('|');
  return (
    <Khung3D khoa={khoa} gocBac={toa.gocDo} chinhThamSo toaNguyen
      tieuDe={`${mau.ten_vi.split(' · ')[0]} · ${toa.soTangDe ? toa.soTangDe + ' + ' : ''}${toa.soTangDH} ${t('m3d.tang')}`}
      dung={({ T, goc, M, G, P }) => dungToa(T, goc, M, G, P, { mau, toa, tv, khoi3d: nap.khoi3d, loi: nap.loi, idLoi }).canh} />
  );
}

/** 3D một căn hộ theo mẫu căn trong thư viện. */
export function MoHinhCan({ canId, ten }: { canId: string; ten: string }) {
  const nap = useNap3d([canId], []);
  if (!nap.xong) return <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>;
  const d = nap.khoi3d.get(canId);
  if (!d) return <div class="giua-man"><span>{t('m3d.chuaCoDuLieu')}</span></div>;
  return (
    <Khung3D khoa={'can|' + canId} chinhThamSo tieuDe={ten}
      dung={({ T, goc, M, G, P }) => {
        dungCan(T, d, P, M, goc, G);
        const K = 0.001, bb = d.bb, cx = ((bb[0] + bb[2]) / 2) * K, cz = -((bb[1] + bb[3]) / 2) * K;
        const co = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * K;
        return { tam: [cx, (P.tang - P.san) * K * 0.3, cz], coCanh: co, cao: (P.tang - P.san) * K };
      }} />
  );
}
