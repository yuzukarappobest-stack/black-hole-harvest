const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const questions = require('./grade4-drill-stage3-data.js');

const base = 'http://127.0.0.1:8765/';
const progressKey = 'grade4DrillNextQuestion:v1';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(base + 'grade4-drill.html');

    async function seek(questionId) {
      const index = questions.findIndex(q => q.id === questionId);
      assert.ok(index >= 0, `Missing question: ${questionId}`);
      await page.evaluate(([key, value]) => localStorage.setItem(key, String(value)), [progressKey, 274 + index]);
      await page.goto(base + 'grade4-drill.html');
      return questions[index];
    }
    async function input(value) {
      for (const digit of String(value)) await page.locator(`[data-digit="${digit}"]`).click();
    }
    async function assertAnswered(expectedNext) {
      await page.locator('#submitButton').click();
      await page.waitForFunction(([key, next]) => localStorage.getItem(key) === next, [progressKey, String(expectedNext)]);
    }

    // 前回の274問を保持したまま70ページの問題へ。
    await seek('g4-p70-1-1');
    assert.equal(await page.locator('#problemNumber').innerText(), '275 / 447');
    assert.match(await page.locator('#problemText').innerText(), /1\.6×47/);
    assert.ok(await page.locator('#decimalKey').isVisible());
    await input('75.2');
    await assertAnswered(275);
    await page.screenshot({ path: '/tmp/grade4-stage3-start.png', fullPage: true });

    // 小数の記号パズルは2進浮動小数点の丸め誤差でも解ける。
    const operatorQuestion = await seek('g4-p73-パズル-1');
    const ops = page.locator('#operatorPuzzle button');
    const operatorSolution = Array.from({ length: 2 ** (operatorQuestion.values.length - 1) }, (_, mask) =>
      operatorQuestion.values.slice(1).map((_, index) => (mask >> index & 1) ? '+' : '-').join(''))
      .find(operators => Math.abs(operatorQuestion.values.slice(1).reduce((sum, val, index) =>
        sum + (operators[index] === '+' ? val : -val), operatorQuestion.values[0]) - operatorQuestion.target) < 1e-8);
    assert.ok(operatorSolution);
    for (const [i, op] of [...operatorSolution].entries()) {
      await ops.nth(i).click();
      if (op === '-') await ops.nth(i).click();
    }
    assert.ok(await page.locator('#submitButton').isEnabled());
    await assertAnswered(274 + questions.findIndex(q => q.id === 'g4-p73-パズル-1') + 1);

    // 小数点のあるパズルは、専用キーボードで小数を入力できる。
    await seek('g4-p77-パズル-1');
    assert.ok(await page.locator('#decimalKey').isVisible());
    await input('1.5');
    await assertAnswered(274 + questions.findIndex(q => q.id === 'g4-p77-パズル-1') + 1);

    // 商・あまりは個別入力でき、あまりに小数点を使える。
    await seek('g4-p84-1-1');
    const blanks = page.locator('#blankArea button');
    assert.equal(await blanks.count(), 2);
    assert.ok(await page.locator('#decimalKey').isVisible());
    await blanks.nth(0).click();
    await input('12');
    await blanks.nth(1).click();
    await input('1.4');
    await assertAnswered(274 + questions.findIndex(q => q.id === 'g4-p84-1-1') + 1);
    await page.screenshot({ path: '/tmp/grade4-stage3-remainder.png', fullPage: true });

    // 2けたの概数と最後のご褒美。
    await seek('g4-p87-2-1');
    await input('24');
    await assertAnswered(274 + questions.findIndex(q => q.id === 'g4-p87-2-1') + 1);

    await seek('g4-p89-パズル-1');
    await input('12');
    await page.locator('#submitButton').click();
    await page.waitForURL(/game-menu\.html/, { timeout: 5000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), progressKey), '447');
    await page.goto(base + 'grade4-drill.html');
    assert.ok(await page.locator('#finishedPanel').isVisible());
    assert.match(await page.locator('#finishedPanel').innerText(), /447もん/);
    console.log('OK: mobile UI, 274→447 resume, decimal operators, two-part remainder, rounding, final reward and finish');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
