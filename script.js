/**
 * Sliding Puzzle Game
 * 
 * Mechanics:
 * - Tile-based movement
 * - Character slides until hitting a wall
 * - Goal: Reach the end square
 */

const TILE_SIZE = 64;
const SRC_TILE_SIZE = 32;

const TILE = {
    FLOOR: 0,
    WALL: 1,
    START: 2,
    GOAL: 3,
    OBSTACLE: 4
};

const DIR = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgm = new Audio('audio/Piece by Piece.mp3');
        this.bgm.loop = true;

        this.masterVolume = 1.0;
        this.musicVolume = 0.5;
        this.sfxVolume = 1.0;
        this.speechVolume = 1.0; // Placeholder

        this.initialized = false;

        this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('sokoban_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.masterVolume = settings.master !== undefined ? settings.master : 1.0;
            this.musicVolume = settings.music !== undefined ? settings.music : 0.5;
            this.sfxVolume = settings.sfx !== undefined ? settings.sfx : 1.0;
            this.speechVolume = settings.speech !== undefined ? settings.speech : 1.0;
        }
    }

    saveSettings() {
        const settings = {
            master: this.masterVolume,
            music: this.musicVolume,
            sfx: this.sfxVolume,
            speech: this.speechVolume
        };
        localStorage.setItem('sokoban_settings', JSON.stringify(settings));
    }

    init() {
        if (this.initialized) return;
        this.ctx.resume().then(() => {
            this.initialized = true;
            this.noiseBuffer = this.createNoiseBuffer();
            this.playBGM();
        });
    }

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    playBGM() {
        this.updateMusicVolume();
        this.bgm.play().catch(e => console.log("Audio play failed", e));
    }

    updateMusicVolume() {
        this.bgm.volume = this.masterVolume * this.musicVolume;
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Calculate effective volume
        const effectiveVol = this.sfxVolume * this.masterVolume * vol;

        gain.gain.setValueAtTime(effectiveVol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playSlide() {
        // Stone sliding sound using filtered noise
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (!this.noiseBuffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;

        // Lowpass filter to simulate heavy object dragging (muffled scrape)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const gain = this.ctx.createGain();
        // Louder, rougher sound
        const effectiveVol = this.sfxVolume * this.masterVolume * 0.8;

        gain.gain.setValueAtTime(effectiveVol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        source.start();
        // Play for a short duration matching the slide
        source.stop(this.ctx.currentTime + 0.3);
    }

    playWin() {
        // Victory chime
        setTimeout(() => this.playTone(523.25, 'sine', 0.4, 0.5), 0);
        setTimeout(() => this.playTone(659.25, 'sine', 0.4, 0.5), 100);
        setTimeout(() => this.playTone(783.99, 'sine', 0.4, 0.5), 200);
        setTimeout(() => this.playTone(1046.50, 'sine', 0.8, 0.5), 300);
    }

    playRestart() {
        this.playTone(200, 'sawtooth', 0.2, 0.3);
    }

    playClick() {
        this.playTone(800, 'square', 0.05, 0.1);
    }

    setVolume(type, value) {
        value = parseFloat(value);
        if (type === 'master') {
            this.masterVolume = value;
            this.updateMusicVolume();
        } else if (type === 'music') {
            this.musicVolume = value;
            this.updateMusicVolume();
        } else if (type === 'sfx') {
            this.sfxVolume = value;
        } else if (type === 'speech') {
            this.speechVolume = value;
        }
        this.saveSettings();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.ctx.imageSmoothingEnabled = false;

        this.assets = {};
        this.imagesLoaded = 0;
        this.totalImages = 0;

        this.level = [];
        this.player = {
            gridX: 0,
            gridY: 0,
            pixelX: 0,
            pixelY: 0,
            sliding: false,
            dir: null,
            targetX: 0,
            targetY: 0,
            speed: 20
        };

        this.rows = 0;
        this.cols = 0;
        this.gameState = 'LOADING';

        this.uiLoading = document.getElementById('loading-screen');
        this.uiMenu = document.getElementById('main-menu');
        this.uiGame = document.getElementById('ui-overlay');

        this.btnStart = document.getElementById('start-btn');

        // Settings UI
        this.uiSettings = document.getElementById('settings-menu');
        this.btnSettings = document.getElementById('settings-btn');
        this.btnSettingsBack = document.getElementById('settings-back-btn');

        // Audio Manager
        this.audio = new AudioManager();

        this.init();
    }

    async init() {
        this.setupUIListeners();
        this.setupInput();

        this.assetsReady = false;
        this.minTimePassed = false;

        // Start asset loading
        this.loadAssets().then(() => {
            this.assetsReady = true;
            this.checkLoadComplete();
        });

        // Start minimum timer (2 seconds)
        setTimeout(() => {
            this.minTimePassed = true;
            this.checkLoadComplete();
        }, 2000);

        this.loop();
    }

    checkLoadComplete() {
        // Auto-transition only if BOTH conditions are met
        if (this.assetsReady && this.minTimePassed && this.gameState === 'LOADING') {
            this.showMenu();
        }
    }

    setupUIListeners() {
        this.btnStart.addEventListener('click', () => {
            this.audio.init();
            this.audio.playClick();
            this.startGame();
        });

        this.btnSettings.addEventListener('click', () => {
            this.audio.init(); // Ensure audio context is ready
            this.audio.playClick();
            this.showSettings();
        });

        this.btnSettingsBack.addEventListener('click', () => {
            this.audio.playClick();
            this.hideSettings();
        });

        // Volume Sliders
        ['master', 'music', 'sfx', 'speech'].forEach(type => {
            const el = document.getElementById(`vol-${type}`);
            if (el) {
                el.addEventListener('input', (e) => {
                    this.audio.setVolume(type, e.target.value);
                });
            }
        });

        window.addEventListener('keydown', (e) => {
            // Ensure audio starts on first key interaction if not already
            if (!this.audio.initialized) this.audio.init();

            // Loading Skip Logic
            if (this.gameState === 'LOADING') {
                if (this.assetsReady) {
                    this.showMenu();
                }
                return;
            }

            if (this.gameState === 'MENU' && e.key === 'Enter') {
                this.audio.playClick();
                this.startGame();
            }
            if (this.gameState === 'WON' && (e.key === 'r' || e.key === 'R')) {
                this.audio.playRestart();
                this.restartLevel();
            }
            if (this.gameState === 'PLAYING' && (e.key === 'r' || e.key === 'R')) {
                this.audio.playRestart();
                this.restartLevel();
            }
        });
    }

    showSettings() {
        // Sync sliders
        document.getElementById('vol-master').value = this.audio.masterVolume;
        document.getElementById('vol-music').value = this.audio.musicVolume;
        document.getElementById('vol-sfx').value = this.audio.sfxVolume;
        document.getElementById('vol-speech').value = this.audio.speechVolume;

        this.uiMenu.style.display = 'none';
        this.uiSettings.style.display = 'flex';
    }

    hideSettings() {
        this.uiSettings.style.display = 'none';
        this.uiMenu.style.display = 'flex';
    }

    showMenu() {
        this.gameState = 'MENU';
        this.uiLoading.style.display = 'none';
        this.uiMenu.style.display = 'flex';
        this.uiGame.style.display = 'none';
    }

    startGame() {
        this.gameState = 'PLAYING';
        this.uiMenu.style.display = 'none';
        this.uiGame.style.display = 'block';

        this.loadLevel(LEVEL_1);
    }

    restartLevel() {
        this.gameState = 'PLAYING';
        document.getElementById('level-text').style.display = 'none';
        this.loadLevel(LEVEL_1);
    }

    loadAssets() {
        const imageSources = {
            'floor-sheet': 'Textures/TX Tileset Stone Ground.png',
            'wall-sheet': 'Textures/TX Tileset Wall.png',
            'player': 'Textures/TX Player.png',
            'props': 'Textures/TX Props.png',
            'struct': 'Textures/TX Struct.png'
        };

        this.totalImages = Object.keys(imageSources).length;

        return new Promise((resolve) => {
            for (let key in imageSources) {
                const img = new Image();
                img.src = imageSources[key];
                img.onload = () => {
                    this.imagesLoaded++;
                    if (this.imagesLoaded === this.totalImages) {
                        resolve();
                    }
                };
                this.assets[key] = img;
            }
        });
    }

    loadLevel(levelData) {
        this.level = JSON.parse(JSON.stringify(levelData));
        this.rows = this.level.length;
        this.cols = this.level[0].length;

        this.canvas.width = this.cols * TILE_SIZE;
        this.canvas.height = this.rows * TILE_SIZE;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.level[y][x] === TILE.START) {
                    this.player.gridX = x;
                    this.player.gridY = y;
                    this.player.pixelX = x * TILE_SIZE;
                    this.player.pixelY = y * TILE_SIZE;
                    this.level[y][x] = TILE.FLOOR;
                }
            }
        }

        this.player.targetX = this.player.pixelX;
        this.player.targetY = this.player.pixelY;
        this.player.sliding = false;
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (this.gameState !== 'PLAYING') return;

            // Prevent scrolling for game keys
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) > -1) {
                e.preventDefault();
            }

            if (this.player.sliding) return;

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    this.calculateSlide(DIR.UP);
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    this.calculateSlide(DIR.DOWN);
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    this.calculateSlide(DIR.LEFT);
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    this.calculateSlide(DIR.RIGHT);
                    break;
            }
        });
    }

    calculateSlide(direction) {
        let currentX = this.player.gridX;
        let currentY = this.player.gridY;

        while (true) {
            const nextX = currentX + direction.x;
            const nextY = currentY + direction.y;

            if (!this.canMoveTo(nextX, nextY)) {
                break;
            }
            currentX = nextX;
            currentY = nextY;
        }

        if (currentX !== this.player.gridX || currentY !== this.player.gridY) {
            this.player.sliding = true;
            this.player.gridX = currentX;
            this.player.gridY = currentY;
            this.player.targetX = currentX * TILE_SIZE;
            this.player.targetY = currentY * TILE_SIZE;
            this.player.dir = direction;
            this.audio.playSlide();
        }
    }

    canMoveTo(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
        const tile = this.level[y][x];
        return tile !== TILE.WALL && tile !== TILE.OBSTACLE;
    }

    update() {
        if (this.gameState === 'PLAYING' && this.player.sliding) {
            const dx = this.player.targetX - this.player.pixelX;
            const dy = this.player.targetY - this.player.pixelY;

            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.player.speed) {
                this.player.pixelX = this.player.targetX;
                this.player.pixelY = this.player.targetY;
                this.player.sliding = false;
                this.checkWin();
            } else {
                const angle = Math.atan2(dy, dx);
                this.player.pixelX += Math.cos(angle) * this.player.speed;
                this.player.pixelY += Math.sin(angle) * this.player.speed;
            }
        }
    }

    checkWin() {
        if (this.level[this.player.gridY][this.player.gridX] === TILE.GOAL) {
            this.gameState = 'WON';
            document.getElementById('level-text').style.display = 'block';
            this.audio.playWin();
        }
    }

    draw() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.gameState === 'LOADING') return;

        if (this.gameState === 'PLAYING' || this.gameState === 'WON') {
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const tile = this.level[y][x];
                    const px = x * TILE_SIZE;
                    const py = y * TILE_SIZE;

                    this.drawSprite(this.assets['floor-sheet'], 0, 0, px, py);

                    if (tile === TILE.WALL) {
                        this.drawSprite(this.assets['wall-sheet'], 0, 0, px, py);
                    } else if (tile === TILE.OBSTACLE) {
                        this.drawSprite(this.assets['props'], 0, 0, px, py);
                    } else if (tile === TILE.GOAL) {
                        this.drawSprite(this.assets['struct'], 0, 0, px, py);
                        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                        this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    }
                }
            }

            // Draw Full Height Player with corrected offset
            if (this.assets['player']) {
                const pSrcW = 32;
                const pSrcH = 128;
                const pDestW = TILE_SIZE;
                const pDestH = TILE_SIZE * 4; // 256px

                // Offset calculation based on visual verification (Top Aligned Content in Transparent Frame)
                const dy = this.player.pixelY + TILE_SIZE - pDestH + (TILE_SIZE * 2);

                this.ctx.drawImage(
                    this.assets['player'],
                    0, 0, pSrcW, pSrcH,
                    this.player.pixelX, dy, pDestW, pDestH
                );
            }
        }
    }

    drawSprite(img, sx, sy, dx, dy) {
        if (!img) return;

        this.ctx.drawImage(
            img,
            sx * SRC_TILE_SIZE, sy * SRC_TILE_SIZE, SRC_TILE_SIZE, SRC_TILE_SIZE,
            dx, dy, TILE_SIZE, TILE_SIZE
        );
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const LEVEL_1 = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 0, 4, 1, 0, 0, 1],
    [1, 2, 0, 4, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 4, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 3, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

window.onload = () => {
    new Game();
};
