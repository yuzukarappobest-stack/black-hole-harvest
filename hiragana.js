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

const letterCard = document.getElementById("letterCard");
const feedback = document.getElementById("feedback");
const correctCount = document.getElementById("correctCount");
const answerButton = document.getElementById("answerButton");
const nextButton = document.getElementById("nextButton");
const completePanel = document.getElementById("completePanel");
const playGameButton = document.getElementById("playGameButton");
const stayButton = document.getElementById("stayButton");
const heardText = document.getElementById("heardText");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let currentLetter = "";
let correct = 0;
let listening = false;
let lastLetter = "";

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = false;
  recognition.maxAlternatives = 4;

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results[0])
      .map((result) => result.transcript)
      .join(" ");
    heardText.textContent = transcript || "ききとれませんでした";
    checkAnswer(transcript);
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
  feedback.textContent = "このブラウザはおんせいにゅうりょくがつかえません";
  feedback.className = "feedback bad";
}

function pickLetter() {
  let next = letters[Math.floor(Math.random() * letters.length)];
  if (letters.length > 1) {
    while (next === lastLetter) {
      next = letters[Math.floor(Math.random() * letters.length)];
    }
  }
  lastLetter = next;
  currentLetter = next;
  letterCard.textContent = currentLetter;
  showFeedback(" ", "");
}

function startListening() {
  if (!recognition || listening || correct >= 10) return;
  listening = true;
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
  const normalized = normalizeKana(transcript);
  const isCorrect = normalized.includes(currentLetter);

  if (isCorrect) {
    correct += 1;
    correctCount.textContent = correct;
    showFeedback("せいかい！", "good");
    if (correct >= 10) {
      setTimeout(showComplete, 800);
      return;
    }
  } else {
    showFeedback("ざんねん！", "bad");
  }

  setTimeout(pickLetter, 950);
}

function normalizeKana(text) {
  return text
    .normalize("NFKC")
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[^\u3041-\u3096]/g, "");
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
  correctCount.textContent = correct;
  heardText.textContent = "まだありません";
  completePanel.classList.add("hidden");
  pickLetter();
}

answerButton.addEventListener("click", startListening);
nextButton.addEventListener("click", pickLetter);
playGameButton.addEventListener("click", () => {
  window.location.href = "index.html";
});
stayButton.addEventListener("click", resetLesson);

pickLetter();
