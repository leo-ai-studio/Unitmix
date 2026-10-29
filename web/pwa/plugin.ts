import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Tệp dữ liệu / ảnh nạp lúc mở app: tải trước cùng /assets/* (thư viện can/*, loi/* lớn, nạp lười khi cần). */
const TIEN_TAI_THEM = [
  '/', '/manifest.webmanifest',
  '/lib/toa.json', '/lib/can.json', '/lib/quy_tac.json', '/lib/pccc.json', '/lib/nguon.json',
  '/brand/favicon_32.png', '/brand/favicon_64.png', '/brand/leo_ai_o.png', '/brand/leo_ai_mark.png', '/brand/pwa_192.png',
];

const moiTep = (thuMuc: string): string[] =>
  readdirSync(thuMuc).flatMap((t) => {
    const p = join(thuMuc, t);
    return statSync(p).isDirectory() ? moiTep(p) : [p];
  });

/**
 * Sinh dist/sw.js từ khuôn web/pwa/sw.js sau khi build xong (public đã chép vào dist).
 * Phiên bản = băm nội dung mọi tệp trong dist (trừ sw.js): đổi mã hay đổi dữ liệu /lib đều ra SW mới → kho mới.
 */
export function sinhServiceWorker(): Plugin {
  let ra = 'dist';
  return {
    name: 'unitmix-sw',
    apply: 'build',
    configResolved(c) { ra = resolve(c.root, c.build.outDir); },
    closeBundle() {
      const tep = moiTep(ra).map((p) => '/' + relative(ra, p).split(sep).join('/')).filter((u) => u !== '/sw.js' && u !== '/_headers').sort();
      const bam = createHash('sha256');
      for (const u of tep) bam.update(u).update(readFileSync(join(ra, u)));
      const phienBan = bam.digest('hex').slice(0, 12);
      const tienTai = [...TIEN_TAI_THEM.filter((u) => u === '/' || tep.includes(u)), ...tep.filter((u) => u.startsWith('/assets/') && !u.endsWith('.map'))];
      const khuon = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
      writeFileSync(join(ra, 'sw.js'), khuon.replace("'__PHIEN_BAN__'", JSON.stringify(phienBan)).replace('const TIEN_TAI = __TIEN_TAI__;', `const TIEN_TAI = ${JSON.stringify(tienTai)};`));
    },
  };
}
