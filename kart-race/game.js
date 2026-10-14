import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import {buildCircuit,sampleAt,projectOnCircuit,CIRCUIT_LENGTH,ROAD_WIDTH,modulus} from "./track.js?v=1";
import {Controls} from "./controls.js?v=1";

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const raceDistance=CIRCUIT_LENGTH*3;
const rivalStyles=[
  {color:0xf9c94f,name:"レモン",speed:32.5},
  {color:0x648cfa,name:"ソラ",speed:34.5},
  {color:0x69cf91,name:"ミント",speed:35.5},
  {color:0xe988c7,name:"ピーチ",speed:36.0},
  {color:0x9e77e9,name:"グレープ",speed:37.0},
];
function createKart(color,isPlayer=false) {
  const root=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.08});
  const darkMat=new THREE.MeshStandardMaterial({color:0x233242,roughness:.8});
  const whiteMat=new THREE.MeshStandardMaterial({color:0xfff3db,roughness:.55});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,.65,3.35),bodyMat);
  body.position.y=.89;root.add(body);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(1.65,.34,1.15),bodyMat);
  hood.position.set(0,1.29,-.86);root.add(hood);
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(1.34,.65,1.3),
    new THREE.MeshStandardMaterial({color:0x8bd8eb,roughness:.25,metalness:.09}));
  canopy.position.set(0,1.63,.25);root.add(canopy);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.43,12,10),whiteMat);
  helmet.position.set(0,1.93,.27);root.add(helmet);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.65,.22,.23),darkMat);
  visor.position.set(0,1.98,-.08);root.add(visor);
  const bumper=new THREE.Mesh(new THREE.BoxGeometry(2.05,.28,.22),darkMat);
  bumper.position.set(0,.7,-1.7);root.add(bumper);
  for(const x of [-1.07,1.07])for(const z of [-1.08,1.1]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.39,12),darkMat);
    wheel.rotation.z=Math.PI/2;wheel.position.set(x,.5,z);root.add(wheel);
  }
  const spoiler=new THREE.Mesh(new THREE.BoxGeometry(2.2,.15,.6),bodyMat);
  spoiler.position.set(0,1.43,1.63);root.add(spoiler);
  if(isPlayer){
    const tailLight=new THREE.Mesh(new THREE.BoxGeometry(.75,.16,.08),
      new THREE.MeshBasicMaterial({color:0xff354c}));
    tailLight.position.set(0,1,1.72);root.add(tailLight);
  }
  return root;
}

class EngineAudio {
  constructor(){this.ctx=null;this.osc=null;this.gain=null;}
  start(){
    try{
      if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.ctx.resume();
      if(!this.osc){
        this.osc=this.ctx.createOscillator();this.gain=this.ctx.createGain();
        const filter=this.ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=450;
        this.osc.type="sawtooth";this.osc.connect(filter).connect(this.gain).connect(this.ctx.destination);
        this.gain.gain.value=.018;this.osc.frequency.value=75;this.osc.start();
      }
      this.gain.gain.setTargetAtTime(.018,this.ctx.currentTime,.06);
    }catch {}
  }
  update(speed) {
    if(this.ctx&&this.osc){
      this.osc.frequency.setTargetAtTime(75+speed*3,this.ctx.currentTime,.09);
    }
  }
  mute(){
    if(this.ctx&&this.gain)this.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.08);
  }
}

