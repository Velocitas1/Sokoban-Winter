import { TILE, TILE_SIZE } from './constants.js';

export class LevelManager {
    constructor() {
        this.manifest = null;
    }

    async loadManifest() {
        try {
            const response = await fetch('Levels/levels.json');
            const data = await response.json();
            this.manifest = data.levels;
            return this.manifest;
        } catch (e) {
            console.error("Failed to load level manifest", e);
            return [];
        }
    }

    async loadLevelFromPath(path) {
        try {
            const response = await fetch(path);
            const levelData = await response.json();
            return this.parseLevel(levelData);
        } catch (e) {
            console.error("Failed to load level", path);
            return null;
        }
    }

    parseLevel(levelData) {
        // Return a cleaner structure if needed, or just raw data
        // For now, let's process the grid here to find start pos? 
        // Or let Game handle that. The original code did it in loadLevel.
        // Let's keep it raw here and let Game handle state.
        // Actually, let's make it helper friendly.

        return levelData;
    }
}
