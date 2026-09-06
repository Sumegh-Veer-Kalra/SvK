

class PortalController {
    constructor() {
        this.games = [];
        this.activeFilter = "all";
        this.modal = document.getElementById("gameModal");
        this.wrapper = document.getElementById("game-iframe-wrapper");
        this.modalTitle = document.getElementById("modal-game-title");
        this.fullscreenBtn = document.getElementById("fullscreenBtn");
        this.currentIframe = null;
        this.searchQuery = "";
        this.activeGameId = null;
        this.toastTimeout = null;

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        window.matchMedia("(pointer: coarse)").matches ||
                        ('ontouchstart' in window) ||
                        (navigator.maxTouchPoints > 0);

        if (this.isMobile) {
            document.body.classList.add("mobile-device");
        } else {
            document.body.classList.add("desktop-device");
        }

        this.init();
    }

    getAbsPath(path) {
        if (!path) return "";
        return path.startsWith("/") ? path : "/" + path;
    }

    async init() {
        try {
            console.log("[Portal] Fetching games database...");
            const response = await fetch('games.json');
            this.games = await response.json();

            this.renderFeatured();

            this.renderGrid();

            this.renderRecentlyPlayed();

            this.setupCategoryFilters();

            this.setupFullscreen();

            this.setupSearch();

            document.addEventListener("fullscreenchange", () => this.handleFullscreenChange());
            document.addEventListener("webkitfullscreenchange", () => this.handleFullscreenChange());

            this.checkRoute();
        } catch (e) {
            console.error("[Portal] Failed to load games database:", e);
        }
    }

    checkRoute() {
        const urlParams = new URLSearchParams(window.location.search);
        const targetGame = urlParams.get('game');
        
        if (targetGame) {
            const gameExists = this.games.some(g => g.id === targetGame);
            if (gameExists) {
                this.playGame(targetGame);
            }
        } else {
            const path = window.location.pathname;
            const match = path.match(/^\/games\/([^\/]+)\/?$/);
            if (match) {
                const gameId = match[1];
                const gameExists = this.games.some(g => g.id === gameId);
                if (gameExists) {
                    this.playGame(gameId);
                }
            }
        }
    }

    renderFeatured() {
        const featuredGame = this.games.find(g => g.featured) || this.games[0];
        if (!featuredGame) return;

        console.log(`[Portal] Setting featured game: ${featuredGame.title}`);

        const tag = document.getElementById("featured-tag");
        const categoryTag = document.getElementById("featured-category");
        const title = document.getElementById("featured-title");
        const desc = document.getElementById("featured-desc");
        const playBtn = document.getElementById("featured-play-btn");
        const mediaImg = document.getElementById("featured-media-img");
        const card = document.getElementById("featured-game-card");

        if (tag) tag.innerText = "NEW!";
        if (categoryTag) categoryTag.innerText = featuredGame.category.toUpperCase();
        if (title) title.innerText = featuredGame.title;
        if (desc) desc.innerText = featuredGame.description;
        
        if (playBtn) {
            playBtn.onclick = () => this.playGame(featuredGame.id);
        }
        if (mediaImg) {
            const imgUrl = `url('${this.getAbsPath(featuredGame.cover_landscape)}')`;
            mediaImg.style.backgroundImage = imgUrl;
            const featuredMedia = mediaImg.parentElement;
            if (featuredMedia) {
                featuredMedia.style.setProperty("--featured-bg", imgUrl);
            }
        }
        if (card) {
            card.style.display = "flex"; 
        }
    }

