(() => {
  const startButton = document.getElementById('startButton');
  const tapButton = document.getElementById('tapButton');
  const pair = document.getElementById('beetlePair');
  const impact = document.getElementById('impact');
  const status = document.getElementById('status');
  const playerPowerEl = document.getElementById('playerPower');
  const cpuPowerEl = document.getElementById('cpuPower');
  const arena = document.getElementById('arena');
  const difficultyButtons = [...document.querySelectorAll('.difficulty-button')];

  const DIFFICULTIES = {
    normal: {
      label: 'ふつう',
      cpuBase: 3.0,
      cpuRandom: 2.6,
      ramp: 0.022,
      rampMax: 1.7,
      firstDelay: 300,
      nextDelayMin: 190,
      nextDelayRandom: 150
    },
    strong: {
      label: 'つよい',
      cpuBase: 3.6,
      cpuRandom: 2.9,
      ramp: 0.028,
      rampMax: 1.8,
      firstDelay: 250,
      nextDelayMin: 155,
      nextDelayRandom: 120
    },
    ultra: {
      label: 'ちょうつよい',
      cpuBase: 4.4,
      cpuRandom: 3.1,
      ramp: 0.035,
      rampMax: 1.95,
      firstDelay: 210,
      nextDelayMin: 120,
      nextDelayRandom: 100
    }
  };

  let difficulty = 'normal';
  let running = false;
  let matchLocked = false;
  let position = 0;
  let playerPower = 0;
  let cpuPower = 0;
  let cpuTimer = null;
  let countdownTimer = null;
  let battleStartTimer = null;
  let gameStartedAt = 0;
  let lastPlayerTap = 0;

  const WIN_DISTANCE = 132;

  function setStatus(text) {
    status.textContent = text;
  }

  function render() {
    pair.style.setProperty('--offset', position + 'px');
    playerPowerEl.textContent = playerPower;
    cpuPowerEl.textContent = cpuPower;
  }

  function setDifficulty(key) {
    if (matchLocked || !DIFFICULTIES[key]) return;
    difficulty = key;
    difficultyButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.difficulty === key);
    });
    setStatus('スタートを押してね');
  }

  function lockDifficulty(locked) {
    matchLocked = locked;
    difficultyButtons.forEach((button) => {
      button.disabled = locked;
    });
  }

  function flashImpact() {
    impact.classList.remove('flash');
    void impact.offsetWidth;
    impact.classList.add('flash');
    setTimeout(() => impact.classList.remove('flash'), 85);
  }

  function sound(freq = 220, duration = 0.035, volume = 0.035) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      sound.ctx ||= new AudioContext();
      const ctx = sound.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  function stopTimers() {
    clearTimeout(cpuTimer);
    clearInterval(countdownTimer);
    clearTimeout(battleStartTimer);
    cpuTimer = null;
    countdownTimer = null;
    battleStartTimer = null;
  }

  function finish(playerWon) {
    if (!running) return;
    running = false;
    tapButton.disabled = true;
    stopTimers();

    position = playerWon ? WIN_DISTANCE + 26 : -WIN_DISTANCE - 26;
    render();

    arena.classList.add('shake');
    setTimeout(() => arena.classList.remove('shake'), 250);

    if (playerWon) {
      setStatus('🏆 押し出し！ あなたの勝ち！');
      sound(520, .08, .05);
      setTimeout(() => sound(740, .11, .05), 90);
    } else {
      setStatus('💥 押し出された！ CPUの勝ち');
      sound(120, .12, .05);
    }

    startButton.textContent = 'もう一度！';
    startButton.disabled = false;
    lockDifficulty(false);
  }

  function checkWin() {
    if (position >= WIN_DISTANCE) finish(true);
    else if (position <= -WIN_DISTANCE) finish(false);
  }

  function playerTap() {
    if (!running) return;

    const now = performance.now();
    const dt = Math.max(45, now - lastPlayerTap);
    lastPlayerTap = now;

    const rapidBonus = dt < 135 ? 1.25 : dt < 210 ? 1.1 : 1;
    const push = (4.4 + Math.random() * 1.8) * rapidBonus;

    position += push;
    playerPower++;
    flashImpact();
    sound(180 + Math.min(playerPower, 25) * 4, .03, .025);

    render();
    checkWin();
  }

  function cpuPush() {
    if (!running) return;

    const level = DIFFICULTIES[difficulty];
    const elapsed = (performance.now() - gameStartedAt) / 1000;
    const difficultyRamp = Math.min(level.rampMax, 1 + elapsed * level.ramp);
    const push = (level.cpuBase + Math.random() * level.cpuRandom) * difficultyRamp;

    position -= push;
    cpuPower++;
    flashImpact();
    render();
    checkWin();
  }

  function startCpu() {
    const level = DIFFICULTIES[difficulty];

    const schedule = () => {
      if (!running) return;
      cpuPush();

      const next = level.nextDelayMin + Math.random() * level.nextDelayRandom;
      cpuTimer = setTimeout(schedule, next);
    };

    cpuTimer = setTimeout(schedule, level.firstDelay);
  }

  function beginBattle() {
    running = true;
    tapButton.disabled = false;
    startButton.disabled = true;
    startButton.textContent = '勝負中！';
    gameStartedAt = performance.now();
    lastPlayerTap = 0;

    setStatus('押せ！ 押せ！ 押せ！');
    startCpu();
  }

  function startGame() {
    stopTimers();
    lockDifficulty(true);

    running = false;
    position = 0;
    playerPower = 0;
    cpuPower = 0;
    render();

    tapButton.disabled = true;
    startButton.disabled = true;

    let count = 3;
    setStatus(count + '　' + DIFFICULTIES[difficulty].label);
    sound(330, .05, .03);

    countdownTimer = setInterval(() => {
      count--;

      if (count > 0) {
        setStatus(count + '　' + DIFFICULTIES[difficulty].label);
        sound(330, .05, .03);
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        setStatus('はっけよい！');
        sound(650, .08, .04);
        battleStartTimer = setTimeout(beginBattle, 350);
      }
    }, 650);
  }

  startButton.addEventListener('click', startGame);

  tapButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    playerTap();
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener('click', () => setDifficulty(button.dataset.difficulty));
  });

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      if (running) playerTap();
      else if (!startButton.disabled) startGame();
    }
  }, { passive: false });

  render();
  setDifficulty('normal');
})();