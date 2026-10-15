// A collision barrier is a tube around the WHOLE closed circuit.
export function constrainToGuardrail(vehicle, center, allowedRadius) {
  const dx=vehicle.x-center.x,dz=vehicle.z-center.z;
  const d2=dx*dx+dz*dz;
  if(d2<=allowedRadius*allowedRadius)return false;
  const ratio=allowedRadius/Math.sqrt(d2);
  vehicle.x=center.x+dx*ratio;
  vehicle.z=center.z+dz*ratio;
  return true;
}
