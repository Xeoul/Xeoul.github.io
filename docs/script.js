// AMBIENT WAVE BACKGROUND
// Builds the ambient-drift SVG behind each panel (see the "AMBIENT
// DRIFT" rules in styles.css for the animation/blur/gradient side of
// this) and prepends the same markup into every .panel, rather than
// duplicating it four times in the HTML.
//
// A first version built each wave from evenly-repeated symmetric
// humps (the same up-down curve copy-pasted every `period` units).
// That read as a mechanical, cartoonish "sine wave" rather than the
// actual PS3 XMB look - a single soft, irregular, blurred ribbon.
// This version instead threads one smooth curve through a hand-tuned,
// non-repeating list of amplitudes (`AMPS` below), so the visible
// shape never looks like a copy-pasted unit.
//
// It still has to loop seamlessly, though, so the same irregular
// "motif" is duplicated exactly once (not many times): the amplitude
// list is required to start and end at the same value (0), so the
// point where motif 1 ends and motif 2 begins is just another smooth
// point on the curve, not a visible seam. The rendered element is
// double its container's width (`width: 200%`) and looped by
// translating exactly -50% - since that's precisely one motif-width,
// the view after the loop is pixel-identical to the view before it.
// Because cycles is fixed at exactly 2 (the minimum that still loops),
// only one motif is ever on screen at a time - it reads as a single
// flowing irregular line drifting past, not a repeating pattern.
function buildSmoothPath(points) {
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const midX = (p0.x + p1.x) / 2;
        d += ` C${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
}

// amps[0] must equal amps[amps.length - 1] - that shared value is the
// y-coordinate at both the motif seam (x = motifWidth) and the wrap
// point (x = 0 / x = 2*motifWidth), which is what keeps the curve
// smooth and seamless across the loop rather than jumping at those
// points.
function buildMotifPoints(amps, motifWidth, baseline, baselineOffset) {
    const n = amps.length;
    const step = motifWidth / (n - 1);
    const points = [];
    for (let rep = 0; rep < 2; rep++) {
        const startI = rep === 0 ? 0 : 1;
        for (let i = startI; i < n; i++) {
            points.push({ x: rep * motifWidth + i * step, y: baseline + baselineOffset + amps[i] });
        }
    }
    return points;
}

function buildStrandPath(amps, motifWidth, baseline, baselineOffset) {
    return buildSmoothPath(buildMotifPoints(amps, motifWidth, baseline, baselineOffset));
}

// A handful of small sparkle particles scattered along one motif's
// worth of width, then duplicated at +motifWidth so they loop with
// the same geometry as the ribbon they sit near. Mixes tiny sharp
// specks with a few larger, more-blurred "glow motes" (the `glow`
// flag) rather than one uniform size, so it doesn't read as a
// mechanically even dot grid.
function buildSparkles(motifWidth, baseline, jitter) {
    const perMotif = jitter.length;
    let markup = '';
    for (let rep = 0; rep < 2; rep++) {
        for (let i = 0; i < perMotif; i++) {
            const j = jitter[i];
            const x = rep * motifWidth + (motifWidth / perMotif) * (i + 0.5);
            const y = baseline + j.dy;
            const delay = (i * 0.6 + rep * 0.3).toFixed(2);
            const duration = (2.6 + j.durBias).toFixed(2);
            const cls = j.glow ? 'wave-sparkle wave-sparkle-glow' : 'wave-sparkle';
            markup += `<circle class="${cls}" cx="${x}" cy="${y}" r="${j.r}" style="animation-delay:-${delay}s;animation-duration:${duration}s"/>`;
        }
    }
    return markup;
}

const WAVE_VIEW_HEIGHT = 200;
const MOTIF_WIDTH = 460;

// Faint secondary strand: higher up, smaller amplitude, more blur -
// a hint of depth behind the main ribbon rather than a second wave
// competing for attention. Amplitudes stay within the same vertical
// band the original hump-based design tested safe (roughly the bottom
// third of the viewBox), so panel-content clearance already verified
// for that zone still holds.
const SECONDARY_AMPS = [0, -6, 4, -7, 5, -3, 0];
const SECONDARY_BASELINE = 165;

// Primary ribbon: three strands, each with its OWN irregular amplitude
// curve (not the same curve copied with a y-offset) so they genuinely
// diverge, cross and re-converge like loosely braided filaments of
// smoke rather than three parallel lines. Different point counts per
// strand keep their bends from ever lining up in sync. Each list still
// starts and ends at 0 for the same loop-seam reason as SECONDARY_AMPS.
const PRIMARY_BASELINE = 186;
const PRIMARY_STRANDS = [
    { amps: [0, 8, -10, 3, 14, -7, 9, -2, 0], dy: -3, className: 'strand-a' },
    { amps: [0, -13, 6, -18, 3, 11, -8, 10, -5, 2, 0], dy: 0, className: 'strand-b' },
    { amps: [0, 7, -11, 15, -4, -9, 8, 0], dy: 3, className: 'strand-c' },
];
const PRIMARY_SPARKLE_JITTER = [
    { dy: -10, r: 0.9, durBias: 0.4 },
    { dy: 6, r: 0.6, durBias: 1.1 },
    { dy: -3, r: 1.6, durBias: 0, glow: true },
    { dy: 9, r: 0.7, durBias: 0.7 },
    { dy: -14, r: 0.8, durBias: 1.4 },
    { dy: 2, r: 0.6, durBias: 0.2 },
    { dy: -7, r: 1.8, durBias: 0.9, glow: true },
    { dy: 11, r: 0.7, durBias: 0.5 },
    { dy: -18, r: 0.6, durBias: 1.6 },
    { dy: 4, r: 1.5, durBias: 0.3, glow: true },
];

// The gradient's stops repeat every 50% of its own length - since that
// matches the motif width exactly, both motifs get an identical
// brightening profile and the traveling "brighter patch" loops with
// the geometry instead of jumping at the seam. The peak stop is a near-
// white highlight rather than the flat accent color - real light
// bunches up brighter than its own base color at a glowing core, and
// stacking a colored-only gradient never gets there on its own.
function gradientStops(peakOpacity, peakColor) {
    return `
    <stop offset="0%" style="stop-color: rgb(var(--color-accent-rgb)); stop-opacity: 0" />
    <stop offset="25%" style="stop-color: ${peakColor}; stop-opacity: ${peakOpacity}" />
    <stop offset="50%" style="stop-color: rgb(var(--color-accent-rgb)); stop-opacity: 0" />
    <stop offset="75%" style="stop-color: ${peakColor}; stop-opacity: ${peakOpacity}" />
    <stop offset="100%" style="stop-color: rgb(var(--color-accent-rgb)); stop-opacity: 0" />`;
}

const totalWidth = MOTIF_WIDTH * 2;
const secondaryPath = buildStrandPath(SECONDARY_AMPS, MOTIF_WIDTH, SECONDARY_BASELINE, 0);
const primaryStrandPaths = PRIMARY_STRANDS.map(strand => buildStrandPath(strand.amps, MOTIF_WIDTH, PRIMARY_BASELINE, strand.dy));
const primarySparklesMarkup = buildSparkles(MOTIF_WIDTH, PRIMARY_BASELINE, PRIMARY_SPARKLE_JITTER);
// strand-b (index 1) is the bright core; its path is reused, wider and
// heavily blurred, as a glow halo painted underneath the crisp strands -
// the actual light-bloom look, not just a thicker line.
const haloPath = primaryStrandPaths[1];

// Gradient ids need to be unique per panel: cloning inline SVGs that
// share an id (as innerHTML-ing the same markup string into all four
// .panel elements would) is a known source of url(#id) paint failures
// in Safari once more than one copy is in the document.
function buildWaveFieldMarkup(uid) {
    const secondaryMarkup = `<svg class="wave-layer wave-layer-secondary" viewBox="0 0 ${totalWidth} ${WAVE_VIEW_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="waveGradSecondary-${uid}" x1="0" x2="${totalWidth}" gradientUnits="userSpaceOnUse">${gradientStops(0.2, 'rgb(var(--color-accent-rgb))')}</linearGradient></defs>
    <path class="wave-stroke" d="${secondaryPath}" stroke="url(#waveGradSecondary-${uid})"/>
</svg>`;

    const primaryStrandsMarkup = PRIMARY_STRANDS.map((strand, i) => {
        return `<path class="wave-stroke ${strand.className}" d="${primaryStrandPaths[i]}" stroke="url(#waveGradPrimary-${uid})"/>`;
    }).join('');
    const primaryMarkup = `<svg class="wave-layer wave-layer-primary" viewBox="0 0 ${totalWidth} ${WAVE_VIEW_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="waveGradPrimary-${uid}" x1="0" x2="${totalWidth}" gradientUnits="userSpaceOnUse">${gradientStops(0.85, 'var(--wave-highlight)')}</linearGradient>
      <linearGradient id="waveGradHalo-${uid}" x1="0" x2="${totalWidth}" gradientUnits="userSpaceOnUse">${gradientStops(0.6, 'rgb(var(--color-accent-rgb))')}</linearGradient>
    </defs>
    <path class="wave-halo" d="${haloPath}" stroke="url(#waveGradHalo-${uid})"/>
    ${primaryStrandsMarkup}
    ${primarySparklesMarkup}
</svg>`;

    return secondaryMarkup + primaryMarkup;
}

document.querySelectorAll('.panel').forEach(panel => {
    const field = document.createElement('div');
    field.className = 'wave-field';
    field.innerHTML = buildWaveFieldMarkup(panel.id);
    panel.prepend(field);
});

// THEME TOGGLE
// Which icon shows (sun/moon) is handled entirely by CSS off [data-theme]
// or prefers-color-scheme - this only needs to flip the explicit override
// and persist it. theme-init.js (loaded in <head>, before styles.css)
// already applied any saved preference before this script even runs.
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const current = document.documentElement.getAttribute('data-theme') || (prefersDark ? 'dark' : 'light');
        const next = current === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', next);
        themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
        themeToggle.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');

        try {
            localStorage.setItem('theme', next);
        } catch (e) {
            // Storage can throw in private-browsing/locked-down contexts -
            // the toggle still works for the rest of this page view.
        }
    });
}

// CLICK-TO-COPY EMAIL
// Progressive enhancement over the plain mailto: link - if the Clipboard
// API is available, copy the address instead of leaving the page for a
// mail client and show a brief inline confirmation. Falls straight
// through to the normal mailto: navigation on older/unsupported
// browsers, or if the copy itself is rejected (e.g. no user-activation
// in some embedded contexts).
const emailCard = document.getElementById('email-card');
if (emailCard && navigator.clipboard && navigator.clipboard.writeText) {
    let copiedTimeout;
    emailCard.addEventListener('click', (e) => {
        e.preventDefault();
        const email = emailCard.getAttribute('data-email');
        navigator.clipboard.writeText(email).then(() => {
            emailCard.classList.add('copied');
            clearTimeout(copiedTimeout);
            copiedTimeout = setTimeout(() => emailCard.classList.remove('copied'), 1800);
        }).catch(() => {
            window.location.href = `mailto:${email}`;
        });
    });
}

// RESTRICTED REPOSITORY LINK
const restrictedRepoLink = document.getElementById('restricted-repo-link');
if (restrictedRepoLink) {
    restrictedRepoLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Repository access may be restricted');
    });
}

// SINGLE-VIEW PANEL SWITCHING
// The whole site is one fixed-height screen - nav links (and the hero's
// own CTAs) swap which <section class="panel"> is visible instead of
// scrolling to it. Panels slide the whole screen left/right based on
// their order in the nav (forward through Home/About/Projects/Contact
// goes one way, back the other). The URL hash still tracks the active
// panel so links are shareable and back/forward work.
const panels = [...document.querySelectorAll('.panel')];
const navLinks = document.querySelectorAll('.nav-link');
const validPanelIds = new Set(panels.map(p => p.id));
const TRANSITION_CLASSES = ['enter-from-right', 'enter-from-left', 'exit-to-left', 'exit-to-right'];
let pendingFrame = null;

function panelIndex(id) {
    return panels.findIndex(p => p.id === id);
}

function showPanel(id, updateHash = true, animate = true) {
    if (!validPanelIds.has(id)) return;

    const current = panels.find(p => p.classList.contains('active'));
    const next = panels.find(p => p.id === id);
    if (!next) return;

    if (next !== current) {
        if (pendingFrame !== null) {
            cancelAnimationFrame(pendingFrame);
            pendingFrame = null;
        }

        if (current) {
            if (animate) {
                const forward = panelIndex(id) > panelIndex(current.id);
                const exitClass = forward ? 'exit-to-left' : 'exit-to-right';

                // Only touch the two panels actually involved. A blanket
                // cleanup across every panel would also strip the exit
                // class off a *different* panel that's still mid-flight
                // from an earlier, interrupted navigation (e.g. rapidly
                // clicking Home -> About -> Projects: Home is uninvolved
                // in the second hop) - stripping its class mid-transition
                // snaps it straight to the default resting transform
                // instead of letting it finish leaving the side it was
                // already headed for. That default was invisible under
                // the old opacity-driven design (still opacity: 0
                // either way); with panels always opaque now it would
                // show up as a visible jump to the wrong edge. Leaving
                // an uninvolved panel's classes alone lets it settle
                // wherever its own transition was already headed - a
                // harmless, still fully off-screen rest position - and
                // it gets cleaned up normally the next time it's reused.
                next.classList.remove(...TRANSITION_CLASSES);

                // `next` needs an off-screen starting position painted
                // before its transition can run (see below), which takes
                // an extra frame - `current` doesn't have that
                // requirement, so removing its 'active'/adding its exit
                // class here, synchronously, would start it moving a
                // couple of frames before `next` does. That was
                // invisible with the old, subtle nudge, but now that the
                // push spans the full width it read as the two edges
                // losing sync rather than moving as one seam. Deferring
                // both panels' class changes into the same callback
                // below starts them on the exact same frame instead.
                const entryClass = forward ? 'enter-from-right' : 'enter-from-left';
                next.classList.add(entryClass, 'no-transition');
                void next.offsetWidth; // commit the off-screen starting position instantly
                next.classList.remove('no-transition');
                // One requestAnimationFrame only schedules a callback that
                // still runs *before* that frame's paint, so swapping
                // classes there would collapse the off-screen state and
                // the final state into a single paint. The nested rAF
                // waits for the frame *after* the one that painted it.
                pendingFrame = requestAnimationFrame(() => {
                    pendingFrame = requestAnimationFrame(() => {
                        current.classList.remove('active', ...TRANSITION_CLASSES);
                        current.classList.add(exitClass);
                        next.classList.remove(entryClass);
                        next.classList.add('active');
                        pendingFrame = null;
                    });
                });
            } else {
                // Instant path (e.g. loading straight into a non-Home
                // hash, before the user has navigated at all) - both
                // panels' transform is unconditional like above, so
                // swap classes with transitions suppressed rather than
                // letting the push-slide play out on page load.
                current.classList.remove(...TRANSITION_CLASSES);
                next.classList.remove(...TRANSITION_CLASSES);
                current.classList.add('no-transition');
                next.classList.add('no-transition');
                void next.offsetWidth;
                current.classList.remove('active');
                next.classList.add('active');
                void next.offsetWidth;
                current.classList.remove('no-transition');
                next.classList.remove('no-transition');
            }
        } else {
            next.classList.remove(...TRANSITION_CLASSES);
            next.classList.add('active');
        }
    }

    // Runs even when next === current (e.g. the very first showPanel()
    // call, where Home is already marked active in the markup) so the
    // nav links and indicator still sync to match on initial load.
    navLinks.forEach(link => {
        const targetId = link.getAttribute('href').replace('#', '');
        link.classList.toggle('active', targetId === id);
    });
    moveNavIndicatorToActive(!animate);

    if (updateHash && window.location.hash !== `#${id}`) {
        history.pushState(null, '', `#${id}`);
    }
}

