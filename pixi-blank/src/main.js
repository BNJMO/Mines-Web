import { createMinesGame } from "./mines.js";
import explosionSheetUrl from "../assets/Sprites/Explosion_Spritesheet.png";

// Mount into your element (keeps a 1:1 square; default 400x400)
const game = await createMinesGame("#mines", {
  // Window visuals
  size: 400,
  background: "#121212",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Game setup
  grid: 5,
  mines: 5,

  // Animations feel
  /* Hover */
  hoverEnterDuration: 120,
  hoverExitDuration: 200,
  hoverTiltAxis: "x", // 'y' | 'x'
  hoverSkewAmount: 0.02,

  /* Wiggle */
  wiggleDuration: 900,
  wiggleTimes: 10,
  wiggleIntensity: 0.01,
  wiggleScale: 0.02,

  /* Flip */
  flipDuration: 380,
  flipEaseFunction: "easeInOutSine",

  /* Explosion spritesheet */
  explosionSheetPath: explosionSheetUrl,
  explosionCols: 7, // number of columns in the sheet
  explosionRows: 3, // number of rows in the sheet
  explosionFps: 24, // playback speed
  explosionScaleFit: 0.8, // how much of the tile size it occupies
  explosionOpacity: 0.75, // sprite's transparency
});

// Example: wire up your own external controls
document
  .querySelector("#resetBtn")
  ?.addEventListener("click", () => game.reset());
document
  .querySelector("#easyBtn")
  ?.addEventListener("click", () => game.setMines(3));
document
  .querySelector("#hardBtn")
  ?.addEventListener("click", () => game.setMines(10));

// Temporary helpers to test controlled reveals
document
  .querySelector("#diamondBtn")
  ?.addEventListener("click", () => game.setSelectedCardIsDiamond());
document
  .querySelector("#bombBtn")
  ?.addEventListener("click", () => game.SetSelectedCardIsBomb());

window.minesGame = game;
