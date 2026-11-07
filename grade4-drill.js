(() => {
  "use strict";

  const QUESTIONS = window.GRADE4_DRILL_QUESTIONS;
  if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) {
    throw new Error("小4算数の問題データを読み込めませんでした。");
  }

  const REWARD_TOKEN_KEY = "miniGameRewardToken";
  const PROGRESS_KEY = "grade4DrillNextQuestion:v1"; // 最初の10問と同じ保存キー
  const REQUIRED_CORRECT = 5;
  const NEXT_DELAY_MS = 800;
  const $ = id => document.getElementById(id);
  const ui = {
    count: $("correctCount"), number: $("problemNumber"), title: $("lessonTitle"),
    page: $("pageLabel"), instruction: $("instruction"), problem: $("problemText"),
    word: $("wordText"), puzzle: $("operatorPuzzle"),
    formulaArea: $("formulaArea"), formulaLeft: $("formulaLeft"),
    formulaRight: $("formulaRight"), formulaOperator: $("formulaOperatorDisplay"),
    numeric: $("numericAnswer"), answerTitle: $("answerTitle"), unit: $("answerUnit"),
    display: $("answerDisplay"), feedback: $("feedback"), submit: $("submitButton"),
    erase: $("backspaceButton"), clear: $("clearAnswerButton"),
    canvas: $("scratchCanvas"), clearCanvas: $("clearScratchButton"),
    problemCard: $("problemCard"), answerArea: $("answerArea"),
    finished: $("finishedPanel"), restart: $("restartButton")
  };

  const OPERATOR_SYMBOLS = { "+": "＋", "-": "－", "*": "×", "/": "÷" };

  function rounded(value, significantDigits) {
    const place = 10 ** (Math.floor(Math.log10(value)) - significantDigits + 1);
    return Math.round(value / place) * place;
  }

  function calculate(left, operator, right) {
    switch (operator) {
      case "+": return left + right;
      case "-": return left - right;
      case "*": return left * right;
      case "/": return left / right;
      default: throw new Error(`Unknown operator: ${operator}`);
    }
  }

  function correctAnswer(question) {
    if (question.kind === "estimate") {
      return calculate(
        rounded(question.left, question.leftDigits), question.operator,
        rounded(question.right, question.rightDigits)
      );
    }
    return question.answer;
  }

  function readProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw === null) return 0;
      const value = Number(raw);
      if (Number.isInteger(value) && value >= 0 && value <= QUESTIONS.length) return value;
    } catch (_error) { /* 保存できない設定でも起動させる */ }
    return 0;
  }

  function saveProgress(value) {
    try { localStorage.setItem(PROGRESS_KEY, String(value)); } catch (_error) {}
  }

  let nextIndex = readProgress();
  let fields = { left: "", right: "", operator: "", answer: "" };
  let activeField = "answer";
  let puzzleOperators = [];
  let locked = false;

  function currentQuestion() { return QUESTIONS[nextIndex]; }

  function toggle(element, visible) { element.classList.toggle("hidden", !visible); }

  function isReady() {
    const question = currentQuestion();
    if (!question || locked) return false;
    if (question.kind === "operators") return puzzleOperators.length === 4 && puzzleOperators.every(Boolean);
    if (!fields.answer) return false;
    if (question.kind !== "story") return true;
    return Boolean(fields.left && fields.right && fields.operator);
  }

  function updateInputs() {
    ui.display.textContent = fields.answer || "数字を入力";
    ui.display.classList.toggle("filled", Boolean(fields.answer));
    ui.display.classList.toggle("active", activeField === "answer" && currentQuestion()?.kind === "story");
    ui.formulaLeft.textContent = fields.left || "左の数";
    ui.formulaRight.textContent = fields.right || "右の数";
    ui.formulaOperator.textContent = OPERATOR_SYMBOLS[fields.operator] || "？";
    ui.formulaLeft.classList.toggle("active", activeField === "left");
    ui.formulaRight.classList.toggle("active", activeField === "right");
    document.querySelectorAll("[data-formula-op]").forEach(button => {
      const selected = button.dataset.formulaOp === fields.operator;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    ui.submit.disabled = !isReady();
  }

  function buildOperatorPuzzle(question) {
    ui.puzzle.replaceChildren();
    puzzleOperators = Array(question.values.length - 1).fill("");
    question.values.forEach((value, index) => {
      const number = document.createElement("span");
      number.textContent = String(value);
      ui.puzzle.appendChild(number);
      if (index === question.values.length - 1) return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "？";
      button.setAttribute("aria-label", `${index + 1}こめの記号`);
      button.addEventListener("click", () => {
        if (locked) return;
        const previous = puzzleOperators[index];
        puzzleOperators[index] = previous === "" ? "+" : previous === "+" ? "-" : "+";
        button.textContent = OPERATOR_SYMBOLS[puzzleOperators[index]];
        button.classList.add("selected");
        updateInputs();
      });
      ui.puzzle.appendChild(button);
    });
    const equal = document.createElement("span");
    equal.textContent = `＝ ${question.target}`;
    ui.puzzle.appendChild(equal);
  }

  function showQuestion() {
    if (nextIndex >= QUESTIONS.length) {
      toggle(ui.problemCard, false);
      toggle(ui.answerArea, false);
      toggle(ui.finished, true);
      ui.count.textContent = "5";
      clearScratch();
      return;
    }

    locked = false;
    fields = { left: "", right: "", operator: "", answer: "" };
    const question = currentQuestion();
    activeField = question.kind === "story" ? "left" : "answer";
    ui.title.textContent = question.page <= 47 ? "がい数の計算（1）" : "がい数の計算（2）";
    ui.number.textContent = `${nextIndex + 1} / ${QUESTIONS.length}`;
    ui.page.textContent = `${question.page}ページ・${question.step === "パズル" ? "さんすうパズル" : `ステップ${question.step}`}`;
    ui.count.textContent = String(nextIndex % REQUIRED_CORRECT);
    ui.feedback.textContent = " ";
    ui.feedback.className = "feedback";
    toggle(ui.problemCard, true);
    toggle(ui.answerArea, true);
    toggle(ui.finished, false);

    const isEstimate = question.kind === "estimate";
    const isStory = question.kind === "story";
    const isOperators = question.kind === "operators";
    toggle(ui.problem, isEstimate);
    toggle(ui.word, !isEstimate);
    toggle(ui.puzzle, isOperators);
    toggle(ui.formulaArea, isStory);
    toggle(ui.numeric, !isOperators);

    if (isEstimate) {
      ui.problem.textContent = `${question.left} ${OPERATOR_SYMBOLS[question.operator]} ${question.right}`;
      ui.instruction.textContent = question.leftDigits === question.rightDigits
        ? `それぞれの数を四捨五入して、上から${question.leftDigits}けたのがい数にして計算しよう。`
        : `わられる数は上から${question.leftDigits}けた、わる数は上から${question.rightDigits}けたのがい数にしよう。`;
      ui.answerTitle.textContent = "こたえ（だいたいの数）";
      ui.unit.textContent = "";
    } else {
      ui.word.textContent = question.prompt;
      ui.instruction.textContent = isStory ? "およその式と答えを入力しよう。" : isOperators ? "？をタップして、＋か－を選ぼう。" : "考えて、答えを入力しよう。";
      ui.answerTitle.textContent = "こたえ";
      ui.unit.textContent = question.unit || "";
      if (isOperators) buildOperatorPuzzle(question);
    }
    updateInputs();
    clearScratch();
  }

  function selectField(field) {
    if (locked || currentQuestion()?.kind !== "story") return;
    activeField = field;
    updateInputs();
  }

  function appendDigit(digit) {
    if (locked || currentQuestion()?.kind === "operators") return;
    const value = fields[activeField];
    if (value.length >= 9) return;
    fields[activeField] = value === "0" ? digit : value + digit;
    updateInputs();
  }

  function eraseDigit() {
    if (locked) return;
    fields[activeField] = fields[activeField].slice(0, -1);
    updateInputs();
  }

  function clearAnswer() {
    if (locked) return;
    fields[activeField] = "";
    updateInputs();
  }

  function matchesFormula(question) {
    const expected = question.formula;
    if (fields.operator !== expected.operator) return false;
    const left = Number(fields.left), right = Number(fields.right);
    const direct = left === expected.left && right === expected.right;
    const reverse = (expected.operator === "+" || expected.operator === "*") &&
      left === expected.right && right === expected.left;
    return direct || reverse;
  }

  function matchesPuzzle(question) {
    let total = question.values[0];
    question.values.slice(1).forEach((value, index) => {
      total += puzzleOperators[index] === "+" ? value : -value;
    });
    return total === question.target;
  }

  function submitAnswer() {
    if (!isReady()) return;
    const question = currentQuestion();
    if (question.kind === "story" && !matchesFormula(question)) {
      ui.feedback.textContent = "式がちがうかも。数をまるめて もういちど！";
      ui.feedback.className = "feedback bad";
      return;
    }

    const success = question.kind === "operators"
      ? matchesPuzzle(question)
      : Number(fields.answer) === correctAnswer(question);
    if (!success) {
      ui.feedback.textContent = question.kind === "story"
        ? "式はあっているよ！ 答えをもういちど。"
        : "おしい！ もういちど考えてみよう。";
      ui.feedback.className = "feedback bad";
      return;
    }

    locked = true;
    nextIndex += 1;
    saveProgress(nextIndex);
    const completedSet = nextIndex % REQUIRED_CORRECT === 0 || nextIndex === QUESTIONS.length;
    ui.count.textContent = String(completedSet ? REQUIRED_CORRECT : nextIndex % REQUIRED_CORRECT);
    ui.feedback.textContent = completedSet ? "やったね！ ごほうびゲームへ！ 🎉" : "せいかい！ ⭐";
    ui.feedback.className = "feedback good";
    updateInputs();

    if (completedSet) {
      sessionStorage.setItem(REWARD_TOKEN_KEY, `${Date.now()}-${Math.random()}`);
      window.setTimeout(() => window.location.replace("game-menu.html"), NEXT_DELAY_MS);
    } else {
      window.setTimeout(showQuestion, NEXT_DELAY_MS);
    }
  }

  // 手書きの途中計算欄（既存の算数アプリと同じ操作）
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

  function clearScratch() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", event => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(activePointer);
    const start = point(event);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + 0.01, start.y + 0.01);
    ctx.stroke();
  });
  canvas.addEventListener("pointermove", event => {
    if (activePointer !== event.pointerId) return;
    const current = point(event);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  });
  const stopDrawing = event => {
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);

  document.querySelectorAll("[data-digit]").forEach(button => {
    button.addEventListener("click", () => appendDigit(button.dataset.digit));
  });
  document.querySelectorAll("[data-formula-op]").forEach(button => {
    button.addEventListener("click", () => {
      if (locked || currentQuestion()?.kind !== "story") return;
      fields.operator = button.dataset.formulaOp;
      updateInputs();
    });
  });
  ui.formulaLeft.addEventListener("click", () => selectField("left"));
  ui.formulaRight.addEventListener("click", () => selectField("right"));
  ui.display.addEventListener("click", () => selectField("answer"));
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
  window.addEventListener("keydown", event => {
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); appendDigit(event.key); }
    else if (event.key === "Backspace") { event.preventDefault(); eraseDigit(); }
    else if (event.key === "Enter") { event.preventDefault(); submitAnswer(); }
    else if (event.key === "Escape") { event.preventDefault(); clearAnswer(); }
  });
  window.addEventListener("resize", resizeScratch);

  const atMilestone = nextIndex > 0 && (nextIndex % REQUIRED_CORRECT === 0 || nextIndex === QUESTIONS.length);
  if (atMilestone && sessionStorage.getItem(REWARD_TOKEN_KEY)) {
    window.location.replace("game-menu.html");
  } else {
    sessionStorage.removeItem(REWARD_TOKEN_KEY);
    resizeScratch();
    showQuestion();
  }
})();
