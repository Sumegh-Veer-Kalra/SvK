let adPlaying = false;
let gameFrozen = false;

const gameStorage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, String(value)),
    removeItem: (key) => localStorage.removeItem(key)
};





const ball = document.getElementById('ball');
const gameArea = document.querySelector('.game-area');
const gameSurface = document.getElementById('gameSurface') || gameArea; 
const countdownOverlay = document.getElementById('countdownOverlay');


const pauseMenuOverlay = document.getElementById('pauseMenuOverlay');
const pauseScoreDisplay = document.getElementById('pauseScoreDisplay');
const resumeBtn = document.getElementById('resumeBtn');
const menuRestartBtn = document.getElementById('menuRestartBtn');

const settingsMenuOverlay = document.getElementById('settingsMenuOverlay');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

const sfxToggle = document.getElementById('sfxToggle');
const shakeToggle = document.getElementById('shakeToggle');



let sfxEnabled = gameStorage.getItem('sfxEnabled') !== 'false';
let shakeEnabled = gameStorage.getItem('shakeEnabled') !== 'false';



sfxToggle.checked = sfxEnabled;
shakeToggle.checked = shakeEnabled;

const gameOverOverlay = document.getElementById('gameOverOverlay');

let totalCoins = parseInt(gameStorage.getItem('totalCoins')) || 0;
let doubleCoinsUsed = false;   // track if Double Coins was used this run

const SLAM_SOUND_FILE = 'sfx/explosion.wav';
const JET_SOUND_FILE = 'sfx/jet_engine.mp3';  // for slam charge-up
const FAIL_SOUND_FILE = 'sfx/fail-sound-effect.mp3';   // <-- add this line

const SFX = (() => {
    let audioCtx = null;
    let slamAudio = null;
    let jetAudio = null;
    let jetDuckTimer = null;
    let failAudio = null;

    function init() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }

        if (!slamAudio) {
            slamAudio = new Audio(SLAM_SOUND_FILE);
            slamAudio.preload = 'auto';
        }
        if (!jetAudio) {
            jetAudio = new Audio(JET_SOUND_FILE);
            jetAudio.preload = 'auto';
            jetAudio.loop = true;
        }
        if (!failAudio) {
            failAudio = new Audio(FAIL_SOUND_FILE);
            failAudio.preload = 'auto';
        }
    }

    function click() {
        if (!sfxEnabled) return;
        init();
        const now = audioCtx.currentTime;
        const bufferSize = 0.02 * audioCtx.sampleRate;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);
        noise.stop(now + 0.05);
    }

    function jetStart() {
        if (!sfxEnabled) return;
        init();
        // Cancel any pending duck restoration
        if (jetDuckTimer) {
            clearTimeout(jetDuckTimer);
            jetDuckTimer = null;
        }
        // Restore full volume and play if paused
        if (jetAudio) {
            jetAudio.volume = 1.0;
            if (jetAudio.paused) {
                jetAudio.currentTime = 0;
                jetAudio.play().catch(() => {});
            }
        }
    }

    function jetStop() {
        if (jetDuckTimer) {
            clearTimeout(jetDuckTimer);
            jetDuckTimer = null;
        }
        if (jetAudio && !jetAudio.paused) {
            jetAudio.pause();
            jetAudio.currentTime = 0;
            jetAudio.volume = 1.0;     // reset for next time
        }
    }

    function slam() {
        if (!sfxEnabled) return;
        init();
        // Play explosion
        if (slamAudio) {
            slamAudio.currentTime = 0;
            slamAudio.play().catch(() => {});
        }
        // Duck the jet engine volume for 1 second
        if (jetAudio && !jetAudio.paused) {
            jetAudio.volume = 0.25;               // lower volume (adjust as needed)
            if (jetDuckTimer) clearTimeout(jetDuckTimer);
            jetDuckTimer = setTimeout(() => {
                if (jetAudio && !jetAudio.paused) {
                    jetAudio.volume = 1.0;        // restore after 1 second
                }
                jetDuckTimer = null;
            }, 1000);
        }
    }

    function countdownBeep(step) {
        if (!sfxEnabled) return;
        init();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';

        // step 5 → lowest & quietest
        if (step === 5) {
            osc.frequency.value = 350;
            gain.gain.setValueAtTime(0.1, now);
        } else if (step === 4) {
            osc.frequency.value = 550;
            gain.gain.setValueAtTime(0.2, now);
        } else if (step === 3) {
            osc.frequency.value = 750;
            gain.gain.setValueAtTime(0.3, now);
        } else if (step === 2) {
            osc.frequency.value = 950;
            gain.gain.setValueAtTime(0.4, now);
        } else if (step === 1) {
            osc.frequency.value = 1150;
            gain.gain.setValueAtTime(0.5, now);
        } else {                         // step 0 = "GO!"
            osc.frequency.value = 1350;
            gain.gain.setValueAtTime(0.6, now);
        }

        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    function fail() {
        if (!sfxEnabled) return;
        init();
        if (failAudio) {
            failAudio.currentTime = 0;
            failAudio.play().catch(() => {});
        }
    }
    function failStop() {
        if (failAudio && !failAudio.paused) {
            failAudio.pause();
            failAudio.currentTime = 0;
        }
    }
    return { click, slam, jetStart, jetStop, countdownBeep, fail, failStop };
})();

let currentScore = 0;
let lastBackgroundScore = 0;


let lastScorePhase = -1;

const bgLayer = document.getElementById('bgLayer');
if (bgLayer) {
    bgLayer.style.background = `
        radial-gradient(circle at 25% 15%, rgba(255,255,255,0.9) 1px, transparent 2px),
        radial-gradient(circle at 75% 35%, rgba(255,255,255,0.75) 1px, transparent 2px),
        radial-gradient(circle at 15% 65%, rgba(255,255,255,0.85) 1px, transparent 2px),
        radial-gradient(circle at 85% 78%, rgba(255,255,255,0.8) 1px, transparent 2px),
        linear-gradient(#0a0a1f 2px, transparent 2px)
    `;
    bgLayer.style.backgroundSize = '180px 180px, 230px 230px, 160px 160px, 200px 200px, 100% 70px';
}


let bgPhase = 0;

function updateBackground() {
    if (gameState !== "playing") return;
    const score = Math.floor((worldY - startY) / 100);
    const phase = score < 150 ? 0 : score < 200 ? 1 : score < 225 ? 2 : 3;
    if (phase === bgPhase) return;
    bgPhase = phase;

    const layer = document.getElementById('bgLayer');
    if (!layer) return;

    if (phase === 0) {
        
        layer.style.backgroundImage = `
            radial-gradient(circle at 25% 15%, rgba(255,255,255,0.9) 1px, transparent 2px),
            radial-gradient(circle at 75% 35%, rgba(255,255,255,0.75) 1px, transparent 2px),
            radial-gradient(circle at 15% 65%, rgba(255,255,255,0.85) 1px, transparent 2px),
            radial-gradient(circle at 85% 78%, rgba(255,255,255,0.8) 1px, transparent 2px),
            linear-gradient(#0a0a1f 2px, transparent 2px)
        `;
        layer.style.backgroundSize = '180px 180px, 230px 230px, 160px 160px, 200px 200px, 100% 70px';
    } else if (phase === 1) {
        
        layer.style.backgroundImage = 'linear-gradient(#0a0a1f, #1a2a4a)';
        layer.style.backgroundSize = '100% 100%';
    } else if (phase === 2) {
        
        layer.style.backgroundImage = 'linear-gradient(#1a2a4a, #4a9eff)';
        layer.style.backgroundSize = '100% 100%';
    } else {
        
        layer.style.backgroundImage = 'linear-gradient(#4a9eff, #87ceeb)';
        layer.style.backgroundSize = '100% 100%';
    }
}


const gameOverPhrases = {
    highSpeed: ["WHY MEEE!", "TOO FAST!", "MELTDOWN", "OVERHEATED", "LIGHTSPEED ENGINE CRASH", "ONE OF THOSE DAYS","JUST MISSED!", "SO CLOSE!", "DIDN'T SEE IT COMING", "OH, NO..."],
    breakableWall: ["BRICKED IT", "NEED MORE SLAM POWER", "SMASH FAIL", "ONE OF THOSE DAYS","JUST MISSED!", "SO CLOSE!", "DIDN'T SEE IT COMING"],
    staircase: ["TRIPPED UP", "STAIRCASE TO HEAVEN", "MISSED A STEP", "ONE OF THOSE DAYS","JUST MISSED!", "SO CLOSE!"],
    zigzag: ["ZAGGED INSTEAD OF ZIG", "CROSS-EYED RUN", "DIAGONAL DOOM", "ZIGGED INSTEAD OF ZAG" ,"JUST MISSED!", "SO CLOSE!"],
    doubleLane: ["CHOSE THE WRONG LANE", "TRAFFIC JAM", "SPLIT DECISION BLUNDER", "ONE OF THOSE DAYS","JUST MISSED!", "SO CLOSE!"],
    spiral: ["DIZZY CRASH", "SPUN OUT OF CONTROL", "VORTEX CAPTURE", "ONE OF THOSE DAYS","JUST MISSED!", "SO CLOSE!", "I FEEL DIZZY"],
    hourglass: ["TIME RAN OUT", "PINCHED AND SQUEEZED", "THE NECK NARROWED", "ONE OF THOSE DAYS","JUST MISSED!", "SO CLOSE!"],
    slalom: ["SKIED OFF TRACK", "GATE MISS", "SLALOM ERROR","JUST MISSED!", "SO CLOSE!"],
    diamond: ["ROUGH CUT SHARDS", "SHINE BLINDED", "PRESSURE CRUSHED", "JUST MISSED!", "SO CLOSE!", "I'M IN A DIAMOND"],
    normalWall: ["JUST MISSED!", "SO CLOSE!", "WACKED!", "WALL-BOMBED", "ONE OF THOSE DAYS", "DIDN'T SEE IT COMING", "FIRST TRY", "NO, JUST NO"]
};

let x = 170;
let worldY = 0;
let speedX = 0;
let isPaused = false;
let startY = 0;

let AREA_WIDTH = gameArea.clientWidth;
const BALL_SIZE = 40;


const WALL_ASSET = "obstacles/brick.png";           // normal obstacle
const BREAKABLE_ASSET = "obstacles/cracked_brick.png"; // breakable obstacle
const OBSTACLE_EXTRA = 10; 

const obstacleStyle = document.createElement('style');
obstacleStyle.textContent = `
    .wall-block {
        background: url('${WALL_ASSET}') repeat-x top / auto 30px;
    }
    .solid-breakable {
        background: url('${BREAKABLE_ASSET}') repeat-x top / auto 30px;
    }
`;
document.head.appendChild(obstacleStyle);

window.addEventListener('resize', () => {AREA_WIDTH = gameArea.clientWidth; if (x > AREA_WIDTH - BALL_SIZE) x = AREA_WIDTH - BALL_SIZE; });

let FALL_SPEED = 3;

let activeGameplayTime = 0;
let gameState = "menu_ai";
let aiTargetX = 170;
let slamProgress = 0;
let countdownETA = 0;

const TRANSITION_TIME = 0.5;

let isPressingSlam = false;
let pointsSinceLastBreakable = 0;
let nextBreakableTarget = Math.floor(Math.random() * 11) + 5;
let obstacles = [];
let nextSpawnY = 800;
let currentBaseSpeed = 3;
let lastFrameTime = Date.now();
let patternQueue = [];
let obstaclesUntilNextPattern = Math.floor(Math.random() * 13) + 3;
let normalCount = 0;
let targetForBreakable = Math.floor(Math.random() * 6) + 5;
let dynamicSpeedX = 5.0;


