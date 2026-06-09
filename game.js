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

const ROUND_SECONDS = 60;
const START_HOLE_RADIUS = 26;
const MAX_HOLE_RADIUS = 66;
const CELESTIALS = [
  { name: "小惑星", points: 1, radius: 11, color: "#9a958a", glow: "#c3bbb0", weight: 42 },
  { name: "小さい惑星", points: 2, radius: 15, color: "#66d9ff", glow: "#b9f1ff", weight: 34 },
  { name: "大きい惑星", points: 3, radius: 21, color: "#ff8f70", glow: "#ffd0bf", weight: 13 },
  { name: "恒星", points: 4, radius: 18, color: "#ffe066", glow: "#fff5b8", weight: 8 },
  { name: "星雲", points: 5, radius: 26, color: "#d46cff", glow: "#f0c2ff", weight: 5 },
  { name: "ブラックホール", points: 10, radius: 20, color: "#05050a", glow: "#ffb703", weight: 3 },
];

let width = 0;
let height = 0;
let dpr = 1;
let score = 0;
let best = Number(localStorage.getItem("blackHoleHarvestBest") || 0);
let timeLeft = ROUND_SECONDS;
let running = false;
let lastTime = 0;
let spawnTimer = 0;
let shake = 0;
let objects = [];
let particles = [];
let stars = [];
let pointer = { x: 0, y: 0, active: false };
let hole = { x: 0, y: 0, radius: START_HOLE_RADIUS, targetX: 0, targetY: 0 };

bestEl.textContent = best;

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, Math.floor(rect.width));
  height = Math.max(320, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hole.x = hole.x || width / 2;
  hole.y = hole.y || height / 2;
  hole.targetX = hole.targetX || hole.x;
  hole.targetY = hole.targetY || hole.y;
  stars = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.3 + 0.4,
    a: Math.random() * 0.7 + 0.25,
  }));
}

function weightedType() {
  const total = CELESTIALS.reduce((sum, item) => sum + item.weight, 0);
  let pick = Math.random() * total;
  for (const item of CELESTIALS) {
    pick -= item.weight;
    if (pick <= 0) return item;
  }
  return CELESTIALS[0];
}

function spawnObject() {
  const type = weightedType();
  const side = Math.floor(Math.random() * 4);
  const margin = type.radius + 28;
  let x;
  let y;

  if (side === 0) {
    x = Math.random() * width;
    y = -margin;
  } else if (side === 1) {
    x = width + margin;
    y = Math.random() * height;
  } else if (side === 2) {
    x = Math.random() * width;
    y = height + margin;
  } else {
    x = -margin;
    y = Math.random() * height;
  }

  const angle = Math.atan2(height / 2 - y, width / 2 - x) + (Math.random() - 0.5) * 1.1;
  const speed = 45 + Math.random() * 75 + type.points * 5;
  objects.push({
    ...type,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: (Math.random() - 0.5) * 3,
    angle: Math.random() * Math.PI * 2,
  });
}

function startGame() {
  score = 0;
  timeLeft = ROUND_SECONDS;
  running = true;
  lastTime = performance.now();
  spawnTimer = 0;
  objects = [];
  particles = [];
  hole.radius = START_HOLE_RADIUS;
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  updateHud();
  for (let i = 0; i < 8; i += 1) spawnObject();
  requestAnimationFrame(loop);
}

function finishGame() {
  running = false;
  finalScoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem("blackHoleHarvestBest", String(best));
    resultMessageEl.textContent = "新記録。さらに大きな重力圏を狙える。";
  } else if (score >= 180) {
    resultMessageEl.textContent = "かなり強い吸引力。200点台も見えている。";
  } else {
    resultMessageEl.textContent = "動き続けるほど稼げる。外周の高得点を狙おう。";
  }
  bestEl.textContent = best;
  finishPanel.classList.remove("hidden");
}

function updateHud() {
  scoreEl.textContent = score;
  timeEl.textContent = Math.max(0, timeLeft).toFixed(1);
  bestEl.textContent = best;
}

function moveHole(dt) {
  if (!pointer.active && !running) return;
  hole.x += (hole.targetX - hole.x) * Math.min(1, dt * 10);
  hole.y += (hole.targetY - hole.y) * Math.min(1, dt * 10);
  hole.x = clamp(hole.x, hole.radius, width - hole.radius);
  hole.y = clamp(hole.y, hole.radius, height - hole.radius);
}

