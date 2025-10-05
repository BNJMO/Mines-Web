import { createMinesGame } from "./mines.js";
import diamondTextureUrl from "../assets/sprites/Diamond.png";
import bombTextureUrl from "../assets/sprites/Bomb.png";
import explosionSheetUrl from "../assets/sprites/Explosion_Spritesheet.png";
import tileTappedSoundUrl from "../assets/sounds/TileTapped.ogg";
import tileSelectedSoundUrl from "../assets/sounds/TileSelected.ogg";
import tileFlipSoundUrl from "../assets/sounds/TileFlip.ogg";
import tileHoverSoundUrl from "../assets/sounds/TileHover.ogg";
import diamondRevealedSoundUrl from "../assets/sounds/DiamondRevealed.ogg";
import bombRevealedSoundUrl from "../assets/sounds/BombRevealed.ogg";
import winSoundUrl from "../assets/sounds/Win.ogg";
import gameStartSoundUrl from "../assets/sounds/GameStart.ogg";


let game;
const opts = {
  // Window visuals
  size: 600,
  backgroundColor: "#121212",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Game setup
  grid: 5,
  mines: 5,

  // Visuals
  diamondTexturePath: diamondTextureUrl,
  bombTexturePath: bombTextureUrl,
  iconSizePercentage: 0.7,
  iconRevealedSizeFactor: 0.85,
  cardsSpawnDuration: 300,
  revealAllIntervalDelay: 40,

  // Animations feel
  hoverEnabled: true,
  hoverEnterDuration: 120,
  hoverExitDuration: 200,
  hoverTiltAxis: "x",
  hoverSkewAmount: 0.02,

  // Card Selected Wiggle
  wiggleSelectionEnabled: true,
  wiggleSelectionDuration: 900,
  wiggleSelectionTimes: 15,
  wiggleSelectionIntensity: 0.03,
  wiggleSelectionScale: 0.005,

  // Card Reveal Flip
  flipDelayMin: 150,
  flipDelayMax: 500,
  flipDuration: 300,
  flipEaseFunction: "easeInOutSine",

  // Bomb Explosion shake
  explosionShakeEnabled: true,
  explosionShakeDuration: 1000,
  explosionShakeAmplitude: 6,
  explosionShakerotationAmplitude: 0.012,
  explosionShakeBaseFrequency: 8,
  explosionShakeSecondaryFrequency: 13,

  // Bomb Explosion spritesheet
  explosionSheetEnabled: true,
  explosionSheetPath: explosionSheetUrl,
  explosionSheetCols: 7,
  explosionSheetRows: 3,
  explosionSheetFps: 24,
  explosionSheetScaleFit: 0.8,
  explosionSheetOpacity: 0.75,

  // Sounds
  tileTappedSoundPath: tileTappedSoundUrl,
  tileSelectedSoundPath: tileSelectedSoundUrl,
  tileFlipSoundPath: tileFlipSoundUrl,
  tileHoverSoundPath: tileHoverSoundUrl,
  diamondRevealedSoundPath: diamondRevealedSoundUrl,
  bombRevealedSoundPath: bombRevealedSoundUrl,
  winSoundPath: winSoundUrl,
  gameStartSoundPath: gameStartSoundUrl,

  // Win pop-up
  winPopupShowDuration: 260,
  winPopupWidth: 240,
  winPopupHeight: 170,

  // Event callback for when a card is selected
  onCardSelected: ({ row, col, tile }) => {
    if (Math.random() < 0.15) {
      game?.SetSelectedCardIsBomb?.();
    } else {
      game?.setSelectedCardIsDiamond?.();
    }
  },
  onWin: () => {
    game?.showWinPopup?.(24.75, "0.00000000");
  },
};

// Initialize game
(async () => {
  try {
    game = await createMinesGame("#mines", opts);
  } catch (e) {
    console.error("Game initialization failed:", e);
    const minesDiv = document.querySelector("#mines");
    if (minesDiv) {
      minesDiv.innerHTML = `
        <div style="color: #f44336; padding: 20px; background: rgba(0,0,0,0.8); border-radius: 8px;">
          <h3>❌ Game Failed to Initialize</h3>
          <p><strong>Error:</strong> ${e.message}</p>
          <p>Check console (F12) for full details.</p>
        </div>
      `;
    }
  }
})();

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
