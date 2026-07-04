const LESSON_CONFIG = {
  requiredCorrect: 8,
  nextLetterDelayMs: 520,
  listenReplayDelayMs: 260,
  maxLevel: 4,
  defaultMode: "listen",
};

const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
const MINI_GAME_RETURN_URL = "miniGameReturnUrl";
const BLACK_HOLE_GAME_ID = "black-hole";
const KINGFISHER_GAME_ID = "kingfisher";
const BUTTERFLY_GAME_ID = "butterfly";
const METEOR_GAME_ID = "meteor";
const RACE_GAME_ID = "race";
const GEM_GAME_ID = "gem";
const PILLBUG_GAME_ID = "pillbug";
const DANGO_SHOT_GAME_ID = "dango-shot";
const PLANET_CATCH_GAME_ID = "planet-catch";

const letterGroups = [
  ["が", "ぎ", "ぐ", "げ", "ご"],
  ["ざ", "じ", "ず", "ぜ", "ぞ"],
  ["だ", "ぢ", "づ", "で", "ど"],
  ["ば", "び", "ぶ", "べ", "ぼ"],
  ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"],
  ["きゃ", "きゅ", "きょ"],
  ["ぎゃ", "ぎゅ", "ぎょ"],
  ["しゃ", "しゅ", "しょ"],
  ["じゃ", "じゅ", "じょ"],
  ["ちゃ", "ちゅ", "ちょ"],
  ["にゃ", "にゅ", "にょ"],
  ["ひゃ", "ひゅ", "ひょ"],
  ["びゃ", "びゅ", "びょ"],
  ["ぴゃ", "ぴゅ", "ぴょ"],
  ["みゃ", "みゅ", "みょ"],
  ["りゃ", "りゅ", "りょ"],
];

const letters = letterGroups.flat();

const listenWords = {
  "が": "がっこう",
  "ぎ": "ぎたー",
  "ぐ": "ぐみ",
  "げ": "げた",
  "ご": "ごりら",
  "ざ": "ざりがに",
  "じ": "じてんしゃ",
  "ず": "ずぼん",
  "ぜ": "ぜりー",
  "ぞ": "ぞう",
  "だ": "だるま",
  "ぢ": "はなぢ",
  "づ": "みかづき",
  "で": "でんしゃ",
  "ど": "どんぐり",
  "ば": "ばなな",
  "び": "びーだま",
  "ぶ": "ぶどう",
  "べ": "べる",
  "ぼ": "ぼうし",
  "ぱ": "ぱん",
  "ぴ": "ぴあの",
  "ぷ": "ぷりん",
  "ぺ": "ぺんぎん",
  "ぽ": "ぽすと",
  "きゃ": "きゃべつ",
  "きゅ": "きゅうり",
  "きょ": "きょうりゅう",
  "ぎゃ": "ぎゃく",
  "ぎゅ": "ぎゅうにゅう",
  "ぎょ": "ぎょーざ",
  "しゃ": "しゃしん",
  "しゅ": "しゅりけん",
  "しょ": "しょうぼうしゃ",
  "じゃ": "じゃんぐる",
  "じゅ": "じゅーす",
  "じょ": "じょうろ",
  "ちゃ": "ちゃわん",
  "ちゅ": "ちゅーりっぷ",
  "ちょ": "ちょうちょ",
  "にゃ": "にゃんこ",
  "にゅ": "にゅうどうぐも",
  "にょ": "にょきにょき",
  "ひゃ": "ひゃく",
  "ひゅ": "ひゅー",
  "ひょ": "ひょう",
  "びゃ": "びゃくや",
  "びゅ": "びゅーん",
  "びょ": "びょういん",
  "ぴゃ": "ぴゃっと",
  "ぴゅ": "ぴゅーん",
  "ぴょ": "ぴょん",
  "みゃ": "みゃくみゃく",
  "みゅ": "みゅーじっく",
  "みょ": "みょうが",
  "りゃ": "りゃく",
  "りゅ": "りゅう",
  "りょ": "りょこう",
};

