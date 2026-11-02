import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations'), TRAM_CHO_MS: '300', CF_ACCESS_TEAM: '', CF_ACCESS_AUD: '', MIEN_TAO_DA: '' } },
    })),
  ],
  test: { setupFiles: ['./test/apDungMigration.ts'] },
});
