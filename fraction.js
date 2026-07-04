const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const REWARD_TOKEN_KEY = "miniGameRewardToken";
const BLACK_HOLE_GAME_ID = "black-hole";
const KINGFISHER_GAME_ID = "kingfisher";
const TETRIS_GAME_ID = "tetris";
const BUTTERFLY_GAME_ID = "butterfly";
const METEOR_GAME_ID = "meteor";
const RACE_GAME_ID = "race";
const GEM_GAME_ID = "gem";
const PILLBUG_GAME_ID = "pillbug";
const DANGO_SHOT_GAME_ID = "dango-shot";
const PLANET_CATCH_GAME_ID = "planet-catch";
const LESSON_CONFIG = {
  requiredCorrect: 3,
  nextDelayMs: 780,
};

const problemText = document.getElementById("problemText");
const numeratorInput = document.getElementById("numeratorInput");
const denominatorInput = document.getElementById("denominatorInput");
const correctCount = document.getElementById("correctCount");
const goalCount = document.getElementById("goalCount");
const feedback = document.getElementById("feedback");
const submitButton = document.getElementById("submitButton");
const backspaceButton = document.getElementById("backspaceButton");
const clearAnswerButton = document.getElementById("clearAnswerButton");
const clearScratchButton = document.getElementById("clearScratchButton");
const scratchCanvas = document.getElementById("scratchCanvas");
const scratchCtx = scratchCanvas.getContext("2d");
const completePanel = document.getElementById("completePanel");
const playBlackHoleButton = document.getElementById("playBlackHoleButton");
const playKingfisherButton = document.getElementById("playKingfisherButton");
const playTetrisButton = document.getElementById("playTetrisButton");
const playButterflyButton = document.getElementById("playButterflyButton");
const playMeteorButton = document.getElementById("playMeteorButton");
const playRaceButton = document.getElementById("playRaceButton");
const playGemButton = document.getElementById("playGemButton");
const playPillbugButton = document.getElementById("playPillbugButton");
const playDangoShotButton = document.getElementById("playDangoShotButton");
const playPlanetCatchButton = document.getElementById("playPlanetCatchButton");
const againButton = document.getElementById("againButton");

let correct = 0;
let activeField = "numerator";
let answer = {
  numerator: "",
  denominator: "",
};
let currentProblem = null;
let lastTouchEnd = 0;
let drawing = false;
let dpr = 1;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;

function resetLesson() {
  correct = 0;
  correctCount.textContent = correct;
  completePanel.classList.add("hidden");
  clearRewardToken();
  nextProblem();
}

function nextProblem() {
  answer = { numerator: "", denominator: "" };
  activeField = "numerator";
  currentProblem = createProblem();
  renderProblem();
  updateAnswerDisplay();
  clearScratch();
  showFeedback(" ", "");
}

function createProblem() {
  let left;
  let right;
  let operator;

  for (let attempts = 0; attempts < 80; attempts += 1) {
    const denominatorA = randomInt(2, 9);
    let denominatorB = randomInt(2, 9);
    while (denominatorB === denominatorA) denominatorB = randomInt(2, 9);

    left = reduceFraction({
      numerator: randomInt(1, denominatorA - 1),
      denominator: denominatorA,
    });
    right = reduceFraction({
      numerator: randomInt(1, denominatorB - 1),
      denominator: denominatorB,
    });
    if (left.denominator === right.denominator) continue;

    operator = Math.random() < 0.56 ? "+" : "-";

    if (operator === "-" && compareFractions(left, right) <= 0) {
      const temp = left;
      left = right;
      right = temp;
    }

    const rawNumerator = operator === "+"
      ? left.numerator * right.denominator + right.numerator * left.denominator
      : left.numerator * right.denominator - right.numerator * left.denominator;
    if (rawNumerator <= 0) continue;

    const rawDenominator = left.denominator * right.denominator;
    const divisor = gcd(rawNumerator, rawDenominator);
    return {
      left,
      right,
      operator,
      answer: {
        numerator: rawNumerator / divisor,
        denominator: rawDenominator / divisor,
      },
    };
  }

  return {
    left: { numerator: 1, denominator: 2 },
    right: { numerator: 1, denominator: 3 },
    operator: "+",
    answer: { numerator: 5, denominator: 6 },
  };
}

