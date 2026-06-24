const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const scoreEl = document.getElementById("score");
const foundEl = document.getElementById("found");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const resultLabel = document.getElementById("resultLabel");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const upButton = document.getElementById("upButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");
const downButton = document.getElementById("downButton");
const digButton = document.getElementById("digButton");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "gem";
const DEFAULT_LEARNING_URL = "learn.html";
const CONFIG = { seconds: 30, clearScore: 200, cols: 12, rows: 8 };
const GEM_SET = [
  { name: "すいしょう", points: 10, color: "#d9fbff" },
  { name: "すいしょう", points: 10, color: "#d9fbff" },
  { name: "あめじすと", points: 15, color: "#b479ff" },
  { name: "あめじすと", points: 15, color: "#b479ff" },
  { name: "えめらるど", points: 20, color: "#43d07c" },
  { name: "えめらるど", points: 20, color: "#43d07c" },
  { name: "るびー", points: 25, color: "#ff4f7b" },
  { name: "るびー", points: 25, color: "#ff4f7b" },
  { name: "だいや", points: 30, color: "#ffffff" },
  { name: "だいや", points: 30, color: "#ffffff" },
];

let width = 0;
let height = 0;
let dpr = 1;
let cell = 40;
let offsetX = 0;
let offsetY = 0;
let running = false;
let timeLeft = CONFIG.seconds;
let score = 0;
let found = 0;
let lastTime = 0;
let board = [];
let elapsed = 0;
let player = { x: 0, y: 0 };
let particles = [];
let lastTouchEnd = 0;

requireMiniGameAccess(GAME_ID);

function requireMiniGameAccess(gameId) {
  const key = `${MINI_GAME_ACCESS_PREFIX}${gameId}`;
  if (sessionStorage.getItem(key) === "1") {
    sessionStorage.removeItem(key);
    return;
  }
  window.location.replace(getLearningUrl());
}

function getLearningUrl() {
  return sessionStorage.getItem("miniGameReturnUrl") || DEFAULT_LEARNING_URL;
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) requireMiniGameAccess(GAME_ID);
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, Math.floor(rect.width));
  height = Math.max(280, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = Math.floor(Math.min(width / CONFIG.cols, height / CONFIG.rows));
  offsetX = (width - cell * CONFIG.cols) / 2;
  offsetY = (height - cell * CONFIG.rows) / 2;
  draw();
}

function startGame() {
  running = true;
  timeLeft = CONFIG.seconds;
  elapsed = 0;
  score = 0;
  found = 0;
  player = { x: 0, y: CONFIG.rows - 1 };
  particles = [];
  board = createBoard();
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  updateHud();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function createBoard() {
  const tiles = [];
  for (let y = 0; y < CONFIG.rows; y += 1) {
    const row = [];
    for (let x = 0; x < CONFIG.cols; x += 1) {
      row.push({ hp: 2 + Math.floor(Math.random() * 4), maxHp: 5, gem: null, open: false, glowOffset: 0 });
    }
    tiles.push(row);
  }
  const spots = [];
  for (let y = 0; y < CONFIG.rows; y += 1) {
    for (let x = 0; x < CONFIG.cols; x += 1) {
      if (x || y !== CONFIG.rows - 1) spots.push({ x, y });
    }
  }
  const gems = shuffle([...GEM_SET]);
  shuffle(spots).slice(0, 10).forEach((spot, index) => {
    tiles[spot.y][spot.x].gem = gems[index];
    tiles[spot.y][spot.x].glowOffset = Math.random() * 5;
    tiles[spot.y][spot.x].hp += 1;
    tiles[spot.y][spot.x].maxHp = tiles[spot.y][spot.x].hp;
  });
  return tiles;
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  elapsed += dt;
  timeLeft -= dt;
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);
  updateHud();
  draw();
  if (score >= CONFIG.clearScore || timeLeft <= 0 || found >= GEM_SET.length) {
    finishGame(score >= CONFIG.clearScore);
    return;
  }
  requestAnimationFrame(loop);
}

function move(dx, dy) {
  if (!running) return;
  player.x = clamp(player.x + dx, 0, CONFIG.cols - 1);
  player.y = clamp(player.y + dy, 0, CONFIG.rows - 1);
  draw();
}

function dig() {
  if (!running) return;
  const tile = board[player.y][player.x];
  if (tile.open) return;
  tile.hp -= 1;
  dirtBurst(player.x, player.y);
  if (tile.hp <= 0) {
    tile.open = true;
    if (tile.gem) {
      found += 1;
      score += tile.gem.points;
      gemBurst(player.x, player.y, tile.gem.color);
    }
  }
  updateHud();
  draw();
}

