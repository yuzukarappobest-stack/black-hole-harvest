export class Input {
  constructor(canvas, dash) {
    this.x = 0; this.z = 0; this.keys = new Set(); this.pointer = null;
    const pad = document.getElementById('pad'), knob = document.getElementById('knob');
    const update = e => {
      const dx = e.clientX - this.origin.x, dz = e.clientY - this.origin.y, d = Math.max(42, Math.hypot(dx, dz));
      this.x = dx / d; this.z = dz / d; knob.style.transform = `translate(${this.x * 35}px,${this.z * 35}px)`;
    };
    for (const element of [pad, canvas]) {
      element.addEventListener('pointerdown', e => { if (this.pointer !== null) return; e.preventDefault(); this.pointer = e.pointerId; element.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); this.origin = element === pad ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : { x: e.clientX, y: e.clientY }; update(e); });
      element.addEventListener('pointermove', e => { if (e.pointerId === this.pointer) update(e); });
      for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(kind, e => { if (e.pointerId === this.pointer) this.reset(); });
    }
    const supported = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'];
    window.addEventListener('keydown', e => { if (!supported.includes(e.code)) return; e.preventDefault(); if (e.code === 'Space' && !e.repeat) dash(); else this.keys.add(e.code); });
    window.addEventListener('keyup', e => this.keys.delete(e.code)); window.addEventListener('blur', () => this.reset());
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  }
  vector() { let x = this.x + Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')); let z = this.z + Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')); const d = Math.max(1, Math.hypot(x, z)); return { x: x / d, z: z / d }; }
  reset() { this.x = this.z = 0; this.pointer = null; this.keys.clear(); document.getElementById('knob').style.transform = ''; }
}
