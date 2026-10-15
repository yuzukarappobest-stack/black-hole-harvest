// Checkpoints are physical crossings, not a nearest-road teleport.
// The next gate must be crossed in order and within the guardrails.
export const CHECKPOINT_COUNT=18;

export function initializeCheckpoints(state,length,startProgress=-32){
  state.gatesPassed=0;
  state.progress=startProgress;
  state.trackS=(startProgress%length+length)%length;
  state.projectionMisses=0;
}

export function updateCheckpointProgress(state,previousPosition,currentPosition,
  projection,sampleAt,{
    length,roadWidth,grassMargin=5.5,finishLaps=3,speed=42,dt=1/60
  }
){
  const spacing=length/CHECKPOINT_COUNT;
  const finishGate=CHECKPOINT_COUNT*finishLaps;
  if(state.gatesPassed>=finishGate){
    state.progress=length*finishLaps;
    return {crossed:false,finished:true};
  }
  const gateIndex=state.gatesPassed;
  const point=sampleAt((gateIndex%CHECKPOINT_COUNT)*spacing);
  const tangent=point.tangent,right=point.right;
  const before=(previousPosition.x-point.position.x)*tangent.x+
               (previousPosition.z-point.position.z)*tangent.z;
  const after=(currentPosition.x-point.position.x)*tangent.x+
              (currentPosition.z-point.position.z)*tangent.z;
  const movement=Math.hypot(currentPosition.x-previousPosition.x,currentPosition.z-previousPosition.z);
  const maxStep=Math.max(3.5,speed*Math.min(dt,.05)*1.8+2.5);
  let crossed=false;
  if(before<=0&&after>0.0001&&movement<=maxStep){
    const fraction=-before/(after-before);
    const crossingX=previousPosition.x+(currentPosition.x-previousPosition.x)*fraction;
    const crossingZ=previousPosition.z+(currentPosition.z-previousPosition.z)*fraction;
    const lateral=(crossingX-point.position.x)*right.x+
                  (crossingZ-point.position.z)*right.z;
    if(Math.abs(lateral)<=roadWidth/2+grassMargin-1){
      state.gatesPassed++;
      crossed=true;
    }
  }

  // Smooth progress can advance only *within* the verified sector.
  const accepted=(state.gatesPassed-1)*spacing;
  const next=state.gatesPassed*spacing;
  const roadLimit=roadWidth/2+grassMargin-.8;
  if(projection&&projection.squared<=roadLimit*roadLimit){
    const candidate=projection.s+Math.round((state.progress-projection.s)/length)*length;
    if(candidate>=accepted-6&&candidate<=next+6){
      state.progress=Math.max(state.progress,Math.max(accepted,Math.min(next-.015,candidate)));
      state.trackS=projection.s;
    }
  }
  if(crossed)state.progress=Math.max(state.progress,accepted);
  if(state.gatesPassed>=finishGate)state.progress=finishLaps*length;
  return {crossed,finished:state.gatesPassed>=finishGate,gatesPassed:state.gatesPassed};
}
