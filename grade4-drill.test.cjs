const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const QUESTIONS = require('./grade4-drill-data.js');

const EXPECTED = [
  900, 1200, 200, 100, 9000, 12000, 4000, 8000, 90000, 40000,
  680, 1390, 300, 180, 8800, 16100, 4300, 5200, 87000, 35000,
  12000, 3600, 55,
  630000, 300000, 600000, 2800000, 4800000, 1000000, 300, 200, 4000, 3000,
  7, 8, 5, 60, 80, 90, 600, 500,
  240, 2000, '-+-+'
];

assert.equal(QUESTIONS.length, 44);
assert.equal(new Set(QUESTIONS.map(question => question.id)).size, 44);
assert.deepEqual(QUESTIONS.slice(0, 10).map(question => question.page), Array(10).fill(46));
assert.deepEqual([0, 10, 23, 33, 43].map(index => QUESTIONS[index].page), [46, 47, 48, 49, 49]);

function rounded(value, digits) {
  const place = 10 ** (Math.floor(Math.log10(value)) - digits + 1);
  return Math.round(value / place) * place;
}
for (const [index, question] of QUESTIONS.entries()) {
  if (question.kind === 'estimate') {
    const left = rounded(question.left, question.leftDigits);
    const right = rounded(question.right, question.rightDigits);
    const operation = { '+': () => left + right, '-': () => left - right, '*': () => left * right, '/': () => left / right }[question.operator];
    assert.equal(operation(), EXPECTED[index], `Wrong estimate: ${question.id}`);
  } else if (question.kind === 'story') {
    const { left, right, operator } = question.formula;
    const result = { '+': () => left + right, '-': () => left - right, '*': () => left * right, '/': () => left / right }[operator]() * question.factor;
    assert.equal(result, question.answer, `Wrong story formula: ${question.id}`);
    assert.equal(question.answer, EXPECTED[index], `Wrong story answer: ${question.id}`);
  } else if (question.kind === 'number') {
    assert.equal(question.answer, EXPECTED[index]);
  } else if (question.kind === 'operators') {
    assert.equal(question.operators, EXPECTED[index]);
    const result = question.values.slice(1).reduce((sum, value, i) => sum + (question.operators[i] === '+' ? value : -value), question.values[0]);
    assert.equal(result, question.target);
  }
}

const script = readFileSync('./grade4-drill.js', 'utf8');
const html = readFileSync('./grade4-drill.html', 'utf8');
const elementIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
for (const [, id] of script.matchAll(/\$\("([^"]+)"\)/g)) {
  assert.ok(elementIds.has(id), `Missing HTML element: ${id}`);
}
assert.match(html, /grade4-drill-data\.js\?v=1[\s\S]*grade4-drill\.js\?v=2/);
const local = new Map(), session = new Map();
const storage = map => ({
  getItem(key) { return map.has(key) ? map.get(key) : null; },
  setItem(key, value) { map.set(key, String(value)); },
  removeItem(key) { map.delete(key); }
});

function createApp() {
  const nodes = new Map(), timers = [], redirects = [];

  function makeElement(id, dataset = {}) {
    const classes = new Set();
    return {
      id, dataset, textContent: '', disabled: false, children: [],
      classList: {
        add(className) { classes.add(className); },
        remove(className) { classes.delete(className); },
        toggle(className, force) {
          const enabled = force ?? !classes.has(className);
          if (enabled) classes.add(className); else classes.delete(className);
          return enabled;
        },
        contains(className) { return classes.has(className); }
      },
      listeners: {},
      addEventListener(name, handler) { this.listeners[name] = handler; },
      setAttribute() {},
      click() { this.listeners.click?.(); },
      appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 300 }; },
      getContext() { return { setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
    };
  }
  const digitButtons = Array.from({ length: 10 }, (_, digit) => makeElement(`digit-${digit}`, { digit: String(digit) }));
  const formulaButtons = ['+', '-', '*', '/'].map(operator => makeElement(`op-${operator}`, { formulaOp: operator }));
  const doc = {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, makeElement(id)); return nodes.get(id); },
    querySelectorAll(selector) {
      if (selector === '[data-digit]') return digitButtons;
      if (selector === '[data-formula-op]') return formulaButtons;
      return [];
    },
    createElement(tag) { const el = makeElement(tag); el.tagName = tag.toUpperCase(); return el; }
  };
  const win = {
    GRADE4_DRILL_QUESTIONS: QUESTIONS, devicePixelRatio: 1,
    setTimeout(fn) { timers.push(fn); },
    location: { replace(path) { redirects.push(path); } },
    confirm() { return true; },
    addEventListener() {}
  };

  vm.runInNewContext(script, { window: win, document: doc, localStorage: storage(local), sessionStorage: storage(session), Math, Date });
  const app = {
    node(id) { return doc.getElementById(id); },
    redirects,
    tick() { const callback = timers.shift(); assert.ok(callback, 'Expected next-question timer'); callback(); },
    digits(value) { for (const digit of String(value)) digitButtons[Number(digit)].click(); },
    answer(question, expected) {
      if (question.kind === 'operators') {
        const buttons = doc.getElementById('operatorPuzzle').children.filter(element => element.tagName === 'BUTTON');
        for (const [index, op] of [...expected].entries()) {
          buttons[index].click();
          if (op === '-') buttons[index].click();
        }
      } else if (question.kind === 'story') {
        doc.getElementById('formulaLeft').click(); app.digits(question.formula.left);
        formulaButtons.find(button => button.dataset.formulaOp === question.formula.operator).click();
        doc.getElementById('formulaRight').click(); app.digits(question.formula.right);
        doc.getElementById('answerDisplay').click(); app.digits(expected);
      } else {
        app.digits(expected);
      }
      doc.getElementById('submitButton').click();
    }
  };
  return app;
}

let app = createApp();
assert.match(app.node('problemText').textContent, /238.*660/);
app.answer(QUESTIONS[0], 123);
assert.match(app.node('feedback').textContent, /もういちど/);
assert.equal(local.get('grade4DrillNextQuestion:v1'), undefined);
app.node('clearAnswerButton').click();

for (let index = 0; index < QUESTIONS.length; index++) {
  const question = QUESTIONS[index];
  app.answer(question, EXPECTED[index]);
  assert.equal(local.get('grade4DrillNextQuestion:v1'), String(index + 1), question.id);
  app.tick();
  const reward = (index + 1) % 5 === 0 || index === QUESTIONS.length - 1;
  if (reward) {
    assert.deepEqual(app.redirects, ['game-menu.html'], `Missing reward at ${index + 1}`);
    assert.ok(session.get('miniGameRewardToken'));
    session.delete('miniGameRewardToken'); // ごほうびゲームを選んで戻った状態
    app = createApp();
    if (index === 9) assert.match(app.node('problemText').textContent, /248.*425/);
  } else {
    assert.equal(app.redirects.length, 0);
  }
}

assert.equal(local.get('grade4DrillNextQuestion:v1'), '44');
assert.equal(app.node('finishedPanel').classList.contains('hidden'), false);
app.node('restartButton').click();
assert.equal(local.get('grade4DrillNextQuestion:v1'), '0');
assert.match(app.node('problemText').textContent, /238.*660/);
console.log('OK: 44 answer keys, ordered progression, formula input, operator puzzle, 5-question rewards, resume and reset');
