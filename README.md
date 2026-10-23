# xeoul.github.io

Source for my portfolio site: **https://xeoul.github.io/**

A single-screen site with four panels (Home, About, Projects, Contact) that slide between each other, over an animated dot-grid wave. It's hand-written HTML, CSS and JavaScript with no framework and no third-party scripts; a one-command build minifies the CSS and JavaScript.

## Highlights

- **Canvas wave background:** one continuous wave across panels, drawn only for panels on screen, with reduced-motion support.
- **Project catalog:** expandable rows with screenshots and live demo and code links. Public GitHub repos are listed automatically from the GitHub API, cached in the browser to respect its rate limit.
- **Case studies:** a page per featured project (problem, how it's built, key decisions, what's next) under `/projects/<name>/`.
- **Shareable project links:** `#projects/nagare` opens the site with that project expanded; each project has a Copy link button.
- **Contact card:** a vCard (`vincent-lam.vcf`) to save to your contacts in one tap.
- **Navigation:** tab bar and swipe on phones; header nav, arrow keys, 1–4, and a ⌘K / Ctrl+K command menu on desktop.
- **Accessibility:** skip link, `aria-current`, off-screen panels made `inert`, focus moved to each panel's heading, and visible focus styles.
- **Resume:** a one-page PDF (`docs/Vincent_Lam_Resume.pdf`) rendered from `resume/resume.html` by `node scripts/build-resume.mjs`; edit the HTML and re-run it.
- **Print / save as PDF:** a clean light-theme layout of every panel.
- **Installable and offline:** a web app manifest and home-screen icons, so it opens full screen like an app, and a service worker that keeps the site's files on the device: repeat visits load from it and every page works offline. It only handles the portfolio's own paths, never the demo apps that share the domain.
- **Light and dark themes**, a matching 404 page, and a strict Content Security Policy.

## Layout

```
src/               readable sources of the styles and script - edit these
  styles.css
  script.js
docs/              the site, published as-is by GitHub Pages
  index.html
  styles.css       minified from src/ by npm run build
  script.js        minified from src/ by npm run build
  sw.js            service worker (offline and instant repeat visits)
  manifest.webmanifest, icons/   home-screen app setup
  theme-init.js    applies a saved theme before first paint
  404.html
  projects/<name>/ case-study pages
  vincent-lam.vcf  contact card
  images/projects/ project preview screenshots
scripts/build.mjs  the build (esbuild): minifies src/ into docs/ and stamps versions
tests/             Playwright smoke tests
```

## Development

Edit `src/styles.css` and `src/script.js`, then rebuild `docs/`:

```sh
npm ci
npm run build    # writes docs/styles.css, docs/script.js and the ?v= links in every page
npm run check    # fails if docs/ is out of date with src/ (CI runs this)
```

Serve `docs/` with any static server:

```sh
python3 -m http.server 8080 --directory docs
```

Run the tests (Playwright, at desktop and phone sizes):

```sh
npm ci
npx playwright install chromium
npm test
```

- `tests/app.spec.js`: the build is current, every page can be installed to the home screen, and the service worker keeps the site working offline without touching the demo apps.
- `tests/site.spec.js`: smoke tests for page load, navigation, referenced files and links, the project catalog and the 404 page.
- `tests/interactions.spec.js`: every feature in depth, plus edge cases:
  - printing and cancelling
  - deep links (to panels and to single projects), the back button, rapid clicks and swipes
  - Copy link, the case-study pages and the contact card
  - theme and email copy
  - blocked storage and GitHub API failures
  - the command menu and keyboard shortcuts
  - overflow from 320px to 1440px
  - resizing and reduced motion
  - an axe accessibility scan of every panel in both themes
  - a seeded stress run of random actions (`STRESS_SEED` / `STRESS_STEPS` make it longer or different)

All three run on every pull request via `.github/workflows/ci.yml`.
