// SERVICE WORKER
// Makes the portfolio load like an installed app: after the first visit
// the styles, script, font and images come straight from this device,
// pages still open with no connection, and nothing waits on the network
// except the page itself.
//
// It only handles the portfolio's own files. Everything else on
// xeoul.github.io - the live demos under /aegis/, /nagare/ and so on,
// which have their own lifecycles - and every other site (the GitHub
// API) is left to the browser exactly as if this worker weren't here.
//
// VERSION, STYLES and SCRIPT are written by `npm run build` (see
// scripts/build.mjs), so each build gets a fresh cache and the old one
// is cleared out.
const VERSION = '80994a102c';
const STYLES = '/styles.css?v=2336af7c23';
const SCRIPT = '/script.js?v=4f4983e1a3';
const CACHE = `portfolio-${VERSION}`;

// Pages and files to have on hand from the first visit, so the whole
// site works offline even before you've opened every page.
const PRECACHE = [
    '/',
    '/projects/aegis/',
    '/projects/installous/',
    '/projects/nagare/',
    '/projects/privacy-blocker/',
    '/projects/sous-chef/',
    '/writing/cedar-in-the-browser/',
    STYLES,
    SCRIPT,
    '/theme-init.js',
    '/fonts/Inter-Variable.woff2',
    '/favicon.svg',
    '/icons/icon-192.png',
];

// The portfolio's own paths. Anything outside these - above all the
// demo apps - is never touched.
const OWN = /^\/(?:$|index\.html$|404\.html$|projects\/|writing\/|images\/|fonts\/|icons\/|styles\.css$|script\.js$|theme-init\.js$|favicon\.svg$|og-image\.png$|manifest\.webmanifest$|Vincent_Lam_Resume\.pdf$|vincent-lam\.vcf$)/;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name.startsWith('portfolio-') && name !== CACHE).map((name) => caches.delete(name)));
        // Starts fetching a page while the worker wakes up, instead of after.
        if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
        await self.clients.claim();
    })());
});

// Pages: the network first, so a new version shows up as soon as it's
// published, with the saved copy used when there's no connection or the
// network takes more than a few seconds to answer.
async function networkFirst(event) {
    const cache = await caches.open(CACHE);
    const network = Promise.resolve(event.preloadResponse)
        .then((preloaded) => preloaded || fetch(event.request))
        .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
        });
    const slow = new Promise((resolve) => setTimeout(resolve, 4000, null));
    try {
        const response = await Promise.race([network, slow]);
        if (response) return response;
    } catch (error) {
        // Offline: fall through to the saved copy.
    }
    const cached = await cache.match(event.request, { ignoreSearch: true });
    // With no saved copy, keep waiting on the network rather than fail.
    return cached || network;
}

// The versioned styles and script never change at a given URL, so a
// saved copy is always right.
async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
}

// Images, the font and other files: the saved copy straight away, with
// a fresh one fetched in the background for next time.
async function staleWhileRevalidate(event) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    const fresh = fetch(event.request).then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
    });
    if (cached) {
        event.waitUntil(fresh.catch(() => {}));
        return cached;
    }
    return fresh;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !OWN.test(url.pathname)) return;
    // Range requests (video/PDF seeking) go straight to the network.
    if (request.headers.has('range')) return;

    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(networkFirst(event));
    } else if (url.search.startsWith('?v=')) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(staleWhileRevalidate(event));
    }
});