function updateObjects(dt) {
  spawnTimer -= dt;
  const interval = Math.max(0.18, 0.55 - score / 900);
  if (spawnTimer <= 0) {
    spawnObject();
    if (score > 60 && Math.random() < 0.25) spawnObject();
    spawnTimer = interval;
  }

  for (const obj of objects) {
    const dx = hole.x - obj.x;
    const dy = hole.y - obj.y;
    const distSq = dx * dx + dy * dy;
    const pullRange = 190 + obj.points * 12;
    if (distSq < pullRange * pullRange) {
      const dist = Math.max(Math.sqrt(distSq), 1);
      const force = (1 - dist / pullRange) * (260 + obj.points * 20);
      obj.vx += (dx / dist) * force * dt;
      obj.vy += (dy / dist) * force * dt;
    }

    obj.x += obj.vx * dt;
    obj.y += obj.vy * dt;
    obj.angle += obj.spin * dt;
  }

  objects = objects.filter((obj) => {
    const dx = hole.x - obj.x;
    const dy = hole.y - obj.y;
    const eaten = Math.hypot(dx, dy) < hole.radius + obj.radius * 0.4;
    if (eaten) {
      score += obj.points;
      growHole(obj.points);
      shake = Math.min(10, shake + obj.points * 0.6);
      burst(obj);
      updateHud();
      return false;
    }
    return obj.x > -100 && obj.x < width + 100 && obj.y > -100 && obj.y < height + 100;
  });
}

function growHole(points) {
  const growth = 0.55 + points * 0.13;
  hole.radius = Math.min(MAX_HOLE_RADIUS, hole.radius + growth);
}

function burst(obj) {
  for (let i = 0; i < 8 + obj.points; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 130;
    particles.push({
      x: obj.x,
      y: obj.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.35,
      maxLife: 0.8,
      color: obj.glow,
      size: 2 + Math.random() * 4,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    return p.life > 0;
  });
}

function draw() {
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  shake *= 0.9;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(sx, sy);
  drawSpace();
  drawObjects();
  drawParticles();
  drawHole();
  ctx.restore();
}

function drawSpace() {
  const gradient = ctx.createRadialGradient(width * 0.52, height * 0.44, 20, width * 0.5, height * 0.5, Math.max(width, height) * 0.8);
  gradient.addColorStop(0, "#111a34");
  gradient.addColorStop(1, "#03040a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  for (const star of stars) {
    ctx.globalAlpha = star.a;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawObjects() {
  for (const obj of objects) {
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate(obj.angle);
    ctx.shadowColor = obj.glow;
    ctx.shadowBlur = obj.points * 3;

    if (obj.name === "小惑星") drawAsteroid(obj);
    else if (obj.name === "恒星") drawStar(obj);
    else if (obj.name === "星雲") drawNebula(obj);
    else if (obj.name === "ブラックホール") drawEnemyBlackHole(obj);
    else drawPlanet(obj);

    ctx.restore();
  }
}

function drawAsteroid(obj) {
  ctx.fillStyle = obj.color;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    const r = obj.radius * (0.72 + ((i * 17) % 5) * 0.08);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPlanet(obj) {
  const gradient = ctx.createRadialGradient(-obj.radius * 0.35, -obj.radius * 0.35, 2, 0, 0, obj.radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.16, obj.glow);
  gradient.addColorStop(1, obj.color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
  ctx.fill();
  if (obj.points === 3) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, obj.radius * 1.45, obj.radius * 0.42, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStar(obj) {
  ctx.fillStyle = obj.color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? obj.radius * 1.2 : obj.radius * 0.55;
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawNebula(obj) {
  const gradient = ctx.createRadialGradient(0, 0, 3, 0, 0, obj.radius * 1.35);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  gradient.addColorStop(0.25, obj.color);
  gradient.addColorStop(1, "rgba(212, 108, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, obj.radius * 1.45, obj.radius * 0.85, 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyBlackHole(obj) {
  ctx.strokeStyle = obj.glow;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, obj.radius * 1.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#020207";
  ctx.beginPath();
  ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHole() {
  const ring = ctx.createRadialGradient(hole.x, hole.y, hole.radius * 0.35, hole.x, hole.y, hole.radius * 1.75);
  ring.addColorStop(0, "rgba(0, 0, 0, 1)");
  ring.addColorStop(0.42, "rgba(0, 0, 0, 1)");
  ring.addColorStop(0.48, "rgba(255, 183, 3, 0.95)");
  ring.addColorStop(0.64, "rgba(86, 215, 255, 0.38)");
  ring.addColorStop(1, "rgba(86, 215, 255, 0)");

  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius * 1.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius * 0.82, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius * 1.08, performance.now() / 400, performance.now() / 400 + Math.PI * 1.3);
  ctx.stroke();
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;

  if (running) {
    timeLeft -= dt;
    moveHole(dt);
    updateObjects(dt);
    updateParticles(dt);
    updateHud();
    if (timeLeft <= 0) finishGame();
  }

  draw();
  if (running) requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setTargetFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.clientX ?? event.touches?.[0]?.clientX;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY;
  if (clientX == null || clientY == null) return;
  hole.targetX = clamp(clientX - rect.left, hole.radius, width - hole.radius);
  hole.targetY = clamp(clientY - rect.top, hole.radius, height - hole.radius);
}

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  canvas.setPointerCapture(event.pointerId);
  setTargetFromEvent(event);
});

canvas.addEventListener("pointermove", (event) => {
  setTargetFromEvent(event);
});

canvas.addEventListener("pointerup", (event) => {
  pointer.active = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

window.addEventListener("resize", resize);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", () => {
  window.location.href = "hiragana.html";
});

resize();
draw();
