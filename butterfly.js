const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const scoreEl = document.getElementById("score");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const resultLabel = document.getElementById("resultLabel");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");
const flapButton = document.getElementById("flapButton");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "butterfly";
const DEFAULT_LEARNING_URL = "learn.html";
const GAME_CONFIG = {
  roundSeconds: 30,
  spawnStart: 1.75,
  spawnMin: 0.86,
  maxEnemies: 4,
  clearFlowers: 42,
};

const ENEMY_TYPES = [
  { id: "sparrow", label: "すずめ", size: 27, speed: 145, weight: 30 },
  { id: "crow", label: "からす", size: 34, speed: 132, weight: 14 },
  { id: "bee", label: "はち", size: 20, speed: 170, weight: 28 },
  { id: "dragonfly", label: "とんぼ", size: 23, speed: 188, weight: 16 },
];

const butterfly = {
  x: 0,
  y: 0,
  vy: 0,
  wing: 0,
};

let width = 0;
let height = 0;
let dpr = 1;
let groundY = 0;
let timeLeft = GAME_CONFIG.roundSeconds;
let score = 0;
let running = false;
let paused = false;
let cleared = false;
let gameOver = false;
let pressing = false;
let lastTime = 0;
let spawnTimer = 0;
let clouds = [];
let hills = [];
let enemies = [];
let flowers = [];
let confetti = [];
let audioContext = null;
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
  height = Math.max(260, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = height * 0.78;
  butterfly.x = width * 0.18;
  if (!running) butterfly.y = height * 0.45;
  buildScenery();
}

function buildScenery() {
  clouds = Array.from({ length: 5 }, () => ({
    x: Math.random() * width,
    y: 24 + Math.random() * groundY * 0.42,
    s: 0.7 + Math.random() * 0.65,
  }));
  hills = Array.from({ length: 4 }, (_, i) => ({
    x: (i - 0.5) * width * 0.34,
    y: groundY + 30 + Math.random() * 22,
    w: width * (0.34 + Math.random() * 0.14),
    h: 72 + Math.random() * 50,
    color: i % 2 ? "#75c979" : "#5fb66b",
  }));
}

function startGame() {
  prepareAudio();
  running = true;
  paused = false;
  cleared = false;
  gameOver = false;
  pressing = false;
  timeLeft = GAME_CONFIG.roundSeconds;
  score = 0;
  enemies = [];
  flowers = [];
  confetti = [];
  spawnTimer = 1.15;
  butterfly.x = width * 0.18;
  butterfly.y = height * 0.45;
  butterfly.vy = 0;
  butterfly.wing = 0;
  lastTime = performance.now();
  finishPanel.classList.add("hidden");
  finishPanel.classList.remove("clear", "gameover");
  startPanel.classList.add("hidden");
  pauseButton.textContent = "Ⅱ";
  updateHud();
  requestAnimationFrame(loop);
}

function finishGame(type) {
  if (!running) return;
  running = false;
  paused = false;
  cleared = type === "clear";
  gameOver = type === "gameover";
  pressing = false;
  flapButton.classList.remove("pressed");
  finishPanel.classList.toggle("clear", cleared);
  finishPanel.classList.toggle("gameover", gameOver);

  if (cleared) {
    resultLabel.textContent = "CLEAR";
    resultTitle.textContent = "クリア！";
    resultMessage.textContent = "花畑に到着。蝶がたくさん待っているよ。";
    buildFlowerField();
    playClearSound();
  } else {
    resultLabel.textContent = "GAME OVER";
    resultTitle.textContent = `${score}`;
    resultMessage.textContent = "外敵にぶつかった。もういちど空へ。";
    playHitSound();
  }
  finishPanel.classList.remove("hidden");
}

