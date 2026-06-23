const LESSON_CONFIG = {
  requiredCorrect: 8,
  nextDelayMs: 560,
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

const QUESTIONS = [
  ["じてんしゃ", "🚲", ["じてんしゃ", "じどうしゃ", "でんしゃ"]],
  ["じどうしゃ", "🚗", ["じどうしゃ", "じてんしゃ", "でんしゃ"]],
  ["でんしゃ", "🚃", ["でんしゃ", "じてんしゃ", "ひこうき"]],
  ["ひこうき", "✈️", ["ひこうき", "ふね", "でんしゃ"]],
  ["ふね", "🚢", ["ふね", "くるま", "ひこうき"]],
  ["ばす", "🚌", ["ばす", "たくしー", "でんしゃ"]],
  ["たくしー", "🚕", ["たくしー", "ばす", "くるま"]],
  ["しょうぼうしゃ", "🚒", ["しょうぼうしゃ", "きゅうきゅうしゃ", "ぱとかー"]],
  ["きゅうきゅうしゃ", "🚑", ["きゅうきゅうしゃ", "しょうぼうしゃ", "ぱとかー"]],
  ["ぱとかー", "🚓", ["ぱとかー", "きゅうきゅうしゃ", "ばす"]],
  ["いぬ", "🐶", ["いぬ", "ねこ", "うさぎ"]],
  ["ねこ", "🐱", ["ねこ", "いぬ", "きつね"]],
  ["うさぎ", "🐰", ["うさぎ", "りす", "ねずみ"]],
  ["りす", "🐿️", ["りす", "うさぎ", "くま"]],
  ["くま", "🐻", ["くま", "いぬ", "ぱんだ"]],
  ["ぱんだ", "🐼", ["ぱんだ", "くま", "こあら"]],
  ["こあら", "🐨", ["こあら", "ぱんだ", "さる"]],
  ["さる", "🐵", ["さる", "ねこ", "らいおん"]],
  ["らいおん", "🦁", ["らいおん", "とら", "ねこ"]],
  ["とら", "🐯", ["とら", "らいおん", "くま"]],
  ["ぞう", "🐘", ["ぞう", "きりん", "うま"]],
  ["きりん", "🦒", ["きりん", "ぞう", "しまうま"]],
  ["しまうま", "🦓", ["しまうま", "うま", "きりん"]],
  ["うま", "🐴", ["うま", "しまうま", "しか"]],
  ["しか", "🦌", ["しか", "うま", "やぎ"]],
  ["やぎ", "🐐", ["やぎ", "しか", "ひつじ"]],
  ["ひつじ", "🐑", ["ひつじ", "やぎ", "うし"]],
  ["うし", "🐮", ["うし", "ひつじ", "ぶた"]],
  ["ぶた", "🐷", ["ぶた", "うし", "にわとり"]],
  ["にわとり", "🐔", ["にわとり", "あひる", "ぺんぎん"]],
  ["あひる", "🦆", ["あひる", "にわとり", "はと"]],
  ["ぺんぎん", "🐧", ["ぺんぎん", "あひる", "ふくろう"]],
  ["ふくろう", "🦉", ["ふくろう", "ぺんぎん", "はと"]],
  ["はと", "🕊️", ["はと", "ふくろう", "すずめ"]],
  ["さかな", "🐟", ["さかな", "えび", "かに"]],
  ["えび", "🦐", ["えび", "さかな", "いか"]],
  ["かに", "🦀", ["かに", "えび", "たこ"]],
  ["たこ", "🐙", ["たこ", "いか", "かに"]],
  ["いか", "🦑", ["いか", "たこ", "さかな"]],
  ["くじら", "🐳", ["くじら", "いるか", "さかな"]],
  ["いるか", "🐬", ["いるか", "くじら", "あざらし"]],
  ["かえる", "🐸", ["かえる", "とかげ", "へび"]],
  ["とかげ", "🦎", ["とかげ", "かえる", "わに"]],
  ["へび", "🐍", ["へび", "とかげ", "みみず"]],
  ["わに", "🐊", ["わに", "へび", "とかげ"]],
  ["ちょうちょ", "🦋", ["ちょうちょ", "はち", "せみ"]],
  ["はち", "🐝", ["はち", "ちょうちょ", "とんぼ"]],
  ["とんぼ", "✨", ["とんぼ", "はち", "せみ"]],
  ["せみ", "🌳", ["せみ", "とんぼ", "かぶとむし"]],
  ["かぶとむし", "🪲", ["かぶとむし", "せみ", "てんとうむし"]],
  ["てんとうむし", "🐞", ["てんとうむし", "かぶとむし", "あり"]],
  ["あり", "🐜", ["あり", "はち", "だんごむし"]],
  ["だんごむし", "🪲", ["だんごむし", "あり", "かたつむり"]],
  ["かたつむり", "🐌", ["かたつむり", "だんごむし", "かめ"]],
  ["かめ", "🐢", ["かめ", "かたつむり", "わに"]],
  ["りんご", "🍎", ["りんご", "みかん", "ぶどう"]],
  ["みかん", "🍊", ["みかん", "りんご", "ばなな"]],
  ["ばなな", "🍌", ["ばなな", "みかん", "いちご"]],
  ["いちご", "🍓", ["いちご", "ばなな", "めろん"]],
  ["めろん", "🍈", ["めろん", "すいか", "いちご"]],
  ["すいか", "🍉", ["すいか", "めろん", "ぶどう"]],
  ["ぶどう", "🍇", ["ぶどう", "すいか", "りんご"]],
  ["もも", "🍑", ["もも", "なし", "さくらんぼ"]],
  ["なし", "🍐", ["なし", "もも", "りんご"]],
  ["さくらんぼ", "🍒", ["さくらんぼ", "もも", "いちご"]],
  ["ぱん", "🍞", ["ぱん", "ごはん", "けーき"]],
  ["ごはん", "🍚", ["ごはん", "ぱん", "おにぎり"]],
  ["おにぎり", "🍙", ["おにぎり", "ごはん", "すし"]],
  ["すし", "🍣", ["すし", "おにぎり", "らーめん"]],
  ["らーめん", "🍜", ["らーめん", "すし", "かれー"]],
  ["かれー", "🍛", ["かれー", "らーめん", "ぴざ"]],
  ["ぴざ", "🍕", ["ぴざ", "かれー", "けーき"]],
  ["けーき", "🍰", ["けーき", "ぴざ", "あいす"]],
  ["あいす", "🍨", ["あいす", "けーき", "ぷりん"]],
  ["ぷりん", "🍮", ["ぷりん", "あいす", "だんご"]],
  ["だんご", "🍡", ["だんご", "ぷりん", "せんべい"]],
  ["せんべい", "🍘", ["せんべい", "だんご", "ぱん"]],
  ["はな", "🌸", ["はな", "き", "くさ"]],
  ["き", "🌳", ["き", "はな", "やま"]],
  ["くさ", "🌿", ["くさ", "き", "はっぱ"]],
  ["はっぱ", "🍃", ["はっぱ", "くさ", "はな"]],
  ["やま", "⛰️", ["やま", "うみ", "そら"]],
  ["うみ", "🌊", ["うみ", "やま", "かわ"]],
  ["かわ", "🏞️", ["かわ", "うみ", "いけ"]],
  ["いけ", "🏞️", ["いけ", "かわ", "もり"]],
  ["もり", "🌲", ["もり", "いけ", "やま"]],
  ["そら", "☁️", ["そら", "うみ", "やま"]],
  ["たいよう", "☀️", ["たいよう", "つき", "ほし"]],
  ["つき", "🌙", ["つき", "たいよう", "ほし"]],
  ["ほし", "⭐", ["ほし", "つき", "にじ"]],
  ["にじ", "🌈", ["にじ", "ほし", "そら"]],
  ["あめ", "☔", ["あめ", "ゆき", "かぜ"]],
  ["ゆき", "❄️", ["ゆき", "あめ", "くも"]],
  ["くも", "☁️", ["くも", "ゆき", "あめ"]],
  ["かぜ", "🍃", ["かぜ", "あめ", "そら"]],
  ["いす", "🪑", ["いす", "つくえ", "べっど"]],
  ["つくえ", "🧸", ["つくえ", "いす", "ほん"]],
  ["ほん", "📕", ["ほん", "えんぴつ", "かばん"]],
  ["えんぴつ", "✏️", ["えんぴつ", "ほん", "はさみ"]],
  ["はさみ", "✂️", ["はさみ", "えんぴつ", "のり"]],
  ["かばん", "🎒", ["かばん", "ほん", "ぼうし"]],
  ["ぼうし", "🧢", ["ぼうし", "かばん", "くつ"]],
  ["くつ", "👟", ["くつ", "ぼうし", "しゃつ"]],
  ["しゃつ", "👕", ["しゃつ", "くつ", "ぼうし"]],
  ["べっど", "🛏️", ["べっど", "いす", "つくえ"]],
];

const correctCount = document.getElementById("correctCount");
const goalCount = document.getElementById("goalCount");
const prompt = document.getElementById("prompt");
const pictureEmoji = document.getElementById("pictureEmoji");
const feedback = document.getElementById("feedback");
const replayButton = document.getElementById("replayButton");
const choiceGrid = document.getElementById("choiceGrid");
const completePanel = document.getElementById("completePanel");
const rewardGrid = document.getElementById("rewardGrid");
const againButton = document.getElementById("againButton");

let correct = 0;
let queue = [];
let current = null;
let locked = false;

goalCount.textContent = `/${LESSON_CONFIG.requiredCorrect}`;
renderRewards();
resetLesson();

function resetLesson() {
  correct = 0;
  queue = shuffle([...QUESTIONS]);
  completePanel.classList.add("hidden");
  correctCount.textContent = correct;
  nextQuestion();
}

function nextQuestion() {
  locked = false;
  if (!queue.length) queue = shuffle([...QUESTIONS]);
  current = queue.pop();
  prompt.textContent = "よくきいて えらぼう";
  pictureEmoji.textContent = current[1];
  feedback.textContent = " ";
  feedback.className = "feedback";
  renderChoices(shuffle(current[2]));
  window.setTimeout(speakCurrent, 240);
}

function renderChoices(choices) {
  choiceGrid.innerHTML = "";
  for (const choice of choices) {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.textContent = choice;
    button.addEventListener("click", () => choose(button, choice));
    choiceGrid.appendChild(button);
  }
}

function choose(button, choice) {
  if (locked) return;
  locked = true;
  const ok = choice === current[0];
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

function speakCurrent() {
  if (!current || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${current[0]} を えらんでね`);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  utterance.pitch = 1.08;
  window.speechSynthesis.speak(utterance);
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

replayButton.addEventListener("click", speakCurrent);
againButton.addEventListener("click", resetLesson);
