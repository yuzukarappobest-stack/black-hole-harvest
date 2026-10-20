// Original, upbeat kart-racing soundtrack. Written for this game:
// no sampled/copyrighted music, remote assets or background timers.
// Safari-compatible Web Audio; scheduled a short way ahead from the game loop.
const BPM=152;
const EIGHTH=60/BPM/2;
const MASTER_VOLUME=.23;

// 16-bar D-major tune: each entry is one eighth note, null = rest.
const MELODY=[
  [74,78,81,null,79,78,76,74],
  [71,74,78,81,78,null,76,74],
  [71,74,79,78,76,74,71,null],
  [73,76,81,79,78,null,76,73],
  [74,78,81,83,81,78,76,null],
  [73,76,78,null,81,78,76,73],
  [71,74,76,79,78,76,74,71],
  [73,76,81,85,83,81,78,null],
  [79,81,83,null,81,79,78,76],
  [78,81,85,83,81,null,78,76],
  [73,76,78,81,78,76,73,null],
  [71,74,78,81,83,81,78,74],
  [76,79,83,null,81,79,76,74],
  [73,76,81,79,78,76,74,73],
  [74,78,81,85,83,81,78,76],
  [81,null,78,76,74,null,73,71]
];
// Chord inversions provide forward motion behind the melody.
const CHORDS=[
  [62,66,69],[59,62,66],[55,59,62],[57,61,64],
  [62,66,69],[61,64,69],[59,62,66],[57,61,64],
  [55,59,62],[57,61,64],[61,64,69],[59,62,66],
  [57,60,64],[57,61,64],[62,66,69],[57,61,64]
];

const frequency=midi=>440*Math.pow(2,(midi-69)/12);
const nearZero=.0001;

