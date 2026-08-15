/**
 * RESEARCHS.JS - Dynamic Research Preview for /researchs/
 * 
 * Handles:
 * - URL parameter extraction (company, first)
 * - Wikipedia article lookup
 * - Research state management
 * - Dynamic content rendering
 * - Security (XSS prevention, input sanitization)
 */

const RESEARCHS_CONFIG = {
  siteName: 'NotablePath',
  siteUrl: 'https://notablepath.online',
  ctaUrls: {
    assessment: 'https://notablepath.online/services.html',
    consultation: 'mailto:hello@notablepath.online'
  },
  footerLinks: {
    services: 'https://notablepath.online/services.html',
    process: 'https://notablepath.online/#process',
    about: 'https://notablepath.online/#about',
    contact: 'mailto:hello@notablepath.online'
  },
  // Wikipedia API configuration
  wikipedia: {
    apiUrl: 'https://en.wikipedia.org/w/api.php',
    timeout: 8000, // 8 seconds
    searchLimit: 5
  },
  // Input validation limits
  limits: {
    company: 200,
    firstName: 80
  }
};

// Research state tracking
const RESEARCH_STATE = {
  LOADING: 'loading',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid'
};

// Wikipedia lookup result states
const WIKIPEDIA_STATE = {
  IDENTIFIED: 'identified',
  NOT_FOUND: 'not_found',
  UNAVAILABLE: 'unavailable'
};

/**
 * Sanitize text input for safe DOM insertion
 * @param {*} value - Raw input value
 * @param {string} fallback - Default value if input is invalid
 * @param {boolean} allowEmpty - Allow empty string (different from fallback)
 * @returns {string} Sanitized text
 */
function sanitizeText(value, fallback = 'Your Organization', allowEmpty = false) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  // Convert to string and trim
  let cleaned = String(value).trim();

  // Handle empty after trim
  if (cleaned === '' && !allowEmpty) {
    return fallback;
  }

  if (cleaned === '' && allowEmpty) {
    return '';
  }

  // Decode URL encoding
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (error) {
    cleaned = String(value).trim();
  }

  // Remove control characters and HTML tags
  cleaned = cleaned
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // Control chars
    .replace(/<[^>]*>/g, ' ')                // HTML tags
    .replace(/\s+/g, ' ')                    // Multiple spaces
    .trim();

  // Validate after sanitization
  if (cleaned === '') {
    return allowEmpty ? '' : fallback;
  }

  // Check length limits
  if (cleaned.length > RESEARCHS_CONFIG.limits.company) {
    cleaned = cleaned.substring(0, RESEARCHS_CONFIG.limits.company);
  }

  return cleaned;
}

/**
 * Get URL query parameters safely
 * @returns {URLSearchParams} Parsed query parameters
 */
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

/**
 * Extract company name from URL
 * @returns {string} Sanitized company name
 */
function getCompanyName() {
  const params = getQueryParams();
  const rawValue = params.get('company');
  return sanitizeText(rawValue, 'Your Organization');
}

/**
 * Extract first name from URL
 * @returns {string} Sanitized first name or empty string
 */
function getFirstName() {
  const params = getQueryParams();
  const rawValue = params.get('first');
  return sanitizeText(rawValue, '', true).substring(0, RESEARCHS_CONFIG.limits.firstName);
}

/**
 * Check if a valid company name was provided
 * @returns {boolean}
 */
function hasValidCompany() {
  const params = getQueryParams();
  return params.has('company') && params.get('company') && params.get('company').trim() !== '';
}

/**
 * Update page title and meta tags with company name
 * @param {string} companyName
 */
function updateMetaTags(companyName) {
  const hasCompanyParam = hasValidCompany();
  
  document.title = hasCompanyParam
    ? `${companyName} — Public Knowledge Footprint | NotablePath`
    : 'Public Knowledge Footprint | NotablePath';

  // Update description meta
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      'content',
      `${companyName}: preliminary public knowledge footprint review prepared by NotablePath.`
    );
  }

  // Update OG title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute('content', `${companyName} — Public Knowledge Footprint | NotablePath`);
  }

  // Update OG description
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    ogDescription.setAttribute(
      'content',
      `${companyName}: preliminary public knowledge footprint review prepared by NotablePath.`
    );
  }
}

/**
 * Set dynamic text throughout the page
 * @param {string} companyName
 * @param {string} firstName
 */
