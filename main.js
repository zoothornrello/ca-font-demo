// main.js — loads glyph PNGs from assets/fonts/<fontFolder>/<CHAR>.png
// Builds a grid from the composed word image, then runs Life-like CA (born/alive sets).

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const fontSelect = document.getElementById("fontSelect");
const textInput = document.getElementById("textInput");

const cellSizeEl = document.getElementById("cellSize");
const cellSizeVal = document.getElementById("cellSizeVal");

const stepGapEl = document.getElementById("stepGap");
const speedEl = document.getElementById("speed");

const bornRow = document.getElementById("bornRow");
const aliveRow = document.getElementById("aliveRow");

const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");

const stepNumEl = document.getElementById("stepNum");

// ---- CONFIG: add more fonts by adding another entry (folder must exist)
const FONTS = [
  { id: "satoshi", label: "Satoshi" },
  // { id: "yourfontfolder", label: "Your Font Name" },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SPACE_NAME = "space";

// ---- State
let running = false;
let step = 0;
let tick = 0;

let cellSize = parseInt(cellSizeEl.value, 10);
let stepGap = parseInt(stepGapEl.value, 10);
let targetFPS = parseInt(speedEl.value, 10);

let bornSet = new Set([3]);        // classic Life default
let aliveSet = new Set([2, 3]);    // classic Life default

let grid = null;
let originalGrid = null;

// We run CA on the "grid resolution" derived from the word image.
// Rendering uses cellSize (pixel size).

function resizeCanvas() {
  // fixed to match preview; CA grid scales inside by cellSize
  canvas.width = 700;
  canvas.height = 500;
}
resizeCanvas();

function updateStepLabel() {
  stepNumEl.textContent = String(step);
}

function deepCopyGrid(g) {
  return g.map(row => row.slice());
}

// --- Toggle UI builder
function buildToggleRow(container, setRef) {
  container.innerHTML = "";
  for (let i = 0; i <= 8; i++) {
    const btn = document.createElement("div");
    btn.className = "toggle" + (setRef.has(i) ? " on" : "");
    btn.textContent = String(i);
    btn.addEventListener("click", () => {
      if (setRef.has(i)) setRef.delete(i);
      else setRef.add(i);
      btn.classList.toggle("on");
    });
    container.appendChild(btn);
  }
}

buildToggleRow(bornRow, bornSet);
buildToggleRow(aliveRow, aliveSet);

// --- Populate font dropdown
for (const f of FONTS) {
  const opt = document.createElement("option");
  opt.value = f.id;
  opt.textContent = f.label;
  fontSelect.appendChild(opt);
}

// --- Load an image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// --- Convert a bitmap glyph image to a 0/1 grid
function gridFromGlyphImage(img, threshold = 200) {
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const offCtx = off.getContext("2d");
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(img, 0, 0);

  const data = offCtx.getImageData(0, 0, img.width, img.height).data;
  const g = [];
  for (let y = 0; y < img.height; y++) {
    const row = [];
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const r = data[i], gg = data[i + 1], b = data[i + 2];
      const brightness = (r + gg + b) / 3;
      row.push(brightness < threshold ? 1 : 0);
    }
    g.push(row);
  }
  return g;
}

// --- Stitch multiple glyph grids into one big grid (word)
function stitchWord(grids, spacing = 1) {
  if (grids.length === 0) return [[0]];

  const h = Math.max(...grids.map(g => g.length));
  const widths = grids.map(g => (g[0] ? g[0].length : 0));
  const totalW = widths.reduce((a, b) => a + b, 0) + spacing * (grids.length - 1);

  const out = Array.from({ length: h }, () => Array(totalW).fill(0));

  let xCursor = 0;
  for (let idx = 0; idx < grids.length; idx++) {
    const g = grids[idx];
    const gh = g.length;
    const gw = g[0].length;

    // top-align; you can center-align later if you want
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        out[y][xCursor + x] = g[y][x];
      }
    }

    xCursor += gw + spacing;
  }

  return out;
}

