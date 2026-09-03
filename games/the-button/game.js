
class AudioSynth {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playBeep(freq, type = "sine", duration = 0.1, volume = 0.15) {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playSuccess() {
        this.playBeep(523.25, "sine", 0.1); 
        setTimeout(() => this.playBeep(659.25, "sine", 0.15), 80); 
    }

    playDoubleTapBeep() {
        this.playBeep(659.25, "square", 0.08);
        setTimeout(() => this.playBeep(880, "square", 0.12), 90);
    }

    playBuzz() {
        this.playBeep(120, "sawtooth", 0.35, 0.25);
    }

    playStart() {
        this.playBeep(440, "square", 0.08);
        setTimeout(() => this.playBeep(554, "square", 0.08), 80);
        setTimeout(() => this.playBeep(659, "square", 0.08), 160);
        setTimeout(() => this.playBeep(880, "square", 0.15), 240);
    }

    playVictory() {
        this.init();
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; 
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playBeep(freq, "triangle", 0.25, 0.3), idx * 130);
        });
    }
}

const synth = new AudioSynth();

const gameContainer = document.getElementById("game-container");
const gameBtn = document.getElementById("game-button");
const scoreVal = document.getElementById("score-val") || { innerText: "" };
const highscoreVal = document.getElementById("highscore-val");
const timerBar = document.getElementById("timer-bar");
const stageWrapper = document.getElementById("stage-wrapper");
const retryBtn = document.getElementById("retry-btn");
const playerImg = document.getElementById("scene-player");

let score = 0;
let highScore = 0;
let gameActive = false;
let maxTime = 4000; 
let timeLeft = 0;
let lastFrameTime = 0;
let activeCommand = null;
let tapCount = 0;
let fallAnimationInterval = null;
let cycleInterval = null;
let targetColorState = ""; 
let currentDisplayMode = "top"; 
let challengeQueue = []; 
let isHolding = false; 
let isTimerPaused = false; 
let isDevMode = false; 

const adminProxy = new Proxy({}, {
    get(target, prop) {
        if (prop === 'log') {
            return new Proxy({}, {
                get(t, p) {
                    if (p === 'mode') {
                        return function() {
                            isDevMode = !isDevMode;
                            console.log("Dev mode toggled:", isDevMode);
                            return `Dev Mode is now ${isDevMode ? 'ENABLED' : 'DISABLED'}`;
                        };
                    }
                },
                ownKeys() {
                    return [];
                },
                getOwnPropertyDescriptor() {
                    return undefined;
                }
            });
        } else if (prop === 'log_mode') {
            return function() {
                isDevMode = !isDevMode;
                console.log("Dev mode toggled:", isDevMode);
                return `Dev Mode is now ${isDevMode ? 'ENABLED' : 'DISABLED'}`;
            };
        }
    },
    ownKeys() {
        return [];
    },
    getOwnPropertyDescriptor() {
        return undefined;
    }
});

Object.defineProperty(window, 'admin', {
    value: adminProxy,
    enumerable: false,
    configurable: true
});

window.addEventListener("keydown", (e) => {
    if (!gameActive || !isDevMode) return;
    const key = e.key.toLowerCase();
    if (key === "s") {
        synth.playSuccess();
        triggerSuccess();
    } else if (key === "t") {
        timeLeft = 0; 
    } else if (key === "p") {
        isTimerPaused = !isTimerPaused;
    }
});

