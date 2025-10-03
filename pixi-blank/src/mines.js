import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Rectangle,
  AnimatedSprite,
  Assets,
} from "pixi.js";
import { DropShadowFilter } from "@pixi/filter-drop-shadow";
import Ease from "./ease.js";
import explosionSheetUrl from "../assets/Sprites/Explosion_Spritesheet.png";

const PALETTE = {
  appBg: 0x0b1a22, // page/canvas background
  tileBase: 0x2e4150, // main tile face
  tileInset: 0x2e4150, // inner inset
  tileStroke: 0x142028, // subtle outline
  hoverTint: 0xfffbf7, // hover
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
  // Options
  const GRID = opts.grid ?? 5;
  let mines = Math.max(1, Math.min(opts.mines ?? 5, GRID * GRID - 1));
  const fontFamily =
    opts.fontFamily ?? "Inter, system-ui, -apple-system, Segoe UI, Arial";
  const initialSize = Math.max(1, opts.size ?? 400);
  const onCardSelected = opts.onCardSelected ?? null;

  const cardImageSizePercentage = opts.cardImageSizePercentage ?? 0.55;
  const revealAllIntervalDelay = opts.revealAllIntervalDelay ?? 50;

  // Animation Options
  /* Card Hover */
  const hoverEnabled = opts.hoverEnabled ?? true;
  const hoverEnterDuration = opts.hoverEnterDuration ?? 120;
  const hoverExitDuration = opts.hoverExitDuration ?? 200;
  const hoverTiltAxis = opts.hoverTiltAxis ?? "x"; // 'y' | 'x'
  const hoverSkewAmount = opts.hoverSkewAmount ?? 0.0;

  /* Card Selected Wiggle */
  const wiggleSelectionEnabled = opts.wiggleSelectionEnabled ?? true;
  const wiggleSelectionDuration = opts.wiggleSelectionDuration ?? 900;
  const wiggleSelectionTimes = opts.wiggleSelectionTimes ?? 10;
  const wiggleSelectionIntensity = opts.wiggleSelectionIntensity ?? 0.05;
  const wiggleSelectionScale = opts.wiggleSelectionScale ?? 0.02;

  /* Card Reveal Flip */
  const flipDelay = opts.flipDelay ?? 100;
  const flipDuration = opts.flipDuration ?? 380;
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

  let explosionFrames = null;
  let explosionFrameW = 0;
  let explosionFrameH = 0;
  await loadExplosionFrames();

  // PIXI app
  const app = new Application();
  await app.init({
    background: PALETTE.appBg,
    width: initialSize,
    height: initialSize,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  root.appendChild(app.canvas);

  // Game state
  const board = new Container();
  const ui = new Container();
  app.stage.addChild(board, ui);

  let tiles = [];
  let bombPositions = new Set();
  let gameOver = false;
  let revealedSafe = 0;
  let totalSafe = GRID * GRID - mines;
  let waitingForChoice = false;
  let selectedTile = null;

  // API callbacks
  const onWin = opts.onWin ?? (() => {});
  const onGameOver = opts.onGameOver ?? (() => {});
  const onChange = opts.onChange ?? (() => {});

  // Game setup and state. TODO: remove later
  const titleText = label(`MINES ${GRID}×${GRID}`, 18, 0xffffff);
  const statusText = label(`Safe picks: 0 / ${totalSafe}`, 14, 0xbfc7d5);
  ui.addChild(titleText, statusText);

  function label(text, size, color) {
    return new Text({
      text,
      style: {
        fill: color,
        fontFamily,
        fontSize: size,
        fontWeight: "600",
        align: "center",
      },
    });
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
    const txtIndex = wrap.getChildIndex(tile._txt);
    wrap.addChildAt(anim, txtIndex);

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

  function hoverTile(t, on) {
    if (!hoverEnabled || t._animating) return;

    const startScale = t._wrap.scale.x;
    const endScale = on ? 1.03 : 1.0;

    const startSkew = getSkew(t._wrap);
    const endSkew = on ? hoverSkewAmount : 0;

    const startY = t.y;
    const endY = on ? t._baseY - 3 : t._baseY;

    const sh = t._shadow;
    const sDist0 = sh.distance,
      sDist1 = on ? 4 : 2;
    const sAlpha0 = sh.alpha,
      sAlpha1 = on ? 0.5 : 0.35;

    const token = Symbol("hover");
    t._hoverToken = token;

    tween(app, {
      duration: on ? hoverEnterDuration : hoverExitDuration,
      ease: (x) => (on ? 1 - Math.pow(1 - x, 3) : x * x * x),
      update: (p) => {
        if (t._hoverToken !== token) return;
        const s = startScale + (endScale - startScale) * p;
        t._wrap.scale.x = t._wrap.scale.y = s;

        const k = startSkew + (endSkew - startSkew) * p;
        setSkew(t._wrap, k);

        t.y = startY + (endY - startY) * p;
        sh.distance = sDist0 + (sDist1 - sDist0) * p;
        sh.alpha = sAlpha0 + (sAlpha1 - sAlpha0) * p;
      },
      complete: () => {
        if (t._hoverToken !== token) return;
        t._wrap.scale.set(endScale);
        setSkew(t._wrap, endSkew);
        t.y = endY;
        sh.distance = sDist1;
        sh.alpha = sAlpha1;
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
    const r = Math.min(18, size * 0.18);
    const pad = Math.max(7, Math.floor(size * 0.08));

    const card = new Graphics()
      .roundRect(0, 0, size, size, r)
      .fill(PALETTE.tileBase)
      .stroke({ color: PALETTE.tileStroke, width: 5, alpha: 0.9 });

    const inset = new Graphics()
      .roundRect(pad, pad, size - pad * 2, size - pad * 2, Math.max(8, r - 6))
      .fill(PALETTE.tileInset);

    const txt = new Text({
      text: "",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: Math.floor(size * cardImageSizePercentage),
        fontWeight: "700",
      },
    });
    txt.anchor.set(0.5);
    txt.position.set(size / 2, size / 2);
    txt.visible = false;

    // Centered wrapper – flip happens here
    const flipWrap = new Container();
    flipWrap.addChild(card, inset, txt);
    flipWrap.position.set(size / 2, size / 2);
    flipWrap.pivot.set(size / 2, size / 2);

    const shadow = new DropShadowFilter({
      color: 0x21ff00,
      alpha: 1,
      blur: 20,
      distance: 32,
      rotation: Math.PI / 3, // 60°
    });
    shadow.padding = 64;
    card.filters = [shadow];

    card.filters = [shadow];
    card.filterArea = new Rectangle(-40, -40, size + 80, size + 80);

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
    t._txt = txt;
    t._tileSize = size;
    t._tileRadius = r;
    t._tilePad = pad;
    t._shadow = shadow;

    t.on("pointerover", () => {
      if (
        !gameOver &&
        !waitingForChoice &&
        !t.revealed &&
        !t._animating &&
        selectedTile !== t
      ) {
        hoverTile(t, true);
      }
    });
    t.on("pointerout", () => {
      if (!t.revealed && !t._animating && selectedTile !== t) {
        hoverTile(t, false);
      }
    });

    t.on("pointertap", () => {
      if (gameOver || waitingForChoice || t.revealed || t._animating) return;
      hoverTile(t, false);
      enterWaitingState(t);
    });

    return t;
  }

  function flipFace(g, w, h, r, color, stroke = true) {
    g.clear().roundRect(0, 0, w, h, r).fill(color);
    if (stroke) {
      g.stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.9 });
    }
  }

  function flipInset(g, w, h, r, pad, color) {
    g.clear()
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

      if (t._shadow) {
        t._shadow.distance = 2;
        t._shadow.alpha = 0.35;
      }
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

    setTimeout(() => {
      stopHover(tile);
      stopWiggle(tile);
      const wrap = tile._wrap;
      const card = tile._card;
      const inset = tile._inset;
      const txt = tile._txt;
      const r = tile._tileRadius;
      const pad = tile._tilePad;
      const size = tile._tileSize;

      tile._animating = true;

      const startScaleY = wrap.scale.y;
      const startSkew = getSkew(wrap);
      const startShadowDist = tile._shadow.distance;
      const startShadowAlpha = tile._shadow.alpha;

      let swapped = false;

      if (!revealedByPlayer) {
        txt.alpha = 0.5;
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

          tile._shadow.distance =
            startShadowDist + (4 - startShadowDist) * elev;
          tile._shadow.alpha =
            startShadowAlpha + (0.55 - startShadowAlpha) * elev;

          if (!swapped && t >= 0.5) {
            swapped = true;
            txt.visible = true;
            if (face === "bomb") {
              txt.text = "💣";
              const facePalette = revealedByPlayer
                ? PALETTE.bombA
                : PALETTE.bombAUnrevealed;
              flipFace(card, size, size, r, facePalette);
              const insetPalette = revealedByPlayer
                ? PALETTE.bombB
                : PALETTE.bombBUnrevealed;
              flipInset(inset, size, size, r, pad, insetPalette);

              if (revealedByPlayer) {
                spawnExplosionSheetOnTile(tile);
                bombShakeTile(tile);
              }
            } else {
              // Diamond
              txt.text = "💎";
              const facePalette = revealedByPlayer
                ? PALETTE.safeA
                : PALETTE.safeAUnrevealed;
              flipFace(card, size, size, r, facePalette);
              const insetPalette = revealedByPlayer
                ? PALETTE.safeB
                : PALETTE.safeBUnrevealed;
              flipInset(inset, size, size, r, pad, insetPalette);
            }
          }
        },
        complete: () => {
          forceFlatPose(tile);
          tile._animating = false;
          tile.revealed = true;

          if (revealedByPlayer) {
            if (face === "bomb") {
              statusText.text = "BOOM! Tap reset.";
              statusText.style.fill = 0xffaaaa;
              revealAllTiles(tile);
              onGameOver();
            } else {
              revealedSafe += 1;
              statusText.style.fill = 0xbfc7d5;
              statusText.text = `Safe picks: ${revealedSafe} / ${totalSafe}`;
              if (revealedSafe >= totalSafe) {
                gameOver = true;
                statusText.text = "You win! 🎉";
                statusText.style.fill = 0xc7f9cc;
                onWin();
              }
            }

            onChange(getState());
          }
        },
      });
    }, flipDelay);
  }

  function buildBoard() {
    clearSelection();
    board.removeChildren();
    tiles = [];
    revealedSafe = 0;
    totalSafe = GRID * GRID - mines;
    statusText.text = `Safe picks: 0 / ${totalSafe}`;
    statusText.style.fill = 0xbfc7d5;

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

  function positionUI() {
    const W = app.renderer.width;
    titleText.anchor.set(0.5, 0);
    statusText.anchor.set(0.5, 0);
    titleText.position.set(W / 2, 6);
    statusText.position.set(W / 2, 22);
  }

  function centerBoard() {
    board.position.set(app.renderer.width / 2, app.renderer.height / 2 + 12);
    board.scale.set(1);
  }

  function resizeSquare() {
    const cw = Math.max(1, root.clientWidth || initialSize);
    const ch = Math.max(1, root.clientHeight || cw);
    const size = Math.floor(Math.min(cw, ch));
    app.renderer.resize(size, size);
    buildBoard();
    positionUI();
    centerBoard();
  }

  resizeSquare();

  const ro = new ResizeObserver(() => resizeSquare());
  ro.observe(root);

  function revealAllTiles(triggeredBombTile) {
    const unrevealed = tiles.filter((t) => !t.revealed);
    const bombsNeeded = mines - 1;
    let available = unrevealed.filter((t) => t !== triggeredBombTile);

    // Shuffle available tiles
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
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

  // Public API for host integration
  function reset() {
    gameOver = false;
    clearSelection();
    bombPositions.clear();
    buildBoard();
    positionUI();
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

    // tile._inset.tint = PALETTE.hoverTint;
    statusText.text = "Awaiting card content...";
    statusText.style.fill = 0xffe066;

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
    revealTileWithFlip(tile, "bomb");
  }

  return {
    app,
    reset,
    setMines,
    getState,
    destroy,
    setSelectedCardIsDiamond,
    SetSelectedCardIsBomb,
  };
}