export class RaceMusic {
  constructor(){
    this.ctx=null;
    this.master=null;
    this.leadOut=null;
    this.bassOut=null;
    this.noise=null;
    this.running=false;
    this.step=0;
    this.nextTime=0;
    try{this.enabled=localStorage.getItem("kartRaceMusicEnabled")!=="0";}
    catch{this.enabled=true;}
  }
  init(ctx){
    if(this.ctx===ctx&&this.master)return;
    this.ctx=ctx;
    this.master=ctx.createGain();
    this.master.gain.value=0;
    this.master.connect(ctx.destination);
    const leadFilter=ctx.createBiquadFilter();
    leadFilter.type="lowpass";
    leadFilter.frequency.value=2350;
    leadFilter.Q.value=.8;
    leadFilter.connect(this.master);
    this.leadOut=leadFilter;
    const bassFilter=ctx.createBiquadFilter();
    bassFilter.type="lowpass";
    bassFilter.frequency.value=560;
    bassFilter.connect(this.master);
    this.bassOut=bassFilter;
    // Deterministic short noise sample reused by hats and snare.
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.22),ctx.sampleRate);
    const channel=buffer.getChannelData(0);
    let seed=17191;
    for(let i=0;i<channel.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      channel[i]=seed/2147483648-1;
    }
    this.noise=buffer;
  }
  fade(){
    if(!this.master||!this.ctx)return;
    const now=this.ctx.currentTime,g=this.master.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this.running&&this.enabled?MASTER_VOLUME:0,now,.045);
  }
  setEnabled(enabled){
    this.enabled=Boolean(enabled);
    try{localStorage.setItem("kartRaceMusicEnabled",this.enabled?"1":"0");}catch{}
    this.fade();
  }
  start(ctx){
    if(!ctx)return;
    this.init(ctx);
    this.running=true;
    this.step=0;
    this.nextTime=ctx.currentTime+.06;
    this.fade();
    this.update();
  }
  pause(){
    this.running=false;
    this.fade();
  }
  stop(){
    this.pause();
    this.step=0;
  }
  // A short, individually enveloped oscillator voice. The frequency and
  // gain changes are scheduled in audio time, not animation-frame time.
  tone(midi,time,duration,volume,type,output,attack=.01){
    const ctx=this.ctx,osc=ctx.createOscillator(),env=ctx.createGain();
    const length=Math.max(.065,duration);
    osc.type=type;
    osc.frequency.setValueAtTime(frequency(midi),time);
    env.gain.setValueAtTime(nearZero,time);
    env.gain.linearRampToValueAtTime(volume,time+Math.min(attack,length*.3));
    env.gain.exponentialRampToValueAtTime(nearZero,time+length);
    osc.connect(env).connect(output||this.master);
    osc.start(time);
    osc.stop(time+length+.02);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  lead(midi,time,accent){
    const length=EIGHTH*(accent?1.1:.82);
    this.tone(midi,time,length,accent?.14:.11,"sawtooth",this.leadOut,.013);
    this.tone(midi+12,time,length*.8,accent?.037:.027,"triangle",this.leadOut,.01);
  }
  chord(notes,time){
    for(const midi of notes)this.tone(midi,time,EIGHTH*2.65,.045,"triangle",this.leadOut,.03);
  }
  bass(root,time,fifth=false){
    const note=fifth?root-5:root-12;
    this.tone(note,time,EIGHTH*1.45,.17,"triangle",this.bassOut,.008);
    this.tone(note-12,time,EIGHTH*.85,.062,"sine",this.bassOut,.009);
  }
  kick(time){
    const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type="sine";
    o.frequency.setValueAtTime(148,time);
    o.frequency.exponentialRampToValueAtTime(48,time+.11);
    g.gain.setValueAtTime(.25,time);
    g.gain.exponentialRampToValueAtTime(nearZero,time+.17);
    o.connect(g).connect(this.master);
    o.start(time);o.stop(time+.19);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  noiseHit(time,{volume=.06,length=.055,cutoff=6000,type="highpass"}={}){
    const ctx=this.ctx,src=ctx.createBufferSource(),
      filt=ctx.createBiquadFilter(),g=ctx.createGain();
    src.buffer=this.noise;
    filt.type=type;
    filt.frequency.value=cutoff;
    g.gain.setValueAtTime(Math.max(nearZero,volume),time);
    g.gain.exponentialRampToValueAtTime(nearZero,time+length);
    src.connect(filt).connect(g).connect(this.master);
    src.start(time);src.stop(time+length+.005);
    src.onended=()=>{src.disconnect();filt.disconnect();g.disconnect();};
  }
  schedule(step,time){
    const bar=Math.floor(step/8)%16,beat8=step%8;
    const melody=MELODY[bar][beat8];
    if(melody!==null)this.lead(melody,time,beat8===0||beat8===4);
    if(beat8===0||beat8===4)this.chord(CHORDS[bar],time);
    if(beat8%2===0)this.bass(CHORDS[bar][0],time,beat8===2||beat8===6);
    if(beat8===0||beat8===4)this.kick(time);
    if(beat8===2||beat8===6)this.noiseHit(time,{volume:.12,length:.115,cutoff:1700,type:"bandpass"});
    this.noiseHit(time,{volume:beat8%2===0?.045:.031,length:.038,cutoff:7600});
    // A little extra percussion at phrase boundaries to signal a new section.
    if(beat8===7&&bar%4===3)this.noiseHit(time,{volume:.067,length:.085,cutoff:4500});
  }
  update(){
    if(!this.running||!this.enabled||!this.ctx)return;
    if(this.ctx.state==="suspended")return;
    const now=this.ctx.currentTime;
    // Resynchronize after Safari tab suspension instead of scheduling a
    // potentially enormous backlog all at once.
    if(this.nextTime<now-.5)this.nextTime=now+.035;
    let count=0;
    while(this.nextTime<now+.28&&count<5){
      this.schedule(this.step,this.nextTime);
      this.nextTime+=EIGHTH;
      this.step=(this.step+1)%(MELODY.length*8);
      count++;
    }
  }
}
