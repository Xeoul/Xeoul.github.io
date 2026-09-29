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

// Tab title per panel, so history entries and the tab itself say
// where you are. Home keeps the page's original <title>.
const PANEL_TITLES = {
    home: document.title,
    about: 'About - Vincent Lam',
    projects: 'Projects - Vincent Lam',
    contact: 'Contact - Vincent Lam',
};

function focusPanelHeading(panel) {
    const heading = panel.querySelector('.hero-title, .section-title');
    if (heading) heading.focus({ preventScroll: true });
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
        // Only the real nav entries claim to be "the current page" to
        // screen readers - not the logo or the hero's CTA buttons.
        if (link.closest('.in-menu, .tab-bar')) {
            if (targetId === id) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        }
    });
    moveNavIndicatorToActive(!animate);

    // Off-screen panels are only slid aside, not removed, so without
    // this Tab would walk into links you can't see and screen readers
    // would read all four panels as one page.
    panels.forEach(panel => { panel.inert = panel !== next; });

    if (PANEL_TITLES[id]) document.title = PANEL_TITLES[id];

    // After a real navigation (not the initial load), move focus to the
    // new panel's heading, so keyboard and screen-reader users land at
    // its start - and hear which panel they're on - rather than being
    // left on a link in the panel that just slid away.
    if (animate && next !== current) focusPanelHeading(next);

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
        const targetId = link.getAttribute('href').replace('#', '');
        // Links to a panel that isn't on this page (404.html's nav
        // points back at /#about etc.) are left to navigate normally.
        if (!validPanelIds.has(targetId)) return;
        e.preventDefault();
        showPanel(targetId);
    });
});

// Moves one panel forward (+1) or back (-1) from the active one, if
// there is one that way - shared by swipe and the arrow keys below.
function stepPanel(delta) {
    const current = panels.find(p => p.classList.contains('active'));
    if (!current) return;
    const target = panels[panelIndex(current.id) + delta];
    if (target) showPanel(target.id);
}

// KEYBOARD NAVIGATION
// Left/right arrows page through the panels in the same direction the
// slide moves, and 1-4 jump straight to one - the keyboard equivalent
// of swiping or the tab bar. Ignored while typing in a field or with a
// modifier held, so browser/OS shortcuts (e.g. Alt+Left for back) and
// any future form input keep their normal behaviour.
// True while the command menu (or any other modal) is up, so keys meant
// for it don't also page the panels behind it.
function modalOpen() {
    return document.querySelector('dialog[open]') !== null;
}

document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || modalOpen()) return;
    const target = e.target;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPanel(e.key === 'ArrowRight' ? 1 : -1);
    } else if (/^[1-9]$/.test(e.key)) {
        const panel = panels[Number(e.key) - 1];
        if (!panel) return;
        e.preventDefault();
        if (!panel.classList.contains('active')) showPanel(panel.id);
    }
});

window.addEventListener('popstate', () => showFromHash(true));

// The view only ever shows one panel, positioned by transform, so it
// should never be scrolled. Following a #panel link the site doesn't
// handle itself (e.g. editing the address bar) makes the browser scroll
// that off-screen panel into view, shifting every panel sideways -
// styles.css prevents that with overflow: clip; this undoes it in
// browsers without clip support.
const viewForScroll = document.querySelector('.view');
if (viewForScroll) {
    viewForScroll.addEventListener('scroll', () => {
        if (viewForScroll.scrollLeft || viewForScroll.scrollTop) viewForScroll.scrollTo(0, 0);
    });
}

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

        stepPanel(dx < 0 ? 1 : -1);
    }, { passive: true });
}

// SKIP LINK
// Jumps keyboard users past the header straight to the visible panel's
// heading. Without the script it's a plain #main anchor, which also works.
const skipLink = document.querySelector('.skip-link');
if (skipLink) {
    skipLink.addEventListener('click', (e) => {
        const active = panels.find(p => p.classList.contains('active'));
        if (!active) return;
        e.preventDefault();
        focusPanelHeading(active);
    });
}

