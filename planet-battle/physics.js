// Planet Battle v2: rectangular 6-pocket solar billiards.
// World units are gameplay units, not true astronomical mass or gravity.
export const ARENA_HALF_WIDTH=300;
export const ARENA_HALF_HEIGHT=210;
export const POCKET_RADIUS=36;
export const SUN_RADIUS=25;
export const MAX_LAUNCH_SPEED=510;
export const PULL_DISTANCE=145;
export const FRICTION=145;
export const CUSHION_RESTITUTION=.87;
export const POCKETS=[
  {id:0,x:-ARENA_HALF_WIDTH,y:-ARENA_HALF_HEIGHT},
  {id:1,x:0,y:-ARENA_HALF_HEIGHT},
  {id:2,x:ARENA_HALF_WIDTH,y:-ARENA_HALF_HEIGHT},
  {id:3,x:-ARENA_HALF_WIDTH,y:ARENA_HALF_HEIGHT},
  {id:4,x:0,y:ARENA_HALF_HEIGHT},
  {id:5,x:ARENA_HALF_WIDTH,y:ARENA_HALF_HEIGHT}
];
// Ball positions are arranged for playable direct pots AND cushion shots.
// The sun (cue ball) remains at exactly (0,0).
export const PLANETS=[
  {id:"mercury",name:"すいせい",radius:13,mass:.9,color:"#aaa9a5",accent:"#ded3bf",x:-185,y:-130},
  {id:"venus",name:"きんせい",radius:17,mass:2,color:"#e7be74",accent:"#fff0ad",x:0,y:-137},
  {id:"earth",name:"ちきゅう",radius:18,mass:2.3,color:"#347ad9",accent:"#61d5a2",x:185,y:-130},
  {id:"mars",name:"かせい",radius:15,mass:1.4,color:"#cf674c",accent:"#f4b179",x:216,y:12},
  {id:"jupiter",name:"もくせい",radius:27,mass:11,color:"#cda077",accent:"#f8dcc1",x:175,y:122},
  {id:"saturn",name:"どせい",radius:25,mass:8.5,color:"#dbbe89",accent:"#fbebbd",x:-175,y:122,ring:true},
  {id:"uranus",name:"てんのうせい",radius:21,mass:5.5,color:"#8bd3df",accent:"#c6faff",x:0,y:143},
  {id:"neptune",name:"かいおうせい",radius:20,mass:5.5,color:"#426aca",accent:"#91afff",x:-105,y:-73}
];
export function makeBodies(){
  return [
    {id:"sun",name:"たいよう",type:"sun",x:0,y:0,vx:0,vy:0,
      radius:SUN_RADIUS,mass:7,fallen:false,fallTime:0},
    ...PLANETS.map(p=>({...p,type:"planet",vx:0,vy:0,fallen:false,fallTime:0}))
  ];
}
export function launch(sun,dx,dy){
  if(!sun||sun.fallen)return false;
  const length=Math.hypot(dx,dy);
  if(length<12)return false;
  const power=Math.min(1,length/PULL_DISTANCE);
  const speed=115+MAX_LAUNCH_SPEED*power*.86;
  sun.vx=dx/length*speed;sun.vy=dy/length*speed;
  return true;
}
export const totalSpeed=b=>Math.hypot(b.vx,b.vy);
export function allStill(bodies){
  return bodies.every(b=>b.fallen||totalSpeed(b)<4);
}
export function pocketAt(b){
  if(b.fallen)return null;
  // Capturing just inside the pocket mouth ensures larger balls can be potted
  // at the corners before their centre reaches the wooden cushion.
  for(const hole of POCKETS){
    if(Math.hypot(b.x-hole.x,b.y-hole.y)<=POCKET_RADIUS-b.radius*.055)
      return hole;
  }
  return null;
}
export function checkFall(b){
  const hole=pocketAt(b);
  if(!hole)return false;
  b.fallen=true;b.pocketId=hole.id;b.fallTime=0;b.vx=0;b.vy=0;
  return true;
}
export function resetSun(bodies){
  const sun=bodies[0];
  const positions=[{x:0,y:0}];
  for(const rad of [45,85,125]){
    for(let i=0;i<20;i++){
      const a=i*2*Math.PI/20;
      positions.push({x:Math.cos(a)*rad,y:Math.sin(a)*rad});
    }
  }
  const clear=p=>bodies.slice(1).every(b=>b.fallen||
    Math.hypot(p.x-b.x,p.y-b.y)>b.radius+sun.radius+11);
  const selected=positions.find(clear)||positions[0];
  Object.assign(sun,{x:selected.x,y:selected.y,vx:0,vy:0,fallen:false,fallTime:0,pocketId:null});
}
function pocketAttraction(b,dt){
  // A gentle pull close to the black holes, never from the middle of the table.
  if(totalSpeed(b)<8)return;
  for(const hole of POCKETS){
    const dx=hole.x-b.x,dy=hole.y-b.y,d=Math.hypot(dx,dy);
    if(d>1&&d<79){
      const a=365*(1-d/79)*dt/d;
      b.vx+=dx*a;b.vy+=dy*a;
    }
  }
}
function isPocketMouth(b,axis){
  // Only open the cushions right next to the six physical black holes.
  // The opening accounts for the ball's size; larger planets can still
  // enter a corner hole without hitting an invisible straight wall.
  return POCKETS.some(hole=>{
    const tangential=axis==="x"?Math.abs(b.y-hole.y):Math.abs(b.x-hole.x);
    const outward=axis==="x"?Math.abs(b.x-hole.x):Math.abs(b.y-hole.y);
    return tangential<POCKET_RADIUS+b.radius*.15&&
      outward<POCKET_RADIUS+b.radius*.7;
  });
}
function containOrPocket(b,onFall,onRail){
  const hole=pocketAt(b);
  if(hole){
    checkFall(b);
    if(onFall)onFall(b,hole);
    return;
  }
  const maxX=ARENA_HALF_WIDTH-b.radius;
  const maxY=ARENA_HALF_HEIGHT-b.radius;
  let bounced=false,impact=0;
  if(b.x>maxX){
    if(!isPocketMouth(b,"x")){
      b.x=maxX-.03;
      if(b.vx>0){impact=Math.max(impact,b.vx);b.vx=-b.vx*CUSHION_RESTITUTION;b.vy*=.984;bounced=true;}
    }
  }else if(b.x< -maxX){
    if(!isPocketMouth(b,"x")){
      b.x=-maxX+.03;
      if(b.vx<0){impact=Math.max(impact,-b.vx);b.vx=-b.vx*CUSHION_RESTITUTION;b.vy*=.984;bounced=true;}
    }
  }
  if(b.y>maxY){
    if(!isPocketMouth(b,"y")){
      b.y=maxY-.03;
      if(b.vy>0){impact=Math.max(impact,b.vy);b.vy=-b.vy*CUSHION_RESTITUTION;b.vx*=.984;bounced=true;}
    }
  }else if(b.y< -maxY){
    if(!isPocketMouth(b,"y")){
      b.y=-maxY+.03;
      if(b.vy<0){impact=Math.max(impact,-b.vy);b.vy=-b.vy*CUSHION_RESTITUTION;b.vx*=.984;bounced=true;}
    }
  }
  // Keep any unlikely mouth glances from drifting out of play. Only a
  // genuine pocket contact removes the planet.
  if(Math.abs(b.x)>ARENA_HALF_WIDTH+POCKET_RADIUS||Math.abs(b.y)>ARENA_HALF_HEIGHT+POCKET_RADIUS){
    if(!checkFall(b)){
      b.x=Math.max(-maxX,Math.min(maxX,b.x));
      b.y=Math.max(-maxY,Math.min(maxY,b.y));
      b.vx=-b.vx*CUSHION_RESTITUTION;
      b.vy=-b.vy*CUSHION_RESTITUTION;
    }else if(onFall)onFall(b,POCKETS[b.pocketId]);
  }
  if(bounced&&onRail&&impact>26)onRail(b,impact);
}
export function simulateStep(bodies,dt,onHit,onFall,onRail){
  const step=Math.max(0,Math.min(dt,1/90));
  for(const b of bodies){
    if(b.fallen){b.fallTime+=step;continue;}
    pocketAttraction(b,step);
    const speed=totalSpeed(b);
    if(speed>0){
      const newSpeed=Math.max(0,speed-FRICTION*step);
      const factor=newSpeed/speed;
      b.vx*=factor;b.vy*=factor;
      b.x+=b.vx*step;b.y+=b.vy*step;
    }
  }
  // Balls that have already crossed a pocket mouth must disappear BEFORE
  // other balls can collide with them. Otherwise an invisible potted ball can
  // still deflect another ball during this frame.
  for(const ball of bodies){
    if(ball.fallen)continue;
    const pocket=pocketAt(ball);
    if(pocket){
      checkFall(ball);
      if(onFall)onFall(ball,pocket);
    }
  }
  // Elastic impulses exchange momentum according to simplified body mass.
  for(let i=0;i<bodies.length;i++){
    const a=bodies[i];if(a.fallen)continue;
    for(let j=i+1;j<bodies.length;j++){
      const b=bodies[j];if(b.fallen)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),touch=a.radius+b.radius;
      if(d>=touch)continue;
      const nx=d>1e-8?dx/d:1,ny=d>1e-8?dy/d:0;
      const ia=1/a.mass,ib=1/b.mass,inv=ia+ib;
      const depth=touch-d+.025;
      a.x-=nx*depth*ia/inv;a.y-=ny*depth*ia/inv;
      b.x+=nx*depth*ib/inv;b.y+=ny*depth*ib/inv;
      const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      if(relative>=0)continue;
      const impulse=-(1+.92)*relative/inv;
      a.vx-=impulse*nx*ia;a.vy-=impulse*ny*ia;
      b.vx+=impulse*nx*ib;b.vy+=impulse*ny*ib;
      if(onHit&&impulse>22)onHit(a,b,Math.abs(relative));
    }
  }
  for(const b of bodies)if(!b.fallen)containOrPocket(b,onFall,onRail);
}
