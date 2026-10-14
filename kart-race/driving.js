// Forward speed is automatic. Only the driver's steering input rotates the kart.
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function stepKart(state, {dt,steer,brake,offroad}) {
  const seconds=clamp(dt,0,.05);
  const targetSpeed=offroad?11:brake?14:42;
  const response=brake?3.7:offroad?3.2:.9;
  state.speed+=(targetSpeed-state.speed)*(1-Math.exp(-response*seconds));
  state.speed=clamp(state.speed,5,44);

  const targetSteer=Math.abs(steer)<.055?0:clamp(steer,-1,1);
  state.steering+=(targetSteer-state.steering)*(1-Math.exp(-11*seconds));
  if(Math.abs(state.steering)<.002)state.steering=0;

  // At low speed steering produces a smaller turning radius.
  const authority=clamp(state.speed/23,.46,1.16);
  state.yaw+=state.steering*(brake?1.58:1.13)*authority*seconds;
  state.yaw=Math.atan2(Math.sin(state.yaw),Math.cos(state.yaw));
  state.x+=Math.sin(state.yaw)*state.speed*seconds;
  state.z-=Math.cos(state.yaw)*state.speed*seconds;
  return state;
}