// TOAST
// A brief confirmation at the bottom of the screen, announced to screen
// readers through its role="status" live region.
const toastEl = document.querySelector('.toast');
let toastTimeout;

function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('visible'), 2200);
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
const GRID_DRIFT_RATIO = 0.06; // ~8px/s at WAVE_SPEED - 0.1 (14px/s) read as too quick
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
// The easter egg's temporary surge (see EASTER EGG below): scales the
// wave's height and speed, easing up from 1 and back down to 1 over
// WAVE_BOOST_SECONDS so it starts and ends without a jump.
const WAVE_BOOST_SECONDS = 6;
const WAVE_BOOST_PEAK = 1.6;
let waveBoostStart = null;
let waveBoost = 1;
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
        // Fired when the browser gives a canvas back after dropping it
        // (see RECOVERING THE CANVASES).
        canvas.addEventListener('contextrestored', rebuildWaveCanvases);
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
    const amp = shape.amp * scale * waveBoost;
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

// Redraws straight away rather than on the next tick - but only the
// panels on screen: off-screen ones are drawn by waveFrame the moment
// they start sliding in, so drawing them here too (as page load, resize
// and theme changes all used to) was just extra startup work. Under
// reduced motion every panel stays in place and only fades, so they all
// count as on screen and are all drawn.
function drawAllWaves() {
    panels.forEach((panel) => {
        const offsetX = panelOffsetX(panel);
        if (Math.abs(offsetX) < panelWaveGeometry(panel).width) drawWave(panel, offsetX);
    });
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
        if (waveBoostStart !== null) {
            const t = (now - waveBoostStart) / 1000 / WAVE_BOOST_SECONDS;
            waveBoost = t >= 1 ? 1 : 1 + WAVE_BOOST_PEAK * Math.sin(Math.PI * Math.max(t, 0));
            if (t >= 1) waveBoostStart = null;
        }
        wavePhase += (2 * Math.PI * WAVE_SPEED * waveBoost * dt) / currentWaveShape().period;
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

// RECOVERING THE CANVASES
// Browsers can throw away a canvas's pixels while the page is out of
// sight - a background tab, a locked phone, a sleeping computer, or the
// graphics driver restarting - and don't always show what's drawn on it
// afterwards until something else repaints that part of the screen.
// Left open long enough, the wave would vanish that way and stay gone
// until switching panel slid a fresh paint over it. So whenever the page
// comes back into view (or the browser reports a canvas restored), the
// canvases - and the glow sprites drawn from - are replaced with new
// ones and drawn straight away.
function rebuildWaveCanvases() {
    panels.forEach((panel) => {
        const old = panel.querySelector(':scope > .wave-canvas');
        if (old) old.remove();
    });
    waveGeometry.clear();
    glowSprites.clear();
    drawAllWaves();
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rebuildWaveCanvases();
});
// Back from the back/forward cache, or a page the browser froze to save
// power, which don't always count as becoming visible.
window.addEventListener('pageshow', (e) => { if (e.persisted) rebuildWaveCanvases(); });
document.addEventListener('resume', rebuildWaveCanvases);
// The dots take the accent colour, which changes with the theme.
new MutationObserver(resetWaveColours)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', resetWaveColours);
syncWaveMotion();

// EASTER EGG
// Typing "wave" anywhere (outside a text field), or tapping the name on
// Home five times quickly, sends the wave surging for a few seconds. Under
// reduced motion there's no animation to boost, so it only says hi.
function surfsUp() {
    showToast("\u{1F30A} Surf's up!");
    if (reducedMotionQuery.matches) return;
    waveBoostStart = performance.now();
}

let typedKeys = '';
document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.key.length !== 1 || modalOpen()) return;
    const target = e.target;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    typedKeys = (typedKeys + e.key.toLowerCase()).slice(-4);
    if (typedKeys === 'wave') {
        typedKeys = '';
        surfsUp();
    }
});