// Listen for the first real user interaction

const MENU_AI_SCRIPT = [
    { ballX:130, gapX:110, gapWidth:160, step:270 },
    { ballX:105, gapX: 80, gapWidth:150, step:250 },
    { ballX:165, gapX:165, gapWidth:150, step:250 },
    { ballX:130, gapX:110, gapWidth:160, step:260 },
    { ballX:165, breakable:true, step:370 },
    { ballX: 75, gapX: 20, gapWidth:150, step:235 },
    { ballX:265, gapX:210, gapWidth:150, step:235 },
    { ballX: 75, gapX: 20, gapWidth:150, step:235 },
    { ballX:265, gapX:210, gapWidth:150, step:235 },
    { ballX: 75, gapX: 20, gapWidth:150, step:235 },
    { ballX:265, gapX:210, gapWidth:150, step:235 },
    { ballX: 75, gapX: 20, gapWidth:150, step:235 },
    { ballX:265, gapX:210, gapWidth:150, step:235 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX:165, breakable:true, step:370 },
    { ballX: 50, isDouble:true, gapX1:30, gapWidth1:80, gapX2:270, gapWidth2:80, step:130 },
    { ballX: 50, isDouble:true, gapX1:30, gapWidth1:80, gapX2:270, gapWidth2:80, step:130 },
    { ballX: 50, isDouble:true, gapX1:30, gapWidth1:80, gapX2:270, gapWidth2:80, step:130 },
    { ballX:270, isDouble:true, gapX1:30, gapWidth1:80, gapX2:270, gapWidth2:80, step:130 },
    { ballX:270, isDouble:true, gapX1:30, gapWidth1:80, gapX2:270, gapWidth2:80, step:130 },
    { ballX:270, isDouble:true, gapX1:30, gapWidth1:80, gapX2:270, gapWidth2:80, step:130 },
    { ballX:150, gapX: 30, gapWidth:320, step:230 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX: 30, gapX:  0, gapWidth:100, step:105 },
    { ballX: 70, gapX: 40, gapWidth:100, step:105 },
    { ballX:110, gapX: 80, gapWidth:100, step:105 },
    { ballX:150, gapX:120, gapWidth:100, step:105 },
    { ballX:190, gapX:160, gapWidth:100, step:105 },
    { ballX:230, gapX:200, gapWidth:100, step:105 },
    { ballX:270, gapX:240, gapWidth:100, step:105 },
    { ballX:300, gapX:280, gapWidth:100, step:105 },
    
    { ballX:300, gapX:280, gapWidth:120, step:270 },
    { ballX:170, gapX:115, gapWidth:150, step:270 },

    { ballX:165, breakable:true, step:370 },
    { ballX:170, gapX:120, gapWidth:140, step:90 },
    { ballX:175, gapX:135, gapWidth:110, step:90 },
    { ballX:170, gapX:150, gapWidth: 80, step:90 },
    { ballX:170, gapX:160, gapWidth: 60, step:90 },
    { ballX:170, gapX:150, gapWidth: 80, step:90 },
    { ballX:175, gapX:135, gapWidth:110, step:90 },
    { ballX:170, gapX:120, gapWidth:140, step:90 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX: 75, gapX: 20, gapWidth:150, step:190 },
    { ballX:265, gapX:210, gapWidth:150, step:190 },
    { ballX: 75, gapX: 20, gapWidth:150, step:190 },
    { ballX:265, gapX:210, gapWidth:150, step:190 },
    { ballX: 75, gapX: 20, gapWidth:150, step:190 },
    { ballX:265, gapX:210, gapWidth:150, step:190 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX:165, breakable:true, step:370 },
    { ballX:170, gapX:140, gapWidth:100, step:95 },
    { ballX:205, gapX:175, gapWidth:100, step:95 },
    { ballX:230, gapX:200, gapWidth:100, step:95 },
    { ballX:215, gapX:185, gapWidth:100, step:95 },
    { ballX:175, gapX:150, gapWidth:100, step:95 },
    { ballX:125, gapX:100, gapWidth:100, step:95 },
    { ballX: 85, gapX: 55, gapWidth:100, step:95 },
    { ballX: 55, gapX: 30, gapWidth:100, step:95 },
    { ballX: 65, gapX: 40, gapWidth:100, step:95 },
    { ballX:105, gapX: 80, gapWidth:100, step:95 },
    { ballX:145, gapX:125, gapWidth:100, step:95 },
    { ballX:170, gapX:140, gapWidth:100, step:95 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX:150, gapX:160, gapWidth: 60, step:90 },
    { ballX:150, gapX:140, gapWidth:100, step:90 },
    { ballX:150, gapX:110, gapWidth:160, step:90 },
    { ballX:150, gapX: 80, gapWidth:220, step:90 },
    { ballX:150, gapX:110, gapWidth:160, step:90 },
    { ballX:150, gapX:140, gapWidth:100, step:90 },
    { ballX:150, gapX:160, gapWidth: 60, step:90 },
    { ballX:170, gapX:115, gapWidth:150, step:210 },
    { ballX:165, breakable:true, step:370 },
    { ballX:170, gapX:115, gapWidth:150, step:260 },
    { ballX:110, gapX: 60, gapWidth:140, step:240 },
    { ballX:230, gapX:180, gapWidth:140, step:240 },
    { ballX:170, gapX:115, gapWidth:150, step:260 },
];

let menuAiStep = 0;


