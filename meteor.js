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

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "meteor";
const DEFAULT_LEARNING_URL = "learn.html";
const GAME_CONFIG = {
  roundSeconds: 30,
  clearScore: 400,
  spawnStart: 0.58,
  spawnMin: 0.31,
  maxMeteors: 12,
  fireCooldown: 0.16,
  bossFirstSecond: 17,
  bossSpawnEverySeconds: 4.2,
  bossMaxCount: 3,
};

const METEOR_TYPES = [
  { id: "pebble", label: "小さな隕石", points: 2, radius: 13, speed: 92, hp: 1, color: "#a88d76", glow: "#ffd0a6", weight: 34 },
  { id: "rock", label: "中くらいの隕石", points: 4, radius: 19, speed: 78, hp: 1, color: "#8b6e63", glow: "#ffb27c", weight: 28 },
  { id: "boulder", label: "大きな隕石", points: 8, radius: 27, speed: 62, hp: 2, color: "#6d5a58", glow: "#ff8f5c", weight: 18 },
  { id: "ice", label: "氷の隕石", points: 11, radius: 23, speed: 96, hp: 1, color: "#7ee7ff", glow: "#d7fbff", weight: 12 },
  { id: "gold", label: "金の隕石", points: 18, radius: 21, speed: 118, hp: 1, color: "#ffd75e", glow: "#fff3a5", weight: 8 },
];

const BOSS_METEOR = {
  id: "boss",
  label: "超大型隕石",
  points: 70,
  radius: 48,
  speed: 42,
  hp: 10,
  color: "#3f3445",
  glow: "#ff4f9a",
  weight: 0,
};

let width = 0;
let height = 0;
let dpr = 1;
let groundY = 0;
let score = 0;
let timeLeft = GAME_CONFIG.roundSeconds;
let running = false;
let gameCleared = false;
let lastTime = 0;
let spawnTimer = 0;
let fireTimer = 0;
let bossSpawnTimer = 0;
let bossSpawnCount = 0;
let shake = 0;
let meteors = [];
let shots = [];
let particles = [];
let stars = [];
let cannon = { x: 0, y: 0, angle: -Math.PI / 2 };
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
  groundY = height - 34;
  cannon.x = cannon.x || width / 2;
  cannon.y = groundY - 8;
  stars = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.82,
    r: 0.8 + Math.random() * 1.6,
    a: 0.35 + Math.random() * 0.65,
  }));
}

function startGame() {
  prepareAudio();
  score = 0;
  timeLeft = GAME_CONFIG.roundSeconds;
  running = true;
  gameCleared = false;
  lastTime = performance.now();
  spawnTimer = 0.32;
  fireTimer = 0;
  bossSpawnTimer = GAME_CONFIG.bossFirstSecond;
  bossSpawnCount = 0;
  shake = 0;
  meteors = [];
  shots = [];
  particles = [];
  cannon.x = width / 2;
  cannon.angle = -Math.PI / 2;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft.toFixed(1);
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  finishPanel.classList.remove("clear", "miss");
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
  timeEl.textContent = timeLeft.toFixed(1);
  fireTimer = Math.max(0, fireTimer - dt);
  shake = Math.max(0, shake - dt * 6);

  spawnTimer -= dt;
  const elapsed = GAME_CONFIG.roundSeconds - timeLeft;
  const interval = Math.max(GAME_CONFIG.spawnMin, GAME_CONFIG.spawnStart - elapsed * 0.008);
  if (spawnTimer <= 0 && meteors.length < GAME_CONFIG.maxMeteors) {
    spawnMeteor();
    spawnTimer = interval * (0.72 + Math.random() * 0.58);
  }
  bossSpawnTimer -= dt;
  if (
    elapsed >= GAME_CONFIG.bossFirstSecond
    && bossSpawnTimer <= 0
    && bossSpawnCount < GAME_CONFIG.bossMaxCount
  ) {
    spawnBossMeteor();
    bossSpawnCount += 1;
    bossSpawnTimer = GAME_CONFIG.bossSpawnEverySeconds;
  }

  updateShots(dt);
  updateMeteors(dt);
  updateParticles(dt);
  checkHits();

  if (timeLeft <= 0) finishGame();
}

function updateShots(dt) {
  for (const shot of shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    shot.spin += dt * 18;
  }
  shots = shots.filter((shot) => shot.life > 0 && shot.x > -30 && shot.x < width + 30 && shot.y > -60);
}

function updateMeteors(dt) {
  for (const meteor of meteors) {
    meteor.x += meteor.vx * dt;
    meteor.y += meteor.vy * dt;
    meteor.spin += meteor.spinSpeed * dt;
    if (meteor.y + meteor.radius >= groundY) {
      burst(meteor.x, groundY, meteor.type.glow, 12, 1.1);
      playLowBoom();
      shake = Math.min(1, shake + 0.35);
      meteor.dead = true;
    }
  }
  meteors = meteors.filter((meteor) => !meteor.dead && meteor.y < height + 80);
}

