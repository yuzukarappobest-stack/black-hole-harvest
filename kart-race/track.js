import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

// A genuinely closed, arc-length-sampled circuit. All six karts share this path.
export const ROAD_WIDTH = 22;
export const SAMPLES = 640;
const controlPoints = [
  [0,100], [68,114], [142,85], [170,27], [160,-45],
  [108,-108], [42,-93], [-21,-117], [-108,-108],
  [-177,-50], [-170,34], [-112,101], [-47,89],
].map(([x,z]) => new THREE.Vector3(x,0,z));
const spline = new THREE.CatmullRomCurve3(controlPoints,true,"centripetal",.45);
export const CIRCUIT_LENGTH = spline.getLength();
export const SEGMENT_LENGTH = CIRCUIT_LENGTH/SAMPLES;
const points = spline.getSpacedPoints(SAMPLES).slice(0,SAMPLES);
const wrap = (i) => ((i%SAMPLES)+SAMPLES)%SAMPLES;
export const modulus = (x,n) => ((x%n)+n)%n;

export function sampleAt(distance) {
  const f = modulus(distance,CIRCUIT_LENGTH)/SEGMENT_LENGTH;
  const i = Math.floor(f), t=f-i, j=wrap(i+1);
  const p = points[i].clone().lerp(points[j],t);
  const ahead = points[wrap(i+2)].clone().sub(points[wrap(i)]).normalize();
  const behind = points[wrap(i+1)].clone().sub(points[wrap(i-1)]).normalize();
  const tangent = behind.lerp(ahead,t).normalize();
  const right = new THREE.Vector3(-tangent.z,0,tangent.x);
  // yaw denotes compass-like motion (+yaw drives toward +X).
  // A Three.js mesh whose nose points toward local -Z must render at -yaw.
  return {position:p,tangent,right,yaw:Math.atan2(tangent.x,-tangent.z)};
}

// Search near the previous projection to prevent shortcuts / jumping across nearby bends.
export function projectOnCircuit(position,lastIndex=null) {
  let best=null;
  const count=lastIndex===null?SAMPLES:67;
  for(let n=0;n<count;n++) {
    const i=lastIndex===null?n:wrap(lastIndex+n-33), j=wrap(i+1);
    const a=points[i], b=points[j];
    const vx=b.x-a.x,vz=b.z-a.z,dx=position.x-a.x,dz=position.z-a.z;
    const t=Math.max(0,Math.min(1,(dx*vx+dz*vz)/(vx*vx+vz*vz)));
    const px=a.x+t*vx,pz=a.z+t*vz;
    const squared=(px-position.x)**2+(pz-position.z)**2;
    if(!best||squared<best.squared) {
      const mag=Math.hypot(vx,vz)||1;
      best={index:i,s:modulus((i+t)*SEGMENT_LENGTH,CIRCUIT_LENGTH),
        lateral:((position.x-px)*(-vz)+(position.z-pz)*vx)/mag,
        squared,center:new THREE.Vector3(px,0,pz)};
    }
  }
  return best;
}

