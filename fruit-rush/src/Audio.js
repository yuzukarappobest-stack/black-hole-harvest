export class AudioManager {
  constructor() { this.context=null; }
  tone(freq, duration, type="sine", offset=0) { const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx)return; if(!this.context)this.context=new Ctx(); if(this.context.state==="suspended")this.context.resume(); const now=this.context.currentTime+offset; const osc=this.context.createOscillator(); const gain=this.context.createGain(); osc.type=type; osc.frequency.setValueAtTime(freq,now); gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(.13,now+.015); gain.gain.exponentialRampToValueAtTime(.0001,now+duration); osc.connect(gain).connect(this.context.destination); osc.start(now); osc.stop(now+duration+.02); }
  merge() { this.tone(540,.11,"triangle"); this.tone(790,.18,"sine",.09); }
  finish() { [523,659,784,1046].forEach((n,i)=>this.tone(n,.2,"sine",i*.11)); }
  over() { this.tone(180,.32,"sawtooth"); this.tone(110,.38,"sawtooth",.18); }
}
