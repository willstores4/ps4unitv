/**
 * player.js — UnitV Pro PS4
 * Player HLS.js para canais ao vivo, filmes e séries
 * Substitui ExoPlayer + Media3 do Android
 */

const Player = (() => {
    let _hls        = null;
    let _miniHls    = null;
    let _currentUrl = '';
    let _isLive     = false;
    let _controlsTimer = null;
    let _fsVisible  = false;
    let _clockTimer = null;

    const miniVideo = () => document.getElementById('mini-video');
    const fsVideo   = () => document.getElementById('fullscreen-video');
    const fsCtrl    = () => document.getElementById('fs-controls');
    const fsLoad    = () => document.getElementById('fs-loading');

    /* ── HLS Support Check ────────────────────────────── */
    function isHlsUrl(url) {
        return url && (url.includes('.m3u8') || url.includes('/live/'));
    }

    /* ── Mini Player (Ao Vivo) ────────────────────────── */
    function playMini(url, channelName, streamId) {
        _currentUrl = url;
        const vid   = miniVideo();
        const load  = document.getElementById('mini-loading');

        stopMini();

        if (load) { load.style.display = 'flex'; load.classList.add('visible'); }

        if (isHlsUrl(url) && typeof Hls !== 'undefined' && Hls.isSupported()) {
            _miniHls = new Hls({
                enableWorker: false,
                lowLatencyMode: true,
                backBufferLength: 30,
            });
            _miniHls.loadSource(url);
            _miniHls.attachMedia(vid);
            _miniHls.on(Hls.Events.MANIFEST_PARSED, () => {
                vid.play().catch(() => {});
            });
            _miniHls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    console.warn('[Player] Mini HLS error:', data.type);
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) _miniHls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) _miniHls.recoverMediaError();
                }
            });
        } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
            vid.src = url;
            vid.play().catch(() => {});
        } else {
            vid.src = url;
            vid.play().catch(() => {});
        }

        vid.oncanplay = () => {
            if (load) { load.style.display = 'none'; load.classList.remove('visible'); }
        };
        vid.onwaiting = () => {
            if (load) { load.style.display = 'flex'; load.classList.add('visible'); }
        };

        // Update channel info
        const nameEl = document.getElementById('mini-channel-name');
        if (nameEl) nameEl.textContent = channelName || '';

        // Load EPG
        if (streamId && App.session) {
            apiGetShortEpg(App.session.dns, App.session.user, App.session.pass, streamId)
                .then(epg => {
                    const epgEl = document.getElementById('mini-epg-program');
                    if (epgEl && epg && epg.epg_listings && epg.epg_listings.length > 0) {
                        const prog = epg.epg_listings[0];
                        const title = atob(prog.title || '') || '';
                        epgEl.textContent = title;
                        const fsEpg = document.getElementById('fs-epg-now');
                        if (fsEpg) fsEpg.textContent = `📺 ${title}`;
                    }
                });
        }
    }

    function stopMini() {
        if (_miniHls) { _miniHls.destroy(); _miniHls = null; }
        const vid = miniVideo();
        if (vid) { vid.pause(); vid.src = ''; }
    }

    /* ── Fullscreen Player ────────────────────────────── */
    function openFullscreen(url, title, isLive, streamId) {
        _isLive = !!isLive;
        const vid  = fsVideo();
        const ctrl = fsCtrl();
        const load = fsLoad();

        stopFullscreen();

        App.showScreen('screen-player');

        const titleEl = document.getElementById('fs-title');
        if (titleEl) titleEl.textContent = title || '';

        // Progress bar visibility
        const progressWrap = document.getElementById('fs-progress-wrap');
        if (progressWrap) progressWrap.style.display = isLive ? 'none' : 'flex';

        // Seek buttons
        document.getElementById('fs-rewind').style.display  = isLive ? 'none' : 'inline-flex';
        document.getElementById('fs-forward').style.display = isLive ? 'none' : 'inline-flex';

        if (load) load.style.display = 'flex';

        if (isHlsUrl(url) && typeof Hls !== 'undefined' && Hls.isSupported()) {
            _hls = new Hls({
                enableWorker: false,
                lowLatencyMode: isLive,
                backBufferLength: isLive ? 30 : 60,
                maxBufferLength: isLive ? 30 : 60,
            });
            _hls.loadSource(url);
            _hls.attachMedia(vid);
            _hls.on(Hls.Events.MANIFEST_PARSED, () => {
                vid.play().catch(() => {});
            });
            _hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) _hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) _hls.recoverMediaError();
                    else { stopFullscreen(); showToast('Erro ao reproduzir. Tente novamente.'); }
                }
            });
        } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
            vid.src = url;
            vid.play().catch(() => {});
        } else {
            vid.src = url;
            vid.play().catch(() => {});
        }

        vid.oncanplay    = () => { if (load) load.style.display = 'none'; };
        vid.onwaiting    = () => { if (load) load.style.display = 'flex'; };
        vid.ontimeupdate = () => updateProgress();

        // History
        addHistory({ id: streamId, title, type: isLive ? 'live' : 'vod', thumb: '' });

        showControls();
        startClockFS();
        startControlsTimer();
    }

    function stopFullscreen() {
        if (_hls) { _hls.destroy(); _hls = null; }
        const vid = fsVideo();
        if (vid) { vid.pause(); vid.src = ''; }
        clearControlsTimer();
        stopClockFS();
    }

    /* ── Controls ─────────────────────────────────────── */
    function showControls() {
        const ctrl = fsCtrl();
        if (ctrl) ctrl.classList.add('visible');
        _fsVisible = true;
        startControlsTimer();
    }

    function hideControls() {
        const ctrl = fsCtrl();
        if (ctrl) ctrl.classList.remove('visible');
        _fsVisible = false;
    }

    function toggleControls() {
        if (_fsVisible) hideControls();
        else showControls();
    }

    function startControlsTimer() {
        clearControlsTimer();
        _controlsTimer = setTimeout(() => { if (!_isLive) hideControls(); }, 5000);
    }
    function clearControlsTimer() {
        if (_controlsTimer) { clearTimeout(_controlsTimer); _controlsTimer = null; }
    }

    function togglePlayPause() {
        const vid = fsVideo();
        if (!vid) return;
        const btn = document.getElementById('fs-play-pause');
        if (vid.paused) {
            vid.play();
            if (btn) btn.textContent = '⏸';
        } else {
            vid.pause();
            if (btn) btn.textContent = '▶';
        }
        showControls();
    }

    function seek(seconds) {
        const vid = fsVideo();
        if (!vid || _isLive) return;
        vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + seconds));
        showControls();
    }

    function updateProgress() {
        const vid  = fsVideo();
        if (!vid || !vid.duration) return;
        const pct  = (vid.currentTime / vid.duration) * 100;
        const fill = document.getElementById('fs-progress-fill');
        if (fill) fill.style.width = pct + '%';
        document.getElementById('fs-time-current').textContent = formatTime(vid.currentTime);
        document.getElementById('fs-time-total').textContent   = formatTime(vid.duration);
    }

    function formatTime(sec) {
        if (isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    /* ── Clock in FS ──────────────────────────────────── */
    function startClockFS() {
        stopClockFS();
        function tick() {
            const el = document.getElementById('fs-clock');
            if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
        }
        tick();
        _clockTimer = setInterval(tick, 30000);
    }
    function stopClockFS() {
        if (_clockTimer) { clearInterval(_clockTimer); _clockTimer = null; }
    }

    /* ── Favorite in Player ───────────────────────────── */
    function updateFavoriteBtn(id, type) {
        const btn = document.getElementById('fs-favorite');
        if (!btn) return;
        btn.textContent = isFavorite(id, type) ? '★' : '☆';
    }

    /* ── Init listeners ────────────────────────────────── */
    function initListeners() {
        // Fullscreen video click → toggle controls
        const fsVid = fsVideo();
        if (fsVid) fsVid.addEventListener('click', toggleControls);

        document.getElementById('fs-back').addEventListener('click', () => {
            stopFullscreen();
            App.goBack();
        });

        document.getElementById('fs-play-pause').addEventListener('click', togglePlayPause);
        document.getElementById('fs-rewind').addEventListener('click', () => seek(-10));
        document.getElementById('fs-forward').addEventListener('click', () => seek(10));

        document.getElementById('fs-fullscreen').addEventListener('click', () => {
            const vid = fsVideo();
            if (vid && vid.requestFullscreen) vid.requestFullscreen();
        });

        document.getElementById('fs-favorite').addEventListener('click', () => {
            showControls();
            // Handled by app.js
        });

        // Mini player click → expand to fullscreen
        document.getElementById('mini-player-container').addEventListener('click', () => {
            if (App.currentLiveChannel) {
                const s = App.session;
                const ch = App.currentLiveChannel;
                const url = getLiveStreamUrl(s.dns, s.user, s.pass, ch.stream_id);
                openFullscreen(url, ch.name, true, ch.stream_id);
            }
        });
    }

    return { playMini, stopMini, openFullscreen, stopFullscreen, showControls, toggleControls, seek, initListeners, updateFavoriteBtn };
})();
