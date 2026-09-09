// HAMBURGER MENU FUNCTIONALITY
const menu_btn = document.querySelector('.hamburger');
const hamburg_menu = document.querySelector('.in-menu');
const menu_backdrop = document.querySelector('.menu-backdrop');
const menu_items = document.querySelectorAll('.in-menu a');

function closeMenu() {
    menu_btn.classList.remove('is-active');
    hamburg_menu.classList.remove('is-active');
    menu_backdrop.classList.remove('is-active');
}

// Toggle menu when hamburger is clicked
menu_btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu_btn.classList.toggle('is-active');
    hamburg_menu.classList.toggle('is-active');
    menu_backdrop.classList.toggle('is-active');
});

// Close menu when a nav link is clicked
menu_items.forEach(item => {
    item.addEventListener('click', closeMenu);
});

// Close menu when clicking outside of it (including the backdrop)
document.addEventListener('click', (e) => {
    if (!menu_btn.contains(e.target) && !hamburg_menu.contains(e.target)) {
        closeMenu();
    }
});

// RESTRICTED REPOSITORY LINK
const restrictedRepoLink = document.getElementById('restricted-repo-link');
if (restrictedRepoLink) {
    restrictedRepoLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Repository access may be restricted');
    });
}

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

// SCROLL INDICATOR PULSE ANIMATION
const scrollIndicator = document.querySelector('.scroll-indicator');
if (scrollIndicator) {
    setInterval(() => {
        const arrow = scrollIndicator.querySelector('.scroll-arrow');
        if (arrow) {
            arrow.style.transform = 'translateY(5px)';
            setTimeout(() => {
                arrow.style.transform = 'translateY(0)';
            }, 500);
        }
    }, 2000);
}

// COMBINED SCROLL EFFECTS: parallax, scroll indicator visibility, header opacity, progress bar
const header = document.querySelector('header');
const parallaxElements = document.querySelectorAll('.scroll-section');
const scrollProgress = document.querySelector('.scroll-progress');

let ticking = false;
function onScroll() {
    const scrolled = window.pageYOffset;

    parallaxElements.forEach((element, index) => {
        if (element.classList.contains('visible')) {
            const rate = scrolled * -0.5;
            const yPos = -(rate / (index + 1));
            element.style.transform = `translate3d(0, ${yPos * 0.1}px, 0)`;
        }
    });

    if (scrollIndicator) {
        if (scrolled > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.transform = 'translateY(20px)';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.transform = 'translateY(0)';
        }
    }

    const opacity = Math.min(scrolled / 100, 0.95);
    header.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;

    if (scrollProgress) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrolled / docHeight) * 100 : 0;
        scrollProgress.style.width = `${Math.min(progress, 100)}%`;
    }

    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
    }
}, { passive: true });

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

// SCROLL-SPY NAV HIGHLIGHTING
// Highlights whichever section is currently near the vertical center of
// the viewport. Scoped to `.in-menu a` only - `.nav-link` is also used by
// the hero CTA buttons, which shouldn't get the "active" treatment.
const spySections = document.querySelectorAll('section[id]');
const spyLinks = document.querySelectorAll('.in-menu a[href^="#"]');

if (spySections.length && spyLinks.length) {
    const spyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                spyLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    spySections.forEach(section => spyObserver.observe(section));
}

// ANIMATED STAT COUNTERS (2025 / 3+ / 3, counting up from 0)
function animateStatCounters() {
    document.querySelectorAll('.stat-number[data-count]').forEach(el => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1200;
        const startTime = performance.now();

        function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        }
        requestAnimationFrame(tick);
    });
}

// TYPEWRITER-STYLE REVEAL FOR THE HERO CODE WINDOW
// Reveals each line in sequence with a briefly-blinking cursor, rather than
// animating individual characters - keeps the existing syntax-highlight
// spans intact instead of having to type through nested HTML.
function typeCodeLines() {
    const lines = document.querySelectorAll('.code-window .code-line');
    lines.forEach((line, index) => {
        setTimeout(() => {
            line.classList.add('visible', 'typing');
            setTimeout(() => line.classList.remove('typing'), 350);
        }, index * 220);
    });
}

// CONTACT FORM: builds a mailto: link client-side and hands off to the
// visitor's own email app. No third-party form service, no API key, and
// nothing is transmitted from this page - matches the static-site CSP.
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('cf-name').value.trim();
        const email = document.getElementById('cf-email').value.trim();
        const message = document.getElementById('cf-message').value.trim();
        const subject = `Portfolio contact from ${name}`;
        const body = `${message}\n\n— ${name} (${email})`;
        window.location.href = `mailto:v812.io@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
}

// INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
    // Add visible class to home section immediately
    const homeSection = document.querySelector('#home');
    if (homeSection) {
        setTimeout(() => {
            homeSection.classList.add('visible');
        }, 100);
    }

    animateStatCounters();
    typeCodeLines();

    // Smooth scroll to top on page refresh
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});
