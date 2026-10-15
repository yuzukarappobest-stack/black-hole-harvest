// iPad Safari cannot reliably lock the OS screen orientation.
// Counter-rotate the entire playfield so the game stays portrait-sized.
export function isAppleTablet(device) {
  const ua=device?.userAgent||"";
  return /iPad/i.test(ua) ||
    ((device?.platform==="MacIntel"||/Macintosh/i.test(ua)) &&
      Number(device?.maxTouchPoints)>1);
}
export function portraitFrame(width,height,angle,tablet) {
  if(!tablet||width<=height){
    return {width,height,rotation:0,transform:"none"};
  }
  const rotation=Number(angle)===-90?90:-90;
  // transforms are applied right-to-left, translating the rotated stage
  // back to the visible top-left corner of the landscape viewport.
  const transform=rotation===90
    ?`translateX(${width}px) rotate(90deg)`
    :`translateY(${height}px) rotate(-90deg)`;
  return {width:height,height:width,rotation,transform};
}
export function portraitPointerX(event,rotation) {
  if(rotation===-90)return -event.clientY;
  if(rotation===90)return event.clientY;
  return event.clientX;
}
