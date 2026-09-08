export class Audio {
  constructor() { this.enabled = true; }
  unlock() { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return; this.ctx ||= new Context(); this.ctx.resume().catch(() => {}); }
  tone(f, seconds, volume = .05, type = 'sine', end = f) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, c.currentTime); o.frequency.exponentialRampToValueAtTime(end, c.currentTime + seconds); g.gain.setValueAtTime(volume, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + seconds); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + seconds); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  hit(power) { this.tone(580 + power * 25, .1, .05, 'triangle', 180); this.tone(110, .09, .06, 'sawtooth', 40); }
  dash() { this.tone(180, .2, .08, 'sawtooth', 760); }
  launch() { this.tone(180, .5, .06, 'triangle', 1000); }
  finish(win) { (win ? [392, 494, 587, 784] : [330, 262, 196]).forEach((f, i) => setTimeout(() => this.tone(f, .3, .07), i * 150)); }
}
