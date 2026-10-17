(() => {
  const dialog = document.getElementById('consultation-dialog');
  const backdrop = document.querySelector('.consultation-backdrop');
  const form = document.getElementById('consultation-form');
  const topicField = document.getElementById('consultation-topic');
  const status = document.getElementById('consultation-status');
  const closeButton = dialog?.querySelector('.dialog-close');
  let lastFocusedElement = null;
  let submitting = false;

  if (!dialog || !backdrop || !form || !topicField || !status) return;

  function openDialog(topic, trigger) {
    lastFocusedElement = trigger || document.activeElement;
    dialog.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('dialog-open');
    status.textContent = '';
    status.removeAttribute('data-state');
    if (topic) {
      const matchingOption = Array.from(topicField.options).find(option => option.value.toLowerCase() === topic.toLowerCase());
      topicField.value = matchingOption ? matchingOption.value : 'General enquiry';
    } else topicField.value = '';
    closeButton?.focus();
    window.trackEvent?.('ConsultationOpened');
  }

  function closeDialog() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('dialog-open');
    lastFocusedElement?.focus?.();
  }

  document.querySelectorAll('[data-open-consultation]').forEach(button => {
    button.addEventListener('click', () => openDialog(button.dataset.topic || '', button));
  });
  document.querySelectorAll('[data-close-consultation]').forEach(button => {
    button.addEventListener('click', closeDialog);
  });

  document.addEventListener('keydown', event => {
    if (dialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'))
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    status.textContent = '';
    status.removeAttribute('data-state');
    if (!form.reportValidity()) return;

    const projectUrl = document.getElementById('consultation-url').value.trim();
    if (projectUrl) {
      try {
        const parsedUrl = new URL(projectUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported URL protocol');
      } catch {
        status.textContent = 'Enter a valid http or https article or draft URL.';
        status.dataset.state = 'error';
        document.getElementById('consultation-url').focus();
        return;
      }
    }

    const submitButton = form.querySelector('[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());
    payload._replyto = payload['Email address'];
    payload._subject = `NotablePath project enquiry: ${payload.Topic}`;
    submitButton.disabled = true;
    submitting = true;
    status.textContent = 'Sending your enquiry...';

    try {
      const response = await fetch('https://formsubmit.co/ajax/notablepathc@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      let result;
      try { result = await response.json(); } catch { result = null; }
      if (!response.ok || !result || !result.success) {
        throw new Error(result?.message || 'The enquiry service did not confirm receipt.');
      }
      status.textContent = 'Your enquiry has been submitted to NotablePath for review. A confirmation here means the enquiry service accepted the submission; it is not a persistent chat conversation.';
      status.dataset.state = 'success';
      form.reset();
      topicField.value = '';
      window.trackEvent?.('EnquirySubmitted');
    } catch (error) {
      status.textContent = 'We could not confirm that your enquiry was submitted. Please try again, or email hello@notablepath.online.';
      status.dataset.state = 'error';
      console.error('Enquiry submission failed', error);
    } finally {
      submitButton.disabled = false;
      submitting = false;
    }
  });
})();

(() => {
  const toggle = document.getElementById('text-size-toggle');
  const panel = document.getElementById('text-size-panel');
  const valueLabel = document.getElementById('text-size-value');
  const decreaseButton = document.getElementById('text-size-decrease');
  const increaseButton = document.getElementById('text-size-increase');
  const resetButton = document.getElementById('text-size-reset');
  const widget = document.querySelector('.text-size-widget');
  const storageKey = 'notablepath-home-text-size';
  const minimumScale = 80;
  const maximumScale = 150;
  let scale = 100;

  if (!toggle || !panel || !valueLabel || !decreaseButton || !increaseButton || !resetButton || !widget) return;

  try {
    const savedScale = Number.parseInt(window.localStorage.getItem(storageKey), 10);
    if (Number.isFinite(savedScale)) scale = Math.max(minimumScale, Math.min(maximumScale, Math.round(savedScale / 10) * 10));
  } catch (error) {
    // Continue with the default if storage is unavailable.
  }

  function applyScale() {
    document.documentElement.style.fontSize = `${scale}%`;
    document.body.style.setProperty('--page-font-scale', String(scale / 100));
    document.body.classList.toggle('text-size-large', scale > 100);
    valueLabel.value = `${scale}%`;
    valueLabel.textContent = `${scale}%`;
    decreaseButton.disabled = scale <= minimumScale;
    increaseButton.disabled = scale >= maximumScale;
    try {
      window.localStorage.setItem(storageKey, String(scale));
    } catch (error) {
      // The selected size remains active for this visit.
    }
  }

  function setPanelOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close text size controls' : 'Open text size controls');
  }

  toggle.addEventListener('click', () => setPanelOpen(panel.hidden));
  decreaseButton.addEventListener('click', () => {
    scale = Math.max(minimumScale, scale - 10);
    applyScale();
  });
  increaseButton.addEventListener('click', () => {
    scale = Math.min(maximumScale, scale + 10);
    applyScale();
  });
  resetButton.addEventListener('click', () => {
    scale = 100;
    applyScale();
  });

  document.addEventListener('click', event => {
    if (!panel.hidden && !widget.contains(event.target)) setPanelOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      setPanelOpen(false);
      toggle.focus();
    }
  });

  applyScale();
})();
