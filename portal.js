

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
        } catch (e) {
            console.error("[Portal] Failed to load games database:", e);
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

        if (tag) tag.innerText = "FEATURED GAME";
        if (categoryTag) categoryTag.innerText = featuredGame.category.toUpperCase();
        if (title) title.innerText = featuredGame.title;
        if (desc) desc.innerText = featuredGame.description;
        
        if (playBtn) {
            playBtn.onclick = () => this.playGame(featuredGame.id);
        }
        if (mediaImg) {
            mediaImg.style.backgroundImage = `url('${featuredGame.cover_landscape}')`;
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
                            <img src="${game.thumbnail}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
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
                    <img src="${game.thumbnail}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
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

        console.log(`[Portal] Launching game: ${game.title} (${game.orientation})`);
        
        
        document.body.style.overflow = "hidden";
        
        
        this.wrapper.className = "iframe-wrapper";
        
        this.wrapper.classList.add(game.orientation);

        
        const modalContent = this.modal.querySelector(".modal-content");
        if (modalContent) {
            modalContent.className = "modal-content"; 
            modalContent.classList.add(game.orientation);
        }

        
        this.modalTitle.innerText = game.title.toUpperCase();

        const isMobile = this.isMobile;
        if (isMobile) {
            console.log(`[Portal] Mobile viewport detected. Injecting play cover for: ${game.title}`);
            this.wrapper.classList.add("showing-cover");
            
            this.wrapper.innerHTML = `
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
        } else {
            const cacheBuster = Date.now();
            
            this.wrapper.innerHTML = `
                <iframe src="${game.path}?v=${cacheBuster}" 
                        id="active-game-iframe"
                        allow="autoplay; keyboard; fullscreen; clipboard-write"
                        scrolling="no">
                </iframe>
            `;
            this.currentIframe = document.getElementById("active-game-iframe");
            
            
            this.addToRecentlyPlayed(gameId);
        }

        
        const pcSidebar = document.getElementById("game-pc-sidebar");
        if (pcSidebar) {
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
                                    <img src="${sim.thumbnail}" alt="${sim.title}" class="similar-thumb">
                                    <span class="similar-title">${sim.title}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `;
            }

            mobilePanel.innerHTML = `
                <div class="mobile-header-row">
                    <img src="${game.thumbnail}" alt="${game.title}" class="mobile-thumb-img">
                    <div class="mobile-game-info">
                        <h3 class="sidebar-title" style="border:none; padding:0; margin:0; font-size:16px;">${game.title}</h3>
                        <span style="color:var(--color-neon-pink); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">${game.category}</span>
                    </div>
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

        this.wrapper.classList.remove("showing-cover");

        const cacheBuster = Date.now();
        
        this.wrapper.innerHTML = `
            <button id="mobile-back-btn" class="mobile-back-btn" onclick="portal.exitMobileFullscreen()" style="display: none;">
                ✕ Back
            </button>
            <iframe src="${game.path}?v=${cacheBuster}" 
                    id="active-game-iframe"
                    allow="autoplay; keyboard; fullscreen; clipboard-write"
                    scrolling="no">
            </iframe>
        `;
        this.currentIframe = document.getElementById("active-game-iframe");

        
        this.addToRecentlyPlayed(gameId);

        
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

    
    closeGame() {
        console.log("[Portal] Closing active game player.");
        
        
        document.body.style.overflow = "";
        
        
        this.wrapper.innerHTML = "";
        this.currentIframe = null;

        
        this.modal.classList.remove("active");
        
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
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
                    <img src="${game.thumbnail}" alt="${game.title}" class="game-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%2311112a%22/><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23ffffff%22 text-anchor=%22middle%22 dy=%22.3em%22>${game.title}</text></svg>'">
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

