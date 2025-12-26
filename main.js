// main.js — FULL REPLACE VERSION (FIXED DEFAULT ZOOM + LESS PADDING)
// Fixes included:
// - Default zoom = 1 (so it FITS, no clipping by default)
// - WORLD_PADDING reduced to 20 (less extra width, still allows expansion)
// - No more word cut-off: render via offscreen bitmap + scaled draw
// - Pixel Size = sampling resolution (rebuild on Generate)
// - Zoom = visual scale (instant)

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Offscreen canvas for crisp scaling (prevents clipping + allows downscale)
const offCanvas = document.createElement("canvas");
const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });

// ---- UI ----
const fontSelect = document.getElementById("fontSelect");
const textInput = document.getElementById("textInput");

const pixelSizeEl = document.getElementById("cellSize");      // sampling step
const pixelSizeVal = document.getElementById("cellSizeVal");

const zoomEl = document.getElementById("zoom");               // visual zoom
const zoomVal = document.getElementById("zoomVal");

const stepGapEl = document.getElementById("stepGap");
const speedEl = document.getElementById("speed");

const bornRow = document.getElementById("bornRow");
const aliveRow = document.getElementById("aliveRow");

const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");

const stepNumEl = document.getElementById("stepNum");

// ---- CONFIG ----
const FONTS = [
  { id: "satoshi", label: "Satoshi" },
  // add more later
];

const SPACE_NAME = "space";

// Reduced padding so long words still fit better by default
const WORLD_PADDING = 20;

// black ink on white paper threshold
const BRIGHTNESS_THRESHOLD = 200;

// ---- STATE ----
let running = false;
let step = 0;
let tick = 0;
let lastTime = 0;

let sampleStep = parseInt(pixelSizeEl?.value, 10) || 4; // "Pixel size" = sampling
let zoom = parseInt(zoomEl?.value, 10) || 1;            // DEFAULT FIT = 1
let stepGap = parseInt(stepGapEl?.value, 10) || 3;
let targetFPS = parseInt(speedEl?.value, 10) || 30;

// born/alive sets (8-neighbor)
let bornSet = new Set([3]);
let aliveSet = new Set([2, 3]);

let grid = null;
let originalGrid = null;

// ---- CANVAS ----
function resizeCanvas() {
  canvas.width = 700;
  canvas.height = 500;
}
resizeCanvas();

// ---- UTILS ----
function deepCopyGrid(g) {
  return g.map(row => row.slice());
}

function updateStepLabel() {
  if (stepNumEl) stepNumEl.textContent = String(step);
}

// ---- TOGGLES ----
function buildToggleRow(container, setRef) {
  if (!container) return;
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

// ---- FONT DROPDOWN ----
if (fontSelect) {
  for (const f of FONTS) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.label;
    fontSelect.appendChild(opt);
  }
}

// ---- IMAGE LOADER ----
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

/**
 * Sample a glyph PNG into a CA grid.
 * sampleStep = number of image pixels that collapse into one CA cell.
 */
function gridFromGlyphImageSampled(img, sampleStep, threshold = BRIGHTNESS_THRESHOLD) {
  const temp = document.createElement("canvas");
  temp.width = img.width;
  temp.height = img.height;
  const c = temp.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0);

  const data = c.getImageData(0, 0, img.width, img.height).data;

  const outH = Math.ceil(img.height / sampleStep);
  const outW = Math.ceil(img.width / sampleStep);
  const g = Array.from({ length: outH }, () => Array(outW).fill(0));

  for (let cy = 0; cy < outH; cy++) {
    for (let cx = 0; cx < outW; cx++) {
      let sum = 0;
      let count = 0;

      const y0 = cy * sampleStep;
      const x0 = cx * sampleStep;

      for (let y = y0; y < y0 + sampleStep && y < img.height; y++) {
        for (let x = x0; x < x0 + sampleStep && x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          const r = data[i];
          const gg = data[i + 1];
          const b = data[i + 2];
          sum += (r + gg + b) / 3;
          count++;
        }
      }

      const avg = sum / Math.max(1, count);
      g[cy][cx] = avg < threshold ? 1 : 0;
    }
  }

  return g;
}

/**
 * Stitch glyph grids horizontally into a single word grid.
 */
function stitchWord(grids, spacing = 2) {
  if (grids.length === 0) return [[0]];
  const h = Math.max(...grids.map(g => g.length));
  const widths = grids.map(g => g[0]?.length || 0);
  const totalW = widths.reduce((a, b) => a + b, 0) + spacing * (grids.length - 1);

  const out = Array.from({ length: h }, () => Array(totalW).fill(0));

  let xCursor = 0;
  for (let idx = 0; idx < grids.length; idx++) {
    const g = grids[idx];
    const gh = g.length;
    const gw = g[0].length;

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        out[y][xCursor + x] = g[y][x];
      }
    }
    xCursor += gw + spacing;
  }
  return out;
}

/**
 * Center-pad a grid into a larger empty world.
 */
