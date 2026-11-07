(() => {
  "use strict";

  const FIRST_STAGE = window.GRADE4_DRILL_QUESTIONS;
  const SECOND_STAGE = window.GRADE4_DRILL_STAGE2_QUESTIONS || [];
  const THIRD_STAGE = window.GRADE4_DRILL_STAGE3_QUESTIONS || [];
  const QUESTIONS = Array.isArray(FIRST_STAGE) && Array.isArray(SECOND_STAGE) && Array.isArray(THIRD_STAGE)
    ? [...FIRST_STAGE, ...SECOND_STAGE, ...THIRD_STAGE] : [];
  if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) {
    throw new Error("小4算数の問題データを読み込めませんでした。");
  }

  const REWARD_TOKEN_KEY = "miniGameRewardToken";
  const PROGRESS_KEY = "grade4DrillNextQuestion:v1"; // 最初の10問と同じ保存キー
  const SECOND_STAGE_START = Array.isArray(FIRST_STAGE) ? FIRST_STAGE.length : 0; // 第1段階の終了後は新たに5問ずつ
  const REQUIRED_CORRECT = 5;
  const NEXT_DELAY_MS = 800;
  const $ = id => document.getElementById(id);
  const ui = {
    count: $("correctCount"), number: $("problemNumber"), title: $("lessonTitle"),
    page: $("pageLabel"), instruction: $("instruction"), problem: $("problemText"),
    word: $("wordText"), puzzle: $("operatorPuzzle"), choice: $("choiceArea"),
    formulaArea: $("formulaArea"), formulaLeft: $("formulaLeft"),
    formulaRight: $("formulaRight"), formulaOperator: $("formulaOperatorDisplay"),
    numeric: $("numericAnswer"), answerTitle: $("answerTitle"), unit: $("answerUnit"),
    display: $("answerDisplay"), answerLine: $("numericAnswerLine"),
    fractionArea: $("fractionAnswerArea"), fractionWhole: $("fractionWhole"),
    fractionNumerator: $("fractionNumerator"), fractionDenominator: $("fractionDenominator"),
    fractionHint: $("fractionHint"), fractionUnit: $("fractionUnit"),
    blankArea: $("blankArea"), decimalKey: $("decimalKey"), keyboard: $("answerKeyboard"),
    feedback: $("feedback"), submit: $("submitButton"),
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
  let fields = { left: "", right: "", operator: "", answer: "", whole: "", numerator: "", denominator: "" };
  let activeField = "answer";
  let puzzleOperators = [];
  let blankFields = [];
  let blankButtons = [];
  let activeBlank = 0;
  let selectedChoice = -1;
  let choiceButtons = [];
  let locked = false;

  function currentQuestion() { return QUESTIONS[nextIndex]; }

  function toggle(element, visible) { element.classList.toggle("hidden", !visible); }

  function fractionAnswer(question) {
    return question.kind === "fraction" || question.kind === "fractionAnswer" ||
      (question.kind === "wordChoice" && typeof question.answer === "object");
  }

  function allowDecimal(question) {
    return !fractionAnswer(question) && (
      /\d\.\d/.test(question.expression || "") ||
      /\d\.\d/.test(question.prompt || "") ||
      (typeof question.answer === "number" && !Number.isInteger(question.answer))
    );
  }

  function solvedSinceReward(index) {
    return (index >= SECOND_STAGE_START ? index - SECOND_STAGE_START : index) % REQUIRED_CORRECT;
  }

  function isRewardPoint(index) {
    return index === QUESTIONS.length || index === SECOND_STAGE_START ||
      (index < SECOND_STAGE_START ? index % REQUIRED_CORRECT === 0 :
        (index - SECOND_STAGE_START) % REQUIRED_CORRECT === 0);
  }

  function isReady() {
    const question = currentQuestion();
    if (!question || locked) return false;
    if (question.kind === "operators") {
      return puzzleOperators.length === question.values.length - 1 && puzzleOperators.every(Boolean);
    }
    if (question.kind === "blanks") return blankFields.length === question.answers.length && blankFields.every(v => v !== "");
    if (question.kind === "wordChoice" && selectedChoice < 0) return false;
    if (fractionAnswer(question)) {
      const hasWhole = fields.whole !== "";
      const hasFraction = fields.numerator !== "" && fields.denominator !== "" && Number(fields.denominator) > 0;
      return hasFraction || (hasWhole && fields.numerator === "" && fields.denominator === "");
    }
    if (!fields.answer || fields.answer.endsWith(".")) return false;
    return question.kind !== "story" || Boolean(fields.left && fields.right && fields.operator);
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
    ui.fractionWhole.textContent = fields.whole || "せいすう";
    ui.fractionNumerator.textContent = fields.numerator || "ぶんし";
    ui.fractionDenominator.textContent = fields.denominator || "ぶんぼ";
    [["whole", ui.fractionWhole], ["numerator", ui.fractionNumerator], ["denominator", ui.fractionDenominator]]
      .forEach(([name, button]) => button.classList.toggle("active", activeField === name));
    blankButtons.forEach((button, index) => {
      button.textContent = blankFields[index] || "□";
      button.classList.toggle("active", activeBlank === index);
    });
    choiceButtons.forEach((button, index) => {
      button.classList.toggle("selected", selectedChoice === index);
      button.setAttribute("aria-pressed", String(selectedChoice === index));
    });
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

  function buildBlankQuestion(question) {
    ui.blankArea.replaceChildren();
    blankFields = question.answers.map(() => "");
    blankButtons = [];
    activeBlank = 0;
    const parts = question.expression.split("□");
    parts.forEach((part, index) => {
      if (part) {
        const text = document.createElement("span");
        text.textContent = part;
        ui.blankArea.appendChild(text);
      }
      if (index === parts.length - 1) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "blank-input";
      button.setAttribute("aria-label", `${index + 1}こ目の□`);
      button.addEventListener("click", () => {
        if (!locked) { activeBlank = index; updateInputs(); }
      });
      blankButtons.push(button);
      ui.blankArea.appendChild(button);
    });
  }

  function buildChoices(question) {
    ui.choice.replaceChildren();
    selectedChoice = -1;
    choiceButtons = [];
    const label = document.createElement("p");
    label.className = "section-title";
    label.textContent = "あてはまる式を選ぼう";
    ui.choice.appendChild(label);
    question.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = `${index + 1}　${choice}`;
      button.addEventListener("click", () => {
        if (!locked) { selectedChoice = index; updateInputs(); }
      });
      choiceButtons.push(button);
      ui.choice.appendChild(button);
    });
  }

  function addFractionNode(parent, value) {
    const term = document.createElement("span");
    term.className = "mixed-fraction";
    if (value.whole || value.numerator === 0) {
      const whole = document.createElement("span");
      whole.textContent = String(value.whole);
      term.appendChild(whole);
    }
    if (value.numerator !== 0) {
      const stack = document.createElement("span");
      stack.className = "stacked-fraction";
      const top = document.createElement("span");
      top.textContent = String(value.numerator);
      const bottom = document.createElement("span");
      bottom.textContent = String(value.denominator);
      stack.appendChild(top);
      stack.appendChild(bottom);
      term.appendChild(stack);
    }
    parent.appendChild(term);
  }

  function showFractionQuestion(question) {
    ui.problem.replaceChildren();
    addFractionNode(ui.problem, question.left);
    const symbol = document.createElement("span");
    symbol.textContent = OPERATOR_SYMBOLS[question.operator];
    ui.problem.appendChild(symbol);
    addFractionNode(ui.problem, question.right);
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
    fields = { left: "", right: "", operator: "", answer: "", whole: "", numerator: "", denominator: "" };
    const question = currentQuestion();
    activeField = question.kind === "story" ? "left" : fractionAnswer(question) ? "numerator" : "answer";
    ui.title.textContent = question.section || (question.page <= 47 ? "がい数の計算（1）" : "がい数の計算（2）");
    ui.number.textContent = `${nextIndex + 1} / ${QUESTIONS.length}`;
    ui.page.textContent = `${question.page}ページ・${question.step === "パズル" ? "さんすうパズル" : `ステップ${question.step}`}`;
    ui.count.textContent = String(solvedSinceReward(nextIndex));
    ui.feedback.textContent = " ";
    ui.feedback.className = "feedback";
    toggle(ui.problemCard, true);
    toggle(ui.answerArea, true);
    toggle(ui.finished, false);

    const isEstimate = question.kind === "estimate";
    const isStory = question.kind === "story";
    const isOperators = question.kind === "operators";
    const isFraction = fractionAnswer(question);
    const isBlanks = question.kind === "blanks";
    const isChoices = question.kind === "wordChoice";
    const isExpression = Boolean(question.expression) && !isBlanks;
    ui.problem.classList.toggle("fraction-problem", question.kind === "fraction");
    toggle(ui.problem, isEstimate || question.kind === "fraction" || isExpression);
    toggle(ui.word, !isEstimate && question.kind !== "fraction" && !isExpression &&
      (!isBlanks || Boolean(question.prompt)));
    toggle(ui.puzzle, isOperators);
    toggle(ui.formulaArea, isStory);
    toggle(ui.numeric, !isOperators);
    toggle(ui.answerLine, !isFraction && !isBlanks);
    toggle(ui.fractionArea, isFraction);
    toggle(ui.fractionHint, isFraction);
    toggle(ui.blankArea, isBlanks);
    toggle(ui.choice, isChoices);
    const decimal = allowDecimal(question);
    toggle(ui.decimalKey, decimal);
    ui.keyboard.classList.toggle("has-decimal", decimal);
    ui.fractionUnit.textContent = question.unit || "";
    ui.unit.textContent = question.unit || "";
    blankButtons = [];
    choiceButtons = [];
    selectedChoice = -1;
    blankFields = [];

    if (isEstimate) {
      ui.problem.textContent = `${question.left} ${OPERATOR_SYMBOLS[question.operator]} ${question.right}`;
      ui.instruction.textContent = question.leftDigits === question.rightDigits
        ? `それぞれの数を四捨五入して、上から${question.leftDigits}けたのがい数にして計算しよう。`
        : `わられる数は上から${question.leftDigits}けた、わる数は上から${question.rightDigits}けたのがい数にしよう。`;
      ui.answerTitle.textContent = "こたえ（だいたいの数）";
      ui.unit.textContent = "";
    } else if (question.kind === "fraction") {
      showFractionQuestion(question);
      ui.instruction.textContent = "分母が同じ分数を計算しよう。帯分数でも仮分数でもOK！";
      ui.answerTitle.textContent = "こたえ（分数）";
    } else {
      ui.word.textContent = question.prompt || "";
      if (isExpression) ui.problem.textContent = question.expression;
      ui.instruction.textContent = question.instruction || (isStory ? "およその式と答えを入力しよう。" :
        isOperators ? "？をタップして、＋か－を選ぼう。" : "考えて、答えを入力しよう。");
      ui.answerTitle.textContent = isBlanks ? "□に入る数" : isFraction ? "こたえ（分数）" : "こたえ";
      if (isOperators) buildOperatorPuzzle(question);
      if (isBlanks) buildBlankQuestion(question);
      if (isChoices) buildChoices(question);
    }
    updateInputs();
    clearScratch();
  }

  function selectField(field) {
    if (locked) return;
    if (currentQuestion()?.kind !== "story" && !fractionAnswer(currentQuestion())) return;
    activeField = field;
    updateInputs();
  }

  function activeValue() {
    return currentQuestion()?.kind === "blanks" ? blankFields[activeBlank] : fields[activeField];
  }

  function changeActiveValue(value) {
    if (currentQuestion()?.kind === "blanks") blankFields[activeBlank] = value;
    else fields[activeField] = value;
    updateInputs();
  }

  function appendDigit(digit) {
    if (locked || currentQuestion()?.kind === "operators") return;
    const value = activeValue();
    if (value.length >= 10) return;
    if (digit === ".") {
      if (!allowDecimal(currentQuestion()) || activeField !== "answer" || value.includes(".")) return;
      changeActiveValue((value || "0") + ".");
    } else {
      changeActiveValue(value === "0" ? digit : value + digit);
    }
  }

  function eraseDigit() {
    if (locked || currentQuestion()?.kind === "operators") return;
    changeActiveValue(activeValue().slice(0, -1));
  }

  function clearAnswer() {
    if (locked || currentQuestion()?.kind === "operators") return;
    changeActiveValue("");
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
    return Math.abs(total - question.target) < 1e-8;
  }

  function matchesFraction(question) {
    const denominator = fields.denominator ? Number(fields.denominator) : 1;
    const numerator = (Number(fields.whole || 0) * denominator) + Number(fields.numerator || 0);
    const expected = question.answer;
    return denominator > 0 && numerator * expected.denominator === expected.numerator * denominator;
  }

  function matchesNumber(question) {
    const value = Number(fields.answer);
    const answer = correctAnswer(question);
    return Number.isFinite(value) && Math.abs(value - answer) < 1e-8;
  }

  function submitAnswer() {
    if (!isReady()) return;
    const question = currentQuestion();
    if (question.kind === "story" && !matchesFormula(question)) {
      ui.feedback.textContent = "式がちがうかも。数をまるめて もういちど！";
      ui.feedback.className = "feedback bad";
      return;
    }

    if (question.kind === "wordChoice" && selectedChoice !== question.correctChoice) {
      ui.feedback.textContent = "式をもういちど考えてみよう。";
      ui.feedback.className = "feedback bad";
      return;
    }

    const success = question.kind === "operators"
      ? matchesPuzzle(question)
      : question.kind === "blanks"
        ? blankFields.every((field, index) => Number(field) === question.answers[index])
        : fractionAnswer(question) ? matchesFraction(question) : matchesNumber(question);
    if (!success) {
      ui.feedback.textContent = question.kind === "story" || question.kind === "wordChoice"
        ? "式はあっているよ！ 答えをもういちど。"
        : "おしい！ もういちど考えてみよう。";
      ui.feedback.className = "feedback bad";
      return;
    }

    locked = true;
    nextIndex += 1;
    saveProgress(nextIndex);
    const completedSet = isRewardPoint(nextIndex);
    ui.count.textContent = String(completedSet ? REQUIRED_CORRECT : solvedSinceReward(nextIndex));
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
  ui.fractionWhole.addEventListener("click", () => selectField("whole"));
  ui.fractionNumerator.addEventListener("click", () => selectField("numerator"));
  ui.fractionDenominator.addEventListener("click", () => selectField("denominator"));
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
    else if (event.key === ".") { event.preventDefault(); appendDigit("."); }
    else if (event.key === "Backspace") { event.preventDefault(); eraseDigit(); }
    else if (event.key === "Enter") { event.preventDefault(); submitAnswer(); }
    else if (event.key === "Escape") { event.preventDefault(); clearAnswer(); }
  });
  window.addEventListener("resize", resizeScratch);

  const atMilestone = nextIndex > 0 && isRewardPoint(nextIndex);
  if (atMilestone && sessionStorage.getItem(REWARD_TOKEN_KEY)) {
    window.location.replace("game-menu.html");
  } else {
    sessionStorage.removeItem(REWARD_TOKEN_KEY);
    resizeScratch();
    showQuestion();
  }
})();