function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (gameFrozen) {
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!isPaused) {
        if (gameState === "playing" || gameState === "menu_ai") {
            activeGameplayTime += deltaTime;
        }

        let currentBase;
        if (gameState === "playing") {
            currentBase = Math.min(6, currentBaseSpeed + (currentBaseSpeed * 0.015 * activeGameplayTime));
        } else {
            currentBase = currentBaseSpeed; 
        }

        
        let SLAM_SPEED_BOOST = 6.0 / currentBase;

        if (currentBase >= 6.0) {
            isPressingSlam = true; 
        }

        dynamicSpeedX = 5.0 + ((currentBase - 3.0) / 3.0);
        if (currentBase > 3.0) {
            
            dynamicSpeedX = 5.0 + ((currentBase - 3.0) / 3.0); 
        }

        if (gameState === "menu_ai" || gameState === "transition") {
            
            const upcoming = obstacles.find(ob => !ob.broken && (ob.y - worldY) > -20);
            const upcomingBreakable = obstacles.find(ob => !ob.broken && ob.breakable && (ob.y - worldY) > -20 && (ob.y - worldY) < 400);
            if (upcoming) {
                if (upcomingBreakable) {
                    aiTargetX = 165;
                    isPressingSlam = true;
                } else if (upcoming.breakable) {
                    aiTargetX = 165;
                    isPressingSlam = true;
                } else if (upcoming.isDouble) {
                    const c1 = upcoming.gapX1 + upcoming.gapWidth1 / 2 - 20;
                    const c2 = upcoming.gapX2 + upcoming.gapWidth2 / 2 - 20;
                    aiTargetX = Math.abs(x - c1) < Math.abs(x - c2) ? c1 : c2;
                    isPressingSlam = false;
                } else {
                    aiTargetX = upcoming.gapX + upcoming.gapWidth / 2 - 20;
                    isPressingSlam = false;
                }
            }
            const diff = aiTargetX - x;
            const step = 4.2 * Math.min(deltaTime * 60, 2.0); // Smoother sliding base speed and tighter cap
            if (Math.abs(diff) > step) {
                x += Math.sign(diff) * step;
            } else {
                x = aiTargetX;
            }
        }

        
        if (gameState === "transition") {
            countdownETA = Math.max(0, countdownETA - deltaTime);
            
        if (countdownETA > 0) {
            const newETA = Math.ceil(countdownETA);
            if (countdownOverlay.innerText !== String(newETA)) {
                countdownOverlay.innerText = newETA;
                SFX.countdownBeep(newETA);   // 3 → 2 → 1 – increasingly loud
            }
        } else {
            if (countdownOverlay.innerText !== "GO!") {
                countdownOverlay.innerText = "GO!";
                SFX.countdownBeep(0);        // final loud "GO!" beep
            }
        }

            if (obstacles.length === 0) {
                gameState = "playing";
                startY = worldY;
                activeGameplayTime = 0;
                isPressingSlam = false;
                countdownETA = 0;
                countdownOverlay.style.display = 'none';
                nextSpawnY = worldY + window.innerHeight + 300;
            }
        }

        
        if (isPressingSlam) {
            slamProgress = Math.min(1, slamProgress + (deltaTime / TRANSITION_TIME));
        } else {
            slamProgress = Math.max(0, slamProgress - (deltaTime / TRANSITION_TIME));
        }

        const isSlamming = slamProgress >= 1;
        if (slamProgress > 0) {
            ball.classList.add('slamming');
            SFX.jetStart();   // keeps calling – harmless if already playing
        } else {
            ball.classList.remove('slamming');
            SFX.jetStop();    // only stops when slam is fully released
        }

        
        let dynamicBoost = 1 + (Math.max(0, SLAM_SPEED_BOOST - 1) * slamProgress);
        FALL_SPEED = currentBase * dynamicBoost;
        
        worldY += FALL_SPEED * Math.min(deltaTime * 60, 2.5);

        if (gameState === "playing") {
            if (speedX !== 0) {
                x += Math.sign(speedX) * dynamicSpeedX * Math.min(deltaTime * 60, 5.0);
            }
            updateBackground();
        }

        
        if (x < 0) x = 0;
        if (x > AREA_WIDTH - BALL_SIZE) x = AREA_WIDTH - BALL_SIZE;

        const currentDip = 15 + (7 * slamProgress);
        const dynamicBallY = window.innerHeight * (currentDip / 100);

        
        ball.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(dynamicBallY)}px, 0)`;

        
        const currentScale = 1 - (0.1 * slamProgress);
        let shakeX = 0;
        let shakeY = 0;
        if (slamProgress > 0 && shakeEnabled) {
            const shakeIntensity = currentBase >= 6.0 ? 1.5 : 6;
            const maxShake = shakeIntensity * slamProgress; 
            shakeX = (Math.random() - 0.5) * 2 * maxShake;
            shakeY = (Math.random() - 0.5) * 2 * maxShake;
        }

        if (gameSurface) {
            gameSurface.style.transform = `translate3d(${Math.round(shakeX)}px, ${Math.round(shakeY)}px, 0)`;
        }

        const bgL = document.getElementById('bgLayer');
        if (bgL) {
            bgL.style.transform = `translate3d(0, ${Math.round(-worldY)}px, 0)`;
        }

        
        const ballHitbox = {
            x: x + 8,
            y: dynamicBallY + 8,
            width: 32,
            height: 32
        };

        const FIXED_ANCHOR = window.innerHeight * 0.15; 

        
        obstacles.forEach(ob => {
            if (!ob.broken) {
                let obScreenY = (ob.y - worldY) + FIXED_ANCHOR;

                if (ballHitbox.y < obScreenY + 30 && ballHitbox.y + ballHitbox.height > obScreenY) {
                    if (ob.breakable) {
                        if (isSlamming) {
                            ob.broken = true;
                            ob.element.style.display = 'none';
                            SFX.slam()
                        } else {
                            if (gameState === "playing") gameOver(ob); 
                        }
                    } else {
                        const ballRight = ballHitbox.x + ballHitbox.width;

                        if (ob.isDouble) {
                            if (ballHitbox.x < ob.gapX1 ||
                                (ballRight > ob.gapX1 + ob.gapWidth1 && ballHitbox.x < ob.gapX2) ||
                                ballRight > ob.gapX2 + ob.gapWidth2) {
                                if (gameState === "playing") gameOver(ob); 
                            }
                        } else {
                            if (ballHitbox.x < ob.gapX || ballRight > ob.gapX + ob.gapWidth) {
                                if (gameState === "playing") gameOver(ob); 
                            }
                        }
                    }
                }
            }
        });

        
        trailFrameCount++;
        if (activeTrail) {
            const spawnRate = activeTrail === 'lightning' ? 1 : activeTrail === 'binary' ? 2 : activeTrail === 'sparks' ? 1 : activeTrail === 'ice' ? 1 : activeTrail === 'smoke' ? 1 : activeTrail === 'void' ? 1 : activeTrail === 'galaxy' ? 1 : 2;
            if (trailFrameCount % spawnRate === 0) {
                spawnTrailParticle();
            }
        }

        if (gameState !== "transition" && worldY + window.innerHeight > nextSpawnY - 500) {
            spawnObstacle();
        }
    }

    renderObstacles();
    requestAnimationFrame(gameLoop);
}


function addBreather(isExit = false) {
    for (let i = 0; i < 2; i++) {
        patternQueue.push({ gapX: 115, gapWidth: 150, step: isExit ? 210 : 160, type: 'breather' });
    }
}

function createStaircase() {
    patternQueue.push({ gapX: 20,  gapWidth: 100, step: 100, type: 'staircase' });
    patternQueue.push({ gapX: 60,  gapWidth: 100, step: 100, type: 'staircase' });
    patternQueue.push({ gapX: 100, gapWidth: 100, step: 100, type: 'staircase' });
    patternQueue.push({ gapX: 140, gapWidth: 100, step: 100, type: 'staircase' });
    patternQueue.push({ gapX: 180, gapWidth: 100, step: 100, type: 'staircase' });
    patternQueue.push({ gapX: 220, gapWidth: 100, step: 100, type: 'staircase' });
    patternQueue.push({ gapX: 260, gapWidth: 100, step: 260, type: 'staircase_exit' });
}

function createZigZag() {
    addBreather();
    for (let i = 0; i < 8; i++) {
        patternQueue.push({ gapX: i % 2 === 0 ? 20 : 210, gapWidth: 150, step: 235, type: 'zigzag' });
    }
    addBreather(true);
}

function createDoubleLane() {
    addBreather();
    for (let i = 0; i < 6; i++) {
        patternQueue.push({ isDouble: true, gapX1: 30, gapWidth1: 80, gapX2: 270, gapWidth2: 80, step: 130, type: 'doubleLane' });
    }
    patternQueue.push({ gapX: 30, gapWidth: 320, step: 230, type: 'doubleLane_exit' });
    addBreather(true);
}

function createSpiral() {
    let offset = Math.random() * 1000;
    for (let i = 0; i < 12; i++) {
        let gx = (380 - 100) / 2 + Math.sin((i + offset) * 0.8) * 120;
        patternQueue.push({ gapX: gx, gapWidth: 100, step: 110, type: 'spiral' });
    }
    addBreather(true);
}

function createHourglass() {
    const steps = [140, 110, 80, 60, 80, 110, 140];
    steps.forEach(w => {
        patternQueue.push({ gapX: (380 - w) / 2, gapWidth: w, step: 90, type: 'hourglass' });
    });
    addBreather(true);
}

function createSlalom() {
    addBreather();
    let positions = [20, 210, 20, 210, 20, 210];
    positions.forEach(pos => {
        patternQueue.push({ gapX: pos, gapWidth: 150, step: 190, type: 'slalom' });
    });
    addBreather(true);
}

function createDiamond() {
    const widths = [60, 100, 160, 220, 160, 100, 60];
    widths.forEach(w => {
        patternQueue.push({ gapX: (380 - w) / 2, gapWidth: w, step: 90, type: 'diamond' });
    });
    addBreather(true);
}

function spawnObstacle() {
    let obstacleData = null;
    let customStep = 260; 

    
    if (gameState === "menu_ai") {
        menuAiStep++;
        const entry = MENU_AI_SCRIPT[menuAiStep % MENU_AI_SCRIPT.length];
        obstacleData = { ...entry };
        customStep = entry.step || 260;
        
        if (!obstacleData) return;
        let obEl = document.createElement('div');
        obEl.classList.add('obstacle');
        if (obstacleData.breakable) {
            obEl.classList.add('breakable-wall');
            let s = document.createElement('div');
            s.style.cssText = 'position:absolute;left:0;width:100%';
            s.classList.add('solid-breakable');
            obEl.appendChild(s);
        } else if (obstacleData.isDouble) {
            let midX = obstacleData.gapX1 + obstacleData.gapWidth1;
            let rightX = obstacleData.gapX2 + obstacleData.gapWidth2;
            [
                { left: 0,      width: obstacleData.gapX1 },
                { left: midX,   width: obstacleData.gapX2 - midX },
                { left: rightX, width: AREA_WIDTH - rightX }
            ].forEach(b => {
                let d = document.createElement('div');
                d.style.cssText = `position:absolute;left:${b.left}px;width:${b.width}px`;
                d.classList.add('wall-block');
                obEl.appendChild(d);
            });
        } else {
            let rightX = obstacleData.gapX + obstacleData.gapWidth;
            [
                { left: 0,      width: obstacleData.gapX },
                { left: rightX, width: AREA_WIDTH - rightX }
            ].forEach(b => {
                let d = document.createElement('div');
                d.style.cssText = `position:absolute;left:${b.left}px;width:${b.width}px`;
                d.classList.add('wall-block');
                obEl.appendChild(d);
            });
        }
        gameSurface.appendChild(obEl);
        obstacles.push({ y: nextSpawnY, element: obEl, ...obstacleData });
        nextSpawnY += customStep;
        return;
    }

    
    if (patternQueue.length > 0) {
        obstacleData = patternQueue.shift();
        if (obstacleData && obstacleData.step) customStep = obstacleData.step;
    } 
    
    else if (obstaclesUntilNextPattern <= 0) {
        const rand = Math.random();
        
        {
            
            if (rand < 0.143)      createStaircase();
            else if (rand < 0.286) createZigZag();
            else if (rand < 0.429) createDoubleLane();
            else if (rand < 0.572) createSpiral();
            else if (rand < 0.715) createHourglass();
            else if (rand < 0.858) createSlalom();
            else                   createDiamond();
        }
        
        obstaclesUntilNextPattern = Math.floor(Math.random() * 5) + 15; 
        
        
        pointsSinceLastBreakable += 5;
        
        obstacleData = patternQueue.shift();
        if (obstacleData && obstacleData.step) customStep = obstacleData.step;
    } 
    
    else {
        obstaclesUntilNextPattern--;
        
        
        pointsSinceLastBreakable += 1;
        
        let gapWidth = Math.max(BALL_SIZE * 2.5, 120 - (currentBaseSpeed * 2));
        let maxGapX = AREA_WIDTH - gapWidth;
        
        obstacleData = { 
            isDouble: false, 
            gapX: Math.random() * maxGapX, 
            gapWidth: gapWidth,
            breakable: false
        };
    }

    
    
    
    
    if (patternQueue.length === 0 && pointsSinceLastBreakable >= nextBreakableTarget) {
        obstacleData = {
            isDouble: false,
            gapX: AREA_WIDTH / 2, 
            gapWidth: 0, 
            breakable: true,
            step: 410 
        };
        
        pointsSinceLastBreakable = 0;
        nextBreakableTarget = Math.floor(Math.random() * 11) + 5; 
    }

    
    if (!obstacleData) return;

    
    
    if (obstacleData.type && currentBaseSpeed > 3.0) {
        let patternScale = 1 + ((currentBaseSpeed - 3.0) / 6.0); 
        customStep = Math.round(customStep * patternScale);
    }
    

    
    
    
    let obElement = document.createElement('div');
    obElement.classList.add('obstacle');
    
    if (obstacleData.breakable) {
        obElement.classList.add('breakable-wall'); 
        
        let solidBlock = document.createElement('div');
        solidBlock.style.position = 'absolute';
        solidBlock.style.left = '0px';
        solidBlock.style.width = '100%';
        solidBlock.classList.add('solid-breakable'); 
        
        obElement.appendChild(solidBlock);
    } else {
        if (obstacleData.isDouble) {
            let leftBlock = document.createElement('div');
            leftBlock.style.position = 'absolute'; leftBlock.style.left = '0px';
            leftBlock.style.width = obstacleData.gapX1 + 'px';
            leftBlock.classList.add('wall-block'); 
            
            let midBlock = document.createElement('div');
            midBlock.style.position = 'absolute';
            let midX = obstacleData.gapX1 + obstacleData.gapWidth1;
            midBlock.style.left = midX + 'px';
            midBlock.style.width = (obstacleData.gapX2 - midX) + 'px';
            midBlock.classList.add('wall-block');
            
            let rightBlock = document.createElement('div');
            rightBlock.style.position = 'absolute';
            let rightX = obstacleData.gapX2 + obstacleData.gapWidth2;
            rightBlock.style.left = rightX + 'px';
            rightBlock.style.width = (AREA_WIDTH - rightX) + 'px';
            rightBlock.classList.add('wall-block');
            
            obElement.appendChild(leftBlock);
            obElement.appendChild(midBlock);
            obElement.appendChild(rightBlock);
        } else {
            let leftBlock = document.createElement('div');
            leftBlock.style.position = 'absolute'; leftBlock.style.left = '0px';
            leftBlock.style.width = obstacleData.gapX + 'px';
            leftBlock.classList.add('wall-block');
            
            let rightBlock = document.createElement('div');
            rightBlock.style.position = 'absolute';
            let rightX = obstacleData.gapX + obstacleData.gapWidth;
            rightBlock.style.left = rightX + 'px';
            rightBlock.style.width = (AREA_WIDTH - rightX) + 'px';
            rightBlock.classList.add('wall-block');
            
            obElement.appendChild(leftBlock);
            obElement.appendChild(rightBlock);
        }
    }

    
    gameSurface.appendChild(obElement);
    obstacles.push({
        y: nextSpawnY,
        element: obElement,
        ...obstacleData
    });

    nextSpawnY += customStep;
}

function renderObstacles() {
    const ballOffset = window.innerHeight * 0.15;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let ob = obstacles[i];
        let screenY = (ob.y - worldY) + ballOffset;

        
        ob.element.style.transform = `translate3d(0, ${Math.round(screenY)}px, 0)`;

        if (screenY < -100) {
            ob.element.remove();
            obstacles.splice(i, 1);
        }
    }
}

function gameOver(hitObstacle) {
    
    isPaused = true;
    SFX.jetStop(); 
    gameState = "gameover";
    SFX.fail();   // play death sound
    
    const ballRect = ball.getBoundingClientRect();
    const areaRect = gameArea.getBoundingClientRect();
    
    const ballCenterX = (ballRect.left - areaRect.left) + (ballRect.width / 2);
    const ballCenterY = (ballRect.top - areaRect.top) + (ballRect.height / 2);

    
    gameOverOverlay.style.setProperty('--mask-x', ballCenterX + 'px');
    gameOverOverlay.style.setProperty('--mask-y', ballCenterY + 'px');

    
    gameOverOverlay.innerHTML = ''; 
    gameOverOverlay.style.display = 'block';

    
    const gapAngle = 75 + Math.random() * 30; 
    
    
    createTrapLine(ballCenterX, ballCenterY, gapAngle + 90, 55);
    createTrapLine(ballCenterX, ballCenterY, gapAngle + 180, 55);
    createTrapLine(ballCenterX, ballCenterY, gapAngle + 270, 55);

    
    if (!hitObstacle) {
        const currentDip = 15 + (7 * slamProgress);
        const ballTopScreen = window.innerHeight * (currentDip / 100);
        hitObstacle = obstacles.find(ob => {
            let obScreenY = (ob.y - worldY) + (window.innerHeight * 0.15);
            return ballTopScreen < obScreenY + 22 && ballTopScreen + 24 > obScreenY;
        });
    }

    let crashCategory = "normalWall";

    if (currentBaseSpeed >= 7.5) {
        crashCategory = "highSpeed"; 
    } else if (hitObstacle && hitObstacle.breakable) {
        crashCategory = "breakableWall";
    } else if (hitObstacle && hitObstacle.type) {
        let cleanType = hitObstacle.type.replace('_exit', '');
        if (gameOverPhrases[cleanType]) {
            crashCategory = cleanType;
        }
    }

    const selectedPool = gameOverPhrases[crashCategory] || gameOverPhrases.normalWall;
    const chosenPhrase = selectedPool[Math.floor(Math.random() * selectedPool.length)];

    const banner = document.createElement('div');
    banner.classList.add('trap-banner');
    banner.innerText = chosenPhrase;

    const calculatedWidth = Math.max(220, chosenPhrase.length * 13 + 30);
    banner.style.width = calculatedWidth + 'px';

    const bannerRad = gapAngle * (Math.PI / 180);
    const bannerDist = 62;
    const rawBannerX = ballCenterX + Math.cos(bannerRad) * bannerDist - (calculatedWidth / 2);
    const bannerY = ballCenterY + Math.sin(bannerRad) * bannerDist - 24;
    const bannerX = Math.max(4, Math.min(AREA_WIDTH - calculatedWidth - 4, rawBannerX));

    banner.style.left = bannerX + 'px';
    banner.style.top = bannerY + 'px';

    
    const expectedDeckHeight = window.innerHeight < 680 ? 240 : 450;
    const deckTop = window.innerHeight - expectedDeckHeight;
    const bannerHeight = window.innerHeight < 680 ? 36 : 48;
    const bannerBottom = bannerY + bannerHeight; 
    if (bannerBottom > deckTop) {
        banner.style.top = (deckTop - bannerHeight) + 'px';
    }

    const edgeThreshold = AREA_WIDTH * 0.25;
    let bannerTiltAngle;
    if (ballCenterX < edgeThreshold) {
        bannerTiltAngle = -(Math.random() * 10 + 5);
    } else if (ballCenterX > AREA_WIDTH - edgeThreshold) {
        bannerTiltAngle = Math.random() * 10 + 5;
    } else {
        bannerTiltAngle = Math.random() * 14 - 7;    
    }
    banner.style.setProperty('--angle', bannerTiltAngle + 'deg');
    banner.style.animationDelay = '0.3s';

    gameOverOverlay.appendChild(banner);

    const scoreText = document.createElement('h2');
    scoreText.classList.add('score-text');
    scoreText.innerHTML = `
        <div style="font-size:18px; margin-bottom:4px; opacity:0.9;">COINS/SCORE</div>
        <div style="font-size:42px; line-height:1;">${Math.floor((worldY - startY) / 100)}</div>
    `;
    
    const deckContainer = document.createElement('div');
    deckContainer.classList.add('control-deck');

    const row = document.createElement('div');
    row.classList.add('deck-row');

    
    const retryBtn = document.createElement('button');
    retryBtn.classList.add('deck-btn', 'retry');
    retryBtn.innerText = 'RE-TRY!';
    retryBtn.addEventListener('click', () => {
        SFX.click();
        resetGameEngine(false);
    });
    retryBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        SFX.click();
        resetGameEngine(false);
    });

    
    const homeBtn = document.createElement('button');
    homeBtn.classList.add('deck-btn', 'home');
    homeBtn.innerText = 'HOME';
    homeBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        SFX.click();
        resetGameEngine(true);
    });

    
    const reviveBtn = document.createElement('button');
    reviveBtn.classList.add('deck-btn', 'revive');
    reviveBtn.innerText = '📺 REVIVE';
    reviveBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        SFX.click();
        revivePlayer();
    });

    
    row.appendChild(homeBtn);
    row.appendChild(retryBtn);
    deckContainer.appendChild(scoreText);

    const doubleCoinsBtn = document.createElement('button');
    doubleCoinsBtn.classList.add('deck-btn', 'double-coins');
    doubleCoinsBtn.innerText = '📺 DOUBLE COINS';
    doubleCoinsBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (doubleCoinsUsed) return;
        SFX.click();
        doubleCoinsUsed = true;
        resetGameEngine(true);
        showCoinDoublingToast();
    });

    const doubleRow = document.createElement('div');
    doubleRow.classList.add('deck-row');

    doubleRow.appendChild(doubleCoinsBtn);

    deckContainer.appendChild(doubleRow);

    deckContainer.appendChild(row);
    deckContainer.appendChild(reviveBtn);
    
    gameOverOverlay.appendChild(deckContainer);
}

function showCoinDoublingToast() {
    const toast = document.createElement('div');
    toast.classList.add('coin-toast');
    const img = document.createElement('img');
    img.src = 'skins/Money_master.png';
    img.style.width = '32px';
    img.style.height = '32px';
    const text = document.createElement('span');
    text.innerText = 'COINS ARE DOUBLED';
    text.style.fontFamily = "'Courier New', Courier, monospace";
    text.style.fontSize = '20px';
    text.style.fontWeight = 'bold';
    toast.appendChild(img);
    toast.appendChild(text);
    document.body.appendChild(toast);
    // Force reflow for transition
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function resetGameEngine(goToMenu) {
    SFX.failStop();  
    if (gameState === "gameover") {
        const runScore = Math.floor((worldY - startY) / 100);
        if (runScore > 0) {
            // Double the reward if the player used the Double Coins button
            const reward = doubleCoinsUsed ? runScore * 2 : runScore;
            totalCoins += reward;
            gameStorage.setItem('totalCoins', totalCoins);
            updateHighScoreIfNeeded(runScore);    // high score still uses the original value
            updateStreakForToday();
            updateMenuStats();
        }
        doubleCoinsUsed = false;   // reset for next run
    }

    
    obstacles.forEach(ob => ob.element.remove());
    obstacles = [];
    patternQueue = [];
    
    
    gameOverOverlay.innerHTML = '';
    gameOverOverlay.style.display = 'none';

    
    x = 170;
    worldY = 0;
    speedX = 0;
    currentBaseSpeed = 3;
    activeGameplayTime = 0;
    pointsSinceLastBreakable = 0;
    slamProgress = 0;
    isPressingSlam = false;
    menuAiStep = 0;

    
    ball.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(window.innerHeight * 0.15)}px, 0)`;
    ball.classList.remove('slamming');

    if (goToMenu) {
        gameState = "menu_ai";
        isPaused = false;
        nextSpawnY = 800;
        
        document.getElementById('startMenu').classList.remove('slide-off');
        document.getElementById('startMenu').style.display = 'flex';
        document.getElementById('settingsBtn').classList.remove('slide-off');
        document.getElementById('slamButton').classList.remove('show');
        document.getElementById('mobilePauseButton').classList.remove('show');

        const bgL = document.getElementById('bgLayer');
        if (bgL) {
            bgL.style.backgroundImage = `radial-gradient(circle at 25% 15%, rgba(255,255,255,0.9) 1px, transparent 2px), radial-gradient(circle at 75% 35%, rgba(255,255,255,0.75) 1px, transparent 2px), radial-gradient(circle at 15% 65%, rgba(255,255,255,0.85) 1px, transparent 2px), radial-gradient(circle at 85% 78%, rgba(255,255,255,0.8) 1px, transparent 2px), linear-gradient(#0a0a1f 2px, transparent 2px)`;
            bgL.style.backgroundSize = '180px 180px, 230px 230px, 160px 160px, 200px 200px, 100% 70px';
            bgL.style.opacity = '1';
        }
        bgPhase = 0;
    } else {
        gameState = "menu_ai";
        isPaused = false;
        nextSpawnY = 800;
        requestAnimationFrame(() => { triggerGameStart(); });
    }
}

