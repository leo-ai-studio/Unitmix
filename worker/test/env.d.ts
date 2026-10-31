declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TRAM: DurableObjectNamespace<import('../src/tram').Tram>;
    TRAM_CHO_MS?: string;
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}
