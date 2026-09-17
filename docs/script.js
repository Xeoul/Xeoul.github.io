// HAMBURGER MENU FUNCTIONALITY
const menu_btn = document.querySelector('.hamburger');
const hamburg_menu = document.querySelector('.in-menu');
const menu_backdrop = document.querySelector('.menu-backdrop');

function closeMenu() {
    menu_btn.classList.remove('is-active');
    hamburg_menu.classList.remove('is-active');
    menu_backdrop.classList.remove('is-active');
}

// Toggle menu when hamburger is clicked
menu_btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu_btn.classList.toggle('is-active');
    hamburg_menu.classList.toggle('is-active');
    menu_backdrop.classList.toggle('is-active');
});

// Close menu when clicking outside of it (including the backdrop)
document.addEventListener('click', (e) => {
    if (!menu_btn.contains(e.target) && !hamburg_menu.contains(e.target)) {
        closeMenu();
    }
});

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
    if (!next || next === current) return;

    if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
    }

    panels.forEach(p => p.classList.remove(...TRANSITION_CLASSES));

    if (current) {
        current.classList.remove('active');

        if (animate) {
            const forward = panelIndex(id) > panelIndex(current.id);
            current.classList.add(forward ? 'exit-to-left' : 'exit-to-right');

            // .panel's own transition is unconditional, so just adding
            // the entry class would itself animate out to the +/-64px
            // starting point instead of snapping there - 'no-transition'
            // forces that first move to happen instantly. The entry
            // position also needs its own painted frame before we switch
            // to the final position - one requestAnimationFrame only
            // schedules a callback that still runs *before* that frame's
            // paint, so swapping classes there collapses the off-screen
            // state and the final state into a single paint. The nested
            // rAF waits for the frame *after* the one that painted it.
            const entryClass = forward ? 'enter-from-right' : 'enter-from-left';
            next.classList.add(entryClass, 'no-transition');
            void next.offsetWidth; // commit the off-screen starting position instantly
            next.classList.remove('no-transition');
            pendingFrame = requestAnimationFrame(() => {
                pendingFrame = requestAnimationFrame(() => {
                    next.classList.remove(entryClass);
                    next.classList.add('active');
                    pendingFrame = null;
                });
            });
        } else {
            next.classList.add('active');
        }
    } else {
        next.classList.add('active');
    }

    navLinks.forEach(link => {
        const targetId = link.getAttribute('href').replace('#', '');
        link.classList.toggle('active', targetId === id);
    });

    if (updateHash && window.location.hash !== `#${id}`) {
        history.pushState(null, '', `#${id}`);
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').replace('#', '');
        showPanel(targetId);
        closeMenu();
    });
});

window.addEventListener('popstate', () => {
    const id = window.location.hash.replace('#', '') || 'home';
    showPanel(id, false);
});

// ANIMATED STAT COUNTERS (2025 / 3+ / 2, counting up from 0)
function animateStatCounters() {
    document.querySelectorAll('.stat-number[data-count]').forEach(el => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1000;
        const startTime = performance.now();

        function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        }
        requestAnimationFrame(tick);
    });
}

// LIVE GITHUB PROFILE STATS (public repo count, followers), embedded
// directly in the nav menu. Pulled from the public GitHub Users API -
// profile-level rather than tied to any one repo, so it keeps working
// regardless of which individual repos are public or private. Fails
// closed: on any error or rate-limit response, the row hides itself
// instead of showing stale placeholder dashes.
const githubStats = document.querySelector('.github-stats[data-github-user]');
if (githubStats) {
    const username = githubStats.getAttribute('data-github-user');
    fetch(`https://api.github.com/users/${username}`, {
        headers: { 'Accept': 'application/vnd.github+json' }
    })
        .then(res => {
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            return res.json();
        })
        .then(data => {
            const setStat = (selector, count, noun) => {
                const el = githubStats.querySelector(selector);
                if (!el) return;
                const valueEl = el.querySelector('.gh-stat-value');
                valueEl.textContent = count;
                valueEl.classList.remove('skeleton');
                el.querySelector('.gh-stat-label').textContent = count === 1 ? ` ${noun}` : ` ${noun}s`;
            };
            setStat('.gh-stat-repos', data.public_repos, 'repo');
            setStat('.gh-stat-followers', data.followers, 'follower');
        })
        .catch(() => {
            githubStats.style.display = 'none';
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
                cell.className = 'gh-heat-cell';
                cell.setAttribute('data-level', level);
                cell.title = `${key}: ${count} event${count === 1 ? '' : 's'}`;
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
    animateStatCounters();
});
