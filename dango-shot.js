const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const shotCountEl = document.getElementById("shotCount");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const learnButton = document.getElementById("learnButton");

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "dango-shot";
const DEFAULT_LEARNING_URL = "learn.html";
const CONFIG = {
  shots: 3,
  gravity: 1160,
  maxPull: 150,
  power: 8.6,
  settleSeconds: 2.4,
  previewSeconds: 1.15,
  returnCameraSpeed: 7,
};

let width = 0;
let height = 0;
let dpr = 1;
let groundY = 0;
let worldWidth = 0;
let targetBaseX = 0;
let cameraX = 0;
let sling = { x: 0, y: 0 };
let state = "ready";
let score = 0;
let best = Number(localStorage.getItem("dangoShotBest") || 0);
let shotsLeft = CONFIG.shots;
let lastTime = 0;
let previewTimer = 0;
let projectile = null;
let blocks = [];
let targets = [];
let particles = [];
let drag = null;
let settleTimer = 0;
let lastTouchEnd = 0;

requireMiniGameAccess(GAME_ID);
bestScoreEl.textContent = best;

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
  groundY = height * 0.82;
  worldWidth = width * 2.75;
  targetBaseX = width * 2.02;
  sling = { x: width * 0.18, y: groundY - height * 0.29 };
  if (state === "ready") resetScene();
  cameraX = clamp(cameraX, 0, maxCameraX());
  draw();
}