function generateCampaignChallenges() {
    return [
        
        { type: "tap", text: "PRESS", color: "red", req: 1 },
        
        { type: "tap", text: "TRIPLE TAP", color: "red", req: 3 },
        
        { type: "memory_prank", text: "NEXT ONE IS 2 PRESSES", color: "red", isNeutral: true },
        
        { type: "tap", text: "TAP ONCE", color: "red", req: 2 },
        
        { type: "memory_prank", text: "REMEMBER: 78", color: "red", isNeutral: true },
        
        { type: "math", text: "SOLVE: 2 + 3 = TAPS", color: "red", req: 5 },
        
        { type: "emoji", text: "PRESS FOR EACH LETTER IN 'EMOJI'", emoji: "🥔", color: "red", req: 5 },
        
        { type: "memory_prank", text: "THE NEXT COMMAND IS A LIE", color: "red", isNeutral: true },
        
        { type: "memory_prank", text: "THE COMMAND AFTER NEXT IS TRUE", color: "red", isNeutral: true },
        
        { type: "tap", text: "WOULD YOU MIND PRESSING?", color: "red", req: 1 },
        
        { type: "memory_prank", text: "PRESS WHEN POTATOES ARE PRIME", color: "red", isNeutral: true },
        
        { type: "dont", text: "DON'T PRESS", color: "red", req: 0 },
        
        { type: "memory_prank", text: "TIGER LIES", color: "red", isNeutral: true },
        
        { type: "countdown", text: "3 PRESS REMAINING", color: "red", req: 3, isCountdown: true },
        
        { type: "dont", text: "🥔🥔🥔🥔🥔🥔🥔", color: "red", req: 0 },
        
        { type: "memory_prank", text: "DON'T OBEY NEXT", color: "red", isNeutral: true },
        
        { type: "memory_prank", text: "DON'T OBEY NEXT", color: "red", isNeutral: true },
        
        { type: "tap", text: "PRESS", color: "red", req: 1 },
        
        { type: "dont", text: "[TIGER] PRESS TWICE", color: "red", req: 0 },
        
        { type: "greater_than_zero", text: "🥔🥔🥔🥔", color: "red", isGreaterThanZero: true },
        
        { type: "memory_prank", text: "SAME AS LAST", color: "red", isNeutral: true },
        
        { type: "memory_prank", text: "ALWAYS PRESS WHEN YOU SEE A ROBOT", color: "red", isNeutral: true },
        
        { type: "shape", text: "PRESS ONCE PER CORNER OF: SQUARE ■", color: "red", req: 4 },
        
        { type: "tap", text: "[ROBOT] DO NOT PRESS!", color: "red", req: 1 },
        
        { type: "greater_than_eight", text: "PRESS MORE THAN 8 TIMES", color: "red", isGreaterThanEight: true },
        
        { type: "hold", text: "HOLD IT", color: "red" },
        
        { type: "tap", text: "PRESS ONCE FOR EACH WORD IN LAST COMMAND", color: "red", req: 2 },
        
        { type: "color_match", text: "PRESS ON BLUE", color: "blue", targetColor: "blue" },
        
        { type: "memory_prank", text: "PRESS ONLY WHEN TEXT IS ON THE BOTTOM SCREEN", color: "red", isNeutral: true },
        
        { type: "screen_trap", text: "PRESS TWICE", color: "red", req: 2 }
    ];
}

function updateDisplayScreens(text, textColor) {
    const topInst = document.getElementById("instruction-box-top");
    const bottomInst = document.getElementById("instruction-box-bottom");

    if (!topInst || !bottomInst) return;

    topInst.innerText = "";
    bottomInst.innerText = "";

    const activeColor = "var(--lcd-text)";
    topInst.style.color = activeColor;
    bottomInst.style.color = activeColor;

    if (currentDisplayMode === "split") {
        
        if (text.includes(":")) {
            const parts = text.split(":");
            topInst.innerText = parts[0].trim();
            bottomInst.innerText = parts[1].trim();
        } else if (text.includes("?")) {
            const parts = text.split("?");
            topInst.innerText = parts[0].trim();
            bottomInst.innerText = parts[1].trim();
        } else {
            
            const words = text.trim().split(/\s+/);
            if (words.length > 1) {
                const mid = Math.ceil(words.length / 2);
                topInst.innerText = words.slice(0, mid).join(" ");
                bottomInst.innerText = words.slice(mid).join(" ");
            } else {
                topInst.innerText = text;
                bottomInst.innerText = "- - -";
            }
        }
    } else if (currentDisplayMode === "bottom") {
        
        bottomInst.innerText = text;
    } else {
        
        topInst.innerText = text;
    }
}

try {
    const saved = localStorage.getItem("the_button_highscore");
    if (saved) {
        highScore = parseInt(saved, 10);
        highscoreVal.innerText = highScore.toString().padStart(3, '0');
    }
} catch (e) {
    console.error("Storage error:", e);
}

