// Distance / lap accounting is independent of the steering and render loop.
// Always update the projection reference: a single rejected frame must not
// permanently stall laps, ranks, pickups or the finish condition.
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function applyRaceProgress(state, globalProjection, localProjection, {
  length,roadWidth,speed,dt,raceLength
}) {
  // Prefer the nearest segment to the previous frame when it is just as close,
  // to avoid switching to another road segment at tight, adjacent bends.
  const near=localProjection && localProjection.squared<=globalProjection.squared+2.25
    ?localProjection:globalProjection;
  const onTrack=globalProjection.squared<=(roadWidth/2+6)**2;
  if(onTrack) {
    let delta=near.s-state.trackS;
    if(delta>length/2)delta-=length;
    if(delta< -length/2)delta+=length;
    // A false projection can jump by hundreds of meters. Credit at most the
    // physically possible travel distance, but REBASE the s/index every time.
    const maxTravel=Math.max(1.5,speed*Math.min(dt,.05)*1.65+1.1);
    state.progress=clamp(state.progress+clamp(delta,-maxTravel,maxTravel),-55,raceLength);
    state.trackS=near.s;
    state.trackIndex=near.index;
  }
  return near;
}
