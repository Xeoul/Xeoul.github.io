const menu_btn = document.querySelector('.hamburger');
const hamburg_menu = document.querySelector('.in-menu');
const menuItems = document.querySelectorAll('.in-menu a');

menu_btn.addEventListener('click', function () {
    menu_btn.classList.toggle('is-active');
    hamburg_menu.classList.toggle('is-active');
});

// Close the menu when a menu item is clicked
menuItems.forEach((menuItem) => {
    menuItem.addEventListener('click', () => {
        hamburg_menu.classList.remove('is-active');
        menu_btn.classList.remove('is-active');
        document.body.classList.remove('menu-open'); // Add this line
    });
});