function revivePlayer() {
    SFX.failStop()
    gameOverOverlay.innerHTML = '';
    gameOverOverlay.style.display = 'none';
    
    
    obstacles.forEach(ob => {
        if (Math.abs(ob.y - worldY) < 350) {
            ob.element.remove();
            ob.broken = true; 
        }
    });
    obstacles = obstacles.filter(ob => !ob.broken);

    
    isPaused = false;
    gameState = "playing";
    isPressingSlam = false;
    slamProgress = 0;
    ball.classList.remove('slamming');
}

function createTrapLine(centerX, centerY, angle, distance) {
    const line = document.createElement('div');
    line.classList.add('trap-line');
    
    
    const width = 90 + Math.random() * 30; 
    line.style.width = width + 'px';
    
    
    const rad = angle * (Math.PI / 180);
    const lineX = centerX + Math.cos(rad) * distance - (width / 2);
    const lineY = centerY + Math.sin(rad) * distance - 10; 
    
    line.style.left = lineX + 'px';
    line.style.top = lineY + 'px';
    
    
    const tangentAngle = angle + 90 + (Math.random() * 30 - 15);
    
    
    line.style.setProperty('--angle', tangentAngle + 'deg');
    
    
    line.style.animationDelay = (Math.random() * 0.15) + 's';
    
    gameOverOverlay.appendChild(line);
}

function triggerGameStart(e) {
    if (e) e.preventDefault();

    if (gameState === "menu_ai") {
        document.getElementById('slamButton').classList.add('show');
        document.getElementById('mobilePauseButton').classList.add('show');
        document.getElementById('settingsBtn').classList.add('slide-off');

        const menu = document.getElementById('startMenu');
        menu.classList.add('slide-off');

        setTimeout(() => {
            menu.style.display = 'none';
        }, 600);

        const ballScreenY = window.innerHeight * 0.15;

        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let ob = obstacles[i];
            let obScreenY = (ob.y - worldY) + ballScreenY;

            if (obScreenY > window.innerHeight) {
                ob.element.remove();
                obstacles.splice(i, 1);
            }
        }

        
        
        if (obstacles.length > 0) {
            let lowestOb = obstacles.reduce((max, ob) => ob.y > max.y ? ob : max, obstacles[0]);
            let currentObScreenY = (lowestOb.y - worldY) + ballScreenY;
            
            
            let distanceToClear = currentObScreenY + 40; 
            
            if (distanceToClear > 0) {
                
                let pixelsPerSecond = currentBaseSpeed * 60; 
                countdownETA = distanceToClear / pixelsPerSecond;
            } else {
                countdownETA = 0;
            }
        } else {
            countdownETA = 0;
        }

        
        if (countdownETA > 0) {
            countdownOverlay.style.display = 'block';
            countdownOverlay.innerText = Math.ceil(countdownETA);
        }

        gameState = "transition";
    }
}

function startGameWithAd() {
    SFX.click();
    triggerGameStart();
}

document.getElementById('playButton').addEventListener('click', startGameWithAd);
document.getElementById('playButton').addEventListener('touchstart', (e) => { e.preventDefault(); startGameWithAd(); });

function togglePauseGame() {
    
    if (gameState !== "playing") return;

    isPaused = !isPaused;

    if (isPaused) {
        pauseScoreDisplay.innerText = Math.floor((worldY - startY) / 100);
        pauseMenuOverlay.style.display = 'flex';
    } else {
        pauseMenuOverlay.style.display = 'none';
    }
}


function handlePauseButtonInteraction(e) {
    e.stopPropagation();
    e.preventDefault();
    togglePauseGame();
}

