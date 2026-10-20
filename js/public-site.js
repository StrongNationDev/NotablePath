(() => {
  const script = document.currentScript;
  if (!script || !document.body || document.body.dataset.page === 'home') return;

  const siteRoot = new URL('../', script.src);
  const siteUrl = path => new URL(path, siteRoot).href;
  const stylesheetUrl = siteUrl('css/public-site.css');
  const hasSharedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(link => link.href === stylesheetUrl || link.href.endsWith('/css/insights.css'));

  if (!hasSharedStyles) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = stylesheetUrl;
    document.head.append(stylesheet);
  }

  document.body.classList.add('public-modern');

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <nav class="navbar" aria-label="Main navigation">
      <div class="navbar-inner">
        <a class="navbar-logo" href="${siteUrl('index.html')}" aria-label="NotablePath home">
          <img src="${siteUrl('images/notablepath-logo.png')}" alt="" class="site-logo" width="180" height="48">
        </a>
        <button class="navbar-toggle" type="button" aria-label="Open navigation" aria-controls="primary-menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <ul class="navbar-menu" id="primary-menu">
          <li><a href="${siteUrl('index.html#situations')}">How Can We Help?</a></li>
          <li><a href="${siteUrl('services.html')}">Services</a></li>
          <li><a href="${siteUrl('index.html#process')}">How It Works</a></li>
          <li><a href="${siteUrl('index.html#help-center')}">Help Centre</a></li>
          <li><a href="${siteUrl('About%20Us/index.html')}">About</a></li>
          <li><a href="mailto:hello@notablepath.online">Contact</a></li>
          <li class="mobile-menu-action"><button class="btn btn-primary" type="button" data-open-consultation>Discuss Your Project</button></li>
        </ul>
        <button class="btn btn-primary navbar-cta" type="button" data-open-consultation data-analytics="consultation-open">Discuss Your Project</button>
      </div>
    </nav>`;

  const existingHeader = document.querySelector('header, body > nav.navbar');
  if (existingHeader) existingHeader.replaceWith(header);
  else document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="content-width footer-grid">
      <div class="footer-brand">
        <a href="${siteUrl('index.html')}"><img src="${siteUrl('images/notablepath-lo.png')}" alt="" width="180" height="48"><span class="brand-name">otablePath</span></a>
        <p>Independent Wikipedia research, editing, and consultation.</p>
        <p class="footer-independence">Not affiliated with or endorsed by Wikipedia or the Wikimedia Foundation.</p>
      </div>
      <div><h2>Company</h2><ul><li><a href="${siteUrl('About%20Us/index.html')}">About NotablePath</a></li><li><a href="${siteUrl('services.html')}">Services</a></li><li><a href="mailto:hello@notablepath.online">Contact</a></li></ul></div>
      <div><h2>Resources</h2><ul><li><a href="${siteUrl('index.html#help-center')}">Wikipedia Help Centre</a></li><li><a href="${siteUrl('insights/')}">Insights</a></li><li><a href="${siteUrl('insights/update-existing-wikipedia-biography/')}">Wikipedia Editor</a></li></ul></div>
      <div><h2>Contact</h2><ul><li><a href="mailto:hello@notablepath.online">hello@notablepath.online</a></li><li><a href="mailto:contact@notablepath.online">contact@notablepath.online</a></li><li><a href="https://www.facebook.com/notablepathc" target="_blank" rel="noopener noreferrer">Facebook</a></li></ul></div>
    </div>
    <div class="content-width footer-bottom"><span>&copy; 2026 NotablePath. All rights reserved.</span><span>Research-led guidance. Clear next steps.</span></div>`;
  const existingFooter = document.querySelector('footer');
  if (existingFooter) existingFooter.replaceWith(footer);
  else document.body.append(footer);

  const backdrop = document.createElement('div');
  backdrop.className = 'consultation-backdrop';
  backdrop.dataset.closeConsultation = '';
  backdrop.hidden = true;

  const dialog = document.createElement('section');
  dialog.className = 'consultation-dialog';
  dialog.id = 'consultation-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'consultation-title');
  dialog.setAttribute('aria-describedby', 'consultation-description');
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="consultation-header">
      <div><p class="eyebrow">NotablePath enquiry</p><h2 id="consultation-title">Tell us about your project</h2></div>
      <button class="dialog-close" type="button" aria-label="Close enquiry form" data-close-consultation>&times;</button>
    </div>
    <p id="consultation-description" class="consultation-intro">Share a little context and we will review whether our research or editorial services may fit. Please do not include passwords, payment details, or sensitive identity information.</p>
    <form id="consultation-form" class="consultation-form" novalidate>
      <label for="consultation-topic">What would you like help with?</label>
      <select id="consultation-topic" name="Topic" required>
        <option value="">Choose a topic</option>
        <option>New Wikipedia article</option><option>Rejected Wikipedia draft</option><option>Existing Wikipedia article</option><option>Article nominated for deletion</option><option>Wikipedia notability and source research</option><option>Wikipedia Eligibility &amp; Source Assessment</option><option>Wikipedia Editing &amp; Draft Development</option><option>Google Knowledge Panel assistance</option><option>General enquiry</option>
      </select>
      <label for="consultation-message">Briefly describe what you need help with</label>
      <textarea id="consultation-message" name="Project description" rows="4" maxlength="2000" minlength="20" required></textarea>
      <p class="field-hint">20 to 2,000 characters. Avoid sharing confidential or sensitive information.</p>
      <label for="consultation-name">Name or preferred contact name</label>
      <input id="consultation-name" name="Name" type="text" autocomplete="name" maxlength="120" required>
      <label for="consultation-email">Email address</label>
      <input id="consultation-email" name="Email address" type="email" autocomplete="email" maxlength="254" required>
      <label for="consultation-url">Existing article or draft URL <span>(optional)</span></label>
      <input id="consultation-url" name="Article or draft URL" type="url" maxlength="500" placeholder="https://">
      <label class="consent-line"><input type="checkbox" name="Privacy acknowledgement" value="Acknowledged" required><span>I understand this enquiry will be sent to NotablePath by email for review.</span></label>
      <div class="form-status" id="consultation-status" role="status" aria-live="polite"></div>
      <button class="btn btn-primary submit-enquiry" type="submit">Send Enquiry</button>
      <p class="form-footnote">This form is for an initial enquiry, not a persistent live chat. Ongoing conversations are handled through the authenticated client workspace.</p>
    </form>`;
  document.body.append(backdrop, dialog);

  const toggle = header.querySelector('.navbar-toggle');
  const menu = header.querySelector('.navbar-menu');
  const closeMenu = () => {
    menu.classList.remove('mobile-open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  };
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('mobile-open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a, button')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
  toggle.setAttribute('data-public-managed', '');

  const consultationScript = document.createElement('script');
  consultationScript.src = siteUrl('js/homepage-redesign.js');
  consultationScript.onerror = () => console.error('NotablePath enquiry form could not be initialized.');
  document.body.append(consultationScript);
})();
