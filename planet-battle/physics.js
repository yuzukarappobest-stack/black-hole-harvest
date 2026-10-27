// Planet Battle — deterministic, device-independent 2D billiards physics.
// Coordinates are world units; all state, masses and collisions are game units.
// No real orbital gravity: the goal is approachable tabletop billiards.
export const ARENA_RADIUS=300;
export const SUN_RADIUS=25;
export const MAX_LAUNCH_SPEED=510;
export const MAX_SHOTS=15;
export const PULL_DISTANCE=145;
export const FRICTION=235;
export const PLANETS=[
  {id:"mercury",name:"すいせい",radius:13,mass:.9,color:"#aaa9a5",accent:"#ded3bf",angle:-107,distance:213},
  {id:"venus",name:"きんせい",radius:17,mass:2,color:"#e7be74",accent:"#fff0ad",angle:-60,distance:224},
  {id:"earth",name:"ちきゅう",radius:18,mass:2.3,color:"#347ad9",accent:"#61d5a2",angle:-14,distance:224},
  {id:"mars",name:"かせい",radius:15,mass:1.4,color:"#cf674c",accent:"#f4b179",angle:30,distance:218},
  {id:"jupiter",name:"もくせい",radius:27,mass:11,color:"#cda077",accent:"#f8dcc1",angle:76,distance:220},
  {id:"saturn",name:"どせい",radius:25,mass:8.5,color:"#dbbe89",accent:"#fbebbd",angle:125,distance:221,ring:true},
  {id:"uranus",name:"てんのうせい",radius:21,mass:5.5,color:"#8bd3df",accent:"#c6faff",angle:169,distance:215},
  {id:"neptune",name:"かいおうせい",radius:20,mass:5.5,color:"#426aca",accent:"#91afff",angle:213,distance:223},
];

export function makeBodies(){
  const sun={id:"sun",name:"たいよう",type:"sun",x:0,y:0,vx:0,vy:0,radius:SUN_RADIUS,mass:7,fallen:false,fallTime:0};
  const planets=PLANETS.map(p=>{
    const rad=p.angle*Math.PI/180;
    return {...p,type:"planet",x:Math.cos(rad)*p.distance,
      y:Math.sin(rad)*p.distance,vx:0,vy:0,fallen:false,fallTime:0};
  });
  return [sun,...planets];
}
export function launch(sun,dx,dy){
  if(!sun||sun.fallen)return false;
  const pull=Math.hypot(dx,dy);
  if(pull<12)return false;
  const amount=Math.min(1,pull/PULL_DISTANCE);
  // Enough speed to reach the outer planets even on an incomplete swipe.
  const speed=115+MAX_LAUNCH_SPEED*amount*.86;
  sun.vx=dx/pull*speed;
  sun.vy=dy/pull*speed;
  return true;
}
export function totalSpeed(b){return Math.hypot(b.vx,b.vy);}
export function allStill(bodies){
  return bodies.every(b=>b.fallen||totalSpeed(b)<4);
}
export function checkFall(body){
  if(body.fallen)return false;
  const distance=Math.hypot(body.x,body.y);
  // No invisible rim: a body disappears once its center passes the edge.
  if(distance>=ARENA_RADIUS+body.radius*.08){
    body.fallen=true;
    body.fallTime=0;
    body.vx=0;body.vy=0;
    return true;
  }
  return false;
}
export function resetSun(bodies){
  const sun=bodies[0];
  // Sun is the cue ball and returns to a clear starting spot between shots.
  // Do not teleport an active planet or award any bonus scoring.
  const candidates=[{x:0,y:0}];
  for(const radius of [45,85,125]){
    for(let i=0;i<16;i++){
      const angle=2*Math.PI*i/16;
      candidates.push({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});
    }
  }
  const clear=c=>bodies.slice(1).every(p=>p.fallen||
    Math.hypot(p.x-c.x,p.y-c.y)>sun.radius+p.radius+12);
  const start=candidates.find(clear)||candidates[0];
  Object.assign(sun,{x:start.x,y:start.y,vx:0,vy:0,fallen:false,fallTime:0});
}
export function simulateStep(bodies,dt,onHit,onFall){
  // Use small fixed physics steps in caller to avoid tunneling at high speeds.
  const step=Math.max(0,Math.min(dt,1/90));
  for(const b of bodies){
    if(b.fallen){b.fallTime+=step;continue;}
    const speed=totalSpeed(b);
    if(speed>0){
      const after=Math.max(0,speed-FRICTION*step);
      const scale=speed>0?after/speed:0;
      b.vx*=scale;b.vy*=scale;
      b.x+=b.vx*step;b.y+=b.vy*step;
    }
  }
  for(let i=0;i<bodies.length;i++){
    const a=bodies[i];
    if(a.fallen)continue;
    for(let j=i+1;j<bodies.length;j++){
      const b=bodies[j];
      if(b.fallen)continue;
      const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy),
        touch=a.radius+b.radius;
      if(distance>=touch)continue;
      const nx=distance>1e-8?dx/distance:1;
      const ny=distance>1e-8?dy/distance:0;
      // Separate interpenetrating objects by inverse masses.
      const invA=1/a.mass,invB=1/b.mass,invSum=invA+invB;
      const overlap=touch-distance+.025;
      a.x-=nx*overlap*invA/invSum;
      a.y-=ny*overlap*invA/invSum;
      b.x+=nx*overlap*invB/invSum;
      b.y+=ny*overlap*invB/invSum;
      const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      if(relative>=0)continue;
      const restitution=.92;
      const impulse=-(1+restitution)*relative/invSum;
      a.vx-=impulse*nx*invA;
      a.vy-=impulse*ny*invA;
      b.vx+=impulse*nx*invB;
      b.vy+=impulse*ny*invB;
      if(onHit&&impulse>22)onHit(a,b,Math.abs(relative));
    }
  }
  for(const b of bodies){
    if(checkFall(b)&&onFall)onFall(b);
  }
}
