import { createMinesGame } from "./mines.js";
import diamondTextureUrl from "../assets/Sprites/Diamond.png";
import bombTextureUrl from "../assets/Sprites/Bomb.png";
import explosionSheetUrl from "../assets/Sprites/Explosion_Spritesheet.png";

const game = await createMinesGame("#mines", {
  // Window visuals
  size: 600,
  backgroundColor: "#121212",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Game setup
  grid: 3,
  mines: 5,

  // Visuals
  diamondTexturePath: diamondTextureUrl,
  bombTexturePath: bombTextureUrl,
  iconSizePercentage: 0.7, // percetange (between 0 and 1) of the card's content (diamond or bomb) inside the card
  iconRevealedSizeFactor: 0.85, // mulitplier factor for the icon's size that have been revealed.
  cardsSpawnDuration: 300, // duration in ms of the animations the cards play to show up when the game begins
  revealAllIntervalDelay: 40, // Delay in ms between every card revealed on gameover

  // Animations feel
  /* Card Hover */
  hoverEnabled: true,
  hoverEnterDuration: 120, // in ms
  hoverExitDuration: 200, // in ms
  hoverTiltAxis: "x", // 'y' | 'x'
  hoverSkewAmount: 0.02, // mimic 3D tilt effect

  /* Card Selected Wiggle */
  wiggleSelectionEnabled: true,
  wiggleSelectionDuration: 900, // in ms
  wiggleSelectionTimes: 15, // how many times the card wiggles during the entire duration
  wiggleSelectionIntensity: 0.03, // intensity of the wiggle
  wiggleSelectionScale: 0.005, // scale of the wiggle

  /* Card Reveal Flip */
  flipDelayMin: 150, // Minimum range of delay in ms to flip card after its content is determined. Actual delay is proportional to the number of cards already revealed.
  flipDelayMax: 500, // Minimum range of delay in ms to flip card after its content is determined. Actual delay is proportional to the number of cards already revealed.
  flipDuration: 300, // in ms
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

  // Event callback for when a card is selected
  onCardSelected: ({ row, col, tile }) => {
    // TODO: Add code here to either call "game.SetSelectedCardIsBomb();" or "game.setSelectedCardIsDiamond();"

    // Example : Basic Random selector
    if (Math.random() < 0.005) {
      game.SetSelectedCardIsBomb();
    } else {
      game.setSelectedCardIsDiamond();
    }
  },
  onWin: () => {
    game.showWinPopup(24.75, "0.00000000");
  },
});

document
  .querySelector("#resetBtn")
  ?.addEventListener("click", () => game.reset());
document
  .querySelector("#easyBtn")
  ?.addEventListener("click", () => game.setMines(3));
document
  .querySelector("#hardBtn")
  ?.addEventListener("click", () => game.setMines(10));

document
  .querySelector("#diamondBtn")
  ?.addEventListener("click", () => game.setSelectedCardIsDiamond());
document
  .querySelector("#bombBtn")
  ?.addEventListener("click", () => game.SetSelectedCardIsBomb());

window.minesGame = game;
