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

// AMBIENT WAVE
// Draws the thin wave of lit dots in each panel's background (see
// AMBIENT DRIFT in styles.css) onto a canvas over the dim dot grid.
// Every dot in the grid near the wave is drawn at a brightness that
// falls off smoothly with its distance from the wave's centre line, so
// dots fade in and out as the wave passes instead of snapping on/off.
// Redrawn every frame so the wave can travel sideways while slowly
// morphing between shapes.
// A single sine reads as a perfect, mechanical sin/cos curve. Summing
// in two smaller harmonics - each at its own frequency and drifting
// at its own rate relative to the fundamental - makes neighbouring
// crests rise and fall by different amounts instead of repeating
// identically, closer to how a real wave looks. Weights sum to 1 so
// the combined wobble still stays within a shape's own amp/thick.
const WAVE_HARMONICS = [
    { weight: 0.62, freq: 1,   phaseRate: 1,   offset: 0 },
    { weight: 0.25, freq: 1.9, phaseRate: 1.4, offset: 1.7 },
    { weight: 0.13, freq: 3.1, phaseRate: 0.6, offset: 4.1 },
];
const WAVE_MORPH_SECONDS = 6; // per shape-to-shape blend
const WAVE_DRIFT_SECONDS = 30; // top-to-bottom-and-back, where --wave-y-top is set
const WAVE_SPEED = 140;       // px/s, leftward - the brisk pace from the old load-in flourish, now the default on both desktop and mobile
const WAVE_FRAME_MS = 33;     // ~30fps is plenty for motion this slow
const WAVE_GRID = 26;         // must match the dot grid's background-size
const WAVE_DOT_RADIUS = 1.2;  // and its dot size
const WAVE_PEAK_ALPHA = 0.85;
// The dim dot grid drifts vertically at this slice of the wave's own
// speed (see --grid-shift below), so it reads as the same current the
// wave rides on rather than a separate animation that merely happens
// to agree, even though the wave itself travels sideways.
const GRID_DRIFT_RATIO = 0.1;
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

// Shapes used to cycle through a fixed list of three, which - combined
// with the harmonics' own fixed phase rates above - eventually lines
// back up into an exact repeat: on a long enough visit the wave (and
// the panels that had been sitting off-screen advancing unseen, see
// waveFrame) would visibly snap back to an earlier moment, like a
// video looping. Picking a fresh random target every WAVE_MORPH_SECONDS
// instead - blended in with the same smoothstep curve a fixed list
// would have used - keeps the period/height/thickness (and with them
// whether the wave leans taller or flatter) continuously drifting
// instead of ever settling into a cycle, while staying just as smooth:
// each new target starts from exactly where the last blend ended, so
// there's no jump at the switch.
function randomWaveShape() {
    return {
        period: 900 + Math.random() * 400,
        amp: 40 + Math.random() * 25,
        thick: 55 + Math.random() * 40,
    };
}

let wavePhase = 0;
let waveShapeFrom = randomWaveShape();
let waveShapeTo = randomWaveShape();
let waveMorphT = 0;
let waveDrift = 0;
let gridShift = 0;
let waveRaf = null;
const waveGeometry = new Map();

function currentWaveShape() {
    const t = waveMorphT * waveMorphT * (3 - 2 * waveMorphT);
    return {
        period: waveShapeFrom.period + (waveShapeTo.period - waveShapeFrom.period) * t,
        amp: waveShapeFrom.amp + (waveShapeTo.amp - waveShapeFrom.amp) * t,
        thick: waveShapeFrom.thick + (waveShapeTo.thick - waveShapeFrom.thick) * t,
    };
}

function panelWaveCanvas(panel) {
    let canvas = panel.querySelector(':scope > .wave-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'wave-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        panel.prepend(canvas);
    }
    return canvas;
}

