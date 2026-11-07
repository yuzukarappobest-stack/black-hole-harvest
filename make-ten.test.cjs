const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const model = require('./make-ten-model.js');

const html = readFileSync('./make-ten.html', 'utf8');
const js = readFileSync('./make-ten.js', 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const [, id] of js.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.has(id), `Missing UI element: ${id}`);
assert.match(html, /make-ten-model\.js\?v=1[\s\S]*make-ten\.js\?v=1/);
assert.match(readFileSync('./learn.html', 'utf8'), /href="make-ten\.html"/);

assert.equal(model.stageFor(0), 1);
assert.equal(model.stageFor(9), 1);
assert.equal(model.stageFor(10), 2);
assert.equal(model.stageFor(19), 2);
assert.equal(model.stageFor(20), 3);
assert.deepEqual(model.questionFor(0), { stage:1, left:10, right:3, answer:13, needed:0, mode:'ten-plus' });
assert.deepEqual(model.questionFor(10), { stage:2, left:8, right:2, answer:2, needed:2, mode:'fill-ten' });
assert.deepEqual(model.questionFor(20), { stage:3, left:8, right:5, answer:13, needed:2, mode:'bridge-ten' });
assert.equal(model.isReady(model.questionFor(20), 1, '13'), false);
assert.equal(model.isCorrect(model.questionFor(20), 2, '13'), true);
assert.equal(model.isCorrect(model.questionFor(20), 2, '12'), false);
assert.equal(model.isReward(5), true);
assert.equal(model.isReward(6), false);

for (let solved = 0; solved < 250; solved++) {
  const q = model.questionFor(solved);
  assert.ok(q.answer >= 1 && q.answer <= 20, `Incorrect range: ${solved}`);
  assert.equal(q.left + q.right, q.stage === 2 ? 10 : q.answer, `Incorrect sum: ${solved}`);
  if (q.stage === 2 || q.stage === 3) assert.equal(q.left + q.needed, 10, `Cannot fill ten: ${solved}`);
  if (q.stage === 3) assert.ok(q.right > q.needed, `No regrouping required: ${solved}`);
}

const local = new Map(), session = new Map();
const storage = map => ({
  getItem(k) { return map.has(k) ? map.get(k) : null; },
  setItem(k, v) { map.set(k, String(v)); },
  removeItem(k) { map.delete(k); }
});

function createApp() {
  const elements = new Map(), redirects = [], timers = [];
  function element(tag = 'div') {
    const classes = new Set();
    return {
      tagName: tag.toUpperCase(), children: [], disabled: false, textContent: '', dataset: {}, listeners: {},
      classList: {
        add(name) { classes.add(name); },
        toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      setAttribute() {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      click() { if (!this.disabled) this.listeners.click?.(); }
    };
  }
  const buttons = [...Array(10)].map((_, digit) => {
    const b = element('button'); b.dataset.digit = String(digit); return b;
  });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelectorAll(selector) { return selector === '[data-digit]' ? buttons : []; },
    createElement: element,
    addEventListener() {}
  };
  const window = {
    MakeTenModel: model,
    setTimeout(fn) { timers.push(fn); },
    confirm() { return true; },
    location: { replace(url) { redirects.push(url); } }
  };
  vm.runInNewContext(js, { window, document, localStorage: storage(local), sessionStorage: storage(session), Date, Math });
  const app = {
    node(id) { return document.getElementById(id); },
    redirects,
    tick() { const t = timers.shift(); assert.ok(t); t(); },
    digit(n) { for (const d of String(n)) buttons[Number(d)].click(); },
    fill(q) {
      if (q.stage === 2) {
        const frame = app.node('tenFrame');
        frame.children.slice(q.left).forEach(slot => slot.click());
      } else if (q.stage === 3) {
        for (let i = 0; i < q.needed; i++) app.node('extras').children[0].click();
      }
    },
    solve(q) {
      app.fill(q);
      app.digit(q.answer);
      assert.equal(app.node('submitAnswer').disabled, false);
      app.node('submitAnswer').click();
    }
  };
  return app;
}

let app = createApp();
app.digit('12');
app.node('submitAnswer').click();
assert.equal(local.get('makeTenSolved:v1'), undefined, 'Incorrect answer advanced progress');
assert.match(app.node('feedback').textContent, /もういちど/);

for (let index = 0; index < 60; index++) {
  const q = model.questionFor(index);
  // 誤答の直後でも、同じ問題を正解するまで続けられる。
  app.solve(q);
  assert.equal(local.get('makeTenSolved:v1'), String(index + 1));
  app.tick();
  if ((index + 1) % 5 === 0) {
    assert.deepEqual(app.redirects, ['game-menu.html']);
    assert.ok(session.get('miniGameRewardToken'));
    session.delete('miniGameRewardToken');
    app = createApp();
    const next = model.questionFor(index + 1);
    assert.match(app.node('problemText').textContent, new RegExp(String(next.left)));
  } else assert.equal(app.redirects.length, 0);
}

assert.equal(local.get('makeTenSolved:v1'), '60');
assert.match(app.node('stageTitle').textContent, /ステップ3/);
app.node('resetProgress').click();
assert.equal(local.get('makeTenSolved:v1'), '0');
assert.match(app.node('stageTitle').textContent, /ステップ1/);
console.log('OK: 60 exercises, 3 stages, ten-frame interaction, wrong-answer retry, 5-answer rewards, persisted resume and reset');
