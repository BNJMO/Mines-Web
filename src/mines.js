import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Rectangle,
  AnimatedSprite,
  Assets,
  Sprite,
} from "pixi.js";

// Sound will be loaded inside createMinesGame function
import Ease from "./ease.js";
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

const PALETTE = {
  appBg: 0x0b1a22, // page/canvas background
  tileBase: 0xE3E552, // main tile face
  tileInset: 0xE3E552, // inner inset
  tileStroke: 0x161616, // subtle outline
  hover: 0xDFE0AC, // hover
  pressedTint: 0x7a7a7a,
  defaultTint: 0xffffff,
  bombA: 0x721c26,
  bombAUnrevealed: 0x26090c,
  bombB: 0x5a0f16,
  bombBUnrevealed: 0x2d070b,
  safeA: 0x163d2b,
  safeAUnrevealed: 0x081610,
  safeB: 0x103526,
  safeBUnrevealed: 0x081c13,
};

function tween(app, { duration = 300, update, complete, ease = (t) => t }) {
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    update?.(ease(t));
    if (t >= 1) {
      app.ticker.remove(step);
      complete?.();
    }
  };
  app.ticker.add(step);
}

export async function createMinesGame(mount, opts = {}) {
  // Load sound library
  let sound;
  try {
    const soundModule = await import("@pixi/sound");
    sound = soundModule.sound;
  } catch (e) {
    console.warn("Sounds disabled:", e.message);
    // Dummy sound object - must call callbacks to prevent hanging!
    sound = {
      add: (alias, options) => {
        if (options && options.loaded) {
          setTimeout(() => options.loaded(), 0);
        }
      },
      play: () => {},
      stop: () => {},
      exists: () => false,
    };
  }

  // Options
  const GRID = opts.grid ?? 5;
  let mines = Math.max(1, Math.min(opts.mines ?? 5, GRID * GRID - 1));
  const fontFamily =
    opts.fontFamily ?? "Inter, system-ui, -apple-system, Segoe UI, Arial";
  const initialSize = Math.max(1, opts.size ?? 400);
  const onCardSelected = opts.onCardSelected ?? null;
  const backgroundColor = opts.backgroundColor ?? PALETTE.appBg;

  // Visuals
  const diamondTexturePath = opts.dimaondTexturePath ?? diamondTextureUrl;
  const bombTexturePath = opts.bombTexturePath ?? bombTextureUrl;
  const iconSizePercentage = opts.iconSizePercentage ?? 0.7;
  const iconRevealedSizeFactor = opts.iconRevealedSizeFactor ?? 0.85;
  const cardsSpawnDuration = opts.cardsSpawnDuration ?? 350;
  const revealAllIntervalDelay = opts.revealAllIntervalDelay ?? 40;

  // Animation Options
  /* Card Hover */
  const hoverEnabled = opts.hoverEnabled ?? true;
  const hoverEnterDuration = opts.hoverEnterDuration ?? 120;
  const hoverExitDuration = opts.hoverExitDuration ?? 200;
  const hoverTiltAxis = opts.hoverTiltAxis ?? "x"; // 'y' | 'x'
  const hoverSkewAmount = opts.hoverSkewAmount ?? 0.02;

  /* Card Selected Wiggle */
  const wiggleSelectionEnabled = opts.wiggleSelectionEnabled ?? true;
  const wiggleSelectionDuration = opts.wiggleSelectionDuration ?? 900;
  const wiggleSelectionTimes = opts.wiggleSelectionTimes ?? 15;
  const wiggleSelectionIntensity = opts.wiggleSelectionIntensity ?? 0.03;
  const wiggleSelectionScale = opts.wiggleSelectionScale ?? 0.005;

  /* Card Reveal Flip */
  const flipDelayMin = opts.flipDelayMin ?? 150;
  const flipDelayMax = opts.flipDelayMax ?? 500;
  const flipDuration = opts.flipDuration ?? 300;
  const flipEaseFunction = opts.flipEaseFunction ?? "easeInOutSine";

  /* Bomb Explosion shake */
  const explosionShakeEnabled = opts.explosionShakeEnabled ?? true;
  const explosionShakeDuration = opts.explosionShakeDuration ?? 1000;
  const explosionShakeAmplitude = opts.explosionShakeAmplitude ?? 6;
  const explosionShakerotationAmplitude =
    opts.explosionShakerotationAmplitude ?? 0.012;
  const explosionShakeBaseFrequency = opts.explosionShakeBaseFrequency ?? 8;
  const explosionShakeSecondaryFrequency =
    opts.explosionShakeSecondaryFrequency ?? 13;

  /* Bomb Explosion spritesheet */
  const explosionSheetEnabled = opts.explosionSheetEnabled ?? true;
  const explosionSheetPath = opts.explosionSheetPath ?? explosionSheetUrl;
  const explosionSheetCols = opts.explosionSheetCols ?? 7;
  const explosionSheetRows = opts.explosionSheetRows ?? 3;
  const explosionSheetFps = opts.explosionSheetFps ?? 24;
  const explosionSheetScaleFit = opts.explosionSheetScaleFit ?? 0.8;
  const explosionSheetOpacity = opts.explosionSheetOpacity ?? 0.75;

  /* Sound effects */
  const tileTappedSoundPath = opts.tileTappedSoundPath ?? tileTappedSoundUrl;
  const tileSelectedSoundPath =
    opts.tileSelectedSoundPath ?? tileSelectedSoundUrl;
  const tileFlipSoundPath = opts.tileFlipSoundPath ?? tileFlipSoundUrl;
  const tileHoverSoundPath = opts.tileHoverSoundPath ?? tileHoverSoundUrl;
  const diamondRevealedSoundPath =
    opts.diamondRevealedSoundPath ?? diamondRevealedSoundUrl;
  const bombRevealedSoundPath =
    opts.bombRevealedSoundPath ?? bombRevealedSoundUrl;
  const winSoundPath = opts.winSoundPath ?? winSoundUrl;
  const gameStartSoundPath = opts.gameStartSoundPath ?? gameStartSoundUrl;

  const soundEffectPaths = {
    tileTapped: tileTappedSoundPath,
    tileSelected: tileSelectedSoundPath,
    tileFlip: tileFlipSoundPath,
    tileHover: tileHoverSoundPath,
    diamondRevealed: diamondRevealedSoundPath,
    bombRevealed: bombRevealedSoundPath,
    win: winSoundPath,
    gameStart: gameStartSoundPath,
  };

  const enabledSoundKeys = new Set(
    Object.entries(soundEffectPaths)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key)
  );

  const SOUND_ALIASES = {
    tileTapped: "mines.tileTapped",
    tileSelected: "mines.tileSelected",
    tileFlip: "mines.tileFlip",
    tileHover: "mines.tileHover",
    diamondRevealed: "mines.diamondRevealed",
    bombRevealed: "mines.bombRevealed",
    win: "mines.win",
    gameStart: "mines.gameStart",
  };

  /* Win pop-up */
  const winPopupShowDuration = opts.winPopupShowDuration ?? 260;
  const winPopupWidth = opts.winPopupWidth ?? 240;
  const winPopupHeight = opts.winPopupHeight ?? 170;

  // Resolve mount element
  const root =
    typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!root) throw new Error("createMinesGame: mount element not found");

  root.style.position = root.style.position || "relative";
  root.style.aspectRatio = root.style.aspectRatio || "1 / 1";
  if (!root.style.width && !root.style.height) {
    root.style.width = `${initialSize}px`;
    root.style.maxWidth = "100%";
  }
  // Debug helpers
  function debugOverlay(msg) {
    try {
      let el = root.querySelector('.mines-debug');
      if (!el) {
        el = document.createElement('div');
        el.className = 'mines-debug';
        Object.assign(el.style, {
          position: 'absolute', left: '8px', top: '8px', zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', color: '#0f0', font: '12px monospace',
          padding: '4px 6px', borderRadius: '4px', pointerEvents: 'none'
        });
        root.appendChild(el);
      }
      el.textContent = String(msg);
    } catch {}
  }
  function dlog(label, data) {
    try { console.log('[MINES]', label, data ?? ''); } catch {}
  }


  let explosionFrames = null;
  let explosionFrameW = 0;
  let explosionFrameH = 0;
  try {
    dlog('load: explosion sheet start');
    await loadExplosionFrames();
    dlog('load: explosion sheet ok', { frameW: explosionFrameW, frameH: explosionFrameH });
  } catch (e) {
    console.error('loadExplosionFrames failed', e);
    debugOverlay('Explosion sheet load failed');
  }

  let diamondTexture = null;
  try {
    dlog('load: diamond start');
    await loadDiamondTexture();
    dlog('load: diamond ok');
  } catch (e) {
    console.error('loadDiamondTexture failed', e);
    debugOverlay('Diamond texture load failed');
  }

  let bombTexture = null;
  try {
    dlog('load: bomb start');
    await loadBombTexture();
    dlog('load: bomb ok');
  } catch (e) {
    console.error('loadBombTexture failed', e);
    debugOverlay('Bomb texture load failed');
  }

  try {
    dlog('load: sounds start');
    await loadSoundEffects();
    dlog('load: sounds ok');
  } catch (e) {
    console.warn('loadSoundEffects failed (non-fatal)', e);
    debugOverlay('Sounds failed (ok)');
  }

  // PIXI app
  const app = new Application();
  try {
    await app.init({
      background: backgroundColor,
      width: initialSize,
      height: initialSize,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    // Clear the loading message
    root.innerHTML = '';

    // Append canvas
    root.appendChild(app.canvas);

    dlog('pixi init ok', { w: initialSize, h: initialSize, dpr: window.devicePixelRatio || 1 });
    debugOverlay('PIXI OK');
  } catch (e) {
    console.error('PIXI init failed', e);
    debugOverlay('PIXI init failed');
    throw e;
  }

  // Game state
  const board = new Container();
  const ui = new Container();
  app.stage.addChild(board, ui);

  const winPopup = createWinPopup();
  ui.addChild(winPopup.container);

  let tiles = [];
  let bombPositions = new Set();
  let gameOver = false;
  let shouldPlayStartSound = true;
  let revealedSafe = 0;
  let totalSafe = GRID * GRID - mines;
  let waitingForChoice = false;
  let selectedTile = null;

  // API callbacks
  const onWin = opts.onWin ?? (() => {});
  const onGameOver = opts.onGameOver ?? (() => {});
  const onChange = opts.onChange ?? (() => {});

  // Game setup and state. TODO: remove later

  // Public API for host integration
  function reset() {
    gameOver = false;
    clearSelection();
    hideWinPopup();
    bombPositions.clear();
    shouldPlayStartSound = true;
    buildBoard();
    centerBoard();
    onChange(getState());
  }

  function setMines(n) {
    mines = Math.max(1, Math.min(n | 0, GRID * GRID - 1));
    reset();
  }

  function getState() {
    return {
      grid: GRID,
      mines,
      revealedSafe,
      totalSafe,
      gameOver,
      waitingForChoice,
      selectedTile: selectedTile
        ? { row: selectedTile.row, col: selectedTile.col }
        : null,
    };
  }

  function destroy() {
    try {
      ro.disconnect();
    } catch {}
    app.destroy(true);
    if (app.canvas?.parentNode === root) root.removeChild(app.canvas);
  }

  function setSelectedCardIsDiamond() {
    if (selectedTile?._animating) {
      stopHover(selectedTile);
      stopWiggle(selectedTile);
    }

    if (
      !waitingForChoice ||
      !selectedTile ||
      selectedTile.revealed ||
      selectedTile._animating
    )
      return;
    waitingForChoice = false;
    const tile = selectedTile;
    selectedTile = null;
    playSoundEffect("tileSelected");
    revealTileWithFlip(tile, "diamond");
  }

  function SetSelectedCardIsBomb() {
    if (selectedTile?._animating) {
      stopHover(selectedTile);
      stopWiggle(selectedTile);
    }

    if (
      !waitingForChoice ||
      !selectedTile ||
      selectedTile.revealed ||
      selectedTile._animating
    )
      return;

    gameOver = true;
    waitingForChoice = false;
    const tile = selectedTile;
    selectedTile = null;
    playSoundEffect("tileSelected");
    revealTileWithFlip(tile, "bomb");
  }

  // Game functions
  function createWinPopup() {
    const popupWidth = winPopupWidth;
    const popupHeight = winPopupHeight;

    const container = new Container();
    container.visible = false;
    container.scale.set(0);
    container.eventMode = "none";
    container.zIndex = 1000;

    const border = new Graphics();
    border
      .roundRect(
        -popupWidth / 2 - 10,
        -popupHeight / 2 - 10,
        popupWidth + 20,
        popupHeight + 20,
        32
      )
      .fill(0x13d672);

    const inner = new Graphics();
    inner
      .roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 28)
      .fill(0x0f2b1a);

    const multiplierText = new Text({
      text: "1.00×",
      style: {
        fill: 0x69ffad,
        fontFamily,
        fontSize: 52,
        fontWeight: "700",
        align: "center",
      },
    });
    multiplierText.anchor.set(0.5);
    multiplierText.position.set(0, -20);

    const amountRow = new Container();

    const amountText = new Text({
      text: "0.00000000",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: 26,
        fontWeight: "600",
        align: "center",
      },
    });
    amountText.anchor.set(0, 0.5);
    amountRow.addChild(amountText);

    const coinContainer = new Container();
    const coinRadius = 16;
    const coinBg = new Graphics();
    coinBg.circle(0, 0, coinRadius).fill(0xf6a821);
    const coinText = new Text({
      text: "₿",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: 18,
        fontWeight: "700",
        align: "center",
      },
    });
    coinText.anchor.set(0.5);
    coinContainer.addChild(coinBg, coinText);
    amountRow.addChild(coinContainer);

    const layoutAmountRow = () => {
      const spacing = 12;
      coinContainer.position.set(amountText.width + spacing + coinRadius, 0);
      amountRow.pivot.set(amountRow.width / 2, amountRow.height / 2);
      amountRow.position.set(0, 34);
    };

    layoutAmountRow();

    container.addChild(border, inner, multiplierText, amountRow);

    return {
      container,
      multiplierText,
      amountText,
      layoutAmountRow,
    };
  }

  function positionWinPopup() {
    winPopup.container.position.set(
      app.renderer.width / 2,
      app.renderer.height / 2
    );
  }

  function hideWinPopup() {
    winPopup.container.visible = false;
    winPopup.container.scale.set(0);
  }

  function formatMultiplier(multiplierValue) {
    if (
      typeof multiplierValue === "number" &&
      Number.isFinite(multiplierValue)
    ) {
      return `${multiplierValue.toFixed(2)}×`;
    }

    const raw = `${multiplierValue ?? ""}`;
    if (!raw) return "";
    return raw.endsWith("×") ? raw : `${raw}×`;
  }

  function formatAmount(amountValue) {
    if (typeof amountValue === "number" && Number.isFinite(amountValue)) {
      return amountValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      });
    }

    return `${amountValue ?? ""}`;
  }

  function spawnWinPopup(multiplierValue, amountValue) {
    winPopup.multiplierText.text = formatMultiplier(multiplierValue);
    winPopup.amountText.text = formatAmount(amountValue);
    winPopup.layoutAmountRow();
    positionWinPopup();

    winPopup.container.visible = true;
    winPopup.container.alpha = 1;
    winPopup.container.scale.set(0);

    tween(app, {
      duration: winPopupShowDuration,
      ease: (t) => Ease.easeOutQuad(t),
      update: (p) => {
        winPopup.container.scale.set(p);
      },
    });
  }

  async function loadDiamondTexture() {
    if (diamondTexture) return;

    diamondTexture = await Assets.load(diamondTexturePath);
  }

  async function loadBombTexture() {
    if (bombTexture) return;

    bombTexture = await Assets.load(bombTexturePath);
  }

  async function loadExplosionFrames() {
    if (explosionFrames) return;

    const baseTex = await Assets.load(explosionSheetPath);

    const sheetW = baseTex.width;
    const sheetH = baseTex.height;

    explosionFrameW = Math.floor(sheetW / explosionSheetCols);
    explosionFrameH = Math.floor(sheetH / explosionSheetRows);

    explosionFrames = [];
    for (let r = 0; r < explosionSheetRows; r++) {
      for (let c = 0; c < explosionSheetCols; c++) {
        const rect = new Rectangle(
          c * explosionFrameW,
          r * explosionFrameH,
          explosionFrameW,
          explosionFrameH
        );

        explosionFrames.push(
          new Texture({ source: baseTex.source, frame: rect })
        );
      }
    }
  }

  function loadSoundEffect(key, path) {
    if (!enabledSoundKeys.has(key) || !path) {
      return Promise.resolve();
    }

    const alias = SOUND_ALIASES[key];
    if (!alias) {
      return Promise.resolve();
    }

    if (sound.exists?.(alias)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      sound.add(alias, {
        url: path,
        preload: true,
        loaded: resolve,
        error: resolve,
      });
    });
  }

  async function loadSoundEffects() {
    const loaders = Object.entries(soundEffectPaths).map(([key, path]) =>
      loadSoundEffect(key, path)
    );

    await Promise.all(loaders);
  }

  function playSoundEffect(key) {
    if (!enabledSoundKeys.has(key)) return;

    const alias = SOUND_ALIASES[key];
    if (!alias) return;

    try {
      sound.play(alias);
    } catch (err) {
      // Ignore playback errors so they don't interrupt gameplay
    }
  }

  function spawnExplosionSheetOnTile(tile) {
    if (!explosionSheetEnabled || !explosionFrames || !explosionFrames.length)
      return;

    const anim = new AnimatedSprite(explosionFrames);
    anim.loop = false;
    anim.animationSpeed = explosionSheetFps / 60;
    anim.anchor.set(0.5);
    anim.alpha = explosionSheetOpacity;

    const size = tile._tileSize;
    anim.position.set(size / 2, size / 2);

    const sx = (size * explosionSheetScaleFit) / explosionFrameW;
    const sy = (size * explosionSheetScaleFit) / explosionFrameH;
    anim.scale.set(Math.min(sx, sy));

    const wrap = tile._wrap;
    const iconIndex = wrap.getChildIndex(tile._icon);
    wrap.addChildAt(anim, iconIndex);

    anim.onComplete = () => {
      anim.destroy();
    };
    anim.play();
  }

  function bombShakeTile(tile) {
    if (!explosionShakeEnabled || tile._bombShaking) return;
    tile._bombShaking = true;

    const duration = explosionShakeDuration;
    const amp = explosionShakeAmplitude;
    const rotAmp = explosionShakerotationAmplitude;
    const f1 = explosionShakeBaseFrequency;
    const f2 = explosionShakeSecondaryFrequency;

    const bx = tile._baseX ?? tile.x;
    const by = tile._baseY ?? tile.y;
    const r0 = tile.rotation;

    const phiX1 = Math.random() * Math.PI * 2;
    const phiX2 = Math.random() * Math.PI * 2;
    const phiY1 = Math.random() * Math.PI * 2;
    const phiY2 = Math.random() * Math.PI * 2;

    tween(app, {
      duration,
      ease: (t) => t,
      update: (p) => {
        const decay = Math.exp(-5 * p);
        const w1 = p * Math.PI * 2 * f1;
        const w2 = p * Math.PI * 2 * f2;

        const dx =
          (Math.sin(w1 + phiX1) + 0.5 * Math.sin(w2 + phiX2)) * amp * decay;
        const dy =
          (Math.cos(w1 + phiY1) + 0.5 * Math.sin(w2 + phiY2)) * amp * decay;

        tile.x = bx + dx;
        tile.y = by + dy;

        tile.rotation = r0 + Math.sin(w2 + phiX1) * rotAmp * decay;
      },
      complete: () => {
        tile.x = bx;
        tile.y = by;
        tile.rotation = r0;
        tile._bombShaking = false;
      },
    });
  }

  function getSkew(wrap) {
    return hoverTiltAxis === "y" ? wrap.skew.y : wrap.skew.x;
  }

  function setSkew(wrap, v) {
    if (hoverTiltAxis === "y") wrap.skew.y = v;
    else wrap.skew.x = v;
  }

  function hoverTile(tile, on) {
    if (!hoverEnabled || tile._animating) return;

    const startScale = tile._wrap.scale.x;
    const endScale = on ? 1.03 : 1.0;

    const startSkew = getSkew(tile._wrap);
    const endSkew = on ? hoverSkewAmount : 0;

    const startY = tile.y;
    const endY = on ? tile._baseY - 3 : tile._baseY;

    const token = Symbol("hover");
    tile._hoverToken = token;

    // Change color
    const card = tile._card;
    const inset = tile._inset;
    const size = tile._tileSize;
    const r = tile._tileRadius;
    const pad = tile._tilePad;
    const faceColor = on ? PALETTE.hover : PALETTE.tileBase;
    flipFace(card, size, size, r, faceColor);
    const insetColor = on ? PALETTE.hover : PALETTE.tileBase;
    flipInset(inset, size, size, r, pad, insetColor);

    tween(app, {
      duration: on ? hoverEnterDuration : hoverExitDuration,
      ease: (x) => (on ? 1 - Math.pow(1 - x, 3) : x * x * x),
      update: (p) => {
        if (tile._hoverToken !== token) return;
        const s = startScale + (endScale - startScale) * p;
        tile._wrap.scale.x = tile._wrap.scale.y = s;

        const k = startSkew + (endSkew - startSkew) * p;
        setSkew(tile._wrap, k);

        tile.y = startY + (endY - startY) * p;
      },
      complete: () => {
        if (tile._hoverToken !== token) return;
        tile._wrap.scale.set(endScale);
        setSkew(tile._wrap, endSkew);
        tile.y = endY;
      },
    });
  }

  function wiggleTile(t) {
    if (!wiggleSelectionEnabled || t._animating) return;

    const wrap = t._wrap;
    const baseSkew = getSkew(wrap);
    const baseScale = wrap.scale.x;

    t._animating = true;

    const token = Symbol("wiggle");
    t._wiggleToken = token;

    tween(app, {
      duration: wiggleSelectionDuration,
      ease: (p) => p,
      update: (p) => {
        if (t._wiggleToken !== token) return;
        const wiggle =
          Math.sin(p * Math.PI * wiggleSelectionTimes) *
          wiggleSelectionIntensity;
        setSkew(wrap, baseSkew + wiggle);

        const scaleWiggle =
          1 +
          Math.sin(p * Math.PI * wiggleSelectionTimes) * wiggleSelectionScale;
        wrap.scale.x = wrap.scale.y = baseScale * scaleWiggle;
      },
      complete: () => {
        if (t._wiggleToken !== token) return;
        setSkew(wrap, baseSkew);
        wrap.scale.x = wrap.scale.y = baseScale;
        t._animating = false;
      },
    });
  }

  function stopHover(t) {
    t._hoverToken = Symbol("hover-cancelled");
  }

  function stopWiggle(t) {
    t._wiggleToken = Symbol("wiggle-cancelled");
    t._animating = false;
  }

  function createTile(row, col, size) {
    const raduis = Math.min(18, size * 0.18);
    const pad = Math.max(7, Math.floor(size * 0.08));

    const card = new Graphics()
      .roundRect(0, 0, size, size, raduis)
      .fill(PALETTE.tileBase)
      .stroke({ color: PALETTE.tileStroke, width: 5, alpha: 0.9 });

    const inset = new Graphics()
      .roundRect(pad, pad, size - pad * 2, size - pad * 2, Math.max(8, raduis - 6))
      .fill(PALETTE.tileInset);

    const icon = new Sprite();
    icon.anchor.set(0.5);
    icon.x = size / 2;
    icon.y = size / 2;
    icon.visible = false;

    // Centered wrapper – flip happens here
    const flipWrap = new Container();
    flipWrap.addChild(card, inset, icon);
    flipWrap.position.set(size / 2, size / 2);
    flipWrap.pivot.set(size / 2, size / 2);

    const t = new Container();
    t.addChild(flipWrap);

    t.eventMode = "static";
    t.cursor = "pointer";
    t.row = row;
    t.col = col;
    t.revealed = false;
    t._animating = false;

    t._wrap = flipWrap;
    t._card = card;
    t._inset = inset;
    t._icon = icon;
    t._tileSize = size;
    t._tileRadius = raduis;
    t._tilePad = pad;

    // Spwan animation
    const s0 = 0.0001;
    flipWrap.scale.set(s0);
    tween(app, {
      duration: cardsSpawnDuration,
      ease: (x) => Ease.easeOutBack(x),
      update: (p) => {
        const s = s0 + (1 - s0) * p;
        flipWrap.scale.set(s);
      },
      complete: () => {
        flipWrap.scale.set(1, 1);
      },
    });

    t.on("pointerover", () => {
      const untapedCount = tiles.filter((t) => !t.taped).length;
      if (untapedCount <= mines) return;

      if (
        !gameOver &&
        !waitingForChoice &&
        !t.revealed &&
        !t._animating &&
        selectedTile !== t
      ) {
        if (hoverEnabled) {
          playSoundEffect("tileHover");
        }
        hoverTile(t, true);

        if (t._pressed) {
          t._inset.tint = PALETTE.pressedTint;
          t._card.tint = PALETTE.pressedTint;
        }
      }
    });
    t.on("pointerdown", () => {
      const untapedCount = tiles.filter((t) => !t.taped).length;
      if (
        gameOver ||
        waitingForChoice ||
        t.revealed ||
        t._animating ||
        untapedCount <= mines
      )
        return;
      t._inset.tint = PALETTE.pressedTint;
      t._card.tint = PALETTE.pressedTint;
      t._pressed = true;
    });
    t.on("pointerup", () => {
      if (t._pressed) {
        t._pressed = false;
        t._inset.tint = PALETTE.defaultTint;
        t._card.tint = PALETTE.defaultTint;
      }
    });
    t.on("pointerout", () => {
      if (!t.revealed && !t._animating && selectedTile !== t) {
        hoverTile(t, false);
        if (t._pressed) {
          t._pressed = false;
          t._inset.tint = PALETTE.defaultTint;
          t._card.tint = PALETTE.defaultTint;
        }
      }
    });
    t.on("pointerupoutside", () => {
      if (t._pressed) {
        t._pressed = false;
        t._inset.tint = PALETTE.defaultTint;
        t._card.tint = PALETTE.defaultTint;
      }
    });
    t.on("pointertap", () => {
      totalSafe;

      const untapedCount = tiles.filter((t) => !t.taped).length;
      if (
        gameOver ||
        waitingForChoice ||
        t.revealed ||
        t._animating ||
        untapedCount <= mines
      )
        return;

      playSoundEffect("tileTapped");
      t.taped = true;
      hoverTile(t, false);
      enterWaitingState(t);
    });

    return t;
  }

  function flipFace(graphic, w, h, r, color, stroke = true) {
    graphic.clear().roundRect(0, 0, w, h, r).fill(color);
    if (stroke) {
      graphic.stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.9 });
    }
  }

  function flipInset(graphic, w, h, r, pad, color) {
    graphic
      .clear()
      .roundRect(pad, pad, w - pad * 2, h - pad * 2, Math.max(8, r - 6))
      .fill(color);
  }

  function easeFlip(t) {
    switch (flipEaseFunction) {
      case "easeInOutBack":
        return Ease.easeInOutBack(t);

      case "easeInOutSine":
        return Ease.easeInOutSine(t);
    }
  }

  function forceFlatPose(t) {
    t._hoverToken = Symbol("hover-kill");
    t._wiggleToken = Symbol("wiggle-kill");

    const w = t._wrap;

    const clampOnce = () => {
      w.scale.set(1, 1);
      w.skew.set(0, 0);
      w.rotation = 0;

      t.scale?.set(1, 1);
      t.skew?.set(0, 0);
      t.rotation = 0;

      t.y = t._baseY ?? t.y;
    };

    clampOnce();

    app.ticker.addOnce(clampOnce);
    app.ticker.addOnce(clampOnce);
  }

  function revealTileWithFlip(
    tile,
    face /* "diamond" | "bomb" */,
    revealedByPlayer = true
  ) {
    if (tile._animating || tile.revealed) return;

    const unrevealed = tiles.filter((t) => !t.revealed).length;
    const revealedCount = tiles.length - unrevealed;
    const progress = Math.min(1, revealedCount / tiles.length);
    const flipDelay = revealedByPlayer
      ? flipDelayMin + (flipDelayMax - flipDelayMin) * progress
      : flipDelayMin;
    setTimeout(() => {
      stopHover(tile);
      stopWiggle(tile);
      const wrap = tile._wrap;
      const card = tile._card;
      const inset = tile._inset;
      const icon = tile._icon;
      const radius = tile._tileRadius;
      const pad = tile._tilePad;
      const size = tile._tileSize;

      tile._animating = true;

      if (revealedByPlayer) {
        playSoundEffect("tileFlip");
      }

      const startScaleY = wrap.scale.y;
      const startSkew = getSkew(wrap);

      let swapped = false;

      if (!revealedByPlayer) {
        icon.alpha = 0.5;
      }

      tween(app, {
        duration: flipDuration,
        ease: (t) => easeFlip(t),
        update: (t) => {
          const widthFactor = Math.max(0.0001, Math.abs(Math.cos(Math.PI * t)));

          const elev = Math.sin(Math.PI * t);
          const popS = 1 + 0.06 * elev;

          const biasSkew =
            (tile._tiltDir ?? (startSkew >= 0 ? +1 : -1)) *
            0.22 *
            Math.sin(Math.PI * t);
          const skewOut = startSkew * (1 - t) + biasSkew;

          wrap.scale.x = widthFactor * popS;
          wrap.scale.y = startScaleY * popS;
          setSkew(wrap, skewOut);

          if (!swapped && t >= 0.5) {
            swapped = true;
            icon.visible = true;
            const iconSizeFactor = revealedByPlayer
              ? 1.0
              : iconRevealedSizeFactor;
            const maxW = tile._tileSize * iconSizePercentage * iconSizeFactor;
            const maxH = tile._tileSize * iconSizePercentage * iconSizeFactor;
            icon.width = maxW;
            icon.height = maxH;

            if (face === "bomb") {
              icon.texture = bombTexture;
              const facePalette = revealedByPlayer
                ? PALETTE.bombA
                : PALETTE.bombAUnrevealed;
              flipFace(card, size, size, radius, facePalette);
              const insetPalette = revealedByPlayer
                ? PALETTE.bombB
                : PALETTE.bombBUnrevealed;
              flipInset(inset, size, size, radius, pad, insetPalette);

              if (revealedByPlayer) {
                spawnExplosionSheetOnTile(tile);
                bombShakeTile(tile);
                playSoundEffect("bombRevealed");
              }
            } else {
              // Diamond
              icon.texture = diamondTexture;

              const facePalette = revealedByPlayer
                ? PALETTE.safeA
                : PALETTE.safeAUnrevealed;
              flipFace(card, size, size, radius, facePalette);
              const insetPalette = revealedByPlayer
                ? PALETTE.safeB
                : PALETTE.safeBUnrevealed;
              flipInset(inset, size, size, radius, pad, insetPalette);

              if (revealedByPlayer) {
                playSoundEffect("diamondRevealed");
              }
            }
          }
        },
        complete: () => {
          forceFlatPose(tile);
          tile._animating = false;
          tile.revealed = true;

          if (revealedByPlayer) {
            if (face === "bomb") {
              revealAllTiles(tile);
              onGameOver();
            } else {
              revealedSafe += 1;
              if (revealedSafe >= totalSafe) {
                gameOver = true;
                revealAllTiles();
                playSoundEffect("win");
                onWin();
              }
            }

    dlog('buildBoard: tiles', { count: tiles.length, size: tileSize, gap });

    try { debugOverlay(`Tiles: ${tiles.length}`); } catch {}

            onChange(getState());
          }
        },
      });
    try { window.__mines_tiles = tiles.length; } catch {}

    }, flipDelay);
  }

  function revealAllTiles(triggeredBombTile) {
    const unrevealed = tiles.filter((t) => !t.revealed);
    const bombsNeeded = mines - 1;
    let available = unrevealed.filter((t) => t !== triggeredBombTile);

    // Shuffle available tiles
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
      stopHover(available[i]);
    }

    // Pick bombs
    const bombTiles = available.slice(0, bombsNeeded);
    bombTiles.forEach((t) => bombPositions.add(`${t.row},${t.col}`));

    // Reveal all unrevealed tiles
    unrevealed.forEach((t, idx) => {
      const key = `${t.row},${t.col}`;
      const isBomb = bombPositions.has(key);

      // stagger them slightly for effect
      setTimeout(() => {
        revealTileWithFlip(t, isBomb ? "bomb" : "diamond", false);
      }, revealAllIntervalDelay * idx);
    });
  }

  function buildBoard() {
    clearSelection();
    board.removeChildren();
    tiles = [];
    revealedSafe = 0;
    totalSafe = GRID * GRID - mines;

    const { tileSize, gap, boardSize } = layoutSizes();
    const startX = -boardSize / 2;
    const startY = -boardSize / 2;

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const tile = createTile(r, c, tileSize);
        tile.x = startX + c * (tileSize + gap);
        tile.y = startY + r * (tileSize + gap);
        tile._baseX = tile.x;
        tile._baseY = tile.y;
        board.addChild(tile);
        tiles.push(tile);
      }
    }

    if (shouldPlayStartSound) {
      playSoundEffect("gameStart");
      shouldPlayStartSound = false;
    }
  }

  function layoutSizes() {
    const canvasSize = Math.min(app.renderer.width, app.renderer.height);
    const topSpace = 32;
    const boardSize = Math.max(40, canvasSize - topSpace - 10);
    const gap = Math.max(10, Math.floor(boardSize * 0.02));
    const totalGaps = gap * (GRID - 1);
    const tileSize = Math.floor((boardSize - totalGaps) / GRID);
    return { tileSize, gap, boardSize };
  }

  function centerBoard() {
    board.position.set(app.renderer.width / 2, app.renderer.height / 2 + 12);
    board.scale.set(1);
    positionWinPopup();
  }

  function resizeSquare() {
    dlog('resizeSquare', { cw: root.clientWidth, ch: root.clientHeight });

    const cw = Math.max(1, root.clientWidth || initialSize);
    const ch = Math.max(1, root.clientHeight || cw);
    dlog('centerBoard', { x: board.position.x, y: board.position.y, rw: app.renderer.width, rh: app.renderer.height });
    try { debugOverlay(`Tiles: ${tiles.length}`); } catch {}

    const size = Math.floor(Math.min(cw, ch));
    app.renderer.resize(size, size);
    buildBoard();
    centerBoard();
    positionWinPopup();
  }

  function enterWaitingState(tile) {
    waitingForChoice = true;
    selectedTile = tile;

    if (onCardSelected) {
      onCardSelected({
        row: tile.row,
        col: tile.col,
        tile: tile,
      });
    }

    const sy = getSkew(tile._wrap) || 0;
    tile._tiltDir = sy >= 0 ? +1 : -1;

    wiggleTile(tile);
    onChange(getState());
  }

  function clearSelection() {
    if (selectedTile && !selectedTile.revealed) {
      hoverTile(selectedTile, false);
      selectedTile._inset.tint = 0xffffff;
    }
    waitingForChoice = false;
    selectedTile = null;
  }

  resizeSquare();
  // Kick one extra layout tick after mount to cover late size changes
  setTimeout(resizeSquare, 0);

  const ro = new ResizeObserver(() => resizeSquare());
  ro.observe(root);

  return {
    app,
    reset,
    setMines,
    getState,
    destroy,
    setSelectedCardIsDiamond,
    SetSelectedCardIsBomb,
    showWinPopup: spawnWinPopup,
  };
}
