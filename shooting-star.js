const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const scoreEl = document.getElementById("score");
const resultScoreEl = document.getElementById("resultScore");
const resultMessageEl = document.getElementById("resultMessage");
const resultLabelEl = document.getElementById("resultLabel");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const startButton = document.getElementById("startButton");
const returnButton = document.getElementById("returnButton");
const difficultyButtons = [...document.querySelectorAll(".difficulty-button")];

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const GAME_ID = "shooting-star";
const DEFAULT_LEARNING_URL = "learn.html";
const GAME_CONFIG = {
  roundSeconds: 30,
  clearScore: 25,
  firstStarDelay: 0.85,
  maxStars: 3,
};

const DIFFICULTIES = {
  slow: { spawnMinSeconds: 1.5, spawnMaxSeconds: 2.35, speedScale: .45 },
  normal: { spawnMinSeconds: 1.05, spawnMaxSeconds: 1.8, speedScale: .68 },
  fast: { spawnMinSeconds: .72, spawnMaxSeconds: 1.42, speedScale: 1 },
  super: { spawnMinSeconds: .48, spawnMaxSeconds: .92, speedScale: 1.38 },
};

let width = 0;
let height = 0;
let dpr = 1;
let running = false;
let score = 0;
let timeLeft = GAME_CONFIG.roundSeconds;
let spawnTimer = GAME_CONFIG.firstStarDelay;
let lastTime = 0;
let stars = [];
let skyDots = [];
let sparks = [];
let audioContext = null;
let difficulty = "fast";

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
  skyDots = Array.from({ length: Math.max(36, Math.round(width * height / 7500)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: .55 + Math.random() * 1.45,
    alpha: .3 + Math.random() * .65,
    twinkle: Math.random() * Math.PI * 2,
  }));
}

function startGame() {
  prepareAudio();
  score = 0;
  timeLeft = GAME_CONFIG.roundSeconds;
  spawnTimer = GAME_CONFIG.firstStarDelay;
  stars = [];
  sparks = [];
  running = true;
  lastTime = performance.now();
  scoreEl.textContent = "0";
  timeEl.textContent = timeLeft.toFixed(1);
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(.035, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw(now / 1000);
  if (running) requestAnimationFrame(loop);
}

function update(dt) {
  timeLeft = Math.max(0, timeLeft - dt);
  timeEl.textContent = timeLeft.toFixed(1);

  spawnTimer -= dt;
  if (spawnTimer <= 0 && stars.length < GAME_CONFIG.maxStars) {
    spawnShootingStar();
    const settings = DIFFICULTIES[difficulty];
    spawnTimer = settings.spawnMinSeconds + Math.random() * (settings.spawnMaxSeconds - settings.spawnMinSeconds);
  }

  for (const star of stars) {
    star.x += star.vx * dt;
    star.y += star.vy * dt;
    star.life -= dt;
    star.phase += dt * 10;
  }
  stars = stars.filter((star) => star.life > 0 && star.x > -180 && star.x < width + 180 && star.y > -120 && star.y < height + 120);

  for (const spark of sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt;
    spark.size *= .975;
  }
  sparks = sparks.filter((spark) => spark.life > 0);

  if (timeLeft <= 0) finishGame();
}

function spawnShootingStar() {
  const direction = Math.random() < .5 ? 1 : -1;
  const startX = direction === 1 ? -55 : width + 55;
  // Keep every shooting star above the foreground so it remains visible long
  // enough to tap before it reaches the landscape.
  const startY = height * (.07 + Math.random() * .46);
  const speed = Math.max(280, width * (1.02 + Math.random() * .48)) * DIFFICULTIES[difficulty].speedScale;
  const angle = direction === 1 ? .23 + Math.random() * .22 : Math.PI - (.23 + Math.random() * .22);
  stars.push({
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 15 + Math.random() * 11,
    life: 1.5 + Math.random() * .46,
    phase: Math.random() * Math.PI * 2,
    color: Math.random() < .68 ? "#fff7ad" : "#a9f1ff",
  });
}

function tapStar(clientX, clientY) {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let hit = null;
  let closest = Infinity;

  for (const star of stars) {
    const distance = Math.hypot(x - star.x, y - star.y);
    if (distance < star.size * 2.4 && distance < closest) {
      hit = star;
      closest = distance;
    }
  }
  if (!hit) return;

  stars = stars.filter((star) => star !== hit);
  score += 1;
  scoreEl.textContent = score;
  createSparkles(hit.x, hit.y, hit.color);
  playTapSound();
  if (score >= GAME_CONFIG.clearScore) finishGame(true);
}

function createSparkles(x, y, color) {
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 150;
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2.5 + Math.random() * 3.5,
      life: .32 + Math.random() * .34,
      color,
    });
  }
}

function finishGame(cleared = score >= GAME_CONFIG.clearScore) {
  if (!running) return;
  running = false;
  resultLabelEl.textContent = cleared ? "CLEAR" : "RESULT";
  resultScoreEl.textContent = score;
  resultMessageEl.textContent = cleared ? "25こ みつけたよ！ すごい！" : `25こまで あと ${GAME_CONFIG.clearScore - score}こ！`;
  finishPanel.classList.remove("hidden");
  playFinishSound();
  draw(performance.now() / 1000);
}

