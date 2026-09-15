// HAMBURGER MENU FUNCTIONALITY
const menu_btn = document.querySelector('.hamburger');
const hamburg_menu = document.querySelector('.in-menu');
const menu_backdrop = document.querySelector('.menu-backdrop');
const menu_items = document.querySelectorAll('.in-menu a');

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

// Close menu when a nav link is clicked
menu_items.forEach(item => {
    item.addEventListener('click', closeMenu);
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

// SCROLL-DRIVEN SECTION REVEALS
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

const scrollSections = document.querySelectorAll('.scroll-section');
scrollSections.forEach(section => {
    observer.observe(section);
});

// SMOOTH SCROLLING FOR NAVIGATION LINKS
const navLinks = document.querySelectorAll('.nav-link');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);

        if (targetSection) {
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// SCROLL INDICATOR PULSE ANIMATION
const scrollIndicator = document.querySelector('.scroll-indicator');
if (scrollIndicator) {
    setInterval(() => {
        const arrow = scrollIndicator.querySelector('.scroll-arrow');
        if (arrow) {
            arrow.style.transform = 'translateY(5px)';
            setTimeout(() => {
                arrow.style.transform = 'translateY(0)';
            }, 500);
        }
    }, 2000);
}

// SCROLL INDICATOR VISIBILITY + PROGRESS BAR
// The header itself no longer needs a scroll-driven background mutation -
// it's a permanently frosted/blurred bar in CSS now (like Apple's own nav),
// so there's nothing to compute here beyond the indicator and the bar.
const scrollProgress = document.querySelector('.scroll-progress');

let ticking = false;
function onScroll() {
    const scrolled = window.pageYOffset;

    if (scrollIndicator) {
        if (scrolled > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.transform = 'translateY(20px)';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.transform = 'translateY(0)';
        }
    }

    if (scrollProgress) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrolled / docHeight) * 100 : 0;
        scrollProgress.style.width = `${Math.min(progress, 100)}%`;
    }

    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
    }
}, { passive: true });

// SKILL/TECH TAG REVEAL
// Toggles a .revealed class rather than writing inline styles - an inline
// style beats any CSS selector regardless of specificity, so setting
// element.style.transform here would permanently block the
// .skill-tag:hover/.tech-tag:hover CSS rules from ever taking visual
// effect after the tag's first reveal.
const skillTags = document.querySelectorAll('.skill-tag, .tech-tag');
const tagObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('revealed');
            }, index * 50); // Quick stagger
        }
    });
}, { threshold: 0.5 });

skillTags.forEach(tag => tagObserver.observe(tag));

// SCROLL-SPY NAV HIGHLIGHTING
// Highlights whichever section is currently near the vertical center of
// the viewport. Scoped to `.in-menu a` only - `.nav-link` is also used by
// the hero CTA buttons, which shouldn't get the "active" treatment.
const spySections = document.querySelectorAll('section[id]');
const spyLinks = document.querySelectorAll('.in-menu a[href^="#"]');

if (spySections.length && spyLinks.length) {
    const spyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                spyLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    spySections.forEach(section => spyObserver.observe(section));
}

// ANIMATED STAT COUNTERS (2025 / 3+ / 2, counting up from 0)
function animateStatCounters() {
    document.querySelectorAll('.stat-number[data-count]').forEach(el => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1200;
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

// LIVE GITHUB PROFILE STATS (public repo count, followers) on the GitHub
// contact card. Pulled from the public GitHub Users API - profile-level
// rather than tied to any one repo, so it keeps working regardless of
// which individual repos are public or private. Fails closed: on any
// error or rate-limit response, the row hides itself instead of showing
// stale placeholder dashes.
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
                el.querySelector('.gh-stat-label').textContent = count === 1 ? noun : `${noun}s`;
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

// CONTACT FORM: builds a mailto: link client-side and hands off to the
// visitor's own email app. No third-party form service, no API key, and
// nothing is transmitted from this page - matches the static-site CSP.
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('cf-name').value.trim();
        const email = document.getElementById('cf-email').value.trim();
        const message = document.getElementById('cf-message').value.trim();
        const subject = `Portfolio contact from ${name}`;
        const body = `${message}\n\n— ${name} (${email})`;
        window.location.href = `mailto:v812.io@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
}

// INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
    // Add visible class to home section immediately
    const homeSection = document.querySelector('#home');
    if (homeSection) {
        setTimeout(() => {
            homeSection.classList.add('visible');
        }, 100);
    }

    animateStatCounters();

    // Smooth scroll to top on page refresh
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});
