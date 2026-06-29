/**
 * ui.js — UnitV Pro PS4
 * Renderização de todas as telas e componentes visuais
 */

const UI = (() => {

    /* ── Toast ───────────────────────────────────────── */
    let _toastTimer = null;
    function showToast(msg, duration) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => el.classList.remove('show'), duration || 2500);
    }

    /* ── Clock ───────────────────────────────────────── */
    function startClock() {
        function tick() {
            const el = document.getElementById('topbar-clock');
            if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        tick();
        setInterval(tick, 30000);
    }

    /* ── Branding (logo + background) ───────────────── */
    function applyBranding(cfg) {
        if (!cfg) return;
        const logoUrl = cfg.app_logo;
        const bgUrl   = cfg.app_background;

        // Login screen
        if (logoUrl) {
            const loginLogo = document.getElementById('login-logo');
            const mainLogo  = document.getElementById('main-logo');
            const splashLogo= document.getElementById('splash-logo-img');
            if (loginLogo)  loginLogo.src  = logoUrl;
            if (mainLogo)   mainLogo.src   = logoUrl;
            if (splashLogo) splashLogo.src = logoUrl;
        }
        if (bgUrl) {
            const loginBg = document.getElementById('login-bg-img');
            const mainBg  = document.getElementById('main-bg');
            if (loginBg) loginBg.style.backgroundImage = `url(${bgUrl})`;
            if (mainBg)  mainBg.style.backgroundImage  = `url(${bgUrl})`;
        }

        // Panel extras
        if (cfg.support_whatsapp) App.panelConfig.support_whatsapp = cfg.support_whatsapp;
        if (cfg.events_url)       App.panelConfig.events_url       = cfg.events_url;
        if (cfg.news_banner_url)  App.panelConfig.news_banner_url  = cfg.news_banner_url;
        if (cfg.message_global || cfg.messageGlobal) {
            App.panelConfig.globalMessage = cfg.message_global || cfg.messageGlobal;
            const badge = document.getElementById('notif-badge');
            if (badge) badge.style.display = 'block';
        }
    }

    /* ── TMDB Banner na Login ────────────────────────── */
    let _tmdbMovies = [];
    let _tmdbIdx    = 0;
    let _tmdbTimer  = null;

    async function initLoginBanner() {
        _tmdbMovies = await tmdbGetNowPlaying();
        if (_tmdbMovies.length === 0) return;
        renderTmdbHighlights();
        rotateBanner();
        _tmdbTimer = setInterval(rotateBanner, 8000);
    }

    function rotateBanner() {
        if (_tmdbMovies.length === 0) return;
        const movie = _tmdbMovies[_tmdbIdx % _tmdbMovies.length];
        _tmdbIdx++;

        const img   = document.getElementById('login-banner-img');
        const title = document.getElementById('login-banner-title');
        const over  = document.getElementById('login-banner-overview');

        if (img)   { img.style.opacity = '0'; setTimeout(() => { img.src = tmdbImg(movie.backdrop_path, 'w1280'); img.style.opacity = '1'; }, 400); }
        if (title) title.textContent = movie.title || '';
        if (over)  over.textContent  = (movie.overview || '').substring(0, 160) + '...';
    }

    function renderTmdbHighlights() {
        const container = document.getElementById('login-highlights');
        if (!container) return;
        container.innerHTML = '';
        _tmdbMovies.slice(0, 8).forEach(movie => {
            const el = document.createElement('div');
            el.className = 'login-highlight-item focusable';
            el.tabIndex  = 0;
            const img = document.createElement('img');
            img.src = tmdbImg(movie.poster_path, 'w185');
            img.alt = movie.title || '';
            el.appendChild(img);
            el.addEventListener('click', () => {
                document.getElementById('login-banner-title').textContent = movie.title || '';
                document.getElementById('login-banner-overview').textContent = movie.overview || '';
                document.getElementById('login-banner-img').src = tmdbImg(movie.backdrop_path, 'w1280');
            });
            container.appendChild(el);
        });
    }

    /* ── AO VIVO ─────────────────────────────────────── */
    function renderCategories(categories, currentCatId) {
        const container = document.getElementById('category-list');
        if (!container) return;
        container.innerHTML = '';

        // Adicionar Favoritos + Todos
        const specials = [
            { category_id: '-1', category_name: '⭐ Favoritos' },
            { category_id: '0',  category_name: '📺 Todos os Canais' },
        ];
        [...specials, ...categories].forEach(cat => {
            const el = document.createElement('div');
            el.className = 'category-item focusable' + (cat.category_id === currentCatId ? ' active' : '');
            el.tabIndex  = 0;
            el.textContent = cat.category_name;
            el.dataset.catId = cat.category_id;
            el.addEventListener('click', () => {
                document.querySelectorAll('.category-item').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                document.getElementById('selected-category-label').textContent = cat.category_name;
                document.getElementById('category-list').style.display = 'none';
                App.loadChannelsByCategory(cat.category_id);
            });
            container.appendChild(el);
        });
    }

    function renderChannels(channels, currentStreamId) {
        const container = document.getElementById('channel-list');
        if (!container) return;
        container.innerHTML = '';

        if (channels.length === 0) {
            container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--c-text3)">Nenhum canal nesta categoria.</div>';
            return;
        }

        channels.forEach((ch, idx) => {
            const el = document.createElement('div');
            el.className = 'channel-item focusable' + (ch.stream_id == currentStreamId ? ' active' : '');
            el.tabIndex  = 0;
            el.setAttribute('role', 'button');

            const logo = document.createElement('img');
            logo.className = 'channel-logo';
            logo.src = ch.stream_icon || '';
            logo.alt = ch.name || '';
            logo.onerror = () => { logo.style.display = 'none'; };

            const info = document.createElement('div');
            info.className = 'channel-info';
            const name = document.createElement('div');
            name.className = 'channel-name';
            name.textContent = ch.name || 'Canal ' + (idx + 1);
            const epg = document.createElement('div');
            epg.className = 'channel-epg';
            epg.id = `epg-${ch.stream_id}`;
            info.appendChild(name);
            info.appendChild(epg);

            const fav = document.createElement('span');
            fav.className = 'channel-fav';
            fav.textContent = isFavorite(ch.stream_id, 'live') ? '★' : '☆';
            fav.title = 'Favoritar';
            fav.addEventListener('click', e => {
                e.stopPropagation();
                if (isFavorite(ch.stream_id, 'live')) {
                    removeFavorite(ch.stream_id, 'live');
                    fav.textContent = '☆';
                    showToast('Removido dos favoritos');
                } else {
                    addFavorite({ id: ch.stream_id, type: 'live', title: ch.name, thumb: ch.stream_icon });
                    fav.textContent = '★';
                    showToast('⭐ Adicionado aos favoritos');
                }
            });

            el.appendChild(logo);
            el.appendChild(info);
            el.appendChild(fav);

            el.addEventListener('click', () => {
                document.querySelectorAll('.channel-item').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                App.playChannel(ch);
            });

            container.appendChild(el);
        });
    }

    /* ── FILMES ──────────────────────────────────────── */
    function renderMoviesTab(movies, categories) {
        // Hero banner
        const featured = movies.slice(0, 20).filter(m => m.stream_icon);
        if (featured.length > 0) {
            const hero = featured[Math.floor(Math.random() * Math.min(5, featured.length))];
            const heroImg = document.getElementById('movies-hero-img');
            if (heroImg) heroImg.src = hero.stream_icon || '';
            const heroTitle = document.getElementById('movies-hero-title');
            if (heroTitle) heroTitle.textContent = hero.name || '';
            const heroOverview = document.getElementById('movies-hero-overview');
            if (heroOverview) heroOverview.textContent = hero.plot || '';

            document.getElementById('movies-hero-play').onclick = () => App.openMovieDetails(hero);
            document.getElementById('movies-hero-info').onclick = () => App.openMovieDetails(hero);
        }

        // Rows
        renderContentRow('movies-featured-row', movies.slice(0, 30), 'movie');

        const newMovies = movies.filter(m => {
            const n = (m.name || '').toLowerCase();
            return n.includes('2025') || n.includes('2026') || n.includes('lança');
        });
        renderContentRow('movies-new-row', newMovies.slice(0, 30), 'movie');

        const cinema = movies.filter(m => {
            const n = (m.name || '').toLowerCase();
            return n.includes('cinema') || n.includes('4k') || n.includes('dual');
        });
        renderContentRow('movies-cinema-row', cinema.slice(0, 30), 'movie');
    }

    /* ── SÉRIES ──────────────────────────────────────── */
    function renderSeriesTab(series, categories) {
        if (series.length === 0) return;
        const heroItem = series[Math.floor(Math.random() * Math.min(5, series.length))];
        const heroImg = document.getElementById('series-hero-img');
        if (heroImg && heroItem) heroImg.src = heroItem.cover || heroItem.stream_icon || '';
        const heroTitle = document.getElementById('series-hero-title');
        if (heroTitle && heroItem) heroTitle.textContent = heroItem.name || '';

        document.getElementById('series-hero-play').onclick = () => App.openSeriesDetails(heroItem);
        document.getElementById('series-hero-info').onclick = () => App.openSeriesDetails(heroItem);

        renderContentRow('series-trending-row', series.slice(0, 30), 'series');

        const novelas = series.filter(s => (s.name||'').toLowerCase().match(/novela|globo|record/));
        renderContentRow('series-novelas-row', novelas.slice(0, 30), 'series');

        const netflix = series.filter(s => (s.name||'').toLowerCase().match(/netflix|hbo|disney|amazon/));
        renderContentRow('series-netflix-row', netflix.slice(0, 30), 'series');
    }

    /* ── ESPORTES ────────────────────────────────────── */
    function renderSportsTab(liveStreams) {
        const sports = liveStreams.filter(s => {
            const n = (s.name || '').toLowerCase();
            return n.match(/sport|esport|futebol|tennis|basquete|vôlei|olimp|band|sbt|record|globo/);
        });
        renderContentRow('sports-channels-row', sports.slice(0, 40), 'live');
    }

    /* ── INFANTIL ─────────────────────────────────────── */
    function renderKidsTab(movies, series) {
        const kidsContent = [...movies, ...series].filter(item => {
            const n = ((item.name || item.category_name || '')).toLowerCase();
            return n.match(/kids|infantil|criança|child|cartoon|disney|nickelodeon|baby|peppa|patrol|bluey|dora/);
        });

        const cards = ['kids-main-card', 'kids-card-2', 'kids-card-3', 'kids-card-4', 'kids-card-5'];
        const imgs  = ['kids-main-img', 'kids-img-2', 'kids-img-3', 'kids-img-4', 'kids-img-5'];
        const titles= ['kids-main-title', 'kids-title-2', 'kids-title-3', 'kids-title-4', 'kids-title-5'];

        kidsContent.slice(0, 5).forEach((item, i) => {
            const imgEl = document.getElementById(imgs[i]);
            const ttlEl = document.getElementById(titles[i]);
            const card  = document.getElementById(cards[i]);
            if (imgEl) imgEl.src = item.stream_icon || item.cover || '';
            if (ttlEl) ttlEl.textContent = item.name || '';
            if (card) card.onclick = () => {
                if (item.series_id || item.num === undefined) App.openSeriesDetails(item);
                else App.openMovieDetails(item);
            };
        });

        renderContentRow('kids-row', kidsContent.slice(5, 35), 'movie');
    }

    /* ── Content Row (horizontal scroll) ─────────────── */
    function renderContentRow(containerId, items, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        items.forEach(item => {
            const card = createContentCard(item, type);
            container.appendChild(card);
        });
    }

    /* ── Content Card ─────────────────────────────────── */
    function createContentCard(item, type) {
        const card = document.createElement('div');
        card.className = 'content-card focusable';
        card.tabIndex  = 0;

        const img = document.createElement('img');
        img.className = 'content-card-img';
        img.src = item.stream_icon || item.cover || item.poster || '';
        img.alt = item.name || '';
        img.loading = 'lazy';
        img.onerror = () => { img.src = ''; img.style.background = 'var(--c-surface2)'; };

        const titleEl = document.createElement('div');
        titleEl.className = 'content-card-title';
        titleEl.textContent = item.name || '';

        const typeBadge = document.createElement('div');
        typeBadge.className = `content-card-type ${type}`;

        if (item.rating && parseFloat(item.rating) > 0) {
            const rating = document.createElement('div');
            rating.className = 'content-card-rating';
            rating.textContent = '★ ' + parseFloat(item.rating).toFixed(1);
            card.appendChild(rating);
        }

        const favBadge = document.createElement('div');
        favBadge.className = 'content-card-fav';
        const itemId = item.stream_id || item.series_id || item.num;
        favBadge.textContent = isFavorite(itemId, type) ? '★' : '';

        card.appendChild(img);
        card.appendChild(typeBadge);
        card.appendChild(titleEl);
        card.appendChild(favBadge);

        card.addEventListener('click', () => {
            if (type === 'live') {
                App.playChannel(item);
            } else if (type === 'movie') {
                App.openMovieDetails(item);
            } else if (type === 'series') {
                App.openSeriesDetails(item);
            }
        });

        return card;
    }

    /* ── Category Grid Screen ─────────────────────────── */
    function renderCategoryGrid(categories, type, onSelect) {
        const container = document.getElementById('category-grid');
        if (!container) return;
        container.innerHTML = '';

        categories.forEach(cat => {
            const el = document.createElement('div');
            el.className = 'category-grid-item focusable';
            el.tabIndex  = 0;

            const emoji = type === 'movie' ? '🎬' : type === 'series' ? '📽️' : '📺';
            el.innerHTML = `<span>${emoji}</span><span>${cat.category_name || cat.categoryName || ''}</span><span class="cat-count">${getCategoryCount(cat, type)}</span>`;

            el.addEventListener('click', () => onSelect(cat));
            container.appendChild(el);
        });

        // Search filter
        const searchEl = document.getElementById('cat-search');
        if (searchEl) {
            searchEl.oninput = () => {
                const q = searchEl.value.toLowerCase();
                container.querySelectorAll('.category-grid-item').forEach((el, i) => {
                    el.style.display = categories[i] && (categories[i].category_name || '').toLowerCase().includes(q) ? '' : 'none';
                });
            };
        }
    }

    function getCategoryCount(cat, type) {
        const id = cat.category_id || cat.categoryId;
        if (!App.data) return '';
        let count = 0;
        if (type === 'movie') count = App.data.allMovies.filter(m => m.category_id == id).length;
        else if (type === 'series') count = App.data.allSeries.filter(s => s.category_id == id).length;
        else count = App.data.liveStreams.filter(s => s.category_id == id).length;
        return count > 0 ? count + ' itens' : '';
    }

    /* ── Content Grid Screen ──────────────────────────── */
    let _gridItems    = [];
    let _gridPage     = 0;
    const GRID_PAGE_SIZE = 60;

    function renderContentGrid(items, type, title) {
        _gridItems = items;
        _gridPage  = 0;

        document.getElementById('grid-title').textContent = title || '';
        const container = document.getElementById('content-grid');
        container.innerHTML = '';

        const page = items.slice(0, GRID_PAGE_SIZE);
        page.forEach(item => container.appendChild(createContentCard(item, type)));

        const loadMoreBtn = document.getElementById('btn-load-more');
        if (loadMoreBtn) loadMoreBtn.style.display = items.length > GRID_PAGE_SIZE ? 'block' : 'none';

        if (loadMoreBtn) {
            loadMoreBtn.onclick = () => {
                _gridPage++;
                const next = _gridItems.slice(_gridPage * GRID_PAGE_SIZE, (_gridPage + 1) * GRID_PAGE_SIZE);
                next.forEach(item => container.appendChild(createContentCard(item, type)));
                if ((_gridPage + 1) * GRID_PAGE_SIZE >= _gridItems.length) loadMoreBtn.style.display = 'none';
            };
        }

        // Inline search
        const searchEl = document.getElementById('grid-search');
        if (searchEl) {
            searchEl.oninput = () => {
                const q = searchEl.value.toLowerCase();
                if (q.length < 2) {
                    renderContentGrid(items, type, title);
                    return;
                }
                const filtered = items.filter(i => (i.name || '').toLowerCase().includes(q));
                container.innerHTML = '';
                filtered.forEach(item => container.appendChild(createContentCard(item, type)));
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            };
        }
    }

    /* ── Movie Details ────────────────────────────────── */
    async function renderMovieDetails(item) {
        document.getElementById('details-title').textContent    = item.name || '';
        document.getElementById('details-poster').src           = item.stream_icon || '';
        document.getElementById('details-year').textContent     = item.year || item.releasedate || '';
        document.getElementById('details-rating').textContent   = item.rating ? '★ ' + parseFloat(item.rating).toFixed(1) : '';
        document.getElementById('details-genre').textContent    = item.genre || item.category_name || '';
        document.getElementById('details-duration').textContent = item.duration || item.runtime || '';
        document.getElementById('details-overview').textContent = item.plot || '';

        // Backdrop
        const bd = document.getElementById('details-backdrop');
        if (bd) bd.style.backgroundImage = `url(${item.stream_icon || ''})`;

        // Hide series section
        document.getElementById('details-series-section').style.display = 'none';

        // Favorite btn
        const favBtn = document.getElementById('details-favorite');
        const itemId = item.stream_id;
        favBtn.textContent = isFavorite(itemId, 'movie') ? '★ Favoritado' : '☆ Favoritar';
        favBtn.onclick = () => {
            if (isFavorite(itemId, 'movie')) {
                removeFavorite(itemId, 'movie');
                favBtn.textContent = '☆ Favoritar';
                showToast('Removido dos favoritos');
            } else {
                addFavorite({ id: itemId, type: 'movie', title: item.name, thumb: item.stream_icon });
                favBtn.textContent = '★ Favoritado';
                showToast('⭐ Adicionado aos favoritos');
            }
        };

        // Play button
        document.getElementById('details-play').onclick = () => {
            const s = App.session;
            const ext = item.container_extension || 'mp4';
            const url = getVodStreamUrl(s.dns, s.user, s.pass, item.stream_id, ext);
            addHistory({ id: item.stream_id, type: 'movie', title: item.name, thumb: item.stream_icon });
            Player.openFullscreen(url, item.name, false, item.stream_id);
        };

        // Try to load more info from Xtream
        if (App.session && item.stream_id) {
            const info = await apiGetVodInfo(App.session.dns, App.session.user, App.session.pass, item.stream_id);
            if (info && info.info) {
                const i = info.info;
                if (i.plot)  document.getElementById('details-overview').textContent = i.plot;
                if (i.rating) document.getElementById('details-rating').textContent = '★ ' + parseFloat(i.rating).toFixed(1);
                if (i.genre)  document.getElementById('details-genre').textContent  = i.genre;
                if (i.releasedate) document.getElementById('details-year').textContent = i.releasedate;
                if (i.duration)    document.getElementById('details-duration').textContent = i.duration;
                if (i.movie_image) {
                    document.getElementById('details-poster').src = i.movie_image;
                    document.getElementById('details-backdrop').style.backgroundImage = `url(${i.movie_image})`;
                }
            }
        }
    }

    /* ── Series Details ───────────────────────────────── */
    async function renderSeriesDetails(item) {
        document.getElementById('details-title').textContent    = item.name || '';
        document.getElementById('details-poster').src           = item.cover || item.stream_icon || '';
        document.getElementById('details-year').textContent     = item.year || '';
        document.getElementById('details-rating').textContent   = item.rating ? '★ ' + parseFloat(item.rating).toFixed(1) : '';
        document.getElementById('details-genre').textContent    = item.genre || '';
        document.getElementById('details-overview').textContent = item.plot || '';

        const bd = document.getElementById('details-backdrop');
        if (bd) bd.style.backgroundImage = `url(${item.cover || item.stream_icon || ''})`;

        // Hide VOD play button for series (use episode list)
        document.getElementById('details-play').style.display   = 'none';
        document.getElementById('details-series-section').style.display = 'block';

        // Fav
        const favBtn = document.getElementById('details-favorite');
        const itemId = item.series_id;
        favBtn.textContent = isFavorite(itemId, 'series') ? '★ Favoritado' : '☆ Favoritar';
        favBtn.onclick = () => {
            if (isFavorite(itemId, 'series')) {
                removeFavorite(itemId, 'series');
                favBtn.textContent = '☆ Favoritar';
            } else {
                addFavorite({ id: itemId, type: 'series', title: item.name, thumb: item.cover });
                favBtn.textContent = '★ Favoritado';
                showToast('⭐ Adicionado aos favoritos');
            }
        };

        // Load series info
        if (App.session && item.series_id) {
            showToast('Carregando episódios...', 1500);
            const info = await apiGetSeriesInfo(App.session.dns, App.session.user, App.session.pass, item.series_id);
            if (info) {
                if (info.info) {
                    const i = info.info;
                    if (i.plot)   document.getElementById('details-overview').textContent = i.plot;
                    if (i.genre)  document.getElementById('details-genre').textContent    = i.genre;
                    if (i.rating) document.getElementById('details-rating').textContent   = '★ ' + parseFloat(i.rating).toFixed(1);
                    if (i.cover)  { document.getElementById('details-poster').src = i.cover; }
                }
                if (info.episodes) {
                    renderSeasonEpisodes(info.episodes, item);
                }
            }
        }
    }

    function renderSeasonEpisodes(episodes, seriesItem) {
        const select   = document.getElementById('details-season-select');
        const epList   = document.getElementById('details-episode-list');
        if (!select || !epList) return;

        // seasons is an object {season_num: [episodes]}
        const seasons = {};
        Object.keys(episodes).forEach(seasonNum => {
            seasons[seasonNum] = episodes[seasonNum];
        });

        select.innerHTML = '';
        Object.keys(seasons).sort((a,b) => parseInt(a)-parseInt(b)).forEach(sNum => {
            const opt = document.createElement('option');
            opt.value = sNum;
            opt.textContent = `Temporada ${sNum}`;
            select.appendChild(opt);
        });

        function loadSeason(sNum) {
            epList.innerHTML = '';
            const eps = seasons[sNum] || [];
            eps.forEach(ep => {
                const el = document.createElement('div');
                el.className = 'episode-item focusable';
                el.tabIndex  = 0;
                el.innerHTML = `<span class="ep-num">${ep.episode_num || ep.episodeNum || ''}</span><span class="ep-title">${ep.title || ep.name || 'Episódio ' + (ep.episode_num || '')}</span><span class="ep-duration">${ep.info?.duration || ''}</span>`;
                el.addEventListener('click', () => {
                    const s = App.session;
                    const ext = ep.container_extension || 'mp4';
                    const url = getSeriesStreamUrl(s.dns, s.user, s.pass, ep.id, ext);
                    addHistory({ id: ep.id, type: 'series', title: `${seriesItem.name} S${sNum}E${ep.episode_num}`, thumb: seriesItem.cover });
                    Player.openFullscreen(url, `${seriesItem.name} - S${sNum}E${ep.episode_num} ${ep.title||''}`, false, ep.id);
                });
                epList.appendChild(el);
            });
        }

        select.addEventListener('change', () => loadSeason(select.value));
        if (Object.keys(seasons).length > 0) loadSeason(Object.keys(seasons)[0]);
    }

    /* ── Search Screen ────────────────────────────────── */
    function renderSearch(query, filter) {
        const container = document.getElementById('search-grid');
        if (!container) return;
        container.innerHTML = '';

        if (!query || query.length < 2) {
            container.innerHTML = '<div class="search-placeholder"><p>💡 Digite para buscar</p></div>';
            return;
        }

        const q = query.toLowerCase();
        const results = [];

        if (filter === 'all' || filter === 'live') {
            App.data.liveStreams.filter(s => (s.name||'').toLowerCase().includes(q))
                .slice(0, 30).forEach(s => results.push({ item: s, type: 'live' }));
        }
        if (filter === 'all' || filter === 'movies') {
            App.data.allMovies.filter(m => (m.name||'').toLowerCase().includes(q))
                .slice(0, 30).forEach(m => results.push({ item: m, type: 'movie' }));
        }
        if (filter === 'all' || filter === 'series') {
            App.data.allSeries.filter(s => (s.name||'').toLowerCase().includes(q))
                .slice(0, 30).forEach(s => results.push({ item: s, type: 'series' }));
        }

        if (results.length === 0) {
            container.innerHTML = `<div class="search-placeholder"><p>Nenhum resultado para "${query}"</p></div>`;
            return;
        }

        results.forEach(({ item, type }) => container.appendChild(createContentCard(item, type)));
    }

    /* ── History Screen ───────────────────────────────── */
    function renderHistory() {
        const container = document.getElementById('history-grid');
        if (!container) return;
        const hist = getHistory();
        container.innerHTML = '';

        if (hist.length === 0) {
            container.innerHTML = '<div class="search-placeholder"><p>🕐 Nenhum histórico ainda.</p></div>';
            return;
        }

        hist.forEach(h => {
            const card = document.createElement('div');
            card.className = 'content-card focusable';
            card.tabIndex  = 0;
            const img = document.createElement('img');
            img.className = 'content-card-img';
            img.src = h.thumb || '';
            img.alt = h.title || '';
            const title = document.createElement('div');
            title.className = 'content-card-title';
            title.textContent = h.title || '';
            card.appendChild(img);
            card.appendChild(title);
            container.appendChild(card);
        });
    }

    /* ── Modals ───────────────────────────────────────── */
    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('open');
            setTimeout(() => {
                const first = modal.querySelector('.focusable');
                if (first) first.focus();
            }, 100);
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    }

    function showSupportModal(whatsapp) {
        if (!whatsapp) { showToast('Suporte indisponível.'); return; }
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://wa.me/${whatsapp}`;
        document.getElementById('support-qr').src = qrUrl;
        openModal('modal-support');
    }

    function showNewsModal(bannerUrl) {
        if (!bannerUrl) { showToast('Sem novidades no momento.'); return; }
        document.getElementById('news-banner').src = bannerUrl;
        openModal('modal-news');
    }

    function showEventsModal(url) {
        if (!url) { showToast('Eventos indisponíveis.'); return; }
        document.getElementById('events-iframe').src = url;
        openModal('modal-events');
    }

    function showMessageModal(msg) {
        if (!msg) { showToast('Nenhuma mensagem.'); return; }
        document.getElementById('modal-message-body').textContent = msg;
        openModal('modal-message');
    }

    function showProfileModal(user, mac, dns) {
        document.getElementById('profile-user').textContent = user || '-';
        document.getElementById('profile-mac').textContent  = mac  || '-';
        document.getElementById('profile-dns').textContent  = dns  || '-';
        openModal('modal-profile');
    }

    function showParentalModal(onSuccess) {
        openModal('modal-parental');
        const pin = document.getElementById('parental-pin');
        if (pin) { pin.value = ''; pin.focus(); }
        const confirmBtn = document.getElementById('parental-confirm');
        const handler = () => {
            if (pin && pin.value === getParentalPin()) {
                closeModal('modal-parental');
                confirmBtn.removeEventListener('click', handler);
                onSuccess();
            } else {
                showToast('❌ PIN incorreto!');
                if (pin) pin.value = '';
            }
        };
        confirmBtn.addEventListener('click', handler);
    }

    /* ── Notification badge ───────────────────────────── */
    function updateNotifBadge(show) {
        const badge = document.getElementById('notif-badge');
        if (badge) badge.style.display = show ? 'block' : 'none';
    }

    return {
        showToast, startClock, applyBranding, initLoginBanner,
        renderCategories, renderChannels,
        renderMoviesTab, renderSeriesTab, renderSportsTab, renderKidsTab,
        renderContentRow, createContentCard,
        renderCategoryGrid, renderContentGrid,
        renderMovieDetails, renderSeriesDetails,
        renderSearch, renderHistory,
        openModal, closeModal,
        showSupportModal, showNewsModal, showEventsModal, showMessageModal, showProfileModal, showParentalModal,
        updateNotifBadge
    };
})();

// Global shortcut
function showToast(msg, dur) { UI.showToast(msg, dur); }
