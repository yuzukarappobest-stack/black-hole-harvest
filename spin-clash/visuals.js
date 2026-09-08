import * as T from './vendor/three.module.js';
const metal = new T.MeshStandardMaterial({ color: 0xcbd4d4, metalness: .75, roughness: .26 });
const dark = new T.MeshStandardMaterial({ color: 0x29393c, metalness: .55, roughness: .4 });
const cylinder = (top, bottom, height, segments = 48) => new T.CylinderGeometry(top, bottom, height, segments);
function mesh(parent, geometry, material, y = 0) { const m = new T.Mesh(geometry, material); m.position.y = y; parent.add(m); m.castShadow = true; return m; }

export function makeTop(data, markerColor) {
  const group = new T.Group(), rotor = new T.Group(); group.add(rotor);
  const color = new T.MeshStandardMaterial({ color: data.color, roughness: .25, metalness: .48 });
  const accent = new T.MeshStandardMaterial({ color: data.accent, roughness: .35, metalness: .3 });
  mesh(rotor, cylinder(.31, .055, .3, 20), dark, .15);
  mesh(rotor, cylinder(.55, .3, .22, 32), color, .36);
  mesh(rotor, cylinder(.76, .63, .12, 48), metal, .52);
  // Swept teeth form a continuous metal attack ring, with colored inlays.
  const shape = new T.Shape();
  for (let i = 0; i < data.blades * 4; i++) {
    const angle = i / (data.blades * 4) * Math.PI * 2;
    const radius = [.73, .87, .88, .67][i % 4];
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 1, steps: 1 }); geometry.rotateX(-Math.PI / 2);
  mesh(rotor, geometry, metal, .61);
  mesh(rotor, cylinder(.56, .6, .14, 32), color, .79);
  for (let i = 0; i < data.blades; i++) {
    const blade = mesh(rotor, new T.BoxGeometry(.17, .06, .42), color, .78);
    const angle = i / data.blades * Math.PI * 2; blade.position.x = Math.sin(angle) * .57; blade.position.z = Math.cos(angle) * .57; blade.rotation.y = angle + .55;
    const screw = mesh(rotor, cylinder(.045, .045, .026, 8), dark, .79); screw.position.set(Math.sin(angle) * .72, .79, Math.cos(angle) * .72);
  }
  const ring = mesh(rotor, new T.TorusGeometry(.36, .045, 8, 40), accent, .9); ring.rotation.x = Math.PI / 2;
  mesh(rotor, cylinder(.29, .32, .08, data.blades), dark, .9);
  const emblem = mesh(rotor, new T.IcosahedronGeometry(.16, 0), accent, .98); emblem.scale.y = .45;
  const marker = mesh(group, new T.RingGeometry(1.01, 1.075, 48), new T.MeshBasicMaterial({ color: markerColor, side: T.DoubleSide, transparent: true, opacity: .85, depthWrite: false }), .035); marker.rotation.x = -Math.PI / 2;
  return { group, rotor, marker };
}

export function disposeTop(top) {
  const materials = new Set();
  top.group.removeFromParent();
  top.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== metal && o.material !== dark) materials.add(o.material); } });
  materials.forEach(m => m.dispose());
}

function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#e0e7de'; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = '#adbeb8'; g.lineWidth = 3;
  for (const r of [110, 285, 440]) { g.beginPath(); g.arc(512, 512, r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24; g.beginPath(); g.moveTo(512 + Math.cos(a) * 452, 512 + Math.sin(a) * 452); g.lineTo(512 + Math.cos(a) * (i % 4 ? 463 : 480), 512 + Math.sin(a) * (i % 4 ? 463 : 480)); g.stroke(); }
  g.lineWidth = 2; g.beginPath(); g.moveTo(512, 45); g.lineTo(512, 979); g.moveTo(45, 512); g.lineTo(979, 512); g.stroke();
  g.fillStyle = '#738f89'; g.font = '900 52px system-ui'; g.textAlign = 'center'; g.fillText('SPIN', 512, 507); g.fillText('CLASH', 512, 560);
  g.fillStyle = '#56bfcb'; g.fillRect(340, 784, 344, 12); g.fillStyle = '#eb8b6f'; g.fillRect(340, 228, 344, 12);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
export function makeArena(scene) {
  const parent = new T.Group(); scene.add(parent);
  const base = new T.MeshStandardMaterial({ color: 0x36464b, roughness: .5, metalness: .3 });
  const trim = new T.MeshStandardMaterial({ color: 0xd7ef8a, roughness: .55 });
  mesh(parent, cylinder(9.15, 8.55, .7, 96), base, -.6);
  const floor = mesh(parent, new T.CircleGeometry(7.2, 96), new T.MeshStandardMaterial({ map: floorTexture(), roughness: .65 }), 0); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  // A shallow raised surround makes ring-outs visible without blocking the playing edge.
  const points = [new T.Vector2(7.2, -.02), new T.Vector2(7.6, .08), new T.Vector2(8.45, .52), new T.Vector2(8.75, .5), new T.Vector2(9, .05)];
  const surround = mesh(parent, new T.LatheGeometry(points, 96), base); surround.receiveShadow = true;
  const border = mesh(parent, new T.TorusGeometry(7.22, .065, 8, 96), new T.MeshStandardMaterial({ color: 0xff9b7e, emissive: 0x9e3d21, emissiveIntensity: .15 }), .018); border.rotation.x = Math.PI / 2;
  const outer = mesh(parent, new T.TorusGeometry(8.57, .095, 8, 96), trim, .52); outer.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const tab = mesh(parent, new T.BoxGeometry(.55, .07, .32), trim, .54); const a = i * Math.PI / 6;
    tab.position.x = Math.sin(a) * 8.4; tab.position.z = Math.cos(a) * 8.4; tab.rotation.y = a;
  }
  const ground = mesh(scene, new T.PlaneGeometry(180, 180), new T.MeshStandardMaterial({ color: 0x20292b, roughness: 1 }), -1.05); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const grid = new T.GridHelper(120, 60, 0x334548, 0x2b383b); grid.position.y = -1.035; scene.add(grid);
  return parent;
}

export class Sparks {
  constructor(scene) {
    this.index = 0; this.items = []; const geometry = new T.SphereGeometry(.055, 4, 3);
    for (let i = 0; i < 90; i++) { const m = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0xffda83, transparent: true })); m.visible = false; scene.add(m); this.items.push({ mesh: m, life: 0, v: new T.Vector3() }); }
  }
  burst(position, amount = 18, color = 0xffe9a7) {
    for (let i = 0; i < amount; i++) { const s = this.items[this.index++ % this.items.length]; s.life = .35 + Math.random() * .25; s.mesh.position.copy(position); s.mesh.position.y = .65; s.mesh.material.color.setHex(color); s.mesh.visible = true; s.v.set((Math.random() - .5) * 12, 2 + Math.random() * 5, (Math.random() - .5) * 12); }
  }
  update(dt) { for (const s of this.items) if (s.life > 0) { s.life -= dt; s.mesh.position.addScaledVector(s.v, dt); s.v.y -= dt * 15; s.mesh.material.opacity = Math.max(0, s.life * 2); if (s.life <= 0) s.mesh.visible = false; } }
  reset() { for (const s of this.items) { s.life = 0; s.mesh.visible = false; } }
}
