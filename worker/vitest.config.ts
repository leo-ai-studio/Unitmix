import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations'), TRAM_CHO_MS: '300' } },
    })),
  ],
  test: { setupFiles: ['./test/apDungMigration.ts'] },
});
