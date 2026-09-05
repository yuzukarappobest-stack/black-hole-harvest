import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const GAME_ID = "space-blaster";
const ACCESS_KEY = `miniGameAccess:${GAME_ID}`;
const learningUrl = () => `../${sessionStorage.getItem("miniGameReturnUrl") || "learn.html"}`;

if (sessionStorage.getItem(ACCESS_KEY) !== "1") {
  window.location.replace(learningUrl());
} else {
  sessionStorage.removeItem(ACCESS_KEY);
}

const CONFIG = { bossScore: 1100, fireInterval: .085, enemyInterval: 1.05, bossHealth: 70, shipBoundX: 5.2, shipBoundY: 3.7, bestKey: "spaceBlasterBestTime" };
const root = document.querySelector("#gameRoot");
const hud = document.querySelector("#hud"), scoreEl = document.querySelector("#scoreValue"), timeEl = document.querySelector("#timeValue"), bossHud = document.querySelector("#bossHud"), bossHealthEl = document.querySelector("#bossHealth"), notice = document.querySelector("#notice"), startScreen = document.querySelector("#startScreen"), finishScreen = document.querySelector("#finishScreen"), resultKicker = document.querySelector("#resultKicker"), resultTitle = document.querySelector("#resultTitle"), resultTime = document.querySelector("#resultTime"), bestTime = document.querySelector("#bestTime");

const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x060a20, 40, 100);
const camera = new THREE.PerspectiveCamera(58, 1, .1, 130); camera.position.set(0, 0, 9);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); root.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x83d7ff, 0x11102f, 2.4)); const keyLight = new THREE.DirectionalLight(0xbceaff, 2.5); keyLight.position.set(-5, 8, 7); scene.add(keyLight);

let state = "ready", score = 0, elapsed = 0, spawnClock = 0, fireClock = 0, boss = null, pointerDown = false, target = new THREE.Vector2(), audio = null;
let enemies = [], bullets = [], sparks = [], stars = [];

function makeShip() {
  const group = new THREE.Group(); const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3ba8ff, metalness: .55, roughness: .25, emissive: 0x092c82, emissiveIntensity: .55 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(.72, 2.1, 4), bodyMat); body.rotation.x = Math.PI / 2; group.add(body);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x91ebff, metalness: .3, roughness: .3 });
  for (const side of [-1, 1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(.62, 1.6, 3), wingMat); wing.scale.set(1.3,.23,1); wing.rotation.set(Math.PI / 2, 0, side * .42); wing.position.set(side * .66, -.05, .05); group.add(wing); }
  const engine = new THREE.PointLight(0x3adfff, 2.6, 9); engine.position.z = .9; group.add(engine); group.position.set(0, -2.5, 2.2); return group;
}
const ship = makeShip(); scene.add(ship);

function makeStars() { const geometry = new THREE.BufferGeometry(); const values = []; for (let i=0;i<900;i+=1) values.push((Math.random()-.5)*38, (Math.random()-.5)*27, -Math.random()*100); geometry.setAttribute("position", new THREE.Float32BufferAttribute(values,3)); const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color:0xbfeaff, size:.075, transparent:true, opacity:.9 })); scene.add(points); stars = [points]; }
makeStars();

