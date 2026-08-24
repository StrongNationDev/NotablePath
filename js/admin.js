(() => {
  const client = window.getNotablePathSupabase?.();
  const access = document.getElementById('admin-access');
  const app = document.getElementById('admin-app');
  const message = document.getElementById('admin-access-message');
  const status = document.getElementById('admin-form-status');
  let inboxChannel = null;
  let loadingInbox = false;
  let activeUserId = null;
  let selectedConversationId = null;
  let messageChannel = null;
  let sendingReply = false;
  let messageRefreshTimer = null;
  let inboxRefreshTimer = null;
  const setStatus = text => { status.textContent = text; };
  const reportError = (error, fallback) => { console.error(error); setStatus(fallback); };

  async function uploadAttachment(file, userId) {
    if (!file || file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${selectedConversationId}/${userId}/${Date.now()}-${safeName}`;
    const upload = await client.storage.from('workspace-files').upload(path, file, { upsert: false });
    if (upload.error) throw upload.error;
    return client.storage.from('workspace-files').getPublicUrl(path).data.publicUrl;
  }

  const offerForm = document.getElementById('admin-offer-form');
  const amountField = document.getElementById('admin-offer-amount');
  if (offerForm && amountField && !document.getElementById('admin-offer-title')) {
    const fields = [
      ['admin-offer-title', 'Title', 'text', 'NotablePath service offer'],
      ['admin-offer-description', 'Description', 'textarea', 'Scope of work'],
      ['admin-offer-service', 'Service type', 'text', 'Wikipedia consultation'],
      ['admin-offer-expiry', 'Expiry', 'datetime-local', '']
    ];
    fields.forEach(([id, labelText, type, placeholder]) => {
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = labelText;
      const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      input.id = id;
      input.required = type !== 'datetime-local';
      if (type !== 'textarea') input.type = type;
      if (placeholder) input.placeholder = placeholder;
      amountField.before(label, input);
    });
    const currencyLabel = amountField.nextElementSibling;
    if (currencyLabel?.id === 'admin-offer-currency') currencyLabel.remove();
    offerForm.querySelector('input[type="hidden"]')?.remove();
  }

  const adminRedirect = () => {
    const current = `${window.location.origin}${window.location.pathname}`;
    return new Set([
      'http://localhost:9000/admin.html',
      'https://notablepath.online/admin.html'
    ]).has(current) || (window.location.hostname === 'localhost' && window.location.pathname === '/admin.html')
      ? current : 'https://notablepath.online/admin.html';
  };

  const getRoleValue = data => {
    if (typeof data === 'string') return data.toLowerCase();
    if (Array.isArray(data)) return getRoleValue(data[0]);
    if (data && typeof data === 'object') return String(data.role || data.user_role || data.get_my_role || '').toLowerCase();
    return '';
  };

  const renderMessage = (item, currentUserId) => {
    const messageItem = document.createElement('article');
    messageItem.className = `message${item.sender_id === currentUserId ? ' mine' : ''}`;
    messageItem.dataset.messageId = item.id;
    if (item.message_type === 'file' && item.body) {
      const link = document.createElement('a');
      link.href = item.body;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open attached file';
      messageItem.appendChild(link);
    } else messageItem.textContent = item.body || '';
    const meta = document.createElement('span');
    meta.className = 'message-meta';
    meta.textContent = new Date(item.created_at).toLocaleString();
    messageItem.appendChild(meta);
    return messageItem;
  };

  async function loadAdminOffers(conversationId) {
    const form = document.getElementById('admin-offer-form');
    if (!form) return;
    let summary = document.getElementById('admin-offer-summary');
    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'admin-offer-summary';
      summary.className = 'offer-list';
      form.before(summary);
    }
    const offers = await client.from('offers').select('id, title, amount, currency, status, expires_at, accepted_at').eq('conversation_id', conversationId).order('created_at', { ascending: false });
    if (offers.error) return;
    const payments = offers.data.length ? await client.from('payments').select('offer_id, status, paid_at').in('offer_id', offers.data.map(offer => offer.id)) : { data: [] };
    summary.replaceChildren();
    offers.data.forEach(offer => {
      const payment = (payments.data || []).find(item => item.offer_id === offer.id);
      const row = document.createElement('div');
      row.className = 'offer-card';
      const details = document.createElement('span');
      details.textContent = `${offer.title || 'Offer'} · ${Number(offer.amount).toLocaleString()} ${offer.currency || 'NGN'}`;
      const state = document.createElement('span');
      state.className = 'status-chip';
      state.textContent = payment?.status === 'successful' ? 'Payment Successful' : (payment?.status || offer.status || 'pending');
      row.append(details, state);
      summary.appendChild(row);
    });
  }

  async function openConversation(conversation, currentUserId) {
    selectedConversationId = conversation.id;
    if (messageChannel) await client.removeChannel(messageChannel);
    const title = document.getElementById('admin-conversation-title');
    const statusChip = document.getElementById('admin-conversation-status');
    const list = document.getElementById('admin-message-list');
    const form = document.getElementById('admin-message-form');
    title.textContent = `Conversation ${conversation.id.slice(0, 8)}`;
    statusChip.textContent = conversation.status || 'open';
    list.replaceChildren();
    list.appendChild(Object.assign(document.createElement('p'), { textContent: 'Loading messages...' }));
    form.hidden = false;
    document.getElementById('admin-offer-form').hidden = false;
    await loadAdminOffers(conversation.id);
    const result = await client.from('messages').select('id, body, sender_id, created_at, message_type').eq('conversation_id', conversation.id).order('created_at', { ascending: true });
    if (result.error) throw result.error;
    list.replaceChildren();
    if (!result.data.length) list.appendChild(Object.assign(document.createElement('p'), { textContent: 'No messages yet.' }));
    result.data.forEach(item => list.appendChild(renderMessage(item, currentUserId)));
    messageChannel = client.channel(`admin-messages-${conversation.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, payload => {
      if (!list.querySelector(`[data-message-id="${payload.new.id}"]`)) list.appendChild(renderMessage(payload.new, currentUserId));
      list.lastElementChild?.scrollIntoView({ block: 'nearest' });
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadAdminOffers(conversation.id)).subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setStatus('Live updates are unavailable. Refreshing messages automatically.');
    });
    if (messageRefreshTimer) window.clearInterval(messageRefreshTimer);
    messageRefreshTimer = window.setInterval(async () => {
      if (document.hidden || selectedConversationId !== conversation.id) return;
      const latest = await client.from('messages').select('id, body, sender_id, created_at, message_type').eq('conversation_id', conversation.id).order('created_at', { ascending: true });
      if (latest.error) return;
      latest.data.forEach(item => {
        if (!list.querySelector(`[data-message-id="${item.id}"]`)) list.appendChild(renderMessage(item, currentUserId));
      });
      list.lastElementChild?.scrollIntoView({ block: 'nearest' });
      await loadAdminOffers(conversation.id);
    }, 2000);
  }

  async function loadInbox() {
    if (loadingInbox) return;
    loadingInbox = true;
    const list = document.getElementById('admin-conversation-list');
    try {
      const result = await client.from('conversations').select('id, client_id, status, updated_at, last_message_at, assigned_agent_id').order('updated_at', { ascending: false });
      if (result.error) throw result.error;
      const conversations = await Promise.all(result.data.map(async conversation => {
        const clientResult = await client.from('clients').select('id, display_name, primary_contact_name, primary_email').eq('id', conversation.client_id).maybeSingle();
        if (clientResult.error) throw clientResult.error;
        const clientProfile = clientResult.data?.primary_email
          ? await client.from('profiles').select('id').eq('email', clientResult.data.primary_email).maybeSingle()
          : { data: null, error: null };
        if (clientProfile.error) throw clientProfile.error;
        const messages = await client.from('messages').select('sender_id, body, created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: false });
        if (messages.error) throw messages.error;
        const clientProfileId = clientProfile.data?.id;
        const clientMessages = clientProfileId ? messages.data.filter(item => item.sender_id === clientProfileId) : [];
        return { conversation, clientRecord: clientResult.data, messages: messages.data, clientMessages };
      }));
      const signature = conversations.map(({ conversation, messages, clientMessages }) => `${conversation.id}:${conversation.updated_at || ''}:${conversation.last_message_at || ''}:${messages[0]?.id || ''}:${clientMessages.length}`).join('|');
      if (list.dataset.signature === signature) return;
      list.dataset.signature = signature;
      list.replaceChildren();
      conversations.forEach(({ conversation, clientRecord, messages, clientMessages }) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'admin-list-item';
        const title = document.createElement('strong');
        title.textContent = clientRecord?.display_name || clientRecord?.primary_contact_name || `Client ${conversation.client_id ? conversation.client_id.slice(0, 8) : 'unknown'}`;
        const detail = document.createElement('span');
        const latest = messages[0];
        detail.textContent = `${clientRecord?.primary_email || 'No email'} · ${conversation.status || 'new'} · ${latest?.created_at ? new Date(latest.created_at).toLocaleString() : 'No activity'} · ${clientMessages.length} client message${clientMessages.length === 1 ? '' : 's'}`;
        item.append(title, detail);
        item.addEventListener('click', () => openConversation(conversation, activeUserId).catch(error => reportError(error, 'Unable to load this conversation.')));
        list.appendChild(item);
      });
      document.getElementById('admin-count').textContent = `${result.data.length} conversations`;
    } finally {
      loadingInbox = false;
    }
  }

  async function enterAdmin(session) {
    if (activeUserId === session.user.id && app.hidden === false) return;
    activeUserId = session.user.id;
    if (inboxChannel) {
      await client.removeChannel(inboxChannel);
      inboxChannel = null;
    }
    const role = await client.rpc('get_my_role');
    if (role.error) {
      reportError(role.error, 'Staff authorization is not configured. Ask an administrator to check the get_my_role database function.');
      message.textContent = 'Staff authorization could not be verified.';
      return;
    }
    const roleName = getRoleValue(role.data);
    if (!['agent', 'admin'].includes(roleName)) {
      console.warn('Authenticated account has no staff role', { userId: session.user.id, role: role.data });
      message.textContent = 'This account is authenticated but does not have an agent or admin role. Ask an administrator to grant staff access, then sign in again.';
      return;
    }
    access.hidden = true;
    app.hidden = false;
    document.getElementById('admin-logout').hidden = false;
    try {
      await loadInbox();
      inboxChannel = client.channel('admin-inbox')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadInbox)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadInbox)
        .subscribe(channelStatus => {
          if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') setStatus('Live inbox updates are unavailable. Please refresh when needed.');
        });
      if (inboxRefreshTimer) window.clearInterval(inboxRefreshTimer);
      inboxRefreshTimer = window.setInterval(() => {
        if (!document.hidden) loadInbox().catch(error => reportError(error, 'Unable to refresh the inbox.'));
      }, 2000);
    } catch (error) { reportError(error, 'Unable to load the inbox. Please refresh and try again.'); }
  }

  async function initialize() {
    if (!client) { message.textContent = 'Staff workspace is not configured yet. Add Supabase settings before enabling access.'; document.getElementById('admin-link-form').querySelector('button').disabled = true; return; }
    const { data, error } = await client.auth.getSession();
    if (error) {
      reportError(error, 'Unable to restore the staff session. Please sign in again.');
      return;
    }
    if (data.session) {
      try { await enterAdmin(data.session); } catch (sessionError) { reportError(sessionError, 'Unable to open the staff workspace. Please try again.'); }
    }
    client.auth.onAuthStateChange((_event, session) => {
      if (session && session.user?.id !== activeUserId) {
        window.setTimeout(() => enterAdmin(session), 0);
      }
    });
  }

  document.getElementById('admin-link-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!client) return;
    const email = document.getElementById('admin-email').value.trim().toLowerCase();
    const password = document.getElementById('admin-password').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Enter a valid staff email address.');
      return;
    }
    if (password.length < 8) { setStatus('Enter your staff password (at least 8 characters).'); return; }
    setStatus('Signing in to the staff inbox...');
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) await enterAdmin(data.session);
    } catch (error) {
      reportError(error, 'Staff email or password is incorrect, or this account is not approved.');
    } finally { submitButton.disabled = false; }
  });
  document.getElementById('admin-magic-link').addEventListener('click', async event => {
    const email = document.getElementById('admin-email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Enter your staff email address first.'); return; }
    event.currentTarget.disabled = true;
    try {
      window.setNotablePathAuthDestination?.('/admin.html');
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: adminRedirect() } });
      if (error) throw error;
      setStatus('Please check your email for the secure sign-in link.');
    } catch (error) {
      window.localStorage.removeItem('notablepath-auth-destination');
      reportError(error, 'Unable to send the staff sign-in link. Please check Supabase Auth settings.');
    } finally { event.currentTarget.disabled = false; }
  });
  document.getElementById('admin-message-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = document.getElementById('admin-message-body').value.trim();
    const fileInput = document.getElementById('admin-file-input');
    const file = fileInput.files[0];
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if ((!body && !file) || !selectedConversationId || sendingReply) return;
    sendingReply = true;
    button.disabled = true;
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      document.getElementById('admin-message-status').textContent = 'Your staff session has expired.';
    } else {
      let messageBody = body;
      let messageType = 'text';
      if (file) {
        messageBody = await uploadAttachment(file, userData.user.id);
        messageType = 'file';
      }
      const result = await client.from('messages').insert({ conversation_id: selectedConversationId, sender_id: userData.user.id, body: messageBody, message_type: messageType }).select('id, body, sender_id, created_at, message_type').single();
      if (result.error) reportError(result.error, 'Unable to send this reply.');
      else {
        document.getElementById('admin-message-body').value = '';
        fileInput.value = '';
        const list = document.getElementById('admin-message-list');
        if (!list.querySelector(`[data-message-id="${result.data.id}"]`)) list.appendChild(renderMessage(result.data, userData.user.id));
        list.lastElementChild?.scrollIntoView({ block: 'nearest' });
        document.getElementById('admin-message-status').textContent = 'Reply sent.';
      }
    }
    sendingReply = false;
    button.disabled = false;
  });
  document.getElementById('admin-attach-button').addEventListener('click', () => document.getElementById('admin-file-input').click());
  document.getElementById('admin-file-input').addEventListener('change', event => {
    if (event.target.files[0]) document.getElementById('admin-message-status').textContent = `Ready to attach ${event.target.files[0].name}.`;
  });
  document.getElementById('admin-offer-form').addEventListener('submit', async event => {
    event.preventDefault();
    const title = document.getElementById('admin-offer-title').value.trim();
    const description = document.getElementById('admin-offer-description').value.trim();
    const serviceType = document.getElementById('admin-offer-service').value.trim();
    const expiresAt = document.getElementById('admin-offer-expiry').value;
    const amount = Number(document.getElementById('admin-offer-amount').value);
    const offerStatus = document.getElementById('admin-offer-status');
    if (!selectedConversationId || !title || !description || !serviceType || !Number.isFinite(amount) || amount <= 0) { offerStatus.textContent = 'Complete the offer details and enter a valid NGN amount.'; return; }
    const result = await client.rpc('create_offer', { p_conversation_id: selectedConversationId, p_title: title, p_description: description, p_service_type: serviceType, p_amount: amount, p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null });
    if (result.error) reportError(result.error, 'Unable to create this offer.');
    else { offerStatus.textContent = 'Offer created.'; event.currentTarget.reset(); await loadAdminOffers(selectedConversationId); }
  });
  document.getElementById('admin-logout').addEventListener('click', async () => {
    if (inboxChannel && client) await client.removeChannel(inboxChannel);
    if (messageChannel && client) await client.removeChannel(messageChannel);
    if (messageRefreshTimer) window.clearInterval(messageRefreshTimer);
    if (inboxRefreshTimer) window.clearInterval(inboxRefreshTimer);
    inboxChannel = null;
    messageChannel = null;
    await client?.auth.signOut();
  });
  window.addEventListener('pagehide', () => {
    if (inboxChannel && client) client.removeChannel(inboxChannel);
    if (messageChannel && client) client.removeChannel(messageChannel);
    if (messageRefreshTimer) window.clearInterval(messageRefreshTimer);
    if (inboxRefreshTimer) window.clearInterval(inboxRefreshTimer);
  }, { once: true });
  initialize();
})();
