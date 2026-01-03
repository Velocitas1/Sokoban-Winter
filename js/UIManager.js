export class UIManager {
    constructor() {
        this.uiLoading = document.getElementById('loading-screen');
        this.uiMenu = document.getElementById('main-menu');
        this.uiGame = document.getElementById('ui-overlay');

        this.btnStart = document.getElementById('start-btn');

        // Settings UI
        this.uiSettings = document.getElementById('settings-menu');
        this.btnSettings = document.getElementById('settings-btn');
        this.btnSettingsBack = document.getElementById('settings-back-btn');

        // Level Select UI
        this.uiLevelSelect = document.getElementById('level-select');
        this.btnLevelSelect = document.getElementById('level-select-btn');
        this.btnLevelBack = document.getElementById('level-back-btn');
        this.levelGrid = document.getElementById('level-grid');

        // Pause Menu UI
        this.uiPause = document.getElementById('pause-menu');
        this.btnResume = document.getElementById('resume-btn');
        this.btnPauseRestart = document.getElementById('pause-restart-btn');
        this.btnPauseSettings = document.getElementById('pause-settings-btn');
        this.btnMainMenu = document.getElementById('main-menu-btn');

        // Level Complete UI
        this.uiLevelComplete = document.getElementById('level-complete-menu');
        this.btnNextLevel = document.getElementById('next-level-btn');
        this.btnLevelMenu = document.getElementById('level-menu-btn');

        // Credits UI
        this.uiCredits = document.getElementById('credits-screen');
    }

    bind(handlers) {
        if (handlers.onStart) {
            this.btnStart.addEventListener('click', handlers.onStart);
        }

        if (handlers.onSettings) {
            this.btnSettings.addEventListener('click', handlers.onSettings);
            this.btnPauseSettings.addEventListener('click', handlers.onSettings);
        }

        if (handlers.onBackSettings) {
            this.btnSettingsBack.addEventListener('click', handlers.onBackSettings);
        }

        if (handlers.onLevelSelect) {
            this.btnLevelSelect.addEventListener('click', handlers.onLevelSelect);
        }

        if (handlers.onBackLevel) {
            this.btnLevelBack.addEventListener('click', handlers.onBackLevel);
        }

        if (handlers.onResume) {
            this.btnResume.addEventListener('click', handlers.onResume);
        }

        if (handlers.onRestart) {
            this.btnPauseRestart.addEventListener('click', handlers.onRestart);
        }

        if (handlers.onMainMenu) {
            this.btnMainMenu.addEventListener('click', handlers.onMainMenu);
            this.btnLevelMenu.addEventListener('click', handlers.onMainMenu);
        }

        if (handlers.onNextLevel) {
            this.btnNextLevel.addEventListener('click', handlers.onNextLevel);
        }

        if (handlers.onVolumeChange) {
            // Volume Sliders
            ['master', 'music', 'sfx', 'speech'].forEach(type => {
                const el = document.getElementById(`vol-${type}`);
                if (el) {
                    el.addEventListener('input', (e) => {
                        handlers.onVolumeChange(type, e.target.value);
                    });
                }
            });
        }
    }

    renderLevelSelect(levels, onLevelClick) {
        this.levelGrid.innerHTML = '';
        if (!levels) return;

        levels.forEach((level) => {
            const card = document.createElement('button');
            card.type = 'button'; // Explicit type
            card.className = 'level-card';
            card.onclick = () => {
                onLevelClick(level.filename);
            };

            const img = document.createElement('img');
            img.src = level.thumbnail || 'Textures/TX Player.png'; // Fallback
            img.className = 'level-thumbnail';

            const info = document.createElement('div');
            info.className = 'level-info';

            const num = document.createElement('div');
            num.className = 'level-number';
            num.innerText = `LEVEL ${level.id}`;

            const title = document.createElement('div');
            title.className = 'level-title';
            title.innerText = level.name;

            info.appendChild(num);
            info.appendChild(title);

            card.appendChild(img);
            card.appendChild(info);

            this.levelGrid.appendChild(card);
        });
    }

    showSettings(audioSettings) {
        // Sync sliders
        document.getElementById('vol-master').value = audioSettings.master;
        document.getElementById('vol-music').value = audioSettings.music;
        document.getElementById('vol-sfx').value = audioSettings.sfx;
        document.getElementById('vol-speech').value = audioSettings.speech;

        // Hide current context is handled by hiding UI layers before showing settings? 
        // Or we just overlay? 
        // Original code hid Menu/Pause. I should probably handle that in Game or here if I track state.
        // For now, let's just show Settings and rely on HideOthers or Game managing state.

        this.uiSettings.style.display = 'flex';
        this.uiMenu.style.display = 'none';
        this.uiPause.style.display = 'none';

        this.focusFirstButton(this.uiSettings);
    }

    hideSettings(returnState) {
        this.uiSettings.style.display = 'none';
        if (returnState === 'PAUSED') {
            this.uiPause.style.display = 'flex';
            this.focusFirstButton(this.uiPause);
        } else {
            this.uiMenu.style.display = 'flex';
            this.focusFirstButton(this.uiMenu);
        }
    }

    showLevelSelect() {
        this.uiMenu.style.display = 'none';
        this.uiLevelSelect.style.display = 'flex';

        // Wait for render to potentially finish if async? No, synchronous.
        // Focus first level or back button.
        this.focusFirstButton(this.uiLevelSelect);

        // NOTE: Game.js should set gameState to 'LEVEL_SELECT' when calling this.
    }

    hideLevelSelect() {
        this.uiLevelSelect.style.display = 'none';
        this.uiMenu.style.display = 'flex';
        this.focusFirstButton(this.uiMenu);
    }

    showMenu() {
        this.uiLoading.style.display = 'none';
        this.uiMenu.style.display = 'flex';
        this.uiGame.style.display = 'none';
        this.uiPause.style.display = 'none';
        this.uiSettings.style.display = 'none';
        this.uiLevelSelect.style.display = 'none';
        this.uiLevelComplete.style.display = 'none';
        this.focusFirstButton(this.uiMenu);
    }

    showGame() {
        this.uiMenu.style.display = 'none';
        this.uiGame.style.display = 'block';
        this.uiLevelSelect.style.display = 'none';
        this.uiLevelComplete.style.display = 'none';
    }

    togglePause(isPaused) {
        if (isPaused) {
            this.uiPause.style.display = 'flex';
            this.focusFirstButton(this.uiPause);
        } else {
            this.uiPause.style.display = 'none';
        }
    }

    showLevelComplete(isLastLevel) {
        if (isLastLevel) {
            this.btnNextLevel.innerText = "THE END";
        } else {
            this.btnNextLevel.innerText = "NEXT LEVEL";
        }
        this.uiLevelComplete.style.display = 'flex';
        this.focusFirstButton(this.uiLevelComplete);
    }

    hideLevelComplete() {
        this.uiLevelComplete.style.display = 'none';
    }

    showCredits() {
        this.uiLevelComplete.style.display = 'none';
        this.uiGame.style.display = 'none';
        this.uiCredits.style.display = 'block';
    }

    hideCredits() {
        this.uiCredits.style.display = 'none';
    }

    hideWinText() {
        document.getElementById('level-text').style.display = 'none';
    }

    focusFirstButton(container) {
        const firstBtn = container.querySelector('button, input');
        if (firstBtn) {
            firstBtn.focus();
        }
    }
}