retryBtn.addEventListener("click", () => {
    
    const hud = document.getElementById("gameover-hud");
    if (hud) {
        hud.style.opacity = "0";
        hud.style.pointerEvents = "none";
    }

    playerImg.style.display = "none";
    playerImg.classList.remove("running-away");
    playerImg.style.left = "";

    if (fallAnimationInterval) {
        clearInterval(fallAnimationInterval);
        fallAnimationInterval = null;
    }

    stageWrapper.classList.remove("state-gameover");
    stageWrapper.classList.remove("state-victory");
    stageWrapper.classList.remove("alarm-active");
    
    const boomOverlay = document.getElementById("boom-overlay");
    if (boomOverlay) boomOverlay.classList.remove("boom-active");

    gameBtn.disabled = false;
    isHolding = false;
    gameBtn.className = "ready";
    const btnSurface = gameBtn.querySelector(".button-surface");
    if (btnSurface) btnSurface.innerText = "";
    
    currentDisplayMode = "top";
    updateDisplayScreens("PRESS TO START", "var(--lcd-text)");
    scoreVal.innerText = "000";
    timerBar.style.width = "100%";
    timerBar.style.background = "var(--color-neon-green)";
    timerBar.style.boxShadow = "0 0 6px var(--color-neon-green)";
    gameActive = false;

    setTimeout(() => {
        const roomStage = document.getElementById("gameover-stage");
        if (roomStage) {
            roomStage.style.backgroundImage = "url('background.png')";
            roomStage.style.backgroundColor = "";
        }
        
        const trapdoorContainer = document.getElementById("trapdoor-container");
        if (trapdoorContainer) trapdoorContainer.style.display = "";

        playerImg.src = "image1.png";
        playerImg.style.display = "";

        if (hud) {
            hud.style.opacity = "";
            hud.style.pointerEvents = "";
        }
    }, 700);
});

function startGame() {
    score = 0;
    scoreVal.innerText = "000";
    gameActive = true;
    isHolding = false;
    challengeQueue = generateCampaignChallenges(); 
    synth.playStart();
    nextRound();

    lastFrameTime = performance.now();
    requestAnimationFrame(updateLoop);
}

function nextRound() {
    
    if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
    }

    maxTime = 4000;
    timeLeft = maxTime;
    tapCount = 0;
    isHolding = false;
    lastFrameTime = performance.now();

    gameBtn.className = "ready";

    const randPlacement = Math.random();
    if (randPlacement < 0.10) {
        currentDisplayMode = "split";   
    } else if (randPlacement < 0.55) {
        currentDisplayMode = "top";     
    } else {
        currentDisplayMode = "bottom";  
    }

    activeCommand = { ...challengeQueue[score] };

    const btnSurface = gameBtn.querySelector(".button-surface");
    if (btnSurface) {
        if (activeCommand.type === "emoji" && activeCommand.emoji) {
            btnSurface.innerText = activeCommand.emoji;
        } else {
            btnSurface.innerText = "";
        }
    }

    if (activeCommand.type === "color_match") {
        startColorCycle();
    } else {
        gameBtn.className = activeCommand.color;
        updateDisplayScreens(activeCommand.text, `var(--color-neon-${activeCommand.color})`);
    }
}

function startColorCycle() {
    const cycleColors = ["pink", "red", "yellow", "green", "blue"];
    let cycleIndex = 0;

    const rotateColor = () => {
        const activeColor = cycleColors[cycleIndex];
        targetColorState = activeColor;
        gameBtn.className = activeColor;
        
        updateDisplayScreens(activeCommand.text, `var(--color-neon-${activeCommand.color})`);
        
        cycleIndex = (cycleIndex + 1) % cycleColors.length;
    };

    rotateColor(); 

    cycleInterval = setInterval(rotateColor, 500);
}

gameBtn.addEventListener("mousedown", (e) => {
    if (!gameActive) {
        
        if (stageWrapper.classList.contains("state-gameover")) return;
        startGame();
        return;
    }
    handleButtonPress();
});

gameBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (!gameActive) {
        
        if (stageWrapper.classList.contains("state-gameover")) return;
        startGame();
        return;
    }
    handleButtonPress();
});