function resetGame() {
  score = 0;
  shotsLeft = CONFIG.shots;
  previewTimer = 0;
  state = "preview";
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  resetScene();
  cameraX = targetCameraX();
  updateHud();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function resetScene() {
  projectile = createProjectile(sling.x, sling.y);
  blocks = createBlocks();
  targets = createTargets();
  particles = [];
  drag = null;
  settleTimer = 0;
}

function createProjectile(x, y) {
  return { x, y, px: x, py: y, vx: 0, vy: 0, r: Math.max(17, Math.min(width, height) * 0.036), launched: false, spin: 0 };
}

function createBlocks() {
  const unit = Math.min(width, height) * 0.072;
  const baseX = targetBaseX;
  const baseY = groundY;
  return [
    block(baseX - unit * 1.25, baseY - unit, unit * 0.58, unit * 2, "#b9824c"),
    block(baseX + unit * 1.25, baseY - unit, unit * 0.58, unit * 2, "#b9824c"),
    block(baseX, baseY - unit * 2.2, unit * 3.1, unit * 0.55, "#d6a15f"),
    block(baseX - unit * 2.25, baseY - unit * 0.55, unit * 0.55, unit * 1.1, "#c18a51"),
    block(baseX + unit * 2.25, baseY - unit * 0.55, unit * 0.55, unit * 1.1, "#c18a51"),
    block(baseX, baseY - unit * 3.35, unit * 0.66, unit * 1.5, "#b9824c"),
    block(baseX, baseY - unit * 4.25, unit * 2.2, unit * 0.5, "#d6a15f"),
  ];
}

function block(x, y, w, h, color) {
  return { x, y, w, h, vx: 0, vy: 0, angle: 0, spin: 0, color, hp: 2, scored: false };
}

function createTargets() {
  const unit = Math.min(width, height) * 0.072;
  const baseX = targetBaseX;
  return [
    target(baseX, groundY - unit * 2.85, unit * 0.42, 80),
    target(baseX - unit * 1.4, groundY - unit * 0.35, unit * 0.36, 40),
    target(baseX + unit * 1.4, groundY - unit * 0.35, unit * 0.36, 40),
  ];
}

function target(x, y, r, points) {
  return { x, y, r, vx: 0, vy: 0, points, hit: false, scored: false };
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (state === "preview" || state === "aim" || state === "fly" || state === "settle") {
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
}

function update(dt) {
  updateCamera(dt);
  updateProjectile(dt);
  updateBlocks(dt);
  updateTargets(dt);
  updateParticles(dt);
  scoreFallenObjects();
  if (state === "settle") {
    settleTimer += dt;
    if (settleTimer >= CONFIG.settleSeconds) nextShot();
  }
}

function updateCamera(dt) {
  if (state === "preview") {
    previewTimer += dt;
    if (previewTimer >= CONFIG.previewSeconds) {
      cameraX = approach(cameraX, 0, CONFIG.returnCameraSpeed * dt);
      if (cameraX < 1) {
        cameraX = 0;
        state = "aim";
      }
    }
    return;
  }
  if (state === "aim") {
    cameraX = approach(cameraX, 0, CONFIG.returnCameraSpeed * dt);
    return;
  }
  if (state === "fly" || state === "settle") {
    const target = clamp(projectile.x - width * 0.32, 0, maxCameraX());
    cameraX = approach(cameraX, target, 5.8 * dt);
  }
}

function updateProjectile(dt) {
  if (!projectile || !projectile.launched) return;
  projectile.px = projectile.x;
  projectile.py = projectile.y;
  projectile.vy += CONFIG.gravity * dt;
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;
  projectile.spin += projectile.vx * dt * 0.012;

  if (projectile.y + projectile.r > groundY) {
    projectile.y = groundY - projectile.r;
    projectile.vy *= -0.34;
    projectile.vx *= 0.72;
    thump(projectile.x, projectile.y, "#7b5d42");
  }
  if (projectile.x - projectile.r < 0 || projectile.x + projectile.r > worldWidth) {
    projectile.vx *= -0.35;
    projectile.x = clamp(projectile.x, projectile.r, worldWidth - projectile.r);
  }
  for (const b of blocks) collideCircleBlock(projectile, b);
  for (const t of targets) collideCircleTarget(projectile, t);
  if (Math.abs(projectile.vx) + Math.abs(projectile.vy) < 55 || projectile.x > worldWidth - 40) {
    if (state === "fly") {
      state = "settle";
      settleTimer = 0;
    }
  }
}

function updateBlocks(dt) {
  for (const b of blocks) {
    if (Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.spin) < 1) continue;
    b.vy += CONFIG.gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.spin * dt;
    b.vx *= 0.992;
    b.spin *= 0.985;
    if (b.y + b.h / 2 > groundY) {
      b.y = groundY - b.h / 2;
      b.vy *= -0.28;
      b.vx *= 0.78;
      b.spin *= 0.7;
    }
  }
}

function updateTargets(dt) {
  for (const t of targets) {
    if (!t.hit) continue;
    t.vy += CONFIG.gravity * dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.vx *= 0.99;
    if (t.y + t.r > groundY) {
      t.y = groundY - t.r;
      t.vy *= -0.34;
      t.vx *= 0.82;
    }
  }
}

function updateParticles(dt) {
  particles = particles.filter((p) => {
    p.life -= dt;
    p.vy += 720 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return p.life > 0;
  });
}

function collideCircleBlock(c, b) {
  const closestX = Math.max(b.x - b.w / 2, Math.min(c.x, b.x + b.w / 2));
  const closestY = Math.max(b.y - b.h / 2, Math.min(c.y, b.y + b.h / 2));
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > c.r * c.r) return;
  const dist = Math.max(1, Math.sqrt(distSq));
  const nx = dx / dist;
  const ny = dy / dist;
  const impact = Math.hypot(c.vx, c.vy);
  c.x += nx * (c.r - dist + 1);
  c.vx = c.vx * 0.58 + nx * impact * 0.26;
  c.vy = c.vy * 0.58 + ny * impact * 0.26;
  b.vx += c.vx * 0.42 + nx * impact * 1.2;
  b.vy += c.vy * 0.2 + ny * impact * 0.65;
  b.spin += (ny || 0.2) * impact * 0.018;
  b.hp -= 1;
  thump(closestX, closestY, "#ffe082");
}

