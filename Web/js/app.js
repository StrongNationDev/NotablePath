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
   HERO NETWORK LINES ANIMATION
   ============================ */

class HeroNetwork {
    constructor(svgSelector, sourceSelector, nodeSelector) {
        this.svg = document.querySelector(svgSelector);
        if (!this.svg) return;
        this.sourceSelector = sourceSelector;
        this.nodeSelector = nodeSelector;
        this.sources = Array.from(document.querySelectorAll(this.sourceSelector));
        this.nodes = Array.from(document.querySelectorAll(this.nodeSelector));
        this.lines = [];
        this.time = 0;

        this.resize();
        window.addEventListener('resize', debounce(() => this.resize(), 100));
        this.animate();
    }

    resize() {
        if (!this.svg) return;
        const rect = this.svg.getBoundingClientRect();
        this.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        this.svg.setAttribute('width', rect.width);
        this.svg.setAttribute('height', rect.height);
        this.clearLines();
        this.createLines();
    }

    clearLines() {
        this.lines = [];
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }
    }

    createLines() {
        this.sources = Array.from(document.querySelectorAll(this.sourceSelector));
        this.nodes = Array.from(document.querySelectorAll(this.nodeSelector));
        const sourceCenters = this.sources.map(el => this.getCenter(el));
        const nodeCenters = this.nodes.map(el => this.getCenter(el));

        sourceCenters.forEach((source, index) => {
            const node = nodeCenters[index % nodeCenters.length] || { x: this.svg.viewBox.baseVal.width / 2, y: this.svg.viewBox.baseVal.height / 2 };
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('network-line');
            this.svg.appendChild(path);
            this.lines.push({ path, source, node, index });
        });

        if (this.sources.length > 1) {
            for (let i = 0; i < sourceCenters.length - 1; i++) {
                const source = sourceCenters[i];
                const target = sourceCenters[i + 1];
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.classList.add('network-line');
                this.svg.appendChild(path);
                this.lines.push({ path, source, node: target, index: i + 10 });
            }
        }
    }

    getCenter(element) {
        const rect = element.getBoundingClientRect();
        const svgRect = this.svg.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - svgRect.left,
            y: rect.top + rect.height / 2 - svgRect.top
        };
    }

    animate() {
        if (!this.svg) return;
        this.time = performance.now() * 0.001;

        this.lines.forEach((line, index) => {
            const wobble = Math.sin(this.time + index * 0.7) * 16;
            const midX = (line.source.x + line.node.x) / 2;
            const midY = (line.source.y + line.node.y) / 2 + wobble;
            const d = `M ${line.source.x} ${line.source.y} Q ${midX} ${midY} ${line.node.x} ${line.node.y}`;
            line.path.setAttribute('d', d);
        });

        requestAnimationFrame(() => this.animate());
    }
}

/* ============================
   NAVBAR SCROLL EFFECT
   ============================ */

class LogoParticles {
    constructor(canvasId, imageSelector) {
        this.canvas = document.getElementById(canvasId);
        this.img = document.querySelector(imageSelector);
        if (!this.canvas || !this.img) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.count = 36;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initParticles();
        this.animate();
    }

    resize() {
        const ratio = devicePixelRatio || 1;
        this.canvas.width = Math.floor(this.canvas.offsetWidth * ratio);
        this.canvas.height = Math.floor(this.canvas.offsetHeight * ratio);
        this.canvas.style.width = this.canvas.offsetWidth + 'px';
        this.canvas.style.height = this.canvas.offsetHeight + 'px';
        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.rect = this.img.getBoundingClientRect();
    }

    initParticles() {
        this.particles = [];
        const rect = this.img.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        const cx = rect.left + rect.width/2 - canvasRect.left;
        const cy = rect.top + rect.height/2 - canvasRect.top;
        const radius = Math.min(rect.width, rect.height)/2 * 0.9;
        for (let i = 0; i < this.count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            this.particles.push({
                x: cx + Math.cos(ang) * r,
                y: cy + Math.sin(ang) * r,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                size: Math.random() * 2 + 0.6
            });
        }
    }

    animate() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
        const rect = this.img.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        const cx = rect.left + rect.width/2 - canvasRect.left;
        const cy = rect.top + rect.height/2 - canvasRect.top;
        const radius = Math.min(rect.width, rect.height)/2 * 0.95;