function setDynamicContent(companyName, firstName) {
  // Update company name throughout the page
  const companyNodes = document.querySelectorAll('[data-company-name]');
  companyNodes.forEach((element) => {
    element.textContent = companyName;
  });

  // Update research date
  const dateElement = document.getElementById('research-date');
  if (dateElement) {
    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    dateElement.textContent = dateString;
  }

  // Add personalized greeting if first name is provided
  if (firstName) {
    const leadElement = document.getElementById('lead-text');
    if (leadElement) {
      leadElement.innerHTML = `Hi ${escapeHtml(firstName)},<br><br>This research snapshot was prepared to help assess how ${escapeHtml(companyName)} appears in publicly available information and what a closer review might examine.`;
    }

    // Add first name to profile meta
    const profileMeta = document.getElementById('profile-meta');
    if (profileMeta) {
      const metaItem = document.createElement('span');
      metaItem.className = 'profile-meta-item';
      metaItem.textContent = `Prepared for: ${firstName}`;
      profileMeta.appendChild(metaItem);
    }
  }

  // Update meta tags
  updateMetaTags(companyName);
}

/**
 * Escape HTML special characters for safe display
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Set research state indicator
 * @param {string} state - One of RESEARCH_STATE values
 * @param {string} message - User-facing message
 */
function setResearchState(state, message) {
  const stateIndicator = document.getElementById('state-indicator');
  if (!stateIndicator) return;

  const stateDot = stateIndicator.querySelector('.state-dot');
  const stateText = stateIndicator.querySelector('.state-text');

  if (stateDot) {
    stateDot.classList.remove('loading', 'success', 'error');
    if (state === RESEARCH_STATE.LOADING) {
      stateDot.classList.add('loading');
    } else if (state === RESEARCH_STATE.SUCCESS || state === RESEARCH_STATE.PARTIAL) {
      stateDot.classList.add('success');
    } else {
      stateDot.classList.add('error');
    }
  }

  if (stateText) {
    stateText.textContent = message;
  }
}

/**
 * Query Wikipedia API for company article
 * @param {string} companyName
 * @returns {Promise<Object>} Result with status and optional article URL
 */
