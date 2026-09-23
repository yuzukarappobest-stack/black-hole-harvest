'use strict';

/**
 * Mushijingi reward AI self-play trainer.
 *
 * Fast strategic simulator for high-level policy learning.
 * Exact tactical legality remains enforced by the real app.js.
 */
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const sandbox={window:{},console};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname,'..','cards.js'),'utf8'),
  sandbox,
  {filename:'cards.js'}
);
const {cards,decks}=sandbox.window.MUSHI_DATA;

const META={
  aquatic:'metaAquatic',
  armyAnt:'metaArmyAnt',
  hercules:'metaHercules',
  sumatra:'metaSumatra3Color',
  bee:'metaBee',
  mimicAggro:'metaMimicAggro',
  colorBlessing:'metaColorBlessing'
};

const DEFAULTS={
  aquatic:{resourceTarget:4,blueBaitFloor:4,aggression:1.35,directAttackWeight:1.45,tempSummonBaitFloor:5,tempSummonMinValue:15,preserveWeight:1.2,removalWeight:1.25,aceWeight:1.25,deployThreshold:7},
  armyAnt:{resourceTarget:4,blueBaitFloor:2,aggression:1.55,directAttackWeight:1.65,tempSummonBaitFloor:4,tempSummonMinValue:11,preserveWeight:1.05,removalWeight:1,aceWeight:1.2,deployThreshold:6},
  hercules:{resourceTarget:6,blueBaitFloor:2,aggression:1.15,directAttackWeight:1.35,tempSummonBaitFloor:6,tempSummonMinValue:12,preserveWeight:1.35,removalWeight:1.35,aceWeight:1.45,deployThreshold:8},
  sumatra:{resourceTarget:6,blueBaitFloor:2,aggression:1.25,directAttackWeight:1.45,tempSummonBaitFloor:6,tempSummonMinValue:13,preserveWeight:1.35,removalWeight:1.25,aceWeight:1.5,deployThreshold:8},
  bee:{resourceTarget:6,blueBaitFloor:2,aggression:1.2,directAttackWeight:1.35,tempSummonBaitFloor:6,tempSummonMinValue:12,preserveWeight:1.3,removalWeight:1.25,aceWeight:1.45,deployThreshold:8},
  mimicAggro:{resourceTarget:4,blueBaitFloor:2,aggression:1.6,directAttackWeight:1.8,tempSummonBaitFloor:4,tempSummonMinValue:10,preserveWeight:.95,removalWeight:.95,aceWeight:1.05,deployThreshold:5},
  colorBlessing:{resourceTarget:5,blueBaitFloor:2,aggression:1.25,directAttackWeight:1.4,tempSummonBaitFloor:5,tempSummonMinValue:11,preserveWeight:1.2,removalWeight:1.2,aceWeight:1.25,deployThreshold:7},
  generic:{resourceTarget:5,blueBaitFloor:2,aggression:1.2,directAttackWeight:1.35,tempSummonBaitFloor:5,tempSummonMinValue:11,preserveWeight:1.15,removalWeight:1.15,aceWeight:1.2,deployThreshold:7}
};

