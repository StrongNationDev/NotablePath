(function () {
  const FALLBACK_CATEGORY = 'PR & Communications';
  const FALLBACK_COMPANY = 'Your Organization';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeText(value, fallback = FALLBACK_COMPANY) {
    const raw = value == null ? '' : String(value).trim();
    if (!raw) return fallback;

    let cleaned = raw;
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (error) {
      cleaned = raw;
    }

    cleaned = cleaned
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return fallback;
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200).trim();
    }

    return cleaned;
  }

  function sanitizeCategory(value) {
    const raw = value == null ? '' : String(value).trim();
    if (!raw) return FALLBACK_CATEGORY;

    let cleaned = raw;
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (error) {
      cleaned = raw;
    }

    cleaned = cleaned
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return FALLBACK_CATEGORY;

    if (cleaned.length > 180) {
      cleaned = cleaned.substring(0, 180).trim();
    }

    return cleaned;
  }

  function getCategory() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('category');
    const value = sanitizeCategory(raw);
    return value || FALLBACK_CATEGORY;
  }

  function formatSubtitle(category) {
    const label = category.trim();
    const normalized = label.toLowerCase();

    if (normalized.includes('agency') || normalized.includes('communications') || normalized.includes('relations')) {
      return `Prepared for professionals in ${label}`;
    }

    if (normalized.includes('pr') || normalized.includes('public relations')) {
      return `Prepared for the ${label} sector`;
    }

    return `Prepared for a ${label} professional`;
  }

  function formatSectorText(category) {
    const label = category.trim();
    if (!label) return FALLBACK_CATEGORY;
    return label;
  }

  function getCompanyName() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('company');
    return sanitizeText(raw, FALLBACK_COMPANY);
  }

  function updateDate() {
    const el = document.getElementById('researchDate');
    if (!el) return;

    const today = new Date();
    el.textContent = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function injectCompanyName() {
    const companyName = getCompanyName();
    const companyNode = document.getElementById('companyNameDisplay');
    if (!companyNode) return;

    companyNode.textContent = `Prepared for: ${escapeHtml(companyName)}`;
  }

  function injectCategory() {
    const category = getCategory();
    const safeCategory = escapeHtml(category);

    const titleHint = document.getElementById('subtitleLabel');
    if (titleHint) {
      titleHint.textContent = formatSubtitle(category);
    }

    const sectorNodes = document.querySelectorAll('#researchSector, #categoryContext');
    sectorNodes.forEach((node) => {
      node.textContent = formatSectorText(category);
    });

    document.title = `PR Agency Research | NotablePath`;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute(
        'content',
        `A NotablePath research brief exploring public knowledge footprints, independent coverage and Wikipedia readiness for ${safeCategory} professionals.`
      );
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute(
        'content',
        `A NotablePath research brief exploring public knowledge footprints, independent coverage and Wikipedia readiness for ${safeCategory} professionals.`
      );
    }

    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) {
      twitterDescription.setAttribute(
        'content',
        `A NotablePath research brief exploring public knowledge footprints, independent coverage and Wikipedia readiness for ${safeCategory} professionals.`
      );
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    injectCompanyName();
    injectCategory();
  });
})();
