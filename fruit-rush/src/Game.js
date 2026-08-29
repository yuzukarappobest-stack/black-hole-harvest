import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { CONFIG, FRUIT_LEVELS } from "./config.js";
import { Fruit, fruitData } from "./Fruit.js";
import { Player } from "./Player.js";
import { Course } from "./Course.js";
import { InputManager } from "./InputManager.js";
import { UI } from "./UI.js";
import { AudioManager } from "./Audio.js";

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
    this.state = "ready"; this.score = 0; this.fruits = []; this.particles = [];
    this.addLights(); this.course = new Course(this.scene); this.player = new Player(); this.scene.add(this.player.mesh);
    window.addEventListener("resize", () => this.resize()); this.resize();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  addLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x489c51, 2.3); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d0, 2.2); sun.position.set(-5, 12, 6); this.scene.add(sun);
  }
  resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
  start() {
    this.clearFruits(); this.clearParticles(); this.player.reset(); this.score = 0; this.state = "running";
    this.spawnFruits(); this.clock.start(); this.ui.showGame(); this.updateUI();
  }
  spawnFruits() {
    const guaranteed = [1, 2, 3, 4, 5, 6, 7];
    guaranteed.forEach((level, index) => this.addFruit(level, index % 2 ? -1.35 : 1.35, -19 - index * 29));
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
  clearFruits() { this.fruits.forEach((fruit) => fruit.dispose()); this.fruits.length = 0; }
  clearParticles() { this.particles.forEach((item) => item.mesh.removeFromParent()); this.particles.length = 0; }
  update(delta) {
    this.player.move(delta, this.input.direction);
    const p = this.player.mesh.position;
    this.camera.position.lerp(new THREE.Vector3(p.x * .34, CONFIG.cameraHeight, p.z + CONFIG.cameraDistance), Math.min(1, delta * 5));
    this.camera.lookAt(p.x * .2, .6, p.z - 8);
    this.checkCollisions(); this.updateParticles(delta);
    if (Math.abs(p.x) > CONFIG.courseWidth / 2 + this.player.radius + .25) this.end("over");
    if (p.z <= -CONFIG.courseLength + CONFIG.finishPadding) this.end("finish");
    this.updateUI();
  }
  checkCollisions() {
    const playerPosition = this.player.mesh.position;
    for (const fruit of this.fruits) {
      if (!fruit.alive || fruit.mesh.position.distanceToSquared(playerPosition) > (fruit.radius + this.player.radius) ** 2) continue;
      if (fruit.level === this.player.level) this.merge(fruit);
      else { const push = Math.sign(fruit.mesh.position.x - playerPosition.x) || 1; fruit.mesh.position.x += push * .14; }
    }
  }
  merge(fruit) {
    fruit.alive = false; fruit.dispose(); this.fruits = this.fruits.filter((item) => item !== fruit);
    const gained = fruitData(this.player.level).score; this.score += gained; const data = this.player.evolve();
    this.spawnBurst(); this.ui.merge(gained); this.audio.merge();
    this.player.mesh.scale.setScalar(1.18); setTimeout(() => { if (this.state === "running") this.player.mesh.scale.setScalar(1); }, 150);
    this.updateUI(data);
  }
  spawnBurst() {
    const material = new THREE.MeshBasicMaterial({ color: 0xfff4a6 });
    for (let index = 0; index < 12; index += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.09, 5, 4), material.clone());
      mesh.position.copy(this.player.mesh.position); const angle = index / 12 * Math.PI * 2; this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(Math.cos(angle) * (1.8 + Math.random()), .9 + Math.random() * 1.8, Math.sin(angle) * 1.5), life: .46 });
    }
  }
  updateParticles(delta) { this.particles = this.particles.filter((item) => { item.life -= delta; item.mesh.position.addScaledVector(item.velocity, delta); item.velocity.y -= 5 * delta; item.mesh.material.opacity = Math.max(0, item.life * 2); item.mesh.material.transparent = true; if (item.life <= 0) { item.mesh.material.dispose(); item.mesh.removeFromParent(); return false; } return true; }); }
  updateUI() { const data = fruitData(this.player.level); const percent = Math.max(0, Math.min(100, (-this.player.mesh.position.z + 4.5) / CONFIG.courseLength * 100)); this.ui.update(this.score, data, percent); }
  end(kind) { if (this.state !== "running") return; this.state = kind; this.clock.stop(); const data = fruitData(this.player.level); this.ui.endGame(kind, this.score, data); kind === "finish" ? this.audio.finish() : this.audio.over(); }
  loop() { const delta = Math.min(this.clock.getDelta(), .05); if (this.state === "running") this.update(delta); this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.loop); }
}