function mulberry32(seed){
  return function(){
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function hash(s){
  let h=2166136261>>>0;
  for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function shuffle(list,rng){
  const a=[...list];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function maxAttack(c){return Math.max(0,...(c.attacks||[]).map(a=>Number(a.power||0)));}
function isAnt(c){return /アリ/.test(c.name||'')&&!/(アリヅカ|アリジゴク|アリバチ)/.test(c.name||'');}
function isWasp(c){return /バチ/.test(c.name||'');}
function baseValue(c){
  if(!c)return 0;
  let v=Number(c.cost||0)*.65;
  if(c.type==='insect'){
    v+=Number(c.hp||0)/320+maxAttack(c)/210;
    if(c.passive)v+=1.1;
    v+=(c.attacks||[]).filter(a=>a.effect).length*.6;
  }else if(c.type==='enhance'){
    v+=2+(c.effect==='attack500'?3:1);
  }else{
    const map={handTempSummon:5,baitTempSummon:2,recoverInsect:3,bloodPact:6,worshipGreatSword:5};
    v+=2+(map[c.effect]||1);
  }
  return v;
}
function aceBonus(arch,c){
  const n=c.name||'';
  if(arch==='aquatic'){
    if(['ヘラクレスオオカブト','サカダチコノハナナフシ'].includes(n))return 5;
    if(c.passive?.type==='aquaticCost')return 3;
  }
  if(arch==='armyAnt'){
    if(n==='ニセハナマオウカマキリ')return 5;
    if(n==='リオック')return 4;
    if(c.passive?.type==='militaryLink')return 3;
  }
  if(arch==='hercules'&&n==='ヘラクレスオオカブト')return 7;
  if(arch==='sumatra'&&n==='スマトラオオヒラタクワガタ')return 8;
  if(arch==='bee'&&n==='オオスズメバチ（女王）')return 8;
  return 0;
}
function cardValue(arch,c,p){return baseValue(c)+aceBonus(arch,c)*p.aceWeight;}

function setup(arch,rng){
  const d=decks[META[arch]];
  const pile=shuffle([...d.ids],rng);
  return {arch,deck:pile.slice(10),territory:pile.slice(0,6),hand:pile.slice(6,10),bait:[],field:[],discard:[]};
}
function draw(side){if(side.deck.length)side.hand.push(side.deck.shift());}
function blueBait(side){return side.bait.filter(id=>cards[id]?.type==='insect'&&cards[id]?.color==='blue').length;}
function rgbBait(side){
  const s=new Set(side.bait.map(id=>cards[id]?.color));
  return s.has('red')&&s.has('blue')&&s.has('green');
}
function effectiveCost(side,id){
  const c=cards[id];let cost=Number(c.cost||0);
  if(c.passive?.type==='aquaticCost')cost=Math.max(0,cost-Math.floor(blueBait(side)/2));
  return cost;
}
function attackPower(side,unit){
  const c=cards[unit.id];let p=maxAttack(c)+Number(unit.buff||0);
  if(c.passive?.type==='sumatraNature'&&rgbBait(side))p+=Number(c.passive.value||800);
  const dyn=(c.attacks||[]).find(a=>a.effect==='dynamicPower');
  if(dyn?.dynamic==='redBait200')p=side.bait.filter(id=>cards[id]?.color==='red').length*200;
  if(dyn?.dynamic==='field100')p=side.field.length*100;
  if(dyn?.dynamic==='antField200')p=side.field.filter(u=>isAnt(cards[u.id])).length*200;
  if(c.passive?.type==='emblem'&&side.field.some(u=>cards[u.id]?.name===c.passive.partner))p+=Number(c.passive.value||300);
  if(c.passive?.type==='militaryLink'){
    let best=p;
    for(const u of side.field){
      const d=cards[u.id];
      if(d.passive?.type!=='militaryLink')continue;
      let q=maxAttack(d);
      const dd=(d.attacks||[]).find(a=>a.effect==='dynamicPower');
      if(dd?.dynamic==='antField200')q=side.field.filter(x=>isAnt(cards[x.id])).length*200;
      best=Math.max(best,q);
    }
    p=best;
  }
  return p;
}
function threat(side,u){const c=cards[u.id];return (Number(c.hp||0)-Number(u.damage||0))/300+attackPower(side,u)/180+Number(c.cost||0);}
function keepScore(side,id,p){
  const c=cards[id],arch=side.arch;
  let v=cardValue(arch,c,p)*p.preserveWeight;
  if(arch==='aquatic'&&c.type==='insect'&&c.color==='blue'&&blueBait(side)<p.blueBaitFloor)v-=4.5;
  if(arch==='bee'&&isWasp(c)&&c.name!=='オオスズメバチ（女王）')v-=1.2;
  return v;
}
function chooseBait(side,p){
  if(!side.hand.length)return null;
  const ranked=[...side.hand].sort((a,b)=>keepScore(side,a,p)-keepScore(side,b,p));
  if(side.bait.length<p.resourceTarget)return ranked[0];
  return keepScore(side,ranked[0],p)<5.5?ranked[0]:null;
}
function moveOne(arr,id){const i=arr.indexOf(id);if(i<0)return false;arr.splice(i,1);return true;}
function tempSummonValue(side,id,p){
  const c=cards[id];let v=cardValue(side.arch,c,p)+maxAttack(c)/150;
  if(['モンシロチョウ','モンキチョウ'].includes(c.name))v-=6;
  return v;
}
function canTempFromBait(side,p){
  if(side.bait.length<=p.tempSummonBaitFloor)return false;
  const list=side.bait.filter(id=>cards[id]?.type==='insect');
  const best=[...list].sort((a,b)=>tempSummonValue(side,b,p)-tempSummonValue(side,a,p))[0];
  if(best==null||tempSummonValue(side,best,p)<p.tempSummonMinValue)return false;
  if(side.arch==='aquatic'&&cards[best].color==='blue'){
    const before=blueBait(side),after=before-1;
    if(Math.floor(after/2)<Math.floor(before/2))return false;
    if(after<p.blueBaitFloor)return false;
  }
  return true;
}
function bestInsect(list,arch,p){return [...list].filter(id=>cards[id]?.type==='insect').sort((a,b)=>cardValue(arch,cards[b],p)-cardValue(arch,cards[a],p))[0];}

function actionCandidates(me,opp,p){
  const out=[];
  for(const id of me.hand){
    const c=cards[id],cost=effectiveCost(me,id);
    if(c.type==='insect'&&cost<=me.bait.length){
      let score=cardValue(me.arch,c,p)*p.aceWeight-cost*.35;
      if(cost<=1)score+=2*p.aggression;
      if(c.passive?.type==='aquaticCost')score+=3;
      if(me.arch==='sumatra'&&c.name==='スマトラオオヒラタクワガタ')score+=rgbBait(me)?12:-5;
      if(me.arch==='bee'&&c.name==='オオスズメバチ（女王）')score+=me.bait.filter(x=>isWasp(cards[x])&&Number(cards[x].cost||0)<=5).length*4;
      out.push({kind:'insect',id,cost,score});
    }else if(c.type==='enhance'&&cost<=me.bait.length&&me.field.length){
      out.push({kind:'enhance',id,cost,score:4+me.field.reduce((m,u)=>Math.max(m,threat(me,u)),0)*.25});
    }else if(c.type==='spell'&&cost<=me.bait.length){
      if(c.effect==='handTempSummon'){
        const best=bestInsect(me.hand.filter(x=>x!==id),me.arch,p);
        if(best!=null)out.push({kind:'handTemp',id,target:best,cost,score:tempSummonValue(me,best,p)*.95+3});
      }else if(c.effect==='baitTempSummon'&&canTempFromBait(me,p)){
        const best=[...me.bait].filter(x=>cards[x]?.type==='insect').sort((a,b)=>tempSummonValue(me,b,p)-tempSummonValue(me,a,p))[0];
        if(best!=null)out.push({kind:'baitTemp',id,target:best,cost,score:tempSummonValue(me,best,p)-6*p.preserveWeight});
      }else if(c.effect==='recoverInsect'&&me.discard.some(x=>cards[x]?.type==='insect')){
        const best=bestInsect(me.discard,me.arch,p);
        out.push({kind:'recover',id,target:best,cost,score:best!=null?cardValue(me.arch,cards[best],p)*.55:0});
      }else if(c.effect==='bloodPact'&&opp.field.length&&(cost<=me.bait.length||me.territory.length>=2)){
        const t=[...opp.field].sort((a,b)=>threat(opp,b)-threat(opp,a))[0];
        out.push({kind:'bloodPact',id,target:t,cost,score:threat(opp,t)*p.removalWeight*1.8-(cost>me.bait.length?5:0)});
      }
    }
  }
  return out;
}
function playBestActions(me,opp,p){
  let budget=me.bait.length,guard=0;
  while(guard++<7){
    const actions=actionCandidates(me,opp,p).filter(a=>a.cost<=budget||a.kind==='bloodPact');
    if(!actions.length)break;
    actions.sort((a,b)=>b.score-a.score);
    const a=actions[0];
    if(a.score<p.deployThreshold)break;
    const c=cards[a.id];
    moveOne(me.hand,a.id);
    if(a.kind==='insect'){
      budget-=a.cost;me.field.push({id:a.id,damage:0,buff:0,temp:false,delay:0,bounceUsed:false,attacked:false});
    }else if(a.kind==='enhance'){
      budget-=a.cost;me.discard.push(a.id);
      const host=[...me.field].sort((x,y)=>threat(me,y)-threat(me,x))[0];
      if(host&&c.effect==='attack500')host.buff=(host.buff||0)+500;
    }else if(a.kind==='handTemp'){
      budget-=a.cost;me.discard.push(a.id);moveOne(me.hand,a.target);
      me.field.push({id:a.target,damage:0,buff:0,temp:true,delay:0,bounceUsed:false,attacked:false});
    }else if(a.kind==='baitTemp'){
      budget-=a.cost;me.discard.push(a.id);moveOne(me.bait,a.target);
      me.field.push({id:a.target,damage:0,buff:0,temp:true,delay:0,bounceUsed:false,attacked:false});
    }else if(a.kind==='recover'){
      budget-=a.cost;me.discard.push(a.id);moveOne(me.discard,a.target);me.hand.push(a.target);
    }else if(a.kind==='bloodPact'){
      if(a.cost<=budget)budget-=a.cost;else me.territory.splice(0,Math.min(2,me.territory.length));
      me.discard.push(a.id);
      const i=opp.field.indexOf(a.target);if(i>=0){opp.discard.push(opp.field[i].id);opp.field.splice(i,1);}
    }
  }
}
function strike(me,opp,u,p){
  const c=cards[u.id];
  if(u.delay>0||u.attacked)return null;
  if(!opp.field.length){
    if(opp.territory.length)opp.hand.push(opp.territory.shift());
    else return 'win';
    u.attacked=true;return null;
  }
  const bounce=(c.attacks||[]).some(a=>a.effect==='bounceOnce')&&!u.bounceUsed;
  if(bounce){
    const t=[...opp.field].sort((a,b)=>threat(opp,b)-threat(opp,a))[0];
    if(t&&threat(opp,t)*p.removalWeight>5){
      opp.hand.push(t.id);opp.field.splice(opp.field.indexOf(t),1);u.bounceUsed=true;u.attacked=true;return null;
    }
  }
  const target=[...opp.field].sort((a,b)=>{
    const dmg=attackPower(me,u);
    const va=(dmg>=Number(cards[a.id].hp||0)-a.damage?10:0)+threat(opp,a)*p.removalWeight;
    const vb=(dmg>=Number(cards[b.id].hp||0)-b.damage?10:0)+threat(opp,b)*p.removalWeight;
    return vb-va;
  })[0];
  const dmg=attackPower(me,u);target.damage+=dmg;
  if(target.damage>=Number(cards[target.id].hp||0)){opp.discard.push(target.id);opp.field.splice(opp.field.indexOf(target),1);}
  u.attacked=true;
  const effects=(c.attacks||[]).map(a=>a.effect);
  if(effects.includes('selfDestruct')){me.discard.push(u.id);me.field.splice(me.field.indexOf(u),1);}
  if(effects.includes('queenOviposition')){
    const wasps=me.bait.filter(id=>cards[id]?.type==='insect'&&isWasp(cards[id])&&Number(cards[id].cost||0)<=5);
    if(wasps.length){
      const id=[...wasps].sort((a,b)=>cardValue(me.arch,cards[b],p)-cardValue(me.arch,cards[a],p))[0];
      moveOne(me.bait,id);me.field.push({id,damage:0,buff:0,temp:false,delay:1,bounceUsed:false,attacked:true});
    }
  }
  if(effects.includes('mantisCombo')&&opp.field.length){
    u.attacked=false;
    const t=[...opp.field].sort((a,b)=>threat(opp,b)-threat(opp,a))[0];
    t.damage+=attackPower(me,u);
    if(t.damage>=Number(cards[t.id].hp||0)){opp.discard.push(t.id);opp.field.splice(opp.field.indexOf(t),1);}
    u.attacked=true;
  }
  return null;
}
function attackPhase(me,opp,p){
  const order=[...me.field].sort((a,b)=>attackPower(me,b)-attackPower(me,a));
  for(const u of order){if(me.field.includes(u)&&strike(me,opp,u,p)==='win')return 'win';}
  return null;
}
function cleanup(side){
  for(const u of [...side.field])if(u.temp){side.discard.push(u.id);side.field.splice(side.field.indexOf(u),1);}
  for(const u of side.field){u.attacked=false;if(u.delay>0)u.delay--;}
}
function runGame(archA,pA,archB,pB,seed){
  const rng=mulberry32(seed),sides=[setup(archA,rng),setup(archB,rng)];
  for(let turn=0;turn<70;turn++){
    const idx=turn%2,me=sides[idx],opp=sides[1-idx],p=idx===0?pA:pB;
    if(turn>0)draw(me);
    const bait=chooseBait(me,p);if(bait!=null){moveOne(me.hand,bait);me.bait.push(bait);}
    playBestActions(me,opp,p);
    if(attackPhase(me,opp,p)==='win')return {winner:idx,margin:6-opp.territory.length};
    cleanup(me);
  }
  const scoreA=sides[0].territory.length+sides[0].field.length*.3;
  const scoreB=sides[1].territory.length+sides[1].field.length*.3;
  return {winner:Math.abs(scoreA-scoreB)<.01?-1:(scoreA>scoreB?0:1),margin:scoreA-scoreB};
}

const PARAMS={
  resourceTarget:[3,7,.8],blueBaitFloor:[2,6,.7],aggression:[.75,2,.18],
  directAttackWeight:[.8,2.3,.2],tempSummonBaitFloor:[2,7,.8],tempSummonMinValue:[7,20,1.5],
  preserveWeight:[.75,1.7,.12],removalWeight:[.75,1.8,.14],aceWeight:[.85,1.8,.14],deployThreshold:[4,11,.8]
};
function mutate(base,rng,scale=1){
  const out={...base};
  for(const [k,[lo,hi,step]] of Object.entries(PARAMS))if(rng()<.75)out[k]=clamp(Number(out[k])+((rng()*2-1)*step*scale),lo,hi);
  out.resourceTarget=Math.round(out.resourceTarget);out.blueBaitFloor=Math.round(out.blueBaitFloor);out.tempSummonBaitFloor=Math.round(out.tempSummonBaitFloor);
  return out;
}
function evaluate(arch,p,gen,index){
  const opponents=Object.keys(META).filter(x=>x!==arch);
  let pts=0,games=0;
  for(const opp of opponents)for(let n=0;n<4;n++){
    const seed=hash('mushi-selfplay-v1:'+arch+':'+opp+':'+gen+':'+index+':'+n);
    const r1=runGame(arch,p,opp,DEFAULTS[opp],seed);
    pts+=r1.winner===0?3:r1.winner===-1?1:0;pts+=clamp(r1.margin,-3,3)*.08;games++;
    const r2=runGame(opp,DEFAULTS[opp],arch,p,seed^0x9e3779b9);
    pts+=r2.winner===1?3:r2.winner===-1?1:0;pts-=clamp(r2.margin,-3,3)*.08;games++;
  }
  return pts/games;
}
function trainArch(arch){
  const rng=mulberry32(hash('train:'+arch+':20260923'));
  let pop=[{...DEFAULTS[arch]}];while(pop.length<14)pop.push(mutate(DEFAULTS[arch],rng,1.2));
  let best=null;
  for(let gen=0;gen<5;gen++){
    const scored=pop.map((p,i)=>({p,score:evaluate(arch,p,gen,i)})).sort((a,b)=>b.score-a.score);
    best=scored[0];const elite=scored.slice(0,4).map(x=>x.p);pop=[...elite];
    while(pop.length<14)pop.push(mutate(elite[Math.floor(rng()*elite.length)],rng,Math.max(.45,1-gen*.12)));
  }
  return best;
}

const learned={},scores={};
for(const arch of Object.keys(META)){
  const best=trainArch(arch);
  learned[arch]=Object.fromEntries(Object.entries(best.p).map(([k,v])=>[k,Number(Number(v).toFixed(3))]));
  scores[arch]=Number(best.score.toFixed(4));
}
learned.generic=DEFAULTS.generic;
const payload={version:2,source:'selfplay-v1',training:{seed:20260923,generations:5,population:14,approximateSimulator:true,scores},archetypes:learned};
const output='(() => {\n  window.MUSHI_AI_POLICY = '+JSON.stringify(payload,null,2)+';\n})();\n';
fs.writeFileSync(path.join(__dirname,'..','ai-policy.js'),output,'utf8');
const crypto=require('crypto');
const rev=crypto.createHash('sha256').update(output).digest('hex').slice(0,12);
const indexPath=path.join(__dirname,'..','index.html');
let indexHtml=fs.readFileSync(indexPath,'utf8');
indexHtml=indexHtml.replace(/ai-policy\.js\?v=[^"]+/,'ai-policy.js?v='+rev);
fs.writeFileSync(indexPath,indexHtml,'utf8');
console.log('Self-play policy written:',scores,'cache rev:',rev);
