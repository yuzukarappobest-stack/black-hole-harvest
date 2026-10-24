(() => {
  "use strict";
  const GOAL = 5, TOKEN = "miniGameRewardToken";
  const $ = id => document.getElementById(id);
  const ui = {
    count:$("correctCount"), heads:$("headCount"), legs:$("legCount"),
    crane:$("craneAnswer"), turtle:$("turtleAnswer"),
    feedback:$("feedback"), hint:$("hintText"), hintButton:$("hintButton"),
    submit:$("submitButton"), panel:$("successPanel"),
    canvas:$("scratchCanvas"), clearCanvas:$("clearScratchButton"),
    erase:$("eraseButton"), clear:$("clearButton")
  };
  let correct=0, problem=null, active="crane", locked=false, complete=false;
  let answers={crane:"",turtle:""};
  const used=new Set();

  function createProblem(){
    let heads,turtles,cranes,legs,key,attempts=0;
    do {
      heads=6+Math.floor(Math.random()*13);
      turtles=2+Math.floor(Math.random()*(heads-3));
      cranes=heads-turtles;
      legs=cranes*2+turtles*4;
      key=heads+":"+legs;
    } while(used.has(key)&&++attempts<250);
    used.add(key);
    return {heads,turtles,cranes,legs};
  }
  function render(){
    for(const species of ["crane","turtle"]){
      const element=ui[species];
      element.textContent=answers[species]||"？";
      element.classList.toggle("active",active===species);
      element.classList.toggle("empty",!answers[species]);
      element.setAttribute("aria-pressed",String(active===species));
    }
    ui.submit.disabled=locked||!answers.crane||!answers.turtle;
  }
  function nextProblem(){
    if(complete)return;
    problem=createProblem();
    answers={crane:"",turtle:""};active="crane";locked=false;
    ui.heads.textContent=problem.heads;
    ui.legs.textContent=problem.legs;
    ui.feedback.textContent="つるは あしが2ほん、かめは4ほん。";
    ui.feedback.className="feedback";
    ui.hint.hidden=true;
    ui.hintButton.textContent="💡 ヒントを みる";
    ui.hintButton.setAttribute("aria-expanded","false");
    ui.hint.textContent="もし ぜんぶ つるなら、あしは "+(problem.heads*2)+
      "ほん。ほんとうは "+problem.legs+
      "ほん。かめ 1ひき につき、あしが 2ほん ふえるよ。";
    render();clearScratch();
  }
  function select(species){if(!locked){active=species;render();}}
  function digit(value){
    if(locked||!/^\d$/.test(value))return;
    if(answers[active].length>=2||(answers[active]===""&&value==="0"))return;
    answers[active]+=value;render();
  }
  function erase(){if(!locked){answers[active]=answers[active].slice(0,-1);render();}}
  function clear(){if(!locked){answers[active]="";render();}}
  function reward(){
    if(complete)return;
    complete=true;
    sessionStorage.setItem(TOKEN,String(Date.now())+"-"+String(Math.random()));
    ui.panel.hidden=false;
    window.location.replace("game-menu.html");
  }
  function submit(){
    if(locked||complete||!problem||!answers.crane||!answers.turtle)return;
    if(Number(answers.crane)===problem.cranes&&Number(answers.turtle)===problem.turtles){
      locked=true;correct++;ui.count.textContent=String(correct);
      ui.feedback.textContent=correct===GOAL
        ?"5もん せいかい！ ごほうびゲームへ！ 🎉"
        :"せいかい！ やったね！ ⭐";
      ui.feedback.className="feedback good";
      ui.submit.disabled=true;
      if(correct===GOAL) {
        ui.panel.hidden=false;
        window.setTimeout(reward,950);
      } else window.setTimeout(nextProblem,800);
    } else {
      // Wrong answers neither increment the score nor change the problem.
      ui.feedback.textContent="もういちど！ あたま と あしの かずを かくにん しよう。";
      ui.feedback.className="feedback bad";
    }
  }
  ui.crane.addEventListener("click",()=>select("crane"));
  ui.turtle.addEventListener("click",()=>select("turtle"));
  document.querySelectorAll("[data-digit]").forEach(b=>{
    b.addEventListener("click",()=>digit(b.dataset.digit));
  });
  ui.erase.addEventListener("click",erase);
  ui.clear.addEventListener("click",clear);
  ui.submit.addEventListener("click",submit);
  ui.hintButton.addEventListener("click",()=>{
    ui.hint.hidden=!ui.hint.hidden;
    const expanded=!ui.hint.hidden;
    ui.hintButton.textContent=expanded?"💡 ヒントを とじる":"💡 ヒントを みる";
    ui.hintButton.setAttribute("aria-expanded",String(expanded));
  });
  window.addEventListener("keydown",e=>{
    if(e.key>="0"&&e.key<="9")digit(e.key);
    else if(e.key==="Backspace")erase();
    else if(e.key==="ArrowLeft")select("crane");
    else if(e.key==="ArrowRight")select("turtle");
    else if(e.key==="Enter")submit();
  });

  const canvas=ui.canvas,ctx=canvas.getContext("2d");
  let pointer=null;
  function resize(){
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(r.width*dpr);
    canvas.height=Math.round(r.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineWidth=4;ctx.lineCap="round";ctx.lineJoin="round";
    ctx.strokeStyle="#294b70";
  }
  function clearScratch(){ctx.clearRect(0,0,canvas.width,canvas.height);}
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  canvas.addEventListener("pointerdown",e=>{
    if(pointer!==null)return;
    pointer=e.pointerId;canvas.setPointerCapture(pointer);
    const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x+.01,p.y+.01);ctx.stroke();
  });
  canvas.addEventListener("pointermove",e=>{
    if(pointer!==e.pointerId)return;
    const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();
  });
  const stop=e=>{
    if(pointer!==e.pointerId)return;
    pointer=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener("pointerup",stop);
  canvas.addEventListener("pointercancel",stop);
  ui.clearCanvas.addEventListener("click",clearScratch);
  window.addEventListener("resize",resize);
  window.addEventListener("pageshow",e=>{
    if(e.persisted&&complete)window.location.replace("learn.html");
  });

  // Every lesson starts without a previously unused reward.
  sessionStorage.removeItem(TOKEN);
  ui.count.textContent="0";
  resize();
  nextProblem();
})();
