import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { CONFIG } from "./config.js?v=5";
import { courseCenterX, courseOffsetPoint, courseYaw } from "./coursePath.js?v=1";

export class Course {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(55, CONFIG.courseLength + 60), new THREE.MeshStandardMaterial({ color: 0x67bd59, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(0, -.05, -CONFIG.courseLength / 2 + 5); this.group.add(grass);
    this.roadMaterial = new THREE.MeshStandardMaterial({ color: 0xedd4a3, roughness: .93 });
    this.addRoadAndRails(); this.addFinish(); this.addDecorations();
  }
  addRoadAndRails() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff5e1, roughness: .6 });
    const step = 7;
    for (let z = CONFIG.courseStartZ; z > -CONFIG.courseLength - 4; z -= step) {
      const centerZ = z - step / 2; const yaw = courseYaw(centerZ);
      const road = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.courseWidth, .12, step + .28), this.roadMaterial);
      road.position.set(courseCenterX(centerZ), 0, centerZ); road.rotation.y = yaw; this.group.add(road);
      for (const side of [-1, 1]) {
        const railPoint = courseOffsetPoint(centerZ, side * (CONFIG.courseWidth / 2 + .12));
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.24, .62, step + .35), mat);
        rail.position.set(railPoint.x, .32, railPoint.z); rail.rotation.y = yaw; this.group.add(rail);
      }
      if (Math.round((CONFIG.courseStartZ - z) / step) % 2 === 0) for (const side of [-1, 1]) {
        const postPoint = courseOffsetPoint(z, side * (CONFIG.courseWidth / 2 + .12));
        const post = new THREE.Mesh(new THREE.BoxGeometry(.28, 1.1, .28), mat);
        post.position.set(postPoint.x, .55, postPoint.z); this.group.add(post);
      }
    }
  }
  addFinish() {
    const z = -CONFIG.courseLength + CONFIG.finishPadding; const postMat = new THREE.MeshStandardMaterial({ color: 0xff5471 });
    for (const side of [-1, 1]) { const point = courseOffsetPoint(z, side * CONFIG.courseWidth / 2); const post = new THREE.Mesh(new THREE.BoxGeometry(.28, 3.4, .28), postMat); post.position.set(point.x, 1.7, point.z); this.group.add(post); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.courseWidth + .5, .55, .28), postMat); bar.position.set(courseCenterX(z), 3.2, z); bar.rotation.y = courseYaw(z); this.group.add(bar);
  }
  addDecorations() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a7049 }); const leafMat = new THREE.MeshStandardMaterial({ color: 0x3c9b54 });
    for (let z = 2; z > -CONFIG.courseLength; z -= 12) for (const side of [-1, 1]) {
      const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17,.22,1.2,7),trunkMat); trunk.position.y=.6; tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.85,10,8),leafMat); crown.position.y=1.55; tree.add(crown);
      const point = courseOffsetPoint(z + Math.random() * 5, side * (CONFIG.courseWidth / 2 + 3 + Math.random() * 3));
      tree.position.set(point.x,0,point.z); tree.scale.setScalar(.65 + Math.random()*.45); this.group.add(tree);
    }
  }
}