// Each panel's size and where its dots are visible (--wave-y/--wave-scale,
// set in styles.css alongside that panel's --safe-mask) only change on
// resize, so they're cached - and the canvas resized - rather than
// re-read every frame.
function panelWaveGeometry(panel) {
    let g = waveGeometry.get(panel);
    if (!g) {
        const style = getComputedStyle(panel);
        const canvas = panelWaveCanvas(panel);
        const dpr = window.devicePixelRatio || 1;
        g = {
            ctx: canvas.getContext('2d'),
            dpr,
            width: panel.clientWidth,
            height: panel.clientHeight,
            y: parseFloat(style.getPropertyValue('--wave-y')) || 0.9,
            yTop: parseFloat(style.getPropertyValue('--wave-y-top')),
            scale: parseFloat(style.getPropertyValue('--wave-scale')) || 1,
            glow: parseFloat(style.getPropertyValue('--wave-glow')) || 0,
        };
        canvas.width = Math.round(g.width * dpr);
        canvas.height = Math.round(g.height * dpr);
        waveGeometry.set(panel, g);
    }
    return g;
}

// Each lit dot's brightness is a gaussian of its vertical distance from
// the wave's centre line, with the shape's thickness setting its spread.
// Measuring the sine from 60% across rather than from x=0 keeps the
// visible middle of the wave steady while the period morphs - otherwise
// the right-hand side would visibly compress and stretch.
// Where the panel sets --wave-y-top (mobile), the centre line also
// glides between that and --wave-y on a cosine, so it eases in and out
// at each end and lingers where the dots are fully visible; it starts
// at --wave-y, so a still frame (reduced motion) sits there.
// Where the panel sets --wave-glow (an opacity), a soft accent haze is
// drawn under the dots along the same centre line, so it rises, falls
// and travels with the wave instead of sitting still behind it. It's
// painted as narrow vertical strips, each a gradient peaking at that
// column's centre line; at GLOW_STEP px wide, neighbouring strips differ
// too little to show a seam.
const GLOW_STEP = 8;

// Where a panel currently sits relative to the view - 0 once it's
// settled, but mid-slide it's partway off one side (see showPanel).
function panelOffsetX(panel) {
    return panel.getBoundingClientRect().left - viewEl.getBoundingClientRect().left;
}

// The accent colour only changes with the theme, so it's read from
// computed style once and cached (see resetWaveColours) instead of on
// every draw. The glow is likewise pre-rendered once per colour as a
// single 1px-wide column of its vertical gradient, which each strip
// then stretches into place - one drawImage per strip rather than
// building a fresh gradient object for every strip of every frame.
const GLOW_SPRITE_HEIGHT = 512;
let accentRgb = null;
const glowSprites = new Map();

function waveAccent() {
    if (accentRgb === null) {
        accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-rgb').trim();
    }
    return accentRgb;
}

