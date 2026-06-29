/**
 * cache.js — UnitV Pro PS4
 * Cache local usando localStorage (equivalente ao SharedPreferences do Android)
 */

const CACHE_KEY_ACCOUNT  = 'unitv_account_key';
const CACHE_KEY_LIVE_CAT = 'unitv_live_cat';
const CACHE_KEY_VOD_CAT  = 'unitv_vod_cat';
const CACHE_KEY_SER_CAT  = 'unitv_ser_cat';
const CACHE_KEY_LIVE_STR = 'unitv_live_streams';
const CACHE_KEY_VOD_STR  = 'unitv_vod_streams';
const CACHE_KEY_SER_STR  = 'unitv_series_streams';
const CACHE_KEY_UPDATED  = 'unitv_last_update';
const CACHE_KEY_CREDS    = 'XTREAM_PREFS';
const CACHE_KEY_FAVS     = 'unitv_favorites';
const CACHE_KEY_HISTORY  = 'unitv_history';
const CACHE_KEY_DNS_MODE = 'unitv_dns_list';

function cacheAccountKey(dns, user, pass) {
    return `${dns.replace(/\/$/, '')}|${user}|${pass}`;
}

/* ── Credenciais ──────────────────────────────────────── */

function saveCredentials(dns, user, pass, mode) {
    const data = { dns, user, pass, mode: mode || 'USER' };
    localStorage.setItem(CACHE_KEY_CREDS, JSON.stringify(data));
}

function loadCredentials() {
    try {
        const raw = localStorage.getItem(CACHE_KEY_CREDS);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function clearCredentials() {
    localStorage.removeItem(CACHE_KEY_CREDS);
}

/* ── Catálogo (cache de listas) ───────────────────────── */

function saveCache(dns, user, pass, data) {
    try {
        localStorage.setItem(CACHE_KEY_ACCOUNT, cacheAccountKey(dns, user, pass));
        localStorage.setItem(CACHE_KEY_LIVE_CAT, JSON.stringify(data.liveCategories || []));
        localStorage.setItem(CACHE_KEY_VOD_CAT,  JSON.stringify(data.vodCategories  || []));
        localStorage.setItem(CACHE_KEY_SER_CAT,  JSON.stringify(data.seriesCategories || []));
        localStorage.setItem(CACHE_KEY_LIVE_STR, JSON.stringify(data.liveStreams   || []));
        localStorage.setItem(CACHE_KEY_VOD_STR,  JSON.stringify(data.allMovies     || []));
        localStorage.setItem(CACHE_KEY_SER_STR,  JSON.stringify(data.allSeries     || []));
        localStorage.setItem(CACHE_KEY_UPDATED,  Date.now().toString());
        console.log('[Cache] Dados salvos.');
    } catch (e) {
        console.warn('[Cache] Erro ao salvar:', e.message);
    }
}

function loadCache(dns, user, pass) {
    try {
        const storedKey = localStorage.getItem(CACHE_KEY_ACCOUNT);
        const expected  = cacheAccountKey(dns, user, pass);
        if (!storedKey || storedKey !== expected) {
            console.log('[Cache] Cache ignorado: conta diferente.');
            return null;
        }
        if (!localStorage.getItem(CACHE_KEY_LIVE_STR)) return null;

        return {
            liveCategories:   JSON.parse(localStorage.getItem(CACHE_KEY_LIVE_CAT) || '[]'),
            vodCategories:    JSON.parse(localStorage.getItem(CACHE_KEY_VOD_CAT)  || '[]'),
            seriesCategories: JSON.parse(localStorage.getItem(CACHE_KEY_SER_CAT)  || '[]'),
            liveStreams:       JSON.parse(localStorage.getItem(CACHE_KEY_LIVE_STR) || '[]'),
            allMovies:         JSON.parse(localStorage.getItem(CACHE_KEY_VOD_STR)  || '[]'),
            allSeries:         JSON.parse(localStorage.getItem(CACHE_KEY_SER_STR)  || '[]'),
        };
    } catch (e) {
        console.warn('[Cache] Erro ao carregar:', e.message);
        return null;
    }
}

function clearCache() {
    const keys = [
        CACHE_KEY_ACCOUNT, CACHE_KEY_LIVE_CAT, CACHE_KEY_VOD_CAT,
        CACHE_KEY_SER_CAT, CACHE_KEY_LIVE_STR, CACHE_KEY_VOD_STR,
        CACHE_KEY_SER_STR, CACHE_KEY_UPDATED
    ];
    keys.forEach(k => localStorage.removeItem(k));
}

/* ── DNS List ─────────────────────────────────────────── */

function saveDnsList(list) {
    localStorage.setItem(CACHE_KEY_DNS_MODE, JSON.stringify(list));
}

function loadDnsList() {
    try {
        const raw = localStorage.getItem(CACHE_KEY_DNS_MODE);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

/* ── Favoritos ────────────────────────────────────────── */

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY_FAVS) || '[]');
    } catch { return []; }
}

function addFavorite(item) {
    const favs = getFavorites();
    if (!favs.find(f => f.id === item.id && f.type === item.type)) {
        favs.unshift(item);
        if (favs.length > 200) favs.pop();
        localStorage.setItem(CACHE_KEY_FAVS, JSON.stringify(favs));
    }
}

function removeFavorite(id, type) {
    const favs = getFavorites().filter(f => !(f.id === id && f.type === type));
    localStorage.setItem(CACHE_KEY_FAVS, JSON.stringify(favs));
}

function isFavorite(id, type) {
    return getFavorites().some(f => f.id === id && f.type === type);
}

function clearFavorites() {
    localStorage.removeItem(CACHE_KEY_FAVS);
}

/* ── Histórico ────────────────────────────────────────── */

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY_HISTORY) || '[]');
    } catch { return []; }
}

function addHistory(item) {
    let hist = getHistory().filter(h => !(h.id === item.id && h.type === item.type));
    hist.unshift({ ...item, watchedAt: Date.now() });
    if (hist.length > 100) hist = hist.slice(0, 100);
    localStorage.setItem(CACHE_KEY_HISTORY, JSON.stringify(hist));
}

function clearHistory() {
    localStorage.removeItem(CACHE_KEY_HISTORY);
}

/* ── Parental PIN ────────────────────────────────────── */

function getParentalPin() {
    return localStorage.getItem('unitv_parental_pin') || '1234';
}

function setParentalPin(pin) {
    localStorage.setItem('unitv_parental_pin', pin);
}
