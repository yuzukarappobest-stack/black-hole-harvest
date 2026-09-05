export class Input {
  constructor(canvas) {
    this.x = 0; this.y = 0; this.yaw = 0; this.pitch = .14; this.keys = new Set(); this.aim = null;
    this.pad = document.querySelector("#joystick"); this.stick = document.querySelector("#stick");
    this.pad.addEventListener("pointerdown", e => { e.preventDefault(); if (this.moveId != null) return; this.moveId = e.pointerId; this.pad.setPointerCapture(e.pointerId); this.move(e); });
    this.pad.addEventListener("pointermove", e => { if (e.pointerId === this.moveId) this.move(e); });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.pad.addEventListener(type, e => { if (e.pointerId === this.moveId) { this.moveId = null; this.x = this.y = 0; this.stick.style.transform = ""; } });
    canvas.addEventListener("pointerdown", e => { if (this.aim) return; this.aim = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (this.aim?.id !== e.pointerId) return; this.yaw += (e.clientX - this.aim.x) * .0045; this.pitch = Math.max(-.65, Math.min(.9, this.pitch - (e.clientY - this.aim.y) * .0035)); this.aim.x = e.clientX; this.aim.y = e.clientY; });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, e => { if (this.aim?.id === e.pointerId) this.aim = null; });
    window.addEventListener("keydown", e => { if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) { e.preventDefault(); this.keys.add(e.code); } });
    window.addEventListener("keyup", e => this.keys.delete(e.code)); window.addEventListener("blur", () => this.reset());
    document.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
  }
  move(e) { const r = this.pad.getBoundingClientRect(); let x = (e.clientX - r.x - r.width / 2) / 40, y = (e.clientY - r.y - r.height / 2) / 40; const length = Math.max(1, Math.hypot(x, y)); this.x = x / length; this.y = y / length; this.stick.style.transform = `translate(${this.x * 36}px,${this.y * 36}px)`; }
  vector() { let x = this.x + Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")); let y = this.y + Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) - Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")); const d = Math.max(1, Math.hypot(x, y)); return { x: x / d, y: y / d }; }
  reset() { this.keys.clear(); this.x = this.y = 0; this.aim = null; this.moveId = null; this.stick.style.transform = ""; }
}
