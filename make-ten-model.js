/* 6歳向け「10をつくろう」。学習順と判定を画面から独立させる。 */
((scope) => {
  "use strict";

  const STAGE_ONE = [3, 1, 4, 2, 5, 2, 6, 7, 8, 9];
  const STAGE_TWO = [8, 9, 7, 6, 8, 5, 7, 9, 6, 4];
  const STAGE_THREE = [
    [8, 5], [9, 4], [7, 5], [8, 4], [9, 5],
    [6, 6], [7, 6], [8, 6], [6, 5], [7, 4],
    [9, 3], [6, 7], [8, 7], [7, 7], [9, 6]
  ];
  const STAGE_NAMES = ["10といくつ", "10にする", "10をつくってたす"];
  const REWARD_EVERY = 5;

  function stageFor(totalCorrect) {
    if (totalCorrect < 10) return 1;
    if (totalCorrect < 20) return 2;
    return 3;
  }

  function questionFor(totalCorrect) {
    if (!Number.isSafeInteger(totalCorrect) || totalCorrect < 0) throw new Error("Invalid progress");
    const stage = stageFor(totalCorrect);
    if (stage === 1) {
      const right = STAGE_ONE[totalCorrect];
      return { stage, left: 10, right, answer: 10 + right, needed: 0, mode: "ten-plus" };
    }
    if (stage === 2) {
      const left = STAGE_TWO[totalCorrect - 10];
      return { stage, left, right: 10 - left, answer: 10 - left, needed: 10 - left, mode: "fill-ten" };
    }
    const [left, right] = STAGE_THREE[(totalCorrect - 20) % STAGE_THREE.length];
    return { stage, left, right, answer: left + right, needed: 10 - left, mode: "bridge-ten" };
  }

  function isReady(question, moved, entry) {
    return /^\d{1,2}$/.test(entry) &&
      (question.stage === 1 || moved === question.needed);
  }

  function isCorrect(question, moved, entry) {
    return isReady(question, moved, entry) && Number(entry) === question.answer;
  }

  function isReward(totalCorrect) {
    return totalCorrect > 0 && totalCorrect % REWARD_EVERY === 0;
  }

  const api = { stageFor, questionFor, isReady, isCorrect, isReward, STAGE_NAMES, REWARD_EVERY };
  scope.MakeTenModel = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window === "object" ? window : globalThis);
