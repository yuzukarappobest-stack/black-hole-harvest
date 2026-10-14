const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
export class Controls {
  constructor(canvas) {
    this.left=false;this.right=false;this.dashRequested=false;
    this.dragging=false;this.dragValue=0;this.dragStart=0;
    this.tiltActive=false;this.rawTilt=null;this.tiltBaseline=null;this.tilt=0;
    this.permission="pending";
    this.onOrientation=this.onOrientation.bind(this);
    window.addEventListener("keydown",(e)=>{
      if(["ArrowLeft","ArrowRight"," ","a","d","A","D"].includes(e.key))e.preventDefault();
      if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")this.left=true;
      if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")this.right=true;
      if(e.key===" "&&!e.repeat)this.dashRequested=true;
    });
    window.addEventListener("keyup",(e)=>{
      if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")this.left=false;
      if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")this.right=false;

    });
    window.addEventListener("blur",()=>{this.left=false;this.right=false;this.dashRequested=false;this.dragging=false;});
    canvas.addEventListener("pointerdown",(e)=>{
      this.dragging=true;this.dragStart=e.clientX;this.dragValue=0;
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener("pointermove",(e)=>{
      if(!this.dragging)return;
      this.dragValue=clamp((e.clientX-this.dragStart)/Math.max(75,innerWidth*.24),-1,1);
    });
    const release=()=>{this.dragging=false;this.dragValue=0;};
    canvas.addEventListener("pointerup",release);
    canvas.addEventListener("pointercancel",release);
  }
  onOrientation(event) {
    const angle=window.screen?.orientation?.angle ?? window.orientation ?? 0;
    const landscape=Math.abs(angle)===90;
    // In landscape the device's beta axis points toward the driver's left/right.
    const raw=landscape ? (angle===90?-event.beta:event.beta) : event.gamma;
    if(!Number.isFinite(raw))return;
    this.rawTilt=raw;
    if(this.tiltBaseline===null)this.tiltBaseline=raw;
    // A physical dead zone prevents sensor noise or a slight resting tilt from
    // causing a continuous slow rotation while the player isn't steering.
    const offset=raw-this.tiltBaseline;
    const deadZone=4;
    const active=Math.sign(offset)*Math.max(0,Math.abs(offset)-deadZone);
    const target=clamp(active/17,-1,1);
    this.tilt+=(target-this.tilt)*.24;
    this.tiltActive=true;
  }
  recenter() {
    if(this.rawTilt!==null)this.tiltBaseline=this.rawTilt;
    this.tilt=0;
  }
  async enableTilt() {
    const DeviceOrientation=window.DeviceOrientationEvent;
    if(!DeviceOrientation){this.permission="unavailable";return false;}
    try{
      if(typeof DeviceOrientation.requestPermission==="function"){
        const result=await DeviceOrientation.requestPermission();
        if(result!=="granted"){this.permission="denied";return false;}
      }
      window.removeEventListener("deviceorientation",this.onOrientation);
      window.addEventListener("deviceorientation",this.onOrientation,{passive:true});
      this.permission="granted";this.recenter();
      return true;
    }catch {this.permission="denied";return false;}
  }
  get steer() {
    if(this.left||this.right)return Number(this.right)-Number(this.left);
    if(this.dragging)return this.dragValue;
    return this.tiltActive ? this.tilt : 0;
  }
  consumeDashRequest(){
    const requested=this.dashRequested;
    this.dashRequested=false;
    return requested;
  }
  clearDashRequest(){this.dashRequested=false;}
}
