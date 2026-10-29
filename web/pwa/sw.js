/*
 * LEO Unitmix — service worker viết tay (không plugin). Đây là KHUÔN: lúc `vite build`, web/pwa/plugin.ts thay
 * `__PHIEN_BAN__` (băm nội dung toàn bộ dist) và `__TIEN_TAI__` (danh sách URL tải trước) rồi ghi ra dist/sw.js.
 *
 * Vì sao cần: mở từ biểu tượng màn hình chính (iOS "web app"), app chạy tiến trình riêng, hay bị hệ điều hành đóng khi
 * chuyển app → mỗi lần bấm biểu tượng là tải lại từ đầu, hỏi lại máy chủ từng tệp. Có SW thì mọi tệp tĩnh lấy ngay từ máy.
 *   · /assets/* (tên có mã băm), /lib/*, /brand/*: lấy từ kho trước (cache-first); thiếu thì tải rồi cất.
 *   · Trang (index.html, mọi đường dẫn SPA): mạng trước (network-first), quá 4 s hoặc mất mạng thì dùng bản đã cất.
 *   · /api/*: không bao giờ chạm (luôn đi mạng, không cất).
 * Cập nhật: bản build mới → sw.js khác byte → trình duyệt cài SW mới, tải trước vào kho mới, kích hoạt ngay.
 * Giữ thêm kho của bản ngay trước: trang cũ còn mở vẫn nạp lười được chunk cũ (3D, xlsx…) dù máy chủ đã thay tệp.
 */
const PHIEN_BAN = '__PHIEN_BAN__';
const TIEN_TAI = __TIEN_TAI__;
const TIEN_TO = 'unitmix-';
const KHO = TIEN_TO + PHIEN_BAN;
const CHO_MANG_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const kho = await caches.open(KHO);
    // từng tệp một: một tệp lỗi không làm hỏng cả lượt cài
    await Promise.all(TIEN_TAI.map((u) => kho.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // caches.keys() theo thứ tự tạo: giữ kho hiện tại + kho mới nhất trước nó, xoá phần còn lại
    const cu = (await caches.keys()).filter((k) => k.startsWith(TIEN_TO) && k !== KHO);
    await Promise.all(cu.slice(0, -1).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/**
 * Lấy từ kho, thiếu thì tải rồi cất vào kho hiện tại. `moiBan`: tìm cả kho bản trước — chỉ cho tệp có mã băm
 * (/assets/*); /lib/* không băm tên nên chỉ lấy từ kho của đúng bản này, tránh dữ liệu cũ sau khi cập nhật.
 */
async function khoTruoc(req, moiBan) {
  const co = moiBan ? await caches.match(req) : await (await caches.open(KHO)).match(req);
  if (co) return co;
  const r = await fetch(req);
  // SPA trả index.html (200) cho tệp không có: đừng cất HTML dưới tên tệp dữ liệu
  if (r.ok && r.type === 'basic' && !(r.headers.get('content-type') || '').includes('text/html')) {
    const ban = r.clone();
    caches.open(KHO).then((k) => k.put(req, ban)).catch(() => {});
  }
  return r;
}

/** Trang: mạng trước, cất bản mới làm "/"; quá hạn chờ hoặc mất mạng → bản đã cất. */
async function mangTruoc(req) {
  const mang = fetch(req).then((r) => {
    if (r.ok && r.type === 'basic') {
      const ban = r.clone();
      caches.open(KHO).then((k) => k.put('/', ban)).catch(() => {});
    }
    return r;
  });
  const het = new Promise((xong) => setTimeout(xong, CHO_MANG_MS, null));
  try {
    const r = await Promise.race([mang, het]);
    if (r) return r;
  } catch { /* mất mạng: dùng bản cất */ }
  const cat = (await (await caches.open(KHO)).match('/')) || (await caches.match('/'));
  return cat || mang;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') { e.respondWith(mangTruoc(req)); return; }
  if (u.pathname.startsWith('/assets/')) e.respondWith(khoTruoc(req, true));
  else if (/^\/(lib|brand)\//.test(u.pathname) || u.pathname === '/manifest.webmanifest') e.respondWith(khoTruoc(req, false));
});