window.addEventListener("mouseup", () => {
    handleRelease();
});
window.addEventListener("touchend", () => {
    handleRelease();
});

function handleRelease() {
    if (gameActive && activeCommand && activeCommand.type === "hold" && isHolding) {
        isHolding = false;
        gameOver("failWrongTapCount"); 
    }
}

function handleButtonPress() {
    
    if (activeCommand.isNeutral) {
        synth.playBeep(880, "square", 0.06);
        return;
    }

    if (activeCommand.type === "hold") {
        isHolding = true;
        synth.playBeep(880, "square", 0.06);
        return;
    }

    if (activeCommand.type === "tap") {
        tapCount++;
        if (tapCount === activeCommand.req) {
            synth.playSuccess();
            triggerSuccess();
        } else if (tapCount > activeCommand.req) {
            gameOver("failWrongTapCount");
        } else {
            synth.playBeep(880, "square", 0.06);
        }
        return;
    }

    if (activeCommand.type === "screen_trap") {
        const effectiveReq = (currentDisplayMode === "bottom") ? activeCommand.req : 0;
        if (effectiveReq === 0) {
            gameOver("failTapOnDont");
        } else {
            tapCount++;
            if (tapCount === effectiveReq) {
                synth.playSuccess();
                triggerSuccess();
            } else if (tapCount > effectiveReq) {
                gameOver("failWrongTapCount");
            } else {
                synth.playBeep(880, "square", 0.06);
            }
        }
        return;
    }

    const hasArrayReq = Array.isArray(activeCommand.req);
    const reqZero = hasArrayReq ? activeCommand.req.includes(0) : (activeCommand.req === 0);

    if (reqZero) {
        
        gameOver("failTapOnDont");
    } else if (activeCommand.type === "color_match") {
        
        const targetColor = activeCommand.targetColor || "green";
        if (targetColorState === targetColor) {
            synth.playSuccess();
            triggerSuccess();
        } else {
            gameOver("failCycleTapWrong");
        }
    } else if (activeCommand.isGreaterThanEight || activeCommand.isGreaterThanZero) {
        
        tapCount++;
        synth.playBeep(880, "square", 0.06);
    } else {
        
        tapCount++;
        const allowedTargets = hasArrayReq ? activeCommand.req : [activeCommand.req];
        const maxReq = Math.max(...allowedTargets);

        if (tapCount > maxReq) {
            
            gameOver("failWrongTapCount");
        } else {
            synth.playBeep(880, "square", 0.06);

            if (activeCommand.isCountdown) {
                const remaining = maxReq - tapCount;
                updateDisplayScreens(`${remaining} PRESS REMAINING`, `var(--color-neon-${activeCommand.color})`);
            }
        }
    }
}

function triggerSuccess() {
    score++;
    scoreVal.innerText = score.toString().padStart(3, '0');

    if (score > highScore) {
        highScore = score;
        highscoreVal.innerText = highScore.toString().padStart(3, '0');
        try {
            localStorage.setItem("the_button_highscore", highScore);
        } catch (e) {
            console.error(e);
        }
    }

    if (score >= challengeQueue.length) {
        
        gameVictory();
        return;
    }

    nextRound();
}