const heroName = document.querySelector('.hero-title .name');
if (heroName) {
    let taps = [];
    heroName.addEventListener('click', () => {
        const now = performance.now();
        taps = taps.filter(t => now - t < 2000).concat(now);
        if (taps.length >= 5) {
            taps = [];
            surfsUp();
        }
    });
}

// COMMAND MENU
// Cmd/Ctrl+K (or the header's shortcut button) opens a small searchable
// list of everything you can do on the site - jump to a panel, copy the
// email, open a profile, flip the theme or print. Type to filter,
// arrows to move, Enter to run.
const cmdk = document.querySelector('.cmdk');
if (cmdk && typeof cmdk.showModal === 'function') {
    const input = cmdk.querySelector('.cmdk-input');
    const list = cmdk.querySelector('.cmdk-list');
    const empty = cmdk.querySelector('.cmdk-empty');
    const trigger = document.querySelector('.cmdk-trigger');
    const email = emailCard ? emailCard.getAttribute('data-email') : null;
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    if (trigger && !isApple) trigger.querySelector('.cmdk-key').textContent = 'Ctrl K';

    const openUrl = (url) => window.open(url, '_blank', 'noopener');
    const downloadFile = (href) => {
        const a = document.createElement('a');
        a.href = href;
        a.download = '';
        a.click();
    };
    const commands = [
        { label: 'Go to Home', hint: '1', keywords: 'start intro', run: () => showPanel('home') },
        { label: 'Go to About', hint: '2', keywords: 'education skills', run: () => showPanel('about') },
        { label: 'Go to Projects', hint: '3', keywords: 'work portfolio', run: () => showPanel('projects') },
        { label: 'Go to Contact', hint: '4', keywords: 'reach hire', run: () => showPanel('contact') },
        email && {
            label: 'Copy email address', hint: email, keywords: 'mail contact',
            run: () => {
                const fallback = () => { window.location.href = `mailto:${email}`; };
                if (!navigator.clipboard || !navigator.clipboard.writeText) return fallback();
                navigator.clipboard.writeText(email).then(() => showToast('Email copied to clipboard'), fallback);
            },
        },
        { label: 'Open GitHub', hint: 'github.com/Xeoul', keywords: 'code repos', run: () => openUrl('https://github.com/Xeoul') },
        { label: 'Open LinkedIn', hint: 'vincentlam812', keywords: 'profile', run: () => openUrl('https://www.linkedin.com/in/vincentlam812') },
        { label: 'Download resume', hint: 'PDF', keywords: 'cv download', run: () => downloadFile('Vincent_Lam_Resume.pdf') },
        { label: 'Save contact card', hint: '.vcf', keywords: 'vcard address book download', run: () => { window.location.href = 'vincent-lam.vcf'; } },
        themeToggle && { label: 'Toggle light / dark theme', keywords: 'dark mode appearance', run: () => themeToggle.click() },
        { label: 'Print / save as PDF', keywords: 'print page', run: () => window.print() },
    ].filter(Boolean);

    let shown = [];
    let activeIndex = 0;

    function setActive(index) {
        activeIndex = index;
        [...list.children].forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
        const active = list.children[index];
        if (active) {
            input.setAttribute('aria-activedescendant', active.id);
            active.scrollIntoView({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    function render() {
        const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
        shown = commands.filter(cmd => {
            const text = `${cmd.label} ${cmd.keywords || ''}`.toLowerCase();
            return terms.every(term => text.includes(term));
        });
        list.replaceChildren(...shown.map((cmd, i) => {
            const item = document.createElement('li');
            item.id = `cmdk-option-${i}`;
            item.className = 'cmdk-item';
            item.setAttribute('role', 'option');
            const label = document.createElement('span');
            label.textContent = cmd.label;
            item.appendChild(label);
            if (cmd.hint) {
                const hint = document.createElement('span');
                hint.className = 'cmdk-hint';
                hint.textContent = cmd.hint;
                item.appendChild(hint);
            }
            item.addEventListener('mousemove', () => { if (activeIndex !== i) setActive(i); });
            item.addEventListener('click', () => runCommand(i));
            return item;
        }));
        empty.hidden = shown.length > 0;
        setActive(shown.length ? 0 : -1);
    }

    // Closed first so the dialog hands focus back before the command
    // runs - otherwise it would undo e.g. showPanel's own focus move.
    function runCommand(index) {
        const cmd = shown[index];
        if (!cmd) return;
        cmdk.close();
        cmd.run();
    }

    function openMenu() {
        if (cmdk.open) return;
        input.value = '';
        render();
        cmdk.showModal();
        input.focus();
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!shown.length) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((activeIndex + step + shown.length) % shown.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            runCommand(activeIndex);
        }
    });

    // A click on the backdrop lands on the <dialog> itself (the box
    // inside fills the rest), so that's the cue to close.
    cmdk.addEventListener('click', (e) => {
        if (e.target === cmdk) cmdk.close();
    });

    if (trigger) trigger.addEventListener('click', openMenu);

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (cmdk.open) cmdk.close();
            else openMenu();
        }
    });
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
    // v2: the repos entry now also carries the site's own last push
    // (see MORE ON GITHUB), so summaries cached in the old shape are
    // ignored rather than misread.
    const key = `github-v2:${path}`;
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

