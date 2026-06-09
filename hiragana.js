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

const speechReadings = {
  "亜": "あ",
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
  "二": "に", "荷": "に",
  "縫": "ぬ",
  "根": "ね", "音": "ね",
  "野": "の",
  "歯": "は", "葉": "は",
  "日": "ひ", "火": "ひ",
  "府": "ふ", "負": "ふ",
  "屁": "へ", "辺": "へ",
  "穂": "ほ", "帆": "ほ",
  "間": "ま", "真": "ま",
  "身": "み", "実": "み", "美": "み",
  "無": "む", "夢": "む",
  "目": "め", "芽": "め",
  "藻": "も",
  "矢": "や", "屋": "や",
  "湯": "ゆ", "油": "ゆ",
  "世": "よ", "夜": "よ",
  "等": "ら", "羅": "ら",
  "利": "り", "理": "り",
  "留": "る", "流": "る",
  "例": "れ", "礼": "れ",
  "炉": "ろ", "路": "ろ",
  "輪": "わ", "和": "わ",
  "を": "を",
  "ん": "ん",
};

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
  const readings = collectReadings(transcript);
  const isCorrect = normalized.includes(currentLetter) || readings.includes(currentLetter);

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

function collectReadings(text) {
  const normalizedText = text.normalize("NFKC");
  let readings = normalizeKana(normalizedText);
  for (const char of normalizedText) {
    readings += speechReadings[char] || "";
  }
  return readings;
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