        for (let p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > radius) {
                const ang = Math.atan2(dy, dx);
                p.x = cx + Math.cos(ang) * (radius * 0.95);
                p.y = cy + Math.sin(ang) * (radius * 0.95);
                p.vx *= -0.6;
                p.vy *= -0.6;
            }

            const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
            g.addColorStop(0, 'rgba(0,212,255,0.95)');
            g.addColorStop(0.3, 'rgba(123,97,255,0.6)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = g;
            this.ctx.fillRect(p.x - p.size*3, p.y - p.size*3, p.size*6, p.size*6);
        }

        requestAnimationFrame(() => this.animate());
    }
}

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

let latestAssessment = null;
const TELEGRAM_BOT_USERNAME = 'NotablePathBot';

function normalizeArticleStatus(value) {
    return {
        yes: 'Existing article',
        no: 'No article',
        unsure: 'Unsure'
    }[value] || 'Unknown';
}

function normalizeCoverage(value) {
    return {
        'yes-major': 'Major publications',
        'yes-minor': 'Some coverage',
        no: 'Minimal coverage'
    }[value] || 'Unknown';
}

function normalizeProfileType(value) {
    return {
        founder: 'Founder',
        business: 'Business',
        author: 'Author',
        artist: 'Artist',
        organization: 'Organization',
        'public-figure': 'Public Figure',
        other: 'Other'
    }[value] || 'Other';
}

function calculateAssessmentScore(q1, q2, q3) {
    const q1Scores = { yes: 30, no: 15, unsure: 10 };
    const q2Scores = { 'yes-major': 40, 'yes-minor': 25, no: 5 };
    const q3Scores = { founder: 15, business: 15, author: 20, artist: 15, organization: 15, 'public-figure': 20, other: 10 };
    const q3Total = q3.reduce((sum, value) => sum + (q3Scores[value] || 0), 0);
    return Math.min(100, (q1Scores[q1] || 0) + (q2Scores[q2] || 0) + q3Total);
}

function getReadinessCategory(score) {
    if (score >= 70) return 'Promising';
    if (score >= 40) return 'Requires Further Review';
    return 'Early Stage';
}

function toSlug(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function buildAssessmentSubject(article, coverage, profile) {
    return `${profile} • ${article} • ${coverage}`;
}

async function saveWebsiteAssessment(assessment) {
    const apiUrl = `${window.location.origin}/api/website-assessment`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessment)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save assessment');
    }

    return response.json();
}

function showAssessmentResult(assessment) {
    const resultSection = document.getElementById('assessmentResult');
    if (!resultSection) return;

    resultSection.querySelector('.result-summary').textContent = `Based on your answers, we calculated a readiness score that helps determine your best next step.`;
    resultSection.querySelector('.result-score').textContent = `${assessment.score}`;
    resultSection.querySelector('.result-category').textContent = assessment.readinessCategory;
    resultSection.querySelector('.result-detail').textContent = `Article status: ${assessment.articleStatus} · Coverage: ${assessment.coverageLabel} · Profile: ${assessment.profileLabel}`;
    resultSection.hidden = false;
}

function openConversionModal(assessment = null) {
    const modal = document.getElementById('conversionModal');
    if (!modal) return;

    if (assessment) {
        latestAssessment = assessment;
    }

    const summary = latestAssessment || {};
    modal.querySelector('.summary-score').textContent = summary.score ? `${summary.score}` : 'Pending';
    modal.querySelector('.summary-category').textContent = summary.readinessCategory || 'Assessment not completed';
    modal.querySelector('.summary-profile').textContent = summary.profileLabel || 'Website Visitor';
    const conversionStatus = modal.querySelector('.conversion-status');
    if (conversionStatus) {
        conversionStatus.textContent = '';
    }
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    modal.querySelector('[data-action="open-telegram-assistant"]')?.focus();
}

