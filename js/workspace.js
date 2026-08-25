(() => {
  const client = window.getNotablePathSupabase?.();
  const accessPanel = document.getElementById('workspace-access');
  const workspaceApp = document.getElementById('workspace-app');
  const accessMessage = document.getElementById('workspace-access-message');
  const status = document.getElementById('workspace-form-status');
  let conversationId = null;
  let realtimeChannel = null;
  let isSending = false;
  let activeUserId = null;
  let authSubscription = null;
  let clientRecordId = null;
  let messageRefreshTimer = null;
  let sendingOffer = false;

  const allowedRedirects = new Set([
    'http://localhost:8000/workspace.html',
    'http://localhost:9000/workspace.html',
    'https://notablepath.online/workspace.html'
  ]);

  const workspaceRedirect = () => {
    const current = `${window.location.origin}${window.location.pathname}`;
    return allowedRedirects.has(current) || (window.location.hostname === 'localhost' && window.location.pathname === '/workspace.html')
      ? current : 'https://notablepath.online/workspace.html';
  };

  const sanitizePrefill = (value, maxLength) => String(value || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.dataset.state = error ? 'error' : 'success';
    const appStatus = document.getElementById('workspace-app-status');
    if (appStatus) {
      appStatus.textContent = message;
      appStatus.dataset.state = error ? 'error' : 'success';
    }
  };

  const friendlyError = (error, fallback) => {
    console.error(error);
    return fallback;
  };

  const stageError = (stage, error) => {
    console.error(`[Workspace ${stage}]`, error);
    const code = error?.code ? ` (${error.code})` : '';
    const message = error?.message || '';
    if (error?.status === 401 || error?.status === 403 || error?.code === '42501') {
      return `${stage} is not permitted for this account${code}. Check the Supabase RLS policy for this table.`;
    }
    if (error?.code === '23505') {
      return `${stage} already exists. Please refresh the workspace.`;
    }
    return `${stage} could not be completed${code}${message.includes('column') ? '. Check that the Supabase column names match the workspace schema.' : '. Please try again.'}`;
  };

  const renderMessage = (message, currentUserId) => {
    const item = document.createElement('article');
    item.className = `message${message.sender_id === currentUserId ? ' mine' : ''}`;
    item.dataset.messageId = message.id;
    if (message.message_type === 'file' && message.body) {
      const link = document.createElement('a');
      link.href = message.body;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open attached file';
      item.appendChild(link);
    } else item.textContent = message.body || '';
    const meta = document.createElement('span');
    meta.className = 'message-meta';
    meta.textContent = new Date(message.created_at).toLocaleString();
    item.appendChild(meta);
    return item;
  };

  async function uploadAttachment(file, userId) {
    if (!file || file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${conversationId}/${userId}/${Date.now()}-${safeName}`;
    const upload = await client.storage.from('workspace-files').upload(path, file, { upsert: false });
    if (upload.error) throw upload.error;
    return client.storage.from('workspace-files').getPublicUrl(path).data.publicUrl;
  }

  const renderOffers = offers => {
    const offerList = document.getElementById('client-offers');
    if (offerList) offerList.replaceChildren();
    const chatOffers = document.getElementById('client-offer-messages');
    if (chatOffers) chatOffers.replaceChildren();
    offers.forEach(offer => {
      const card = document.createElement('div');
      card.className = 'offer-card';
      const details = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = 'Offer';
      details.append(title, document.createElement('br'), document.createTextNode(offer.title || 'NotablePath service offer'), document.createElement('br'), document.createTextNode(`${Number(offer.amount).toLocaleString()} ${offer.currency || 'NGN'}`));
      if (offer.description) details.append(document.createElement('br'), document.createTextNode(offer.description));
      if (offer.expires_at) details.append(document.createElement('br'), document.createTextNode(`Expires ${new Date(offer.expires_at).toLocaleDateString()}`));
      const state = document.createElement('span');
      state.className = 'status-chip';
      const paymentState = offer.payment_status === 'successful' ? 'Payment Successful' : (offer.payment_status || offer.status || 'pending');
      state.textContent = paymentState;
      const actions = document.createElement('span');
      if (offer.status === 'pending' || offer.status === 'sent') {
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'workspace-button secondary';
        accept.textContent = 'Accept';
        accept.dataset.offerId = offer.id;
        accept.dataset.offerAction = 'accept';
        actions.appendChild(accept);
      } else if (offer.status === 'accepted' && offer.payment_status !== 'successful') {
        const pay = document.createElement('button');
        pay.type = 'button';
        pay.className = 'workspace-button primary';
        pay.textContent = 'Pay now';
        pay.dataset.offerId = offer.id;
        pay.dataset.offerAction = 'pay';
        actions.appendChild(pay);
      }
      card.append(details, state, actions);
      offerList.appendChild(card);
      if (chatOffers) {
        const chatCard = document.createElement('article');
        chatCard.className = 'chat-offer';
        const chatTitle = document.createElement('h3');
        chatTitle.className = 'chat-offer-title';
        chatTitle.textContent = offer.title || 'NotablePath service offer';
        const chatDescription = document.createElement('p');
        chatDescription.className = 'chat-offer-description';
        chatDescription.textContent = offer.description || 'Review the offer details below.';
        const chatMeta = document.createElement('div');
        chatMeta.className = 'chat-offer-meta';
        const chatAmount = document.createElement('strong');
        chatAmount.textContent = `${Number(offer.amount).toLocaleString()} ${offer.currency || 'NGN'}`;
        const chatState = document.createElement('span');
        chatState.className = 'status-chip';
        chatState.textContent = offer.payment_status === 'successful' ? 'Payment Successful' : (offer.payment_status || offer.status || 'sent');
        chatMeta.append(chatAmount, chatState);
        const chatAction = actions.firstElementChild?.cloneNode(true);
        if (chatAction) {
          chatAction.addEventListener('click', () => handleOfferAction(chatAction));
          chatMeta.appendChild(chatAction);
        }
        chatCard.append(chatTitle, chatDescription, chatMeta);
        chatOffers.appendChild(chatCard);
      }
    });
    offerList.querySelectorAll('[data-offer-action]').forEach(button => {
      button.addEventListener('click', () => handleOfferAction(button));
    });
  };

  async function handleOfferAction(button) {
    const offerId = button.dataset.offerId;
    button.disabled = true;
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new Error('Your secure session has expired.');
      if (button.dataset.offerAction === 'accept') {
        const accepted = await client.rpc('accept_offer', { p_offer_id: offerId });
        if (accepted.error) throw accepted.error;
        setStatus('Offer accepted. You can now pay securely.', false);
      } else {
        const payment = await client.functions.invoke('create-payment', { body: { offer_id: offerId } });
        if (payment.error) {
          let detail = payment.error.message || 'Payment service rejected the request.';
          try {
            const responseBody = await payment.error.context?.json();
            if (responseBody?.error) detail = responseBody.error;
          } catch (responseError) {
            console.warn('Unable to read payment error response', responseError);
          }
          throw new Error(detail);
        }
        const authorizationUrl = payment.data?.authorization_url;
        if (!authorizationUrl) throw new Error('Payment checkout URL was not returned.');
        window.location.assign(authorizationUrl);
      }
      await refreshOffers();
    } catch (error) {
      console.error(error);
      setStatus(button.dataset.offerAction === 'accept' ? 'Unable to accept this offer.' : 'Unable to start payment securely.', true);
      button.disabled = false;
    }
  }

  async function refreshOffers() {
    const offers = await client.from('offers').select('id, title, description, service_type, status, amount, currency, expires_at, accepted_at, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false });
    if (offers.error) return;
    if (!offers.data.length) { renderOffers([]); return; }
    const payments = await client.from('payments').select('offer_id, status').in('offer_id', offers.data.map(offer => offer.id));
    const paymentByOffer = new Map((payments.data || []).map(payment => [payment.offer_id, payment.status]));
    renderOffers(offers.data.map(offer => ({ ...offer, payment_status: paymentByOffer.get(offer.id) })));
  }

  async function loadConversation(user) {
    activeUserId = user.id;
    if (realtimeChannel) {
      await client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    const displayName = sanitizePrefill(user.user_metadata?.name || user.email?.split('@')[0], 120) || 'NotablePath client';
    const workspace = await client.rpc('bootstrap_client_workspace', { p_display_name: displayName });
    if (workspace.error || !workspace.data) {
      throw Object.assign(workspace.error || new Error('No workspace conversation was returned.'), { workspaceStage: 'Creating your client workspace' });
    }
    conversationId = workspace.data;
    const conversation = await client.from('conversations').select('client_id').eq('id', conversationId).single();
    if (conversation.error || !conversation.data?.client_id) {
      throw Object.assign(conversation.error || new Error('Your client record could not be linked to this conversation.'), { workspaceStage: 'Linking your client workspace' });
    }
    clientRecordId = conversation.data.client_id;
    const list = document.getElementById('message-list');
    list.replaceChildren();
    if (!conversationId) {
      const empty = document.createElement('p');
      empty.textContent = 'Your workspace is ready. A NotablePath agent will open your conversation shortly.';
      list.appendChild(empty);
      document.getElementById('message-form').querySelector('textarea').disabled = true;
      document.getElementById('message-form').querySelector('button[type="submit"]').disabled = true;
      return;
    }
    document.getElementById('message-form').querySelector('textarea').disabled = false;
    document.getElementById('message-form').querySelector('button[type="submit"]').disabled = false;
    const messages = await client.from('messages').select('id, body, sender_id, created_at, message_type').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (messages.error) throw Object.assign(messages.error, { workspaceStage: 'Loading your messages' });
    messages.data.forEach(message => list.appendChild(renderMessage(message, user.id)));
    const chatOfferMessages = document.createElement('div');
    chatOfferMessages.id = 'client-offer-messages';
    chatOfferMessages.className = 'chat-offer-messages';
    list.appendChild(chatOfferMessages);
    const offers = await client.from('offers').select('id, title, description, service_type, status, amount, currency, expires_at, accepted_at, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false });
    if (!offers.error) renderOffers(offers.data);
    realtimeChannel = client.channel(`conversation-${conversationId}`);
    realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => {
      if (list.querySelector(`[data-message-id="${payload.new.id}"]`)) return;
      list.appendChild(renderMessage(payload.new, user.id));
      list.lastElementChild?.scrollIntoView({ block: 'nearest' });
    });
    realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `conversation_id=eq.${conversationId}` }, async () => {
      await refreshOffers();
    });
    realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async () => {
      await refreshOffers();
    });
    realtimeChannel.subscribe(channelStatus => {
      if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
        setStatus('Live updates are unavailable. Messages will refresh automatically.', true);
      }
    });
    if (messageRefreshTimer) window.clearInterval(messageRefreshTimer);
    messageRefreshTimer = window.setInterval(async () => {
      if (document.hidden || !conversationId) return;
      const latest = await client.from('messages').select('id, body, sender_id, created_at, message_type').eq('conversation_id', conversationId).order('created_at', { ascending: true });
      if (latest.error) return;
      latest.data.forEach(message => {
        if (!list.querySelector(`[data-message-id="${message.id}"]`)) list.appendChild(renderMessage(message, user.id));
      });
      await refreshOffers();
    }, 2000);
  }

  async function enterWorkspace(session) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user || userData.user.id !== session.user.id) {
      throw userError || new Error('Authenticated user could not be verified');
    }
    accessPanel.hidden = true;
    workspaceApp.hidden = false;
    document.getElementById('workspace-logout').hidden = false;
    document.getElementById('workspace-client-name').textContent = session.user.user_metadata?.name || session.user.email;
    document.getElementById('context-client-name').textContent = session.user.user_metadata?.name || 'Client profile';
    document.getElementById('context-client-email').textContent = session.user.email;
      try { await loadConversation(session.user); } catch (sessionError) { setStatus(stageError(sessionError.workspaceStage || 'Opening your workspace', sessionError), true); }
  }

  async function initialize() {
    if (!client) {
      accessMessage.textContent = 'The secure workspace is not configured yet. Add the public Supabase URL and anon key to js/supabase-client.js before enabling client access.';
      document.getElementById('magic-link-form').querySelector('button').disabled = true;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const emailInput = document.getElementById('client-email');
    emailInput.value = sanitizePrefill(params.get('email'), 254);
    const { data, error } = await client.auth.getSession();
    if (error) { setStatus('Unable to restore your secure session. Please request a new link.', true); return; }
    if (data.session) {
      try { await enterWorkspace(data.session); } catch (sessionError) { setStatus(stageError(sessionError.workspaceStage || 'Opening your workspace', sessionError), true); }
    }
    authSubscription = client.auth.onAuthStateChange(async (_event, session) => {
      if (session && session.user?.id !== activeUserId) {
        window.setTimeout(async () => {
          try { await enterWorkspace(session); } catch (sessionError) { setStatus(stageError(sessionError.workspaceStage || 'Opening your workspace', sessionError), true); }
        }, 0);
      }
    });
    window.addEventListener('pagehide', () => {
      if (realtimeChannel) client.removeChannel(realtimeChannel);
      if (messageRefreshTimer) window.clearInterval(messageRefreshTimer);
      authSubscription?.data?.subscription?.unsubscribe();
    }, { once: true });
  }

  async function sendClientMagicLink(email) {
    window.setNotablePathAuthDestination?.('/workspace.html');
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: workspaceRedirect() } });
    if (error) throw error;
    setStatus('Please check your email for a secure sign-in link.');
  }

  document.getElementById('magic-link-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!client) return;
    const form = new FormData(event.currentTarget);
    const email = sanitizePrefill(form.get('email'), 254).toLowerCase();
    const password = String(form.get('password') || '');
    const action = event.submitter?.value || 'signin';
    const displayName = email.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'NotablePath client';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Please enter a valid email address.', true); return; }
    if (password.length < 8) { setStatus('Your password must be at least 8 characters.', true); return; }
    setStatus(action === 'signup' ? 'Creating your secure account...' : 'Signing you in...');
    const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = action === 'signup'
        ? await client.auth.signUp({ email, password, options: { data: { name: displayName }, emailRedirectTo: workspaceRedirect() } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) {
        await enterWorkspace(result.data.session);
      } else if (action === 'signup') {
        setStatus('Account created. Please confirm your email, then return here to sign in.');
      }
    } catch (error) {
      window.localStorage.removeItem('notablepath-auth-destination');
      const message = error?.status === 400 && action === 'signin'
        ? 'Email or password is incorrect. Use Create account if you are new here.'
        : friendlyError(error, action === 'signup' ? 'Unable to create your account. Please try again.' : 'Unable to sign you in. Please try again.');
      setStatus(message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById('client-magic-link').addEventListener('click', async event => {
    const email = sanitizePrefill(document.getElementById('client-email').value, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Enter your email address first.', true); return; }
    event.currentTarget.disabled = true;
    try { await sendClientMagicLink(email); } catch (error) { setStatus(friendlyError(error, 'Unable to send the sign-in link. Please try again.'), true); }
    event.currentTarget.disabled = false;
  });

  document.getElementById('message-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = document.getElementById('message-body').value.trim();
    const fileInput = document.getElementById('client-file-input');
    const file = fileInput.files[0];
    if ((!body && !file) || !conversationId || !client || isSending) return;
    isSending = true;
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setStatus('Sending message...');
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) { setStatus('Your secure session has expired. Please request a new sign-in link.', true); return; }
      let messageBody = body;
      let messageType = 'text';
      if (file) {
        messageBody = await uploadAttachment(file, userData.user.id);
        messageType = 'file';
      }
      const { data: insertedMessage, error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: userData.user.id, body: messageBody, message_type: messageType }).select('id, body, sender_id, created_at, message_type').single();
      if (error) {
        setStatus(friendlyError(error, 'Unable to send your message. Please try again.'), true);
      } else {
        document.getElementById('message-body').value = '';
        fileInput.value = '';
        const list = document.getElementById('message-list');
        if (insertedMessage && !list.querySelector(`[data-message-id="${insertedMessage.id}"]`)) list.appendChild(renderMessage(insertedMessage, userData.user.id));
        list.lastElementChild?.scrollIntoView({ block: 'nearest' });
        setStatus('Message sent.');
      }
    } catch (error) {
      setStatus(friendlyError(error, 'Unable to send your message. Please try again.'), true);
    } finally {
      isSending = false;
      submitButton.disabled = false;
    }
  });

  document.getElementById('client-attach-button').addEventListener('click', () => document.getElementById('client-file-input').click());
  document.getElementById('client-file-input').addEventListener('change', event => {
    if (event.target.files[0]) setStatus(`Ready to attach ${event.target.files[0].name}.`);
  });

  document.getElementById('client-offer-form').addEventListener('submit', async event => {
    event.preventDefault();
    const amount = Number(document.getElementById('client-offer-amount').value);
    const offerStatus = document.getElementById('client-offer-status');
    const form = event.currentTarget;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (!conversationId || !Number.isFinite(amount) || amount <= 0 || sendingOffer) { offerStatus.textContent = 'Enter a valid NGN amount.'; return; }
    sendingOffer = true;
    button.disabled = true;
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) offerStatus.textContent = 'Your secure session has expired.';
      else {
        const result = await client.from('offers').insert({ conversation_id: conversationId, client_id: clientRecordId, created_by: userData.user.id, title: 'Client offer request', description: 'Offer requested by the client through the NotablePath workspace.', service_type: 'Consultation', status: 'sent', amount, currency: 'NGN' }).select('id').single();
        if (result.error) { console.error(result.error); offerStatus.textContent = 'Unable to request an offer right now.'; }
        else { offerStatus.textContent = 'Offer requested.'; form.reset(); await refreshOffers(); }
      }
    } catch (error) {
      console.error(error);
      offerStatus.textContent = 'Unable to request an offer right now.';
    } finally {
      sendingOffer = false;
      button.disabled = false;
    }
  });

  document.getElementById('workspace-logout').addEventListener('click', () => client?.auth.signOut());
  initialize();
})();
