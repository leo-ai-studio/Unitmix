/**
 * Đọc bảng unitmix đề bài của kinh doanh: mỗi dòng một loại căn (Studio, 1PN, 2PN, 2PN+1, 3PN) với tỷ lệ %,
 * số căn và/hoặc DT căn. Thiếu tỷ lệ thì suy từ số căn.
 */
import { LOAI_CAN, type LoaiCan } from '../tinh/kieu';
import { loaiTrongTen, type LoaiNhaO } from '../tinh/loaiNha';
import { boDau, chuTrongO, soTrongO, type Luoi } from './luoi';

export type DongDeBai = { loai: LoaiCan; nhan: string; tyLe: number | null; soCan: number | null; dtCan: number | null };
export type DeBaiDoc = { dong: DongDeBai[]; coCau: Record<LoaiCan, number>; canhBao: string[] };

/** Loại căn theo nhãn: "Studio", "1PN", "1 phòng ngủ", "2PN+1", "2PN + 1", "2BR+", "3PN"… 4PN trở lên xếp vào 3PN. */
export function loaiTheoNhan(s: string): LoaiCan | null {
  const h = boDau(s).replace(/\s+/g, '');
  if (/studio|^stu|^st$|^ob$|officetel/.test(h)) return 'stu';
  const m = h.match(/^(\d)(pn|br|bed|phongngu|n)(.*)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n === 1) return '1pn'; // 1PN+1 (thêm phòng làm việc) vẫn là 1PN
  if (n === 2) return /^(\+|p$|plus)/.test(m[3]) ? '2pnp' : '2pn';
  return n >= 3 ? '3pn' : null;
}

function cotTheoTieuDe(luoi: Luoi): { hang: number; tyLe?: number; soCan?: number; dtCan?: number; nhan?: number } {
  for (let r = 0; r < Math.min(20, luoi.length); r++) {
    const h = (luoi[r] ?? []).map((o) => boDau(chuTrongO(o)));
    const tim = (re: RegExp) => { const i = h.findIndex((x) => re.test(x)); return i >= 0 ? i : undefined; };
    const tyLe = tim(/ty le|co cau|%/), soCan = tim(/so can|so luong|^sl\b|so lg/), dtCan = tim(/dien tich|^dt\b|m2|thong thuy|tim tuong/);
    if ([tyLe, soCan, dtCan].filter((x) => x !== undefined).length >= 1 && h.some((x) => /loai|can ho|hang muc|^can$/.test(x)))
      return { hang: r, tyLe, soCan, dtCan, nhan: tim(/loai|can ho|hang muc|^can$/) };
  }
  return { hang: -1 };
}

type KhoiMaTran = { dt: boolean; cot: (LoaiCan | null)[]; hang: { nhan: string; v: (number | null)[] }[] };

/**
 * Bảng ma trận kiểu VTK: mỗi dòng một mẫu tháp, mỗi CỘT một loại căn (STU, 1PN+, 2PN-N, 2PN+_G, 3PN…). Khối "số lượng căn / tầng"
 * cho số căn, khối "diện tích" cho DT căn; DT mỗi loại = trung bình có trọng số số căn. Cột không phải loại căn (Duplex…) bỏ qua.
 */
function khoiMaTran(luoi: Luoi): KhoiMaTran[] {
  const kq: KhoiMaTran[] = [];
  for (let r = 0; r < luoi.length; r++) {
    const cot = (luoi[r] ?? []).map((o, i) => (i === 0 || typeof o !== 'string' ? null : loaiTheoNhan(o)));
    if (new Set(cot.filter((x) => x)).size < 3) continue;
    const ngu = [luoi[r - 2], luoi[r - 1], luoi[r]].flatMap((h) => (h ?? []).map((o) => boDau(chuTrongO(o)))).join('|');
    const dt = !/so luong|so can/.test(ngu) && /dien tich/.test(ngu);
    const hang: KhoiMaTran['hang'] = [];
    let q = r + 1;
    for (; q < luoi.length; q++) {
      const nhan = chuTrongO((luoi[q] ?? [])[0] ?? null);
      const v = cot.map((c, i) => (c ? soTrongO((luoi[q] ?? [])[i] ?? null) : null));
      if (!nhan || !v.some((x) => x !== null)) break;
      hang.push({ nhan, v });
    }
    if (hang.length) kq.push({ dt, cot, hang });
    r = q;
  }
  return kq;
}

