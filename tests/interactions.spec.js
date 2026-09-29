// Deeper interaction tests: every feature exercised directly, plus the
// edge cases most likely to break it - printing, rapid input, resizing,
// failing or blocked browser APIs, reduced motion, and accessibility.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { GITHUB_FIXTURES, mockGitHub, watchErrors, navLink, panelOffsets, expectSettled } = require('./helpers');

const PANELS = ['home', 'about', 'projects', 'contact'];
const CASE_STUDIES = ['aegis', 'installous', 'nagare', 'privacy-blocker', 'sous-chef'];

// ---------------------------------------------------------------- print

test.describe('printing', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  // Regression: cancelling (or finishing) a print used to animate every
  // panel from the print layout back off-screen, sweeping them across
  // the page.
  test('returning from print leaves the panels where they were', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await navLink(page, isMobile, 'about').click();
    await expectSettled(page, 'about');
    const before = await panelOffsets(page);

    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

    // Immediately, and throughout: no panel moves or animates.
    expect(await panelOffsets(page)).toEqual(before);
    const moving = await page.evaluate(() => document.getAnimations()
      .filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('panel')).length);
    expect(moving).toBe(0);
    await page.waitForTimeout(400);
    expect(await panelOffsets(page)).toEqual(before);
    await expect(page.locator('html')).not.toHaveClass(/printing/);
    // And the site still works normally afterwards.
    await navLink(page, isMobile, 'contact').click();
    await expectSettled(page, 'contact');
    expect(errors).toEqual([]);
  });

  test('printing from the command menu calls print and closes the menu', async ({ page, isMobile }) => {
    test.skip(isMobile, 'command menu is a desktop feature');
    await page.goto('/');
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.keyboard.press('Control+k');
    await page.keyboard.type('print');
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog.cmdk')).toBeHidden();
    expect(await page.evaluate(() => window.__printed)).toBe(1);
  });

  test('the print layout shows every section and hides the controls', async ({ page }) => {
    await page.goto('/#about');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('.tab-bar')).toBeHidden();
    await expect(page.locator('.wave-canvas').first()).toBeHidden();
    for (const heading of ['#home .hero-title', '#about .section-title', '#projects .section-title', '#contact .section-title']) {
      await expect(page.locator(heading)).toBeVisible();
    }
    // Every project description is printed, not just the summaries.
    const descriptions = page.locator('.project-description');
    const count = await descriptions.count();
    for (let i = 0; i < count; i++) await expect(descriptions.nth(i)).toBeVisible();
    // Printing is in the light theme even when the page is dark.
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
});

