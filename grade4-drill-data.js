/* 小4算数・46〜49ページの学習用データ。
 * 紙面画像や手書き部分は使用せず、文章題はアプリ用に言い換えている。
 * id と並び順は進捗を守るため変更しない。今後の問題は末尾へ追加する。
 */
(function (scope) {
  "use strict";

  const estimate = (page, step, number, left, operator, right, leftDigits, rightDigits) => ({
    id: `p${page}-s${step}-${number}`,
    page,
    step,
    number,
    kind: "estimate",
    left,
    operator,
    right,
    leftDigits,
    rightDigits
  });

  const story = (page, number, prompt, formula, answer, unit, factor = 1) => ({
    id: `p${page}-s3-${number}`,
    page,
    step: 3,
    number,
    kind: "story",
    prompt,
    formula,
    answer,
    unit,
    factor
  });

  const QUESTIONS = [
    // 46ページ：上から1けたに丸める、たし算・ひき算（先行公開した10問）
    ...[
      [238, "+", 660], [251, "+", 945], [807, "-", 631],
      [960, "-", 854], [6235, "+", 2774], [2878, "+", 8653],
      [4763, "-", 1209], [9773, "-", 2090],
      [31405, "+", 58673], [77623, "-", 40952]
    ].map(([a, op, b], i) => estimate(46, 1, i + 1, a, op, b, 1, 1)),

    // 47ページ：上から2けたに丸める、たし算・ひき算
    ...[
      [248, "+", 425], [631, "+", 756], [805, "-", 512],
      [795, "-", 623], [3762, "+", 5043], [8286, "+", 7834],
      [9214, "-", 4852], [6972, "-", 1753],
      [12546, "+", 74059], [99563, "-", 65437]
    ].map(([a, op, b], i) => estimate(47, 2, i + 1, a, op, b, 2, 2)),

    story(47, 1,
      "A町には7862人、B町には4265人が住んでいます。どちらも上から1けたの概数にして、人口の合計を求めよう。",
      { left: 8000, operator: "+", right: 4000 }, 12000, "人"),
    story(47, 2,
      "A町には7862人、B町には4265人が住んでいます。どちらも上から2けたの概数にして、人口の差を求めよう。",
      { left: 7900, operator: "-", right: 4300 }, 3600, "人"),
    {
      id: "p47-puzzle-1", page: 47, step: "パズル", number: 1, kind: "number",
      prompt: "車とトラックが交互に1列に並んでいます。先頭も最後も車で、車は56台です。トラックは何台でしょう？",
      answer: 55, unit: "台"
    },

    // 48ページ：上から1けたに丸める、かけ算・わり算
    ...[
      [672, "*", 915], [546, "*", 557], [2725, "*", 169],
      [4423, "*", 708], [758, "*", 6148], [174, "*", 4862],
      [6308, "/", 17], [8427, "/", 43],
      [76054, "/", 22], [85004, "/", 29]
    ].map(([a, op, b], i) => estimate(48, 1, i + 1, a, op, b, 1, 1)),

    // 49ページ：わられる数は上から2けた、わる数は上から1けた
    ...[
      [2843, "/", 431], [4765, "/", 612], [4478, "/", 891],
      [3025, "/", 48], [23843, "/", 319], [62546, "/", 747],
      [120584, "/", 194], [196674, "/", 378]
    ].map(([a, op, b], i) => estimate(49, 2, i + 1, a, op, b, 2, 1)),

    story(49, 1,
      "1周586mの公園を毎日1周走ります。1年を365日として、両方の数を上から1けたに丸めると、1年間で約何km走るでしょう？",
      { left: 600, operator: "*", right: 400 }, 240, "km", 0.001),
    story(49, 2,
      "バス旅行に295人が参加します。バス6台の費用は合計586750円。1人あたりの費用を、人数と合計金額を上から1けたに丸めて見積もろう。",
      { left: 600000, operator: "/", right: 300 }, 2000, "円"),
    {
      id: "p49-puzzle-1", page: 49, step: "パズル", number: 1, kind: "operators",
      prompt: "4つの「？」に＋か－を入れて、答えを1000にしよう。",
      values: [320, 100, 500, 120, 400], target: 1000,
      operators: "-+-+"
    }
  ];

  scope.GRADE4_DRILL_QUESTIONS = Object.freeze(QUESTIONS);
  if (typeof module !== "undefined" && module.exports) module.exports = QUESTIONS;
})(typeof window !== "undefined" ? window : globalThis);
