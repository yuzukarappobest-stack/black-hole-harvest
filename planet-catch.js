const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const scoreEl = document.getElementById("score");
const basketLoadEl = document.getElementById("basketLoad");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const resultLabel = document.getElementById("resultLabel");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const startButton = document.getElementById("startButton");
const learnButton = document.getElementById("learnButton");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "planet-catch";
const DEFAULT_LEARNING_URL = "learn.html";
const CONFIG = {
  seconds: 30,
  clearScore: 200,
  capacity: 50,
  spawnStart: 0.78,
  spawnMin: 0.34,
};

const BODY_TYPES = [
  { name: "水星", points: 1, load: 1, radius: 12, color: "#b5aaa0", weight: 15 },
  { name: "火星", points: 2, load: 1, radius: 13, color: "#df7452", weight: 14 },
  { name: "金星", points: 2, load: 1, radius: 15, color: "#e6bf70", weight: 13 },
  { name: "地球", points: 2, load: 1, radius: 15, color: "#4da2ff", weight: 13 },
  { name: "天王星", points: 4, load: 2, radius: 21, color: "#7ae5e5", weight: 9 },
  { name: "海王星", points: 4, load: 2, radius: 21, color: "#426dff", weight: 9 },
  { name: "土星", points: 6, load: 3, radius: 26, color: "#d9bd7a", weight: 7, ring: true },
  { name: "木星", points: 8, load: 4, radius: 30, color: "#d18b62", weight: 6 },
  { name: "太陽", points: 18, load: 6, radius: 34, color: "#ffd24d", weight: 3, sun: true },
];

let width = 0;
let height = 0;
let dpr = 1;
let running = false;
let timeLeft = CONFIG.seconds;
let score = 0;
let load = 0;
let basket = { x: 0, y: 0, w: 0, h: 0, targetX: 0 };
let bodies = [];
let storedBodies = [];
let particles = [];
let stars = [];
let lastTime = 0;
let spawnTimer = 0;
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
  height = Math.max(300, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  basket.w = Math.min(190, width * 0.3);
  basket.h = Math.max(46, height * 0.085);
  basket.y = height - basket.h - 18;
  basket.x = basket.x || width / 2;
  basket.targetX = basket.x;
  stars = Array.from({ length: Math.round((width * height) / 8500) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.72,
    r: 0.8 + Math.random() * 1.6,
    a: 0.32 + Math.random() * 0.68,
  }));
  draw();
}

