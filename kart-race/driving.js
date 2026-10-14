// Forward speed is automatic. Only the driver's steering input rotates the kart.
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function stepKart(state, {dt,steer,offroad,boost=false}) {
  const seconds=clamp(dt,0,.05);
  // Grass should slow you gently, not glue you to a crawl.
  const targetSpeed=boost?66:offroad?29:42;
  // Dash accelerates quickly; coast back to normal speed after it ends.
  const response=boost?6.5:state.speed>targetSpeed?2.8:offroad?1.15:.9;
  state.speed+=(targetSpeed-state.speed)*(1-Math.exp(-response*seconds));
  state.speed=clamp(state.speed,5,70);

  const targetSteer=Math.abs(steer)<.055?0:clamp(steer,-1,1);
  state.steering+=(targetSteer-state.steering)*(1-Math.exp(-11*seconds));
  if(Math.abs(state.steering)<.002)state.steering=0;

  // Steering remains fully manual while the kart is boosting.
  const authority=clamp(state.speed/23,.46,1.16);
  state.yaw+=state.steering*1.13*authority*seconds;
  state.yaw=Math.atan2(Math.sin(state.yaw),Math.cos(state.yaw));
  state.x+=Math.sin(state.yaw)*state.speed*seconds;
  state.z-=Math.cos(state.yaw)*state.speed*seconds;
  return state;
}
