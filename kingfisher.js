const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const finalScoreEl = document.getElementById("finalScore");
const resultMessageEl = document.getElementById("resultMessage");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "kingfisher";
const LEARNING_URL = "hiragana.html";
const GAME_CONFIG = {
  roundSeconds: 30,
  initialFish: 30,
  maxFish: 48,
  spawnInterval: 0.42,
  rippleSeconds: 0.62,
  lordFirstSecond: 9,
};

const FISH_TYPES = [
  { id: "small", label: "小さな魚", points: 1, size: 12, speed: 64, color: "#74d8ff", fin: "#dff7ff", weight: 48 },
  { id: "medium", label: "中位の魚", points: 3, size: 17, speed: 54, color: "#ffd36c", fin: "#fff1bd", weight: 25 },
  { id: "large", label: "大きな魚", points: 6, size: 24, speed: 43, color: "#ff8f5c", fin: "#ffd2bf", weight: 11 },
  { id: "shrimp", label: "エビ", points: 10, size: 16, speed: 75, color: "#ff6f8f", fin: "#ffd1dd", weight: 5 },
];

const LORD = { id: "lord", label: "池の主", points: 30, size: 34, speed: 30, color: "#8c67ff", fin: "#d6ccff", weight: 0 };
const BIRD = {
  perchX: 0,
  perchY: 0,
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  state: "perched",
  t: 0,
  caught: null,
};

let width = 0;
let height = 0;
let dpr = 1;
let waterTop = 0;
let score = 0;
let best = Number(localStorage.getItem("kingfisherDiveBest") || 0);
let timeLeft = GAME_CONFIG.roundSeconds;
let running = false;
let lastTime = 0;
let spawnTimer = 0;
let lordSpawned = false;
let fishes = [];
let ripples = [];
let splashes = [];
let reeds = [];
let clouds = [];

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
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, Math.floor(rect.width));
  height = Math.max(320, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  waterTop = Math.max(118, height * 0.29);
  BIRD.perchX = width * 0.52;
  BIRD.perchY = waterTop - 42;
  if (BIRD.state === "perched") {
    BIRD.x = BIRD.perchX;
    BIRD.y = BIRD.perchY;
  }
  reeds = Array.from({ length: Math.max(8, Math.round(width / 80)) }, (_, i) => ({
    x: (i + Math.random() * 0.8) * (width / Math.max(8, Math.round(width / 80))),
    h: 30 + Math.random() * 46,
    lean: (Math.random() - 0.5) * 18,
  }));
  clouds = Array.from({ length: 4 }, () => ({
    x: Math.random() * width,
    y: 22 + Math.random() * Math.max(26, waterTop * 0.3),
    s: 0.75 + Math.random() * 0.7,
  }));
}

function startGame() {
  score = 0;
  timeLeft = GAME_CONFIG.roundSeconds;
  running = true;
  lastTime = performance.now();
  spawnTimer = 0;
  lordSpawned = false;
  fishes = [];
  ripples = [];
  splashes = [];
  resetBird();
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  for (let i = 0; i < GAME_CONFIG.initialFish; i += 1) spawnFish(true);
  updateHud();
  requestAnimationFrame(loop);
}

function resetBird() {
  BIRD.x = BIRD.perchX;
  BIRD.y = BIRD.perchY;
  BIRD.targetX = BIRD.perchX;
  BIRD.targetY = BIRD.perchY;
  BIRD.state = "perched";
  BIRD.t = 0;
  BIRD.caught = null;
}

function finishGame() {
  running = false;
  finalScoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem("kingfisherDiveBest", String(best));
    resultMessageEl.textContent = "新記録。水面を見る目がするどい。";
  } else if (score >= 90) {
    resultMessageEl.textContent = "大漁。池の主も夢じゃない。";
  } else {
    resultMessageEl.textContent = "魚の群れをよく見て飛び込もう。";
  }
  bestEl.textContent = best;
  finishPanel.classList.remove("hidden");
}

