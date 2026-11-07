(() => {
  "use strict";

  const REWARD_TOKEN_KEY = "miniGameRewardToken";
  const PROGRESS_KEY = "grade4DrillNextQuestion:v1";
  const REQUIRED_CORRECT = 5;
  const NEXT_DELAY_MS = 800;

  // ドリル46ページ・「がい数の計算（1）」ステップ1の印刷問題。
  // 手書きの回答、見本、解説は含めない。
  const QUESTIONS = [
    [238, "+", 660],
    [251, "+", 945],
    [807, "-", 631],
    [960, "-", 854],
    [6235, "+", 2774],
    [2878, "+", 8653],
    [4763, "-", 1209],
    [9773, "-", 2090],
    [31405, "+", 58673],
    [77623, "-", 40952]
  ];

  const $ = (id) => document.getElementById(id);
  const ui = {
    count: $("correctCount"),
    number: $("problemNumber"),
    problem: $("problemText"),
    display: $("answerDisplay"),
    feedback: $("feedback"),
    submit: $("submitButton"),
    erase: $("backspaceButton"),
    clear: $("clearAnswerButton"),
    canvas: $("scratchCanvas"),
    clearCanvas: $("clearScratchButton"),
    problemCard: $("problemCard"),
    answerArea: $("answerArea"),
    finished: $("finishedPanel"),
    restart: $("restartButton")
  };

  function roundToOneSignificantDigit(value) {
    const place = 10 ** Math.floor(Math.log10(value));
    return Math.round(value / place) * place;
  }

  function expectedAnswer([left, operator, right]) {
    const roundedLeft = roundToOneSignificantDigit(left);
    const roundedRight = roundToOneSignificantDigit(right);
    return operator === "+" ? roundedLeft + roundedRight : roundedLeft - roundedRight;
  }

  function readProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw === null) return 0;
      const value = Number(raw);
      if (Number.isInteger(value) && value >= 0 && value <= QUESTIONS.length) return value;
    } catch (_error) {
      // 端末側で保存が制限されていても、問題は遊べるようにする。
    }
    return 0;
  }

  function saveProgress(value) {
    try { localStorage.setItem(PROGRESS_KEY, String(value)); } catch (_error) {}
  }

  let nextIndex = readProgress();
  let answer = "";
  let locked = false;

  function updateAnswer() {
    ui.display.textContent = answer || "数字を入力";
    ui.display.classList.toggle("filled", Boolean(answer));
    ui.submit.disabled = locked || !answer;
  }

  function showQuestion() {
    if (nextIndex >= QUESTIONS.length) {
      ui.problemCard.classList.add("hidden");
      ui.answerArea.classList.add("hidden");
      ui.finished.classList.remove("hidden");
      ui.count.textContent = "5";
      clearScratch();
      return;
    }

    locked = false;
    answer = "";
    const [left, operator, right] = QUESTIONS[nextIndex];
    ui.problem.textContent = `${left} ${operator === "+" ? "＋" : "－"} ${right}`;
    ui.number.textContent = `${nextIndex + 1} / ${QUESTIONS.length}`;
    ui.count.textContent = String(nextIndex % REQUIRED_CORRECT);
    ui.feedback.textContent = " ";
    ui.feedback.className = "feedback";
    ui.problemCard.classList.remove("hidden");
    ui.answerArea.classList.remove("hidden");
    ui.finished.classList.add("hidden");
    updateAnswer();
    clearScratch();
  }

  function appendDigit(digit) {
    if (locked || answer.length >= 7) return;
    answer = answer === "0" ? digit : answer + digit;
    updateAnswer();
  }

  function eraseDigit() {
    if (locked) return;
    answer = answer.slice(0, -1);
    updateAnswer();
  }

  function clearAnswer() {
    if (locked) return;
    answer = "";
    updateAnswer();
  }

  function submitAnswer() {
    if (locked || !answer || nextIndex >= QUESTIONS.length) return;

    if (Number(answer) !== expectedAnswer(QUESTIONS[nextIndex])) {
      ui.feedback.textContent = "おしい！ それぞれの数を まるめて、もういちど。";
      ui.feedback.className = "feedback bad";
      return;
    }

    locked = true;
    nextIndex += 1;
    saveProgress(nextIndex);
    const completedSet = nextIndex % REQUIRED_CORRECT === 0;
    ui.count.textContent = String(completedSet ? REQUIRED_CORRECT : nextIndex % REQUIRED_CORRECT);
    ui.feedback.textContent = completedSet ? "5もん せいかい！ ごほうびゲームへ！ 🎉" : "せいかい！ ⭐";
    ui.feedback.className = "feedback good";
    updateAnswer();

    if (completedSet) {
      sessionStorage.setItem(REWARD_TOKEN_KEY, `${Date.now()}-${Math.random()}`);
      window.setTimeout(() => window.location.replace("game-menu.html"), NEXT_DELAY_MS);
    } else {
      window.setTimeout(showQuestion, NEXT_DELAY_MS);
    }
  }

  const canvas = ui.canvas;
  const ctx = canvas.getContext("2d");
  let activePointer = null;

  function resizeScratch() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#294b70";
  }

  function clearScratch() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(activePointer);
    const start = point(event);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + 0.01, start.y + 0.01);
    ctx.stroke();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (activePointer !== event.pointerId) return;
    const current = point(event);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  });

  const stopDrawing = (event) => {
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);

  document.querySelectorAll("[data-digit]").forEach((button) => {
    button.addEventListener("click", () => appendDigit(button.dataset.digit));
  });
  ui.erase.addEventListener("click", eraseDigit);
  ui.clear.addEventListener("click", clearAnswer);
  ui.submit.addEventListener("click", submitAnswer);
  ui.clearCanvas.addEventListener("click", clearScratch);
  ui.restart.addEventListener("click", () => {
    if (!window.confirm("小4算数の進みぐあいを最初からにしますか？")) return;
    nextIndex = 0;
    saveProgress(0);
    sessionStorage.removeItem(REWARD_TOKEN_KEY);
    showQuestion();
  });
  window.addEventListener("keydown", (event) => {
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); appendDigit(event.key); }
    else if (event.key === "Backspace") { event.preventDefault(); eraseDigit(); }
    else if (event.key === "Enter") { event.preventDefault(); submitAnswer(); }
    else if (event.key === "Escape") { event.preventDefault(); clearAnswer(); }
  });
  window.addEventListener("resize", resizeScratch);

  // 正解直後の再読み込みなどで、未使用のごほうびを消さない。
  if (nextIndex > 0 && nextIndex % REQUIRED_CORRECT === 0 && sessionStorage.getItem(REWARD_TOKEN_KEY)) {
    window.location.replace("game-menu.html");
  } else {
    sessionStorage.removeItem(REWARD_TOKEN_KEY);
    resizeScratch();
    showQuestion();
  }
})();
