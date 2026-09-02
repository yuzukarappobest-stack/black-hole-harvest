import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { CONFIG, FRUIT_LEVELS } from "./config.js?v=3";
import { Fruit, fruitData } from "./Fruit.js?v=3";
import { Player } from "./Player.js?v=4";
import { Course } from "./Course.js?v=3";
import { InputManager } from "./InputManager.js?v=2";
import { UI } from "./UI.js?v=3";
import { AudioManager } from "./Audio.js?v=5";

export class Game {
  constructor(root) {
    this.root = root;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x70cfff);
    this.scene.fog = new THREE.Fog(0x70cfff, 28, 86);
    this.camera = new THREE.PerspectiveCamera(58, 1, .1, 180);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.prepend(this.renderer.domElement);
    this.input = new InputManager(this.renderer.domElement);
    this.ui = new UI(); this.audio = new AudioManager(); this.clock = new THREE.Clock(false);
    this.state = "ready"; this.score = 0; this.fruits = []; this.particles = []; this.gates = []; this.combo = 0; this.comboTimer = 0; this.magnetCharges = 0; this.magneticTime = 0; this.smallCollects = 0; this.slowTime = 0; this.respawnTimer = 0; this.respawnZ = 4.5;
    this.addLights(); this.course = new Course(this.scene); this.player = new Player(); this.scene.add(this.player.mesh);
    window.addEventListener("resize", () => this.resize()); this.resize();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  addLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x489c51, 2.3); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d0, 2.2); sun.position.set(-5, 12, 6); this.scene.add(sun);
  }
  resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
  enableTilt() { return this.input.enableTilt(); }
  start() {
    const audioReady=this.audio.unlock();
    this.clearFruits(); this.clearParticles(); this.clearGates(); this.player.reset(); this.score = 0; this.combo = 0; this.comboTimer = 0; this.magnetCharges = 0; this.magneticTime = 0; this.smallCollects = 0; this.slowTime = 0; this.respawnTimer = 0; this.state = "running";
    this.spawnFruits(); this.addGates(); this.clock.start(); this.ui.showGame(); this.updateUI();
    audioReady.then((ready) => { if (ready && this.state === "running") this.audio.startBgm(); });
  }
  spawnFruits() {
    const guaranteed = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];
    guaranteed.forEach((level, index) => this.addFruit(level, index % 2 ? -1.35 : 1.35, -20 - index * 25));
    for (let index = 0; index < CONFIG.spawnCount; index += 1) {
      const z = -12 - index * 7.4 - Math.random() * 4;
      const x = (Math.random() - .5) * (CONFIG.courseWidth - 1.7);
      const progress = Math.min(1, -z / CONFIG.courseLength);
      const maxLevel = Math.min(5, 1 + Math.floor(progress * 6));
      const level = 1 + Math.floor(Math.random() * maxLevel);
      this.addFruit(level, x, z);
    }
  }
  addFruit(level, x, z) { const fruit = new Fruit(level, x, z); this.fruits.push(fruit); this.scene.add(fruit.mesh); }
  addGates() {
    [[-110, ["upgrade", "magnet"]], [-235, ["magnet", "score"]], [-350, ["upgrade", "score"]]].forEach(([z, kinds]) => kinds.forEach((kind, index) => this.addGate(kind, index ? 2.15 : -2.15, z)));
  }
  addGate(kind, x, z) {
    const colors={upgrade:0x56a7ff,magnet:0xa761ff,score:0xffae45}; const labels={upgrade:"+1 LV",magnet:"MAGNET",score:"+100"};
    const group=new THREE.Group(); const material=new THREE.MeshStandardMaterial({color:colors[kind],roughness:.4});
    for(const offset of [-1.42,1.42]) { const post=new THREE.Mesh(new THREE.BoxGeometry(.16,2.1,.2),material); post.position.set(offset,1.05,0); group.add(post); }
    const top=new THREE.Mesh(new THREE.BoxGeometry(3,.42,.25),material); top.position.y=2.05; group.add(top);
    const canvas=document.createElement("canvas"); canvas.width=256; canvas.height=72; const ctx=canvas.getContext("2d"); ctx.fillStyle="#ffffff"; ctx.font="900 32px system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(labels[kind],128,38);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.65,.74),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true})); sign.position.set(0,1.48,.14); group.add(sign);
    group.position.set(x,0,z); this.scene.add(group); this.gates.push({kind,x,z,group,used:false});
  }
  clearGates() { this.gates.forEach((gate)=>gate.group.removeFromParent()); this.gates.length=0; }
  clearFruits() { this.fruits.forEach((fruit) => fruit.dispose()); this.fruits.length = 0; }
  clearParticles() { this.particles.forEach((item) => item.mesh.removeFromParent()); this.particles.length = 0; }
  update(delta) {
    this.slowTime=Math.max(0,this.slowTime-delta); this.player.move(delta, this.input.direction, this.slowTime>0?.46:1);
    const p = this.player.mesh.position;
    this.camera.position.lerp(new THREE.Vector3(p.x * .34, CONFIG.cameraHeight, p.z + CONFIG.cameraDistance), Math.min(1, delta * 5));
    this.camera.lookAt(p.x * .2, .6, p.z - 8);
    this.comboTimer=Math.max(0,this.comboTimer-delta); if(this.comboTimer===0)this.combo=0;
    this.magneticTime=Math.max(0,this.magneticTime-delta); this.checkGates(); this.applyMagnet(delta); this.checkCollisions(); this.updateParticles(delta);
    if (Math.abs(p.x) > CONFIG.courseWidth / 2 + this.player.radius + .25) this.startRecovery();
    if (p.z <= -CONFIG.courseLength + CONFIG.finishPadding) this.end("finish");
    this.updateUI();
  }
  startRecovery() {
    if (this.state !== "running") return;
    const p = this.player.mesh.position;
    this.state = "recovering"; this.respawnTimer = CONFIG.respawnDelay;
    this.respawnZ = Math.min(4.5, p.z + CONFIG.respawnBacktrack);
    this.ui.showRecovery(Math.ceil(this.respawnTimer)); this.audio.rescue();
  }
  updateRecovery(delta) {
    this.respawnTimer = Math.max(0, this.respawnTimer - delta);
    this.player.mesh.position.y -= delta * 2.8;
    this.player.mesh.rotation.z += delta * 2.4;
    const p = this.player.mesh.position;
    this.camera.position.lerp(new THREE.Vector3(p.x * .26, CONFIG.cameraHeight, p.z + CONFIG.cameraDistance), Math.min(1, delta * 4));
    this.camera.lookAt(p.x * .15, .3, p.z - 8);
    this.ui.showRecovery(Math.max(1, Math.ceil(this.respawnTimer)));
    if (this.respawnTimer > 0) return;
    this.player.respawn(this.respawnZ); this.state = "running"; this.ui.hideRecovery(); this.updateUI();
  }
  checkCollisions() {
    const playerPosition = this.player.mesh.position;
    for (const fruit of this.fruits) {
      if (!fruit.alive || fruit.mesh.position.distanceToSquared(playerPosition) > (fruit.radius + this.player.radius) ** 2) continue;
      if (fruit.level === this.player.level) this.merge(fruit);
      else if (fruit.level < this.player.level) this.collectSmallFruit(fruit);
      else { const push = Math.sign(fruit.mesh.position.x - playerPosition.x) || 1; fruit.mesh.position.x += push * .22; this.slowTime=Math.max(this.slowTime,.38); }
    }
  }
  removeFruit(fruit) { fruit.alive=false; fruit.dispose(); this.fruits=this.fruits.filter((item)=>item!==fruit); }
  collectSmallFruit(fruit) {
    const gained=Math.max(4,Math.round(fruitData(fruit.level).score*CONFIG.smallFruitScoreFactor));
    this.removeFruit(fruit); this.score+=gained; this.smallCollects+=1;
    if(this.smallCollects%CONFIG.smallFruitMagnetEvery===0)this.magnetCharges=Math.min(3,this.magnetCharges+1);
    this.spawnBurst(0xffe36a,7); this.ui.merge(`JUICY +${gained}`,Math.max(1,this.combo)); this.audio.tone(680,.08,"triangle");
  }
  checkGates() {
    const p=this.player.mesh.position;
    for(const gate of this.gates) {
      if(gate.used || Math.abs(p.z-gate.z)>.72 || Math.abs(p.x-gate.x)>1.65) continue;
      gate.used=true; gate.group.removeFromParent();
      if(gate.kind==="upgrade") { const before=this.player.level; const data=this.player.evolve(); if(before!==this.player.level) { this.ui.merge("LEVEL UP!",this.combo||1); this.audio.merge(); } this.updateUI(data); }
      if(gate.kind==="magnet") { this.magnetCharges=Math.min(3,this.magnetCharges+1); this.ui.merge("MAGNET +1",this.combo||1); this.audio.tone(960,.16,"triangle"); }
      if(gate.kind==="score") { this.score+=100; this.ui.merge("+100",this.combo||1); this.audio.tone(720,.14,"triangle"); }
    }
  }
  applyMagnet(delta) {
    if(this.magneticTime<=0)return;
    const p=this.player.mesh.position;
    for(const fruit of this.fruits) {
      if(!fruit.alive || fruit.level!==this.player.level || fruit.mesh.position.distanceTo(p)>6.5)continue;
      fruit.mesh.position.x+=(p.x-fruit.mesh.position.x)*Math.min(1,delta*4.8);
      fruit.mesh.position.z+=(p.z-fruit.mesh.position.z)*Math.min(1,delta*4.8);
    }
  }
  activateMagnet() { if(this.state!=="running" || this.magnetCharges<=0 || this.magneticTime>0)return; this.magnetCharges-=1; this.magneticTime=5; this.ui.merge("MAGNET!",this.combo||1); this.audio.tone(880,.2,"sine"); this.audio.tone(1175,.26,"sine",.1); }
  merge(fruit) {
    this.removeFruit(fruit);
    this.combo=this.comboTimer>0?this.combo+1:1; this.comboTimer=2.5;
    if(this.combo>0 && this.combo%3===0)this.magnetCharges=Math.min(3,this.magnetCharges+1);
    const multiplier=1+Math.floor((this.combo-1)/3); const gained = fruitData(this.player.level).score*multiplier; this.score += gained; const data = this.player.evolve();
    this.spawnBurst(); this.ui.merge(gained,this.combo); this.audio.merge();
    this.player.mesh.scale.setScalar(1.18); setTimeout(() => { if (this.state === "running") this.player.mesh.scale.setScalar(1); }, 150);
    this.updateUI(data);
  }
  spawnBurst(color = 0xfff4a6, count = 12) {
    const material = new THREE.MeshBasicMaterial({ color });
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.09, 5, 4), material.clone());
      mesh.position.copy(this.player.mesh.position); const angle = index / count * Math.PI * 2; this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(Math.cos(angle) * (1.8 + Math.random()), .9 + Math.random() * 1.8, Math.sin(angle) * 1.5), life: .46 });
    }
  }
  updateParticles(delta) { this.particles = this.particles.filter((item) => { item.life -= delta; item.mesh.position.addScaledVector(item.velocity, delta); item.velocity.y -= 5 * delta; item.mesh.material.opacity = Math.max(0, item.life * 2); item.mesh.material.transparent = true; if (item.life <= 0) { item.mesh.material.dispose(); item.mesh.removeFromParent(); return false; } return true; }); }
  updateUI() { const data = fruitData(this.player.level); const percent = Math.max(0, Math.min(100, (-this.player.mesh.position.z + 4.5) / CONFIG.courseLength * 100)); this.ui.update(this.score, data, percent,Math.max(1,this.combo),this.magnetCharges,this.magneticTime); }
  end(kind) { if (this.state !== "running") return; this.state = kind; this.clock.stop(); this.audio.stopBgm(); const data = fruitData(this.player.level); this.ui.endGame(kind, this.score, data); kind === "finish" ? this.audio.finish() : this.audio.over(); }
  loop() { const delta = Math.min(this.clock.getDelta(), .05); if (this.state === "running") this.update(delta); else if (this.state === "recovering") this.updateRecovery(delta); this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.loop); }
}
