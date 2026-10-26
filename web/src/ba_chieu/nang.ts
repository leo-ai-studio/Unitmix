/** Vị trí mặt trời (thuật toán NOAA rút gọn). Góc tính bằng độ. */

const RAD = Math.PI / 180;

/**
 * Góc cao và phương vị mặt trời tại (vĩ độ, kinh độ) vào thời điểm `ngay`.
 * Phương vị đo từ Bắc theo chiều kim đồng hồ (0–360); góc cao âm khi dưới chân trời.
 * Bỏ qua khúc xạ khí quyển.
 */
export function viTriMatTroi(viDo: number, kinhDo: number, ngay: Date): { gocCao: number; phuongVi: number } {
  // Ngày Julian từ mốc UTC
  const jd = ngay.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525; // thế kỷ Julian từ J2000

  // Kinh độ trung bình và dị thường trung bình (độ)
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mr = m * RAD;
  const c =
    Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * mr) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * mr) * 0.000289;
  const kinhThat = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lamda = kinhThat - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  // Độ nghiêng hoàng đạo hiệu chỉnh và độ xích vĩ mặt trời
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const xichVi = Math.asin(Math.sin(eps * RAD) * Math.sin(lamda * RAD));

  // Phương trình thời gian (phút)
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const l0r = l0 * RAD;
  const ptTG =
    4 *
    (y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr)) /
    RAD;

  // Thời gian mặt trời thật (phút) và góc giờ (độ)
  const phutUTC = ngay.getUTCHours() * 60 + ngay.getUTCMinutes() + ngay.getUTCSeconds() / 60 + ngay.getUTCMilliseconds() / 60000;
  const tst = (((phutUTC + ptTG + 4 * kinhDo) % 1440) + 1440) % 1440;
  const gocGio = (tst / 4 - 180) * RAD;

  const vd = viDo * RAD;
  const cosZ = Math.sin(vd) * Math.sin(xichVi) + Math.cos(vd) * Math.cos(xichVi) * Math.cos(gocGio);
  const z = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const gocCao = 90 - z / RAD;

  // Phương vị từ Bắc theo chiều kim đồng hồ
  const sinZ = Math.sin(z);
  let phuongVi: number;
  if (sinZ < 1e-9) {
    phuongVi = 180;
  } else {
    const cosA = (Math.sin(vd) * cosZ - Math.sin(xichVi)) / (Math.cos(vd) * sinZ);
    const a = Math.acos(Math.max(-1, Math.min(1, cosA))) / RAD; // 0..180, lệch khỏi hướng Nam
    // sáng (góc giờ <= 0): 180 - a; chiều (góc giờ > 0): 180 + a
    phuongVi = gocGio > 0 ? ((a + 180) % 360) : (540 - a) % 360;
  }
  return { gocCao, phuongVi };
}