function glowSprite(rgb, glow) {
    const key = `${rgb}|${glow}`;
    let sprite = glowSprites.get(key);
    if (!sprite) {
        sprite = document.createElement('canvas');
        sprite.width = 1;
        sprite.height = GLOW_SPRITE_HEIGHT;
        const sctx = sprite.getContext('2d');
        const grad = sctx.createLinearGradient(0, 0, 0, GLOW_SPRITE_HEIGHT);
        grad.addColorStop(0, `rgba(${rgb}, 0)`);
        grad.addColorStop(0.25, `rgba(${rgb}, ${glow * 0.35})`);
        grad.addColorStop(0.5, `rgba(${rgb}, ${glow})`);
        grad.addColorStop(0.75, `rgba(${rgb}, ${glow * 0.35})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 1, GLOW_SPRITE_HEIGHT);
        glowSprites.set(key, sprite);
    }
    return sprite;
}

function drawWave(panel, offsetX = panelOffsetX(panel)) {
    const { ctx, dpr, width, height, y, yTop, scale, glow } = panelWaveGeometry(panel);
    // The wave is laid out in view coordinates rather than the panel's
    // own (offsetX), so while two panels slide past each other their
    // waves meet at the seam as one continuous line instead of each
    // carrying its own copy along - which showed as a visible break
    // between them.
    const shape = currentWaveShape();
    const centreY = Number.isNaN(yTop) ? y : y + (yTop - y) * (1 - Math.cos(2 * Math.PI * waveDrift)) / 2;
    const mid = height * centreY;
    const amp = shape.amp * scale;
    const sigma = (shape.thick * scale) * 0.4;
    const reach = sigma * 3;
    const center = width * 0.6;
    const rgb = waveAccent();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `rgb(${rgb})`;
    const half = WAVE_GRID / 2;
    // The dim CSS grid's rows are shifted by --grid-shift (see AMBIENT
    // DRIFT in styles.css), so the lit dots drawn here need the same
    // row offset each frame or they drift out of register with it,
    // producing a moiré between the two layers instead of one grid.
    const rowPhase = ((half + gridShift) % WAVE_GRID + WAVE_GRID) % WAVE_GRID;
    const centreAt = (x) => {
        const theta = (2 * Math.PI * (x + offsetX - center)) / shape.period;
        let wobble = 0;
        for (const h of WAVE_HARMONICS) {
            wobble += h.weight * Math.sin(theta * h.freq + wavePhase * h.phaseRate + h.offset);
        }
        return mid + amp * wobble;
    };

    if (glow > 0) {
        const radius = reach * 2.5 + 40;
        const sprite = glowSprite(rgb, glow);
        for (let x = 0; x < width; x += GLOW_STEP) {
            const c = centreAt(x + GLOW_STEP / 2);
            ctx.drawImage(sprite, x, c - radius, GLOW_STEP, radius * 2);
        }
    }

    for (let x = half; x < width; x += WAVE_GRID) {
        const c = centreAt(x);
        const firstRow = Math.max(0, Math.ceil((c - reach - rowPhase) / WAVE_GRID));
        for (let dotY = firstRow * WAVE_GRID + rowPhase; dotY <= c + reach && dotY < height; dotY += WAVE_GRID) {
            const d = (dotY - c) / sigma;
            ctx.globalAlpha = WAVE_PEAK_ALPHA * Math.exp(-0.5 * d * d);
            ctx.beginPath();
            ctx.arc(x, dotY, WAVE_DOT_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    // Set on the panel itself, alongside its canvas, rather than once on
    // the root: a custom property changed on <html> restyles the whole
    // page every frame, where here it only touches the panels actually
    // on screen - and keeps the dim grid's rows in step with the rowPhase
    // the lit dots above were just drawn at.
    panel.style.setProperty('--grid-shift', `${gridShift}px`);
}

function drawAllWaves() {
    panels.forEach((panel) => drawWave(panel));
}

// Drops the cached accent colour and glow (see waveAccent) after a theme
// change and redraws straight away, so still panels (and reduced
// motion) pick up the new colour too.
function resetWaveColours() {
    accentRgb = null;
    glowSprites.clear();
    drawAllWaves();
}

let waveLastTime = null;
let waveLastDraw = -Infinity;
let waveLastOffsets = [];

// Only panels at least partly on screen are redrawn each tick - each
// one is a full-screen canvas, so redrawing (and re-uploading) the
// three sitting off-screen cost several times the work of the one
// actually visible. The shared clock below still advances every tick
// regardless, and a panel is drawn on the very frame it starts sliding
// back into view, so it never shows a stale frame from when it was
// last visible - which is what once made a panel returning after a
// while jump to wherever the wave had since moved.
function waveFrame(now) {
    if (waveLastTime !== null) {
        const dt = Math.min((now - waveLastTime) / 1000, 0.1);
        // Not wrapped mod 2*PI: wavePhase feeds three harmonics at
        // different phaseRate multiples (see drawWave), and wrapping
        // it by exactly 2*PI only leaves the freq:1 term unchanged -
        // the others land at a different point in their own cycle
        // each time, a real jump in the rendered wave every time this
        // wrapped around (every few seconds at the current speed).
        // Left to grow, a double still carries ample precision for
        // any realistic session length.
        wavePhase += (2 * Math.PI * WAVE_SPEED * dt) / currentWaveShape().period;
        waveMorphT += dt / WAVE_MORPH_SECONDS;
        if (waveMorphT >= 1) {
            waveMorphT = 0;
            waveShapeFrom = waveShapeTo;
            waveShapeTo = randomWaveShape();
        }
        waveDrift = (waveDrift + dt / WAVE_DRIFT_SECONDS) % 1;
        gridShift = (gridShift - WAVE_SPEED * GRID_DRIFT_RATIO * dt) % WAVE_GRID;
    }
    waveLastTime = now;
    // Every position is read up front, before drawWave writes any
    // style, so reading them never forces an extra style/layout pass.
    const offsets = panels.map(panelOffsetX);
    // Mid-slide, redraw every frame rather than at the usual reduced
    // rate: the wave is positioned from where each panel sat when it
    // was drawn, so a stale frame would leave the two halves out of
    // line at the seam for as long as it stayed on screen.
    const sliding = offsets.some((offset, i) => offset !== waveLastOffsets[i]);
    if (sliding || now - waveLastDraw >= WAVE_FRAME_MS) {
        panels.forEach((panel, i) => {
            if (Math.abs(offsets[i]) < panelWaveGeometry(panel).width) drawWave(panel, offsets[i]);
        });
        waveLastOffsets = offsets;
        waveLastDraw = now;
    }
    waveRaf = requestAnimationFrame(waveFrame);
}

function syncWaveMotion() {
    drawAllWaves();
    if (reducedMotionQuery.matches) {
        cancelAnimationFrame(waveRaf);
        waveRaf = null;
    } else if (waveRaf === null) {
        waveLastTime = null;
        waveRaf = requestAnimationFrame(waveFrame);
    }
}

window.addEventListener('resize', () => {
    waveGeometry.clear();
    drawAllWaves();
});
reducedMotionQuery.addEventListener('change', syncWaveMotion);
// The dots take the accent colour, which changes with the theme.
new MutationObserver(resetWaveColours)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', resetWaveColours);
syncWaveMotion();

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

// Both GitHub requests below go through here. Unauthenticated calls to
// the API are capped at 60 an hour per visitor, and every page load used
// to spend two - a few reloads or tab revisits could run a visitor out,
// after which both sections hide themselves (see the .catch()es). So the
// part of each response actually used is kept for a few minutes: only
// that summary is stored, not the raw response (the events list alone
// runs to hundreds of KB), and a cached result also skips the loading
// shimmer. Storage can throw in private-browsing/locked-down contexts,
// in which case this just falls back to fetching every time.
const GITHUB_CACHE_MS = 10 * 60 * 1000;

function fetchGitHub(path, summarize) {
    const key = `github:${path}`;
    try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (cached && Date.now() - cached.time < GITHUB_CACHE_MS) {
            return Promise.resolve(cached.data);
        }
    } catch (e) {
        // Fall through to a fresh fetch.
    }
    return fetch(`https://api.github.com${path}`, {
        headers: { 'Accept': 'application/vnd.github+json' }
    })
        .then(res => {
            if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
            return res.json();
        })
        .then(json => {
            const data = summarize(json);
            try {
                localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
            } catch (e) {
                // Not cached this time - still shown.
            }
            return data;
        });
}

const githubStatsEls = document.querySelectorAll('.github-stats[data-github-user]');
if (githubStatsEls.length) {
    const username = githubStatsEls[0].getAttribute('data-github-user');
    fetchGitHub(`/users/${username}`, ({ public_repos, followers }) => ({ public_repos, followers }))
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

    fetchGitHub(`/users/${username}/events/public?per_page=100`, events => {
        const counts = {};
        events.forEach(ev => {
            const day = ev.created_at.slice(0, 10); // YYYY-MM-DD, UTC
            counts[day] = (counts[day] || 0) + 1;
        });
        return counts;
    })
        .then(counts => {
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
