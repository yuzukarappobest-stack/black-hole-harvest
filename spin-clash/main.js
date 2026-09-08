import * as T from './vendor/three.module.js';
import { TOPS, CONFIG } from './config.js?v=2';
import { makeArena, makeTop, disposeTop, Sparks } from './visuals.js';
import { BattlePhysics } from './physics.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const $ = id => document.getElementById(id);
class Game {
  constructor() {
    this.state = 'ready'; this.selected = 0; this.elapsed = 0; this.hits = 0; this.cooldown = 0; this.dashTime = 0; this.enemyDash = 0; this.enemyClock = 3; this.callTime = 0; this.shake = 0; this.outcome = null;
    this.scene = new T.Scene(); this.scene.background = new T.Color(0x191e21); this.scene.fog = new T.Fog(0x191e21, 38, 110);
    this.camera = new T.PerspectiveCamera(44, 1, .1, 160);
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7)); this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    $('app').prepend(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight(0xe4f7ff, 0x53624d, 2.4));
    const sun = new T.DirectionalLight(0xfff5df, 4); sun.position.set(-9, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -11; sun.shadow.camera.right = sun.shadow.camera.top = 11; sun.shadow.camera.far = 50; sun.shadow.normalBias = .03; this.scene.add(sun);
    const rim = new T.DirectionalLight(0x6adaee, 1.7); rim.position.set(8, 5, -10); this.scene.add(rim);
    makeArena(this.scene); this.fx = new Sparks(this.scene); this.physics = new BattlePhysics(); this.audio = new Audio();
    this.input = new Input(this.renderer.domElement, () => this.dash()); this.tops = [];
    this.choose(0); this.resize();
    document.querySelectorAll('[data-top]').forEach(b => b.onclick = () => this.choose(Number(b.dataset.top)));
    $('launch').onclick = () => this.start(); $('retry').onclick = () => this.start();
    $('choose').onclick = () => { this.state = 'ready'; $('result').hidden = true; $('ready').hidden = false; $('hud').hidden = true; this.choose(this.selected); };
    $('dash').addEventListener('pointerdown', event => { event.preventDefault(); this.dash(); });
    $('dash').onclick = () => this.dash(); $('pause').onclick = () => this.pause(); $('resume').onclick = () => this.resume();
    $('sound').onclick = () => { this.audio.unlock(); this.audio.enabled = !this.audio.enabled; $('sound').textContent = `音 ${this.audio.enabled ? 'ON' : 'OFF'}`; $('sound').setAttribute('aria-pressed', String(this.audio.enabled)); };
    window.addEventListener('resize', () => this.resize()); document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); this.pause(); $('resume').disabled = true; $('resume').textContent = '再読み込みしてください'; });
    $('launch').disabled = false; $('launch').textContent = 'バトル開始';
    this.last = performance.now(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    const distance = Math.max(25, 23.5 / this.camera.aspect);
    this.camera.position.set(0, distance * .8, distance * .6); this.camera.lookAt(0, -1, 0); this.camera.updateMatrixWorld();
  }
  choose(index) {
    if (this.state !== 'ready') return;
    this.selected = index; this.types = [TOPS[index], TOPS[(index + 1) % TOPS.length]];
    for (const t of this.tops) disposeTop(t);
    this.tops = this.types.map((type, i) => { const top = makeTop(type, i ? 0xff876c : 0x62deee); this.scene.add(top.group); top.group.position.set(i ? 2.3 : -2.3, 0, i ? -.8 : .8); return top; });
    document.querySelectorAll('[data-top]').forEach(b => { const selected = Number(b.dataset.top) === index; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
  }
  start() {
    if (!['ready', 'finished'].includes(this.state)) return;
    this.audio.unlock(); this.input.reset(); this.fx.reset();
    this.elapsed = 0; this.spin = [100, 100]; this.hits = 0; this.cooldown = 0; this.dashTime = 0; this.enemyDash = 0; this.enemyClock = 3;
    this.dashDirection = { x: 0, z: -1 }; this.enemyDirection = { x: 0, z: 1 }; this.callTime = 0; this.shake = 0; this.outcome = null;
    this.physics.reset(this.types, speed => this.collision(speed));
    this.state = 'countdown'; this.countTime = 2.4; this.countBeep = -1;
    $('ready').hidden = $('result').hidden = $('pauseScreen').hidden = true; $('hud').hidden = false;
    $('yourName').textContent = `YOU / ${this.types[0].name}`; $('enemyName').textContent = `RIVAL / ${this.types[1].name}`;
    this.tops.forEach(t => { t.group.rotation.set(0, 0, 0); t.group.scale.setScalar(1); t.marker.visible = true; });
    this.sync(0); this.updateHUD(); this.audio.launch();
  }
  pause() {
    if (!['running', 'countdown'].includes(this.state)) return;
    this.beforePause = this.state; this.state = 'paused'; this.input.reset(); $('pauseScreen').hidden = false;
  }
  resume() { if (this.state !== 'paused') return; this.state = this.beforePause; this.last = performance.now(); $('pauseScreen').hidden = true; this.audio.unlock(); }
  dash() {
    if (this.state !== 'running' || this.cooldown > 0) return;
    let v = this.input.vector();
    if (Math.hypot(v.x, v.z) < .15) { const a = this.physics.bodies[0].position, b = this.physics.bodies[1].position; const d = Math.hypot(b.x - a.x, b.z - a.z) || 1; v = { x: (b.x - a.x) / d, z: (b.z - a.z) / d }; }
    const d = Math.hypot(v.x, v.z) || 1; this.dashDirection = { x: v.x / d, z: v.z / d };
    this.physics.impulse(0, this.dashDirection.x, this.dashDirection.z, 5.3);
    this.dashTime = CONFIG.dashSeconds; this.cooldown = CONFIG.cooldown; this.audio.dash(); this.say('DASH!', .4);
  }
  collision(speed) {
    if (this.state !== 'running') return;
    const damage = Math.min(15, 2.5 + speed * .48), a = this.types[0], b = this.types[1];
    const playerDamage = damage * b.attack / a.defense * (this.enemyDash > 0 ? 1.4 : 1);
    const enemyDamage = damage * a.attack / b.defense * (this.dashTime > 0 ? 1.55 : 1);
    this.spin[0] = Math.max(0, this.spin[0] - playerDamage); this.spin[1] = Math.max(0, this.spin[1] - enemyDamage);
    this.hits++; const p = this.physics.bodies[0].position, q = this.physics.bodies[1].position;
    this.fx.burst(new T.Vector3((p.x + q.x) / 2, .7, (p.z + q.z) / 2), speed > 7 ? 28 : 16);
    this.shake = Math.min(.35, speed * .025); this.audio.hit(speed);
    this.say(this.dashTime > 0 ? 'SMASH!' : 'CLASH!', .5);
  }
  say(text, seconds) { $('callout').textContent = text; this.callTime = seconds; }
  updateBattle(dt) {
    this.elapsed = Math.min(CONFIG.seconds, this.elapsed + dt);
    this.cooldown = Math.max(0, this.cooldown - dt); this.dashTime = Math.max(0, this.dashTime - dt); this.enemyDash = Math.max(0, this.enemyDash - dt);
    this.enemyClock -= dt;
    const [p, q] = this.physics.bodies.map(b => b.position), distance = Math.hypot(p.x - q.x, p.z - q.z) || 1;
    const toward = { x: (p.x - q.x) / distance, z: (p.z - q.z) / distance };
    let enemy = { x: toward.x, z: toward.z };
    if (Math.hypot(q.x, q.z) > 6.65) { const r = Math.hypot(q.x, q.z); enemy = { x: -q.x / r, z: -q.z / r }; }
    else if (distance < 2.8 && Math.sin(this.elapsed * 1.7) > .15) {
      enemy = { x: -toward.x * .5 + toward.z * .9, z: -toward.z * .5 - toward.x * .9 };
    } else { const sway = Math.sin(this.elapsed * 1.4) * .22; enemy.x += toward.z * sway; enemy.z -= toward.x * sway; }
    if (this.enemyClock <= 0 && distance < 4.8 && distance > 2.1) { this.enemyDirection = toward; this.enemyDash = .28; this.enemyClock = 4.6; this.physics.impulse(1, toward.x, toward.z, 3); }
    const v = this.dashTime > 0 ? this.dashDirection : this.input.vector();
    this.physics.accelerate(0, v.x, v.z, this.types[0].speed * (this.dashTime > 0 ? 1.7 : 1), dt, this.dashTime > 0);
    const e = this.enemyDash > 0 ? this.enemyDirection : enemy;
    this.physics.accelerate(1, e.x, e.z, this.types[1].speed * (this.enemyDash > 0 ? 1.25 : .67), dt, this.enemyDash > 0);
    this.physics.step(dt);
    this.spin = this.spin.map(s => Math.max(0, s - dt * CONFIG.naturalDrain));
    const out = [this.physics.outside(0), this.physics.outside(1)];
    if (out.some(Boolean)) { this.end(out[0] && out[1] ? null : out[1], 'ring', out); return; }
    if (this.spin.some(s => s <= 0)) { this.end(this.spin[0] === 0 && this.spin[1] === 0 ? null : this.spin[1] === 0, 'spin'); return; }
    if (this.elapsed >= CONFIG.seconds) { const diff = this.spin[0] - this.spin[1]; this.end(Math.abs(diff) < .5 ? null : diff > 0, 'time'); }
  }
  sync(dt) {
    for (let i = 0; i < 2; i++) {
      const top = this.tops[i], body = this.physics.bodies[i], stamina = this.spin?.[i] ?? 100;
      if (body) top.group.position.set(body.position.x, 0, body.position.z);
      const shake = Math.max(0, 1 - stamina / 55) * .15;
      top.rotor.rotation.y += dt * (10 + stamina * .48) * (i ? -1 : 1);
      top.rotor.rotation.x = Math.sin(this.elapsed * 17 + i) * shake; top.rotor.rotation.z = Math.cos(this.elapsed * 17 + i) * shake;
      top.marker.material.opacity = .55 + Math.sin(this.elapsed * 5) * .2;
      if (this.state === 'ending') {
        if (this.outcome.out[i]) { const v = body.velocity; top.group.position.x += v.x * this.endTime * .45; top.group.position.z += v.z * this.endTime * .45; top.group.position.y = Math.sin(this.endTime / 1.45 * Math.PI) * 1.8 - this.endTime * .5; top.rotor.rotation.z += this.endTime * 3; top.marker.visible = false; }
        else if (this.outcome.loser === i) { top.rotor.rotation.z = Math.min(1.3, this.endTime); top.rotor.rotation.y -= dt * (10 + stamina * .48) * (i ? -1 : 1); }
      }
    }
  }
  updateHUD() {
    $('time').textContent = Math.max(0, CONFIG.seconds - this.elapsed).toFixed(1);
    for (const [i, prefix] of ['your', 'enemy'].entries()) { $(prefix + 'Spin').textContent = Math.ceil(this.spin[i]); $(prefix + 'Bar').style.width = `${this.spin[i]}%`; }
    $('dash').disabled = this.state !== 'running' || this.cooldown > 0; $('cooldown').textContent = this.cooldown > 0 ? `${this.cooldown.toFixed(1)}s` : 'READY';
  }
  end(win, reason, out = [false, false]) {
    if (this.state !== 'running') return;
    this.state = 'ending'; this.endTime = 0; this.outcome = { win, reason, out, loser: win === null ? -1 : win ? 1 : 0 }; this.input.reset();
    this.say(reason === 'ring' ? 'RING OUT!' : reason === 'spin' ? 'SPIN FINISH!' : 'TIME UP!', 2);
    this.audio.finish(win === true); $('dash').disabled = true;
  }
  showResult() {
    this.state = 'finished'; $('hud').hidden = true; $('result').hidden = false;
    const { win, reason } = this.outcome;
    $('resultTitle').textContent = win === null ? 'DRAW' : win ? 'YOU WIN!' : 'YOU LOSE';
    $('reason').textContent = reason === 'ring' ? 'リングアウトで決着！' : reason === 'spin' ? '回転停止で決着！' : '残った回転力で判定';
    $('resultTime').textContent = this.elapsed.toFixed(1); $('summary').textContent = `ぶつかった回数 ${this.hits} / 残り回転力 ${Math.ceil(this.spin[0])}`;
    let text = win ? '勝利！' : '次のバトルへ！';
    try { const key = `${CONFIG.bestKey}.${this.selected}`, best = Number(localStorage.getItem(key)); if (win === true && (!best || this.elapsed < best)) { localStorage.setItem(key, String(this.elapsed)); text = '最速勝利！'; } else if (best) text = `最速勝利 ${best.toFixed(1)}秒`; } catch { /* The battle still completes when storage is unavailable. */ }
    $('best').textContent = text;
  }
  step(dt) {
    if (this.state === 'paused' || this.state === 'finished') return;
    this.callTime -= dt; if (this.callTime <= 0) $('callout').textContent = '';
    this.shake = Math.max(0, this.shake - dt * 1.4); this.fx.update(dt);
    if (this.state === 'ready') { this.tops.forEach((t, i) => t.rotor.rotation.y += dt * (i ? -5 : 7)); return; }
    if (this.state === 'countdown') {
      this.countTime -= dt; const n = Math.ceil(this.countTime / .8);
      $('countdown').textContent = String(Math.max(1, n));
      if (n !== this.countBeep) { this.countBeep = n; this.audio.tone(500 + (3 - n) * 100, .09); }
      if (this.countTime <= 0) { this.state = 'running'; $('countdown').textContent = ''; this.physics.bodies[0].velocity.set(1.4, 0, -3.2); this.physics.bodies[1].velocity.set(-1.4, 0, 3.2); this.say('GO SHOOT!', .7); }
    } else if (this.state === 'running') this.updateBattle(dt);
    else if (this.state === 'ending') { this.endTime += dt; if (this.endTime >= 1.45) this.showResult(); }
    this.sync(dt); this.updateHUD();
  }
  loop(now) {
    requestAnimationFrame(this.loop); const dt = Math.min(.05, (now - this.last) / 1000); this.last = now; this.step(dt);
    const x = this.camera.position.x; this.camera.position.x += (Math.random() - .5) * this.shake; this.renderer.render(this.scene, this.camera); this.camera.position.x = x;
  }
}

try {
  const game = new Game();
  if (['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('test')) window.testGame = game;
} catch (error) { console.error(error); $('loading').textContent = '起動できませんでした。ページを再読み込みしてください。'; }
