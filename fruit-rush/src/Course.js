import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { CONFIG, ACTIVE_STAGE } from "./config.js?v=12";
import { courseCenterX, courseOffsetPoint, courseYaw, courseWidthAtZ } from "./coursePath.js?v=2";

export class Course {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.theme = ACTIVE_STAGE.theme;
    this.applyTheme();
    this.addRoadAndRails(); this.addFinish(); this.addDecorations();
  }
  applyTheme() {
    const themes = {
      park:{bg:0x70cfff,fog:0x70cfff,ground:0x67bd59,road:0xedd4a3,rail:0xfff5e1},
      space:{bg:0x090b2d,fog:0x101a4f,ground:0x16172f,road:0x5a61a8,rail:0xb6c8ff},
      mountain:{bg:0x8fd0ff,fog:0x9bcff0,ground:0x557448,road:0xcab687,rail:0xf3e8cc},
      sea:{bg:0x48b9df,fog:0x72d0e7,ground:0x1688a7,road:0xe6d09f,rail:0xfaf4d0},
    };
    const t=themes[this.theme]||themes.park;
    this.scene.background=new THREE.Color(t.bg); this.scene.fog=new THREE.Fog(t.fog,28,92);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,CONFIG.courseLength+120),new THREE.MeshStandardMaterial({color:t.ground,roughness:1}));
    ground.rotation.x=-Math.PI/2; ground.position.set(0,-.06,-CONFIG.courseLength/2+5); this.group.add(ground);
    this.roadMaterial=new THREE.MeshStandardMaterial({color:t.road,roughness:.9});
    this.railMaterial=new THREE.MeshStandardMaterial({color:t.rail,roughness:.65});
    if(this.theme==="space")this.addStars();
    if(this.theme==="sea")this.addSeaSurface();
  }
  addRoadAndRails() {
    const step=5;
    for(let z=CONFIG.courseStartZ;z>-CONFIG.courseLength-4;z-=step){
      const centerZ=z-step/2, yaw=courseYaw(centerZ), width=courseWidthAtZ(centerZ);
      const road=new THREE.Mesh(new THREE.BoxGeometry(width,.12,step+.22),this.roadMaterial);
      road.position.set(courseCenterX(centerZ),0,centerZ); road.rotation.y=yaw; this.group.add(road);
      for(const side of [-1,1]){
        const railPoint=courseOffsetPoint(centerZ,side*(width/2+.12));
        const rail=new THREE.Mesh(new THREE.BoxGeometry(.24,.62,step+.28),this.railMaterial);
        rail.position.set(railPoint.x,.32,railPoint.z); rail.rotation.y=yaw; this.group.add(rail);
      }
      if(Math.round((CONFIG.courseStartZ-z)/step)%3===0)for(const side of [-1,1]){
        const point=courseOffsetPoint(z,side*(courseWidthAtZ(z)/2+.12));
        const post=new THREE.Mesh(new THREE.BoxGeometry(.28,1.05,.28),this.railMaterial);
        post.position.set(point.x,.52,point.z); this.group.add(post);
      }
    }
  }
  addFinish() {
    const z=-CONFIG.courseLength+CONFIG.finishPadding, width=courseWidthAtZ(z);
    const mat=new THREE.MeshStandardMaterial({color:0xff5471});
    for(const side of [-1,1]){
      const point=courseOffsetPoint(z,side*width/2);
      const post=new THREE.Mesh(new THREE.BoxGeometry(.28,3.4,.28),mat);
      post.position.set(point.x,1.7,point.z);this.group.add(post);
    }
    const bar=new THREE.Mesh(new THREE.BoxGeometry(width+.5,.55,.28),mat);
    bar.position.set(courseCenterX(z),3.2,z);bar.rotation.y=courseYaw(z);this.group.add(bar);
  }
  addDecorations() {
    if(this.theme==="space"){this.addSpaceDecor();return;}
    if(this.theme==="mountain"){this.addMountainDecor();return;}
    if(this.theme==="sea"){this.addSeaDecor();return;}
    const trunkMat=new THREE.MeshStandardMaterial({color:0x9a7049}), leafMat=new THREE.MeshStandardMaterial({color:0x3c9b54});
    for(let z=2;z>-CONFIG.courseLength;z-=12)for(const side of [-1,1]){
      const tree=new THREE.Group(), trunk=new THREE.Mesh(new THREE.CylinderGeometry(.17,.22,1.2,7),trunkMat);trunk.position.y=.6;tree.add(trunk);
      const crown=new THREE.Mesh(new THREE.SphereGeometry(.85,10,8),leafMat);crown.position.y=1.55;tree.add(crown);
      const point=courseOffsetPoint(z+Math.random()*5,side*(courseWidthAtZ(z)/2+3+Math.random()*3));
      tree.position.set(point.x,0,point.z);tree.scale.setScalar(.65+Math.random()*.45);this.group.add(tree);
    }
  }
  addStars(){
    const geo=new THREE.BufferGeometry(), pts=[];
    for(let i=0;i<320;i++)pts.push((Math.random()-.5)*90,4+Math.random()*45,-Math.random()*(CONFIG.courseLength+80));
    geo.setAttribute("position",new THREE.Float32BufferAttribute(pts,3));
    const mat=new THREE.PointsMaterial({color:0xffffff,size:.18,sizeAttenuation:true});
    this.group.add(new THREE.Points(geo,mat));
  }
  addSpaceDecor(){
    const colors=[0x6a6eea,0xd66de8,0x65c8ff];
    for(let z=-20;z>-CONFIG.courseLength;z-=34)for(const side of [-1,1]){
      const mat=new THREE.MeshStandardMaterial({color:colors[Math.floor(Math.random()*colors.length)],roughness:.7});
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.8+Math.random()*1.2,0),mat);
      const p=courseOffsetPoint(z+Math.random()*8,side*(courseWidthAtZ(z)/2+4+Math.random()*5));rock.position.set(p.x,1+Math.random()*3,p.z);rock.rotation.set(Math.random(),Math.random(),Math.random());this.group.add(rock);
    }
  }
  addMountainDecor(){
    const rockMat=new THREE.MeshStandardMaterial({color:0x77806c,roughness:1}), snowMat=new THREE.MeshStandardMaterial({color:0xf2f6ef,roughness:.9});
    for(let z=-10;z>-CONFIG.courseLength;z-=22)for(const side of [-1,1]){
      const g=new THREE.Group();const base=new THREE.Mesh(new THREE.ConeGeometry(2.2+Math.random()*1.6,5+Math.random()*3,5),rockMat);base.position.y=2.5;g.add(base);
      const snow=new THREE.Mesh(new THREE.ConeGeometry(1.2,1.6,5),snowMat);snow.position.y=5.1;g.add(snow);
      const p=courseOffsetPoint(z+Math.random()*7,side*(courseWidthAtZ(z)/2+5+Math.random()*5));g.position.set(p.x,0,p.z);this.group.add(g);
    }
  }
  addSeaSurface(){
    const water=new THREE.Mesh(new THREE.PlaneGeometry(160,CONFIG.courseLength+160),new THREE.MeshStandardMaterial({color:0x1e9ac2,roughness:.35,metalness:.05}));
    water.rotation.x=-Math.PI/2;water.position.set(0,-.14,-CONFIG.courseLength/2+5);this.group.add(water);
  }
  addSeaDecor(){
    const palmTrunk=new THREE.MeshStandardMaterial({color:0x9b6d3d,roughness:1}), palmLeaf=new THREE.MeshStandardMaterial({color:0x43a35b,roughness:.9});
    for(let z=-12;z>-CONFIG.courseLength;z-=28)for(const side of [-1,1]){
      const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,2.8,7),palmTrunk);trunk.position.y=1.4;g.add(trunk);
      for(let i=0;i<5;i++){const leaf=new THREE.Mesh(new THREE.BoxGeometry(.16,.08,1.8),palmLeaf);leaf.position.y=2.9;leaf.rotation.y=i/5*Math.PI*2;leaf.position.x=Math.sin(leaf.rotation.y)*.6;leaf.position.z=Math.cos(leaf.rotation.y)*.6;g.add(leaf);}
      const p=courseOffsetPoint(z+Math.random()*9,side*(courseWidthAtZ(z)/2+4+Math.random()*4));g.position.set(p.x,0,p.z);this.group.add(g);
    }
  }
}
