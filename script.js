const menu_btn = document.querySelector(".hamburger");
const hamburg_menu = document.querySelector(".in-menu");
const menuItems = document.querySelectorAll(".in-menu a");

// Toggle menu open/close
menu_btn.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent triggering the outside click
  menu_btn.classList.toggle("is-active");
  hamburg_menu.classList.toggle("is-active");
});

// Close the menu when a menu item is clicked
menuItems.forEach((menuItem) => {
  menuItem.addEventListener("click", () => {
    hamburg_menu.classList.remove("is-active");
    menu_btn.classList.remove("is-active");
  });
});

// Close the menu when clicking outside
document.addEventListener("click", (event) => {
  const isClickInside =
    menu_btn.contains(event.target) || hamburg_menu.contains(event.target);
  if (!isClickInside) {
    hamburg_menu.classList.remove("is-active");
    menu_btn.classList.remove("is-active");
  }
});
