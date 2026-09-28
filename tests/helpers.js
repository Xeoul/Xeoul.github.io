// Shared setup for the Playwright tests.

// The site calls the public GitHub API for stats, repos and activity.
// It's answered locally so tests are fast, deterministic and never
// spend the API's unauthenticated rate limit.
const today = new Date().toISOString();
const GITHUB_FIXTURES = {
  user: { public_repos: 9, followers: 4 },
  repos: [
    { name: 'Xeoul.github.io', fork: false, archived: false, html_url: 'https://github.com/Xeoul/Xeoul.github.io', language: 'CSS', stargazers_count: 1, pushed_at: '2026-09-27T18:53:40Z' },
    { name: 'Installous', fork: false, archived: false, html_url: 'https://github.com/Xeoul/Installous', language: 'TypeScript', stargazers_count: 0 },
    { name: 'AgentApply', fork: false, archived: false, html_url: 'https://github.com/Xeoul/AgentApply', language: 'Python', stargazers_count: 0 },
    { name: 'some-fork', fork: true, archived: false, html_url: 'https://github.com/Xeoul/some-fork', language: 'Go', stargazers_count: 0 },
    { name: 'side-project', fork: false, archived: false, html_url: 'https://github.com/Xeoul/side-project', language: 'Java', stargazers_count: 3 },
  ],
  // Three events today (activity level 3) and one yesterday (level 1).
  events: [
    { created_at: today }, { created_at: today }, { created_at: today },
    { created_at: new Date(Date.now() - 86400000).toISOString() },
  ],
};

// status: answer every GitHub call with this HTTP status instead (e.g.
// 403 to simulate the rate limit). Returns a counter of calls made.
async function mockGitHub(page, { status = 200 } = {}) {
  const calls = { count: 0 };
  await page.route('https://api.github.com/**', (route) => {
    calls.count++;
    if (status !== 200) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: 'API rate limit exceeded' }) });
    }
    const url = route.request().url();
    const body = url.includes('/events') ? GITHUB_FIXTURES.events
      : url.includes('/repos') ? GITHUB_FIXTURES.repos
        : GITHUB_FIXTURES.user;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

// Collects anything the page logs as an error, so a test can assert the
// page stayed clean. ignore: patterns for errors a test expects.
function watchErrors(page, { ignore = [] } = {}) {
  const errors = [];
  const keep = (text) => !ignore.some((re) => re.test(text));
  page.on('pageerror', (err) => { if (keep(err.message)) errors.push(`pageerror: ${err.message}`); });
  page.on('console', (msg) => { if (msg.type() === 'error' && keep(msg.text())) errors.push(`console: ${msg.text()}`); });
  return errors;
}

// Phones navigate with the bottom tab bar, desktop with the header nav.
function navLink(page, isMobile, id) {
  return page.locator(isMobile ? `.tab-bar a[href="#${id}"]` : `.in-menu a[href="#${id}"]`);
}

// Where each panel sits relative to the view, in px (0 = on screen).
function panelOffsets(page) {
  return page.evaluate(() => {
    const v = document.querySelector('.view').getBoundingClientRect();
    return Object.fromEntries([...document.querySelectorAll('.panel')]
      .map((p) => [p.id, Math.round(p.getBoundingClientRect().left - v.left)]));
  });
}

// Waits until no panel is mid-slide, then checks the resting layout: one
// active panel on screen and every other one out of sight - fully off to
// one side, or (under reduced motion, where panels crossfade in place)
// faded out. showPanel() starts a slide two frames after it's called, so
// those frames are waited out first.
async function expectSettled(page, activeId) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => document.getAnimations().every((a) =>
    !(a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('panel'))));
  const state = await page.evaluate(() => {
    const v = document.querySelector('.view').getBoundingClientRect();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      reduced,
      scrolled: document.querySelector('.view').scrollLeft,
      panels: [...document.querySelectorAll('.panel')].map((p) => ({
        id: p.id,
        active: p.classList.contains('active'),
        offset: Math.round(p.getBoundingClientRect().left - v.left),
        opacity: getComputedStyle(p).opacity,
        width: Math.round(v.width),
      })),
    };
  });
  const dump = JSON.stringify(state);
  if (state.scrolled !== 0) throw new Error(`view is scrolled sideways: ${dump}`);
  const active = state.panels.filter((p) => p.active);
  if (active.length !== 1) throw new Error(`expected one active panel, got ${dump}`);
  if (activeId && active[0].id !== activeId) throw new Error(`expected #${activeId} active, got ${dump}`);
  for (const p of state.panels) {
    const ok = state.reduced
      ? p.offset === 0 && p.opacity === (p.active ? '1' : '0')
      : p.active ? p.offset === 0 : Math.abs(p.offset) === p.width;
    if (!ok) throw new Error(`panel not at rest: ${dump}`);
  }
}

module.exports = { GITHUB_FIXTURES, mockGitHub, watchErrors, navLink, panelOffsets, expectSettled };
