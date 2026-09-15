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

// APPLE-STYLE SCROLL ANIMATIONS
// Intersection Observer for scroll animations
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

// Observe all scroll sections
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

// COMBINED SCROLL EFFECTS: parallax, scroll indicator visibility, header opacity, progress bar
const header = document.querySelector('header');
const parallaxElements = document.querySelectorAll('.scroll-section');
const scrollProgress = document.querySelector('.scroll-progress');

let ticking = false;
function onScroll() {
    const scrolled = window.pageYOffset;

    parallaxElements.forEach((element, index) => {
        if (element.classList.contains('visible')) {
            const rate = scrolled * -0.5;
            const yPos = -(rate / (index + 1));
            element.style.transform = `translate3d(0, ${yPos * 0.1}px, 0)`;
        }
    });

    if (scrollIndicator) {
        if (scrolled > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.transform = 'translateY(20px)';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.transform = 'translateY(0)';
        }
    }

    const opacity = Math.min(scrolled / 100, 0.95);
    header.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;

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

// SKILL TAGS ANIMATION
// Toggles a .revealed class rather than writing inline styles - an inline
// style beats any CSS selector regardless of specificity, so setting
// element.style.transform here would have permanently blocked the
// .skill-tag:hover/.tech-tag:hover CSS rules from ever taking visual
// effect after the tag's first reveal. (The project-card entrance
// animation had this same bug via its own inline-style observer; that one
// is removed outright since .scroll-section.visible .project-card:nth-child(n)
// in styles.css already handles the identical reveal via CSS alone.)
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

// ANIMATED STAT COUNTERS (2025 / 3+ / 3, counting up from 0)
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

// TYPEWRITER-STYLE REVEAL FOR THE HERO CODE WINDOW
// Reveals each line in sequence with a briefly-blinking cursor, rather than
// animating individual characters - keeps the existing syntax-highlight
// spans intact instead of having to type through nested HTML.
function typeCodeLines() {
    const lines = document.querySelectorAll('.code-window .code-line');
    lines.forEach((line, index) => {
        setTimeout(() => {
            line.classList.add('visible', 'typing');
            setTimeout(() => line.classList.remove('typing'), 350);
        }, index * 220);
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

// FINE-POINTER-ONLY INTERACTIONS: cursor glow, 3D tilt, custom cursor,
// magnetic buttons. Gated on the same media feature the CSS checks, so
// touch devices never attach listeners for effects they can't usefully
// show (no hover state to track).
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {

    // CURSOR-REACTIVE GLOW (project + contact cards)
    // Only ever sets custom properties, never transform/opacity directly -
    // see the .project-card::before comment in styles.css for why that
    // distinction matters (an inline style beats :hover regardless of
    // specificity).
    document.querySelectorAll('.project-card, .contact-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
            card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
        });
    });

    // 3D TILT (project cards only - the larger "hero" cards where it reads
    // well; applying it to every small contact card would be overkill)
    document.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width - 0.5;
            const py = (e.clientY - rect.top) / rect.height - 0.5;
            const maxTilt = 6; // degrees
            card.style.setProperty('--tiltY', `${px * maxTilt * 2}deg`);
            card.style.setProperty('--tiltX', `${-py * maxTilt * 2}deg`);
        });
        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--tiltX', '0deg');
            card.style.setProperty('--tiltY', '0deg');
        });
    });

    // MAGNETIC BUTTON PULL (hero CTAs + project buttons)
    document.querySelectorAll('.cta-primary, .cta-secondary, .project-btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const relX = e.clientX - rect.left - rect.width / 2;
            const relY = e.clientY - rect.top - rect.height / 2;
            const pull = 0.25;
            const maxOffset = 10;
            const mx = Math.max(-maxOffset, Math.min(maxOffset, relX * pull));
            const my = Math.max(-maxOffset, Math.min(maxOffset, relY * pull));
            btn.style.setProperty('--mx', `${mx}px`);
            btn.style.setProperty('--my', `${my}px`);
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.setProperty('--mx', '0px');
            btn.style.setProperty('--my', '0px');
        });
    });

    // CUSTOM CURSOR: a dot that tracks the pointer exactly, and a ring that
    // trails behind it with a little easing, expanding over interactive
    // elements. Built and attached only here, so a device that doesn't
    // match the media query above never gets `cursor: none` with nothing
    // to replace it.
    document.documentElement.classList.add('custom-cursor-active');

    const cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    const cursorRing = document.createElement('div');
    cursorRing.className = 'cursor-ring';
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    });

    function animateCursorRing() {
        ringX += (mouseX - ringX) * 0.2;
        ringY += (mouseY - ringY) * 0.2;
        cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        requestAnimationFrame(animateCursorRing);
    }
    requestAnimationFrame(animateCursorRing);

    const cursorHoverTargets = 'a, button, input, textarea, .project-card, .contact-card, .skill-tag, .tech-tag';
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(cursorHoverTargets)) {
            cursorRing.classList.add('cursor-hover');
        }
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(cursorHoverTargets)) {
            cursorRing.classList.remove('cursor-hover');
        }
    });

    // Keep the cursor hidden until the real position is known, so it
    // doesn't flash at a stale (0,0) or center coordinate on load.
    cursorDot.style.opacity = '0';
    cursorRing.style.opacity = '0';
    document.addEventListener('mousemove', function revealCursor() {
        cursorDot.style.opacity = '1';
        cursorRing.style.opacity = '1';
        document.removeEventListener('mousemove', revealCursor);
    }, { once: true });
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
    typeCodeLines();

    // Smooth scroll to top on page refresh
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});
