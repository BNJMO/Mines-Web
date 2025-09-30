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
  const ui = new Container();
  app.stage.addChild(board, ui);

  let tiles = [];
  let gameOver = false;
  let revealedSafe = 0;
  let totalSafe = GRID * GRID - mines;

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

  function createTile(row, col, size) {
    const r = Math.min(18, size * 0.18); // rounded radius
    const pad = Math.max(7, Math.floor(size * 0.08)); // inset padding

    // Fake shadow under the tile (no extra packages needed)
    const shadow = new Graphics().roundRect(2, 3, size, size, r).fill(0x000000);
    shadow.alpha = 0.28;

    // Base tile
    const card = new Graphics()
      .roundRect(0, 0, size, size, r)
      .fill(PALETTE.tileBase)
      .stroke({ color: PALETTE.tileStroke, width: 2, alpha: 0.9 });

    // Inset panel (gives “pressed” look)
    const inset = new Graphics()
      .roundRect(pad, pad, size - pad * 2, size - pad * 2, Math.max(8, r - 6))
      .fill(PALETTE.tileInset);

    // Symbol (hidden until reveal)
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

    const t = new Container();
    //t.addChild(shadow, card, inset, txt);
    t.addChild(card, inset, txt);
    t.eventMode = "static";
    t.cursor = "pointer";
    t.row = row;
    t.col = col;
    t.isMine = false;
    t.revealed = false;

    // Hover: gently lift the inner panel
    t.on("pointerover", () => {
      if (!gameOver && !t.revealed) inset.tint = PALETTE.hoverTint;
    });
    t.on("pointerout", () => {
      if (!t.revealed) inset.tint = 0xffffff;
    });

    t.on("pointertap", () => {
      if (gameOver || t.revealed) return;
      revealTile(t, { card, inset, txt, r, pad, size });
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

    return t;
  }

  function flipColor(card, inner, c1, c2, /*textColor*/ _) {
    card
      .clear()
      .roundRect(0, 0, card.width, card.height, Math.min(16, card.width * 0.2))
      .fill(c1)
      .stroke({ color: 0x1f2937, width: 2 });
    inner
      .clear()
      .roundRect(
        6,
        6,
        card.width - 12,
        card.height - 12,
        Math.min(10, card.width * 0.15)
      )
      .fill(c2);
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

  function revealTile(tile, refs) {
    const { card, inset, txt, r, pad, size } = refs;
    tile.revealed = true;
    txt.visible = true;

    if (tile.isMine) {
      txt.text = "💣";
      flipFace(card, size, size, r, PALETTE.bombA);
      flipInset(inset, size, size, r, pad, PALETTE.bombB);
      gameOver = true;
      revealAllMines();
      statusText.text = "BOOM! Tap reset.";
      statusText.style.fill = 0xffaaaa;
      onGameOver();
    } else {
      txt.text = "💎";
      flipFace(card, size, size, r, PALETTE.safeA);
      flipInset(inset, size, size, r, pad, PALETTE.safeB);
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

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function buildBoard() {
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
        board.addChild(tile);
        tiles.push(tile);
      }
    }

    const indices = [...Array(GRID * GRID).keys()];
    shuffleInPlace(indices);
    const mineSet = new Set(indices.slice(0, mines));
    tiles.forEach((t, idx) => (t.isMine = mineSet.has(idx)));
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
        const txt = t.children[3];
        const card = t.children[1];
        const inset = t.children[2];
        txt.visible = true;
        txt.text = "💣";
        // match the bomb look
        flipFace(
          card,
          card.width,
          card.height,
          card.height * 0.18,
          PALETTE.bombA
        );
        flipInset(
          inset,
          card.width,
          card.height,
          card.height * 0.18,
          Math.max(7, Math.floor(card.width * 0.08)),
          PALETTE.bombB
        );
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
    };
  }
  function destroy() {
    try {
      ro.disconnect();
    } catch {}
    app.destroy(true);
    if (app.canvas?.parentNode === root) root.removeChild(app.canvas);
  }

  return { app, reset, setMines, getState, destroy };
}
