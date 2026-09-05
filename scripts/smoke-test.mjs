// Guardrail smoke test — run against a built (`npm run build`) app served by `vite preview`.
// Visits every route and fails the build if the app crashes (uncaught JS exception, React error
// boundary, or a totally blank page). It does NOT fail on failed network/Supabase requests —
// this runs against build output that may have placeholder or unreachable Supabase credentials,
// so failed data fetches are expected and are the app's own job to handle gracefully (loading /
// error states), not a build-breaking regression.
//
// Usage: node scripts/smoke-test.mjs <base-url>
// Exit code 0 = pass, 1 = fail.

import { chromium } from 'playwright';

const BASE_URL = process.argv[2] || 'http://localhost:4173';

const ROUTES = [
  { path: '/', expect: 'APEX' },
  { path: '/register', expect: 'Register' },
  { path: '/tournament', expect: 'Tournament' },
  { path: '/formats', expect: 'Format' },
  { path: '/analytics', expect: 'Analytics' },
  { path: '/admin', expect: null }, // auth-gated; just must not crash
  { path: '/match-center/scores', expect: 'Scores' },
  { path: '/match-center/schedule', expect: 'Schedule' },
  { path: '/match-center/standings', expect: 'Standings' },
  // 'Match KPIs' itself is inside an <h1>, which index.css uppercases visually (innerText
  // reflects that, same reason this doesn't check any other page's <h1> text directly) -- assert
  // on the plain-text back-link instead, which renders identically either way.
  { path: '/match-center/match/00000000-0000-0000-0000-000000000000', expect: 'Back to Scores' },
];

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

async function main() {
  const browser = await chromium.launch({ executablePath });
  let failures = 0;

  for (const route of ROUTES) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const url = `${BASE_URL}${route.path}`;
    let ok = true;
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      if (!response || !response.ok()) {
        ok = false;
        console.error(`[FAIL] ${route.path} — HTTP ${response ? response.status() : 'no response'}`);
      }

      const bodyText = await page.evaluate(() => document.body.innerText.trim());
      if (bodyText.length < 20) {
        ok = false;
        console.error(`[FAIL] ${route.path} — page body is effectively blank`);
      }
      if (route.expect && !bodyText.includes(route.expect)) {
        ok = false;
        console.error(`[FAIL] ${route.path} — expected text "${route.expect}" not found`);
      }
      if (pageErrors.length > 0) {
        ok = false;
        console.error(`[FAIL] ${route.path} — uncaught JS error(s): ${pageErrors.join(' | ')}`);
      }
    } catch (err) {
      ok = false;
      console.error(`[FAIL] ${route.path} — ${err.message}`);
    } finally {
      await page.close();
    }

    if (ok) {
      console.log(`[PASS] ${route.path}`);
    } else {
      failures++;
    }
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\n${failures} route(s) failed the smoke test.`);
    process.exit(1);
  }
  console.log('\nAll routes passed the smoke test.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
