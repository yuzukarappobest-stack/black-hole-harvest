const LESSON_CONFIG = {
  requiredCorrect: 8,
  nextDelayMs: 520,
};

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const MINI_GAME_RETURN_URL = "miniGameReturnUrl";
const REWARDS = [
  ["black-hole", "ブラックホール", "index.html"],
  ["kingfisher", "カワセミ", "kingfisher.html"],
  ["tetris", "テトリス", "tetris.html"],
  ["butterfly", "ちょうちょ", "butterfly.html"],
  ["meteor", "いんせき", "meteor.html"],
  ["race", "レース", "race.html"],
  ["gem", "ほうせき", "gem.html"],
  ["pillbug", "ダンゴムシ", "pillbug.html"],
];

const NOTES = [
  { name: "ド", top: 82 },
  { name: "レ", top: 76 },
  { name: "ミ", top: 70 },
  { name: "ファ", top: 64 },
  { name: "ソ", top: 58 },
  { name: "ラ", top: 52 },
  { name: "シ", top: 46 },
];

const NOTE_NAMES = NOTES.map((note) => note.name);
const correctCount = document.getElementById("correctCount");
const goalCount = document.getElementById("goalCount");
const prompt = document.getElementById("prompt");
const noteMark = document.getElementById("noteMark");
const feedback = document.getElementById("feedback");
const choiceGrid = document.getElementById("choiceGrid");
const completePanel = document.getElementById("completePanel");
const rewardGrid = document.getElementById("rewardGrid");
const againButton = document.getElementById("againButton");

let correct = 0;
let current = null;
let queue = [];
let locked = false;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;
renderRewards();
resetLesson();

function resetLesson() {
  correct = 0;
  queue = shuffle([...NOTES, ...NOTES, ...NOTES]);
  completePanel.classList.add("hidden");
  correctCount.textContent = correct;
  nextQuestion();
}

function nextQuestion() {
  locked = false;
  if (!queue.length) queue = shuffle([...NOTES, ...NOTES, ...NOTES]);
  current = queue.pop();
  prompt.textContent = "これはなに？";
  noteMark.style.top = `${current.top}%`;
  feedback.textContent = " ";
  feedback.className = "feedback";
  renderChoices();
}

function renderChoices() {
  choiceGrid.innerHTML = "";
  for (const name of NOTE_NAMES) {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", () => choose(button, name));
    choiceGrid.appendChild(button);
  }
}

function choose(button, name) {
  if (locked) return;
  locked = true;
  const ok = name === current.name;
  button.classList.add(ok ? "correct" : "wrong");
  if (ok) {
    correct += 1;
    correctCount.textContent = correct;
    feedback.textContent = "せいかい！";
    feedback.className = "feedback good";
  } else {
    feedback.textContent = "ざんねん！";
    feedback.className = "feedback bad";
  }
  if (correct >= LESSON_CONFIG.requiredCorrect) {
    window.setTimeout(() => completePanel.classList.remove("hidden"), LESSON_CONFIG.nextDelayMs);
    return;
  }
  window.setTimeout(nextQuestion, LESSON_CONFIG.nextDelayMs);
}

function renderRewards() {
  rewardGrid.innerHTML = "";
  for (const [id, label, href] of REWARDS) {
    const button = document.createElement("button");
    button.className = "primary-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      sessionStorage.setItem(`${MINI_GAME_ACCESS_PREFIX}${id}`, "1");
      sessionStorage.setItem(MINI_GAME_RETURN_URL, "learn.html");
      window.location.href = href;
    });
    rewardGrid.appendChild(button);
  }
}

function shuffle(items) {
  return items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

againButton.addEventListener("click", resetLesson);
