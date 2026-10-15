const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
export class Controls {
  constructor(canvas) {
    this.left=false;this.right=false;this.dashRequested=false;
    this.dragging=false;this.dragValue=0;this.dragStart=0;
    this.tiltActive=false;this.rawTilt=null;this.tiltBaseline=null;this.tilt=0;
    this.permission="pending";
    this.onOrientation=this.onOrientation.bind(this);
    const resetOnRotate=()=>{
      this.rawTilt=null;this.tiltBaseline=null;this.tilt=0;this.tiltActive=false;
    };
    window.addEventListener("orientationchange",resetOnRotate);
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
    // Use the same axis as the working Fruit Rush controls on iPhone and iPad.
    // An iPad may report a landscape screen angle even while the device is
    // held differently; switching to beta makes steering turn the wrong way.
    const raw=event.gamma;
    if(!Number.isFinite(raw))return;
    this.rawTilt=raw;
    if(this.tiltBaseline===null)this.tiltBaseline=raw;

    const offset=raw-this.tiltBaseline;
    const deadZone=3; // Suppress hand tremor without dulling iPad steering.
    const active=Math.sign(offset)*Math.max(0,Math.abs(offset)-deadZone);
    const target=clamp(active/16,-1,1);
    this.tilt+=(target-this.tilt)*.2;
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
      // The first fresh gyro event establishes the neutral angle; a stale
      // sample from before the permission prompt must not be reused.
      this.rawTilt=null;this.tiltBaseline=null;this.tilt=0;this.tiltActive=false;
      window.removeEventListener("deviceorientation",this.onOrientation);
      window.addEventListener("deviceorientation",this.onOrientation,{passive:true});
      this.permission="granted";
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
