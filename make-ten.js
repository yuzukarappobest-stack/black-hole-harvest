(() => {
  "use strict";
  const model = window.MakeTenModel;
  if (!model) throw new Error("10をつくろうの問題データを読み込めませんでした。");

  const PROGRESS_KEY = "makeTenSolved:v1";
  const REWARD_TOKEN_KEY = "miniGameRewardToken";
  const NEXT_DELAY_MS = 850;
  const $ = id => document.getElementById(id);
  const ui = {
    reward: $("rewardCount"), stageTitle: $("stageTitle"), stageCount: $("stageCount"),
    instruction: $("instruction"), problem: $("problemText"), frame: $("tenFrame"),
    hint: $("blocksHint"), extras: $("extras"), undo: $("undoMove"),
    bridge: $("bridgeHint"), display: $("answerDisplay"), question: $("answerQuestion"),
    submit: $("submitAnswer"), feedback: $("feedback"), reset: $("resetProgress"),
    backspace: $("backspace"), clear: $("clearAnswer")
  };

  function readProgress() {
    try {
      const saved = Number(localStorage.getItem(PROGRESS_KEY));
      if (Number.isSafeInteger(saved) && saved >= 0 && saved <= 1000000) return saved;
    } catch (_error) { /* 保存が無効でも使える */ }
    return 0;
  }
  function saveProgress(value) {
    try { localStorage.setItem(PROGRESS_KEY, String(value)); } catch (_error) {}
  }

  let totalCorrect = readProgress();
  let problem = model.questionFor(totalCorrect);
  let entry = "";
  let moved = 0;
  let filledSlots = new Set();
  let locked = false;

  function makeBall(className) {
    const ball = document.createElement("span");
    ball.className = className;
    ball.setAttribute("aria-hidden", "true");
    return ball;
  }

  function renderFrame() {
    ui.frame.replaceChildren();
    const stage = problem.stage;
    for (let index = 0; index < 10; index++) {
      const original = index < problem.left;
      const added = stage === 2 ? filledSlots.has(index) :
        stage === 3 && index >= problem.left && index < problem.left + moved;
      const slot = document.createElement(stage === 2 && !original ? "button" : "div");
      slot.className = "ten-slot";
      if (original || added) slot.classList.add("filled");
      if (added) slot.classList.add("moved");
      if (slot.tagName === "BUTTON") {
        slot.type = "button";
        slot.setAttribute("aria-label", `${index + 1}ばんめのマス：${added ? "もどす" : "まるをいれる"}`);
        slot.disabled = locked;
        slot.addEventListener("click", () => {
          if (locked) return;
          if (filledSlots.has(index)) filledSlots.delete(index);
          else filledSlots.add(index);
          moved = filledSlots.size;
          renderVisual();
        });
      }
      slot.appendChild(original || added ? makeBall("ten-ball") : Object.assign(document.createElement("span"),
        { className: "empty-mark", textContent: "+" }));
      ui.frame.appendChild(slot);
    }
  }

  function moveOne() {
    if (locked || problem.stage !== 3 || moved >= problem.needed) return;
    moved++;
    renderVisual();
  }

  function renderExtras() {
    ui.extras.replaceChildren();
    if (problem.stage === 2) return;
    const count = problem.stage === 3 ? problem.right - moved : problem.right;
    for (let index = 0; index < count; index++) {
      if (problem.stage === 3 && moved < problem.needed) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "extra-button";
        button.disabled = locked;
        button.setAttribute("aria-label", "オレンジのまるを1こ、10のおへやへうつす");
        button.addEventListener("click", moveOne);
        ui.extras.appendChild(button);
      } else {
        ui.extras.appendChild(makeBall("extra-ball"));
      }
    }
  }

  function renderVisual() {
    renderFrame();
    renderExtras();
    if (problem.stage === 1) {
      ui.hint.textContent = `みどりが10こ。オレンジが${problem.right}こ。`;
      ui.bridge.textContent = "";
    } else if (problem.stage === 2) {
      ui.hint.textContent = moved < problem.needed
        ? `あいているマスを おしてね！（あと${problem.needed - moved}こ）`
        : "10この おへやが いっぱい！";
      ui.bridge.textContent = moved === problem.needed ? `${problem.left} と ${moved} で 10！` : "";
    } else {
      ui.hint.textContent = moved < problem.needed
        ? `オレンジを おして、あと${problem.needed - moved}こ いれよう！`
        : `10が できた！ オレンジは あと${problem.right - moved}こ。`;
      ui.bridge.textContent = moved === problem.needed
        ? `10 ＋ ${problem.right - moved} ＝ ？` : "";
    }
    ui.undo.classList.toggle("hidden", problem.stage !== 3 || moved === 0);
    ui.undo.disabled = locked;
    updateEntry();
  }

  function updateEntry() {
    ui.display.textContent = entry || "？";
    ui.submit.disabled = locked || !model.isReady(problem, moved, entry);
  }

  function renderQuestion() {
    locked = false;
    entry = "";
    moved = 0;
    filledSlots = new Set();
    problem = model.questionFor(totalCorrect);
    const stage = problem.stage;
    ui.reward.textContent = String(totalCorrect % model.REWARD_EVERY);
    ui.stageTitle.textContent = `ステップ${stage}　${model.STAGE_NAMES[stage - 1]}`;
    ui.stageCount.textContent = stage === 3 ? `${totalCorrect - 19}もんめ` :
      `${stage === 1 ? totalCorrect : totalCorrect - 10} / 10`;
    for (let i = 1; i <= 3; i++) {
      const dot = $(`stageDot${i}`);
      dot.classList.toggle("current", i === stage);
      dot.classList.toggle("done", i < stage);
      dot.textContent = i < stage ? "✓" : String(i);
    }
    ui.instruction.textContent = stage === 1 ? "10と いくつ あるかな？" :
      stage === 2 ? "10に なるように マスを おそう！" : "まず 10を つくろう！";
    ui.problem.textContent = stage === 2 ? `${problem.left} ＋ ？ ＝ 10` :
      `${problem.left} ＋ ${problem.right} ＝ ？`;
    ui.question.textContent = stage === 2 ? "いくつ たした？" : "こたえは いくつ？";
    ui.feedback.textContent = " ";
    ui.feedback.className = "feedback";
    renderVisual();
  }

  function appendDigit(digit) {
    if (locked || entry.length >= 2) return;
    entry = entry === "0" ? digit : entry + digit;
    updateEntry();
  }

  function submitAnswer() {
    if (locked || !model.isReady(problem, moved, entry)) return;
    if (!model.isCorrect(problem, moved, entry)) {
      ui.feedback.textContent = "おしい！ もういちど かぞえてみよう。";
      ui.feedback.className = "feedback bad";
      entry = "";
      updateEntry();
      return;
    }
    locked = true;
    totalCorrect++;
    saveProgress(totalCorrect);
    const reward = model.isReward(totalCorrect);
    ui.reward.textContent = String(reward ? model.REWARD_EVERY : totalCorrect % model.REWARD_EVERY);
    ui.feedback.textContent = reward ? "やったー！ ごほうびゲームへ！ 🎉" : "せいかい！ すごいね！ ⭐";
    ui.feedback.className = "feedback good";
    updateEntry();
    if (reward) {
      try { sessionStorage.setItem(REWARD_TOKEN_KEY, `${Date.now()}-${Math.random()}`); } catch (_error) {}
      window.setTimeout(() => window.location.replace("game-menu.html"), NEXT_DELAY_MS);
    } else {
      window.setTimeout(renderQuestion, NEXT_DELAY_MS);
    }
  }

  document.querySelectorAll("[data-digit]").forEach(button => {
    button.addEventListener("click", () => appendDigit(button.dataset.digit));
  });
  ui.backspace.addEventListener("click", () => { if (!locked) { entry = entry.slice(0, -1); updateEntry(); } });
  ui.clear.addEventListener("click", () => { if (!locked) { entry = ""; updateEntry(); } });
  ui.submit.addEventListener("click", submitAnswer);
  ui.undo.addEventListener("click", () => {
    if (!locked && moved > 0) { moved--; renderVisual(); }
  });
  ui.reset.addEventListener("click", () => {
    if (!window.confirm("このコースの すすみぐあいを さいしょからに しますか？")) return;
    totalCorrect = 0;
    saveProgress(totalCorrect);
    renderQuestion();
  });
  document.addEventListener("keydown", event => {
    if (event.target?.tagName === "BUTTON" || event.target?.tagName === "SUMMARY") return;
    if (/^\d$/.test(event.key)) appendDigit(event.key);
    else if (event.key === "Backspace") { entry = entry.slice(0, -1); updateEntry(); }
    else if (event.key === "Enter") submitAnswer();
  });
  renderQuestion();
})();