function gameVictory() {
    gameActive = false;
    synth.playVictory();

    if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
    }

    gameBtn.disabled = true;

    const btnSurface = gameBtn.querySelector(".button-surface");
    if (btnSurface) btnSurface.innerText = "";

    const title = document.getElementById("gameover-title");
    title.innerText = "MISSION SUCCESS";
    title.style.color = "var(--color-neon-green)";
    title.style.textShadow = "0 0 10px rgba(57, 255, 20, 0.6)";
    
    const victoryQuotes = [
        "Your payment is in your account 💸",
        "Enemy doomed ☠️",
        "R.I.P. factory ⚰️",
        "I'm forced to say 'Congrats' 😒",
        "I know it was random guesses, I just can't prove it 🤨",
        "You received World Record of Memory instead of your payment 🤦‍♂️"
    ];
    const randomQuote = victoryQuotes[Math.floor(Math.random() * victoryQuotes.length)];
    document.getElementById("fail-ai-quote").innerText = `"${randomQuote}"`;
    retryBtn.innerText = "NEW MISSION";

    stageWrapper.classList.add("state-victory");

    const roomStage = document.getElementById("gameover-stage");
    roomStage.style.backgroundImage = "url('background.png')";

    playerImg.classList.remove("running-away");
    playerImg.style.left = "175px";
    playerImg.src = "image1.png";

    stageWrapper.classList.add("alarm-active");

    setTimeout(() => {
        let frame = 4;
        playerImg.src = "image4.png";
        playerImg.classList.add("running-away"); 
        
        if (fallAnimationInterval) clearInterval(fallAnimationInterval);
        fallAnimationInterval = setInterval(() => {
            frame = (frame === 4) ? 5 : 4;
            playerImg.src = `image${frame}.png`;
        }, 80); 
    }, 600);

    setTimeout(() => {
        
        if (fallAnimationInterval) {
            clearInterval(fallAnimationInterval);
            fallAnimationInterval = null;
        }

        stageWrapper.classList.remove("alarm-active");

        roomStage.style.backgroundImage = "none";
        roomStage.style.backgroundColor = "#000";
        const trapdoorContainer = document.getElementById("trapdoor-container");
        if (trapdoorContainer) trapdoorContainer.style.display = "none";

        const boomOverlay = document.getElementById("boom-overlay");
        boomOverlay.classList.add("boom-active");

        stageWrapper.classList.add("shake-screen-victory");
        setTimeout(() => stageWrapper.classList.remove("shake-screen-victory"), 1000);
    }, 1800);
}

function updateLoop(timestamp) {
    if (!gameActive) return;

    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (!(isTimerPaused && isDevMode)) {
        timeLeft -= delta;
    }

    const percent = Math.max(0, (timeLeft / maxTime) * 100);
    timerBar.style.width = `${percent}%`;

    if (percent < 30) {
        timerBar.style.background = "var(--led-red)";
        timerBar.style.boxShadow = "0 0 8px var(--led-red)";
    } else {
        timerBar.style.background = "var(--color-neon-green)";
        timerBar.style.boxShadow = "0 0 6px var(--color-neon-green)";
    }

    if (timeLeft <= 0) {
        
        if (activeCommand && activeCommand.isNeutral) {
            synth.playSuccess();
            triggerSuccess();
            requestAnimationFrame(updateLoop);
        } else if (activeCommand && activeCommand.type === "screen_trap") {
            const effectiveReq = (currentDisplayMode === "bottom") ? activeCommand.req : 0;
            if (effectiveReq === tapCount) {
                synth.playSuccess();
                triggerSuccess();
                requestAnimationFrame(updateLoop);
            } else {
                gameOver("failWrongTapCount");
            }
        } else if (activeCommand && activeCommand.type === "hold") {
            
            if (isHolding) {
                isHolding = false; 
                synth.playSuccess();
                triggerSuccess();
                requestAnimationFrame(updateLoop);
            } else {
                gameOver("failWrongTapCount");
            }
        } else if (activeCommand && activeCommand.req === 0) {
            
            synth.playSuccess();
            triggerSuccess();
            requestAnimationFrame(updateLoop);
        } else if (activeCommand && activeCommand.isGreaterThanEight) {
            
            if (tapCount > 8) {
                synth.playSuccess();
                triggerSuccess();
                requestAnimationFrame(updateLoop);
            } else {
                gameOver("failWrongTapCount");
            }
        } else if (activeCommand && activeCommand.isGreaterThanZero) {
            
            if (tapCount > 0) {
                synth.playSuccess();
                triggerSuccess();
                requestAnimationFrame(updateLoop);
            } else {
                gameOver("failWrongTapCount");
            }
        } else if (activeCommand && activeCommand.type !== "color_match") {
            
            const hasArrayReq = Array.isArray(activeCommand.req);
            const allowedTargets = hasArrayReq ? activeCommand.req : [activeCommand.req];
            
            if (allowedTargets.includes(tapCount)) {
                
                synth.playSuccess();
                triggerSuccess();
                requestAnimationFrame(updateLoop);
            } else {
                
                gameOver("failWrongTapCount");
            }
        } else {
            
            gameOver("failTimeOut");
        }
        return;
    }

    requestAnimationFrame(updateLoop);
}

