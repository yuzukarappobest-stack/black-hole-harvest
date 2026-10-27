import {ARENA_RADIUS,PLANETS,PULL_DISTANCE,MAX_SHOTS,makeBodies,launch,
  resetSun,simulateStep,allStill} from "./physics.js?v=1";
import {makeStars,drawScene} from "./render.js?v=1";

const ACCESS_KEY="miniGameAccess:planet-battle";
function learningUrl(){
  const saved=sessionStorage.getItem("miniGameReturnUrl")||"learn.html";
  if(saved.startsWith("/")||saved.includes("://"))return "../learn.html";
  return "../"+saved.replace("./","");
}
class SoundFX{
  constructor(){this.context=null;this.enabled=true;this.lastTime=-1;}
  unlock(){
    if(!this.enabled)return;
    try{
      if(!this.context)this.context=new (window.AudioContext||window.webkitAudioContext)();
      this.context.resume();
    }catch{}
  }
  play(pitch=310){
    if(!this.enabled||!this.context)return;
    try{
      const ctx=this.context,t=ctx.currentTime;
      if(t-this.lastTime<.05)return;
      this.lastTime=t;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="triangle";o.frequency.setValueAtTime(pitch,t);
      o.frequency.exponentialRampToValueAtTime(Math.max(80,pitch*.68),t+.17);
      g.gain.setValueAtTime(.065,t);
      g.gain.exponentialRampToValueAtTime(.0001,t+.19);
      o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.2);
      o.onended=()=>{o.disconnect();g.disconnect();};
    }catch{}
  }
}

