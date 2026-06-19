/* ============================
   PARTICLE NETWORK ANIMATION
   ============================ */

class ParticleNetwork {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 120;
        
        this.resizeCanvas();
        this.init();
        this.animate();
        
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    
    init() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 1.5 + 0.5
            });
        }
        // mouse tracking for interactive connections
        this.mouse = null;
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        });
        window.addEventListener('mouseleave', () => { this.mouse = null; });
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;
            
            particle.x = Math.max(0, Math.min(this.canvas.width, particle.x));
            particle.y = Math.max(0, Math.min(this.canvas.height, particle.y));
        });
        
        this.particles.forEach(particle => {
            this.ctx.fillStyle = `rgba(0, 212, 255, ${0.35 + 0.35 * Math.sin(Date.now() * 0.001)})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.drawConnections();
        
        requestAnimationFrame(() => this.animate());
    }
    
    drawConnections() {
        const maxDistance = 150;
        
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.3;
                    this.ctx.strokeStyle = `rgba(123, 97, 255, ${opacity})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        // draw connections to mouse for interactive knowledge network
        if (this.mouse) {
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 160) {
                    const alpha = (1 - dist / 160) * 0.9;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(0,212,255,${alpha * 0.8})`;
                    this.ctx.lineWidth = 1.2;
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    this.ctx.stroke();
                }
            }
        }
    }
}

/* ============================
   CONNECTOR LINES FOR SOURCE CARDS
   ============================ */

class ConnectorCanvas {
    constructor(canvasId, sourceSelector) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.sources = Array.from(document.querySelectorAll(sourceSelector));
        this.resize();
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => this.handleMouse(e));
        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth * devicePixelRatio;
        this.canvas.height = this.canvas.offsetHeight * devicePixelRatio;
        this.canvas.style.width = this.canvas.offsetWidth + 'px';
        this.canvas.style.height = this.canvas.offsetHeight + 'px';
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    handleMouse(e) {
        this.mouse = { x: e.clientX, y: e.clientY };
    }

    animate() {
        if (!this.ctx) return;
        const w = this.canvas.offsetWidth;
        const h = this.canvas.offsetHeight;
        this.ctx.clearRect(0, 0, w, h);

        const centers = this.sources.map(el => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2 - this.canvas.getBoundingClientRect().left, y: r.top + r.height / 2 - this.canvas.getBoundingClientRect().top };
        });

        // draw lines between sources and center
        const centerX = w / 2;
        const centerY = h / 2;

        centers.forEach((c, i) => {
            // line to center
            const dx = c.x - centerX;
            const dy = c.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const alpha = Math.max(0.08, 1 - dist / (Math.max(w, h)));
            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(123,97,255,${alpha * 0.9})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.moveTo(c.x, c.y);
            this.ctx.quadraticCurveTo((c.x + centerX) / 2, (c.y + centerY) / 2 - 40, centerX, centerY);
            this.ctx.stroke();
        });

        // draw mouse interaction connections
        if (this.mouse) {
            centers.forEach(c => {
                const dx = c.x - this.mouse.x + this.canvas.getBoundingClientRect().left;
                const dy = c.y - this.mouse.y + this.canvas.getBoundingClientRect().top;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) {
                    const a = 1 - dist / 200;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(0,212,255,${a * 0.9})`;
                    this.ctx.lineWidth = 1.2;
                    this.ctx.moveTo(c.x, c.y);
                    this.ctx.lineTo(this.mouse.x - this.canvas.getBoundingClientRect().left, this.mouse.y - this.canvas.getBoundingClientRect().top);
                    this.ctx.stroke();
                }
            });
        }

        requestAnimationFrame(() => this.animate());
    }
}

/* ============================
   NAVBAR SCROLL EFFECT
   ============================ */

function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

function trackEvent(eventName, eventProps = {}) {
    window.analyticsQueue = window.analyticsQueue || [];
    window.analyticsQueue.push({ event: eventName, properties: eventProps, timestamp: new Date().toISOString() });
    if (window.dataLayer) {
        window.dataLayer.push({ event: eventName, ...eventProps });
    }
    console.log('[Analytics]', eventName, eventProps);
}

