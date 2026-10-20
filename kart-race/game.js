import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import {buildCircuit,sampleAt,projectOnCircuit,CIRCUIT_LENGTH,ROAD_WIDTH,GRASS_MARGIN,RAIL_OFFSET,COURSE_ID,COURSE_NAME,JUMP_ZONES,modulus,isJumpGap,getJumpLaunch} from "./track.js?v=9";
import {initVertical,advanceVertical} from "./vertical.js?v=1";
import {initializeCheckpoints,updateCheckpointProgress} from "./checkpoints.js?v=2";
import {constrainToGuardrail} from "./barriers.js?v=1";
import {stepKart} from "./driving.js?v=3";
import {Controls} from "./controls.js?v=4";
import {createDashPickups,resetDashPickups,updateDashPickups} from "./items.js?v=7";
import {RaceMusic} from "./music.js?v=1";

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const raceDistance=CIRCUIT_LENGTH*3;
const rivalStyles=[
  {color:0xf9c94f,name:"レモン",speed:35.8},
  {color:0x648cfa,name:"ソラ",speed:37.3},
  {color:0x69cf91,name:"ミント",speed:38.4},
  // Crystal course only: one CPU matches the player's normal 42-speed cap.
  // Sunset and Green retain their original Peach tuning.
  {color:0xe988c7,name:COURSE_ID===3?"エース":"ピーチ",
   speed:COURSE_ID===3?42:39.6,turnSlowdown:COURSE_ID===3?0:.15},
  // Crystal's King is now visibly faster (46 vs the player's 42).
  // A 10% peak corner slowdown preserves a small opportunity to win by
  // collecting and deploying the six available boosts on straights.
  // Course 1 and 2 keep their exact previous speed/turning specifications.
  {color:0x9e77e9,name:COURSE_ID===1?"グレープ":COURSE_ID===3?"キング":"チャンピオン",
   speed:COURSE_ID===3?46:COURSE_ID===2?42:40.8,
   turnSlowdown:COURSE_ID===3?.10:COURSE_ID===1?.15:0},
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
  unlock(){
    try{
      if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.ctx.resume();
    }catch {}
  }
  start(){
    try{
      this.unlock();
      if(!this.ctx)return;
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
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(COURSE_ID===4?0xa0d7ff:COURSE_ID===3?0x91b2e2:COURSE_ID===2?0xffcca7:0x8fd5ff);
    this.scene.fog=new THREE.Fog(COURSE_ID===4?0xb6dbea:COURSE_ID===3?0xb7d8ec:COURSE_ID===2?0xffd6b8:0x9ee4f4,
      COURSE_ID===4?145:115,COURSE_ID===4?490:330);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x478158,2.45));
    const sun=new THREE.DirectionalLight(0xfff4d2,2.1);sun.position.set(-80,100,40);this.scene.add(sun);
    this.camera=new THREE.PerspectiveCamera(67,1,.1,450);
    const world=buildCircuit(this.scene);this.mapPoints=world.points;
    this.player=createKart(0xf15747,true);this.scene.add(this.player);
    this.dashItems=createDashPickups(this.scene);
    this.dashFlames=[];
    const flameMaterial=new THREE.MeshBasicMaterial({
      color:0x64dcff,transparent:true,opacity:.83,depthWrite:false
    });
    for(const x of [-.55,.55]){
      const flame=new THREE.Mesh(new THREE.ConeGeometry(.35,1.55,8),flameMaterial);
      flame.rotation.x=Math.PI/2;flame.position.set(x,.84,2.25);
      flame.visible=false;this.player.add(flame);this.dashFlames.push(flame);
    }
    this.rivals=rivalStyles.map((style,index)=>{
      const mesh=createKart(style.color);this.scene.add(mesh);
      return {...style,index,mesh,progress:0,speed:0,lane:0,targetLane:0,finished:false};
    });
    document.getElementById("courseTitle").textContent=COURSE_NAME;
    document.getElementById("courseDescription").textContent=COURSE_ID===4
      ?"やまを のぼって たにを ジャンプ！ そらまで とぼう！"
      :COURSE_ID===3?"エースは42！ キングは46！ ダッシュで ちょうせん！"
      :COURSE_ID===2?"はやい チャンピオンと 3しゅう しょうぶ！"
      :"CPU 5だい と 3しゅう しょうぶ！";
    this.input=new Controls(this.canvas);
    this.audio=new EngineAudio();
    this.music=new RaceMusic();
    this.ui={
      ready:document.getElementById("readyPanel"),result:document.getElementById("resultPanel"),
      pause:document.getElementById("pausePanel"),start:document.getElementById("startButton"),
      note:document.getElementById("controlHint"),position:document.getElementById("positionValue"),
      lap:document.getElementById("lapValue"),speed:document.getElementById("speedValue"),
      time:document.getElementById("timeValue"),banner:document.getElementById("banner"),
      resultPlace:document.getElementById("resultPlace"),resultTime:document.getElementById("resultTime"),
      resultMessage:document.getElementById("resultMessage"),best:document.getElementById("bestTime"),
      dash:document.getElementById("dashButton"),
      dashLabel:document.getElementById("dashLabel"),
      dashCount:document.getElementById("dashCount"),
      recovery:document.getElementById("recoveryButton"),
      recenter:document.getElementById("recenterButton"),
      music:document.getElementById("musicButton"),
      minimap:document.getElementById("minimap"),
    };
    this.mapCtx=this.ui.minimap.getContext("2d");
    this.state="ready";this.lastFrame=0;this.elapsed=0;this.speed=0;this.yaw=0;
    this.progress=-32;this.lane=.75;
    this.vehicle={x:0,z:0,yaw:0,speed:17,steering:0};
    this.trackIndex=null;this.trackS=0;this.cameraTarget=new THREE.Vector3();
    this.offroadTime=0;this.roadDistanceSquared=0;this.lastRailImpact=-Infinity;this.gatesPassed=0;
    this.falling=false;this.fallTimer=0;this.fallStartHeight=0;
    this.rank=6;this.countdown=3.5;this.hudTimer=0;
    this.dashCharges=0;this.maxDashCharges=2;this.boostTime=0;
    this.bestTimeKey=COURSE_ID===4?"kartRaceBestTime4"
      :COURSE_ID===3?"kartRaceBestTime3"
      :COURSE_ID===2?"kartRaceBestTime2":"kartRaceBestTime";
    this.bestTime=Number(localStorage.getItem(this.bestTimeKey)||0);
    this.ui.best.textContent=this.bestTime?this.bestTime.toFixed(1)+"びょう":"まだないよ";
    this.placeCars();this.setupEvents();this.resize();this.drawMap();this.updateHud();this.updateDashButton();
    this.updateMusicButton();
    this.camera.position.set(0,17,160);this.camera.lookAt(0,0,100);
    this.tick=this.tick.bind(this);requestAnimationFrame(this.tick);
  }
  setupEvents(){
    window.addEventListener("resize",()=>this.resize());
    this.ui.start.addEventListener("click",()=>this.begin());
    this.ui.dash.addEventListener("click",()=>this.activateDash());
    this.ui.music.addEventListener("click",()=>{
      this.music.setEnabled(!this.music.enabled);
      this.updateMusicButton();
      this.music.update();
    });
    this.ui.recovery.addEventListener("click",()=>{
      if(COURSE_ID!==4&&this.state==="running"&&this.offroadTime>=3){
        this.rescue();
        this.ui.recovery.classList.add("hidden");
      }
    });
    this.ui.recenter.addEventListener("click",()=>{this.input.recenter();this.notify("ハンドルを まんなかに したよ");});
    document.getElementById("returnButton").addEventListener("click",()=>this.goBack());
    document.getElementById("resumeButton").addEventListener("click",()=>{
      this.audio.unlock(); // iPad requires resumed audio inside the tap handler.
      this.state=this.wasCounting?"countdown":"running";
      this.ui.pause.classList.add("hidden");
      this.ui.recovery.classList.toggle("hidden",this.offroadTime<3);
      this.lastFrame=performance.now();
      this.audio.start();
      if(this.state==="running")this.music.start(this.audio.ctx);
    });
    document.getElementById("pauseButton").addEventListener("click",()=>this.pause());
    document.addEventListener("visibilitychange",()=>{if(document.hidden)this.pause();});
  }
  goBack(){
    this.music.stop();
    this.audio.mute();
    window.location.replace("../"+(sessionStorage.getItem("miniGameReturnUrl")||"learn.html"));
  }
  resize(){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.camera.aspect=innerWidth/Math.max(1,innerHeight);this.camera.updateProjectionMatrix();
  }
  placeCars(){
    // The kart starts behind the line, but drives in world coordinates after START.
    this.progress=-32;this.lane=.75;
    initializeCheckpoints(this,CIRCUIT_LENGTH,-32);
    this.lastRailImpact=-Infinity;
    this.roadDistanceSquared=0;this.offroadTime=0;
    this.falling=false;this.fallTimer=0;
    this.ui.recovery.classList.add("hidden");
    this.dashCharges=0;this.boostTime=0;
    resetDashPickups(this.dashItems);
    this.dashFlames.forEach(flame=>{flame.visible=false;});
    this.input.clearDashRequest();
    const start=sampleAt(this.progress);
    this.vehicle={
      x:start.position.x+start.right.x*this.lane,
      z:start.position.z+start.right.z*this.lane,
      yaw:start.yaw,speed:17,steering:0,
    };
    if(COURSE_ID===4)initVertical(this.vehicle,start.position.y);
    this.player.position.set(this.vehicle.x,
      COURSE_ID===4?this.vehicle.height:.02,this.vehicle.z);
    // Three.js local forward is -Z, so mesh yaw is the negative of travel yaw.
    this.yaw=this.vehicle.yaw;this.player.rotation.set(0,-this.yaw,0);
    const near=projectOnCircuit(this.player.position);
    this.trackIndex=near.index;this.trackS=near.s;
    const startingLanes=[-6,-3,0,3,6];
    this.rivals.forEach((r,i)=>{
      r.progress=-6-i*4.4;r.speed=23+i*.35;r.finished=false;
      r.lane=startingLanes[i];r.targetLane=r.lane;r.homeLane=r.lane;r.lastContactAt=-Infinity;
      const p=sampleAt(r.progress);
      if(COURSE_ID===4)initVertical(r,p.position.y);
      r.mesh.position.copy(p.position).addScaledVector(p.right,r.lane);
      r.mesh.position.y=COURSE_ID===4?r.height:r.mesh.position.y;
      if(COURSE_ID===4)r.mesh.rotation.set(p.pitch,-p.yaw,0,"YXZ");
      else r.mesh.rotation.y=-p.yaw;
    });
    const fwd=new THREE.Vector3(Math.sin(this.yaw),0,-Math.cos(this.yaw));
    this.camera.position.copy(this.player.position).addScaledVector(fwd,-12);
    this.camera.position.y=(COURSE_ID===4?this.player.position.y:0)+7.5;
    this.cameraTarget.copy(this.player.position).addScaledVector(fwd,17);
    this.cameraTarget.y=(COURSE_ID===4?this.player.position.y:0)+2.1;
    this.camera.lookAt(this.cameraTarget);
  }
  async begin(){
    if(this.state!=="ready")return;
    this.ui.start.disabled=true;
    // iPad Safari: unlock the Web Audio context BEFORE the orientation
    // permission await, while we still have a direct tap gesture.
    this.audio.unlock();
    // Request permission from the START tap (required by Safari/iOS).
    const enabled=await this.input.enableTilt();
    this.ui.note.textContent=enabled?"スマホを かたむけて ハンドルそうさ":"かたむきが つかえないときは がめんを さゆうに ドラッグ";
    this.placeCars();this.elapsed=0;this.rank=6;this.offroadTime=0;
    this.state="countdown";this.countdown=3.5;
    this.ui.ready.classList.add("hidden");
    this.ui.dash.classList.remove("hidden");
    this.updateDashButton();
    this.ui.recenter.classList.remove("hidden");
    this.audio.start();this.lastFrame=performance.now();
    this.showBanner("3");
  }
  pause(){
    if(this.state!=="running"&&this.state!=="countdown")return;
    this.wasCounting=this.state==="countdown";this.state="paused";
    this.ui.pause.classList.remove("hidden");this.ui.recovery.classList.add("hidden");
    this.audio.mute();
    this.music.pause();
  }
  updateMusicButton(){
    this.ui.music.textContent=this.music.enabled?"♫ BGM ON":"♫ BGM OFF";
    this.ui.music.setAttribute("aria-pressed",String(this.music.enabled));
    this.ui.music.classList.toggle("is-muted",!this.music.enabled);
  }
  notify(message){
    this.showBanner(message);
    this.noticeUntil=performance.now()+1250;
  }
  updateDashButton(){
    const boosting=this.boostTime>0;
    const ready=this.state==="running"&&this.dashCharges>0&&!boosting;
    this.ui.dash.disabled=!ready;
    this.ui.dash.classList.toggle("charged",ready);
    this.ui.dash.classList.toggle("boosting",boosting);
    this.ui.dashLabel.textContent=boosting?"ダッシュ中":"ダッシュ";
    this.ui.dashCount.textContent="×"+this.dashCharges;
  }
  collectDashItem(){
    if(this.state!=="running"||this.dashCharges>=this.maxDashCharges)return false;
    this.dashCharges++;
    this.notify("⚡ ダッシュ +1");
    this.updateDashButton();
    return true;
  }
  activateDash(){
    if(this.state!=="running"||this.boostTime>0||this.dashCharges<=0)return false;
    this.dashCharges--;
    this.boostTime=2.8;
    this.vehicle.speed=Math.max(this.vehicle.speed,49);
    this.dashFlames.forEach(flame=>{flame.visible=true;});
    this.notify("DASH!");
    this.updateDashButton();
    return true;
  }
  showBanner(message){this.ui.banner.textContent=message;this.ui.banner.classList.remove("hidden");}
  clearBanner(){this.ui.banner.classList.add("hidden");}
  startMountainFall(){
    if(COURSE_ID!==4||this.falling)return;
    this.falling=true;
    this.fallTimer=0;
    this.fallStartHeight=this.vehicle.height;
    this.vehicle.verticalSpeed=0;
    this.vehicle.speed=0;
    this.speed=0;
    this.boostTime=0;
    this.input.clearDashRequest();
    this.dashFlames.forEach(flame=>{flame.visible=false;});
    this.updateDashButton();
    this.ui.recovery.classList.add("hidden");
    this.notify("おっこちた！ 3びょうで もどるよ");
  }
  recoverMountain(){
    // Rewind to a confirmed part of the CURRENT sector, not ahead of
    // an unchecked gate. This prevents farming shortcuts or getting stuck.
    const sector=CIRCUIT_LENGTH/18;
    let safe=this.gatesPassed===0?-32:
      (this.gatesPassed-1)*sector+Math.min(12,sector*.12);
    const gap=JUMP_ZONES.find(zone=>zone.gap);
    if(gap){
      const lap=Math.floor(Math.max(0,safe)/CIRCUIT_LENGTH);
      const local=modulus(safe,CIRCUIT_LENGTH);
      if(local>=gap.start-40&&local<=gap.end+12){
        // Give the kart a long enough acceleration run-up on retry.
        safe=lap*CIRCUIT_LENGTH+gap.start-85;
      }
    }
    const p=sampleAt(safe);
    this.vehicle.x=p.position.x;
    this.vehicle.z=p.position.z;
    this.vehicle.yaw=p.yaw;
    this.vehicle.steering=0;
    this.vehicle.speed=12;
    initVertical(this.vehicle,p.position.y);
    this.player.position.set(this.vehicle.x,this.vehicle.height,this.vehicle.z);
    this.player.rotation.set(p.pitch,-p.yaw,0,"YXZ");
    this.yaw=p.yaw;this.speed=12;this.lane=0;
    this.progress=safe;
    this.gatesPassed=Math.max(0,Math.floor(safe/sector)+1);
    this.trackS=modulus(safe,CIRCUIT_LENGTH);
    this.trackIndex=null;
    this.projectionMisses=0;this.roadDistanceSquared=0;this.offroadTime=0;
    this.falling=false;this.fallTimer=0;
    this.lastRailImpact=-Infinity;
    const fwd=new THREE.Vector3(Math.sin(p.yaw),0,-Math.cos(p.yaw));
    this.camera.position.copy(this.player.position).addScaledVector(fwd,-12);
    this.camera.position.y=this.player.position.y+7.5;
    this.cameraTarget.copy(this.player.position).addScaledVector(fwd,17);
    this.cameraTarget.y=this.player.position.y+2.1;
    this.camera.lookAt(this.cameraTarget);
    this.ui.recovery.classList.add("hidden");
    this.updateDashButton();
    this.notify("コースに もどったよ！");
  }
  update(dt){
    this.elapsed+=dt;
    if(COURSE_ID===4&&this.falling){
      // Three seconds of visibly falling; CPU keeps racing.
      this.fallTimer+=dt;
      this.vehicle.height=this.fallStartHeight-16*this.fallTimer*this.fallTimer;
      this.player.position.y=this.vehicle.height;
      this.rivals.forEach(r=>this.advanceRival(r,dt));
      if(this.fallTimer>=3)this.recoverMountain();
      this.rank=1+this.rivals.filter(r=>r.finished||r.progress>this.progress+.05).length;
      this.moveCamera(dt);this.updateHud();this.drawMap();
      return;
    }
    if(this.input.consumeDashRequest())this.activateDash();
    const steer=clamp(this.input.steer,-1,1);
    const previousPosition={x:this.vehicle.x,z:this.vehicle.z};
    const boosting=this.boostTime>0;
    // Use the closest point on the full circuit for road/grass classification.
    // The local lap projection can lag or jump and is not reliable here.
    const offroad=this.roadDistanceSquared>(ROAD_WIDTH/2-.5)**2;

    // Unlike the prior on-rails implementation, no spline direction is applied to the driver.
    stepKart(this.vehicle,{dt,steer,offroad,boost:boosting});
    if(boosting){
      this.boostTime=Math.max(0,this.boostTime-dt);
      this.dashFlames.forEach((flame,index)=>{
        flame.visible=this.boostTime>0;
        flame.scale.y=.85+.21*Math.sin(this.elapsed*24+index*2);
      });
      if(this.boostTime===0)this.updateDashButton();
    }
    this.speed=this.vehicle.speed;this.yaw=this.vehicle.yaw;
    this.player.position.set(this.vehicle.x,
      COURSE_ID===4?this.vehicle.height:.02+Math.sin(this.elapsed*13)*.018,
      this.vehicle.z);
    this.player.rotation.set(0,-this.yaw,-clamp(this.vehicle.steering*.085,-.10,.10));

    this.rivals.forEach((r)=>this.advanceRival(r,dt));
    this.handleContacts();

    // Guardrails are a real collision boundary, not merely decoration.
    // Allow a 5.5m grass shoulder beyond the 22m tarmac, then prevent crossing.
    const beforeRail=projectOnCircuit(this.player.position);
    // The gorge is open air; no invisible rails across the missing road.
    const impacted=COURSE_ID===4?false
      :constrainToGuardrail(this.vehicle,beforeRail.center,RAIL_OFFSET-1.05);
    if(impacted){
      this.player.position.x=this.vehicle.x;
      this.player.position.z=this.vehicle.z;
      if(this.elapsed-this.lastRailImpact>.65){
        this.vehicle.speed=Math.max(15,this.vehicle.speed-1.2);
        this.speed=this.vehicle.speed;
        this.lastRailImpact=this.elapsed;
      }
    }

    // Progress is gated by ACTUAL ordered crossings of 18 physical sectors.
    // Moving to a distant road or crossing grass cannot increment the lap.
    const globalRoad=projectOnCircuit(this.player.position);
    if(COURSE_ID===4){
      const road=sampleAt(globalRoad.s);
      const launchVelocity=getJumpLaunch(this.trackS,globalRoad.s,this.speed,dt,globalRoad.lateral);
      const vertical=advanceVertical(this.vehicle,{
        dt,roadHeight:road.position.y,
        overRoad:!isJumpGap(globalRoad.s)&&globalRoad.squared<(RAIL_OFFSET-1)**2,
        launchVelocity
      });
      this.player.position.y=this.vehicle.height;
      const pitch=this.vehicle.airborne
        ?Math.atan2(this.vehicle.verticalSpeed,Math.max(1,this.vehicle.speed))*.65
        :road.pitch;
      this.player.rotation.set(pitch,-this.yaw,
        -clamp(this.vehicle.steering*.085,-.10,.10),"YXZ");
      if(vertical.launched)this.notify("JUMP!");
      // A real offroad drop: never allow the kart to drive on imaginary
      // horizontal surfaces outside the elevated pavement. The open canyon
      // is only valid while aligned with the intended jumping corridor.
      const leftRoad=globalRoad.squared>(ROAD_WIDTH/2+.8)**2;
      const belowDeck=this.vehicle.airborne&&!isJumpGap(globalRoad.s)
        &&this.vehicle.height<road.position.y-3;
      if(leftRoad||belowDeck||vertical.failed){
        this.startMountainFall();
        this.moveCamera(dt);this.updateHud();this.drawMap();
        return;
      }
    }
    const checkpointResult=updateCheckpointProgress(this,previousPosition,this.player.position,globalRoad,sampleAt,{
      length:CIRCUIT_LENGTH,roadWidth:ROAD_WIDTH,grassMargin:GRASS_MARGIN,
      finishLaps:3,speed:this.speed,dt
    });
    this.trackIndex=globalRoad.index;
    this.trackS=globalRoad.s;
    this.lane=globalRoad.lateral;
    this.roadDistanceSquared=globalRoad.squared;
    // Never teleport automatically: it was interrupting races even when the
    // driver appeared to be on the road. Offer recovery only after truly
    // driving far onto the grass, and only when the player asks for it.
    if(this.roadDistanceSquared>(ROAD_WIDTH/2+11)**2){
      this.offroadTime+=dt;
    }else this.offroadTime=0;
    this.ui.recovery.classList.toggle("hidden",
      COURSE_ID===4||this.offroadTime<3);
    const currentLap=Math.min(2,Math.floor(Math.max(0,this.progress)/CIRCUIT_LENGTH));
    updateDashPickups(
      this.dashItems,this.player.position,this.elapsed,dt,currentLap,
      ()=>this.collectDashItem()
    );
    this.rank=1+this.rivals.filter((r)=>r.finished||r.progress>this.progress+.05).length;
    // Finishing must be caused by crossing the third finish line, not
    // a rounded or projected progress value just before that line.
    if(checkpointResult.finished){this.finish();return;}
    this.moveCamera(dt);this.audio.update(this.speed);
    this.hudTimer+=dt;
    if(this.hudTimer>.09){this.hudTimer=0;this.updateHud();this.drawMap();}
    if(this.noticeUntil && performance.now()>this.noticeUntil){this.noticeUntil=0;this.clearBanner();}
  }
  rescue(){
    // Recover a failed mountain jump BEFORE its lip, not in midair.
    let rescueProgress=this.progress;
    if(COURSE_ID===4&&this.vehicle.failedJump){
      const near=projectOnCircuit(this.player.position);
      const jumpStartDistance=CIRCUIT_LENGTH*.275;
      const gapS=isJumpGap(near.s);
      if(gapS)rescueProgress=Math.floor(Math.max(0,this.progress)/CIRCUIT_LENGTH)*CIRCUIT_LENGTH
        +jumpStartDistance-22;
    }
    const p=sampleAt(rescueProgress);
    this.vehicle.x=p.position.x;this.vehicle.z=p.position.z;
    this.vehicle.yaw=p.yaw;this.vehicle.steering=0;this.vehicle.speed=12;
    if(COURSE_ID===4)initVertical(this.vehicle,p.position.y);
    this.player.position.set(this.vehicle.x,
      COURSE_ID===4?this.vehicle.height:.02,this.vehicle.z);
    this.player.rotation.set(0,-this.vehicle.yaw,0);
    this.yaw=this.vehicle.yaw;this.speed=this.vehicle.speed;this.lane=0;
    if(COURSE_ID===4){this.player.rotation.set(p.pitch,-p.yaw,0,"YXZ");}
    const near=projectOnCircuit(this.player.position);
    this.trackIndex=near.index;this.trackS=near.s;this.offroadTime=0;this.roadDistanceSquared=0;
    this.ui.recovery.classList.add("hidden");
    this.elapsed+=2.5;this.notify("コースに もどったよ！ +2.5びょう");
  }
  advanceRival(r,dt){
    if(r.finished)return;
    const previousRivalDistance=r.progress;
    const here=sampleAt(r.progress),ahead=sampleAt(r.progress+27);
    const turn=Math.acos(clamp(here.tangent.dot(ahead.tangent),-1,1));
    let desired=rivalStyles[r.index].speed;
    desired*=1-(r.turnSlowdown??.15)*clamp(turn/.65,0,1);
    const close=this.rivals.find((other)=>other!==r&&other.progress>r.progress&&other.progress-r.progress<17&&Math.abs(other.lane-r.lane)<2.8);
    const playerAhead=this.progress>r.progress&&this.progress-r.progress<13&&Math.abs(this.lane-r.lane)<2.8;
    if(close||playerAhead){
      const leaderLane=close?close.lane:this.lane;
      r.targetLane=leaderLane>=0?Math.max(-6.5,leaderLane-3.5):Math.min(6.5,leaderLane+3.5);
      if(close && Math.abs(close.lane-r.lane)<1)desired=Math.min(desired,close.speed+1.5);
    }else if(Math.abs(r.targetLane)>6.5||Math.sin(this.elapsed*.19+r.index*1.6)>.85)r.targetLane=r.homeLane;
    r.speed+=(desired-r.speed)*(1-Math.exp(-1.7*dt));
    r.lane+=(r.targetLane-r.lane)*(1-Math.exp(-2.7*dt));
    r.progress=Math.min(raceDistance,r.progress+r.speed*dt);
    if(r.progress>=raceDistance)r.finished=true;
    const p=sampleAt(r.finished?10:r.progress);
    const lane=r.finished?ROAD_WIDTH/2+10+r.index*3:r.lane;
    r.mesh.position.copy(p.position).addScaledVector(p.right,lane);
    if(COURSE_ID===4&&!r.finished){
      const launchVelocity=getJumpLaunch(previousRivalDistance,r.progress,r.speed,dt,r.lane);
      advanceVertical(r,{
        dt,roadHeight:p.position.y,overRoad:!isJumpGap(r.progress),
        launchVelocity,allowFailure:false
      });
      r.mesh.position.y=r.height;
      const pitch=r.airborne?Math.atan2(r.verticalSpeed,Math.max(1,r.speed))*.6:p.pitch;
      r.mesh.rotation.set(pitch,-p.yaw,0,"YXZ");
    }else{
      r.mesh.position.y=COURSE_ID===4?p.position.y+.02:.02+Math.sin(this.elapsed*6+r.index)*.035;
      r.mesh.rotation.y=-p.yaw;
    }
  }
  handleContacts(){
    for(const rival of this.rivals){
      if(rival.finished)continue;
      // No ghost collisions between cars separated vertically during jumps.
      if(COURSE_ID===4&&Math.abs(this.player.position.y-rival.mesh.position.y)>2.7)continue;
      const dx=this.vehicle.x-rival.mesh.position.x,dz=this.vehicle.z-rival.mesh.position.z;
      const dist=Math.hypot(dx,dz);
      if(dist<2.65&&dist>.02){
        const push=(2.65-dist)*.42;
        this.vehicle.x+=dx/dist*push;this.vehicle.z+=dz/dist*push;
        this.player.position.x=this.vehicle.x;this.player.position.z=this.vehicle.z;
        // Once per contact cooldown; never deduct speed every rendered frame.
        if(this.elapsed-rival.lastContactAt>.7){
          this.vehicle.speed=Math.max(15,this.vehicle.speed-.65);
          this.speed=this.vehicle.speed;
          rival.speed=Math.max(15,rival.speed-.25);
          rival.lastContactAt=this.elapsed;
        }
      }
    }
  }
  moveCamera(dt){
    const fwd=new THREE.Vector3(Math.sin(this.vehicle.yaw),0,-Math.cos(this.vehicle.yaw));
    const target=this.player.position.clone().addScaledVector(fwd,-12);
    target.y=(COURSE_ID===4?this.player.position.y:0)+7.5;
    this.camera.position.lerp(target,1-Math.exp(-5*dt));
    const look=this.player.position.clone().addScaledVector(fwd,17);
    look.y=(COURSE_ID===4?this.player.position.y:0)+2.1;
    this.cameraTarget.lerp(look,1-Math.exp(-7*dt));
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov=64+this.speed*.09;this.camera.updateProjectionMatrix();
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
    this.state="finished";this.audio.mute();this.music.stop();
    this.ui.dash.classList.add("hidden");
    this.ui.recovery.classList.add("hidden");
    this.dashFlames.forEach(flame=>{flame.visible=false;});
    this.ui.recenter.classList.add("hidden");this.clearBanner();
    this.updateHud();this.drawMap();
    this.ui.resultPlace.textContent=this.rank+"い / 6だい";
    this.ui.resultTime.textContent=this.elapsed.toFixed(1)+"びょう";
    this.ui.resultMessage.textContent=this.rank===1?"おめでとう！ いちばんはやかったよ！":
      this.rank<=3?"やったね！ つぎは1いを めざそう！":"ゴール！ つぎもがんばろう！";
    if(!this.bestTime||this.elapsed<this.bestTime){
      this.bestTime=this.elapsed;localStorage.setItem(this.bestTimeKey,this.elapsed.toString());
    }
    this.ui.result.classList.remove("hidden");
  }
  tick(now){
    requestAnimationFrame(this.tick);
    const dt=Math.min(.04,Math.max(0,(now-(this.lastFrame||now))/1000));
    this.lastFrame=now;
    if(this.state==="countdown"){
      this.countdown-=dt;
      if(this.countdown<=0){
        this.state="running";
        this.music.start(this.audio.ctx);
        this.showBanner("GO!");this.noticeUntil=performance.now()+1000;
      }
      else this.showBanner(String(Math.ceil(this.countdown)));
    }else if(this.state==="running")this.update(dt);
    if(this.state==="ready"){
      const point=sampleAt(-32);
      const readyCamera=point.position.clone().addScaledVector(point.tangent,-20);
      readyCamera.y=(COURSE_ID===4?point.position.y:0)+11;
      this.camera.position.lerp(readyCamera,.05);
      const look=point.position.clone().addScaledVector(point.tangent,18);
      look.y=(COURSE_ID===4?point.position.y:0)+1.4;
      this.camera.lookAt(look);
    }
    this.music.update();
    this.renderer.render(this.scene,this.camera);
  }
}

const accessKey=COURSE_ID===4?"miniGameAccess:kart-race-4"
  :COURSE_ID===3?"miniGameAccess:kart-race-3"
  :COURSE_ID===2?"miniGameAccess:kart-race-2":"miniGameAccess:kart-race";
if(sessionStorage.getItem(accessKey)!=="1"){
  window.location.replace("../"+(sessionStorage.getItem("miniGameReturnUrl")||"learn.html"));
}else{
  sessionStorage.removeItem(accessKey);
  new KartRace();
  window.addEventListener("pageshow",(event)=>{
    if(event.persisted)window.location.replace("../"+(sessionStorage.getItem("miniGameReturnUrl")||"learn.html"));
  });
}