// SLIDING NAV INDICATOR (desktop only - .in-menu is hidden below 900px)
// A pill that tracks the active link and glides to whichever link is
// hovered, snapping back to the active one on mouseleave. Reads real
// layout (offsetLeft/offsetWidth) instead of hardcoding per-link
// positions, so it stays correct regardless of label length or font.
const navIndicator = document.querySelector('.nav-indicator');
const inMenu = document.querySelector('.in-menu');
const inMenuLinks = inMenu ? [...inMenu.querySelectorAll('a')] : [];

function moveNavIndicator(link, instant = false) {
    if (!navIndicator || !link) return;
    if (instant) navIndicator.classList.add('no-transition');
    navIndicator.style.width = `${link.offsetWidth}px`;
    navIndicator.style.transform = `translateX(${link.offsetLeft}px)`;
    if (instant) {
        void navIndicator.offsetWidth; // commit instantly before re-enabling the transition
        navIndicator.classList.remove('no-transition');
    }
}

function moveNavIndicatorToActive(instant = false) {
    const active = inMenuLinks.find(link => link.classList.contains('active'));
    if (active) moveNavIndicator(active, instant);
}

inMenuLinks.forEach(link => {
    link.addEventListener('mouseenter', () => moveNavIndicator(link));
});

if (inMenu) {
    inMenu.addEventListener('mouseleave', () => moveNavIndicatorToActive());
}

