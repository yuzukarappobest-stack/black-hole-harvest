import { Fruit, fruitData } from "./Fruit.js?v=4";
import { CONFIG, FRUIT_LEVELS } from "./config.js?v=8";
import { courseCenterX } from "./coursePath.js?v=1";

export class Player extends Fruit {
  constructor() { super(1, courseCenterX(CONFIG.courseStartZ), CONFIG.courseStartZ, true); this.targetX = 0; this.lastX = 0; }
  reset() { this.targetX = 0; this.lastX = 0; this.mesh.position.set(courseCenterX(CONFIG.courseStartZ), this.radius, CONFIG.courseStartZ); this.setLevel(1); }
  respawn(z) { this.targetX = 0; this.lastX = 0; this.mesh.position.set(courseCenterX(z), this.radius, z); this.mesh.rotation.set(0, 0, 0); }
  move(delta, input, speedScale = 1) {
    this.targetX += input * CONFIG.lateralSpeed * delta;
    const boundary = CONFIG.courseWidth / 2 + this.radius + .9;
    this.targetX = Math.max(-boundary, Math.min(boundary, this.targetX));
    this.mesh.position.z -= CONFIG.forwardSpeed * speedScale * delta;
    const oldX = this.mesh.position.x;
    const desiredX = courseCenterX(this.mesh.position.z) + this.targetX;
    this.mesh.position.x += (desiredX - oldX) * Math.min(1, CONFIG.lateralSmoothing * delta);
    const side = this.mesh.position.x - oldX;
    this.mesh.position.y = this.radius + Math.sin(this.mesh.position.z * 2.8) * .025;
    this.updateRoll(CONFIG.forwardSpeed * speedScale * delta, side);
  }
  evolve() { if (this.level < FRUIT_LEVELS.length) this.setLevel(this.level + 1); return fruitData(this.level); }
  devolve() { if (this.level > 1) this.setLevel(this.level - 1); return fruitData(this.level); }
}