document.getElementById('mobilePauseButton').addEventListener('pointerdown', (e) => {
    SFX.click();
    handlePauseButtonInteraction(e);
});


resumeBtn.addEventListener('click', () => {
    SFX.click();
    togglePauseGame();
});

menuRestartBtn.addEventListener('click', () => {
    SFX.click();

    setTimeout(() => {
        location.reload();
    }, 80); // small delay lets sound play
});

window.addEventListener('keydown', (e) => {
    if (adPlaying) return;

    if (e.repeat) return;
    
    if (e.code === 'KeyP') {
        SFX.click();
        togglePauseGame(); 
        return;
    }

    if (gameState !== "playing" || isPaused) return;

    if (e.code === 'Space') {
        isPressingSlam = true;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        speedX = -1;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        speedX = 1;
    }
});

window.addEventListener('keyup', (e) => {
    if (adPlaying) return;

    if (gameState !== "playing" || isPaused) return;

    if (e.code === 'Space') isPressingSlam = false;
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && speedX === -1) {
        speedX = 0;
    }
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && speedX === 1) {
        speedX = 0;
    }
});

window.addEventListener('mousedown', (e) => {
    if (gameState !== "playing" || isPaused) return;
    
    let activeSpeed = (typeof dynamicSpeedX !== 'undefined') ? dynamicSpeedX : 5;
    speedX = e.button === 0 ? -activeSpeed : activeSpeed;
});

window.addEventListener('mouseup', () => {
    speedX = 0;
});

let moveTouchId = null;

window.addEventListener('touchstart', (e) => {
    if (adPlaying) return;
    if (gameState !== "playing" || isPaused) return;
    
    for (let t of e.changedTouches) {
        const targetEl = document.elementFromPoint(t.clientX, t.clientY);
        if (targetEl && targetEl.id === 'slamButton') continue;
        moveTouchId = t.identifier;
        let activeSpeed = (typeof dynamicSpeedX !== 'undefined') ? dynamicSpeedX : 5;
        speedX = t.clientX < window.innerWidth / 2 ? -activeSpeed : activeSpeed;
        break;
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    for (let t of e.changedTouches) {
        if (t.identifier === moveTouchId) {
            speedX = 0;
            moveTouchId = null;
            break;
        }
    }
});

document.getElementById('slamButton').addEventListener('touchstart', (e) => {
    e.stopPropagation();
    if (gameState !== "playing" || isPaused) return;
    isPressingSlam = true;
});

document.getElementById('slamButton').addEventListener('touchend', (e) => {
    e.stopPropagation();
    if (gameState !== "playing") return;
    isPressingSlam = false;
});

document.getElementById('slamButton').addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (gameState !== "playing" || isPaused) return;
    isPressingSlam = true;
});

document.getElementById('slamButton').addEventListener('mouseup', (e) => {
    e.stopPropagation();
    if (gameState !== "playing") return;
    isPressingSlam = false;
});


sfxToggle.addEventListener('change', (e) => { 
    SFX.click();
    sfxEnabled = e.target.checked; 
    gameStorage.setItem('sfxEnabled', sfxEnabled);
});

shakeToggle.addEventListener('change', (e) => { 
    SFX.click();
    shakeEnabled = e.target.checked; 
    gameStorage.setItem('shakeEnabled', shakeEnabled);
});

function openSettingsMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    settingsMenuOverlay.style.display = 'flex';
}

function closeSettingsMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setTimeout(() => {
        settingsMenuOverlay.style.display = 'none';
    }, 50);
}
document.getElementById('settingsBtn').addEventListener('click', () => {
    SFX.click();
    openSettingsMenu();
});

document.getElementById('settingsBtn').addEventListener('touchstart', () => {
    SFX.click();
    openSettingsMenu();
});

closeSettingsBtn.addEventListener('click', () => {
    SFX.click();
    closeSettingsMenu();
});

closeSettingsBtn.addEventListener('pointerdown', () => {
    SFX.click();
    closeSettingsMenu();
});




const skinStyleSheet = document.createElement("style");
skinStyleSheet.innerText = `
    /* Live Game Ball Texture Mapping */
    #ball::before { 
        background-image: var(--skin-image) !important; 
        background-size: cover !important;
        background-position: center !important;
        background-color: transparent !important;
        border-radius: 50%;
    }

    /* Showroom Preview Sprite Auto-Layout (Seated right above your 135px floor shadow) */
    #srSkinPreview {
        position: absolute;
        bottom: 165px; 
        left: 50%;
        transform: translateX(-50%) scale(1);
        width: 150px;
        height: 150px;
        object-fit: contain;
        z-index: 5;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
    }
`;
document.head.appendChild(skinStyleSheet);


const SKINS_DB = [
    { id: "default", name: "Meteor (Default)", cost: 0, image: "skins/meteor.png" }, 
    { id: "fb", name: "Football", cost: 100, image: "skins/football.png" },
    { id: "p", name: "PIZZA", cost: 175, image: "skins/pizza.png" },     
    { id: "tp", name: "TOPINGS PIZZA", cost: 250, image: "skins/topings_pizza.png" }, 
    { id: "🍩", name: "DONUT", cost: 350, image: "skins/donut.png" }, 
    { id: "og", name: "Orange", cost: 350, image: "skins/orange.png" },
    { id: "money", name: "MONEY MASTER", cost: 750, image: "skins/Money_master.png" },   
    { id: "pc", name: "Plasma Chamber", cost: 1100, image: "skins/Plasma_Chamber.png" },         
    { id: "dm", name: "Disco", cost: 1450, image: "skins/cosmic_disco.png" },
    { id: "cd", name: "Galaxy", cost: 1900, image: "skins/dark_matter.png" } 
];

const TRAILS_DB = [
    { id: "sparks",     name: "Sparks",     cost: 100  },
    { id: "smoke",      name: "Smoke",      cost: 175  },
    { id: "fire",       name: "Fire",       cost: 350  },
    { id: "ice",        name: "Ice",        cost: 500  },
    { id: "rainbow",    name: "Rainbow",    cost: 750  },
    { id: "void",       name: "Void",       cost: 1000 },
    { id: "neon",       name: "Neon",       cost: 1250 },
    { id: "confetti",   name: "Confetti",   cost: 1500 },
    { id: "bubbles",    name: "Bubbles",    cost: 1750 },
    { id: "lightning",  name: "Lightning",  cost: 2000 },
    { id: "galaxy",     name: "Galaxy",     cost: 2500 },
    { id: "binary",     name: "Binary",     cost: 3500 },
];

let unlockedTrails = JSON.parse(gameStorage.getItem('unlockedTrails')) || [];
let activeTrail = gameStorage.getItem('activeTrail') || null;
let currentTrailIndex = 0;

function updateTrailsShowroomUI() {
    const trail = TRAILS_DB[currentTrailIndex];
    if (!trail) return;

    const nameEl = document.getElementById('trSkinName');
    const coinEl = document.getElementById('trCoinText');
    const actionBtn = document.getElementById('trActionBtn');

    if (nameEl) nameEl.innerText = trail.name;
    if (coinEl) coinEl.innerText = String(totalCoins).padStart(4, '0');

    startTrailPreview(trail.id);

    if (actionBtn) {
        if (activeTrail === trail.id) {
            actionBtn.innerText = "EQUIPPED";
            actionBtn.style.backgroundColor = "#666666";
            actionBtn.style.color = "#aaaaaa";
            actionBtn.style.cursor = "default";
        } else if (unlockedTrails.includes(trail.id)) {
            actionBtn.innerText = "EQUIP";
            actionBtn.style.backgroundColor = "#00ffcc";
            actionBtn.style.color = "#000000";
            actionBtn.style.cursor = "pointer";
        } else {
            actionBtn.innerText = `BUY ${trail.cost}`;
            actionBtn.style.backgroundColor = "#ff5500";
            actionBtn.style.color = "#ffffff";
            actionBtn.style.cursor = "pointer";
        }
    }
}

function handleTrailActionBtn(e) {
    SFX.click();

    if (e) e.preventDefault();
    const trail = TRAILS_DB[currentTrailIndex];
    if (!trail) return;

    if (activeTrail === trail.id) return;

    if (unlockedTrails.includes(trail.id)) {
        activeTrail = trail.id;
        localStorage.setItem('activeTrail', activeTrail);
        updateTrailsShowroomUI();
    } else {
        if (totalCoins >= trail.cost) {
            totalCoins -= trail.cost;
            gameStorage.setItem('totalCoins', totalCoins);
            unlockedTrails.push(trail.id);
            gameStorage.setItem('unlockedTrails', JSON.stringify(unlockedTrails));
            // Happytime: first trail purchase
            if (unlockedTrails.length === 1)
            // Happytime: most costly trail (Binary, cost 3500)
            if (trail.id === 'binary')
            activeTrail = trail.id;
            localStorage.setItem('activeTrail', activeTrail);
            updateTrailsShowroomUI();
        } else {
            const actionBtn = document.getElementById('trActionBtn');
            if (actionBtn) {
                actionBtn.innerText = "NO COINS!";
                actionBtn.style.backgroundColor = "#ff3333";
                setTimeout(() => updateTrailsShowroomUI(), 800);
            }
        }
    }
}

function navigateTrailsShowroom(direction) {
    SFX.click()
    if (direction === 'left') {
        currentTrailIndex = (currentTrailIndex - 1 + TRAILS_DB.length) % TRAILS_DB.length;
    } else {
        currentTrailIndex = (currentTrailIndex + 1) % TRAILS_DB.length;
    }
    updateTrailsShowroomUI();
}

function openTrailsMenu() {
    SFX.click();

    const activeIdx = TRAILS_DB.findIndex(t => t.id === activeTrail);
    if (activeIdx !== -1) currentTrailIndex = activeIdx;
    updateTrailsShowroomUI();
    const el = document.getElementById('trailsShowroom');
    if (el) {
        el.style.display = 'flex';
        requestAnimationFrame(() => el.classList.add('open'));
    }
}

function closeTrailsMenu() {
    SFX.click();

    stopTrailPreview();
    const el = document.getElementById('trailsShowroom');
    if (el) {
        el.classList.remove('open');
        setTimeout(() => el.style.display = 'none', 350);
    }
}

let unlockedSkins = JSON.parse(gameStorage.getItem('unlockedSkins'));
if (!unlockedSkins || !Array.isArray(unlockedSkins) || unlockedSkins.length === 0) {
    unlockedSkins = ["default"]; 
    gameStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
}

let activeSkin = gameStorage.getItem('activeSkin');
if (!activeSkin) {
    activeSkin = "default"; 
    gameStorage.setItem('activeSkin', activeSkin);
}

let currentSkinIndex = 0;


const skinsShowroom = document.getElementById('skinsShowroom');
const skinsBtn = document.getElementById('skinsBtn');
const closeSkinsBtn = document.getElementById('closeSkinsBtn');
const srActiveSkinName = document.getElementById('srActiveSkinName');
const srNavLeft = document.getElementById('srNavLeft');
const srNavRight = document.getElementById('srNavRight');
const srActionBtn = document.getElementById('srActionBtn');


let srSkinPreview = document.getElementById('srSkinPreview');
if (!srSkinPreview) {
    srSkinPreview = document.createElement('img');
    srSkinPreview.id = 'srSkinPreview';
    srSkinPreview.alt = 'Skin Preview';
    const stageContainer = document.querySelector('.sr-stage');
    if (stageContainer) {
        
        const floorShadow = document.querySelector('.sr-floor-shadow');
        stageContainer.insertBefore(srSkinPreview, floorShadow);
    }
}


