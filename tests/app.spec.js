// The parts that make the site behave like an installed app: the
// minified build being current, the home-screen setup, and the service
// worker that keeps pages on hand offline without touching the demos.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const PAGES = ['/', '/404.html', '/writing/cedar-in-the-browser/', '/writing/ai-agent-on-my-nas/', '/writing/iphone-backup/', ...['aegis', 'installous', 'nagare', 'privacy-blocker', 'sous-chef'].map((slug) => `/projects/${slug}/`)];

test('docs/ matches what npm run build makes from src/', () => {
  // Throws (failing the test) if any built file or page link is stale.
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build.mjs'), '--check'], { stdio: 'pipe' });
});

test('every page can be added to the home screen and run full screen', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  for (const url of PAGES) {
    await page.goto(url);
    await expect(page.locator('link[rel="manifest"]'), url).toHaveAttribute('href', '/manifest.webmanifest');
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect((await request.get(touchIcon)).status(), `${url} ${touchIcon}`).toBe(200);
    await expect(page.locator('meta[name="viewport"]'), url).toHaveAttribute('content', /viewport-fit=cover/);
  }
});

test.describe('service worker', () => {
  test.skip(({ isMobile }) => isMobile, 'the same worker either way - checked once');

  test('keeps the site working offline and leaves the demo apps alone', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, serviceWorkers: 'allow' });
    await context.route('https://api.github.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The first visit's page isn't controlled yet; the next one is.
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names.find((n) => n.startsWith('portfolio-')));
      return (await cache.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
    });
    expect(cached).toContain('/projects/aegis/');
    expect(cached.some((url) => /^\/styles\.css\?v=[0-9a-f]+$/.test(url))).toBe(true);

    await context.setOffline(true);
    // A page never opened in this visit still loads, styled, from the cache.
    await page.goto('/projects/nagare/');
    await expect(page.locator('h1')).toHaveText('Nagare');
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.goto('/#projects');
    await expect(page.locator('#projects .project')).not.toHaveCount(0);

    // The live demos share the domain but aren't the portfolio's: offline,
    // the worker must not answer for them.
    const demo = await page.goto('/nagare/').catch(() => null);
    expect(demo === null || !demo.ok()).toBe(true);

    expect(errors).toEqual([]);
    await context.close();
  });
});

test('the lit dots stay in line with the grid when the screen settles without a resize event', async ({ page }) => {
  // Opened from an iPhone home screen, the app's height changes after
  // load without the window firing resize; the canvas must follow it.
  await page.goto('/');
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('.view').style.bottom = '0px'; });
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector('#home .wave-canvas');
    return Math.abs(canvas.height / devicePixelRatio - canvas.clientHeight) <= 1;
  })).toBe(true);
});