function compareFractions(a, b) {
  return a.numerator * b.denominator - b.numerator * a.denominator;
}

function reduceFraction(fraction) {
  const divisor = gcd(fraction.numerator, fraction.denominator);
  return {
    numerator: fraction.numerator / divisor,
    denominator: fraction.denominator / divisor,
  };
}

function renderProblem() {
  problemText.replaceChildren(
    fractionNode(currentProblem.left),
    operatorNode(currentProblem.operator),
    fractionNode(currentProblem.right),
    operatorNode("="),
  );
}

function fractionNode(fraction) {
  const wrapper = document.createElement("div");
  wrapper.className = "term-fraction";

  const numerator = document.createElement("div");
  numerator.className = "term-number";
  numerator.textContent = fraction.numerator;

  const line = document.createElement("div");
  line.className = "term-line";

  const denominator = document.createElement("div");
  denominator.className = "term-number";
  denominator.textContent = fraction.denominator;

  wrapper.append(numerator, line, denominator);
  return wrapper;
}

function operatorNode(text) {
  const node = document.createElement("span");
  node.className = text === "=" ? "equals" : "operator";
  node.textContent = text;
  return node;
}

function selectField(field) {
  activeField = field;
  updateAnswerDisplay();
}

function appendDigit(digit) {
  const current = answer[activeField];
  if (current.length >= 3) return;
  answer[activeField] = current === "0" ? digit : current + digit;
  if (activeField === "numerator" && answer.numerator.length >= 3) activeField = "denominator";
  updateAnswerDisplay();
}

function backspace() {
  answer[activeField] = answer[activeField].slice(0, -1);
  updateAnswerDisplay();
}

function clearAnswer() {
  answer = { numerator: "", denominator: "" };
  activeField = "numerator";
  updateAnswerDisplay();
}

function updateAnswerDisplay() {
  numeratorInput.textContent = answer.numerator || "入力";
  denominatorInput.textContent = answer.denominator || "入力";
  numeratorInput.classList.toggle("filled", Boolean(answer.numerator));
  denominatorInput.classList.toggle("filled", Boolean(answer.denominator));
  numeratorInput.classList.toggle("active", activeField === "numerator");
  denominatorInput.classList.toggle("active", activeField === "denominator");
}

function submitAnswer() {
  if (!answer.numerator || !answer.denominator || !currentProblem) return;
  const numerator = Number(answer.numerator);
  const denominator = Number(answer.denominator);
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) return;

  const expected = currentProblem.answer;
  const isCorrect = numerator * expected.denominator === expected.numerator * denominator;
  if (isCorrect) {
    correct += 1;
    correctCount.textContent = correct;
    showFeedback("せいかい！", "good");
    if (correct >= LESSON_CONFIG.requiredCorrect) {
      window.setTimeout(showComplete, LESSON_CONFIG.nextDelayMs);
      return;
    }
  } else {
    showFeedback(`ざんねん！ こたえは ${expected.numerator}/${expected.denominator}`, "bad");
  }
  window.setTimeout(nextProblem, LESSON_CONFIG.nextDelayMs);
}

function showFeedback(text, type) {
  feedback.textContent = text;
  feedback.className = type ? `feedback ${type}` : "feedback";
}

function showComplete() {
  issueRewardToken();
  completePanel.classList.remove("hidden");
}

function grantMiniGameAccess(gameId) {
  if (!consumeRewardToken()) {
    window.location.replace("learn.html");
    return false;
  }
  sessionStorage.setItem(`${MINI_GAME_ACCESS_PREFIX}${gameId}`, "1");
  sessionStorage.setItem("miniGameReturnUrl", "learn.html");
  return true;
}
function issueRewardToken() {
  const token = String(Date.now()) + "-" + String(Math.random());
  sessionStorage.setItem(REWARD_TOKEN_KEY, token);
}

function clearRewardToken() {
  sessionStorage.removeItem(REWARD_TOKEN_KEY);
}

function consumeRewardToken() {
  const token = sessionStorage.getItem(REWARD_TOKEN_KEY);
  if (!token) return false;
  sessionStorage.removeItem(REWARD_TOKEN_KEY);
  return true;
}

function enforceRewardTokenOnRestore() {
  if (!completePanel || completePanel.classList.contains("hidden")) return;
  if (!sessionStorage.getItem(REWARD_TOKEN_KEY)) {
    window.location.replace("learn.html");
  }
}