const pictureHints = {
  "が": "🏫",
  "ぎ": "🎸",
  "ぐ": { src: "assets/gummy.jpg" },
  "げ": "🩴",
  "ご": "🦍",
  "ざ": "🦞",
  "じ": "🚲",
  "ず": "👖",
  "ぜ": { src: "assets/jelly.jpg" },
  "ぞ": "🐘",
  "だ": { src: "assets/daruma.jpg" },
  "ぢ": "🩸",
  "づ": "🌙",
  "で": "🚃",
  "ど": "🌰",
  "ば": "🍌",
  "び": { src: "assets/marble.jpg" },
  "ぶ": "🍇",
  "べ": "🔔",
  "ぼ": "👒",
  "ぱ": "🍞",
  "ぴ": "🎹",
  "ぷ": "🍮",
  "ぺ": "🐧",
  "ぽ": "📮",
  "きゃ": "🥬",
  "きゅ": "🥒",
  "きょ": "🦕",
  "ぎゃ": "↩️",
  "ぎゅ": "🥛",
  "ぎょ": "🥟",
  "しゃ": "📷",
  "しゅ": "🥷",
  "しょ": "🚒",
  "じゃ": "🌴",
  "じゅ": "🧃",
  "じょ": "🚿",
  "ちゃ": "🍵",
  "ちゅ": "🌷",
  "ちょ": "🦋",
  "にゃ": "🐱",
  "にゅ": "☁️",
  "にょ": "🌱",
  "ひゃ": "💯",
  "ひゅ": "💨",
  "ひょ": "🐆",
  "びゃ": "🌃",
  "びゅ": "💨",
  "びょ": "🏥",
  "ぴゃ": "💥",
  "ぴゅ": "🚀",
  "ぴょ": "🐰",
  "みゃ": { src: "assets/myakumyaku.jpg" },
  "みゅ": "🎵",
  "みょ": { src: "assets/myoga.jpg" },
  "りゃ": "📝",
  "りゅ": "🐉",
  "りょ": "🧳",
};

const speechReadings = {
  "学": "が",
  "牛": "ぎゅ",
  "写": "しゃ",
  "手": "しゅ",
  "消": "しょ",
  "茶": "ちゃ",
  "竜": "りゅ",
  "旅": "りょ",
};

const letterCard = document.getElementById("letterCard");
const pictureHint = document.getElementById("pictureHint");
const pictureEmoji = document.getElementById("pictureEmoji");
const pictureImage = document.getElementById("pictureImage");
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
const playBlackHoleButton = document.getElementById("playBlackHoleButton");
const playKingfisherButton = document.getElementById("playKingfisherButton");
const playButterflyButton = document.getElementById("playButterflyButton");
const playMeteorButton = document.getElementById("playMeteorButton");
const playRaceButton = document.getElementById("playRaceButton");
const playGemButton = document.getElementById("playGemButton");
const playPillbugButton = document.getElementById("playPillbugButton");
const playDangoShotButton = document.getElementById("playDangoShotButton");
const playPlanetCatchButton = document.getElementById("playPlanetCatchButton");
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
let speechToken = 0;
let audioContext = null;
let answerSoundOutput = null;

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
  pictureHint.classList.toggle("hidden", mode !== "listen");
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
  updatePictureHint();
  showFeedback(" ", "");
  answered = false;

  if (currentMode === "listen") {
    renderChoices();
    window.setTimeout(speakCurrentLetter, LESSON_CONFIG.listenReplayDelayMs);
  }
}

function updatePictureHint() {
  const hint = pictureHints[currentLetter] || "🌟";
  if (typeof hint === "string") {
    pictureEmoji.textContent = hint;
    pictureEmoji.classList.remove("hidden");
    pictureImage.classList.add("hidden");
    pictureImage.removeAttribute("src");
    return;
  }
  pictureImage.src = hint.src;
  pictureImage.classList.remove("hidden");
  pictureEmoji.classList.add("hidden");
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
  const group = getSeriesLetters(answer);
  const picked = new Set([answer]);

  for (const item of shuffleArray(group.filter((letter) => letter !== answer))) {
    if (picked.size >= 3) break;
    picked.add(item);
  }

  return shuffleArray(Array.from(picked));
}

function getSeriesLetters(letter) {
  return letterGroups.find((items) => items.includes(letter)) || [letter];
}

function checkChoice(choice, button) {
  if (answered) return;
  prepareAudio();
  answered = true;
  const isCorrect = choice === currentLetter;
  letterCard.textContent = currentLetter;
  button.classList.add(isCorrect ? "correct" : "wrong");
  finishQuestion(isCorrect);
}

function speakCurrentLetter() {
  if (!("speechSynthesis" in window) || !currentLetter || currentMode !== "listen") return;
  stopPromptSpeech();
  const token = speechToken;
  const parts = buildListenPromptParts(currentLetter);
  speakPromptPart(parts, 0, token);
}

function buildListenPromptParts(letter) {
  const cue = listenWords[letter] || letter;
  return [`${cue}の`, letter, "をえらんでね"];
}