function startGame() {
  prepareAudio();
  running = true;
  timeLeft = CONFIG.seconds;
  score = 0;
  load = 0;
  bodies = [];
  storedBodies = [];
  particles = [];
  spawnTimer = 0.25;
  basket.x = width / 2;
  basket.targetX = basket.x;
  updateHud();
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

function update(dt) {
  timeLeft = Math.max(0, timeLeft - dt);
  basket.x += (basket.targetX - basket.x) * Math.min(1, dt * 12);
  basket.x = clamp(basket.x, basket.w / 2 + 8, width - basket.w / 2 - 8);

  spawnTimer -= dt;
  const elapsed = CONFIG.seconds - timeLeft;
  const interval = Math.max(CONFIG.spawnMin, CONFIG.spawnStart - elapsed * 0.012);
  if (spawnTimer <= 0 && load < CONFIG.capacity) {
    spawnBody();
    spawnTimer = interval * (0.75 + Math.random() * 0.55);
  }

  for (const body of bodies) {
    body.y += body.speed * dt;
    body.spin += body.spinSpeed * dt;
    if (body.y - body.r > height + 30) body.dead = true;
    if (!body.dead && canCatch(body) && hitBasket(body)) catchBody(body);
  }
  bodies = bodies.filter((body) => !body.dead);
  updateParticles(dt);
  updateHud();

  if (timeLeft <= 0 || score >= CONFIG.clearScore) finishGame();
}

function spawnBody() {
  const type = chooseBodyType();
  const r = type.radius * (0.9 + Math.random() * 0.18);
  bodies.push({
    type,
    x: r + Math.random() * (width - r * 2),
    y: -r - 8,
    r,
    speed: 92 + Math.random() * 64 + type.load * 6,
    spin: Math.random() * Math.PI * 2,
    spinSpeed: -1.2 + Math.random() * 2.4,
    dead: false,
  });
}

function chooseBodyType() {
  const total = BODY_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let roll = Math.random() * total;
  for (const type of BODY_TYPES) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return BODY_TYPES[0];
}

function canCatch(body) {
  return load + body.type.load <= CONFIG.capacity;
}

function hitBasket(body) {
  const basketTop = basket.y + basket.h * 0.12;
  const inX = body.x > basket.x - basket.w * 0.56 && body.x < basket.x + basket.w * 0.56;
  return inX && body.y + body.r > basketTop && body.y < basket.y + basket.h;
}

function catchBody(body) {
  body.dead = true;
  score += body.type.points;
  load += body.type.load;
  storedBodies.push({
    type: body.type,
    r: Math.max(7, body.r * 0.3),
    x: -basket.w * 0.31 + Math.random() * basket.w * 0.62,
    y: basket.h * 0.28 + Math.random() * basket.h * 0.42,
    spin: body.spin,
  });
  sparkle(body.x, body.y, body.type.color, 14);
  playCatchSound(body.type.points);
}

function updateParticles(dt) {
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 120 * dt;
    particle.life -= dt;
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function finishGame() {
  running = false;
  const cleared = score >= CONFIG.clearScore;
  resultLabel.textContent = cleared ? "CLEAR!" : "RESULT";
  resultTitle.textContent = `${score}てん`;
  resultMessage.textContent = cleared ? "200てんたっせい！" : "カゴがいっぱいになる前に高得点をねらおう。";
  finishPanel.classList.remove("hidden");
  if (cleared) playClearSound();
}

function updateHud() {
  timeEl.textContent = Math.max(0, timeLeft).toFixed(1);
  scoreEl.textContent = score;
  basketLoadEl.textContent = load >= CONFIG.capacity ? "FULL" : `${load}/${CONFIG.capacity}`;
}

function draw() {
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  drawSpace();
  for (const body of bodies) drawBody(body.type, body.x, body.y, body.r, body.spin);
  drawBasket();
  drawParticles();
}

function drawSpace() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#112b5a");
  gradient.addColorStop(0.62, "#071225");
  gradient.addColorStop(1, "#142d42");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (const star of stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBasket() {
  ctx.save();
  ctx.translate(basket.x, basket.y);
  const loadRatio = Math.min(1, load / CONFIG.capacity);
  ctx.lineWidth = 5;
  ctx.strokeStyle = load >= CONFIG.capacity ? "#ffef8a" : "#f6d28b";
  ctx.fillStyle = load >= CONFIG.capacity ? "#8f6740" : "#b9854f";
  ctx.beginPath();
  ctx.moveTo(-basket.w * 0.5, 0);
  ctx.lineTo(-basket.w * 0.38, basket.h);
  ctx.lineTo(basket.w * 0.38, basket.h);
  ctx.lineTo(basket.w * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-basket.w * 0.43, basket.h * 0.18);
  ctx.lineTo(-basket.w * 0.33, basket.h * 0.86);
  ctx.lineTo(basket.w * 0.33, basket.h * 0.86);
  ctx.lineTo(basket.w * 0.43, basket.h * 0.18);
  ctx.closePath();
  ctx.clip();
  const fillHeight = basket.h * 0.68 * loadRatio;
  const fillY = basket.h * 0.86 - fillHeight;
  const fillGradient = ctx.createLinearGradient(0, fillY, 0, basket.h * 0.86);
  fillGradient.addColorStop(0, loadRatio >= 1 ? "#ff6767" : "#ffe66b");
  fillGradient.addColorStop(1, loadRatio >= 1 ? "#d93232" : "#ff9f43");
  ctx.fillStyle = fillGradient;
  ctx.fillRect(-basket.w * 0.43, fillY, basket.w * 0.86, fillHeight);
  ctx.restore();

  ctx.save();
  drawBasketInnerPath();
  ctx.clip();
  ctx.globalAlpha = 0.88;
  for (const stored of storedBodies.slice(-40)) {
    drawBody(stored.type, stored.x, stored.y, stored.r, stored.spin);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i += 1) {
    const y = basket.h * (0.86 - i * 0.17);
    ctx.beginPath();
    ctx.moveTo(-basket.w * 0.36, y);
    ctx.lineTo(basket.w * 0.36, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffe0a6";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-basket.w * 0.55, 0);
  ctx.lineTo(basket.w * 0.55, 0);
  ctx.stroke();
  if (load >= CONFIG.capacity) {
    ctx.shadowColor = "#ffdf5a";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ff5a5a";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-basket.w * 0.56, -3);
    ctx.lineTo(basket.w * 0.56, -3);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff0bd";
    ctx.font = `900 ${Math.max(24, basket.h * 0.54)}px ui-rounded, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FULL", 0, basket.h * 0.58);
  } else {
    ctx.fillStyle = "#fff0bd";
    ctx.font = `900 ${Math.max(13, basket.h * 0.26)}px ui-rounded, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${load}/${CONFIG.capacity}`, 0, basket.h * 0.58);
  }
  ctx.restore();
}

function drawBasketInnerPath() {
  ctx.beginPath();
  ctx.moveTo(-basket.w * 0.42, basket.h * 0.14);
  ctx.lineTo(-basket.w * 0.31, basket.h * 0.84);
  ctx.lineTo(basket.w * 0.31, basket.h * 0.84);
  ctx.lineTo(basket.w * 0.42, basket.h * 0.14);
  ctx.closePath();
}

function drawBody(type, x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  if (type.ring) {
    ctx.strokeStyle = "rgba(245, 220, 166, 0.84)";
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.55, r * 0.42, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (type.sun) {
    const glow = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.7);
    glow.addColorStop(0, "#fff3a0");
    glow.addColorStop(0.45, type.color);
    glow.addColorStop(1, "rgba(255, 130, 50, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.32, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  if (type.name === "地球") {
    ctx.fillStyle = "#45d483";
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, 0, r * 0.25, r * 0.42, 0.4, 0, Math.PI * 2);
    ctx.ellipse(r * 0.3, r * 0.05, r * 0.18, r * 0.28, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (type.name === "木星") {
    ctx.strokeStyle = "#f4c390";
    ctx.lineWidth = Math.max(3, r * 0.16);
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, i * r * 0.28);
      ctx.lineTo(r * 0.8, i * r * 0.22);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function sparkle(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 180;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2.5 + Math.random() * 4,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color,
    });
  }
}

function moveBasketTo(clientX) {
  const rect = canvas.getBoundingClientRect();
  basket.targetX = clamp(clientX - rect.left, basket.w / 2 + 8, width - basket.w / 2 - 8);
}

function prepareAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playCatchSound(points) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420 + points * 9, now);
  osc.frequency.exponentialRampToValueAtTime(760 + points * 6, now + 0.1);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

function playClearSound() {
  if (!audioContext) return;
  [0, 0.08, 0.16, 0.24].forEach((delay, index) => {
    const now = audioContext.currentTime + delay;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.setValueAtTime([523, 659, 784, 1046][index], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function preventZoom(event) {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (!running) return;
  moveBasketTo(event.clientX);
});
canvas.addEventListener("pointermove", (event) => {
  event.preventDefault();
  if (!running) return;
  moveBasketTo(event.clientX);
});
startButton.addEventListener("click", startGame);
learnButton.addEventListener("click", () => {
  window.location.href = getLearningUrl();
});
window.addEventListener("resize", resize);
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("touchmove", preventZoom, { passive: false });
document.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();
    if (now - lastTouchEnd < 360) event.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

resize();