function collideCircleTarget(c, t) {
  if (t.scored) return;
  const dx = c.x - t.x;
  const dy = c.y - t.y;
  const dist = Math.hypot(dx, dy);
  if (dist > c.r + t.r) return;
  const impact = Math.hypot(c.vx, c.vy);
  t.hit = true;
  t.vx += c.vx * 0.45;
  t.vy += c.vy * 0.28 - 160;
  t.scored = true;
  addScore(t.points);
  sparkle(t.x, t.y, "#ff6f91", 16);
  c.vx *= 0.72;
  c.vy *= 0.72;
  if (impact > 340) addScore(20);
}

function scoreFallenObjects() {
  for (const b of blocks) {
    if (!b.scored && (Math.abs(b.angle) > 0.55 || b.x < targetBaseX - width * 0.18 || b.hp <= 0)) {
      b.scored = true;
      addScore(25);
      sparkle(b.x, b.y, "#ffd65e", 10);
    }
  }
}

function addScore(points) {
  score += points;
  updateHud();
}

function nextShot() {
  shotsLeft -= 1;
  updateHud();
  if (shotsLeft <= 0) {
    finishGame();
    return;
  }
  projectile = createProjectile(sling.x, sling.y);
  cameraX = 0;
  state = "aim";
}

function finishGame() {
  state = "finish";
  if (score > best) {
    best = score;
    localStorage.setItem("dangoShotBest", String(best));
    resultMessage.textContent = "ベストこうしん！";
  } else {
    resultMessage.textContent = "もういちど とばしてみよう。";
  }
  resultTitle.textContent = `${score}てん`;
  bestScoreEl.textContent = best;
  finishPanel.classList.remove("hidden");
}

function updateHud() {
  shotCountEl.textContent = shotsLeft;
  scoreEl.textContent = score;
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawSling();
  drawBlocks();
  drawTargets();
  drawProjectile();
  drawParticles();
  ctx.restore();
  if (state === "aim" && !drag) drawHint();
  if (state === "preview") drawPreviewText();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#91ddff");
  sky.addColorStop(1, "#d9fff4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, groundY);

  ctx.save();
  ctx.translate(-cameraX * 0.35, 0);
  ctx.fillStyle = "#83cf70";
  ctx.beginPath();
  ctx.moveTo(-width, groundY - height * 0.08);
  for (let x = -width; x <= worldWidth + width; x += width * 0.5) {
    ctx.quadraticCurveTo(x + width * 0.25, groundY - height * 0.22, x + width * 0.5, groundY - height * 0.08);
  }
  ctx.lineTo(worldWidth + width, groundY);
  ctx.lineTo(-width, groundY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 9; i += 1) {
    const x = width * (0.15 + i * 0.34);
    ctx.beginPath();
    ctx.ellipse(x, height * 0.17 + (i % 2) * 18, 38, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 34, height * 0.17 + (i % 2) * 18, 28, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "#93673c";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let x = -(cameraX % 80); x < width; x += 80) {
    ctx.fillRect(x, groundY + 22, 46, 8);
  }
}

function drawSling() {
  ctx.lineCap = "round";
  ctx.strokeStyle = "#6b4124";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(sling.x - 14, sling.y + 74);
  ctx.lineTo(sling.x - 7, sling.y + 8);
  ctx.moveTo(sling.x + 18, sling.y + 74);
  ctx.lineTo(sling.x + 8, sling.y + 8);
  ctx.stroke();

  if (state === "aim" && projectile) {
    ctx.strokeStyle = "#4f2f20";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sling.x - 8, sling.y + 10);
    ctx.lineTo(projectile.x, projectile.y);
    ctx.lineTo(sling.x + 9, sling.y + 10);
    ctx.stroke();
  }
}

function drawProjectile() {
  if (!projectile) return;
  drawPillbug(projectile.x, projectile.y, projectile.r, projectile.spin);
}

function drawPillbug(x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "#5c5a62";
  ctx.strokeStyle = "#323038";
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = Math.max(2, r * 0.08);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.28 + Math.abs(i) * 0.11), -0.75, 0.75);
    ctx.stroke();
  }
  ctx.fillStyle = "#1f1d22";
  ctx.beginPath();
  ctx.arc(r * 0.34, -r * 0.16, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlocks() {
  for (const b of blocks) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    ctx.strokeStyle = "#7b512d";
    ctx.lineWidth = 3;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-b.w / 2 + 5, -b.h / 2 + 5, b.w - 10, Math.max(6, b.h * 0.16));
    ctx.restore();
  }
}

