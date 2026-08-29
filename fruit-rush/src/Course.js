import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { CONFIG } from "./config.js?v=2";

export class Course {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.courseWidth, CONFIG.courseLength + 30), new THREE.MeshStandardMaterial({ color: 0xedd4a3, roughness: .93 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -CONFIG.courseLength / 2 + 5); this.group.add(ground);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(55, CONFIG.courseLength + 60), new THREE.MeshStandardMaterial({ color: 0x67bd59, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(0, -.05, -CONFIG.courseLength / 2 + 5); this.group.add(grass);
    this.addRails(); this.addFinish(); this.addDecorations();
  }
  addRails() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff5e1, roughness: .6 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(.24, .62, CONFIG.courseLength + 12), mat);
      rail.position.set(side * (CONFIG.courseWidth / 2 + .12), .32, -CONFIG.courseLength / 2 + 5); this.group.add(rail);
      for (let z = 5; z > -CONFIG.courseLength; z -= 8) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.28, 1.1, .28), mat);
        post.position.set(side * (CONFIG.courseWidth / 2 + .12), .55, z); this.group.add(post);
      }
    }
  }
  addFinish() {
    const finish = new THREE.Group(); const postMat = new THREE.MeshStandardMaterial({ color: 0xff5471 });
    for (const x of [-CONFIG.courseWidth / 2, CONFIG.courseWidth / 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.28, 3.4, .28), postMat); post.position.set(x, 1.7, -CONFIG.courseLength + CONFIG.finishPadding); finish.add(post); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.courseWidth + .5, .55, .28), postMat); bar.position.y = 3.2; finish.add(bar);
    finish.position.z = -CONFIG.courseLength + CONFIG.finishPadding; this.group.add(finish);
  }
  addDecorations() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a7049 }); const leafMat = new THREE.MeshStandardMaterial({ color: 0x3c9b54 });
    for (let z = 2; z > -CONFIG.courseLength; z -= 12) for (const side of [-1, 1]) {
      const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17,.22,1.2,7),trunkMat); trunk.position.y=.6; tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.85,10,8),leafMat); crown.position.y=1.55; tree.add(crown);
      tree.position.set(side * (CONFIG.courseWidth/2 + 3 + Math.random()*3),0,z + Math.random()*5); tree.scale.setScalar(.65 + Math.random()*.45); this.group.add(tree);
    }
  }
}