// MORE ON GITHUB: the most recently updated public repos under
// Projects, so new work shows up without editing the page. Forks,
// archived repos and this site's own repo are left out. On a phone CSS
// shows only the heading, which links to the full list (see
// .repo-list in styles.css).
// Fails closed like the rest: the section stays hidden on error or if
// nothing is left after filtering.
// The same response also says when this site's own repo was last pushed
// to, which the Contact footer shows as "Updated <date>" - so that line
// costs no request of its own.
const REPO_LIMIT = 6;
const moreRepos = document.querySelector('.more-repos[data-github-user]');
const lastUpdated = document.querySelector('.last-updated');
if (moreRepos || lastUpdated) {
    const username = (moreRepos || document.querySelector('[data-github-user]')).getAttribute('data-github-user');
    const siteRepo = `${username}.github.io`.toLowerCase();
    // Repos already featured in the catalog above aren't listed twice,
    // and any named in data-exclude aren't listed at all.
    const featured = new Set([...document.querySelectorAll('.project[data-repo]')]
        .map(el => el.getAttribute('data-repo').toLowerCase())
        .concat((moreRepos ? moreRepos.getAttribute('data-exclude') || '' : '').toLowerCase().split(/[\s,]+/).filter(Boolean)));
    const reposData = fetchGitHub(`/users/${username}/repos?sort=pushed&per_page=30`, repos => {
        const site = repos.find(r => r.name.toLowerCase() === siteRepo);
        return {
            updated: site ? site.pushed_at : null,
            repos: repos
                .filter(r => !r.fork && !r.archived && r.name.toLowerCase() !== siteRepo
                    && r.name.toLowerCase() !== username.toLowerCase() && !featured.has(r.name.toLowerCase()))
                .slice(0, REPO_LIMIT)
                .map(r => ({ name: r.name, url: r.html_url, language: r.language, stars: r.stargazers_count })),
        };
    });

    if (lastUpdated) {
        reposData.then(({ updated }) => {
            const date = updated && new Date(updated);
            if (!date || Number.isNaN(date.getTime())) return;
            const time = lastUpdated.querySelector('time');
            time.dateTime = updated;
            time.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            lastUpdated.hidden = false;
        }).catch(() => {});
    }

    if (moreRepos) reposData
        .then(({ repos }) => {
            if (!repos.length) return;
            const list = moreRepos.querySelector('.repo-list');
            repos.forEach(repo => {
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.className = 'repo-link';
                link.href = repo.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                const name = document.createElement('span');
                name.className = 'repo-name';
                name.textContent = repo.name;
                link.appendChild(name);
                const meta = [repo.language, repo.stars > 0 ? `★ ${repo.stars}` : null].filter(Boolean).join(' · ');
                if (meta) {
                    const metaEl = document.createElement('span');
                    metaEl.className = 'repo-meta';
                    metaEl.textContent = meta;
                    link.appendChild(metaEl);
                }
                item.appendChild(link);
                list.appendChild(item);
            });
            moreRepos.hidden = false;
        })
        .catch(() => {});
}

