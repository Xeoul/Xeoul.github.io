const menu_btn = document.querySelector('.hamburger');
const hamburg_menu = document.querySelector('.in-menu');
const menu_items = document.querySelectorAll('.in-menu a');

// Toggle menu when hamburger is clicked
menu_btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu_btn.classList.toggle('is-active');
    hamburg_menu.classList.toggle('is-active');
});

// Close menu when a nav link is clicked
menu_items.forEach(item => {
    item.addEventListener('click', () => {
        menu_btn.classList.remove('is-active');
        hamburg_menu.classList.remove('is-active');
    });
});

// Close menu when clicking outside of it
document.addEventListener('click', (e) => {
    if (!menu_btn.contains(e.target) && !hamburg_menu.contains(e.target)) {
        menu_btn.classList.remove('is-active');
        hamburg_menu.classList.remove('is-active');
    }
});
