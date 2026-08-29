export class InputManager {
  constructor(element) {
    this.value = 0; this.dragging = false; this.lastX = 0; this.keyLeft = false; this.keyRight = false;
    element.addEventListener("pointerdown", (event) => { this.dragging = true; this.lastX = event.clientX; element.setPointerCapture?.(event.pointerId); });
    element.addEventListener("pointermove", (event) => { if (!this.dragging) return; const delta = (event.clientX - this.lastX) / Math.max(180, window.innerWidth * .42); this.value = Math.max(-1, Math.min(1, delta * 4)); this.lastX = event.clientX; });
    const end = () => { this.dragging = false; this.value = 0; };
    element.addEventListener("pointerup", end); element.addEventListener("pointercancel", end);
    window.addEventListener("keydown", (event) => { if (["ArrowLeft","a","A"].includes(event.key)) this.keyLeft = true; if (["ArrowRight","d","D"].includes(event.key)) this.keyRight = true; });
    window.addEventListener("keyup", (event) => { if (["ArrowLeft","a","A"].includes(event.key)) this.keyLeft = false; if (["ArrowRight","d","D"].includes(event.key)) this.keyRight = false; });
  }
  get direction() { return this.keyLeft ? -1 : this.keyRight ? 1 : this.value; }
}
