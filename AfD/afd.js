const ASSESSMENT_FEE = '$99.00 USD';

const DEFAULT_LEAD_DATA = {
  firstName: '',
  companyName: '',
  deletionReason: '',
  leadId: '',
  source: 'url'
};

function sanitizeText(value, fallback = '', allowEmpty = false, maxLength = 300) {
  if (value === null || value === undefined) {
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

  if (cleaned === '') {
    return allowEmpty ? '' : fallback;
  }

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim();
  }

  return cleaned;
}

function generateSafeLeadId() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const timestampPart = Date.now().toString(36).slice(-4).toUpperCase();
  return `NP-${timestampPart}${randomPart}`;
}

function getQueryParams() {
  return new URLSearchParams(window.location.search || '');
}

function getLeadData() {
  const params = getQueryParams();
  const firstName = sanitizeText(params.get('first'), '', true, 80);
  const companyName = sanitizeText(params.get('company'), 'Your organization', false, 200);
  const deletionReason = sanitizeText(params.get('reason'), '', true, 700);
  const leadId = sanitizeText(params.get('id') || params.get('lead') || '', '', true, 80) || generateSafeLeadId();

  return {
    firstName,
    companyName,
    deletionReason,
    leadId,
    source: 'url'
  };
}

function sanitizeLeadData(rawLeadData = DEFAULT_LEAD_DATA) {
  const safeLeadData = {
    ...DEFAULT_LEAD_DATA,
    ...rawLeadData
  };

  safeLeadData.firstName = sanitizeText(safeLeadData.firstName, '', true, 80);
  safeLeadData.companyName = sanitizeText(safeLeadData.companyName, 'Your organization', false, 200);
  safeLeadData.deletionReason = sanitizeText(safeLeadData.deletionReason, '', true, 700);
  safeLeadData.leadId = sanitizeText(safeLeadData.leadId, generateSafeLeadId(), false, 80);
  safeLeadData.source = sanitizeText(safeLeadData.source, 'url', false, 50);

  return safeLeadData;
}

function categorizeDeletionReason(reasonText) {
  const normalized = String(reasonText || '').toLowerCase();

  if (!normalized) {
    return 'other';
  }

  if (
    /general notability|notability|lacking in-depth secondary coverage|insufficient independent coverage|insufficient independent sources|secondary coverage/.test(normalized)
  ) {
    return 'notability';
  }

  if (/promotional|advertising|marketing|neutrality|self-promotion|promotional tone/.test(normalized)) {
    return 'promotional';
  }

  if (/source|reliable sources|citation|verification|not enough sources|unreliable sources|insufficient sourcing|references/.test(normalized)) {
    return 'sourcing';
  }

  if (/conflict of interest|paid editing|editorial control|financial interest|undue influence/.test(normalized)) {
    return 'conflict';
  }

  if (/recreated|recreation|previously deleted|same topic|recreated article/.test(normalized)) {
    return 'recreated';
  }

  if (/biographical|blp|biography|person|notability of the subject/.test(normalized)) {
    return 'biographical';
  }

  if (/primary source|primary-source|self-published|official website/.test(normalized)) {
    return 'primarySource';
  }

  return 'other';
}

function setTextContent(elementId, text, fallback = '') {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = text || fallback;
}

function renderLeadIdentity(leadData) {
  const companyDisplay = leadData.companyName || 'Your organization';
  const firstName = leadData.firstName || '';
  const hasLeadDetails = Boolean(firstName || leadData.companyName || leadData.deletionReason);

  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');
  const ctaRow = document.getElementById('cta-row');
  const fallbackCtas = document.getElementById('fallback-ctas');

  if (!heroTitle || !heroSubtitle) {
    return;
  }

  if (!hasLeadDetails) {
    heroTitle.textContent = 'Your Wikipedia article is facing a deletion challenge.';
    heroSubtitle.textContent = 'This assessment link is incomplete.';
    if (ctaRow) ctaRow.hidden = true;
    if (fallbackCtas) fallbackCtas.hidden = false;
    setTextContent('panel-company', 'Your article');
    setTextContent('panel-subject', 'Current article review');
    setTextContent('panel-source', 'Outreach email');
    return;
  }

  if (ctaRow) ctaRow.hidden = false;
  if (fallbackCtas) fallbackCtas.hidden = true;

  if (firstName) {
    heroTitle.textContent = `Hi ${firstName}, your Wikipedia article is currently facing a deletion challenge.`;
    heroSubtitle.textContent = `We reviewed the deletion issue associated with ${companyDisplay}.`;
  } else {
    heroTitle.textContent = 'Your Wikipedia article is facing a deletion challenge.';
    heroSubtitle.textContent = `We reviewed the deletion issue associated with ${companyDisplay}.`;
  }

  setTextContent('panel-company', companyDisplay);
  setTextContent('panel-subject', 'Deletion review');
  setTextContent('panel-source', 'Outreach email');
}

function renderDeletionReason(leadData) {
  const companyDisplay = leadData.companyName || 'your article';
  const reasonText = leadData.deletionReason || 'No deletion reason was supplied in the link. A tailored assessment requires the specific editorial concern.';

  setTextContent('deletion-reason', reasonText);

  const reasonContext = document.getElementById('deletion-context');
  if (!reasonContext) return;

  if (leadData.deletionReason) {
    reasonContext.textContent = `The reason attached to the nomination for ${companyDisplay} is:`;
  } else {
    reasonContext.textContent = 'The nomination reason is the starting point—not the final assessment.';
  }
}