function weightedFishType() {
  const total = FISH_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let pick = Math.random() * total;
  for (const type of FISH_TYPES) {
    pick -= type.weight;
    if (pick <= 0) return type;
  }
  return FISH_TYPES[0];
}

function spawnFish(initial = false, forcedType = null) {
  const type = forcedType || weightedFishType();
  const y = waterTop + type.size + Math.random() * Math.max(30, height - waterTop - type.size * 2 - 10);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const margin = type.size + 28;
  const x = initial ? Math.random() * width : dir > 0 ? -margin : width + margin;
  fishes.push({
    type,
    x,
    y,
    vx: dir * (type.speed * (0.68 + Math.random() * 0.58)),
    phase: Math.random() * Math.PI * 2,
    wiggle: 8 + Math.random() * 12,
    caught: false,
  });
}

function diveAt(x, y) {
  if (!running || BIRD.state !== "perched") return;
  BIRD.targetX = clamp(x, 24, width - 24);
  BIRD.targetY = clamp(y, waterTop + 18, height - 22);
  BIRD.state = "diving";
  BIRD.t = 0;
  BIRD.caught = null;
}

function update(dt) {
  if (running) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      finishGame();
    }
  }

  if (running) updateSpawns(dt);
  updateFish(dt);
  updateBird(dt);
  updateEffects(dt);
  updateHud();
}

function updateSpawns(dt) {
  spawnTimer -= dt;
  const secondsElapsed = GAME_CONFIG.roundSeconds - timeLeft;
  if (spawnTimer <= 0) {
    if (fishes.length < GAME_CONFIG.maxFish) spawnFish();
    if (!lordSpawned && secondsElapsed >= GAME_CONFIG.lordFirstSecond) {
      spawnFish(false, LORD);
      lordSpawned = true;
    }
    spawnTimer = GAME_CONFIG.spawnInterval * (0.75 + Math.random() * 0.7);
  }
}

function updateFish(dt) {
  for (const fish of fishes) {
    fish.phase += dt * 4;
    fish.x += fish.vx * dt;
    fish.y += Math.sin(fish.phase) * fish.wiggle * dt;
  }
  fishes = fishes.filter((fish) => fish.x > -80 && fish.x < width + 80 && !fish.caught);
}

function updateBird(dt) {
  if (BIRD.state === "perched") {
    BIRD.x = BIRD.perchX;
    BIRD.y = BIRD.perchY + Math.sin(performance.now() / 420) * 1.4;
    return;
  }

  if (BIRD.state === "diving") {
    BIRD.t += dt / 0.34;
    const t = easeIn(Math.min(1, BIRD.t));
    const lift = Math.sin(Math.min(1, BIRD.t) * Math.PI) * 48;
    BIRD.x = lerp(BIRD.perchX, BIRD.targetX, t);
    BIRD.y = lerp(BIRD.perchY, BIRD.targetY, t) - lift;
    if (BIRD.t >= 1) {
      catchFish();
      addRipple(BIRD.targetX, BIRD.targetY);
      addSplash(BIRD.targetX, BIRD.targetY);
      BIRD.state = "returning";
      BIRD.t = 0;
    }
    return;
  }

  if (BIRD.state === "returning") {
    BIRD.t += dt / 0.46;
    const t = easeOut(Math.min(1, BIRD.t));
    const arc = Math.sin(t * Math.PI) * 38;
    BIRD.x = lerp(BIRD.targetX, BIRD.perchX, t);
    BIRD.y = lerp(BIRD.targetY, BIRD.perchY, t) - arc;
    if (BIRD.t >= 1) resetBird();
  }
}

function catchFish() {
  let bestFish = null;
  let bestDistance = Infinity;
  const catchRadius = 34;
  for (const fish of fishes) {
    const distance = Math.hypot(fish.x - BIRD.targetX, fish.y - BIRD.targetY);
    if (distance < catchRadius + fish.type.size && distance < bestDistance) {
      bestFish = fish;
      bestDistance = distance;
    }
  }
  if (!bestFish) return;
  bestFish.caught = true;
  BIRD.caught = bestFish.type;
  score += bestFish.type.points;
  splashes.push({ x: BIRD.targetX, y: BIRD.targetY, t: 0, color: bestFish.type.color, score: bestFish.type.points });
}

