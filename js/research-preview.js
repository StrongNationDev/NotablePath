const SITE_CONFIG = {
  siteName: 'NotablePath',
  siteUrl: 'https://preview.notablepath.online',
  canonicalPath: '/research',
  ctaUrls: {
    assessment: 'https://notablepath.online/services.html',
    consultation: 'mailto:hello@notablepath.online'
  },
  footerLinks: {
    services: 'https://notablepath.online/services.html',
    process: 'https://notablepath.online/#process',
    about: 'https://notablepath.online/#about',
    contact: 'mailto:hello@notablepath.online'
  }
};

const researchData = {
  company: null,
  observation: '[Company] appears across multiple public sources, but information about the organization is distributed across different publications and reference points rather than consolidated in a single neutral knowledge resource.',
  sourceCount: 'Multiple public references',
  sourceCategories: ['public reporting', 'industry coverage', 'organizational materials'],
  readinessStatus: 'Assessment required'
};

const analytics = {
  track(eventName, eventProperties = {}) {
    const payload = {
      event: eventName,
      ...eventProperties,
      timestamp: new Date().toISOString()
    };

    if (window.analyticsQueue) {
      window.analyticsQueue.push(payload);
    } else {
      window.analyticsQueue = [payload];
    }

    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }

    if (window.gtag) {
      window.gtag('event', eventName, eventProperties);
    }

    if (window.plausible) {
      window.plausible(eventName, { props: eventProperties });
    }
  }
};

function sanitizeText(value, fallback = 'Your Organization') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  let cleaned = String(value).trim();

  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (error) {
    cleaned = String(value).trim();
  }

  cleaned = cleaned
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function getCompanyName() {
  const params = getQueryParams();
  const rawValue = params.get('company');
  return sanitizeText(rawValue, 'Your Organization');
}

function renderOptionalProfileMeta() {
  const params = getQueryParams();
  const metaContainer = document.getElementById('profile-meta');

  if (!metaContainer) {
    return;
  }

  const details = [];
  const firstName = sanitizeText(params.get('first'), '', true);
  const industry = sanitizeText(params.get('industry'), '', true);

  if (firstName) {
    details.push(`Contact: ${firstName}`);
  }

  if (industry) {
    details.push(`Industry: ${industry}`);
  }

  if (researchData.sourceCount) {
    details.push(researchData.sourceCount);
  }

  if (researchData.sourceCategories && researchData.sourceCategories.length) {
    details.push(researchData.sourceCategories.join(' • '));
  }

  metaContainer.innerHTML = '';

  details.forEach((detail) => {
    const item = document.createElement('span');
    item.className = 'profile-meta-item';
    item.textContent = detail;
    metaContainer.appendChild(item);
  });
}

function setDynamicText() {
  const companyName = getCompanyName();
  const hasCompanyParam = new URLSearchParams(window.location.search).has('company');
  researchData.company = companyName;

  const companyNodes = document.querySelectorAll('[data-company-name]');
  companyNodes.forEach((element) => {
    element.textContent = companyName;
  });

  document.title = hasCompanyParam
    ? `${companyName} — Public Knowledge Footprint | NotablePath`
    : 'Public Knowledge Footprint | NotablePath';

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      'content',
      `${companyName}: preliminary public knowledge footprint review prepared by NotablePath.`
    );
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute('content', `${companyName} — Public Knowledge Footprint | NotablePath`);
  }

  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    ogDescription.setAttribute(
      'content',
      `A preliminary public knowledge footprint review for ${companyName} prepared by NotablePath.`
    );
  }

  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) {
    twitterTitle.setAttribute('content', `${companyName} — Public Knowledge Footprint | NotablePath`);
  }

  const twitterDescription = document.querySelector('meta[name="twitter:description"]');
  if (twitterDescription) {
    twitterDescription.setAttribute(
      'content',
      `A preliminary public knowledge footprint review for ${companyName} prepared by NotablePath.`
    );
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  const currentUrl = new URL(window.location.href);
  const baseCanonical = `${SITE_CONFIG.siteUrl}${SITE_CONFIG.canonicalPath}`;

  if (canonical) {
    canonical.setAttribute('href', baseCanonical);
  }

  const currentDate = new Date();
  const dateText = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const dateNode = document.getElementById('research-date');
  if (dateNode) {
    dateNode.textContent = dateText;
  }

  const observationText = document.getElementById('observation-text');
  if (observationText) {
    const observation = researchData.observation.replace(/\[Company\]/g, companyName);
    observationText.textContent = observation;
  }

  renderOptionalProfileMeta();
}

function initCtaUrls() {
  const assessmentLink = document.getElementById('cta-assessment');
  const consultationLink = document.getElementById('cta-consultation');
  const headerLink = document.getElementById('header-cta');

  if (assessmentLink) {
    assessmentLink.href = SITE_CONFIG.ctaUrls.assessment;
  }

  if (consultationLink) {
    consultationLink.href = SITE_CONFIG.ctaUrls.consultation;
  }

  if (headerLink) {
    headerLink.href = SITE_CONFIG.ctaUrls.assessment;
  }
}

function initAnalytics() {
  const params = new URLSearchParams(window.location.search);

  analytics.track('page_view', {
    company: researchData.company || 'unknown',
    source: 'cold-email-preview',
    utm_source: params.get('utm_source') || null,
    utm_medium: params.get('utm_medium') || null,
    utm_campaign: params.get('utm_campaign') || null,
    utm_content: params.get('utm_content') || null
  });

  analytics.track('research_preview_viewed', {
    company: researchData.company || 'unknown'
  });

  document.querySelectorAll('[data-analytics]').forEach((element) => {
    element.addEventListener('click', (event) => {
      const eventName = element.getAttribute('data-analytics');
      analytics.track(eventName, {
        company: researchData.company || 'unknown',
        href: element.getAttribute('href') || ''
      });
    });
  });

  const trackedThresholds = [25, 50, 75, 100];
  let maxScrollDepth = 0;

  const handleScrollDepth = () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentScroll = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
    const rounded = Math.min(100, Math.round(currentScroll));

    trackedThresholds.forEach((threshold) => {
      if (rounded >= threshold && maxScrollDepth < threshold) {
        maxScrollDepth = threshold;
        analytics.track('scroll_depth', {
          company: researchData.company || 'unknown',
          depth: threshold
        });
      }
    });
  };

  window.addEventListener('scroll', handleScrollDepth, { passive: true });
  handleScrollDepth();
}

function initResearchProfileArchitecture() {
  // Future architecture hook:
  // Replace the URL-only company fallback with a server-side lookup using ?id=RP-12345.
  // Example: if params.get('id') is present, fetch /api/research-profiles/:id and hydrate researchData.
  // For the MVP, this page intentionally uses the company query parameter and does not depend on a database.
  const params = getQueryParams();
  const researchId = sanitizeText(params.get('id'), '', true);

  if (researchId) {
    document.body.dataset.researchId = researchId;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setDynamicText();
  initResearchProfileArchitecture();
  initCtaUrls();
  initAnalytics();
});