class KartRace {
  constructor(){
    this.canvas=document.getElementById("raceCanvas");
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x8fd5ff);
    this.scene.fog=new THREE.Fog(0x9ee4f4,115,330);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x478158,2.45));
    const sun=new THREE.DirectionalLight(0xfff4d2,2.1);sun.position.set(-80,100,40);this.scene.add(sun);
    this.camera=new THREE.PerspectiveCamera(67,1,.1,450);
    const world=buildCircuit(this.scene);this.mapPoints=world.points;
    this.player=createKart(0xf15747,true);this.scene.add(this.player);
    this.rivals=rivalStyles.map((style,index)=>{
      const mesh=createKart(style.color);this.scene.add(mesh);
      return {...style,index,mesh,progress:0,speed:0,lane:0,targetLane:0,finished:false};
    });
    this.input=new Controls(this.canvas,document.getElementById("brakeButton"));
    this.audio=new EngineAudio();
    this.ui={
      ready:document.getElementById("readyPanel"),result:document.getElementById("resultPanel"),
      pause:document.getElementById("pausePanel"),start:document.getElementById("startButton"),
      note:document.getElementById("controlHint"),position:document.getElementById("positionValue"),
      lap:document.getElementById("lapValue"),speed:document.getElementById("speedValue"),
      time:document.getElementById("timeValue"),banner:document.getElementById("banner"),
      resultPlace:document.getElementById("resultPlace"),resultTime:document.getElementById("resultTime"),
      resultMessage:document.getElementById("resultMessage"),best:document.getElementById("bestTime"),
      brake:document.getElementById("brakeButton"),recenter:document.getElementById("recenterButton"),
      minimap:document.getElementById("minimap"),
    };
    this.mapCtx=this.ui.minimap.getContext("2d");
    this.state="ready";this.lastFrame=0;this.elapsed=0;this.speed=0;this.yaw=0;
    this.progress=-32;this.trackS=modulus(this.progress,CIRCUIT_LENGTH);this.trackIndex=null;
    this.offroadTime=0;this.rank=6;this.countdown=3.5;this.hudTimer=0;
    this.bestTime=Number(localStorage.getItem("kartRaceBestTime")||0);
    this.ui.best.textContent=this.bestTime?this.bestTime.toFixed(1)+"びょう":"まだないよ";
    this.placeCars();this.setupEvents();this.resize();this.drawMap();this.updateHud();
    this.camera.position.set(0,17,160);this.camera.lookAt(0,0,100);
    this.tick=this.tick.bind(this);requestAnimationFrame(this.tick);
  }
  setupEvents(){
    window.addEventListener("resize",()=>this.resize());
    this.ui.start.addEventListener("click",()=>this.begin());
    this.ui.recenter.addEventListener("click",()=>{this.input.recenter();this.notify("ハンドルを まんなかに したよ");});
    document.getElementById("returnButton").addEventListener("click",()=>this.goBack());
    document.getElementById("resumeButton").addEventListener("click",()=>{
      this.state=this.wasCounting?"countdown":"running";this.ui.pause.classList.add("hidden");this.lastFrame=performance.now();this.audio.start();
    });
    document.getElementById("pauseButton").addEventListener("click",()=>this.pause());
    document.addEventListener("visibilitychange",()=>{if(document.hidden)this.pause();});
  }
  goBack(){
    window.location.replace("../"+(sessionStorage.getItem("miniGameReturnUrl")||"learn.html"));
  }
  resize(){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.camera.aspect=innerWidth/Math.max(1,innerHeight);this.camera.updateProjectionMatrix();
  }
  placeCars(){
    // Every kart starts behind the same finish line: no teleporting or disconnected tracks.
    this.progress=-32;this.trackIndex=null;this.trackS=modulus(this.progress,CIRCUIT_LENGTH);
    const start=sampleAt(this.progress);
    this.player.position.copy(start.position).addScaledVector(start.right,.75);
    this.yaw=start.yaw;this.player.rotation.y=this.yaw;
    this.speed=17;
    this.rivals.forEach((r,i)=>{
      r.progress=-6-i*4.4;r.speed=23+i*.35;r.finished=false;
      r.lane=i%2===0?-2.2:2.2;r.targetLane=r.lane;
      const p=sampleAt(r.progress);
      r.mesh.position.copy(p.position).addScaledVector(p.right,r.lane);r.mesh.rotation.y=p.yaw;
    });
    const projection=projectOnCircuit(this.player.position);
    this.trackIndex=projection.index;this.trackS=projection.s;
  }
  async begin(){
    if(this.state!=="ready")return;
    this.ui.start.disabled=true;
    // Request permission from the START tap (required by Safari/iOS).
    const enabled=await this.input.enableTilt();
    this.ui.note.textContent=enabled?"スマホを かたむけて ハンドルそうさ":"かたむきが つかえないときは がめんを さゆうに ドラッグ";
    this.placeCars();this.elapsed=0;this.rank=6;this.offroadTime=0;
    this.state="countdown";this.countdown=3.5;
    this.ui.ready.classList.add("hidden");
    this.ui.brake.classList.remove("hidden");
    this.ui.recenter.classList.remove("hidden");
    this.audio.start();this.lastFrame=performance.now();
    this.showBanner("3");
  }
  pause(){
    if(this.state!=="running"&&this.state!=="countdown")return;
    this.wasCounting=this.state==="countdown";this.state="paused";
    this.ui.pause.classList.remove("hidden");this.audio.mute();
  }
  notify(message){
    this.showBanner(message);
    this.noticeUntil=performance.now()+1250;
  }
  showBanner(message){this.ui.banner.textContent=message;this.ui.banner.classList.remove("hidden");}
  clearBanner(){this.ui.banner.classList.add("hidden");}
  update(dt){
    this.elapsed+=dt;
    const steer=this.input.steer;
    const braking=this.input.brake;
    // Automatic throttle, with a meaningful reduction in turning radius while braking.
    const projectionBefore=projectOnCircuit(this.player.position,this.trackIndex);
    const edge=Math.abs(projectionBefore.lateral);
    const offroad=edge>ROAD_WIDTH/2-.5;
    const desired=offroad?Math.min(braking?15:42,17):braking?16:42;
    this.speed+=(desired-this.speed)*(1-Math.exp(-(braking?3.1:offroad?2.4:.73)*dt));
    this.speed=clamp(this.speed,8,44);
    const turnRate=(1.72-this.speed*.015)*(offroad?.82:1);
    this.yaw+=steer*turnRate*dt;
    const fwd=new THREE.Vector3(Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const movement=this.speed*dt;
    this.player.position.addScaledVector(fwd,movement);
    this.player.rotation.y=this.yaw;
    const projected=projectOnCircuit(this.player.position,this.trackIndex);
    let advance=projected.s-this.trackS;
    if(advance>CIRCUIT_LENGTH/2)advance-=CIRCUIT_LENGTH;
    if(advance<-CIRCUIT_LENGTH/2)advance+=CIRCUIT_LENGTH;
    // Localized track projection and forward-progress cap prevent lap-skipping.
    if(projected.squared<=(ROAD_WIDTH/2+5)**2){
      this.progress=clamp(this.progress+clamp(advance,-this.speed*dt-1,this.speed*dt+1),-55,raceDistance);
    }
    this.trackS=projected.s;this.trackIndex=projected.index;
    if(Math.abs(projected.lateral)>ROAD_WIDTH/2+7){
      this.offroadTime+=dt;
      if(this.offroadTime>3.2)this.rescue();
    }else this.offroadTime=0;
    this.rivals.forEach((r)=>this.advanceRival(r,dt));
    this.handleContacts();
    this.rank=1+this.rivals.filter((r)=>r.finished||r.progress>this.progress+.05).length;
    if(this.progress>=raceDistance-.01){this.finish();return;}
    this.moveCamera(dt);
    this.audio.update(this.speed);
    this.hudTimer+=dt;
    if(this.hudTimer>.09){this.hudTimer=0;this.updateHud();this.drawMap();}
    if(this.noticeUntil && performance.now()>this.noticeUntil){this.noticeUntil=0;this.clearBanner();}
  }
  rescue(){
    const at=sampleAt(this.progress);
    this.player.position.copy(at.position);this.yaw=at.yaw;
    this.player.rotation.y=this.yaw;this.speed=13;this.offroadTime=0;
    const projected=projectOnCircuit(this.player.position);
    this.trackIndex=projected.index;this.trackS=projected.s;
    this.elapsed+=2.5;this.notify("コースに もどったよ！ +2.5びょう");
  }
  advanceRival(r,dt){
    if(r.finished)return;
    const here=sampleAt(r.progress),ahead=sampleAt(r.progress+27);
    const turn=Math.acos(clamp(here.tangent.dot(ahead.tangent),-1,1));
    let desired=rivalStyles[r.index].speed;
    desired*=1-.3*clamp(turn/.65,0,1);
    const close=this.rivals.find((other)=>other!==r&&other.progress>r.progress&&other.progress-r.progress<17&&Math.abs(other.lane-r.lane)<2);
    const playerAhead=this.progress>r.progress&&this.progress-r.progress<13&&Math.abs(projectOnCircuit(this.player.position,this.trackIndex).lateral-r.lane)<2;
    if(close||playerAhead){
      const leaderLane=close?close.lane:projectOnCircuit(this.player.position,this.trackIndex).lateral;
      r.targetLane=leaderLane>=0?-2.6:2.6;
      if(close && Math.abs(close.lane-r.lane)<1)desired=Math.min(desired,close.speed+1.5);
    }else if(Math.abs(r.targetLane)>3||Math.sin(this.elapsed*.19+r.index*1.6)>.85)r.targetLane=r.index%2===0?-2.2:2.2;
    r.speed+=(desired-r.speed)*(1-Math.exp(-1.7*dt));
    r.lane+=(r.targetLane-r.lane)*(1-Math.exp(-2.7*dt));
    r.progress=Math.min(raceDistance,r.progress+r.speed*dt);
    if(r.progress>=raceDistance)r.finished=true;
    const p=sampleAt(r.finished?10:r.progress);
    const lane=r.finished?ROAD_WIDTH/2+10+r.index*3:r.lane;
    r.mesh.position.copy(p.position).addScaledVector(p.right,lane);
    r.mesh.position.y=.02+Math.sin(this.elapsed*6+r.index)*.035;
    r.mesh.rotation.y=p.yaw;
  }
  handleContacts(){
    const p=this.player.position;
    for(const rival of this.rivals){
      const dx=p.x-rival.mesh.position.x,dz=p.z-rival.mesh.position.z;
      const dist=Math.hypot(dx,dz);
      if(dist<2.65&&dist>.02){
        const impact=(2.65-dist);
        p.x+=dx/dist*impact*.22;p.z+=dz/dist*impact*.22;
        this.speed=Math.max(10,this.speed-.28);
        if(!rival.finished)rival.speed=Math.max(14,rival.speed-.23);
      }
    }
  }
  moveCamera(dt){
    const forward=new THREE.Vector3(Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const target=this.player.position.clone().addScaledVector(forward,-12);
    target.y=7.9;
    this.camera.position.lerp(target,1-Math.exp(-5*dt));
    const look=this.player.position.clone().addScaledVector(forward,16);look.y=2.1;
    this.camera.lookAt(look);
    this.camera.fov=63+this.speed*.13;this.camera.updateProjectionMatrix();
  }
  updateHud(){
    this.ui.position.textContent=this.rank+" / 6";
    this.ui.lap.textContent=Math.min(3,Math.max(1,Math.floor(Math.max(0,this.progress)/CIRCUIT_LENGTH)+1))+" / 3";
    this.ui.speed.textContent=Math.round(this.speed*3.6);
    this.ui.time.textContent=this.elapsed.toFixed(1);
  }
  drawMap(){
    const ctx=this.mapCtx,canvas=this.ui.minimap;
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    const minX=Math.min(...this.mapPoints.map(p=>p.x)),maxX=Math.max(...this.mapPoints.map(p=>p.x));
    const minZ=Math.min(...this.mapPoints.map(p=>p.z)),maxZ=Math.max(...this.mapPoints.map(p=>p.z));
    const ratio=Math.min((w-20)/(maxX-minX),(h-20)/(maxZ-minZ));
    const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
    const coord=(p)=>[(p.x-centerX)*ratio+w/2,(p.z-centerZ)*ratio+h/2];
    ctx.lineWidth=8;ctx.strokeStyle="#18283bbd";ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();
    this.mapPoints.forEach((p,i)=>{const [x,y]=coord(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.closePath();ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle="#eef3f5";ctx.stroke();
    const [sx,sy]=coord(sampleAt(0).position);ctx.fillStyle="#fff";ctx.fillRect(sx-3,sy-3,6,6);
    this.rivals.forEach(r=>{
      const [x,y]=coord(r.mesh.position);
      ctx.beginPath();ctx.fillStyle="#ffda5c";ctx.arc(x,y,3.3,0,Math.PI*2);ctx.fill();
    });
    const [x,y]=coord(this.player.position);
    ctx.beginPath();ctx.fillStyle="#ff4f51";ctx.strokeStyle="#fff";
    ctx.arc(x,y,5.1,0,Math.PI*2);ctx.fill();ctx.lineWidth=1.5;ctx.stroke();
  }
  finish(){
    if(this.state!=="running")return;
    this.state="finished";this.audio.mute();this.ui.brake.classList.add("hidden");
    this.ui.recenter.classList.add("hidden");this.clearBanner();
    this.updateHud();this.drawMap();
    this.ui.resultPlace.textContent=this.rank+"い / 6だい";
    this.ui.resultTime.textContent=this.elapsed.toFixed(1)+"びょう";
    this.ui.resultMessage.textContent=this.rank===1?"おめでとう！ いちばんはやかったよ！":
      this.rank<=3?"やったね！ つぎは1いを めざそう！":"ゴール！ つぎもがんばろう！";
    if(!this.bestTime||this.elapsed<this.bestTime){
      this.bestTime=this.elapsed;localStorage.setItem("kartRaceBestTime",this.elapsed.toString());
    }
    this.ui.result.classList.remove("hidden");
  }
  tick(now){
    requestAnimationFrame(this.tick);
    const dt=Math.min(.04,Math.max(0,(now-(this.lastFrame||now))/1000));
    this.lastFrame=now;
    if(this.state==="countdown"){
      this.countdown-=dt;
      if(this.countdown<=0){this.state="running";this.showBanner("GO!");this.noticeUntil=performance.now()+1000;}
      else this.showBanner(String(Math.ceil(this.countdown)));
    }else if(this.state==="running")this.update(dt);
    if(this.state==="ready"){
      const point=sampleAt(-32);
      this.camera.position.lerp(new THREE.Vector3(point.position.x-17,12,point.position.z+19),.045);
      this.camera.lookAt(this.player.position.x,1,this.player.position.z);
    }
    this.renderer.render(this.scene,this.camera);
  }
}

const accessKey="miniGameAccess:kart-race";
if(sessionStorage.getItem(accessKey)!=="1"){
  window.location.replace("../"+(sessionStorage.getItem("miniGameReturnUrl")||"learn.html"));
}else{
  sessionStorage.removeItem(accessKey);
  new KartRace();
  window.addEventListener("pageshow",(event)=>{
    if(event.persisted)window.location.replace("../"+(sessionStorage.getItem("miniGameReturnUrl")||"learn.html"));
  });
}
