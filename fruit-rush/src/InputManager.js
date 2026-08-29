export class InputManager {
  constructor(element) {
    this.value = 0; this.dragging = false; this.lastX = 0; this.keyLeft = false; this.keyRight = false;
    this.tiltValue = 0; this.tiltEnabled = false; this.tiltBaseline = null;
    this.onOrientation = this.onOrientation.bind(this);
    element.addEventListener("pointerdown", (event) => { this.dragging = true; this.lastX = event.clientX; element.setPointerCapture?.(event.pointerId); });
    element.addEventListener("pointermove", (event) => { if (!this.dragging) return; const delta = (event.clientX - this.lastX) / Math.max(180, window.innerWidth * .42); this.value = Math.max(-1, Math.min(1, delta * 4)); this.lastX = event.clientX; });
    const end = () => { this.dragging = false; this.value = 0; };
    element.addEventListener("pointerup", end); element.addEventListener("pointercancel", end);
    window.addEventListener("keydown", (event) => { if (["ArrowLeft","a","A"].includes(event.key)) this.keyLeft = true; if (["ArrowRight","d","D"].includes(event.key)) this.keyRight = true; });
    window.addEventListener("keyup", (event) => { if (["ArrowLeft","a","A"].includes(event.key)) this.keyLeft = false; if (["ArrowRight","d","D"].includes(event.key)) this.keyRight = false; });
  }
  async enableTilt() {
    const Orientation = window.DeviceOrientationEvent;
    if (!Orientation) return false;
    try {
      if (typeof Orientation.requestPermission === "function") {
        const result = await Orientation.requestPermission();
        if (result !== "granted") return false;
      }
      this.tiltEnabled = true; this.tiltBaseline = null;
      window.addEventListener("deviceorientation", this.onOrientation, { passive: true });
      return true;
    } catch { return false; }
  }
  onOrientation(event) {
    if (typeof event.gamma !== "number") return;
    if (this.tiltBaseline === null) this.tiltBaseline = event.gamma;
    const target = Math.max(-1, Math.min(1, (event.gamma - this.tiltBaseline) / 16));
    this.tiltValue += (target - this.tiltValue) * .2;
  }
  get direction() {
    if (this.keyLeft) return -1;
    if (this.keyRight) return 1;
    if (this.dragging) return this.value;
    return this.tiltEnabled ? this.tiltValue : this.value;
  }
}