// ---------------------------------------------------------------- navigation

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  for (const id of PANELS) {
    test(`a link straight to #${id} opens that panel`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/#${id}`);
      await expectSettled(page, id);
      await expect(page.locator(`#${id} .reveal`).first()).toHaveCSS('opacity', '1', { timeout: 5000 });
      expect(errors).toEqual([]);
    });
  }

  // Regression: following a #panel link the site doesn't intercept (like
  // editing the address bar) used to scroll the view sideways to the
  // off-screen panel, shifting every panel a screen out of place.
  test('editing the address bar hash switches panel without scrolling the view', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    for (const id of ['projects', 'about', 'contact', 'home']) {
      await page.evaluate((id) => { location.hash = id; }, id);
      await expectSettled(page, id); // also fails if the view is scrolled
    }
    expect(errors).toEqual([]);
  });

  test('the view stays unscrolled even without overflow: clip support', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: '.view { overflow: hidden !important; }' });
    await page.evaluate(() => { location.hash = 'contact'; });
    await expectSettled(page, 'contact');
  });

  test('an unknown hash falls back to Home', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#does-not-exist');
    await expectSettled(page, 'home');
    expect(errors).toEqual([]);
  });

  test('rapid clicking ends on the last panel clicked, at rest', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    for (const id of ['about', 'projects', 'contact', 'about', 'home', 'projects', 'contact']) {
      await navLink(page, isMobile, id).click({ delay: 0 });
    }
    await expectSettled(page, 'contact');
    await expect(page).toHaveURL(/#contact$/);
    expect(errors).toEqual([]);
  });

  test('back and forward walk through the history', async ({ page, isMobile }) => {
    await page.goto('/');
    for (const id of ['about', 'projects', 'contact']) {
      await navLink(page, isMobile, id).click();
      await expectSettled(page, id);
    }
    await page.goBack(); await expectSettled(page, 'projects');
    await page.goBack(); await expectSettled(page, 'about');
    await page.goForward(); await expectSettled(page, 'projects');
    await expect(page).toHaveTitle('Projects - Vincent Lam');
  });

  test('swiping pages through panels on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'swipe is a touch feature');
    await page.goto('/');
    const swipe = (dx, dy = 0) => page.evaluate(([dx, dy]) => {
      const view = document.querySelector('.view');
      const touch = (x, y) => new Touch({ identifier: 1, target: view, clientX: x, clientY: y });
      view.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch(200, 400)], bubbles: true }));
      view.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(200 + dx, 400 + dy)], bubbles: true }));
    }, [dx, dy]);
    await swipe(-150); await expectSettled(page, 'about');
    await swipe(-150); await expectSettled(page, 'projects');
    await swipe(150); await expectSettled(page, 'about');
    // A mostly vertical drag (scrolling) doesn't change panel.
    await swipe(-70, 200); await expectSettled(page, 'about');
    // Past the ends nothing happens.
    await swipe(150); await expectSettled(page, 'home');
    await swipe(150); await expectSettled(page, 'home');
  });

  test('Tab never reaches a link in a hidden panel', async ({ page, isMobile }) => {
    await page.goto('/');
    await navLink(page, isMobile, 'projects').click();
    await expectSettled(page, 'projects');
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        const panel = el && el.closest('.panel');
        return panel ? (panel.classList.contains('active') ? 'active' : `hidden:${panel.id}`) : 'outside';
      });
      expect(where.startsWith('hidden')).toBe(false);
    }
  });

  test('the skip link is the first Tab stop and jumps to the panel heading', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#home .hero-title')).toBeFocused();
  });

  test('a project row opens and closes from the keyboard', async ({ page, isMobile }) => {
    await page.goto('/');
    await navLink(page, isMobile, 'projects').click();
    await expectSettled(page, 'projects');
    const summary = page.locator('details[data-repo="nagare"] summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('details[data-repo="nagare"]')).toHaveAttribute('open', '');
    await page.keyboard.press(' ');
    await expect(page.locator('details[data-repo="nagare"]')).not.toHaveAttribute('open', '');
  });
});

// ---------------------------------------------------------------- theme, copy, storage

