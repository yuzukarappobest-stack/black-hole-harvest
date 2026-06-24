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
  shots: 8,
  clearScore: 200,
  gravity: 1160,
  maxPull: 290,
  power: 8.9,
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
let targets = [];
let particles = [];
let drag = null;
let settleTimer = 0;
let lastTouchEnd = 0;
let audioContext = null;

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
  targets = createTargets();
  particles = [];
  drag = null;
  settleTimer = 0;
}

function createProjectile(x, y) {
  return { x, y, px: x, py: y, vx: 0, vy: 0, r: Math.max(17, Math.min(width, height) * 0.036), launched: false, spin: 0 };
}

function createTargets() {
  const unit = Math.min(width, height) * 0.074;
  const baseX = targetBaseX;
  const airY = groundY - unit * 4.6;
  const midAirY = groundY - unit * 3.45;
  const groundBugY = groundY - unit * 0.72;
  return [
    target("ちょう", "🦋", baseX - unit * 3.4, airY, unit * 0.54, true),
    target("はち", "🐝", baseX - unit * 1.2, midAirY, unit * 0.48, true),
    target("とんぼ", "✦", baseX + unit * 1.2, airY, unit * 0.5, true),
    target("が", "☾", baseX + unit * 3.35, midAirY, unit * 0.5, true),
    target("ばった", "🦗", baseX - unit * 3.05, groundBugY, unit * 0.5, false),
    target("かぶと", "🪲", baseX - unit * 0.95, groundBugY, unit * 0.54, false),
    target("くわがた", "♆", baseX + unit * 1.25, groundBugY, unit * 0.54, false),
    target("せみ", "◉", baseX + unit * 3.4, groundBugY, unit * 0.5, false),
  ];
}

function target(name, icon, x, y, r, airborne) {
  return { name, icon, x, y, r, points: 25, hit: false, scored: false, airborne, flap: Math.random() * Math.PI * 2 };
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
  updateTargets(dt);
  updateParticles(dt);
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
  for (const t of targets) collideCircleTarget(projectile, t);
  if (Math.abs(projectile.vx) + Math.abs(projectile.vy) < 55 || projectile.x > worldWidth - 40) {
    if (state === "fly") {
      state = "settle";
      settleTimer = 0;
    }
  }
}

function updateTargets(dt) {
  for (const t of targets) {
    t.flap += dt * (t.airborne ? 5.2 : 2.2);
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

function collideCircleTarget(c, t) {
  if (t.scored) return;
  const dx = c.x - t.x;
  const dy = c.y - t.y;
  const dist = Math.hypot(dx, dy);
  if (dist > c.r + t.r) return;
  const impact = Math.hypot(c.vx, c.vy);
  t.hit = true;
  t.scored = true;
  addScore(t.points);
  playHitSound(0.9);
  sparkle(t.x, t.y, t.airborne ? "#8ee8ff" : "#ffd65e", 20);
  c.vx *= 0.72;
  c.vy *= 0.72;
  if (impact > 340) sparkle(t.x, t.y, "#ffffff", 8);
  if (targets.every((targetItem) => targetItem.scored)) finishGame();
}

function addScore(points) {
  score += points;
  updateHud();
}

function nextShot() {
  shotsLeft -= 1;
  updateHud();
  if (shotsLeft <= 0 || targets.every((targetItem) => targetItem.scored)) {
    finishGame();
    return;
  }
  projectile = createProjectile(sling.x, sling.y);
  cameraX = 0;
  state = "aim";
}

function finishGame() {
  state = "finish";
  const cleared = targets.every((targetItem) => targetItem.scored) && score >= CONFIG.clearScore;
  if (score > best) {
    best = score;
    localStorage.setItem("dangoShotBest", String(best));
    resultMessage.textContent = cleared ? "ぜんぶあてた！ベストこうしん！" : "ベストこうしん！";
  } else {
    resultMessage.textContent = cleared ? "ぜんぶあてた！クリア！" : "虫をぜんぶねらおう。";
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

function drawTargets() {
  for (const t of targets) {
    if (t.scored) continue;
    ctx.save();
    ctx.translate(t.x, t.y);
    drawBug(t);
    ctx.restore();
  }
}

function drawBug(t) {
  const flap = Math.sin(t.flap) * t.r * 0.16;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (t.name === "とんぼ") {
    drawDragonfly(t.r, flap);
  } else if (t.name === "が") {
    drawMoth(t.r, flap);
  } else if (t.name === "くわがた") {
    drawStagBeetle(t.r);
  } else if (t.name === "せみ") {
    drawCicada(t.r);
  } else {
    ctx.font = `${t.r * 1.9}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText(t.icon, 0, 0);
  }
  ctx.fillStyle = "rgba(45,38,29,0.78)";
  ctx.font = `900 ${Math.max(12, t.r * 0.42)}px ui-rounded, sans-serif`;
  ctx.fillText(t.name, 0, t.r * 1.42);
}

function drawDragonfly(r, flap) {
  ctx.strokeStyle = "#4c8a55";
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, 0);
  ctx.lineTo(r * 0.7, 0);
  ctx.stroke();
  ctx.fillStyle = "rgba(190, 245, 255, 0.78)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.16, -r * 0.34 - flap, r * 0.56, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.ellipse(r * 0.16, -r * 0.34 + flap, r * 0.56, r * 0.18, 0.4, 0, Math.PI * 2);
  ctx.ellipse(-r * 0.16, r * 0.34 + flap, r * 0.56, r * 0.18, 0.4, 0, Math.PI * 2);
  ctx.ellipse(r * 0.16, r * 0.34 - flap, r * 0.56, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#79c85b";
  ctx.beginPath();
  ctx.arc(r * 0.78, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoth(r, flap) {
  ctx.fillStyle = "#c9a0dd";
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, flap, r * 0.48, r * 0.72, -0.45, 0, Math.PI * 2);
  ctx.ellipse(r * 0.34, -flap, r * 0.48, r * 0.72, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#725088";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.18, r * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStagBeetle(r) {
  ctx.fillStyle = "#4a2d1d";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 0.46, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a2d1d";
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 0.52);
  ctx.quadraticCurveTo(-r * 0.78, -r * 1.05, -r * 0.92, -r * 0.35);
  ctx.moveTo(r * 0.18, -r * 0.52);
  ctx.quadraticCurveTo(r * 0.78, -r * 1.05, r * 0.92, -r * 0.35);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.12, r * 0.07, 0, Math.PI * 2);
  ctx.arc(r * 0.14, -r * 0.12, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawCicada(r) {
  ctx.fillStyle = "#c98943";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.4, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(245, 218, 166, 0.86)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, r * 0.12, r * 0.34, r * 0.72, -0.26, 0, Math.PI * 2);
  ctx.ellipse(r * 0.35, r * 0.12, r * 0.34, r * 0.72, 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5d7d45";
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.moveTo(-r * 0.22, -r * 0.15);
  ctx.lineTo(r * 0.22, -r * 0.15);
  ctx.moveTo(-r * 0.2, r * 0.12);
  ctx.lineTo(r * 0.2, r * 0.12);
  ctx.stroke();
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
  playLaunchSound();
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

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playLaunchSound() {
  const audio = ensureAudio();
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

function playHitSound(strength = 0.7) {
  const audio = ensureAudio();
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(130 + Math.random() * 70, now);
  osc.frequency.exponentialRampToValueAtTime(58, now + 0.11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2 * strength, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.14);
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
