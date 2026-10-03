// Smoke tests for the portfolio site (docs/). They load the real pages in
// Chromium at desktop and phone sizes and check the things a broken
// change would most likely take out: script errors, navigation, missing
// files, the project catalog, and the 404 page.
const { test, expect } = require('@playwright/test');

const { mockGitHub, watchErrors, navLink } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
});

test('home loads without errors and the hero becomes visible', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Vincent Lam - Portfolio');
  await expect(page.locator('#home.panel.active')).toBeVisible();
  // The entrance animation ends fully opaque.
  await expect(page.locator('#home .hero-title')).toHaveCSS('opacity', '1', { timeout: 5000 });
  await expect(page.locator('.wave-canvas').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('every panel is reachable from the navigation', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  for (const id of ['about', 'projects', 'contact', 'home']) {
    await navLink(page, isMobile, id).click();
    await expect(page.locator(`#${id}.panel.active`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(navLink(page, isMobile, id)).toHaveAttribute('aria-current', 'page');
    // Panels that slid away can't be tabbed into.
    const inertOthers = await page.evaluate((active) =>
      [...document.querySelectorAll('.panel')].filter((p) => p.id !== active).every((p) => p.inert), id);
    expect(inertOthers).toBe(true);
  }
  await page.goBack();
  await expect(page.locator('#contact.panel.active')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every local file the pages reference exists', async ({ page, request }) => {
  const pages = ['/', '/404.html', '/writing/cedar-in-the-browser/', ...['aegis', 'installous', 'nagare', 'privacy-blocker', 'sous-chef'].map((slug) => `/projects/${slug}/`)];
  for (const pagePath of pages) {
    await page.goto(pagePath);
    // Scripts, styles, images, and every same-site link (case studies,
    // the contact card, the case studies' pager).
    const refs = await page.evaluate(() => [
      ...[...document.querySelectorAll('[src]')].map((el) => el.getAttribute('src')),
      ...[...document.querySelectorAll('link[href], a[href]')].map((el) => el.getAttribute('href')),
    ]);
    const local = [...new Set(refs)].filter((ref) => ref && !/^(https?:|mailto:|data:|#|\/#)/.test(ref));
    expect(local.length).toBeGreaterThan(0);
    for (const ref of local) {
      const res = await request.get(new URL(ref, `http://127.0.0.1${pagePath}`).pathname);
      expect(res.status(), `${ref} (referenced from ${pagePath})`).toBe(200);
    }
  }
});

test('project catalog opens one project at a time and loads its preview', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await navLink(page, isMobile, 'projects').click();
  const installous = page.locator('details.project[data-repo="Installous"]');
  const nagare = page.locator('details.project[data-repo="nagare"]');
  await installous.locator('summary').click();
  await expect(installous).toHaveAttribute('open', '');
  const preview = installous.locator('img.project-preview');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  await nagare.locator('summary').click();
  await expect(nagare).toHaveAttribute('open', '');
  await expect(installous).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('school projects sit in their own list, numbered on from the rest', async ({ page, isMobile }) => {
  await page.goto('/');
  await navLink(page, isMobile, 'projects').click();
  const school = page.locator('.projects-grid.school-projects');
  await expect(page.locator('.project-group-title')).toHaveText('School projects');
  await expect(school.locator('details.project')).toHaveCount(2);
  await expect(school.locator('details.project').first()).toHaveAttribute('data-slug', 'wemu');
  // Not resetting the counter keeps the numbers going (06, 07).
  await expect(school).toHaveCSS('counter-reset', 'none');
  // The accordion still spans both lists: opening a school project closes Aegis.
  const aegis = page.locator('details.project[data-slug="aegis"]');
  await aegis.locator('summary').click();
  await expect(aegis).toHaveAttribute('open', '');
  await school.locator('details.project').first().locator('summary').click();
  await expect(aegis).not.toHaveAttribute('open', '');
});

test('GitHub data renders, excluding featured and hidden repos', async ({ page, isMobile }) => {
  await page.goto('/');
  await navLink(page, isMobile, 'projects').click();
  const moreRepos = page.locator('.more-repos');
  await expect(moreRepos).toBeVisible();
  if (!isMobile) {
    // Installous and Aegis are featured above, AgentApply is excluded, forks and the
    // site's own repo and old-stuff (no push in a year) are skipped - which
    // leaves just side-project.
    await expect(page.locator('.repo-link .repo-name')).toHaveText(['side-project']);
  }
  await navLink(page, isMobile, 'contact').click();
  await expect(page.locator('.last-updated')).toBeVisible();
  await expect(page.locator('.last-updated time')).toHaveAttribute('datetime', '2026-09-27T18:53:40Z');
});

test('contact rows show only icon and value but still name themselves to screen readers', async ({ page }) => {
  await page.goto('/#contact');
  const linkedin = page.getByRole('link', { name: /^LinkedIn vincentlam812/ });
  await expect(linkedin).toBeVisible();
  await expect(linkedin.locator('.contact-label')).toHaveCSS('position', 'absolute');
  expect((await linkedin.locator('.contact-label').boundingBox()).width).toBeLessThanOrEqual(1);
});

test('printing expands every project and restores them afterwards', async ({ page }) => {
  await page.goto('/#projects');
  const openStates = () => page.locator('details.project').evaluateAll((els) => els.map((d) => d.open));
  const before = await openStates();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  expect((await openStates()).every(Boolean)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  expect(await openStates()).toEqual(before);
});

test('the 404 page renders in the site style and links back home', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/404.html');
  await expect(page).toHaveTitle('Page not found - Vincent Lam');
  await expect(page.locator('.hero-title .name')).toHaveText('404');
  await expect(page.locator('.hero-actions')).toBeVisible();
  await page.locator('.hero-actions a', { hasText: 'Back to home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#home.panel.active')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('desktop keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcuts are a desktop feature');

  test('arrow keys and number keys switch panels', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#about.panel.active')).toBeVisible();
    await page.keyboard.press('4');
    await expect(page.locator('#contact.panel.active')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#projects.panel.active')).toBeVisible();
  });

  test('the command menu opens with Ctrl+K and runs a command', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const menu = page.locator('dialog.cmdk');
    await expect(menu).toBeVisible();
    await page.keyboard.type('contact');
    await expect(page.locator('.cmdk-item').first()).toHaveText(/Go to Contact/);
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(page.locator('#contact.panel.active')).toBeVisible();
  });
});
