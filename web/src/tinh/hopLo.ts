import { chanToa, namTrong, trongTam } from './hinhHoc';
import type { Diem, Lo, ToaDat, ToaMau } from './kieu';

const BUOC_GOC = 5;

/** Góc thử: trước hết song song các cạnh chỉ giới (cạnh dài trước, kể cả xoay thêm 90°/180°/270°), rồi 0–355° bước 5°. */
function gocThu(chiGioi: Diem[]): number[] {
  const canh = chiGioi.map((p, i) => {
    const q = chiGioi[(i + 1) % chiGioi.length];
    return { dai: Math.hypot(q[0] - p[0], q[1] - p[1]), goc: (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI };
  });
  const theoCanh = canh
    .sort((a, b) => b.dai - a.dai)
    .flatMap((c) => [0, 90, 180, 270].map((k) => Math.round((((c.goc + k) % 360) + 360) % 360 * 10) / 10));
  const deu = Array.from({ length: 360 / BUOC_GOC }, (_, i) => i * BUOC_GOC);
  return [...new Set([...theoCanh, ...deu])];
}

/** Mẫu tòa "hợp lô" khi đặt tại trọng tâm chỉ giới, ở ít nhất một góc xoay, thì nằm trọn trong chỉ giới. */
export function hopLo(mau: ToaMau, chiGioi: Diem[]): { hop: boolean; gocHop: number | null } {
  if (chiGioi.length < 3) return { hop: false, gocHop: null };
  const [x, y] = trongTam(chiGioi);
  for (const goc of gocThu(chiGioi)) {
    const chan = chanToa(mau, { x, y, gocDo: goc } as ToaDat);
    if (namTrong(chan, chiGioi)) return { hop: true, gocHop: goc };
  }
  return { hop: false, gocHop: null };
}

/** Vùng được đặt tòa của lô: chỉ giới nếu có, không thì ranh lô. */
export const vungDat = (lo: Lo): Diem[] => lo.chiGioi ?? lo.ranh;

/** Tòa mới trên lô: tại trọng tâm vùng đặt, góc hợp lô (không hợp thì 0°). Số tầng đế / tầng căn hộ theo bảng QH;
 * bảng không ghi thì 1 tầng đế, phần còn lại của tầng cao tối đa là điển hình. */
export function taoToaTrenLo(mau: ToaMau, lo: Lo, id: string): ToaDat {
  const vung = vungDat(lo);
  const [x, y] = vung.length >= 3 ? trongTam(vung) : [0, 0];
  const ct = lo.temDat.chiTieu;
  const soTangDe = ct.tangDe ?? 1;
  return {
    id,
    loId: lo.id,
    mauId: mau.id,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    gocDo: hopLo(mau, vung).gocHop ?? 0,
    soTangDH: Math.max(1, ct.tangCanHo ?? Math.round(ct.tangCaoMax) - soTangDe),
    soTangDe,
    caoDe: 4.5,
    caoDH: 3.3,
    coApMai: false,
    deOffset: 0,
    canTheo: {},
  };
}
