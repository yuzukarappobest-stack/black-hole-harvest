const LESSON_CONFIG = {
  requiredCorrect: 5,
  nextLetterDelayMs: 520,
  listenReplayDelayMs: 260,
  maxLevel: 4,
  defaultMode: "listen",
};

const letters = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん",
];

const similarGroups = [
  ["あ", "お", "め", "ぬ", "の"],
  ["い", "り", "こ", "に"],
  ["う", "つ", "ら", "ろ", "る"],
  ["え", "そ", "ん"],
  ["か", "や", "が"],
  ["き", "さ", "ち"],
  ["く", "へ", "し"],
  ["け", "は", "ほ"],
  ["た", "な", "に"],
  ["ま", "も", "ほ"],
  ["れ", "わ", "ね"],
];

const speechReadings = {
  "亜": "あ",
  "1": "い", "一": "い",
  "胃": "い", "井": "い", "位": "い",
  "鵜": "う", "卯": "う",
  "絵": "え", "江": "え",
  "尾": "お", "緒": "お",
  "蚊": "か", "可": "か", "課": "か",
  "木": "き", "気": "き", "黄": "き",
  "区": "く", "句": "く", "苦": "く",
  "毛": "け", "家": "け",
  "子": "こ", "個": "こ", "粉": "こ",
  "差": "さ", "佐": "さ",
  "氏": "し", "市": "し", "死": "し",
  "巣": "す", "酢": "す", "素": "す",
  "背": "せ", "瀬": "せ",
  "祖": "そ", "曽": "そ",
  "田": "た", "他": "た",
  "血": "ち", "地": "ち",
  "津": "つ", "都": "とつ",
  "手": "て",
  "戸": "と",
  "名": "な", "菜": "な",
  "7": "な", "七": "な",
  "二": "に", "荷": "に",
  "2": "に",
  "縫": "ぬ",
  "根": "ね", "音": "ね",
  "野": "の",
  "歯": "は", "葉": "は",
  "8": "は", "八": "は",
  "日": "ひ", "火": "ひ",
  "府": "ふ", "負": "ふ",
  "屁": "へ", "辺": "へ",
  "穂": "ほ", "帆": "ほ",
  "間": "ま", "真": "ま",
  "身": "み", "実": "み", "美": "み",
  "3": "み", "三": "み",
  "無": "む", "夢": "む",
  "目": "め", "芽": "め",
  "藻": "も",
  "矢": "や", "屋": "や",
  "湯": "ゆ", "油": "ゆ",
  "世": "よ", "夜": "よ",
  "4": "しよ", "四": "しよ",
  "等": "ら", "羅": "ら",
  "利": "り", "理": "り",
  "留": "る", "流": "る",
  "例": "れ", "礼": "れ",
  "炉": "ろ", "路": "ろ",
  "6": "ろ", "六": "ろ",
  "9": "く", "九": "く",
  "輪": "わ", "和": "わ",
  "を": "を",
  "ん": "ん",
};

const letterCard = document.getElementById("letterCard");
const prompt = document.getElementById("prompt");
const feedback = document.getElementById("feedback");
const correctCount = document.getElementById("correctCount");
const goalCount = document.getElementById("goalCount");
const levelText = document.getElementById("levelText");
const listenModeButton = document.getElementById("listenModeButton");
const speechModeButton = document.getElementById("speechModeButton");
const listenControls = document.getElementById("listenControls");
const speechControls = document.getElementById("speechControls");
const choiceGrid = document.getElementById("choiceGrid");
const replayButton = document.getElementById("replayButton");
const answerButton = document.getElementById("answerButton");
const nextButton = document.getElementById("nextButton");
const completePanel = document.getElementById("completePanel");
const playGameButton = document.getElementById("playGameButton");
const stayButton = document.getElementById("stayButton");
const heardBox = document.getElementById("heardBox");
const heardText = document.getElementById("heardText");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let currentMode = LESSON_CONFIG.defaultMode;
let currentLetter = "";
let correct = 0;
let level = 1;
let listening = false;
let letterQueue = [];
let answered = false;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = true;
  recognition.maxAlternatives = 4;

  recognition.addEventListener("result", (event) => {
    const transcripts = [];
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      for (let j = 0; j < event.results[i].length; j += 1) {
        transcripts.push(event.results[i][j].transcript);
      }
    }
    handleTranscript(transcripts.join(" "));
  });

  recognition.addEventListener("error", () => {
    stopListening();
    heardText.textContent = "ききとれませんでした";
    showFeedback("もういちど", "bad");
  });

  recognition.addEventListener("end", () => {
    stopListening();
  });
} else {
  answerButton.disabled = true;
}

function setMode(mode) {
  currentMode = mode;
  answered = false;
  if (recognition && listening) recognition.stop();

  listenModeButton.classList.toggle("active", mode === "listen");
  speechModeButton.classList.toggle("active", mode === "speech");
  listenControls.classList.toggle("hidden", mode !== "listen");
  speechControls.classList.toggle("hidden", mode !== "speech");
  heardBox.classList.toggle("hidden", mode !== "speech");
  prompt.textContent = mode === "listen" ? "よくきいてえらぼう" : "よんでみよう";
  heardText.textContent = "まだありません";
  pickLetter();
}