    renderGrid() {
        const grid = document.getElementById("games-grid-container");
        if (!grid) return;

        grid.innerHTML = "";

        const sectionTitle = document.getElementById("games-section-title");
        if (sectionTitle) {
            if (this.searchQuery.length > 0) {
                sectionTitle.innerText = "Search Results";
            } else if (this.activeFilter !== "all") {
                
                sectionTitle.innerText = this.activeFilter.charAt(0).toUpperCase() + this.activeFilter.slice(1) + " Games";
            } else {
                sectionTitle.innerText = "Popular Games";
            }
        }

        const featuredCard = document.getElementById("featured-game-card");
        if (featuredCard) {
            if (this.searchQuery.length > 0) {
                featuredCard.style.display = "none";
            } else {
                
                if (this.games.length > 0) {
                    featuredCard.style.display = "flex";
                }
            }
        }

        const recentlyPlayedSection = document.getElementById("recently-played-section");
        if (recentlyPlayedSection) {
            if (this.searchQuery.length > 0) {
                recentlyPlayedSection.style.display = "none";
            } else {
                this.renderRecentlyPlayed();
            }
        }

        const filteredGames = this.games.filter(game => {
            
            if (this.activeFilter !== "all" && game.category !== this.activeFilter) {
                return false;
            }

            if (this.searchQuery.length > 0) {
                const q = this.searchQuery;
                const matchTitle = game.title.toLowerCase().includes(q);
                const matchCategory = game.category.toLowerCase().includes(q);
                const matchDesc = game.description.toLowerCase().includes(q);
                const matchTags = Array.isArray(game.tags) && game.tags.some(t => t.toLowerCase().includes(q));
                
                return matchTitle || matchCategory || matchDesc || matchTags;
            }
            
            return true;
        });

        if (filteredGames.length === 0) {
            if (this.searchQuery.length > 0) {
                
                const header = document.createElement("div");
                header.style.cssText = "grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px 0 30px 0;";
                header.innerHTML = `
                    <h3 style="font-size: 18px; margin: 0 0 10px 0; color: var(--text-primary); font-family: var(--font-primary);">Your search didn't matched anything🤔</h3>
                    <p style="font-size: 14px; margin: 0; color: var(--color-neon-pink); font-family: var(--font-heading); letter-spacing: 1.5px; text-transform: uppercase;">Try these:</p>
                `;
                grid.appendChild(header);

                const featuredList = this.games.filter(g => g.featured);
                const recommendGames = featuredList.length > 0 ? featuredList : this.games.slice(0, 3);

                recommendGames.forEach(game => {
                    const card = document.createElement("div");
                    card.className = "game-card";
                    card.setAttribute("data-id", game.id);
                    card.onclick = () => this.playGame(game.id);

                    const displayCategory = game.category.toUpperCase();

                    card.innerHTML = `
                        <div class="game-thumb-wrapper">
                            <img src="${this.getAbsPath(game.thumbnail)}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
                        </div>
                        <div class="game-info">
                            <h3 class="game-title">${game.title}</h3>
                            <div class="game-meta" style="display: flex; justify-content: flex-start; align-items: center; font-size: 11px; color: var(--text-secondary);">
                                <span style="color: var(--color-neon-pink); font-weight: 800; letter-spacing: 0.5px;">${displayCategory}</span>
                                <span style="opacity: 0.4; margin: 0 6px;">•</span>
                                <span>${game.orientation.toUpperCase()}</span>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            } else {
                
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px 0;">No games found in this category yet.</div>`;
            }
            return;
        }

        filteredGames.forEach(game => {
            const card = document.createElement("div");
            card.className = "game-card";
            card.setAttribute("data-id", game.id);
            card.onclick = () => this.playGame(game.id);

            const displayCategory = game.category.toUpperCase();

            card.innerHTML = `
                <div class="game-thumb-wrapper">
                    <img src="${this.getAbsPath(game.thumbnail)}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <div class="game-meta" style="display: flex; justify-content: flex-start; align-items: center; font-size: 11px; color: var(--text-secondary);">
                        <span style="color: var(--color-neon-pink); font-weight: 800; letter-spacing: 0.5px;">${displayCategory}</span>
                        <span style="opacity: 0.4; margin: 0 6px;">•</span>
                        <span>${game.orientation.toUpperCase()}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    setupCategoryFilters() {
        const filters = document.querySelectorAll(".nav-links a");
        filters.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();

                filters.forEach(f => f.classList.remove("active"));
                link.classList.add("active");

                this.activeFilter = link.getAttribute("data-filter");
                this.renderGrid();
            });
        });
    }

    playGame(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

        this.activeGameId = gameId;

        const ratio = game.aspectRatio ? game.aspectRatio.replace('/', ' / ') : (game.orientation === 'portrait' ? '9 / 16' : '16 / 9');
        this.wrapper.style.setProperty('--game-aspect-ratio', ratio);

        if (!window.location.search.includes("game=")) {
            window.history.replaceState(null, "", `/games/${gameId}/`);
        }

        console.log(`[Portal] Launching game: ${game.title} (${game.orientation})`);

        document.body.style.overflow = "hidden";

        this.wrapper.className = "iframe-wrapper";
        
        this.wrapper.classList.add(game.orientation);

        const modalContent = this.modal.querySelector(".modal-content");
        if (modalContent) {
            modalContent.className = "modal-content"; 
            modalContent.classList.add(game.orientation);
            modalContent.style.setProperty('--game-aspect-ratio', ratio);
        }

        this.modalTitle.innerText = game.title.toUpperCase();

        const isMobile = this.isMobile;
        if (isMobile) {
            console.log(`[Portal] Mobile viewport detected. Injecting play cover for: ${game.title}`);
            this.wrapper.classList.add("showing-cover");
            
            this.wrapper.innerHTML = `
                <div class="mobile-play-cover" style="background-image: url('${this.getAbsPath(game.cover_square)}');" onclick="portal.startMobileGame('${game.id}')">
                    <div class="mobile-play-btn">
                        <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                    <span class="mobile-play-text">PLAY NOW</span>
                </div>
            `;
            this.currentIframe = null;
        } else {
            const cacheBuster = Date.now();
            const absolutePath = game.path.startsWith("/") ? game.path : "/" + game.path;
            this.wrapper.innerHTML = `
                <div id="game-loader-overlay" class="game-loader-overlay">
                    <div class="loader-pulse-logo">S<span class="logo-v">v</span>K</div>
                    <div class="loader-game-title">${game.title.toUpperCase()}</div>
                    <div class="loader-bar-track">
                        <div class="loader-bar-fill" id="loader-progress-bar"></div>
                    </div>
                    <div class="loader-stats">
                        <span id="loader-percent">0%</span>
                        <span id="loader-bytes">Connecting...</span>
                    </div>
                </div>
                <iframe src="${absolutePath}?v=${cacheBuster}" 
                        id="active-game-iframe"
                        allow="autoplay; keyboard; fullscreen; clipboard-write"
                        scrolling="no">
                </iframe>
            `;
            this.currentIframe = document.getElementById("active-game-iframe");

            this.addToRecentlyPlayed(gameId);
            this.loadGameWithAssets(game);
        }

        const pcSidebar = document.getElementById("game-pc-sidebar");
        
        const oldInline = document.getElementById("game-pc-sidebar-inline");
        if (oldInline) oldInline.remove();

        const isLandscapeDesktop = !this.isMobile && game.orientation === "landscape";

        if (isLandscapeDesktop) {
            
            if (pcSidebar) {
                pcSidebar.innerHTML = "";
                pcSidebar.classList.add("landscape-mode");
            }

            const inlinePanel = document.createElement("div");
            inlinePanel.id = "game-pc-sidebar-inline";
            inlinePanel.innerHTML = `
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Description</span>
                    <p class="sidebar-section-text">${game.description}</p>
                </div>
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Controls</span>
                    <p class="sidebar-section-text">${game.controls}</p>
                </div>
            `;
            if (modalContent) modalContent.appendChild(inlinePanel);
        } else {
            
            if (pcSidebar) {
                pcSidebar.classList.remove("landscape-mode");
                pcSidebar.innerHTML = `
                    <h3 class="sidebar-title">${game.title}</h3>
                    <div class="sidebar-section">
                        <span class="sidebar-section-title">Description</span>
                        <p class="sidebar-section-text">${game.description}</p>
                    </div>
                    <div class="sidebar-section">
                        <span class="sidebar-section-title">Controls</span>
                        <p class="sidebar-section-text">${game.controls}</p>
                    </div>
                `;
            }
        }

        const mobilePanel = document.getElementById("game-mobile-panel");
        if (mobilePanel) {
            
            let similarGames = this.games.filter(g => g.id !== game.id);
            
            similarGames.sort((a, b) => {
                if (a.category === game.category && b.category !== game.category) return -1;
                if (a.category !== game.category && b.category === game.category) return 1;
                return 0;
            });
            
            similarGames = similarGames.slice(0, 10);

            let similarHtml = "";
            if (similarGames.length > 0) {
                similarHtml = `
                    <div class="sidebar-section">
                        <span class="sidebar-section-title">Similar Games</span>
                        <div class="mobile-similar-grid">
                            ${similarGames.map(sim => `
                                <div class="similar-game-card" onclick="portal.playGame('${sim.id}')">
                                    <img src="${this.getAbsPath(sim.thumbnail)}" alt="${sim.title}" class="similar-thumb">
                                    <span class="similar-title">${sim.title}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `;
            }

            mobilePanel.innerHTML = `
                <div class="mobile-header-row">
                    <img src="${this.getAbsPath(game.thumbnail)}" alt="${game.title}" class="mobile-thumb-img">
                    <div class="mobile-game-info">
                        <h3 class="sidebar-title" style="border:none; padding:0; margin:0; font-size:16px;">${game.title}</h3>
                        <span style="color:var(--color-neon-pink); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">${game.category}</span>
                    </div>
                    <button class="mobile-share-btn" onclick="portal.shareActiveGame()" title="Share Game">🔗 SHARE</button>
                </div>
                
                ${similarHtml}
                
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Controls</span>
                    <p class="sidebar-section-text">${game.controls}</p>
                </div>
                
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Description</span>
                    <p class="sidebar-section-text">${game.description}</p>
                </div>
            `;
        }

        this.modal.classList.add("active");

        setTimeout(() => {
            if (this.currentIframe) {
                this.currentIframe.focus();
                try {
                    this.currentIframe.contentWindow.focus();
                } catch (e) {
                    
                }
            }
        }, 150);

        this.wrapper.onclick = () => {
            if (this.currentIframe) {
                this.currentIframe.focus();
            }
        };
    }

    playFeatured(gameId) {
        this.playGame(gameId);
    }

    startMobileGame(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

        console.log(`[Portal] Starting mobile game in fullscreen: ${game.title}`);

        const ratio = game.aspectRatio ? game.aspectRatio.replace('/', ' / ') : (game.orientation === 'portrait' ? '9 / 16' : '16 / 9');
        this.wrapper.style.setProperty('--game-aspect-ratio', ratio);
        this.modal.classList.add("mobile-playing");
        this.wrapper.classList.add("mobile-playing");

        this.wrapper.classList.remove("showing-cover");

        const cacheBuster = Date.now();
        const absolutePath = game.path.startsWith("/") ? game.path : "/" + game.path;
        this.wrapper.innerHTML = `
            <div id="game-loader-overlay" class="game-loader-overlay">
                <div class="loader-pulse-logo">S<span class="logo-v">v</span>K</div>
                <div class="loader-game-title">${game.title.toUpperCase()}</div>
                <div class="loader-bar-track">
                    <div class="loader-bar-fill" id="loader-progress-bar"></div>
                </div>
                <div class="loader-stats">
                    <span id="loader-percent">0%</span>
                    <span id="loader-bytes">Connecting...</span>
                </div>
            </div>
            <button id="mobile-back-btn" class="mobile-back-btn" onclick="portal.exitMobileFullscreen()" style="display: none;">
                ✕ Back
            </button>
            <iframe src="${absolutePath}?v=${cacheBuster}" 
                    id="active-game-iframe"
                    allow="autoplay; keyboard; fullscreen; clipboard-write"
                    scrolling="no">
            </iframe>
        `;
        this.currentIframe = document.getElementById("active-game-iframe");

        this.addToRecentlyPlayed(gameId);
        this.loadGameWithAssets(game);

        if (this.wrapper.requestFullscreen) {
            this.wrapper.requestFullscreen().catch(err => console.error(err));
        } else if (this.wrapper.webkitRequestFullscreen) { 
            this.wrapper.webkitRequestFullscreen();
        } else if (this.wrapper.msRequestFullscreen) { 
            this.wrapper.msRequestFullscreen();
        }

        setTimeout(() => {
            if (this.currentIframe) {
                this.currentIframe.focus();
                try {
                    this.currentIframe.contentWindow.focus();
                } catch (e) {}
            }
        }, 150);
    }

    async loadGameWithAssets(game) {
        const loaderOverlay = document.getElementById("game-loader-overlay");
        const loaderBar = document.getElementById("loader-progress-bar");
        const loaderPercent = document.getElementById("loader-percent");
        const loaderBytes = document.getElementById("loader-bytes");
        const loaderTitle = document.getElementById("loader-game-title");

        if (loaderTitle) loaderTitle.innerText = game.title.toUpperCase();
        if (loaderBar) loaderBar.style.width = "0%";
        if (loaderPercent) loaderPercent.innerText = "0%";
        if (loaderBytes) loaderBytes.innerText = "Scanning assets...";
        if (loaderOverlay) {
            loaderOverlay.classList.remove("fade-out");
            loaderOverlay.style.display = "flex";
        }

        const gameDir = game.path.substring(0, game.path.lastIndexOf("/") + 1);
        const gameHtmlUrl = this.getAbsPath(game.path);

        const assetUrls = new Set([gameHtmlUrl]);
        if (game.thumbnail) assetUrls.add(this.getAbsPath(game.thumbnail));
        if (game.cover_square) assetUrls.add(this.getAbsPath(game.cover_square));
        if (game.cover_landscape) assetUrls.add(this.getAbsPath(game.cover_landscape));

        try {
            const response = await fetch(gameHtmlUrl);
            const htmlText = await response.text();

            const assetRegex = /(?:src|href|url)\s*[:=\(]\s*['"]?([^'"\)\s>]+\.(?:png|jpe?g|gif|svg|webp|mp3|wav|ogg|ttf|woff2?|css|js))['"\)]?/gi;
            let match;
            while ((match = assetRegex.exec(htmlText)) !== null) {
                let assetPath = match[1].trim();
                if (!assetPath.startsWith("http://") && !assetPath.startsWith("https://") && !assetPath.startsWith("//")) {
                    if (assetPath.startsWith("/")) {
                        assetUrls.add(assetPath);
                    } else {
                        assetUrls.add(this.getAbsPath(gameDir + assetPath));
                    }
                }
            }

            const subFilesToScan = Array.from(assetUrls).filter(u => u.endsWith(".css") || u.endsWith(".js"));
            await Promise.all(subFilesToScan.map(async (subUrl) => {
                try {
                    const subRes = await fetch(subUrl);
                    const subText = await subRes.text();
                    let subMatch;
                    const subRegex = /['"]([^'"]+\.(?:png|jpe?g|gif|svg|webp|mp3|wav|ogg|ttf|woff2?))['"]/gi;
                    while ((subMatch = subRegex.exec(subText)) !== null) {
                        let p = subMatch[1].trim();
                        if (!p.startsWith("http://") && !p.startsWith("https://") && !p.startsWith("//")) {
                            if (p.startsWith("/")) {
                                assetUrls.add(p);
                            } else {
                                assetUrls.add(this.getAbsPath(gameDir + p));
                            }
                        }
                    }
                } catch (e) {}
            }));

            const uniqueUrls = Array.from(assetUrls);
            let totalBytes = 0;
            let loadedBytes = 0;
            const assetSizes = new Map();

            await Promise.all(uniqueUrls.map(async (url) => {
                try {
                    const head = await fetch(url, { method: "HEAD" });
                    const len = head.headers.get("Content-Length");
                    const size = len ? parseInt(len, 10) : 40000;
                    assetSizes.set(url, size);
                    totalBytes += size;
                } catch (e) {
                    assetSizes.set(url, 40000);
                    totalBytes += 40000;
                }
            }));

            const formatMB = (bytes) => {
                if (bytes < 1024 * 1024) {
                    return `${(bytes / 1024).toFixed(1)} KB`;
                }
                return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            };

            const updateUI = () => {
                const pct = totalBytes > 0 ? Math.min(100, Math.floor((loadedBytes / totalBytes) * 100)) : 100;
                if (loaderBar) loaderBar.style.width = `${pct}%`;
                if (loaderPercent) loaderPercent.innerText = `${pct}%`;
                if (loaderBytes) loaderBytes.innerText = `${formatMB(loadedBytes)} / ${formatMB(totalBytes)}`;
            };

            await Promise.all(uniqueUrls.map(async (url) => {
                try {
                    const res = await fetch(url);
                    if (!res.body) {
                        loadedBytes += assetSizes.get(url) || 0;
                        updateUI();
                        return;
                    }
                    const reader = res.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        loadedBytes += value.length;
                        updateUI();
                    }
                } catch (e) {
                    loadedBytes += assetSizes.get(url) || 0;
                    updateUI();
                }
            }));

            loadedBytes = totalBytes;
            if (loaderBar) loaderBar.style.width = "100%";
            if (loaderPercent) loaderPercent.innerText = "100%";
            if (loaderBytes) loaderBytes.innerText = `${formatMB(totalBytes)} / ${formatMB(totalBytes)}`;

        } catch (err) {
            console.warn("[Portal Preloader] Fallback:", err);
            if (loaderBar) loaderBar.style.width = "100%";
            if (loaderPercent) loaderPercent.innerText = "100%";
        }

        setTimeout(() => {
            if (loaderOverlay) {
                loaderOverlay.classList.add("fade-out");
                setTimeout(() => {
                    loaderOverlay.style.display = "none";
                }, 350);
            }
        }, 250);
    }

    closeGame() {
        console.log("[Portal] Closing active game player.");

        document.body.style.overflow = "";

        this.wrapper.innerHTML = "";
        this.currentIframe = null;
        this.activeGameId = null;

        this.modal.classList.remove("active");
        this.modal.classList.remove("mobile-playing");
        this.wrapper.classList.remove("mobile-playing");

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }

        window.history.replaceState(null, "", "/");
    }

    shareActiveGame() {
        const game = this.games.find(g => g.id === this.activeGameId);
        const gameTitle = game ? game.title : "SvK Games";
        const gameUrl = this.activeGameId 
            ? `https://svk-games.netlify.app/games/${this.activeGameId}/`
            : window.location.origin;

        if (navigator.share) {
            navigator.share({
                title: `${gameTitle} - SvK`,
                text: `Play ${gameTitle} instantly on SvK!`,
                url: gameUrl
            }).catch(() => {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(gameUrl).then(() => {
                this.showToast("Link copied to clipboard! 📋");
            }).catch(() => {
                this.copyFallback(gameUrl);
            });
        } else {
            this.copyFallback(gameUrl);
        }
    }

    copyFallback(text) {
        try {
            const input = document.createElement("input");
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            this.showToast("Link copied to clipboard! 📋");
        } catch (e) {
            this.showToast("Could not copy link");
        }
    }

    showToast(msg) {
        const toast = document.getElementById("toast-notification");
        if (!toast) return;
        toast.innerText = msg;
        toast.classList.add("show");
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 2200);
    }

    setupFullscreen() {
        this.fullscreenBtn.addEventListener("click", () => {
            const iframe = document.getElementById("active-game-iframe");
            if (!iframe) return;

            if (!document.fullscreenElement) {
                
                if (iframe.requestFullscreen) {
                    iframe.requestFullscreen();
                } else if (iframe.webkitRequestFullscreen) { 
                    iframe.webkitRequestFullscreen();
                } else if (iframe.msRequestFullscreen) { 
                    iframe.msRequestFullscreen();
                }
            } else {
                document.exitFullscreen().catch(err => console.log(err));
            }
        });
    }

    exitMobileFullscreen() {
        console.log("[Portal] Exit fullscreen button tapped.");
        this.modal.classList.remove("mobile-playing");
        this.wrapper.classList.remove("mobile-playing");
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.log(err));
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    handleFullscreenChange() {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

        const backBtn = document.getElementById("mobile-back-btn");
        if (backBtn) {
            backBtn.style.display = isFullscreen ? "flex" : "none";
        }

        if (!isFullscreen && this.isMobile) {
            console.log("[Portal] Exited fullscreen on mobile. Stopping game and restoring play cover.");
            this.modal.classList.remove("mobile-playing");
            this.wrapper.classList.remove("mobile-playing");

            const activeIframe = document.getElementById("active-game-iframe");
            if (activeIframe) {
                
                const game = this.games.find(g => activeIframe.src.includes(g.path));
                if (game) {
                    
                    this.wrapper.classList.add("showing-cover");
                    this.wrapper.innerHTML = `
                        <button id="mobile-back-btn" class="mobile-back-btn" onclick="portal.exitMobileFullscreen()" style="display: none;">
                            ✕ Back
                        </button>
                        <div class="mobile-play-cover" style="background-image: url('${game.cover_square}');" onclick="portal.startMobileGame('${game.id}')">
                            <div class="mobile-play-btn">
                                <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            </div>
                            <span class="mobile-play-text">PLAY NOW</span>
                        </div>
                    `;
                    this.currentIframe = null;
                }
            }
        }
    }

    setupSearch() {
        const searchInput = document.getElementById("search-input");
        const clearBtn = document.getElementById("search-clear-btn");
        if (!searchInput) return;

        searchInput.addEventListener("input", (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();

            if (clearBtn) {
                clearBtn.style.display = this.searchQuery.length > 0 ? "block" : "none";
            }

            this.renderGrid();
        });

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                searchInput.value = "";
                this.searchQuery = "";
                clearBtn.style.display = "none";
                this.renderGrid();
                searchInput.focus();
            });
        }
    }

