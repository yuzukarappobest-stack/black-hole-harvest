// Recover lap and position from the physical location on the circuit.
// A one-frame projection glitch never steals traveled distance, and a
// sustained loss of position tracking re-acquires the nearest road section.
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function applyRaceProgress(state, globalProjection, localProjection, {
  length,roadWidth,speed,dt,raceLength
}) {
  const near=localProjection && localProjection.squared<=globalProjection.squared+2.25
    ?localProjection:globalProjection;
  if(globalProjection.squared>(roadWidth/2+6)**2)return near;

  // Choose the revolution of s closest to the previous signed progress.
  // This handles the finish-line seam, including starting behind the line.
  const proposed=near.s+Math.round((state.progress-near.s)/length)*length;
  const delta=proposed-state.progress;
  const maxTravel=Math.max(1.5,speed*Math.min(dt,.05)*1.65+1.1);

  if(Math.abs(delta)>maxTravel){
    state.projectionMisses=(state.projectionMisses||0)+1;
    if(state.projectionMisses<3)return near;
    // A persistent discontinuity means our old local index is stale. Rebase
    // progress to the real on-road position rather than freezing the lap.
  }
  state.progress=clamp(proposed,-55,raceLength);
  state.trackS=near.s;
  state.trackIndex=near.index;
  state.projectionMisses=0;
  return near;
}
