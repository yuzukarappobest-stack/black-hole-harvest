import { Fruit, fruitData } from "./Fruit.js?v=3";
import { CONFIG, FRUIT_LEVELS } from "./config.js?v=2";

export class Player extends Fruit {
  constructor() { super(1, 0, 4.5, true); this.targetX = 0; this.lastX = 0; }
  reset() { this.targetX = 0; this.lastX = 0; this.mesh.position.set(0, this.radius, 4.5); this.setLevel(1); }
  move(delta, input, speedScale = 1) {
    this.targetX += input * CONFIG.lateralSpeed * delta;
    const boundary = CONFIG.courseWidth / 2 + 1.15;
    this.targetX = Math.max(-boundary, Math.min(boundary, this.targetX));
    const oldX = this.mesh.position.x;
    this.mesh.position.x += (this.targetX - oldX) * Math.min(1, CONFIG.lateralSmoothing * delta);
    const side = this.mesh.position.x - oldX;
    this.mesh.position.z -= CONFIG.forwardSpeed * speedScale * delta;
    this.mesh.position.y = this.radius + Math.sin(this.mesh.position.z * 2.8) * .025;
    this.updateRoll(CONFIG.forwardSpeed * speedScale * delta, side);
  }
  evolve() { if (this.level < FRUIT_LEVELS.length) this.setLevel(this.level + 1); return fruitData(this.level); }
}
