const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// UI
const bornButtonsEl = document.getElementById("bornButtons");
const aliveButtonsEl = document.getElementById("aliveButtons");
const stepGapEl = document.getElementById("stepGap");
const speedMsEl = document.getElementById("speedMs");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const stepNumEl = document.getElementById("stepNum");

// Canvas size (fits inside previewFrame)
canvas.width = 700;
canvas.height = 500;

// Asset
const img = new Image();
img.src = "assets/glyph.png";

// State
let grid = null;
let originalGrid = null;

let running = false;
let step = 0;

let tick = 0;
let stepGap = parseInt(stepGapEl?.value ?? "3", 10) || 3;

let speedMs = parseInt(speedMsEl?.value ?? "300", 10) || 300;
let intervalId = null;

// Sets for Born/Alive
// Defaults: classic Game of Life (B3/S23)
const bornSet = new Set([3]);
const aliveSet = new Set([2, 3]);

// ---------- helpers ----------
function deepCopyGrid(g) {
  return g.map(row => row.slice());
}

function updateStepLabel() {
  if (stepNumEl) stepNumEl.textContent = String(step);
}

function makeButtonGrid(container, setRef) {
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i <= 8; i++) {
    const btn = document.createElement("button");
    btn.className = "btnCell";
    btn.type = "button";
    btn.textContent = String(i);

    if (setRef.has(i)) btn.classList.add("active");

    btn.addEventListener("click", () => {
      if (setRef.has(i)) {
        setRef.delete(i);
        btn.classList.remove("active");
      } else {
        setRef.add(i);
        btn.classList.add("active");
      }
    });

    container.appendChild(btn);
  }
}

// ---------- PNG -> 0/1 GRID ----------
function buildGridFromPng(image) {
  const off = document.createElement("canvas");
  off.width = image.width;
  off.height = image.height;
  const offCtx = off.getContext("2d");

  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(image, 0, 0);

  const data = offCtx.getImageData(0, 0, image.width, image.height).data;

  const threshold = 200;
  const g = [];

  for (let y = 0; y < image.height; y++) {
    const row = [];
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const r = data[i];
      const gg = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + gg + b) / 3;
      row.push(brightness < threshold ? 1 : 0);
    }
    g.push(row);
  }

  return g;
}

// ---------- COUNT 8 NEIGHBORS ----------
function countNeighbors(g, x, y) {
  const h = g.length;
  const w = g[0].length;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        count += g[ny][nx];
      }
    }
  }
  return count;
}

// ---------- LIFE-OF-FONT STYLE STEP (Born/Alive sets) ----------
function stepCA(currentGrid) {
  const h = currentGrid.length;
  const w = currentGrid[0].length;
  const next = Array.from({ length: h }, () => Array(w).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = countNeighbors(currentGrid, x, y);
      const isAlive = currentGrid[y][x] === 1;

      if (!isAlive) next[y][x] = bornSet.has(n) ? 1 : 0;
      else next[y][x] = aliveSet.has(n) ? 1 : 0;
    }
  }

  return next;
}

// ---------- DRAW (Life-of-Font-ish dots) ----------
function renderGrid(g) {
  const height = g.length;
  const width = g[0].length;

  // paper
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // fit glyph
  const cellSize = Math.floor(Math.min(canvas.width / width, canvas.height / height));
  const xOffset = Math.floor((canvas.width - width * cellSize) / 2);
  const yOffset = Math.floor((canvas.height - height * cellSize) / 2);

  // dot + gap
  const gap = Math.max(1, Math.floor(cellSize * 0.25));
  const dot = Math.max(1, cellSize - gap);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (g[y][x] === 1) {
        ctx.fillStyle = "#333";
        ctx.fillRect(
          xOffset + x * cellSize + Math.floor(gap / 2),
          yOffset + y * cellSize + Math.floor(gap / 2),
          dot,
          dot
        );
      }
    }
  }
}

// ---------- SIM STEP ----------
function doOneStep() {
  if (!running || !grid) return;

  tick++;
  if (tick % stepGap !== 0) return;

  grid = stepCA(grid);
  step++;
  updateStepLabel();
  renderGrid(grid);
}

function restartInterval() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(doOneStep, speedMs);
}

// ---------- UI wiring ----------
if (stepGapEl) {
  stepGapEl.addEventListener("change", () => {
    stepGap = parseInt(stepGapEl.value, 10) || 1;
  });
}

if (speedMsEl) {
  speedMsEl.addEventListener("change", () => {
    speedMs = parseInt(speedMsEl.value, 10) || 300;
    restartInterval();
  });
}

if (playBtn) {
  playBtn.addEventListener("click", () => {
    running = !running;
    playBtn.textContent = running ? "Pause" : "Play";
  });
}

function resetSim() {
  if (!originalGrid) return;
  grid = deepCopyGrid(originalGrid);
  step = 0;
  tick = 0;
  updateStepLabel();
  renderGrid(grid);
}

if (resetBtn) {
  resetBtn.addEventListener("click", resetSim);
}

window.addEventListener("keydown", (e) => {
  if (!grid) return;

  if (e.code === "Space") {
    running = !running;
    if (playBtn) playBtn.textContent = running ? "Pause" : "Play";
  }

  if (e.key === "r" || e.key === "R") resetSim();
});

// ---------- START ----------
img.onload = () => {
  grid = buildGridFromPng(img);
  originalGrid = deepCopyGrid(grid);

  makeButtonGrid(bornButtonsEl, bornSet);
  makeButtonGrid(aliveButtonsEl, aliveSet);

  updateStepLabel();
  renderGrid(grid);

  restartInterval();
};

img.onerror = () => console.log("Could not load assets/glyph.png");