// The indicator's pixel position only makes sense while .in-menu is
// actually laid out (≥900px) - recomputing on resize keeps it correct
// across that breakpoint and any label-width reflow.
window.addEventListener('resize', () => moveNavIndicatorToActive(true));

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').replace('#', '');
        showPanel(targetId);
    });
});

window.addEventListener('popstate', () => {
    const id = window.location.hash.replace('#', '') || 'home';
    showPanel(id, false);
});

// SWIPE BETWEEN PANELS (touch only)
// Complements the tab bar with the gesture that matches the slide
// transition itself - swipe left to go forward a panel, right to go
// back, same as paging through a deck. Only reacts to a swipe that's
// clearly more horizontal than vertical, so a normal vertical scroll
// inside an overflowing panel is left alone.
const viewEl = document.querySelector('.view');
if (viewEl) {
    let touchStartX = 0;
    let touchStartY = 0;

    viewEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    viewEl.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const SWIPE_THRESHOLD = 60;

        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;

        const current = panels.find(p => p.classList.contains('active'));
        if (!current) return;
        const currentIndex = panelIndex(current.id);
        const targetIndex = currentIndex + (dx < 0 ? 1 : -1);

        if (targetIndex >= 0 && targetIndex < panels.length) {
            showPanel(panels[targetIndex].id);
        }
    }, { passive: true });
}

