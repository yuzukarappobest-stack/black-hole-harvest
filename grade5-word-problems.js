const CONFIG = { total: 100, nextDelayMs: 800, maxAnswerLength: 8 };
const $ = (id) => document.getElementById(id);
const problemText = $("problemText"), categoryLabel = $("categoryLabel"), answerDisplay = $("answerDisplay"), correctCount = $("correctCount"), feedback = $("feedback"), submitButton = $("submitButton"), decimalButton = $("decimalButton"), backspaceButton = $("backspaceButton"), clearAnswerButton = $("clearAnswerButton"), clearScratchButton = $("clearScratchButton"), scratchCanvas = $("scratchCanvas"), completePanel = $("completePanel"), againButton = $("againButton");
const scratchCtx = scratchCanvas.getContext("2d");
let queue = [], currentProblem = null, answer = "", correct = 0, drawing = false, dpr = 1, lastTouchEnd = 0;

const number = (value) => Number((Math.round(value * 100) / 100).toFixed(2));
const make = (category, text, answer) => ({ category, text, answer: String(number(answer)) });
const buildProblems = () => {
  const problems = [];
  [[1.2,4,"リボン","m"],[2.5,3,"ジュース","L"],[1.6,5,"色紙","m"],[3.4,2,"ひも","m"],[0.8,7,"ノート","kg"],[2.3,4,"えんぴつ","m"],[1.5,6,"クッキー","kg"],[4.2,3,"布","m"],[0.6,9,"シール","m"],[2.7,5,"花のたね","g"],[1.8,4,"テープ","m"],[3.5,2,"水","L"],[0.9,8,"紙コップ","kg"],[2.4,6,"カード","m"],[1.25,4,"牛乳","L"]].forEach(([a,b,item,unit]) => problems.push(make("小数のかけ算", `${item}を 1つ ${a} ${unit}ずつ、${b}つ分 用意します。\n全部で 何 ${unit}ですか。`, a * b)));
  [[8.4,4,"リボン","m"],[7.5,3,"ジュース","L"],[9.6,6,"ひも","m"],[6.8,2,"布","m"],[12.6,7,"テープ","m"],[10.5,5,"牛乳","L"],[14.4,8,"紙","m"],[5.4,3,"ロープ","m"],[16.2,6,"水","L"],[18,9,"えんぴつ","m"],[11.2,4,"水","L"],[13.5,5,"小麦粉","kg"],[7.2,8,"リボン","m"],[15.6,6,"ひも","m"],[9,12,"ジュース","L"]].forEach(([total,count,item,unit]) => problems.push(make("小数のわり算", `${item}が 全部で ${total} ${unit} あります。${count}人で 同じ量ずつ 分けます。\n1人分は 何 ${unit}ですか。`, total / count)));
  [[12,8,5],[15,6,4],[20,9,3],[14,10,6],[18,7,5],[25,8,4],[16,12,3],[30,5,6],[11,9,8],[24,6,7],[13,11,4],[28,5,5],[20,12,4],[16,15,3],[32,4,6]].forEach(([a,b,c]) => problems.push(make("体積", `たて ${a} cm、横 ${b} cm、高さ ${c} cm の箱があります。\nこの箱の 体積は 何 cm³ ですか。`, a * b * c)));
  [[2.4,"L","mL",1000,"水とうに 2.4 L の水が入っています。何 mL ですか。"],[3500,"mL","L",.001,"大きなペットボトルに 3500 mL の水が入っています。何 L ですか。"],[1.8,"L","mL",1000,"ジュースが 1.8 L あります。何 mL ですか。"],[4200,"mL","L",.001,"水そうに 4200 mL の水があります。何 L ですか。"],[3.25,"L","mL",1000,"ミルクを 3.25 L 買いました。何 mL ですか。"],[750,"mL","L",.001,"コップに 750 mL のお茶があります。何 L ですか。"],[4,"L","mL",1000,"バケツに 4 L の水を入れました。何 mL ですか。"],[2600,"mL","L",.001,"水とうに 2600 mL 入っています。何 L ですか。"],[1.5,"m³","L",1000,"水そうの体積は 1.5 m³ です。何 L ですか。"],[3200,"L","m³",.001,"プールには 3200 L の水が入っています。何 m³ ですか。"]].forEach(([value,from,to,rate,text]) => problems.push(make("単位の換算", text, value * rate)));
  [["長方形",12,8],["長方形",15,9],["長方形",24,7],["長方形",18,14],["長方形",32,5]].forEach(([,a,b]) => problems.push(make("面積", `たて ${a} cm、横 ${b} cm の長方形があります。\n面積は 何 cm² ですか。`, a * b)));
  [[14,8],[20,9],[16,11],[25,12],[18,15]].forEach(([base,height]) => problems.push(make("面積", `底辺 ${base} cm、高さ ${height} cm の三角形があります。\n面積は 何 cm² ですか。`, base * height / 2)));
  [[13,7],[18,12],[24,9],[15,16],[30,8]].forEach(([base,height]) => problems.push(make("面積", `底辺 ${base} cm、高さ ${height} cm の平行四辺形があります。\n面積は 何 cm² ですか。`, base * height)));
  [[12,18,15,19],[24,30,27,35],[8,12,10,14],[35,42,38,45],[16,20,24,28],[52,48,56,44],[21,25,23,27],[60,54,58,64],[14,17,19,18],[31,29,33,35],[40,36,44,48],[18,22,20,24],[72,68,70,74],[26,30,28,32],[45,50,55,40]].forEach((values) => problems.push(make("平均", `4日間に 集めた ペットボトルの本数は、${values.join("、")} 本でした。\n1日あたりの 平均は 何本ですか。`, values.reduce((sum, value) => sum + value, 0) / values.length)));
  [["3分間で 36 L の水をくみました。1分あたり 何 L くみましたか。",12],["6日間で 本を84ページ読みました。1日あたり 何ページですか。",14],["りんご48こを 4箱に同じ数ずつ入れます。1箱は何こですか。",12],["5分間で 90 m 走りました。1分あたり 何mですか。",18],["72円で あめを8こ買いました。あめ1このねだんは何円ですか。",9],["7日間で 56 km 歩きました。1日あたり 何kmですか。",8],["120まいの紙を 6人で同じ数ずつ分けます。1人分は何まいですか。",20],["45 L のジュースを 3箱に同じように入れます。1箱は何Lですか。",15],["8日間で 64点とりました。1日あたり何点ですか。",8],["100このビー玉を 5袋に同じ数ずつ入れます。1袋は何こですか。",20]].forEach(([text,answer]) => problems.push(make("単位量あたり", text, answer)));
  [[12,8,5],[18,6,7],[15,9,4],[24,5,6],[20,7,3]].forEach(([a,b,count]) => problems.push(make("2段階の文章題", `1こ ${a} 円のパンと、1こ ${b} 円のジュースを買います。\n同じ組み合わせを ${count} 回買うと、全部で何円ですか。`, (a + b) * count)));
  return problems;
};
const PROBLEMS = buildProblems();