function ribbon(inner,outer,height,material,colorAlternation=false) {
  const vertices=[],colors=[],indices=[];
  const white=new THREE.Color(0xf6f3e8),red=new THREE.Color(0xf05d5c);
  for(let i=0;i<SAMPLES;i++) {
    const s=i*SEGMENT_LENGTH, p=sampleAt(s);
    for(const offset of [inner,outer]) {
      vertices.push(p.position.x+p.right.x*offset,height,p.position.z+p.right.z*offset);
      const col=colorAlternation?(Math.floor(s/10)%2===0?red:white):white;
      colors.push(col.r,col.g,col.b);
    }
    const a=i*2,b=((i+1)%SAMPLES)*2;
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  if(colorAlternation)g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();
  return new THREE.Mesh(g,material);
}

export function buildCircuit(scene) {
  const green=new THREE.MeshStandardMaterial({color:0x5fae66,roughness:1});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,650),green);
  ground.rotation.x=-Math.PI/2;ground.position.y=-.13;scene.add(ground);
  const asphalt=new THREE.MeshStandardMaterial({color:0x414957,roughness:.94,side:THREE.DoubleSide});
  const curb=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide});
  const side=new THREE.MeshStandardMaterial({color:0x9aaa80,roughness:1,side:THREE.DoubleSide});
  scene.add(ribbon(-ROAD_WIDTH/2-.8,ROAD_WIDTH/2+.8,-.04,side));
  scene.add(ribbon(-ROAD_WIDTH/2,ROAD_WIDTH/2,.015,asphalt));
  scene.add(ribbon(-ROAD_WIDTH/2-.65,-ROAD_WIDTH/2,.045,curb,true));
  scene.add(ribbon(ROAD_WIDTH/2,ROAD_WIDTH/2+.65,.045,curb,true));
  // Broken yellow center stripe, with segments laid along the road tangent.
  const stripe=new THREE.MeshStandardMaterial({color:0xffe5a1,roughness:.8});
  const markerGeometry=new THREE.BoxGeometry(.15,.018,4.4);
  const stripeCount=Math.floor(CIRCUIT_LENGTH/13);
  const stripes=new THREE.InstancedMesh(markerGeometry,stripe,stripeCount);
  const helper=new THREE.Object3D();
  for(let i=0;i<stripeCount;i++) {
    const p=sampleAt(i*13+5);
    helper.position.set(p.position.x,.065,p.position.z);helper.rotation.set(0,-p.yaw,0);helper.updateMatrix();
    stripes.setMatrixAt(i,helper.matrix);
  }
  stripes.instanceMatrix.needsUpdate=true;scene.add(stripes);
  // Proper start/finish across the driving surface.
  const lineGroup=new THREE.Group();
  const tile=new THREE.BoxGeometry(ROAD_WIDTH/10,.025,1.8);
  const black=new THREE.MeshBasicMaterial({color:0x1e2430}),white=new THREE.MeshBasicMaterial({color:0xfdfdf9});
  for(let row=0;row<2;row++)for(let col=0;col<10;col++) {
    const mesh=new THREE.Mesh(tile,(row+col)%2?black:white);
    mesh.position.set((col-4.5)*ROAD_WIDTH/10,.1,(row-.5)*.9);
    lineGroup.add(mesh);
  }
  const start=sampleAt(0);
  lineGroup.position.copy(start.position);lineGroup.rotation.y=-start.yaw;scene.add(lineGroup);

  const trunkGeo=new THREE.CylinderGeometry(.48,.62,4,5);
  const crownGeo=new THREE.ConeGeometry(2.7,7,7);
  const trunks=new THREE.InstancedMesh(trunkGeo,new THREE.MeshStandardMaterial({color:0x896048}),170);
  const crowns=new THREE.InstancedMesh(crownGeo,new THREE.MeshStandardMaterial({color:0x258851,roughness:1}),170);
  const rockGeo=new THREE.DodecahedronGeometry(1.8,0);
  const rocks=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({color:0xadb5ac}),35);
  for(let i=0;i<170;i++) {
    const p=sampleAt(i*CIRCUIT_LENGTH/170+1);
    const sideSign=i%2===0?1:-1,offset=24+(i*19%18);
    helper.position.copy(p.position).addScaledVector(p.right,sideSign*offset);
    helper.position.y=2;helper.rotation.set(0,i*2.1,0);
    const scale=.6+(i*7%10)/16;helper.scale.setScalar(scale);helper.updateMatrix();trunks.setMatrixAt(i,helper.matrix);
    helper.position.y=5.2*scale;helper.position.y=4*scale+3.5*scale;
    helper.updateMatrix();crowns.setMatrixAt(i,helper.matrix);
  }
  trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;scene.add(trunks,crowns);
  for(let i=0;i<35;i++) {
    const p=sampleAt(i*CIRCUIT_LENGTH/35+8),sign=i%2===0?-1:1;
    helper.position.copy(p.position).addScaledVector(p.right,sign*(43+(i%5)*4));
    helper.position.y=1.1;helper.rotation.set(i*.47,i*1.1,0);helper.scale.setScalar(1+(i%5)*.27);
    helper.updateMatrix();rocks.setMatrixAt(i,helper.matrix);
  }
  rocks.instanceMatrix.needsUpdate=true;scene.add(rocks);
  // Finish arch, set forward over the line.
  const arch=new THREE.Group(),postMaterial=new THREE.MeshStandardMaterial({color:0x375fb2});
  for(const x of [-ROAD_WIDTH/2-1,ROAD_WIDTH/2+1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.7,6,.7),postMaterial);post.position.set(x,3,0);arch.add(post);
  }
  const bar=new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH+2.5,1,.75),new THREE.MeshStandardMaterial({color:0xffc84c}));
  bar.position.y=6;arch.add(bar);
  arch.position.copy(start.position);arch.rotation.y=-start.yaw;scene.add(arch);
  return {points:points.map(p=>p.clone()),length:CIRCUIT_LENGTH};
}
