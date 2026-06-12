const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const bestEl = document.getElementById("best");
const startButton = document.getElementById("startButton");
const learnButton = document.getElementById("learnButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");
const rotateButton = document.getElementById("rotateButton");
const downButton = document.getElementById("downButton");
const dropButton = document.getElementById("dropButton");
const messagePanel = document.getElementById("messagePanel");
const messageText = document.getElementById("messageText");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "tetris";
const LEARNING_URL = "learn.html";
const COLS = 10;
const ROWS = 20;
const DROP_START_MS = 760;
const DROP_MIN_MS = 170;
const COLORS = {
  I: "#47d9ff",
  O: "#ffd75e",
  T: "#b987ff",
  S: "#5ee08f",
  Z: "#ff6f8f",
  J: "#5f8dff",
  L: "#ffae57",
};
const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

let board = [];
let piece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let best = Number(localStorage.getItem("tetrisBest") || 0);
let running = false;
let lastTime = 0;
let dropTimer = 0;
let cell = 20;
let nextCell = 20;
let audioContext = null;

bestEl.textContent = best;
requireMiniGameAccess(GAME_ID);

function requireMiniGameAccess(gameId) {
  const key = `${MINI_GAME_ACCESS_PREFIX}${gameId}`;
  if (sessionStorage.getItem(key) === "1") {
    sessionStorage.removeItem(key);
    return;
  }
  window.location.replace(LEARNING_URL);
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) requireMiniGameAccess(GAME_ID);
});

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const boardRect = boardCanvas.getBoundingClientRect();
  const targetCell = Math.floor(Math.min(boardRect.width / COLS, boardRect.height / ROWS));
  cell = Math.max(12, targetCell);
  boardCanvas.width = Math.floor(COLS * cell * dpr);
  boardCanvas.height = Math.floor(ROWS * cell * dpr);
  boardCanvas.style.width = `${COLS * cell}px`;
  boardCanvas.style.height = `${ROWS * cell}px`;
  boardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const nextRect = nextCanvas.getBoundingClientRect();
  nextCell = Math.max(14, Math.floor(Math.min(nextRect.width, nextRect.height) / 5));
  nextCanvas.width = Math.floor(nextRect.width * dpr);
  nextCanvas.height = Math.floor(nextRect.height * dpr);
  nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function newBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createPiece(type = randomType()) {
  const shape = SHAPES[type].map((row) => row.slice());
  return {
    type,
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  };
}

function randomType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function startGame() {
  prepareAudio();
  board = newBoard();
  score = 0;
  lines = 0;
  running = true;
  piece = createPiece();
  nextPiece = createPiece();
  dropTimer = 0;
  lastTime = performance.now();
  messagePanel.classList.add("hidden");
  updateHud();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  if (running) {
    dropTimer += dt;
    if (dropTimer >= dropInterval()) {
      softDrop(false);
      dropTimer = 0;
    }
  }
  draw();
  if (running) requestAnimationFrame(loop);
}

function dropInterval() {
  return Math.max(DROP_MIN_MS, DROP_START_MS - lines * 22);
}

function move(dx) {
  if (!running) return;
  const moved = { ...piece, x: piece.x + dx };
  if (!collides(moved)) {
    piece = moved;
    playTone(330, 0.025, 0.08);
    draw();
  }
}

function softDrop(scoreMove = true) {
  if (!running) return;
  const moved = { ...piece, y: piece.y + 1 };
  if (!collides(moved)) {
    piece = moved;
    if (scoreMove) score += 1;
    updateHud();
    draw();
    return;
  }
  lockPiece();
}

function hardDrop() {
  if (!running) return;
  let steps = 0;
  while (!collides({ ...piece, y: piece.y + 1 })) {
    piece = { ...piece, y: piece.y + 1 };
    steps += 1;
  }
  score += steps * 2;
  lockPiece();
}

function rotatePiece() {
  if (!running || piece.type === "O") return;
  const rotated = {
    ...piece,
    shape: piece.shape[0].map((_, col) => piece.shape.map((row) => row[col]).reverse()),
  };
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    const candidate = { ...rotated, x: rotated.x + kick };
    if (!collides(candidate)) {
      piece = candidate;
      playTone(470, 0.035, 0.08);
      draw();
      return;
    }
  }
}

