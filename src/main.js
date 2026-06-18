import { Game } from './game.js';
import { requireUnlock } from './gate.js';

window.addEventListener('DOMContentLoaded', () => {
  requireUnlock().then(() => {
    window.__game = new Game();
  });
});
