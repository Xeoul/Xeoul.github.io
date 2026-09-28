# xeoul.github.io

Source for my portfolio site: **https://xeoul.github.io/**

A single-screen site with four panels (Home, About, Projects, Contact) that slide between each other, over an animated dot-grid wave. It's hand-written HTML, CSS and JavaScript with no framework, no build step and no third-party scripts.

## Highlights

- **Canvas wave background:** one continuous wave across panels, drawn only for panels on screen, with reduced-motion support.
- **Project catalog:** expandable rows with screenshots and live demo and code links. Public GitHub repos are listed automatically from the GitHub API, cached in the browser to respect its rate limit.
- **Navigation:** tab bar and swipe on phones; header nav, arrow keys, 1–4, and a ⌘K / Ctrl+K command menu on desktop.
- **Accessibility:** skip link, `aria-current`, off-screen panels made `inert`, focus moved to each panel's heading, and visible focus styles.
- **Print / save as PDF:** a clean light-theme layout of every panel.
- **Light and dark themes**, a matching 404 page, and a strict Content Security Policy.

## Layout

```
docs/              the site, published as-is by GitHub Pages
  index.html
  styles.css
  script.js
  theme-init.js    applies a saved theme before first paint
  404.html
  images/projects/ project preview screenshots
tests/             Playwright smoke tests
```

## Development

Serve `docs/` with any static server:

```sh
python3 -m http.server 8080 --directory docs
```

Run the smoke tests (at desktop and phone sizes):

```sh
npm ci
npx playwright install chromium
npm test
```

The same tests run on every pull request via `.github/workflows/ci.yml`.
