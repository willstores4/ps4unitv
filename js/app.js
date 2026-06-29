/**
 * app.js — UnitV Pro PS4
 * Orquestrador principal: estado, roteamento e inicialização
 */

const App = (() => {
    // ── Estado global ────────────────────────────────── //
    let session = null;  // { dns, user, pass }
    let data    = {
        liveCategories:   [],
        vodCategories:    [],
        seriesCategories: [],
        liveStreams:       [],
        allMovies:         [],
        allSeries:         [],
        isLoaded: false,
    };
    let panelConfig      = {};
    let currentScreen    = 'screen-splash';
    let screenHistory    = [];
    let activeTab        = 'live';
    let currentCategoryId = '0';
    let currentLiveChannel = null;
    let _currentDetails  = null; // movie or series currently shown
    let _searchFilter    = 'all';

    /* ── Screen Router ──────────────────────────────── */
    function showScreen(id, pushHistory) {
        if (pushHistory !== false && currentScreen !== id) {
            screenHistory.push(currentScreen);
        }
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        currentScreen = id;
        Navigation.focusFirstInScreen(id);
    }

    function goBack() {
        // Player screen → go back to main
        if (currentScreen === 'screen-player') {
            Player.stopFullscreen();
            if (screenHistory.length > 0) {
                showScreen(screenHistory.pop(), false);
            } else {
                showScreen('screen-main', false);
            }
            return;
        }
        // Close any open modal first
        const openModal = document.querySelector('.modal.open');
        if (openModal) { openModal.classList.remove('open'); return; }

        if (screenHistory.length > 0) {
            const prev = screenHistory.pop();
            showScreen(prev, false);
        }
        // If on main screen, do nothing
    }

    /* ── Main Screen ────────────────────────────────── */
    function showMain() {
        showScreen('screen-main');
        initMainListeners();
        loadTab('live');
        UI.startClock();
        updateSettingsValues();
        // Fetch panel config to update notification badge
        if (panelConfig && panelConfig.message_global || panelConfig.messageGlobal) {
            UI.updateNotifBadge(true);
        }
    }

    function showLogin() {
        showScreen('screen-login', false);
        screenHistory = [];
        UI.initLoginBanner();
    }

    /* ── Tab System ─────────────────────────────────── */
    function loadTab(tabName) {
        activeTab = tabName;

        // Toggle tab-content visibility
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        const tc = document.getElementById(`tab-content-${tabName}`);
        if (tc) tc.classList.add('active');

        // Toggle tab-btn active
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const tb = document.getElementById(`tab-${tabName}`);
        if (tb) tb.classList.add('active');

        switch (tabName) {
            case 'live':
                loadLiveTab();
                break;
            case 'movies':
                UI.renderMoviesTab(data.allMovies, data.vodCategories);
                break;
            case 'series':
                UI.renderSeriesTab(data.allSeries, data.seriesCategories);
                break;
            case 'sports':
                UI.renderSportsTab(data.liveStreams);
                break;
            case 'kids':
                UI.renderKidsTab(data.allMovies, data.allSeries);
                break;
        }
    }

    /* ── Live Tab ───────────────────────────────────── */
    function loadLiveTab() {
        const cats = [
            { category_id: '-1', category_name: '⭐ Favoritos' },
            { category_id: '0',  category_name: '📺 Todos os Canais' },
            ...data.liveCategories
        ];
        UI.renderCategories(data.liveCategories, currentCategoryId);
        loadChannelsByCategory(currentCategoryId);
    }

    function loadChannelsByCategory(catId) {
        currentCategoryId = catId;
        let channels;
        if (catId === '-1') {
            // Favoritos
            const favIds = getFavorites().filter(f => f.type === 'live').map(f => f.id);
            channels = data.liveStreams.filter(s => favIds.includes(s.stream_id));
        } else if (catId === '0') {
            channels = data.liveStreams;
        } else {
            channels = data.liveStreams.filter(s => String(s.category_id) === String(catId));
        }
        UI.renderChannels(channels, currentLiveChannel ? currentLiveChannel.stream_id : null);
    }

    /* ── Play Channel ───────────────────────────────── */
    function playChannel(channel) {
        currentLiveChannel = channel;
        const s = session;
        if (!s) return;
        const url = getLiveStreamUrl(s.dns, s.user, s.pass, channel.stream_id);
        Player.playMini(url, channel.name, channel.stream_id);
        // Update active channel in list
        document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    }

    /* ── Movie Details ──────────────────────────────── */
    async function openMovieDetails(item) {
        _currentDetails = { item, type: 'movie' };
        document.getElementById('details-play').style.display = 'inline-flex';
        showScreen('screen-details');
        await UI.renderMovieDetails(item);
    }

    /* ── Series Details ─────────────────────────────── */
    async function openSeriesDetails(item) {
        _currentDetails = { item, type: 'series' };
        showScreen('screen-details');
        await UI.renderSeriesDetails(item);
    }

    /* ── Category / Grid Screens ────────────────────── */
    function openCategoryScreen(categories, type, title) {
        document.getElementById('cat-title').textContent = title || 'Categorias';
        document.getElementById('cat-search').value = '';
        showScreen('screen-category');
        UI.renderCategoryGrid(categories, type, (cat) => {
            const catId  = cat.category_id || cat.categoryId;
            const catName= cat.category_name || cat.categoryName || '';
            let items;
            if (type === 'movie')  items = data.allMovies.filter(m => String(m.category_id) === String(catId));
            else if (type === 'series') items = data.allSeries.filter(s => String(s.category_id) === String(catId));
            else items = data.liveStreams.filter(s => String(s.category_id) === String(catId));
            openGridScreen(items, type, catName);
        });
    }

    function openGridScreen(items, type, title) {
        document.getElementById('grid-search').value = '';
        showScreen('screen-grid');
        UI.renderContentGrid(items, type, title);
    }

    /* ── Search ─────────────────────────────────────── */
    let _searchDebounce = null;
    function initSearchListeners() {
        const input = document.getElementById('search-input');
        if (input) {
            input.addEventListener('input', () => {
                clearTimeout(_searchDebounce);
                _searchDebounce = setTimeout(() => {
                    UI.renderSearch(input.value.trim(), _searchFilter);
                }, 300);
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                _searchFilter = btn.dataset.filter || 'all';
                const q = document.getElementById('search-input').value.trim();
                UI.renderSearch(q, _searchFilter);
            });
        });
    }

    /* ── Parental Lock ──────────────────────────────── */
    function withParentalLock(onSuccess) {
        UI.showParentalModal(onSuccess);
    }

    /* ── Favorite from player ────────────────────────── */
    function toggleFavoriteFromPlayer() {
        if (!currentLiveChannel) return;
        const id = currentLiveChannel.stream_id;
        if (isFavorite(id, 'live')) {
            removeFavorite(id, 'live');
            showToast('Removido dos favoritos');
        } else {
            addFavorite({ id, type: 'live', title: currentLiveChannel.name, thumb: currentLiveChannel.stream_icon });
            showToast('⭐ Adicionado aos favoritos');
        }
        Player.updateFavoriteBtn(id, 'live');
    }

    /* ── Apply Panel Config ──────────────────────────── */
    function applyPanelConfig(cfg) {
        if (!cfg) return;
        panelConfig = { ...panelConfig, ...cfg };
        UI.applyBranding(cfg);
        if (cfg.dns && Array.isArray(cfg.dns) && cfg.dns.length > 0) {
            Auth.setDnsList(cfg.dns);
        }
        if (cfg.message_global || cfg.messageGlobal) {
            UI.updateNotifBadge(true);
        }
    }

    /* ── Settings ────────────────────────────────────── */
    function updateSettingsValues() {
        if (!session) return;
        document.getElementById('settings-user').textContent = session.user || '-';
        document.getElementById('settings-mac').textContent  = Auth.getDeviceId() || '-';
        document.getElementById('settings-dns').textContent  = session.dns || '-';
        document.getElementById('profile-user').textContent  = session.user || '-';
        document.getElementById('profile-mac').textContent   = Auth.getDeviceId() || '-';
        document.getElementById('profile-dns').textContent   = session.dns || '-';
    }

    /* ── Init Main Listeners ─────────────────────────── */
    function initMainListeners() {
        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => loadTab(btn.dataset.tab));
        });

        // Top bar
        document.getElementById('btn-search').addEventListener('click', () => {
            showScreen('screen-search');
            setTimeout(() => document.getElementById('search-input').focus(), 150);
        });
        document.getElementById('btn-history').addEventListener('click', () => {
            showScreen('screen-history');
            UI.renderHistory();
        });
        document.getElementById('btn-messages').addEventListener('click', () => {
            UI.showMessageModal(panelConfig.message_global || panelConfig.messageGlobal || panelConfig.globalMessage);
        });
        document.getElementById('btn-profile').addEventListener('click', () => {
            updateSettingsValues();
            UI.openModal('modal-profile');
        });
        document.getElementById('btn-settings').addEventListener('click', () => {
            updateSettingsValues();
            showScreen('screen-settings');
        });

        // Category toggle
        document.getElementById('btn-toggle-categories').addEventListener('click', () => {
            const list = document.getElementById('category-list');
            list.style.display = list.style.display === 'none' ? 'flex' : 'none';
        });

        // Movies quick cats
        document.getElementById('movies-btn-genre').addEventListener('click', () => openCategoryScreen(data.vodCategories, 'movie', 'Categorias de Filmes'));
        document.getElementById('movies-btn-2026').addEventListener('click', () => {
            const cat = data.vodCategories.find(c => (c.category_name||'').match(/lança|2025|2026/i));
            const items = cat ? data.allMovies.filter(m => String(m.category_id) === String(cat.category_id)) : data.allMovies.slice(0, 100);
            openGridScreen(items, 'movie', cat ? cat.category_name : 'Lançamentos');
        });
        document.getElementById('movies-btn-cinema').addEventListener('click', () => {
            const cat = data.vodCategories.find(c => (c.category_name||'').toLowerCase().includes('cinema'));
            const items = cat ? data.allMovies.filter(m => String(m.category_id) === String(cat.category_id)) : [];
            openGridScreen(items, 'movie', 'Cinema');
        });
        document.getElementById('movies-btn-adult').addEventListener('click', () => {
            withParentalLock(() => {
                const cat = data.vodCategories.find(c => isAdultCat(c.category_name));
                const items = cat ? data.allMovies.filter(m => String(m.category_id) === String(cat.category_id)) : [];
                openGridScreen(items, 'movie', 'Adultos');
            });
        });

        // Series quick cats
        document.getElementById('series-btn-genre').addEventListener('click', () => openCategoryScreen(data.seriesCategories, 'series', 'Categorias de Séries'));
        document.getElementById('series-btn-novelas').addEventListener('click', () => {
            const items = data.allSeries.filter(s => (s.name||'').toLowerCase().match(/novela|globo|record/));
            openGridScreen(items, 'series', 'Novelas');
        });
        document.getElementById('series-btn-netflix').addEventListener('click', () => {
            const items = data.allSeries.filter(s => (s.name||'').toLowerCase().match(/netflix|hbo|disney|amazon/));
            openGridScreen(items, 'series', 'Netflix & Streamings');
        });
        document.getElementById('series-btn-doramas').addEventListener('click', () => {
            const items = data.allSeries.filter(s => (s.name||'').toLowerCase().match(/dorama|coreano|coreia|japonês|kdrama/));
            openGridScreen(items, 'series', 'Doramas');
        });

        // Back buttons
        document.getElementById('cat-back').addEventListener('click', goBack);
        document.getElementById('grid-back').addEventListener('click', goBack);
        document.getElementById('details-back').addEventListener('click', goBack);
        document.getElementById('search-back').addEventListener('click', goBack);
        document.getElementById('history-back').addEventListener('click', goBack);
        document.getElementById('settings-back').addEventListener('click', goBack);

        // Settings actions
        document.getElementById('settings-logout').addEventListener('click', Auth.logout);
        document.getElementById('settings-refresh').addEventListener('click', async () => {
            if (!session) return;
            showToast('Atualizando catálogo...', 3000);
            await Auth.refreshCacheSilently(session.dns, session.user, session.pass);
            showToast('✅ Catálogo atualizado!');
        });
        document.getElementById('settings-clear-history').addEventListener('click', () => {
            clearHistory();
            showToast('Histórico limpo.');
        });

        // Modals close buttons
        document.getElementById('modal-support-close').addEventListener('click', () => UI.closeModal('modal-support'));
        document.getElementById('modal-news-close').addEventListener('click',    () => UI.closeModal('modal-news'));
        document.getElementById('modal-events-close').addEventListener('click',  () => {
            document.getElementById('events-iframe').src = '';
            UI.closeModal('modal-events');
        });
        document.getElementById('modal-message-close').addEventListener('click', () => UI.closeModal('modal-message'));
        document.getElementById('modal-profile-close').addEventListener('click', () => UI.closeModal('modal-profile'));
        document.getElementById('modal-parental-close').addEventListener('click',() => UI.closeModal('modal-parental'));
        document.getElementById('profile-logout').addEventListener('click', () => {
            UI.closeModal('modal-profile');
            Auth.logout();
        });

        // Login card buttons (on login screen)
        document.getElementById('card-support').addEventListener('click', () => UI.showSupportModal(panelConfig.support_whatsapp));
        document.getElementById('card-news').addEventListener('click',    () => UI.showNewsModal(panelConfig.news_banner_url));
        document.getElementById('card-events').addEventListener('click',  () => UI.showEventsModal(panelConfig.events_url));

        // History screen
        document.getElementById('history-clear').addEventListener('click', () => { clearHistory(); UI.renderHistory(); showToast('Histórico limpo.'); });
    }

    /* ── Adult Category Detection ────────────────────── */
    function isAdultCat(name) {
        if (!name) return false;
        return /adult|xxx|sex|18\+|erót|porN/i.test(name);
    }

    /* ── Splash + Boot ───────────────────────────────── */
    async function boot() {
        // Update splash bar
        function splash(pct, text) {
            const bar  = document.getElementById('splash-bar-fill');
            const txt  = document.getElementById('splash-status');
            if (bar) bar.style.width = pct + '%';
            if (txt) txt.textContent = text || '';
        }

        splash(10, 'Iniciando...');
        await sleep(300);

        splash(30, 'Carregando configurações...');
        Navigation.init();
        Player.initListeners();
        initSearchListeners();

        // Init modal close on backdrop click
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
        });

        splash(60, 'Verificando sessão...');
        await sleep(400);

        splash(80, 'Pronto!');
        await sleep(400);

        splash(100, '');
        await sleep(300);

        // Go to login screen and init auth
        showScreen('screen-login', false);
        await Auth.init();
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ── Public API ──────────────────────────────────── */
    return {
        get session() { return session; },
        set session(v) { session = v; },
        get data() { return data; },
        set data(v) { data = v; },
        get panelConfig() { return panelConfig; },
        set panelConfig(v) { panelConfig = v; },
        get currentLiveChannel() { return currentLiveChannel; },
        set currentLiveChannel(v) { currentLiveChannel = v; },

        showScreen, goBack, showMain, showLogin,
        loadTab, loadChannelsByCategory,
        playChannel, openMovieDetails, openSeriesDetails,
        openCategoryScreen, openGridScreen,
        toggleFavoriteFromPlayer, applyPanelConfig,
        isAdultCat, boot,
    };
})();

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.boot());