function enemyMesh(kind) {
  const group = new THREE.Group(); const color = kind === "ufo" ? 0xc36dff : 0xa3907e;
  if (kind === "ufo") { const disk = new THREE.Mesh(new THREE.SphereGeometry(.9,16,10), new THREE.MeshStandardMaterial({color, metalness:.55, roughness:.18, emissive:0x351064, emissiveIntensity:.5})); disk.scale.y=.34; group.add(disk); const dome = new THREE.Mesh(new THREE.SphereGeometry(.43,12,8), new THREE.MeshStandardMaterial({color:0x92f6ff, emissive:0x2186cc, emissiveIntensity:.9})); dome.position.y=.2; group.add(dome); }
  else { const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(.72 + Math.random()*.28,1), new THREE.MeshStandardMaterial({color, roughness:.92, flatShading:true})); rock.rotation.set(Math.random()*3,Math.random()*3,0); group.add(rock); }
  return group;
}
function spawnEnemy() { const kind = Math.random() < .36 ? "ufo" : "asteroid"; const mesh = enemyMesh(kind); mesh.position.set((Math.random()-.5)*10, (Math.random()-.5)*6.5, -54); const radius=kind === "ufo" ? 1 : .85; enemies.push({mesh,kind,radius,hp:kind === "ufo"?2:1,score:kind === "ufo"?75:40,spin:(Math.random()-.5)*2,drift:(Math.random()-.5)*.35}); scene.add(mesh); }
function spawnBoss() { const mesh = new THREE.Group(); const base = new THREE.Mesh(new THREE.SphereGeometry(2.7,20,12), new THREE.MeshStandardMaterial({color:0xe95cff,metalness:.45,roughness:.2,emissive:0x54007d,emissiveIntensity:.9})); base.scale.y=.38; mesh.add(base); const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35,18,10), new THREE.MeshStandardMaterial({color:0x9afff0,emissive:0x2fd0c0,emissiveIntensity:1})); dome.scale.y=.62; dome.position.y=.45; mesh.add(dome); for(let i=0;i<8;i+=1){const light=new THREE.Mesh(new THREE.SphereGeometry(.13,7,6),new THREE.MeshBasicMaterial({color:i%2?0xffe067:0x6beaff})); const a=i/8*Math.PI*2; light.position.set(Math.cos(a)*2.3,-.15,Math.sin(a)*.3); mesh.add(light);} mesh.position.set(0,1,-44); scene.add(mesh); boss={mesh,hp:CONFIG.bossHealth,maxHp:CONFIG.bossHealth,phase:0}; bossHud.classList.remove("hidden"); showNotice("きょだいUFOが きた！",1500); }
function fire() { const mesh = new THREE.Mesh(new THREE.SphereGeometry(.09,6,5), new THREE.MeshBasicMaterial({color:0xffec72})); mesh.position.copy(ship.position); mesh.position.z-=.8; bullets.push({mesh}); scene.add(mesh); tone(190,.035,"square",.035); }
function burst(position, color=0xffd76a, count=10) { for(let i=0;i<count;i+=1){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,5,4),new THREE.MeshBasicMaterial({color})); mesh.position.copy(position); sparks.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*6,(Math.random()-.5)*6,(Math.random()-.5)*4),life:.45});scene.add(mesh);} }
function removeEnemy(enemy) { scene.remove(enemy.mesh); enemies=enemies.filter(item=>item!==enemy); }
function killEnemy(enemy) { score+=enemy.score; burst(enemy.mesh.position,enemy.kind==="ufo"?0xc36dff:0xffae67,14); tone(enemy.kind==="ufo"?540:360,.12,"triangle",.08); removeEnemy(enemy); }
function hitBoss() { boss.hp-=1; boss.mesh.scale.setScalar(1.08); setTimeout(()=>boss?.mesh.scale.setScalar(1),70); bossHealthEl.style.width=`${Math.max(0,boss.hp)/boss.maxHp*100}%`; tone(250,.045,"sawtooth",.05); if(boss.hp>0)return; score+=500; burst(boss.mesh.position,0xff6fe8,42); scene.remove(boss.mesh); boss=null; end(true); }
function updateBullets(delta) { bullets=bullets.filter(bullet=>{bullet.mesh.position.z-=delta*41; let hit=false; for(const enemy of [...enemies]){if(bullet.mesh.position.distanceToSquared(enemy.mesh.position)<(enemy.radius+.16)**2){enemy.hp-=1;burst(bullet.mesh.position);scene.remove(bullet.mesh);hit=true;if(enemy.hp<=0)killEnemy(enemy);break;}} if(!hit&&boss&&bullet.mesh.position.distanceToSquared(boss.mesh.position)<8.2){scene.remove(bullet.mesh);hit=true;hitBoss();} if(!hit&&bullet.mesh.position.z<-64){scene.remove(bullet.mesh);hit=true;} return !hit;}); }
function updateEnemies(delta) { for(const enemy of [...enemies]) { enemy.mesh.position.z+=delta*(4.5+(elapsed/30)); enemy.mesh.position.x+=Math.sin(elapsed*1.3+enemy.mesh.position.z)*enemy.drift*delta; enemy.mesh.rotation.y+=enemy.spin*delta; if(enemy.mesh.position.z>8)removeEnemy(enemy); } if(boss){boss.phase+=delta; boss.mesh.position.x=Math.sin(boss.phase*.85)*3.2; boss.mesh.position.y=.7+Math.sin(boss.phase*1.8)*.7; boss.mesh.rotation.y+=delta*.5;} }
function updateSparks(delta){sparks=sparks.filter(item=>{item.life-=delta;item.mesh.position.addScaledVector(item.velocity,delta);if(item.life<=0){scene.remove(item.mesh);return false;}return true;});}
function updateStars(delta){const pos=stars[0].geometry.attributes.position;for(let i=2;i<pos.count*3;i+=3){pos.array[i]+=delta*12;if(pos.array[i]>8)pos.array[i]=-95;}pos.needsUpdate=true;}
function updateShip(delta){ship.position.x+=(target.x-ship.position.x)*Math.min(1,delta*7);ship.position.y+=(target.y-ship.position.y)*Math.min(1,delta*7);ship.rotation.z=(target.x-ship.position.x)*-.16;ship.rotation.x=(target.y-ship.position.y)*.07;}
function updateHud(){scoreEl.textContent=score;timeEl.textContent=`${elapsed.toFixed(1)}秒`;}
function loop(now){requestAnimationFrame(loop);const delta=Math.min(.05,(now-(loop.last||now))/1000);loop.last=now;if(state==="running"){elapsed+=delta;spawnClock+=delta;fireClock+=delta;if(!boss&&score>=CONFIG.bossScore)spawnBoss();if(!boss&&spawnClock>CONFIG.enemyInterval){spawnClock=0;spawnEnemy();}if(fireClock>CONFIG.fireInterval){fireClock=0;fire();}updateShip(delta);updateBullets(delta);updateEnemies(delta);updateSparks(delta);updateStars(delta);updateHud();}renderer.render(scene,camera);}requestAnimationFrame(loop);
function start(){enemies.forEach(item=>scene.remove(item.mesh));bullets.forEach(item=>scene.remove(item.mesh));sparks.forEach(item=>scene.remove(item.mesh));enemies=[];bullets=[];sparks=[];if(boss)scene.remove(boss.mesh);boss=null;score=0;elapsed=0;spawnClock=.7;fireClock=0;target.set(0,-2.5);ship.position.set(0,-2.5,2.2);bossHud.classList.add("hidden");startScreen.classList.add("hidden");finishScreen.classList.add("hidden");hud.classList.remove("hidden");state="running";unlockAudio();}
function end(clear){state="finished";hud.classList.add("hidden");finishScreen.classList.remove("hidden");const time=elapsed.toFixed(1);resultKicker.textContent=clear?"MISSION CLEAR":"MISSION FAILED";resultTitle.textContent=clear?"CLEAR!":"GAME OVER";resultTime.textContent=`TIME ${time}秒`;let best=Number(localStorage.getItem(CONFIG.bestKey));if(clear&&(!best||elapsed<best)){best=elapsed;localStorage.setItem(CONFIG.bestKey,String(best));bestTime.textContent=`NEW BEST! ${best.toFixed(1)}秒`;}else bestTime.textContent=best?`BEST ${best.toFixed(1)}秒`:"BEST --";tone(clear?720:150,.3,"sine",.12);}
function setTarget(event){const rect=renderer.domElement.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*2-1;const y=-((event.clientY-rect.top)/rect.height*2-1);target.set(THREE.MathUtils.clamp(x*CONFIG.shipBoundX,-CONFIG.shipBoundX,CONFIG.shipBoundX),THREE.MathUtils.clamp(y*CONFIG.shipBoundY,-CONFIG.shipBoundY,CONFIG.shipBoundY));}
renderer.domElement.addEventListener("pointerdown",event=>{pointerDown=true;renderer.domElement.setPointerCapture(event.pointerId);setTarget(event);});renderer.domElement.addEventListener("pointermove",event=>{if(pointerDown)setTarget(event);});renderer.domElement.addEventListener("pointerup",()=>{pointerDown=false;});renderer.domElement.addEventListener("pointercancel",()=>{pointerDown=false;});
window.addEventListener("keydown",event=>{const step=.7;if(event.key==="ArrowLeft"||event.key==="a")target.x-=step;if(event.key==="ArrowRight"||event.key==="d")target.x+=step;if(event.key==="ArrowUp"||event.key==="w")target.y+=step;if(event.key==="ArrowDown"||event.key==="s")target.y-=step;target.x=THREE.MathUtils.clamp(target.x,-CONFIG.shipBoundX,CONFIG.shipBoundX);target.y=THREE.MathUtils.clamp(target.y,-CONFIG.shipBoundY,CONFIG.shipBoundY);});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}window.addEventListener("resize",resize);resize();
function unlockAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();}
function tone(freq,length,type="sine",volume=.05){if(!audio)return;const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;osc.type=type;osc.frequency.setValueAtTime(freq,now);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+length);osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+length);}
function showNotice(text,ms){notice.textContent=text;notice.classList.remove("hidden");clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>notice.classList.add("hidden"),ms);}
document.querySelector("#startButton").addEventListener("click",start);
document.querySelector("#returnButton").addEventListener("click",()=>window.location.replace(learningUrl()));
window.addEventListener("pageshow",event=>{if(event.persisted)window.location.replace(learningUrl());});