function padGridCenter(small, paddingCells = WORLD_PADDING) {
  const sh = small.length;
  const sw = small[0].length;

  const bigH = sh + paddingCells * 2;
  const bigW = sw + paddingCells * 2;

  const big = Array.from({ length: bigH }, () => Array(bigW).fill(0));

  const yOff = paddingCells;
  const xOff = paddingCells;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      big[yOff + y][xOff + x] = small[y][x];
    }
  }
  return big;
}

/**
 * One Life-like CA step using born/alive sets.
 */
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

/**
 * RENDER — no clipping, supports huge grids.
 * Offscreen bitmap scaled into main canvas with smoothing off.
 */
function renderGrid(g) {
  const h = g.length;
  const w = g[0].length;

  // main background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // offscreen = exact grid size
  offCanvas.width = w;
  offCanvas.height = h;

  const imgData = offCtx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (g[y][x] === 1) {
        data[i] = 51;
        data[i + 1] = 51;
        data[i + 2] = 51;
        data[i + 3] = 255;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Fit-to-canvas * zoom (zoom default = 1 so it FITS)
  ctx.imageSmoothingEnabled = false;

  const baseScale = Math.min(canvas.width / w, canvas.height / h);
  const scale = baseScale * zoom;

  const drawW = w * scale;
  const drawH = h * scale;

  const x0 = (canvas.width - drawW) / 2;
  const y0 = (canvas.height - drawH) / 2;

  ctx.drawImage(offCanvas, x0, y0, drawW, drawH);
}

/**
 * Build CA grid from typed text (rebuild on Generate).
 */
async function generateFromText() {
  const fontId = fontSelect?.value || "satoshi";
  let txt = (textInput?.value || "").toUpperCase();

  txt = txt.replace(/[^A-Z ]/g, "");
  if (txt.length === 0) txt = "M";

  const glyphGrids = [];

  for (const ch of txt) {
    const file = (ch === " ") ? `${SPACE_NAME}.png` : `${ch}.png`;
    const src = `assets/fonts/${fontId}/${file}`;

    try {
      const img = await loadImage(src);
      glyphGrids.push(gridFromGlyphImageSampled(img, sampleStep));
    } catch (e) {
      console.warn("Missing glyph:", src);
      // fallback to space
      try {
        const img = await loadImage(`assets/fonts/${fontId}/${SPACE_NAME}.png`);
        glyphGrids.push(gridFromGlyphImageSampled(img, sampleStep));
      } catch {
        glyphGrids.push(Array.from({ length: 16 }, () => Array(8).fill(0)));
      }
    }
  }

  const wordGrid = stitchWord(glyphGrids, 2);
  const world = padGridCenter(wordGrid, WORLD_PADDING);

  grid = world;
  originalGrid = deepCopyGrid(world);

  step = 0;
  tick = 0;
  updateStepLabel();
  renderGrid(grid);
}

// ---- LOOP ----
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

// ---- UI events ----
if (pixelSizeVal) pixelSizeVal.textContent = String(sampleStep);
pixelSizeEl?.addEventListener("input", () => {
  sampleStep = parseInt(pixelSizeEl.value, 10) || 1;
  if (pixelSizeVal) pixelSizeVal.textContent = String(sampleStep);
});

// Zoom defaults to 1 (fit). If your index.html slider still says value="3",
// change it to value="1" for matching UI. This JS will show whatever the slider is.
if (zoomVal) zoomVal.textContent = String(zoom);
zoomEl?.addEventListener("input", () => {
  zoom = parseInt(zoomEl.value, 10) || 1;
  if (zoomVal) zoomVal.textContent = String(zoom);
  if (grid) renderGrid(grid);
});

stepGapEl?.addEventListener("change", () => {
  stepGap = parseInt(stepGapEl.value, 10) || 1;
});

speedEl?.addEventListener("change", () => {
  targetFPS = parseInt(speedEl.value, 10) || 30;
  lastTime = 0;
});

generateBtn?.addEventListener("click", () => {
  running = false;
  if (playBtn) playBtn.textContent = "Play";
  lastTime = 0;
  generateFromText();
});

playBtn?.addEventListener("click", () => {
  running = !running;
  playBtn.textContent = running ? "Pause" : "Play";
  lastTime = 0;
});

resetBtn?.addEventListener("click", () => {
  if (!originalGrid) return;
  running = false;
  if (playBtn) playBtn.textContent = "Play";
  grid = deepCopyGrid(originalGrid);
  step = 0;
  tick = 0;
  updateStepLabel();
  renderGrid(grid);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
    if (playBtn) playBtn.textContent = running ? "Pause" : "Play";
    lastTime = 0;
  }
  if (e.key === "r" || e.key === "R") {
    if (!originalGrid) return;
    running = false;
    if (playBtn) playBtn.textContent = "Play";
    grid = deepCopyGrid(originalGrid);
    step = 0;
    tick = 0;
    updateStepLabel();
    renderGrid(grid);
  }
  if (e.key === "Enter") {
    running = false;
    if (playBtn) playBtn.textContent = "Play";
    lastTime = 0;
    generateFromText();
  }
});

// boot
generateFromText();
