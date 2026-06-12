const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const BLACK_HOLE_GAME_ID = "black-hole";
const KINGFISHER_GAME_ID = "kingfisher";
const TETRIS_GAME_ID = "tetris";
const LESSON_CONFIG = {
  requiredCorrect: 3,
  nextDelayMs: 650,
};

const problemText = document.getElementById("problemText");
const answerDisplay = document.getElementById("answerDisplay");
const correctCount = document.getElementById("correctCount");
const goalCount = document.getElementById("goalCount");
const feedback = document.getElementById("feedback");
const mixedModeButton = document.getElementById("mixedModeButton");
const multiplyModeButton = document.getElementById("multiplyModeButton");
const divideModeButton = document.getElementById("divideModeButton");
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
const againButton = document.getElementById("againButton");

let mode = "mixed";
let correct = 0;
let answer = "";
let currentProblem = null;
let drawing = false;
let dpr = 1;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;

function setMode(nextMode) {
  mode = nextMode;
  mixedModeButton.classList.toggle("active", mode === "mixed");
  multiplyModeButton.classList.toggle("active", mode === "multiply");
  divideModeButton.classList.toggle("active", mode === "divide");
  resetLesson();
}

function resetLesson() {
  correct = 0;
  correctCount.textContent = correct;
  completePanel.classList.add("hidden");
  clearScratch();
  nextProblem();
}

function nextProblem() {
  answer = "";
  currentProblem = createProblem();
  problemText.textContent = currentProblem.text;
  feedback.textContent = " ";
  feedback.className = "feedback";
  updateAnswerDisplay();
  clearScratch();
}

function createProblem() {
  const kind = mode === "mixed" ? (Math.random() < 0.5 ? "multiply" : "divide") : mode;
  if (kind === "multiply") {
    const left = randomInt(12, 99);
    const right = randomInt(12, 99);
    return {
      text: `${left} × ${right}`,
      answer: left * right,
    };
  }

  const divisor = randomInt(12, 32);
  const quotient = randomInt(9, 31);
  return {
    text: `${divisor * quotient} ÷ ${divisor}`,
    answer: quotient,
  };
}

function appendDigit(digit) {
  if (answer.length >= 5) return;
  answer = answer === "0" ? digit : answer + digit;
  updateAnswerDisplay();
}

function updateAnswerDisplay() {
  answerDisplay.textContent = answer || "入力らん";
  answerDisplay.classList.toggle("filled", Boolean(answer));
}

function submitAnswer() {
  if (!answer || !currentProblem) return;
  const isCorrect = Number(answer) === currentProblem.answer;
  if (isCorrect) {
    correct += 1;
    correctCount.textContent = correct;
    feedback.textContent = "せいかい！";
    feedback.className = "feedback good";
    if (correct >= LESSON_CONFIG.requiredCorrect) {
      window.setTimeout(showComplete, LESSON_CONFIG.nextDelayMs);
      return;
    }
  } else {
    feedback.textContent = `ざんねん！ こたえは ${currentProblem.answer}`;
    feedback.className = "feedback bad";
  }
  window.setTimeout(nextProblem, LESSON_CONFIG.nextDelayMs);
}

function showComplete() {
  completePanel.classList.remove("hidden");
}

function grantMiniGameAccess(gameId) {
  sessionStorage.setItem(`${MINI_GAME_ACCESS_PREFIX}${gameId}`, "1");
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

document.querySelectorAll(".key[data-key]").forEach((button) => {
  button.addEventListener("click", () => appendDigit(button.dataset.key));
});
backspaceButton.addEventListener("click", () => {
  answer = answer.slice(0, -1);
  updateAnswerDisplay();
});
clearAnswerButton.addEventListener("click", () => {
  answer = "";
  updateAnswerDisplay();
});
submitButton.addEventListener("click", submitAnswer);
mixedModeButton.addEventListener("click", () => setMode("mixed"));
multiplyModeButton.addEventListener("click", () => setMode("multiply"));
divideModeButton.addEventListener("click", () => setMode("divide"));
clearScratchButton.addEventListener("click", clearScratch);
playBlackHoleButton.addEventListener("click", () => {
  grantMiniGameAccess(BLACK_HOLE_GAME_ID);
  window.location.href = "index.html";
});
playKingfisherButton.addEventListener("click", () => {
  grantMiniGameAccess(KINGFISHER_GAME_ID);
  window.location.href = "kingfisher.html";
});
playTetrisButton.addEventListener("click", () => {
  grantMiniGameAccess(TETRIS_GAME_ID);
  window.location.href = "tetris.html";
});
againButton.addEventListener("click", resetLesson);

scratchCanvas.addEventListener("pointerdown", startDrawing);
scratchCanvas.addEventListener("pointermove", draw);
scratchCanvas.addEventListener("pointerup", stopDrawing);
scratchCanvas.addEventListener("pointercancel", stopDrawing);
window.addEventListener("resize", resizeScratch);

resizeScratch();
nextProblem();