// PRINTING THE PROJECT CATALOG
// Collapsed projects would print as just their one-line summary, so every
// one is opened for printing and put back afterwards. The shared name
// that makes them an accordion is lifted first - otherwise opening each
// one would close the one before it.
const projectDetails = [...document.querySelectorAll('details.project')];
let projectsBeforePrint = null;
window.addEventListener('beforeprint', () => {
    projectsBeforePrint = projectDetails.map(d => ({ open: d.open, name: d.getAttribute('name') }));
    projectDetails.forEach(d => {
        d.removeAttribute('name');
        d.open = true;
    });
});
window.addEventListener('afterprint', () => {
    if (!projectsBeforePrint) return;
    projectDetails.forEach((d, i) => { d.open = projectsBeforePrint[i].open; });
    projectDetails.forEach((d, i) => {
        if (projectsBeforePrint[i].name) d.setAttribute('name', projectsBeforePrint[i].name);
    });
    projectsBeforePrint = null;
});

// LINKS TO ONE PROJECT
// A hash is either "#panel" or "#projects/<slug>", which opens that
// project in the catalog - what each project's Copy link button shares.
// Opening or closing a project by hand keeps the address bar in step
// (replaced, not pushed, so Back still steps through panels rather than
// every project you peeked at).
function parseHash() {
    const [panel, project] = window.location.hash.slice(1).split('/');
    return { panel: panel || 'home', project: project || null };
}

function openProject(slug) {
    const details = projectDetails.find(d => d.dataset.slug === slug);
    if (!details) return;
    const folding = closingProjects.get(details);
    if (folding) folding(false);
    details.open = true;
    // The catalog scrolls on its own on phones. Measured by hand rather
    // than scrollIntoView(), which would also scroll the view sideways
    // toward a panel that's still sliding in.
    const panel = details.closest('.panel');
    const top = details.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    if (top < 0 || top + details.offsetHeight > panel.clientHeight) panel.scrollTop += top - 16;
}

function showFromHash(animate) {
    const { panel, project } = parseHash();
    showPanel(panel, false, animate);
    if (panel === 'projects' && project) openProject(project);
}

projectDetails.forEach(details => {
    const slug = details.dataset.slug;
    if (!slug) return;

    // Runs before the <details> toggles, so .open is still the old state.
    details.querySelector('summary').addEventListener('click', () => {
        if (parseHash().panel !== 'projects') return;
        // A click on a row that's mid-fold keeps it open (see CLOSING A PROJECT).
        const closing = details.open && !('closing' in details.dataset);
        const hash = closing ? '#projects' : `#projects/${slug}`;
        if (window.location.hash !== hash) history.replaceState(null, '', hash);
    });

    // Added here rather than in the markup since it needs the script.
    let links = details.querySelector('.project-links');
    if (!links) {
        links = document.createElement('div');
        links.className = 'project-links';
        details.querySelector('.project-body').appendChild(links);
    }
    const title = details.querySelector('.project-title').textContent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-copy-link';
    button.append('Copy link');
    const hidden = document.createElement('span');
    hidden.className = 'visually-hidden';
    hidden.textContent = ` to ${title}`;
    button.appendChild(hidden);
    button.addEventListener('click', () => {
        const hash = `#projects/${slug}`;
        const url = `${window.location.origin}${window.location.pathname}${hash}`;
        const fallback = () => {
            history.replaceState(null, '', hash);
            showToast('Copy the link from the address bar');
        };
        if (!navigator.clipboard || !navigator.clipboard.writeText) return fallback();
        navigator.clipboard.writeText(url).then(() => showToast('Link copied'), fallback);
    });
    links.appendChild(button);
});

