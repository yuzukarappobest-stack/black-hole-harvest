const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const BLACK_HOLE_GAME_ID = "black-hole";
const KINGFISHER_GAME_ID = "kingfisher";
const TETRIS_GAME_ID = "tetris";
const BUTTERFLY_GAME_ID = "butterfly";
const METEOR_GAME_ID = "meteor";
const LESSON_CONFIG = {
  requiredCorrect: 8,
  nextDelayMs: 650,
};

const problemText = document.getElementById("problemText");
const answerDisplay = document.getElementById("answerDisplay");
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
const againButton = document.getElementById("againButton");

let correct = 0;
let answer = "";
let currentProblem = null;
let drawing = false;
let dpr = 1;
let lastTouchEnd = 0;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;

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
  const left = randomInt(1, 8);
  const right = randomInt(1, 9 - left);
  return {
    text: `${left} + ${right}`,
    answer: left + right,
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
  sessionStorage.setItem("miniGameReturnUrl", "learn.html");
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
  bindAppButton(button, () => appendDigit(button.dataset.key));
});
bindAppButton(backspaceButton, () => {
  answer = answer.slice(0, -1);
  updateAnswerDisplay();
});
bindAppButton(clearAnswerButton, () => {
  answer = "";
  updateAnswerDisplay();
});
bindAppButton(submitButton, submitAnswer);
bindAppButton(clearScratchButton, clearScratch);
bindAppButton(playBlackHoleButton, () => {
  grantMiniGameAccess(BLACK_HOLE_GAME_ID);
  window.location.href = "index.html";
});
bindAppButton(playKingfisherButton, () => {
  grantMiniGameAccess(KINGFISHER_GAME_ID);
  window.location.href = "kingfisher.html";
});
bindAppButton(playTetrisButton, () => {
  grantMiniGameAccess(TETRIS_GAME_ID);
  window.location.href = "tetris.html";
});
bindAppButton(playButterflyButton, () => {
  grantMiniGameAccess(BUTTERFLY_GAME_ID);
  window.location.href = "butterfly.html";
});
bindAppButton(playMeteorButton, () => {
  grantMiniGameAccess(METEOR_GAME_ID);
  window.location.href = "meteor.html";
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

resizeScratch();
resetLesson();
