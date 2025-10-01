// mines.js
import { Application, Container, Graphics, Text } from "pixi.js";
import { DropShadowFilter } from "@pixi/filter-drop-shadow";

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

function smoothstep(edge0, edge1, x) {
  const range = edge1 - edge0;
  if (range === 0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / range));
  return t * t * (3 - 2 * t);
}

export async function createMinesGame(mount, opts = {}) {
  // Options
  const GRID = opts.grid ?? 5;
  let mines = Math.max(1, Math.min(opts.mines ?? 5, GRID * GRID - 1));
  const bg = opts.background ?? "#121212";
  const fontFamily =
    opts.fontFamily ?? "Inter, system-ui, -apple-system, Segoe UI, Arial";
  const initialSize = Math.max(1, opts.size ?? 400); // default 400

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
  board.sortableChildren = true;
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

  const animatedTiles = new Set();

  app.ticker.add((delta) => {
    if (!animatedTiles.size) return;
    const dt = Math.min(0.064, delta / 60);
    animatedTiles.forEach((tile) => {
      if (!tile._content) {
        animatedTiles.delete(tile);
        return;
      }
      if (!updateTileAnimation(tile, dt)) {
        animatedTiles.delete(tile);
      }
    });
  });

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

  function createTile(row, col, size) {
    const r = Math.min(18, size * 0.18); // rounded radius
    const pad = Math.max(7, Math.floor(size * 0.08)); // inset padding

    // Base/front face (card face-down)
    const frontCard = new Graphics()
      .roundRect(0, 0, size, size, r)
      .fill(PALETTE.tileBase)
      .stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.9 });

    const frontInset = new Graphics()
      .roundRect(pad, pad, size - pad * 2, size - pad * 2, Math.max(8, r - 6))
      .fill(PALETTE.tileInset);

    const front = new Container();
    front.addChild(frontCard, frontInset);

    // Back face (card face-up)
    const backCard = new Graphics()
      .roundRect(0, 0, size, size, r)
      .fill(PALETTE.tileBase)
      .stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.95 });

    const backInset = new Graphics()
      .roundRect(pad, pad, size - pad * 2, size - pad * 2, Math.max(8, r - 6))
      .fill(PALETTE.tileInset);

    const symbol = new Text({
      text: "",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: Math.floor(size * 0.45),
        fontWeight: "700",
        align: "center",
      },
    });
    symbol.anchor.set(0.5);
    symbol.position.set(size / 2, size / 2);
    symbol.visible = true;
    symbol.alpha = 0;

    const back = new Container();
    back.visible = false;
    back.addChild(backCard, backInset, symbol);

    const content = new Container();
    content.pivot.set(size / 2, size / 2);
    content.position.set(size / 2, size / 2);
    content.addChild(front, back);

    const t = new Container();
    t.addChild(content);
    t.eventMode = "static";
    t.cursor = "pointer";
    t.row = row;
    t.col = col;
    t.isMine = false;
    t.revealed = false;
    t._content = content;
    t._front = front;
    t._frontCard = frontCard;
    t._frontInset = frontInset;
    t._back = back;
    t._backCard = backCard;
    t._backInset = backInset;
    t._txt = symbol;
    t._tileSize = size;
    t._tileRadius = r;
    t._tilePad = pad;
    t._hover = { value: 0, target: 0 };
    t._flip = {
      value: 0,
      duration: 0.45,
      active: false,
      face: null,
      halfApplied: false,
    };

    // Hover: gently lift the inner panel
    t.on("pointerover", () => {
      if (!gameOver && !waitingForChoice && !t.revealed && selectedTile !== t) {
        frontInset.tint = PALETTE.hoverTint;
        setTileHover(t, true);
      }
    });
    t.on("pointerout", () => {
      if (!waitingForChoice && !t.revealed && selectedTile !== t) {
        frontInset.tint = 0xffffff;
        setTileHover(t, false);
      }
    });

    t.on("pointertap", () => {
      if (gameOver || waitingForChoice || t.revealed) return;
      enterWaitingState(t);
    });

    t.filters = [
      new DropShadowFilter({
        blur: 4,
        quality: 3,
        distance: 2,
        alpha: 0.35,
        color: 0x000000,
        rotation: Math.PI / 6,
      }),
    ];

    updateTileTransforms(t);

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

  function scheduleTileAnimation(tile) {
    animatedTiles.add(tile);
  }

  function setTileHover(tile, active) {
    if (!tile) return;
    if (tile.revealed && active) return;
    const target = active ? 1 : 0;
    if (!tile._hover) tile._hover = { value: 0, target };
    if (tile._hover.target === target) return;
    tile._hover.target = target;
    scheduleTileAnimation(tile);
  }

  function startTileFlip(tile, face) {
    if (!tile._flip) {
      tile._flip = {
        value: 0,
        duration: 0.45,
        active: false,
        face: null,
        halfApplied: false,
      };
    }
    tile._flip.value = 0;
    tile._flip.active = true;
    tile._flip.face = face;
    tile._flip.halfApplied = false;
    scheduleTileAnimation(tile);
  }

  function applyTileFace(tile, face) {
    if (!face) return;
    const {
      _backCard: backCard,
      _backInset: backInset,
      _tileSize: size,
      _tileRadius: r,
      _tilePad: pad,
    } = tile;
    flipFace(backCard, size, size, r, face.cardColor);
    flipInset(backInset, size, size, r, pad, face.insetColor);
    if (tile._txt) {
      if (face.textColor) {
        tile._txt.style.fill = face.textColor;
      }
      tile._txt.visible = true;
      tile._txt.alpha = 0;
    }
  }

  function updateTileAnimation(tile, dt) {
    let animating = false;
    const hover = tile._hover;
    if (hover) {
      const diff = hover.target - hover.value;
      if (Math.abs(diff) > 0.0005) {
        const smoothing = 10; // controls easing speed for hover lift
        const step = 1 - Math.exp(-smoothing * dt);
        hover.value += diff * step;
        if (Math.abs(hover.target - hover.value) < 0.0005) {
          hover.value = hover.target;
        }
        animating = true;
      } else {
        hover.value = hover.target;
      }
    }

    const flip = tile._flip;
    if (flip) {
      if (flip.active) {
        const step = dt / Math.max(0.001, flip.duration);
        flip.value = Math.min(1, flip.value + step);
        if (!flip.halfApplied && flip.value >= 0.5) {
          flip.halfApplied = true;
          applyTileFace(tile, flip.face);
        }
        if (flip.value >= 1) {
          flip.value = 1;
          flip.active = false;
        }
        animating = true;
      } else if (flip.value > 0 && flip.value < 1) {
        // settle scale towards the resting state
        flip.value = Math.min(1, flip.value + dt * 2);
        if (flip.value >= 1) flip.value = 1;
        animating = flip.value < 1;
      }
    }

    updateTileTransforms(tile);
    return animating;
  }

  function updateTileTransforms(tile) {
    const content = tile._content;
    if (!content) return;

    const hoverValue = tile._hover?.value ?? 0;
    const flipValue = tile._flip?.value ?? 0;
    const flipActive = !!tile._flip?.active;
    const hoverLift = hoverValue * Math.min(12, tile._tileSize * 0.14);
    const baseScale = 1 + hoverValue * 0.045;
    const tilt = hoverValue * 0.16;

    if (typeof tile._baseX === "number") tile.x = tile._baseX;
    if (typeof tile._baseY === "number") tile.y = tile._baseY - hoverLift;

    const angle = flipValue * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const minWidth = 0.12;
    const frontWidth = Math.max(minWidth, Math.max(0, cos));
    const backWidth = Math.max(minWidth, Math.max(0, -cos));
    const perspective = sin * 0.32;
    const wobble = sin * 0.07;

    content.scale.set(baseScale);
    content.skew.x = -tilt * 0.28;
    content.skew.y = perspective;
    content.rotation = wobble;
    content.position.set(
      tile._tileSize / 2,
      tile._tileSize / 2 - hoverLift * 0.3
    );

    if (tile._front && tile._back) {
      const blend = smoothstep(0.35, 0.65, flipValue);
      const frontAlpha = tile.revealed ? 1 - blend : 1;
      const backAlpha = tile.revealed ? blend : 0;

      tile._front.visible = frontAlpha > 0.001;
      tile._back.visible = backAlpha > 0.001 || (tile.revealed && (flipActive || flipValue >= 1));
      tile._front.alpha = frontAlpha;
      tile._back.alpha = backAlpha;
      tile._front.scale.set(frontWidth, 1);
      tile._back.scale.set(backWidth, 1);
    }

    if (tile._txt) {
      const symbolAlpha = tile.revealed ? smoothstep(0.45, 0.8, flipValue) : 0;
      tile._txt.alpha = symbolAlpha;
      tile._txt.visible = tile.revealed && symbolAlpha > 0.01;
    }

    const flipWeight = flipActive ? 20 : 0;
    const hoverWeight = hoverValue > 0.01 ? 10 : 0;
    tile.zIndex = (tile._baseZ ?? 0) + hoverWeight + flipWeight;
  }

  function revealTile(tile) {
    const txt = tile._txt;
    tile.revealed = true;
    tile.eventMode = "none";
    setTileHover(tile, false);

    const face = tile.isMine
      ? {
          text: "💣",
          cardColor: PALETTE.bombA,
          insetColor: PALETTE.bombB,
          textColor: 0xfff0f0,
        }
      : {
          text: "💎",
          cardColor: PALETTE.safeA,
          insetColor: PALETTE.safeB,
          textColor: 0xe6fff4,
        };

    txt.text = face.text;
    txt.visible = false;
    txt.alpha = 0;
    tile._frontInset.tint = 0xffffff;

    startTileFlip(tile, face);

    if (tile.isMine) {
      gameOver = true;
      revealAllMines();
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
  }

  function buildBoard() {
    clearSelection();
    board.removeChildren();
    tiles = [];
    animatedTiles.clear();
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
        tile._baseZ = r * GRID + c;
        tile.zIndex = tile._baseZ;
        tile._baseX = tile.x;
        tile._baseY = tile.y;
        tile._hover.value = 0;
        tile._hover.target = 0;
        tile._flip.value = 0;
        tile._flip.active = false;
        tile._flip.halfApplied = false;
        tile._flip.face = null;
        tile._content.scale.set(1, 1);
        tile._content.skew.set(0, 0);
        tile._content.position.set(tile._tileSize / 2, tile._tileSize / 2);
        tile._front.visible = true;
        tile._front.alpha = 1;
        tile._front.scale.set(1, 1);
        tile._frontInset.tint = 0xffffff;
        tile._back.visible = false;
        tile._back.alpha = 0;
        tile._back.scale.set(1, 1);
        tile._txt.text = "";
        tile._txt.visible = false;
        tile._txt.alpha = 0;
        updateTileTransforms(tile);
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

  function revealAllMines() {
    tiles.forEach((t) => {
      if (t.isMine && !t.revealed) {
        t.revealed = true;
        t.eventMode = "none";
        setTileHover(t, false);
        const face = {
          text: "💣",
          cardColor: PALETTE.bombA,
          insetColor: PALETTE.bombB,
          textColor: 0xfff0f0,
        };
        t._txt.text = face.text;
        t._txt.visible = false;
        t._txt.alpha = 0;
        t._frontInset.tint = 0xffffff;
        startTileFlip(t, face);
      }
    });
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
    animatedTiles.clear();
    app.destroy(true);
    if (app.canvas?.parentNode === root) root.removeChild(app.canvas);
  }

  function enterWaitingState(tile) {
    waitingForChoice = true;
    selectedTile = tile;
    tile._frontInset.tint = PALETTE.hoverTint;
    statusText.text = "Awaiting card content...";
    statusText.style.fill = 0xffe066;
    onChange(getState());
  }

  function clearSelection() {
    if (selectedTile && !selectedTile.revealed) {
      selectedTile._frontInset.tint = 0xffffff;
      setTileHover(selectedTile, false);
    }
    waitingForChoice = false;
    selectedTile = null;
  }

  function setSelectedCardIsDiamond() {
    if (!waitingForChoice || !selectedTile || selectedTile.revealed) return;
    selectedTile.isMine = false;
    const tile = selectedTile;
    waitingForChoice = false;
    selectedTile = null;
    revealTile(tile);
  }

  function SetSelectedCardIsBomb() {
    if (!waitingForChoice || !selectedTile || selectedTile.revealed) return;
    selectedTile.isMine = true;
    const tile = selectedTile;
    waitingForChoice = false;
    selectedTile = null;
    revealTile(tile);
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