function renderReasonAnalysis(leadData) {
  const container = document.getElementById('reason-analysis');
  if (!container) return;

  container.replaceChildren();

  const category = categorizeDeletionReason(leadData.deletionReason);
  const explanations = {
    notability: {
      title: 'The central issue appears to be the strength and depth of independent coverage.',
      body: 'For an assessment, we would look beyond the number of search results and examine whether reputable, independent publications provide substantial coverage of the subject.'
    },
    promotional: {
      title: 'The concern appears to involve neutrality or promotional presentation.',
      body: 'Article language, framing, and sourcing would need to be examined separately to determine whether the content reads like encyclopedic coverage or promotional material.'
    },
    sourcing: {
      title: 'The concern appears to involve the quality, reliability, or independence of the article\'s sources.',
      body: 'We would review whether the article relies on appropriate references and whether the evidence supports the important claims without depending on weak or non-independent material.'
    },
    conflict: {
      title: 'The concern appears to involve editorial independence or potential conflicts of interest.',
      body: 'An assessment would evaluate whether the article reflects objective editorial treatment or whether the source base or contribution pattern raises concerns about undue influence.'
    },
    recreated: {
      title: 'The concern appears to involve a previously deleted or recreated article context.',
      body: 'We would assess whether the article has already been discussed in a deletion context and what evidence exists now that may support a more defensible position.'
    },
    biographical: {
      title: 'The concern appears to involve biographical or notability-based scrutiny.',
      body: 'The question would be whether the article provides sufficient coverage from independent, reliable sources to support a meaningful encyclopedic treatment of the subject.'
    },
    primarySource: {
      title: 'The concern appears to involve whether the article relies too heavily on primary-source material.',
      body: 'We would examine whether the article is grounded in independent reporting and whether the underlying sourcing supports the claims being made.'
    },
    other: {
      title: 'The nomination requires a closer review of the article, its sources, and the specific editorial concern identified by the nominating editor.',
      body: 'A proper assessment would examine the exact evidence in context, identify the strongest factual support, and clarify the gaps that remain.'
    }
  };

  const selected = explanations[category] || explanations.other;

  const heading = document.createElement('h3');
  heading.textContent = selected.title;

  const paragraph = document.createElement('p');
  paragraph.textContent = selected.body;

  const followUp = document.createElement('p');
  if (leadData.firstName) {
    followUp.textContent = `${leadData.firstName}, the next step is to determine what the evidence actually supports before deciding how to respond.`;
  } else {
    followUp.textContent = 'The next step is to determine what the evidence actually supports before deciding how to respond.';
  }

  container.append(heading, paragraph, followUp);
}

function renderPaymentDetails(leadData) {
  const feeElement = document.getElementById('assessment-fee');
  if (feeElement) {
    feeElement.textContent = ASSESSMENT_FEE;
  }

  const paymentButton = document.getElementById('payment-button');
  if (paymentButton) {
    paymentButton.addEventListener('click', () => {
      handleAssessmentPayment(leadData);
    });
  }

  const finalPaymentButton = document.getElementById('final-payment-button');
  if (finalPaymentButton) {
    finalPaymentButton.addEventListener('click', () => {
      handleAssessmentPayment(leadData);
    });
  }
}

function buildPaymentUrl(leadData) {
  const id = sanitizeText(leadData.leadId, generateSafeLeadId(), false, 80);
  const params = new URLSearchParams();
  params.set('lead', id);
  params.set('source', 'afd');
  return `./payment.html?${params.toString()}`;
}

function handleAssessmentPayment(leadData) {
  let nextLeadData = sanitizeLeadData(leadData);

  if (!nextLeadData.leadId) {
    nextLeadData.leadId = generateSafeLeadId();
  }

  const redirectUrl = buildPaymentUrl(nextLeadData);
  trackAfDEvent('payment_redirect_initiated', {
    leadId: nextLeadData.leadId,
    source: nextLeadData.source,
    company: nextLeadData.companyName || ''
  });

  window.location.assign(redirectUrl);
}

function trackAfDEvent(eventName, eventProps = {}) {
  const payload = {
    page: 'afd',
    source: 'url',
    ...eventProps
  };

  if (typeof window.trackEvent === 'function') {
    window.trackEvent(eventName, payload);
    return;
  }

  window.analyticsQueue = window.analyticsQueue || [];
  window.analyticsQueue.push({
    event: eventName,
    properties: payload,
    timestamp: new Date().toISOString()
  });

  if (window.dataLayer) {
    window.dataLayer.push({ event: eventName, ...payload });
  }
}

function bindAnalyticsButtons() {
  document.querySelectorAll('[data-analytics]').forEach((button) => {
    button.addEventListener('click', () => {
      const eventName = button.getAttribute('data-analytics');
      if (!eventName) return;
      trackAfDEvent(eventName, {
        label: button.textContent.trim()
      });
    });
  });
}

function initializeAfDPage() {
  const rawLeadData = getLeadData();
  const leadData = sanitizeLeadData(rawLeadData);

  window.leadData = leadData;

  renderLeadIdentity(leadData);
  renderDeletionReason(leadData);
  renderReasonAnalysis(leadData);
  renderPaymentDetails(leadData);

  const hasLeadDetails = Boolean(leadData.firstName || leadData.companyName || leadData.deletionReason);

  if (hasLeadDetails) {
    trackAfDEvent('afd_page_loaded', {
      lead_detected: true,
      company: leadData.companyName || '',
      has_reason: Boolean(leadData.deletionReason)
    });

    trackAfDEvent('personalized_lead_detected', {
      firstName: leadData.firstName || '',
      company: leadData.companyName || '',
      source: leadData.source
    });
  } else {
    trackAfDEvent('afd_page_loaded', {
      lead_detected: false,
      company: '',
      has_reason: false
    });
    trackAfDEvent('missing_lead_parameters', {
      source: 'url'
    });
  }

  bindAnalyticsButtons();
}

document.addEventListener('DOMContentLoaded', initializeAfDPage);
