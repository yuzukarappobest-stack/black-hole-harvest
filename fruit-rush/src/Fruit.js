import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { FRUIT_LEVELS } from "./config.js?v=2";

const sharedGeometry = new THREE.SphereGeometry(1, 18, 14);

export function fruitData(level) { return FRUIT_LEVELS[Math.min(level - 1, FRUIT_LEVELS.length - 1)]; }

export class Fruit {
  constructor(level, x, z, isPlayer = false) {
    this.level = level;
    this.isPlayer = isPlayer;
    this.mesh = new THREE.Group();
    this.material = new THREE.MeshStandardMaterial({ roughness: .48, metalness: .02 });
    this.body = new THREE.Mesh(sharedGeometry, this.material);
    this.mesh.add(this.body);
    this.leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f9e52, roughness: .75 });
    this.stem = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .30, 7), this.leafMaterial);
    this.stem.position.y = 1.02;
    this.mesh.add(this.stem);
    this.leaf = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), this.leafMaterial);
    this.leaf.scale.set(1.5, .28, .65);
    this.leaf.position.set(.18, 1.08, 0);
    this.mesh.add(this.leaf);
    this.decoration = new THREE.Group();
    this.mesh.add(this.decoration);
    this.setLevel(level);
    this.mesh.position.set(x, this.radius, z);
    this.spin = Math.random() * Math.PI * 2;
    this.alive = true;
  }
  setLevel(level) {
    this.level = Math.min(level, FRUIT_LEVELS.length);
    const data = fruitData(this.level);
    this.radius = data.radius;
    this.material.color.setHex(data.color);
    this.body.scale.setScalar(this.radius);
    this.stem.position.y = this.radius + .09;
    this.leaf.position.y = this.radius + .16;
    this.mesh.position.y = this.radius;
    this.buildDecoration();
  }
  clearDecoration() {
    this.decoration.traverse((item) => item.geometry?.dispose());
    this.decoration.clear();
    this.decorationMaterials?.forEach((material) => material.dispose());
    this.decorationMaterials = [];
  }
  decorationMaterial(color, roughness = .5) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: .01 });
    this.decorationMaterials.push(material); return material;
  }
  addDot(x, y, z, size, color) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 6), this.decorationMaterial(color));
    dot.position.set(x, y, z); this.decoration.add(dot);
  }
  addRing(rotation, radius, tube, color) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 20), this.decorationMaterial(color));
    ring.rotation.copy(rotation); this.decoration.add(ring);
  }
  buildDecoration() {
    this.clearDecoration();
    const r = this.radius;
    if (this.level === 1) {
      this.addDot(-r * .22, r * .32, r * .82, r * .14, 0xffd8d6);
      this.addDot(r * .08, r * .48, r * .72, r * .08, 0xfff3ed);
    } else if (this.level === 2) {
      for (let index = 0; index < 9; index += 1) { const angle = index / 9 * Math.PI * 1.65 + .18; this.addDot(Math.cos(angle) * r * .62, Math.sin(angle) * r * .64, r * .54, r * .055, 0xffe97a); }
    } else if (this.level === 3) {
      this.addDot(-r * .23, r * .29, r * .78, r * .14, 0xe9d9ff);
      this.addDot(r * .10, r * .50, r * .64, r * .07, 0xf7eefe);
    } else if (this.level === 4) {
      for (let index = 0; index < 7; index += 1) { const angle = index / 7 * Math.PI * 1.7; this.addDot(Math.cos(angle) * r * .72, Math.sin(angle) * r * .68, r * .40, r * .05, 0xe47822); }
    } else if (this.level === 5) {
      this.addRing(new THREE.Euler(Math.PI / 2, 0, 0), r * .77, r * .026, 0x9e2738);
      this.addDot(-r * .26, r * .36, r * .76, r * .11, 0xffd7c7);
    } else if (this.level === 6) {
      this.addRing(new THREE.Euler(Math.PI / 2, 0, 0), r * .48, r * .024, 0xe97e98);
      this.addDot(-r * .28, r * .33, r * .77, r * .15, 0xffd9d6);
    } else if (this.level === 7) {
      [-.55, 0, .55].forEach((offset) => this.addRing(new THREE.Euler(Math.PI / 2, 0, 0), r * Math.sqrt(1 - offset * offset), r * .025, 0x5b9c43));
      [-.6, 0, .6].forEach((offset) => this.addRing(new THREE.Euler(0, Math.PI / 2, 0), r * Math.sqrt(1 - offset * offset), r * .025, 0x5b9c43));
    } else {
      [-.62, -.3, 0, .3, .62].forEach((offset) => this.addRing(new THREE.Euler(Math.PI / 2, 0, 0), r * Math.sqrt(1 - offset * offset), r * .05, 0x17693d));
      this.addDot(-r * .27, r * .36, r * .77, r * .13, 0xb8efb0);
    }
  }
  updateRoll(distance, lateral) {
    this.mesh.rotation.x += distance / this.radius;
    this.mesh.rotation.z -= lateral / this.radius;
  }
  dispose() { this.mesh.removeFromParent(); this.clearDecoration(); this.material.dispose(); this.leafMaterial.dispose(); }
}
