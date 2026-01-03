import { TILE_SIZE, SRC_TILE_SIZE, TILE, DIR } from './constants.js';
import { AudioManager } from './AudioManager.js';
import { UIManager } from './UIManager.js';
import { LevelManager } from './LevelManager.js';

export class Game {
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

        this.audio = new AudioManager();
        this.ui = new UIManager();
        this.levelManager = new LevelManager();

        this.levelsManifest = null;
        this.currentLevelIndex = -1;
        this.currentLevelData = null;
        this.lastState = null; // Track previous state for Settings return

        this.init();
    }

    async init() {
        this.setupBindings();
        this.setupInput();

        this.assetsReady = false;
        this.minTimePassed = false;

        // Start asset loading
        this.loadAssets().then(() => {
            this.assetsReady = true;
            this.checkLoadComplete();
        });

        // Load Level Manifest
        this.levelsManifest = await this.levelManager.loadManifest();
        this.ui.renderLevelSelect(this.levelsManifest, (path) => {
            this.audio.playClick();
            this.loadLevelFromPath(path);
        });

        // Start minimum timer (2 seconds)
        setTimeout(() => {
            this.minTimePassed = true;
            this.checkLoadComplete();
        }, 2000);

        this.loop();
    }

    setupBindings() {
        this.ui.bind({
            onStart: () => {
                this.audio.init();
                this.audio.playClick();
                this.startGame();
            },
            onSettings: () => {
                this.audio.init();
                this.audio.playClick();
                this.ui.showSettings({
                    master: this.audio.masterVolume,
                    music: this.audio.musicVolume,
                    sfx: this.audio.sfxVolume,
                    speech: this.audio.speechVolume
                });
                this.lastState = this.gameState;
                this.gameState = 'SETTINGS';
            },
            onBackSettings: () => {
                this.audio.playClick();
                this.returnFromSettings();
            },
            onLevelSelect: () => {
                this.audio.init();
                this.audio.playClick();
                this.ui.showLevelSelect();
                this.gameState = 'LEVEL_SELECT';
            },
            onBackLevel: () => {
                this.audio.playClick();
                this.ui.hideLevelSelect();
                this.gameState = 'MENU';
            },
            onRestart: () => {
                this.audio.playRestart();
                this.restartLevel();
                if (this.gameState === 'PAUSED') {
                    this.togglePause();
                } else {
                    this.ui.togglePause(false);
                }
            },
            onResume: () => {
                this.audio.playClick();
                this.togglePause();
            },
            onMainMenu: () => {
                this.audio.playClick();
                this.returnToMainMenu();
            },
            onNextLevel: () => {
                this.audio.playClick();
                this.handleNextLevelClick();
            },
            onVolumeChange: (type, value) => {
                this.audio.setVolume(type, value);
            }
        });
    }

    checkLoadComplete() {
        if (this.assetsReady && this.minTimePassed && this.gameState === 'LOADING') {
            this.showMenu();
        }
    }

    showMenu() {
        this.gameState = 'MENU';
        this.ui.showMenu();
    }

    startGame() {
        this.gameState = 'PLAYING';
        this.ui.showGame();

        // Default to Level 1 if not loaded via select
        if (this.levelsManifest && this.levelsManifest.length > 0) {
            this.loadLevelFromPath(this.levelsManifest[0].filename);
        }
    }

    async loadLevelFromPath(path) {
        const levelData = await this.levelManager.loadLevelFromPath(path);
        if (levelData) {
            this.loadLevel(levelData);
            this.gameState = 'PLAYING';
            this.ui.showGame();

            // Find current level index
            if (this.levelsManifest) {
                this.currentLevelIndex = this.levelsManifest.findIndex(l => l.filename === path);
            }
        }
    }

    loadLevel(levelData) {
        this.currentLevelData = JSON.parse(JSON.stringify(levelData)); // Store for restart
        // Deep copy grid to avoid mutation of the source data structure
        this.level = this.currentLevelData.grid.map(row => [...row]);
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
                    this.level[y][x] = TILE.FLOOR; // Clear start pos
                }
            }
        }

        this.player.targetX = this.player.pixelX;
        this.player.targetY = this.player.pixelY;
        this.player.sliding = false;
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (!this.audio.initialized) this.audio.init();

            // Loading Skip
            if (this.gameState === 'LOADING') {
                if (this.assetsReady) {
                    this.showMenu();
                }
                return;
            }

            // Removed: Enter key logic now handled by native button focus
            // if (this.gameState === 'MENU' && e.key === 'Enter') { ... }

            if ((this.gameState === 'WON' || this.gameState === 'PLAYING') && (e.key === 'r' || e.key === 'R')) {
                this.audio.playRestart();
                this.restartLevel();
            }

            if (e.key === 'Escape') {
                if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED') {
                    this.togglePause();
                }
            }

            // Credits Skip
            if (this.gameState === 'CREDITS') {
                this.ui.hideCredits();
                this.returnToMainMenu();
            }

            if (this.isMenuState()) {
                this.handleMenuInput(e);
                return; // Stop processing for game
            }

            if (this.gameState !== 'PLAYING') return;

            // Prevent scrolling
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) > -1) {
                e.preventDefault();
            }

            if (this.player.sliding) return;

            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': this.calculateSlide(DIR.UP); break;
                case 'ArrowDown': case 's': case 'S': this.calculateSlide(DIR.DOWN); break;
                case 'ArrowLeft': case 'a': case 'A': this.calculateSlide(DIR.LEFT); break;
                case 'ArrowRight': case 'd': case 'D': this.calculateSlide(DIR.RIGHT); break;
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
            this.audio.playWin();

            let isLastLevel = false;
            if (this.levelsManifest && this.currentLevelIndex >= this.levelsManifest.length - 1) {
                isLastLevel = true;
            }
            this.ui.showLevelComplete(isLastLevel);
        }
    }

    handleNextLevelClick() {
        let isLastLevel = false;
        if (this.levelsManifest && this.currentLevelIndex !== undefined) {
            if (this.currentLevelIndex >= this.levelsManifest.length - 1) {
                isLastLevel = true;
            }
        }

        if (isLastLevel) {
            this.ui.showCredits();
            this.gameState = 'CREDITS';
            this.audio.updateMusicVolume();

            // Auto return after credits (approx 20s animation)
            setTimeout(() => {
                if (this.gameState === 'CREDITS') {
                    this.ui.hideCredits();
                    this.returnToMainMenu();
                }
            }, 20000);
        } else {
            this.loadNextLevel();
        }
    }

    loadNextLevel() {
        if (this.levelsManifest && this.currentLevelIndex !== undefined) {
            const nextIndex = this.currentLevelIndex + 1;
            if (nextIndex < this.levelsManifest.length) {
                const nextLevel = this.levelsManifest[nextIndex];
                this.loadLevelFromPath(nextLevel.filename);
            }
        }
    }

    restartLevel() {
        this.gameState = 'PLAYING';
        this.ui.hideWinText();
        if (this.currentLevelData) {
            this.loadLevel(this.currentLevelData);
        }
    }

    togglePause() {
        if (this.gameState === 'PLAYING') {
            this.gameState = 'PAUSED';
            this.ui.togglePause(true);
        } else if (this.gameState === 'PAUSED') {
            this.gameState = 'PLAYING';
            this.ui.togglePause(false);
        }
    }

    returnToMainMenu() {
        this.gameState = 'MENU';
        this.ui.showMenu();
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

    draw() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.gameState === 'LOADING') return;

        if (this.gameState === 'PLAYING' || this.gameState === 'WON' || this.gameState === 'PAUSED') {
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

            // Draw Full Height Player
            if (this.assets['player']) {
                const pSrcW = 32;
                const pSrcH = 128;
                const pDestW = TILE_SIZE;
                const pDestH = TILE_SIZE * 4;

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

    returnFromSettings() {
        this.ui.hideSettings(this.lastState);
        this.gameState = this.lastState;
    }

    isMenuState() {
        return ['MENU', 'PAUSED', 'SETTINGS', 'LEVEL_SELECT', 'LEVEL_COMPLETE'].includes(this.gameState);
    }

    handleMenuInput(e) {
        // Basic keyboard navigation for menus
        // We can rely on standard tab/arrow navigation if buttons are focused.
        // But since we want "first button selected" and arrow keys to work:
        if (e.key === 'Escape') {
            if (this.gameState === 'SETTINGS') {
                this.returnFromSettings();
            } else if (this.gameState === 'LEVEL_SELECT') {
                this.audio.playClick();
                this.ui.hideLevelSelect();
                this.gameState = 'MENU'; // Assume came from menu
            }
            return;
        }

        const activeElement = document.activeElement;
        if (!activeElement || activeElement.tagName !== 'BUTTON' && activeElement.tagName !== 'INPUT') return;

        // Map Arrow Keys to focus movement if needed, 
        // but default browser behavior for buttons + focus management in UI might be enough?
        // Actually, default browser behavior for Arrow keys on buttons isn't always reliable (Vertical vs Horizontal).
        // Let's rely on Tab for now, or add simple sibling navigation?
        // The user asked "Menus controllable by keyboard". 
        // If we focused the first button, Tab works. Arrow keys might need custom logic.

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            this.navigateFocus(e.key, activeElement);
        }
    }

    navigateFocus(key, currentEl) {
        // Find suitable container based on game state
        let containerSelector = '';
        if (this.gameState === 'MENU') containerSelector = '.menu-options';
        else if (this.gameState === 'PAUSED') containerSelector = '#pause-menu';
        else if (this.gameState === 'SETTINGS') containerSelector = '#settings-menu';
        else if (this.gameState === 'LEVEL_SELECT') containerSelector = '#level-select';
        else if (this.gameState === 'WON' || this.gameState === 'LEVEL_COMPLETE') containerSelector = '#level-complete-menu';

        let container = null;
        if (containerSelector) {
            container = document.querySelector(containerSelector);
        }

        if (!container) return;

        // Query all focusable elements in the container
        const siblings = Array.from(container.querySelectorAll('button:not([style*="display: none"]), input:not([style*="display: none"])'));
        const index = siblings.indexOf(currentEl);

        if (index === -1) return;

        let nextIndex = index;
        if (key === 'ArrowDown' || key === 'ArrowRight' || key === 's' || key === 'S' || key === 'd' || key === 'D') {
            nextIndex = index + 1;
        } else if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'w' || key === 'W' || key === 'a' || key === 'A') {
            nextIndex = index - 1;
        }

        if (nextIndex >= 0 && nextIndex < siblings.length) {
            siblings[nextIndex].focus();
            this.audio.playClick();
        }
    }


    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}
