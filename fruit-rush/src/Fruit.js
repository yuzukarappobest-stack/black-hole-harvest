import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { FRUIT_LEVELS } from "./config.js?v=1";

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
  }
  updateRoll(distance, lateral) {
    this.mesh.rotation.x += distance / this.radius;
    this.mesh.rotation.z -= lateral / this.radius;
  }
  dispose() { this.mesh.removeFromParent(); this.material.dispose(); this.leafMaterial.dispose(); }
}
