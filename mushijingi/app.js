(() => {
  'use strict';
  const {cards, decks} = window.MUSHI_DATA;
  const $ = (id) => document.getElementById(id);
  const startScreen = $('startScreen');
  const gameScreen = $('gameScreen');
  const modal = $('modal');
  let uidCounter = 1;
  let state = null;
  let modalResolver = null;

  const colorJa = {red:'赤', blue:'青', green:'緑'};
  const typeJa = {insect:'虫', enhance:'強化', spell:'術'};

  function instance(cardId) { return {uid:uidCounter++, cardId}; }
  function def(inst) { return cards[inst.cardId]; }
  function shuffled(list) {
    const a=[...list];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function makeSide(deckKey,isCPU){
    const deck=shuffled(decks[deckKey].ids.map(instance));
    const territory=deck.splice(0,6);
    const hand=deck.splice(0,4);
    return {deckKey,deckName:decks[deckKey].name,isCPU,deck,territory,hand,bait:[],discard:[],field:[],cost:0,setDone:false};
  }
  function sideObj(side){ return state[side]; }
  function other(side){ return side==='player'?'cpu':'player'; }
  function fieldActive(side){ return sideObj(side).field.filter(x=>!x.hidden); }
  function cardTypeLabel(card){ return typeJa[card.type] || ''; }
  function newFieldCard(inst){
    const c=def(inst);
    return {inst,damage:0,attacked:false,hidden:false,attachments:[],usedAttacks:new Set(),turnAttackBonus:0,attackPenaltyTurn:0,attackPenalty:0,mimicTurn:c.passive?.type==='mimic'?state.turnSeq+1:0};
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
    let hp=def(fc.inst).hp;
    for(const a of fc.attachments){ if(def(a).effect==='hp500') hp+=500; }
    return hp;
  }
  function effectiveColor(fc){
    for(let i=fc.attachments.length-1;i>=0;i--){const a=def(fc.attachments[i]);if(a.effect==='changeColor' && fc.changedColor)return fc.changedColor;}
    return def(fc.inst).color;
  }
  function attackBonus(fc){
    let b=fc.turnAttackBonus||0;
    for(const a of fc.attachments){ if(def(a).effect==='attack300') b+=300; }
    if(fc.attackPenaltyTurn===state.turnSeq) b-=fc.attackPenalty||0;
    return b;
  }
  function hasAttachment(fc,effect){ return fc.attachments.some(a=>def(a).effect===effect); }
  function weaknessMultiplier(attackerColor, defenderColor){
    return (attackerColor==='red'&&defenderColor==='green') || (attackerColor==='blue'&&defenderColor==='red') || (attackerColor==='green'&&defenderColor==='blue') ? 2 : 1;
  }
  function attackableTargets(attackingSide){
    const opp=other(attackingSide);
    let candidates=fieldActive(opp).filter(fc=>fc.mimicTurn!==state.turnSeq);
    const pollen=candidates.filter(fc=>def(fc.inst).passive?.type==='pollen');
    if(pollen.length) candidates=pollen;
    return candidates;
  }
  function opponentHasFieldInsect(side){ return fieldActive(other(side)).length>0; }
  function hasFlyOutOnField(side){ return fieldActive(side).some(fc=>def(fc.inst).passive?.type==='flyOut'); }

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
    const c=def(inst); const fc=opt.field;
    const el=document.createElement('div');
    el.className=`game-card ${c.type==='insect'?c.color:'special'} ${opt.playable?'playable':''} ${fc?.attacked?'used':''} ${fc?.hidden?'hidden-insect':''} ${opt.mini?'mini-card':''}`;
    if(fc?.hidden){ el.innerHTML='<div class="card-name">裏向きの虫</div><div class="card-effect">ターン終了まで「場にいない」扱い</div>'; return el; }
    const meta=c.type==='insect' ? `<span>${colorJa[fc?effectiveColor(fc):c.color]}</span><span>HP ${fc?Math.max(0,maxHp(fc)-fc.damage):c.hp}/${fc?maxHp(fc):c.hp}</span>` : `<span>${cardTypeLabel(c)}</span>`;
    let body='';
    if(c.type==='insect'){
      body=c.attacks.map(a=>`<div class="attack-line"><b>${escapeHtml(a.name)} ${Math.max(0,a.power+(fc?attackBonus(fc):0))}</b>${a.text?`<div>${escapeHtml(a.text)}</div>`:''}</div>`).join('');
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
    if(c.cost>s.cost)return false;
    if(c.type==='insect') return true;
    if(c.type==='enhance') return fieldActive(side).length>0;
    if(c.effect==='recoverInsect') return s.discard.some(x=>def(x).type==='insect');
    if(c.effect==='burn600') return fieldActive(other(side)).length>0;
    return true;
  }
  function canAttack(fc){
    if(state.phase!=='main' || state.turn!=='player' || fc.hidden)return false;
    if(state.chain?.side==='player') return state.chain.uid===fc.inst.uid;
    return !fc.attacked;
  }

  async function startGame(deckKey, firstSide){
    const cpuKey=deckKey==='kabuto'?'mantis':'kabuto';
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
    for(const fc of s.field){fc.attacked=false;}
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
      s.hand=s.hand.filter(x=>x.uid!==uid); s.bait.push(inst); s.setDone=true;
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
    state.busy=true;
    try{
      if(c.type==='insect'){
        s.cost-=c.cost; removeHand(s,inst); s.field.push(newFieldCard(inst)); log(`${sideName(side)}は「${c.name}」を場に出した。`);
        if(side==='cpu'){render();await cpuNotice(`「${c.name}」を場に出した`);}
      } else if(c.type==='enhance'){
        const targets=fieldActive(side); if(!targets.length)return false;
        let target= side==='player' ? await chooseField(`「${c.name}」をつける虫を選んでください。`,targets,true) : chooseEnhanceTargetCPU(c,targets);
        if(!target)return false;
        s.cost-=c.cost; removeHand(s,inst); target.attachments.push(inst);
        if(c.effect==='changeColor'){
          const col=side==='player'?await chooseSimple('色を選んでください。',[['red','赤'],['blue','青'],['green','緑']]):bestColorAgainstCPU(target,other(side));
          target.changedColor=col||effectiveColor(target);
        }
        log(`${sideName(side)}は「${c.name}」を「${def(target.inst).name}」につけた。`);
        if(side==='cpu'){render();await cpuNotice(`「${c.name}」を「${def(target.inst).name}」につけた`);}
      } else {
        const ok=await resolveSpell(side,inst,c); if(!ok)return false;
      }
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
      s.cost-=c.cost; removeHand(s,inst); s.discard=s.discard.filter(x=>x.uid!==chosen.uid); s.hand.push(chosen); s.discard.push(inst);
      log(`${sideName(side)}は「${c.name}」で「${def(chosen).name}」を手札に戻した。`);
      if(side==='cpu'){render();await cpuNotice(`「${c.name}」を使用 → 「${def(chosen).name}」を手札に戻した`);}
      return true;
    }
    if(c.effect==='burn600'){
      const choices=fieldActive(other(side)); if(!choices.length)return false;
      target=side==='player'?await chooseField('600ダメージを与える相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);
      if(!target)return false;
      s.cost-=c.cost;removeHand(s,inst);s.discard.push(inst);target.damage+=600;log(`${sideName(side)}の「${c.name}」！ ${def(target.inst).name}に600ダメージ。`);
      if(target.damage>=maxHp(target))destroyFieldCard(other(side),target,'effect',null);
      if(side==='cpu'){render();await cpuNotice(`「${c.name}」を使用 → 「${def(target.inst).name}」に600ダメージ`);}
      return true;
    }
    s.cost-=c.cost; removeHand(s,inst);
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
    const c=def(fc.inst);
    let attacks=c.attacks.filter(a=>!(a.effect==='oncePerEntry'&&fc.usedAttacks.has(a.name)));
    if(state.chain?.side==='player' && state.chain.uid===fc.inst.uid && state.chain.kind==='mantisCombo'){
      attacks=attacks.filter(a=>a.effect==='mantisCombo');
    }
    const options=attacks.map((a,i)=>({value:i,title:`${a.name} ${Math.max(0,a.power+attackBonus(fc))}`,detail:a.text||'攻撃'}));
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
    fc.attacked=true;
    if(attack.effect==='oncePerEntry')fc.usedAttacks.add(attack.name);
    const base=Math.max(0,attack.power+attackBonus(fc));
    if(!target){
      log(`${sideName(side)}の「${def(fc.inst).name}」が${attack.name}で直接攻撃！`);
      cpuAttackSummary=`「${def(fc.inst).name}」の「${attack.name}」で直接攻撃`;
      if(side==='cpu'){
        render();
        await cpuNotice(cpuAttackSummary);
        cpuAttackSummary='';
      }
      await takeTerritory(other(side),true);
    } else if(attack.effect==='flip'){
      target.hidden=true; log(`${sideName(side)}の「すくい投げ」！ 「${def(target.inst).name}」をターン終了まで裏返した。`);
      cpuAttackSummary=`「${def(fc.inst).name}」の「すくい投げ」→「${def(target.inst).name}」を裏返した`;
    } else if(attack.effect==='stinkHorn'){
      target.attackPenaltyTurn=state.turnSeq+1;
      target.attackPenalty=400;
      const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(target));
      const dmg=base*mult;
      target.damage+=dmg;
      log(`${sideName(side)}の「くさいツノ」！ 「${def(target.inst).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}。次のターン攻撃力-400。`);
      cpuAttackSummary=`「${def(fc.inst).name}」の「くさいツノ」→「${def(target.inst).name}」に${dmg}ダメージ / 次ターン攻撃-400`;
      if(target.damage>=maxHp(target)){
        const revenge=hasAttachment(target,'revenge');
        destroyFieldCard(other(side),target,'attack',fc);
        if(revenge && sideObj(side).field.includes(fc)){
          log(`「針金虫の道連れ」で攻撃した「${def(fc.inst).name}」も破壊！`);
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
      const dmg=base*mult; target.damage+=dmg;
      log(`${sideName(side)}の「${def(fc.inst).name}」が「${def(target.inst).name}」へ${attack.name}！ ${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
      cpuAttackSummary=`「${def(fc.inst).name}」の「${attack.name}」→「${def(target.inst).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}`;
      if(sacrificeName)cpuAttackSummary+=` / 「${sacrificeName}」を共食い`;
      if(target.damage>=maxHp(target)){
        const revenge=hasAttachment(target,'revenge');
        destroyFieldCard(other(side),target,'attack',fc);
        if(revenge && sideObj(side).field.includes(fc)){
          log(`「針金虫の道連れ」で攻撃した「${def(fc.inst).name}」も破壊！`); destroyFieldCard(side,fc,'effect',null);
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
    log(`「${def(fc.inst).name}」が破壊された。`);
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
      const bait=chooseBaitCPU(s.hand); s.hand=s.hand.filter(x=>x.uid!==bait.uid);s.bait.push(bait);log(`CPUは「${def(bait).name}」をエサにした。`);render();await cpuNotice(`「${def(bait).name}」をエサ場に置いた`);
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
      const attacker=fieldActive('cpu').find(fc=>!fc.attacked);
      if(attacker){
        const at=chooseAttackCPU(attacker); if(at){await performAttack('cpu',attacker,at);acted=true;render();continue;} else attacker.attacked=true;
      }
      if(!acted)break;
    }
    if(!state.over){state.busy=false;await endTurn();}
  }
  function canUseHandCardCPU(inst){
    const c=def(inst),s=state.cpu;if(c.cost>s.cost)return false;if(c.type==='insect')return true;if(c.type==='enhance')return fieldActive('cpu').length>0;
    if(c.effect==='recoverInsect')return s.discard.some(x=>def(x).type==='insect');if(c.effect==='burn600')return fieldActive('player').length>0;return true;
  }
  function chooseBaitCPU(hand){
    const score=i=>{const c=def(i);let v=c.cost*1.2;if(c.type==='insect')v+=(c.hp/500)+(Math.max(...c.attacks.map(a=>a.power))/300);if(c.effect==='baitBoost')v-=2;if(c.effect==='allAttack200')v-=.5;return v;};
    return [...hand].sort((a,b)=>score(a)-score(b))[0];
  }
  function chooseAttackCPU(fc){
    const c=def(fc.inst); let ats=c.attacks.filter(a=>!(a.effect==='oncePerEntry'&&fc.usedAttacks.has(a.name)));
    if(c.id===7){const cann=ats.find(a=>a.effect==='cannibal');if(cann && fieldActive('cpu').length>1)return cann;return ats.find(a=>a.effect==='mantisCombo')||ats[0];}
    if(c.id===40 && fieldActive('player').length===1 && fieldActive('cpu').filter(x=>!x.attacked).length>1)return ats.find(a=>a.effect==='flip')||ats[0];
    if(c.id===79 && fieldActive('player').some(x=>Math.max(...def(x.inst).attacks.map(a=>a.power))>=500))return ats.find(a=>a.effect==='stinkHorn')||ats[0];
    return [...ats].sort((a,b)=>b.power-a.power)[0];
  }
  function chooseMantisSecondAttackCPU(fc){return def(fc.inst).attacks.find(a=>a.effect==='mantisCombo')||null;}
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
    const opts=targets.map(fc=>({value:fc.inst.uid,title:def(fc.inst).name,detail:`${colorJa[effectiveColor(fc)]} / HP ${Math.max(0,maxHp(fc)-fc.damage)}/${maxHp(fc)}`}));
    if(cancel)opts.push({value:null,title:'やめる',detail:''});
    return choose(opts,text,'虫を選択').then(uid=>targets.find(x=>x.inst.uid===uid)||null);
  }
  function chooseInstances(text,instances){
    return choose([...instances.map(i=>({value:i.uid,title:def(i).name,detail:`コスト ${def(i).cost}`})),{value:null,title:'やめる',detail:''}],text,'カードを選択').then(uid=>instances.find(i=>i.uid===uid)||null);
  }
  async function confirmChoice(text,title){const v=await choose([{value:true,title:'はい',detail:'場に出す'},{value:false,title:'いいえ',detail:'手札に加える'}],text,title);return !!v;}

  $('resultRestartBtn').addEventListener('click',()=>showStart());
  document.querySelectorAll('.deck-choice').forEach(b=>b.addEventListener('click',()=>chooseTurnOrder(b.dataset.deck)));
  $('newGameBtn').addEventListener('click',()=>{ if(!state||state.over)showStart(); else if(confirm('今の対戦を終了して最初からやり直しますか？'))showStart(); });
})();