function applyActiveSkinStyle() {
    if (!ball) return;
    const currentSkin = SKINS_DB.find(s => s.id === activeSkin);
    if (currentSkin) {
        ball.style.setProperty('--skin-image', `url('${currentSkin.image}')`);
    }
}


function updateSkinsShowroomUI() {
    const currentSkin = SKINS_DB[currentSkinIndex];
    if (!currentSkin) return;

    
    if (srActiveSkinName) {
        srActiveSkinName.innerText = currentSkin.name;
    }

    
    const coinTextElement = document.getElementById('srCoinText');
    if (coinTextElement) {
        coinTextElement.innerText = String(totalCoins).padStart(4, '0');
    }

    
    if (srSkinPreview) {
        srSkinPreview.src = currentSkin.image;
        srSkinPreview.style.transform = 'translateX(-50%) scale(1.15)';
        setTimeout(() => {
            srSkinPreview.style.transform = 'translateX(-50%) scale(1)';
        }, 120);
    }

    
    if (srActionBtn) {
        if (activeSkin === currentSkin.id) {
            srActionBtn.innerText = "EQUIPPED";
            srActionBtn.style.backgroundColor = "#666666";
            srActionBtn.style.color = "#aaaaaa";
            srActionBtn.style.cursor = "default";
        } else if (unlockedSkins.includes(currentSkin.id)) {
            srActionBtn.innerText = "EQUIP";
            srActionBtn.style.backgroundColor = "#00ffcc";
            srActionBtn.style.color = "#000000";
            srActionBtn.style.cursor = "pointer";
        } else {
            srActionBtn.innerText = `BUY ${currentSkin.cost}`;
            srActionBtn.style.backgroundColor = "#ff5500";
            srActionBtn.style.color = "#ffffff";
            srActionBtn.style.cursor = "pointer";
        }
    }
}


function handleActionBtnInteraction(e) {
    SFX.click();
    if (e) e.preventDefault();
    const currentSkin = SKINS_DB[currentSkinIndex];
    if (!currentSkin) return;

    if (activeSkin === currentSkin.id) return;

    
    if (unlockedSkins.includes(currentSkin.id)) {
        activeSkin = currentSkin.id;
        gameStorage.setItem('activeSkin', activeSkin);
        applyActiveSkinStyle();
        updateSkinsShowroomUI();
    } 
    
    else {
        if (totalCoins >= currentSkin.cost) {
            totalCoins -= currentSkin.cost;
            localStorage.setItem('totalCoins', totalCoins);
            
            unlockedSkins.push(currentSkin.id);
            localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
            // Happytime: first skin purchase (default is always unlocked, so length 2 = first buy)
            if (unlockedSkins.length === 2)
            // Happytime: most costly skin (Cosmic Disco, cost 2500)
            if (currentSkin.id === 'cd')
            
            activeSkin = currentSkin.id;
            localStorage.setItem('activeSkin', activeSkin);
            
            applyActiveSkinStyle();
            updateSkinsShowroomUI();
        } else {
            
            if (srActionBtn) {
                srActionBtn.innerText = "NO COINS!";
                srActionBtn.style.backgroundColor = "#ff3333";
                srActionBtn.style.color = "#ffffff";
                
                setTimeout(() => {
                    updateSkinsShowroomUI();
                }, 800);
            }
        }
    }
}


function navigateShowroom(direction) {
    SFX.click();
    if (direction === 'left') {
        currentSkinIndex = (currentSkinIndex - 1 + SKINS_DB.length) % SKINS_DB.length;
    } else {
        currentSkinIndex = (currentSkinIndex + 1) % SKINS_DB.length;
    }
    updateSkinsShowroomUI();
}


function openSkinsMenu() {
    SFX.click();
    const activeIdx = SKINS_DB.findIndex(s => s.id === activeSkin);
    if (activeIdx !== -1) currentSkinIndex = activeIdx;

    updateSkinsShowroomUI();
    skinsShowroom.style.display = 'flex';
    
    requestAnimationFrame(() => {
        skinsShowroom.classList.add('open');
    });
}

function closeSkinsMenu() {
    SFX.click();
    skinsShowroom.classList.remove('open');
    
    setTimeout(() => {
        skinsShowroom.style.display = 'none';
    }, 350);
}

skinsBtn.addEventListener('click', openSkinsMenu);
skinsBtn.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    openSkinsMenu(); 
});

const trailsBtn = document.getElementById('trailsBtn');
if (trailsBtn) {
    trailsBtn.addEventListener('click', openTrailsMenu);
    trailsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); openTrailsMenu(); });
}

closeSkinsBtn.addEventListener('click', closeSkinsMenu);
closeSkinsBtn.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    closeSkinsMenu(); 
});

document.getElementById('closeTrailsBtn').addEventListener('click', closeTrailsMenu);
document.getElementById('closeTrailsBtn').addEventListener('touchstart', (e) => { e.preventDefault(); closeTrailsMenu(); });

document.getElementById('trNavLeft').addEventListener('click', () => navigateTrailsShowroom('left'));
document.getElementById('trNavLeft').addEventListener('touchstart', (e) => { e.preventDefault(); navigateTrailsShowroom('left'); });

document.getElementById('trNavRight').addEventListener('click', () => navigateTrailsShowroom('right'));
document.getElementById('trNavRight').addEventListener('touchstart', (e) => { e.preventDefault(); navigateTrailsShowroom('right'); });

document.getElementById('trActionBtn').addEventListener('click', handleTrailActionBtn);
document.getElementById('trActionBtn').addEventListener('touchstart', handleTrailActionBtn);

srNavLeft.addEventListener('click', () => navigateShowroom('left'));
srNavLeft.addEventListener('touchstart', (e) => { e.preventDefault(); navigateShowroom('left'); });

srNavRight.addEventListener('click', () => navigateShowroom('right'));
srNavRight.addEventListener('touchstart', (e) => { e.preventDefault(); navigateShowroom('right'); });

srActionBtn.addEventListener('click', handleActionBtnInteraction);
srActionBtn.addEventListener('touchstart', handleActionBtnInteraction);


const FAKE_NAMES = [
    "xX_Bl4ze_Xx","NovaSurge","DropKing99","IronFalcon","ZeroGravity",
    "SlipStream","VoidRunner","CrashLord","BlazeWulf","PixelReaper",
    "NeonDrift","ThunderBolt","MeteorManiac","DarkPulse","SonicRush",
    "CryptoFall","GravityBend","PhantomFall","RiftWalker","StormDrop",
    "ArcaneBlitz","LunarCrash","NightFury","ByteSmash","LazerEdge",
    "CobaltRush","InfernoX","HyperDrop","SpectralX","TurboFall",
    "CelestialQ","FluxRider","QuasarBoy","NebulaBoy","AtomSmash",
    "GlitchKing","VortexDude","PlasmaBolt","ChromeDash","IceFracture",
    "SolarFlare","BinaryBob","GhostDrop","NanoBlitz","EchoFall",
    "ApexPrey","CrystalBal","ObsidianX","TitanFall1","WarpZone99"
];

