import {ARENA_HALF_WIDTH,ARENA_HALF_HEIGHT,PULL_DISTANCE,POCKETS,POCKET_RADIUS} from "./physics.js?v=5";
const TAU=Math.PI*2;
export function makeStars(){
  let seed=78133;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return Array.from({length:145},()=>({x:rand(),y:rand(),r:.35+rand()*1.15,p:rand()*TAU}));
}
export function drawScene(ctx,view,bodies,aim,stars,particles,now,trajectory=null){
  const {w,h,cx,cy,scale}=view;
  ctx.clearRect(0,0,w,h);
  const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.75);
  bg.addColorStop(0,"#16274e");bg.addColorStop(.8,"#09122a");bg.addColorStop(1,"#030719");
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(const star of stars){
    ctx.globalAlpha=.35+.5*(.5+.5*Math.sin(now*1.5+star.p));
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(star.x*w,star.y*h,star.r,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.save();ctx.translate(cx,cy);
  if(view.rotated)ctx.rotate(Math.PI/2);
  ctx.scale(scale,scale);
  drawTable(ctx,now);
  for(const b of bodies.slice(1))drawBody(ctx,b,now,Boolean(view.rotated));
  drawBody(ctx,bodies[0],now,Boolean(view.rotated));
  for(const p of particles){
    const alpha=Math.max(0,1-p.age/p.life);
    ctx.globalAlpha=alpha;ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
  if(trajectory)drawTrajectory(ctx,trajectory);
  if(aim)drawAim(ctx,bodies[0],aim,Boolean(view.rotated));
  ctx.restore();
}
function drawTable(c,now){
  const W=ARENA_HALF_WIDTH,H=ARENA_HALF_HEIGHT;
  // Classic six-pocket rectangular pool table, floating in outer space.
  c.save();
  c.shadowColor="#5579e6";c.shadowBlur=37;
  c.fillStyle="#344d86";
  c.fillRect(-W-10,-H-10,2*W+20,2*H+20);
  c.shadowBlur=0;
  const felt=c.createRadialGradient(-60,-60,12,0,0,W+50);
  felt.addColorStop(0,"#2a4b86");
  felt.addColorStop(.72,"#182a58");
  felt.addColorStop(1,"#101d40");
  c.fillStyle=felt;c.fillRect(-W,-H,2*W,2*H);
  // Pool-ball aiming aids printed onto the velvet.
  c.strokeStyle="#c4d8ff26";c.lineWidth=1.5;c.setLineDash([4,12]);
  for(const r of [92,178]){
    c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
  }
  c.setLineDash([]);
  c.beginPath();c.moveTo(-W+22,0);c.lineTo(W-22,0);
  c.strokeStyle="#d6e5ff16";c.lineWidth=2;c.stroke();
  // The black-hole opening widens gently at the cushion jaws so that
  // even large planets fit a physically small pocket.
  const gap=POCKET_RADIUS+19;
  function cushion(x1,y1,x2,y2){
    c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);
    c.strokeStyle="#79a5ee";c.lineWidth=17;c.lineCap="round";c.stroke();
    c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);
    c.strokeStyle="#e6f4ff";c.lineWidth=3;c.stroke();
  }
  // Four corner holes plus two middle pockets on opposite long rails.
  for(const y of [-H,H]){
    cushion(-W+gap,y,-gap,y);
    cushion(gap,y,W-gap,y);
  }
  for(const x of [-W,W])cushion(x,-H+gap,x,H-gap);
  // Diamonds on the long rail, avoiding all six pocket openings.
  for(const y of [-H,H]){
    for(const x of [-195,-110,110,195]){
      c.fillStyle="#e2f4ff";
      c.beginPath();c.arc(x,y,3.2,0,TAU);c.fill();
    }
  }
  for(const hole of POCKETS)drawBlackHole(c,hole,now);
  c.restore();
}
function drawBlackHole(c,p,now){
  c.save();c.translate(p.x,p.y);
  const r=POCKET_RADIUS;
  const pulse=1+.055*Math.sin(now*3+p.id*1.2);
  const glow=c.createRadialGradient(0,0,r*.3,0,0,r*1.5*pulse);
  glow.addColorStop(0,"#000000");
  glow.addColorStop(.38,"#160900");
  glow.addColorStop(.60,"#fe6a17b8");
  glow.addColorStop(.78,"#ffb847a0");
  glow.addColorStop(.90,"#ff571733");
  glow.addColorStop(1,"#ed480000");
  c.fillStyle=glow;c.beginPath();c.arc(0,0,r*1.5*pulse,0,TAU);c.fill();
  // Black core: the visible billiard pocket.
  c.fillStyle="#01020a";c.beginPath();c.arc(0,0,r*.87,0,TAU);c.fill();
  c.save();c.rotate(now*.42*(p.id%2?-1:1)+p.id);
  for(let i=0;i<3;i++){
    const a=i*TAU/3;
    c.beginPath();c.arc(0,0,r*(.65+.12*i),a,a+1.85);
    c.strokeStyle=["#ffe5a2","#ff9e28","#fd581c"][i];
    c.lineWidth=i===0?4.5:2.7;c.stroke();
  }
  c.restore();
  c.fillStyle="#000008";c.beginPath();c.arc(0,0,r*.48,0,TAU);c.fill();
  c.restore();
}
function drawBody(c,b,now,rotated=false){
  if(b.fallen&&b.fallTime>.7)return;
  const f=b.fallen?Math.max(.05,1-b.fallTime/.7):1,r=b.radius;
  c.save();c.translate(b.x,b.y);c.globalAlpha=f;c.scale(f,f);
  if(b.type==="sun"){
    const pulse=1+.05*Math.sin(now*5);
    const glow=c.createRadialGradient(0,0,r*.2,0,0,r*2.7*pulse);
    glow.addColorStop(0,"#ffe56d9a");glow.addColorStop(.5,"#ff9d2b69");glow.addColorStop(1,"#ff7b0800");
    c.fillStyle=glow;c.beginPath();c.arc(0,0,r*2.7*pulse,0,TAU);c.fill();
    c.save();c.rotate(now*.35);
    for(let i=0;i<12;i++){
      const a=i*TAU/12;
      c.strokeStyle="#ffd36ca6";c.lineWidth=2.5;c.beginPath();
      c.moveTo(Math.cos(a)*(r+3),Math.sin(a)*(r+3));
      c.lineTo(Math.cos(a)*(r+13),Math.sin(a)*(r+13));c.stroke();
    }
    c.restore();
  }
  if(b.ring)ring(c,r,true);
  const globe=c.createRadialGradient(-r*.38,-r*.48,r*.08,0,0,r*1.15);
  if(b.type==="sun"){
    globe.addColorStop(0,"#fff7bd");globe.addColorStop(.37,"#ffe65d");
    globe.addColorStop(.78,"#ffa02f");globe.addColorStop(1,"#b74d23");
  }else{
    globe.addColorStop(0,b.accent);globe.addColorStop(.55,b.color);
    globe.addColorStop(1,"#182037");
  }
  c.fillStyle=globe;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
  if(b.id==="jupiter"||b.id==="saturn"){
    c.save();c.beginPath();c.arc(0,0,r,0,TAU);c.clip();
    for(let i=-2;i<=2;i++){
      c.lineWidth=b.id==="jupiter"?5:3;
      c.strokeStyle=i%2?"#79554e9a":"#f8d8a49a";
      c.beginPath();c.moveTo(-r-3,i*8);
      c.quadraticCurveTo(0,i*8+3,r+3,i*8-1);c.stroke();
    }
    if(b.id==="jupiter"){c.fillStyle="#ae684e";c.beginPath();c.ellipse(9,8,7,3.5,-.2,0,TAU);c.fill();}
    c.restore();
  }
  if(b.id==="earth"){
    c.fillStyle="#5ceda8";
    c.beginPath();c.ellipse(-5,1,6,10,-.45,0,TAU);c.fill();
    c.beginPath();c.ellipse(9,8,7,4,.8,0,TAU);c.fill();
  }
  if(b.id==="mars"||b.id==="mercury"){
    c.fillStyle=b.id==="mars"?"#79372d66":"#595b6270";
    for(let i=0;i<3;i++){
      c.beginPath();c.arc(Math.cos(i*2.5)*r*.54,Math.sin(i*2.7)*r*.52,2+i,0,TAU);c.fill();
    }
  }
  if(b.id==="uranus"||b.id==="neptune"){
    c.save();c.beginPath();c.arc(0,0,r,0,TAU);c.clip();
    c.strokeStyle="#e2ffff88";c.lineWidth=4;
    c.beginPath();c.moveTo(-r,r*.2);c.quadraticCurveTo(0,r*.5,r,r*.12);c.stroke();c.restore();
  }
  if(b.ring)ring(c,r,false);
  c.lineWidth=b.type==="sun"?2.5:1;c.strokeStyle="#ffffff88";
  c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
  if(b.type==="planet"){
    // Rotate labels back upright when the billiards table is portrait.
    c.save();if(rotated)c.rotate(-Math.PI/2);
    c.font="bold 13px system-ui,-apple-system,sans-serif";
    c.textAlign="center";c.textBaseline="top";c.lineWidth=4;
    c.strokeStyle="#071228cc";c.strokeText(b.name,0,r+6);
    c.fillStyle="#ffffff";c.fillText(b.name,0,r+6);
    c.restore();
  }
  c.restore();
}
function ring(c,r,back){
  c.save();c.rotate(-.38);
  c.beginPath();c.ellipse(0,0,r*1.68,r*.58,0,back?Math.PI:0,back?TAU:Math.PI);
  c.strokeStyle=back?"#ac9781":"#f7e4af";c.lineWidth=7;c.stroke();
  c.restore();
}
function drawTrajectory(c,shot){
  if(!shot||!shot.dots||shot.dots.length<2)return;
  c.save();
  c.strokeStyle="#8ff6f3";
  c.lineWidth=3;
  c.lineCap="round";c.lineJoin="round";
  c.setLineDash([8,8]);
  c.beginPath();
  c.moveTo(shot.dots[0].x,shot.dots[0].y);
  for(let i=1;i<shot.dots.length;i++)c.lineTo(shot.dots[i].x,shot.dots[i].y);
  c.stroke();
  c.setLineDash([]);
  // Bank points are taken from the actual cushion collision calculation.
  for(const p of shot.banks){
    c.strokeStyle="#fff3a5";c.lineWidth=3;
    c.beginPath();c.arc(p.x,p.y,7,0,TAU);c.stroke();
  }
  const last=shot.impact||shot.pocket;
  if(last){
    c.fillStyle=shot.pocket?"#ad8dff":"#ffe16e";
    c.beginPath();c.arc(last.x,last.y,8,0,TAU);c.fill();
    c.strokeStyle="#fff";c.lineWidth=2;c.stroke();
  }
  c.restore();
}
function drawAim(c,sun,aim,rotated=false){
  const length=Math.hypot(aim.dx,aim.dy);
  if(length<2)return;
  const x=aim.dx/length,y=aim.dy/length;
  const pct=Math.min(1,length/PULL_DISTANCE),end=67;
  c.save();
  c.strokeStyle="#fff8b5";c.lineWidth=4;c.setLineDash([11,10]);
  c.beginPath();c.moveTo(sun.x+x*40,sun.y+y*40);
  c.lineTo(sun.x+x*end,sun.y+y*end);c.stroke();c.setLineDash([]);
  const ex=sun.x+x*end,ey=sun.y+y*end;
  c.fillStyle="#ffe78a";c.beginPath();c.moveTo(ex+x*12,ey+y*12);
  c.lineTo(ex-x*9-y*10,ey-y*9+x*10);
  c.lineTo(ex-x*9+y*10,ey-y*9-x*10);c.closePath();c.fill();
  c.save();c.translate(sun.x,sun.y);
  if(rotated)c.rotate(-Math.PI/2);
  c.font="bold 18px system-ui";c.textAlign="center";
  c.strokeStyle="#0a143d";c.lineWidth=5;
  const label=Math.round(pct*100)+" %";
  c.strokeText(label,0,-57);c.fillText(label,0,-57);
  c.restore();c.restore();
}