function gameOver(failReason) {
    gameActive = false;
    synth.playBuzz();

    if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
    }

    const title = document.getElementById("gameover-title");
    title.innerText = "GAME OVER";
    title.style.color = "var(--led-red)";
    retryBtn.innerText = "REBOOT SYSTEM";

    playerImg.src = "image1.png";

    setTimeout(() => {
        let frame = 2;
        playerImg.src = "image2.png";
        
        if (fallAnimationInterval) clearInterval(fallAnimationInterval);
        fallAnimationInterval = setInterval(() => {
            frame = (frame === 2) ? 3 : 2;
            playerImg.src = `image${frame}.png`;
        }, 90); 
    }, 500);

    gameBtn.className = "ready";
    const btnSurface = gameBtn.querySelector(".button-surface");
    if (btnSurface) btnSurface.innerText = "";

    let quotes = [];

    if (failReason === "failTapOnDont") {
        quotes = [
            "I literally wrote DON'T / 0 presses. Reading is hard.",
            "Wait, did you think 0 meant tap?",
            "Impulse control: Zero.",
            "When the screen says 0, you do absolutely nothing."
        ];
    } else if (failReason === "failCycleTapWrong") {
        quotes = [
            "Wrong color glow! Read the target color.",
            "Are you colorblind, or just impatient?",
            "Missed the target color light!",
            "That was not the color I asked for."
        ];
    } else if (activeCommand) {
        if (activeCommand.type === "emoji") {
            quotes = [
                "You fell for the decoy emoji! I said letters in 'EMOJI' (which has 5 letters)!",
                "The word is 'E-M-O-J-I'. Why did you count the fruit/vegetable?",
                "Bitten by the decoy emoji trap. It's always 5 letters!",
                "Classic decoy trap. EMOJI has exactly 5 letters!"
            ];
        } else if (activeCommand.type === "math") {
            quotes = [
                "Basic arithmetic failed. Go back to primary school.",
                "Calculator error: Math under pressure is apparently too hard for you.",
                "Math equation failed. 1 + 1 = Game Over.",
                "You calculated the wrong answer."
            ];
        } else if (activeCommand.type === "shape") {
            quotes = [
                "Corner counting failed. Did you forget what shapes look like?",
                "A triangle has 3 corners. A square has 4. Count them next time!",
                "Geometry class was a long time ago, huh?",
                "Wrong corner calculation."
            ];
        } else if (activeCommand.type === "screen_trap") {
            quotes = [
                "It was on the TOP/SPLIT screen! Read the condition in Level 29!",
                "You pressed when it wasn't on the bottom screen. Alignment error.",
                "Position matters. Level 29 said BOTTOM screen only!",
                "Read where the text is. You got fooled by the screen placement!"
            ];
        }
    }

    if (quotes.length === 0) {
        if (failReason === "failTimeOut") {
            quotes = [
                "Time is up! 3 seconds expired.",
                "Did you fall asleep?",
                "Move those thumbs faster next time!"
            ];
        } else {
            quotes = [
                "Wrong number of clicks! Count in your mind.",
                "Can't count under pressure?",
                "Too many or too few clicks. Failed!"
            ];
        }
    }

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById("fail-ai-quote").innerText = `"${quote}"`;

    stageWrapper.classList.add("state-gameover");

    stageWrapper.classList.add("shake-screen");
    setTimeout(() => stageWrapper.classList.remove("shake-screen"), 300);
}

function fitGameToScreen() {
    const stage = document.getElementById("stage-wrapper");
    if (!stage) return;
    const padding = 16;
    const availWidth = window.innerWidth - padding;
    const availHeight = window.innerHeight - padding;
    const scale = Math.min(availWidth / 500, availHeight / 500, 1.2);
    document.documentElement.style.setProperty("--scale-factor", Math.max(0.1, scale));
}

window.addEventListener("resize", fitGameToScreen);
window.addEventListener("orientationchange", fitGameToScreen);
window.addEventListener("DOMContentLoaded", fitGameToScreen);
fitGameToScreen();