// LIVE GITHUB PROFILE STATS (public repo count, followers). Pulled from
// the public GitHub Users API - profile-level rather than tied to any
// one repo, so it keeps working regardless of which individual repos
// are public or private. Shown inline in the desktop nav and, since
// there's no nav bar to embed it in there, inline in the Contact
// panel's GitHub row on mobile - both share this one fetch. Fails
// closed: on any error or rate-limit response, each instance hides
// itself instead of showing stale placeholder dashes.
// Eases a stat from 0 up to its real value instead of just popping the
// number in - skipped under reduced-motion, where it just sets the value.
function animateCount(el, target, duration = 800) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !target) {
        el.textContent = target;
        return;
    }
    const start = performance.now();
    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

const githubStatsEls = document.querySelectorAll('.github-stats[data-github-user]');
if (githubStatsEls.length) {
    const username = githubStatsEls[0].getAttribute('data-github-user');
    fetch(`https://api.github.com/users/${username}`, {
        headers: { 'Accept': 'application/vnd.github+json' }
    })
        .then(res => {
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            return res.json();
        })
        .then(data => {
            githubStatsEls.forEach(githubStats => {
                const setStat = (selector, count, noun) => {
                    const el = githubStats.querySelector(selector);
                    if (!el) return;
                    const valueEl = el.querySelector('.gh-stat-value');
                    valueEl.classList.remove('skeleton');
                    animateCount(valueEl, count);
                    el.querySelector('.gh-stat-label').textContent = count === 1 ? ` ${noun}` : ` ${noun}s`;
                };
                setStat('.gh-stat-repos', data.public_repos, 'repo');
                setStat('.gh-stat-followers', data.followers, 'follower');
            });
        })
        .catch(() => {
            githubStatsEls.forEach(githubStats => {
                githubStats.style.display = 'none';
            });
        });
}

