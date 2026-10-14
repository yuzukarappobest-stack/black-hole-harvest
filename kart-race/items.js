import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import {CIRCUIT_LENGTH, sampleAt} from "./track.js?v=4";

// Pickups stay at known positions on the racing surface and reset each lap.
const LANES = [-2.3,2.3]; // Two easily reachable items each lap.
const COLLECT_RADIUS = 3.5;

export function createDashPickups(scene) {
  const ringGeometry = new THREE.TorusGeometry(1.12,.16,7,20);
  const coreGeometry = new THREE.OctahedronGeometry(.79,0);
  const boltShape = new THREE.Shape();
  boltShape.moveTo(-.15,.67);
  boltShape.lineTo(.34,.67);
  boltShape.lineTo(.04,.09);
  boltShape.lineTo(.42,.09);
  boltShape.lineTo(-.32,-.7);
  boltShape.lineTo(-.13,-.08);
  boltShape.lineTo(-.42,-.08);
  boltShape.closePath();
  const boltGeometry = new THREE.ShapeGeometry(boltShape);
  const ringMaterial = new THREE.MeshBasicMaterial({color:0xffe64c});
  const coreMaterial = new THREE.MeshStandardMaterial({
    color:0x43d7ff,emissive:0x16a8ff,emissiveIntensity:.75,
    metalness:.15,roughness:.24
  });
  const boltMaterial = new THREE.MeshBasicMaterial({
    color:0xffffff,side:THREE.DoubleSide
  });
  return LANES.map((lane,index)=>{
    const along=(index+.5)*CIRCUIT_LENGTH/LANES.length;
    const track=sampleAt(along);
    const root=new THREE.Group();
    const ring=new THREE.Mesh(ringGeometry,ringMaterial);
    const core=new THREE.Mesh(coreGeometry,coreMaterial);
    const bolt=new THREE.Mesh(boltGeometry,boltMaterial);
    // Two lightning-bolt faces remain readable from both approaches.
    bolt.position.z=.82;
    const backBolt=bolt.clone();
    backBolt.position.z=-.82;
    root.add(ring,core,bolt,backBolt);
    root.position.set(
      track.position.x+track.right.x*lane,
      1.9,
      track.position.z+track.right.z*lane
    );
    scene.add(root);
    return {mesh:root,index,lane,collectedLap:-1,
      x:root.position.x,z:root.position.z};
  });
}

export function resetDashPickups(items) {
  for(const item of items) {
    item.collectedLap=-1;
    item.mesh.visible=true;
  }
}

export function updateDashPickups(items,position,elapsed,dt,lap,collect) {
  for(const item of items) {
    const picked=item.collectedLap===lap;
    item.mesh.visible=!picked;
    if(picked)continue;
    item.mesh.position.y=1.9+Math.sin(elapsed*3.8+item.index*.7)*.23;
    item.mesh.rotation.y+=dt*1.8;
    const dx=position.x-item.x,dz=position.z-item.z;
    if(dx*dx+dz*dz<COLLECT_RADIUS*COLLECT_RADIUS && collect()) {
      item.collectedLap=lap;
      item.mesh.visible=false;
    }
  }
}
