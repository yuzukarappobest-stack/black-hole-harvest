const LESSON_CONFIG = {
  requiredCorrect: 8,
  nextDelayMs: 520,
};

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const REWARD_TOKEN_KEY = "miniGameRewardToken";
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
  ["dango-shot", "ダンゴショット", "dango-shot.html"],
  ["planet-catch", "惑星", "planet-catch.html"],
];

const NOTES = [
  { name: "ド", image: "assets/music-notes/do.jpg?v=2", frequency: 261.63 },
  { name: "レ", image: "assets/music-notes/re.jpg?v=2", frequency: 293.66 },
  { name: "ミ", image: "assets/music-notes/mi.jpg?v=2", frequency: 329.63 },
  { name: "ファ", image: "assets/music-notes/fa.jpg?v=2", frequency: 349.23 },
  { name: "ソ", image: "assets/music-notes/so.jpg?v=2", frequency: 392.0 },
  { name: "ラ", image: "assets/music-notes/la.jpg?v=2", frequency: 440.0 },
  { name: "シ", image: "assets/music-notes/si.jpg?v=2", frequency: 493.88 },
];

const NOTE_NAMES = NOTES.map((note) => note.name);
const correctCount = document.getElementById("correctCount");
const goalCount = document.getElementById("goalCount");
const prompt = document.getElementById("prompt");
const noteImage = document.getElementById("noteImage");
const feedback = document.getElementById("feedback");
const choiceGrid = document.getElementById("choiceGrid");
const completePanel = document.getElementById("completePanel");
const rewardGrid = document.getElementById("rewardGrid");
const againButton = document.getElementById("againButton");

let correct = 0;
let current = null;
let queue = [];
let locked = false;
let audioContext = null;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;
renderRewards();
resetLesson();

function resetLesson() {
  correct = 0;
  queue = shuffle([...NOTES, ...NOTES, ...NOTES]);
  completePanel.classList.add("hidden");
  clearRewardToken();
  correctCount.textContent = correct;
  nextQuestion();
}

function nextQuestion() {
  locked = false;
  if (!queue.length) queue = shuffle([...NOTES, ...NOTES, ...NOTES]);
  current = queue.pop();
  prompt.textContent = "これはなに？";
  noteImage.src = current.image;
  noteImage.alt = `${current.name}の音符`;
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
    playNote(current.frequency);
  } else {
    feedback.textContent = "ざんねん！";
    feedback.className = "feedback bad";
  }
  if (correct >= LESSON_CONFIG.requiredCorrect) {
    window.setTimeout(showComplete, LESSON_CONFIG.nextDelayMs);
    return;
  }
  window.setTimeout(nextQuestion, LESSON_CONFIG.nextDelayMs);
}

function showComplete() {
  issueRewardToken();
  completePanel.classList.remove("hidden");
}

function playNote(frequency) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.018);
  gain.gain.setValueAtTime(0.18, now + 0.32);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.62);
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

function renderRewards() {
  rewardGrid.innerHTML = "";
  for (const [id, label, href] of REWARDS) {
    const button = document.createElement("button");
    button.className = "primary-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (!consumeRewardToken()) {
        window.location.replace("learn.html");
        return;
      }
      sessionStorage.setItem(`${MINI_GAME_ACCESS_PREFIX}${id}`, "1");
      sessionStorage.setItem(MINI_GAME_RETURN_URL, "learn.html");
      window.location.replace(href);
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

window.addEventListener("pageshow", enforceRewardTokenOnRestore);