// CLOSING A PROJECT
// A <details> element hides its contents the instant it closes, which
// read as the row slamming shut next to its gentle opening animation. So
// a close - clicking an open row, or opening another row while one is
// open (the shared name makes them an accordion) - first folds the open
// body away, then actually closes it. The row being closed keeps
// data-closing while it folds.
const PROJECT_CLOSE_MS = 300;
const closingProjects = new Map();

function foldProject(details) {
    const body = details.querySelector('.project-body');
    if (!body || reducedMotionQuery.matches) {
        details.open = false;
        return;
    }
    // Out of the accordion while it folds, so opening the next row doesn't
    // close this one early.
    const name = details.getAttribute('name');
    details.removeAttribute('name');
    details.dataset.closing = '';
    const style = getComputedStyle(body);
    const animation = body.animate([
        { height: `${body.offsetHeight}px`, paddingBottom: style.paddingBottom, opacity: 1 },
        { height: '0px', paddingBottom: '0px', opacity: 0 },
    ], { duration: PROJECT_CLOSE_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    body.style.overflow = 'hidden';
    const done = (close) => {
        closingProjects.delete(details);
        delete details.dataset.closing;
        body.style.overflow = '';
        animation.cancel();
        if (close) details.open = false;
        if (name) details.setAttribute('name', name);
    };
    closingProjects.set(details, done);
    animation.onfinish = () => done(true);
}

projectDetails.forEach(details => {
    details.querySelector('summary').addEventListener('click', (e) => {
        const closing = closingProjects.get(details);
        if (closing) {
            // Clicked again mid-fold: stay open.
            e.preventDefault();
            closing(false);
            return;
        }
        if (details.open) {
            e.preventDefault();
            foldProject(details);
            return;
        }
        const name = details.getAttribute('name');
        if (!name) return;
        projectDetails
            .filter(other => other !== details && other.open && other.getAttribute('name') === name)
            .forEach(foldProject);
    });
});

// Printing opens every project; anything mid-fold finishes closing first.
window.addEventListener('beforeprint', () => {
    closingProjects.forEach(done => done(true));
}, { capture: true });

// LEAVING PRINT
// The print layout (see PRINT in styles.css) lays every panel out in
// place, one after another. Coming back from it - after printing, or on
// cancelling the print dialog - the screen layout's transitions would
// animate each panel from there back to its off-screen spot: three
// panels sweeping across the one you were on. .printing switches
// transitions off until the screen layout is back and has been painted.
// The wave canvases are re-measured too, in case the print layout
// resized the page while it was up.
const rootEl = document.documentElement;
window.addEventListener('beforeprint', () => rootEl.classList.add('printing'));
window.addEventListener('afterprint', () => {
    void document.body.offsetWidth; // apply the screen layout now, while transitions are still off
    requestAnimationFrame(() => requestAnimationFrame(() => {
        rootEl.classList.remove('printing');
        waveGeometry.clear();
        drawAllWaves();
        moveNavIndicatorToActive(true);
    }));
});

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
    showFromHash(false);
    // Pages outside the four panels (a case study, the 404) mark their
    // section's nav link active in the markup - place the pill under it.
    moveNavIndicatorToActive(true);

    // Home's .reveal children play their first entrance as a CSS
    // animation (.init-pending, see CONTENT ENTRANCE in styles.css).
    // Once it ends, the class comes off so later visits to Home use the
    // same .panel.active transition as every other panel - otherwise the
    // animation's final state would keep them visible even off-screen.
    document.querySelectorAll('.reveal.init-pending').forEach(el => {
        el.addEventListener('animationend', () => el.classList.remove('init-pending'), { once: true });
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
