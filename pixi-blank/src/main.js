import { createMinesGame } from './mines.js';

  // Mount into your element (keeps a 1:1 square; default 400x400)
  const game = await createMinesGame('#mines', { size: 400, mines: 5 });

  // Example: wire up your own external controls
  document.querySelector('#resetBtn')?.addEventListener('click', () => game.reset());
  document.querySelector('#easyBtn')?.addEventListener('click', () => game.setMines(3));
  document.querySelector('#hardBtn')?.addEventListener('click', () => game.setMines(10));