function initAboutModal() {
    const aboutModal = document.getElementById('aboutModal');
    const aboutTrigger = document.querySelector('.nav-about-trigger');
    const aboutClose = document.querySelector('.about-close');

    function openModal() {
        if (!aboutModal) return;
        aboutModal.classList.add('active');
        aboutModal.setAttribute('aria-hidden', 'false');
        trackEvent('AboutModalOpened');
    }

    function closeModal() {
        if (!aboutModal) return;
        aboutModal.classList.remove('active');
        aboutModal.setAttribute('aria-hidden', 'true');
        trackEvent('AboutModalClosed');
    }

    if (aboutTrigger) {
        aboutTrigger.addEventListener('click', openModal);
    }
    if (aboutClose) {
        aboutClose.addEventListener('click', closeModal);
    }
    if (aboutModal) {
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                closeModal();
            }
        });
    }
    setTimeout(openModal, 1000);
}

function initAnalyticsTracking() {
    document.querySelectorAll('[data-analytics]').forEach(el => {
        el.addEventListener('click', () => {
            const eventName = el.getAttribute('data-analytics');
            if (eventName) {
                trackEvent(eventName);
            }
        });
    });
}

/* ============================
   SCROLL REVEAL ANIMATION
   ============================ */

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.approach-card, .service-card, .failure-card, .who-card, .practice-item, .faq-item').forEach(el => {
        el.classList.add('scroll-reveal');
        observer.observe(el);
    });
}

/* ============================
   SMOOTH SCROLL NAVIGATION
   ============================ */

function initSmoothScroll() {
    document.querySelectorAll('[data-scroll]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = button.getAttribute('data-scroll');
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ============================
   ASSESSMENT WIZARD
   ============================ */

let currentQuestion = 1;

function nextQuestion() {
    if (currentQuestion < 3) {
        document.querySelector(`.assessment-question[data-question="${currentQuestion}"]`).classList.remove('active');
        currentQuestion++;
        document.querySelector(`.assessment-question[data-question="${currentQuestion}"]`).classList.add('active');
    }
}

function prevQuestion() {
    if (currentQuestion > 1) {
        document.querySelector(`.assessment-question[data-question="${currentQuestion}"]`).classList.remove('active');
        currentQuestion--;
        document.querySelector(`.assessment-question[data-question="${currentQuestion}"]`).classList.add('active');
    }
}

function submitAssessment() {
    const q1 = document.querySelector('input[name="q1"]:checked')?.value;
    const q2 = document.querySelector('input[name="q2"]:checked')?.value;
    const q3 = Array.from(document.querySelectorAll('input[name="q3"]:checked')).map(el => el.value);
    
    if (!q1 || !q2 || q3.length === 0) {
        alert('Please answer all questions before submitting.');
        return;
    }
    
    const message = `Assessment Submission:\nQ1: ${q1}\nQ2: ${q2}\nQ3: ${q3.join(', ')}`;
    trackEvent('AssessmentSubmitted', { q1, q2, q3 });
    window.location.href = `https://t.me/your_bot?text=${encodeURIComponent(message)}`;
}

/* ============================
   FAQ ACCORDION
   ============================ */

function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', (e) => {
            const faqItem = button.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });
}

/* ============================
   MAGNETIC BUTTON EFFECT
   ============================ */

function initMagneticButtons() {
    const magneticButtons = document.querySelectorAll('.magnetic-btn');
    
    magneticButtons.forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const distX = (e.clientX - centerX) * 0.1;
            const distY = (e.clientY - centerY) * 0.1;
            
            button.style.transform = `translate(${distX}px, ${distY}px)`;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translate(0, 0)';
        });
    });
}

/* ============================
   RESPONSIVE NAVBAR TOGGLE
   ============================ */

