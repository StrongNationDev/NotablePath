window.NOTABLEPATH_SUPABASE = window.NOTABLEPATH_SUPABASE || {
    url: 'https://etmpljusmehfomzeqkvs.supabase.co',

    anonKey: 'sb_publishable_Dn8MHu7XKmEXJuREKj_3cQ_n0F6yFkT'
};

window.getNotablePathSupabase = function getNotablePathSupabase() {

    const config = window.NOTABLEPATH_SUPABASE;

    if (
        !config?.url ||
        !config?.anonKey ||
        !window.supabase?.createClient
    ) {
        return null;
    }

    return window.supabase.createClient(
        config.url,
        config.anonKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );
};

window.setNotablePathAuthDestination = function setNotablePathAuthDestination(path) {
    const normalized = path === '/admin/' || path === '/admin.html' || path === '/workspace/' || path === '/workspace.html' ? path : null;
    if (!normalized) return;
    window.localStorage.setItem('notablepath-auth-destination', `${window.location.origin}${normalized}`);
};

(() => {
    const isLandingPage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
    const hasAuthCallback = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
    if (!isLandingPage || !hasAuthCallback) return;

    const destination = window.localStorage.getItem('notablepath-auth-destination');
    let allowedDestination = null;
    try {
        const parsedDestination = destination ? new URL(destination) : null;
        if (parsedDestination && parsedDestination.origin === window.location.origin &&
            (parsedDestination.pathname === '/admin/' || parsedDestination.pathname === '/admin.html' || parsedDestination.pathname === '/workspace/' || parsedDestination.pathname === '/workspace.html')) {
            allowedDestination = parsedDestination.href;
        }
    } catch (error) {
        console.error('Invalid authentication destination', error);
    }
    if (!allowedDestination) return;

    window.localStorage.removeItem('notablepath-auth-destination');
    if (window.location.hash.includes('error=')) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        return;
    }

    const authClient = window.getNotablePathSupabase();
    if (!authClient) return;
    authClient.auth.getSession().then(({ data }) => {
        if (data.session) window.location.replace(allowedDestination);
    }).catch(error => console.error('Unable to complete authentication callback', error));
})();