class PlanetBattle{
  constructor(){
    this.canvas=document.getElementById("board");
    this.ctx=this.canvas.getContext("2d");
    this.ui={
      start:document.getElementById("startPanel"),
      finish:document.getElementById("finishPanel"),
      knocked:document.getElementById("knocked"),
      shotsLeft:document.getElementById("shotsLeft"),
      shotsUsed:document.getElementById("shotsUsed"),
      status:document.getElementById("liveStatus"),
      sound:document.getElementById("soundButton"),
      resultIcon:document.getElementById("resultIcon"),
      resultTitle:document.getElementById("resultTitle"),
      resultMessage:document.getElementById("resultMessage"),
      resultStats:document.getElementById("resultStats")
    };
    this.state="ready";
    this.bodies=makeBodies();
    this.stars=makeStars();
    this.sound=new SoundFX();
    this.shots=0;
    this.pointerId=null;
    this.aim=null;
    this.particles=[];
    this.view={w:1,h:1,cx:0,cy:0,scale:1};
    this.lastTime=null;
    this.accumulator=0;
    this.shotTime=0;
    this.restTime=0;
    this.bind();
    this.resize();
    this.updateHud();
    requestAnimationFrame(t=>this.frame(t));
  }
  bind(){
    document.getElementById("startButton").addEventListener("click",()=>{
      if(this.state!=="ready")return;
      this.sound.unlock();
      this.state="aim";
      this.ui.start.classList.add("hidden");
      this.status("たいようを タッチして、とばしたい ほうへ スワイプ！");
    });
    document.getElementById("returnButton").addEventListener("click",()=>{
      window.location.replace(learningUrl());
    });
    this.ui.sound.addEventListener("click",()=>{
      this.sound.enabled=!this.sound.enabled;
      this.ui.sound.textContent=this.sound.enabled?"🔊 おと ON":"🔇 おと OFF";
      this.ui.sound.classList.toggle("muted",!this.sound.enabled);
      this.ui.sound.setAttribute("aria-pressed",String(this.sound.enabled));
      if(this.sound.enabled)this.sound.unlock();
    });
    this.canvas.addEventListener("pointerdown",e=>this.pointerDown(e));
    this.canvas.addEventListener("pointermove",e=>this.pointerMove(e));
    this.canvas.addEventListener("pointerup",e=>this.pointerUp(e));
    this.canvas.addEventListener("pointercancel",e=>this.cancelPointer(e));
    window.addEventListener("resize",()=>this.resize());
    document.addEventListener("visibilitychange",()=>{this.lastTime=null;});
  }
  status(s){this.ui.status.textContent=s;}
  knocked(){return this.bodies.slice(1).filter(b=>b.fallen).length;}
  updateHud(){
    this.ui.knocked.textContent=String(this.knocked());
    this.ui.shotsLeft.textContent=String(Math.max(0,MAX_SHOTS-this.shots));
    this.ui.shotsUsed.textContent=String(this.shots);
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect();
    if(rect.width<5||rect.height<5)return;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    this.canvas.width=Math.round(rect.width*ratio);
    this.canvas.height=Math.round(rect.height*ratio);
    this.ctx.setTransform(ratio,0,0,ratio,0,0);
    this.view={w:rect.width,h:rect.height,
      cx:rect.width/2,cy:rect.height/2,
      scale:Math.max(.14,(Math.min(rect.width,rect.height)-28)/(2*(ARENA_RADIUS+23)))};
  }
  eventToWorld(event){
    const rect=this.canvas.getBoundingClientRect(),v=this.view;
    return {x:(event.clientX-rect.left-v.cx)/v.scale,
      y:(event.clientY-rect.top-v.cy)/v.scale};
  }
  pointerDown(event){
    if(this.state!=="aim"||this.pointerId!==null)return;
    const p=this.eventToWorld(event),sun=this.bodies[0];
    if(Math.hypot(p.x-sun.x,p.y-sun.y)>sun.radius+30){
      this.status("きいろい たいようを タッチしよう！");
      return;
    }
    event.preventDefault();
    this.pointerId=event.pointerId;
    this.aim={dx:0,dy:0};
    this.canvas.setPointerCapture(event.pointerId);
    this.pointerMove(event);
  }
  pointerMove(event){
    if(this.state!=="aim"||event.pointerId!==this.pointerId)return;
    event.preventDefault();
    const p=this.eventToWorld(event),sun=this.bodies[0];
    let dx=p.x-sun.x,dy=p.y-sun.y;
    const length=Math.hypot(dx,dy);
    if(length>PULL_DISTANCE){
      dx*=PULL_DISTANCE/length;dy*=PULL_DISTANCE/length;
    }
    this.aim={dx,dy};
    this.status(length<12?"すすむ ほうへ スワイプ！":
      "パワー "+Math.round(100*Math.min(1,length/PULL_DISTANCE))+"％　ゆびを はなそう！");
  }
  ungrab(){
    if(this.pointerId===null)return;
    try{
      if(this.canvas.hasPointerCapture(this.pointerId))
        this.canvas.releasePointerCapture(this.pointerId);
    }catch{}
    this.pointerId=null;
  }
  pointerUp(event){
    if(event.pointerId!==this.pointerId)return;
    event.preventDefault();
    const aim=this.aim;
    this.ungrab();
    this.aim=null;
    if(!aim||!launch(this.bodies[0],aim.dx,aim.dy)){
      this.status("もうすこし ながく スワイプしてみよう！");
      return;
    }
    this.shots++;
    this.shotTime=0;this.restTime=0;this.accumulator=0;
    this.state="moving";
    this.sound.play(510);
    this.updateHud();
    this.status("いけー！ たいよう！ ☀️💨");
  }
  cancelPointer(event){
    if(event.pointerId!==this.pointerId)return;
    this.ungrab();this.aim=null;
    this.status("たいようを タッチして もういちど！");
  }
  particlesAt(x,y,color,count){
    for(let i=0;i<count;i++){
      const theta=Math.PI*2*i/count+Math.random()*.25;
      const velocity=32+Math.random()*112;
      this.particles.push({
        x,y,vx:Math.cos(theta)*velocity,vy:Math.sin(theta)*velocity,
        age:0,life:.3+Math.random()*.45,size:1.4+Math.random()*4,color
      });
    }
    if(this.particles.length>120)this.particles.splice(0,this.particles.length-120);
  }
  hit(a,b,speed){
    if(speed<30)return;
    this.particlesAt((a.x+b.x)/2,(a.y+b.y)/2,"#fff4b9",
      Math.min(8,Math.round(speed/90)+3));
    this.sound.play(190+Math.min(440,speed*.7));
  }
  fall(b){
    this.particlesAt(b.x,b.y,b.type==="sun"?"#ffd876":b.accent,15);
    if(b.type==="planet"){
      this.sound.play(690);
      this.status(b.name+"を おとした！ "+this.knocked()+" / 8 🌟");
    }else this.status("たいようも おちた！ つぎの ショットで もういちど！");
    this.updateHud();
  }
  advance(dt){
    if(this.state==="moving"){
      this.shotTime+=dt;
      this.accumulator+=dt;
      const fixed=1/120;
      let loops=0;
      while(this.accumulator>=fixed&&loops<12){
        simulateStep(this.bodies,fixed,
          (a,b,speed)=>this.hit(a,b,speed),b=>this.fall(b));
        this.accumulator-=fixed;
        loops++;
      }
      if(loops===12)this.accumulator=0;
      if(allStill(this.bodies))this.restTime+=dt;
      else this.restTime=0;
      if((this.shotTime>.4&&this.restTime>.32)||this.shotTime>7)
        this.endShot();
    }
    this.particles=this.particles.filter(p=>{
      p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
      const damp=Math.exp(-2*dt);
      p.vx*=damp;p.vy*=damp;
      return p.age<p.life;
    });
  }
  endShot(){
    if(this.state!=="moving")return;
    for(const b of this.bodies){
      b.vx=0;b.vy=0;
      // Fallen balls should not remain as half-transparent ghosts on
      // the rim once the next aiming turn begins.
      if(b.fallen)b.fallTime=Math.max(b.fallTime,.71);
    }
    if(this.knocked()===PLANETS.length){this.finish(true);return;}
    if(this.shots>=MAX_SHOTS){this.finish(false);return;}
    resetSun(this.bodies);
    this.state="aim";
    this.status("のこり "+(MAX_SHOTS-this.shots)+"かい！ つぎは どこを ねらう？");
  }
  finish(won){
    this.state="finished";
    this.ui.resultIcon.textContent=won?"🏆 ☀️":"🪐 ✨";
    this.ui.resultTitle.textContent=won?"たいようの かち！":"バトル しゅうりょう！";
    this.ui.resultMessage.textContent=won?
      "8この わくせいを ぜんぶ おとしたよ！":
      this.knocked()+"この わくせいを おとした！ がんばったね！";
    this.ui.resultStats.textContent="ショット "+this.shots+"かい / "+MAX_SHOTS+"かい";
    this.ui.finish.classList.remove("hidden");
    this.status(won?"ぜんぶ おとした！ おめでとう！":"また ちょうせん しよう！");
  }
  frame(time){
    const dt=this.lastTime===null?0:Math.max(0,Math.min(.05,(time-this.lastTime)/1000));
    this.lastTime=time;
    if(!document.hidden)this.advance(dt);
    drawScene(this.ctx,this.view,this.bodies,this.aim,this.stars,this.particles,time/1000);
    requestAnimationFrame(t=>this.frame(t));
  }
}

// The existing reward selector grants exactly one access flag. Consume it
// when opening the game, so a direct URL or reload never grants extra play.
if(sessionStorage.getItem(ACCESS_KEY)!=="1"){
  window.location.replace(learningUrl());
}else{
  sessionStorage.removeItem(ACCESS_KEY);
  new PlanetBattle();
  window.addEventListener("pageshow",event=>{
    if(event.persisted)window.location.replace(learningUrl());
  });
}
