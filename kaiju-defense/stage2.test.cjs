const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = filename => fs.readFileSync(__dirname + '/' + filename, 'utf8');
const html = read('index.html');
const source = read('main.js');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
for (const id of ['stage1Choice', 'stage2Choice', 'stageUnlockHint', 'stageClear', 'nextStage', 'stage1Time', 'bossName', 'districtName', 'districtSub', 'finishTitle']) {
  assert.ok(ids.includes(id), `Missing ${id}`);
}
assert.match(html, /stage2\.css\?v=1/);
assert.match(html, /main\.js\?v=4/);
assert.match(read('world.js'), /wide \? 370 : 220/);
assert.match(read('actors.js'), /function flyingMonster/);

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setY(y) { this.y = y; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const length = this.length() || 1; this.x /= length; this.y /= length; this.z /= length; return this; }
  distanceTo(v) { return this.clone().sub(v).length(); }
  lerp(v, fraction) { return this.addScaledVector(v.clone().sub(this), fraction); }
}
class Group {
  constructor() {
    this.position = new Vec3();
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.scale = { x: 1, y: 1, z: 1, setScalar(n) { this.x = this.y = this.z = n; } };
    this.quaternion = { setFromUnitVectors() {} };
    this.visible = true; this.children = [];
  }
  add(child) { this.children.push(child); child.parent = this; }
  updateMatrixWorld() {}
}
class Mesh extends Group { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
class Camera extends Group { updateProjectionMatrix() {} lookAt() {} }
class Renderer { constructor() { this.shadowMap = {}; this.domElement = { addEventListener() {} }; } setPixelRatio() {} setSize() {} render() {} }
class Raycaster {
  set() {} intersectObjects() { return []; }
  setFromCamera() { this.ray = { at(n, v) { return v.set(0, 0, -n); } }; }
}
const T = {
  Scene: Group, Group, Mesh, Vector2: class {}, Vector3: Vec3, Raycaster,
  WebGLRenderer: Renderer, PerspectiveCamera: Camera,
  Color: class {}, Fog: class {}, HemisphereLight: class {},
  DirectionalLight: class extends Group { constructor() { super(); this.shadow = { mapSize: { set() {} }, camera: {} }; } },
  RingGeometry: class {}, CylinderGeometry: class {},
  MeshBasicMaterial: class { constructor(options) { Object.assign(this, options); } },
  MathUtils: { clamp(n, min, max) { return Math.max(min, Math.min(max, n)); } },
  PCFSoftShadowMap: 1, SRGBColorSpace: 1, ACESFilmicToneMapping: 1, DoubleSide: 1,
};
class City {
  constructor(parent, stage = 1) { this.parent = parent; this.stage = stage; this.count = 0; this.buildings = []; }
  reset() { this.count = 0; }
  blocked() { return false; }
  crush() { return false; }
  update() {}
}
class Effects { reset() {} tracer() {} burst() {} update() {} }
const actor = () => ({ root: new Group(), body: new Group(), head: new Group(), limbs: [],
  wings: [new Group(), new Group()], tail: new Group(), legs: [],
  muzzle: { getWorldPosition(v) { v.set(0, 2, 0); } },
  mouth: { getWorldPosition(v) { v.set(0, 20, 0); } } });
const soldier = actor, monster = actor, flyingMonster = actor;
class Input { constructor() { this.yaw = 0; this.pitch = 0; } reset() {} vector() { return { x: 0, y: 0 }; } }
class Sound { unlock() {} roar() {} clear() {} boom() {} shot() {} }

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, String(value)); },
};
const elements = new Map();
function element() {
  const classes = new Set();
  return { style: {}, hidden: false, textContent: '', disabled: false, firstChild: { textContent: '' },
    classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } },
    setAttribute() {}, addEventListener() {}, prepend() {}, querySelector() { return { textContent: '' }; } };
}
const document = { body: element(), getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, addEventListener() {} };
const window = { devicePixelRatio: 1, addEventListener() {}, location: { replace() {} } };
const CONFIG = { monsterHealth: 5600, bulletDamage: 12, shotInterval: .105, walkSpeed: 11,
  monsterSpeed: 1.2, attackInterval: 6.5, knockdownSeconds: 1.5, mapLimit: 89, bestKey: 'kaijuDefense.best.v1' };
const STAGES = {
  1: { district: 'BAY DISTRICT', subtitle: '湾岸防衛線', boss: '巨獣 ヴォルガ', health: 5600, limit: 89, walkSpeed: 11, playerZ: 42, monsterZ: -26, bestKey: CONFIG.bestKey },
  2: { district: 'SKY DISTRICT', subtitle: '広域迎撃戦', boss: '翼獣 アルカ', health: 4200, limit: 167, walkSpeed: 14, playerZ: 90, monsterZ: -20, altitude: 19, bestKey: 'kaijuDefense.best.stage2.v1' },
};
const STAGE_TWO_UNLOCK = 'kaijuDefense.stage2Unlocked.v1';
const formatTime = n => `${n.toFixed(1)}s`;
const gameClass = source.slice(0, source.lastIndexOf('\ntry {'))
  .replace(/^import .*;\s*$/gm, '') + '\nglobalThis.__Game = Game;';
const context = { T, City, Effects, soldier, monster, flyingMonster, Input, Sound, CONFIG, STAGES, STAGE_TWO_UNLOCK,
  formatTime, learningUrl: '../learn.html', document, window, localStorage, performance: { now: () => 0 }, requestAnimationFrame() {},
  innerWidth: 390, innerHeight: 844, Math, console };
vm.runInNewContext(gameClass, context);
const Game = context.__Game;
const g = new Game();
assert.equal(g.stage, 1);
assert.equal(g.stageTwoUnlocked, false);
assert.equal(document.getElementById('stage2Choice').disabled, true);
g.start(1);
assert.equal(g.state, 'running');
assert.equal(g.maxHealth, 5600);
g.hp = 0; g.win(); g.step(3);
assert.equal(g.state, 'stageclear');
assert.equal(g.stageTwoUnlocked, true);
assert.equal(storage.get(STAGE_TWO_UNLOCK), '1');
assert.ok(Number(storage.get(CONFIG.bestKey)) >= 0);
assert.equal(document.getElementById('stageClear').hidden, false);
g.start(2);
assert.equal(g.state, 'running');
assert.equal(g.stage, 2);
assert.equal(g.maxHealth, 4200);
assert.equal(g.city.stage, 2);
assert.equal(g.player.root.position.z, 90);
assert.equal(g.kaiju.root.position.y, 19);
assert.equal(document.getElementById('stageClear').hidden, true);
g.elapsed = 1; g.updateMonster(.1);
assert.ok(g.kaiju.root.position.y > 10);
assert.ok(g.kaiju.wings.some(w => w.rotation.z !== 0));
g.beginAttack();
assert.equal(g.attack.type, 'skybeam');
assert.equal(g.attack.radius, 12);
g.updateAttack(1.9);
assert.equal(g.attack.fired, true);
g.hp = 0; g.win(); g.step(3);
assert.equal(g.state, 'finished');
assert.equal(document.getElementById('finishTitle').textContent, '翼獣、撃破！');
assert.equal(storage.has(STAGES[2].bestKey), true);
const replay = new Game();
assert.equal(replay.stageTwoUnlocked, true);
replay.selectStage(2);
replay.start(2);
assert.equal(replay.stage, 2);
console.log('OK: stage 1 clear, stage 2 unlock, wide map, flying enemy, aerial attack, final clear and direct replay');
