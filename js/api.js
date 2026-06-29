/**
 * api.js — UnitV Pro PS4
 * Todas as chamadas de API: Xtream Codes + Panel API + TMDB
 */

const PANEL_URL = 'https://willgame.top/iptv/unitv-pro/';
const TMDB_KEY  = '9c9cb34f4459dc4c8de0276cf67044c3';

/* ── Utilitários ────────────────────────────────────── */

async function fetchJSON(url, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

/* ── Panel API ───────────────────────────────────────── */

async function apiGetPanelConfig(mac) {
    try {
        const url = `${PANEL_URL}api.php?action=get_config${mac ? '&mac=' + encodeURIComponent(mac) : ''}`;
        return await fetchJSON(url);
    } catch (e) {
        console.warn('[API] Panel config failed:', e.message);
        return null;
    }
}

async function apiCheckMac(mac) {
    try {
        const url = `${PANEL_URL}api.php?action=check_mac&mac=${encodeURIComponent(mac)}`;
        return await fetchJSON(url);
    } catch (e) {
        console.warn('[API] checkMac failed:', e.message);
        return null;
    }
}

/* ── Xtream Codes API ────────────────────────────────── */

function xtreamUrl(dns, user, pass, action, extra) {
    let url = `${dns.replace(/\/$/, '')}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    if (action) url += `&action=${action}`;
    if (extra)  url += extra;
    return url;
}

async function apiLogin(dns, user, pass) {
    try {
        const url = xtreamUrl(dns, user, pass, null, null);
        return await fetchJSON(url, 12000);
    } catch (e) {
        console.warn('[API] login failed:', e.message);
        return null;
    }
}

async function apiGetLiveCategories(dns, user, pass) {
    try {
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_live_categories'), 20000);
    } catch (e) { console.warn('[API] live categories:', e.message); return []; }
}

async function apiGetVodCategories(dns, user, pass) {
    try {
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_vod_categories'), 20000);
    } catch (e) { console.warn('[API] vod categories:', e.message); return []; }
}

async function apiGetSeriesCategories(dns, user, pass) {
    try {
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_series_categories'), 20000);
    } catch (e) { console.warn('[API] series categories:', e.message); return []; }
}

async function apiGetLiveStreams(dns, user, pass, catId) {
    try {
        const extra = catId ? `&category_id=${catId}` : '';
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_live_streams', extra), 45000);
    } catch (e) { console.warn('[API] live streams:', e.message); return []; }
}

async function apiGetVodStreams(dns, user, pass, catId) {
    try {
        const extra = catId ? `&category_id=${catId}` : '';
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_vod_streams', extra), 60000);
    } catch (e) { console.warn('[API] vod streams:', e.message); return []; }
}

async function apiGetSeries(dns, user, pass, catId) {
    try {
        const extra = catId ? `&category_id=${catId}` : '';
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_series', extra), 60000);
    } catch (e) { console.warn('[API] series:', e.message); return []; }
}

async function apiGetVodInfo(dns, user, pass, vodId) {
    try {
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_vod_info', `&vod_id=${vodId}`), 15000);
    } catch (e) { console.warn('[API] vod info:', e.message); return null; }
}

async function apiGetSeriesInfo(dns, user, pass, seriesId) {
    try {
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_series_info', `&series_id=${seriesId}`), 15000);
    } catch (e) { console.warn('[API] series info:', e.message); return null; }
}

async function apiGetShortEpg(dns, user, pass, streamId) {
    try {
        return await fetchJSON(xtreamUrl(dns, user, pass, 'get_short_epg', `&stream_id=${streamId}`), 10000);
    } catch (e) { return null; }
}

/* ── Stream URLs ─────────────────────────────────────── */

function getLiveStreamUrl(dns, user, pass, streamId) {
    return `${dns.replace(/\/$/, '')}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${streamId}.m3u8`;
}

function getVodStreamUrl(dns, user, pass, vodId, extension) {
    const ext = extension || 'mp4';
    return `${dns.replace(/\/$/, '')}/movie/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${vodId}.${ext}`;
}

function getSeriesStreamUrl(dns, user, pass, episodeId, extension) {
    const ext = extension || 'mp4';
    return `${dns.replace(/\/$/, '')}/series/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${episodeId}.${ext}`;
}

/* ── TMDB API ────────────────────────────────────────── */

async function tmdbGetNowPlaying() {
    try {
        const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=pt-BR&page=1`;
        const data = await fetchJSON(url, 10000);
        return data.results || [];
    } catch (e) { console.warn('[TMDB]:', e.message); return []; }
}

async function tmdbGetMovieDetails(title) {
    try {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=pt-BR`;
        const data = await fetchJSON(url, 8000);
        return (data.results || [])[0] || null;
    } catch (e) { return null; }
}

function tmdbImg(path, size) {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size || 'w500'}${path}`;
}