function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1;
}

function resizeScratch() {
  const rect = scratchCanvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  scratchCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  scratchCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scratchCtx.lineCap = "round";
  scratchCtx.lineJoin = "round";
  scratchCtx.lineWidth = 5;
  scratchCtx.strokeStyle = "#071b35";
}

function clearScratch() {
  scratchCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
}

function scratchPoint(event) {
  const rect = scratchCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function startDrawing(event) {
  event.preventDefault();
  drawing = true;
  scratchCanvas.setPointerCapture(event.pointerId);
  const point = scratchPoint(event);
  scratchCtx.beginPath();
  scratchCtx.moveTo(point.x, point.y);
}

function draw(event) {
  if (!drawing) return;
  event.preventDefault();
  const point = scratchPoint(event);
  scratchCtx.lineTo(point.x, point.y);
  scratchCtx.stroke();
}

function stopDrawing(event) {
  if (!drawing) return;
  drawing = false;
  scratchCanvas.releasePointerCapture(event.pointerId);
}

function bindAppButton(button, handler) {
  let handledPointer = false;
  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handledPointer = true;
    handler();
    window.setTimeout(() => {
      handledPointer = false;
    }, 450);
  });
  button.addEventListener("click", (event) => {
    if (handledPointer) {
      event.preventDefault();
      return;
    }
    handler();
  });
}

document.querySelectorAll(".key[data-key]").forEach((button) => {
  bindAppButton(button, () => appendDigit(button.dataset.key));
});
bindAppButton(numeratorInput, () => selectField("numerator"));
bindAppButton(denominatorInput, () => selectField("denominator"));
bindAppButton(backspaceButton, backspace);
bindAppButton(clearAnswerButton, clearAnswer);
bindAppButton(submitButton, submitAnswer);
bindAppButton(clearScratchButton, clearScratch);
bindAppButton(playBlackHoleButton, () => {
  if (grantMiniGameAccess(BLACK_HOLE_GAME_ID)) {
    window.location.replace("index.html");
  }
});
bindAppButton(playKingfisherButton, () => {
  if (grantMiniGameAccess(KINGFISHER_GAME_ID)) {
    window.location.replace("kingfisher.html");
  }
});
bindAppButton(playTetrisButton, () => {
  if (grantMiniGameAccess(TETRIS_GAME_ID)) {
    window.location.replace("tetris.html");
  }
});
bindAppButton(playButterflyButton, () => {
  if (grantMiniGameAccess(BUTTERFLY_GAME_ID)) {
    window.location.replace("butterfly.html");
  }
});
bindAppButton(playMeteorButton, () => {
  if (grantMiniGameAccess(METEOR_GAME_ID)) {
    window.location.replace("meteor.html");
  }
});
bindAppButton(playRaceButton, () => {
  if (grantMiniGameAccess(RACE_GAME_ID)) {
    window.location.replace("race.html");
  }
});
bindAppButton(playGemButton, () => {
  if (grantMiniGameAccess(GEM_GAME_ID)) {
    window.location.replace("gem.html");
  }
});
bindAppButton(playPillbugButton, () => {
  if (grantMiniGameAccess(PILLBUG_GAME_ID)) {
    window.location.replace("pillbug.html");
  }
});
bindAppButton(playDangoShotButton, () => {
  if (grantMiniGameAccess(DANGO_SHOT_GAME_ID)) {
    window.location.replace("dango-shot.html");
  }
});
bindAppButton(playPlanetCatchButton, () => {
  if (grantMiniGameAccess(PLANET_CATCH_GAME_ID)) {
    window.location.replace("planet-catch.html");
  }
});
bindAppButton(againButton, resetLesson);

scratchCanvas.addEventListener("pointerdown", startDrawing);
scratchCanvas.addEventListener("pointermove", draw);
scratchCanvas.addEventListener("pointerup", stopDrawing);
scratchCanvas.addEventListener("pointercancel", stopDrawing);
window.addEventListener("resize", resizeScratch);

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
    if (now - lastTouchEnd <= 360) event.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("gesturechange", (event) => event.preventDefault());
document.addEventListener("gestureend", (event) => event.preventDefault());

resizeScratch();
resetLesson();

window.addEventListener("pageshow", enforceRewardTokenOnRestore);
