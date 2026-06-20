class MiniRaceGame {
  constructor(root = document) {
    this.canvas = root.getElementById("raceCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.timeEl = root.getElementById("raceTime");
    this.speedEl = root.getElementById("raceSpeed");
    this.rankEl = root.getElementById("raceRank");
    this.bestEl = root.getElementById("raceBest");
    this.readyPanel = root.getElementById("readyPanel");
    this.finishPanel = root.getElementById("finishPanel");
    this.resultLabel = root.getElementById("resultLabel");
    this.resultTitle = root.getElementById("resultTitle");
    this.resultMessage = root.getElementById("resultMessage");
    this.startButton = root.getElementById("startButton");
    this.orientationButton = root.getElementById("orientationButton");
    this.againButton = root.getElementById("againButton");
    this.pauseButton = root.getElementById("pauseButton");
    this.acceleratorButton = root.getElementById("acceleratorButton");
    this.leftButton = root.getElementById("leftButton");
    this.rightButton = root.getElementById("rightButton");

    this.course = [
      { length: 760, curve: 0 },
      { length: 920, curve: 0.62 },
      { length: 620, curve: 0 },
      { length: 1050, curve: -0.56 },
      { length: 720, curve: 0.34 },
      { length: 1050, curve: 0 },
      { length: 950, curve: -0.68 },
      { length: 850, curve: 0.5 },
      { length: 1530, curve: 0 },
    ];
    this.courseLength = this.course.reduce((sum, segment) => sum + segment.length, 0);
    this.obstacles = [
      { z: 980, x: -0.62, type: "cone" },
      { z: 1550, x: 0.58, type: "hay" },
      { z: 2480, x: -0.34, type: "cone" },
      { z: 3180, x: 0.44, type: "hay" },
      { z: 4040, x: -0.5, type: "cone" },
    ];
    this.rivalTemplates = [
      { z: 420, x: -0.34, speed: 96, color: "#ffd45e", accent: "#ff8f39" },
      { z: 880, x: 0.32, speed: 112, color: "#5f8dff", accent: "#b7d1ff" },
      { z: 1340, x: -0.08, speed: 104, color: "#7adf7e", accent: "#d8ffd8" },
      { z: 1840, x: 0.54, speed: 118, color: "#ff7aa8", accent: "#ffd2e2" },
      { z: 2380, x: -0.56, speed: 98, color: "#b987ff", accent: "#ead7ff" },
      { z: 2960, x: 0.18, speed: 116, color: "#ffae57", accent: "#fff1bd" },
      { z: 3580, x: -0.28, speed: 106, color: "#47d9ff", accent: "#d7fbff" },
      { z: 4160, x: 0.4, speed: 122, color: "#f95f62", accent: "#ffe3e3" },
      { z: 4720, x: -0.46, speed: 100, color: "#8cf06b", accent: "#efffdc" },
      { z: 5280, x: 0.12, speed: 92, color: "#ffef62", accent: "#ff9f43" },
      { z: 5860, x: 0.58, speed: 82, color: "#5de0c9", accent: "#dcfff8" },
      { z: 6120, x: -0.18, speed: 66, color: "#ff91dc", accent: "#ffe1f6" },
    ];

    this.state = "ready";
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.elapsed = 0;
    this.distance = 0;
    this.speed = 0;
    this.playerX = 0;
    this.playerVx = 0;
    this.visualDistance = 0;
    this.cameraShake = 0;
    this.rank = this.rivalTemplates.length + 1;
    this.lastTime = 0;
    this.input = {
      accel: false,
      left: false,
      right: false,
      tilt: 0,
      tiltActive: false,
    };
    this.bestTime = Number(localStorage.getItem("miniRaceBestTime") || 0);
    this.hitMemory = new Set();
    this.rivalHitMemory = new Set();
    this.rivalPassMemory = new Set();
    this.rivals = this.createRivals();
    this.effects = [];
    this.audioContext = null;
    this.engineOscillator = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.engineOutput = null;
    this.lastTouchEnd = 0;
    this.roadCenterCache = [];

    this.bindEvents();
    this.resize();
    this.updateHud();
    this.draw();
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());
    this.startButton.addEventListener("click", () => this.start());
    this.againButton.addEventListener("click", () => this.reset());
    this.pauseButton.addEventListener("click", () => this.togglePause());
    this.orientationButton.addEventListener("click", () => this.requestOrientation());

    this.bindHoldButton(this.acceleratorButton, "accel");
    this.bindHoldButton(this.leftButton, "left");
    this.bindHoldButton(this.rightButton, "right");

    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.state !== "running") return;
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < rect.width * 0.42) this.input.left = true;
      if (x > rect.width * 0.58) this.input.right = true;
    });
    this.canvas.addEventListener("pointerup", () => {
      this.input.left = false;
      this.input.right = false;
    });
    this.canvas.addEventListener("pointercancel", () => {
      this.input.left = false;
      this.input.right = false;
    });

    window.addEventListener("deviceorientation", (event) => {
      if (typeof event.gamma !== "number") return;
      this.input.tilt = this.clamp(event.gamma / 24, -1, 1);
      this.input.tiltActive = true;
    });

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
        if (now - this.lastTouchEnd <= 360) event.preventDefault();
        this.lastTouchEnd = now;
      },
      { passive: false },
    );
    document.addEventListener("gesturestart", (event) => event.preventDefault());
    document.addEventListener("gesturechange", (event) => event.preventDefault());
    document.addEventListener("gestureend", (event) => event.preventDefault());
  }

  bindHoldButton(button, key) {
    const set = (value) => {
      this.input[key] = value;
      button.classList.toggle("pressed", value);
      if (key === "accel" && value) this.ensureAudio();
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      set(true);
    });
    button.addEventListener("pointerup", (event) => {
      button.releasePointerCapture(event.pointerId);
      set(false);
    });
    button.addEventListener("pointercancel", () => set(false));
    button.addEventListener("pointerleave", () => set(false));
    button.addEventListener("mousedown", () => set(true));
    button.addEventListener("mouseup", () => set(false));
    button.addEventListener("mouseleave", () => set(false));
    button.addEventListener("touchstart", (event) => {
      event.preventDefault();
      set(true);
    }, { passive: false });
    button.addEventListener("touchend", () => set(false));
    button.addEventListener("touchcancel", () => set(false));
  }

  async requestOrientation() {
    const DeviceOrientation = window.DeviceOrientationEvent;
    if (!DeviceOrientation) {
      this.orientationButton.textContent = "左右ボタンであそべます";
      return;
    }
    try {
      if (typeof DeviceOrientation.requestPermission === "function") {
        const result = await DeviceOrientation.requestPermission();
        this.orientationButton.textContent = result === "granted" ? "傾き操作OK" : "左右ボタンであそべます";
      } else {
        this.orientationButton.textContent = "傾き操作OK";
      }
    } catch {
      this.orientationButton.textContent = "左右ボタンであそべます";
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, Math.floor(rect.width));
    this.height = Math.max(240, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  start() {
    this.ensureAudio();
    this.state = "running";
    this.elapsed = 0;
    this.distance = 0;
    this.visualDistance = 0;
    this.speed = 0;
    this.playerX = 0;
    this.playerVx = 0;
    this.cameraShake = 0;
    this.rank = this.rivalTemplates.length + 1;
    this.hitMemory.clear();
    this.rivalHitMemory.clear();
    this.rivalPassMemory.clear();
    this.rivals = this.createRivals();
    this.effects = [];
    this.readyPanel.classList.add("hidden");
    this.finishPanel.classList.add("hidden");
    this.finishPanel.classList.remove("goal", "gameover");
    this.pauseButton.textContent = "Ⅱ";
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  reset() {
    this.state = "ready";
    this.stopEngineSound();
    this.speed = 0;
    this.distance = 0;
    this.visualDistance = 0;
    this.elapsed = 0;
    this.playerX = 0;
    this.playerVx = 0;
    this.rank = this.rivalTemplates.length + 1;
    this.readyPanel.classList.remove("hidden");
    this.finishPanel.classList.add("hidden");
    this.updateHud();
    this.draw();
  }

  togglePause() {
    if (this.state === "running") {
      this.state = "paused";
      this.updateEngineSound(0);
      this.pauseButton.textContent = "▶";
      return;
    }
    if (this.state === "paused") {
      this.state = "running";
      this.pauseButton.textContent = "Ⅱ";
      this.lastTime = performance.now();
      requestAnimationFrame((time) => this.loop(time));
    }
  }

  loop(now) {
    if (this.state !== "running") return;
    const dt = Math.min(0.033, (now - this.lastTime) / 1000 || 0);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame((time) => this.loop(time));
  }

  update(dt) {
    this.elapsed += dt;
    const maxSpeed = 320;
    const acceleration = this.input.accel ? 235 : -92;
    this.speed = this.clamp(this.speed + acceleration * dt, 0, maxSpeed);

    const curve = this.curveAt(this.distance);
    const steer = this.getSteer();
    const steerPower = 2.75 * (0.28 + this.speed / maxSpeed);
    const targetVx = steer * steerPower - curve * (this.speed / maxSpeed) * 0.86;
    this.playerVx += (targetVx - this.playerVx) * Math.min(1, dt * 9);
    this.playerX += this.playerVx * dt;

    const offRoad = Math.abs(this.playerX) > 1.24;
    if (offRoad) {
      this.speed = Math.max(42, this.speed - 130 * dt);
      this.playerX = this.clamp(this.playerX, -1.56, 1.56);
      this.playerVx *= 0.88;
    }

    this.distance += this.speed * dt;
    this.visualDistance += (this.distance - this.visualDistance) * Math.min(1, dt * 14);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 5);
    this.updateRivals(dt);
    this.updateEffects(dt);
    this.checkObstacleHit();
    this.checkRivalHit();
    this.updateRank();
    this.updateEngineSound(dt);
    this.updateHud();

    if (this.distance >= this.courseLength) {
      this.finish(this.rank === 1 ? "goal" : "gameover");
      return;
    }
    if (this.elapsed >= 60) {
      this.finish("gameover");
    }
  }

  getSteer() {
    const buttonSteer = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (buttonSteer !== 0) return buttonSteer;
    return this.input.tiltActive ? this.input.tilt : 0;
  }

  checkObstacleHit() {
    for (let i = 0; i < this.obstacles.length; i += 1) {
      const obstacle = this.obstacles[i];
      const dz = obstacle.z - this.distance;
      if (dz < -28 || dz > 34 || this.hitMemory.has(i)) continue;
      if (Math.abs(this.playerX - obstacle.x) < 0.2) {
        this.speed *= 0.42;
        this.cameraShake = 1;
        this.hitMemory.add(i);
      }
    }
  }

  createRivals() {
    return this.rivalTemplates.map((rival, index) => ({
      ...rival,
      id: index,
      z: rival.z,
      wobble: Math.random() * Math.PI * 2,
    }));
  }

  updateRivals(dt) {
    for (const rival of this.rivals) {
      rival.z += rival.speed * dt;
      rival.x += Math.sin(this.elapsed * 1.2 + rival.wobble) * 0.05 * dt;
      rival.x = this.clamp(rival.x, -0.82, 0.82);
      const dz = rival.z - this.distance;
      if (dz < -35 && !this.rivalPassMemory.has(rival.id)) {
        this.rivalPassMemory.add(rival.id);
        this.addEffect("PASS!", rival.x, "#fff45e");
        this.playPassSound();
      }
    }
  }

  updateRank() {
    const racersAhead = this.rivals.filter((rival) => rival.z > this.distance).length;
    this.rank = racersAhead + 1;
  }

  updateEffects(dt) {
    for (const effect of this.effects) {
      effect.life -= dt;
      effect.y -= dt * 42;
    }
    this.effects = this.effects.filter((effect) => effect.life > 0);
  }

  addEffect(text, x, color) {
    this.effects.push({
      text,
      x,
      y: this.height * 0.58,
      color,
      life: 0.9,
    });
  }

  checkRivalHit() {
    for (const rival of this.rivals) {
      const dz = rival.z - this.distance;
      if (dz < -20 || dz > 38 || this.rivalHitMemory.has(rival.id)) continue;
      if (Math.abs(this.playerX - rival.x) < 0.28) {
        this.speed *= 0.56;
        this.playerVx *= -0.35;
        this.cameraShake = 1;
        this.rivalHitMemory.add(rival.id);
      }
    }
  }

  ensureAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.audioContext) {
      this.audioContext = new AudioCtx();
      this.engineOutput = this.audioContext.createGain();
      this.engineOutput.gain.value = 0.72;
      this.engineOutput.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    if (!this.engineOscillator) {
      const oscillator = this.audioContext.createOscillator();
      const filter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 72;
      filter.type = "lowpass";
      filter.frequency.value = 520;
      gain.gain.value = 0.0001;
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.engineOutput);
      oscillator.start();
      this.engineOscillator = oscillator;
      this.engineFilter = filter;
      this.engineGain = gain;
    }
  }

  updateEngineSound(dt) {
    if (!this.engineOscillator || !this.engineGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const speedRatio = this.clamp(this.speed / 320, 0, 1);
    const targetVolume = this.input.accel && this.state === "running" ? 0.045 + speedRatio * 0.075 : 0.0001;
    const targetFrequency = 58 + speedRatio * 170 + (this.input.accel ? 18 : 0);
    const targetFilter = 420 + speedRatio * 1000;
    this.engineOscillator.frequency.setTargetAtTime(targetFrequency, now, 0.045);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetVolume, now, dt ? Math.max(0.025, dt * 2) : 0.035);
  }

  stopEngineSound() {
    if (!this.engineGain || !this.audioContext) return;
    this.engineGain.gain.setTargetAtTime(0.0001, this.audioContext.currentTime, 0.03);
  }

  playPassSound() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const output = this.engineOutput || this.audioContext.destination;
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    gain.connect(output);

    [520, 780].forEach((frequency, index) => {
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = index ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.035);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, now + 0.18 + index * 0.02);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.035);
      oscillator.stop(now + 0.28 + index * 0.02);
    });
  }

  finish(state) {
    this.state = state;
    this.stopEngineSound();
    this.input.accel = false;
    this.input.left = false;
    this.input.right = false;
    this.acceleratorButton.classList.remove("pressed");
    this.leftButton.classList.remove("pressed");
    this.rightButton.classList.remove("pressed");
    const isGoal = state === "goal";
    const reachedFinish = this.distance >= this.courseLength;
    let bestUpdated = false;
    if (isGoal && (!this.bestTime || this.elapsed < this.bestTime)) {
      this.bestTime = this.elapsed;
      localStorage.setItem("miniRaceBestTime", String(this.bestTime));
      bestUpdated = true;
    }
    this.resultLabel.textContent = isGoal ? "クリア！" : "ゲームオーバー";
    this.resultTitle.textContent = isGoal ? "1位ゴール！" : reachedFinish ? `${this.rank}位ゴール` : "60.00";
    this.resultMessage.textContent = isGoal
      ? `今回のタイム ${this.formatTime(this.elapsed)}${bestUpdated ? " / 自己ベスト更新！" : ""}`
      : reachedFinish
        ? "1位でゴールするとクリアだよ"
        : "60秒以内にゴールできなかったよ";
    this.finishPanel.classList.toggle("goal", isGoal);
    this.finishPanel.classList.toggle("gameover", !isGoal);
    this.finishPanel.classList.remove("hidden");
    this.updateHud();
    this.draw();
  }

  updateHud() {
    this.timeEl.textContent = this.formatTime(this.elapsed);
    this.speedEl.textContent = Math.round(this.speed);
    this.rankEl.textContent = `${this.rank}位`;
    this.bestEl.textContent = this.bestTime ? this.formatTime(this.bestTime) : "--.--";
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    if (!w || !h) return;
    const shakeX = this.cameraShake ? (Math.random() - 0.5) * 8 * this.cameraShake : 0;
    const shakeY = this.cameraShake ? (Math.random() - 0.5) * 6 * this.cameraShake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground();
    this.drawRoad();
    this.drawObjects();
    this.drawRivals();
    this.drawSpeedLines();
    this.drawGoalMarker();
    this.drawCar();
    this.drawEffects();
    ctx.restore();
  }

  drawBackground() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const horizon = h * 0.38;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#50a8ff");
    sky.addColorStop(1, "#bdf4ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);

    ctx.fillStyle = "#7cc975";
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.fillStyle = "#69a7ca";
    this.drawMountain(-60, horizon + 16, w * 0.38, 86);
    this.drawMountain(w * 0.18, horizon + 22, w * 0.42, 110);
    this.drawMountain(w * 0.58, horizon + 18, w * 0.36, 92);

    for (let i = 0; i < 18; i += 1) {
      const x = (i * 83 - (this.distance * 0.16)) % (w + 120) - 60;
      this.drawTree(x, horizon + 34 + (i % 3) * 12, 0.6 + (i % 4) * 0.08);
    }
  }

  drawMountain(x, baseY, width, height) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + width * 0.5, baseY - height);
    ctx.lineTo(x + width, baseY);
    ctx.closePath();
    ctx.fill();
  }

  drawTree(x, y, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#775038";
    ctx.fillRect(-4, 8, 8, 26);
    ctx.fillStyle = "#2f9e50";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(-13, 8, 14, 0, Math.PI * 2);
    ctx.arc(13, 8, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRoad() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const horizon = h * 0.39;
    const roadHeight = h - horizon;
    const rows = 68;
    let previous = null;
    this.roadCenterCache = [];

    for (let i = 0; i < rows; i += 1) {
      const y1 = horizon + (i / rows) * roadHeight;
      const y2 = horizon + ((i + 1) / rows) * roadHeight;
      const p1 = (y1 - horizon) / roadHeight;
      const p2 = (y2 - horizon) / roadHeight;
      const row1 = this.projectRoadRow(p1, y1);
      const row2 = this.projectRoadRow(p2, y2);
      this.roadCenterCache.push(row2);

      if (previous) {
        const grassColor = Math.floor((this.visualDistance / 80 + i) % 2) ? "#69c86f" : "#5dbb62";
        ctx.fillStyle = grassColor;
        ctx.fillRect(0, previous.y, w, row2.y - previous.y + 1);
      }

      const roadShade = Math.floor((this.visualDistance / 120 + i) % 2) ? "#42484d" : "#363c41";
      this.drawTrapezoid(row1.center - row1.width, row1.y, row1.center + row1.width, row1.y, row2.center + row2.width, row2.y, row2.center - row2.width, row2.y, roadShade);

      const railWidth1 = Math.max(2, row1.width * 0.05);
      const railWidth2 = Math.max(3, row2.width * 0.05);
      const railColor = Math.floor((this.visualDistance / 100 + i) % 2) ? "#ffffff" : "#ff6f6f";
      this.drawTrapezoid(row1.center - row1.width - railWidth1 * 1.8, row1.y, row1.center - row1.width - railWidth1 * 0.25, row1.y, row2.center - row2.width - railWidth2 * 0.25, row2.y, row2.center - row2.width - railWidth2 * 1.8, row2.y, railColor);
      this.drawTrapezoid(row1.center + row1.width + railWidth1 * 0.25, row1.y, row1.center + row1.width + railWidth1 * 1.8, row1.y, row2.center + row2.width + railWidth2 * 1.8, row2.y, row2.center + row2.width + railWidth2 * 0.25, row2.y, railColor);

      if (Math.floor((row2.z / 150) % 2) === 0) {
        const marker1 = row1.width * 0.035;
        const marker2 = row2.width * 0.035;
        this.drawTrapezoid(row1.center - marker1, row1.y, row1.center + marker1, row1.y, row2.center + marker2, row2.y, row2.center - marker2, row2.y, "#f5f5f5");
      }
      previous = row2;
    }
  }

  projectRoadRow(p, y) {
    const safeP = Math.max(0.018, p);
    const lookAhead = ((1 - safeP) * (1 - safeP) / safeP) * 360;
    const z = this.visualDistance + lookAhead;
    const curve = this.curveAt(z);
    const nextCurve = this.curveAt(z + 180);
    const roadWidth = this.width * (0.075 + Math.pow(safeP, 1.6) * 0.72);
    const bend = (curve * this.width * 0.24 + nextCurve * this.width * 0.1) * (1 - safeP);
    const playerOffset = this.playerX * roadWidth * 0.56 * Math.pow(safeP, 1.2);
    return {
      y,
      z,
      center: this.width / 2 + bend - playerOffset,
      width: roadWidth,
      p: safeP,
    };
  }

  drawObjects() {
    for (const obstacle of this.obstacles) {
      const dz = obstacle.z - this.distance;
      if (dz < -120 || dz > 1100) continue;
      const p = 1 / (1 + dz / 240);
      const y = this.height * 0.39 + p * (this.height * 0.58);
      if (y < this.height * 0.4 || y > this.height + 40) continue;
      const row = this.projectRoadRow(p, y);
      const x = row.center + obstacle.x * row.width;
      const size = Math.max(10, p * 58);
      if (obstacle.type === "hay") this.drawHay(x, y, size);
      else this.drawCone(x, y, size);
    }
  }

  drawRivals() {
    const visible = this.rivals
      .map((rival) => ({ rival, dz: rival.z - this.distance }))
      .filter(({ dz }) => dz > -90 && dz < 1350)
      .sort((a, b) => b.dz - a.dz);

    for (const { rival, dz } of visible) {
      const p = 1 / (1 + dz / 240);
      const y = this.height * 0.39 + p * (this.height * 0.58);
      if (y < this.height * 0.39 || y > this.height + 60) continue;
      const row = this.projectRoadRow(p, y);
      const x = row.center + rival.x * row.width;
      this.drawRivalCar(x, y, Math.max(0.18, p), rival);
    }
  }

  drawEffects() {
    const ctx = this.ctx;
    for (const effect of this.effects) {
      const alpha = this.clamp(effect.life / 0.9, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect.color;
      ctx.strokeStyle = "rgba(18, 48, 71, 0.55)";
      ctx.lineWidth = 5;
      ctx.font = "950 34px ui-rounded, Hiragino Maru Gothic ProN, sans-serif";
      ctx.textAlign = "center";
      const x = this.width / 2 + effect.x * this.width * 0.22;
      ctx.strokeText(effect.text, x, effect.y);
      ctx.fillText(effect.text, x, effect.y);
      ctx.restore();
    }
  }

  drawSpeedLines() {
    if (this.speed < 160) return;
    const ctx = this.ctx;
    const strength = this.clamp((this.speed - 160) / 160, 0, 1);
    const pulse = (this.visualDistance * 0.08) % 28;
    ctx.save();
    ctx.globalAlpha = 0.16 + strength * 0.22;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2 + strength * 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 16; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const y = this.height * (0.46 + row * 0.065) + pulse;
      const x = this.width / 2 + side * this.width * (0.23 + row * 0.035);
      const len = (34 + row * 13) * strength;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * len, y + len * 0.36);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRivalCar(x, y, scale, rival) {
    const ctx = this.ctx;
    const carW = Math.min(96, 78 * scale);
    const carH = carW * 0.66;
    ctx.save();
    ctx.translate(x, y - carH * 0.35);
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.beginPath();
    ctx.ellipse(0, carH * 0.42, carW * 0.52, carH * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rival.color;
    this.roundRect(-carW * 0.48, -carH * 0.32, carW * 0.96, carH * 0.58, carW * 0.13);
    ctx.fill();
    ctx.fillStyle = rival.accent;
    this.roundRect(-carW * 0.28, -carH * 0.56, carW * 0.56, carH * 0.34, carW * 0.1);
    ctx.fill();
    ctx.fillStyle = "#202020";
    ctx.fillRect(-carW * 0.52, carH * 0.03, carW * 0.17, carH * 0.22);
    ctx.fillRect(carW * 0.35, carH * 0.03, carW * 0.17, carH * 0.22);
    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(-carW * 0.34, -carH * 0.13, carW * 0.14, carH * 0.08);
    ctx.fillRect(carW * 0.2, -carH * 0.13, carW * 0.14, carH * 0.08);
    ctx.restore();
  }

  drawCone(x, y, size) {
    const ctx = this.ctx;
    ctx.fillStyle = "#ff8f39";
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.5, y);
    ctx.lineTo(x + size * 0.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - size * 0.28, y - size * 0.38, size * 0.56, size * 0.12);
  }

  drawHay(x, y, size) {
    const ctx = this.ctx;
    ctx.fillStyle = "#d9a747";
    ctx.fillRect(x - size * 0.55, y - size * 0.72, size * 1.1, size * 0.72);
    ctx.strokeStyle = "#9f6f22";
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.strokeRect(x - size * 0.55, y - size * 0.72, size * 1.1, size * 0.72);
  }

  drawGoalMarker() {
    const dz = this.courseLength - this.distance;
    if (dz < -60 || dz > 650) return;
    const p = 1 / (1 + dz / 220);
    const y = this.height * 0.39 + p * (this.height * 0.58);
    const row = this.projectRoadRow(p, y);
    const stripeCount = 12;
    const stripeW = (row.width * 2) / stripeCount;
    for (let i = 0; i < stripeCount; i += 1) {
      this.ctx.fillStyle = i % 2 ? "#ffffff" : "#202020";
      this.ctx.fillRect(row.center - row.width + i * stripeW, y - Math.max(4, p * 18), stripeW + 1, Math.max(5, p * 20));
    }
  }

  drawCar() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const carW = Math.min(150, w * 0.18);
    const carH = carW * 0.68;
    const x = w / 2;
    const y = h - carH * 0.62;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.getSteer() * 0.05);

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, carH * 0.34, carW * 0.56, carH * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff595e";
    this.roundRect(-carW * 0.46, -carH * 0.36, carW * 0.92, carH * 0.58, carW * 0.14);
    ctx.fill();
    ctx.fillStyle = "#ff7b7f";
    this.roundRect(-carW * 0.3, -carH * 0.64, carW * 0.6, carH * 0.38, carW * 0.12);
    ctx.fill();
    ctx.fillStyle = "#8ee7ff";
    this.roundRect(-carW * 0.21, -carH * 0.57, carW * 0.42, carH * 0.23, carW * 0.06);
    ctx.fill();
    ctx.fillStyle = "#202020";
    ctx.fillRect(-carW * 0.5, carH * 0.05, carW * 0.18, carH * 0.22);
    ctx.fillRect(carW * 0.32, carH * 0.05, carW * 0.18, carH * 0.22);
    ctx.fillStyle = "#fff1a8";
    ctx.fillRect(-carW * 0.39, -carH * 0.12, carW * 0.16, carH * 0.1);
    ctx.fillRect(carW * 0.23, -carH * 0.12, carW * 0.16, carH * 0.1);
    ctx.restore();
  }

  roundRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  drawTrapezoid(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  curveAt(distance) {
    let cursor = 0;
    let previousCurve = this.course[0]?.curve || 0;
    for (const segment of this.course) {
      const start = cursor;
      const end = cursor + segment.length;
      if (distance <= end) {
        const t = this.clamp((distance - start) / segment.length, 0, 1);
        const smooth = t * t * (3 - 2 * t);
        return previousCurve + (segment.curve - previousCurve) * smooth;
      }
      previousCurve = segment.curve;
      cursor = end;
    }
    return 0;
  }

  formatTime(value) {
    return value.toFixed(2);
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.miniRaceGame = new MiniRaceGame(document);
});