function closeConversionModal() {
    const modal = document.getElementById('conversionModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function openTelegramAssistant() {
    if (!latestAssessment) {
        openConversionModal();
        return;
    }

    const profileSlug = toSlug(latestAssessment.profileSlug || latestAssessment.profileLabel || 'website');
    const categorySlug = toSlug(latestAssessment.readinessCategory || 'review');
    const startParam = `website_${profileSlug}_${categorySlug}`;
    const url = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(startParam)}`;
    window.open(url, '_blank');
    trackEvent('OpenTelegramAssistant', {
        score: latestAssessment.score,
        category: latestAssessment.readinessCategory,
        profile: latestAssessment.profileLabel
    });
}

function openConsultationBooking() {
    const bookingUrl = 'https://calendly.com/notablepath/30min';
    window.open(bookingUrl, '_blank');
    trackEvent('OpenConsultationBooking', {});
}

async function submitAssessment() {
    const q1 = document.querySelector('input[name="q1"]:checked')?.value;
    const q2 = document.querySelector('input[name="q2"]:checked')?.value;
    const q3Values = Array.from(document.querySelectorAll('input[name="q3"]:checked')).map(el => el.value);

    if (!q1 || !q2 || q3Values.length === 0) {
        alert('Please answer all questions before submitting.');
        return;
    }

    const articleStatus = normalizeArticleStatus(q1);
    const coverageLabel = normalizeCoverage(q2);
    const profileLabels = q3Values.map(normalizeProfileType);
    const primaryProfile = profileLabels[0] || 'Website Visitor';
    const score = calculateAssessmentScore(q1, q2, q3Values);
    const readinessCategory = getReadinessCategory(score);
    const subject = buildAssessmentSubject(articleStatus, coverageLabel, primaryProfile);

    const assessment = {
        telegram_id: 0,
        username: null,
        full_name: 'Website Visitor',
        request_type: 'Website Assessment',
        subject,
        goal: 'Wikipedia Readiness Assessment',
        wiki_status: readinessCategory,
        contact_type: 'website',
        contact_value: null,
        lead_status: 'new',
        source: 'website',
        question_1: articleStatus,
        question_2: coverageLabel,
        question_3: profileLabels.join(', '),
        readiness_score: score,
        readiness_category: readinessCategory,
        timestamp: new Date().toISOString(),
        articleStatus,
        coverageLabel,
        profileLabel: primaryProfile,
        profileSlug: primaryProfile
    };

    latestAssessment = assessment;
    showAssessmentResult(assessment);
    trackEvent('AssessmentSubmitted', {
        question_1: articleStatus,
        question_2: coverageLabel,
        question_3: profileLabels,
        score,
        readinessCategory
    });

    const modal = document.getElementById('conversionModal');
    const statusElement = modal ? modal.querySelector('.conversion-status') : null;
    if (statusElement) {
        statusElement.textContent = 'Saving your assessment...';
    }

    try {
        await saveWebsiteAssessment(assessment);
        if (statusElement) {
            statusElement.textContent = 'Your assessment is recorded and ready for follow-up.';
        }
        trackEvent('AssessmentSaved', { score, readinessCategory });
    } catch (error) {
        if (statusElement) {
            statusElement.textContent = 'There was an issue saving your assessment. You can still continue and our team will follow up manually.';
        }
        trackEvent('AssessmentSaveFailed', { error: error.message });
    }

    openConversionModal(assessment);
}

function initConversionModal() {
    const modal = document.getElementById('conversionModal');
    if (!modal) return;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeConversionModal();
        }
    });

    modal.querySelector('.conversion-close')?.addEventListener('click', closeConversionModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeConversionModal();
        }
    });

    document.querySelectorAll('[data-action="open-conversion-modal"]').forEach(element => {
        element.addEventListener('click', (event) => {
            event.preventDefault();
            openConversionModal(latestAssessment);
        });
    });

    document.querySelector('[data-action="open-telegram-assistant"]')?.addEventListener('click', openTelegramAssistant);
    document.querySelector('[data-action="open-consultation-booking"]')?.addEventListener('click', openConsultationBooking);
}

/* ============================
   FAQ ACCORDION
   ============================
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
    if (document.querySelector('.network-lines')) {
        new HeroNetwork('.network-lines', '.visual-overlay .source-card', '.network-node');
    }
    if (document.getElementById('logoParticleCanvas')) {
        new LogoParticles('logoParticleCanvas', '.hero-logo-img img');
    }
    
    // Initialize all features
    initNavbarScroll();
    initScrollReveal();
    initSmoothScroll();
    initFAQ();
    initMagneticButtons();
    initMobileNavbar();
    initAboutModal();
    initConversionModal();
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
