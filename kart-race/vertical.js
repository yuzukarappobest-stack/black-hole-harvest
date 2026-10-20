// Vertical physics for Sky Mountain (course 4); no Three.js dependency.
// Other courses keep their original flat and always-grounded behavior.
const GRAVITY=32;
export function initVertical(state,roadHeight=0){
  state.height=roadHeight+.02;
  state.verticalSpeed=0;
  state.airborne=false;
  state.failedJump=false;
  state.justLanded=false;
}
export function advanceVertical(state,{dt,roadHeight,overRoad=true,launchVelocity=0,allowFailure=true}){
  if(state.failedJump)return {launched:false,landed:false,failed:true};
  const step=Math.max(0,Math.min(dt,.05));
  let launched=false,landed=false;
  state.justLanded=false;
  if(launchVelocity>0&&!state.airborne){
    state.airborne=true;
    state.verticalSpeed=launchVelocity;
    launched=true;
  }
  if(!state.airborne&&!overRoad){
    // The deck has ended: the kart must physically jump or fall.
    state.airborne=true;state.verticalSpeed=0;
  }
  if(state.airborne){
    state.height+=state.verticalSpeed*step-GRAVITY*step*step*.5;
    state.verticalSpeed-=GRAVITY*step;
    if(overRoad&&state.verticalSpeed<=0&&state.height<=roadHeight+.02){
      state.height=roadHeight+.02;
      state.verticalSpeed=0;
      state.airborne=false;
      state.justLanded=true;
      landed=true;
    }else if(allowFailure&&state.height<roadHeight-22){
      // Never force an automatic rescue: the regular recovery button is used.
      state.failedJump=true;
      state.verticalSpeed=0;
    }
  }else if(overRoad){
    state.height=roadHeight+.02;
    state.verticalSpeed=0;
  }
  return {launched,landed,failed:state.failedJump};
}