function seedRandom(seed) {
    
    let s = seed >>> 0;
    return function() {
        s += 0x6D2B79F5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function generateFakePlayers() {
    const seed = 20250612; 
    const rng = seedRandom(seed);
    const players = [];
    for (let i = 0; i < 49; i++) {
        
        let score;
        const tier = rng();
        if (tier < 0.06)       score = 0;
        else if (tier < 0.25)  score = Math.floor(rng() * 50) + 1;
        else if (tier < 0.60)  score = Math.floor(rng() * 400) + 50;
        else if (tier < 0.85)  score = Math.floor(rng() * 600) + 450;
        else                   score = Math.floor(rng() * 800) + 1000;

        
        const streak = Math.floor(Math.pow(rng(), 2) * 40) + 1;

        players.push({ name: FAKE_NAMES[i], score, streak, fake: true });
    }
    return players;
}

const FAKE_SCORE_DAILY_COUNTS = {
    hold: 20,
    smallRise: 15,
    bigRise: 14
};

const FAKE_STREAK_DAILY_COUNTS = {
    increase: 30,
    hold: 12,
    reset: 7
};

function dateSeed(dateLabel, salt) {
    let seed = 0;
    const input = `${dateLabel}:${salt}`;
    for (let i = 0; i < input.length; i++) {
        seed = Math.imul(seed ^ input.charCodeAt(i), 2654435761);
    }
    return seed >>> 0;
}

function shuffledFakePlayerIndexes(rng) {
    const indexes = Array.from({ length: 49 }, (_, i) => i);
    for (let i = indexes.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    return indexes;
}

function updateFakePlayersForToday() {
    const today = new Date().toDateString();
    if (gameStorage.getItem('fakePlayersLastProgressDate') === today) return;

    fakePlayers = fakePlayers.map((player) => ({
        ...player,
        score: Number.isFinite(Number(player.score)) ? Math.max(0, Math.floor(Number(player.score))) : 0,
        streak: Number.isFinite(Number(player.streak)) ? Math.max(0, Math.floor(Number(player.streak))) : 0,
        fake: true
    }));

    const scoreRng = seedRandom(dateSeed(today, 'fake-score-progress'));
    const scoreOrder = shuffledFakePlayerIndexes(scoreRng);
    const smallStart = FAKE_SCORE_DAILY_COUNTS.hold;
    const bigStart = smallStart + FAKE_SCORE_DAILY_COUNTS.smallRise;

    scoreOrder.slice(smallStart, bigStart).forEach((index) => {
        fakePlayers[index].score += Math.floor(scoreRng() * 21) + 10;
    });

    scoreOrder.slice(bigStart, bigStart + FAKE_SCORE_DAILY_COUNTS.bigRise).forEach((index) => {
        fakePlayers[index].score += Math.floor(scoreRng() * 41) + 30;
    });

    const streakRng = seedRandom(dateSeed(today, 'fake-streak-progress'));
    const streakOrder = shuffledFakePlayerIndexes(streakRng);
    const holdStart = FAKE_STREAK_DAILY_COUNTS.increase;
    const resetStart = holdStart + FAKE_STREAK_DAILY_COUNTS.hold;

    streakOrder.slice(0, holdStart).forEach((index) => {
        fakePlayers[index].streak += 1;
    });

    streakOrder.slice(resetStart, resetStart + FAKE_STREAK_DAILY_COUNTS.reset).forEach((index) => {
        fakePlayers[index].streak = 0;
    });

    gameStorage.setItem('fakePlayers', JSON.stringify(fakePlayers));
    gameStorage.setItem('fakePlayersLastProgressDate', today);
}


let fakePlayers = JSON.parse(gameStorage.getItem('fakePlayers'));
if (!fakePlayers || fakePlayers.length !== 49) {
    fakePlayers = generateFakePlayers();
    gameStorage.setItem('fakePlayers', JSON.stringify(fakePlayers));
}
updateFakePlayersForToday();


let playerHighScore = parseInt(gameStorage.getItem('playerHighScore')) || 0;
let playerStreak = parseInt(gameStorage.getItem('playerStreak')) || 0;
let playerBestStreak = parseInt(gameStorage.getItem('playerBestStreak')) || playerStreak;
let lastScore = parseInt(gameStorage.getItem('lastScore')) || 0;
let lastPlayedDate = gameStorage.getItem('lastPlayedDate') || null;

function updateStreakForToday() {
    const today = new Date().toDateString();
    if (lastPlayedDate === today) return; 

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toDateString();

    if (lastPlayedDate === yStr) {
        playerStreak += 1;
    } else {
        playerStreak = 1; 
    }

    if (playerStreak > playerBestStreak) {
        playerBestStreak = playerStreak;
        gameStorage.setItem('playerBestStreak', playerBestStreak);
    }

    lastPlayedDate = today;
    gameStorage.setItem('playerStreak', playerStreak);
    gameStorage.setItem('lastPlayedDate', lastPlayedDate);
}

function updateHighScoreIfNeeded(runScore) {
    const wasFirstEverRun = (playerHighScore === 0 && lastScore === 0);
    lastScore = runScore;
    gameStorage.setItem('lastScore', lastScore);
    if (runScore > playerHighScore) {
        playerHighScore = runScore;
        gameStorage.setItem('playerHighScore', playerHighScore);
    }
}


let playerName = gameStorage.getItem('playerName') || null;

function openUsernameOverlay(onDone) {
    SFX.click();
    const overlay = document.getElementById('usernameOverlay');
    const input   = document.getElementById('usernameInput');
    const confirm = document.getElementById('usernameConfirmBtn');
    const skip    = document.getElementById('usernameSkipBtn');

    input.value = playerName && playerName !== 'YOU' ? playerName : '';
    overlay.classList.remove('hidden');

    function finish(name) {
        SFX.click();
        playerName = name || 'YOU';
        localStorage.setItem('playerName', playerName);
        overlay.classList.add('hidden');
        updateSettingsNameDisplay();
        startMenuFire();
        if (onDone) onDone();
    }

    
    const newConfirm = confirm.cloneNode(true);
    const newSkip    = skip.cloneNode(true);
    confirm.parentNode.replaceChild(newConfirm, confirm);
    skip.parentNode.replaceChild(newSkip, skip);

    newConfirm.addEventListener('click', () => {
        const val = document.getElementById('usernameInput').value.trim().toUpperCase();
        finish(val || 'YOU');
    });
    newSkip.addEventListener('click', () => finish('YOU'));

    document.getElementById('usernameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = document.getElementById('usernameInput').value.trim().toUpperCase();
            finish(val || 'YOU');
        }
    });
}

function updateMenuStats() {
    const hs = document.getElementById('menuHighScore');
    const st = document.getElementById('menuStreak');
    if (hs) hs.innerText = playerHighScore;
    if (st) st.innerText = playerStreak;
}

function updateSettingsNameDisplay() {
    const el = document.getElementById('settingsNameDisplay');
    if (el) el.innerText = playerName || 'YOU';
}


// Username Initialization
(async function initUser() {
    // Fallback: use local username popup if name is not set
    if (!localStorage.getItem('playerName')) {
        openUsernameOverlay(null);
    } else {
        updateSettingsNameDisplay();
    }
})();
updateMenuStats();


document.getElementById('settingsChangeNameBtn').addEventListener('click', () => {
    closeSettingsMenu();
    setTimeout(() => openUsernameOverlay(null), 100);
});


function renderLeaderboard() {
    const isStreak = document.getElementById('lbToggle').checked;
    const list     = document.getElementById('leaderboardList');
    const header   = document.querySelector('.lb-header span:last-child');
    if (header) header.innerText = isStreak ? 'STREAK' : 'SCORE';

    const realPlayer = {
        name:   playerName || 'YOU',
        score:  playerHighScore,
        streak: playerStreak,
        fake:   false
    };

    const all = [...fakePlayers, realPlayer];
    all.sort((a, b) => {
        const valA = isStreak ? a.streak : a.score;
        const valB = isStreak ? b.streak : b.score;
        if (valB !== valA) return valB - valA;
        
        if (!a.fake && b.fake) return -1;
        if (a.fake && !b.fake) return 1;
        return 0;
    });

    list.innerHTML = '';
    all.forEach((p, i) => {
        const row = document.createElement('div');
        row.classList.add('lb-row');
        if (!p.fake) row.classList.add('lb-you');

        const rank  = document.createElement('span');
        rank.innerText = '#' + (i + 1);

        const name  = document.createElement('span');
        name.innerText = p.name;
        name.style.overflow = 'hidden';
        name.style.textOverflow = 'ellipsis';
        name.style.whiteSpace = 'nowrap';

        const val   = document.createElement('span');
        val.innerText = isStreak
            ? (p.streak + (p.streak === 1 ? ' day' : ' days'))
            : p.score;

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(val);
        list.appendChild(row);

        if (!p.fake) {
            setTimeout(() => {
                const listEl = document.getElementById('leaderboardList');
                const rowTop = row.offsetTop;
                const rowHeight = row.offsetHeight;
                const listHeight = listEl.clientHeight;
                listEl.scrollTop = rowTop - (listHeight / 2) + (rowHeight / 2);
            }, 80);
        }
    });
}

const leaderboardBtn   = document.getElementById("leaderboardBtn");
const leaderboardPopup = document.getElementById("leaderboardPopup");
const lbCloseBtn       = document.getElementById("lbCloseBtn");
const lbToggle         = document.getElementById("lbToggle");

function openLeaderboard() {
    SFX.click();
    renderLeaderboard();
    leaderboardPopup.style.display = "flex";
    requestAnimationFrame(() => leaderboardPopup.classList.add("open"));
}

function closeLeaderboard() {
    SFX.click();
    leaderboardPopup.classList.remove("open");
    setTimeout(() => {
        leaderboardPopup.style.display = "none";
        document.getElementById('leaderboardList').scrollTop = 0;
    }, 250);
}

leaderboardBtn.addEventListener("click", openLeaderboard);
leaderboardBtn.addEventListener("touchstart", (e) => { e.preventDefault(); openLeaderboard(); });

lbCloseBtn.addEventListener("click", closeLeaderboard);
lbCloseBtn.addEventListener("touchstart", (e) => { e.preventDefault(); closeLeaderboard(); });

leaderboardPopup.addEventListener("click", (e) => {
    if (e.target === leaderboardPopup) closeLeaderboard();
});

lbToggle.addEventListener("change", () => {
    SFX.click();
    renderLeaderboard();
});

let trailFrameCount = 0;
const MAX_TRAIL_PARTICLES = 30;        
let trailParticleCount = 0;            

function spawnTrailParticle() {
    if (!activeTrail || trailParticleCount >= MAX_TRAIL_PARTICLES) return;
    if (gameState !== "playing" && gameState !== "menu_ai" && gameState !== "transition") return;

    trailParticleCount++;           

    const bx = x + BALL_SIZE / 2;
    const by = window.innerHeight * ((15 + 7 * slamProgress) / 100) + BALL_SIZE / 2;
    const fallTrail = Math.min(FALL_SPEED * 4, 40);

    const p = document.createElement('div');
    p.classList.add('trail-particle');
    p.style.zIndex = '1';
    gameSurface.appendChild(p);

    
    switch (activeTrail) {
        case 'sparks': {
            const angle = Math.random() * Math.PI * 2;
            const dist  = 20 + Math.random() * 30;
            const size  = 3 + Math.random() * 4;
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background: ${Math.random()>0.5 ? '#ffe066' : '#ffffff'};
                left:${bx + (Math.random()-0.5)*30}px; top:${by + (Math.random()-0.5)*20}px;
                --tx:${(Math.random()-0.5)*50}px; --ty:-${120+Math.random()*60}px;
                --tx2:${Math.cos(angle)*dist*1.5}px; --ty2:${Math.sin(angle)*dist*1.5}px;
                --ts:1; --dur:${0.4 + Math.random()*0.3}s;
                box-shadow: 0 0 4px #ffe066;
            `;
            break;
        }
        case 'smoke': {
            const ox = (Math.random() - 0.5) * 20;
            const size = 10 + Math.random() * 10;
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background: rgba(180,180,180,0.5);
                left:${bx + ox}px; top:${by}px;
                --tx:${(Math.random()-0.5)*10}px; --ty:-${150+Math.random()*60}px;
                --tx2:${ox*2}px; --ty2:-${60 + Math.random()*20}px;
                --ts:1.5; --dur:${0.7 + Math.random()*0.4}s;
                filter: blur(3px);
            `;
            break;
        }

        case 'fire': {
            const ox = (Math.random() - 0.5) * 16;
            const size = 10 + Math.random() * 8;
            const colors = ['#ffd700','#ff8c00','#ff4500','#ff6600'];
            const col = colors[Math.floor(Math.random()*colors.length)];
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background: ${col};
                left:${bx + ox}px; top:${by + 10}px;
                --tx:${(Math.random()-0.5)*10}px; --ty:-${150+Math.random()*50}px;
                --tx2:${ox * (Math.random()>0.5?-1:1) * 2}px; --ty2:-${55 + Math.random()*15}px;
                --ts:0.8; --dur:${0.5 + Math.random()*0.3}s;
                filter: blur(1px);
                mix-blend-mode: screen;
            `;
            break;
        }

        case 'ice': {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const size = 4 + Math.random() * 5;
            p.style.cssText = `
                width:${size}px; height:${size}px;
                background: ${Math.random()>0.5 ? '#aef6ff' : '#ffffff'};
                left:${bx + (Math.random()-0.5)*25}px; top:${by + (Math.random()-0.5)*20}px;
                --tx:${(Math.random()-0.5)*40}px; --ty:-${120+Math.random()*60}px;
                --tx2:${dir*(40+Math.random()*20)}px; --ty2:${(Math.random()-0.5)*10}px;
                --ts:1; --dur:${0.5+Math.random()*0.3}s;
                box-shadow: 0 0 5px #aef6ff;
                clip-path: polygon(50% 0%,100% 50%,50% 100%,0% 50%);
            `;
            break;
        }

        case 'rainbow': {
            const angle = (trailFrameCount * 25) % 360;
            const r = 22 + Math.random()*6;
            const px2 = bx + Math.cos(angle*Math.PI/180)*r;
            const py2 = by + Math.sin(angle*Math.PI/180)*r;
            const size = 5 + Math.random()*5;
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background: hsl(${angle},100%,60%);
                left:${px2}px; top:${py2}px;
                --tx:${(Math.random()-0.5)*15}px; --ty:-${130+Math.random()*60}px;
                --tx2:0px; --ty2:-${20+Math.random()*10}px;
                --ts:1; --dur:0.5s;
                box-shadow: 0 0 6px hsl(${angle},100%,60%);
            `;
            break;
        }

        case 'void': {
            const angle = Math.random() * Math.PI * 2;
            const r = 10 + Math.random() * 20;
            const size = 5 + Math.random() * 8;
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background: ${Math.random()>0.5 ? '#9b00ff' : '#6600cc'};
                left:${bx + Math.cos(angle)*r}px; top:${by + Math.sin(angle)*r}px;
                --tx:${(Math.random()-0.5)*10}px; --ty:-${140+Math.random()*60}px;
                --tx2:${Math.cos(angle)*-5}px;  --ty2:${Math.sin(angle)*-5}px;
                --ts:1.2; --dur:${0.6+Math.random()*0.4}s;
                filter: blur(1px);
                opacity: 0.6;
            `;
            break;
        }

        case 'neon': {
            const isH = Math.random() > 0.5;
            const len = 12 + Math.random() * 18;
            const col = Math.random() > 0.5 ? '#00ffff' : '#ff00ff';
            p.style.cssText = `
                width:${isH ? len : 2}px; height:${isH ? 2 : len}px;
                background:${col};
                left:${bx + (Math.random()-0.5)*20}px; top:${by + 10 + (Math.random()-0.5)*20}px;
                --tx:${(Math.random()-0.5)*10}px; --ty:-${130+Math.random()*60}px;
                --tx2:${(Math.random()-0.5)*20}px; --ty2:${(Math.random()-0.5)*20}px;
                --ts:1; --dur:${0.3+Math.random()*0.3}s;
                box-shadow: 0 0 8px ${col}, 0 0 16px ${col};
            `;
            break;
        }

        case 'confetti': {
            const cols = ['#ff3b3b','#ffcc00','#33ff66','#33aaff','#cc44ff','#ff88cc'];
            const col  = cols[Math.floor(Math.random()*cols.length)];
            const w    = 5 + Math.random()*6;
            const h    = 3 + Math.random()*4;
            const rot  = Math.random()*360;
            const dx   = (Math.random()-0.5)*40;
            p.style.cssText = `
                width:${w}px; height:${h}px;
                background:${col};
                left:${bx+(Math.random()-0.5)*20}px; top:${by}px;
                transform: rotate(${rot}deg);
                --tx:${(Math.random()-0.5)*20}px; --ty:-${130+Math.random()*60}px;
                --tx2:${dx*1.5}px; --ty2:-${50+Math.random()*20}px;
                --ts:1; --dur:${0.6+Math.random()*0.4}s;
            `;
            break;
        }

        case 'bubbles': {
            const size = 8 + Math.random() * 12;
            const ox   = (Math.random()-0.5)*30;
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background: transparent;
                border: 2px solid rgba(180,230,255,0.8);
                left:${bx+ox}px; top:${by}px;
                --tx:${(Math.random()-0.5)*10}px; --ty:-${150+Math.random()*60}px;
                --tx2:${ox}px;   --ty2:-${55+Math.random()*20}px;
                --ts:1.3; --dur:${0.7+Math.random()*0.5}s;
            `;
            break;
        }

        case 'lightning': {
            const len  = 15 + Math.random()*20;
            const ang  = (Math.random()-0.5)*60;
            const col  = Math.random()>0.5 ? '#ffffff' : '#ffff88';
            p.style.cssText = `
                width:2px; height:${len}px;
                background:${col};
                left:${bx+(Math.random()-0.5)*25}px; top:${by+10+(Math.random()-0.5)*20}px;
                transform: rotate(${ang}deg);
                --tx:${(Math.random()-0.5)*10}px; --ty:-${120+Math.random()*50}px;
                --tx2:${(Math.random()-0.5)*10}px; --ty2:${(Math.random()-0.5)*10}px;
                --ts:1; --dur:${0.15+Math.random()*0.15}s;
                box-shadow: 0 0 6px ${col}, 0 0 12px ${col};
            `;
            break;
        }

        case 'galaxy': {
            const angle = Math.random() * Math.PI * 2;
            const r     = 5 + Math.random()*25;
            const size  = 2 + Math.random()*4;
            const col   = Math.random()>0.5 ? '#8888ff' : '#cc99ff';
            p.style.cssText = `
                width:${size}px; height:${size}px; border-radius:50%;
                background:${col};
                left:${bx+Math.cos(angle)*r}px; top:${by+Math.sin(angle)*r}px;
                --tx:${(Math.random()-0.5)*15}px; --ty:-${140+Math.random()*70}px;
                --tx2:0px; --ty2:0px;
                --ts:0.5; --dur:${0.8+Math.random()*0.6}s;
                box-shadow: 0 0 4px ${col};
            `;
            break;
        }

        case 'binary': {
            const char = Math.random() > 0.5 ? '1' : '0';
            const col = Math.random() > 0.3 ? '#00ff00' : '#00aa00';
            const fs   = 18 + Math.random()*5;
            p.style.cssText = `
                font-family: monospace;
                font-size:${fs}px;
                color: ${col};
                left:${bx + (Math.random()-0.5)*10}px; top:${by}px;
                --tx:0px; --ty:${-200+Math.random()*60}px; 
                --ts:1; --dur:${1+Math.random()*0.3}s;
                text-shadow: 0 0 8px #00ff00;
                line-height:1;
                opacity:${0.6+Math.random()*0.4};
            `;
            p.innerText = char;
            break;
        }
        default: return;
    }

    
    p.addEventListener('animationend', () => {
        if (p.parentNode) p.remove();
        trailParticleCount--;
    }, { once: true });
}


let trailPreviewInterval = null;

function startTrailPreview(trailId) {
    stopTrailPreview();
    const box = document.getElementById('trPreviewBox');
    if (!box) return;

    trailPreviewInterval = setInterval(() => {
        const p = document.createElement('div');
        p.classList.add('trail-particle');
        box.appendChild(p);

        const bx = 40, by = 40; 

        
        switch (trailId) {
            case 'sparks': {
                const angle = Math.random()*Math.PI*2, dist=15+Math.random()*15, size=3+Math.random()*3;
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:${Math.random()>0.5?'#ffe066':'#fff'};left:${bx}px;top:${by}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;--tx2:${Math.cos(angle)*dist*1.5}px;--ty2:${Math.sin(angle)*dist*1.5}px;--ts:1;--dur:0.5s;box-shadow:0 0 4px #ffe066;`;
                break;
            }
            case 'smoke': {
                const ox=(Math.random()-0.5)*16,size=8+Math.random()*8;
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:rgba(180,180,180,0.5);left:${bx+ox}px;top:${by}px;--tx:${ox}px;--ty:-${20+Math.random()*15}px;--tx2:${ox*2}px;--ty2:-${40+Math.random()*10}px;--ts:1.5;--dur:0.8s;filter:blur(3px);`;
                break;
            }
            case 'fire': {
                const ox=(Math.random()-0.5)*14,col=['#ffd700','#ff8c00','#ff4500'][Math.floor(Math.random()*3)],size=8+Math.random()*7;
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:${col};left:${bx+ox}px;top:${by+8}px;--tx:${ox}px;--ty:-${20+Math.random()*15}px;--tx2:${ox*(Math.random()>0.5?-1:1)*2}px;--ty2:-${40+Math.random()*10}px;--ts:0.8;--dur:0.5s;filter:blur(1px);mix-blend-mode:screen;`;
                break;
            }
            case 'ice': {
                const dir=Math.random()>0.5?1:-1,size=3+Math.random()*4;
                p.style.cssText=`width:${size}px;height:${size}px;background:${Math.random()>0.5?'#aef6ff':'#fff'};left:${bx}px;top:${by+(Math.random()-0.5)*8}px;--tx:${dir*(15+Math.random()*20)}px;--ty:${(Math.random()-0.5)*10}px;--tx2:${dir*(30+Math.random()*10)}px;--ty2:${(Math.random()-0.5)*8}px;--ts:1;--dur:0.5s;box-shadow:0 0 5px #aef6ff;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);`;
                break;
            }
            case 'rainbow': {
                const ang=(Date.now()/10)%360,r=18+Math.random()*5,size=4+Math.random()*4;
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:hsl(${ang},100%,60%);left:${bx+Math.cos(ang*Math.PI/180)*r}px;top:${by+Math.sin(ang*Math.PI/180)*r}px;--tx:0px;--ty:-${8+Math.random()*8}px;--tx2:0px;--ty2:-${16+Math.random()*8}px;--ts:1;--dur:0.5s;box-shadow:0 0 6px hsl(${ang},100%,60%);`;
                break;
            }
            case 'void': {
                const ang=Math.random()*Math.PI*2,r=8+Math.random()*16,size=4+Math.random()*6;
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:${Math.random()>0.5?'#7b00ff':'#3d0080'};left:${bx+Math.cos(ang)*r}px;top:${by+Math.sin(ang)*r}px;--tx:${Math.cos(ang)*-10}px;--ty:${Math.sin(ang)*-10}px;--tx2:${Math.cos(ang)*-3}px;--ty2:${Math.sin(ang)*-3}px;--ts:1.2;--dur:0.7s;filter:blur(2px);mix-blend-mode:screen;`;
                break;
            }
            case 'neon': {
                const isH=Math.random()>0.5,len=10+Math.random()*14,col=Math.random()>0.5?'#00ffff':'#ff00ff';
                p.style.cssText=`width:${isH?len:2}px;height:${isH?2:len}px;background:${col};left:${bx+(Math.random()-0.5)*16}px;top:${by+(Math.random()-0.5)*16}px;--tx:${(Math.random()-0.5)*20}px;--ty:${(Math.random()-0.5)*20}px;--tx2:${(Math.random()-0.5)*14}px;--ty2:${(Math.random()-0.5)*14}px;--ts:1;--dur:0.3s;box-shadow:0 0 8px ${col};`;
                break;
            }
            case 'confetti': {
                const cols=['#ff3b3b','#ffcc00','#33ff66','#33aaff','#cc44ff','#ff88cc'],col=cols[Math.floor(Math.random()*cols.length)],w=4+Math.random()*5,h=3+Math.random()*3,rot=Math.random()*360,dx=(Math.random()-0.5)*30;
                p.style.cssText=`width:${w}px;height:${h}px;background:${col};left:${bx+(Math.random()-0.5)*16}px;top:${by}px;transform:rotate(${rot}deg);--tx:${dx}px;--ty:-${15+Math.random()*20}px;--tx2:${dx*1.5}px;--ty2:-${35+Math.random()*15}px;--ts:1;--dur:0.7s;`;
                break;
            }
            case 'bubbles': {
                const size=6+Math.random()*10,ox=(Math.random()-0.5)*24;
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:transparent;border:2px solid rgba(180,230,255,0.8);left:${bx+ox}px;top:${by}px;--tx:${ox*0.5}px;--ty:-${18+Math.random()*18}px;--tx2:${ox}px;--ty2:-${40+Math.random()*14}px;--ts:1.3;--dur:0.8s;`;
                break;
            }
            case 'lightning': {
                const len=10+Math.random()*16,ang=(Math.random()-0.5)*60,col=Math.random()>0.5?'#fff':'#ffff88';
                p.style.cssText=`width:2px;height:${len}px;background:${col};left:${bx+(Math.random()-0.5)*20}px;top:${by+(Math.random()-0.5)*16}px;transform:rotate(${ang}deg);--tx:${(Math.random()-0.5)*12}px;--ty:${(Math.random()-0.5)*12}px;--tx2:${(Math.random()-0.5)*8}px;--ty2:${(Math.random()-0.5)*8}px;--ts:1;--dur:0.18s;box-shadow:0 0 6px ${col};`;
                break;
            }
            case 'galaxy': {
                const ang=Math.random()*Math.PI*2,r=4+Math.random()*20,size=2+Math.random()*3,col=Math.random()>0.5?'#8888ff':'#cc99ff';
                p.style.cssText=`width:${size}px;height:${size}px;border-radius:50%;background:${col};left:${bx+Math.cos(ang)*r}px;top:${by+Math.sin(ang)*r}px;--tx:${Math.cos(ang+0.5)*r*0.5}px;--ty:${Math.sin(ang+0.5)*r*0.5}px;--tx2:0px;--ty2:0px;--ts:0.5;--dur:0.9s;box-shadow:0 0 4px ${col};`;
                break;
            }
            case 'binary': {
                const char=Math.random()>0.5?'1':'0',ox=(Math.random()-0.5)*32,fs=9+Math.random()*5;
                p.style.cssText=`font-family:monospace;font-size:${fs}px;color:#00ff00;left:${bx+ox}px;top:${by}px;--tx:${ox*0.3}px;--ty:${10+Math.random()*18}px;--tx2:${ox*0.2}px;--ty2:${25+Math.random()*12}px;--ts:1;--dur:0.7s;text-shadow:0 0 8px #00ff00;line-height:1;`;
                p.innerText = char;
                break;
            }
        }

        const dur = parseFloat(p.style.getPropertyValue('--dur') || '0.6') * 1000;
        setTimeout(() => p.remove(), dur + 50);
    }, 80);
}

function stopTrailPreview() {
    if (trailPreviewInterval) {
        clearInterval(trailPreviewInterval);
        trailPreviewInterval = null;
    }
    const box = document.getElementById('trPreviewBox');
    if (box) box.innerHTML = '';
}

applyActiveSkinStyle();
gameLoop();
