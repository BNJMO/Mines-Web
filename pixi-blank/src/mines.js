// mines.js
import { Application, Container, Graphics, Text } from "pixi.js";
import { DropShadowFilter } from "@pixi/filter-drop-shadow";
import Ease from "./ease.js";

const PALETTE = {
  appBg: 0x0b1a22, // page/canvas background
  tileBase: 0x2e4150, // main tile face
  tileInset: 0x263743, // inner inset
  tileStroke: 0x142028, // subtle outline
  hoverTint: 0x3b5461, // hover
  bombA: 0x3a0e13,
  bombB: 0x5a0f16,
  safeA: 0x0b1f16,
  safeB: 0x103526,
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
  const bg = opts.background ?? "#121212";
  const fontFamily =
    opts.fontFamily ?? "Inter, system-ui, -apple-system, Segoe UI, Arial";
  const initialSize = Math.max(1, opts.size ?? 400); // default 400

  // Animation Options
  /* Hover */
  const hoverEnterDuration = 120;
  const hoverExitDuration = 200;

  /* Wiggle */
  const wiggleDuration = 900;
  const wiggleTimes = 10;
  const wiggleIntensity = 0.05;
  const wiggleScale = 0.02;

  /* Flip */
  const flipDuration = 380;
  const flipEaseFunction = "easeInOutSine";

  // Resolve mount element
  const root =
    typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!root) throw new Error("createMinesGame: mount element not found");

  // Ensure the container is square by CSS; JS will also enforce exact pixels.
  root.style.position = root.style.position || "relative";
  root.style.aspectRatio = root.style.aspectRatio || "1 / 1";
  // If the host didn’t size the container, use a sensible default (400x400).
  if (!root.style.width && !root.style.height) {
    root.style.width = `${initialSize}px`;
    root.style.maxWidth = "100%";
  }

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
  let gameOver = false;
  let revealedSafe = 0;
  let totalSafe = GRID * GRID - mines;
  let waitingForChoice = false;
  let selectedTile = null;

  // API callbacks
  const onWin = opts.onWin ?? (() => {});
  const onGameOver = opts.onGameOver ?? (() => {});
  const onChange = opts.onChange ?? (() => {});

  // Minimal (optional) title/status – can be hidden via CSS if not desired
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

  function hoverTile(t, on) {
    // Don’t hover during flips or while a different selection is pending
    if (t._animating) return;

    // Targets (very subtle)
    const startScale = t._wrap.scale.x; // current (should be 1 when idle)
    const endScale = on ? 1.03 : 1.0; // tiny pop
    const startSkew = t._wrap.skew.y;
    const endSkew = on ? 0.06 : 0.0; // slight perspective hint
    const startY = t.y;
    const endY = on ? t._baseY - 3 : t._baseY; // lift 3 px
    const sh = t._shadow;
    const sDist0 = sh.distance,
      sDist1 = on ? 4 : 2; // a bit longer shadow
    const sAlpha0 = sh.alpha,
      sAlpha1 = on ? 0.5 : 0.35;

    // Kill previous hover tween by marking a token
    const token = Symbol("hover");
    t._hoverToken = token;

    tween(app, {
      duration: on ? hoverEnterDuration : hoverExitDuration,
      ease: (x) => (on ? 1 - Math.pow(1 - x, 3) : x * x * x), // ease-out / ease-in
      update: (p) => {
        if (t._hoverToken !== token) return; // superseded
        // Lerp
        t._wrap.scale.x = t._wrap.scale.y =
          startScale + (endScale - startScale) * p;
        t._wrap.skew.y = startSkew + (endSkew - startSkew) * p;
        t.y = startY + (endY - startY) * p;
        sh.distance = sDist0 + (sDist1 - sDist0) * p;
        sh.alpha = sAlpha0 + (sAlpha1 - sAlpha0) * p;
      },
      complete: () => {
        if (t._hoverToken !== token) return;
        t._wrap.scale.set(endScale);
        t._wrap.skew.y = endSkew;
        t.y = endY;
        sh.distance = sDist1;
        sh.alpha = sAlpha1;
      },
    });
  }

  function wiggleTile(t) {
    if (t._animating) return;

    const wrap = t._wrap;
    const baseSkew = wrap.skew.y;
    const baseScale = wrap.scale.x;

    t._animating = true;

    const token = Symbol("wiggle");
    t._wiggleToken = token;

    tween(app, {
      duration: wiggleDuration, // total duration
      ease: (p) => p,
      update: (p) => {
        if (t._wiggleToken !== token) return;
        // oscillate skew around base
        const wiggle = Math.sin(p * Math.PI * wiggleTimes) * wiggleIntensity; // 2 cycles
        wrap.skew.y = baseSkew + wiggle;

        // subtle squash/stretch
        const scaleWiggle =
          1 + Math.sin(p * Math.PI * wiggleTimes) * wiggleScale;
        wrap.scale.x = wrap.scale.y = baseScale * scaleWiggle;
      },
      complete: () => {
        if (t._wiggleToken !== token) return;
        // restore to base tilt (don’t flatten!)
        wrap.skew.y = baseSkew;
        wrap.scale.x = wrap.scale.y = baseScale;
        t._animating = false;
      },
    });
  }

  function stopHover(t) {
    // invalidate any in-flight hover tween
    t._hoverToken = Symbol("hover-cancelled");
  }

  function stopWiggle(t) {
    // invalidate any in-flight wiggle tween and clear animating
    t._wiggleToken = Symbol("wiggle-cancelled");
    t._animating = false; // allow reveal to start immediately
    // Do NOT reset skew/scale/y; we want to keep the current pose
  }

  function createTile(row, col, size) {
    const r = Math.min(18, size * 0.18);
    const pad = Math.max(7, Math.floor(size * 0.08));

    const card = new Graphics()
      .roundRect(0, 0, size, size, r)
      .fill(PALETTE.tileBase)
      .stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.9 });

    const inset = new Graphics()
      .roundRect(pad, pad, size - pad * 2, size - pad * 2, Math.max(8, r - 6))
      .fill(PALETTE.tileInset);

    const txt = new Text({
      text: "",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: Math.floor(size * 0.45),
        fontWeight: "700",
      },
    });
    txt.anchor.set(0.5);
    txt.position.set(size / 2, size / 2);
    txt.visible = false;

    // Centered wrapper – flip happens here
    const flipWrap = new Container();
    flipWrap.addChild(card, inset, txt);
    flipWrap.position.set(size / 2, size / 2); // place it at tile center
    flipWrap.pivot.set(size / 2, size / 2); // rotate/scale around center

    const t = new Container();
    t.addChild(flipWrap);

    t.eventMode = "static";
    t.cursor = "pointer";
    t.row = row;
    t.col = col;
    t.revealed = false;
    t._animating = false;

    // store refs
    t._wrap = flipWrap;
    t._card = card;
    t._inset = inset;
    t._txt = txt;
    t._tileSize = size;
    t._tileRadius = r;
    t._tilePad = pad;

    // Shadow (we’ll strengthen it on hover)
    const shadow = new DropShadowFilter({
      blur: 4,
      quality: 3,
      distance: 2,
      alpha: 0.35,
      color: 0x000000,
      rotation: Math.PI / 6,
    });
    t.filters = [shadow];
    t._shadow = shadow;

    // HOVER: subtle lift (guard against waiting/animating/revealed)
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
      hoverTile(t, false); // ensure it settles before selection
      enterWaitingState(t);
    });

    return t;
  }

  function flipFace(g, w, h, r, color, stroke = true) {
    g.clear().roundRect(0, 0, w, h, r).fill(color);
    if (stroke) g.stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.9 });
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
    // Kill any in-flight hover/wiggle updates or completions.
    t._hoverToken = Symbol("hover-kill");
    t._wiggleToken = Symbol("wiggle-kill");

    // Clamp BOTH the wrapper and the outer container.
    const w = t._wrap;

    const clampOnce = () => {
      // Wrapper (where we apply flip/hover/wiggle transforms)
      w.scale.set(1, 1);
      w.skew.set(0, 0);
      w.rotation = 0;

      // Outer tile container (just in case)
      t.scale?.set(1, 1);
      t.skew?.set(0, 0);
      t.rotation = 0;

      // Vertical position back to baseline
      t.y = t._baseY ?? t.y;

      // Shadow back to idle
      if (t._shadow) {
        t._shadow.distance = 2;
        t._shadow.alpha = 0.35;
      }
    };

    // Clamp now…
    clampOnce();
    // …and clamp again next frames to beat any late tween ticks.
    app.ticker.addOnce(clampOnce);
    app.ticker.addOnce(clampOnce);
  }

  function revealTileWithFlip(tile, face /* "diamond" | "bomb" */) {
    stopHover(tile);
    stopWiggle(tile);

    if (tile._animating || tile.revealed || gameOver) return;

    const wrap = tile._wrap;
    const card = tile._card;
    const inset = tile._inset;
    const txt = tile._txt;
    const r = tile._tileRadius;
    const pad = tile._tilePad;
    const size = tile._tileSize;
    const baseY = tile._baseY ?? tile.y;

    tile._animating = true;

    // start pose (likely slightly tilted & lifted)
    const startScaleX = wrap.scale.x; // ~1.03 if hovered/selected
    const startScaleY = wrap.scale.y; // same as X
    const startSkewY = wrap.skew.y; // small tilt
    const startY = tile.y;
    const startShadowDist = tile._shadow.distance;
    const startShadowAlpha = tile._shadow.alpha;

    // direction for perspective bias (left/right)
    const dir = tile._tiltDir ?? (startSkewY >= 0 ? +1 : -1);

    let swapped = false;

    // Single tween from 0..1 using cosine to sculpt width nicely

    tween(app, {
      duration: flipDuration, // overall flip time
      ease: (t) => easeFlip(t),
      update: (t) => {
        // width follows |cos(pi t)| to look like a rotating plane
        // 1 → 0 → 1, never negative (we prevent culling)
        const widthFactor = Math.max(0.0001, Math.abs(Math.cos(Math.PI * t)));

        // subtle elevation: rises to mid, then settles
        const elev = Math.sin(Math.PI * t); // 0 → 1 → 0
        const liftY = -6 * elev; // lift up to -6px at mid
        const popS = 1 + 0.06 * elev; // slight scale-up at mid

        // perspective bias: small skew around mid, using the stored direction
        // we smoothly remove the initial skew as we approach the edge,
        // then add a tiny directional bias so it looks like the same flip direction
        const biasSkew = dir * 0.22 * Math.sin(Math.PI * t); // peak at mid
        const skewY = startSkewY * (1 - t) + biasSkew;

        // apply transforms
        wrap.scale.x = widthFactor * popS;
        wrap.scale.y = startScaleY * popS;
        wrap.skew.y = skewY;
        tile.y = baseY + liftY;

        // shadow gets longer & darker when elevated, then returns
        tile._shadow.distance = startShadowDist + (4 - startShadowDist) * elev;
        tile._shadow.alpha =
          startShadowAlpha + (0.55 - startShadowAlpha) * elev;

        // swap at midpoint (when the edge is thinnest)
        if (!swapped && t >= 0.5) {
          swapped = true;
          txt.visible = true;
          if (face === "bomb") {
            txt.text = "💣";
            flipFace(card, size, size, r, PALETTE.bombA);
            flipInset(inset, size, size, r, pad, PALETTE.bombB);
          } else {
            txt.text = "💎";
            flipFace(card, size, size, r, PALETTE.safeA);
            flipInset(inset, size, size, r, pad, PALETTE.safeB);
          }
        }
      },
      complete: () => {
        forceFlatPose(tile); // ⬅️ ensures no residual tilt
        tile._animating = false;
        tile.revealed = true;

        // End-state game logic (same as before)
        if (face === "bomb") {
          gameOver = true;
          statusText.text = "BOOM! Tap reset.";
          statusText.style.fill = 0xffaaaa;
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
      },
    });
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
        tile._baseY = tile.y; // <— baseline for hover lift
        board.addChild(tile);
        tiles.push(tile);
      }
    }
  }

  function layoutSizes() {
    const canvasSize = Math.min(app.renderer.width, app.renderer.height);
    const topSpace = 32; // compact header
    const boardSize = Math.max(40, canvasSize - topSpace - 10);
    const gap = Math.max(10, Math.floor(boardSize * 0.02)); // a bit wider than before
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
    const { boardSize } = layoutSizes();
    board.position.set(app.renderer.width / 2, app.renderer.height / 2 + 12);
    board.scale.set(1);
    // Ensure crisp layout on any size (no need to scale tiles; we rebuild on size changes)
  }

  function resizeSquare() {
    // Keep 1:1 by choosing the smaller of clientWidth/Height (fallback to width if height is 0).
    const cw = Math.max(1, root.clientWidth || initialSize);
    const ch = Math.max(1, root.clientHeight || cw);
    const size = Math.floor(Math.min(cw, ch));
    app.renderer.resize(size, size);
    buildBoard(); // rebuild tiles to the new per-tile size
    positionUI();
    centerBoard();
  }

  // Initial layout
  resizeSquare();

  // Observe container size changes (keeps the canvas perfectly square)
  const ro = new ResizeObserver(() => resizeSquare());
  ro.observe(root);

  // Public API for host integration
  function reset() {
    gameOver = false;
    clearSelection();
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

    // keep tilt; capture direction based on current skew sign
    const sy = tile._wrap.skew.y || 0;
    tile._tiltDir = sy >= 0 ? +1 : -1; // used by flip to bias the perspective

    tile._inset.tint = PALETTE.hoverTint;
    statusText.text = "Awaiting card content...";
    statusText.style.fill = 0xffe066;

    wiggleTile(tile); // you already added this in step 1
    onChange(getState());
  }

  function clearSelection() {
    if (selectedTile && !selectedTile.revealed) {
      hoverTile(selectedTile, false); // settle if it was hovered
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