function docMaTran(luoi: Luoi, loaiNha?: LoaiNhaO): DeBaiDoc | null {
  const khoi = khoiMaTran(luoi);
  const dem = khoi.find((k) => !k.dt);
  if (!dem) return null;
  const dtKhoi = khoi.find((k) => k.dt && k.cot.length === dem.cot.length);
  // dòng TỔNG không cộng lại; bảng có dòng theo loại nhà ở (TĐC, NOXH, NOTM) thì chỉ lấy dòng đúng loại đang chọn
  const khongTong = dem.hang.filter((h) => !/^tong/.test(boDau(h.nhan)));
  const dungLoai = loaiNha ? khongTong.filter((h) => loaiTrongTen(h.nhan) === loaiNha) : [];
  dem.hang = dungLoai.length ? dungLoai : khongTong.length ? khongTong : dem.hang;
  const sc = new Map<LoaiCan, number>(), tdt = new Map<LoaiCan, number>(), mauSo = new Map<LoaiCan, number>();
  for (const h of dem.hang) {
    const dtHang = dtKhoi?.hang.find((x) => boDau(x.nhan) === boDau(h.nhan));
    h.v.forEach((n, i) => {
      const loai = dem.cot[i];
      if (!loai || !n) return;
      sc.set(loai, (sc.get(loai) ?? 0) + n);
      const d = dtHang?.v[i];
      if (d) { tdt.set(loai, (tdt.get(loai) ?? 0) + n * d); mauSo.set(loai, (mauSo.get(loai) ?? 0) + n); }
    });
  }
  const tong = [...sc.values()].reduce((a, b) => a + b, 0);
  if (!tong) return null;
  const dong: DongDeBai[] = LOAI_CAN.filter((k) => sc.has(k)).map((k) => ({
    loai: k, nhan: k, tyLe: (sc.get(k)! / tong) * 100, soCan: sc.get(k)!,
    dtCan: mauSo.get(k) ? Math.round((tdt.get(k)! / mauSo.get(k)!) * 10) / 10 : null,
  }));
  const coCau = Object.fromEntries(LOAI_CAN.map((k) => [k, Math.round(((sc.get(k) ?? 0) / tong) * 1000) / 10])) as Record<LoaiCan, number>;
  return { dong, coCau, canhBao: [`bảng ma trận: gộp ${dem.hang.length} mẫu tháp (${dem.hang.map((h) => h.nhan).join(', ')}), mỗi mẫu 1 tầng điển hình`] };
}