function lockPiece() {
  forEachBlock(piece, (x, y) => {
    if (y >= 0) board[y][x] = piece.type;
  });
  const cleared = clearLines();
  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared];
    playClearSound(cleared);
  } else {
    playTone(190, 0.04, 0.06);
  }
  piece = nextPiece;
  nextPiece = createPiece();
  dropTimer = 0;
  updateHud();
  if (collides(piece)) finishGame();
}

function clearLines() {
  const remaining = board.filter((row) => row.some((cellValue) => !cellValue));
  const cleared = ROWS - remaining.length;
  while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
  board = remaining;
  return cleared;
}

function finishGame() {
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem("tetrisBest", String(best));
    messageText.textContent = "新記録！もういちど学習してから遊ぼう。";
  } else {
    messageText.textContent = "ゲームおわり。もういちど学習してから遊ぼう。";
  }
  updateHud();
  messagePanel.classList.remove("hidden");
}

function collides(target) {
  let hit = false;
  forEachBlock(target, (x, y) => {
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) hit = true;
  });
  return hit;
}

function forEachBlock(target, callback) {
  target.shape.forEach((row, rowIndex) => {
    row.forEach((filled, colIndex) => {
      if (filled) callback(target.x + colIndex, target.y + rowIndex);
    });
  });
}

function updateHud() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  bestEl.textContent = best;
}

function draw() {
  boardCtx.clearRect(0, 0, COLS * cell, ROWS * cell);
  drawGrid(boardCtx, COLS, ROWS, cell);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) drawBlock(boardCtx, x, y, COLORS[board[y][x]], cell);
    }
  }
  if (piece) forEachBlock(piece, (x, y) => drawBlock(boardCtx, x, y, COLORS[piece.type], cell));

  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (nextPiece) drawPreview();
}

function drawPreview() {
  const shape = nextPiece.shape;
  const offsetX = (nextCanvas.clientWidth - shape[0].length * nextCell) / 2;
  const offsetY = (nextCanvas.clientHeight - shape.length * nextCell) / 2;
  shape.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) drawBlock(nextCtx, offsetX / nextCell + x, offsetY / nextCell + y, COLORS[nextPiece.type], nextCell);
    });
  });
}

function drawGrid(context, cols, rows, size) {
  context.strokeStyle = "rgba(198, 222, 255, 0.08)";
  context.lineWidth = 1;
  for (let x = 0; x <= cols; x += 1) {
    context.beginPath();
    context.moveTo(x * size, 0);
    context.lineTo(x * size, rows * size);
    context.stroke();
  }
  for (let y = 0; y <= rows; y += 1) {
    context.beginPath();
    context.moveTo(0, y * size);
    context.lineTo(cols * size, y * size);
    context.stroke();
  }
}

function drawBlock(context, x, y, color, size) {
  const px = x * size;
  const py = y * size;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = "rgba(255,255,255,0.28)";
  context.fillRect(px + 3, py + 3, size - 6, Math.max(2, size * 0.18));
  context.strokeStyle = "rgba(0,0,0,0.28)";
  context.strokeRect(px + 1, py + 1, size - 2, size - 2);
}

function prepareAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  if (!audioContext) audioContext = new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(freq, duration, gain = 0.1) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(amp).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playClearSound(count) {
  [520, 660, 780, 940].slice(0, count + 1).forEach((freq, index) => {
    window.setTimeout(() => playTone(freq, 0.06, 0.12), index * 42);
  });
}

leftButton.addEventListener("click", () => move(-1));
rightButton.addEventListener("click", () => move(1));
rotateButton.addEventListener("click", rotatePiece);
downButton.addEventListener("click", () => softDrop(true));
dropButton.addEventListener("click", hardDrop);
startButton.addEventListener("click", startGame);
learnButton.addEventListener("click", () => {
  window.location.href = LEARNING_URL;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
  if (event.key === "ArrowUp") rotatePiece();
  if (event.key === "ArrowDown") softDrop(true);
  if (event.key === " ") hardDrop();
});
window.addEventListener("resize", resize);

resize();
draw();
