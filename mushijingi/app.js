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
    return Engine.createFieldState(inst,{mimicTurn:c.passive?.type==='mimic'?state.turnSeq+1:0});
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
  function findFieldSide(fc){
    if(!state)return null;
    if(state.player.field.includes(fc))return 'player';
    if(state.cpu.field.includes(fc))return 'cpu';
    return null;
  }
  function dynamicBasePower(side,fc,attack){
    if(!attack.dynamic)return Number(attack.power||0);
    const s=sideObj(side);
    if(attack.dynamic==='redBait200')return s.bait.filter(i=>def(i).type==='insect'&&def(i).color==='red').length*200;
    if(attack.dynamic==='discard100')return s.discard.length*100;
    if(attack.dynamic==='field100')return fieldActive(side).length*100;
    return Number(attack.power||0);
  }
  function attackPower(side,fc,attack){return Math.max(0,dynamicBasePower(side,fc,attack)+attackBonus(fc));}
  function isAttackBlocked(side,fc){
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
    if(attack.effect==='baitSacrifice' && sideObj(side).bait.length===0)return false;
    if(attack.effect==='multiTwo' && attackableTargets(side).length<2)return false;
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
      const d=document.createElement('div'); d.className='territory-card'; d.title='縄張り'; el.appendChild(d);
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
    items.forEach(inst=>el.appendChild(cardElement(inst,{mini:true})));
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
    let body='';
    if(c.type==='insect'){
      body=c.attacks.map(a=>`<div class="attack-line"><b>${escapeHtml(a.name)} ${fc?attackPower(opt.side||findFieldSide(fc),fc,a):Math.max(0,Number(a.power||0))}</b>${a.text?`<div>${escapeHtml(a.text)}</div>`:''}</div>`).join('');
      if(c.passive) body+=`<div class="card-effect">${escapeHtml(c.passive.text)}</div>`;
    } else body=`<div class="card-effect">${escapeHtml(c.effectText)}</div>`;
    let status='';
    if(fc){
      if(fc.mimicTurn===state.turnSeq) status+='擬態中 '; if(fc.attackPenaltyTurn===state.turnSeq) status+=`攻撃-${fc.attackPenalty} `;
      if(fc.turnAttackBonus) status+=`攻撃+${fc.turnAttackBonus} `;
    }
    const attaches=fc?.attachments.length?`<div class="attach-line">強化: ${fc.attachments.map(a=>escapeHtml(def(a).name)).join(' / ')}</div>`:'';
    el.innerHTML=`<div class="card-top"><div class="card-name">${escapeHtml(c.name)}</div><div class="card-cost">${c.cost}</div></div><div class="card-meta">${meta}</div>${body}${status?`<div class="status-line">${status}</div>`:''}${attaches}`;
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

  function canUseHandCard(side,inst){
    if(state.turn!==side || state.over) return false;
    const s=sideObj(side),c=def(inst);
    if(state.phase==='set') return !s.setDone;
    if(state.phase!=='main' || state.chain) return false;
    if(c.type==='insect' && c.passive?.type==='altSacrifice2')return c.cost<=s.cost || fieldActive(side).length>=2;
    if(c.cost>s.cost)return false;
    if(c.type==='insect')return true;
    if(c.type==='enhance') return fieldActive(side).length>0;
    if(c.effect==='recoverInsect') return s.discard.some(x=>def(x).type==='insect');
    if(c.effect==='burn600'||c.effect==='destroyOpponent')return fieldActive(other(side)).length>0;
    if(c.effect==='readyAttack')return fieldActive(side).some(fc=>fc.attacked);
    if(c.effect==='baitToHand'||c.effect==='baitTempSummon')return s.bait.some(x=>def(x).type==='insect');
    if(c.effect==='baitRushTwo')return s.bait.some(x=>def(x).type==='insect');
    if(c.effect==='moveEnhance')return fieldActive(side).length>=2 && fieldActive(side).some(fc=>fc.attachments.length);
    if(c.effect==='destroyEnhance')return fieldActive(other(side)).some(fc=>fc.attachments.length);
    if(c.effect==='blockAttackNext')return fieldActive(other(side)).length>0;
    if(c.effect==='swapDiscardField')return s.discard.some(x=>def(x).type==='insect')&&fieldActive(side).length>0;
    if(c.effect==='sameCostSwap')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&fieldActive(side).some(fc=>def(fc.inst).cost===def(x).cost));
    if(c.effect==='handTempSummon')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect');
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
    const cpuKey=deckKey==='random1'?'random1':(deckKey==='kabuto'?'mantis':'kabuto');
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
  async function playCardFromHand(side,inst){
    const s=sideObj(side),c=def(inst); if(c.cost>s.cost)return false;
    const action={state,side,card:inst,definition:c,cost:c.cost};
    events.emit(EVENT.CARD_USE_DECLARED,action);
    state.busy=true;
    try{
      if(c.type==='insect'){
        s.cost-=c.cost; events.emit(EVENT.COST_PAID,{state,side,card:inst,definition:c,cost:c.cost}); events.emit(EVENT.REACTION_WINDOW,{state,side,card:inst,definition:c,cost:c.cost}); removeHand(s,inst); const entered=newFieldCard(inst); s.field.push(entered); events.emit(EVENT.INSECT_ENTERED,{state,side,fieldCard:entered,card:inst}); log(`${sideName(side)}は「${c.name}」を場に出した。`);
        if(side==='cpu'){render();await cpuNotice(`「${c.name}」を場に出した`);}
      } else if(c.type==='enhance'){
        const targets=fieldActive(side); if(!targets.length)return false;
        let target= side==='player' ? await chooseField(`「${c.name}」をつける虫を選んでください。`,targets,true) : chooseEnhanceTargetCPU(c,targets);
        if(!target)return false;
        s.cost-=c.cost; events.emit(EVENT.COST_PAID,{state,side,card:inst,definition:c,cost:c.cost}); events.emit(EVENT.REACTION_WINDOW,{state,side,card:inst,definition:c,cost:c.cost}); removeHand(s,inst); target.attachments.push(inst);
        if(c.effect==='changeColor'){
          const col=side==='player'?await chooseSimple('色を選んでください。',[['red','赤'],['blue','青'],['green','緑']]):bestColorAgainstCPU(target,other(side));
          target.changedColor=col||effectiveColor(target);
        }
        log(`${sideName(side)}は「${c.name}」を「${fieldDef(target).name}」につけた。`);
        if(side==='cpu'){render();await cpuNotice(`「${c.name}」を「${fieldDef(target).name}」につけた`);}
      } else {
        const ok=await resolveSpell(side,inst,c); if(!ok)return false;
      }
      events.emit(EVENT.CARD_RESOLVED,action);
      render(); return true;
    } finally {state.busy=false;render();}
  }
  function removeHand(s,inst){s.hand=s.hand.filter(x=>x.uid!==inst.uid);}
  async function resolveSpell(side,inst,c){
    const s=sideObj(side); let target;
    if(c.effect==='recoverInsect'){
      const choices=s.discard.filter(x=>def(x).type==='insect'); if(!choices.length)return false;
      const chosen=side==='player'?await chooseInstances('捨て札から手札に戻す虫を選んでください。',choices):choices.sort((a,b)=>def(b).cost-def(a).cost)[0];
      if(!chosen)return false;
      s.cost-=c.cost; events.emit(EVENT.COST_PAID,{state,side,card:inst,definition:c,cost:c.cost}); events.emit(EVENT.REACTION_WINDOW,{state,side,card:inst,definition:c,cost:c.cost}); removeHand(s,inst); s.discard=s.discard.filter(x=>x.uid!==chosen.uid); s.hand.push(chosen); s.discard.push(inst);
      log(`${sideName(side)}は「${c.name}」で「${def(chosen).name}」を手札に戻した。`);
      if(side==='cpu'){render();await cpuNotice(`「${c.name}」を使用 → 「${def(chosen).name}」を手札に戻した`);}
      return true;
    }
    if(c.effect==='burn600'){
      const choices=fieldActive(other(side)); if(!choices.length)return false;
      target=side==='player'?await chooseField('600ダメージを与える相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);
      if(!target)return false;
      s.cost-=c.cost; events.emit(EVENT.COST_PAID,{state,side,card:inst,definition:c,cost:c.cost}); events.emit(EVENT.REACTION_WINDOW,{state,side,card:inst,definition:c,cost:c.cost});removeHand(s,inst);s.discard.push(inst);
      events.emit(EVENT.BEFORE_DAMAGE,{state,source:inst,sourceSide:side,target,amount:600,kind:'effect'});
      target.damage+=600;
      events.emit(EVENT.AFTER_DAMAGE,{state,source:inst,sourceSide:side,target,amount:600,kind:'effect'});
      log(`${sideName(side)}の「${c.name}」！ ${fieldDef(target).name}に600ダメージ。`);
      if(target.damage>=maxHp(target))destroyFieldCard(other(side),target,'effect',null);
      if(side==='cpu'){render();await cpuNotice(`「${c.name}」を使用 → 「${fieldDef(target).name}」に600ダメージ`);}
      return true;
    }
    s.cost-=c.cost; events.emit(EVENT.COST_PAID,{state,side,card:inst,definition:c,cost:c.cost}); events.emit(EVENT.REACTION_WINDOW,{state,side,card:inst,definition:c,cost:c.cost}); removeHand(s,inst);
    if(c.effect==='baitBoost'){
      s.bait.push(inst);log(`${sideName(side)}は「蟲の息吹」を使い、エサを1枚増やした（このターンのコストは増えない）。`);
      if(side==='cpu'){render();await cpuNotice('「蟲の息吹」を使用 → エサ場へ（このターンはコスト+1なし）');}
      return true;
    }
    if(c.effect==='allAttack200'){
      for(const fc of fieldActive(side))fc.turnAttackBonus+=200;
      s.discard.push(inst);log(`${sideName(side)}は「飛蝗の凶相」！ 今いる虫の攻撃力がこのターン+200。`);
      if(side==='cpu'){render();await cpuNotice('「飛蝗の凶相」を使用 → 場の虫すべて攻撃力+200');}
      return true;
    }
    return false;
  }

  async function onFieldCard(uid){
    if(state.busy||state.turn!=='player'||state.phase!=='main')return;
    const fc=state.player.field.find(x=>x.inst.uid===uid); if(!fc||!canAttack(fc))return;
    const c=fieldDef(fc);
    let attacks=c.attacks.filter(a=>!(a.effect==='oncePerEntry'&&fc.usedAttacks.has(a.name)) && !(a.effect==='bounceOnce'&&fc.usedAttacks.has(a.name)) && usableAttack('player',fc,a));
    if(state.chain?.side==='player' && state.chain.uid===fc.inst.uid && state.chain.kind==='mantisCombo'){
      attacks=attacks.filter(a=>a.effect==='mantisCombo');
    }
    const options=attacks.map((a,i)=>({value:i,title:`${a.name} ${attackPower('player',fc,a)}`,detail:a.text||'攻撃'}));
    options.push({value:null,title:'やめる',detail:''});
    const idx=await choose(options,'使う技を選んでください。','虫の攻撃');
    if(idx===null)return;
    await performAttack('player',fc,attacks[idx]);
  }

  async function performAttack(side,fc,attack){
    if(state.over||fc.hidden)return false;
    const isChainAttack = state.chain?.side===side && state.chain?.uid===fc.inst.uid;
    let cpuAttackSummary='';
    let sacrificeName='';
    if(attack.effect==='cannibal'){
      const sacrifices=fieldActive(side).filter(x=>x.inst.uid!==fc.inst.uid);
      if(!sacrifices.length){if(side==='player')message('共食いには、この虫以外の自分の虫が必要です。');return false;}
      const sac=side==='player'?await chooseField('「共食い」で破壊する自分の虫を選んでください。',sacrifices,true):sacrifices.sort((a,b)=>maxHp(a)-a.damage-(maxHp(b)-b.damage))[0];
      if(!sac)return false; sacrificeName=def(sac.inst).name; destroyFieldCard(side,sac,'sacrifice',null); log(`${sideName(side)}は共食いのため「${def(sac.inst).name}」を破壊した。`);
    }
    let targets=attackableTargets(side); let target=null;
    if(targets.length){
      target=side==='player'?await chooseField(`${attack.name}の攻撃先を選んでください。`,targets,true):chooseAttackTargetCPU(fc,attack,targets);
      if(!target)return false;
    }
    events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,target,attack});
    fc.attacked=true;
    if(attack.effect==='oncePerEntry')fc.usedAttacks.add(attack.name);
    const base=attackPower('cpu',fc,attack);
    if(!target){
      log(`${sideName(side)}の「${fieldDef(fc).name}」が${attack.name}で直接攻撃！`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「${attack.name}」で直接攻撃`;
      if(side==='cpu'){
        render();
        await cpuNotice(cpuAttackSummary);
        cpuAttackSummary='';
      }
      await takeTerritory(other(side),true);
    } else if(attack.effect==='flip'){
      target.hidden=true; log(`${sideName(side)}の「すくい投げ」！ 「${fieldDef(target).name}」をターン終了まで裏返した。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「すくい投げ」→「${fieldDef(target).name}」を裏返した`;
    } else if(attack.effect==='stinkHorn'){
      target.attackPenaltyTurn=state.turnSeq+1;
      target.attackPenalty=400;
      const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(target));
      const dmg=base*mult;
      events.emit(EVENT.BEFORE_DAMAGE,{state,source:fc,sourceSide:side,target,amount:dmg,kind:'attack',attack});
      target.damage+=dmg;
      events.emit(EVENT.AFTER_DAMAGE,{state,source:fc,sourceSide:side,target,amount:dmg,kind:'attack',attack});
      log(`${sideName(side)}の「くさいツノ」！ 「${fieldDef(target).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}。次のターン攻撃力-400。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「くさいツノ」→「${fieldDef(target).name}」に${dmg}ダメージ / 次ターン攻撃-400`;
      if(target.damage>=maxHp(target)){
        const revenge=hasAttachment(target,'revenge');
        destroyFieldCard(other(side),target,'attack',fc);
        if(revenge && sideObj(side).field.includes(fc)){
          log(`「針金虫の道連れ」で攻撃した「${fieldDef(fc).name}」も破壊！`);
          destroyFieldCard(side,fc,'effect',null);
        }
        if(side==='cpu'){
          render();
          await cpuNotice(cpuAttackSummary + ' → 破壊');
          cpuAttackSummary='';
        }
        await takeTerritory(other(side),false);
      }
    } else {
      const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(target));
      const dmg=base*mult;
      events.emit(EVENT.BEFORE_DAMAGE,{state,source:fc,sourceSide:side,target,amount:dmg,kind:'attack',attack});
      target.damage+=dmg;
      events.emit(EVENT.AFTER_DAMAGE,{state,source:fc,sourceSide:side,target,amount:dmg,kind:'attack',attack});
      log(`${sideName(side)}の「${fieldDef(fc).name}」が「${fieldDef(target).name}」へ${attack.name}！ ${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「${attack.name}」→「${fieldDef(target).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}`;
      if(sacrificeName)cpuAttackSummary+=` / 「${sacrificeName}」を共食い`;
      if(target.damage>=maxHp(target)){
        const revenge=hasAttachment(target,'revenge');
        destroyFieldCard(other(side),target,'attack',fc);
        if(revenge && sideObj(side).field.includes(fc)){
          log(`「針金虫の道連れ」で攻撃した「${fieldDef(fc).name}」も破壊！`); destroyFieldCard(side,fc,'effect',null);
        }
        if(side==='cpu'){
          render();
          await cpuNotice(cpuAttackSummary + ' → 破壊');
          cpuAttackSummary='';
        }
        await takeTerritory(other(side),false);
      }
    }
    render();
    if(side==='cpu' && cpuAttackSummary)await cpuNotice(cpuAttackSummary);
    if(state.over)return true;
    if(!isChainAttack && attack.effect==='mantisCombo' && sideObj(side).field.includes(fc) && opponentHasFieldInsect(side)){
      state.chain={side,uid:fc.inst.uid,kind:'mantisCombo'};
      if(side==='cpu'){
        await sleep(300);
        const nextAttack=chooseMantisSecondAttackCPU(fc);
        if(nextAttack){await performAttack(side,fc,nextAttack);} state.chain=null;
      } else {
        message('カマ連撃！ このオオカマキリでもう1度だけ、すぐに攻撃できます。');
      }
    } else if(state.chain?.uid===fc.inst.uid){state.chain=null;}
    render();return true;
  }

  function destroyFieldCard(side,fc,reason,attacker){
    const s=sideObj(side); if(!s.field.includes(fc))return;
    s.field=s.field.filter(x=>x!==fc);
    s.discard.push(fc.inst,...fc.attachments);
    events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:fc,reason,attacker});
    events.emit(EVENT.INSECT_DESTROYED,{state,side,fieldCard:fc,reason,attacker});
    log(`「${fieldDef(fc).name}」が破壊された。`);
  }
  async function takeTerritory(side,isDirect){
    const s=sideObj(side);
    if(!s.territory.length){
      if(isDirect) finishGame(other(side),`${sideName(side)}の縄張りは0。直接攻撃が通り、${sideName(other(side))}の勝ち！`);
      else log(`${sideName(side)}の縄張りは0なので、縄張りは引きません。`);
      return;
    }
    let idx;
    if(side==='player'){
      const opts=s.territory.map((_,i)=>({value:i,title:`縄張り ${i+1}`,detail:'裏向きのカード'}));
      idx=await choose(opts,'縄張りを1枚選んで手札に加えます。','縄張り');
      if(idx===null)idx=0;
    } else idx=Math.floor(Math.random()*s.territory.length);
    const [drawn]=s.territory.splice(idx,1); const c=def(drawn);
    events.emit(EVENT.TERRITORY_DRAWN,{state,side,card:drawn,definition:c});
    log(`${sideName(side)}が縄張りを1枚引いた。`);
    if(c.type==='insect' && c.passive?.type==='flyOut' && !hasFlyOutOnField(side)){
      let use=true;
      if(side==='player') use=await confirmChoice(`引いたカードは「${c.name}」。＜とびだす＞で場に出しますか？`,'とびだす！');
      if(use){
        s.field.push(newFieldCard(drawn));log(`＜とびだす＞！ ${sideName(side)}の「${c.name}」が場に出た。`);render();
        if(side==='cpu')await cpuNotice(`縄張りから「${c.name}」が＜とびだす＞で場に出た`);
        return;
      }
    }
    s.hand.push(drawn); render();
  }

  async function endTurn(){
    if(state.over||state.busy||state.chain)return;
    state.busy=true;
    try{
      events.emit(EVENT.TURN_END,{state,side:state.turn,turnSeq:state.turnSeq,turnNo:state.turnNo});
      for(const side of ['player','cpu'])for(const fc of sideObj(side).field){fc.damage=0;fc.hidden=false;fc.turnAttackBonus=0;}
      sideObj(state.turn).cost=0;
      state.turn=other(state.turn); state.turnSeq++; state.turnNo++; state.phase='draw';
      log('ターン終了。場の虫のダメージが回復しました。'); render(); await sleep(150); await beginTurn();
    } finally {state.busy=false;render();}
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
  function canUseHandCardCPU(inst){
    const c=def(inst),s=state.cpu;
    if(c.type==='insect'&&c.passive?.type==='altSacrifice2')return c.cost<=s.cost||fieldActive('cpu').length>=2;
    if(c.cost>s.cost)return false;
    if(c.type==='insect')return true;
    if(c.type==='enhance')return fieldActive('cpu').length>0;
    if(c.effect==='recoverInsect')return s.discard.some(x=>def(x).type==='insect');
    if(c.effect==='burn600'||c.effect==='destroyOpponent'||c.effect==='blockAttackNext')return fieldActive('player').length>0;
    if(c.effect==='readyAttack')return fieldActive('cpu').some(fc=>fc.attacked);
    if(['baitToHand','baitTempSummon','baitRushTwo'].includes(c.effect))return s.bait.some(x=>def(x).type==='insect');
    if(c.effect==='moveEnhance')return fieldActive('cpu').length>=2&&fieldActive('cpu').some(fc=>fc.attachments.length);
    if(c.effect==='destroyEnhance')return fieldActive('player').some(fc=>fc.attachments.length);
    if(c.effect==='swapDiscardField')return s.discard.some(x=>def(x).type==='insect')&&fieldActive('cpu').length>0;
    if(c.effect==='sameCostSwap')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&fieldActive('cpu').some(fc=>def(fc.inst).cost===def(x).cost));
    if(c.effect==='handTempSummon')return s.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect');
    return true;
  }
  function chooseBaitCPU(hand){
    const score=i=>{const c=def(i);let v=c.cost*1.2;if(c.type==='insect')v+=(c.hp/500)+(Math.max(...c.attacks.map(a=>Number(a.power||0)))/300);if(c.effect==='baitBoost')v-=2;if(c.effect==='allAttack200')v-=.5;return v;};
    return [...hand].sort((a,b)=>score(a)-score(b))[0];
  }
  function chooseAttackCPU(fc){
    const c=fieldDef(fc); let ats=c.attacks.filter(a=>!(a.effect==='oncePerEntry'&&fc.usedAttacks.has(a.name))&&!(a.effect==='bounceOnce'&&fc.usedAttacks.has(a.name))&&usableAttack('cpu',fc,a));
    if(c.id===7){const cann=ats.find(a=>a.effect==='cannibal');if(cann && fieldActive('cpu').length>1)return cann;return ats.find(a=>a.effect==='mantisCombo')||ats[0];}
    if(c.id===40 && fieldActive('player').length===1 && fieldActive('cpu').filter(x=>!x.attacked).length>1)return ats.find(a=>a.effect==='flip')||ats[0];
    if(c.id===79 && fieldActive('player').some(x=>Math.max(...def(x.inst).attacks.map(a=>a.power))>=500))return ats.find(a=>a.effect==='stinkHorn')||ats[0];
    return [...ats].sort((a,b)=>attackPower('cpu',fc,b)-attackPower('cpu',fc,a))[0];
  }
  function chooseMantisSecondAttackCPU(fc){return fieldDef(fc).attacks.find(a=>a.effect==='mantisCombo')||null;}
  function chooseAttackTargetCPU(fc,attack,targets){
    const base=Math.max(0,attack.power+attackBonus(fc));
    return [...targets].sort((a,b)=>{
      const da=base*weaknessMultiplier(effectiveColor(fc),effectiveColor(a)); const db=base*weaknessMultiplier(effectiveColor(fc),effectiveColor(b));
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

  $('resultRestartBtn').addEventListener('click',()=>showStart());
  window.MUSHI_RUNTIME={engineVersion:Engine.version,events,getState:()=>state,fieldDef};
  document.querySelectorAll('.deck-choice').forEach(b=>b.addEventListener('click',()=>chooseTurnOrder(b.dataset.deck)));
  $('newGameBtn').addEventListener('click',()=>{ if(!state||state.over)showStart(); else if(confirm('今の対戦を終了して最初からやり直しますか？'))showStart(); });
})();