function drawTargets() {
  for (const t of targets) {
    if (t.scored && t.y > groundY + 80) continue;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.fillStyle = t.scored ? "#ffb3c4" : "#ff5f88";
    ctx.strokeStyle = "#9c2f4a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-t.r * 0.25, -t.r * 0.12, t.r * 0.12, 0, Math.PI * 2);
    ctx.arc(t.r * 0.23, -t.r * 0.12, t.r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b1e25";
    ctx.beginPath();
    ctx.arc(-t.r * 0.25, -t.r * 0.1, t.r * 0.05, 0, Math.PI * 2);
    ctx.arc(t.r * 0.23, -t.r * 0.1, t.r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHint() {
  ctx.fillStyle = "rgba(45,38,29,0.74)";
  ctx.font = `900 ${Math.max(18, width * 0.026)}px ui-rounded, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("ひっぱって はなす", sling.x - cameraX + width * 0.08, sling.y - 58);
}

function drawPreviewText() {
  ctx.fillStyle = "rgba(45,38,29,0.72)";
  ctx.font = `900 ${Math.max(18, width * 0.026)}px ui-rounded, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("まとはここ！", targetBaseX - cameraX, groundY - height * 0.45);
}

function pointerDown(event) {
  if (state !== "aim" || !projectile) return;
  const p = pointerPosition(event);
  if (Math.hypot(p.x - projectile.x, p.y - projectile.y) > projectile.r * 2.4) return;
  drag = p;
  projectile.x = p.x;
  projectile.y = p.y;
  event.preventDefault();
}

function pointerMove(event) {
  if (!drag || state !== "aim") return;
  const p = pointerPosition(event);
  const dx = p.x - sling.x;
  const dy = p.y - sling.y;
  const dist = Math.hypot(dx, dy);
  const scale = Math.min(CONFIG.maxPull, dist) / Math.max(1, dist);
  projectile.x = sling.x + dx * scale;
  projectile.y = Math.min(sling.y + dy * scale, groundY - projectile.r - 10);
  draw();
  event.preventDefault();
}

function pointerUp(event) {
  if (!drag || state !== "aim") return;
  const dx = sling.x - projectile.x;
  const dy = sling.y - projectile.y;
  projectile.vx = dx * CONFIG.power;
  projectile.vy = dy * CONFIG.power;
  projectile.launched = true;
  state = "fly";
  drag = null;
  event.preventDefault();
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] || event.changedTouches[0] : event;
  return { x: point.clientX - rect.left + cameraX, y: point.clientY - rect.top };
}

function thump(x, y, color) {
  sparkle(x, y, color, 5);
}

function sparkle(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 180;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 90,
      r: 3 + Math.random() * 4,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color,
    });
  }
}

function targetCameraX() {
  return clamp(targetBaseX - width * 0.5, 0, maxCameraX());
}

function maxCameraX() {
  return Math.max(0, worldWidth - width);
}

function approach(current, target, amount) {
  return current + (target - current) * Math.min(1, amount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function preventZoom(event) {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}

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

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
startButton.addEventListener("click", resetGame);
restartButton.addEventListener("click", resetGame);
learnButton.addEventListener("click", () => {
  window.location.href = getLearningUrl();
});
window.addEventListener("resize", resize);
resize();