function updateParticles(dt) {
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 180 * dt;
    particle.life -= dt;
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function checkHits() {
  for (const shot of shots) {
    if (shot.dead) continue;
    for (const meteor of meteors) {
      if (meteor.dead) continue;
      const distance = Math.hypot(shot.x - meteor.x, shot.y - meteor.y);
      if (distance > meteor.radius + shot.radius) continue;
      shot.dead = true;
      meteor.hp -= 1;
      burst(shot.x, shot.y, "#cfffff", 8, 0.65);
      if (meteor.hp <= 0) {
        meteor.dead = true;
        score += meteor.type.points;
        scoreEl.textContent = score;
        burst(meteor.x, meteor.y, meteor.type.glow, Math.round(meteor.radius * 0.9), 1.25);
        floatingText(`+${meteor.type.points}`, meteor.x, meteor.y, meteor.type.glow);
        playHitSound(meteor.type.points);
      } else {
        burst(meteor.x, meteor.y, meteor.type.glow, 8, 0.75);
        playCrackSound();
      }
      break;
    }
  }
  shots = shots.filter((shot) => !shot.dead);
  meteors = meteors.filter((meteor) => !meteor.dead);
}

function finishGame() {
  running = false;
  const cleared = score >= GAME_CONFIG.clearScore;
  gameCleared = cleared;
  resultLabel.textContent = cleared ? "CLEAR" : "RESULT";
  resultTitle.textContent = `${score}てん`;
  resultMessage.textContent = cleared ? "ちきゅうをまもったぞ！" : "400てんまであと少し。";
  finishPanel.classList.toggle("clear", cleared);
  finishPanel.classList.toggle("miss", !cleared);
  finishPanel.classList.remove("hidden");
  if (cleared) {
    playClearSound();
    for (let i = 0; i < 44; i += 1) {
      burst(Math.random() * width, 40 + Math.random() * height * 0.42, i % 2 ? "#53dbff" : "#ffd75e", 4, 1.1);
    }
    draw();
  }
}

function spawnMeteor() {
  const type = chooseMeteorType();
  const radius = type.radius * (0.88 + Math.random() * 0.24);
  const fromLeft = Math.random() < 0.5;
  const x = Math.random() * width;
  const y = -radius - 12;
  const sidePush = (fromLeft ? 1 : -1) * (18 + Math.random() * 44);
  meteors.push({
    type,
    x,
    y,
    radius,
    vx: sidePush,
    vy: type.speed * (0.86 + Math.random() * 0.28),
    hp: type.hp,
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 4,
  });
}

function spawnBossMeteor() {
  const drift = (Math.random() - 0.5) * 24;
  meteors.push({
    type: BOSS_METEOR,
    x: width * (0.28 + Math.random() * 0.44),
    y: -BOSS_METEOR.radius - 18,
    radius: BOSS_METEOR.radius * (0.92 + Math.random() * 0.12),
    vx: drift,
    vy: BOSS_METEOR.speed * (0.9 + Math.random() * 0.16),
    hp: BOSS_METEOR.hp,
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 1.6,
  });
}

function chooseMeteorType() {
  const total = METEOR_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let roll = Math.random() * total;
  for (const type of METEOR_TYPES) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return METEOR_TYPES[0];
}

function aimAndFire(x, y) {
  if (!running) return;
  if (y > groundY - 70) {
    cannon.x = clamp(x, 28, width - 28);
  }
  const dx = x - cannon.x;
  const dy = y - cannon.y;
  let angle = Math.atan2(dy, dx);
  angle = clamp(angle, -Math.PI + 0.22, -0.22);
  cannon.angle = angle;
  fireShot();
}

function fireShot() {
  if (fireTimer > 0) return;
  fireTimer = GAME_CONFIG.fireCooldown;
  const speed = 610;
  const muzzleX = cannon.x + Math.cos(cannon.angle) * 34;
  const muzzleY = cannon.y + Math.sin(cannon.angle) * 34;
  shots.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(cannon.angle) * speed,
    vy: Math.sin(cannon.angle) * speed,
    radius: 6,
    life: 1.25,
    spin: 0,
  });
  burst(muzzleX, muzzleY, "#53dbff", 4, 0.35);
  playShootSound();
}

function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function burst(x, y, color, count, power) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (60 + Math.random() * 180) * power;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.38 + Math.random() * 0.36,
      size: 2 + Math.random() * 5,
      color,
      text: "",
    });
  }
}

function floatingText(text, x, y, color) {
  particles.push({
    x,
    y,
    vx: 0,
    vy: -44,
    life: 0.72,
    size: 26,
    color,
    text,
  });
}