async function queryWikipedia(companyName) {
  if (!companyName) {
    return {
      status: WIKIPEDIA_STATE.UNAVAILABLE,
      error: 'No company name provided'
    };
  }

  const cleanName = companyName.trim();

  try {
    // Use JSONP to avoid CORS issues
    const searchUrl = new URL(RESEARCHS_CONFIG.wikipedia.apiUrl);
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', cleanName);
    searchUrl.searchParams.set('srnamespace', '0'); // Main namespace only
    searchUrl.searchParams.set('srlimit', String(RESEARCHS_CONFIG.wikipedia.searchLimit));
    searchUrl.searchParams.set('origin', '*'); // Allow CORS

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RESEARCHS_CONFIG.wikipedia.timeout);

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: WIKIPEDIA_STATE.UNAVAILABLE,
        error: `API returned ${response.status}`
      };
    }

    const data = await response.json();

    // Check if search returned results
    if (!data.query || !data.query.search || data.query.search.length === 0) {
      return {
        status: WIKIPEDIA_STATE.NOT_FOUND,
        company: companyName
      };
    }

    // Get the first result
    const result = data.query.search[0];

    // Verify the result is actually relevant
    // by checking if the search term appears in title or snippet
    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    const searchLower = cleanName.toLowerCase();

    // Check for reasonable match
    if (titleLower.includes(searchLower) || 
        (snippetLower.includes(searchLower) && result.title.split(' ').length <= 6)) {
      
      // Build Wikipedia article URL
      const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`;

      return {
        status: WIKIPEDIA_STATE.IDENTIFIED,
        title: result.title,
        snippet: result.snippet,
        url: articleUrl,
        company: companyName
      };
    }

    // If no good match found
    return {
      status: WIKIPEDIA_STATE.NOT_FOUND,
      company: companyName
    };
  } catch (error) {
    console.error('Wikipedia lookup error:', error);
    return {
      status: WIKIPEDIA_STATE.UNAVAILABLE,
      error: error.message || 'Lookup failed'
    };
  }
}

/**
 * Update observation text based on Wikipedia result
 * @param {Object} wikiResult - Result from queryWikipedia
 * @param {string} companyName
 */
function updateObservationText(wikiResult, companyName) {
  const observationText = document.getElementById('observation-text');
  if (!observationText) return;

  if (wikiResult.status === WIKIPEDIA_STATE.IDENTIFIED) {
    observationText.textContent = `Our research identified a Wikipedia article for ${companyName}. This indicates the organization is recognized as having noteworthy public presence and significance in its field. Your next step should be evaluating how the article represents your organization and identifying any gaps in coverage.`;
  } else if (wikiResult.status === WIKIPEDIA_STATE.NOT_FOUND) {
    observationText.textContent = `Currently, there is no Wikipedia article identified for ${companyName}. This presents an opportunity to build stronger independent coverage and public recognition. Many successful organizations build their public record before pursuing Wikipedia documentation.`;
  } else {
    observationText.textContent = `The research lookup for ${companyName} could not be completed at this time. We recommend conducting a manual Wikipedia search or reaching out to discuss alternative approaches to your public knowledge strategy.`;
  }
}

/**
 * Show/hide Wikipedia readiness content based on article status
 * @param {Object} wikiResult - Result from queryWikipedia
 */
function updateWikipediaReadinessContent(wikiResult) {
  const contentIdentified = document.getElementById('wikipedia-content-identified');
  const contentNotFound = document.getElementById('wikipedia-content-not-found');

  if (!contentIdentified || !contentNotFound) return;

  // Hide both initially
  contentIdentified.classList.add('hidden');
  contentNotFound.classList.add('hidden');

  // Show appropriate content
  if (wikiResult.status === WIKIPEDIA_STATE.IDENTIFIED) {
    contentIdentified.classList.remove('hidden');
  } else {
    contentNotFound.classList.remove('hidden');
  }
}

/**
 * Display Wikipedia result in the page
 * @param {Object} wikiResult - Result from queryWikipedia
 */
function displayWikipediaResult(wikiResult) {
  const resultContainer = document.getElementById('wikipedia-result');
  if (!resultContainer) return;

  resultContainer.innerHTML = ''; // Clear previous content

  let html = '<div class="wikipedia-result-content">';

  if (wikiResult.status === WIKIPEDIA_STATE.IDENTIFIED) {
    resultContainer.classList.remove('not-found', 'unavailable');
    html += `
      <span class="wikipedia-result-status success">
        ✓ Wikipedia: Article identified
      </span>
      <a href="${escapeHtml(wikiResult.url)}" 
         target="_blank" 
         rel="noopener noreferrer"
         class="wikipedia-link"
         data-analytics="wikipedia-article-link">
        View Wikipedia article
      </a>
    `;
  } else if (wikiResult.status === WIKIPEDIA_STATE.NOT_FOUND) {
    resultContainer.classList.add('not-found');
    resultContainer.classList.remove('unavailable');
    html += `
      <span class="wikipedia-result-status not-found">
        ◆ Wikipedia: No article identified
      </span>
      <p style="margin: 0; color: var(--muted); font-size: 0.9rem;">
        A Wikipedia article was not identified in the initial lookup. This does not determine notability—it only indicates the current state of Wikipedia's database.
      </p>
    `;
  } else if (wikiResult.status === WIKIPEDIA_STATE.UNAVAILABLE) {
    resultContainer.classList.add('unavailable');
    resultContainer.classList.remove('not-found');
    html += `
      <span class="wikipedia-result-status unavailable">
        ⚠ Wikipedia: Record unavailable
      </span>
      <p style="margin: 0; color: var(--muted); font-size: 0.9rem;">
        The Wikipedia lookup could not be completed at this time. A deeper manual review would be required.
      </p>
    `;
  }

  html += '</div>';
  resultContainer.innerHTML = html;
}

/**
 * Update signal statuses based on research
 * @param {Object} wikiResult - Result from queryWikipedia
 */
function updateSignals(wikiResult) {
  // Update Wikipedia Readiness signal
  const signalWikipedia = document.getElementById('signal-wikipedia');
  if (signalWikipedia) {
    if (wikiResult.status === WIKIPEDIA_STATE.IDENTIFIED) {
      signalWikipedia.textContent = 'Article identified';
      signalWikipedia.classList.add('identified');
    } else if (wikiResult.status === WIKIPEDIA_STATE.NOT_FOUND) {
      signalWikipedia.textContent = 'No article identified';
      signalWikipedia.classList.add('not-found');
    } else {
      signalWikipedia.textContent = 'Unable to verify';
      signalWikipedia.classList.add('unavailable');
    }
  }

  // Update status badge
  const statusBadge = document.getElementById('wikipedia-status-badge');
  if (statusBadge) {
    if (wikiResult.status === WIKIPEDIA_STATE.IDENTIFIED) {
      statusBadge.textContent = 'Article identified';
    } else if (wikiResult.status === WIKIPEDIA_STATE.NOT_FOUND) {
      statusBadge.textContent = 'Further review needed';
    } else {
      statusBadge.textContent = 'Assessment required';
    }
  }
}

/**
 * Handle missing or invalid company
 */
function handleMissingCompany() {
  setResearchState(RESEARCH_STATE.INVALID, 'No company name provided');

  // Hide the state indicator
  const stateIndicator = document.getElementById('state-indicator');
  if (stateIndicator) {
    stateIndicator.style.display = 'none';
  }

  // Update observation
  const observationText = document.getElementById('observation-text');
  if (observationText) {
    observationText.textContent = 'A company name is required to generate a research preview. Please check the URL and ensure the "company" parameter is included.';
  }

  // Clear other research sections
  const wikipediaResult = document.getElementById('wikipedia-result');
  if (wikipediaResult) {
    wikipediaResult.innerHTML = '';
  }
}

/**
 * Conduct preliminary research
 * @param {string} companyName
 */
async function conductResearch(companyName) {
  // Set loading state
  setResearchState(RESEARCH_STATE.LOADING, 'Preparing preliminary research...');

  // Show loading in Wikipedia result
  const wikipediaResult = document.getElementById('wikipedia-result');
  if (wikipediaResult) {
    wikipediaResult.innerHTML = '<p style="color: var(--accent-strong); font-weight: 500;">Looking up Wikipedia article...</p>';
  }

  // Query Wikipedia
  const wikiResult = await queryWikipedia(companyName);

  // Display Wikipedia result
  displayWikipediaResult(wikiResult);

  // Update signals
  updateSignals(wikiResult);

  // Update observation text
  updateObservationText(wikiResult, companyName);

  // Update Wikipedia readiness content
  updateWikipediaReadinessContent(wikiResult);

  // Set completion state
  let stateMessage = 'Research preview ready';
  if (wikiResult.status === WIKIPEDIA_STATE.UNAVAILABLE) {
    stateMessage = 'Research preview ready (some data unavailable)';
  }
  setResearchState(RESEARCH_STATE.SUCCESS, stateMessage);
}

/**
 * Initialize the page
 */
function initializeResearchsPage() {
  // Get company and first name from URL
  const companyName = getCompanyName();
  const firstName = getFirstName();

  // Check if company is valid
  if (!hasValidCompany()) {
    handleMissingCompany();
    return;
  }

  // Set dynamic content (company name, date, greeting)
  setDynamicContent(companyName, firstName);

  // Conduct research (Wikipedia lookup, etc.)
  conductResearch(companyName);
}

/**
 * Analytics helper
 * @param {string} eventName
 * @param {Object} properties
 */
function trackEvent(eventName, properties = {}) {
  const payload = {
    event: eventName,
    ...properties,
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
    window.gtag('event', eventName, properties);
  }

  if (window.plausible) {
    window.plausible(eventName, { props: properties });
  }
}

/**
 * Set up event tracking
 */
function setupAnalytics() {
  // Track CTA clicks
  const ctaAssessment = document.getElementById('cta-assessment');
  if (ctaAssessment) {
    ctaAssessment.addEventListener('click', () => {
      trackEvent('researchs_assessment_cta_click', {
        company: getCompanyName()
      });
    });
  }

  const ctaConsultation = document.getElementById('cta-consultation');
  if (ctaConsultation) {
    ctaConsultation.addEventListener('click', () => {
      trackEvent('researchs_consultation_cta_click', {
        company: getCompanyName()
      });
    });
  }

  // Track Wikipedia link clicks
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('wikipedia-link')) {
      trackEvent('researchs_wikipedia_link_click', {
        company: getCompanyName()
      });
    }
  });

  // Track page load
  trackEvent('researchs_page_loaded', {
    company: hasValidCompany() ? getCompanyName() : 'none',
    has_first_name: getFirstName() !== ''
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeResearchsPage();
    setupAnalytics();
  });
} else {
  initializeResearchsPage();
  setupAnalytics();
}