function updateEffects(dt) {
  for (const ripple of ripples) ripple.t += dt;
  ripples = ripples.filter((ripple) => ripple.t < GAME_CONFIG.rippleSeconds);
  for (const splash of splashes) splash.t += dt;
  splashes = splashes.filter((splash) => splash.t < 0.75);
}

function addRipple(x, y) {
  ripples.push({ x, y, t: 0 });
}

function addSplash(x, y) {
  for (let i = 0; i < 14; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    splashes.push({
      x,
      y,
      t: Math.random() * 0.05,
      vx: Math.cos(angle) * (40 + Math.random() * 120),
      vy: Math.sin(angle) * (80 + Math.random() * 120),
      color: "#dffbff",
    });
  }
}

function updateHud() {
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft.toFixed(1);
  bestEl.textContent = best;
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawScene();
  for (const fish of fishes) drawFish(fish);
  for (const ripple of ripples) drawRipple(ripple);
  for (const splash of splashes) drawSplash(splash);
  drawPerch();
  drawKingfisher();
}

function drawScene() {
  const sky = ctx.createLinearGradient(0, 0, 0, waterTop);
  sky.addColorStop(0, "#dff8ff");
  sky.addColorStop(1, "#fff4c7");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, waterTop);

  for (const cloud of clouds) drawCloud(cloud);

  ctx.fillStyle = "#78bf68";
  ctx.beginPath();
  ctx.ellipse(width * 0.18, waterTop + 8, width * 0.34, 34, 0, 0, Math.PI * 2);
  ctx.ellipse(width * 0.84, waterTop + 2, width * 0.28, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  const water = ctx.createLinearGradient(0, waterTop, 0, height);
  water.addColorStop(0, "#58d2ee");
  water.addColorStop(0.5, "#2499c8");
  water.addColorStop(1, "#166f9c");
  ctx.fillStyle = water;
  ctx.fillRect(0, waterTop, width, height - waterTop);

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  for (let y = waterTop + 22; y < height; y += 34) {
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 28) {
      const waveY = y + Math.sin(x * 0.025 + performance.now() / 900) * 3;
      if (x === -20) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  for (const reed of reeds) drawReed(reed);
}

function drawCloud(cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.s, cloud.s);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 30, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(20, 2, 26, 15, 0, 0, Math.PI * 2);
  ctx.ellipse(-22, 5, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawReed(reed) {
  ctx.strokeStyle = "#4c8f48";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(reed.x, waterTop + 18);
  ctx.quadraticCurveTo(reed.x + reed.lean * 0.35, waterTop - reed.h * 0.48, reed.x + reed.lean, waterTop - reed.h);
  ctx.stroke();
  ctx.fillStyle = "#8b673f";
  ctx.beginPath();
  ctx.ellipse(reed.x + reed.lean, waterTop - reed.h, 5, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPerch() {
  ctx.strokeStyle = "#7b502d";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(BIRD.perchX - 86, BIRD.perchY + 20);
  ctx.lineTo(BIRD.perchX + 84, BIRD.perchY + 7);
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(BIRD.perchX + 30, BIRD.perchY + 10);
  ctx.lineTo(BIRD.perchX + 62, BIRD.perchY - 22);
  ctx.stroke();
}

function drawKingfisher() {
  const angle = BIRD.state === "diving"
    ? Math.atan2(BIRD.targetY - BIRD.perchY, BIRD.targetX - BIRD.perchX)
    : BIRD.state === "returning"
      ? Math.atan2(BIRD.perchY - BIRD.y, BIRD.perchX - BIRD.x)
      : 0;
  const scale = BIRD.state === "perched" ? 1 : 0.95;
  ctx.save();
  ctx.translate(BIRD.x, BIRD.y);
  ctx.rotate(angle * 0.42);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#1297c6";
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 18, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f28b2d";
  ctx.beginPath();
  ctx.ellipse(-4, 8, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1db7e0";
  ctx.beginPath();
  ctx.ellipse(-4, -4, 21, 8, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1579a5";
  ctx.beginPath();
  ctx.ellipse(26, -1, 14, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2e2620";
  ctx.beginPath();
  ctx.moveTo(37, -2);
  ctx.lineTo(74, -8);
  ctx.lineTo(38, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(29, -6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.arc(30, -6, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0c7399";
  ctx.beginPath();
  ctx.moveTo(-25, -2);
  ctx.lineTo(-58, -10);
  ctx.lineTo(-35, 13);
  ctx.closePath();
  ctx.fill();

  if (BIRD.caught) {
    ctx.save();
    ctx.translate(76, 0);
    ctx.scale(0.65, 0.65);
    drawFishShape(BIRD.caught, 0, 0, 1);
    ctx.restore();
  }
  ctx.restore();
}

function drawFish(fish) {
  const direction = fish.vx >= 0 ? 1 : -1;
  const y = fish.y + Math.sin(fish.phase) * 3;
  drawFishShape(fish.type, fish.x, y, direction);
}

function drawFishShape(type, x, y, direction) {
  if (type.id === "shrimp") {
    drawShrimp(type, x, y, direction);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  ctx.fillStyle = type.color;
  ctx.strokeStyle = "rgba(24,49,58,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, type.size * 1.25, type.size * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = type.fin;
  ctx.beginPath();
  ctx.moveTo(-type.size * 1.12, 0);
  ctx.lineTo(-type.size * 1.86, -type.size * 0.58);
  ctx.lineTo(-type.size * 1.72, type.size * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();
  ctx.arc(type.size * 0.58, -type.size * 0.16, Math.max(2.4, type.size * 0.13), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#152027";
  ctx.beginPath();
  ctx.arc(type.size * 0.62, -type.size * 0.16, Math.max(1.3, type.size * 0.06), 0, Math.PI * 2);
  ctx.fill();
  if (type.id === "lord") {
    ctx.strokeStyle = "#fff3a6";
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(-type.size * 0.12 + i * 9, 0, type.size * 0.5, -0.9, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawShrimp(type, x, y, direction) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, type.size, -0.2, Math.PI * 1.25);
  ctx.stroke();
  ctx.fillStyle = "#fff0f4";
  ctx.beginPath();
  ctx.arc(type.size * 0.68, -type.size * 0.56, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = type.fin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(type.size * 0.9, -type.size * 0.1);
  ctx.lineTo(type.size * 1.55, -type.size * 0.55);
  ctx.moveTo(type.size * 0.9, type.size * 0.12);
  ctx.lineTo(type.size * 1.55, type.size * 0.56);
  ctx.stroke();
  ctx.restore();
}

function drawRipple(ripple) {
  const progress = ripple.t / GAME_CONFIG.rippleSeconds;
  ctx.strokeStyle = `rgba(255,255,255,${0.72 * (1 - progress)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ripple.x, ripple.y, 18 + progress * 72, 6 + progress * 20, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSplash(splash) {
  const progress = splash.t / 0.75;
  if (splash.score) {
    ctx.fillStyle = `rgba(255,255,255,${1 - progress})`;
    ctx.font = "900 24px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`+${splash.score}`, splash.x, splash.y - 34 - progress * 28);
    return;
  }
  const x = splash.x + splash.vx * splash.t;
  const y = splash.y + splash.vy * splash.t + 180 * splash.t * splash.t;
  ctx.fillStyle = `rgba(230,251,255,${1 - progress})`;
  ctx.beginPath();
  ctx.arc(x, y, 3.2 * (1 - progress * 0.35), 0, Math.PI * 2);
  ctx.fill();
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  if (running || BIRD.state !== "perched" || ripples.length || splashes.length) requestAnimationFrame(loop);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches ? event.touches[0] : event;
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeIn(t) {
  return t * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const point = pointerPosition(event);
  diveAt(point.x, point.y);
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", () => {
  window.location.href = LEARNING_URL;
});
window.addEventListener("resize", resize);

resize();
draw();
