export class AudioManager {
  constructor() { this.context=null; this.bgmTimer=null; this.bgmStep=0; }
  getContext() {
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if (!Ctx) return null;
    if (!this.context) this.context=new Ctx();
    return this.context;
  }
  unlock() {
    const context=this.getContext();
    if (!context) return false;
    // iOS Safari needs an actual node started from the tap that begins the game.
    const osc=context.createOscillator(); const gain=context.createGain();
    gain.gain.setValueAtTime(.00001,context.currentTime);
    osc.connect(gain).connect(context.destination); osc.start(context.currentTime); osc.stop(context.currentTime+.012);
    if (context.state!=="running") context.resume();
    return true;
  }
  tone(freq, duration, type="sine", offset=0, volume=.16) {
    const context=this.getContext(); if(!context || context.state!=="running")return;
    const now=context.currentTime+offset; const osc=context.createOscillator(); const gain=context.createGain();
    osc.type=type; osc.frequency.setValueAtTime(freq,now); gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(volume,now+.012); gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain).connect(context.destination); osc.start(now); osc.stop(now+duration+.025);
  }
  merge() { this.tone(540,.11,"triangle",0,.18); this.tone(790,.18,"sine",.09,.2); }
  finish() { [523,659,784,1046].forEach((n,i)=>this.tone(n,.2,"sine",i*.11,.2)); }
  over() { this.tone(180,.32,"sawtooth",0,.16); this.tone(110,.38,"sawtooth",.18,.14); }
  startBgm() { this.stopBgm(); const melody=[523,659,784,659,587,659,880,784,659,784,988,784,587,659,784,659]; const bass=[131,0,0,0,147,0,0,0,165,0,0,0,147,0,0,0]; const beat=160; const play=()=>{ const step=this.bgmStep++%melody.length; this.tone(melody[step],.12,"triangle",0,.075); if(bass[step])this.tone(bass[step],.16,"sine",0,.095); if(step%4===2)this.tone(120,.035,"square",0,.032); }; play(); this.bgmTimer=setInterval(play,beat); }
  stopBgm() { if(this.bgmTimer){ clearInterval(this.bgmTimer); this.bgmTimer=null; } }
}