test.describe('theme, email and storage', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  test('the theme toggle switches, is remembered and survives a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 13, 16)');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the dark system preference is used when nothing is saved', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 13, 16)');
    await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking the email copies it and confirms', async ({ page, context, isMobile, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await navLink(page, isMobile, 'contact').click();
    await expectSettled(page, 'contact');
    await page.locator('#email-card').click();
    await expect(page.locator('#email-card')).toHaveClass(/copied/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('v812.io@gmail.com');
    await expect(page.locator('#email-card')).not.toHaveClass(/copied/, { timeout: 4000 });
  });

  test('everything still works when browser storage is blocked', async ({ page, isMobile }) => {
    await page.addInitScript(() => {
      const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
      Storage.prototype.getItem = blocked;
      Storage.prototype.setItem = blocked;
    });
    const errors = watchErrors(page);
    await page.goto('/');
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
    await navLink(page, isMobile, 'projects').click();
    await expectSettled(page, 'projects');
    await expect(page.locator('.more-repos')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- GitHub data

test.describe('GitHub data', () => {
  test('stats, heatmap, repo list and last-updated render from the API', async ({ page, isMobile }) => {
    const calls = await mockGitHub(page);
    await page.goto('/');
    await navLink(page, isMobile, 'about').click();
    const cells = page.locator('.gh-heatmap .gh-heat-cell:not(.skeleton)');
    await expect(cells.first()).toBeAttached();
    expect(await cells.count()).toBeGreaterThanOrEqual(90);
    await expect(page.locator('.gh-heatmap .gh-heat-cell[data-level="3"]')).toHaveCount(1);
    await expect(page.locator('.gh-heatmap .gh-heat-cell[data-level="1"]')).toHaveCount(1);
    await navLink(page, isMobile, 'contact').click();
    await expect(page.locator('.last-updated time')).toHaveText('Sep 27, 2026');
    expect(calls.count).toBe(3);

    // A reload inside the cache window makes no new requests.
    await page.reload();
    await expect(page.locator('.last-updated')).toBeVisible();
    expect(calls.count).toBe(3);
  });

  for (const status of [403, 500]) {
    test(`GitHub answering ${status} hides the GitHub sections cleanly`, async ({ page, isMobile }) => {
      await mockGitHub(page, { status });
      const errors = watchErrors(page, { ignore: [/Failed to load resource/] });
      await page.goto('/');
      await expect(page.locator('.github-stats').first()).toBeHidden();
      await navLink(page, isMobile, 'about').click();
      await expect(page.locator('.github-activity')).toBeHidden();
      await navLink(page, isMobile, 'projects').click();
      await expect(page.locator('.more-repos')).toBeHidden();
      await navLink(page, isMobile, 'contact').click();
      await expect(page.locator('.last-updated')).toBeHidden();
      expect(errors).toEqual([]);
    });
  }

  test('a fork, archived repo, featured project or excluded repo is never listed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the list itself is desktop-only');
    await mockGitHub(page);
    await page.goto('/#projects');
    const names = await page.locator('.repo-link .repo-name').allTextContents();
    expect(names).toEqual(['side-project']);
    for (const hidden of ['some-fork', 'Installous', 'aegis', 'AgentApply', 'Xeoul.github.io']) {
      expect(names).not.toContain(hidden);
    }
    expect(GITHUB_FIXTURES.repos.length).toBeGreaterThan(names.length);
  });
});

// ---------------------------------------------------------------- desktop keyboard features

test.describe('command menu and shortcuts', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard features are desktop-only');
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  test('opens, filters, wraps with the arrows and closes every way', async ({ page }) => {
    await page.goto('/');
    const menu = page.locator('dialog.cmdk');
    await page.keyboard.press('Control+k');
    await expect(menu).toBeVisible();
    await expect(page.locator('.cmdk-input')).toBeFocused();
    const items = page.locator('.cmdk-item');
    const total = await items.count();
    expect(total).toBe(10);
    // Up from the first wraps to the last.
    await page.keyboard.press('ArrowUp');
    await expect(items.nth(total - 1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(0)).toHaveAttribute('aria-selected', 'true');
    // Arrow keys inside the menu don't page the panels behind it.
    await expectSettled(page, 'home');
    // No-match state.
    await page.keyboard.type('zzzz');
    await expect(page.locator('.cmdk-empty')).toBeVisible();
    await page.keyboard.press('Enter'); // nothing to run - stays open
    await expect(menu).toBeVisible();
    // Escape, Ctrl+K again, the header button and the backdrop.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.keyboard.press('Control+k');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(menu).toBeHidden();
    await page.locator('.cmdk-trigger').click();
    await expect(menu).toBeVisible();
    await expect(page.locator('.cmdk-input')).toHaveValue('');
    await page.mouse.click(10, 790);
    await expect(menu).toBeHidden();
  });

  for (const [query, id] of [['home', 'home'], ['about', 'about'], ['projects', 'projects'], ['contact', 'contact']]) {
    test(`"Go to ${id}" works from another panel`, async ({ page }) => {
      await page.goto(id === 'home' ? '/#about' : '/');
      await page.keyboard.press('Meta+k');
      await page.keyboard.type(query);
      await page.keyboard.press('Enter');
      await expectSettled(page, id);
      await expect(page.locator(`#${id} .hero-title, #${id} .section-title`)).toBeFocused();
    });
  }

  test('copy email, open profiles and toggle theme from the menu', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // The profiles open in a new tab; answer them locally so the test
    // doesn't depend on reaching GitHub or LinkedIn.
    await context.route(/https:\/\/(github\.com|www\.linkedin\.com)\/.*/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>profile</title>' }));
    await page.goto('/');
    const run = async (text) => {
      await page.keyboard.press('Control+k');
      await page.keyboard.type(text);
      await page.keyboard.press('Enter');
    };
    await run('copy email');
    await expect(page.locator('.toast')).toHaveText('Email copied to clipboard');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('v812.io@gmail.com');

    for (const [text, url] of [['github', 'https://github.com/Xeoul'], ['linkedin', 'https://www.linkedin.com/in/vincentlam812']]) {
      const popupPromise = context.waitForEvent('page');
      await run(text);
      const popup = await popupPromise;
      expect(popup.url()).toContain(new URL(url).hostname);
      await popup.close();
    }

    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await run('theme');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(before);
  });

  test('keys typed into the menu never trigger page shortcuts', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('wave 2 4');
    await expect(page.locator('.toast')).not.toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expectSettled(page, 'home');
  });

  test('the easter egg answers to typing "wave" and to five taps on the name', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1200); // let the entrance finish so the name is clickable
    await page.keyboard.type('wave');
    await expect(page.locator('.toast')).toHaveText(/Surf's up/);
    await expect(page.locator('.toast')).toHaveClass(/visible/);
    await expect(page.locator('.toast')).not.toHaveClass(/visible/, { timeout: 5000 });
    for (let i = 0; i < 5; i++) await page.locator('.hero-title .name').click();
    await expect(page.locator('.toast')).toHaveClass(/visible/);
  });

  test('modifier combinations are left to the browser', async ({ page }) => {
    await page.goto('/');
    for (const combo of ['Alt+ArrowRight', 'Shift+ArrowRight', 'Control+ArrowRight', 'Alt+2']) {
      await page.keyboard.press(combo);
    }
    await expectSettled(page, 'home');
  });
});

