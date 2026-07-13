const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const progressEl = document.getElementById("progress");
const gaugeMarkEl = document.getElementById("gaugeMark");
const gaugeFillEl = document.getElementById("gaugeFill");
const startPanel = document.getElementById("startPanel");
const finishPanel = document.getElementById("finishPanel");
const resultLabelEl = document.getElementById("resultLabel");
const resultTitleEl = document.getElementById("resultTitle");
const resultMessageEl = document.getElementById("resultMessage");
const jumpHint = document.getElementById("jumpHint");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const jumpButton = document.getElementById("jumpButton");

const GAME_CONFIG = {
  roundSeconds: 30,
  goalLeaves: 8,
  jumpSeconds: .57,
  respawnSeconds: .48,
  leafRadius: 49,
};

let width = 0;
let height = 0;
let dpr = 1;
let running = false;
let timeLeft = GAME_CONFIG.roundSeconds;
let lastTime = 0;
let gaugeTime = 0;
let gaugeValue = .5;
let leaves = [];
let currentLeaf = 0;
let frog = { x: 0, y: 0, state: "ready", jump: null };
let cameraX = 0;
let ripples = [];
let bubbles = [];
let audioContext = null;

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, Math.floor(rect.width));
  height = Math.max(260, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!running) draw();
}

function makeCourse() {
  leaves = [{ x: 120, y: height * .69, radius: GAME_CONFIG.leafRadius }];
  for (let index = 1; index <= GAME_CONFIG.goalLeaves; index += 1) {
    const previous = leaves[index - 1];
    const distance = width * (.205 + Math.random() * .065);
    const y = Math.max(height * .38, Math.min(height * .76, previous.y + (-62 + Math.random() * 124)));
    leaves.push({ x: previous.x + distance, y, radius: GAME_CONFIG.leafRadius * (.91 + Math.random() * .16) });
  }
  leaves.push({
    x: leaves[leaves.length - 1].x + width * .22,
    y: height * .55,
    radius: GAME_CONFIG.leafRadius * 1.3,
    goal: true,
  });
}

function startGame() {
  prepareAudio();
  timeLeft = GAME_CONFIG.roundSeconds;
  gaugeTime = 0;
  gaugeValue = .5;
  currentLeaf = 0;
  ripples = [];
  bubbles = [];
  makeCourse();
  frog = { x: leaves[0].x, y: leaves[0].y - 30, state: "ready", jump: null };
  cameraX = Math.max(0, frog.x - width * .22);
  running = true;
  lastTime = performance.now();
  timeEl.textContent = timeLeft.toFixed(1);
  progressEl.textContent = "0";
  startPanel.classList.add("hidden");
  finishPanel.classList.add("hidden");
  jumpHint.classList.remove("show");
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

function update(dt) {
  timeLeft = Math.max(0, timeLeft - dt);
  timeEl.textContent = timeLeft.toFixed(1);
  gaugeTime += dt;
  gaugeValue = .09 + .91 * ((Math.sin(gaugeTime * 4.55 - Math.PI / 2) + 1) / 2);
  gaugeMarkEl.style.left = `${gaugeValue * 100}%`;
  gaugeFillEl.style.width = `${gaugeValue * 100}%`;

  if (frog.state === "jumping") updateJump(dt);
  if (frog.state === "respawning") {
    frog.respawnTimer -= dt;
    if (frog.respawnTimer <= 0) resetFrog();
  }
  for (const ripple of ripples) {
    ripple.radius += ripple.speed * dt;
    ripple.life -= dt;
  }
  ripples = ripples.filter((ripple) => ripple.life > 0);
  for (const bubble of bubbles) {
    bubble.x += bubble.vx * dt;
    bubble.y += bubble.vy * dt;
    bubble.vy += 130 * dt;
    bubble.life -= dt;
  }
  bubbles = bubbles.filter((bubble) => bubble.life > 0);

  const targetCamera = Math.max(0, frog.x - width * .23);
  cameraX += (targetCamera - cameraX) * Math.min(1, dt * 5.8);
  if (timeLeft <= 0) finishGame(false);
}

function doJump() {
  if (!running || frog.state !== "ready") return;
  const source = leaves[currentLeaf];
  const target = leaves[currentLeaf + 1];
  const required = target.x - source.x;
  const strength = .42 + gaugeValue * 1.22;
  const distance = required * strength;
  const endX = source.x + distance;
  const endY = source.y + (target.y - source.y) * Math.min(1.08, Math.max(.25, strength));
  frog.state = "jumping";
  frog.jump = { startX: frog.x, startY: frog.y, endX, endY, elapsed: 0, duration: GAME_CONFIG.jumpSeconds, strength };
  jumpHint.classList.remove("show");
  playJumpSound(strength);
}

function updateJump(dt) {
  const jump = frog.jump;
  jump.elapsed += dt;
  const t = Math.min(1, jump.elapsed / jump.duration);
  frog.x = jump.startX + (jump.endX - jump.startX) * t;
  frog.y = jump.startY + (jump.endY - jump.startY) * t - Math.sin(Math.PI * t) * (78 + jump.strength * 30);
  if (t < 1) return;

  const target = leaves[currentLeaf + 1];
  const horizontal = Math.abs(frog.x - target.x);
  const successful = horizontal <= target.radius * .76;
  if (successful) {
    currentLeaf += 1;
    frog.x = target.x;
    frog.y = target.y - 30;
    frog.state = "ready";
    frog.jump = null;
    progressEl.textContent = currentLeaf;
    playLandSound();
    if (target.goal) finishGame(true);
    else showJumpHint();
  } else {
    splash(frog.x, Math.min(height * .89, Math.max(height * .28, frog.y + 42)));
    frog.state = "respawning";
    frog.respawnTimer = GAME_CONFIG.respawnSeconds;
    frog.jump = null;
    playSplashSound();
  }
}

function resetFrog() {
  const leaf = leaves[currentLeaf];
  frog.x = leaf.x;
  frog.y = leaf.y - 30;
  frog.state = "ready";
}

function splash(x, y) {
  ripples.push({ x, y, radius: 8, speed: 54, life: .55 });
  for (let i = 0; i < 13; i += 1) {
    const angle = Math.PI + Math.random() * Math.PI;
    const speed = 45 + Math.random() * 130;
    bubbles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 25, life: .42 + Math.random() * .24 });
  }
}

