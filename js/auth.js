/**
 * auth.js — UnitV Pro PS4
 * Login, auto-login, MAC, fallback DNS
 */

const Auth = (() => {
    let _dnsList    = [];
    let _dnsIndex   = 0;
    let _macCheckInterval = null;
    let _isMacMode  = false;
    let _isAuthenticating = false;

    /* ── MAC address (PS4) ─────────────────────────────── */
    // No PS4, obtemos um identificador único via Gamepad API ou User-Agent hash
    function getDeviceId() {
        // Tenta localStorage persistente como identificador
        let id = localStorage.getItem('unitv_device_id');
        if (!id) {
            // Gera baseado em UserAgent + timestamp (pseudo-MAC)
            const ua  = navigator.userAgent || '';
            const ts  = Date.now().toString(16);
            let hash  = 0;
            for (let i = 0; i < ua.length; i++) hash = ((hash << 5) - hash) + ua.charCodeAt(i);
            hash = Math.abs(hash).toString(16).padStart(8, '0');
            id = `PS:${hash.substr(0,2)}:${hash.substr(2,2)}:${hash.substr(4,2)}:${ts.substr(-4,2)}:${ts.substr(-2)}`.toUpperCase();
            localStorage.setItem('unitv_device_id', id);
        }
        return id;
    }

    /* ── DNS Manager ────────────────────────────────────── */
    function setDnsList(list) {
        _dnsList  = list || [];
        _dnsIndex = 0;
        saveDnsList(_dnsList);
    }

    function getCurrentDns() {
        if (_dnsList.length === 0) return null;
        return _dnsList[_dnsIndex] || _dnsList[0];
    }

    function fallbackDns() {
        if (_dnsList.length <= 1) return false;
        _dnsIndex = (_dnsIndex + 1) % _dnsList.length;
        console.log('[Auth] Fallback DNS:', getCurrentDns());
        return true;
    }

    /* ── Panel Config ───────────────────────────────────── */
    async function fetchPanelConfig(mac) {
        const cfg = await apiGetPanelConfig(mac);
        if (!cfg) return;
        if (cfg.dns && Array.isArray(cfg.dns) && cfg.dns.length > 0) {
            setDnsList(cfg.dns);
        }
        App.panelConfig = cfg;
        return cfg;
    }

    /* ── Perform Login ─────────────────────────────────── */
    async function performLogin(dns, user, pass, attempt) {
        _isAuthenticating = true;
        attempt = attempt || 1;

        updateLoginProgress(20 + attempt * 10, 'Aguardando conexão com o servidor...');

        const response = await apiLogin(dns, user, pass);
        const isActive = response && response.user_info && response.user_info.auth === 1
                      || response && response.user_info && response.user_info.status === 'Active';

        if (isActive) {
            updateLoginProgress(90, 'Login bem-sucedido!');
            saveCredentials(dns, user, pass, _isMacMode ? 'MAC' : 'USER');
            App.session = { dns, user, pass };
            await preloadAll(dns, user, pass);
        } else {
            // Tenta próximo DNS
            if (attempt < _dnsList.length && fallbackDns()) {
                return performLogin(getCurrentDns(), user, pass, attempt + 1);
            }
            _isAuthenticating = false;
            hideLoginProgress();
            showLoginForms();
            showToast('❌ Falha na conexão com todos os servidores.', 4000);
        }
    }

    /* ── MAC Login ─────────────────────────────────────── */
    async function performMacLogin(mac) {
        _isAuthenticating = true;
        updateLoginProgress(30, 'Verificando MAC...');

        const data = await apiCheckMac(mac);
        if (data && data.active) {
            const dns = (data.dns && data.dns.trim()) ? data.dns : getCurrentDns();
            if (dns && data.username && data.password) {
                stopMacAutoCheck();
                await performLogin(dns, data.username, data.password);
            } else {
                resetLoginState('MAC registrado! Aguarde ativação no painel.');
            }
        } else {
            resetLoginState(data?.message || 'MAC solicitado. Aguardando aprovação no painel...');
            startMacAutoCheck(mac);
        }
    }

    function resetLoginState(msg) {
        _isAuthenticating = false;
        hideLoginProgress();
        showLoginForms();
        if (msg) showToast(msg, 4000);
    }

    /* ── MAC Auto-Check ────────────────────────────────── */
    function startMacAutoCheck(mac) {
        stopMacAutoCheck();
        _macCheckInterval = setInterval(async () => {
            if (_isAuthenticating) return;
            const data = await apiCheckMac(mac);
            if (data && data.active && data.username && data.password) {
                const dns = (data.dns && data.dns.trim()) ? data.dns : getCurrentDns();
                if (dns) {
                    stopMacAutoCheck();
                    performLogin(dns, data.username, data.password);
                }
            }
        }, 10000);
    }

    function stopMacAutoCheck() {
        if (_macCheckInterval) {
            clearInterval(_macCheckInterval);
            _macCheckInterval = null;
        }
    }

    /* ── Preload ────────────────────────────────────────── */
    async function preloadAll(dns, user, pass) {
        // Tenta cache primeiro
        const cached = loadCache(dns, user, pass);
        if (cached && cached.liveStreams && cached.liveStreams.length > 0) {
            App.data = cached;
            App.data.isLoaded = true;
            updateLoginProgress(100, 'Carregando dados salvos...');
            setTimeout(() => App.showMain(), 600);
            // Atualiza em background
            setTimeout(() => refreshCacheSilently(dns, user, pass), 15000);
            return;
        }

        // Download completo
        updateLoginProgress(40, 'Sincronizando categorias ao vivo...');
        App.data.liveCategories   = await apiGetLiveCategories(dns, user, pass);

        updateLoginProgress(50, 'Sincronizando categorias de filmes...');
        App.data.vodCategories    = await apiGetVodCategories(dns, user, pass);

        updateLoginProgress(55, 'Sincronizando categorias de séries...');
        App.data.seriesCategories = await apiGetSeriesCategories(dns, user, pass);

        updateLoginProgress(65, 'Baixando canais ao vivo...');
        App.data.liveStreams       = await apiGetLiveStreams(dns, user, pass);

        updateLoginProgress(80, 'Baixando filmes...');
        App.data.allMovies        = await apiGetVodStreams(dns, user, pass);

        updateLoginProgress(92, 'Baixando séries...');
        App.data.allSeries        = await apiGetSeries(dns, user, pass);

        saveCache(dns, user, pass, App.data);
        App.data.isLoaded = true;
        updateLoginProgress(100, 'Pronto!');
        setTimeout(() => App.showMain(), 600);
    }

    async function refreshCacheSilently(dns, user, pass) {
        try {
            App.data.liveCategories   = await apiGetLiveCategories(dns, user, pass);
            await delay(3000);
            App.data.vodCategories    = await apiGetVodCategories(dns, user, pass);
            await delay(3000);
            App.data.seriesCategories = await apiGetSeriesCategories(dns, user, pass);
            await delay(5000);
            App.data.liveStreams       = await apiGetLiveStreams(dns, user, pass);
            await delay(5000);
            App.data.allMovies        = await apiGetVodStreams(dns, user, pass);
            await delay(5000);
            App.data.allSeries        = await apiGetSeries(dns, user, pass);
            saveCache(dns, user, pass, App.data);
            console.log('[Auth] Cache atualizado em background.');
        } catch (e) {
            console.warn('[Auth] Atualização silenciosa falhou:', e.message);
        }
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ── Login UI Helpers ───────────────────────────────── */
    function updateLoginProgress(pct, text) {
        const prog = document.getElementById('login-progress');
        const fill = document.getElementById('login-progress-fill');
        const txt  = document.getElementById('login-progress-text');
        if (prog) prog.style.display = 'flex';
        if (fill) fill.style.width = pct + '%';
        if (txt)  txt.textContent = text || '';
        // Hide forms while loading
        document.getElementById('login-user-section').style.display  = 'none';
        document.getElementById('login-mac-section').style.display   = 'none';
        document.getElementById('btn-switch-mode').style.display      = 'none';
    }

    function hideLoginProgress() {
        const prog = document.getElementById('login-progress');
        if (prog) prog.style.display = 'none';
        document.getElementById('btn-switch-mode').style.display = 'block';
    }

    function showLoginForms() {
        if (_isMacMode) {
            document.getElementById('login-user-section').style.display = 'none';
            document.getElementById('login-mac-section').style.display  = 'block';
        } else {
            document.getElementById('login-user-section').style.display = 'block';
            document.getElementById('login-mac-section').style.display  = 'none';
        }
    }

    /* ── Public Init ────────────────────────────────────── */
    async function init() {
        const mac = getDeviceId();
        document.getElementById('login-mac').value = mac;

        // Restore mode
        const creds = loadCredentials();
        _isMacMode = creds && creds.mode === 'MAC';
        _updateModeUI();

        // Setup listeners
        document.getElementById('btn-login').addEventListener('click', () => {
            if (_isAuthenticating) return;
            const user = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value.trim();
            if (!user || !pass) { showToast('Preencha usuário e senha.'); return; }
            const dns = getCurrentDns();
            if (!dns) { fetchPanelConfig(mac).then(() => performLogin(getCurrentDns(), user, pass)); return; }
            performLogin(dns, user, pass);
        });

        document.getElementById('btn-mac-login').addEventListener('click', () => {
            if (_isAuthenticating) return;
            performMacLogin(mac);
        });

        document.getElementById('btn-switch-mode').addEventListener('click', () => {
            _isMacMode = !_isMacMode;
            _updateModeUI();
        });

        // Enter key on inputs
        ['login-user', 'login-pass'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => {
                if (e.key === 'Enter') document.getElementById('btn-login').click();
            });
        });

        // Panel config + auto-login
        const cfg = await fetchPanelConfig(mac);
        if (cfg) App.applyPanelConfig(cfg);

        if (creds && creds.user && creds.pass && creds.dns) {
            // Auto-login com credenciais salvas
            document.getElementById('login-user').value = creds.user;
            document.getElementById('login-pass').value = creds.pass;
            _dnsList = [creds.dns, ...loadDnsList().filter(d => d !== creds.dns)];
            setTimeout(() => performLogin(creds.dns, creds.user, creds.pass), 800);
        } else if (creds && creds.mode === 'MAC') {
            startMacAutoCheck(mac);
        }
    }

    function _updateModeUI() {
        const sw = document.getElementById('btn-switch-mode');
        if (_isMacMode) {
            document.getElementById('login-user-section').style.display = 'none';
            document.getElementById('login-mac-section').style.display  = 'block';
            if (sw) sw.textContent = 'Acessar via Usuário';
        } else {
            document.getElementById('login-user-section').style.display = 'block';
            document.getElementById('login-mac-section').style.display  = 'none';
            if (sw) sw.textContent = 'Acessar via MAC';
        }
    }

    function logout() {
        stopMacAutoCheck();
        clearCache();
        clearCredentials();
        clearFavorites();
        clearHistory();
        App.data = { liveCategories:[], vodCategories:[], seriesCategories:[], liveStreams:[], allMovies:[], allSeries:[], isLoaded: false };
        App.session = null;
        _isAuthenticating = false;
        _dnsIndex = 0;
        App.showScreen('screen-login');
        init();
    }

    return { init, logout, getDeviceId, setDnsList, getCurrentDns, refreshCacheSilently };
})();