function initMobileNavbar() {
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');
    const navbarInner = document.querySelector('.navbar-inner');

    if (navbarToggle && navbarMenu) {
        navbarToggle.addEventListener('click', () => {
            const isOpen = navbarMenu.classList.toggle('mobile-open');
            navbarToggle.classList.toggle('open', isOpen);
            navbarMenu.style.display = isOpen ? 'flex' : 'none';
            if (navbarInner) {
                navbarInner.classList.toggle('open', isOpen);
            }
        });
    }

    document.querySelectorAll('.navbar-menu a, .nav-about-trigger').forEach(link => {
        link.addEventListener('click', () => {
            if (navbarMenu) {
                navbarMenu.classList.remove('mobile-open');
                navbarMenu.style.display = 'none';
            }
            if (navbarToggle) {
                navbarToggle.classList.remove('open');
            }
            if (navbarInner) {
                navbarInner.classList.remove('open');
            }
        });
    });
}

/* ============================
   TIMELINE SCROLL ANIMATION
   ============================ */

function initTimelineAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.2
    });
    
    document.querySelectorAll('.timeline-item').forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(item);
    });
}

/* ============================
   HERO SCROLL INDICATOR
   ============================ */

function initScrollIndicator() {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    if (scrollIndicator) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                scrollIndicator.style.opacity = '0';
                scrollIndicator.style.pointerEvents = 'none';
            } else {
                scrollIndicator.style.opacity = '1';
                scrollIndicator.style.pointerEvents = 'auto';
            }
        });
    }
}

/* ============================
   PARALLAX EFFECT
   ============================ */

function initParallax() {
    window.addEventListener('scroll', () => {
        const heroVisualization = document.querySelector('.hero-visualization');
        if (heroVisualization) {
            const scrollPosition = window.scrollY;
            heroVisualization.style.transform = `translateY(${scrollPosition * 0.3}px)`;
        }
    });
}

/* ============================
   CARD HOVER ANIMATIONS
   ============================ */

function initCardAnimations() {
    const cards = document.querySelectorAll('.service-card, .approach-card, .failure-card, .who-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.boxShadow = '0 20px 50px rgba(0, 212, 255, 0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.boxShadow = 'none';
        });
    });
}

/* ============================
   INITIALIZATION
   ============================ */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize particle network
    if (document.getElementById('particleCanvas')) {
        new ParticleNetwork('particleCanvas');
    }
    // Initialize connector canvas for source cards
    if (document.getElementById('connectorCanvas')) {
        new ConnectorCanvas('connectorCanvas', '.visual-overlay .source-card');
    }
    
    // Initialize all features
    initNavbarScroll();
    initScrollReveal();
    initSmoothScroll();
    initFAQ();
    initMagneticButtons();
    initMobileNavbar();
    initAboutModal();
    initAnalyticsTracking();
    initTimelineAnimation();
    initScrollIndicator();
    initParallax();
    initCardAnimations();
    
    const pageName = document.body.dataset.page || (window.location.pathname.includes('services') ? 'services' : 'homepage');
    trackEvent('PageView', { page: pageName });

    // Add scroll-reveal class to timeline items
    document.querySelectorAll('.timeline-item').forEach(item => {
        item.classList.add('scroll-reveal');
    });
});

/* ============================
   UTILITY: DEBOUNCE FUNCTION
   ============================ */

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/* ============================
   ADDITIONAL RESPONSIVE HANDLING
   ============================ */

const resizeHandler = debounce(() => {
    const particleCanvas = document.getElementById('particleCanvas');
    if (particleCanvas) {
        particleCanvas.width = particleCanvas.offsetWidth;
        particleCanvas.height = particleCanvas.offsetHeight;
    }
}, 250);

window.addEventListener('resize', resizeHandler);

/* ============================
   PROGRESSIVE ENHANCEMENT
   ============================ */

if ('IntersectionObserver' in window) {
    console.log('IntersectionObserver is supported');
} else {
    console.warn('IntersectionObserver is not supported');
}

/* ============================
   PERFORMANCE OPTIMIZATION
   ============================ */

// Lazy load images if used in future
document.addEventListener('lazyload', (e) => {
    const img = e.target;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
});