// ---------------------------------------------------------------- project links, case studies, contact card

test.describe('project links, case studies and the contact card', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  const openSlugs = (page) => page.locator('details.project').evaluateAll((els) => els.filter((d) => d.open).map((d) => d.dataset.slug));

  test('a link to #projects/<slug> opens the catalog with that project expanded', async ({ page }) => {
    const errors = watchErrors(page);
    for (const slug of ['nagare', 'movie-recommender']) {
      await page.goto(`/#projects/${slug}`);
      await expectSettled(page, 'projects');
      expect(await openSlugs(page)).toEqual([slug]);
      // Scrolled into view, even at the bottom of a phone-length list.
      const visible = await page.locator(`details[data-slug="${slug}"] summary`).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const p = el.closest('.panel').getBoundingClientRect();
        return r.top >= p.top && r.bottom <= p.bottom;
      });
      expect(visible).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test('an unknown project still opens the catalog, with nothing expanded', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#projects/not-a-project');
    await expectSettled(page, 'projects');
    expect(await openSlugs(page)).toEqual([]);
    // A fresh load of an unknown panel falls back to Home, as for #nope.
    await page.goto('about:blank');
    await page.goto('/#nope/nagare');
    await expectSettled(page, 'home');
    expect(errors).toEqual([]);
  });

  test('opening and closing a project keeps the address bar in step', async ({ page, isMobile }) => {
    await page.goto('/');
    await navLink(page, isMobile, 'projects').click();
    await expectSettled(page, 'projects');
    const historyLength = await page.evaluate(() => history.length);
    await page.locator('details[data-slug="nagare"] summary').click();
    await expect(page).toHaveURL(/#projects\/nagare$/);
    await page.locator('details[data-slug="sous-chef"] summary').click();
    await expect(page).toHaveURL(/#projects\/sous-chef$/);
    await page.locator('details[data-slug="sous-chef"] summary').click();
    await expect(page).toHaveURL(/#projects$/);
    // Replaced, not pushed: Back still steps through panels.
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
  });

  test('Back returns to the project that was open', async ({ page, isMobile }) => {
    await page.goto('/#projects/privacy-blocker');
    await expectSettled(page, 'projects');
    await navLink(page, isMobile, 'contact').click();
    await expectSettled(page, 'contact');
    await page.locator('details[data-slug="privacy-blocker"]').evaluate((d) => { d.open = false; });
    await page.goBack();
    await expectSettled(page, 'projects');
    expect(await openSlugs(page)).toEqual(['privacy-blocker']);
  });

  test('Copy link copies a link to the project', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#projects/nagare');
    await expectSettled(page, 'projects');
    const button = page.locator('details[data-slug="nagare"] .project-copy-link');
    await expect(button).toHaveAccessibleName('Copy link to Nagare');
    await button.click();
    await expect(page.locator('.toast')).toHaveText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:4173/#projects/nagare');
    // Every project gets one, including those without links of their own.
    await expect(page.locator('.project-copy-link')).toHaveCount(7);
  });

  test('Copy link falls back to the address bar when the clipboard is refused', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
    });
    await page.goto('/#projects');
    await expectSettled(page, 'projects');
    await page.locator('details[data-slug="wemu"] summary').click();
    await page.locator('details[data-slug="wemu"] .project-copy-link').click();
    await expect(page.locator('.toast')).toHaveText('Copy the link from the address bar');
    await expect(page).toHaveURL(/#projects\/wemu$/);
  });

  test('each case-study link opens its page, and its back link reopens the project', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto('/#projects/sous-chef');
    await expectSettled(page, 'projects');
    await page.locator('details[data-slug="sous-chef"] .project-links a', { hasText: 'Case study' }).click();
    await expect(page).toHaveURL(/\/projects\/sous-chef\/$/);
    await expect(page).toHaveTitle('Sous Chef case study - Vincent Lam');
    await expect(page.locator('h1.case-title')).toHaveText('Sous Chef');
    await expect(page.locator('#case')).toBeVisible();
    // The page's section is marked in the nav.
    await expect(page.locator(isMobile ? '.tab-bar a[href="/#projects"]' : '.in-menu a[href="/#projects"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('.case-back').click();
    await expect(page).toHaveURL(/\/#projects\/sous-chef$/);
    await expectSettled(page, 'projects');
    expect(await openSlugs(page)).toEqual(['sous-chef']);
    expect(errors).toEqual([]);
  });

  for (const slug of CASE_STUDIES) {
    test(`the ${slug} case study loads cleanly, scrolls and links on`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/projects/${slug}/`);
      await expect(page.locator('.case-section h2').first()).toBeVisible();
      await expect(page.locator('.case-preview')).toHaveJSProperty('complete', true);
      expect(await page.locator('.case-preview').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      // The article scrolls inside the still panel, all the way to the pager.
      const scroller = page.locator('.case-scroll');
      expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      await page.locator('.case-pager a[rel="next"]').scrollIntoViewIfNeeded();
      await expect(page.locator('.case-pager a[rel="next"]')).toBeInViewport();
      expect(await page.evaluate(() => document.querySelector('.view').scrollLeft + document.documentElement.scrollTop)).toBe(0);
      // Nothing sticks out sideways.
      const wide = await page.evaluate(() => [...document.querySelectorAll('.case-study *')]
        .filter((el) => el.getBoundingClientRect().right > document.querySelector('.case-scroll').clientWidth + 1)
        .map((el) => el.className || el.tagName));
      expect(wide).toEqual([]);
      // The pager walks through all four and comes back around.
      const next = CASE_STUDIES[(CASE_STUDIES.indexOf(slug) + 1) % CASE_STUDIES.length];
      await page.locator('.case-pager a[rel="next"]').click();
      await expect(page).toHaveURL(new RegExp(`/projects/${next}/$`));
      expect(errors).toEqual([]);
    });
  }

  test('a case study prints as a plain document', async ({ page }) => {
    await page.goto('/projects/nagare/');
    await page.emulateMedia({ media: 'print' });
    const layout = await page.evaluate(() => ({
      scroll: getComputedStyle(document.querySelector('.case-scroll')).position,
      back: getComputedStyle(document.querySelector('.case-back')).display,
      pager: getComputedStyle(document.querySelector('.case-pager')).display,
      header: getComputedStyle(document.querySelector('header')).display,
    }));
    expect(layout).toEqual({ scroll: 'static', back: 'none', pager: 'none', header: 'none' });
  });

  test('the contact card downloads a valid vCard', async ({ page, request, isMobile }) => {
    const res = await request.get('/vincent-lam.vcf');
    expect(res.status()).toBe(200);
    const card = await res.text();
    expect(card).toMatch(/^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
    expect(card).toMatch(/\r\nEND:VCARD\r\n$/);
    for (const line of ['FN:Vincent Lam', 'EMAIL;TYPE=INTERNET:v812.io@gmail.com', 'URL:https://xeoul.github.io/', 'https://www.linkedin.com/in/vincentlam812', 'https://github.com/Xeoul']) {
      expect(card).toContain(line);
    }
    await page.goto('/');
    await navLink(page, isMobile, 'contact').click();
    await expectSettled(page, 'contact');
    const download = page.waitForEvent('download');
    await page.locator('a.save-contact').click();
    expect((await download).suggestedFilename()).toBe('vincent-lam.vcf');
  });

  test('the command menu can save the contact card', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard features are desktop-only');
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('vcard');
    await expect(page.locator('.cmdk-item')).toHaveText([/Save contact card/]);
    const download = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toBe('vincent-lam.vcf');
  });
});

// ---------------------------------------------------------------- layout and motion

test.describe('layout and motion', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`nothing overflows sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      for (const id of PANELS) {
        await page.evaluate((id) => { location.hash = id; }, id);
        await expectSettled(page, id);
        const overflow = await page.evaluate((id) => {
          const panel = document.getElementById(id);
          const wide = [...panel.querySelectorAll('*')]
            .filter((el) => !el.closest('.gh-heatmap') && el.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1 && el.getBoundingClientRect().width > 0)
            .map((el) => el.className || el.tagName);
          return { page: document.documentElement.scrollWidth > window.innerWidth, panel: panel.scrollWidth > panel.clientWidth + 1, wide: wide.slice(0, 3) };
        }, id);
        expect(overflow, `#${id} at ${width}px`).toEqual({ page: false, panel: false, wide: [] });
      }
      for (const slug of CASE_STUDIES) {
        await page.goto(`/projects/${slug}/`);
        const overflow = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth > window.innerWidth,
          article: document.querySelector('.case-scroll').scrollWidth > document.querySelector('.case-scroll').clientWidth,
        }));
        expect(overflow, `${slug} at ${width}px`).toEqual({ page: false, article: false });
      }
    });
  }

  test('resizing across the phone/desktop breakpoint keeps everything in place', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#projects');
    await expectSettled(page, 'projects');
    for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 700, height: 500 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(150);
      await expectSettled(page, 'projects');
      const canvas = await page.evaluate(() => {
        const panel = document.getElementById('projects');
        const c = panel.querySelector('.wave-canvas');
        return { cw: c.width / devicePixelRatio, pw: panel.clientWidth, ch: c.height / devicePixelRatio, ph: panel.clientHeight };
      });
      expect(Math.abs(canvas.cw - canvas.pw)).toBeLessThanOrEqual(1);
      expect(Math.abs(canvas.ch - canvas.ph)).toBeLessThanOrEqual(1);
    }
    // Desktop nav pill sits under the active link after all that.
    const pill = await page.evaluate(() => {
      const ind = document.querySelector('.nav-indicator').getBoundingClientRect();
      const link = document.querySelector('.in-menu a.active').getBoundingClientRect();
      return { dx: Math.abs(ind.left - link.left), dw: Math.abs(ind.width - link.width) };
    });
    expect(pill.dx).toBeLessThanOrEqual(1);
    expect(pill.dw).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('the wave is drawn and keeps moving', async ({ page }) => {
    await page.goto('/');
    const lit = () => page.evaluate(() => {
      const c = document.querySelector('#home .wave-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++;
      return n;
    });
    expect(await lit()).toBeGreaterThan(0);
    const shift = () => page.evaluate(() => document.getElementById('home').style.getPropertyValue('--grid-shift'));
    const a = await shift();
    await page.waitForTimeout(500);
    expect(await shift()).not.toBe(a);
  });

  // Regression: left open a long time, the browser could drop the
  // canvas's pixels while the page was out of sight, and the wave stayed
  // gone until switching panel repainted it. Each way back into view now
  // swaps in fresh canvases and draws them at once.
  test('the wave is redrawn on fresh canvases whenever the page comes back', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    const canvasCount = () => page.locator('.wave-canvas').count();
    const litNow = () => page.evaluate(() => {
      const c = document.querySelector('#home .wave-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++;
      return n;
    });
    // Marks the current canvases, then checks each was replaced by a new,
    // already-drawn one - without waiting for the next animation frame.
    const expectRebuilt = async (trigger) => {
      await page.evaluate(() => document.querySelectorAll('.wave-canvas').forEach((c) => { c.dataset.old = '1'; }));
      await page.evaluate(trigger);
      expect(await page.locator('.wave-canvas[data-old]').count()).toBe(0);
      expect(await canvasCount()).toBe(4);
      expect(await litNow()).toBeGreaterThan(0);
    };
    await expect.poll(litNow).toBeGreaterThan(0);

    await expectRebuilt(() => document.dispatchEvent(new Event('visibilitychange')));
    await expectRebuilt(() => {
      const e = new Event('pageshow');
      Object.defineProperty(e, 'persisted', { value: true });
      window.dispatchEvent(e);
    });
    await expectRebuilt(() => document.dispatchEvent(new Event('resume')));
    await expectRebuilt(() => document.querySelector('#home .wave-canvas').dispatchEvent(new Event('contextrestored')));

    // Hidden: nothing to redraw yet.
    await page.evaluate(() => document.querySelectorAll('.wave-canvas').forEach((c) => { c.dataset.old = '1'; }));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
    expect(await page.locator('.wave-canvas[data-old]').count()).toBe(4);

    // And it keeps animating on the new canvases, on every panel.
    const shift = () => page.evaluate(() => document.getElementById('home').style.getPropertyValue('--grid-shift'));
    const a = await shift();
    await expect.poll(shift).not.toBe(a);
    await page.goto('/#contact');
    await expectSettled(page, 'contact');
    expect(await page.evaluate(() => {
      const c = document.querySelector('#contact .wave-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 20) return true;
      return false;
    })).toBe(true);
    expect(errors).toEqual([]);
  });

  test('reduced motion: panels crossfade in place and everything still works', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = watchErrors(page);
    await page.goto('/');
    for (const id of ['about', 'projects', 'contact', 'home']) {
      await navLink(page, isMobile, id).click();
      await expectSettled(page, id); // in place, crossfaded - see expectSettled
    }
    // The wave is still drawn, just not animated.
    const shift = () => page.evaluate(() => document.getElementById('home').style.getPropertyValue('--grid-shift'));
    const a = await shift();
    await page.waitForTimeout(400);
    expect(await shift()).toBe(a);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- accessibility

test.describe('accessibility scan', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  for (const scheme of ['light', 'dark']) {
    for (const id of PANELS) {
      test(`#${id} has no accessibility violations (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto(`/#${id}`);
        await expectSettled(page, id);
        await page.waitForTimeout(300);
        if (id === 'projects') await page.locator('details[data-repo="Installous"] summary').click();
        const results = await new AxeBuilder({ page })
          .include(`#${id}`)
          .include('header')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
        expect(summary).toEqual([]);
      });
    }
  }

  for (const scheme of ['light', 'dark']) {
    test(`the case studies have no accessibility violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const slug of CASE_STUDIES) {
        await page.goto(`/projects/${slug}/`);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const summary = results.violations.map((v) => `${slug} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
        expect(summary).toEqual([]);
      }
    });
  }

  test('the 404 page has no accessibility violations', async ({ page }) => {
    await page.goto('/404.html');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

// ---------------------------------------------------------------- 404 page

test.describe('404 page', () => {
  test.beforeEach(async ({ page }) => { await mockGitHub(page); });

  test('its nav leads back into the site and page shortcuts do nothing harmful', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto('/404.html');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('2');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('wave');
    await expect(page.locator('#not-found')).toBeVisible();
    await (isMobile ? page.locator('.tab-bar a[href="/#projects"]') : page.locator('.in-menu a[href="/#projects"]')).click();
    await expect(page).toHaveURL(/\/#projects$/);
    await expectSettled(page, 'projects');
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- stress

// A long, seeded run of mixed input - navigation, keys, theme, printing,
// resizing, the command menu - checking after every step that the page
// settles into a consistent state and never throws. Seeded so a failure
// reproduces exactly.
// STRESS_SEED / STRESS_STEPS override the defaults for longer local runs.
const STRESS_STEPS = Number(process.env.STRESS_STEPS) || 150;
test(`stress: ${STRESS_STEPS} random actions leave the page consistent`, async ({ page, isMobile }) => {
  test.setTimeout(STRESS_STEPS * 1000);
  await mockGitHub(page);
  const errors = watchErrors(page);
  await page.goto('/');
  let seed = Number(process.env.STRESS_SEED) || 12345;
  const rand = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const phoneWidth = () => page.viewportSize().width < 900;
  const actions = [
    async () => navLink(page, phoneWidth(), PANELS[rand(4)]).click({ delay: 0 }),
    async () => { if (!isMobile) await page.keyboard.press(['ArrowLeft', 'ArrowRight', '1', '2', '3', '4'][rand(6)]); },
    async () => page.locator('.theme-toggle').click(),
    async () => page.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); window.dispatchEvent(new Event('afterprint')); }),
    async () => page.setViewportSize(rand(2) ? { width: 390, height: 844 } : { width: 1280, height: 800 }),
    async () => {
      if (phoneWidth()) return; // the menu's header button is desktop-only; the shortcut still works
      await page.keyboard.press('Control+k');
      await page.keyboard.type(['proj', 'about', 'home', 'cont'][rand(4)]);
      await page.keyboard.press(rand(2) ? 'Enter' : 'Escape');
    },
    async () => {
      const summaries = page.locator('#projects.active details.project summary');
      const n = await summaries.count();
      if (n) await summaries.nth(rand(n)).click({ timeout: 3000 }).catch(() => {}); // the panel may slide away first
    },
    async () => {
      const button = page.locator('#projects.active details.project[open] .project-copy-link');
      if (await button.count()) await button.click({ timeout: 3000 }).catch(() => {});
    },
    async () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))),
    // Back only within the site: from the first entry (no hash yet) it
    // would leave for the blank page the test browser started on.
    async () => page.evaluate(() => { if (location.hash) history.back(); }),
  ];
  for (let step = 0; step < STRESS_STEPS; step++) {
    await actions[rand(actions.length)]();
    if (step % 10 === 9) {
      await expect(page.locator('dialog.cmdk')).toBeHidden();
      await expectSettled(page);
      expect(await page.locator('details.project[open]').count()).toBeLessThanOrEqual(1);
      // A #projects/<slug> address always shows that project open.
      const linked = await page.evaluate(() => {
        const m = location.hash.match(/^#projects\/(.+)$/);
        return m && document.querySelector('#projects.active') ? document.querySelector(`details[data-slug="${m[1]}"]`).open : true;
      });
      expect(linked).toBe(true);
      await expect(page.locator('html')).not.toHaveClass(/printing/);
      expect(await page.locator('.wave-canvas').count()).toBe(4);
    }
  }
  await expectSettled(page);
  expect(errors).toEqual([]);
});