function buildFlowerField() {
  flowers = Array.from({ length: GAME_CONFIG.clearFlowers }, () => ({
    x: Math.random() * width,
    y: groundY + 10 + Math.random() * Math.max(20, height - groundY - 24),
    s: 0.65 + Math.random() * 0.9,
    hue: Math.random() * 360,
  }));
  confetti = Array.from({ length: 18 }, () => ({
    x: width * (0.35 + Math.random() * 0.55),
    y: height * (0.25 + Math.random() * 0.45),
    vx: -18 + Math.random() * 36,
    vy: -35 - Math.random() * 55,
    wing: Math.random() * Math.PI * 2,
    color: ["#ffd53f", "#ff8fc6", "#8f73ff", "#53d2ff"][Math.floor(Math.random() * 4)],
  }));
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseButton.textContent = paused ? "▶" : "Ⅱ";
  if (!paused) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function update(dt) {
  if (paused) return;
  if (running) {
    timeLeft -= dt;
    score = Math.max(0, Math.floor((GAME_CONFIG.roundSeconds - timeLeft) * 10));
    if (timeLeft <= 0) {
      timeLeft = 0;
      finishGame("clear");
      return;
    }
  }

  updateButterfly(dt);
  updateEnemies(dt);
  updateClearButterflies(dt);
  updateHud();
}

function updateButterfly(dt) {
  const lift = pressing ? -1280 : 0;
  butterfly.vy += (780 + lift) * dt;
  butterfly.vy = clamp(butterfly.vy, -265, 315);
  butterfly.y += butterfly.vy * dt;
  butterfly.y = clamp(butterfly.y, 34, groundY - 30);
  if (butterfly.y >= groundY - 30 && butterfly.vy > 0) butterfly.vy *= -0.18;
  butterfly.wing += dt * (pressing ? 21 : 13);
}

function updateEnemies(dt) {
  spawnTimer -= dt;
  const elapsed = GAME_CONFIG.roundSeconds - timeLeft;
  if (spawnTimer <= 0) {
    if (enemies.length < GAME_CONFIG.maxEnemies) spawnEnemy();
    spawnTimer = Math.max(GAME_CONFIG.spawnMin, GAME_CONFIG.spawnStart - elapsed * 0.014) * (0.86 + Math.random() * 0.44);
  }

  for (const enemy of enemies) {
    enemy.x -= enemy.speed * dt;
    enemy.y += Math.sin(enemy.phase + performance.now() / enemy.waveRate) * enemy.wave * dt;
    enemy.phase += dt * 2.2;
  }

  for (const enemy of enemies) {
    const hitDistance = enemy.size * 0.62 + 14;
    if (Math.hypot(enemy.x - butterfly.x, enemy.y - butterfly.y) < hitDistance) {
      finishGame("gameover");
      return;
    }
  }

  enemies = enemies.filter((enemy) => enemy.x > -90);
}

function updateClearButterflies(dt) {
  if (!cleared) return;
  for (const item of confetti) {
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.vy += 42 * dt;
    item.wing += dt * 10;
    if (item.y > groundY - 20) item.vy = -35 - Math.random() * 45;
  }
  butterfly.wing += dt * 10;
  butterfly.y = height * 0.38 + Math.sin(performance.now() / 420) * 6;
}

function spawnEnemy() {
  const type = weightedEnemyType();
  const margin = 58;
  enemies.push({
    type,
    x: width + margin,
    y: 42 + Math.random() * Math.max(50, groundY - 86),
    speed: type.speed * (0.86 + Math.random() * 0.34),
    size: type.size,
    phase: Math.random() * Math.PI * 2,
    wave: 12 + Math.random() * 20,
    waveRate: 360 + Math.random() * 320,
  });
}

function weightedEnemyType() {
  const total = ENEMY_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let pick = Math.random() * total;
  for (const type of ENEMY_TYPES) {
    pick -= type.weight;
    if (pick <= 0) return type;
  }
  return ENEMY_TYPES[0];
}

function updateHud() {
  timeEl.textContent = timeLeft.toFixed(1);
  scoreEl.textContent = score;
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawScene();
  if (cleared) drawFlowerField();
  for (const enemy of enemies) drawEnemy(enemy);
  for (const item of confetti) drawSmallButterfly(item);
  drawButterfly(butterfly.x, butterfly.y, 1.05, butterfly.wing);
}

function drawScene() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#67cff9");
  sky.addColorStop(0.58, "#c7f2ff");
  sky.addColorStop(1, "#b6e78e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (const cloud of clouds) drawCloud(cloud);

  for (const hill of hills) {
    ctx.fillStyle = hill.color;
    ctx.beginPath();
    ctx.ellipse(hill.x + hill.w, hill.y, hill.w, hill.h, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#87d06f";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i += 1) {
    const x = (i * 71 + performance.now() / 40) % (width + 80) - 40;
    const y = 42 + (i % 4) * 78;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 34, y);
    ctx.stroke();
  }
}

function drawCloud(cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.s, cloud.s);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 34, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(23, 1, 28, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(-26, 4, 23, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlowerField() {
  for (const flower of flowers) {
    drawFlower(flower);
  }
}

function drawFlower(flower) {
  ctx.save();
  ctx.translate(flower.x, flower.y);
  ctx.scale(flower.s, flower.s);
  ctx.strokeStyle = "#3f9e54";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -2);
  ctx.stroke();
  ctx.fillStyle = `hsl(${flower.hue} 86% 68%)`;
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 7, Math.sin(angle) * 7 - 8, 5, 8, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffe66d";
  ctx.beginPath();
  ctx.arc(0, -8, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButterfly(x, y, scale, wing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const flap = Math.abs(Math.sin(wing));
  ctx.rotate(Math.sin(wing * 0.4) * 0.08);

  ctx.fillStyle = "#ffd736";
  ctx.strokeStyle = "#332615";
  ctx.lineWidth = 2.5;
  drawWing(-1, flap);
  drawWing(1, flap);

  ctx.fillStyle = "#4b3b2b";
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 23, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -20, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#332615";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -23);
  ctx.quadraticCurveTo(13, -34, 18, -29);
  ctx.moveTo(2, -23);
  ctx.quadraticCurveTo(-9, -34, -14, -29);
  ctx.stroke();
  ctx.restore();
}

function drawWing(direction, flap) {
  ctx.save();
  ctx.scale(direction * (0.72 + flap * 0.32), 1);
  ctx.beginPath();
  ctx.ellipse(18, -9, 20, 27, -0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(16, 13, 18, 21, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2c251b";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(18 + i * 4, -22 + i * 9, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(51,38,21,0.48)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(1, -4);
  ctx.lineTo(31, -24);
  ctx.moveTo(1, 2);
  ctx.lineTo(29, 18);
  ctx.stroke();
  ctx.restore();
}

function drawSmallButterfly(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(0.42, 0.42);
  ctx.fillStyle = item.color;
  ctx.strokeStyle = "rgba(40,30,30,0.35)";
  ctx.lineWidth = 2;
  drawWing(-1, Math.abs(Math.sin(item.wing)));
  drawWing(1, Math.abs(Math.sin(item.wing)));
  ctx.fillStyle = "#3b3025";
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(enemy) {
  if (enemy.type.id === "bee") {
    drawBee(enemy);
  } else if (enemy.type.id === "dragonfly") {
    drawDragonfly(enemy);
  } else {
    drawBird(enemy);
  }
}

function drawBird(enemy) {
  const dark = enemy.type.id === "crow";
  const s = enemy.size / 30;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(s, s);
  ctx.fillStyle = dark ? "#2f3a46" : "#b57a2b";
  ctx.strokeStyle = "rgba(20,30,35,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark ? "#1f2730" : "#7d551f";
  ctx.beginPath();
  ctx.ellipse(-8, -13, 31, 10, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(25, -2);
  ctx.lineTo(47, -8);
  ctx.lineTo(29, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe7b5";
  if (!dark) {
    ctx.beginPath();
    ctx.ellipse(4, 7, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f6c04e";
  ctx.beginPath();
  ctx.moveTo(-27, -2);
  ctx.lineTo(-42, -8);
  ctx.lineTo(-28, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-17, -6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(-18, -6, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBee(enemy) {
  const s = enemy.size / 21;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(-4, -15, 11, 18, -0.65, 0, Math.PI * 2);
  ctx.ellipse(9, -14, 11, 18, 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7c331";
  ctx.strokeStyle = "#3b3025";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 23, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#3b3025";
  ctx.lineWidth = 5;
  for (let x = -9; x <= 10; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, -11);
    ctx.lineTo(x + 3, 11);
    ctx.stroke();
  }
  ctx.fillStyle = "#3b3025";
  ctx.beginPath();
  ctx.moveTo(23, 0);
  ctx.lineTo(35, -6);
  ctx.lineTo(31, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDragonfly(enemy) {
  const s = enemy.size / 24;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(s, s);
  ctx.strokeStyle = "#61723d";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-27, 0);
  ctx.lineTo(28, 0);
  ctx.stroke();
  ctx.fillStyle = "rgba(236,253,255,0.68)";
  ctx.beginPath();
  ctx.ellipse(-6, -13, 23, 8, -0.25, 0, Math.PI * 2);
  ctx.ellipse(-6, 13, 23, 8, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7aaa45";
  ctx.beginPath();
  ctx.arc(-31, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-35, -4, 4, 0, Math.PI * 2);
  ctx.arc(-28, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function prepareAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playHitSound() {
  if (!audioContext) return;
  playTone(130, 0.18, 0.28, "sawtooth", 82);
  playTone(92, 0.22, 0.22, "sawtooth", 68, audioContext.currentTime + 0.14);
}

function playClearSound() {
  if (!audioContext) return;
  const start = audioContext.currentTime + 0.02;
  [784, 988, 1175, 1568].forEach((frequency, index) => {
    playTone(frequency, 0.14, 0.24, "triangle", frequency * 1.08, start + index * 0.11);
  });
}

function playTone(frequency, duration, volume, type, endFrequency = frequency, startTime = audioContext.currentTime + 0.01) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration * 1.05);
}

function setPressing(value) {
  if (!running || paused) return;
  pressing = value;
  flapButton.classList.toggle("pressed", value);
}

function bindPressControl(target) {
  const pressStart = (event) => {
    event.preventDefault();
    prepareAudio();
    if (event.pointerId !== undefined && target.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Some mobile browsers expose pointer events without reliable capture.
      }
    }
    setPressing(true);
  };
  const pressEnd = (event) => {
    event.preventDefault();
    setPressing(false);
    if (event.pointerId !== undefined && target.releasePointerCapture) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // Matching the guarded capture call above.
      }
    }
  };

  target.addEventListener("pointerdown", (event) => {
    pressStart(event);
  });
  target.addEventListener("pointerup", (event) => {
    pressEnd(event);
  });
  target.addEventListener("pointercancel", () => setPressing(false));
  target.addEventListener("pointerleave", () => setPressing(false));
  target.addEventListener(
    "touchstart",
    (event) => {
      pressStart(event);
    },
    { passive: false },
  );
  target.addEventListener(
    "touchend",
    (event) => {
      pressEnd(event);
    },
    { passive: false },
  );
  target.addEventListener("touchcancel", () => setPressing(false), { passive: false });
}

function preventZoomGestures() {
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 360) event.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("gesturechange", (event) => event.preventDefault());
  document.addEventListener("gestureend", (event) => event.preventDefault());
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  if (running || cleared) requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", () => {
  window.location.href = getLearningUrl();
});
pauseButton.addEventListener("click", togglePause);
bindPressControl(flapButton);
bindPressControl(canvas);
window.addEventListener("resize", resize);
preventZoomGestures();

resize();
updateHud();
draw();
