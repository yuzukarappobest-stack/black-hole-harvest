const assert = require('node:assert/strict');
const FIRST = require('./grade4-drill-data.js');
const SECOND = require('./grade4-drill-stage2-data.js');
const THIRD = require('./grade4-drill-stage3-data.js');

// 紙面の各ページに対応する問題数（計算・文章題・さんすうパズルを含む）。
const pageCounts = {
  70: 6, 71: 9, 72: 8, 73: 10, 74: 14, 75: 8, 76: 10, 77: 10,
  78: 8, 79: 12, 80: 6, 81: 10, 82: 8, 83: 12, 84: 6, 85: 6,
  86: 6, 87: 8, 88: 10, 89: 6
};
assert.equal(THIRD.length, 173);
assert.equal(FIRST.length + SECOND.length + THIRD.length, 447);
assert.equal(new Set([...FIRST, ...SECOND, ...THIRD].map(q => q.id)).size, 447);
assert.deepEqual(Object.fromEntries(Object.keys(pageCounts).map(page => [page, THIRD.filter(q => q.page === Number(page)).length])), pageCounts);
assert.deepEqual([...new Set(THIRD.map(q => q.page))], Object.keys(pageCounts).map(Number));

// 筆算と計算テストの数値をページ順に独立して照合。
const printedCalculations = {
  70: '1.6×47,7.3×96,8.4×65,2.5×32,0.2×18,0.5×76',
  71: '16.3×38,38.6×49,85.4×82,78.5×64,40.8×73,57.6×25',
  72: '1.54×3,7.96×7,8.06×5,0.38×2,2.18×24,6.26×78,6.05×92,0.57×49',
  73: '4.56×2,9.73×9,7.05×4,0.29×3,3.69×18,2.93×74,6.25×24,0.08×65',
  74: '0.7×8,1.3×2,1.2×3,0.5×8,3.8×2,9.7×6,26.8×3,46.5×4,1.9×42,5.6×79,70.4×63,62.5×48,9.36×7,8.92×45',
  75: '8.4×9,47.3×8,12.5×4,6.38×3,56.9×74,7.42×65',
  76: '3.2÷8,0.8÷4,4.6÷2,6.3÷3,8.4÷2,7.2÷3,7.8÷6,9.5÷5,42.3÷9,39.2÷7',
  77: '50.4÷8,19.4÷2,83.5÷5,55.6÷4,76.8÷6,73.8÷3,3.6÷4,5.6÷7',
  78: '72.5÷29,97.2÷36,99.6÷83,84.6÷47,86.7÷51,59.2÷16,97.5÷65,93.6÷72',
  79: '99.2÷31,94.5÷45,93.8÷67,94.5÷27,86.4÷54,60.2÷14,16.8÷28,30.1÷43,22.2÷74,50.4÷56',
  80: '7.68÷6,5.74÷2,9.52÷7,9.75÷3,9.36÷4,7.65÷5',
  81: '5.13÷9,5.52÷8,2.88÷3,3.36÷4,0.24÷6,0.63÷7,0.108÷9,0.435÷5',
  82: '7.68÷48,7.02÷18,8.25÷33,8.71÷67,6.44÷46,7.29÷27,7.28÷14,7.95÷53',
  83: '9.12÷24,8.88÷74,8.51÷37,5.98÷13,5.85÷65,2.96÷37,0.92÷23,0.84÷14,0.395÷79,0.574÷82',
  84: '73.4÷6,96.3÷7,86.6÷4,75.2÷3,76.8÷16,68.3÷24',
  85: '89.1÷5,58.3÷2,74.5÷13,98.4÷32,43.9÷3',
  86: '3.2÷5,6.3÷6,8.6÷4,21.6÷16,10.8÷48,1.4÷56',
  87: '72.4÷3,60.7÷7,48.4÷13,77.4÷49,82.5÷27,95.1÷52',
  88: '7.8÷2,55.2÷8,96.6÷7,88.2÷63,8.61÷3,5.04÷9,7.05÷15,8.74÷46,0.25÷5,2.82÷47',
  89: '97.4÷8,80.2÷19,1.2÷8,65.1÷35'
};

