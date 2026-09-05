import * as T from "./vendor/three.module.js";
import { City, Effects } from "./world.js";
import { soldier, monster } from "./actors.js";
import { Input } from "./input.js?v=2";
import { Sound } from "./audio.js";
import { CONFIG, formatTime } from "./config.js";

const $ = id => document.getElementById(id);
class Game {
  constructor() {
    this.state = "ready"; this.hp = CONFIG.monsterHealth; this.elapsed = 0; this.shotClock = 0; this.attackClock = 4;
    this.knockTime = 0; this.knockdowns = 0; this.attack = null; this.attackNumber = 0; this.shake = 0; this.hitTime = 0;
    this.scene = new T.Scene(); this.scene.background = new T.Color(0x9cc2cb); this.scene.fog = new T.Fog(0x9cc2cb, 85, 215);
    this.camera = new T.PerspectiveCamera(62, 1, .1, 260);
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.2;
    $("game").prepend(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight(0xe0f5ff, 0x7a8674, 2.7));
    const sun = new T.DirectionalLight(0xffd8ac, 3.2); sun.position.set(-38, 66, 35); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -72; sun.shadow.camera.right = sun.shadow.camera.top = 72; sun.shadow.camera.far = 180; sun.shadow.normalBias = .1; this.scene.add(sun);
    this.city = new City(this.scene); this.fx = new Effects(this.scene); this.player = soldier(this.scene); this.kaiju = monster(this.scene);
    this.kaiju.root.scale.setScalar(1.6);
    this.input = new Input(this.renderer.domElement); this.audio = new Sound(); this.ray = new T.Raycaster();
    this.direction = new T.Vector3(); this.tmp = new T.Vector3(); this.muzzle = new T.Vector3(); this.camTarget = new T.Vector3();
    this.ring = new T.Mesh(new T.RingGeometry(.87, 1, 64), new T.MeshBasicMaterial({ color: 0xff623f, transparent: true, opacity: .65, side: T.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.scene.add(this.ring);
    this.beam = new T.Mesh(new T.CylinderGeometry(.45, 1.3, 1, 10), new T.MeshBasicMaterial({ color: 0xffbd66, transparent: true, opacity: .8 })); this.beam.visible = false; this.scene.add(this.beam);
    this.player.root.position.set(0, 0, 42); this.kaiju.root.position.set(0, 0, -26); this.kaiju.root.rotation.y = Math.PI;
    this.resize(); this.camera.position.set(12, 11, 55); this.camera.lookAt(0, 9, -26);
    $("start").disabled = false; $("start").textContent = "出撃する"; $("loadStatus").textContent = "";
    $("start").onclick = () => this.start(); $("retry").onclick = () => this.start();
    $("pause").onclick = () => this.pause(); $("resume").onclick = () => this.resume();
    $("sound").onclick = () => { this.audio.unlock(); this.audio.enabled = !this.audio.enabled; $("sound").textContent = `音 ${this.audio.enabled ? "ON" : "OFF"}`; $("sound").setAttribute("aria-pressed", String(this.audio.enabled)); };
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.pause(); });
    window.addEventListener("resize", () => this.resize());
    this.renderer.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); this.pause(); $("resume").disabled = true; $("resume").textContent = "再読み込みしてください"; });
    this.last = performance.now(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); }
  start() {
    this.audio.unlock(); this.city.reset(); this.fx.reset(); this.input.reset();
    this.hp = CONFIG.monsterHealth; this.elapsed = 0; this.knockdowns = 0; this.knockTime = 0; this.attackClock = 4; this.attack = null; this.attackNumber = 0; this.shotClock = 0; this.shake = 0;
    this.kaiju.root.position.set(0, 0, -26); this.kaiju.root.rotation.set(0, Math.PI, 0); this.player.root.position.set(0, 0, 42); this.player.body.rotation.set(0, 0, 0);
    this.input.yaw = 0; this.input.pitch = .12; this.ring.visible = this.beam.visible = false; this.state = "running";
    $("intro").hidden = $("finish").hidden = $("pauseScreen").hidden = true; $("hud").hidden = false;
    this.updateCamera(1); this.updateHUD(); this.audio.roar(); this.last = performance.now();
  }
  pause() { if (this.state !== "running") return; this.state = "paused"; this.input.reset(); $("pauseScreen").hidden = false; }
  resume() { if (this.state !== "paused") return; this.state = "running"; this.audio.unlock(); this.last = performance.now(); $("pauseScreen").hidden = true; }
  updatePlayer(dt) {
    const p = this.player.root.position;
    if (this.knockTime > 0) {
      this.knockTime = Math.max(0, this.knockTime - dt);
      this.player.body.rotation.x = Math.sin(Math.min(1, this.knockTime / .4) * Math.PI / 2) * 1.35;
      this.player.body.position.y = -.3;
      if (this.knockTime === 0) { this.player.body.rotation.x = 0; this.player.body.position.y = 0; }
      return;
    }
    const v = this.input.vector(), yaw = this.input.yaw;
    const dx = (v.x * Math.cos(yaw) - v.y * Math.sin(yaw)) * CONFIG.walkSpeed * dt;
    const dz = (v.x * Math.sin(yaw) + v.y * Math.cos(yaw)) * CONFIG.walkSpeed * dt;
    const limit = CONFIG.mapLimit;
    const nextX = T.MathUtils.clamp(p.x + dx, -limit, limit), nextZ = T.MathUtils.clamp(p.z + dz, -limit, limit);
    if (!this.city.blocked(nextX, p.z)) p.x = nextX;
    if (!this.city.blocked(p.x, nextZ)) p.z = nextZ;
    const k = this.kaiju.root.position, distance = Math.hypot(p.x - k.x, p.z - k.z);
    if (distance < 7.5) { const a = Math.atan2(p.x - k.x, p.z - k.z); p.x = k.x + Math.sin(a) * 7.5; p.z = k.z + Math.cos(a) * 7.5; }
    this.player.root.rotation.y = -yaw;
    const moving = Math.hypot(v.x, v.y);
    this.player.legs.forEach((leg, i) => leg.rotation.x = Math.sin(this.elapsed * 15 + i * Math.PI) * .65 * moving);
    this.player.body.position.y = Math.sin(this.elapsed * 30) * .035 * moving;
  }
  updateCamera(dt) {
    const p = this.player.root.position;
    const yaw = this.input.yaw, pitch = this.input.pitch;
    this.camTarget.set(p.x - Math.sin(yaw) * 8 + Math.cos(yaw) * .75, 3.1, p.z + Math.cos(yaw) * 8 + Math.sin(yaw) * .75);
    // Shorten the camera boom when a building lies between the soldier and camera.
    const anchor = this.tmp.set(p.x, 2.7, p.z), offset = this.camTarget.clone().sub(anchor), len = offset.length();
    this.ray.set(anchor, offset.normalize()); this.ray.far = len;
    const obstruction = this.ray.intersectObjects(this.city.buildings.filter(b => b.alive).map(b => b.mesh), false)[0];
    if (obstruction) this.camTarget.copy(anchor).addScaledVector(offset, Math.max(.5, obstruction.distance - .3));
    this.camera.position.lerp(this.camTarget, Math.min(1, dt * 12));
    this.direction.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this.camera.lookAt(this.tmp.copy(this.camera.position).addScaledVector(this.direction, 100));
    if (this.shake > 0) { this.camera.position.x += (Math.random() - .5) * this.shake * .25; this.camera.position.y += (Math.random() - .5) * this.shake * .18; }
    this.camera.updateMatrixWorld();
  }
  shoot() {
    this.scene.updateMatrixWorld(true);
    this.ray.setFromCamera(new T.Vector2(0, 0), this.camera); this.ray.far = 190;
    const candidates = [this.kaiju.root, ...this.city.buildings.filter(b => b.alive).map(b => b.mesh)];
    const hit = this.ray.intersectObjects(candidates, true)[0];
    const end = hit ? hit.point : this.ray.ray.at(160, new T.Vector3());
    this.player.muzzle.getWorldPosition(this.muzzle); this.fx.tracer(this.muzzle, end); this.audio.shot();
    if (!hit) return;
    let node = hit.object, building = null, isMonster = false;
    while (node) { if (node === this.kaiju.root) isMonster = true; if (node.userData.building) building = node.userData.building; node = node.parent; }
    this.fx.burst(end, isMonster ? 0xffbf60 : 0xc6d5d0, 4, 2);
    if (isMonster) { this.hp = Math.max(0, this.hp - CONFIG.bulletDamage); this.hitTime = .1; if (this.hp === 0) this.win(); }
    if (building && this.city.hit(building, CONFIG.bulletDamage, this.fx)) { this.audio.boom(); this.shake = .5; }
    $("crosshair").classList.toggle("target", isMonster);
  }
  updateMonster(dt) {
    const k = this.kaiju.root, p = this.player.root.position;
    const distance = Math.hypot(p.x - k.position.x, p.z - k.position.z);
    const toward = new T.Vector3(p.x - k.position.x, 0, p.z - k.position.z).normalize();
    k.rotation.y = Math.atan2(-toward.x, -toward.z);
    if (!this.attack) {
      if (distance > 13) k.position.addScaledVector(toward, dt * CONFIG.monsterSpeed);
      k.position.y = Math.sin(this.elapsed * 2.6) * .14;
      this.kaiju.limbs.forEach((limb, i) => limb.rotation.x = Math.sin(this.elapsed * 2.6 + (i % 2) * Math.PI) * (i % 2 ? .13 : .2));
      if (this.city.crush(k.position, 8, this.fx)) this.audio.boom();
      this.attackClock -= dt;
      if (this.attackClock <= 0) this.beginAttack();
      return;
    }
    const a = this.attack; a.time += dt;
    this.ring.material.opacity = .35 + Math.sin(a.time * 14) * .2;
    this.kaiju.head.rotation.x = -Math.sin(Math.min(a.time / 1.6, 1) * Math.PI) * .35;
    if (a.time >= 1.8 && !a.fired) {
      a.fired = true; this.audio.boom(); this.shake = 1;
      this.fx.burst(a.target.clone().setY(.5), 0xd3bc95, 32, 12);
      this.city.crush(a.target, a.radius, this.fx);
      if (Math.hypot(p.x - a.target.x, p.z - a.target.z) < a.radius) this.knockDown(a.target);
      if (a.type === "beam") { this.kaiju.mouth.getWorldPosition(this.muzzle); const delta = a.target.clone().sub(this.muzzle); this.beam.position.copy(this.muzzle).addScaledVector(delta, .5); this.beam.scale.y = delta.length(); this.beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); this.beam.visible = true; }
    }
    if (a.time >= 2.3) { this.attack = null; this.ring.visible = this.beam.visible = false; this.attackClock = CONFIG.attackInterval - (1 - this.hp / CONFIG.monsterHealth) * 1.5; this.kaiju.head.rotation.x = 0; }
  }
  beginAttack() {
    this.attackNumber++;
    const stomp = this.attackNumber % 3 === 0 && this.player.root.position.distanceTo(this.kaiju.root.position) < 26;
    const target = (stomp ? this.kaiju.root.position : this.player.root.position).clone(); target.y = .05;
    this.attack = { type: stomp ? "stomp" : "beam", target, radius: stomp ? 21 : 9, time: 0, fired: false };
    this.ring.position.copy(target); this.ring.scale.setScalar(this.attack.radius); this.ring.visible = true; this.audio.roar();
  }
  knockDown(origin) {
    if (this.knockTime > 0 || this.state !== "running") return;
    this.knockTime = CONFIG.knockdownSeconds; this.knockdowns++;
    const p = this.player.root.position, away = p.clone().sub(this.kaiju.root.position).setY(0).normalize();
    const next = p.clone().addScaledVector(away, 2);
    if (!this.city.blocked(next.x, next.z)) { p.x = T.MathUtils.clamp(next.x, -CONFIG.mapLimit, CONFIG.mapLimit); p.z = T.MathUtils.clamp(next.z, -CONFIG.mapLimit, CONFIG.mapLimit); }
  }
  updateHUD() {
    $("time").textContent = formatTime(this.elapsed); $("health").style.width = `${this.hp / CONFIG.monsterHealth * 100}%`;
    $("healthText").textContent = `${Math.ceil(this.hp / CONFIG.monsterHealth * 100)}%`;
    $("destroyed").textContent = this.city.count; $("knockdowns").textContent = this.knockdowns;
    $("warning").textContent = this.knockTime > 0 ? "転倒！ すぐに復帰する" : this.attack && !this.attack.fired ? (this.attack.type === "stomp" ? "踏みつけ！ 赤い円から離れろ" : "ブレス接近！ 赤い円から離れろ") : "";
    $("status").textContent = this.knockTime > 0 ? "RECOVERING" : "AUTO FIRE"; $("hit").style.opacity = this.hitTime > 0 ? "1" : "0";
  }
  win() {
    this.state = "dying"; this.deathTime = 0; this.attack = null; this.ring.visible = this.beam.visible = false; this.input.reset(); this.audio.roar();
    this.fx.burst(this.kaiju.root.position.clone().setY(9), 0xffce86, 55, 16);
  }
  finish() {
    this.state = "finished"; $("hud").hidden = true; $("finish").hidden = false;
    let best = 0, saved = true;
    try { best = Number(localStorage.getItem(CONFIG.bestKey)) || 0; if (!best || this.elapsed < best) localStorage.setItem(CONFIG.bestKey, String(this.elapsed)); } catch { saved = false; }
    $("resultTime").textContent = formatTime(this.elapsed);
    $("best").textContent = !saved ? "このブラウザでは記録を保存できません" : !best || this.elapsed < best ? "自己ベスト更新！" : `BEST ${formatTime(best)}`;
    $("resultStats").textContent = `街区破壊 ${this.city.count}棟 · 転倒 ${this.knockdowns}回`;
    this.audio.clear();
  }
  step(dt) {
    if (this.state === "running") {
      this.elapsed += dt; this.shake = Math.max(0, this.shake - dt * 2); this.hitTime -= dt;
      this.updatePlayer(dt); this.updateMonster(dt); this.updateCamera(dt);
      if (this.knockTime > 0) this.shotClock = 0;
      else {
        this.shotClock -= dt;
        if (this.shotClock <= 0) { this.shotClock += CONFIG.shotInterval; this.shoot(); }
      }
      this.city.update(dt, this.fx); this.fx.update(dt); this.updateHUD();
    } else if (this.state === "dying") {
      this.deathTime += dt; this.kaiju.root.rotation.z = Math.min(Math.PI / 2, this.deathTime * .65); this.kaiju.root.position.y = -Math.min(3, this.deathTime);
      this.fx.update(dt); this.city.update(dt, this.fx);
      if (this.deathTime > 2.8) this.finish();
    }
  }
  loop(now) {
    requestAnimationFrame(this.loop); const dt = Math.min((now - this.last) / 1000, .05); this.last = now;
    this.step(dt); this.renderer.render(this.scene, this.camera);
  }
}

try {
  const game = new Game();
  // Local-only instrumentation for reproducible browser checks; absent on the published URL.
  if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).has("test")) window.testGame = game;
} catch (error) {
  console.error(error); $("loadStatus").textContent = "起動できませんでした。ページを再読み込みしてください。";
}
