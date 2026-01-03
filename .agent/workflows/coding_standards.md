---
description: Standards for modifying and extending the codebase
---

# Coding Standards

## 1. Modular Architecture (ES6)
- **Do not use Global Scope**: All code must be encapsulated in ES6 modules.
- **Imports/Exports**: Use `import` and `export` to share functionality.
- **Entry Point**: `js/main.js` is the only entry point. `index.html` loads it with `<script type="module" src="js/main.js">`.

## 2. Component Responsibility
- **Game Logic**: Goes in `js/Game.js`.
- **DOM/HTML**: Goes in `js/UIManager.js`. `Game.js` should not manipulate DOM elements directly if possible (except Canvas).
- **Audio**: Goes in `js/AudioManager.js`.

## 3. Style Guidelines
- **Constants**: Define magic numbers and shared strings in `js/constants.js`.
- **Naming**: Classes are `PascalCase`. Variables and functions are `camelCase`. Constants are `UPPER_SNAKE_CASE`.

## 4. Web Audio API
- **User Interaction**: Always resume the `AudioContext` on the first user interaction (click/keydown) to comply with browser autoplay policies.
- **Synthesized SFX**: Prefer synthesized sounds (Oscillators/Noise Buffers) over loading many small audio files, to keep the game lightweight.
