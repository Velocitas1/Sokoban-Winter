# Project Architecture

## Overview
Sokoban Winter is a tile-based puzzle game built with vanilla HTML5 Canvas and JavaScript. It uses a modular ES6 architecture.

## Directory Structure

### `js/` - Core Logic
- **`main.js`**: Application entry point. Instantiates the `Game`.
- **`Game.js`**: The central controller. Manages the game loop (`update`, `draw`), state (`PLAYING`, `PAUSED`, etc.), and orchestrates other managers.
- **`LevelManager.js`**: Handles fetching the level manifest (`levels.json`) and parsing individual level files.
- **`AudioManager.js`**: Wraps the Web Audio API. Manages background music (BGM) loop and sound effects (SFX) synthesis (oscillators/noise).
- **`UIManager.js`**: Manages all DOM interactions. Shows/hides screens (Menu, Settings, Game) and binds event listeners to HTML buttons.
- **`constants.js`**: Shared configuration (Tile IDs, Dimensions, Directions).

### `Levels/` - Data
- **`levels.json`**: Manifest listing all available levels in order.
- **`*.json`**: Individual level data defining the grid layout.

## Key Concepts
- **State Management**: The `Game` class holds the master state (`this.gameState`). Components like `UIManager` react to state changes but do not drive them directly.
- **Input Handling**: The `Game` class listens for keyboard input. UI buttons are handled by `UIManager` which callbacks to `Game` via a binder pattern.
- **Rendering**: The game uses a `requestAnimationFrame` loop in `Game.js` to clear and redraw the canvas every frame.
