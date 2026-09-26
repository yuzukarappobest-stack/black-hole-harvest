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
let PREVIOUS_POLICY=null;
try{
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname,'..','ai-policy.js'),'utf8'),
    sandbox,
    {filename:'ai-policy.js'}
  );
  PREVIOUS_POLICY=sandbox.window.MUSHI_AI_POLICY||null;
}catch(_){ PREVIOUS_POLICY=null; }

const META={
  aquatic:'metaAquatic',
  armyAnt:'metaArmyAnt',
  hercules:'metaHercules',
  sumatra:'metaSumatra3Color',
  bee:'metaBee',
  mimicAggro:'metaMimicAggro',
  colorBlessing:'metaColorBlessing',
  colorCounter:'metaColorCounter'
};

const DEFAULTS={
  aquatic:{resourceTarget:4,finisherResourceTarget:6,blueBaitFloor:4,aggression:1.35,directAttackWeight:1.45,tempSummonBaitFloor:5,tempSummonMinValue:15,preserveWeight:1.2,removalWeight:1.25,aceWeight:1.25,deployThreshold:7,bloodPactWeight:1.4,aquaticCheapBonus:2.5,bounceThreatThreshold:7,reverseSwapDelta:3},
  armyAnt:{resourceTarget:4,blueBaitFloor:2,aggression:1.55,directAttackWeight:1.65,tempSummonBaitFloor:4,tempSummonMinValue:11,preserveWeight:1.05,removalWeight:1,aceWeight:1.2,deployThreshold:6},
  hercules:{resourceTarget:6,blueBaitFloor:2,aggression:1.15,directAttackWeight:1.35,tempSummonBaitFloor:6,tempSummonMinValue:12,preserveWeight:1.35,removalWeight:1.35,aceWeight:1.45,deployThreshold:8},
  sumatra:{resourceTarget:6,blueBaitFloor:2,aggression:1.25,directAttackWeight:1.45,tempSummonBaitFloor:6,tempSummonMinValue:13,preserveWeight:1.35,removalWeight:1.25,aceWeight:1.5,deployThreshold:8},
  bee:{resourceTarget:6,blueBaitFloor:2,aggression:1.2,directAttackWeight:1.35,tempSummonBaitFloor:6,tempSummonMinValue:12,preserveWeight:1.3,removalWeight:1.25,aceWeight:1.45,deployThreshold:8,engineBaitPriority:8},
  mimicAggro:{resourceTarget:4,blueBaitFloor:2,aggression:1.6,directAttackWeight:1.8,tempSummonBaitFloor:4,tempSummonMinValue:10,preserveWeight:.95,removalWeight:.95,aceWeight:1.05,deployThreshold:5},
  colorBlessing:{resourceTarget:5,blueBaitFloor:2,aggression:1.25,directAttackWeight:1.4,tempSummonBaitFloor:5,tempSummonMinValue:11,preserveWeight:1.2,removalWeight:1.2,aceWeight:1.25,deployThreshold:7,rgbBaitPriority:9,bloodPactTerritoryWeight:1.15},
  colorCounter:{resourceTarget:4,blueBaitFloor:2,aggression:1.65,directAttackWeight:1.9,tempSummonBaitFloor:5,tempSummonMinValue:11,preserveWeight:1.25,removalWeight:1.5,aceWeight:1.7,deployThreshold:4.8,rgbBaitPriority:9,bloodPactTerritoryWeight:1.15},
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
  if(arch==='colorBlessing'&&c.passive?.type==='colorBlessing')return 6;
  if(arch==='colorCounter'&&c.passive?.type==='silenceAll')return 18;
  if(arch==='colorCounter'&&c.passive?.type==='phaseMutation')return 11;
  if(arch==='colorCounter'&&c.effect==='spellDanceCounter')return 8;
  if(arch==='colorCounter'&&c.name==='オウサマミツギリゾウムシ')return 6;
  if(arch==='colorCounter'&&c.name==='オオミズアオ（幼虫）')return 5;
  if(arch==='colorCounter'&&c.name==='クロテイオウゼミ')return 5;
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
function silenceOn(side,opp=null){
  return [side,opp].filter(Boolean).some(s=>s?.field?.some(u=>cards[u.id]?.passive?.type==='silenceAll'));
}
function phaseMutationOn(side,opp=null){
  if(silenceOn(side,opp))return false;
  return !!side?.field?.some(u=>cards[u.id]?.passive?.type==='phaseMutation');
}
function rgbBait(side,opp=null){
  if(phaseMutationOn(side,opp)||phaseMutationOn(opp,side))return false;
  const s=new Set(side.bait.map(id=>cards[id]?.color));
  return s.has('red')&&s.has('blue')&&s.has('green');
}
function effectiveCost(side,id,opp=null){
  const c=cards[id];let cost=Number(c.cost||0);
  if(c.passive?.type==='aquaticCost')cost=Math.max(0,cost-Math.floor(blueBait(side)/2));
  if(c.passive?.type==='colorBlessing'){
    if(!silenceOn(side,opp)){
      const colors=(phaseMutationOn(side,opp)||phaseMutationOn(opp,side))
        ? new Set(side.bait.some(x=>cards[x]?.type==='insect')?['colorless']:[])
        : new Set(side.bait.filter(x=>cards[x]?.type==='insect').map(x=>cards[x]?.color).filter(Boolean));
      cost=Math.max(0,cost-colors.size);
    }
  }
  if(c.effect==='eternalCocoon'){
    const colors=new Set(side.bait.map(x=>cards[x]?.color).filter(Boolean));
    for(const col of ['red','blue','green'])if(colors.has(col))cost--;
    cost=Math.max(0,cost);
  }
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
  if(arch==='colorBlessing'&&c.type==='insect'){
    const have=new Set(side.bait.filter(x=>cards[x]?.type==='insect').map(x=>cards[x]?.color));
    const missing=new Set(['red','blue','green'].filter(x=>!have.has(x)));
    if(missing.has(c.color)){
      v-=Number(p.rgbBaitPriority||9);
      if(c.passive?.type==='colorBlessing')v+=5;
    }else if(missing.size&&!['red','blue','green'].includes(c.color))v+=3;
  }
  if(arch==='colorBlessing'&&c.effect==='bloodPact')v+=8;
  if(arch==='colorCounter'){
    if(c.passive?.type==='silenceAll')v+=26;
    if(c.passive?.type==='phaseMutation')v+=14;
    if(c.effect==='spellDanceCounter')v+=silenceOn(side)||phaseMutationOn(side)?12:5;
    if(c.name==='オウサマミツギリゾウムシ')v+=7;
    if(c.name==='オオミズアオ（幼虫）')v+=6;
    if(c.name==='クロテイオウゼミ')v+=5;
    if(c.effect==='burn1000'||c.effect==='bloodPact')v+=5;
  }
  if(arch==='sumatra'&&c.type==='insect'){
    const have=new Set(side.bait.filter(x=>cards[x]?.type==='insect').map(x=>cards[x]?.color));
    const missing=new Set(['red','blue','green'].filter(x=>!have.has(x)));
    if(missing.has(c.color))v-=Number(p.rgbBaitPriority||8);
    if(c.name==='スマトラオオヒラタクワガタ')v+=14;
  }
  if(arch==='bee'){
    const beeBait=side.bait.filter(x=>cards[x]?.type==='insect'&&isWasp(cards[x])&&cards[x]?.name!=='オオスズメバチ（女王）'&&Number(cards[x]?.cost||0)<=5).length;
    if(c.type==='insect'&&isWasp(c)&&c.name!=='オオスズメバチ（女王）'&&Number(c.cost||0)<=5&&beeBait<2)v-=Number(p.engineBaitPriority||8);
    if(c.name==='オオスズメバチ（女王）')v+=14;
  }
  if(arch==='armyAnt'){
    if(c.name==='ミツツボアリ'&&side.bait.length<4)v+=5;
    if(c.passive?.type==='militaryLink'&&side.field.filter(u=>cards[u.id]?.passive?.type==='militaryLink').length<2)v+=4;
  }
  if(arch==='hercules'){
    if(c.name==='ヘラクレスオオカブト'||c.effect==='handTempSummon')v+=12;
    if(c.name==='ゴライアスオオツノハナムグリ')v-=2;
  }
  if(arch==='mimicAggro'){
    const have=new Set(side.bait.filter(x=>cards[x]?.type==='insect').map(x=>cards[x]?.color));
    const missing=new Set(['red','blue','green'].filter(x=>!have.has(x)));
    const hasCocoon=[...side.hand,...side.deck,...side.bait,...side.discard].some(x=>cards[x]?.effect==='eternalCocoon');
    if(hasCocoon&&c.type==='insect'&&missing.has(c.color))v-=Number(p.rgbBaitPriority||7);
    if(c.effect==='bloodPact')v+=8;
    if(c.effect==='eternalCocoon')v+=6;
  }
  return v;
}
function chooseBait(side,p){
  if(!side.hand.length)return null;
  const ranked=[...side.hand].sort((a,b)=>keepScore(side,a,p)-keepScore(side,b,p));
  let target=p.resourceTarget;
  if(side.arch==='aquatic'){
    const hasFinisher=side.hand.some(id=>['ヘラクレスオオカブト','サカダチコノハナナフシ','シタベニオオバッタ'].includes(cards[id]?.name));
    if(hasFinisher)target=Math.max(target,Number(p.finisherResourceTarget||6));
  }
  if(side.bait.length<target)return ranked[0];
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
function bestTempHandInsect(side,list,p){
  const candidates=[...list].filter(id=>{
    const c=cards[id];
    if(c?.type!=='insect')return false;
    const cost=effectiveCost(side,id);
    return cost>=4||maxAttack(c)>=700;
  });
  return candidates.sort((a,b)=>{
    const va=cardValue(side.arch,cards[a],p)+maxAttack(cards[a])/120+Math.max(0,effectiveCost(side,a)-1)*3;
    const vb=cardValue(side.arch,cards[b],p)+maxAttack(cards[b])/120+Math.max(0,effectiveCost(side,b)-1)*3;
    return vb-va;
  })[0];
}
function deathTriggerCard(c){
  const text=String(c?.passive?.text||'')+' '+(c?.attacks||[]).map(a=>String(a.text||'')).join(' ');
  return /破壊されたとき|破壊されるとき/.test(text)||['toxicRevenge','poisonBubble','abyssRevival'].includes(c?.passive?.type);
}

function actionCandidates(me,opp,p){
  const out=[];
  for(const id of me.hand){
    const c=cards[id],cost=effectiveCost(me,id,opp);
    if(c.type==='insect'&&cost<=me.bait.length){
      let score=cardValue(me.arch,c,p)*p.aceWeight-cost*.35;
      if(cost<=1)score+=2*p.aggression+Number(p.cheapDeployBonus||0);
      if(c.passive?.type==='aquaticCost')score+=3+(me.arch==='aquatic'?Number(p.aquaticCheapBonus||0):0);
      if(me.arch==='sumatra'&&c.name==='スマトラオオヒラタクワガタ')score+=rgbBait(me,opp)?12:-5;
      if(me.arch==='colorBlessing'&&c.passive?.type==='colorBlessing'){
        score+=rgbBait(me,opp)?14:1;
        if(rgbBait(me,opp)&&cost<=2)score+=7;
      }
      if(me.arch==='colorCounter'&&c.passive?.type==='silenceAll'){
        score+=opp.arch==='colorBlessing'&&!silenceOn(me,opp)?48:18;
      }
      if(me.arch==='colorCounter'&&c.passive?.type==='phaseMutation'&&!silenceOn(me,opp)){
        score+=opp.arch==='colorBlessing'&&!phaseMutationOn(me,opp)?30:10;
      }
      if(me.arch==='bee'&&c.name==='オオスズメバチ（女王）')score+=me.bait.filter(x=>isWasp(cards[x])&&Number(cards[x].cost||0)<=5).length*4;
      const colorCounterTactical=me.arch==='colorCounter'
        ? (c.name==='クロテイオウゼミ'?7:c.name==='オウサマミツギリゾウムシ'?8:c.name==='オオミズアオ（幼虫）'?6:c.name==='チリクワガタ'?5:0)
        : 0;
      score+=colorCounterTactical;
      out.push({kind:'insect',id,cost,score});
    }else if(c.type==='enhance'&&cost<=me.bait.length&&me.field.length){
      out.push({kind:'enhance',id,cost,score:4+me.field.reduce((m,u)=>Math.max(m,threat(me,u)),0)*.25});
    }else if(c.type==='spell'&&(cost<=me.bait.length||(c.effect==='bloodPact'&&me.territory.length>=2))){
      if(c.effect==='handTempSummon'){
        const best=bestTempHandInsect(me,me.hand.filter(x=>x!==id),p);
        if(best!=null)out.push({kind:'handTemp',id,target:best,cost,score:tempSummonValue(me,best,p)*.95+3});
      }else if(c.effect==='baitTempSummon'&&canTempFromBait(me,p)){
        const best=[...me.bait].filter(x=>cards[x]?.type==='insect').sort((a,b)=>tempSummonValue(me,b,p)-tempSummonValue(me,a,p))[0];
        if(best!=null)out.push({kind:'baitTemp',id,target:best,cost,score:tempSummonValue(me,best,p)-6*p.preserveWeight});
      }else if(c.effect==='recoverInsect'&&me.discard.some(x=>cards[x]?.type==='insect')){
        const best=bestInsect(me.discard,me.arch,p);
        out.push({kind:'recover',id,target:best,cost,score:best!=null?cardValue(me.arch,cards[best],p)*.55:0});
      }else if(c.effect==='spellDanceCounter'&&cost<=me.bait.length&&!opp.spellCounter){
        const lock=silenceOn(me,opp)||phaseMutationOn(me,opp);
        out.push({kind:'spellGuard',id,cost,score:(lock?28:10)+p.preserveWeight*2});
      }else if(c.effect==='bloodPact'&&opp.field.length&&(cost<=me.bait.length||me.territory.length>=2)){
        const t=[...opp.field].sort((a,b)=>threat(opp,b)-threat(opp,a))[0];
        const ready=me.field.filter(u=>!u.attacked&&u.delay<=0).length;
        const hitsNeeded=opp.territory.length+1;
        const single=opp.field.length===1;
        const discounted=me.hand.filter(x=>x!==id&&cards[x]?.type==='insect'&&cards[x]?.passive?.type==='colorBlessing')
          .map(x=>effectiveCost(me,x,opp)).filter(x=>x<=me.bait.length).sort((a,b)=>a-b);
        const afterBudget=Math.max(0,me.bait.length-cost);
        const fullDeploy=discounted.filter((_,i,arr)=>{
          let sum=0;for(let j=0;j<=i;j++)sum+=arr[j];return sum<=me.bait.length;
        }).length;
        const afterDeploy=discounted.filter((_,i,arr)=>{
          let sum=0;for(let j=0;j<=i;j++)sum+=arr[j];return sum<=afterBudget;
        }).length;
        const lethal=single&&(ready+fullDeploy)>=hitsNeeded;
        const preserves=fullDeploy>afterDeploy;
        const safe=me.territory.length>=3||lethal;
        let payTerritory=me.territory.length>=2&&(
          cost>me.bait.length||
          (me.arch==='colorBlessing'&&(lethal||(safe&&single&&preserves&&(ready+fullDeploy)>=2)))
        );
        let score=threat(opp,t)*p.removalWeight*1.8*Number(p.bloodPactWeight||1);
        if(lethal)score+=35;
        if(payTerritory&&me.arch==='colorBlessing')score+=(preserves?12:3)*Number(p.bloodPactTerritoryWeight||1.15);
        if(payTerritory&&me.territory.length<=2&&!lethal)score-=25;
        if(me.arch==='mimicAggro'){
          const cheap=me.hand.filter(x=>x!==id&&cards[x]?.type==='insect'&&effectiveCost(me,x,opp)<=2).map(x=>effectiveCost(me,x,opp)).sort((a,b)=>a-b);
          const countWithin=budget=>{let n=0,sum=0;for(const x of cheap){if(sum+x>budget)break;sum+=x;n++;}return n;};
          const full=countWithin(me.bait.length),after=countWithin(Math.max(0,me.bait.length-cost));
          const ready=me.field.filter(u=>!u.attacked&&u.delay<=0).length;
          const lethal=opp.field.length===1&&(ready+full)>=opp.territory.length+1;
          const preserves=full>after;
          const safe=me.territory.length>=3||lethal;
          if(me.territory.length>=2&&(lethal||(safe&&opp.field.length===1&&preserves&&(ready+full)>=2)))payTerritory=true;
          if(payTerritory&&preserves)score+=12*Number(p.bloodPactTerritoryWeight||1);
          if(lethal)score+=35;
        }
        out.push({kind:'bloodPact',id,target:t,cost,payTerritory,score});
      }else if(c.effect==='eternalCocoon'&&opp.field.length){
        const t=[...opp.field].sort((a,b)=>{
          const va=threat(opp,a)+(deathTriggerCard(cards[a.id])?10:0);
          const vb=threat(opp,b)+(deathTriggerCard(cards[b.id])?10:0);
          return vb-va;
        })[0];
        let score=threat(opp,t)*p.removalWeight*1.65+(deathTriggerCard(cards[t.id])?12:0);
        if(opp.field.length===1&&me.field.some(u=>!u.attacked&&u.delay<=0))score+=12;
        out.push({kind:'cocoon',id,target:t,cost,score});
      }else if(c.effect==='blackMountain'&&me.arch==='mimicAggro'&&me.field.length>=2&&opp.field.length){
        const ready=me.field.filter(u=>!u.attacked&&u.delay<=0);
        const buff=me.field.length*100;
        let newKills=0;
        for(const u of ready){
          const before=attackPower(me,u),after=before+buff;
          if(opp.field.some(t=>before<Number(cards[t.id]?.hp||0)-t.damage&&after>=Number(cards[t.id]?.hp||0)-t.damage))newKills++;
        }
        const score=ready.length*2+buff/90+newKills*12+(ready.length>=3?6:0);
        out.push({kind:'blackMountain',id,cost,score});
      }else if(c.effect==='flyLarvae'&&me.arch==='mimicAggro'){
        const bugs=me.discard.filter(x=>cards[x]?.type==='insect'&&Number(cards[x]?.cost||0)<=1);
        if(bugs.length){
          const bodies=Math.min(2,bugs.length);
          const score=bodies*5+(me.field.length<=1?10:me.field.length===2?5:0);
          out.push({kind:'flyLarvae',id,cost,score});
        }
      }else if(c.effect==='singleAttack500'&&me.arch==='mimicAggro'&&me.field.length&&opp.field.length){
        let score=2,target=null;
        for(const u of me.field.filter(x=>!x.attacked&&x.delay<=0)){
          const base=attackPower(me,u);
          for(const t of opp.field){
            const remain=Number(cards[t.id]?.hp||0)-t.damage;
            if(base<remain&&base+500>=remain&&14+threat(opp,t)>score){score=14+threat(opp,t);target=u;}
          }
        }
        if(!target)target=[...me.field].sort((a,b)=>attackPower(me,b)-attackPower(me,a))[0];
        out.push({kind:'singleAttack500',id,target,cost,score});
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
      budget-=a.cost;
      const unit={id:a.id,damage:0,buff:0,temp:false,delay:0,bounceUsed:false,attacked:false,mimicShield:cards[a.id]?.passive?.type==='mimic'};
      me.field.push(unit);
      if(cards[a.id]?.name==='ミツツボアリ'&&me.hand.length){
        const extra=[...me.hand].sort((x,y)=>keepScore(me,x,p)-keepScore(me,y,p))[0];
        if(extra!=null){moveOne(me.hand,extra);me.bait.push(extra);}
      }
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
    }else if(a.kind==='spellGuard'){
      budget-=a.cost;me.discard.push(a.id);opp.spellCounter=true;
    }else if(a.kind==='bloodPact'){
      if(a.payTerritory||a.cost>budget)me.territory.splice(0,Math.min(2,me.territory.length));
      else budget-=a.cost;
      me.discard.push(a.id);
      if(me.spellCounter){
        me.spellCounter=false;
      }else{
        const counteredBySuperClairvoyance=!silenceOn(me,opp)&&opp.field.find(u=>cards[u.id]?.passive?.type==='superClairvoyance');
        if(counteredBySuperClairvoyance){
          opp.discard.push(counteredBySuperClairvoyance.id);
          opp.field.splice(opp.field.indexOf(counteredBySuperClairvoyance),1);
        }else{
          const i=opp.field.indexOf(a.target);if(i>=0){opp.discard.push(opp.field[i].id);opp.field.splice(i,1);}
        }
      }
    }else if(a.kind==='cocoon'){
      budget-=a.cost;me.discard.push(a.id);
      const i=opp.field.indexOf(a.target);if(i>=0){opp.deck.push(opp.field[i].id);opp.field.splice(i,1);}
    }else if(a.kind==='blackMountain'){
      budget-=a.cost;me.discard.push(a.id);
      const value=me.field.length*100;for(const u of me.field)u.buff=(u.buff||0)+value;
    }else if(a.kind==='flyLarvae'){
      budget-=a.cost;me.discard.push(a.id);
      const bugs=[...me.discard].filter(x=>cards[x]?.type==='insect'&&Number(cards[x]?.cost||0)<=1)
        .sort((x,y)=>cardValue(me.arch,cards[y],p)-cardValue(me.arch,cards[x],p)).slice(0,2);
      for(const x of bugs){moveOne(me.discard,x);me.field.push({id:x,damage:0,buff:0,temp:false,delay:1,bounceUsed:false,attacked:true,mimicShield:cards[x]?.passive?.type==='mimic'});}
    }else if(a.kind==='singleAttack500'){
      budget-=a.cost;me.discard.push(a.id);if(a.target)a.target.buff=(a.target.buff||0)+500;
    }
  }
}
function strike(me,opp,u,p){
  const c=cards[u.id];
  if(u.delay>0||u.attacked)return null;

  const legalTargets=opp.field.filter(t=>{
    const tc=cards[t.id],pt=tc?.passive?.type;
    if(pt==='mimic'&&t.mimicShield)return false;
    if(pt==='batesMimic'&&opp.field.length>1)return false;
    return true;
  });

  if(!legalTargets.length){
    if(opp.territory.length){
      const drawn=opp.territory.shift(),dc=cards[drawn];
      if(dc?.type==='insect'&&dc?.passive?.type==='flyOut'){
        opp.field.push({id:drawn,damage:0,buff:0,temp:false,delay:0,bounceUsed:false,attacked:true,mimicShield:dc.passive?.type==='mimic'});
      }else opp.hand.push(drawn);
    }else return 'win';
    u.attacked=true;return null;
  }
  const effects=(c.attacks||[]).map(a=>a.effect);

  // Hercules throw: bounce a sufficiently valuable wall instead of wasting damage.
  const bounce=effects.includes('bounceOnce')&&!u.bounceUsed;
  if(bounce){
    const t=[...opp.field].sort((a,b)=>threat(opp,b)-threat(opp,a))[0];
    if(t&&threat(opp,t)*p.removalWeight>=Number(p.bounceThreatThreshold||7)){
      opp.hand.push(t.id);opp.field.splice(opp.field.indexOf(t),1);u.bounceUsed=true;u.attacked=true;return null;
    }
  }

  // Reverse swap: trade the strongest opposing field insect for its weakest bait insect.
  if(effects.includes('reverseSwap')&&opp.bait.length){
    const outgoing=[...opp.field].sort((a,b)=>threat(opp,b)-threat(opp,a))[0];
    const incoming=[...opp.bait].filter(id=>cards[id]?.type==='insect').sort((a,b)=>baseValue(cards[a])-baseValue(cards[b]))[0];
    if(outgoing&&incoming!=null){
      const delta=threat(opp,outgoing)-baseValue(cards[incoming]);
      if(delta>=Number(p.reverseSwapDelta||3)){
        opp.field.splice(opp.field.indexOf(outgoing),1);opp.bait.push(outgoing.id);
        moveOne(opp.bait,incoming);
        const fresh={id:incoming,damage:0,buff:0,temp:false,delay:0,bounceUsed:false,attacked:false};
        opp.field.push(fresh);
        const dmg=attackPower(me,u);fresh.damage+=dmg;
        if(fresh.damage>=Number(cards[fresh.id].hp||0)){opp.discard.push(fresh.id);opp.field.splice(opp.field.indexOf(fresh),1);}
        u.attacked=true;return null;
      }
    }
  }

  const dmg=attackPower(me,u);
  const killable=legalTargets.filter(t=>dmg>=Number(cards[t.id].hp||0)-t.damage);
  const pool=killable.length?killable:legalTargets;
  const target=[...pool].sort((a,b)=>{
    if(killable.length){
      const overA=dmg-(Number(cards[a.id].hp||0)-a.damage);
      const overB=dmg-(Number(cards[b.id].hp||0)-b.damage);
      return (threat(opp,b)*p.removalWeight-overB/700)-(threat(opp,a)*p.removalWeight-overA/700);
    }
    return threat(opp,b)*p.removalWeight-threat(opp,a)*p.removalWeight;
  })[0];
  target.damage+=dmg;
  if(target.damage>=Number(cards[target.id].hp||0)){opp.discard.push(target.id);opp.field.splice(opp.field.indexOf(target),1);}
  u.attacked=true;
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
    for(const u of opp.field)u.mimicShield=false;
    cleanup(me);
    me.spellCounter=false; // expires at the end of the protected player's turn if unused
  }
  const scoreA=sides[0].territory.length+sides[0].field.length*.3;
  const scoreB=sides[1].territory.length+sides[1].field.length*.3;
  return {winner:Math.abs(scoreA-scoreB)<.01?-1:(scoreA>scoreB?0:1),margin:scoreA-scoreB};
}

const PARAMS={
  resourceTarget:[3,7,.7],finisherResourceTarget:[4,7,.7],blueBaitFloor:[2,6,.65],aggression:[.75,2.2,.18],
  directAttackWeight:[.8,2.5,.2],tempSummonBaitFloor:[2,7,.7],tempSummonMinValue:[7,22,1.4],
  preserveWeight:[.7,1.8,.12],removalWeight:[.75,2,.14],aceWeight:[.8,2,.14],deployThreshold:[3.5,11,.75],
  comboWeight:[.6,2.2,.16],cheapDeployBonus:[0,6,.6],rgbBaitPriority:[4,14,1],bloodPactTerritoryWeight:[.6,2.2,.16],engineBaitPriority:[4,14,1],
  bloodPactWeight:[.7,2.7,.2],aquaticCheapBonus:[0,7,.7],bounceThreatThreshold:[3,12,.9],reverseSwapDelta:[.5,8,.7]
};
function mutate(base,rng,scale=1){
  const out={...base};
  for(const [k,[lo,hi,step]] of Object.entries(PARAMS))if(rng()<.75)out[k]=clamp(Number(out[k])+((rng()*2-1)*step*scale),lo,hi);
  out.resourceTarget=Math.round(out.resourceTarget);
  out.finisherResourceTarget=Math.round(out.finisherResourceTarget);
  out.blueBaitFloor=Math.round(out.blueBaitFloor);
  out.tempSummonBaitFloor=Math.round(out.tempSummonBaitFloor);
  return out;
}
function scoreGame(result,ourSeat){
  if(result.winner===-1)return 1;
  const win=result.winner===ourSeat;
  const signedMargin=ourSeat===0?result.margin:-result.margin;
  return (win?3:0)+clamp(signedMargin,-3,3)*.08;
}
function withPolicyDefaults(arch,p){
  const base={...DEFAULTS[arch]};
  return {
    comboWeight:1,
    cheapDeployBonus:0,
    finisherResourceTarget:base.resourceTarget||5,
    blueBaitFloor:2,
    bloodPactWeight:1,
    rgbBaitPriority:base.rgbBaitPriority||9,
    bloodPactTerritoryWeight:base.bloodPactTerritoryWeight||1.15,
    engineBaitPriority:base.engineBaitPriority||8,
    aquaticCheapBonus:0,
    bounceThreatThreshold:7,
    reverseSwapDelta:3,
    ...base,
    ...(p||{})
  };
}
const PREVIOUS_ARCHETYPES=PREVIOUS_POLICY?.archetypes||{};
const BASE_POLICY=Object.fromEntries(
  Object.keys(META).map(arch=>[arch,withPolicyDefaults(arch,PREVIOUS_ARCHETYPES[arch])])
);

function opponentVariantsFor(arch){
  const base=BASE_POLICY[arch];
  const rng=mulberry32(hash('all-meta-opponents-v1:'+arch));
  const out=[{...base}];
  while(out.length<3)out.push(mutate(base,rng,.9));
  return out;
}
const ALL_OPPONENT_VARIANTS=Object.fromEntries(
  Object.keys(META).map(arch=>[arch,opponentVariantsFor(arch)])
);

let TOTAL_GAME_COUNT=0;
function leagueEvalArch(arch,p,gen,index,hall=[]){
  let pts=0,games=0,wins=0,losses=0,draws=0;
  for(const opp of Object.keys(META).filter(x=>x!==arch)){
    const variants=ALL_OPPONENT_VARIANTS[opp];
    for(let v=0;v<variants.length;v++){
      for(let n=0;n<4;n++){
        const seed=hash('all-meta-league-v1:'+arch+':'+opp+':'+v+':'+gen+':'+index+':'+n);
        const r1=runGame(arch,p,opp,variants[v],seed);
        pts+=scoreGame(r1,0);games++;TOTAL_GAME_COUNT++;
        if(r1.winner===0)wins++;else if(r1.winner===1)losses++;else draws++;

        const r2=runGame(opp,variants[v],arch,p,seed^0x9e3779b9);
        pts+=scoreGame(r2,1);games++;TOTAL_GAME_COUNT++;
        if(r2.winner===1)wins++;else if(r2.winner===0)losses++;else draws++;
      }
    }
  }

  for(let h=0;h<hall.length;h++){
    const hp=hall[h];
    for(let n=0;n<4;n++){
      const seed=hash('all-meta-hof-v1:'+arch+':'+h+':'+gen+':'+index+':'+n);
      const r1=runGame(arch,p,arch,hp,seed);
      pts+=scoreGame(r1,0);games++;TOTAL_GAME_COUNT++;
      if(r1.winner===0)wins++;else if(r1.winner===1)losses++;else draws++;

      const r2=runGame(arch,hp,arch,p,seed^0x85ebca6b);
      pts+=scoreGame(r2,1);games++;TOTAL_GAME_COUNT++;
      if(r2.winner===1)wins++;else if(r2.winner===0)losses++;else draws++;
    }
  }
  return {score:pts/games,winRate:wins/games,wins,losses,draws,games};
}

function benchmarkArch(arch,p,rounds=10){
  let pts=0,games=0,wins=0,losses=0,draws=0;
  for(const opp of Object.keys(META).filter(x=>x!==arch)){
    const variants=ALL_OPPONENT_VARIANTS[opp];
    for(let v=0;v<variants.length;v++){
      for(let n=0;n<rounds;n++){
        const seed=hash('all-meta-benchmark-v1:'+arch+':'+opp+':'+v+':'+n);
        const r1=runGame(arch,p,opp,variants[v],seed);
        pts+=scoreGame(r1,0);games++;TOTAL_GAME_COUNT++;
        if(r1.winner===0)wins++;else if(r1.winner===1)losses++;else draws++;

        const r2=runGame(opp,variants[v],arch,p,seed^0x27d4eb2d);
        pts+=scoreGame(r2,1);games++;TOTAL_GAME_COUNT++;
        if(r2.winner===1)wins++;else if(r2.winner===0)losses++;else draws++;
      }
    }
  }
  return {score:pts/games,winRate:wins/games,wins,losses,draws,games};
}

function microMutate(base,rng,scale){
  const out={...base};
  const keys=['resourceTarget','aggression','directAttackWeight','tempSummonBaitFloor','tempSummonMinValue',
    'preserveWeight','removalWeight','aceWeight','deployThreshold','comboWeight','cheapDeployBonus','rgbBaitPriority','bloodPactTerritoryWeight','engineBaitPriority'];
  const changes=2+Math.floor(rng()*4);
  for(let n=0;n<changes;n++){
    const k=keys[Math.floor(rng()*keys.length)];
    const [lo,hi,step]=PARAMS[k];
    if(['resourceTarget','tempSummonBaitFloor'].includes(k)){
      if(rng()<.55)out[k]=clamp(Math.round(Number(out[k])+(rng()<.5?-1:1)),lo,hi);
    }else{
      out[k]=clamp(Number(out[k])+(rng()*2-1)*step*scale,lo,hi);
    }
  }
  return out;
}

function trainFocusedArch(arch){
  const previous=withPolicyDefaults(arch,BASE_POLICY[arch]);
  const rng=mulberry32(hash('all-meta-train-v1:'+arch+':20260924'));

  let population=[previous];
  while(population.length<36)population.push(mutate(previous,rng,1.15));

  const hall=[];
  let champion={p:previous,score:-Infinity,winRate:0};
  const generationStats=[];

  for(let gen=0;gen<12;gen++){
    const scored=population.map((p,i)=>({p,...leagueEvalArch(arch,p,gen,i,hall.slice(-4))}))
      .sort((a,b)=>b.score-a.score);
    if(scored[0].score>champion.score)champion=scored[0];
    hall.push({...scored[0].p});
    if(hall.length>6)hall.shift();

    generationStats.push({
      gen,
      score:Number(scored[0].score.toFixed(4)),
      winRate:Number(scored[0].winRate.toFixed(4))
    });

    const elite=scored.slice(0,6).map(x=>x.p);
    population=[...elite,previous,champion.p];
    while(population.length<36){
      const parent=elite[Math.floor(rng()*elite.length)];
      population.push(mutate(parent,rng,Math.max(.32,1.05-gen*.055)));
    }
  }

  // Fair identical-seed benchmark.
  const baseline=benchmarkArch(arch,previous,10);
  const leagueBest=benchmarkArch(arch,champion.p,10);
  let seedPolicy=leagueBest.score>baseline.score?champion.p:previous;

  // Local refinement around whichever is stronger.
  const candidates=[seedPolicy];
  while(candidates.length<240)candidates.push(microMutate(seedPolicy,rng,.18+rng()*.55));
  const quick=candidates.map((p,i)=>({p,i,...benchmarkArch(arch,p,3)}))
    .sort((a,b)=>b.score-a.score);
  const finalists=quick.slice(0,12).map(x=>({p:x.p,quick:x,full:benchmarkArch(arch,x.p,10)}))
    .sort((a,b)=>b.full.score-a.full.score);

  const seedBench=benchmarkArch(arch,seedPolicy,10);
  const localBest=finalists[0];
  const chosen=localBest&&localBest.full.score>seedBench.score?localBest.p:seedPolicy;
  const chosenBench=localBest&&localBest.full.score>seedBench.score?localBest.full:seedBench;

  return {
    arch,
    policy:chosen,
    previous,
    baseline,
    leagueBest,
    seedBench,
    localBest:localBest?localBest.full:null,
    chosenBench,
    generationStats,
    candidates:candidates.length,
    finalists:finalists.length
  };
}

// ===== 色彩の加護 相性ベンチマーク =====
const TARGET_OPP='colorBlessing';

function colorOpponentVariants(){
  const base=BASE_POLICY[TARGET_OPP];
  const rng=mulberry32(hash('color-counter-benchmark-opponents-v1'));
  const out=[{...base}];
  while(out.length<8)out.push(mutate(base,rng,.9));
  return out;
}
const COLOR_OPPONENTS=colorOpponentVariants();

function benchmarkVsColor(arch,p,rounds=900){
  let pts=0,games=0,wins=0,losses=0,draws=0;
  for(let v=0;v<COLOR_OPPONENTS.length;v++){
    const op=COLOR_OPPONENTS[v];
    for(let n=0;n<rounds;n++){
      const seed=hash('color-benchmark-v1:'+arch+':'+v+':'+n);
      const r1=runGame(arch,p,TARGET_OPP,op,seed);
      pts+=scoreGame(r1,0);games++;TOTAL_GAME_COUNT++;
      if(r1.winner===0)wins++;else if(r1.winner===1)losses++;else draws++;
      const r2=runGame(TARGET_OPP,op,arch,p,seed^0x9e3779b9);
      pts+=scoreGame(r2,1);games++;TOTAL_GAME_COUNT++;
      if(r2.winner===1)wins++;else if(r2.winner===0)losses++;else draws++;
    }
  }
  return {score:pts/games,winRate:wins/games,wins,losses,draws,games};
}

const candidateArches=['aquatic','armyAnt','hercules','sumatra','bee','mimicAggro','termite','colorCounter'];
const matchups={};
for(const arch of candidateArches){
  const p=BASE_POLICY[arch]||DEFAULTS[arch]||DEFAULTS.generic;
  matchups[arch]=benchmarkVsColor(arch,p,900);
  console.log('VS COLOR',arch,matchups[arch]);
}

const payload={
  version:9,
  source:'color-counter-matchup-benchmark-v1',
  training:{
    seed:20260926,
    targetOpponent:TARGET_OPP,
    games:TOTAL_GAME_COUNT,
    approximateSimulator:true,
    matchups
  },
  archetypes:{...PREVIOUS_ARCHETYPES}
};
const output='(() => {\n  window.MUSHI_AI_POLICY = '+JSON.stringify(payload,null,2)+';\n})();\n';
fs.writeFileSync(path.join(__dirname,'..','ai-policy.js'),output,'utf8');
console.log('Color matchup benchmark complete',payload.training);