function speakPromptPart(parts, index, token) {
  if (token !== speechToken || currentMode !== "listen" || index >= parts.length) return;
  const utterance = new SpeechSynthesisUtterance(parts[index]);
  utterance.lang = "ja-JP";
  utterance.rate = index === 1 ? 0.62 : 0.72;
  utterance.pitch = 1.12;
  utterance.onend = () => {
    const pause = index === 0 ? 380 : 240;
    window.setTimeout(() => speakPromptPart(parts, index + 1, token), pause);
  };
  window.speechSynthesis.speak(utterance);
}

function stopPromptSpeech() {
  speechToken += 1;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
  prepareAudio();
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
  const readings = getReadingCandidates(transcript);
  finishQuestion(readings.includes(currentLetter));
}

function finishQuestion(isCorrect) {
  stopPromptSpeech();
  playAnswerSound(isCorrect);
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

function prepareAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (!answerSoundOutput) {
    answerSoundOutput = audioContext.createGain();
    answerSoundOutput.gain.setValueAtTime(0.82, audioContext.currentTime);
    answerSoundOutput.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playAnswerSound(isCorrect) {
  if (!audioContext) return;
  if (audioContext.state === "suspended") audioContext.resume();
  if (isCorrect) {
    playToneSequence([880, 1175], 0.2, 0.34, "sine");
  } else {
    playToneSequence([150, 110], 0.22, 0.36, "sawtooth");
  }
}

function playToneSequence(frequencies, step, volume, type) {
  const start = audioContext.currentTime + 0.01;
  frequencies.forEach((frequency, index) => {
    const toneStart = start + index * step;
    const oscillator = audioContext.createOscillator();
    const subOscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    subOscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    subOscillator.frequency.setValueAtTime(frequency * 0.5, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(volume, toneStart + 0.012);
    gain.gain.setValueAtTime(volume, toneStart + step * 0.56);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + step * 0.96);
    oscillator.connect(gain);
    subOscillator.connect(gain);
    gain.connect(answerSoundOutput || audioContext.destination);
    oscillator.start(toneStart);
    subOscillator.start(toneStart);
    oscillator.stop(toneStart + step * 1.02);
    subOscillator.stop(toneStart + step * 1.02);
  });
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

function getReadingCandidates(text) {
  const normalizedText = text.normalize("NFKC");
  const normalizedKana = normalizeKana(normalizedText);
  const readings = [];

  for (const letter of letters) {
    if (normalizedKana.startsWith(letter)) readings.push(letter);
  }

  for (const char of normalizedText) {
    const reading = getCharReading(char);
    if (reading) readings.push(reading);
  }

  return readings;
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
playBlackHoleButton.addEventListener("click", () => {
  grantMiniGameAccess(BLACK_HOLE_GAME_ID);
  window.location.href = "index.html";
});
playKingfisherButton.addEventListener("click", () => {
  grantMiniGameAccess(KINGFISHER_GAME_ID);
  window.location.href = "kingfisher.html";
});
playButterflyButton.addEventListener("click", () => {
  grantMiniGameAccess(BUTTERFLY_GAME_ID);
  window.location.href = "butterfly.html";
});
playMeteorButton.addEventListener("click", () => {
  grantMiniGameAccess(METEOR_GAME_ID);
  window.location.href = "meteor.html";
});
playRaceButton.addEventListener("click", () => {
  grantMiniGameAccess(RACE_GAME_ID);
  window.location.href = "race.html";
});
playGemButton.addEventListener("click", () => {
  grantMiniGameAccess(GEM_GAME_ID);
  window.location.href = "gem.html";
});
playPillbugButton.addEventListener("click", () => {
  grantMiniGameAccess(PILLBUG_GAME_ID);
  window.location.href = "pillbug.html";
});
playDangoShotButton.addEventListener("click", () => {
  grantMiniGameAccess(DANGO_SHOT_GAME_ID);
  window.location.href = "dango-shot.html";
});
playPlanetCatchButton.addEventListener("click", () => {
  grantMiniGameAccess(PLANET_CATCH_GAME_ID);
  window.location.href = "planet-catch.html";
});
stayButton.addEventListener("click", resetLesson);

function grantMiniGameAccess(gameId) {
  sessionStorage.setItem(`${MINI_GAME_ACCESS_PREFIX}${gameId}`, "1");
  sessionStorage.setItem(MINI_GAME_RETURN_URL, "hiragana-dakuon.html");
}

setMode(LESSON_CONFIG.defaultMode);