    forceMobileMode() {
        console.log("[Portal Developer Tools] Forcing mobile mode...");
        this.isMobile = true;
        document.body.classList.remove("desktop-device");
        document.body.classList.add("mobile-device");
        this.renderGrid();
        this.renderFeatured();
        this.renderRecentlyPlayed();
    }

    addToRecentlyPlayed(gameId) {
        let list = [];
        try {
            const stored = localStorage.getItem("recently_played");
            if (stored) {
                list = JSON.parse(stored);
            }
        } catch (e) {
            console.error("[Portal] Failed to parse recently played list:", e);
        }

        list = list.filter(id => id !== gameId);

        list.unshift(gameId);

        list = list.slice(0, 5);

        try {
            localStorage.setItem("recently_played", JSON.stringify(list));
        } catch (e) {
            console.error("[Portal] Failed to save recently played list:", e);
        }

        this.renderRecentlyPlayed();
    }

    renderRecentlyPlayed() {
        const section = document.getElementById("recently-played-section");
        const grid = document.getElementById("recently-played-grid-container");
        if (!section || !grid) return;

        let list = [];
        try {
            const stored = localStorage.getItem("recently_played");
            if (stored) {
                list = JSON.parse(stored);
            }
        } catch (e) {
            console.error(e);
        }

        if (list.length === 0) {
            section.style.display = "none";
            return;
        }

        const playedGames = list
            .map(id => this.games.find(g => g.id === id))
            .filter(Boolean);

        if (playedGames.length === 0) {
            section.style.display = "none";
            return;
        }

        section.style.display = "block";
        grid.innerHTML = "";

        playedGames.forEach(game => {
            const card = document.createElement("div");
            card.className = "game-card";
            card.setAttribute("data-id", game.id);
            card.onclick = () => this.playGame(game.id);

            const displayCategory = game.category.toUpperCase();

            card.innerHTML = `
                <div class="game-thumb-wrapper">
                    <img src="${this.getAbsPath(game.thumbnail)}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <div class="game-meta" style="display: flex; justify-content: flex-start; align-items: center; font-size: 11px; color: var(--text-secondary);">
                        <span style="color: var(--color-neon-pink); font-weight: 800; letter-spacing: 0.5px;">${displayCategory}</span>
                        <span style="opacity: 0.4; margin: 0 6px;">•</span>
                        <span>${game.orientation.toUpperCase()}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

let portal;
window.addEventListener("DOMContentLoaded", () => {
    portal = new PortalController();

    window.mode = {
        mobile: function() {
            if (portal) {
                portal.forceMobileMode();
                return "Mobile Mode Forced Successfully! 📱";
            }
            return "Portal not initialized yet.";
        }
    };
});

