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
  /* Card Hover */
  hoverEnabled: true,
  hoverEnterDuration: 120, // in ms
  hoverExitDuration: 200,
  hoverTiltAxis: "x", // 'y' | 'x'
  hoverSkewAmount: 0.02,

  /* Card Selected Wiggle */
  wiggleSelectionEnabled: true,
  wiggleSelectionDuration: 900, // in ms
  wiggleSelectionTimes: 10,
  wiggleSelectionIntensity: 0.01,
  wiggleSelectionScale: 0.02,

  /* Card Reveal Flip */
  flipDuration: 380, // in ms
  flipEaseFunction: "easeInOutSine", // ease method's name from ease.js

  /* Bomb Explosion shake */
  explosionShakeEnabled: true,
  explosionShakeDuration: 1000, // in ms
  explosionShakeAmplitude: 6, // in px (peak)
  explosionShakerotationAmplitude: 0.012, // subtle rotational spice (radians)
  explosionShakeBaseFrequency: 8, // base frequency
  explosionShakeSecondaryFrequency: 13, // second frequency for richer feel

  /* Bomb Explosion spritesheet */
  explosionSheetEnabled: true,
  explosionSheetPath: explosionSheetUrl,
  explosionSheetCols: 7, // number of columns in the sheet
  explosionSheetRows: 3, // number of rows in the sheet
  explosionSheetFps: 24, // playback speed
  explosionSheetScaleFit: 0.8, // how much of the tile size it occupies
  explosionSheetOpacity: 0.75, // sprite's transparency
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