function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function resetLesson() { queue = shuffle(PROBLEMS); correct = 0; correctCount.textContent = "0"; completePanel.classList.add("hidden"); nextProblem(); }
function nextProblem() { answer = ""; currentProblem = queue[correct]; problemText.textContent = currentProblem.text; categoryLabel.textContent = currentProblem.category; feedback.textContent = " "; feedback.className = "feedback"; updateAnswer(); clearScratch(); }
function updateAnswer() { answerDisplay.textContent = answer || "数字を入力"; answerDisplay.classList.toggle("filled", Boolean(answer)); }
function append(value) { if (answer.length >= CONFIG.maxAnswerLength) return; if (value === "." && answer.includes(".")) return; if (value === "." && !answer) answer = "0."; else answer += value; updateAnswer(); }
function submit() { if (!answer) return; const correctAnswer = Number(currentProblem.answer), entered = Number(answer); if (Number.isFinite(entered) && Math.abs(entered - correctAnswer) < .00001) { correct += 1; correctCount.textContent = correct; feedback.textContent = "せいかい！"; feedback.className = "feedback good"; if (correct >= CONFIG.total) { window.setTimeout(() => completePanel.classList.remove("hidden"), CONFIG.nextDelayMs); return; } } else { feedback.textContent = `ざんねん！ こたえは ${currentProblem.answer}`; feedback.className = "feedback bad"; } window.setTimeout(nextProblem, CONFIG.nextDelayMs); }

function resizeScratch() { const rect = scratchCanvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); scratchCanvas.width = Math.max(1, Math.floor(rect.width * dpr)); scratchCanvas.height = Math.max(1, Math.floor(rect.height * dpr)); scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0); scratchCtx.lineCap = "round"; scratchCtx.lineJoin = "round"; scratchCtx.lineWidth = 5; scratchCtx.strokeStyle = "#071b35"; }
function clearScratch() { scratchCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height); }
function point(event) { const rect = scratchCanvas.getBoundingClientRect(); return { x:event.clientX - rect.left, y:event.clientY - rect.top }; }
function startDrawing(event) { event.preventDefault(); drawing = true; scratchCanvas.setPointerCapture(event.pointerId); const p = point(event); scratchCtx.beginPath(); scratchCtx.moveTo(p.x, p.y); }
function draw(event) { if (!drawing) return; event.preventDefault(); const p = point(event); scratchCtx.lineTo(p.x, p.y); scratchCtx.stroke(); }
function stopDrawing(event) { if (!drawing) return; drawing = false; scratchCanvas.releasePointerCapture(event.pointerId); }
function bind(button, handler) { let pointerHandled = false; button.addEventListener("pointerdown", (event) => { if (event.pointerType === "mouse") return; event.preventDefault(); pointerHandled = true; handler(); setTimeout(() => { pointerHandled = false; }, 450); }); button.addEventListener("click", (event) => { if (pointerHandled) { event.preventDefault(); return; } handler(); }); }

$("goalCount").textContent = `/${CONFIG.total}`;
document.querySelectorAll(".key[data-key]").forEach((button) => bind(button, () => append(button.dataset.key)));
bind(decimalButton, () => append(".")); bind(backspaceButton, () => { answer = answer.slice(0, -1); updateAnswer(); }); bind(clearAnswerButton, () => { answer = ""; updateAnswer(); }); bind(submitButton, submit); bind(clearScratchButton, clearScratch); bind(againButton, resetLesson);
scratchCanvas.addEventListener("pointerdown", startDrawing); scratchCanvas.addEventListener("pointermove", draw); scratchCanvas.addEventListener("pointerup", stopDrawing); scratchCanvas.addEventListener("pointercancel", stopDrawing); window.addEventListener("resize", resizeScratch);
document.addEventListener("touchmove", (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive:false }); document.addEventListener("touchend", (event) => { const now = Date.now(); if (now - lastTouchEnd <= 360) event.preventDefault(); lastTouchEnd = now; }, { passive:false }); document.addEventListener("gesturestart", (event) => event.preventDefault()); document.addEventListener("gesturechange", (event) => event.preventDefault()); document.addEventListener("gestureend", (event) => event.preventDefault());
resizeScratch(); resetLesson();
