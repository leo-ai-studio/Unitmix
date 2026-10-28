#!/usr/bin/env node
/**
 * Cổng kiểm một lệnh (học app cũ MDI_Unitmix_v4: `chay_selftest.js --nho`, `chay_pha_hoai.js --nhanh`).
 *   node scripts/kiem.mjs            đủ: tsc · vitest web · vitest worker · pytest · vite build — chạy SONG SONG
 *   node scripts/kiem.mjs --nhanh    bài quét nặng lấy mẫu 1/k (KIEM_NHANH=1, xem web/src/thu/layMau.ts), bỏ test xuất CAD / .dxf và vite build
 *   node scripts/kiem.mjs --nho      dấu vân tay mã nguồn trùng lần ĐẠT trước (cùng chế độ hoặc lần đủ) → ĐẠT ngay, không chạy lại
 * Lần ĐẠT ghi sha256(tệp nguồn + cấu hình) vào .cache/kiem_da_dat.json. Khác một byte → chạy lại. Trước khi gộp main: chạy đủ.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = join(dirname(fileURLToPath(import.meta.url)), '..');
const co = new Set(process.argv.slice(2));
const nhanh = co.has('--nhanh'), nho = co.has('--nho');
const cheDo = nhanh ? 'nhanh' : 'du';
const tepNho = join(goc, '.cache', 'kiem_da_dat.json');

/** Dấu vân tay: nội dung mọi tệp git theo dõi hoặc chưa theo dõi (không bị ignore) trong các vùng ảnh hưởng tới kết quả kiểm. */
function dauVanTay() {
  const vung = ['web', 'worker', 'tests', 'scripts', 'package.json', 'package-lock.json'];
  const ds = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '--', ...vung], { cwd: goc, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  const h = createHash('sha256');
  for (const f of ds) {
    const p = join(goc, f);
    if (!existsSync(p)) continue;
    h.update(f + '\0');
    h.update(readFileSync(p));
  }
  return h.digest('hex');
}

const docNho = () => { try { return JSON.parse(readFileSync(tepNho, 'utf8')); } catch { return {}; } };

const vt = dauVanTay();
if (nho) {
  const n = docNho();
  // lần đủ ĐẠT cũng thoả chế độ nhanh; lần nhanh ĐẠT không thoả chế độ đủ
  if (n.du === vt || (nhanh && n.nhanh === vt)) {
    console.log(`kiem ${cheDo}: ĐẠT (nhớ — trùng dấu vân tay ${vt.slice(0, 12)}, không chạy lại)`);
    process.exit(0);
  }
}

const win = process.platform === 'win32';
const env = { ...process.env, ...(nhanh ? { KIEM_NHANH: '1' } : {}), FORCE_COLOR: '0' };
const buoc = [
  ['tsc', 'npx', ['tsc', '--noEmit'], 'web'],
  // --nhanh bỏ test xuất CAD / .dxf (người dùng yêu cầu 2026-10-29); cổng đủ trước push vẫn chạy.
  ['vitest web', 'npx', ['vitest', 'run', '--reporter=dot', ...(nhanh ? ['--exclude', 'src/xuat/xuatCad*.test.ts'] : [])], 'web'],
  ['vitest worker', 'npx', ['vitest', 'run', '--reporter=dot'], 'worker'],
  ['pytest', 'python', ['-m', 'pytest', 'tests', '-q', '--color=no'], '.'],
  ...(nhanh ? [] : [['vite build', 'npx', ['vite', 'build', '--logLevel', 'error'], 'web']]),
];

const chay = ([ten, lenh, ts, thuMuc]) => new Promise((xong) => {
  const t0 = Date.now();
  let ra = '';
  // Windows: npx là .cmd nên cần shell; truyền một chuỗi lệnh (đối số không có khoảng trắng) để tránh cảnh báo DEP0190.
  const p = win ? spawn([lenh, ...ts].join(' '), { cwd: join(goc, thuMuc), env, shell: true }) : spawn(lenh, ts, { cwd: join(goc, thuMuc), env });
  p.stdout.on('data', (d) => { ra += d; });
  p.stderr.on('data', (d) => { ra += d; });
  p.on('close', (ma) => xong({ ten, ma, giay: (Date.now() - t0) / 1000, ra }));
});

const t0 = Date.now();
const kq = await Promise.all(buoc.map(chay));
let dat = true;
for (const k of kq) {
  const ok = k.ma === 0;
  dat &&= ok;
  const tom = k.ra.match(/Tests\s+(\d+ passed[^\n]*)/)?.[1] ?? k.ra.match(/(\d+ passed[^\n]*)/)?.[1] ?? '';
  console.log(`${ok ? 'ĐẠT' : 'HỎNG'}  ${k.ten.padEnd(14)} ${k.giay.toFixed(1).padStart(5)} s  ${tom.trim()}`);
  if (!ok) console.log(k.ra.split('\n').slice(-40).join('\n'));
}
console.log(`kiem ${cheDo}: ${dat ? 'ĐẠT' : 'HỎNG'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (dat) {
  mkdirSync(dirname(tepNho), { recursive: true });
  writeFileSync(tepNho, JSON.stringify({ ...docNho(), [cheDo]: vt, luc: new Date().toISOString() }, null, 2));
}
process.exit(dat ? 0 : 1);