function pickLetter() {
  if (letterQueue.length === 0) {
    letterQueue = shuffleLetters();
  }
  currentLetter = letterQueue.pop();
  letterCard.textContent = currentMode === "listen" ? "?" : currentLetter;
  showFeedback(" ", "");
  answered = false;

  if (currentMode === "listen") {
    renderChoices();
    window.setTimeout(speakCurrentLetter, LESSON_CONFIG.listenReplayDelayMs);
  }
}

function renderChoices() {
  const choices = buildChoices(currentLetter, level);
  choiceGrid.innerHTML = "";
  for (const choice of choices) {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.textContent = choice;
    button.addEventListener("click", () => checkChoice(choice, button));
    choiceGrid.appendChild(button);
  }
}

function buildChoices(answer, currentLevel) {
  const similar = getSimilarLetters(answer);
  const similarCount = Math.min(similar.length, Math.max(0, currentLevel - 1));
  const picked = new Set([answer]);

  for (const item of shuffleArray(similar)) {
    if (picked.size >= similarCount + 1) break;
    picked.add(item);
  }

  const distant = letters.filter((letter) => !picked.has(letter) && !similar.includes(letter));
  for (const item of shuffleArray(distant)) {
    if (picked.size >= 5) break;
    picked.add(item);
  }

  for (const item of shuffleArray(letters)) {
    if (picked.size >= 5) break;
    picked.add(item);
  }

  return shuffleArray(Array.from(picked));
}

function getSimilarLetters(letter) {
  const group = similarGroups.find((items) => items.includes(letter));
  if (!group) return [];
  return group.filter((item) => item !== letter && letters.includes(item));
}

function checkChoice(choice, button) {
  if (answered) return;
  answered = true;
  const isCorrect = choice === currentLetter;
  button.classList.add(isCorrect ? "correct" : "wrong");
  finishQuestion(isCorrect);
}

function speakCurrentLetter() {
  if (!("speechSynthesis" in window) || !currentLetter || currentMode !== "listen") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentLetter);
  utterance.lang = "ja-JP";
  utterance.rate = 0.72;
  utterance.pitch = 1.12;
  window.speechSynthesis.speak(utterance);
}

function shuffleLetters() {
  return shuffleArray(letters);
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = current;
  }
  return shuffled;
}

function startListening() {
  if (!recognition || listening || correct >= LESSON_CONFIG.requiredCorrect) return;
  listening = true;
  answered = false;
  answerButton.disabled = true;
  answerButton.textContent = "きいてるよ";
  showFeedback("どうぞ", "");
  try {
    recognition.start();
  } catch {
    stopListening();
  }
}

function stopListening() {
  listening = false;
  answerButton.disabled = false;
  answerButton.textContent = "こたえる";
}

function checkAnswer(transcript) {
  if (answered) return;
  answered = true;
  if (recognition && listening) {
    recognition.stop();
  }
  const firstReading = getFirstReadingCandidates(transcript);
  finishQuestion(firstReading.includes(currentLetter));
}

function finishQuestion(isCorrect) {
  if (isCorrect) {
    correct += 1;
    level = Math.min(LESSON_CONFIG.maxLevel, level + 1);
    correctCount.textContent = correct;
    showFeedback("せいかい！", "good");
    if (correct >= LESSON_CONFIG.requiredCorrect) {
      window.setTimeout(showComplete, LESSON_CONFIG.nextLetterDelayMs);
      return;
    }
  } else {
    level = Math.max(1, level - 1);
    showFeedback("ざんねん！", "bad");
  }

  levelText.textContent = level;
  window.setTimeout(pickLetter, LESSON_CONFIG.nextLetterDelayMs);
}

function handleTranscript(transcript) {
  const heard = transcript.trim();
  if (!heard || answered) return;
  heardText.textContent = heard;
  checkAnswer(heard);
}

function normalizeKana(text) {
  return text
    .normalize("NFKC")
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[^\u3041-\u3096]/g, "");
}

function getFirstReadingCandidates(text) {
  const normalizedText = text.normalize("NFKC");
  for (const char of normalizedText) {
    const reading = getCharReading(char);
    if (reading) return reading;
  }
  return "";
}

function getCharReading(char) {
  const kana = normalizeKana(char);
  return kana || speechReadings[char] || "";
}

function showFeedback(text, type) {
  feedback.textContent = text;
  feedback.className = type ? `feedback ${type}` : "feedback";
}

function showComplete() {
  completePanel.classList.remove("hidden");
}

function resetLesson() {
  correct = 0;
  level = 1;
  letterQueue = [];
  correctCount.textContent = correct;
  levelText.textContent = level;
  heardText.textContent = "まだありません";
  completePanel.classList.add("hidden");
  pickLetter();
}

listenModeButton.addEventListener("click", () => setMode("listen"));
speechModeButton.addEventListener("click", () => setMode("speech"));
replayButton.addEventListener("click", speakCurrentLetter);
answerButton.addEventListener("click", startListening);
nextButton.addEventListener("click", pickLetter);
playGameButton.addEventListener("click", () => {
  window.location.href = "index.html";
});
stayButton.addEventListener("click", resetLesson);

setMode(LESSON_CONFIG.defaultMode);