function finishGame(cleared) {
  running = false;
  resultLabel.textContent = cleared ? "CLEAR!" : "RESULT";
  resultTitle.textContent = score;
  resultMessage.textContent = cleared ? "200てんたっせい！" : "レアなほうせきをねらおう。";
  finishPanel.classList.remove("hidden");
  draw();
}

function updateHud() {
  timeEl.textContent = Math.max(0, timeLeft).toFixed(1);
  scoreEl.textContent = score;
  foundEl.textContent = `${found}/${GEM_SET.length}`;
}

function draw() {
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  const skyH = offsetY + cell * 0.55;
  ctx.fillStyle = "#8ed7ff";
  ctx.fillRect(0, 0, width, skyH);
  ctx.fillStyle = "#75c85e";
  ctx.fillRect(0, skyH - 8, width, 18);
  for (let y = 0; y < CONFIG.rows; y += 1) {
    for (let x = 0; x < CONFIG.cols; x += 1) drawTile(x, y);
  }
  drawPlayer();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTile(x, y) {
  const tile = board[y]?.[x] || { open: false, hp: 1, maxHp: 1 };
  const px = offsetX + x * cell;
  const py = offsetY + y * cell;
  ctx.fillStyle = tile.open ? "#5b3b23" : y % 2 ? "#9b6b3d" : "#8d6238";
  ctx.fillRect(px, py, cell, cell);
  ctx.strokeStyle = "rgba(55, 35, 20, 0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, cell, cell);
  if (!tile.open) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px + 6, py + 6, cell - 12, Math.max(3, (cell - 12) * (tile.hp / tile.maxHp)));
    if (tile.gem) drawHiddenGemGlow(px, py, tile);
  }
  if (tile.open && tile.gem) drawGem(px + cell / 2, py + cell / 2, tile.gem.color, cell * 0.28);
}

function drawHiddenGemGlow(px, py, tile) {
  const phase = (elapsed + tile.glowOffset) % 5;
  const pulse = phase < 0.72 ? Math.sin((phase / 0.72) * Math.PI) : 0;
  if (pulse <= 0) return;
  const cx = px + cell / 2;
  const cy = py + cell / 2;
  const radius = cell * (0.22 + pulse * 0.34);
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
  glow.addColorStop(0, tile.gem.color);
  glow.addColorStop(0.35, `rgba(255, 255, 180, ${0.55 * pulse})`);
  glow.addColorStop(1, "rgba(255, 255, 180, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * pulse})`;
  ctx.lineWidth = 2 + pulse * 3;
  ctx.strokeRect(px + 5, py + 5, cell - 10, cell - 10);
  ctx.restore();
}

function drawGem(x, y, color, r) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(45,34,24,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawPlayer() {
  const x = offsetX + player.x * cell + cell / 2;
  const y = offsetY + player.y * cell + cell / 2;
  ctx.fillStyle = "#ffcf5b";
  ctx.beginPath();
  ctx.arc(x, y - cell * 0.1, cell * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2d2218";
  ctx.fillRect(x - cell * 0.2, y + cell * 0.06, cell * 0.4, cell * 0.22);
  ctx.fillStyle = "#7fd9ff";
  ctx.fillRect(x - cell * 0.18, y - cell * 0.22, cell * 0.36, cell * 0.13);
}

function dirtBurst(tx, ty) {
  const x = offsetX + tx * cell + cell / 2;
  const y = offsetY + ty * cell + cell / 2;
  for (let i = 0; i < 8; i += 1) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.7) * 160, r: 3 + Math.random() * 3, life: 0.32, maxLife: 0.32, color: "#6e4527" });
  }
}

function gemBurst(tx, ty, color) {
  const x = offsetX + tx * cell + cell / 2;
  const y = offsetY + ty * cell + cell / 2;
  for (let i = 0; i < 18; i += 1) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.8) * 220, r: 3 + Math.random() * 4, life: 0.68, maxLife: 0.68, color });
  }
}

function bindButton(button, handler) {
  let handled = false;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handled = true;
    handler();
    window.setTimeout(() => { handled = false; }, 280);
  });
  button.addEventListener("click", (event) => {
    if (handled) {
      event.preventDefault();
      return;
    }
    handler();
  });
}

function shuffle(items) {
  return items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

document.addEventListener("touchend", (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 360) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("gesturechange", (event) => event.preventDefault());
document.addEventListener("gestureend", (event) => event.preventDefault());

bindButton(startButton, startGame);
bindButton(restartButton, () => { window.location.href = getLearningUrl(); });
bindButton(upButton, () => move(0, -1));
bindButton(leftButton, () => move(-1, 0));
bindButton(rightButton, () => move(1, 0));
bindButton(downButton, () => move(0, 1));
bindButton(digButton, dig);
window.addEventListener("resize", resize);
resize();
