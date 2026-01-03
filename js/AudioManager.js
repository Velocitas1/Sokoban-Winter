export class AudioManager {
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
