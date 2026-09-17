// Runs synchronously in <head>, before styles.css paints anything, so a
// saved dark-mode preference applies immediately instead of flashing the
// light theme first. Kept as its own tiny external file (rather than an
// inline <script>) because the CSP has no 'unsafe-inline' for script-src.
(function () {
    try {
        var saved = localStorage.getItem('theme');
        if (saved === 'dark' || saved === 'light') {
            document.documentElement.setAttribute('data-theme', saved);
        }
    } catch (e) {
        // Storage can throw in private-browsing/locked-down contexts -
        // falling back to the OS-level prefers-color-scheme is fine.
    }
})();