function draw() {
  const shakeX = shake ? (Math.random() - 0.5) * shake * 8 : 0;
  const shakeY = shake ? (Math.random() - 0.5) * shake * 8 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  for (const shot of shots) drawShot(shot);
  for (const meteor of meteors) drawMeteor(meteor);
  drawParticles();
  drawCannon();
  ctx.restore();
}

function drawBackground() {
  if (gameCleared) {
    drawClearSkyBackground();
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#07152d");
  sky.addColorStop(0.58, "#12346d");
  sky.addColorStop(1, "#0c274f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#12311f";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = "#1b5732";
  for (let x = -20; x < width + 20; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 20, groundY - 18 - Math.sin(x) * 7);
    ctx.lineTo(x + 42, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClearSkyBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#63c9ff");
  sky.addColorStop(0.58, "#b9efff");
  sky.addColorStop(1, "#e8fbff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  drawCloud(width * 0.18, height * 0.18, 1.05);
  drawCloud(width * 0.72, height * 0.24, 0.92);
  drawCloud(width * 0.46, height * 0.12, 0.65);

  ctx.fillStyle = "#35b96f";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = "#54d17b";
  for (let x = -20; x < width + 20; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 20, groundY - 18 - Math.sin(x) * 7);
    ctx.lineTo(x + 42, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(-34, 9, 22, 0, Math.PI * 2);
  ctx.arc(-11, -4, 28, 0, Math.PI * 2);
  ctx.arc(20, 3, 24, 0, Math.PI * 2);
  ctx.arc(43, 12, 18, 0, Math.PI * 2);
  ctx.rect(-50, 10, 106, 24);
  ctx.fill();
  ctx.restore();
}

function drawMeteor(meteor) {
  const { type, radius } = meteor;
  ctx.save();
  ctx.translate(meteor.x, meteor.y);
  ctx.rotate(meteor.spin);
  const trail = ctx.createLinearGradient(-radius * 2.1, -radius * 2.1, radius, radius);
  trail.addColorStop(0, "rgba(255, 120, 60, 0)");
  trail.addColorStop(1, type.glow);
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.ellipse(-radius * 0.9, -radius * 1.3, radius * 0.45, radius * 1.45, -0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = type.glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = type.color;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const angle = (Math.PI * 2 * i) / 9;
    const r = radius * (0.82 + ((i * 17) % 9) / 38);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.arc(-radius * 0.28, -radius * 0.25, radius * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShot(shot) {
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(shot.spin);
  ctx.shadowColor = "#53dbff";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#d7fbff";
  ctx.beginPath();
  ctx.arc(0, 0, shot.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#53dbff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-shot.radius * 1.8, 0);
  ctx.lineTo(shot.radius * 1.8, 0);
  ctx.moveTo(0, -shot.radius * 1.8);
  ctx.lineTo(0, shot.radius * 1.8);
  ctx.stroke();
  ctx.restore();
}

function drawCannon() {
  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.rotate(cannon.angle + Math.PI / 2);
  ctx.fillStyle = "#53dbff";
  ctx.shadowColor = "#53dbff";
  ctx.shadowBlur = 12;
  ctx.fillRect(-8, -42, 16, 44);
  ctx.restore();

  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.shadowColor = "#53dbff";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#d7fbff";
  ctx.beginPath();
  ctx.arc(0, 0, 24, Math.PI, 0);
  ctx.lineTo(24, 12);
  ctx.lineTo(-24, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2f8df2";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    const alpha = clamp(particle.life / 0.72, 0, 1);
    ctx.globalAlpha = alpha;
    if (particle.text) {
      ctx.fillStyle = particle.color;
      ctx.font = "950 26px ui-rounded, Hiragino Maru Gothic ProN, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(particle.text, particle.x, particle.y);
    } else {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function prepareAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(freq, duration, gain, type = "sine") {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(amp).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playShootSound() {
  playTone(720, 0.08, 0.07, "triangle");
}

function playCrackSound() {
  playTone(190, 0.08, 0.08, "sawtooth");
}

function playLowBoom() {
  playTone(88, 0.12, 0.06, "sawtooth");
}

function playHitSound(points) {
  playTone(points >= 25 ? 1040 : 840, 0.08, 0.09, "square");
}

function playClearSound() {
  [640, 820, 980, 1280].forEach((freq, index) => {
    window.setTimeout(() => playTone(freq, 0.11, 0.09, "triangle"), index * 82);
  });
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const point = pointerPoint(event);
  aimAndFire(point.x, point.y);
});

canvas.addEventListener("pointermove", (event) => {
  if (!running || event.buttons === 0) return;
  event.preventDefault();
  const point = pointerPoint(event);
  if (point.y > groundY - 110) {
    cannon.x = clamp(point.x, 28, width - 28);
  }
});

canvas.addEventListener("pointerup", (event) => {
  canvas.releasePointerCapture(event.pointerId);
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", () => {
  window.location.href = getLearningUrl();
});
window.addEventListener("resize", resize);
preventZoomGestures();
resize();
draw();