function showJumpHint() {
  jumpHint.classList.remove("show");
  void jumpHint.offsetWidth;
  jumpHint.classList.add("show");
  window.setTimeout(() => jumpHint.classList.remove("show"), 420);
}

function finishGame(cleared) {
  running = false;
  resultLabelEl.textContent = cleared ? "CLEAR" : "TIME UP";
  resultTitleEl.textContent = cleared ? "ゴール！" : `${currentLeaf}まい すすんだ！`;
  resultMessageEl.textContent = cleared ? "みずべの ゴールに とうちゃく！" : "もういちど ゴールを めざそう！";
  finishPanel.classList.remove("hidden");
  if (cleared) playClearSound();
}

function draw() {
  drawSky();
  drawWater();
  ctx.save();
  ctx.translate(-cameraX, 0);
  for (const leaf of leaves) drawLeaf(leaf);
  for (const ripple of ripples) drawRipple(ripple);
  for (const bubble of bubbles) drawBubble(bubble);
  drawFrog();
  ctx.restore();
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#75d7ff");
  sky.addColorStop(.52, "#c8f5ff");
  sky.addColorStop(.525, "#49c5d9");
  sky.addColorStop(1, "#167aa4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  drawCloud(width * .12, height * .16, 1);
  drawCloud(width * .58, height * .1, .78);
  ctx.fillStyle = "rgba(26, 133, 98, .42)";
  ctx.fillRect(0, height * .49, width, height * .05);
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 28 * scale, y - 9 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.arc(x + 60 * scale, y + 1 * scale, 21 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawWater() {
  ctx.strokeStyle = "rgba(214, 253, 255, .34)";
  ctx.lineWidth = 2;
  for (let y = height * .58; y < height; y += 34) {
    const offset = (y * .31) % 35;
    for (let x = -20 + offset; x < width; x += 88) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 18, y - 4, x + 37, y);
      ctx.stroke();
    }
  }
}

function drawLeaf(leaf) {
  const color = leaf.goal ? "#f2cc4e" : "#49b968";
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.scale(1, .56);
  ctx.fillStyle = "rgba(8, 83, 80, .25)";
  ctx.beginPath();
  ctx.ellipse(5, 11, leaf.radius, leaf.radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, leaf.radius, .22, Math.PI * 2 - .22);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = leaf.goal ? "#b47d22" : "#23834a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-leaf.radius * .15, 0);
  ctx.lineTo(leaf.radius * .65, -leaf.radius * .45);
  ctx.stroke();
  ctx.restore();
  if (leaf.goal) {
    ctx.fillStyle = "#fff8b9";
    ctx.font = "950 18px ui-rounded, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GOAL", leaf.x, leaf.y - leaf.radius * .65);
  }
}

function drawFrog() {
  if (frog.state === "respawning") return;
  const bob = frog.state === "ready" ? Math.sin(gaugeTime * 5) * 1.5 : 0;
  ctx.save();
  ctx.translate(frog.x, frog.y + bob);
  const jumping = frog.state === "jumping";
  if (jumping) ctx.rotate(.18);
  ctx.fillStyle = "rgba(16, 87, 74, .22)";
  ctx.beginPath();
  ctx.ellipse(0, 27, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#65d95e";
  ctx.beginPath();
  ctx.ellipse(0, 7, 25, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7ff078";
  ctx.beginPath();
  ctx.arc(-13, -10, 12, 0, Math.PI * 2);
  ctx.arc(13, -10, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-13, -11, 6, 0, Math.PI * 2);
  ctx.arc(13, -11, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#173c44";
  ctx.beginPath();
  ctx.arc(-12, -10, 2.7, 0, Math.PI * 2);
  ctx.arc(14, -10, 2.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#216846";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 1, 8, .12, Math.PI - .12);
  ctx.stroke();
  ctx.restore();
}

function drawRipple(ripple) {
  ctx.strokeStyle = `rgba(239, 255, 255, ${Math.max(0, ripple.life * 1.6)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ripple.x, ripple.y, ripple.radius, ripple.radius * .34, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBubble(bubble) {
  ctx.fillStyle = `rgba(234, 253, 255, ${Math.max(0, bubble.life * 1.8)})`;
  ctx.beginPath();
  ctx.arc(bubble.x, bubble.y, 2.5 + bubble.life * 4, 0, Math.PI * 2);
  ctx.fill();
}

function prepareAudio() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration, volume, type = "sine", shift = 1) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * shift), now + duration);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + .02);
}

function playJumpSound(strength) { playTone(310 + strength * 190, .18, .13, "triangle", 1.45); }
function playLandSound() { playTone(620, .12, .11, "sine", 1.25); }
function playSplashSound() { playTone(210, .2, .12, "triangle", .45); }
function playClearSound() {
  playTone(523, .18, .12, "triangle", 1);
  window.setTimeout(() => playTone(659, .2, .12, "triangle", 1), 115);
  window.setTimeout(() => playTone(784, .28, .12, "triangle", 1), 230);
}

jumpButton.addEventListener("click", doJump);
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  doJump();
});
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
window.addEventListener("resize", resize);
document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });

resize();
draw();
