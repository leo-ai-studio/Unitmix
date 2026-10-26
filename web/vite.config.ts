import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  // Chạy thử trên máy: API do `wrangler dev` (cổng 8787) phục vụ.
  server: { port: 5180, proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: { environment: 'node' },
});