// --- CA step using born/alive sets (8-neighborhood)
function stepLife(current) {
  const h = current.length;
  const w = current[0].length;
  const next = Array.from({ length: h }, () => Array(w).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) {
            n += current[yy][xx] ? 1 : 0;
          }
        }
      }

      const alive = current[y][x] === 1;
      if (!alive && bornSet.has(n)) next[y][x] = 1;
      else if (alive && aliveSet.has(n)) next[y][x] = 1;
      else next[y][x] = 0;
    }
  }

  return next;
}

// --- Render grid as small squares on white paper
function renderGrid(g) {
  const h = g.length;
  const w = g[0].length;

  // background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // fit into canvas based on cellSize
  const drawW = w * cellSize;
  const drawH = h * cellSize;
  const x0 = Math.floor((canvas.width - drawW) / 2);
  const y0 = Math.floor((canvas.height - drawH) / 2);

  // draw pixels
  ctx.fillStyle = "#333";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] === 1) {
        ctx.fillRect(x0 + x * cellSize, y0 + y * cellSize, cellSize, cellSize);
      }
    }
  }
}

// --- Generate: load glyphs for typed text, stitch, set grid
async function generateFromText() {
  const fontId = fontSelect.value;
  let txt = (textInput.value || "").toUpperCase();

  // keep only A-Z and space
  txt = txt.replace(/[^A-Z ]/g, "");
  if (txt.length === 0) txt = "M";

  const glyphGrids = [];

  for (const ch of txt) {
    const file = (ch === " ") ? `${SPACE_NAME}.png` : `${ch}.png`;
    const src = `assets/fonts/${fontId}/${file}`;

    try {
      const img = await loadImage(src);
      glyphGrids.push(gridFromGlyphImage(img));
    } catch (e) {
      console.warn("Missing glyph:", src);
      // fallback: treat as space
      try {
        const img = await loadImage(`assets/fonts/${fontId}/${SPACE_NAME}.png`);
        glyphGrids.push(gridFromGlyphImage(img));
      } catch {
        // absolute fallback blank 10px wide
        glyphGrids.push(Array.from({ length: 40 }, () => Array(10).fill(0)));
      }
    }
  }

  const wordGrid = stitchWord(glyphGrids, 2);

  grid = wordGrid;
  originalGrid = deepCopyGrid(wordGrid);
  step = 0;
  tick = 0;
  updateStepLabel();
  renderGrid(grid);
}

// --- Animation loop with speed + stepGap
let lastTime = 0;
function loop(ts) {
  const interval = 1000 / targetFPS;
  if (running && grid) {
    if (!lastTime) lastTime = ts;
    const elapsed = ts - lastTime;
    if (elapsed >= interval) {
      lastTime = ts - (elapsed % interval);
      tick++;
      if (tick % stepGap === 0) {
        grid = stepLife(grid);
        step++;
        updateStepLabel();
        renderGrid(grid);
      }
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- UI wiring
cellSizeEl.addEventListener("input", () => {
  cellSize = parseInt(cellSizeEl.value, 10);
  cellSizeVal.textContent = String(cellSize);
  if (grid) renderGrid(grid);
});

stepGapEl.addEventListener("change", () => {
  stepGap = parseInt(stepGapEl.value, 10) || 1;
});

speedEl.addEventListener("change", () => {
  targetFPS = parseInt(speedEl.value, 10) || 30;
  lastTime = 0;
});

generateBtn.addEventListener("click", () => {
  generateFromText();
});

playBtn.addEventListener("click", () => {
  running = !running;
  playBtn.textContent = running ? "Pause" : "Play";
  lastTime = 0;
});

resetBtn.addEventListener("click", () => {
  if (!originalGrid) return;
  grid = deepCopyGrid(originalGrid);
  step = 0;
  tick = 0;
  updateStepLabel();
  renderGrid(grid);
});

// keyboard shortcuts
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
    playBtn.textContent = running ? "Pause" : "Play";
    lastTime = 0;
  }
  if (e.key === "r" || e.key === "R") {
    if (!originalGrid) return;
    grid = deepCopyGrid(originalGrid);
    step = 0;
    tick = 0;
    updateStepLabel();
    renderGrid(grid);
  }
  if (e.key === "Enter") {
    generateFromText();
  }
});

// initial render
generateFromText();
