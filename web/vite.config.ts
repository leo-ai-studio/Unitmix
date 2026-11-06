import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import type { Plugin } from 'vite';
import { sinhServiceWorker } from './pwa/plugin';

// Phiên bản hiện trên app: số trong package.json + mã commit + ngày build (không có git thì bỏ mã commit).
const goi = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const git = (lenh: string) => {
  try {
    return execSync(lenh, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
/** Đưa cầu Claude + bộ cài lên cùng app (dist/cau/*, và khi chạy dev) để nút "Tải bộ cài cầu AI" tải từ chính địa chỉ app. */
const TEP_CAU = ['cau_claude.py', 'cai_cau_ai.ps1'];
const docCau = (t: string) => readFileSync(new URL(`../scripts/${t}`, import.meta.url));
const phatCau = (): Plugin => ({
  name: 'unitmix-cau',
  generateBundle() { for (const t of TEP_CAU) this.emitFile({ type: 'asset', fileName: `cau/${t}`, source: docCau(t) }); },
  configureServer(sv) {
    sv.middlewares.use('/cau', (req, res, next) => {
      const t = (req.url ?? '').split('?')[0].slice(1);
      if (!TEP_CAU.includes(t)) return next();
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(docCau(t));
    });
  },
});

const commit = git('git rev-parse --short HEAD');
const sua = commit && git('git status --porcelain -- .') ? '+' : ''; // '+' = có sửa chưa commit

export default defineConfig({
  plugins: [preact(), phatCau(), sinhServiceWorker()], // sinhServiceWorker: dist/sw.js cho app mở từ màn hình chính (web/pwa)
  define: {
    __PHIEN_BAN__: JSON.stringify(goi.version),
    __COMMIT__: JSON.stringify(commit + sua),
    __NGAY_BUILD__: JSON.stringify(new Date().toLocaleDateString('sv-SE')), // YYYY-MM-DD theo giờ máy, không theo UTC
  },
  // Chạy thử trên máy: API do `wrangler dev` (cổng 8787) phục vụ; agent chạy API riêng thì đặt UNITMIX_API (vd. http://127.0.0.1:8797).
  server: { port: 5180, proxy: { '/api': process.env.UNITMIX_API ?? 'http://127.0.0.1:8787' } },
  // Vài test quét tệp XREF / thư viện trên đĩa, chậm khi máy bận: nới giới hạn mặc định 5 s; chạy song song cả bộ có ca quét tới 40 s.
  test: { environment: 'node', testTimeout: 90_000 },
});