function draw(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#132e69");
  sky.addColorStop(.55, "#0a1d4a");
  sky.addColorStop(1, "#06132c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawMoon();
  for (const dot of skyDots) {
    const alpha = dot.alpha * (.7 + .3 * Math.sin(time * 2 + dot.twinkle));
    ctx.fillStyle = `rgba(244, 250, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const star of stars) drawShootingStar(star);
  for (const spark of sparks) {
    ctx.globalAlpha = Math.max(0, spark.life * 1.75);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawHills();
}

function drawMoon() {
  const x = width * .85;
  const y = height * .18;
  const r = Math.min(width, height) * .11;
  ctx.fillStyle = "rgba(255, 239, 176, .13)";
  ctx.beginPath();
  ctx.arc(x, y, r * 1.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff1b5";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9c98c";
  ctx.beginPath();
  ctx.arc(x - r * .24, y - r * .16, r * .14, 0, Math.PI * 2);
  ctx.arc(x + r * .2, y + r * .28, r * .11, 0, Math.PI * 2);
  ctx.fill();
}

function drawShootingStar(star) {
  const angle = Math.atan2(star.vy, star.vx);
  const tailLength = star.size * 4.2;
  const tailX = star.x - Math.cos(angle) * tailLength;
  const tailY = star.y - Math.sin(angle) * tailLength;
  const gradient = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(.65, star.color);
  gradient.addColorStop(1, "#ffffff");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = star.size * .44;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(star.x, star.y);
  ctx.stroke();

  ctx.save();
  ctx.translate(star.x, star.y);
  ctx.rotate(star.phase);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = star.color;
  ctx.shadowBlur = 14;
  drawStarShape(0, 0, star.size, star.size * .43, 5);
  ctx.fill();
  ctx.restore();
}

function drawStarShape(x, y, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHills() {
  const horizon = height * .76;
  ctx.fillStyle = "#183e4d";
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, horizon);
  ctx.quadraticCurveTo(width * .13, height * .62, width * .31, height * .78);
  ctx.quadraticCurveTo(width * .52, height * .58, width * .7, height * .79);
  ctx.quadraticCurveTo(width * .88, height * .65, width, height * .74);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0d5b52";
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height * .84);
  ctx.quadraticCurveTo(width * .16, height * .77, width * .34, height * .86);
  ctx.quadraticCurveTo(width * .55, height * .74, width * .74, height * .85);
  ctx.quadraticCurveTo(width * .9, height * .77, width, height * .83);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  drawHouse(width * .17, height * .8, .72);
  drawHouse(width * .72, height * .82, .58);
  drawTree(width * .42, height * .84, .9);
  drawTree(width * .57, height * .87, .67);
  drawTree(width * .91, height * .86, .8);

  ctx.fillStyle = "#123d3a";
  ctx.fillRect(0, height * .91, width, height * .09);
  ctx.strokeStyle = "rgba(119, 240, 166, .2)";
  ctx.lineWidth = 2;
  for (let x = 6; x < width; x += 17) {
    ctx.beginPath();
    ctx.moveTo(x, height * .94);
    ctx.lineTo(x + 3, height * .91 - (x % 4));
    ctx.stroke();
  }
}

function drawHouse(x, y, scale) {
  const houseWidth = 55 * scale;
  const houseHeight = 37 * scale;
  ctx.fillStyle = "#174b54";
  ctx.fillRect(x, y, houseWidth, houseHeight);
  ctx.fillStyle = "#2a263e";
  ctx.beginPath();
  ctx.moveTo(x - 7 * scale, y + 3 * scale);
  ctx.lineTo(x + houseWidth * .5, y - 24 * scale);
  ctx.lineTo(x + houseWidth + 7 * scale, y + 3 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe788";
  ctx.fillRect(x + houseWidth * .18, y + houseHeight * .35, 8 * scale, 9 * scale);
  ctx.fillRect(x + houseWidth * .66, y + houseHeight * .35, 8 * scale, 9 * scale);
}

function drawTree(x, y, scale) {
  ctx.fillStyle = "#3e3540";
  ctx.fillRect(x - 3 * scale, y - 18 * scale, 6 * scale, 24 * scale);
  ctx.fillStyle = "#18714f";
  ctx.beginPath();
  ctx.arc(x, y - 26 * scale, 17 * scale, 0, Math.PI * 2);
  ctx.arc(x - 11 * scale, y - 15 * scale, 13 * scale, 0, Math.PI * 2);
  ctx.arc(x + 11 * scale, y - 14 * scale, 14 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function prepareAudio() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTapSound() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, now);
  oscillator.frequency.exponentialRampToValueAtTime(1320, now + .15);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.18, now + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .19);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + .21);
}

function playFinishSound() {
  if (!audioContext) return;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const now = audioContext.currentTime + index * .12;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.14, now + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .25);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + .27);
  });
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  tapStar(event.clientX, event.clientY);
});

startButton.addEventListener("click", startGame);
returnButton.addEventListener("click", () => window.location.replace(getLearningUrl()));
difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty;
    difficultyButtons.forEach((item) => item.classList.toggle("selected", item === button));
  });
});
window.addEventListener("resize", resize);
document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });

resize();
draw(0);
