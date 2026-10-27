import {ARENA_RADIUS,PULL_DISTANCE} from "./physics.js?v=1";
const TAU=Math.PI*2;
export function makeStars(){
  let seed=78133;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return Array.from({length:145},()=>({x:rand(),y:rand(),r:.35+rand()*1.15,p:rand()*TAU}));
}
export function drawScene(ctx,view,bodies,aim,stars,particles,now){
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
  ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);
  drawTable(ctx,now);
  for(const b of bodies.slice(1))drawBody(ctx,b,now);
  drawBody(ctx,bodies[0],now);
  for(const p of particles){
    const alpha=Math.max(0,1-p.age/p.life);
    ctx.globalAlpha=alpha;ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
  if(aim)drawAim(ctx,bodies[0],aim);
  ctx.restore();
}
function drawTable(c,now){
  const R=ARENA_RADIUS;
  c.shadowColor="#5983e8";c.shadowBlur=35;
  c.fillStyle="#5078bb";c.beginPath();c.arc(0,0,R+8,0,TAU);c.fill();
  c.shadowBlur=0;
  const g=c.createRadialGradient(-60,-80,5,0,0,R);
  g.addColorStop(0,"#305489");g.addColorStop(.72,"#172f5d");g.addColorStop(1,"#101d38");
  c.fillStyle=g;c.beginPath();c.arc(0,0,R,0,TAU);c.fill();
  c.lineWidth=3;c.strokeStyle="#8cc8f8";c.stroke();
  c.setLineDash([3,12]);c.strokeStyle="#b4d6ff26";c.lineWidth=1.7;
  for(const r of [100,200]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}
  c.setLineDash([]);
  c.strokeStyle="#ffffff20";c.lineWidth=1.5;
  c.beginPath();c.arc(0,0,R-11,0,TAU);c.stroke();
  for(let i=0;i<16;i++){
    const a=i*TAU/16;
    c.fillStyle=i%2?"#ffd983":"#a1d9ff";
    c.beginPath();c.arc(Math.cos(a)*(R+8),Math.sin(a)*(R+8),3.2,0,TAU);c.fill();
  }
  c.save();c.rotate(now*.02);c.strokeStyle="#ecf6ff1c";c.lineWidth=5;
  c.beginPath();c.arc(0,0,145,.2,2.6);c.stroke();c.restore();
}
function drawBody(c,b,now){
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
    c.font="bold 13px system-ui,-apple-system,sans-serif";
    c.textAlign="center";c.textBaseline="top";c.lineWidth=4;
    c.strokeStyle="#071228cc";c.strokeText(b.name,0,r+6);
    c.fillStyle="#ffffff";c.fillText(b.name,0,r+6);
  }
  c.restore();
}
function ring(c,r,back){
  c.save();c.rotate(-.38);
  c.beginPath();c.ellipse(0,0,r*1.68,r*.58,0,back?Math.PI:0,back?TAU:Math.PI);
  c.strokeStyle=back?"#ac9781":"#f7e4af";c.lineWidth=7;c.stroke();
  c.restore();
}
function drawAim(c,sun,aim){
  const length=Math.hypot(aim.dx,aim.dy);
  if(length<2)return;
  const x=aim.dx/length,y=aim.dy/length;
  const pct=Math.min(1,length/PULL_DISTANCE),end=115+205*pct;
  c.save();
  c.strokeStyle="#fff8b5";c.lineWidth=4;c.setLineDash([11,10]);
  c.beginPath();c.moveTo(sun.x+x*40,sun.y+y*40);
  c.lineTo(sun.x+x*end,sun.y+y*end);c.stroke();c.setLineDash([]);
  const ex=sun.x+x*end,ey=sun.y+y*end;
  c.fillStyle="#ffe78a";c.beginPath();c.moveTo(ex+x*12,ey+y*12);
  c.lineTo(ex-x*9-y*10,ey-y*9+x*10);
  c.lineTo(ex-x*9+y*10,ey-y*9-x*10);c.closePath();c.fill();
  c.font="bold 18px system-ui";c.textAlign="center";
  c.strokeStyle="#0a143d";c.lineWidth=5;
  const label=Math.round(pct*100)+" %";
  c.strokeText(label,sun.x,sun.y-55);c.fillText(label,sun.x,sun.y-55);
  c.restore();
}
