export class Sound {
  constructor() { this.enabled = true; }
  unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    this.context ||= new Audio();
    this.context.resume().catch(() => {});
  }
  tone(frequency, duration, volume = .06, type = "triangle", end = frequency) {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const c = this.context, oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, c.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, end), c.currentTime + duration);
    gain.gain.setValueAtTime(volume, c.currentTime); gain.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration);
    oscillator.connect(gain).connect(c.destination); oscillator.start(); oscillator.stop(c.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  shot() { this.tone(95, .065, .035, "sawtooth", 35); }
  boom() { this.tone(65, .65, .16, "sawtooth", 14); }
  roar() { this.tone(110, 1.1, .09, "sawtooth", 29); this.tone(78, .9, .07, "triangle", 24); }
  clear() { [262, 330, 392, 523].forEach((f, i) => setTimeout(() => this.tone(f, .5, .09), i * 140)); }
}
