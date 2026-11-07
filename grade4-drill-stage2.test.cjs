const assert = require('node:assert/strict');
const FIRST = require('./grade4-drill-data.js');
const SECOND = require('./grade4-drill-stage2-data.js');

const EXPECTED_PAGE_COUNTS = {
  50: 10, 51: 14, 52: 4, 53: 11, 54: 12, 55: 10, 56: 10, 57: 14,
  58: 10, 59: 14, 60: 10, 61: 14, 62: 10, 63: 14, 64: 16, 65: 11,
  66: 12, 67: 13, 68: 10, 69: 11
};
assert.equal(FIRST.length, 44);
assert.equal(SECOND.length, 230);
assert.equal(FIRST.length + SECOND.length, 274);
assert.equal(new Set([...FIRST, ...SECOND].map(q => q.id)).size, 274);
assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(SECOND, q => q.page))
  .map(([page, questions]) => [page, questions.length])), EXPECTED_PAGE_COUNTS);

function numericExpression(expression) {
  const normalized = expression
    .replace(/(\d+)と(\d+)\/(\d+)/g, '($1+$2/$3)')
    .replaceAll('＋', '+').replaceAll('－', '-').replaceAll('×', '*').replaceAll('÷', '/');
  assert.match(normalized, /^[0-9\s.()+\-*/]+$/, `Unsupported expression: ${expression}`);
  return Function(`"use strict"; return (${normalized});`)(); // テスト専用。ユーザー入力は評価しない。
}
function roughlyEqual(actual, expected, context) {
  assert.ok(Math.abs(actual - expected) < 1e-7,
    `${context}: ${actual} != ${expected}`);
}

const specialAnswers = new Map([
  [51, [8]], [55, [4]], [57, [642]], [59, [239]],
  [61, [531]], [63, [18]], [67, [512]]
]);
const specialWordValues = new Map([
  [51, [490]], [55, [2790]], [57, [2]], [59, [9.5]],
  [61, [1.4]], [63, [25 / 7]], [65, [4, 8 / 9]],
  [67, [16.5, 19.6]], [69, [62.4, 380]]
]);

for (const [index, question] of SECOND.entries()) {
  const context = `${index + 45}番目 ${question.id}`;
  assert.equal(typeof question.section, 'string', context);
  if (index > 0) assert.ok(SECOND[index - 1].page <= question.page, context);
  if (question.kind === 'fraction') {
    const { left, right, operator, answer } = question;
    assert.equal(left.denominator, right.denominator, context);
    assert.equal(left.denominator, answer.denominator, context);
    const firstNumerator = left.whole * left.denominator + left.numerator;
    const secondNumerator = right.whole * right.denominator + right.numerator;
    assert.equal(answer.numerator, operator === '+' ? firstNumerator + secondNumerator : firstNumerator - secondNumerator, context);
    assert.ok(answer.numerator >= 0, context);
  } else if (question.kind === 'number') {
    if (question.expression) roughlyEqual(numericExpression(question.expression), question.answer, context);
    else {
      const relevant = specialAnswers.get(question.page);
      assert.ok(relevant, context);
      assert.equal(question.answer, relevant.shift(), context);
    }
  } else if (question.kind === 'estimate') {
    const rounded = (value, digits) => {
      const place = 10 ** (Math.floor(Math.log10(value)) - digits + 1);
      return Math.round(value / place) * place;
    };
    const a = rounded(question.left, question.leftDigits);
    const b = rounded(question.right, question.rightDigits);
    assert.ok(Number.isFinite(numericExpression(`${a}${({ '+': '+', '-': '-', '*': '*', '/': '/' })[question.operator]}${b}`)), context);
  } else if (question.kind === 'blanks') {
    assert.equal(question.answers.length, (question.expression.match(/□/g) || []).length, context);
    if (question.page !== 65) {
      let at = 0;
      const expression = question.expression.replace(/□/g, () => String(question.answers[at++]));
      const steps = expression.split('＝').map(numericExpression);
      for (const step of steps.slice(1)) roughlyEqual(step, steps[0], context);
    } else assert.deepEqual(question.answers, [8, 40]);
  } else if (question.kind === 'wordChoice') {
    assert.ok(question.correctChoice >= 0 && question.correctChoice < question.choices.length, context);
    assert.equal(question.choices.length, 3, context);
    const value = typeof question.answer === 'object'
      ? question.answer.numerator / question.answer.denominator : question.answer;
    question.choices.forEach((choice, choiceIndex) => {
      const result = numericExpression(choice);
      if (choiceIndex === question.correctChoice) roughlyEqual(result, value, `${context} correct formula`);
      else assert.ok(Math.abs(result - value) > 1e-7, `${context} distractor also correct: ${choice}`);
    });
    const relevant = specialWordValues.get(question.page);
    assert.ok(relevant, context);
    roughlyEqual(value, relevant.shift(), context);
  } else if (question.kind === 'operators') {
    assert.equal(question.page, 53);
    const values = question.values.slice(1);
    assert.ok(Array.from({ length: 2 ** values.length }, (_, mask) =>
      values.reduce((sum, val, i) => sum + ((mask >> i & 1) ? val : -val), question.values[0]))
      .some(total => total === question.target), context);
  } else if (question.kind === 'fractionAnswer') {
    assert.equal(question.page, 69);
    assert.deepEqual(question.answer, { numerator: 1, denominator: 9 });
  } else assert.fail(`Unknown kind: ${context}`);
}

for (const [page, remaining] of specialAnswers) assert.equal(remaining.length, 0, `p${page} puzzle coverage`);
for (const [page, remaining] of specialWordValues) assert.equal(remaining.length, 0, `p${page} story coverage`);
console.log('OK: stage 2, 230 questions/20 pages; 274 IDs; expression arithmetic, all fractions, blanks, stories and puzzles');