// GITHUB ACTIVITY HEATMAP: built from GitHub's own public Events API
// (first-party, same trust level as the profile stats above) rather than a
// third-party rendering service - the tradeoff is that endpoint only
// retains roughly the last 90 days of public events, so this covers ~90
// days, not the full year GitHub's own contribution graph shows, and
// counts public events (pushes, PRs, issues, stars, etc.), not GitHub's
// internal "contributions" definition. Fails closed like the stats above.
const ghHeatmap = document.querySelector('.gh-heatmap[data-github-user]');
if (ghHeatmap) {
    const username = ghHeatmap.getAttribute('data-github-user');

    const msPerDay = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rangeStart = new Date(today.getTime() - 89 * msPerDay);
    const gridStart = new Date(rangeStart);
    gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay()); // back up to Sunday
    const totalDays = Math.round((today - gridStart) / msPerDay) + 1;

    // Shimmer placeholder grid while the fetch is in flight, so the
    // section doesn't sit empty during the request.
    const skeletonFragment = document.createDocumentFragment();
    for (let i = 0; i < totalDays; i++) {
        const cell = document.createElement('span');
        cell.className = 'gh-heat-cell skeleton';
        skeletonFragment.appendChild(cell);
    }
    ghHeatmap.appendChild(skeletonFragment);

    fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, {
        headers: { 'Accept': 'application/vnd.github+json' }
    })
        .then(res => {
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            return res.json();
        })
        .then(events => {
            const counts = {};
            events.forEach(ev => {
                const day = ev.created_at.slice(0, 10); // YYYY-MM-DD, UTC
                counts[day] = (counts[day] || 0) + 1;
            });

            const fragment = document.createDocumentFragment();

            for (let i = 0; i < totalDays; i++) {
                const d = new Date(gridStart.getTime() + i * msPerDay);
                const key = d.toISOString().slice(0, 10);
                const count = counts[key] || 0;
                let level = 0;
                if (count >= 5) level = 4;
                else if (count >= 3) level = 3;
                else if (count >= 2) level = 2;
                else if (count >= 1) level = 1;

                const cell = document.createElement('span');
                cell.className = 'gh-heat-cell cell-in';
                cell.setAttribute('data-level', level);
                cell.title = `${key}: ${count} event${count === 1 ? '' : 's'}`;
                // Capped so the tail of a ~90-cell grid doesn't drag the
                // reveal out - past the cap cells just animate together.
                cell.style.animationDelay = `${Math.min(i * 6, 400)}ms`;
                fragment.appendChild(cell);
            }

            ghHeatmap.innerHTML = '';
            ghHeatmap.appendChild(fragment);
        })
        .catch(() => {
            const wrapper = ghHeatmap.closest('.github-activity');
            if (wrapper) wrapper.style.display = 'none';
        });
}

// INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
    const initialId = window.location.hash.replace('#', '') || 'home';
    showPanel(initialId, false, false);

    // Home's .reveal children start hidden via .init-pending (see
    // styles.css) even though the panel itself is marked active in the
    // raw HTML - this unhides them so the same entrance plays on the
    // actual first page load instead of skipping straight to visible.
    // The double rAF guarantees that hidden state has already painted
    // once before removing the class, same reasoning as the panel
    // push's off-screen snap above.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.querySelectorAll('.reveal.init-pending').forEach(el => el.classList.remove('init-pending'));
        });
    });

    if (themeToggle) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = document.documentElement.getAttribute('data-theme')
            ? document.documentElement.getAttribute('data-theme') === 'dark'
            : prefersDark;
        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
});
