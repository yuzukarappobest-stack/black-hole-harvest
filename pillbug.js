const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const mazeNoEl = document.getElementById("mazeNo");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const resultTime = document.getElementById("resultTime");
const resultMessage = document.getElementById("resultMessage");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const upButton = document.getElementById("upButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");
const downButton = document.getElementById("downButton");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "pillbug";
const DEFAULT_LEARNING_URL = "learn.html";
const MAZES = [
  ["1111111111111", "1000001000001", "1011101011101", "1010001000101", "1010111110101", "1000100000101", "1110101110101", "1000101000001", "1011101011111", "1000000000001", "1111111111111"],
  ["1111111111111", "1000100000001", "1110101111101", "1000101000101", "1011101010101", "1000001010101", "1011111010101", "1010000010101", "1010111110101", "1000000000001", "1111111111111"],
  ["1111111111111", "1000000010001", "1011111010111", "1010001010001", "1010101111101", "1010100000101", "1010111110101", "1010001000101", "1011101011101", "1000001000001", "1111111111111"],
  ["1111111111111", "1000000000101", "1011111110101", "1010000010101", "1010111010101", "1010101010001", "1010101011111", "1000101000001", "1111101111101", "1000000000001", "1111111111111"],
  ["1111111111111", "1000100000001", "1010101111101", "1010001000101", "1011111010101", "1000000010101", "1111111010101", "1000001010101", "1011101010101", "1000100000001", "1111111111111"],
  ["1111111111111", "1000001000001", "1111101011101", "1000101010001", "1010101010111", "1010000010001", "1011111111101", "1000000010001", "1011111010111", "1000000000001", "1111111111111"],
  ["1111111111111", "1000000000001", "1011111111101", "1010000000101", "1010111110101", "1010100010101", "1010101010101", "1000101010001", "1111101011101", "1000000000001", "1111111111111"],
  ["1111111111111", "1000001000001", "1011101110101", "1000100010101", "1110111010101", "1000001010101", "1011111010101", "1010000010101", "1010111110101", "1000000000001", "1111111111111"],
  ["1111111111111", "1000100000001", "1010101111101", "1010101000001", "1010101011111", "1010001010001", "1011111010101", "1000000010101", "1111111010101", "1000000000001", "1111111111111"],
  ["1111111111111", "1000000000101", "1011111110101", "1000000010101", "1111111010101", "1000100010001", "1010101111101", "1010101000001", "1010101011111", "1000000000001", "1111111111111"],
];

let width = 0;
let height = 0;
let dpr = 1;
let cell = 30;
let offsetX = 0;
let offsetY = 0;
let maze = null;
let mazeIndex = 0;
let player = { x: 1, y: 1, px: 1, py: 1 };
let goal = { x: 11, y: 9 };
let running = false;
let elapsed = 0;
let lastTime = 0;
let best = Number(localStorage.getItem("pillbugMazeBest") || 0);
let lastTouchEnd = 0;

bestEl.textContent = best ? best.toFixed(2) : "--.--";
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
  height = Math.max(260, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = Math.floor(Math.min(width / 13, height / 11));
  offsetX = (width - cell * 13) / 2;
  offsetY = (height - cell * 11) / 2;
  draw();
}

function startGame() {
  mazeIndex = Math.floor(Math.random() * MAZES.length);
  maze = MAZES[mazeIndex];
  mazeNoEl.textContent = mazeIndex + 1;
  player = { x: 1, y: 1, px: 1, py: 1 };
  goal = { x: 11, y: 9 };
  elapsed = 0;
  running = true;
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  elapsed += dt;
  player.px += (player.x - player.px) * Math.min(1, dt * 12);
  player.py += (player.y - player.py) * Math.min(1, dt * 12);
  timeEl.textContent = elapsed.toFixed(2);
  draw();
  requestAnimationFrame(loop);
}

function move(dx, dy) {
  if (!running) return;
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (maze[ny]?.[nx] !== "0") return;
  player.x = nx;
  player.y = ny;
  if (player.x === goal.x && player.y === goal.y) finishGame();
}

function finishGame() {
  running = false;
  resultTime.textContent = elapsed.toFixed(2);
  if (!best || elapsed < best) {
    best = elapsed;
    localStorage.setItem("pillbugMazeBest", String(best));
    resultMessage.textContent = "じこベストこうしん！";
  } else {
    resultMessage.textContent = "ゴールできたね。";
  }
  bestEl.textContent = best.toFixed(2);
  finishPanel.classList.remove("hidden");
  draw();
}

function draw() {
  if (!width || !height) return;
  ctx.fillStyle = "#b1e58d";
  ctx.fillRect(0, 0, width, height);
  const activeMaze = maze || MAZES[0];
  for (let y = 0; y < 11; y += 1) {
    for (let x = 0; x < 13; x += 1) {
      const px = offsetX + x * cell;
      const py = offsetY + y * cell;
      if (activeMaze[y][x] === "1") {
        ctx.fillStyle = "#5b8d4c";
        ctx.fillRect(px, py, cell, cell);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(px + 4, py + 4, cell - 8, 5);
      } else {
        ctx.fillStyle = "#d8be8d";
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }
  drawLeaf(goal.x, goal.y);
  drawPillbug(player.px, player.py);
}

function drawLeaf(tx, ty) {
  const x = offsetX + tx * cell + cell / 2;
  const y = offsetY + ty * cell + cell / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.45);
  ctx.fillStyle = "#3dcf5e";
  ctx.beginPath();
  ctx.ellipse(0, 0, cell * 0.34, cell * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#16813b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-cell * 0.28, 0);
  ctx.lineTo(cell * 0.28, 0);
  ctx.stroke();
  ctx.restore();
}

function drawPillbug(tx, ty) {
  const x = offsetX + tx * cell + cell / 2;
  const y = offsetY + ty * cell + cell / 2;
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + cell * 0.18, cell * 0.34, cell * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i % 2 ? "#647182" : "#788696";
    ctx.beginPath();
    ctx.arc(x - cell * 0.24 + i * cell * 0.12, y, cell * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2d3744";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = "#1d2530";
  ctx.beginPath();
  ctx.arc(x + cell * 0.27, y - cell * 0.06, cell * 0.035, 0, Math.PI * 2);
  ctx.arc(x + cell * 0.27, y + cell * 0.06, cell * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

function bindButton(button, handler) {
  let handled = false;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handled = true;
    handler();
    window.setTimeout(() => { handled = false; }, 260);
  });
  button.addEventListener("click", (event) => {
    if (handled) {
      event.preventDefault();
      return;
    }
    handler();
  });
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
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") move(0, -1);
  if (event.key === "ArrowLeft") move(-1, 0);
  if (event.key === "ArrowRight") move(1, 0);
  if (event.key === "ArrowDown") move(0, 1);
});
window.addEventListener("resize", resize);
resize();
