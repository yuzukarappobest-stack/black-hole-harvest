// A lightweight *real-physics* shot preview.
// Run only while the player changes their aim, not once per animation frame.
// Predict the sun's first collision with a planet or a black-hole pocket,
// including any cushion bounces before that first contact.
import {launch,simulateStep,totalSpeed} from "./physics.js?v=4";

export function predictShot(originalBodies,aim){
  if(!aim||Math.hypot(aim.dx,aim.dy)<12)return null;
  const bodies=originalBodies.map(b=>({...b}));
  const sun=bodies[0];
  if(!launch(sun,aim.dx,aim.dy))return null;
  const dots=[{x:sun.x,y:sun.y}],banks=[];
  let impact=null, pocket=null;
  const step=1/120;
  for(let i=0;i<720;i++){
    simulateStep(bodies,step,
      (a,b,speed)=>{
        if(!impact&&(a.id==="sun"||b.id==="sun")){
          const other=a.id==="sun"?b:a;
          impact={x:sun.x,y:sun.y,target:other.id,speed};
        }
      },
      (b,hole)=>{if(b.id==="sun"&&!pocket)pocket={x:b.x,y:b.y,hole:hole.id};},
      (b)=>{if(b.id==="sun"&&banks.length<8)banks.push({x:b.x,y:b.y});}
    );
    if(i%6===0||impact||pocket)
      dots.push({x:sun.x,y:sun.y});
    if(impact||pocket||sun.fallen||totalSpeed(sun)<4)break;
  }
  return {dots,banks,impact,pocket};
}
