

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
        this.isTester = false;

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        window.matchMedia("(pointer: coarse)").matches ||
                        ('ontouchstart' in window) ||
                        (navigator.maxTouchPoints > 0);

        if (this.isMobile) {
            document.body.classList.add("mobile-device");
        } else {
            document.body.classList.add("desktop-device");
        }

        this.firebaseConfig = {
            apiKey: "AIzaSyDrSFAr555ScmDaPopTNIDGCtn8Tt_k4Dk",
            authDomain: "svk-games.firebaseapp.com",
            projectId: "svk-games",
            storageBucket: "svk-games.firebasestorage.app",
            messagingSenderId: "83781444329",
            appId: "1:83781444329:web:31a69a3e6fb4da1200c678",
            measurementId: "G-6BBMQCVZ4E"
        };
        this.firestoreDb = null;
        this.activeFeedbackType = "idea";
        this.currentUser = null;
        this.currentUsername = "";
        this.userRole = "user";
        this.isAdmin = false;
        this.authInstance = null;
        this.attachedScreenshotBase64 = null;
        this.authMode = "signin";
        this.adminUsersCache = null;
        this.activeAdminTab = "games";
        this.usernameModalRequired = false;

        this.setupStorageGuard();
        this.init();
    }

    setupStorageGuard() {
        const nativeSetItem = Storage.prototype.setItem.bind(localStorage);
        const nativeRemoveItem = Storage.prototype.removeItem.bind(localStorage);
        const trackedKeys = [
            'totalCoins', 'dropoff_highscore', 'the_button_highscore',
            'maze_best_time_stage_1', 'maze_best_time_stage_2', 'maze_best_time_stage_3',
            'activeSkin', 'activeTrail', 'playerName', 'voxel_maze_save',
            'unlockedSkins', 'recently_played'
        ];
        const sigKey = '_svk_integrity_sig';
        const verifiedMap = new Map();

        const computeSig = () => {
            let str = 'svk_salt_v1:';
            trackedKeys.forEach(k => {
                const v = verifiedMap.has(k) ? verifiedMap.get(k) : '';
                str += `${k}=${v};`;
            });
            let h1 = 0xdeadbeef ^ str.length;
            let h2 = 0x41c6ce57 ^ str.length;
            for (let i = 0; i < str.length; i++) {
                const ch = str.charCodeAt(i);
                h1 = Math.imul(h1 ^ ch, 2654435761);
                h2 = Math.imul(h2 ^ ch, 1597334677);
            }
            h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
            return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
        };

        trackedKeys.forEach(k => {
            const val = localStorage.getItem(k);
            if (val !== null) verifiedMap.set(k, val);
        });

        const existingSig = localStorage.getItem(sigKey);
        const expectedSig = computeSig();
        if (existingSig !== null && existingSig !== expectedSig) {
            trackedKeys.forEach(k => {
                if (k !== 'recently_played') {
                    verifiedMap.delete(k);
                    nativeRemoveItem(k);
                }
            });
        }
        nativeSetItem(sigKey, computeSig());

        this.safeSetStorage = (key, value) => {
            const strVal = String(value);
            nativeSetItem(key, strVal);
            if (trackedKeys.includes(key)) {
                verifiedMap.set(key, strVal);
                nativeSetItem(sigKey, computeSig());
            }
        };

        this.safeRemoveStorage = (key) => {
            nativeRemoveItem(key);
            if (trackedKeys.includes(key)) {
                verifiedMap.delete(key);
                nativeSetItem(sigKey, computeSig());
            }
        };

        this.captureGameStorage = () => {
            trackedKeys.forEach(k => {
                const val = localStorage.getItem(k);
                if (val !== null) {
                    verifiedMap.set(k, val);
                } else {
                    verifiedMap.delete(k);
                }
            });
            nativeSetItem(sigKey, computeSig());
        };

        this.enforceVerifiedStorage = () => {
            trackedKeys.forEach(k => {
                const currentVal = localStorage.getItem(k);
                const verifiedVal = verifiedMap.has(k) ? verifiedMap.get(k) : null;
                if (currentVal !== verifiedVal) {
                    if (verifiedVal !== null) {
                        nativeSetItem(k, verifiedVal);
                    } else {
                        nativeRemoveItem(k);
                    }
                }
            });
            nativeSetItem(sigKey, computeSig());
        };

        Storage.prototype.setItem = function(key, value) {
            console.warn("[SvK Security] Direct localStorage.setItem from console is disabled.");
        };

        Storage.prototype.removeItem = function(key) {
            console.warn("[SvK Security] Direct localStorage.removeItem from console is disabled.");
        };

        Storage.prototype.clear = function() {
            console.warn("[SvK Security] Direct localStorage.clear from console is disabled.");
        };

        setInterval(() => {
            if (!this.activeGameId) {
                this.enforceVerifiedStorage();
            }
        }, 1000);
    }

    getAbsPath(path) {
        if (!path) return "";
        return path.startsWith("/") ? path : "/" + path;
    }

    getFallbackAvatarHtml() {
        return `<svg class="fallback-avatar-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    }

    setUserAvatar(element, photoURL) {
        if (!element) return;
        if (photoURL) {
            element.innerHTML = `<img src="${photoURL}" alt="avatar">`;
            const img = element.querySelector("img");
            if (img) {
                img.addEventListener("error", () => {
                    element.innerHTML = this.getFallbackAvatarHtml();
                }, { once: true });
            }
        } else {
            element.innerHTML = this.getFallbackAvatarHtml();
        }
    }

    applyInstantCachedAuth() {
        try {
            const raw = localStorage.getItem("_svk_cached_auth");
            if (!raw) return;
            const cached = JSON.parse(raw);
            if (!cached || !cached.uid) return;

            this.currentUsername = cached.username || "";
            this.userRole = cached.role || "user";
            this.isOwner = this.userRole === "owner";
            this.isAdmin = Boolean(cached.isAdmin) || this.isOwner;
            this.isTester = Boolean(cached.isTester) || this.isAdmin;

            const nameEl = document.getElementById("side-user-name");
            const editUsernameBtn = document.getElementById("side-edit-username-btn");
            const badgeEl = document.getElementById("side-user-badge");
            const avatarEl = document.getElementById("side-user-avatar");
            const loginBtn = document.getElementById("side-login-open-btn");
            const signoutBtn = document.getElementById("side-signout-btn");
            const adminBtn = document.getElementById("side-admin-inbox-btn");
            const adminTopBar = document.getElementById("admin-top-bar");

            const publicLabel = this.currentUsername ? `@${this.currentUsername}` : (cached.displayName || cached.email || "Player");
            if (nameEl) nameEl.textContent = publicLabel;
            if (editUsernameBtn) editUsernameBtn.style.display = "inline-flex";
            if (avatarEl) {
                this.setUserAvatar(avatarEl, cached.photoURL);
            }
            if (loginBtn) loginBtn.style.display = "none";
            if (signoutBtn) signoutBtn.style.display = "inline-block";
            if (adminBtn) adminBtn.style.display = "inline-block";

            if (this.isOwner) {
                if (badgeEl) {
                    badgeEl.textContent = "OWNER";
                    badgeEl.className = "side-user-badge owner";
                }
                if (adminTopBar) adminTopBar.style.display = "flex";
            } else if (this.isAdmin) {
                if (badgeEl) {
                    badgeEl.textContent = "ADMIN";
                    badgeEl.className = "side-user-badge admin";
                }
                if (adminTopBar) adminTopBar.style.display = "flex";
            } else if (this.userRole === "tester") {
                if (badgeEl) {
                    badgeEl.textContent = "PLAYTESTER";
                    badgeEl.className = "side-user-badge tester";
                }
                if (adminTopBar) adminTopBar.style.display = "none";
            } else {
                if (badgeEl) {
                    badgeEl.textContent = "Signed In";
                    badgeEl.className = "side-user-badge cloud";
                }
                if (adminTopBar) adminTopBar.style.display = "none";
            }

            this.updateSideMenuPlaytestState();
        } catch (e) {}
    }

    saveCachedAuth(user) {
        if (!user) return;
        this.safeSetStorage("_svk_cached_auth", JSON.stringify({
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
            username: this.currentUsername || "",
            role: this.userRole || "user",
            isOwner: this.isOwner,
            isAdmin: this.isAdmin,
            isTester: this.isTester
        }));
    }

    async init() {
        this.applyInstantCachedAuth();
        this.setupAuth().catch(() => {});

        try {
            console.log("[Portal] Fetching games database...");
            const response = await fetch('games.json');
            this.games = await response.json();

            this.renderFeatured();

            this.renderGrid();

            this.renderPlaytest();

            this.renderRecentlyPlayed();

            this.setupCategoryFilters();

            this.setupFullscreen();

            this.setupSearch();

            this.setupSideMenu();

            this.setupFeedbackModal();

            this.setupAdminInbox();

            this.setupUsernameModal();

            this.setupWarningModal();

            this.setupAdminUsersDashboard();

            document.addEventListener("fullscreenchange", () => {
                this.handleFullscreenChange();
                this.updateIframeScaling();
            });
            document.addEventListener("webkitfullscreenchange", () => {
                this.handleFullscreenChange();
                this.updateIframeScaling();
            });
            window.addEventListener("resize", () => {
                this.updateIframeScaling();
                this.checkAutoRotateLaunch();
            });
            window.addEventListener("orientationchange", () => {
                this.updateIframeScaling();
                this.checkAutoRotateLaunch();
            });

            this.checkRoute();
        } catch (e) {
            console.error("[Portal] Failed to load games database:", e);
        }
    }

    checkRoute() {
        const urlParams = new URLSearchParams(window.location.search);
        const targetGame = urlParams.get('game');
        
        if (targetGame) {
            const game = this.games.find(g => g.id === targetGame);
            if (game) {
                if (game.playtest && !this.isTester) {
                    window.history.replaceState(null, "", "/");
                    return;
                }
                this.playGame(targetGame);
            }
        } else {
            const path = window.location.pathname;
            const match = path.match(/^\/games\/([^\/]+)\/?$/);
            if (match) {
                const gameId = match[1];
                const game = this.games.find(g => g.id === gameId);
                if (game) {
                    if (game.playtest && !this.isTester) {
                        window.history.replaceState(null, "", "/");
                        return;
                    }
                    this.playGame(gameId);
                }
            }
        }
    }

    getGameCategories(game) {
        if (!game) return [];
        const cats = [];
        if (Array.isArray(game.categories)) {
            cats.push(...game.categories);
        }
        if (Array.isArray(game.category)) {
            cats.push(...game.category);
        } else if (typeof game.category === "string" && game.category.trim()) {
            cats.push(game.category.trim());
        }
        return Array.from(new Set(cats));
    }

    hasCategory(game, categoryName) {
        if (!categoryName) return false;
        const target = categoryName.toLowerCase().replace(/[\s-]+/g, "");
        const cats = this.getGameCategories(game);
        return cats.some(c => c.toLowerCase().replace(/[\s-]+/g, "") === target);
    }

    createGameCard(game) {
        const card = document.createElement("div");
        card.className = "game-card";
        card.setAttribute("data-id", game.id);
        card.onclick = () => this.playGame(game.id);

        const cats = this.getGameCategories(game);
        const displayCategory = (cats[0] || game.category || "").toUpperCase();

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
        return card;
    }

    renderHomeCategories() {
        const intensitySection = document.getElementById("intensity-games-section");
        const intensityGrid = document.getElementById("intensity-games-grid-container");
        if (intensitySection && intensityGrid) {
            intensityGrid.innerHTML = "";
            const intensityGames = this.games.filter(g => !g.playtest && this.hasCategory(g, "intensity"));
            if (intensityGames.length > 0) {
                intensityGames.forEach(g => intensityGrid.appendChild(this.createGameCard(g)));
                intensitySection.style.display = "";
            } else {
                intensitySection.style.display = "none";
            }
        }

        const trollSection = document.getElementById("troll-games-section");
        const trollGrid = document.getElementById("troll-games-grid-container");
        if (trollSection && trollGrid) {
            trollGrid.innerHTML = "";
            const trollGames = this.games.filter(g => !g.playtest && this.hasCategory(g, "troll"));
            if (trollGames.length > 0) {
                trollGames.forEach(g => trollGrid.appendChild(this.createGameCard(g)));
                trollSection.style.display = "";
            } else {
                trollSection.style.display = "none";
            }
        }
    }

    renderFeatured() {
        const featuredGame = this.games.find(g => g.featured && !g.playtest) || this.games.find(g => !g.playtest) || this.games[0];
        if (!featuredGame) return;

        console.log(`[Portal] Setting featured game: ${featuredGame.title}`);

        const tag = document.getElementById("featured-tag");
        const categoryTag = document.getElementById("featured-category");
        const title = document.getElementById("featured-title");
        const desc = document.getElementById("featured-desc");
        const playBtn = document.getElementById("featured-play-btn");
        const mediaImg = document.getElementById("featured-media-img");
        const card = document.getElementById("featured-game-card");

        const cats = this.getGameCategories(featuredGame);
        const primaryCat = (cats[0] || featuredGame.category || "").toUpperCase();

        if (tag) tag.innerText = "NEW!";
        if (categoryTag) categoryTag.innerText = primaryCat;
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

        const mobileFeaturedSection = document.getElementById("featured-mobile-section");
        const mobileFeaturedGrid = document.getElementById("featured-mobile-grid-container");
        if (mobileFeaturedGrid) {
            mobileFeaturedGrid.innerHTML = "";
            const featuredGames = this.games.filter(g => g.featured && !g.playtest);
            const gamesToShow = featuredGames.length > 0 ? featuredGames : [featuredGame];
            gamesToShow.forEach(game => {
                mobileFeaturedGrid.appendChild(this.createGameCard(game));
            });
            if (mobileFeaturedSection) {
                mobileFeaturedSection.style.display = "";
            }
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
                const words = this.activeFilter.toLowerCase().split(/[\s-]+/);
                const titleStr = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                sectionTitle.innerText = titleStr + " Games";
            } else {
                sectionTitle.innerText = "All Games";
            }
        }

        const featuredCard = document.getElementById("featured-game-card");
        const mobileFeaturedSection = document.getElementById("featured-mobile-section");
        const intensitySection = document.getElementById("intensity-games-section");
        const trollSection = document.getElementById("troll-games-section");

        if (featuredCard) {
            if (this.searchQuery.length > 0 || this.activeFilter !== "all") {
                featuredCard.style.display = "none";
                if (mobileFeaturedSection) mobileFeaturedSection.style.display = "none";
            } else {
                if (this.games.length > 0) {
                    featuredCard.style.display = "flex";
                    if (mobileFeaturedSection) mobileFeaturedSection.style.display = "";
                }
            }
        }

        if (this.searchQuery.length > 0 || this.activeFilter !== "all") {
            if (intensitySection) intensitySection.style.display = "none";
            if (trollSection) trollSection.style.display = "none";
        } else {
            this.renderHomeCategories();
        }

        const recentlyPlayedSection = document.getElementById("recently-played-section");
        if (recentlyPlayedSection) {
            if (this.searchQuery.length > 0 || this.activeFilter !== "all") {
                recentlyPlayedSection.style.display = "none";
            } else {
                this.renderRecentlyPlayed();
            }
        }

        if (this.isTester) {
            const playtestSection = document.getElementById("playtest-section");
            if (this.searchQuery.length > 0) {
                if (playtestSection) playtestSection.style.display = "none";
            } else {
                this.renderPlaytest();
            }
        }

        const filteredGames = this.games.filter(game => {
            if (game.playtest) {
                return false;
            }

            if (this.activeFilter !== "all") {
                const target = this.activeFilter.toLowerCase().replace(/[\s-]+/g, "");
                const matchCategory = this.hasCategory(game, target);
                const matchTags = Array.isArray(game.tags) && game.tags.some(t => {
                    const tag = t.toLowerCase().replace(/[\s-]+/g, "");
                    if (tag === target) return true;
                    if (target === "survival" && tag === "survive") return true;
                    if (target === "endlessrunner" && tag === "endless") return true;
                    return false;
                });

                if (!matchCategory && !matchTags) {
                    return false;
                }
            }

            if (this.searchQuery.length > 0) {
                const q = this.searchQuery;
                const matchTitle = game.title.toLowerCase().includes(q);
                const matchCategory = this.hasCategory(game, q);
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
                    grid.appendChild(this.createGameCard(game));
                });
            } else {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px 0;">No games found in this category yet.</div>`;
            }
            return;
        }

        filteredGames.forEach(game => {
            grid.appendChild(this.createGameCard(game));
        });
    }

    setupCategoryFilters() {
        const filters = document.querySelectorAll(".category-link");
        filters.forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();

                filters.forEach(f => f.classList.remove("active"));
                btn.classList.add("active");

                this.activeFilter = btn.getAttribute("data-filter") || "all";
                this.renderGrid();
                this.closeSideMenu();

                const gridSection = document.getElementById("games-grid-container");
                if (gridSection) {
                    gridSection.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });

        const homeLink = document.querySelector('.side-nav-group a[href="/"]');
        if (homeLink) {
            homeLink.addEventListener("click", (e) => {
                if (window.location.pathname === "/" || window.location.pathname === "") {
                    e.preventDefault();
                    filters.forEach(f => f.classList.remove("active"));
                    const allBtn = document.querySelector('.category-link[data-filter="all"]');
                    if (allBtn) allBtn.classList.add("active");
                    this.activeFilter = "all";
                    this.renderGrid();
                    this.closeSideMenu();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }
            });
        }
    }

    playGame(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;
        if (game.playtest && !this.isTester) return;

        this.enforceVerifiedStorage();
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
                        allow="autoplay; keyboard; fullscreen; clipboard-write; pointer-lock"
                        scrolling="no">
                </iframe>
            `;
            this.currentIframe = document.getElementById("active-game-iframe");
            this.updateIframeScaling();

            this.addToRecentlyPlayed(gameId);
            this.loadGameWithAssets(game);
        }

        const pcSidebar = document.getElementById("game-pc-sidebar");
        
        const oldInline = document.getElementById("game-pc-sidebar-inline");
        if (oldInline) oldInline.remove();

        const isLandscapeDesktop = !this.isMobile && game.orientation === "landscape";

        if (isLandscapeDesktop) {
            this.modal.classList.add("modal-landscape-view");
            if (pcSidebar) {
                pcSidebar.innerHTML = "";
                pcSidebar.classList.add("landscape-mode");
            }

            const isLongControls = game.controls && (game.controls.length > 80 || game.controls.includes("\n"));
            const inlinePanel = document.createElement("div");
            inlinePanel.id = "game-pc-sidebar-inline";
            if (isLongControls) {
                inlinePanel.classList.add("vertical-layout");
            }
            inlinePanel.innerHTML = `
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Description</span>
                    <p class="sidebar-section-text">${game.description}</p>
                </div>
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Controls</span>
                    <p class="sidebar-section-text sidebar-section-controls">${game.controls}</p>
                </div>
            `;
            if (modalContent) modalContent.appendChild(inlinePanel);
        } else {
            this.modal.classList.remove("modal-landscape-view");
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
        this.modal.scrollTop = 0;

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

        const isLandscape = game.orientation === "landscape" || game.aspectRatio === "16/9";
        const isPortrait = window.innerHeight > window.innerWidth;

        if (isLandscape && isPortrait) {
            this.showRotatePrompt(gameId);
            return;
        }

        this.launchMobileGameActual(gameId);
    }

    showRotatePrompt(gameId) {
        this.dismissRotateOverlay();

        const overlay = document.createElement("div");
        overlay.id = "rotate-device-overlay";
        overlay.className = "rotate-overlay";
        overlay.dataset.gameId = gameId;

        overlay.innerHTML = `
            <button class="rotate-close-btn" onclick="portal.exitMobileFullscreen()" aria-label="Close">✕</button>
            <div class="rotate-content">
                <h2 class="rotate-title">ROTATE YOUR DEVICE TO BE A GODLIKE PLAYER</h2>
                <div class="rotate-anim-container">
                    <div class="rotate-phone-anim">
                        <div class="rotate-phone-screen">
                            <div class="rotate-game-preview">S<span class="logo-v">v</span>K</div>
                        </div>
                    </div>
                    <div class="rotate-arrows">
                        <svg viewBox="0 0 150 150" class="rotate-arrow-svg">
                            <path d="M 75 14 A 61 61 0 0 0 14 75" fill="none" stroke="var(--color-neon-pink)" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 6"/>
                            <polygon points="14,83 7,69 21,69" fill="var(--color-neon-pink)"/>
                        </svg>
                    </div>
                </div>
                <div id="rotate-notice-tip" class="rotate-notice-tip" style="display: none;"></div>
                <button class="rotate-btn-primary" onclick="portal.handleRotateDone('${gameId}')">YEP, I'M DONE.</button>
                <button class="rotate-btn-secondary" onclick="portal.continueInPortrait('${gameId}')">Continue anyway</button>
            </div>
        `;

        this.wrapper.innerHTML = "";
        this.wrapper.appendChild(overlay);
    }

    async handleRotateDone(gameId) {
        if (this.wrapper.requestFullscreen) {
            try {
                await this.wrapper.requestFullscreen();
            } catch (e) {}
        } else if (this.wrapper.webkitRequestFullscreen) {
            try {
                this.wrapper.webkitRequestFullscreen();
            } catch (e) {}
        }

        if (screen.orientation && screen.orientation.lock) {
            try {
                await screen.orientation.lock("landscape");
            } catch (e) {}
        }

        setTimeout(() => {
            const isLandscape = window.innerWidth > window.innerHeight;
            if (isLandscape) {
                this.dismissRotateOverlay();
                this.launchMobileGameActual(gameId);
            } else {
                const container = document.querySelector(".rotate-anim-container");
                if (container) {
                    container.classList.remove("shake");
                    void container.offsetWidth;
                    container.classList.add("shake");
                    setTimeout(() => {
                        if (container) container.classList.remove("shake");
                    }, 500);
                }
                const tip = document.getElementById("rotate-notice-tip");
                if (tip) {
                    tip.textContent = "Please turn your phone sideways!";
                    tip.style.display = "block";
                }
            }
        }, 250);
    }

    continueInPortrait(gameId) {
        this.dismissRotateOverlay();
        this.launchMobileGameActual(gameId);
    }

    dismissRotateOverlay() {
        const overlay = document.getElementById("rotate-device-overlay");
        if (overlay) overlay.remove();
    }

    checkAutoRotateLaunch() {
        const overlay = document.getElementById("rotate-device-overlay");
        if (overlay && overlay.dataset.gameId) {
            const isLandscape = window.innerWidth > window.innerHeight;
            if (isLandscape) {
                const gameId = overlay.dataset.gameId;
                this.dismissRotateOverlay();
                this.launchMobileGameActual(gameId);
            }
        }
    }

    exitMobileFullscreen() {
        this.dismissRotateOverlay();
        this.closeGame();
    }

    launchMobileGameActual(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

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
            <button id="mobile-back-btn" class="mobile-back-btn" onclick="portal.exitMobileFullscreen()">
                ✕ Back
            </button>
            <iframe src="${absolutePath}?v=${cacheBuster}" 
                    id="active-game-iframe"
                    allow="autoplay; keyboard; fullscreen; clipboard-write; pointer-lock"
                    scrolling="no">
            </iframe>
        `;
        this.currentIframe = document.getElementById("active-game-iframe");
        this.updateIframeScaling();

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

    updateIframeScaling() {
        if (!this.currentIframe || !this.activeGameId) return;
        const game = this.games.find(g => g.id === this.activeGameId);
        if (!game) return;

        const isLandscape = game.orientation === "landscape" || game.aspectRatio === "16/9";
        const isNarrow = window.innerWidth < 640 && (window.innerHeight > window.innerWidth || this.modal.classList.contains("mobile-playing"));

        if (isLandscape && isNarrow) {
            const screenW = window.innerWidth;
            const screenH = window.innerHeight;
            const baseW = 750;
            const baseH = 422;
            const scale = Math.min(screenW / baseW, screenH / baseH);

            this.currentIframe.style.setProperty("width", baseW + "px", "important");
            this.currentIframe.style.setProperty("height", baseH + "px", "important");
            this.currentIframe.style.setProperty("max-width", "none", "important");
            this.currentIframe.style.setProperty("max-height", "none", "important");
            this.currentIframe.style.setProperty("transform", `scale(${scale})`, "important");
            this.currentIframe.style.setProperty("transform-origin", "center center", "important");
            this.currentIframe.style.setProperty("flex-shrink", "0", "important");
            return;
        }

        this.currentIframe.style.removeProperty("width");
        this.currentIframe.style.removeProperty("height");
        this.currentIframe.style.removeProperty("max-width");
        this.currentIframe.style.removeProperty("max-height");
        this.currentIframe.style.removeProperty("transform");
        this.currentIframe.style.removeProperty("transform-origin");
        this.currentIframe.style.removeProperty("flex-shrink");
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
        this.captureGameStorage();
        this.activeGameId = null;

        this.modal.classList.remove("active");
        this.modal.classList.remove("modal-landscape-view");
        this.modal.classList.remove("mobile-playing");
        this.wrapper.classList.remove("mobile-playing");

        const oldInline = document.getElementById("game-pc-sidebar-inline");
        if (oldInline) oldInline.remove();

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }

        if (this.currentUser) {
            this.syncCloudSaves(this.currentUser.uid, null, "push").catch(() => {});
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

    setupSideMenu() {
        const toggleBtn = document.getElementById("menu-toggle-btn");
        const closeBtn = document.getElementById("side-menu-close-btn");
        const backdrop = document.getElementById("side-menu-backdrop");
        const drawer = document.getElementById("side-menu");

        if (!drawer) return;

        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
                this.toggleSideMenu();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                this.closeSideMenu();
            });
        }

        if (backdrop) {
            backdrop.addEventListener("click", () => {
                this.closeSideMenu();
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && drawer.classList.contains("open")) {
                this.closeSideMenu();
            }
        });

        this.updateSideMenuPlaytestState();
    }

    updateSideMenuPlaytestState() {
        const container = document.getElementById("side-playtest-container");
        if (!container) return;

        if (this.isTester) {
            container.innerHTML = `
                <div class="side-nav-divider"></div>
                <div class="side-playtest-section">
                    <span class="side-nav-heading">Playtest Mode</span>
                    <div class="side-playtest-card">
                        <div class="side-playtest-badge">
                            <span class="side-playtest-dot"></span>
                            <span>TESTER ACTIVE</span>
                        </div>
                        <p class="side-playtest-desc">Confidential builds are unlocked on the portal.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = "";
        }
    }

    openSideMenu() {
        const drawer = document.getElementById("side-menu");
        const backdrop = document.getElementById("side-menu-backdrop");
        if (drawer) {
            drawer.classList.add("open");
            drawer.setAttribute("aria-hidden", "false");
        }
        if (backdrop) backdrop.classList.add("open");
        this.updateSideMenuPlaytestState();
    }

    closeSideMenu() {
        const drawer = document.getElementById("side-menu");
        const backdrop = document.getElementById("side-menu-backdrop");
        if (drawer) {
            if (document.activeElement && drawer.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            drawer.classList.remove("open");
            drawer.setAttribute("aria-hidden", "true");
        }
        if (backdrop) backdrop.classList.remove("open");
    }

    toggleSideMenu() {
        const drawer = document.getElementById("side-menu");
        if (drawer && drawer.classList.contains("open")) {
            this.closeSideMenu();
        } else {
            this.openSideMenu();
        }
    }

    setupFeedbackModal() {
        const modal = document.getElementById("feedbackModal");
        const backdrop = document.getElementById("feedback-backdrop");
        const closeBtn = document.getElementById("feedback-close-btn");
        const form = document.getElementById("feedback-form");
        const footerSuggestBtn = document.getElementById("footer-suggest-btn");
        const footerSupportBtn = document.getElementById("footer-support-btn");
        const sideSuggestBtn = document.getElementById("side-suggest-btn");
        const sideSupportBtn = document.getElementById("side-support-btn");
        const typeTabs = document.querySelectorAll(".feedback-type-tab");
        const screenshotInput = document.getElementById("feedback-screenshot-input");
        const removeImgBtn = document.getElementById("feedback-remove-img-btn");
        const previewBox = document.getElementById("feedback-preview-box");
        const previewImg = document.getElementById("feedback-preview-img");
        const filePrompt = document.getElementById("feedback-file-prompt");

        if (footerSuggestBtn) {
            footerSuggestBtn.addEventListener("click", () => this.openFeedbackModal("idea"));
        }
        if (footerSupportBtn) {
            footerSupportBtn.addEventListener("click", () => this.openFeedbackModal("support"));
        }
        if (sideSuggestBtn) {
            sideSuggestBtn.addEventListener("click", () => {
                this.closeSideMenu();
                this.openFeedbackModal("idea");
            });
        }
        if (sideSupportBtn) {
            sideSupportBtn.addEventListener("click", () => {
                this.closeSideMenu();
                this.openFeedbackModal("support");
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.closeFeedbackModal());
        }
        if (backdrop) {
            backdrop.addEventListener("click", () => this.closeFeedbackModal());
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal && modal.classList.contains("active")) {
                this.closeFeedbackModal();
            }
        });

        typeTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                typeTabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                this.activeFeedbackType = tab.getAttribute("data-type") || "idea";
                this.updateFeedbackModalLabels();
            });
        });

        if (screenshotInput) {
            screenshotInput.addEventListener("change", (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const maxDim = 1000;
                        let w = img.width;
                        let h = img.height;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                            } else {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                            }
                        }
                        const canvas = document.createElement("canvas");
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, w, h);
                        this.attachedScreenshotBase64 = canvas.toDataURL("image/jpeg", 0.75);
                        if (previewImg) previewImg.src = this.attachedScreenshotBase64;
                        if (previewBox) previewBox.style.display = "inline-block";
                        if (filePrompt) filePrompt.style.display = "none";
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        if (removeImgBtn) {
            removeImgBtn.addEventListener("click", () => {
                this.attachedScreenshotBase64 = null;
                if (screenshotInput) screenshotInput.value = "";
                if (previewBox) previewBox.style.display = "none";
                if (filePrompt) filePrompt.style.display = "block";
            });
        }

        if (form) {
            form.addEventListener("submit", (e) => this.submitFeedback(e));
        }
    }

    openFeedbackModal(type = "idea") {
        const modal = document.getElementById("feedbackModal");
        if (!modal) return;
        this.activeFeedbackType = type;

        const tabs = document.querySelectorAll(".feedback-type-tab");
        tabs.forEach(t => {
            if (t.getAttribute("data-type") === type) {
                t.classList.add("active");
            } else {
                t.classList.remove("active");
            }
        });

        this.updateFeedbackModalLabels();
        const statusMsg = document.getElementById("feedback-status-msg");
        if (statusMsg) {
            statusMsg.textContent = "";
            statusMsg.className = "feedback-status-msg";
        }

        const nameInput = document.getElementById("feedback-name");
        const contactField = document.getElementById("feedback-contact-field");
        const contactInput = document.getElementById("feedback-contact");
        const inboxNotice = document.getElementById("feedback-inbox-notice");

        if (nameInput) {
            if (this.currentUser) {
                const publicIdent = this.currentUsername ? `@${this.currentUsername}` : (this.currentUser.displayName || "Player");
                nameInput.value = publicIdent;
                nameInput.readOnly = true;
                nameInput.classList.add("locked-input");
                if (contactField) contactField.style.display = "none";
                if (inboxNotice) inboxNotice.style.display = "block";
            } else {
                nameInput.readOnly = false;
                nameInput.classList.remove("locked-input");
                if (nameInput.value.startsWith("@")) nameInput.value = "";
                if (contactField) contactField.style.display = "block";
                if (inboxNotice) inboxNotice.style.display = "none";
            }
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        const msgInput = document.getElementById("feedback-message");
        if (msgInput) {
            setTimeout(() => msgInput.focus(), 150);
        }
    }

    closeFeedbackModal() {
        const modal = document.getElementById("feedbackModal");
        if (!modal) return;
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        if (!this.activeGameId) {
            document.body.style.overflow = "";
        }
    }

    updateFeedbackModalLabels() {
        const titleEl = document.getElementById("feedback-modal-title");
        const subtitleEl = document.getElementById("feedback-modal-subtitle");
        const msgInput = document.getElementById("feedback-message");
        const screenshotField = document.getElementById("feedback-screenshot-field");

        if (this.activeFeedbackType === "idea") {
            if (titleEl) titleEl.textContent = "Suggest a Game";
            if (subtitleEl) subtitleEl.textContent = "Have a cool game idea? Send it straight to the creator!";
            if (msgInput) msgInput.placeholder = "Describe the gameplay, theme, or concept you'd like to see...";
            if (screenshotField) screenshotField.style.display = "none";
        } else if (this.activeFeedbackType === "bug") {
            if (titleEl) titleEl.textContent = "Report a Bug";
            if (subtitleEl) subtitleEl.textContent = "Found something broken? Help us fix it!";
            if (msgInput) msgInput.placeholder = "Which game/page, and what happened? Any details help...";
            if (screenshotField) screenshotField.style.display = "flex";
        } else {
            if (titleEl) titleEl.textContent = "Help & Support";
            if (subtitleEl) subtitleEl.textContent = "Questions, feedback, or need help? We're listening.";
            if (msgInput) msgInput.placeholder = "How can we help you?...";
            if (screenshotField) screenshotField.style.display = "flex";
        }
    }

    async getFirestoreDb() {
        if (this.firestoreDb) return this.firestoreDb;
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        const app = initializeApp(this.firebaseConfig);
        this.firestoreDb = getFirestore(app);
        return this.firestoreDb;
    }

    async getFirebaseAuth() {
        if (this.authInstance) return this.authInstance;
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
        const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
        const app = initializeApp(this.firebaseConfig);
        this.authInstance = getAuth(app);
        return this.authInstance;
    }

    async submitFeedback(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("feedback-submit-btn");
        const btnText = submitBtn ? submitBtn.querySelector(".btn-text") : null;
        const btnSpinner = submitBtn ? submitBtn.querySelector(".btn-spinner") : null;
        const statusMsg = document.getElementById("feedback-status-msg");
        const nameInput = document.getElementById("feedback-name");
        const contactInput = document.getElementById("feedback-contact");
        const msgInput = document.getElementById("feedback-message");
        const screenshotInput = document.getElementById("feedback-screenshot-input");
        const previewBox = document.getElementById("feedback-preview-box");
        const filePrompt = document.getElementById("feedback-file-prompt");

        const message = msgInput ? msgInput.value.trim() : "";
        if (!message) {
            if (statusMsg) statusMsg.textContent = "Please enter a message.";
            return;
        }

        const name = nameInput ? nameInput.value.trim() : "";
        const contact = contactInput ? contactInput.value.trim() : "";
        const fallbackIdentity = this.currentUsername
            ? `@${this.currentUsername}`
            : (this.currentUser ? (this.currentUser.displayName || this.currentUser.email) : "Anonymous");

        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.style.display = "none";
        if (btnSpinner) btnSpinner.style.display = "inline";
        if (statusMsg) statusMsg.textContent = "";

        try {
            const db = await this.getFirestoreDb();
            const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
            await addDoc(collection(db, "feedback"), {
                type: this.activeFeedbackType,
                name: name || fallbackIdentity,
                contact: this.currentUser ? (this.currentUser.email || "") : contact,
                uid: this.currentUser ? this.currentUser.uid : null,
                username: this.currentUsername || "",
                message: message,
                screenshot: this.attachedScreenshotBase64 || null,
                device: this.isMobile ? "mobile" : "desktop",
                url: window.location.href,
                createdAt: serverTimestamp()
            });

            if (msgInput) msgInput.value = "";
            if (nameInput) nameInput.value = "";
            if (contactInput) contactInput.value = "";
            this.attachedScreenshotBase64 = null;
            if (screenshotInput) screenshotInput.value = "";
            if (previewBox) previewBox.style.display = "none";
            if (filePrompt) filePrompt.style.display = "block";

            this.closeFeedbackModal();
            this.showToast("Message sent! Thanks for your input 🚀");
        } catch (err) {
            console.error("[Feedback] Submit error:", err);
            if (statusMsg) {
                statusMsg.textContent = "Could not send right now. Please try again!";
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) btnText.style.display = "inline";
            if (btnSpinner) btnSpinner.style.display = "none";
        }
    }

    async setupAuth() {
        try {
            const auth = await this.getFirebaseAuth();
            const { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");

            const loginOpenBtn = document.getElementById("side-login-open-btn");
            const signoutBtn = document.getElementById("side-signout-btn");
            const authCloseBtn = document.getElementById("auth-close-btn");
            const authBackdrop = document.getElementById("auth-backdrop");
            const googleBtn = document.getElementById("google-signin-btn");
            const emailForm = document.getElementById("auth-email-form");
            const toggleModeBtn = document.getElementById("auth-toggle-mode-btn");
            const forgotBtn = document.getElementById("auth-forgot-btn");
            const passInput = document.getElementById("auth-password");
            const passToggleBtn = document.getElementById("auth-password-toggle");

            const highlightGoogleBtn = () => {
                if (!googleBtn) return;
                googleBtn.classList.remove("pulse-highlight");
                void googleBtn.offsetWidth;
                googleBtn.classList.add("pulse-highlight");
                setTimeout(() => {
                    if (googleBtn) googleBtn.classList.remove("pulse-highlight");
                }, 2500);
            };

            const isGoogleOnlyAccount = async (targetEmail) => {
                if (!targetEmail) return false;
                try {
                    if (typeof fetchSignInMethodsForEmail === "function") {
                        const methods = await fetchSignInMethodsForEmail(auth, targetEmail);
                        if (Array.isArray(methods) && methods.length > 0) {
                            if (methods.includes("google.com") && !methods.includes("password")) {
                                return true;
                            }
                            if (methods.includes("password")) {
                                return false;
                            }
                        }
                    }
                } catch (e) {}
                return false;
            };

            const emailInputEl = document.getElementById("auth-email");
            if (emailInputEl) {
                emailInputEl.addEventListener("blur", async () => {
                    if (this.authMode !== "signin") return;
                    const val = emailInputEl.value.trim();
                    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
                    const isGoogle = await isGoogleOnlyAccount(val);
                    if (isGoogle) {
                        const statusMsg = document.getElementById("auth-status-msg");
                        if (statusMsg) {
                            statusMsg.classList.remove("success");
                            statusMsg.textContent = "This account is linked with Google. Please use 'Continue with Google' to sign in.";
                        }
                        highlightGoogleBtn();
                    }
                });
            }

            if (loginOpenBtn) {
                loginOpenBtn.addEventListener("click", () => {
                    this.closeSideMenu();
                    this.openAuthModal();
                });
            }
            if (authCloseBtn) {
                authCloseBtn.addEventListener("click", () => this.closeAuthModal());
            }
            if (authBackdrop) {
                authBackdrop.addEventListener("click", () => this.closeAuthModal());
            }

            if (toggleModeBtn) {
                toggleModeBtn.addEventListener("click", () => {
                    this.authMode = this.authMode === "signin" ? "register" : "signin";
                    const title = document.getElementById("auth-modal-title");
                    const submitText = document.getElementById("auth-submit-btn-text");
                    const statusMsg = document.getElementById("auth-status-msg");
                    if (statusMsg) {
                        statusMsg.textContent = "";
                        statusMsg.classList.remove("success");
                    }
                    if (this.authMode === "register") {
                        if (title) title.textContent = "Create SvK Account";
                        if (submitText) submitText.textContent = "Create Account";
                        toggleModeBtn.textContent = "Already have an account? Sign In";
                        if (forgotBtn) forgotBtn.style.display = "none";
                    } else {
                        if (title) title.textContent = "SvK Games Account";
                        if (submitText) submitText.textContent = "Sign In";
                        toggleModeBtn.textContent = "Need an account? Register";
                        if (forgotBtn) forgotBtn.style.display = "inline-block";
                    }
                });
            }

            if (forgotBtn) {
                forgotBtn.addEventListener("click", async () => {
                    const emailInput = document.getElementById("auth-email");
                    const statusMsg = document.getElementById("auth-status-msg");
                    const email = emailInput ? emailInput.value.trim() : "";
                    if (!email) {
                        if (statusMsg) {
                            statusMsg.classList.remove("success");
                            statusMsg.textContent = "Enter your email above first.";
                        }
                        if (emailInput) emailInput.focus();
                        return;
                    }

                    forgotBtn.disabled = true;
                    const originalText = forgotBtn.textContent;
                    forgotBtn.textContent = "Sending...";
                    if (statusMsg) {
                        statusMsg.textContent = "";
                        statusMsg.classList.remove("success");
                    }

                    try {
                        await sendPasswordResetEmail(auth, email);
                        if (statusMsg) {
                            statusMsg.classList.add("success");
                            statusMsg.textContent = "Reset email sent! If you don't see it in your inbox, check your spam or junk folder.";
                        }
                    } catch (err) {
                        console.error("[Auth] Reset password error:", err);
                        let msg = "Failed to send reset email.";
                        const code = err.code || "";
                        const rawMsg = err.message || "";
                        if (code.includes("requests-from-referer") || rawMsg.includes("requests-from-referer") || code === "auth/user-not-found") {
                            msg = "No existing account found! Create a new account to continue.";
                        } else if (code === "auth/invalid-email") {
                            msg = "Invalid email format.";
                        }
                        if (statusMsg) {
                            statusMsg.classList.remove("success");
                            statusMsg.textContent = msg;
                        }
                    } finally {
                        forgotBtn.disabled = false;
                        forgotBtn.textContent = originalText;
                    }
                });
            }

            if (passToggleBtn && passInput) {
                passToggleBtn.addEventListener("click", () => {
                    const isPassword = passInput.type === "password";
                    passInput.type = isPassword ? "text" : "password";
                    const eyeShow = passToggleBtn.querySelector(".eye-show");
                    const eyeHide = passToggleBtn.querySelector(".eye-hide");
                    if (eyeShow && eyeHide) {
                        eyeShow.style.display = isPassword ? "none" : "block";
                        eyeHide.style.display = isPassword ? "block" : "none";
                    }
                });
            }

            if (googleBtn) {
                googleBtn.addEventListener("click", async () => {
                    if (googleBtn.disabled) return;
                    googleBtn.disabled = true;
                    googleBtn.classList.remove("pulse-highlight");
                    const statusMsg = document.getElementById("auth-status-msg");
                    if (statusMsg) {
                        statusMsg.textContent = "";
                        statusMsg.classList.remove("success");
                    }
                    try {
                        const provider = new GoogleAuthProvider();
                        await signInWithPopup(auth, provider);
                    } catch (err) {
                        console.error("[Auth] Google sign-in error:", err);
                        let msg = "Could not sign in with Google.";
                        const code = err.code || "";
                        const rawMsg = err.message || "";
                        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
                            msg = "Sign in cancelled.";
                        } else if (code === "auth/user-disabled") {
                            msg = "This account has been disabled by an administrator.";
                        } else if (code === "auth/popup-blocked") {
                            msg = "Popup blocked by browser. Please allow popups for this site.";
                        } else if (code.includes("requests-from-referer") || rawMsg.includes("requests-from-referer")) {
                            msg = "Allow https://svk-games.firebaseapp.com/* in Google Cloud API key referrers.";
                        }
                        if (statusMsg) {
                            statusMsg.classList.remove("success");
                            statusMsg.textContent = msg;
                        }
                    } finally {
                        googleBtn.disabled = false;
                    }
                });
            }

            if (emailForm) {
                emailForm.addEventListener("submit", async (e) => {
                    e.preventDefault();
                    const emailInput = document.getElementById("auth-email");
                    const passInput = document.getElementById("auth-password");
                    const statusMsg = document.getElementById("auth-status-msg");
                    const submitBtn = document.getElementById("auth-submit-btn");
                    const btnText = document.getElementById("auth-submit-btn-text");
                    const spinner = document.getElementById("auth-submit-spinner");

                    const email = emailInput ? emailInput.value.trim() : "";
                    const password = passInput ? passInput.value : "";
                    if (!email || !password) return;

                    if (this.authMode === "signin") {
                        const isGoogle = await isGoogleOnlyAccount(email);
                        if (isGoogle) {
                            if (statusMsg) {
                                statusMsg.classList.remove("success");
                                statusMsg.textContent = "This account is linked with Google. Please use 'Continue with Google' to sign in.";
                            }
                            highlightGoogleBtn();
                            return;
                        }
                    }

                    if (submitBtn) submitBtn.disabled = true;
                    if (btnText) btnText.style.display = "none";
                    if (spinner) spinner.style.display = "inline";
                    if (statusMsg) {
                        statusMsg.textContent = "";
                        statusMsg.classList.remove("success");
                    }

                    try {
                        if (this.authMode === "register") {
                            await createUserWithEmailAndPassword(auth, email, password);
                        } else {
                            await signInWithEmailAndPassword(auth, email, password);
                        }
                    } catch (err) {
                        console.error("[Auth] Email sign-in error:", err);
                        let msg = "Authentication failed. Please try again.";
                        const code = err.code || "";
                        const rawMsg = err.message || "";

                        if (this.authMode === "signin") {
                            const isGoogle = await isGoogleOnlyAccount(email);
                            if (isGoogle) {
                                msg = "This account is linked with Google. Please use 'Continue with Google' to sign in.";
                                highlightGoogleBtn();
                            } else if (code === "auth/user-not-found") {
                                msg = "No existing account found! Create a new account to continue.";
                            } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                                msg = "Incorrect password. Try again or reset password.";
                            } else if (code === "auth/user-disabled") {
                                msg = "This account has been disabled by an administrator.";
                            } else if (code === "auth/invalid-email") {
                                msg = "Invalid email format.";
                            } else if (code === "auth/too-many-requests") {
                                msg = "Too many attempts. Please try again later.";
                            } else if (code === "auth/network-request-failed") {
                                msg = "Network error. Please check your connection.";
                            } else if (code.includes("requests-from-referer") || rawMsg.includes("requests-from-referer")) {
                                msg = "Domain blocked by Google API settings.";
                            }
                        } else {
                            if (code === "auth/email-already-in-use") {
                                msg = "Email already registered. Try signing in.";
                            } else if (code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements" || rawMsg.includes("password-does-not-meet-requirements") || rawMsg.includes("numeric")) {
                                msg = "Password must be at least 6 characters and include a number (0–9).";
                            } else if (code === "auth/invalid-email") {
                                msg = "Invalid email format.";
                            } else if (code.includes("requests-from-referer") || rawMsg.includes("requests-from-referer")) {
                                msg = "Localhost blocked by Google API settings. Deploy to Netlify or allow localhost in GCP.";
                            } else if (code === "auth/network-request-failed") {
                                msg = "Network error. Please check your connection.";
                            }
                        }

                        if (statusMsg) {
                            statusMsg.classList.remove("success");
                            statusMsg.textContent = msg;
                        }
                    } finally {
                        if (submitBtn) submitBtn.disabled = false;
                        if (btnText) btnText.style.display = "inline";
                        if (spinner) spinner.style.display = "none";
                    }
                });
            }

            if (signoutBtn) {
                signoutBtn.addEventListener("click", async () => {
                    try {
                        this.safeRemoveStorage("_svk_cached_auth");
                        await signOut(auth);
                        this.showToast("Signed out. Progress saved locally 💾");
                    } catch (err) {
                        console.error("[Auth] Sign out error:", err);
                    }
                });
            }

            onAuthStateChanged(auth, async (user) => {
                await this.handleAuthStateChanged(user);
            });
        } catch (err) {
            console.error("[Auth] Setup error:", err);
        }
    }

    openAuthModal() {
        const modal = document.getElementById("authModal");
        const statusMsg = document.getElementById("auth-status-msg");
        const passInput = document.getElementById("auth-password");
        const passToggleBtn = document.getElementById("auth-password-toggle");
        const googleBtn = document.getElementById("google-signin-btn");
        if (googleBtn) googleBtn.classList.remove("pulse-highlight");
        if (statusMsg) {
            statusMsg.textContent = "";
            statusMsg.classList.remove("success");
        }
        if (passInput) passInput.type = "password";
        if (passToggleBtn) {
            const eyeShow = passToggleBtn.querySelector(".eye-show");
            const eyeHide = passToggleBtn.querySelector(".eye-hide");
            if (eyeShow && eyeHide) {
                eyeShow.style.display = "block";
                eyeHide.style.display = "none";
            }
        }
        if (!modal) return;
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    closeAuthModal() {
        const modal = document.getElementById("authModal");
        const passInput = document.getElementById("auth-password");
        const passToggleBtn = document.getElementById("auth-password-toggle");
        const googleBtn = document.getElementById("google-signin-btn");
        if (googleBtn) googleBtn.classList.remove("pulse-highlight");
        if (passInput) passInput.type = "password";
        if (passToggleBtn) {
            const eyeShow = passToggleBtn.querySelector(".eye-show");
            const eyeHide = passToggleBtn.querySelector(".eye-hide");
            if (eyeShow && eyeHide) {
                eyeShow.style.display = "block";
                eyeHide.style.display = "none";
            }
        }
        if (!modal) return;
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        if (!this.activeGameId) {
            document.body.style.overflow = "";
        }
    }

    async handleAuthStateChanged(user) {
        this.currentUser = user;
        const nameEl = document.getElementById("side-user-name");
        const editUsernameBtn = document.getElementById("side-edit-username-btn");
        const badgeEl = document.getElementById("side-user-badge");
        const avatarEl = document.getElementById("side-user-avatar");
        const loginBtn = document.getElementById("side-login-open-btn");
        const signoutBtn = document.getElementById("side-signout-btn");
        const adminBtn = document.getElementById("side-admin-inbox-btn");
        const adminTopBar = document.getElementById("admin-top-bar");

        if (user) {
            const fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "Player");
            if (nameEl) nameEl.textContent = fallbackName;
            if (editUsernameBtn) editUsernameBtn.style.display = "inline-flex";
            if (avatarEl) {
                this.setUserAvatar(avatarEl, user.photoURL);
            }
            if (loginBtn) loginBtn.style.display = "none";
            if (signoutBtn) signoutBtn.style.display = "inline-block";
            if (adminBtn) adminBtn.style.display = "inline-block";

            try {
                const db = await this.getFirestoreDb();
                const { doc, getDoc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);

                let userData = {};
                if (userSnap.exists()) {
                    userData = userSnap.data();
                } else {
                    userData = {
                        email: user.email || "",
                        displayName: fallbackName,
                        role: "user",
                        banned: false,
                        warnCount: 0,
                        createdAt: serverTimestamp()
                    };
                    await setDoc(userRef, userData);
                }

                if (userData.deleted === true) {
                    this.safeRemoveStorage("_svk_cached_auth");
                    try { localStorage.clear(); } catch (e) {}
                    const auth = await this.getFirebaseAuth();
                    try {
                        await user.delete();
                    } catch (e) {
                        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
                        await signOut(auth);
                    }
                    this.openAuthModal();
                    const statusMsg = document.getElementById("auth-status-msg");
                    if (statusMsg) {
                        statusMsg.classList.remove("success");
                        statusMsg.textContent = "This account has been deleted by an administrator.";
                    }
                    return;
                }

                if (userData.banned === true) {
                    this.safeRemoveStorage("_svk_cached_auth");
                    const auth = await this.getFirebaseAuth();
                    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
                    await signOut(auth);
                    this.openAuthModal();
                    const statusMsg = document.getElementById("auth-status-msg");
                    if (statusMsg) {
                        statusMsg.classList.remove("success");
                        statusMsg.textContent = "This account has been disabled/banned by an administrator.";
                    }
                    return;
                }

                this.currentUsername = userData.username || "";
                if (this.currentUsername) {
                    if (nameEl) nameEl.textContent = `@${this.currentUsername}`;
                }

                this.userRole = userData.role || "user";
                this.isOwner = this.userRole === "owner";
                this.isAdmin = this.userRole === "admin" || this.isOwner;

                if (this.isOwner) {
                    this.isTester = true;
                    if (badgeEl) {
                        badgeEl.textContent = "OWNER";
                        badgeEl.className = "side-user-badge owner";
                    }
                    if (adminTopBar) adminTopBar.style.display = "flex";
                } else if (this.isAdmin) {
                    this.isTester = true;
                    if (badgeEl) {
                        badgeEl.textContent = "ADMIN";
                        badgeEl.className = "side-user-badge admin";
                    }
                    if (adminTopBar) adminTopBar.style.display = "flex";
                } else if (this.userRole === "tester") {
                    this.isTester = true;
                    if (badgeEl) {
                        badgeEl.textContent = "PLAYTESTER";
                        badgeEl.className = "side-user-badge tester";
                    }
                    if (adminTopBar) adminTopBar.style.display = "none";
                    this.switchAdminTopTab("games");
                } else {
                    this.isTester = false;
                    if (badgeEl) {
                        badgeEl.textContent = "Signed In";
                        badgeEl.className = "side-user-badge cloud";
                    }
                    if (adminTopBar) adminTopBar.style.display = "none";
                    this.switchAdminTopTab("games");
                }

                this.updateSideMenuPlaytestState();
                this.renderPlaytest();
                this.renderGrid();
                this.saveCachedAuth(user);

                await this.syncCloudSaves(user.uid, userData.gameSaves || null, "pull");

                this.closeAuthModal();
                this.showToast("Signed in successfully! ☁️");

                if (this.currentUsername) {
                    this.safeSetStorage("playerName", this.currentUsername);
                } else {
                    this.openUsernameModal(true);
                }

                if (userData.activeWarning && userData.activeWarning.message && userData.activeWarning.type !== "support_reply") {
                    this.openWarningModal(userData.activeWarning.message);
                } else if (userData.activeWarning && userData.activeWarning.type === "support_reply") {
                    try {
                        const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                        await updateDoc(userRef, { activeWarning: null });
                    } catch (e) {}
                }
            } catch (err) {
                console.error("[Auth] User profile error:", err);
            }
        } else {
            this.safeRemoveStorage("_svk_cached_auth");
            this.currentUser = null;
            this.currentUsername = "";
            this.userRole = "user";
            this.isAdmin = false;
            this.isTester = false;

            if (nameEl) nameEl.textContent = "Guest Player";
            if (editUsernameBtn) editUsernameBtn.style.display = "none";
            if (badgeEl) {
                badgeEl.textContent = "Not Signed In";
                badgeEl.className = "side-user-badge";
            }
            if (avatarEl) {
                avatarEl.innerHTML = this.getFallbackAvatarHtml();
            }
            if (loginBtn) loginBtn.style.display = "inline-block";
            if (signoutBtn) signoutBtn.style.display = "none";
            if (adminBtn) adminBtn.style.display = "none";
            if (adminTopBar) adminTopBar.style.display = "none";
            this.switchAdminTopTab("games");
            this.closeUsernameModal();

            this.updateSideMenuPlaytestState();
            this.renderPlaytest();
            this.renderGrid();
        }
    }

    async syncCloudSaves(uid, cloudSaves = null, mode = "pull") {
        if (!uid) return;
        const trackedNumberKeys = ['totalCoins', 'dropoff_highscore', 'the_button_highscore', 'maze_best_time_stage_1', 'maze_best_time_stage_2', 'maze_best_time_stage_3'];
        const trackedStringKeys = ['activeSkin', 'activeTrail', 'playerName', 'voxel_maze_save'];
        const trackedArrayKeys = ['unlockedSkins', 'recently_played'];

        const hasCloudData = cloudSaves && typeof cloudSaves === "object" && Object.keys(cloudSaves).length > 0;

        if (mode === "pull" && hasCloudData) {
            trackedNumberKeys.forEach(key => {
                const cloudVal = parseFloat(cloudSaves[key]);
                if (!isNaN(cloudVal) && cloudVal > 0) {
                    this.safeSetStorage(key, String(cloudVal));
                } else {
                    this.safeRemoveStorage(key);
                }
            });

            trackedStringKeys.forEach(key => {
                const cloudVal = cloudSaves[key];
                if (cloudVal !== undefined && cloudVal !== null && cloudVal !== "") {
                    this.safeSetStorage(key, String(cloudVal));
                } else {
                    this.safeRemoveStorage(key);
                }
            });

            trackedArrayKeys.forEach(key => {
                const cloudArr = cloudSaves[key];
                if (Array.isArray(cloudArr)) {
                    this.safeSetStorage(key, JSON.stringify(cloudArr));
                } else {
                    this.safeRemoveStorage(key);
                }
            });

            this.renderRecentlyPlayed();
            return;
        }

        const payload = {};

        trackedNumberKeys.forEach(key => {
            const localVal = parseFloat(localStorage.getItem(key)) || 0;
            if (localVal > 0) {
                payload[key] = localVal;
            }
        });

        trackedStringKeys.forEach(key => {
            const localVal = localStorage.getItem(key);
            if (localVal) {
                payload[key] = localVal;
            }
        });

        trackedArrayKeys.forEach(key => {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        payload[key] = parsed;
                    }
                }
            } catch (e) {}
        });

        try {
            const db = await this.getFirestoreDb();
            const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
            await updateDoc(doc(db, "users", uid), {
                gameSaves: payload,
                lastSyncedAt: serverTimestamp()
            });
        } catch (err) {
            console.warn("[CloudSave] Sync error:", err);
        }
    }

    setupUsernameModal() {
        const editBtn = document.getElementById("side-edit-username-btn");
        const closeBtn = document.getElementById("username-close-btn");
        const backdrop = document.getElementById("username-backdrop");
        const form = document.getElementById("username-form");

        if (editBtn) {
            editBtn.addEventListener("click", () => {
                this.closeSideMenu();
                this.openUsernameModal(false);
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                if (!this.usernameModalRequired) this.closeUsernameModal();
            });
        }
        if (backdrop) {
            backdrop.addEventListener("click", () => {
                if (!this.usernameModalRequired) this.closeUsernameModal();
            });
        }

        if (form) {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (!this.currentUser) return;

                const input = document.getElementById("username-input");
                const statusMsg = document.getElementById("username-status-msg");
                const submitBtn = document.getElementById("username-submit-btn");
                const btnText = document.getElementById("username-submit-text");
                const spinner = document.getElementById("username-submit-spinner");

                const rawName = input ? input.value.trim().replace(/^@+/, "") : "";
                const lower = rawName.toLowerCase();

                if (!/^[a-zA-Z0-9_. ]{1,20}$/.test(rawName)) {
                    if (statusMsg) {
                        statusMsg.classList.remove("success");
                        statusMsg.textContent = "Use 1–20 characters: letters, numbers, spaces, (_) or (.)";
                    }
                    return;
                }

                if (this.currentUsername && this.currentUsername.toLowerCase() === lower && this.currentUsername === rawName) {
                    this.closeUsernameModal();
                    return;
                }

                if (submitBtn) submitBtn.disabled = true;
                if (btnText) btnText.style.display = "none";
                if (spinner) spinner.style.display = "inline";
                if (statusMsg) {
                    statusMsg.textContent = "";
                    statusMsg.classList.remove("success");
                }

                try {
                    const db = await this.getFirestoreDb();
                    const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");

                    const usernameRef = doc(db, "usernames", lower);
                    const usernameSnap = await getDoc(usernameRef);

                    if (usernameSnap.exists()) {
                        const existingOwnerUid = usernameSnap.data().uid;
                        if (existingOwnerUid && existingOwnerUid !== this.currentUser.uid) {
                            const ownerUserSnap = await getDoc(doc(db, "users", existingOwnerUid));
                            if (ownerUserSnap.exists()) {
                                if (statusMsg) {
                                    statusMsg.classList.remove("success");
                                    statusMsg.textContent = "Username is already taken! Try another.";
                                }
                                return;
                            }
                        }
                    }

                    const oldLower = this.currentUsername ? this.currentUsername.toLowerCase() : "";

                    await setDoc(usernameRef, {
                        uid: this.currentUser.uid,
                        username: rawName,
                        updatedAt: serverTimestamp()
                    });

                    if (oldLower && oldLower !== lower) {
                        try {
                            await deleteDoc(doc(db, "usernames", oldLower));
                        } catch (e) {}
                    }

                    await updateDoc(doc(db, "users", this.currentUser.uid), {
                        username: rawName,
                        usernameLower: lower
                    });

                    this.currentUsername = rawName;
                    this.safeSetStorage("playerName", rawName);
                    if (this.currentUser) this.saveCachedAuth(this.currentUser);

                    const nameEl = document.getElementById("side-user-name");
                    if (nameEl) nameEl.textContent = `@${rawName}`;

                    if (this.adminUsersCache) {
                        const cached = this.adminUsersCache.find(u => u.uid === this.currentUser.uid);
                        if (cached) {
                            cached.username = rawName;
                            cached.usernameLower = lower;
                            this.saveAdminUsersCache();
                            this.renderAdminUsersList();
                        }
                    }

                    this.usernameModalRequired = false;
                    this.closeUsernameModal();
                    this.showToast(`Username set to @${rawName}! ✨`);
                } catch (err) {
                    console.error("[Username] Save error:", err);
                    if (statusMsg) {
                        statusMsg.classList.remove("success");
                        statusMsg.textContent = "Could not save username. Check connection or rules.";
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    if (btnText) btnText.style.display = "inline";
                    if (spinner) spinner.style.display = "none";
                }
            });
        }
    }

    openUsernameModal(required = false) {
        const modal = document.getElementById("usernameModal");
        const closeBtn = document.getElementById("username-close-btn");
        const input = document.getElementById("username-input");
        const statusMsg = document.getElementById("username-status-msg");
        const titleEl = document.getElementById("username-modal-title");
        if (!modal) return;

        this.usernameModalRequired = required;
        if (closeBtn) closeBtn.style.display = required ? "none" : "flex";
        if (titleEl) titleEl.textContent = required ? "Choose Your Username" : "Change Username";
        if (input) input.value = this.currentUsername || "";
        if (statusMsg) {
            statusMsg.textContent = "";
            statusMsg.classList.remove("success");
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        if (input) setTimeout(() => input.focus(), 120);
    }

    closeUsernameModal() {
        const modal = document.getElementById("usernameModal");
        if (!modal) return;
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        if (!this.activeGameId) {
            document.body.style.overflow = "";
        }
    }

    setupWarningModal() {
        const dismissBtn = document.getElementById("warning-dismiss-btn");
        if (dismissBtn) {
            dismissBtn.addEventListener("click", () => {
                this.closeWarningModal();
                if (this.currentUser) {
                    this.getFirestoreDb().then(async (db) => {
                        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                        await updateDoc(doc(db, "users", this.currentUser.uid), {
                            activeWarning: null
                        });
                    }).catch(e => {
                        console.error("[Warning] Dismiss error:", e);
                    });
                }
            });
        }
    }

    openWarningModal(message) {
        const modal = document.getElementById("warningModal");
        const msgBox = document.getElementById("warning-modal-message");
        if (!modal || !msgBox) return;
        msgBox.textContent = message;
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    closeWarningModal() {
        const modal = document.getElementById("warningModal");
        if (!modal) return;
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        if (!this.activeGameId) {
            document.body.style.overflow = "";
        }
    }

    setupAdminUsersDashboard() {
        const tabGames = document.getElementById("admin-tab-games");
        const tabUsers = document.getElementById("admin-tab-users");
        const refreshBtn = document.getElementById("admin-users-refresh-btn");
        const searchInput = document.getElementById("admin-users-search-input");
        const searchBtn = document.getElementById("admin-users-search-btn");
        const clearBtn = document.getElementById("admin-users-clear-btn");
        const actionCloseBtn = document.getElementById("admin-action-close-btn");
        const actionBackdrop = document.getElementById("admin-action-backdrop");

        try {
            const rawCache = sessionStorage.getItem("_svk_admin_users_cache");
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                if (Array.isArray(parsed)) this.adminUsersCache = parsed;
            }
        } catch (e) {}

        if (tabGames) {
            tabGames.addEventListener("click", () => this.switchAdminTopTab("games"));
        }
        if (tabUsers) {
            tabUsers.addEventListener("click", () => this.switchAdminTopTab("users"));
        }
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => this.loadAdminUsers(true));
        }
        if (searchBtn) {
            searchBtn.addEventListener("click", () => this.renderAdminUsersList());
        }
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                if (clearBtn) {
                    clearBtn.style.display = searchInput.value.trim() ? "inline-block" : "none";
                }
                this.renderAdminUsersList();
            });
            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.renderAdminUsersList();
                }
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                if (searchInput) searchInput.value = "";
                clearBtn.style.display = "none";
                this.renderAdminUsersList();
            });
        }

        if (actionCloseBtn) {
            actionCloseBtn.addEventListener("click", () => this.closeAdminActionModal());
        }
        if (actionBackdrop) {
            actionBackdrop.addEventListener("click", () => this.closeAdminActionModal());
        }

        document.addEventListener("keydown", (e) => {
            const actModal = document.getElementById("adminActionModal");
            if (e.key === "Escape" && actModal && actModal.classList.contains("active")) {
                this.closeAdminActionModal();
            }
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".admin-menu-wrap")) {
                document.querySelectorAll(".admin-dots-dropdown.open").forEach(el => el.classList.remove("open"));
            }
        });
    }

    switchAdminTopTab(tab) {
        this.activeAdminTab = tab;
        const tabGames = document.getElementById("admin-tab-games");
        const tabUsers = document.getElementById("admin-tab-users");
        const gamesView = document.getElementById("portal-games-view");
        const usersSection = document.getElementById("admin-users-section");
        const playtestSection = document.getElementById("playtest-section");

        if (tab === "users" && this.isAdmin) {
            if (tabGames) tabGames.classList.remove("active");
            if (tabUsers) tabUsers.classList.add("active");
            if (gamesView) gamesView.style.display = "none";
            if (playtestSection) playtestSection.style.display = "none";
            if (usersSection) usersSection.style.display = "block";
            this.loadAdminUsers(false);
        } else {
            if (tabGames) tabGames.classList.add("active");
            if (tabUsers) tabUsers.classList.remove("active");
            if (gamesView) gamesView.style.display = "block";
            if (playtestSection && this.isTester) playtestSection.style.display = "block";
            if (usersSection) usersSection.style.display = "none";
        }
    }

    saveAdminUsersCache() {
        try {
            if (this.adminUsersCache) {
                sessionStorage.setItem("_svk_admin_users_cache", JSON.stringify(this.adminUsersCache));
            }
        } catch (e) {}
    }

    async loadAdminUsers(forceRefresh = false) {
        if (!this.isAdmin) return;
        const listEl = document.getElementById("admin-users-list");

        if (!forceRefresh && Array.isArray(this.adminUsersCache)) {
            this.renderAdminUsersList();
            return;
        }

        if (listEl) listEl.innerHTML = `<div class="admin-inbox-empty">Fetching users from Firebase...</div>`;

        try {
            const db = await this.getFirestoreDb();
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
            const snap = await getDocs(collection(db, "users"));
            const users = [];
            snap.forEach(docSnap => {
                const d = docSnap.data();
                const actualWarns = Array.isArray(d.warnings)
                    ? d.warnings.filter(w => w && w.type !== "support_reply").length
                    : 0;
                users.push({
                    uid: docSnap.id,
                    email: d.email || "",
                    username: d.username || "",
                    usernameLower: d.usernameLower || (d.username ? d.username.toLowerCase() : ""),
                    displayName: d.displayName || "",
                    role: d.role || "user",
                    banned: Boolean(d.banned),
                    warnCount: d.warnCount !== undefined ? Number(d.warnCount) : actualWarns,
                    activeWarning: d.activeWarning || null,
                    warnings: Array.isArray(d.warnings) ? d.warnings : []
                });
            });

            this.adminUsersCache = users;
            this.saveAdminUsersCache();
            this.renderAdminUsersList();
        } catch (err) {
            console.error("[Admin Users] Load error:", err);
            if (listEl) listEl.innerHTML = `<div class="admin-inbox-empty">Failed to load users. Check Firestore rules.</div>`;
        }
    }

    renderAdminUsersList() {
        const listEl = document.getElementById("admin-users-list");
        const countRow = document.getElementById("admin-users-count-row");
        const searchInput = document.getElementById("admin-users-search-input");
        if (!listEl) return;

        const allUsers = Array.isArray(this.adminUsersCache) ? this.adminUsersCache : [];
        const q = searchInput ? searchInput.value.trim().toLowerCase().replace(/^@+/, "") : "";

        const filtered = allUsers.filter(u => {
            if (!q) return true;
            const uName = (u.username || "").toLowerCase();
            const dName = (u.displayName || "").toLowerCase();
            const uEmail = (u.email || "").toLowerCase();
            return uName.includes(q) || dName.includes(q) || uEmail.includes(q);
        });

        if (countRow) {
            countRow.textContent = `Showing ${filtered.length} of ${allUsers.length} user${allUsers.length === 1 ? "" : "s"}`;
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="admin-inbox-empty">No matching users found.</div>`;
            return;
        }

        listEl.innerHTML = "";

        const emailCounts = {};
        allUsers.forEach(u => {
            if (u.email) {
                const em = u.email.toLowerCase().trim();
                emailCounts[em] = (emailCounts[em] || 0) + 1;
            }
        });

        filtered.forEach(u => {
            const row = document.createElement("div");
            row.className = `admin-user-row${u.banned ? " banned-row" : ""}`;

            const publicLabel = u.username ? `@${u.username}` : (u.displayName || "No username set");
            const roleClass = u.role === "owner" ? "owner" : (u.role === "admin" ? "admin" : (u.role === "tester" ? "tester" : ""));
            const roleLabel = u.role === "owner" ? "OWNER" : (u.role === "admin" ? "ADMIN" : (u.role === "tester" ? "PLAYTESTER" : "USER"));

            const bannedBadge = u.banned ? `<span class="admin-user-role-tag banned">BANNED</span>` : "";
            const warnCountVal = Number(u.warnCount) || 0;
            const warnedBadge = warnCountVal > 0 ? `<span class="admin-user-role-tag warned">WARNED (${warnCountVal})</span>` : "";
            const isDuplicate = Boolean(u.email && emailCounts[u.email.toLowerCase().trim()] > 1);
            const duplicateBadge = isDuplicate ? `<span class="admin-user-role-tag duplicate">DUPLICATE EMAIL</span>` : "";

            const canManageTarget = this.isOwner || (this.isAdmin && u.role !== "admin" && u.role !== "owner");

            let actionMenuHtml = "";
            if (canManageTarget) {
                actionMenuHtml = `
                    <div class="admin-menu-wrap">
                        <button type="button" class="admin-dots-btn" title="Actions" aria-label="User Actions">&#8942;</button>
                        <div class="admin-dots-dropdown">
                            <button type="button" class="admin-dots-item" data-action="roles">ROLES</button>
                            <button type="button" class="admin-dots-item warn" data-action="warn">WARN</button>
                            <button type="button" class="admin-dots-item danger" data-action="ban">${u.banned ? "UNBAN" : "BAN"}</button>
                            <button type="button" class="admin-dots-item danger" data-action="delete">DELETE</button>
                        </div>
                    </div>
                `;
            }

            row.innerHTML = `
                <div class="admin-user-main">
                    <div class="admin-user-avatar">${this.getFallbackAvatarHtml()}</div>
                    <div class="admin-user-details">
                        <div class="admin-user-top-line">
                            <span class="admin-user-username"></span>
                            <span class="admin-user-role-tag ${roleClass}">${roleLabel}</span>
                            ${bannedBadge}
                            ${warnedBadge}
                            ${duplicateBadge}
                        </div>
                        <span class="admin-user-email"></span>
                    </div>
                </div>
                ${actionMenuHtml}
            `;

            const avatarBox = row.querySelector(".admin-user-avatar");
            if (avatarBox && u.photoURL) {
                this.setUserAvatar(avatarBox, u.photoURL);
            }

            const uNameSpan = row.querySelector(".admin-user-username");
            const uEmailSpan = row.querySelector(".admin-user-email");
            if (uNameSpan) uNameSpan.textContent = publicLabel;
            if (uEmailSpan) uEmailSpan.textContent = u.email || u.uid;

            const dotsBtn = row.querySelector(".admin-dots-btn");
            const dropdown = row.querySelector(".admin-dots-dropdown");

            if (dotsBtn && dropdown) {
                dotsBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = dropdown.classList.contains("open");
                    document.querySelectorAll(".admin-dots-dropdown.open").forEach(el => el.classList.remove("open"));
                    if (!isOpen) dropdown.classList.add("open");
                });

                dropdown.querySelectorAll(".admin-dots-item").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        dropdown.classList.remove("open");
                        const action = btn.getAttribute("data-action");
                        this.openAdminUserActionModal(u, action);
                    });
                });
            }

            listEl.appendChild(row);
        });
    }

    openAdminUserActionModal(targetUser, actionType) {
        const modal = document.getElementById("adminActionModal");
        const titleEl = document.getElementById("admin-action-title");
        const subEl = document.getElementById("admin-action-subtitle");
        const bodyEl = document.getElementById("admin-action-body");
        if (!modal || !bodyEl) return;

        if (!this.isOwner && (targetUser.role === "admin" || targetUser.role === "owner")) {
            this.showToast("Admins cannot modify other Admins or Owners.");
            return;
        }

        const targetIdentity = targetUser.username ? `@${targetUser.username} (${targetUser.email})` : (targetUser.email || targetUser.uid);
        if (subEl) subEl.textContent = targetIdentity;
        bodyEl.innerHTML = "";

        if (actionType === "roles") {
            if (titleEl) titleEl.textContent = "Change User Role";
            let selectedRole = targetUser.role || "user";

            let roleOptsHtml = `
                <div class="admin-role-options">
                    <button type="button" class="admin-role-opt ${selectedRole === 'user' ? 'selected' : ''}" data-role="user">
                        <span>USER</span>
                        <span>Standard Player</span>
                    </button>
                    <button type="button" class="admin-role-opt ${selectedRole === 'tester' ? 'selected' : ''}" data-role="tester">
                        <span>PLAYTESTER</span>
                        <span>Unlocks Confidential Builds</span>
                    </button>
                    <button type="button" class="admin-role-opt ${selectedRole === 'admin' ? 'selected' : ''}" data-role="admin">
                        <span>ADMIN</span>
                        <span>Full Portal Management</span>
                    </button>
            `;

            if (this.isOwner) {
                roleOptsHtml += `
                    <button type="button" class="admin-role-opt ${selectedRole === 'owner' ? 'selected' : ''}" data-role="owner">
                        <span>OWNER</span>
                        <span>Full Project Ownership</span>
                    </button>
                `;
            }

            roleOptsHtml += `
                </div>
                <div class="admin-action-btns">
                    <button type="button" class="admin-cancel-btn" id="admin-act-cancel">Cancel</button>
                    <button type="button" class="feedback-submit-btn" id="admin-act-confirm">Save Role</button>
                </div>
            `;

            bodyEl.innerHTML = roleOptsHtml;

            bodyEl.querySelectorAll(".admin-role-opt").forEach(opt => {
                opt.addEventListener("click", () => {
                    bodyEl.querySelectorAll(".admin-role-opt").forEach(o => o.classList.remove("selected"));
                    opt.classList.add("selected");
                    selectedRole = opt.getAttribute("data-role");
                });
            });

            bodyEl.querySelector("#admin-act-cancel").addEventListener("click", () => this.closeAdminActionModal());
            bodyEl.querySelector("#admin-act-confirm").addEventListener("click", async () => {
                try {
                    const db = await this.getFirestoreDb();
                    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                    await updateDoc(doc(db, "users", targetUser.uid), { role: selectedRole });
                    targetUser.role = selectedRole;
                    this.saveAdminUsersCache();
                    this.renderAdminUsersList();
                    this.closeAdminActionModal();
                    this.showToast(`Updated role to ${selectedRole.toUpperCase()}.`);
                } catch (err) {
                    console.error("[Admin] Role update error:", err);
                }
            });
        } else if (actionType === "ban") {
            const willBan = !targetUser.banned;
            if (titleEl) titleEl.textContent = willBan ? "Ban User — Are you sure?" : "Unban User — Are you sure?";

            bodyEl.innerHTML = `
                <div class="admin-confirm-text">
                    ${willBan
                        ? `Are you sure you want to <strong>BAN</strong> this account? They will be immediately signed out and blocked from logging in.`
                        : `Are you sure you want to <strong>UNBAN</strong> this account and restore their login access?`}
                </div>
                <div class="admin-action-btns">
                    <button type="button" class="admin-cancel-btn" id="admin-act-cancel">Cancel</button>
                    <button type="button" class="${willBan ? 'admin-danger-btn' : 'feedback-submit-btn'}" id="admin-act-confirm">${willBan ? "Yes, Ban Account" : "Yes, Unban Account"}</button>
                </div>
            `;

            bodyEl.querySelector("#admin-act-cancel").addEventListener("click", () => this.closeAdminActionModal());
            bodyEl.querySelector("#admin-act-confirm").addEventListener("click", async () => {
                try {
                    const db = await this.getFirestoreDb();
                    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                    await updateDoc(doc(db, "users", targetUser.uid), { banned: willBan });
                    targetUser.banned = willBan;
                    this.saveAdminUsersCache();
                    this.renderAdminUsersList();
                    this.closeAdminActionModal();
                    this.showToast(willBan ? "User account banned." : "User account unbanned.");
                } catch (err) {
                    console.error("[Admin] Ban update error:", err);
                }
            });
        } else if (actionType === "delete") {
            if (titleEl) titleEl.textContent = "Delete User — Are you sure?";

            bodyEl.innerHTML = `
                <div class="admin-confirm-text">
                    Are you sure you want to permanently <strong>DELETE</strong> this user's profile and all synced game progress?
                </div>
                <div class="admin-action-btns">
                    <button type="button" class="admin-cancel-btn" id="admin-act-cancel">Cancel</button>
                    <button type="button" class="admin-danger-btn" id="admin-act-confirm">Yes, Delete User</button>
                </div>
            `;

            bodyEl.querySelector("#admin-act-cancel").addEventListener("click", () => this.closeAdminActionModal());
            bodyEl.querySelector("#admin-act-confirm").addEventListener("click", async () => {
                try {
                    const db = await this.getFirestoreDb();
                    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                    if (targetUser.usernameLower) {
                        try {
                            await deleteDoc(doc(db, "usernames", targetUser.usernameLower));
                        } catch (e) {}
                    }
                    await deleteDoc(doc(db, "users", targetUser.uid));
                    if (Array.isArray(this.adminUsersCache)) {
                        this.adminUsersCache = this.adminUsersCache.filter(u => u.uid !== targetUser.uid);
                        this.saveAdminUsersCache();
                    }
                    this.renderAdminUsersList();
                    this.closeAdminActionModal();
                    this.showToast("User and data deleted.");
                } catch (err) {
                    console.error("[Admin] Delete user error:", err);
                }
            });
        } else if (actionType === "warn") {
            if (titleEl) titleEl.textContent = "Send Warning to User";

            bodyEl.innerHTML = `
                <form id="admin-warn-form" class="feedback-form">
                    <div class="feedback-field">
                        <label for="admin-warn-msg" class="feedback-label">Warning Message (Required)</label>
                        <textarea id="admin-warn-msg" class="feedback-textarea" rows="3" placeholder="Enter the warning message the user will receive..." required></textarea>
                    </div>
                    <div class="admin-action-btns">
                        <button type="button" class="admin-cancel-btn" id="admin-act-cancel">Cancel</button>
                        <button type="submit" class="feedback-submit-btn">Send Warning</button>
                    </div>
                </form>
            `;

            bodyEl.querySelector("#admin-act-cancel").addEventListener("click", () => this.closeAdminActionModal());
            const warnForm = bodyEl.querySelector("#admin-warn-form");
            warnForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const msgInput = bodyEl.querySelector("#admin-warn-msg");
                const msg = msgInput ? msgInput.value.trim() : "";
                if (!msg) return;
                try {
                    const db = await this.getFirestoreDb();
                    const { doc, updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                    const warningObj = {
                        message: msg,
                        issuedAt: new Date().toISOString(),
                        type: "warning"
                    };
                    const nextWarnCount = (Number(targetUser.warnCount) || 0) + 1;
                    await updateDoc(doc(db, "users", targetUser.uid), {
                        activeWarning: warningObj,
                        warnCount: nextWarnCount,
                        warnings: arrayUnion(warningObj)
                    });
                    targetUser.activeWarning = warningObj;
                    targetUser.warnCount = nextWarnCount;
                    if (!Array.isArray(targetUser.warnings)) targetUser.warnings = [];
                    targetUser.warnings.push(warningObj);
                    this.saveAdminUsersCache();
                    this.renderAdminUsersList();
                    this.closeAdminActionModal();
                    this.showToast("Warning sent to user.");
                } catch (err) {
                    console.error("[Admin] Warn user error:", err);
                }
            });
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    closeAdminActionModal() {
        const modal = document.getElementById("adminActionModal");
        if (!modal) return;
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        if (!this.activeGameId) {
            document.body.style.overflow = "";
        }
    }

    setupAdminInbox() {
        const adminBtn = document.getElementById("side-admin-inbox-btn");
        const modal = document.getElementById("adminInboxModal");
        const closeBtn = document.getElementById("admin-inbox-close-btn");
        const backdrop = document.getElementById("admin-inbox-backdrop");

        if (adminBtn) {
            adminBtn.addEventListener("click", () => {
                this.closeSideMenu();
                this.openAdminInbox();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.closeAdminInbox());
        }
        if (backdrop) {
            backdrop.addEventListener("click", () => this.closeAdminInbox());
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal && modal.classList.contains("active")) {
                this.closeAdminInbox();
            }
        });
    }

    async openAdminInbox() {
        const modal = document.getElementById("adminInboxModal");
        const list = document.getElementById("admin-inbox-list");
        const countEl = document.getElementById("admin-inbox-count");
        const titleEl = modal ? modal.querySelector(".feedback-title") : null;
        if (!modal || !list) return;

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        if (!this.isAdmin) {
            if (titleEl) titleEl.textContent = "My Inbox";
            if (countEl) countEl.textContent = "";
            list.innerHTML = `<div class="admin-inbox-empty">Loading your messages...</div>`;

            try {
                if (!this.currentUser) {
                    list.innerHTML = `<div class="admin-inbox-empty">Sign in to view your inbox messages.</div>`;
                    if (countEl) countEl.textContent = "";
                    return;
                }

                const db = await this.getFirestoreDb();
                const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                const uSnap = await getDoc(doc(db, "users", this.currentUser.uid));
                const uData = uSnap.exists() ? uSnap.data() : {};
                const warningsList = Array.isArray(uData.warnings) ? uData.warnings : [];

                if (warningsList.length === 0) {
                    list.innerHTML = `<div class="admin-inbox-empty">No messages or warnings in your inbox! 🎉</div>`;
                    if (countEl) countEl.textContent = "";
                    return;
                }

                if (countEl) countEl.textContent = "";
                list.innerHTML = "";

                warningsList.slice().reverse().forEach((w, idx) => {
                    const card = document.createElement("div");
                    card.className = "admin-inbox-card";
                    const dateStr = w.issuedAt ? new Date(w.issuedAt).toLocaleString() : "Official Notice";
                    const isReply = w.type === "support_reply";
                    const badgeText = isReply ? "SUPPORT REPLY" : "WARNING";
                    const badgeStyle = isReply
                        ? "background: rgba(0, 255, 204, 0.2); color: #00ffcc;"
                        : "background: rgba(255, 187, 0, 0.2); color: #ffbb00;";
                    const senderName = w.from || (isReply ? "SvK Administration" : "SvK Administration");

                    card.innerHTML = `
                        <div class="admin-card-header">
                            <span class="admin-badge" style="${badgeStyle}">${badgeText}</span>
                            <span class="admin-date">${dateStr}</span>
                        </div>
                        <div class="admin-sender">
                            <strong>${senderName}</strong>
                        </div>
                        <div class="admin-msg-body">${w.message || "No content"}</div>
                    `;
                    list.appendChild(card);
                });
            } catch (err) {
                console.error("[User Inbox] Load error:", err);
                list.innerHTML = `<div class="admin-inbox-empty">Could not load inbox messages.</div>`;
            }
            return;
        }

        if (titleEl) titleEl.textContent = "Admin Inbox";
        list.innerHTML = `<div class="admin-inbox-empty">Loading feedback...</div>`;

        try {
            const db = await this.getFirestoreDb();
            const { collection, getDocs, query, orderBy, deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
            const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);

            if (snap.empty) {
                list.innerHTML = `<div class="admin-inbox-empty">Inbox is clean! No submissions found.</div>`;
                if (countEl) countEl.textContent = "0 submissions";
                return;
            }

            if (countEl) countEl.textContent = `${snap.size} submission${snap.size === 1 ? '' : 's'}`;
            list.innerHTML = "";

            snap.forEach(docSnap => {
                const item = docSnap.data();
                const card = document.createElement("div");
                card.className = "admin-inbox-card";
                card.id = `feedback-doc-${docSnap.id}`;

                let dateStr = "";
                if (item.createdAt && item.createdAt.toDate) {
                    dateStr = item.createdAt.toDate().toLocaleString();
                } else {
                    dateStr = "Recent";
                }

                const badgeClass = item.type === "bug" ? "bug" : (item.type === "support" ? "support" : "");
                const badgeText = item.type === "bug" ? "BUG REPORT" : (item.type === "support" ? "HELP" : "GAME IDEA");

                let screenshotHtml = "";
                if (item.screenshot) {
                    screenshotHtml = `
                        <div class="admin-screenshot-box">
                            <img src="${item.screenshot}" alt="Screenshot" class="admin-screenshot-thumb" onclick="window.open('${item.screenshot}')" title="Click to view full image">
                        </div>
                    `;
                }

                let contactInfoHtml = "";
                if (item.contact) {
                    contactInfoHtml += `<div class="admin-contact-row"><strong>CONTACT:</strong> ${item.contact}</div>`;
                }
                if (item.username) {
                    contactInfoHtml += `<div class="admin-contact-row"><strong>ACCOUNT:</strong> @${item.username}</div>`;
                }

                let replyBtnHtml = "";
                if (item.uid) {
                    replyBtnHtml = `<button type="button" class="admin-reply-btn" data-doc-id="${docSnap.id}">Reply to User</button>`;
                }

                card.innerHTML = `
                    <div class="admin-card-header">
                        <span class="admin-badge ${badgeClass}">${badgeText}</span>
                        <span class="admin-date">${dateStr}</span>
                    </div>
                    <div class="admin-sender">
                        <strong>${item.name || "Anonymous"}</strong> &bull; ${item.device || "desktop"}
                    </div>
                    ${contactInfoHtml}
                    <div class="admin-msg-body">${item.message || ""}</div>
                    ${screenshotHtml}
                    <div class="admin-card-footer">
                        ${replyBtnHtml}
                        <button type="button" class="admin-del-btn" data-doc-id="${docSnap.id}">Delete</button>
                    </div>
                `;

                const replyBtn = card.querySelector(".admin-reply-btn");
                if (replyBtn) {
                    replyBtn.addEventListener("click", () => {
                        this.openAdminReplyModal(item);
                    });
                }

                const delBtn = card.querySelector(".admin-del-btn");
                if (delBtn) {
                    delBtn.addEventListener("click", () => {
                        this.confirmDeleteSubmission(docSnap.id, card);
                    });
                }

                list.appendChild(card);
            });
        } catch (err) {
            console.error("[Admin Inbox] Load error:", err);
            list.innerHTML = `<div class="admin-inbox-empty">Could not load feedback. Check admin permissions.</div>`;
        }
    }

    openAdminReplyModal(item) {
        const modal = document.getElementById("adminActionModal");
        const titleEl = document.getElementById("admin-action-title");
        const subEl = document.getElementById("admin-action-subtitle");
        const bodyEl = document.getElementById("admin-action-body");
        if (!modal || !bodyEl) return;

        const targetName = item.username ? `@${item.username}` : (item.name || "User");
        if (titleEl) titleEl.textContent = `Reply to ${targetName}`;
        if (subEl) subEl.textContent = "Your reply will appear directly in their website Inbox.";

        bodyEl.innerHTML = `
            <form id="admin-reply-form" class="feedback-form">
                <div class="feedback-field">
                    <label for="admin-reply-msg" class="feedback-label">Message</label>
                    <textarea id="admin-reply-msg" class="feedback-textarea" rows="3" placeholder="Type your reply to this player..." required></textarea>
                </div>
                <div class="admin-action-btns">
                    <button type="button" class="admin-cancel-btn" id="admin-act-cancel">Cancel</button>
                    <button type="submit" class="feedback-submit-btn">Send to User's Inbox</button>
                </div>
            </form>
        `;

        bodyEl.querySelector("#admin-act-cancel").addEventListener("click", () => this.closeAdminActionModal());
        const replyForm = bodyEl.querySelector("#admin-reply-form");
        replyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const msgInput = bodyEl.querySelector("#admin-reply-msg");
            const replyMsg = msgInput ? msgInput.value.trim() : "";
            if (!replyMsg || !item.uid) return;

            try {
                const db = await this.getFirestoreDb();
                const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                const userRef = doc(db, "users", item.uid);
                const userSnap = await getDoc(userRef);
                const replyObj = {
                    message: replyMsg,
                    issuedAt: new Date().toISOString(),
                    type: "support_reply",
                    from: this.isOwner ? "SvK Owner" : "SvK Administration"
                };

                let existing = [];
                if (userSnap.exists()) {
                    const d = userSnap.data();
                    if (Array.isArray(d.warnings)) existing = d.warnings;
                }
                existing.unshift(replyObj);

                await updateDoc(userRef, {
                    warnings: existing
                });

                this.closeAdminActionModal();
                this.showToast(`Reply sent to ${targetName}'s Inbox! 📬`);
            } catch (err) {
                console.error("[Admin Reply] Error:", err);
                this.showToast("Failed to send reply: " + (err.message || "Error"));
            }
        });

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    confirmDeleteSubmission(docId, cardElement) {
        const modal = document.getElementById("adminActionModal");
        const titleEl = document.getElementById("admin-action-title");
        const subEl = document.getElementById("admin-action-subtitle");
        const bodyEl = document.getElementById("admin-action-body");
        if (!modal || !bodyEl) return;

        if (titleEl) titleEl.textContent = "Delete Submission — Are you sure?";
        if (subEl) subEl.textContent = "This will permanently remove this player feedback.";

        bodyEl.innerHTML = `
            <div class="admin-confirm-text">
                Are you sure you want to permanently <strong>DELETE</strong> this submission?
            </div>
            <div class="admin-action-btns">
                <button type="button" class="admin-cancel-btn" id="admin-act-cancel">Cancel</button>
                <button type="button" class="admin-danger-btn" id="admin-act-confirm">Yes, Delete</button>
            </div>
        `;

        bodyEl.querySelector("#admin-act-cancel").addEventListener("click", () => this.closeAdminActionModal());
        bodyEl.querySelector("#admin-act-confirm").addEventListener("click", async () => {
            try {
                const db = await this.getFirestoreDb();
                const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
                await deleteDoc(doc(db, "feedback", docId));
                if (cardElement) cardElement.remove();
                this.closeAdminActionModal();
                this.showToast("Submission deleted.");
            } catch (e) {
                console.error("[Admin Inbox] Delete error:", e);
                this.showToast("Failed to delete submission.");
            }
        });

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    closeAdminInbox() {
        const modal = document.getElementById("adminInboxModal");
        if (!modal) return;
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        if (!this.activeGameId) {
            document.body.style.overflow = "";
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
            this.safeSetStorage("recently_played", JSON.stringify(list));
        } catch (e) {
            console.error("[Portal] Failed to save recently played list:", e);
        }

        this.renderRecentlyPlayed();
    }

    renderPlaytest() {
        if (!this.isTester) {
            const existingSection = document.getElementById("playtest-section");
            if (existingSection) existingSection.remove();
            const existingStyle = document.getElementById("playtest-dynamic-styles");
            if (existingStyle) existingStyle.remove();
            return;
        }

        const testGames = this.games.filter(g => {
            if (!g.playtest) return false;
            if (this.activeFilter !== "all") {
                const target = this.activeFilter.toLowerCase().replace(/[\s-]+/g, "");
                const cat = (g.category || "").toLowerCase().replace(/[\s-]+/g, "");
                const matchCategory = cat === target;
                const matchTags = Array.isArray(g.tags) && g.tags.some(t => {
                    const tag = t.toLowerCase().replace(/[\s-]+/g, "");
                    if (tag === target) return true;
                    if (target === "survival" && tag === "survive") return true;
                    if (target === "endlessrunner" && tag === "endless") return true;
                    return false;
                });
                return matchCategory || matchTags;
            }
            return true;
        });
        if (testGames.length === 0) {
            const existingSection = document.getElementById("playtest-section");
            if (existingSection) existingSection.style.display = "none";
            return;
        }

        if (!document.getElementById("playtest-dynamic-styles")) {
            const style = document.createElement("style");
            style.id = "playtest-dynamic-styles";
            style.textContent = `
                #playtest-section {
                    margin-bottom: 30px;
                }
                #playtest-section .section-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .playtest-badge {
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    background: rgba(255, 51, 102, 0.15);
                    color: var(--color-neon-pink);
                    border: 1px solid rgba(255, 51, 102, 0.35);
                    padding: 2px 8px;
                    border-radius: 12px;
                }
            `;
            document.head.appendChild(style);
        }

        let section = document.getElementById("playtest-section");
        let grid = document.getElementById("playtest-grid-container");

        if (!section) {
            section = document.createElement("section");
            section.className = "games-section";
            section.id = "playtest-section";

            const title = document.createElement("h2");
            title.className = "section-title";
            title.innerHTML = 'Play Test <span class="playtest-badge">Confidential</span>';
            section.appendChild(title);

            grid = document.createElement("div");
            grid.className = "games-grid";
            grid.id = "playtest-grid-container";
            section.appendChild(grid);

            const recentlyPlayed = document.getElementById("recently-played-section");
            if (recentlyPlayed && recentlyPlayed.parentNode) {
                recentlyPlayed.parentNode.insertBefore(section, recentlyPlayed);
            } else {
                const gamesSectionTitle = document.getElementById("games-section-title");
                if (gamesSectionTitle && gamesSectionTitle.closest(".games-section")) {
                    gamesSectionTitle.closest(".games-section").before(section);
                } else {
                    const main = document.querySelector("main") || document.body;
                    main.appendChild(section);
                }
            }
        }

        section.style.display = "block";
        grid.innerHTML = "";

        testGames.forEach(game => {
            const card = document.createElement("div");
            card.className = "game-card";
            card.setAttribute("data-id", game.id);
            card.onclick = () => this.playGame(game.id);

            const displayCategory = (game.category || "PLAY TEST").toUpperCase();

            card.innerHTML = `
                <div class="game-thumb-wrapper">
                    <img src="${this.getAbsPath(game.thumbnail)}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <div class="game-meta" style="display: flex; justify-content: flex-start; align-items: center; font-size: 11px; color: var(--text-secondary);">
                        <span style="color: var(--color-neon-pink); font-weight: 800; letter-spacing: 0.5px;">${displayCategory}</span>
                        <span style="opacity: 0.4; margin: 0 6px;">•</span>
                        <span>${(game.orientation || "PORTRAIT").toUpperCase()}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
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
            .filter(Boolean)
            .filter(g => !g.playtest || this.isTester);

        if (playedGames.length === 0) {
            section.style.display = "none";
            return;
        }

        section.style.display = "block";
        grid.innerHTML = "";

        playedGames.forEach(game => {
            grid.appendChild(this.createGameCard(game));
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

