// HAMBURGER MENU FUNCTIONALITY
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

// PARALLAX SCROLL EFFECTS
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.scroll-section');
    
    parallaxElements.forEach((element, index) => {
        const rate = scrolled * -0.5;
        const yPos = -(rate / (index + 1));
        
        // Apply subtle parallax effect
        if (element.classList.contains('visible')) {
            element.style.transform = `translate3d(0, ${yPos * 0.1}px, 0)`;
        }
    });
});

// ENHANCED SCROLL INDICATOR ANIMATION
const scrollIndicator = document.querySelector('.scroll-indicator');
if (scrollIndicator) {
    // Add pulsing animation
    setInterval(() => {
        const arrow = scrollIndicator.querySelector('.scroll-arrow');
        if (arrow) {
            arrow.style.transform = 'translateY(5px)';
            setTimeout(() => {
                arrow.style.transform = 'translateY(0)';
            }, 500);
        }
    }, 2000);
    
    // Hide scroll indicator when user starts scrolling
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.transform = 'translateY(20px)';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.transform = 'translateY(0)';
        }
    });
}

// HEADER BACKGROUND OPACITY ON SCROLL
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const opacity = Math.min(scrolled / 100, 0.95);
    header.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
});

// STAGGERED ANIMATION FOR PROJECT CARDS
const projectCards = document.querySelectorAll('.project-card');
const projectObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0) scale(1)';
            }, index * 200); // Stagger the animation
        }
    });
}, { threshold: 0.2 });

projectCards.forEach(card => {
    projectObserver.observe(card);
});

// SKILL TAGS ANIMATION
const skillTags = document.querySelectorAll('.skill-tag, .tech-tag');
const tagObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }, index * 50); // Quick stagger
        }
    });
}, { threshold: 0.5 });

skillTags.forEach(tag => {
    // Initially hide tags
    tag.style.opacity = '0';
    tag.style.transform = 'translateY(20px)';
    tag.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    tagObserver.observe(tag);
});

// CONTACT CARDS HOVER EFFECT ENHANCEMENT
const contactCards = document.querySelectorAll('.contact-card');
contactCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
    });
});

// INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
    // Add visible class to home section immediately
    const homeSection = document.querySelector('#home');
    if (homeSection) {
        setTimeout(() => {
            homeSection.classList.add('visible');
        }, 100);
    }
    
    // Smooth scroll to top on page refresh
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});