function extractExpression(question) {
  if (question.kind === 'number') return question.expression || null;
  if (question.kind === 'blanks') {
    const match = question.expression.replace(/m/g, '').match(/\d+(?:\.\d+)?÷\d+(?:\.\d+)?/);
    return match ? match[0] : null;
  }
  return null;
}

for (const [page, expected] of Object.entries(printedCalculations)) {
  const found = THIRD.filter(q => q.page === Number(page)).map(extractExpression).filter(Boolean);
  assert.deepEqual(found, expected.split(','), `紙面の計算問題と不一致: ${page}ページ`);
}

function evaluate(expr) {
  const match = expr.match(/^(\d+(?:\.\d+)?)([×÷＋－])(\d+(?:\.\d+)?)$/);
  assert.ok(match, `演算式が判別できない: ${expr}`);
  const a = Number(match[1]), b = Number(match[3]);
  return { '×': a * b, '÷': a / b, '＋': a + b, '－': a - b }[match[2]];
}

const expectedPuzzles = {
  71: 23, 73: 1, 75: 13, 77: 1.5, 79: 100, 81: 1582, 83: 159,
  85: 600, 87: 573, 89: 12
};
const wordAnswers = {
  71: [914.4, 76.2], 73: [90.3], 75: [147], 77: [4.9], 79: [3.2],
  81: [1.24], 83: [0.52], 87: [2.65], 89: [2.9]
};
for (const [page, answers] of Object.entries(wordAnswers)) {
  assert.deepEqual(THIRD.filter(q => q.page === Number(page) && q.kind === 'wordChoice').map(q => q.answer), answers);
}

for (const q of THIRD) {
  assert.ok(q.section && q.step && q.page, `基本フィールド不足: ${q.id}`);
  if (q.kind === 'number' && q.expression) {
    const raw = evaluate(q.expression);
    const digits = q.page === 87 ? 2 : q.page === 89 && q.step === '4' ? 2 : null;
    const place = digits && 10 ** (Math.floor(Math.log10(raw)) - digits + 1);
    const answer = digits ? Math.round(raw / place) * place : raw;
    assert.ok(Math.abs(q.answer - answer) < 1e-8, `算数の答えが違う: ${q.id}`);
  }
  if (q.kind === 'blanks') {
    assert.equal((q.expression.match(/□/g) || []).length, q.answers.length, q.id);
    assert.equal(q.answers.length, 2, q.id);
    const dividend = Number(q.expression.match(/^\d+(?:\.\d+)?/)[0]);
    const divisor = Number(q.expression.match(/÷(\d+(?:\.\d+)?)/)[1]);
    assert.ok(Math.abs(q.answers[0] * divisor + q.answers[1] - dividend) < 1e-8, q.id);
    assert.ok(q.answers[1] >= 0 && q.answers[1] < divisor, q.id);
  }
  if (q.kind === 'wordChoice') {
    assert.equal(q.choices.length, 3, q.id);
    assert.ok(q.correctChoice >= 0 && q.correctChoice < 3, q.id);
    const raw = evaluate(q.choices[q.correctChoice]);
    const expected = q.page === 89 ? 2.9 : raw;
    assert.ok(Math.abs(q.answer - expected) < 1e-8, `文章題の式が合わない: ${q.id}`);
  }
  if (q.step === 'パズル') {
    assert.equal(q.answer ?? q.target, expectedPuzzles[q.page], q.id);
    if (q.kind === 'operators') {
      const n = q.values.length - 1;
      assert.ok(Array.from({ length: 2 ** n }, (_, mask) => q.values.slice(1).reduce((sum, val, index) =>
        sum + ((mask >> index) & 1 ? val : -val), q.values[0]))
        .some(total => Math.abs(total - q.target) < 1e-8), `解けない記号パズル: ${q.id}`);
    }
  }
}

assert.equal(THIRD.at(0).id, 'g4-p70-1-1');
assert.equal(THIRD.at(-1).id, 'g4-p89-パズル-1');
console.log('OK: stage 3, 173 questions/20 pages, all printed calculations, independently verified arithmetic, decimal remainders, rounded quotients, stories and puzzles');
