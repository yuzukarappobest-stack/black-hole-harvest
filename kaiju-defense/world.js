import * as T from "./vendor/three.module.js";

const box = new T.BoxGeometry(1, 1, 1);
export function block(parent, material, x, y, z, w, h, d) {
  const m = new T.Mesh(box, material); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m;
}
const mat = color => new T.MeshStandardMaterial({ color, roughness: .85 });
function facade(color) {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 256;
  const c = canvas.getContext("2d"); c.fillStyle = color; c.fillRect(0, 0, 128, 256);
  for (let y = 7; y < 250; y += 19) for (let x = 7; x < 120; x += 20) {
    c.fillStyle = Math.random() < .22 ? "#f9d5a0" : "#304e5d"; c.fillRect(x, y, 10, 11);
    c.fillStyle = "#ffffff30"; c.fillRect(x, y, 10, 2);
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  return new T.MeshStandardMaterial({ map: texture, roughness: .85 });
}
export class City {
  constructor(scene) {
    this.scene = scene; this.buildings = []; this.count = 0;
    this.facades = ["#a4babd", "#80979d", "#d1bcb0", "#a5aca2"].map(facade);
    this.roof = mat(0x677d83); this.rubble = mat(0x7d8988);
    const ground = block(scene, mat(0x43555a), 0, -.3, 0, 220, .5, 220);
    ground.receiveShadow = true;
    const pavement = mat(0x859596), line = new T.MeshBasicMaterial({ color: 0xe7d8aa });
    for (const x of [-12, 12]) block(scene, pavement, x, 0, 0, 1, .15, 196);
    for (let z = -100; z < 100; z += 9) block(scene, line, 0, -.025, z, .17, .04, 4);
    for (let x = -90; x < 100; x += 4) for (const z of [-8, 8]) block(scene, line, x, .005, z, 1.9, .02, 2.5);
    // Keep the main avenue and crossing open; blocks flank both sides.
    for (const side of [-1, 1]) for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) {
      const z = -83 + row * 24; if (Math.abs(z) < 13) continue;
      const x = side * (22 + col * 22), height = 10 + Math.random() * 21;
      const mesh = block(scene, this.facades[(row + col) % 4], x, height / 2, z, 12 + Math.random() * 4, height, 13);
      mesh.castShadow = true;
      const roof = block(mesh, this.roof, 0, .51, 0, .65, .025, .65);
      const b = { mesh, x, z, w: mesh.scale.x, d: 13, height, hp: 72, alive: true, falling: false, fall: 0 };
      mesh.userData.building = b; this.buildings.push(b);
    }
    const trunk = mat(0x776956), leaf = mat(0x568573), lamp = mat(0x344d58);
    const crown = new T.IcosahedronGeometry(1.4, 0);
    for (let z = -80; z <= 80; z += 16) for (const x of [-14, 14]) {
      block(scene, trunk, x, 1.1, z, .3, 2.2, .3);
      const tree = new T.Mesh(crown, leaf); tree.position.set(x, 3, z); tree.scale.y = 1.3; scene.add(tree);
      block(scene, lamp, x * .85, 3.1, z + 6, .13, 6.2, .13);
      block(scene, mat(0xffe8b3), x * .85, 6.2, z + 6, 1.1, .15, .45);
    }
    const carColors = [mat(0xe4b660), mat(0xc6d4d6), mat(0x8ba3b9), mat(0xbc715b)];
    for (let i = 0; i < 14; i++) {
      const x = i % 2 ? 9 : -9, z = -78 + i * 12;
      block(scene, carColors[i % 4], x, .6, z, 1.7, .9, 3.6);
      block(scene, mat(0x344b58), x, 1.25, z, 1.5, .55, 1.8);
    }
  }
  hit(building, amount, fx) {
    if (!building.alive) return false;
    building.hp -= amount;
    if (building.hp > 0) return false;
    building.alive = false; building.falling = true; this.count++;
    fx.burst(new T.Vector3(building.x, 3, building.z), 0xc1b7a1, 25, 7);
    return true;
  }
  crush(position, radius, fx) {
    let crushed = false;
    for (const b of this.buildings) if (b.alive && Math.hypot(b.x - position.x, b.z - position.z) < radius + b.w / 2) crushed = this.hit(b, 999, fx) || crushed;
    return crushed;
  }
  update(dt, fx) {
    for (const b of this.buildings) if (b.falling) {
      b.fall = Math.min(1, b.fall + dt * .6);
      b.mesh.scale.y = b.height * Math.max(.045, 1 - b.fall);
      b.mesh.position.y = b.mesh.scale.y / 2;
      b.mesh.rotation.z = Math.sin(b.fall * 20) * .025 * (1 - b.fall);
      if (b.fall >= 1) { b.falling = false; b.mesh.material = this.rubble; b.mesh.rotation.z = 0; }
    }
  }
  blocked(x, z, radius = .65) {
    return this.buildings.some(b => b.alive && Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius);
  }
  reset() {
    this.count = 0;
    this.buildings.forEach((b, i) => { b.alive = true; b.falling = false; b.fall = 0; b.hp = 72; b.mesh.position.y = b.height / 2; b.mesh.scale.y = b.height; b.mesh.rotation.set(0, 0, 0); b.mesh.material = this.facades[Math.floor(i / 3) % 4]; });
  }
}

export class Effects {
  constructor(scene) {
    this.particles = []; this.tracers = []; this.index = 0;
    const geometry = new T.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 140; i++) {
      const m = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0xffd896, transparent: true })); m.visible = false; scene.add(m);
      this.particles.push({ mesh: m, velocity: new T.Vector3(), life: 0, max: 1 });
    }
    for (let i = 0; i < 16; i++) {
      const g = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
      const line = new T.Line(g, new T.LineBasicMaterial({ color: 0xffe3a2, transparent: true, opacity: .9 })); scene.add(line); line.visible = false;
      this.tracers.push({ line, life: 0 });
    }
  }
  tracer(a, b) { const t = this.tracers.find(t => t.life <= 0) || this.tracers[0]; const p = t.line.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; t.line.geometry.computeBoundingSphere(); t.life = .065; t.line.visible = true; }
  burst(point, color, count = 5, power = 2) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.index++ % this.particles.length]; p.mesh.position.copy(point); p.mesh.material.color.setHex(color); p.mesh.scale.setScalar(.1 + Math.random() * power * .12); p.mesh.visible = true;
      p.velocity.set((Math.random() - .5) * power, Math.random() * power + 1, (Math.random() - .5) * power); p.life = p.max = .35 + Math.random() * .7;
    }
  }
  update(dt) {
    for (const p of this.particles) if (p.life > 0) { p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 6; p.mesh.material.opacity = Math.max(0, p.life / p.max); if (p.life <= 0) p.mesh.visible = false; }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
  }
  reset() { for (const p of this.particles) { p.life = 0; p.mesh.visible = false; } for (const t of this.tracers) { t.life = 0; t.line.visible = false; } }
}