/** Đọc lưới (sheet Excel hoặc bảng dán). Dòng nào nhận được loại căn thì lấy; cột số lấy theo tiêu đề, không có tiêu đề thì đoán. */
export function docDeBai(luoi: Luoi, loaiNha?: LoaiNhaO): DeBaiDoc {
  const maTran = docMaTran(luoi, loaiNha);
  if (maTran) return maTran;
  const cot = cotTheoTieuDe(luoi);
  const canhBao: string[] = [];
  const gop = new Map<LoaiCan, DongDeBai>();
  for (let r = cot.hang + 1; r < luoi.length; r++) {
    const hang = luoi[r] ?? [];
    const iNhan = cot.nhan ?? hang.findIndex((o) => typeof o === 'string' && loaiTheoNhan(o) !== null);
    const nhan = iNhan < 0 ? '' : chuTrongO(hang[iNhan] ?? null);
    const loai = nhan ? loaiTheoNhan(nhan) : null;
    if (!loai) {
      // một sheet thường có nhiều bảng (tổng + từng tòa): hết bảng đầu thì dừng, không cộng dồn bảng sau
      const dau = boDau(chuTrongO(hang.find((o) => o !== null) ?? null));
      if (gop.size && (!dau || /^(tong|dtsd|total)/.test(dau))) break;
      continue;
    }
    let tyLe = cot.tyLe !== undefined ? soTrongO(hang[cot.tyLe] ?? null) : null;
    let soCan = cot.soCan !== undefined ? soTrongO(hang[cot.soCan] ?? null) : null;
    let dtCan = cot.dtCan !== undefined ? soTrongO(hang[cot.dtCan] ?? null) : null;
    if (cot.hang >= 0 && dtCan === null && cot.dtCan === undefined && iNhan + 1 !== cot.soCan && iNhan + 1 !== cot.tyLe) {
      // cột DT không có tiêu đề, nằm ngay sau nhãn (bảng "LOẠI CĂN | | Số căn | Tỷ lệ")
      const o = soTrongO(hang[iNhan + 1] ?? null);
      if (o !== null && o >= 20 && o <= 300) dtCan = o;
    }
    if (cot.hang < 0) {
      // Không có tiêu đề: ô có dấu % là tỷ lệ; số nguyên > 100 hoặc số còn lại đầu tiên là số căn / DT theo độ lớn.
      const so = hang.slice(iNhan + 1).map((o) => ({ o, v: soTrongO(o) })).filter((x) => x.v !== null);
      for (const { o, v } of so) {
        if (typeof o === 'string' && o.includes('%') && tyLe === null) tyLe = v;
        else if (v! > 0 && v! <= 1 && tyLe === null) tyLe = v! * 100;
        else if (v! >= 20 && v! <= 200 && !Number.isInteger(v!) && dtCan === null) dtCan = v;
        else if (Number.isInteger(v!) && soCan === null) soCan = v;
        else if (dtCan === null) dtCan = v;
      }
    }
    if (/^[4-9]/.test(boDau(nhan).replace(/\s+/g, ''))) canhBao.push(`"${nhan}" xếp vào 3PN`);
    const cu = gop.get(loai);
    if (cu) {
      // Hai dòng cùng loại (vd 3PN và 4PN): cộng tỷ lệ, số căn; DT lấy trung bình theo số căn.
      const sc = (cu.soCan ?? 0) + (soCan ?? 0);
      cu.dtCan = cu.dtCan !== null && dtCan !== null && sc > 0 ? ((cu.dtCan * (cu.soCan ?? 1)) + dtCan * (soCan ?? 1)) / ((cu.soCan ?? 1) + (soCan ?? 1)) : cu.dtCan ?? dtCan;
      cu.tyLe = cu.tyLe !== null || tyLe !== null ? (cu.tyLe ?? 0) + (tyLe ?? 0) : null;
      cu.soCan = cu.soCan !== null || soCan !== null ? sc : null;
    } else gop.set(loai, { loai, nhan, tyLe, soCan, dtCan });
  }
  const dong = LOAI_CAN.filter((k) => gop.has(k)).map((k) => gop.get(k)!);
  // Tỷ lệ ghi dạng 0,35 (định dạng % của Excel đọc ra số thô) thì nhân 100.
  const tongTL = dong.reduce((a, d) => a + (d.tyLe ?? 0), 0);
  if (tongTL > 0 && tongTL <= 1.01) dong.forEach((d) => d.tyLe !== null && (d.tyLe *= 100));
  const tongSC = dong.reduce((a, d) => a + (d.soCan ?? 0), 0);
  if (dong.some((d) => d.tyLe === null) && tongSC > 0) dong.forEach((d) => (d.tyLe ??= ((d.soCan ?? 0) / tongSC) * 100));
  const coCau = Object.fromEntries(LOAI_CAN.map((k) => [k, Math.round((gop.get(k)?.tyLe ?? 0) * 10) / 10])) as Record<LoaiCan, number>;
  const tong = LOAI_CAN.reduce((a, k) => a + coCau[k], 0);
  if (dong.length && Math.abs(tong - 100) > 0.5) canhBao.push(`tổng tỷ lệ ${tong.toFixed(1)} % (khác 100 %)`);
  if (!dong.length) canhBao.push('không nhận được dòng loại căn nào');
  return { dong, coCau, canhBao };
}
