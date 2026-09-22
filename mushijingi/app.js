(() => {
  'use strict';
  const {cards, decks} = window.MUSHI_DATA;
  const Engine = window.MUSHI_ENGINE;
  if(!Engine) throw new Error('MUSHI_ENGINE is not loaded');
  const {ZONE, EVENT} = Engine;
  const events = Engine.createEventBus();
  const $ = (id) => document.getElementById(id);
  const startScreen = $('startScreen');
  const gameScreen = $('gameScreen');
  const modal = $('modal');
  let uidCounter = 1;
  let state = null;
  let modalResolver = null;

  const colorJa = {red:'赤', blue:'青', green:'緑'};
  const typeJa = {insect:'虫', enhance:'強化', spell:'術'};

  function instance(cardId,owner=null) { return Engine.createCardInstance(uidCounter++,cardId,owner); }
  function def(inst) { return cards[inst.cardId]; }
  function fieldDef(fc) { return Engine.currentCardDefinition(def(fc.inst),fc); }
  function shuffled(list) {
    const a=[...list];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function makeSide(deckKey,isCPU){
    const owner=isCPU?'cpu':'player';
    const deckDef=decks[deckKey];
    const ids=deckDef.randomCount ? shuffled(deckDef.ids).slice(0,deckDef.randomCount) : deckDef.ids;
    const deck=shuffled(ids.map(id=>instance(id,owner)));
    const territory=deck.splice(0,6);
    const hand=deck.splice(0,4);
    return Engine.ensureModernZones({deckKey,deckName:deckDef.name,isCPU,deck,territory,hand,bait:[],discard:[],field:[],cost:0,setDone:false});
  }
  function sideObj(side){ return state[side]; }
  function other(side){ return side==='player'?'cpu':'player'; }
  function fieldActive(side){ return sideObj(side).field.filter(x=>!x.hidden); }
  function cardTypeLabel(card){ return typeJa[card.type] || ''; }
  function newFieldCard(inst){
    const c=def(inst);
    return Engine.createFieldState(inst,{
      mimicTurn:c.passive?.type==='mimic'?state.turnSeq+1:0,
      persistentDamage:0,
      temporaryDestroyTurn:0,
      cannotAttackTurn:0,
      attackLocks:[],
      turnColorOverride:null,
      turnColorOverrideTurn:0,
      hiddenUntilTurnSeq:0,
      damageShieldUsedTurn:0,
      spiderWebTurn:0,
      spiderWebUsedTurn:0,
      poisonBubbleTurn:0,
      puppetDestroyTurn:0
    });
  }
  function log(text){
    state.log.unshift(text);
    state.log=state.log.slice(0,80);
    renderLog();
  }
  function renderLog(){ $('gameLog').innerHTML=state ? state.log.map(x=>`<div>・${escapeHtml(x)}</div>`).join('') : ''; }
  function message(text){ $('messageBox').textContent=text; }
  function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  async function cpuNotice(text){
    const popup=$('cpuActionPopup');
    const textEl=$('cpuActionText');
    if(!popup||!textEl)return;
    textEl.textContent=text;
    popup.classList.remove('hidden');
    const bar=popup.querySelector('.cpu-action-progress');
    if(bar){
      bar.style.animation='none';
      void bar.offsetWidth;
      bar.style.animation='cpuActionTimer 3s linear forwards';
    }
    await sleep(3000);
    popup.classList.add('hidden');
  }
  function hideCpuNotice(){
    const popup=$('cpuActionPopup');
    if(popup)popup.classList.add('hidden');
  }


  function maxHp(fc){
    let hp=fieldDef(fc).hp + Engine.modifierTotal(fc,'hp',state?.turnSeq||0);
    for(const a of fc.attachments){
      const e=def(a).effect;
      if(e==='hp500')hp+=500;
      if(e==='hp800')hp+=800;
      if(e==='hpAttack300')hp+=300;
      if(e==='hpAttack500')hp+=500;
    }
    return hp;
  }
  function effectiveColor(fc){
    if(fc.turnColorOverrideTurn===state?.turnSeq && fc.turnColorOverride)return fc.turnColorOverride;
    for(let i=fc.attachments.length-1;i>=0;i--){
      const e=def(fc.attachments[i]).effect;
      if(e==='changeColor' && fc.changedColor)return fc.changedColor;
      if(e==='setRed')return 'red';
      if(e==='setBlue')return 'blue';
      if(e==='setGreen')return 'green';
    }
    return fieldDef(fc).color;
  }
  function attackBonus(fc){
    let b=(fc.turnAttackBonus||0)+Engine.modifierTotal(fc,'attack',state?.turnSeq||0);
    for(const a of fc.attachments){
      const e=def(a).effect;
      if(e==='attack300')b+=300;
      if(e==='attack500')b+=500;
      if(e==='hpAttack300')b+=300;
      if(e==='hpAttack500')b+=500;
    }
    const p=fieldDef(fc).passive;
    if(p?.type==='emblem'){
      const side=findFieldSide(fc);
      if(side && fieldActive(side).some(x=>x!==fc && fieldDef(x).name===p.partner))b+=Number(p.value||300);
    }
    if(fc.attackPenaltyTurn===state.turnSeq)b-=fc.attackPenalty||0;
    return b;
  }
  function hasAttachment(fc,effect){ return fc.attachments.some(a=>def(a).effect===effect); }
  function ownerSideOf(inst,fallback){
    return inst?.owner==='player'||inst?.owner==='cpu'?inst.owner:fallback;
  }
  function sendToOwnerDiscard(inst,fallback){
    sideObj(ownerSideOf(inst,fallback)).discard.push(inst);
  }
  function sendToOwnerHand(inst,fallback){
    sideObj(ownerSideOf(inst,fallback)).hand.push(inst);
  }
  function sendToOwnerBait(inst,fallback){
    inst.faceDown=false;
    sideObj(ownerSideOf(inst,fallback)).bait.push(inst);
  }
  function isFaceUpBait(inst){return !inst.faceDown;}
  function legalSpellTarget(fc){return fieldDef(fc).passive?.type!=='foamGuard';}
  function oncePerEntryEffect(effect){
    return ['oncePerEntry','bounceOnce','hideUntilOpponentEnd','mimicColorAttack','hornSkewer'].includes(effect);
  }
  function findFieldSide(fc){
    if(!state)return null;
    if(state.player.field.includes(fc))return 'player';
    if(state.cpu.field.includes(fc))return 'cpu';
    return null;
  }
  function dynamicBasePower(side,fc,attack){
    if(!attack.dynamic)return Number(attack.power||0);
    const s=sideObj(side);
    if(attack.dynamic==='redBait200')return s.bait.filter(i=>isFaceUpBait(i)&&def(i).type==='insect'&&def(i).color==='red').length*200;
    if(attack.dynamic==='discard100')return s.discard.length*100;
    if(attack.dynamic==='field100')return fieldActive(side).length*100;
    return Number(attack.power||0);
  }
  function attackPower(side,fc,attack){return Math.max(0,dynamicBasePower(side,fc,attack)+attackBonus(fc));}
  function isAttackBlocked(side,fc){
    if(fieldDef(fc).passive?.type==='foamGuard')return true;
    if(hasAttachment(fc,'summonWithAttachment'))return true;
    if(fc.cannotAttackTurn===state.turnSeq)return true;
    const locks=fc.attackLocks||[];
    for(const lock of locks){
      if(lock.turnSeq!==state.turnSeq)continue;
      const src=sideObj(lock.sourceSide)?.field.find(x=>x.inst.uid===lock.sourceUid);
      if(src && !src.hidden)return true;
    }
    return false;
  }
  function usableAttack(side,fc,attack){
    if(attack.effect==='cannibal' && fieldActive(side).filter(x=>x!==fc).length===0)return false;
    if(attack.effect==='baitSacrifice' && sideObj(side).bait.filter(isFaceUpBait).length===0)return false;
    if(attack.effect==='hornSkewer'&&attackableTargets(side).length===0)return false;
    if(attack.effect==='mimicColorAttack'&&fieldActive(side).filter(x=>x!==fc).length===0)return false;
    if(attack.effect==='multiTwo'){
      const raw=fieldActive(other(side)).filter(x=>x.mimicTurn!==state.turnSeq);
      const forced=raw.filter(x=>['pollen','taunt'].includes(fieldDef(x).passive?.type)||hasAttachment(x,'tauntAttachment'));
      if(forced.length)return false;
      if(raw.length<2)return false;
    }
    return true;
  }
  function weaknessMultiplier(attackerColor, defenderColor){
    return (attackerColor==='red'&&defenderColor==='green') || (attackerColor==='blue'&&defenderColor==='red') || (attackerColor==='green'&&defenderColor==='blue') ? 2 : 1;
  }
  function attackableTargets(attackingSide){
    const opp=other(attackingSide);
    let candidates=fieldActive(opp).filter(fc=>fc.mimicTurn!==state.turnSeq);
    const forced=candidates.filter(fc=>['pollen','taunt'].includes(fieldDef(fc).passive?.type)||hasAttachment(fc,'tauntAttachment'));
    if(forced.length)candidates=forced;
    return candidates;
  }
  function opponentHasFieldInsect(side){ return fieldActive(other(side)).length>0; }
  function hasFlyOutOnField(side){ return fieldActive(side).some(fc=>fieldDef(fc).passive?.type==='flyOut'); }

  function render(){
    if(!state)return;
    const p=state.player,c=state.cpu;
    $('playerDeckName').textContent=p.deckName;
    $('cpuDeckName').textContent=c.deckName;
    $('playerDeckCount').textContent=p.deck.length;
    $('cpuDeckCount').textContent=c.deck.length;
    $('playerHandCount').textContent=p.hand.length;
    $('cpuHandCount').textContent=c.hand.length;
    $('playerBaitCount').textContent=p.bait.length;
    $('cpuBaitCount').textContent=c.bait.length;
    $('playerDiscardCount').textContent=p.discard.length;
    $('cpuDiscardCount').textContent=c.discard.length;
    $('playerFieldCount').textContent=`${fieldActive('player').length}体`;
    $('cpuFieldCount').textContent=`${fieldActive('cpu').length}体`;
    renderTerritory('player'); renderTerritory('cpu');
    renderField('player'); renderField('cpu');
    renderAuxZones();
    renderHand();
    $('turnLabel').textContent = state.over ? '対戦終了' : `${state.turn==='player'?'あなた':'CPU'}のターン`;
    $('phaseLabel').textContent = state.over ? '' : phaseName(state.phase);
    $('costLabel').textContent = state.phase==='main' ? `残りコスト ${sideObj(state.turn).cost}` : '';
    renderActions(); renderLog();
  }
  function phaseName(p){return ({draw:'ドロー',set:'セット',main:'メイン',cpu:'CPU思考中'})[p]||'';}
  function renderTerritory(side){
    const el=$(side==='player'?'playerTerritory':'cpuTerritory');
    el.innerHTML='';
    for(let i=0;i<sideObj(side).territory.length;i++){
      const inst=sideObj(side).territory[i];
      if(inst.faceUpTerritory){
        const d=cardElement(inst,{mini:true});d.title='表向きの縄張り';el.appendChild(d);
      }else{
        const d=document.createElement('div');d.className='territory-card';d.title='縄張り';el.appendChild(d);
      }
    }
  }
  function renderField(side){
    const el=$(side==='player'?'playerField':'cpuField'); el.innerHTML='';
    const arr=sideObj(side).field;
    if(!arr.length){const e=document.createElement('div');e.className='field-empty';e.textContent='場に虫はいません';el.appendChild(e);return;}
    arr.forEach(fc=>el.appendChild(cardElement(fc.inst,{field:fc,side})));
  }
  function cardBack(){
    const d=document.createElement('div'); d.className='card-back'; return d;
  }
  function emptyZone(text){
    const d=document.createElement('div'); d.className='empty-zone'; d.textContent=text; return d;
  }
  function renderPile(id,items,faceUp){
    const el=$(id); el.innerHTML='';
    if(!items.length){el.appendChild(emptyZone('0枚'));return;}
    if(faceUp) el.appendChild(cardElement(items[items.length-1],{mini:true}));
    else el.appendChild(cardBack());
    const n=document.createElement('span');n.className='pile-count';n.textContent=items.length;el.appendChild(n);
  }
  function renderBait(side){
    const el=$(side==='player'?'playerBaitVisual':'cpuBaitVisual');el.innerHTML='';
    const items=sideObj(side).bait;
    if(!items.length){el.appendChild(emptyZone('まだありません'));return;}
    items.forEach(inst=>el.appendChild(inst.faceDown?cardBack():cardElement(inst,{mini:true})));
  }
  function renderCpuHand(){
    const el=$('cpuHandVisual');el.innerHTML='';
    const n=state.cpu.hand.length;
    if(!n){el.appendChild(emptyZone('0枚'));return;}
    for(let i=0;i<Math.min(n,10);i++)el.appendChild(cardBack());
    if(n>10){const more=document.createElement('span');more.className='empty-zone';more.textContent=`+${n-10}`;el.appendChild(more);}
  }
  function renderAuxZones(){
    renderPile('playerDeckVisual',state.player.deck,false);
    renderPile('cpuDeckVisual',state.cpu.deck,false);
    renderPile('playerDiscardVisual',state.player.discard,true);
    renderPile('cpuDiscardVisual',state.cpu.discard,true);
    renderBait('player');renderBait('cpu');renderCpuHand();
  }
  function renderHand(){
    const el=$('playerHand'); el.innerHTML='';
    state.player.hand.forEach(inst=>{
      const playable=canUseHandCard('player',inst);
      const node=cardElement(inst,{hand:true,playable});
      if(playable && !state.over) node.addEventListener('click',()=>onHandCard(inst.uid));
      el.appendChild(node);
    });
  }
  function cardElement(inst,opt={}){
    const fc=opt.field; const c=fc?fieldDef(fc):def(inst);
    const el=document.createElement('div');
    el.className=`game-card ${c.type==='insect'?c.color:'special'} ${opt.playable?'playable':''} ${fc?.attacked?'used':''} ${fc?.hidden?'hidden-insect':''} ${opt.mini?'mini-card':''}`;
    if(fc?.hidden){ el.innerHTML='<div class="card-name">裏向きの虫</div><div class="card-effect">ターン終了まで「場にいない」扱い</div>'; return el; }
    const meta=c.type==='insect' ? `<span>${colorJa[fc?effectiveColor(fc):c.color]}</span><span>HP ${fc?Math.max(0,maxHp(fc)-fc.damage):c.hp}/${fc?maxHp(fc):c.hp}</span>` : `<span>${cardTypeLabel(c)}</span>`;
    const artHtml=c.image?`<div class="card-art"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}"></div>`:'';
    let body='';
    if(c.type==='insect'){
      body=c.attacks.map(a=>`<div class="attack-line"><b>${escapeHtml(a.name)} ${fc?attackPower(opt.side||findFieldSide(fc),fc,a):(a.dynamic?'X':Math.max(0,Number(a.power||0)))}</b>${a.text?`<div>${escapeHtml(a.text)}</div>`:''}</div>`).join('');
      if(c.passive) body+=`<div class="card-effect">${escapeHtml(c.passive.text)}</div>`;
    } else body=`<div class="card-effect">${escapeHtml(c.effectText)}</div>`;
    let status='';
    if(fc){
      if(fc.mimicTurn===state.turnSeq) status+='擬態中 '; if(fc.attackPenaltyTurn===state.turnSeq) status+=`攻撃-${fc.attackPenalty} `;
      if(fc.turnAttackBonus)status+=`攻撃+${fc.turnAttackBonus} `;
      if(fc.persistentDamage)status+=`回復しないダメージ ${fc.persistentDamage} `;
      if(fc.poisonBubbleTurn===state.turnSeq)status+='毒の泡 ';
      if(isAttackBlocked(opt.side||findFieldSide(fc),fc))status+='攻撃不可 ';
    }
    const attaches=fc?.attachments.length?`<div class="attach-line">強化: ${fc.attachments.map(a=>escapeHtml(def(a).name)).join(' / ')}</div>`:'';
    if(c.image)el.classList.add('has-art');
    el.innerHTML=`<div class="card-top"><div class="card-name">${escapeHtml(c.name)}</div><div class="card-cost">${c.cost}</div></div>${artHtml}<div class="card-meta">${meta}</div>${body}${status?`<div class="status-line">${status}</div>`:''}${attaches}`;
    if(fc && opt.side==='player' && state.turn==='player' && state.phase==='main' && !state.over && !fc.hidden){
      if(canAttack(fc)) el.classList.add('playable');
      el.addEventListener('click',()=>onFieldCard(fc.inst.uid));
    }
    return el;
  }
  function renderActions(){
    const bar=$('actionBar'); bar.innerHTML='';
    if(state.over){
      const b=btn('もう一度遊ぶ','action-btn',()=>showStart());bar.appendChild(b);return;
    }
    if(state.turn!=='player')return;
    if(state.phase==='set'){
      bar.appendChild(btn('エサを置かない','action-btn secondary',()=>finishSetPhase()));
      return;
    }
    if(state.phase==='main'){
      if(state.chain?.side==='player') bar.appendChild(btn('連撃をやめる','action-btn secondary',()=>{state.chain=null;message('連撃を終了しました。');render();}));
      else bar.appendChild(btn('ターン終了','action-btn',()=>endTurn()));
    }
  }
  function btn(text,cls,fn){const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=fn;return b;}

  function adultNameForLarva(name){return String(name).replace('（幼虫）','');}
  function faceUpBait(side){return sideObj(side).bait.filter(isFaceUpBait);}
  function canUseHandCard(side,inst){
    if(state.turn!==side||state.over)return false;
    const s=sideObj(side),c=def(inst);
    if(state.phase==='set')return !s.setDone;
    if(state.phase!=='main'||state.chain)return false;
    if(c.type==='insect'&&c.passive?.type==='altSacrifice2')return c.cost<=s.cost||fieldActive(side).length>=2;
    if(c.cost>s.cost)return false;
    if(c.type==='insect')return true;
    if(c.type==='enhance'){
      if(c.effect==='summonWithAttachment')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect');
      return fieldActive(side).length>0;
    }
    const opp=other(side);
    const legalOpp=fieldActive(opp).filter(legalSpellTarget);
    if(c.effect==='recoverInsect')return s.discard.some(x=>def(x).type==='insect');
    if(['burn600','burn1000','destroyOpponent','blockAttackNext'].includes(c.effect))return legalOpp.length>0;
    if(c.effect==='readyAttack')return fieldActive(side).some(fc=>fc.attacked);
    if(c.effect==='baitToHand'||c.effect==='baitTempSummon')return faceUpBait(side).some(x=>def(x).type==='insect');
    if(c.effect==='baitRushTwo')return faceUpBait(side).some(x=>def(x).type==='insect');
    if(c.effect==='moveEnhance')return fieldActive(side).length>=2&&fieldActive(side).some(fc=>fc.attachments.length);
    if(c.effect==='destroyEnhance')return legalOpp.some(fc=>fc.attachments.length);
    if(c.effect==='swapDiscardField')return s.discard.some(x=>def(x).type==='insect')&&fieldActive(side).length>0;
    if(c.effect==='sameCostSwap')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&fieldActive(side).some(fc=>def(fc.inst).cost===def(x).cost));
    if(c.effect==='handTempSummon')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect');
    if(c.effect==='evolveLarva')return fieldActive(side).some(fc=>fieldDef(fc).name.includes('（幼虫）')&&s.hand.some(x=>def(x).type==='insect'&&def(x).name===adultNameForLarva(fieldDef(fc).name)));
    if(c.effect==='singleAttack500')return fieldActive(side).length>0;
    if(c.effect==='harvestBaitSpecial')return faceUpBait(side).some(x=>['enhance','spell'].includes(def(x).type));
    return true;
  }
  function canAttack(fc){
    if(state.phase!=='main'||state.turn!=='player'||fc.hidden||isAttackBlocked('player',fc))return false;
    if(state.chain?.side==='player')return state.chain.uid===fc.inst.uid;
    return !fc.attacked;
  }
  function canAttackSide(side,fc){
    if(fc.hidden||isAttackBlocked(side,fc))return false;
    if(state.chain?.side===side)return state.chain.uid===fc.inst.uid;
    return !fc.attacked;
  }

  async function startGame(deckKey, firstSide){
    const cpuKey=(deckKey==='random1'||deckKey==='random2'||deckKey==='random3')?deckKey:(deckKey==='kabuto'?'mantis':'kabuto');
    uidCounter=1;
    state={player:makeSide(deckKey,false),cpu:makeSide(cpuKey,true),turn:firstSide,turnSeq:1,turnNo:1,phase:'draw',over:false,winner:null,log:[],chain:null,busy:false};
    startScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    log(`対戦開始！ あなたは「${state.player.deckName}」を使用。`);
    log(`${state.turn==='player'?'あなた':'CPU'}が先攻です。`);
    render();
    await beginTurn();
  }
  async function chooseTurnOrder(deckKey){
    const firstSide=await choose([
      {value:'player',title:'先攻',detail:'あなたから開始。先攻1ターン目はドローなし'},
      {value:'cpu',title:'後攻',detail:'CPUが先攻。あなたは後攻で開始'}
    ],'先攻・後攻を選んでください。','ターン順');
    if(!firstSide)return;
    await startGame(deckKey,firstSide);
  }

  function showStart(){
    hideCpuNotice();
    hideResultPopup();
    state=null; gameScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); closeModal(null);
  }
  async function beginTurn(){
    if(state.over)return;
    const side=state.turn,s=sideObj(side);
    state.phase='draw'; state.chain=null;
    s.setDone=false; s.cost=0;
    for(const fc of s.field){fc.attacked=false;Engine.pruneExpiredModifiers(fc,state.turnSeq);}
    for(const owner of ['player','cpu']){
      for(const fc of [...sideObj(owner).field]){
        if((fc.persistentDamage||0)>=maxHp(fc))await attemptDestroyFieldCard(owner,fc,'effect',null);
      }
    }
    events.emit(EVENT.TURN_START,{state,side,turnSeq:state.turnSeq,turnNo:state.turnNo});
    render();
    const firstTurnNoDraw=state.turnNo===1;
    if(!firstTurnNoDraw){
      if(!s.deck.length){ resolveDeckOut(side); return; }
      s.hand.push(s.deck.shift()); log(`${side==='player'?'あなた':'CPU'}が1枚ドロー。`);
    } else log('先攻1ターン目なのでドローはありません。');
    render();
    if(side==='cpu'){state.phase='cpu';render();await sleep(450);await cpuTurn();}
    else {state.phase='set';message('セットフェイズ：手札からエサを1枚置くか、「エサを置かない」を選んでください。');render();}
  }
  function resolveDeckOut(side){
    const p=state.player.territory.length,c=state.cpu.territory.length;
    if(p===c)finishGame('draw',`山札切れ。縄張りが同数（${p}対${c}）なので引き分け！`);
    else {const winner=p>c?'player':'cpu';finishGame(winner,`山札切れ。縄張りが多い${winner==='player'?'あなた':'CPU'}の勝ち！`);}
  }
  async function onHandCard(uid){
    if(state.busy)return; const s=state.player; const inst=s.hand.find(x=>x.uid===uid); if(!inst)return;
    if(state.phase==='set'){
      Engine.moveCard(s,inst,ZONE.HAND,ZONE.BAIT); s.setDone=true;
      events.emit(EVENT.CARD_MOVED,{side:'player',card:inst,from:ZONE.HAND,to:ZONE.BAIT});
      log(`あなたは「${def(inst).name}」をエサにしました。`); finishSetPhase(); return;
    }
    if(state.phase==='main' && canUseHandCard('player',inst)) await playCardFromHand('player',inst);
  }

  function finishSetPhase(){
    if(state.turn!=='player'||state.phase!=='set')return;
    const s=state.player; s.setDone=true; s.cost=s.bait.length; state.phase='main';
    message('メインフェイズ：手札のカードを使う、場の虫で攻撃する、またはターン終了。'); render();
  }
  function emitCost(side,inst,c,cost=c.cost){
    events.emit(EVENT.COST_PAID,{state,side,card:inst,definition:c,cost});
    events.emit(EVENT.REACTION_WINDOW,{state,side,card:inst,definition:c,cost});
  }
  function removeHand(s,inst){s.hand=s.hand.filter(x=>x.uid!==inst.uid);}
  function removeInstance(list,inst){const i=list.findIndex(x=>x.uid===inst.uid);if(i>=0)return list.splice(i,1)[0];return null;}
  function chooseBestInstance(list){return [...list].sort((a,b)=>def(b).cost-def(a).cost)[0]||null;}
  async function chooseOwnedInstance(side,text,list){
    if(!list.length)return null;
    return side==='player'?await chooseInstances(text,list):chooseBestInstance(list);
  }
  async function chooseOwnedField(side,text,list=fieldActive(side)){
    if(!list.length)return null;
    return side==='player'?await chooseField(text,list,true):[...list].sort((a,b)=>def(b.inst).cost-def(a.inst).cost)[0];
  }
  function isCicadaCard(inst){
    return ['ミンミンゼミ','ヒグラシ','クマゼミ','アブラゼミ','テイオウゼミ','エゾゼミ','ツクツクボウシ','チッチゼミ'].includes(def(inst).name);
  }
  async function handleInsectEntered(side,fc){
    const p=fieldDef(fc).passive;
    if(!p)return;

    if(p.type==='honey'){
      const hand=sideObj(side).hand;
      if(!hand.length)return;
      let use=true;
      if(side==='player')use=await confirmYesNo('＜蜜をためる＞を使って、手札1枚をエサにしますか？','蜜をためる');
      if(!use)return;
      const chosen=await chooseOwnedInstance(side,'エサにする手札を選んでください。',hand);
      if(!chosen)return;
      Engine.moveCard(sideObj(side),chosen,ZONE.HAND,ZONE.BAIT);
      chosen.faceDown=false;
      events.emit(EVENT.CARD_MOVED,{state,side,card:chosen,from:ZONE.HAND,to:ZONE.BAIT});
      log(`${sideName(side)}は＜蜜をためる＞で「${def(chosen).name}」をエサにした（このターンのコストは増えない）。`);
      if(side==='cpu'){render();await cpuNotice(`＜蜜をためる＞ → 「${def(chosen).name}」をエサにした`);}
      return;
    }

    if(p.type==='jadeColor'){
      let col=null;
      if(side==='player'){
        col=await choose([
          {value:'blue',title:'青にする',detail:'このターンのみ'},
          {value:'green',title:'緑にする',detail:'このターンのみ'},
          {value:null,title:'変えない',detail:'赤のまま'}
        ],'＜翡翠色＞ このターンの色を選べます。','翡翠色');
      }else{
        const opp=fieldActive(other(side))[0];
        if(opp){
          const oc=effectiveColor(opp);
          col=oc==='red'?'blue':oc==='blue'?'green':'blue';
        }
      }
      if(col){
        fc.turnColorOverride=col;fc.turnColorOverrideTurn=state.turnSeq;
        log(`＜翡翠色＞ 「${fieldDef(fc).name}」はこのターン${colorJa[col]}になった。`);
      }
      return;
    }

    if(p.type==='cicadaEmperor'){
      const choices=sideObj(side).discard.filter(isCicadaCard);
      if(!choices.length)return;
      let use=true;
      if(side==='player')use=await confirmYesNo('＜セミの帝王＞で捨て札のセミ科の虫を場に出しますか？','セミの帝王');
      if(!use)return;
      const chosen=await chooseOwnedInstance(side,'場に出すセミ科の虫を選んでください。',choices);
      if(!chosen)return;
      removeInstance(sideObj(side).discard,chosen);
      const summoned=await putInsectOnField(side,chosen,{noAttackThisTurn:true});
      log(`＜セミの帝王＞ 「${fieldDef(summoned).name}」を捨て札から場に出した。`);
      if(side==='cpu'){render();await cpuNotice(`＜セミの帝王＞ → 「${fieldDef(summoned).name}」を場に出した`);}
    }
  }
  async function putInsectOnField(side,inst,options={}){
    const fc=newFieldCard(inst);
    if(options.temporary)fc.temporaryDestroyTurn=state.turnSeq;
    if(options.noAttackThisTurn)fc.cannotAttackTurn=state.turnSeq;
    if(options.puppet)fc.puppetDestroyTurn=state.turnSeq;
    if(options.attachments)fc.attachments.push(...options.attachments);
    sideObj(side).field.push(fc);
    events.emit(EVENT.INSECT_ENTERED,{state,side,fieldCard:fc,card:inst});
    await handleInsectEntered(side,fc);
    return fc;
  }
  function discardAttachmentsToOwners(fc,controllerSide){
    for(const a of fc.attachments)sendToOwnerDiscard(a,controllerSide);
  }
  function leaveFieldToHand(side,fc){
    const s=sideObj(side);if(!s.field.includes(fc))return false;
    s.field=s.field.filter(x=>x!==fc);
    discardAttachmentsToOwners(fc,side);
    sendToOwnerHand(fc.inst,side);
    events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:fc,reason:'return'});
    log(`「${fieldDef(fc).name}」が持ち主の手札に戻った。`);
    return true;
  }
  function leaveFieldToDiscard(side,fc,reason='effect'){
    return destroyFieldCard(side,fc,reason,null);
  }
  async function attemptDestroyFieldCard(side,fc,reason,attacker){
    const s=sideObj(side);if(!s.field.includes(fc))return false;
    const armorIndex=fc.attachments.findIndex(a=>def(a).effect==='substituteArmor');
    if(armorIndex>=0){
      const [armor]=fc.attachments.splice(armorIndex,1);
      sendToOwnerDiscard(armor,side);
      fc.damage=fc.persistentDamage||0;
      log(`「空蝉の皮鎧」が「${fieldDef(fc).name}」の破壊を防いだ！`);
      if(fc.damage>=maxHp(fc)){
        destroyFieldCard(side,fc,reason,attacker);
        return true;
      }
      return false;
    }
    destroyFieldCard(side,fc,reason,attacker);
    return true;
  }
  function destroyFieldCard(side,fc,reason,attacker){
    const s=sideObj(side);if(!s.field.includes(fc))return false;
    s.field=s.field.filter(x=>x!==fc);
    sendToOwnerDiscard(fc.inst,side);
    discardAttachmentsToOwners(fc,side);
    events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:fc,reason,attacker});
    events.emit(EVENT.INSECT_DESTROYED,{state,side,fieldCard:fc,reason,attacker});
    log(`「${fieldDef(fc).name}」が破壊された。`);
    return true;
  }
  async function captureDestroyedInsect(side,target){
    const owner=ownerSideOf(target.inst,other(side));
    const pile=sideObj(owner).discard;
    const inst=removeInstance(pile,target.inst);
    if(!inst)return null;
    const fc=await putInsectOnField(side,inst,{puppet:true});
    log(`＜操り針＞ 「${fieldDef(fc).name}」を${sideName(side)}の場に出した。ターン終了時に破壊される。`);
    return fc;
  }
  async function resolveAttackDestructionReaction(defenderSide,target,attacker){
    const attackerSide=other(defenderSide);
    const p=fieldDef(target).passive;

    if(attacker&&sideObj(attackerSide).field.includes(attacker)&&p?.type==='poisonBubble'){
      attacker.poisonBubbleTurn=state.turnSeq+1;
      log(`＜毒の泡＞ 「${fieldDef(attacker).name}」に毒の泡がついた。`);
    }
    if(attacker&&sideObj(attackerSide).field.includes(attacker)&&p?.type==='toxicRevenge'){
      log(`＜トウワタ毒＞ 「${fieldDef(attacker).name}」を破壊！`);
      await attemptDestroyFieldCard(attackerSide,attacker,'effect',null);
    }

    if(!attacker||!sideObj(attackerSide).field.includes(attacker))return;
    const poison=p?.type==='poisonMist';
    const revenge=hasAttachment(target,'revenge');
    if(!poison&&!revenge)return;
    let action=poison?'poison':'revenge';
    if(poison&&revenge){
      if(defenderSide==='player'){
        action=await choose([
          {value:'poison',title:'毒霧噴射',detail:'攻撃した虫を手札に戻す'},
          {value:'revenge',title:'針金虫の道連れ',detail:'攻撃した虫を破壊する'}
        ],'同時に使える効果があります。1つ選んでください。','破壊時効果');
      }else action='revenge';
    }
    if(action==='poison'&&sideObj(attackerSide).field.includes(attacker)){
      log(`＜毒霧噴射＞！ 「${fieldDef(attacker).name}」を持ち主の手札に戻した。`);
      leaveFieldToHand(attackerSide,attacker);
    }else if(action==='revenge'&&sideObj(attackerSide).field.includes(attacker)){
      log(`「針金虫の道連れ」で「${fieldDef(attacker).name}」を破壊！`);
      await attemptDestroyFieldCard(attackerSide,attacker,'effect',null);
    }
  }

  async function sacrificeTwoForRiock(side){
    const candidates=fieldActive(side);
    if(candidates.length<2)return false;
    let picks;
    if(side==='player'){
      const a=await chooseField('リオックのために破壊する虫（1つ目）',candidates,true);if(!a)return false;
      const b=await chooseField('リオックのために破壊する虫（2つ目）',candidates.filter(x=>x!==a),true);if(!b)return false;
      picks=[a,b];
    }else picks=[...candidates].sort((a,b)=>(maxHp(a)-a.damage)-(maxHp(b)-b.damage)).slice(0,2);
    for(const fc of picks)destroyFieldCard(side,fc,'sacrifice',null);
    return true;
  }
  async function playCardFromHand(side,inst){
    const s=sideObj(side),c=def(inst);
    let alt=false;
    if(c.type==='insect'&&c.passive?.type==='altSacrifice2'){
      if(c.cost>s.cost){
        if(fieldActive(side).length<2)return false;
        alt=true;
      }else if(fieldActive(side).length>=2&&side==='player'){
        const mode=await choose([
          {value:'cost',title:`${c.cost}コスト払う`,detail:'通常通り場に出す'},
          {value:'sac',title:'虫2つを破壊',detail:'コストを払わず場に出す'}
        ],'リオックをどうやって場に出しますか？','＜エサにする＞');
        if(mode===null)return false;
        alt=mode==='sac';
      }
    }else if(c.cost>s.cost)return false;

    const action={state,side,card:inst,definition:c,cost:alt?'虫2つ':c.cost};
    events.emit(EVENT.CARD_USE_DECLARED,action);
    state.busy=true;
    try{
      if(c.type==='insect'){
        if(alt){
          if(!await sacrificeTwoForRiock(side))return false;
          emitCost(side,inst,c,'虫2つ');
        }else{s.cost-=c.cost;emitCost(side,inst,c);}
        removeHand(s,inst);
        await putInsectOnField(side,inst);
        log(`${sideName(side)}は「${c.name}」を場に出した。`);
        if(side==='cpu'){render();await cpuNotice(`「${c.name}」を場に出した`);}
      }else if(c.type==='enhance'){
        if(c.effect==='summonWithAttachment'){
          const insects=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect');
          if(!insects.length)return false;
          const chosen=await chooseOwnedInstance(side,'「口寄せの時蛹」で場に出す虫を選んでください。',insects);
          if(!chosen)return false;
          s.cost-=c.cost;emitCost(side,inst,c);removeHand(s,inst);removeHand(s,chosen);
          inst.expireTurn=state.turnSeq+1;
          const fc=await putInsectOnField(side,chosen,{attachments:[inst]});
          log(`「口寄せの時蛹」で「${fieldDef(fc).name}」を場に出した。時蛹がある間は攻撃できない。`);
          if(side==='cpu'){render();await cpuNotice(`「口寄せの時蛹」→「${fieldDef(fc).name}」を場に出した`);}
        }else{
          const targets=fieldActive(side);if(!targets.length)return false;
          const target=await chooseOwnedField(side,`「${c.name}」をつける虫を選んでください。`,targets);if(!target)return false;
          s.cost-=c.cost;emitCost(side,inst,c);removeHand(s,inst);target.attachments.push(inst);
          if(c.effect==='changeColor'){
            const col=side==='player'?await chooseSimple('色を選んでください。',[['red','赤'],['blue','青'],['green','緑']]):bestColorAgainstCPU(target,other(side));
            target.changedColor=col||effectiveColor(target);
          }
          log(`${sideName(side)}は「${c.name}」を「${fieldDef(target).name}」につけた。`);
          if(side==='cpu'){render();await cpuNotice(`「${c.name}」を「${fieldDef(target).name}」につけた`);}
        }
      }else{
        const ok=await resolveSpell(side,inst,c);if(!ok)return false;
      }
      events.emit(EVENT.CARD_RESOLVED,action);
      render();return true;
    }finally{state.busy=false;render();}
  }

  async function chooseAttachment(side,fieldCards,text){
    const sources=fieldCards.filter(fc=>fc.attachments.length);
    if(!sources.length)return null;
    const source=await chooseOwnedField(side,text,sources);if(!source)return null;
    const attachment=await chooseOwnedInstance(side,'強化カードを選んでください。',source.attachments);
    if(!attachment)return null;
    return {source,attachment};
  }
  function paySpell(side,inst,c,toDiscard=true){
    const s=sideObj(side);s.cost-=c.cost;emitCost(side,inst,c);removeHand(s,inst);if(toDiscard)s.discard.push(inst);
  }
  async function resolveSpell(side,inst,c){
    const s=sideObj(side),opp=other(side);
    let target,chosen;

    if(c.effect==='recoverInsect'){
      const choices=s.discard.filter(x=>def(x).type==='insect');if(!choices.length)return false;
      chosen=await chooseOwnedInstance(side,'捨て札から手札に戻す虫を選んでください。',choices);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.discard,chosen);s.hand.push(chosen);
      log(`${sideName(side)}は「${c.name}」で「${def(chosen).name}」を手札に戻した。`);
    }else if(c.effect==='burn600'||c.effect==='burn1000'){
      const amount=c.effect==='burn1000'?1000:600;
      const choices=fieldActive(opp).filter(legalSpellTarget);if(!choices.length)return false;
      target=side==='player'?await chooseField(`${amount}ダメージを与える相手の虫を選んでください。`,choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      paySpell(side,inst,c);
      const actual=await dealDamage(opp,target,amount,{source:inst,sourceSide:side,kind:'spell'});
      log(`${sideName(side)}の「${c.name}」！ ${fieldDef(target).name}に${actual}ダメージ。`);
      if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='baitBoost'){
      s.cost-=c.cost;emitCost(side,inst,c);removeHand(s,inst);inst.faceDown=false;s.bait.push(inst);
      log(`${sideName(side)}は「蟲の息吹」を使い、エサを1枚増やした（このターンのコストは増えない）。`);
    }else if(c.effect==='allAttack200'||c.effect==='allAttack300'){
      paySpell(side,inst,c);const value=c.effect==='allAttack300'?300:200;
      for(const fc of fieldActive(side))fc.turnAttackBonus+=value;
      log(`${sideName(side)}の場の虫すべての攻撃力がこのターン+${value}。`);
    }else if(c.effect==='moveEnhance'){
      const pick=await chooseAttachment(side,fieldActive(side),'強化カードがついている虫を選んでください。');if(!pick)return false;
      const dests=fieldActive(side).filter(x=>x!==pick.source);if(!dests.length)return false;
      const dest=await chooseOwnedField(side,'つけ替える先の虫を選んでください。',dests);if(!dest)return false;
      paySpell(side,inst,c);removeInstance(pick.source.attachments,pick.attachment);dest.attachments.push(pick.attachment);
      log(`「${def(pick.attachment).name}」を「${fieldDef(dest).name}」につけ替えた。`);
    }else if(c.effect==='addTerritory'){
      s.cost-=c.cost;emitCost(side,inst,c);removeHand(s,inst);inst.faceUpTerritory=true;s.territory.push(inst);
      log('「蜜蝋の壁」を表向きで縄張りに置いた。');
    }else if(c.effect==='readyAttack'){
      const list=fieldActive(side).filter(fc=>fc.attacked);if(!list.length)return false;
      target=await chooseOwnedField(side,'もう一度攻撃できる虫を選んでください。',list);if(!target)return false;
      paySpell(side,inst,c);target.attacked=false;log(`「${fieldDef(target).name}」がもう一度攻撃できるようになった。`);
    }else if(c.effect==='baitRushTwo'){
      const insects=faceUpBait(side).filter(x=>def(x).type==='insect');if(!insects.length)return false;
      let picks=[];
      if(side==='player'){
        const first=await chooseInstances('エサ場から出す虫（1つ目）を選んでください。',insects);if(!first)return false;
        picks.push(first);const same=insects.filter(x=>x.uid!==first.uid&&def(x).color===def(first).color);
        if(same.length){
          const second=await choose([...same.map(i=>({value:i.uid,title:def(i).name,detail:`${colorJa[def(i).color]} / コスト ${def(i).cost}`})),{value:null,title:'1つだけ出す',detail:''}],'同じ色の虫をもう1つ出せます。','瀬戸際の虫時雨');
          const found=same.find(x=>x.uid===second);if(found)picks.push(found);
        }
      }else{
        const groups={red:[],blue:[],green:[]};for(const i of insects)groups[def(i).color].push(i);
        picks=Object.values(groups).sort((a,b)=>b.length-a.length)[0].sort((a,b)=>def(b).cost-def(a).cost).slice(0,2);
      }
      paySpell(side,inst,c);
      for(const i of picks){removeInstance(s.bait,i);const fc=await putInsectOnField(side,i,{temporary:true});log(`「${fieldDef(fc).name}」がエサ場から出た。`);}
    }else if(c.effect==='destroyOpponent'){
      const choices=fieldActive(opp).filter(legalSpellTarget);if(!choices.length)return false;
      target=side==='player'?await chooseField('破壊する相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      paySpell(side,inst,c);await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='topDeckSummon'){
      paySpell(side,inst,c);
      if(!s.deck.length)log('山札にカードがありません。');
      else{
        const top=s.deck.shift();
        if(def(top).type==='insect'){const fc=await putInsectOnField(side,top,{temporary:true});log(`山札から「${fieldDef(fc).name}」が場に出た。`);}
        else{s.hand.push(top);log(`山札の「${def(top).name}」を手札に加えた。`);}
      }
    }else if(c.effect==='swapDiscardField'){
      const disc=s.discard.filter(x=>def(x).type==='insect');if(!disc.length||!fieldActive(side).length)return false;
      const incoming=await chooseOwnedInstance(side,'捨て札から場に出す虫を選んでください。',disc);if(!incoming)return false;
      const outgoing=await chooseOwnedField(side,'捨て札と入れ替える場の虫を選んでください。');if(!outgoing)return false;
      paySpell(side,inst,c);removeInstance(s.discard,incoming);
      s.field=s.field.filter(x=>x!==outgoing);sendToOwnerDiscard(outgoing.inst,side);discardAttachmentsToOwners(outgoing,side);
      await putInsectOnField(side,incoming,{noAttackThisTurn:true});
      log(`「${fieldDef(outgoing).name}」と「${def(incoming).name}」を入れ替えた。`);
    }else if(c.effect==='baitToHand'){
      const list=faceUpBait(side).filter(x=>def(x).type==='insect');if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'手札に戻すエサの虫を選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.bait,chosen);s.hand.push(chosen);log(`「${def(chosen).name}」をエサ場から手札に戻した。`);
    }else if(c.effect==='baitTempSummon'){
      const list=faceUpBait(side).filter(x=>def(x).type==='insect');if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'場に出すエサの虫を選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.bait,chosen);await putInsectOnField(side,chosen,{temporary:true});log(`「${def(chosen).name}」をエサ場から場に出した。`);
    }else if(c.effect==='handTempSummon'){
      const list=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect');if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'場に出す手札の虫を選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeHand(s,chosen);await putInsectOnField(side,chosen,{temporary:true});log(`「${def(chosen).name}」を手札から場に出した。`);
    }else if(c.effect==='sameCostSwap'){
      const handInsects=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect'&&fieldActive(side).some(fc=>def(fc.inst).cost===def(x).cost));if(!handInsects.length)return false;
      const incoming=await chooseOwnedInstance(side,'場に出す手札の虫を選んでください。',handInsects);if(!incoming)return false;
      const matches=fieldActive(side).filter(fc=>def(fc.inst).cost===def(incoming).cost);
      const outgoing=await chooseOwnedField(side,'手札に戻す同コストの虫を選んでください。',matches);if(!outgoing)return false;
      paySpell(side,inst,c);removeHand(s,incoming);
      s.field=s.field.filter(x=>x!==outgoing);discardAttachmentsToOwners(outgoing,side);sendToOwnerHand(outgoing.inst,side);
      await putInsectOnField(side,incoming,{noAttackThisTurn:true});
      log(`「${def(incoming).name}」と「${fieldDef(outgoing).name}」を入れ替えた。`);
    }else if(c.effect==='destroyEnhance'){
      const choices=fieldActive(opp).filter(fc=>legalSpellTarget(fc)&&fc.attachments.length);
      const source=side==='player'?await chooseField('強化カードを破壊する相手の虫を選んでください。',choices,true):choices[0];
      if(!source)return false;
      const att=side==='player'?await chooseInstances('破壊する強化カードを選んでください。',source.attachments):source.attachments[0];if(!att)return false;
      paySpell(side,inst,c);removeInstance(source.attachments,att);sendToOwnerDiscard(att,opp);log(`「${def(att).name}」を破壊した。`);
    }else if(c.effect==='blockAttackNext'){
      const choices=fieldActive(opp).filter(legalSpellTarget);if(!choices.length)return false;
      target=side==='player'?await chooseField('次のターン攻撃できなくする虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      paySpell(side,inst,c);target.cannotAttackTurn=state.turnSeq+1;log(`「${fieldDef(target).name}」は次のターン攻撃できない。`);
    }else if(c.effect==='evolveLarva'){
      const larvae=fieldActive(side).filter(fc=>fieldDef(fc).name.includes('（幼虫）')&&s.hand.some(x=>def(x).type==='insect'&&def(x).name===adultNameForLarva(fieldDef(fc).name)));
      if(!larvae.length)return false;
      const larva=await chooseOwnedField(side,'羽化させる幼虫を選んでください。',larvae);if(!larva)return false;
      const adults=s.hand.filter(x=>def(x).type==='insect'&&def(x).name===adultNameForLarva(fieldDef(larva).name));
      const adult=await chooseOwnedInstance(side,'場に出す成虫を選んでください。',adults);if(!adult)return false;
      paySpell(side,inst,c);
      sideObj(side).field=sideObj(side).field.filter(x=>x!==larva);
      discardAttachmentsToOwners(larva,side);sendToOwnerBait(larva.inst,side);
      events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:larva,reason:'evolve'});
      removeHand(s,adult);const fc=await putInsectOnField(side,adult);
      log(`「${fieldDef(larva).name}」が「${fieldDef(fc).name}」に羽化した。`);
    }else if(c.effect==='smokeNoFlyOut'){
      paySpell(side,inst,c);state.noFlyOutSide=opp;state.noFlyOutTurn=state.turnSeq;
      log(`「蟲祓いの煙幕」！ このターン${sideName(opp)}は＜とびだす＞を使えない。`);
    }else if(c.effect==='singleAttack500'){
      const list=fieldActive(side);if(!list.length)return false;
      target=await chooseOwnedField(side,'攻撃力を500増やす虫を選んでください。',list);if(!target)return false;
      paySpell(side,inst,c);target.turnAttackBonus+=500;log(`「${fieldDef(target).name}」の攻撃力がこのターン+500。`);
    }else if(c.effect==='harvestBaitSpecial'){
      const list=faceUpBait(side).filter(x=>['enhance','spell'].includes(def(x).type));if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'手札に戻すエサを選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.bait,chosen);s.hand.push(chosen);log(`「${def(chosen).name}」をエサ場から手札に戻した。`);
    }else return false;

    if(side==='cpu'){render();await cpuNotice(`「${c.name}」を使用`);}
    return true;
  }

  async function onFieldCard(uid){
    if(state.busy||state.turn!=='player'||state.phase!=='main')return;
    const fc=state.player.field.find(x=>x.inst.uid===uid);if(!fc||!canAttack(fc))return;
    const c=fieldDef(fc);
    let attacks=c.attacks.filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('player',fc,a));
    if(state.chain?.side==='player'&&state.chain.uid===fc.inst.uid&&state.chain.kind==='mantisCombo')attacks=attacks.filter(a=>a.effect==='mantisCombo');
    const options=attacks.map((a,i)=>({value:i,title:`${a.name} ${attackPower('player',fc,a)}`,detail:a.text||'攻撃'}));
    options.push({value:null,title:'やめる',detail:''});
    const idx=await choose(options,'使う技を選んでください。','虫の攻撃');if(idx===null)return;
    await performAttack('player',fc,attacks[idx]);
  }

  async function dealDamage(targetSide,target,amount,ctx={}){
    let actual=Math.max(0,Number(amount||0));
    const p=fieldDef(target).passive;

    if(ctx.kind==='attack'&&p?.type==='poisonBody'&&String(ctx.attack?.name||'').includes('毒')){
      actual=0;
      log(`＜毒の体＞ 「${fieldDef(target).name}」は毒の技のダメージを0にした。`);
    }

    if(actual>0&&p?.type==='undyingDance'&&target.damageShieldUsedTurn!==state.turnSeq){
      target.damageShieldUsedTurn=state.turnSeq;
      actual=0;
      log(`＜不死蝶の舞＞ 「${fieldDef(target).name}」がこのターン最初のダメージを0にした。`);
    }

    if(actual>0&&target.spiderWebTurn===state.turnSeq&&target.spiderWebUsedTurn!==state.turnSeq){
      target.spiderWebUsedTurn=state.turnSeq;
      actual=0;
      log(`「蜘蛛の巣」で「${fieldDef(target).name}」への最初のダメージを0にした。`);
    }

    if(actual>0&&ctx.kind==='attack'){
      const cuts=target.attachments.filter(a=>def(a).effect==='zeroAttackDamageOnce');
      if(cuts.length){
        target.attachments=target.attachments.filter(a=>def(a).effect!=='zeroAttackDamageOnce');
        for(const a of cuts)sendToOwnerDiscard(a,targetSide);
        actual=0;
        log(`「蚰蜒の足切り」で「${fieldDef(target).name}」への攻撃ダメージを0にした。`);
      }
    }

    events.emit(EVENT.BEFORE_DAMAGE,{state,target,targetSide,amount:actual,...ctx});
    target.damage+=actual;
    if(ctx.kind==='attack'&&ctx.attack?.effect==='persistentDamage'&&actual>0){
      target.persistentDamage=(target.persistentDamage||0)+actual;
    }
    events.emit(EVENT.AFTER_DAMAGE,{state,target,targetSide,amount:actual,...ctx});
    return actual;
  }

  async function applyAttackDamage(side,fc,target,attack,base){
    const defenderSide=other(side);
    const mult=hasAttachment(target,'noWeakness')?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(target));
    const proposed=base*mult;
    const dmg=await dealDamage(defenderSide,target,proposed,{source:fc,sourceSide:side,kind:'attack',attack});
    return {dmg,mult:proposed===0?1:mult};
  }
  async function applyNextTurnHp(fc,value){
    Engine.addModifier(fc,{stat:'hp',value:Number(value||0),activeFromTurnSeq:state.turnSeq+1,expiresAfterTurnSeq:state.turnSeq+1});
  }
  async function chooseBaitToReturn(side){
    const s=sideObj(side),available=s.bait.filter(isFaceUpBait);if(!available.length)return null;
    const chosen=await chooseOwnedInstance(side,'手札に戻すエサを選んでください。',available);if(!chosen)return null;
    removeInstance(s.bait,chosen);s.hand.push(chosen);log(`${sideName(side)}は「${def(chosen).name}」をエサ場から手札に戻した。`);return chosen;
  }
  async function moveEnhanceByAttack(side,fc){
    if(!fc.attachments.length)return;
    const dests=fieldActive(side).filter(x=>x!==fc);if(!dests.length)return;
    const att=await chooseOwnedInstance(side,'つけ替える強化カードを選んでください。',fc.attachments);if(!att)return;
    const dest=await chooseOwnedField(side,'強化カードのつけ替え先を選んでください。',dests);if(!dest)return;
    removeInstance(fc.attachments,att);dest.attachments.push(att);log(`「${def(att).name}」を「${fieldDef(dest).name}」につけ替えた。`);
  }
  async function applyAttackUseSetup(side,fc,attack){
    if(attack.effect==='mimicColorAttack'){
      const others=fieldActive(side).filter(x=>x!==fc);if(!others.length)return false;
      const chosen=await chooseOwnedField(side,'擬態する色の虫を選んでください。',others);if(!chosen)return false;
      fc.turnColorOverride=effectiveColor(chosen);fc.turnColorOverrideTurn=state.turnSeq;
      log(`「${fieldDef(fc).name}」は「${fieldDef(chosen).name}」の色を擬態した。`);
    }
    if(attack.effect==='spiderWeb'){
      fc.spiderWebTurn=state.turnSeq+1;fc.spiderWebUsedTurn=0;
      log(`「${fieldDef(fc).name}」は蜘蛛の巣を張った。`);
    }
    if(attack.effect==='nextOwnAttack'){
      Engine.addModifier(fc,{stat:'attack',value:Number(attack.value||0),activeFromTurnSeq:state.turnSeq+2,expiresAfterTurnSeq:state.turnSeq+2});
      log(`「${fieldDef(fc).name}」は次の自分のターン攻撃力+${Number(attack.value||0)}。`);
    }
    return true;
  }
  async function applyAfterTerritoryAttackEffect(side,fc,attack,drew){
    if(!drew)return;
    if(attack.effect==='growthOnTerritory'&&sideObj(side).field.includes(fc)){
      const value=Number(attack.value||0);
      Engine.addModifier(fc,{stat:'attack',value});
      Engine.addModifier(fc,{stat:'hp',value});
      log(`「${fieldDef(fc).name}」の攻撃力と体力が+${value}。`);
    }
    if(attack.effect==='flipBaitOnTerritory'){
      const defender=other(side),available=sideObj(defender).bait.filter(isFaceUpBait);
      if(!available.length)return;
      let use=true;
      if(side==='player')use=await confirmYesNo('相手のエサを1枚裏向きにしますか？','シロガネタックル');
      if(!use)return;
      const chosen=side==='player'?await chooseInstances('裏向きにする相手のエサを選んでください。',available):available[0];
      if(chosen){chosen.faceDown=true;log(`「${def(chosen).name}」を裏向きのエサにした。`);}
    }
  }
  async function finishAttackSpecialState(side,fc,attack){
    if(attack.effect==='hideUntilOpponentEnd'&&sideObj(side).field.includes(fc)){
      fc.hidden=true;fc.hiddenUntilTurnSeq=state.turnSeq+1;
      log(`「${fieldDef(fc).name}」は＜かくれる＞で次の相手ターン終了時まで裏向きになった。`);
    }
  }
  async function resolveDestroyedAttackTarget(side,fc,target,attack){
    const defender=other(side);
    if(attack.effect==='puppetNeedle')await captureDestroyedInsect(side,target);
    await resolveAttackDestructionReaction(defender,target,fc);
    const suppress=attack.effect==='blockFlyOutAttack';
    const drew=await takeTerritory(defender,false,{attacker:fc,suppressFlyOut:suppress});
    await applyAfterTerritoryAttackEffect(side,fc,attack,drew);
    return drew;
  }

  async function performAttack(side,fc,attack){
    if(state.over||fc.hidden||isAttackBlocked(side,fc))return false;
    const isChainAttack=state.chain?.side===side&&state.chain?.uid===fc.inst.uid;
    let cpuAttackSummary='',sacrificeName='';

    if(attack.effect==='cannibal'){
      const sacrifices=fieldActive(side).filter(x=>x!==fc);if(!sacrifices.length)return false;
      const sac=await chooseOwnedField(side,'「共食い」で破壊する自分の虫を選んでください。',sacrifices);if(!sac)return false;
      sacrificeName=fieldDef(sac).name;destroyFieldCard(side,sac,'sacrifice',null);
      log(`${sideName(side)}は共食いのため「${sacrificeName}」を破壊した。`);
    }
    if(attack.effect==='baitSacrifice'){
      const available=sideObj(side).bait.filter(isFaceUpBait);if(!available.length)return false;
      const bait=await chooseOwnedInstance(side,'「イナゴの大群」で破壊するエサを選んでください。',available);if(!bait)return false;
      removeInstance(sideObj(side).bait,bait);sendToOwnerDiscard(bait,side);log(`「${def(bait).name}」をエサ場から破壊した。`);
    }

    if(attack.effect==='multiTwo'){
      const candidates=attackableTargets(side);if(candidates.length<2)return false;
      let targets;
      if(side==='player'){
        const first=await chooseField(`${attack.name}の1体目を選んでください。`,candidates,true);if(!first)return false;
        const second=await chooseField(`${attack.name}の2体目を選んでください。`,candidates.filter(x=>x!==first),true);if(!second)return false;
        targets=[first,second];
      }else targets=[...candidates].sort((a,b)=>def(b.inst).cost-def(a.inst).cost).slice(0,2);
      if(!await applyAttackUseSetup(side,fc,attack))return false;
      fc.attacked=true;events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,targets,attack});
      for(const target of targets){
        if(!sideObj(side).field.includes(fc))break;
        const {dmg,mult}=await applyAttackDamage(side,fc,target,attack,attackPower(side,fc,attack));
        log(`「${fieldDef(fc).name}」の「${attack.name}」→「${fieldDef(target).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
        let destroyed=false;
        if(target.poisonBubbleTurn===state.turnSeq&&sideObj(other(side)).field.includes(target)){
          destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
          if(destroyed)log('＜毒の泡＞の効果で破壊された。');
        }else if(target.damage>=maxHp(target)){
          destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
        }
        if(destroyed)await resolveDestroyedAttackTarget(side,fc,target,attack);
      }
      await finishAttackSpecialState(side,fc,attack);render();return true;
    }

    let targets=attackableTargets(side),target=null;
    if(attack.effect==='hornSkewer'&&!targets.length)return false;
    if(targets.length){
      if(attack.effect==='blindAttack'&&targets.length>1){
        target=side==='cpu'
          ? await chooseField('盲目攻撃を受ける虫を選んでください。',targets,false)
          : chooseAttackTargetCPU(fc,attack,targets);
      }else{
        target=side==='player'?await chooseField(`${attack.name}の攻撃先を選んでください。`,targets,true):chooseAttackTargetCPU(fc,attack,targets);
      }
      if(!target)return false;
    }

    if(!await applyAttackUseSetup(side,fc,attack))return false;
    events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,target,attack});
    fc.attacked=true;
    if(oncePerEntryEffect(attack.effect))fc.usedAttacks.add(attack.name);

    if(!target){
      log(`${sideName(side)}の「${fieldDef(fc).name}」が${attack.name}で直接攻撃！`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「${attack.name}」で直接攻撃`;
      if(side==='cpu'){render();await cpuNotice(cpuAttackSummary);cpuAttackSummary='';}
      if(attack.effect==='directBaitReturn')await chooseBaitToReturn(other(side));
      if(attack.effect==='hpNextTurn')await applyNextTurnHp(fc,attack.value);
      if(attack.effect==='selfDestruct'&&sideObj(side).field.includes(fc))await attemptDestroyFieldCard(side,fc,'effect',null);
      const drew=await takeTerritory(other(side),true,{attacker:fc,suppressFlyOut:attack.effect==='blockFlyOutAttack'});
      await applyAfterTerritoryAttackEffect(side,fc,attack,drew);
    }else if(attack.effect==='flip'){
      target.hidden=true;target.hiddenUntilTurnSeq=state.turnSeq;
      log(`${sideName(side)}の「すくい投げ」！ 「${fieldDef(target).name}」をターン終了まで裏返した。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「すくい投げ」→「${fieldDef(target).name}」を裏返した`;
    }else if(attack.effect==='bounceOnce'){
      const name=fieldDef(target).name;leaveFieldToHand(other(side),target);
      log(`「${name}」を手札に戻した。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」のヘラクレス投げ → 「${name}」を手札へ`;
    }else{
      if(attack.effect==='rainbowColor'){
        const color=side==='player'?await chooseSimple('相手の虫を何色にしますか？',[['red','赤'],['blue','青'],['green','緑']]):bestColorAgainstCPU(fc,other(side));
        for(const x of fieldActive(other(side))){x.turnColorOverride=color;x.turnColorOverrideTurn=state.turnSeq;}
      }
      if(attack.effect==='sourceAttackLock'){
        target.attackLocks=target.attackLocks||[];target.attackLocks.push({turnSeq:state.turnSeq+1,sourceUid:fc.inst.uid,sourceSide:side});
      }
      if(attack.effect==='moveEnhanceAttack')await moveEnhanceByAttack(side,fc);
      if(attack.effect==='stinkHorn'){target.attackPenaltyTurn=state.turnSeq+1;target.attackPenalty=Number(attack.value||400);}
      if(attack.effect==='hpNextTurn')await applyNextTurnHp(fc,attack.value);

      let destroyed=false;
      const base=attackPower(side,fc,attack);
      if(attack.effect==='hornSkewer'&&target.damage>0&&base>=100){
        destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
        if(destroyed){
          log(`「${fieldDef(fc).name}」のツノ串刺し！ ダメージを与える前に「${fieldDef(target).name}」を破壊した。`);
          await resolveDestroyedAttackTarget(side,fc,target,attack);
        }
      }

      if(!destroyed&&sideObj(other(side)).field.includes(target)){
        const {dmg,mult}=await applyAttackDamage(side,fc,target,attack,base);
        log(`${sideName(side)}の「${fieldDef(fc).name}」が「${fieldDef(target).name}」へ${attack.name}！ ${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
        cpuAttackSummary=`「${fieldDef(fc).name}」の「${attack.name}」→「${fieldDef(target).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}`;
        if(sacrificeName)cpuAttackSummary+=` / 「${sacrificeName}」を共食い`;

        if(attack.effect==='selfDestruct'&&sideObj(side).field.includes(fc))await attemptDestroyFieldCard(side,fc,'effect',null);

        if(target.poisonBubbleTurn===state.turnSeq&&sideObj(other(side)).field.includes(target)){
          destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
          if(destroyed)log('＜毒の泡＞の効果で破壊された。');
        }else if(target.damage>=maxHp(target)){
          destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
        }

        if(destroyed){
          if(attack.effect==='puppetNeedle')await captureDestroyedInsect(side,target);
          await resolveAttackDestructionReaction(other(side),target,fc);
          if(side==='cpu'){render();await cpuNotice(cpuAttackSummary+' → 破壊');cpuAttackSummary='';}
          const drew=await takeTerritory(other(side),false,{attacker:fc,suppressFlyOut:attack.effect==='blockFlyOutAttack'});
          await applyAfterTerritoryAttackEffect(side,fc,attack,drew);
        }
      }
    }

    await finishAttackSpecialState(side,fc,attack);
    render();
    if(side==='cpu'&&cpuAttackSummary)await cpuNotice(cpuAttackSummary);
    if(state.over)return true;
    if(!isChainAttack&&attack.effect==='mantisCombo'&&sideObj(side).field.includes(fc)&&opponentHasFieldInsect(side)){
      state.chain={side,uid:fc.inst.uid,kind:'mantisCombo'};
      if(side==='cpu'){await sleep(300);const nextAttack=chooseMantisSecondAttackCPU(fc);if(nextAttack)await performAttack(side,fc,nextAttack);state.chain=null;}
      else message('カマ連撃！ この虫でもう1度だけ、すぐに攻撃できます。');
    }else if(state.chain?.uid===fc.inst.uid)state.chain=null;
    render();return true;
  }

  async function takeTerritory(side,isDirect,options={}){
    const s=sideObj(side);
    if(!s.territory.length){
      if(isDirect)finishGame(other(side),`${sideName(side)}の縄張りは0。直接攻撃が通り、${sideName(other(side))}の勝ち！`);
      else log(`${sideName(side)}の縄張りは0なので、縄張りは引きません。`);
      return false;
    }
    if(fieldActive(side).some(fc=>hasAttachment(fc,'noTerritory'))){
      log(`「不滅の王台」の効果で${sideName(side)}は縄張りを引かない。`);return false;
    }
    let idx;
    if(side==='player'){
      const opts=s.territory.map((x,i)=>({value:i,title:`縄張り ${i+1}`,detail:x.faceUpTerritory?def(x).name:'裏向きのカード'}));
      idx=await choose(opts,'縄張りを1枚選んで手札に加えます。','縄張り');if(idx===null)idx=0;
    }else idx=Math.floor(Math.random()*s.territory.length);

    const [drawn]=s.territory.splice(idx,1),c=def(drawn);
    events.emit(EVENT.TERRITORY_DRAWN,{state,side,card:drawn,definition:c});
    log(`${sideName(side)}が縄張りを1枚引いた。`);

    if(drawn.faceUpTerritory){
      sendToOwnerDiscard(drawn,side);
      log('「蜜蝋の壁」は捨て札に置かれた。');render();return true;
    }

    const attacker=options.attacker;
    const attachmentBlock=attacker&&sideObj(other(side)).field.includes(attacker)&&hasAttachment(attacker,'blockFlyOut');
    const smokeBlock=state.noFlyOutSide===side&&state.noFlyOutTurn===state.turnSeq;
    const suppressFlyOut=!!options.suppressFlyOut||attachmentBlock||smokeBlock;
    if(c.type==='insect'&&c.passive?.type==='flyOut'&&!hasFlyOutOnField(side)&&!suppressFlyOut){
      let use=true;
      if(side==='player')use=await confirmChoice(`引いたカードは「${c.name}」。＜とびだす＞で場に出しますか？`,'とびだす！');
      if(use){
        const fc=await putInsectOnField(side,drawn);
        log(`＜とびだす＞！ ${sideName(side)}の「${c.name}」が場に出た。`);render();
        if(side==='cpu')await cpuNotice(`縄張りから「${c.name}」が＜とびだす＞で場に出た`);
        return true;
      }
    }
    s.hand.push(drawn);render();return true;
  }

  async function endTurn(){
    if(state.over||state.busy||state.chain)return;
    state.busy=true;
    try{
      events.emit(EVENT.TURN_END,{state,side:state.turn,turnSeq:state.turnSeq,turnNo:state.turnNo});

      for(const controller of ['player','cpu']){
        for(const fc of [...sideObj(controller).field]){
          if(!sideObj(controller).field.includes(fc))continue;
          if(fc.temporaryDestroyTurn===state.turnSeq){
            fc.temporaryDestroyTurn=0;await attemptDestroyFieldCard(controller,fc,'effect',null);
            continue;
          }
          if(fc.puppetDestroyTurn===state.turnSeq){
            fc.puppetDestroyTurn=0;await attemptDestroyFieldCard(controller,fc,'effect',null);
          }
        }
      }

      for(const controller of ['player','cpu']){
        for(const fc of sideObj(controller).field){
          const expired=fc.attachments.filter(a=>a.expireTurn===state.turnSeq);
          if(expired.length){
            fc.attachments=fc.attachments.filter(a=>a.expireTurn!==state.turnSeq);
            for(const a of expired)sendToOwnerDiscard(a,controller);
            log(`「${fieldDef(fc).name}」から「口寄せの時蛹」が外れた。`);
          }
        }
      }

      for(const controller of ['player','cpu']){
        for(const fc of sideObj(controller).field){
          fc.damage=fc.persistentDamage||0;
          fc.turnAttackBonus=0;
          if(fc.hidden&&fc.hiddenUntilTurnSeq===state.turnSeq){
            fc.hidden=false;fc.hiddenUntilTurnSeq=0;
          }
          if(fc.turnColorOverrideTurn===state.turnSeq){
            fc.turnColorOverride=null;fc.turnColorOverrideTurn=0;
          }
        }
      }

      sideObj(state.turn).cost=0;
      state.turn=other(state.turn);state.turnSeq++;state.turnNo++;state.phase='draw';
      log('ターン終了。通常ダメージが回復しました。');render();await sleep(150);await beginTurn();
    }finally{state.busy=false;render();}
  }

  async function cpuTurn(){
    if(state.over)return; const s=state.cpu;
    message('CPUが考えています…');
    if(s.hand.length){
      const bait=chooseBaitCPU(s.hand); Engine.moveCard(s,bait,ZONE.HAND,ZONE.BAIT);events.emit(EVENT.CARD_MOVED,{side:'cpu',card:bait,from:ZONE.HAND,to:ZONE.BAIT});log(`CPUは「${def(bait).name}」をエサにした。`);render();await cpuNotice(`「${def(bait).name}」をエサ場に置いた`);
    }
    s.cost=s.bait.length; state.phase='main';render();
    let guard=0;
    while(!state.over && guard++<20){
      let acted=false;
      const usable=s.hand.filter(x=>canUseHandCardCPU(x));
      const burnTarget=chooseBurnTargetCPU(fieldActive('player'));
      const spellFirst=usable.find(x=>def(x).effect==='allAttack200'&&fieldActive('cpu').filter(fc=>!fc.attacked).length>=2)
        || usable.find(x=>def(x).effect==='burn600'&&burnTarget&&burnTarget.damage+600>=maxHp(burnTarget))
        || usable.find(x=>def(x).effect==='baitBoost'&&s.bait.length<4)
        || usable.find(x=>def(x).type==='insect')
        || usable.find(x=>def(x).type==='enhance')
        || usable.find(x=>def(x).type==='spell');
      if(spellFirst){acted=await playCardFromHand('cpu',spellFirst); if(acted){render();continue;}}
      const attacker=fieldActive('cpu').find(fc=>canAttackSide('cpu',fc));
      if(attacker){
        const at=chooseAttackCPU(attacker); if(at){await performAttack('cpu',attacker,at);acted=true;render();continue;} else attacker.attacked=true;
      }
      if(!acted)break;
    }
    if(!state.over){state.busy=false;await endTurn();}
  }
  function canUseHandCardCPU(inst){return canUseHandCard('cpu',inst);}
  function chooseBaitCPU(hand){
    const score=i=>{const c=def(i);let v=c.cost*1.2;if(c.type==='insect')v+=(c.hp/500)+(Math.max(...c.attacks.map(a=>Number(a.power||0)))/300);if(c.effect==='baitBoost')v-=2;if(c.effect==='allAttack200')v-=.5;return v;};
    return [...hand].sort((a,b)=>score(a)-score(b))[0];
  }
  function chooseAttackCPU(fc){
    const c=fieldDef(fc); let ats=c.attacks.filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('cpu',fc,a));
    const cann=ats.find(a=>a.effect==='cannibal');if(cann&&fieldActive('cpu').length>1)return cann;
    const combo=ats.find(a=>a.effect==='mantisCombo');if(combo)return combo;
    const flip=ats.find(a=>a.effect==='flip');if(flip&&fieldActive('player').length===1)return flip;
    const stink=ats.find(a=>a.effect==='stinkHorn');if(stink&&fieldActive('player').length)return stink;
    return [...ats].sort((a,b)=>attackPower('cpu',fc,b)-attackPower('cpu',fc,a))[0];
  }
  function chooseMantisSecondAttackCPU(fc){return fieldDef(fc).attacks.find(a=>a.effect==='mantisCombo')||null;}
  function chooseAttackTargetCPU(fc,attack,targets){
    const base=attackPower('cpu',fc,attack);
    return [...targets].sort((a,b)=>{
      const da=base*(hasAttachment(a,'noWeakness')?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(a))); const db=base*(hasAttachment(b,'noWeakness')?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(b)));
      const ka=da>=maxHp(a)-a.damage?10000:0, kb=db>=maxHp(b)-b.damage?10000:0;
      return (kb+def(b.inst).cost*100-(maxHp(b)-b.damage))-(ka+def(a.inst).cost*100-(maxHp(a)-a.damage));
    })[0];
  }
  function chooseEnhanceTargetCPU(c,targets){return [...targets].sort((a,b)=>def(b.inst).cost-def(a.inst).cost)[0];}
  function chooseBurnTargetCPU(targets){return [...targets].sort((a,b)=>((600>=maxHp(b)-b.damage)?1000:0)+def(b.inst).cost*50-(((600>=maxHp(a)-a.damage)?1000:0)+def(a.inst).cost*50))[0];}
  function bestColorAgainstCPU(target,oppSide){
    const opp=fieldActive(oppSide)[0]; if(!opp)return effectiveColor(target); const oc=effectiveColor(opp); return oc==='green'?'red':oc==='red'?'blue':'green';
  }

  function sideName(side){return side==='player'?'あなた':'CPU';}
  function hideResultPopup(){
    const p=$('resultPopup');
    if(p){p.classList.add('hidden');p.classList.remove('win','lose','draw');}
  }
  function showResultPopup(winner,text){
    const p=$('resultPopup');
    const title=$('resultTitle');
    const detail=$('resultText');
    if(!p||!title||!detail)return;
    p.classList.remove('hidden','win','lose','draw');
    if(winner==='player'){p.classList.add('win');title.textContent='勝ち！';}
    else if(winner==='cpu'){p.classList.add('lose');title.textContent='負け…';}
    else{p.classList.add('draw');title.textContent='引き分け';}
    detail.textContent=text;
  }
  function finishGame(winner,text){
    state.over=true;state.winner=winner;state.chain=null;state.phase='';
    message(text);log(text);render();showResultPopup(winner,text);
  }

  function choose(options,text,title='選択'){
    return new Promise(resolve=>{
      modalResolver=resolve;$('modalTitle').textContent=title;$('modalText').textContent=text;const wrap=$('modalOptions');wrap.innerHTML='';
      options.forEach(o=>{const b=document.createElement('button');b.className=`modal-option ${o.value===null?'cancel':''}`;b.innerHTML=`<b>${escapeHtml(o.title)}</b>${o.detail?`<small>${escapeHtml(o.detail)}</small>`:''}`;b.onclick=()=>closeModal(o.value);wrap.appendChild(b);});
      modal.classList.remove('hidden');
    });
  }
  function closeModal(value){if(modal.classList.contains('hidden'))return;modal.classList.add('hidden');const r=modalResolver;modalResolver=null;if(r)r(value);}
  function chooseSimple(text,pairs){return choose(pairs.map(([value,title])=>({value,title,detail:''})),text,'選択');}
  function chooseField(text,targets,cancel){
    const opts=targets.map(fc=>({value:fc.inst.uid,title:fieldDef(fc).name,detail:`${colorJa[effectiveColor(fc)]} / HP ${Math.max(0,maxHp(fc)-fc.damage)}/${maxHp(fc)}`}));
    if(cancel)opts.push({value:null,title:'やめる',detail:''});
    return choose(opts,text,'虫を選択').then(uid=>targets.find(x=>x.inst.uid===uid)||null);
  }
  function chooseInstances(text,instances){
    return choose([...instances.map(i=>({value:i.uid,title:def(i).name,detail:`コスト ${def(i).cost}`})),{value:null,title:'やめる',detail:''}],text,'カードを選択').then(uid=>instances.find(i=>i.uid===uid)||null);
  }
  async function confirmChoice(text,title){const v=await choose([{value:true,title:'はい',detail:'場に出す'},{value:false,title:'いいえ',detail:'手札に加える'}],text,title);return !!v;}
  async function confirmYesNo(text,title){const v=await choose([{value:true,title:'はい',detail:''},{value:false,title:'いいえ',detail:''}],text,title);return !!v;}

  $('resultRestartBtn').addEventListener('click',()=>showStart());
  window.MUSHI_RUNTIME={engineVersion:Engine.version,events,getState:()=>state,fieldDef};
  document.querySelectorAll('.deck-choice').forEach(b=>b.addEventListener('click',()=>chooseTurnOrder(b.dataset.deck)));
  $('newGameBtn').addEventListener('click',()=>{ if(!state||state.over)showStart(); else if(confirm('今の対戦を終了して最初からやり直しますか？'))showStart(); });
})();
