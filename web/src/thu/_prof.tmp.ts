import { napThuVien, toaThu } from './thuVienThat';
import { mauToa } from '../tinh/canThem';
import { apMatBang, matBangCua, tuChinhToa, type ToaMB } from '../tinh/loiThang';
import { boCucTang, congNangTai, viTriCan } from '../tinh/matBang';
import { latTay, xoaCanTay } from '../tinh/thaoTacTay';

const { tv, dl } = napThuVien();
const c = { tv, dl };
const ra: string[] = [];
for (const id of ['tm-t2', 'xh-z3', 'tm-u1']) {
  const toa = tuChinhToa(toaThu(id), tv.toa.get(id) as unknown as ToaMB, tv, dl);
  const mau = mauToa(tv, toa) as ToaMB, hd = apMatBang(mau, matBangCua(toa, mau, dl), dl), bc = boCucTang(toa, null);
  const vts = viTriCan(hd, tv, bc).filter((v) => congNangTai(v.khoa, bc) === 'can').slice(0, 12);
  for (const v of vts) {
    let t0 = performance.now();
    latTay(toa, null, [v.khoa], c);
    const a = performance.now() - t0;
    t0 = performance.now();
    xoaCanTay(toa, null, [v.khoa], c);
    ra.push(`${id} ${v.khoa} lật ${Math.round(a)} xoá ${Math.round(performance.now() - t0)}`);
  }
}
console.log(ra.join('\n'));
