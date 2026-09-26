(() => {
  'use strict';

  const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
  const GAME_ID = "mushijingi-reward";
  const CUSTOM_DECKS_KEY = "mushijingiCustomDecks:v1";
  const CUSTOM_DECK_SIZE = 20;
  const CUSTOM_DECK_MAX_COPIES = 2;
  const BATTLE_ACCESS_KEY = MINI_GAME_ACCESS_PREFIX + GAME_ID;
  let battleAccessAvailable = sessionStorage.getItem(BATTLE_ACCESS_KEY) === "1";
  let battleAccessConsumed = false;

  function getLearningUrl() {
    const saved = sessionStorage.getItem("miniGameReturnUrl");
    if (!saved) return "../learn.html";
    if (/^(?:[a-z]+:|\/)/i.test(saved)) return saved;
    return "../" + saved.replace(/^\.\//, "");
  }

  function returnToLearning() {
    window.location.replace(getLearningUrl());
  }

  function hasBattleAccess() {
    return battleAccessAvailable && !battleAccessConsumed;
  }

  function consumeBattleAccess() {
    if (!hasBattleAccess()) return false;
    sessionStorage.removeItem(BATTLE_ACCESS_KEY);
    battleAccessAvailable = false;
    battleAccessConsumed = true;
    refreshBattleGate();
    return true;
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted && battleAccessConsumed) {
      returnToLearning();
      return;
    }
    battleAccessAvailable = sessionStorage.getItem(BATTLE_ACCESS_KEY) === "1";
    refreshBattleGate();
    // Safari may restore the search field value after initial rendering.
    // Re-render once pageshow fires so the restored Japanese query is applied.
    if(deckBuilderScreen && !deckBuilderScreen.classList.contains('hidden')) renderCardCatalog();
  });

  const {cards, decks} = window.MUSHI_DATA;
  const Engine = window.MUSHI_ENGINE;
  if(!Engine) throw new Error('MUSHI_ENGINE is not loaded');
  const {ZONE, EVENT} = Engine;
  const events = Engine.createEventBus();
  const $ = (id) => document.getElementById(id);
  const startScreen = $('startScreen');
  const deckBuilderScreen = $('deckBuilderScreen');
  const gameScreen = $('gameScreen');
  const modal = $('modal');
  let uidCounter = 1;
  let state = null;
  let modalResolver = null;
  let customDecks = [];
  let builderDeckId = null;
  let builderIds = [];

  const CPU_DIFFICULTY_KEY = 'mushijingiCpuDifficulty';
  const CPU_DIFFICULTIES = new Set(['normal','strong','veryStrong']);
  let cpuDifficulty = (() => {
    try {
      const saved=localStorage.getItem(CPU_DIFFICULTY_KEY);
      return CPU_DIFFICULTIES.has(saved)?saved:'normal';
    } catch (error) {
      return 'normal';
    }
  })();

  function currentCpuDifficulty(){return state?.cpuDifficulty||cpuDifficulty;}
  function cpuLearnedPolicy(){
    const arch=typeof cpuDeckArchetype==='function'?cpuDeckArchetype():'generic';
    return window.MUSHI_AI_POLICY?.archetypes?.[arch]||window.MUSHI_AI_POLICY?.archetypes?.generic||{};
  }
  function cpuPolicyValue(key,fallback){
    const v=cpuLearnedPolicy()?.[key];
    return Number.isFinite(Number(v))?Number(v):fallback;
  }
  function cpuDifficultyLabel(mode=currentCpuDifficulty()){
    return ({normal:'ふつう',strong:'つよい',veryStrong:'ちょうつよい'})[mode]||'ふつう';
  }
  function setCpuDifficulty(mode){
    if(!CPU_DIFFICULTIES.has(mode))mode='normal';
    cpuDifficulty=mode;
    try{localStorage.setItem(CPU_DIFFICULTY_KEY,mode);}catch(error){}
    document.querySelectorAll('input[name="cpuDifficulty"]').forEach(input=>{input.checked=input.value===mode;});
    const help=$('cpuDifficultyHelp');
    if(help)help.textContent=mode==='normal'
      ? 'いままでのCPUです。'
      : mode==='strong'
        ? '盤面・コンボ・エサの価値を考えて行動します。'
        : '盤面評価に加えて、次の行動まで読んで手を選びます。';
  }

  const colorJa = {red:'赤', blue:'青', green:'緑', colorless:'無色'};
  const typeJa = {insect:'虫', enhance:'強化', spell:'術'};

  function instance(cardId,owner=null) { return Engine.createCardInstance(uidCounter++,cardId,owner); }
  function def(inst) { return cards[inst.cardId]; }
  function fieldDef(fc) { return Engine.currentCardDefinition(def(fc.inst),fc); }
  function rawFieldPassive(fc){ return fieldDef(fc)?.passive||null; }
  function silenceActive(){
    if(!state)return false;
    return ['player','cpu'].some(side=>!warriorSealActive(side)&&fieldActive(side).some(fc=>!fc.suppressKeywords&&!hasAttachment(fc,'suppressPassive')&&rawFieldPassive(fc)?.type==='silenceAll'));
  }
  function warriorSealActive(side){
    return !!(state&&side&&fieldActive(side).some(fc=>fc.attachments.some(a=>def(a).effect==='warriorSeal')));
  }
  function passiveOfField(fc){
    const p=rawFieldPassive(fc);
    if(!p)return null;
    const side=findFieldSide(fc)||ownerSideOf(fc.inst,null);
    if(fc.suppressKeywords||hasAttachment(fc,'suppressPassive')||warriorSealActive(side)||silkwormGagActive(side))return null;
    if(p.type==='king'&&emperorBaitCount(side)>0)return null;
    if(fc.hawkEyeSuppressedTurn===state?.turnSeq&&/(破壊されたとき|破壊されるとき)/.test(String(p.text||'')))return null;
    if(p.type==='silenceAll')return p;
    return silenceActive()?null:p;
  }
  function passiveOfInst(inst){
    const p=def(inst)?.passive||null;
    if(!p||inst?.discardFaceDown)return null;
    const side=ownerSideOf(inst,null);
    if(warriorSealActive(side)||silkwormGagActive(side))return null;
    if(p.type==='king'&&emperorBaitCount(side)>0)return null;
    if(p.type==='silenceAll')return p;
    return silenceActive()?null:p;
  }
  function silkwormGagActive(side){
    const rec=state?.silkwormGag?.[side];
    return !!(rec&&rec.untilTurnSeq>=state.turnSeq);
  }
  function visibleDiscard(side){return sideObj(side).discard.filter(x=>!x.discardFaceDown);}
  function visibleDiscardFrom(ss){return ss.discard.filter(x=>!x.discardFaceDown);}
  function emperorBaitCount(side){
    if(!state||!side||silenceActive())return 0;
    return sideObj(side).bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect'&&def(x).passive?.type==='emperorBait'&&!silkwormGagActive(side)&&!warriorSealActive(side)).length;
  }
  function phaseMutationActive(){
    if(!state)return false;
    return ['player','cpu'].some(side=>fieldActive(side).some(fc=>passiveOfField(fc)?.type==='phaseMutation'));
  }
  function dangerSenseActive(){
    return ['player','cpu'].some(side=>fieldActive(side).some(fc=>passiveOfField(fc)?.type==='dangerSense'));
  }
  function safeParseCustomDecks() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_DECKS_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.map((deck, index) => {
        const ids = Array.isArray(deck?.ids) ? deck.ids.map(Number).filter(id => cards[id]) : [];
        const limited = [];
        const nameCounts = new Map();
        for (const id of ids) {
          if (limited.length >= CUSTOM_DECK_SIZE) break;
          const name = cards[id]?.name;
          if (!name) continue;
          const n = nameCounts.get(name) || 0;
          if (n >= CUSTOM_DECK_MAX_COPIES) continue;
          nameCounts.set(name, n + 1);
          limited.push(id);
        }
        return {
          id: String(deck?.id || `legacy-${index + 1}`),
          name: String(deck?.name || `自作デッキ ${index + 1}`).slice(0, 24),
          ids: limited,
          updatedAt: Number(deck?.updatedAt || 0)
        };
      }).filter(deck => deck.ids.length > 0);
    } catch (error) {
      return [];
    }
  }
  function persistCustomDecks() {
    try {
      localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks));
      return true;
    } catch (error) {
      setBuilderNotice('このブラウザではデッキを保存できませんでした。', true);
      return false;
    }
  }
  function customDeckRef(id) { return `custom:${id}`; }
  function customDeckById(id) { return customDecks.find(deck => deck.id === String(id)) || null; }
  function customDeckFromRef(ref) {
    if (!String(ref || '').startsWith('custom:')) return null;
    return customDeckById(String(ref).slice(7));
  }
  function resolveDeckDefinition(ref) {
    if (decks[ref]) return { ...decks[ref], ref, custom:false };
    const custom = customDeckFromRef(ref);
    if (!custom) return null;
    return { name:custom.name, ids:[...custom.ids], ref, custom:true };
  }
  function deckIsBattleReady(deck) {
    if (!deck) return false;
    if (deck.randomCount) return Number(deck.randomCount) === CUSTOM_DECK_SIZE && deck.ids.length >= CUSTOM_DECK_SIZE;
    return Array.isArray(deck.ids) && deck.ids.length === CUSTOM_DECK_SIZE && deck.ids.every(id => !!cards[id]);
  }
  function battleDeckOptions() {
    const builtIn = Object.entries(decks).map(([ref, deck]) => ({
      ref,
      name:deck.name,
      detail:deck.randomCount ? `${deck.ids.length}種からランダム20枚` : '固定20枚'
    }));
    const custom = customDecks.filter(deck => deckIsBattleReady(deck)).map(deck => ({
      ref:customDeckRef(deck.id),
      name:deck.name,
      detail:'保存した自作デッキ・20枚'
    }));
    return [...builtIn, ...custom];
  }
  function newCustomDeckId() {
    return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  }

  function shuffled(list) {
    const a=[...list];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function makeSide(deckRef,isCPU){
    const owner=isCPU?'cpu':'player';
    const deckDef=resolveDeckDefinition(deckRef);
    if(!deckDef||!deckIsBattleReady(deckDef))throw new Error(`Invalid deck: ${deckRef}`);
    const ids=deckDef.randomCount ? shuffled(deckDef.ids).slice(0,deckDef.randomCount) : [...deckDef.ids];
    const deck=shuffled(ids.map(id=>instance(id,owner)));
    const territory=deck.splice(0,6);
    const hand=deck.splice(0,4);
    return Engine.ensureModernZones({deckKey:deckRef,deckName:deckDef.name,isCPU,deck,territory,hand,bait:[],discard:[],field:[],cost:0,setDone:false});
  }
  customDecks = safeParseCustomDecks();

  function sideObj(side){ return state[side]; }
  function other(side){ return side==='player'?'cpu':'player'; }
  function fieldActive(side){ return sideObj(side).field.filter(x=>!x.hidden); }
  function cardTypeLabel(card){ return typeJa[card.type] || ''; }
  function nextOpponentTurnSeq(side){
    return state.turn===side?state.turnSeq+1:state.turnSeq+2;
  }
  function newFieldCard(inst){
    return Engine.createFieldState(inst,{
      mimicTurn:0,
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
      puppetDestroyTurn:0,
      enteredTurnSeq:0,
      megaArmorTurn:0,
      blueJadeUsedTurn:0,
      mucusCurse:false,
      summonedByTimePupa:false,
      hawkEyeSuppressedTurn:0,
      nextDamageDestroy:false,
      redOgreWebTurn:0,redOgreWebUsedTurn:0,
      blueOgreWebTurn:0,blueOgreWebUsedTurn:0,
      queenHatchTurn:0,
      mossMultiplier:1,
      abyssRevived:false,
      gigasLockTurn:0,
      hardenTurn:0,
      firstSpellModifierUsed:false,
      spiritAwaySourceUid:null,
      spiritAwayReturnTurn:0,
      underworldFaceDownTurn:0
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

  function setBuilderNotice(text='', isError=false) {
    const el=$('builderNotice'); if(!el)return;
    el.textContent=text;
    el.classList.toggle('notice-error',!!isError);
    el.classList.toggle('notice-ok',!!text&&!isError);
  }
  function builderExactCount(cardId){return builderIds.filter(id=>id===Number(cardId)).length;}
  function builderNameCount(cardId){
    const name=cards[Number(cardId)]?.name;
    return name?builderIds.filter(id=>cards[id]?.name===name).length:0;
  }
  function setLabel(set){
    if(set==='starter')return 'スターター';
    const m=String(set||'').match(/^booster(\d+)$/);
    return m?`第${m[1]}弾`:'第1弾';
  }
  function typeLabel(card){return typeJa[card.type]||card.type;}
  function colorLabel(card){return card.type==='insect'?(colorJa[card.color]||card.color):'—';}
  function renderSavedDeckSelect(){
    const select=$('savedDeckSelect');if(!select)return;
    const current=builderDeckId||'';
    select.innerHTML='<option value="">新しいデッキ</option>';
    for(const deck of [...customDecks].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))){
      const option=document.createElement('option');
      option.value=deck.id;
      option.textContent=`${deck.name}（${deck.ids.length}枚）`;
      select.appendChild(option);
    }
    select.value=current;
    $('deleteDeckBtn').disabled=!builderDeckId;
  }
  function renderBuilderStatus(){
    const count=builderIds.length,remaining=Math.max(0,CUSTOM_DECK_SIZE-count);
    $('builderCount').textContent=`${count} / ${CUSTOM_DECK_SIZE}枚`;
    $('builderRuleStatus').textContent=count===CUSTOM_DECK_SIZE?'保存できます':`あと${remaining}枚`;
    $('saveDeckBtn').disabled=count!==CUSTOM_DECK_SIZE;
  }
  function builderCardImage(card){
    return card.image?`<img src="${escapeHtml(card.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:'';
  }
  function addBuilderCard(cardId){
    const id=Number(cardId);
    if(!cards[id])return;
    if(builderIds.length>=CUSTOM_DECK_SIZE){setBuilderNotice('デッキは20枚までです。',true);return;}
    if(builderNameCount(id)>=CUSTOM_DECK_MAX_COPIES){setBuilderNotice('同じ名前のカードは、別弾・別レアリティを合わせて2枚までです。',true);return;}
    builderIds.push(id);setBuilderNotice('');
    renderBuilderDeckList();renderCardCatalog();renderBuilderStatus();
  }
  function removeBuilderCard(cardId){
    const id=Number(cardId),index=builderIds.lastIndexOf(id);
    if(index<0)return;
    builderIds.splice(index,1);setBuilderNotice('');
    renderBuilderDeckList();renderCardCatalog();renderBuilderStatus();
  }
  function renderBuilderDeckList(){
    const wrap=$('builderDeckList');if(!wrap)return;
    wrap.innerHTML='';
    if(!builderIds.length){
      wrap.innerHTML='<div class="builder-empty">下のカード一覧からカードを追加してね。</div>';
      return;
    }
    const ids=[...new Set(builderIds)].sort((a,b)=>compareBuilderCards(cards[a],cards[b]));
    for(const id of ids){
      const card=cards[id],count=builderExactCount(id);
      const row=document.createElement('div');row.className='builder-deck-row';
      row.innerHTML=`${builderCardImage(card)}<div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(setLabel(card.set))} / ${escapeHtml(typeLabel(card))} / コスト ${card.cost}</small></div><div class="builder-qty"><button type="button" data-remove="${id}" aria-label="1枚減らす">−</button><b>${count}</b><button type="button" data-add="${id}" aria-label="1枚増やす" ${builderNameCount(id)>=CUSTOM_DECK_MAX_COPIES||builderIds.length>=CUSTOM_DECK_SIZE?'disabled':''}>＋</button></div>`;
      row.querySelector('[data-remove]').addEventListener('click',()=>removeBuilderCard(id));
      row.querySelector('[data-add]').addEventListener('click',()=>addBuilderCard(id));
      wrap.appendChild(row);
    }
  }
  const japaneseCardCollator = new Intl.Collator('ja', {
    usage:'sort',
    sensitivity:'base',
    numeric:true,
    ignorePunctuation:true
  });
  function cardSetOrder(card){
    if(card.set==='starter')return 0;
    const match=String(card.set||'').match(/^booster(\d+)$/);
    return match?Number(match[1]):99;
  }
  function compareBuilderCards(a,b,mode=$('cardSort')?.value||'kana'){
    if(mode==='costAsc'){
      return Number(a.cost||0)-Number(b.cost||0)
        || japaneseCardCollator.compare(a.name,b.name)
        || a.id-b.id;
    }
    if(mode==='costDesc'){
      return Number(b.cost||0)-Number(a.cost||0)
        || japaneseCardCollator.compare(a.name,b.name)
        || a.id-b.id;
    }
    if(mode==='set'){
      return cardSetOrder(a)-cardSetOrder(b)
        || a.id-b.id;
    }
    return japaneseCardCollator.compare(a.name,b.name)
      || cardSetOrder(a)-cardSetOrder(b)
      || a.id-b.id;
  }
  function normalizedCardSearchText(value){
    return String(value||'').normalize('NFKC').trim().toLocaleLowerCase('ja');
  }
  function filteredCatalogCards(){
    const q=normalizedCardSearchText($('cardSearchInput')?.value);
    const set=$('cardSetFilter')?.value||'all';
    const type=$('cardTypeFilter')?.value||'all';
    const color=$('cardColorFilter')?.value||'all';
    const sortMode=$('cardSort')?.value||'kana';
    return Object.values(cards).filter(Boolean).filter(card=>{
      if(set!=='all'&&card.set!==set)return false;
      if(type!=='all'&&card.type!==type)return false;
      if(color!=='all'&&(card.type!=='insect'||card.color!==color))return false;
      if(q&&!normalizedCardSearchText(card.name).includes(q))return false;
      return true;
    }).sort((a,b)=>compareBuilderCards(a,b,sortMode));
  }
  function renderCardCatalog(){
    const wrap=$('cardCatalog');if(!wrap)return;
    wrap.innerHTML='';
    for(const card of filteredCatalogCards()){
      const count=builderExactCount(card.id),disabled=builderNameCount(card.id)>=CUSTOM_DECK_MAX_COPIES||builderIds.length>=CUSTOM_DECK_SIZE;
      const button=document.createElement('button');
      button.type='button';button.className='catalog-card';button.disabled=disabled;
      button.innerHTML=`${count?`<span class="catalog-count">×${count}</span>`:''}${builderCardImage(card)}<strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(setLabel(card.set))} / ${escapeHtml(typeLabel(card))} / ${escapeHtml(colorLabel(card))} / コスト ${card.cost}</small>`;
      button.addEventListener('click',()=>addBuilderCard(card.id));
      wrap.appendChild(button);
    }
    if(!wrap.children.length)wrap.innerHTML='<div class="builder-empty">条件に合うカードがありません。</div>';
  }
  function renderDeckBuilder(){
    renderSavedDeckSelect();renderBuilderDeckList();renderCardCatalog();renderBuilderStatus();
  }
  function newBuilderDeck(){
    builderDeckId=null;builderIds=[];$('deckNameInput').value='';setBuilderNotice('');
    renderDeckBuilder();
  }
  function loadBuilderDeck(id){
    const deck=customDeckById(id);
    if(!deck){newBuilderDeck();return;}
    builderDeckId=deck.id;builderIds=[...deck.ids];$('deckNameInput').value=deck.name;setBuilderNotice('');
    renderDeckBuilder();
  }
  function saveBuilderDeck(){
    if(builderIds.length!==CUSTOM_DECK_SIZE){setBuilderNotice('20枚ちょうどにしてから保存してください。',true);return false;}
    const nameCounts=new Map();
    for(const id of builderIds){
      if(!cards[id]){setBuilderNotice('使えないカードが含まれています。',true);return false;}
      const name=cards[id].name,n=(nameCounts.get(name)||0)+1;nameCounts.set(name,n);
      if(n>CUSTOM_DECK_MAX_COPIES){setBuilderNotice('同じ名前のカードは、別弾・別レアリティを合わせて2枚までです。',true);return false;}
    }
    const name=String($('deckNameInput').value||'').trim().slice(0,24)||`自作デッキ ${customDecks.length+1}`;
    if(builderDeckId){
      const deck=customDeckById(builderDeckId);
      if(!deck)return false;
      deck.name=name;deck.ids=[...builderIds];deck.updatedAt=Date.now();
    }else{
      builderDeckId=newCustomDeckId();
      customDecks.push({id:builderDeckId,name,ids:[...builderIds],updatedAt:Date.now()});
    }
    if(!persistCustomDecks())return false;
    $('deckNameInput').value=name;
    setBuilderNotice(`「${name}」を保存しました。`);
    renderSavedDeckSelect();renderCustomDeckChoices();refreshBattleGate();return true;
  }
  function deleteBuilderDeck(){
    if(!builderDeckId)return;
    const deck=customDeckById(builderDeckId);if(!deck)return;
    if(!window.confirm(`「${deck.name}」を削除しますか？`))return;
    customDecks=customDecks.filter(x=>x.id!==builderDeckId);
    persistCustomDecks();newBuilderDeck();renderCustomDeckChoices();refreshBattleGate();
    setBuilderNotice('デッキを削除しました。');
  }
  function renderCustomDeckChoices(){
    const wrap=$('customDeckChoices'),empty=$('noCustomDecks');if(!wrap||!empty)return;
    wrap.innerHTML='';
    const ready=customDecks.filter(deck=>deckIsBattleReady(deck));
    empty.classList.toggle('hidden',ready.length>0);
    for(const deck of ready){
      const button=document.createElement('button');
      button.type='button';button.className='deck-choice custom-deck-choice';
      button.dataset.deck=customDeckRef(deck.id);
      button.innerHTML=`<span class="deck-icon">🃏</span><strong>${escapeHtml(deck.name)}</strong><small>自作デッキ・20枚</small>`;
      button.disabled=!hasBattleAccess();
      button.addEventListener('click',()=>chooseTurnOrder(button.dataset.deck));
      wrap.appendChild(button);
    }
  }
  function refreshBattleGate(){
    const gate=$('battleGate');if(!gate)return;
    const unlocked=hasBattleAccess();
    gate.classList.toggle('locked',!unlocked);gate.classList.toggle('unlocked',unlocked);
    $('battleGateTitle').textContent=unlocked?'✅ CPU対戦できます':'🔒 CPU対戦はロック中';
    $('battleGateText').textContent=unlocked?'自分のデッキを選んでください。対戦開始時に権利を1回分使います。':'デッキ作りはいつでもできます。CPU対戦には、がくしゅうクリアが必要です。';
    document.querySelectorAll('#startScreen .deck-choice').forEach(button=>{button.disabled=!unlocked;});
  }
  function openDeckBuilder(){
    hideCpuNotice();hideResultPopup();closeModal(null);state=null;
    startScreen.classList.add('hidden');gameScreen.classList.add('hidden');deckBuilderScreen.classList.remove('hidden');
    if(builderDeckId&&!customDeckById(builderDeckId))builderDeckId=null;
    renderDeckBuilder();
  }
  function closeDeckBuilder(){
    deckBuilderScreen.classList.add('hidden');gameScreen.classList.add('hidden');startScreen.classList.remove('hidden');
    renderCustomDeckChoices();refreshBattleGate();
  }

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


  function attachmentStatFactor(fc){
    return passiveOfField(fc)?.type==='doubleEnhance'?2:1;
  }
  function attachmentModifier(inst){
    const e=def(inst).effect;
    if(e==='imitation')return {attack:Number(inst.copyAttack||0),hp:Number(inst.copyHp||0)};
    const map={
      attack300:[300,0],attack400:[400,0],attack500:[500,0],attack700:[700,0],attack1000:[1000,0],
      hp500:[0,500],hp600:[0,600],hp800:[0,800],hp1000:[0,1000],
      hpAttack200:[200,200],hpAttack300:[300,300],hpAttack500:[500,500],hpAttack700:[700,700],
      spellSummonLockAttachment:[100,100],suppressPassive:[300,300],
      spear400:[400,400],spear800:[800,800],waspArmor:[800,800],larvaPot:[400,400],
      flowerArmor1000:[1000,1000],smallKabutoArmor:[200,200],warriorSeal:[300,300],
      longhornJaw:[300,300],ancientDragonflyBlade:[300,300],lifeFlame:[700,700],
      grudgeJinbaori:[1000,1000],victoryBlade:[600,0],auspiciousBlade:[300,0],
      electricKanabo:[500,500],blastClub:[300,300],jewelCrown:[500,500],
      centipedeGreaves:[400,400],goldenSixCoins:[100,100],bewitchingFireflyBag:[100,100],
      stinkShieldArmor:[0,400],puppetCordyceps:[-100,-100]
    };
    const v=map[e]||[0,0];
    return {attack:v[0],hp:v[1]};
  }
  function distinctFaceUpInsectBaitColors(side){
    return new Set(sideObj(side).bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect').map(x=>baitCardColor(x)).filter(Boolean));
  }
  function baitHasRGB(side){
    const colors=new Set(sideObj(side).bait.filter(isFaceUpBait).map(x=>baitCardColor(x)).filter(Boolean));
    return colors.has('red')&&colors.has('blue')&&colors.has('green');
  }
  function poisonTechniqueOnInstance(inst){
    const c=def(inst),p=passiveOfInst(inst);
    return (c.attacks||[]).some(a=>String(a.name||'').includes('毒')||String(a.text||'').includes('毒'))||
      !!(p&&(/毒/.test(String(p.text||''))||/poison/i.test(String(p.type||''))));
  }
  function discardSummonBlocked(){
    return ['player','cpu'].some(side=>fieldActive(side).some(fc=>passiveOfField(fc)?.type==='hellGatekeeper'||hasAttachment(fc,'bewitchingFireflyBag')));
  }

  function scavengerActive(side){
    if(!side)return false;
    const colors=new Set(visibleDiscard(side).filter(x=>def(x).type==='insect').map(x=>def(x).color));
    return colors.has('red')&&colors.has('blue')&&colors.has('green');
  }
  function maxHp(fc){
    let hp=fieldDef(fc).hp*Number(fc.mossMultiplier||1)+Engine.modifierTotal(fc,'hp',state?.turnSeq||0);
    const factor=attachmentStatFactor(fc);
    for(const a of fc.attachments)hp+=attachmentModifier(a).hp*factor;
    const p=passiveOfField(fc);
    const side=findFieldSide(fc);
    if(p?.type==='bloodPrice'&&side)hp-=sideObj(side).territory.length*100;
    if(p?.type==='scavenger'&&scavengerActive(side))hp+=Number(p.value||200);
    if(p?.type==='giantBait'&&side&&sideObj(side).bait.length>=Number(p.threshold||8))hp+=Number(p.value||0);
    if(p?.type==='fungusPower'&&fc.attachments.length>0)hp+=Number(p.value||100);
    if(p?.type==='aphidFavorite'&&side)hp+=faceUpBait(side).filter(x=>def(x).type==='insect'&&/アブラムシ/.test(def(x).name)).length*Number(p.value||100);
    if(p?.type==='cicadaParasite'&&side&&fieldActive(side).some(x=>x!==fc&&isCicadaCard(x.inst)))hp+=Number(p.value||100);
    if(p?.type==='whiteStripe'&&side)hp+=sideObj(side).bait.filter(x=>x.faceDown).length*Number(p.value||100);
    if(p?.type==='colony'&&side)hp+=sideObj(side).discard.filter(x=>x.discardFaceDown).length*Number(p.value||200);
    if(side){
      const mirrors=fc.attachments.filter(a=>def(a).effect==='greenMirror').length;
      if(mirrors)hp+=(sideObj(side).bait.length>=6?800:400)*mirrors*factor;
    }
    return hp;
  }
  function effectiveColor(fc){
    if(fc.turnColorOverrideTurn===state?.turnSeq&&fc.turnColorOverride)return fc.turnColorOverride;
    for(let i=fc.attachments.length-1;i>=0;i--){
      const e=def(fc.attachments[i]).effect;
      if(e==='changeColor'&&fc.changedColor)return fc.changedColor;
      if(e==='stickChange'&&fc.attachments[i].chosenColor)return fc.attachments[i].chosenColor;
      if(e==='jewelColorCopy'&&fc.attachments[i].copyColor)return fc.attachments[i].copyColor;
      if(e==='setRed')return 'red';
      if(e==='setBlue')return 'blue';
      if(e==='setGreen')return 'green';
    }
    return fieldDef(fc).color;
  }
  function attackBonus(fc){
    let b=(fc.turnAttackBonus||0)+Engine.modifierTotal(fc,'attack',state?.turnSeq||0);
    if(Number(fc.mossMultiplier||1)>1){
      const base=Number((fieldDef(fc).attacks||[])[0]?.power||0);
      b+=base*(Number(fc.mossMultiplier||1)-1);
    }
    const factor=attachmentStatFactor(fc);
    for(const a of fc.attachments)b+=attachmentModifier(a).attack*factor;
    const p=passiveOfField(fc);
    const side=findFieldSide(fc);
    if(p?.type==='emblem'&&side&&fieldActive(side).some(x=>x!==fc&&fieldDef(x).name===p.partner))b+=Number(p.value||300);
    if(p?.type==='loneAttack'&&side&&fieldActive(side).length===1)b+=Number(p.value||100);
    if(p?.type==='bloodPrice'&&side)b-=sideObj(side).territory.length*100;
    if(p?.type==='scavenger'&&scavengerActive(side))b+=Number(p.value||200);
    if(p?.type==='giantBait'&&side&&sideObj(side).bait.length>=Number(p.threshold||8))b+=Number(p.value||0);
    if(p?.type==='fungusPower'&&fc.attachments.length>0)b+=Number(p.value||100);
    if(p?.type==='aphidFavorite'&&side)b+=faceUpBait(side).filter(x=>def(x).type==='insect'&&/アブラムシ/.test(def(x).name)).length*Number(p.value||100);
    if(p?.type==='cicadaParasite'&&side&&fieldActive(side).some(x=>x!==fc&&isCicadaCard(x.inst)))b+=Number(p.value||100);
    if(p?.type==='whiteStripe'&&side)b+=sideObj(side).bait.filter(x=>x.faceDown).length*Number(p.value||100);
    if(p?.type==='colony'&&side)b+=sideObj(side).discard.filter(x=>x.discardFaceDown).length*Number(p.value||200);
    if(p?.type==='sumatraNature'&&side&&baitHasRGB(side))b+=Number(p.value||800);
    if(side){
      const mirrors=fc.attachments.filter(a=>def(a).effect==='greenMirror').length;
      if(mirrors)b+=(sideObj(side).bait.length>=6?800:400)*mirrors*factor;
    }
    if(fc.attackPenaltyTurn===state.turnSeq)b-=fc.attackPenalty||0;
    return b;
  }
  function hasAttachment(fc,effect){ return fc.attachments.some(a=>def(a).effect===effect); }
  function ownerSideOf(inst,fallback){
    return inst?.owner==='player'||inst?.owner==='cpu'?inst.owner:fallback;
  }
  function sendToOwnerDiscard(inst,fallback){
    inst.faceDown=false;inst.discardFaceDown=false;
    sideObj(ownerSideOf(inst,fallback)).discard.push(inst);
  }
  function sendToOwnerDiscardFaceDown(inst,fallback){
    inst.faceDown=false;inst.discardFaceDown=true;
    sideObj(ownerSideOf(inst,fallback)).discard.push(inst);
  }
  function sendToOwnerHand(inst,fallback){
    inst.faceDown=false;inst.discardFaceDown=false;
    sideObj(ownerSideOf(inst,fallback)).hand.push(inst);
  }
  function sendToOwnerBait(inst,fallback){
    inst.discardFaceDown=false;inst.faceDown=false;inst.baitColor=null;inst.baitColorTurn=0;
    sideObj(ownerSideOf(inst,fallback)).bait.push(inst);
  }
  function isFaceUpBait(inst){return !inst.faceDown;}
  function legalSpellTarget(fc,casterSide=null){
    const p=passiveOfField(fc);
    if(p?.type==='foamGuard'||p?.type==='spellImmune')return false;
    if(p?.type==='transparentWings'&&fc.attachments.length>0)return false;
    const owner=findFieldSide(fc);
    if(casterSide&&owner&&casterSide!==owner&&(fc.spellShieldUntilTurnSeq>=state.turnSeq||fc.hardenTurn===state.turnSeq))return false;
    return true;
  }
  function spellTargetCandidates(casterSide,targetSide){
    let list=fieldActive(targetSide).filter(fc=>legalSpellTarget(fc,casterSide));
    if(casterSide!==targetSide){
      const forced=list.filter(fc=>passiveOfField(fc)?.type==='spellTaunt'||hasAttachment(fc,'spellTauntAttachment'));
      if(forced.length)list=forced;
    }
    return list;
  }
  function oncePerEntryEffect(effect){
    return ['oncePerEntry','bounceOnce','hideUntilOpponentEnd','mimicColorAttack','hornSkewer','weakPoison','handDiscardAfterTerritory','banditArm','baitFlipOnce','sourceAttackLockPersistent','dragonMantisFist','superPainNeedle','colorlessTargetOnce','kingHorn','charmingWing','antennaWhip','spellTaxTwoNext','spiritAway'].includes(effect);
  }
  function baitCardColor(inst){
    if(!inst||inst.faceDown)return null;
    if(phaseMutationActive())return 'colorless';
    if(inst.baitColorTurn===state?.turnSeq&&inst.baitColor)return inst.baitColor;
    return def(inst).color||null;
  }
  function faceUpColorCount(side,color){
    return sideObj(side).bait.filter(i=>baitCardColor(i)===color).length;
  }
  function allOwnEnhancements(side){
    return fieldActive(side).flatMap(fc=>fc.attachments.map(att=>({fc,att})));
  }
  function eligibleSwordDanceEnhance(inst){
    return def(inst).type==='enhance'&&!['summonWithAttachment','silverThread','blackSilverThread'].includes(def(inst).effect);
  }
  function canSwordDanceAttach(side,inst){
    if(!eligibleSwordDanceEnhance(inst))return false;
    if(def(inst).effect==='imitation'&&allOwnEnhancements(side).length===0)return false;
    return fieldActive(side).some(fc=>canAttachEnhancement(fc,inst));
  }
  function baseAdultName(name){return String(name).replace('（幼虫）','');}
  function matchingLarvaName(adult){return adult+'（幼虫）';}
  function flowerDanceRecord(side){
    if(!state.flowerDance)state.flowerDance={player:{turnSeq:0,count:0},cpu:{turnSeq:0,count:0}};
    return state.flowerDance[side];
  }
  function flowerDanceApplies(side,inst){
    const rec=flowerDanceRecord(side);
    if(rec.turnSeq!==state.turnSeq||rec.count<=0||def(inst).type!=='insect'||def(inst).name.includes('（幼虫）'))return false;
    return faceUpBait(side).some(x=>def(x).type==='insect'&&def(x).name===matchingLarvaName(def(inst).name));
  }
  function consumeFlowerDance(side,inst){
    const rec=flowerDanceRecord(side);
    if(flowerDanceApplies(side,inst)){rec.count=0;return true;}
    return false;
  }

  function activeLowSpellTax(){
    let count=0;
    for(const owner of ['player','cpu'])count+=fieldActive(owner).filter(fc=>passiveOfField(fc)?.type==='spellTaxLow').length;
    return count;
  }
  function currentSpellTax(side,c){
    if(c.type!=='spell')return 0;
    let tax=c.cost<=1?activeLowSpellTax():0;
    const rec=state?.spellTax?.[side];
    if(rec&&rec.turnSeq===state.turnSeq)tax+=rec.count||0;
    const first=state?.firstSpellTax?.[side];
    if(first&&first.turnSeq===state.turnSeq&&!first.used)tax+=first.count||0;
    return tax;
  }
  function currentEnhanceDiscount(side){
    const rec=state?.enhanceDiscount?.[side];
    return rec&&rec.turnSeq===state.turnSeq?(rec.count||0):0;
  }
  function insectHasTechniqueEffect(fc){
    const c=fieldDef(fc);
    if(passiveOfField(fc))return true;
    if((c.attacks||[]).some(a=>!!a.effect))return true;
    const side=findFieldSide(fc),amb=side?state?.grasshopperAmbush?.[side]:null;
    if(side&&!fc.suppressKeywords&&!hasAttachment(fc,'suppressPassive')&&!silenceActive()&&amb?.active&&!amb.ended&&grasshopperFamily(fc.inst))return true;
    return false;
  }
  function isAntFamily(inst){
    const name=def(inst)?.name||'';
    return /アリ/.test(name)&&!/(アリヅカ|アリジゴク|アリバチ)/.test(name);
  }
  function isWaspFamily(fc){return /バチ/.test(fieldDef(fc)?.name||'');}
  function isLonghornFamily(fc){return /カミキリ/.test(fieldDef(fc)?.name||'');}
  function isDragonflyFamily(fc){return /(トンボ|ヤンマ)/.test(fieldDef(fc)?.name||'');}
  function isStickInsectFamily(fc){return /ナナフシ/.test(fieldDef(fc)?.name||'');}
  function enhancementTargetLegal(fc,inst){
    if(!fc||!inst)return false;
    const e=def(inst)?.effect;
    if(e==='spear400'||e==='spear800'||e==='victoryBlade'||e==='auspiciousBlade')return !insectHasTechniqueEffect(fc);
    if(e==='redSword')return effectiveColor(fc)==='red';
    if(e==='blueJade')return effectiveColor(fc)==='blue';
    if(e==='greenMirror')return effectiveColor(fc)==='green';
    if(e==='waspArmor')return isWaspFamily(fc);
    if(e==='larvaPot')return fieldDef(fc).name.includes('（幼虫）');
    if(e==='longhornJaw')return isLonghornFamily(fc);
    if(e==='ancientDragonflyBlade')return isDragonflyFamily(fc);
    if(e==='stickChange')return isStickInsectFamily(fc);
    if(e==='centipedeGreaves')return /ムカデ/.test(fieldDef(fc).name);
    return true;
  }
  function canAttachEnhancement(fc,inst){
    if(!fc||fc.hidden||!enhancementTargetLegal(fc,inst))return false;
    if(def(inst).effect==='warriorSeal')return true;
    const p=passiveOfField(fc);
    if(p?.type==='doubleEnhance'&&fc.attachments.length>=1)return false;
    if(p?.type==='extremeBeauty'&&fc.attachments.length>=1)return false;
    return true;
  }
  function enforceAttachmentLegality(fc,side){
    if(!fc||!sideObj(side).field.includes(fc))return;
    for(const att of [...fc.attachments]){
      if(!enhancementTargetLegal(fc,att)){
        if(destroyAttachment(fc,att,side,'effect'))log(`装着条件を満たさなくなったため「${def(att).name}」を破壊した。`);
      }
    }
    if(passiveOfField(fc)?.type==='extremeBeauty'){
      while(fc.attachments.length>1){
        const att=fc.attachments[fc.attachments.length-1];
        if(!destroyAttachment(fc,att,side,'effect'))break;
        log(`＜極美蝶＞ 強化カードを1枚にするため「${def(att).name}」を破壊した。`);
      }
    }
  }
  function enforceAllAttachmentLegality(){
    if(!state)return;
    for(const side of ['player','cpu'])for(const fc of [...sideObj(side).field])enforceAttachmentLegality(fc,side);
  }
  function effectiveTechniqueCount(side,inst){
    const card=def(inst);
    let count=card.attacks?.length||0;
    if(passiveOfInst(inst))count++;
    const amb=state?.grasshopperAmbush?.[side];
    if(!silenceActive()&&amb?.active&&!amb.ended&&grasshopperFamily(inst)&&passiveOfInst(inst)?.type!=='flyOut')count++;
    return count;
  }
  function activeIntimidateCount(){
    let n=0;
    for(const owner of ['player','cpu'])n+=fieldActive(owner).filter(fc=>passiveOfField(fc)?.type==='intimidateCost').length;
    return n;
  }
  function effectiveCardCost(side,inst,target=null){
    const c=def(inst);
    if(inst?.freeUse||inst?.prepaidUse)return 0;
    let cost=Number(c.cost||0);
    if(c.type==='insect'){
      const p=passiveOfInst(inst);
      if(p?.type==='aquaticCost'||p?.type==='sapCost')cost-=Math.floor(faceUpColorCount(side,'blue')/2);
      if(p?.type==='nightFlight'&&fieldActive(side).length===0)cost-=1;
      if(p?.type==='ancientFossil'){
        cost-=visibleDiscard(side).filter(x=>def(x).type==='insect'&&passiveOfInst(x)?.type==='ancientFossil').length;
      }
      if(p?.type==='livingFossil'){
        cost-=visibleDiscard(side).filter(x=>def(x).type==='insect'&&passiveOfInst(x)?.type==='livingFossil').length;
      }
      if(p?.type==='colorBlessing')cost-=distinctFaceUpInsectBaitColors(side).size;
      if(p?.type==='riverCross'&&faceUpColorCount(other(side),'blue')>=3)cost-=1;
      if(p?.type==='phaseMutation')cost-=Math.floor(faceUpColorCount(side,'green')/2);
      if(def(inst)?.passive?.type==='king')cost-=emperorBaitCount(side);
      if(p?.type==='redDragonflyCost'&&fieldActive(side).some(fc=>fieldDef(fc).name==='アキアカネ'))cost-=1;
      if(p?.type==='yamatoPurple')cost-=Math.floor(sideObj(side).bait.filter(x=>x.faceDown).length/2);
      if(p?.type==='waterLarva')cost-=Math.floor(faceUpColorCount(other(side),'blue')/3);
      if(p?.type==='faceDownBaitDiscount')cost-=Math.floor(sideObj(other(side)).bait.filter(x=>x.faceDown).length/2);
      if(p?.type==='dewBlessing')cost-=visibleDiscard(side).filter(x=>def(x).type==='enhance').length;
      if(/ムカシ(トンボ|ヤンマ)/.test(c.name))cost-=visibleDiscard(side).filter(x=>def(x).effect==='ancientDragonflyBlade').length;
      if(flowerDanceApplies(side,inst))cost-=flowerDanceRecord(side).count*3;
      if(effectiveTechniqueCount(side,inst)>=2)cost+=activeIntimidateCount();
    }else if(c.type==='spell'){
      cost+=currentSpellTax(side,c);
      const sd=state?.nextSpellDiscount?.[side];
      if(sd&&sd.turnSeq===state.turnSeq&&sd.count>0)cost-=sd.count;
      if(c.effect==='eternalCocoon'){
        const colors=new Set(sideObj(side).bait.filter(isFaceUpBait).map(x=>baitCardColor(x)).filter(Boolean));
        for(const col of ['red','blue','green'])if(colors.has(col))cost-=1;
      }
    }else if(c.type==='enhance'){
      cost-=currentEnhanceDiscount(side);
      if(/甲冑/.test(c.name))cost-=faceUpBait(side).filter(x=>def(x).effect==='smallKabutoArmor').length*2;
      const tp=target?passiveOfField(target):null;
      if(tp?.type==='enhanceDiscount')cost-=Number(tp.value||1);
      if(tp?.type==='extremeBeauty')cost-=4;
    }
    return Math.max(0,cost);
  }
  function consumeEnhanceDiscount(side){
    const rec=state?.enhanceDiscount?.[side];
    if(rec&&rec.turnSeq===state.turnSeq)rec.count=0;
  }
  function triggerImmatureOnSpell(casterSide){
    const victimSide=other(casterSide);
    for(const fc of [...fieldActive(victimSide)]){
      if(passiveOfField(fc)?.type!=='immature')continue;
      log(`＜未熟＞ 相手が術カードを使用したため「${fieldDef(fc).name}」を破壊する。`);
      if(consumeArmorSynchronously(victimSide,fc))continue;
      destroyFieldCard(victimSide,fc,'effect',null);
    }
  }
  function spendCost(side,inst,cost){
    const s=sideObj(side);
    if(cost>s.cost)return false;
    s.cost-=cost;
    emitCost(side,inst,def(inst),cost);
    if(def(inst).type==='spell'){
      triggerImmatureOnSpell(side);
      const first=state?.firstSpellTax?.[side];
      if(first&&first.turnSeq===state.turnSeq&&!first.used)first.used=true;
      const sd=state?.nextSpellDiscount?.[side];
      if(sd&&sd.turnSeq===state.turnSeq&&sd.count>0)sd.count=0;
    }
    if(def(inst).type==='enhance')consumeEnhanceDiscount(side);
    return true;
  }
  function activeUseCounter(side,type){
    const rec=state?.cardCounter?.[side];
    if(!rec)return false;
    return type==='spell'?rec.spellTurn===state.turnSeq:rec.enhanceTurn===state.turnSeq;
  }
  async function consumeUseCounter(side,type){
    if(!activeUseCounter(side,type))return false;
    const rec=state.cardCounter[side];
    if(type==='spell')rec.spellTurn=0;else rec.enhanceTurn=0;
    log(`「${type==='spell'?'蟲術の演舞':'蟲装の演舞'}」により${sideName(side)}の最初の${type==='spell'?'術':'強化'}カードを打ち消した。`);
    return true;
  }
  async function shouldCounterCardUse(side,inst,paidCost){
    const c=def(inst),opp=other(side);
    if(c.type==='enhance'&&await consumeUseCounter(side,'enhance'))return true;
    if(c.type!=='spell')return false;
    if(await consumeUseCounter(side,'spell'))return true;

    const supers=[...fieldActive(opp)].filter(fc=>passiveOfField(fc)?.type==='superClairvoyance');
    for(const fc of supers){
      let use=opp==='cpu'?true:await confirmYesNo(`＜超神通力＞で「${c.name}」を打ち消しますか？`,'超神通力');
      if(!use)continue;
      const destroyed=await attemptDestroyFieldCard(opp,fc,'effect',null);
      if(destroyed){log(`＜超神通力＞ 「${c.name}」を打ち消した。`);return true;}
    }
    if(Number.isFinite(Number(paidCost))&&Number(paidCost)<=1){
      const normals=[...fieldActive(opp)].filter(fc=>passiveOfField(fc)?.type==='clairvoyance');
      for(const fc of normals){
        let use=opp==='cpu'?true:await confirmYesNo(`＜神通力＞で「${c.name}」を打ち消しますか？`,'神通力');
        if(!use)continue;
        const destroyed=await attemptDestroyFieldCard(opp,fc,'effect',null);
        if(destroyed){log(`＜神通力＞ 「${c.name}」を打ち消した。`);return true;}
      }
    }
    return false;
  }
  function counterThreatened(side,inst){
    const c=def(inst);
    if(c.type==='enhance')return activeUseCounter(side,'enhance');
    if(c.type!=='spell')return false;
    if(activeUseCounter(side,'spell'))return true;
    const opp=other(side);
    if(fieldActive(opp).some(fc=>passiveOfField(fc)?.type==='superClairvoyance'))return true;
    if(effectiveCardCost(side,inst)<=1&&fieldActive(opp).some(fc=>passiveOfField(fc)?.type==='clairvoyance'))return true;
    return false;
  }
  async function prepaySpellForCounter(side,inst,c){
    const s=sideObj(side);
    if(c.effect==='bloodPact'&&s.territory.length>=2){
      const normal=effectiveCardCost(side,inst);
      let useTerritory=normal>s.cost;
      if(side==='cpu'&&normal<=s.cost&&cpuShouldPayBloodPactWithTerritory(inst))useTerritory=true;
      if(side==='player'&&normal<=s.cost){
        const choice=await choose([
          {value:'cost',title:`${normal}コスト払う`,detail:'通常のコスト'},
          {value:'territory',title:'縄張り2枚を捨てる',detail:'代替コスト'}
        ],'打ち消し判定の前に使用コストを支払います。','刺蠅の血盟');
        if(choice===null)return null;useTerritory=choice==='territory';
      }
      if(useTerritory){
        for(let n=0;n<2;n++){
          let idx=0;
          if(side==='player'){
            const opts=s.territory.map((x,i)=>({value:i,title:`縄張り ${i+1}`,detail:x.faceUpTerritory?def(x).name:'裏向き'}));
            idx=await choose(opts,'使用コストとして捨てる縄張りを選んでください。','刺蠅の血盟');if(idx===null)return null;
          }
          const [card]=s.territory.splice(Number(idx)||0,1);sendToOwnerDiscard(card,side);
        }
        emitCost(side,inst,c,'縄張り2枚');triggerImmatureOnSpell(side);
        inst.prepaidUse=true;inst.prepaidMode='territory';inst.prepaidCost='territory2';
        return 'territory2';
      }
    }
    const cost=effectiveCardCost(side,inst);
    if(!spendCost(side,inst,cost))return null;
    inst.prepaidUse=true;inst.prepaidCost=cost;
    return cost;
  }
  function clearPrepaid(inst){delete inst.prepaidUse;delete inst.prepaidMode;delete inst.prepaidCost;}

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
    if(attack.dynamic==='redBait300')return s.bait.filter(i=>isFaceUpBait(i)&&def(i).type==='insect'&&baitCardColor(i)==='red').length*300;
    if(attack.dynamic==='redDiscard100')return visibleDiscardFrom(s).filter(i=>def(i).type==='insect'&&def(i).color==='red').length*100;
    if(attack.dynamic==='discard100')return visibleDiscardFrom(s).length*100;
    if(attack.dynamic==='field100')return fieldActive(side).length*100;
    if(attack.dynamic==='greenField300')return fieldActive(side).filter(x=>effectiveColor(x)==='green').length*300;
    if(attack.dynamic==='antField200')return fieldActive(side).filter(x=>fieldDef(x).name.includes('アリ')).length*200;
    if(attack.dynamic==='poisonDiscard300')return visibleDiscardFrom(s).filter(x=>def(x).type==='insect'&&poisonTechniqueOnInstance(x)).length*300;
    if(attack.dynamic==='poisonDiscard200')return visibleDiscardFrom(s).filter(x=>def(x).type==='insect'&&poisonTechniqueOnInstance(x)).length*200;
    if(attack.dynamic==='waspField100')return fieldActive(side).filter(x=>/バチ/.test(fieldDef(x).name)).length*100;
    return Number(attack.power||0);
  }
  function attackPower(side,fc,attack){return Math.max(0,dynamicBasePower(side,fc,attack)+attackBonus(fc));}
  function isAttackBlocked(side,fc){
    const p=passiveOfField(fc);
    if(state?.attackTax&&currentAttackTax(side)>sideObj(side).cost)return true;
    if(p?.type==='foamGuard'||p?.type==='cannotAttack')return true;
    if(p?.type==='king'&&fc.enteredTurnSeq===state.turnSeq)return true;
    if(fc.gigasLockTurn===state.turnSeq)return true;
    if(p?.type==='greenBaitAttackGate'&&faceUpColorCount(side,'green')<Number(p.value||0))return true;
    if(hasAttachment(fc,'summonWithAttachment'))return true;
    if(fc.cannotAttackTurn===state.turnSeq)return true;
    const locks=fc.attackLocks||[];
    for(const lock of locks){
      if(lock.turnSeq!==state.turnSeq)continue;
      if(lock.persistent)return true;
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
    if(attack.effect==='targetHasEnhance'&&!attackableTargets(side).some(x=>x.attachments.length>0))return false;
    if(attack.effect==='partnerRequired'&&!fieldActive(side).some(x=>x!==fc&&fieldDef(x).name===attack.partner))return false;
    if(attack.effect==='reverseSwap'){
      if(attackableTargets(side).length===0)return false;
      if(!sideObj(other(side)).bait.some(x=>isFaceUpBait(x)&&def(x).type==='insect'))return false;
    }
    if(attack.effect==='sacrificeEnhanceAttack'){
      if(!fieldActive(side).some(x=>x.attachments.length>0))return false;
    }
    if(attack.effect==='banditArm'&&sideObj(other(side)).hand.length===0)return false;
    if(attack.effect==='multiTwo'&&attackableTargets(side).length<2)return false;
    if(attack.effect==='requiresEnhance'&&fc.attachments.length===0)return false;
    if(attack.effect==='doubleTerritory'&&fc.attachments.length===0)return false;
    if(attack.effect==='carnivore'&&visibleDiscard(side).filter(x=>def(x).type==='insect').length<5)return false;
    if(attack.effect==='needsTwoEnemy'&&fieldActive(other(side)).length<2)return false;
    if(attack.effect==='longArmMusou'){
      const targets=attackableTargets(side);
      if(!targets.some((x,i)=>targets.some((y,j)=>j!==i&&effectiveColor(x)===effectiveColor(y))))return false;
    }
    if(attack.effect==='hawkEye'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>!!passiveOfField(x)))return false;
    if(attack.effect==='maxCostTarget'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>Number(fieldDef(x).cost||0)<=Number(attack.maxCost??1)))return false;
    if(attack.effect==='bounceLowCost'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>Number(fieldDef(x).cost||0)<=Number(attack.maxCost??1)))return false;
    if(attack.effect==='colorlessTargetOnce'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>effectiveColor(x)==='colorless'))return false;
    if(attack.effect==='highCostTarget'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>Number(fieldDef(x).cost||0)>=Number(attack.minCost||5)))return false;
    if(attack.effect==='damagedTarget'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>x.damage>0))return false;
    if(attack.effect==='cicadaChorus'&&fieldActive(side).filter(x=>isCicadaCard(x.inst)).length<2)return false;
    if(attack.effect==='mantisOrchidDance'&&fc.attachments.length===0)return false;
    if(attack.effect==='monochromeNeedle'&&fieldActive(other(side)).length>0&&!attackableTargets(side).some(x=>effectiveColor(x)==='colorless'))return false;
    return true;
  }
  function weaknessMultiplier(attackerColor, defenderColor){
    return (attackerColor==='red'&&defenderColor==='green') || (attackerColor==='blue'&&defenderColor==='red') || (attackerColor==='green'&&defenderColor==='blue') ? 2 : 1;
  }
  function cicadaParasiteActive(fc){
    const side=findFieldSide(fc);
    return passiveOfField(fc)?.type==='cicadaParasite'&&side&&fieldActive(side).some(x=>x!==fc&&isCicadaCard(x.inst));
  }
  function attackableTargets(attackingSide){
    const opp=other(attackingSide);
    const active=fieldActive(opp);
    const forcedRaw=active.filter(fc=>
      ['pollen','taunt'].includes(passiveOfField(fc)?.type)||
      cicadaParasiteActive(fc)||
      hasAttachment(fc,'tauntAttachment')||
      hasAttachment(fc,'shadowDoubleMirror')||
      fc.forcedAttackTargetTurn===state.turnSeq
    );
    let candidates=active.filter(fc=>{
      if(fc.mimicTurn===state.turnSeq)return false;
      if(fc.attachments.some(a=>def(a).effect==='secretBook'&&a.protectTurn===state.turnSeq))return false;
      const p=passiveOfField(fc);
      if(p?.type==='batesMimic'&&active.some(x=>x!==fc))return false;
      return true;
    });
    if(forcedRaw.length)candidates=candidates.filter(fc=>forcedRaw.includes(fc));
    return candidates;
  }
  function opponentHasFieldInsect(side){ return fieldActive(other(side)).length>0; }
  function hasFlyOutOnField(side){ return fieldActive(side).some(fc=>passiveOfField(fc)?.type==='flyOut'); }
  function grasshopperFamily(inst){return /(バッタ|イナゴ)/.test(def(inst).name);}
  function hasFlyOutAbility(side,inst){
    if(def(inst).type!=='insect')return false;
    if(passiveOfInst(inst)?.type==='flyOut')return true;
    const rec=state?.grasshopperAmbush?.[side];
    return !!(rec?.active&&!rec.ended&&grasshopperFamily(inst));
  }

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
    if(faceUp) el.appendChild(items[items.length-1].discardFaceDown?cardBack():cardElement(items[items.length-1],{mini:true}));
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
    const cropClass=c.imageCrop?` crop-${escapeHtml(c.imageCrop)}`:'';
    const artHtml=c.image?`<div class="card-art${cropClass}"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" referrerpolicy="no-referrer" loading="lazy"></div>`:'';
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
      const b=btn('がくしゅうへ','action-btn',()=>returnToLearning());bar.appendChild(b);return;
    }
    if(state.turn!=='player')return;
    if(state.phase==='set'){
      bar.appendChild(btn('やっぱり置かない','action-btn secondary',()=>{
        log('あなたはエサを置かずにメインフェイズへ進みます。');
        finishSetPhase();
      }));
      return;
    }
    if(state.phase==='main'){
      if(state.chain?.side==='player') bar.appendChild(btn('連撃をやめる','action-btn secondary',()=>{state.chain=null;message('連撃を終了しました。');render();}));
      else{
        if(canAbyssRevive('player'))bar.appendChild(btn('奈落復活','action-btn secondary',()=>useAbyssRevival('player')));
        bar.appendChild(btn('ターン終了','action-btn',()=>endTurn()));
      }
    }
  }
  function btn(text,cls,fn){const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=fn;return b;}

  function adultNameForLarva(name){return String(name).replace('（幼虫）','');}
  function faceUpBait(side){return sideObj(side).bait.filter(isFaceUpBait);}
  function hasPoisonTechnique(fc){
    const c=fieldDef(fc),p=passiveOfField(fc);
    return (c.attacks||[]).some(a=>String(a.name||'').includes('毒'))||/＜[^＞]*毒[^＞]*＞/.test(String(p?.text||''));
  }
  function canUseHandCard(side,inst){
    if(state.turn!==side||state.over)return false;
    const ss=sideObj(side),c=def(inst);
    if(state.phase==='set')return !ss.setDone;
    if(state.phase!=='main'||state.chain)return false;

    if(c.type==='insect'){
      const cost=effectiveCardCost(side,inst);
      if(passiveOfInst(inst)?.type==='altSacrifice2')return cost<=ss.cost||fieldActive(side).length>=2;
      if(passiveOfInst(inst)?.type==='larvaSacrificeSummon')return cost<=ss.cost||fieldActive(side).some(fc=>fieldDef(fc).name.includes('（幼虫）'));
      if(passiveOfInst(inst)?.type==='parthenogenesis'&&fieldActive(side).some(fc=>passiveOfField(fc)?.type==='parthenogenesis'))return true;
      if(passiveOfInst(inst)?.type==='demonSummon'&&fieldActive(side).some(fc=>fc.attachments.length>0))return true;
      return cost<=ss.cost;
    }

    if(c.type==='enhance'){
      if(c.effect==='shadowDoubleMirror'||c.effect==='jewelColorCopy')return effectiveCardCost(side,inst)<=ss.cost&&fieldActive(side).length>=2&&fieldActive(side).some(fc=>canAttachEnhancement(fc,inst));
      if(c.effect==='puppetCordyceps')return !discardSummonBlocked()&&effectiveCardCost(side,inst)<=ss.cost&&visibleDiscardFrom(ss).some(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=3);
      if(c.effect==='silverThread')return effectiveCardCost(side,inst)<=ss.cost&&visibleDiscardFrom(ss).filter(x=>def(x).type==='insect').length>=2;
      if(c.effect==='blackSilverThread')return effectiveCardCost(side,inst)<=ss.cost&&visibleDiscardFrom(ss).some(x=>def(x).type==='insect');
      if(c.effect==='summonWithAttachment')return effectiveCardCost(side,inst)<=ss.cost&&ss.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect');
      if(c.effect==='imitation'&&allOwnEnhancements(side).length===0)return false;
      const targets=fieldActive(side).filter(fc=>canAttachEnhancement(fc,inst));
      if(c.effect==='grudgeJinbaori'){
        const maxDiscount=faceUpBait(side).length;
        return targets.some(fc=>Math.max(0,effectiveCardCost(side,inst,fc)-maxDiscount)<=ss.cost);
      }
      return targets.some(fc=>effectiveCardCost(side,inst,fc)<=ss.cost);
    }

    const cost=effectiveCardCost(side,inst);
    const opp=other(side);
    const legalOpp=spellTargetCandidates(side,opp);
    if(c.effect==='bloodPact'){
      if(!legalOpp.length)return false;
      return cost<=ss.cost||ss.territory.length>=2;
    }
    if(cost>ss.cost)return false;
    if(c.effect==='recoverInsect')return visibleDiscardFrom(ss).some(x=>def(x).type==='insect');
    if(['burn600','burn1000','destroyOpponent','blockAttackNext','breathRelease'].includes(c.effect))return legalOpp.length>0;
    if(c.effect==='readyAttack')return fieldActive(side).some(fc=>fc.attacked);
    if(c.effect==='baitToHand'||c.effect==='baitTempSummon')return faceUpBait(side).some(x=>def(x).type==='insect');
    if(c.effect==='baitRushTwo')return faceUpBait(side).some(x=>def(x).type==='insect');
    if(c.effect==='moveEnhance')return fieldActive(side).length>=2&&fieldActive(side).some(fc=>fc.attachments.length);
    if(c.effect==='destroyEnhance')return legalOpp.some(fc=>fc.attachments.length);
    if(c.effect==='swapDiscardField')return visibleDiscardFrom(ss).some(x=>def(x).type==='insect')&&fieldActive(side).length>0;
    if(c.effect==='sameCostSwap')return ss.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&fieldActive(side).some(fc=>def(fc.inst).cost===def(x).cost));
    if(c.effect==='handTempSummon')return ss.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect');
    if(c.effect==='evolveLarva')return fieldActive(side).some(fc=>fieldDef(fc).name.includes('（幼虫）')&&ss.hand.some(x=>def(x).type==='insect'&&def(x).name===adultNameForLarva(fieldDef(fc).name)));
    if(c.effect==='singleAttack500'||c.effect==='hideOwn')return fieldActive(side).length>0;
    if(c.effect==='harvestBaitSpecial')return faceUpBait(side).some(x=>['enhance','spell'].includes(def(x).type));
    if(c.effect==='queenBeeSummon')return ss.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&def(x).name.includes('バチ'));
    if(c.effect==='drawOwnTerritory')return ss.territory.length>0;
    if(c.effect==='flipOwnBaitUp')return ss.bait.some(x=>x.faceDown);
    if(c.effect==='youngReincarnation')return fieldActive(side).some(fc=>!fieldDef(fc).name.includes('（幼虫）')&&visibleDiscardFrom(ss).some(x=>def(x).type==='insect'&&def(x).name===matchingLarvaName(fieldDef(fc).name)));
    if(c.effect==='ghostSwap')return legalOpp.length>0&&faceUpBait(opp).some(x=>def(x).type==='insect');
    if(c.effect==='polarEvolution')return fieldActive(side).some(fc=>fieldDef(fc).name.includes('（幼虫）')&&visibleDiscardFrom(ss).some(x=>def(x).type==='insect'&&def(x).name===baseAdultName(fieldDef(fc).name)));
    if(c.effect==='whiteAntHarvest')return faceUpBait(side).some(x=>def(x).type==='enhance');
    if(c.effect==='leafcutterWork')return faceUpBait(side).length>0;
    if(c.effect==='spellShield')return fieldActive(side).length>0;
    if(c.effect==='swordDanceAttach')return faceUpBait(side).some(x=>canSwordDanceAttach(side,x));
    if(c.effect==='sameNameBurn')return legalOpp.length>0;
    if(c.effect==='sacrificeEnhanceBurn')return allOwnEnhancements(side).length>0;
    if(c.effect==='intercept400'||c.effect==='intercept800')return legalOpp.length>0;
    if(c.effect==='compostSoil')return visibleDiscardFrom(ss).length>=2;
    if(c.effect==='poisonFollowUp')return fieldActive(side).some(fc=>fc.attacked&&hasPoisonTechnique(fc));
    if(c.effect==='poisonCurse')return fieldActive(opp).some(fc=>(fc.persistentDamage||0)>0);
    if(['sealedGrudge','offeringSeal','fiveColorRelease','eternalCocoon'].includes(c.effect))return legalOpp.length>0;
    if(c.effect==='worshipGreatSword')return fieldActive(side).some(fc=>fc.attacked)&&visibleDiscardFrom(ss).some(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=3);
    if(c.effect==='enhanceDanceCounter'||c.effect==='spellDanceCounter'||c.effect==='jewelLegacy')return true;
    if(c.effect==='armorSmith')return visibleDiscardFrom(ss).some(x=>def(x).type==='enhance'&&/(甲冑|贋作)/.test(def(x).name));
    if(c.effect==='gongChant')return allOwnEnhancements(side).length>0;
    if(c.effect==='hellSword')return fieldActive(side).some(fc=>fc.attacked&&fc.attachments.length>0);
    if(c.effect==='fatedShadow')return faceUpBait(side).some(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=ss.cost-cost);
    if(c.effect==='flyLarvae')return visibleDiscardFrom(ss).some(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=1);
    if(c.effect==='lightningStorm'||c.effect==='blastStorm')return legalOpp.length>0;
    if(c.effect==='sacrificeReincarnation')return fieldActive(side).some(fc=>ownerSideOf(fc.inst,side)===side);
    if(c.effect==='nextSpellDiscount'||c.effect==='halfDeathCompanion'||c.effect==='allField300End'||c.effect==='allField1200End'||c.effect==='silkwormGag')return true;
    if(c.effect==='sparkStorm'||c.effect==='boundarySend')return legalOpp.length>0;
    if(c.effect==='pupaWintering')return ss.hand.some(x=>x.uid!==inst.uid);
    if(c.effect==='underworldGuide')return !discardSummonBlocked()&&visibleDiscardFrom(ss).some(x=>def(x).type==='insect');
    if(c.effect==='goldenArm')return fieldActive(side).some(fc=>legalSpellTarget(fc,side));
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

  async function startGame(playerDeckRef, cpuDeckRef, firstSide){
    if(!hasBattleAccess()){refreshBattleGate();return false;}
    const playerDeck=resolveDeckDefinition(playerDeckRef),cpuDeck=resolveDeckDefinition(cpuDeckRef);
    if(!deckIsBattleReady(playerDeck)||!deckIsBattleReady(cpuDeck))return false;
    if(!consumeBattleAccess())return false;
    uidCounter=1;
    state={player:makeSide(playerDeckRef,false),cpu:makeSide(cpuDeckRef,true),turn:firstSide,turnSeq:1,turnNo:1,phase:'draw',over:false,winner:null,log:[],chain:null,busy:false,
      enhanceDiscount:{player:{turnSeq:0,count:0},cpu:{turnSeq:0,count:0}},
      spellTax:{player:{turnSeq:0,count:0},cpu:{turnSeq:0,count:0}},
      grasshopperAmbush:{player:{active:false,ended:false},cpu:{active:false,ended:false}},
      flowerDance:{player:{turnSeq:0,count:0},cpu:{turnSeq:0,count:0}},
      attackTax:{player:{turnSeq:0,count:0},cpu:{turnSeq:0,count:0}},
      moonlight:{player:{active:false,turnSeq:0},cpu:{active:false,turnSeq:0}},
      cardCounter:{player:{spellTurn:0,enhanceTurn:0},cpu:{spellTurn:0,enhanceTurn:0}},
      jewelLegacy:{player:{turnSeq:0},cpu:{turnSeq:0}},
      firstSpellTax:{player:{turnSeq:0,count:0,used:false},cpu:{turnSeq:0,count:0,used:false}},
      nextSpellDiscount:{player:{turnSeq:0,count:0},cpu:{turnSeq:0,count:0}},
      silkwormGag:{player:{untilTurnSeq:0},cpu:{untilTurnSeq:0}},
      resolvingSpellUntargeted:false,
      resolvingSpellSide:null,
      noFlyOutSide:null,noFlyOutTurn:0,
      cpuDifficulty};
    startScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    log(`対戦開始！ あなたは「${state.player.deckName}」、CPUは「${state.cpu.deckName}」を使用。`);
    log(`CPUのつよさ：${cpuDifficultyLabel(state.cpuDifficulty)}`);
    log(`${state.turn==='player'?'あなた':'CPU'}が先攻です。`);
    render();
    await beginTurn();
  }
  async function chooseTurnOrder(playerDeckRef){
    if(!hasBattleAccess()){refreshBattleGate();return;}
    const playerDeck=resolveDeckDefinition(playerDeckRef);if(!deckIsBattleReady(playerDeck))return;
    const cpuOptions=battleDeckOptions().map(item=>({value:item.ref,title:item.name,detail:item.detail}));
    cpuOptions.push({value:null,title:'やめる',detail:''});
    const cpuDeckRef=await choose(cpuOptions,`あなた：${playerDeck.name}\nCPUが使うデッキを選んでください。`,'CPUのデッキ');
    if(!cpuDeckRef)return;
    const firstSide=await choose([
      {value:'player',title:'先攻',detail:'あなたから開始。先攻1ターン目はドローなし'},
      {value:'cpu',title:'後攻',detail:'CPUが先攻。あなたは後攻で開始'},
      {value:null,title:'やめる',detail:''}
    ],`あなた：${playerDeck.name}\nCPU：${resolveDeckDefinition(cpuDeckRef).name}`,'先攻・後攻');
    if(!firstSide)return;
    await startGame(playerDeckRef,cpuDeckRef,firstSide);
  }

  function showStart(){
    hideCpuNotice();
    hideResultPopup();
    state=null;deckBuilderScreen.classList.add('hidden');gameScreen.classList.add('hidden');startScreen.classList.remove('hidden');closeModal(null);
    renderCustomDeckChoices();refreshBattleGate();
  }
  function renderSetDecisionHandPreview(container){
    if(!container||!state?.player)return;
    container.classList.add('set-hand-preview');
    const label=document.createElement('div');
    label.className='set-hand-preview-label';
    label.textContent=`現在の手札 ${state.player.hand.length}枚`;
    container.appendChild(label);

    const grid=document.createElement('div');
    grid.className='set-hand-preview-grid';
    for(const inst of state.player.hand){
      const node=cardElement(inst,{hand:true});
      node.classList.add('set-hand-preview-card');
      node.removeAttribute('style');
      grid.appendChild(node);
    }
    container.appendChild(grid);
  }

  async function beginTurn(){
    if(state.over)return;
    const side=state.turn,s=sideObj(side);
    state.phase='draw'; state.chain=null;
    s.setDone=false; s.cost=0;
    for(const fc of s.field){
      fc.attacked=false;Engine.pruneExpiredModifiers(fc,state.turnSeq);
      if(fc.hidden&&fc.queenHatchTurn===state.turnSeq){fc.hidden=false;fc.queenHatchTurn=0;log(`「${fieldDef(fc).name}」を女王の産卵で表向きにした。`);}
    }
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
    else {
      if(!s.hand.length){
        state.phase='set';
        log('手札がないため、エサを置かずにメインフェイズへ進みます。');
        finishSetPhase();
        return;
      }

      state.phase='set-choice';
      message('このターン、エサを置きますか？');
      render();

      const setChoice=await choose([
        {value:'place',title:'エサを置く',detail:'手札から1枚を選んでエサにする'},
        {value:'skip',title:'置かない',detail:'そのままメインフェイズへ進む'}
      ],'手札を確認して、このターンにエサを置くか決めてください。','エサを置く？',renderSetDecisionHandPreview);

      if(!state||state.over||state.turn!=='player')return;

      if(setChoice==='place'){
        state.phase='set';
        message('セットフェイズ：エサにする手札を1枚選んでください。');
        render();
      }else{
        state.phase='set';
        log('あなたはエサを置かずにメインフェイズへ進みます。');
        finishSetPhase();
      }
    }
  }
  function resolveDeckOut(side){
    const p=state.player.territory.length,c=state.cpu.territory.length;
    if(p===c)finishGame('draw',`山札切れ。縄張りが同数（${p}対${c}）なので引き分け！`);
    else {const winner=p>c?'player':'cpu';finishGame(winner,`山札切れ。縄張りが多い${winner==='player'?'あなた':'CPU'}の勝ち！`);}
  }
  async function onHandCard(uid){
    if(state.busy)return; const s=state.player; const inst=s.hand.find(x=>x.uid===uid); if(!inst)return;
    if(state.phase==='set'){
      inst.faceDown=false;inst.discardFaceDown=false;Engine.moveCard(s,inst,ZONE.HAND,ZONE.BAIT); s.setDone=true;
      events.emit(EVENT.CARD_MOVED,{side:'player',card:inst,from:ZONE.HAND,to:ZONE.BAIT});
      log(`あなたは「${def(inst).name}」をエサにしました。`);
      await resolveGoldenDungBait('player',inst);
      finishSetPhase(); return;
    }
    if(state.phase==='main' && canUseHandCard('player',inst)) await playCardFromHand('player',inst);
  }

  async function resolveGoldenDungBait(side,inst){
    if(passiveOfInst(inst)?.type!=='goldenDungBeetle')return false;
    const choices=visibleDiscard(side).filter(x=>def(x).type==='insect');if(!choices.length)return false;
    let use=side==='cpu'?true:await confirmYesNo('＜黄金虫＞で、このオオセンチコガネを捨て札の虫と入れ替えますか？','黄金虫');
    if(!use)return false;
    const chosen=await chooseOwnedInstance(side,'表向きのエサにする捨て札の虫を選んでください。',choices);if(!chosen)return false;
    if(!removeInstance(sideObj(side).bait,inst))return false;
    removeInstance(sideObj(side).discard,chosen);
    sendToOwnerDiscard(inst,side);chosen.faceDown=false;sideObj(side).bait.push(chosen);
    log(`＜黄金虫＞ 「${def(inst).name}」と捨て札の「${def(chosen).name}」を入れ替えた。`);
    return true;
  }

  function canAbyssRevive(side){
    if(state.turn!==side||state.phase!=='main'||state.chain||discardSummonBlocked()||sideObj(side).cost<6)return false;
    return visibleDiscard(side).some(x=>def(x).type==='insect'&&passiveOfInst(x)?.type==='abyssRevival');
  }
  async function useAbyssRevival(side){
    if(!canAbyssRevive(side))return false;
    const choices=visibleDiscard(side).filter(x=>def(x).type==='insect'&&passiveOfInst(x)?.type==='abyssRevival');
    const chosen=await chooseOwnedInstance(side,'＜奈落復活＞で場に出す虫を選んでください。',choices);if(!chosen)return false;
    sideObj(side).cost-=6;emitCost(side,chosen,def(chosen),6);removeInstance(sideObj(side).discard,chosen);
    await putInsectOnField(side,chosen,{abyssRevived:true});
    log(`＜奈落復活＞ 「${def(chosen).name}」をコスト6で捨て札から場に出した。`);render();return true;
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
  function chooseBestInstance(list){
    if(!list.length)return null;
    if(currentCpuDifficulty()==='normal')return [...list].sort((a,b)=>def(b).cost-def(a).cost)[0]||null;
    return [...list].sort((a,b)=>cpuCardKeepValue(b)-cpuCardKeepValue(a))[0]||null;
  }
  function cpuInstanceChoiceScore(text,inst){
    const t=String(text||''),c=def(inst);
    let score=cpuCardKeepValue(inst);
    if(/エサにする手札|捨てる手札|破壊するエサ|捨て札にする手札/.test(t))score=-cpuCardKeepValue(inst);
    else if(/場に出す|手札に戻す|回収|表向きにする/.test(t))score=cpuCardKeepValue(inst)+Number(c?.cost||0)*0.4;
    else if(/強化カード/.test(t)&&c?.type==='enhance'){
      const m=attachmentModifier(inst);score=4+(Math.max(0,m.attack)+Math.max(0,m.hp))/250;
    }
    if(/相手/.test(t))score+=Number(c?.cost||0)*0.7;
    return score;
  }
  async function chooseOwnedInstance(side,text,list){
    if(!list.length)return null;
    if(side==='player')return await chooseInstances(text,list);
    if(cpuAquaticBossActive()&&String(text||'').includes('逆立ち返しで場に出す相手のエサ')){
      return [...list].sort((a,b)=>cpuAquaticOpponentBaitDanger(a)-cpuAquaticOpponentBaitDanger(b))[0]||null;
    }
    if(cpuAquaticBossActive()&&String(text||'').includes('場に出すエサの虫')){
      return [...list].sort((a,b)=>cpuTempSummonValue(b)-cpuTempSummonValue(a))[0]||null;
    }
    if(currentCpuDifficulty()==='normal')return chooseBestInstance(list);
    return [...list].sort((a,b)=>cpuInstanceChoiceScore(text,b)-cpuInstanceChoiceScore(text,a))[0]||null;
  }
  async function chooseOwnedField(side,text,list=fieldActive(side)){
    if(!list.length)return null;
    if(side==='player')return await chooseField(text,list,true);
    if(currentCpuDifficulty()==='normal')return [...list].sort((a,b)=>def(b.inst).cost-def(a.inst).cost)[0];
    const t=String(text||'');
    const score=fc=>{
      if(/破壊する|犠牲|生贄|共食い|捨てる/.test(t))return -cpuFieldThreat(fc,'cpu');
      if(/もう1度攻撃|再び攻撃|攻撃させる/.test(t))return cpuBestAttackScore(fc,'strong')+cpuFieldThreat(fc,'cpu')*0.3;
      if(/攻撃力を500増やす虫/.test(t)){
        let v=cpuFieldThreat(fc,'cpu');
        if(canAttackSide('cpu',fc)){
          const attacks=availableAttacks('cpu',fc).filter(a=>usableAttack('cpu',fc,a));
          const base=Math.max(0,...attacks.map(a=>attackPower('cpu',fc,a)));
          for(const enemy of attackableTargets('cpu')){
            const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(enemy));
            const remain=maxHp(enemy)-enemy.damage;
            if(base*mult<remain&&(base+500)*mult>=remain)v+=20+cpuFieldThreat(enemy,'player');
          }
        }
        return v;
      }
      if(/裏向きにする自分|守る|対象/.test(t))return cpuFieldThreat(fc,'cpu');
      return cpuFieldThreat(fc,'cpu');
    };
    return [...list].sort((a,b)=>score(b)-score(a))[0];
  }
  function isCicadaCard(inst){
    return ['ミンミンゼミ','ヒグラシ','クマゼミ','アブラゼミ','テイオウゼミ','エゾゼミ','ツクツクボウシ','チッチゼミ','クロテイオウゼミ','ニイニイゼミ','ハルゼミ','ジュウシチネンゼミ','ジュウサンネンゼミ'].includes(def(inst).name);
  }
  async function configureAttachedCard(side,fc,att,options={}){
    const e=def(att).effect;
    const entered=options.entered!==false;
    if(e==='stickChange'){
      const col=side==='player'?await chooseSimple('七節の変化巻で色を選んでください。',[['red','赤'],['blue','青'],['green','緑']]):'red';
      att.chosenColor=col||'red';
    }
    if(e==='lifeFlame'){
      att.destroyHostTurn=nextOpponentTurnSeq(side);
      att.destroyHostResolved=false;
    }
    if(e==='changeColor'){
      const col=side==='player'?await chooseSimple('色を選んでください。',[['red','赤'],['blue','青'],['green','緑']]):bestColorAgainstCPU(fc,other(side));
      fc.changedColor=col||effectiveColor(fc);
    }
    if(e==='secretBook')att.protectTurn=nextOpponentTurnSeq(side);
    if(e==='dragonflyHairpin'&&options.paidOwnCost){
      const targets=fieldActive(other(side));
      if(targets.length){
        const target=side==='player'?await chooseField('「鬼蜻蜓の簪」で裏向きにする相手の虫を選んでください。',targets,true):targets[0];
        if(target){target.hidden=true;target.hairpinSourceUid=att.uid;target.hiddenUntilTurnSeq=0;att.hairpinTargetUid=target.inst.uid;log(`「鬼蜻蜓の簪」で「${fieldDef(target).name}」を裏向きにした。`);}
      }
    }
    if(e==='centipedeGreaves'){
      const choices=visibleDiscard(side).filter(x=>def(x).effect==='centipedeGreaves'&&canAttachEnhancement(fc,x));
      if(choices.length){
        let use=side==='cpu'?true:await confirmYesNo('捨て札の「百足の具足」を同じ虫につけますか？','百足の具足');
        if(use){const extra=await chooseOwnedInstance(side,'つける百足の具足を選んでください。',choices);if(extra){removeInstance(sideObj(side).discard,extra);fc.attachments.push(extra);await configureAttachedCard(side,fc,extra,{entered:true});}}
      }
    }
    if(entered&&(e==='electricKanabo'||e==='blastClub')){
      const amount=e==='electricKanabo'?1000:600,targets=fieldActive(other(side));
      if(targets.length){
        let use=true;if(side==='player')use=await confirmYesNo(`「${def(att).name}」で相手の虫に${amount}ダメージを与えますか？`,def(att).name);
        if(use){
          const target=side==='player'?await chooseField(`${amount}ダメージを与える虫を選んでください。`,targets,true):chooseBurnTargetCPU(targets);
          if(target){const dmg=await dealDamage(other(side),target,amount,{source:att,sourceSide:side,kind:'effect'});log(`「${def(att).name}」で「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(other(side),target,'effect',null);}
        }
      }
    }
    const hostPassive=passiveOfField(fc);
    if(hostPassive?.type==='devilEnhance'){
      const targets=fieldActive(other(side)),amount=Number(hostPassive.value||0);
      if(targets.length){
        let use=true;if(side==='player')use=await confirmYesNo(`＜${amount===300?'デビルフェイス':'デビルストライプ'}＞で相手の虫に${amount}ダメージを与えますか？`,'強化装着');
        if(use){const target=side==='player'?await chooseField(`${amount}ダメージを与える虫を選んでください。`,targets,true):chooseBurnTargetCPU(targets);if(target){const dmg=await dealDamage(other(side),target,amount,{source:fc,sourceSide:side,kind:'effect'});log(`強化装着効果で「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(other(side),target,'effect',null);}}
      }
    }
    if(e==='warriorSeal')enforceAllAttachmentLegality();
    else enforceAttachmentLegality(fc,side);
  }

  async function handleInsectEntered(side,fc){
    const p=passiveOfField(fc);
    if(!p)return;
    if(dangerSenseActive()&&String(p.text||'').includes('場に出たとき')&&p.type!=='dangerSense'){
      log(`＜危険察知＞により「${fieldDef(fc).name}」の場に出たときの効果は使えない。`);
      return;
    }

    if(p.type==='shiningThread'){
      if(!fc.paidOwnCost)return;
      const choices=visibleDiscard(side).filter(x=>def(x).type==='enhance'&&def(x).name.includes('糸'));
      if(!choices.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜かがやく糸＞で捨て札の「糸」を含む強化カードを手札に戻しますか？','かがやく糸');
      if(use){const chosen=await chooseOwnedInstance(side,'手札に戻す強化カードを選んでください。',choices);if(chosen){removeInstance(sideObj(side).discard,chosen);sendToOwnerHand(chosen,side);log(`＜かがやく糸＞ 「${def(chosen).name}」を手札に戻した。`);}}
      return;
    }

    if(p.type==='blastCharge'){
      if(!visibleDiscard(side).some(x=>def(x).name.includes('爆熱')))return;
      const targets=fieldActive(other(side));if(!targets.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜爆熱充填＞で相手の虫に600ダメージを与えますか？','爆熱充填');if(!use)return;
      const target=side==='player'?await chooseField('600ダメージを与える虫を選んでください。',targets,true):chooseBurnTargetCPU(targets);
      if(target){const dmg=await dealDamage(other(side),target,600,{source:fc,sourceSide:side,kind:'effect'});log(`＜爆熱充填＞ 「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(other(side),target,'effect',null);}
      return;
    }

    if(p.type==='poisonMistSpread'){
      const targets=[...fieldActive(other(side))];if(!targets.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜毒霧拡散＞で相手のすべての虫に200ダメージを与えますか？','毒霧拡散');if(!use)return;
      for(const target of targets){
        if(!sideObj(other(side)).field.includes(target))continue;
        const dmg=await dealDamage(other(side),target,200,{source:fc,sourceSide:side,kind:'effect'});
        log(`＜毒霧拡散＞ 「${fieldDef(target).name}」に${dmg}ダメージ。`);
      }
      for(const target of targets)if(sideObj(other(side)).field.includes(target)&&target.damage>=maxHp(target))await attemptDestroyFieldCard(other(side),target,'effect',null);
      return;
    }

    if(p.type==='bugHunter'){
      if(!fc.paidOwnCost)return;
      const targets=fieldActive(other(side)).filter(x=>Number(fieldDef(x).cost||0)<=2);if(!targets.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜バグハンター＞で相手のコスト2以下の虫を破壊しますか？','バグハンター');if(!use)return;
      const target=side==='player'?await chooseField('破壊する虫を選んでください。',targets,true):targets[0];if(target)await attemptDestroyFieldCard(other(side),target,'effect',fc);
      return;
    }

    if(p.type==='phalanx'){
      if(!fc.paidOwnCost)return;
      const maxCost=Number(fieldDef(fc).cost||0);
      const choices=sideObj(side).hand.filter(x=>def(x).type==='insect'&&def(x).passive?.type==='phalanx'&&Number(def(x).cost||0)<=maxCost);
      if(!choices.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜ファランクス＞で手札の＜ファランクス＞を持つ虫を場に出しますか？','ファランクス');if(!use)return;
      const chosen=await chooseOwnedInstance(side,'場に出す虫を選んでください。',choices);if(chosen){removeInstance(sideObj(side).hand,chosen);await putInsectOnField(side,chosen);log(`＜ファランクス＞ 「${def(chosen).name}」を場に出した。`);}
      return;
    }

    if(p.type==='reincarnationBoost'&&fc.summonedByEclosion){
      const value=Number(p.value||400);Engine.addModifier(fc,{stat:'attack',value});Engine.addModifier(fc,{stat:'hp',value});
      log(`＜転生強化＞ 「${fieldDef(fc).name}」の体力と攻撃力+${value}。`);
      return;
    }

    if(p.type==='snakeEye'){
      if(!fc.paidOwnCost)return;
      const choices=sideObj(other(side)).bait.filter(x=>isFaceUpBait(x)&&['red','blue','green'].includes(baitCardColor(x)));if(!choices.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜蛇の目＞で相手の色付きエサ1枚を裏向きにしますか？','蛇の目');if(!use)return;
      let chosen=null;
      if(side==='cpu'){
        const snakeEyeColorCounts=new Map(['red','blue','green'].map(col=>[col,choices.filter(x=>baitCardColor(x)===col).length]));
        chosen=[...choices].sort((a,b)=>(snakeEyeColorCounts.get(baitCardColor(a))||99)-(snakeEyeColorCounts.get(baitCardColor(b))||99))[0]||null;
      }else chosen=await chooseOwnedInstance(side,'裏向きにする相手のエサを選んでください。',choices);
      if(chosen){chosen.faceDown=true;log(`＜蛇の目＞ 「${def(chosen).name}」を裏向きにした。`);}
      return;
    }

    if(p.type==='adultCalling'){
      if(!fc.paidOwnCost)return;
      const adult=baseAdultName(fieldDef(fc).name),choices=sideObj(side).hand.filter(x=>def(x).type==='insect'&&def(x).name===adult);
      if(!choices.length)return;
      let use=side==='cpu'?true:await confirmYesNo(`＜成虫招き＞で手札の「${adult}」を場に出しますか？`,'成虫招き');if(!use)return;
      const chosen=await chooseOwnedInstance(side,'場に出す成虫を選んでください。',choices);if(chosen){removeInstance(sideObj(side).hand,chosen);await putInsectOnField(side,chosen);log(`＜成虫招き＞ 「${adult}」を場に出した。`);}
      return;
    }

    if(p.type==='plainPattern'){
      const available=sideObj(side).bait.filter(isFaceUpBait);if(!available.length)return;
      let flipped=0;
      while(flipped<2){
        const choices=sideObj(side).bait.filter(isFaceUpBait);if(!choices.length)break;
        let use=side==='cpu'?true:await confirmYesNo('＜無紋＞で表向きのエサを裏向きにしますか？','無紋');if(!use)break;
        const chosen=await chooseOwnedInstance(side,'裏向きにするエサを選んでください。',choices);if(!chosen)break;chosen.faceDown=true;flipped++;
      }
      if(flipped){Engine.addModifier(fc,{stat:'attack',value:100});Engine.addModifier(fc,{stat:'hp',value:100});log(`＜無紋＞ エサを${flipped}枚裏向きにし、体力と攻撃力+100。`);}
      return;
    }

    if(p.type==='saltDragonfly'){
      const choices=fieldActive(side).filter(x=>x!==fc&&/(トンボ|ヤンマ)/.test(fieldDef(x).name));if(!choices.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜塩辛＞でほかのトンボ/ヤンマの攻撃力を+300しますか？','塩辛');if(!use)return;
      const target=await chooseOwnedField(side,'攻撃力を上げる虫を選んでください。',choices);if(target){target.turnAttackBonus=(target.turnAttackBonus||0)+300;log(`＜塩辛＞ 「${fieldDef(target).name}」の攻撃力+300。`);}
      return;
    }

    if(p.type==='sparkle'){
      for(const col of ['red','blue','green','colorless']){
        const choices=sideObj(side).bait.filter(x=>x.faceDown&&def(x).type==='insect'&&def(x).color===col);
        if(!choices.length)continue;
        let use=side==='cpu'?true:await confirmYesNo(`＜きらめき＞で${colorJa[col]}の裏向きの虫エサを表向きにしますか？`,'きらめき');if(!use)continue;
        const chosen=await chooseOwnedInstance(side,'表向きにする虫のエサを選んでください。',choices);if(chosen){chosen.faceDown=false;log(`＜きらめき＞ 「${def(chosen).name}」を表向きにした。`);}
      }
      return;
    }

    if(p.type==='shineEntry'){
      const choices=sideObj(side).bait.filter(x=>x.faceDown);if(!choices.length)return;
      let use=side==='cpu'?true:await confirmYesNo('＜光る＞で裏向きのエサ1枚を表向きにしますか？','光る');if(!use)return;
      const chosen=await chooseOwnedInstance(side,'表向きにするエサを選んでください。',choices);if(chosen){chosen.faceDown=false;log(`＜光る＞ 「${def(chosen).name}」を表向きにした。`);}
      return;
    }

    if(p.type==='honey'){
      const hand=sideObj(side).hand;
      if(!hand.length)return;
      let use=true;
      if(side==='player')use=await confirmYesNo('＜蜜をためる＞を使って、手札1枚をエサにしますか？','蜜をためる');
      else if(currentCpuDifficulty()!=='normal')use=cpuShouldSpendCardAsExtraBait(hand);
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

    if(p.type==='whiteShell'){
      fc.whiteShellTurn=nextOpponentTurnSeq(side);
      return;
    }

    if(p.type==='baitColor'){
      const available=sideObj(side).bait.filter(isFaceUpBait);
      if(!available.length)return;
      let col=null;
      if(side==='player'){
        col=await choose([
          {value:'red',title:'赤',detail:'表向きのエサを赤として扱う'},
          {value:'blue',title:'青',detail:'表向きのエサを青として扱う'},
          {value:'green',title:'緑',detail:'表向きのエサを緑として扱う'},
          {value:null,title:'変えない',detail:''}
        ],'＜七色反射＞ エサの色を選びますか？','七色反射');
      }else col='blue';
      if(col){
        for(const bait of available){bait.baitColor=col;bait.baitColorTurn=state.turnSeq;}
        log(`＜七色反射＞ ${sideName(side)}の表向きのエサをこのターン${colorJa[col]}として扱う。`);
      }
      return;
    }

    if(p.type==='entryMist'){
      const targets=fieldActive(other(side));
      if(!targets.length)return;
      let use=true;
      if(side==='player')use=await confirmYesNo(`＜毒霧散布＞で相手の虫に${Number(p.value||0)}ダメージを与えますか？`,'毒霧散布');
      if(!use)return;
      const target=side==='player'
        ? await chooseField('毒霧散布の対象を選んでください。',targets,true)
        : chooseBurnTargetCPU(targets);
      if(!target)return;
      const amount=Number(p.value||0);
      const actual=await dealDamage(other(side),target,amount,{source:fc,sourceSide:side,kind:'effect'});
      log(`＜毒霧散布＞ 「${fieldDef(target).name}」に${actual}ダメージ。`);
      if(target.damage>=maxHp(target))await attemptDestroyFieldCard(other(side),target,'effect',null);
      return;
    }

    if(p.type==='mandatoryBaitSacrifice'){
      const available=sideObj(side).bait.filter(isFaceUpBait);
      if(!available.length){
        log(`＜狂暴化＞ エサを破壊できないため「${fieldDef(fc).name}」を破壊した。`);
        await attemptDestroyFieldCard(side,fc,'effect',null);
        return;
      }
      const chosen=await chooseOwnedInstance(side,'＜狂暴化＞で破壊するエサを選んでください。',available);
      if(!chosen){
        await attemptDestroyFieldCard(side,fc,'effect',null);return;
      }
      removeInstance(sideObj(side).bait,chosen);sendToOwnerDiscard(chosen,side);
      log(`＜狂暴化＞ 「${def(chosen).name}」をエサ場から破壊した。`);
      return;
    }

    if(p.type==='offering'){
      const bugs=sideObj(side).hand.filter(x=>def(x).type==='insect');
      if(!bugs.length){
        log(`＜供物＞ 捨てられる虫がないため「${fieldDef(fc).name}」を破壊した。`);
        await attemptDestroyFieldCard(side,fc,'effect',null);return;
      }
      const chosen=await chooseOwnedInstance(side,'＜供物＞で捨てる手札の虫を選んでください。',bugs);
      if(!chosen){await attemptDestroyFieldCard(side,fc,'effect',null);return;}
      removeInstance(sideObj(side).hand,chosen);sideObj(side).discard.push(chosen);
      log(`＜供物＞ 「${def(chosen).name}」を手札から捨てた。`);
      return;
    }

    if(p.type==='blueHead'){
      let use=true;
      if(side==='player')use=await confirmYesNo('＜青頭＞でこのターン青にしますか？','青頭');
      if(use){fc.turnColorOverride='blue';fc.turnColorOverrideTurn=state.turnSeq;log(`＜青頭＞ 「${fieldDef(fc).name}」はこのターン青になった。`);}
      return;
    }

    if(p.type==='reinforcedCarapace'){
      if(!fc.paidOwnCost)return;
      const choices=visibleDiscard(side).filter(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=3&&canAttachEnhancement(fc,x));
      if(!choices.length)return;
      let use=true;if(side==='player')use=await confirmYesNo('＜強化甲殻＞で捨て札の強化カードをつけますか？','強化甲殻');
      if(!use)return;
      const chosen=await chooseOwnedInstance(side,'つける強化カードを選んでください。',choices);if(!chosen)return;
      removeInstance(sideObj(side).discard,chosen);fc.attachments.push(chosen);
      if(def(chosen).effect==='suppressPassive')enforceAttachmentLegality(fc,side);
      log(`＜強化甲殻＞ 「${def(chosen).name}」を「${fieldDef(fc).name}」につけた。`);
      return;
    }

    if(p.type==='fluffy'){
      const col=side==='player'
        ? await chooseSimple('＜モフモフ＞ 裏返す虫の色を選んでください。',[['red','赤'],['blue','青'],['green','緑'],['colorless','無色']])
        : 'blue';
      if(col){
        let n=0;
        for(const owner of ['player','cpu'])for(const bait of sideObj(owner).bait){
          if(isFaceUpBait(bait)&&def(bait).type==='insect'&&baitCardColor(bait)===col){bait.faceDown=true;n++;}
        }
        log(`＜モフモフ＞ ${colorJa[col]}のエサの虫を${n}枚裏向きにした。`);
      }
      return;
    }

    if(p.type==='locustHarvest'){
      const choices=visibleDiscard(side).filter(x=>def(x).type==='enhance'&&Number(def(x).cost||0)===0);
      if(!choices.length)return;
      let use=true;if(side==='player')use=await confirmYesNo('＜イナゴの収穫＞でコスト0の強化カードを手札に戻しますか？','イナゴの収穫');
      if(!use)return;
      const chosen=await chooseOwnedInstance(side,'手札に戻す強化カードを選んでください。',choices);if(!chosen)return;
      removeInstance(sideObj(side).discard,chosen);sideObj(side).hand.push(chosen);
      log(`＜イナゴの収穫＞ 「${def(chosen).name}」を手札に戻した。`);
      return;
    }

    if(p.type==='megaArmor'){
      fc.megaArmorTurn=state.turnSeq+1;
      return;
    }

    if(p.type==='legendaryEclosion'&&fc.summonedByEclosion){
      Engine.addModifier(fc,{stat:'attack',value:500});
      Engine.addModifier(fc,{stat:'hp',value:500});
      log(`＜伝承羽化＞ 「${fieldDef(fc).name}」の攻撃力と体力が+500。`);
      return;
    }

    if(p.type==='warFanEntry'){
      if(!fc.paidOwnCost)return;
      const choices=sideObj(side).hand.filter(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=4&&!['summonWithAttachment','silverThread','blackSilverThread'].includes(def(x).effect)&&(def(x).effect!=='imitation'||allOwnEnhancements(side).length>0)&&fieldActive(side).some(t=>canAttachEnhancement(t,x)));
      if(!choices.length)return;
      let use=true;if(side==='player')use=await confirmYesNo('＜軍配団扇＞で手札の強化カードをつけますか？','軍配団扇');
      if(!use)return;
      const att=await chooseOwnedInstance(side,'つける強化カードを選んでください。',choices);if(!att)return;
      const targets=fieldActive(side).filter(t=>canAttachEnhancement(t,att));if(!targets.length)return;
      const target=await chooseOwnedField(side,'強化カードのつけ先を選んでください。',targets);if(!target)return;
      if(def(att).effect==='imitation'&&!await configureImitation(side,att,target))return;
      removeInstance(sideObj(side).hand,att);target.attachments.push(att);await configureAttachedCard(side,target,att);
      log(`＜軍配団扇＞ 「${def(att).name}」を「${fieldDef(target).name}」につけた。`);
      return;
    }

    if(p.type==='bloodTrade'){
      const opp=other(side);
      if(sideObj(opp).territory.length<2)return;
      let use=side==='player'?true:await confirmYesNo('＜血の取引＞で縄張りを2枚引きますか？ 引くと相手のアカウシアブが破壊されます。','血の取引');
      if(side==='player')use=sideObj(opp).territory.length>=2;
      if(use){
        await takeTerritory(opp,false,{effectDraw:true,forceDraw:true});
        await takeTerritory(opp,false,{effectDraw:true,forceDraw:true});
        if(sideObj(side).field.includes(fc))await attemptDestroyFieldCard(side,fc,'effect',null);
        log('＜血の取引＞ 縄張りを2枚引いたためアカウシアブを破壊した。');
      }
      return;
    }

    if(p.type==='paradiseReturn'){
      if(!fc.paidOwnCost)return;
      const choices=visibleDiscard(side).filter(x=>def(x).name==='ゴクラクトリバネアゲハ');
      if(!choices.length)return;
      let use=true;if(side==='player')use=await confirmYesNo('＜極楽還り＞で捨て札のゴクラクトリバネアゲハを場に出しますか？','極楽還り');
      if(use){
        const chosen=await chooseOwnedInstance(side,'場に出すゴクラクトリバネアゲハを選んでください。',choices);if(chosen){removeInstance(sideObj(side).discard,chosen);await putInsectOnField(side,chosen);log('＜極楽還り＞ ゴクラクトリバネアゲハを場に出した。');}
      }
      return;
    }

    if(p.type==='goldenEclosion'&&fc.summonedByTimePupa){
      const pupa=fc.attachments.find(a=>def(a).effect==='summonWithAttachment');
      if(pupa)destroyAttachment(fc,pupa,side,'effect');
      Engine.addModifier(fc,{stat:'hp',value:700});Engine.addModifier(fc,{stat:'attack',value:300});
      log(`＜黄金羽化＞ 「${fieldDef(fc).name}」の体力+700、攻撃力+300。`);
      return;
    }

    if(p.type==='springWind'){
      if(sideObj(other(side)).bait.length<sideObj(side).bait.length+2||!sideObj(side).hand.length)return;
      let use=true;if(side==='player')use=await confirmYesNo('＜春風＞で手札を2枚までエサ場に置きますか？','春風');
      if(!use)return;
      for(let n=0;n<2&&sideObj(side).hand.length;n++){
        let chosen=await chooseOwnedInstance(side,'エサ場に置く手札を選んでください。',sideObj(side).hand);if(!chosen)break;
        removeInstance(sideObj(side).hand,chosen);chosen.faceDown=false;sideObj(side).bait.push(chosen);log(`＜春風＞ 「${def(chosen).name}」を表向きのエサにした。`);
        if(side==='player'&&n===0&&sideObj(side).hand.length&&!(await confirmYesNo('もう1枚エサ場に置きますか？','春風')))break;
      }
      return;
    }

    if(p.type==='colorChangeRG'){
      let col=null;
      if(side==='player')col=await choose([{value:'red',title:'赤',detail:'ターン終了まで赤'},{value:'green',title:'緑',detail:'ターン終了まで緑'},{value:null,title:'変えない',detail:'青のまま'}],'＜色彩変化＞ 色を選んでください。','色彩変化');
      else col='green';
      if(col){fc.turnColorOverride=col;fc.turnColorOverrideTurn=state.turnSeq;log(`＜色彩変化＞ 「${fieldDef(fc).name}」を${colorJa[col]}にした。`);}
      return;
    }

    if(p.type==='greenFerocity'){
      for(const target of fieldActive(side))if(effectiveColor(target)==='green')target.turnAttackBonus=(target.turnAttackBonus||0)+200;
      log('＜獰猛化緑＞ 現在場にいる緑の虫の攻撃力をこのターン+200。');
      return;
    }

    if(p.type==='dungEating'){
      const choices=visibleDiscard(other(side)).filter(x=>def(x).type==='insect');
      if(!choices.length)return;
      let use=true;if(side==='player')use=await confirmYesNo('＜糞食＞で相手の捨て札の虫を山札の一番下へ戻しますか？','糞食');
      if(use){
        const chosen=await chooseOwnedInstance(side,'山札の一番下へ戻す虫を選んでください。',choices);if(chosen){removeInstance(sideObj(other(side)).discard,chosen);chosen.faceDown=true;sideObj(other(side)).deck.push(chosen);log(`＜糞食＞ 「${def(chosen).name}」を相手の山札の一番下へ戻した。`);}
      }
      return;
    }

    if(p.type==='cicadaEmperor'){
      const choices=visibleDiscard(side).filter(isCicadaCard);
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
    inst.baitColor=null;inst.baitColorTurn=0;
    const fc=newFieldCard(inst);
    fc.enteredTurnSeq=state.turnSeq;
    fc.paidOwnCost=!!options.paidOwnCost;
    fc.summonedByEclosion=!!options.summonedByEclosion;
    fc.summonedByTimePupa=!!options.summonedByTimePupa;
    fc.abyssRevived=!!options.abyssRevived;
    fc.underworldFaceDownTurn=options.underworldFaceDownTurn||0;
    inst.discardFaceDown=false;
    if(rawFieldPassive(fc)?.type==='dive')fc.diveTurn=nextOpponentTurnSeq(side);
    if(['mimic','thornMimic'].includes(passiveOfField(fc)?.type))fc.mimicTurn=nextOpponentTurnSeq(side);
    if(options.temporary)fc.temporaryDestroyTurn=state.turnSeq;
    if(options.noAttackThisTurn)fc.cannotAttackTurn=state.turnSeq;
    if(options.puppet)fc.puppetDestroyTurn=state.turnSeq;
    if(options.attachments)fc.attachments.push(...options.attachments);
    fc.baseKeywordSuppression=!!options.suppressKeywords;
    if(options.suppressKeywords){Engine.setCardOverrides(fc,{passive:null});fc.suppressKeywords=true;}
    if(options.silverThreadLink)fc.silverThreadLink=options.silverThreadLink;
    if(options.summonedBySpell){
      const lock=['player','cpu'].some(owner=>fieldActive(owner).some(x=>passiveOfField(x)?.type==='spellSummonLock'||hasAttachment(x,'spellSummonLockAttachment')));
      if(lock)fc.cannotAttackTurn=state.turnSeq;
    }
    sideObj(side).field.push(fc);
    events.emit(EVENT.INSECT_ENTERED,{state,side,fieldCard:fc,card:inst});

    // ＜危険察知＞がある間は＜にげる＞の「場に出たとき」効果も発動しない。
    if(!dangerSenseActive()){
      for(const runner of [...fieldActive(side)]){
        if(runner===fc||passiveOfField(runner)?.type!=='escape')continue;
        log(`＜にげる＞ 「${fieldDef(runner).name}」を破壊した。`);
        await attemptDestroyFieldCard(side,runner,'effect',null);
      }
    }

    await handleInsectEntered(side,fc);
    enforceAttachmentLegality(fc,side);
    if(maxHp(fc)<=fc.damage&&sideObj(side).field.includes(fc))await attemptDestroyFieldCard(side,fc,'effect',null);
    return fc;
  }
  function consumeArmorSynchronously(side,fc){
    const armorIndex=fc.attachments.findIndex(a=>def(a).effect==='substituteArmor');
    if(armorIndex<0)return false;
    const [armor]=fc.attachments.splice(armorIndex,1);sendToOwnerDiscard(armor,side);
    fc.damage=fc.persistentDamage||0;
    log(`「空蝉の皮鎧」が「${fieldDef(fc).name}」の破壊を防いだ！`);
    return fc.damage<maxHp(fc);
  }
  function resolveSilverThreadDestroyed(threadUid){
    if(!threadUid)return;
    const linked=[];
    for(const side of ['player','cpu']){
      for(const fc of [...sideObj(side).field])if(fc.silverThreadLink===threadUid)linked.push({side,fc});
    }
    for(const {side,fc} of linked){
      if(!sideObj(side).field.includes(fc))continue;
      if(consumeArmorSynchronously(side,fc))continue;
      destroyFieldCard(side,fc,'effect',null,{skipThreadUid:threadUid});
      log(`「白銀蜘蛛の糸」の効果で「${fieldDef(fc).name}」を破壊した。`);
    }
  }
  function discardAttachmentsToOwners(fc,controllerSide,reason='effect',options={}){
    const threadUids=[];
    fc.destroyedAttachmentEffects=[...fc.attachments].map(a=>def(a).effect);
    fc.destroyedAttachmentCards=[...fc.attachments];
    for(const a of [...fc.attachments]){
      revealHairpinTarget(a);
      if(['secretBook','spear400','spear800','larvaPot','stickChange'].includes(def(a).effect)&&reason==='attack')sendToOwnerHand(a,controllerSide);
      else sendToOwnerDiscard(a,controllerSide);
      if(def(a).effect==='silverThread'&&a.uid!==options.skipThreadUid)threadUids.push(a.uid);
      if(['attack','effect','sacrifice'].includes(reason))destroyImitationsOf(a.uid);
    }
    fc.attachments=[];
    if(reason==='attack'&&threadUids.length)fc.pendingSilverThreadUids=[...(fc.pendingSilverThreadUids||[]),...threadUids];
    else for(const uid of threadUids)resolveSilverThreadDestroyed(uid);
  }
  function refreshCordycepsSuppression(fc){
    if(!fc)return;
    fc.cordycepsSuppressed=hasAttachment(fc,'puppetCordyceps');
    fc.suppressKeywords=!!(fc.baseKeywordSuppression||fc.cordycepsSuppressed);
    applyShadowMirrorOverride(fc);
  }
  function revealHairpinTarget(att){
    if(!att?.hairpinTargetUid)return;
    for(const side of ['player','cpu']){
      const target=sideObj(side).field.find(fc=>fc.inst.uid===att.hairpinTargetUid);
      if(target&&target.hidden&&target.hairpinSourceUid===att.uid){target.hidden=false;target.hairpinSourceUid=null;target.hiddenUntilTurnSeq=0;log(`「鬼蜻蜓の簪」が場を離れたため「${fieldDef(target).name}」を表向きにした。`);}
    }
    att.hairpinTargetUid=null;
  }
  function applyShadowMirrorOverride(fc){
    const mirrors=fc.attachments.filter(a=>def(a).effect==='shadowDoubleMirror'&&a.shadowCopy);
    const last=mirrors[mirrors.length-1];
    Engine.clearCardOverrides(fc);
    fc.suppressKeywords=!!(fc.baseKeywordSuppression||fc.cordycepsSuppressed);
    if(!last){
      if(fc.cordycepsSuppressed){
        const base=def(fc.inst);
        Engine.setCardOverrides(fc,{attacks:(base.attacks||[]).map(a=>({...a,effect:null,text:''})),passive:null});
        fc.suppressKeywords=true;
      }
      return;
    }
    const c=last.shadowCopy;
    const attacks=fc.cordycepsSuppressed?(c.attacks||[]).map(a=>({...a,effect:null,text:''})):(c.attacks||[]);
    Engine.setCardOverrides(fc,{name:c.name,color:c.color,hp:c.hp,attacks,passive:fc.cordycepsSuppressed?null:c.passive});
  }
  function resolveShadowMirrorSourceLeft(sourceUid){
    for(const side of ['player','cpu'])for(const fc of [...sideObj(side).field]){
      for(const att of [...fc.attachments]){
        if(def(att).effect==='shadowDoubleMirror'&&att.shadowSourceUid===sourceUid){
          destroyAttachment(fc,att,side,'effect');
          log(`影武者の参照元が場を離れたため「${def(att).name}」を破壊した。`);
        }
      }
    }
  }
  function revealSpiritAwayBySource(sourceUid){
    for(const side of ['player','cpu'])for(const fc of sideObj(side).field){
      if(fc.spiritAwaySourceUid===sourceUid&&fc.hidden){fc.hidden=false;fc.hiddenUntilTurnSeq=0;fc.spiritAwaySourceUid=null;log(`「神隠し」の使用虫が場を離れたため「${fieldDef(fc).name}」を表向きにした。`);}
    }
  }
  function spellModifierValue(target,value){
    const p=passiveOfField(target);
    if(p?.type==='firstSpellModifierDouble'&&!target.firstSpellModifierUsed&&Number(value)!==0){
      target.firstSpellModifierUsed=true;return Number(value)*2;
    }
    return Number(value);
  }
  function consumeStinkShieldArmor(targetSide,target){
    const sourceSide=state?.resolvingSpellSide;
    if(!sourceSide||sourceSide===targetSide||state.resolvingSpellUntargeted)return false;
    if(!armorNamedAttachment(target))return false;
    const shield=faceUpBait(targetSide).find(x=>def(x).effect==='stinkShieldArmor');
    if(!shield)return false;
    shield.faceDown=true;log(`「亀虫の盾甲冑」を裏向きにし、「${fieldDef(target).name}」はこの術カードの効果を受けない。`);return true;
  }

  function destroyImitationsOf(sourceUid){
    for(const side of ['player','cpu']){
      for(const fc of [...sideObj(side).field]){
        for(const copy of [...fc.attachments]){
          if(def(copy).effect==='imitation'&&copy.copySourceUid===sourceUid){
            destroyAttachment(fc,copy,side,'effect');
            log(`元の強化カードが破壊されたため「蠱術の贋作」も破壊した。`);
          }
        }
      }
    }
  }
  function destroyAttachment(source,att,controllerSide,reason='effect'){
    if(!source||!att)return false;
    if(!removeInstance(source.attachments,att))return false;
    revealHairpinTarget(att);
    sendToOwnerDiscard(att,controllerSide);
    if(def(att).effect==='puppetCordyceps'&&sideObj(controllerSide).field.includes(source)){
      log(`「傀儡の冬虫夏草」が破壊されたため「${fieldDef(source).name}」を破壊する。`);
      if(!consumeArmorSynchronously(controllerSide,source))destroyFieldCard(controllerSide,source,'effect',null);
    }
    if(def(att).effect==='silverThread')resolveSilverThreadDestroyed(att.uid);
    destroyImitationsOf(att.uid);
    if(def(att).effect==='shadowDoubleMirror')applyShadowMirrorOverride(source);
    enforceAttachmentLegality(source,controllerSide);
    return true;
  }
  function leaveFieldToHand(side,fc){
    const ss=sideObj(side);if(!ss.field.includes(fc))return false;
    const hadWarriorSeal=hasAttachment(fc,'warriorSeal');
    ss.field=ss.field.filter(x=>x!==fc);
    discardAttachmentsToOwners(fc,side,'return');
    sendToOwnerHand(fc.inst,side);
    events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:fc,reason:'return'});
    resolveShadowMirrorSourceLeft(fc.inst.uid);revealSpiritAwayBySource(fc.inst.uid);
    log(`「${fieldDef(fc).name}」が持ち主の手札に戻った。`);
    if(rawFieldPassive(fc)?.type==='silenceAll'||hadWarriorSeal)enforceAllAttachmentLegality();
    return true;
  }
  function leaveFieldToDiscard(side,fc,reason='effect'){return destroyFieldCard(side,fc,reason,null);}
  function armorNamedAttachment(fc){return fc.attachments.some(a=>/甲冑/.test(def(a).name));}
  function flowerArmorAura(side,fc){
    return armorNamedAttachment(fc)&&faceUpBait(side).some(x=>def(x).effect==='flowerArmor1000');
  }
  function diveProtection(side,fc){
    return passiveOfField(fc)?.type==='dive'&&fc.diveTurn===state.turnSeq&&faceUpColorCount(side,'blue')>=2;
  }
  function spellDamageDestroyImmune(side,fc){
    if(hasAttachment(fc,'lifeFlame'))return true;
    if(flowerArmorAura(side,fc))return true;
    if(diveProtection(side,fc))return true;
    if(passiveOfField(fc)?.type==='megaArmor'&&fc.megaArmorTurn===state.turnSeq)return true;
    return false;
  }
  async function resolveStateBasedDestructions(reason='effect'){
    let changed=true,guard=0;
    while(changed&&guard++<20){
      changed=false;
      for(const side of ['player','cpu']){
        for(const fc of [...fieldActive(side)]){
          if(sideObj(side).field.includes(fc)&&fc.damage>=maxHp(fc)){
            const destroyed=await attemptDestroyFieldCard(side,fc,reason,null);
            if(destroyed)changed=true;
          }
        }
      }
    }
  }
  function canSpiritBody(side,fc){
    return passiveOfField(fc)?.type==='spiritBody'&&sideObj(side).territory.length>=2&&!fieldActive(side).some(x=>hasAttachment(x,'noTerritory'));
  }
  async function resolveSpiritBody(side,fc,attacker){
    if(!canSpiritBody(side,fc))return 'declined';
    let use=true;
    const hasArmor=fc.attachments.some(a=>def(a).effect==='substituteArmor');
    if(side==='player'){
      if(hasArmor){
        const mode=await choose([
          {value:'spirit',title:'＜霊体＞',detail:'縄張りを2枚引き、破壊を防ぐ'},
          {value:'armor',title:'空蝉の皮鎧',detail:'甲冑を破壊して防ぐ'},
          {value:'none',title:'防がない',detail:'そのまま破壊される'}
        ],'破壊を防ぐ効果を選んでください。','破壊置換');
        if(mode==='armor'){consumeArmorSynchronously(side,fc);return 'prevented';}
        if(mode==='none'||mode===null)return 'skipArmor';
        use=mode==='spirit';
      }else use=await confirmYesNo('＜霊体＞で縄張りを2枚引き、破壊を防ぎますか？','霊体');
    }else{
      if(hasArmor){consumeArmorSynchronously(side,fc);return 'prevented';}
      use=sideObj(side).territory.length>=3;
    }
    if(!use)return 'declined';
    await takeTerritory(side,false,{effectDraw:true,forceDraw:true,spiritDraw:true});
    await takeTerritory(side,false,{effectDraw:true,forceDraw:true,spiritDraw:true});
    if(!sideObj(side).field.includes(fc))return 'destroyed';
    fc.damage=fc.persistentDamage||0;
    log(`＜霊体＞ 「${fieldDef(fc).name}」は破壊されず、回復できるダメージを回復した。`);
    if(fc.damage>=maxHp(fc)){
      const destroyed=await attemptDestroyFieldCard(side,fc,'attack',attacker);
      return destroyed?'destroyed':'prevented';
    }
    return 'prevented';
  }

  async function resolveDestroyedAttachmentAftermath(controllerSide,fc,reason){
    for(const att of fc.destroyedAttachmentCards||[]){
      const e=def(att).effect,owner=ownerSideOf(att,controllerSide),pile=sideObj(owner).discard;
      if(e==='jewelCrown'&&pile.some(x=>x.uid===att.uid)){
        let use=owner==='cpu'?true:await confirmYesNo('「宝石虫の冠」をエサ場に置きますか？','宝石虫の冠');
        if(use){removeInstance(pile,att);att.faceDown=false;sideObj(owner).bait.push(att);log('「宝石虫の冠」をエサ場に置いた。');}
      }
      if(e==='goldenSixCoins'&&reason==='attack'&&pile.some(x=>x.uid===att.uid)){
        let use=owner==='cpu'?true:await confirmYesNo('「黄金虫の六文銭」を山札の一番下に置いて1枚引きますか？','黄金虫の六文銭');
        if(use){removeInstance(pile,att);att.faceDown=true;sideObj(owner).deck.push(att);if(sideObj(owner).deck.length){const drawn=sideObj(owner).deck.shift();sendToOwnerHand(drawn,owner);log('「黄金虫の六文銭」を山札の一番下に置き、1枚引いた。');}}
      }
      if((e==='victoryBlade'||e==='auspiciousBlade')&&pile.some(x=>x.uid===att.uid)&&faceUpBait(owner).length){
        let use=owner==='cpu'?true:await confirmYesNo(`「${def(att).name}」を手札に戻すため、表向きのエサ1枚を裏向きにしますか？`,def(att).name);
        if(use){
          const bait=await chooseOwnedInstance(owner,'裏向きにするエサを選んでください。',faceUpBait(owner));
          if(bait){bait.faceDown=true;removeInstance(pile,att);sideObj(owner).hand.push(att);log(`「${def(att).name}」を手札に戻した。`);}
        }
      }
    }
    fc.destroyedAttachmentCards=[];
  }

  async function resolveReincarnationEclose(side,printedName){
    const adultName=baseAdultName(printedName),choices=sideObj(side).hand.filter(x=>def(x).type==='insect'&&def(x).name===adultName);
    if(!choices.length)return false;
    let use=side==='cpu'?true:await confirmYesNo(`＜転生羽化＞で手札の「${adultName}」を場に出しますか？`,'転生羽化');if(!use)return false;
    const chosen=await chooseOwnedInstance(side,'場に出す成虫を選んでください。',choices);if(!chosen)return false;
    removeInstance(sideObj(side).hand,chosen);await putInsectOnField(side,chosen,{summonedByEclosion:true});
    log(`＜転生羽化＞ 「${adultName}」を場に出した。`);return true;
  }

  async function attemptDestroyFieldCard(side,fc,reason,attacker){
    const ss=sideObj(side);if(!ss.field.includes(fc))return false;
    const beforePassive=passiveOfField(fc),printedName=def(fc.inst).name;
    const pendingSource=fc.pendingDamageSourceSide;fc.pendingDamageSourceSide=null;
    const attackerSide=attacker?findFieldSide(attacker):null;
    const causedByOpponent=(attackerSide&&attackerSide!==side)||(pendingSource&&pendingSource!==side)||(state.resolvingSpellSide&&state.resolvingSpellSide!==side);
    if(reason==='effect'&&state.resolvingSpellSide&&state.resolvingSpellSide!==side&&consumeStinkShieldArmor(side,fc))return false;
    if(reason==='effect'&&state.resolvingSpellSide&&state.resolvingSpellSide!==side&&spellDamageDestroyImmune(side,fc)){
      log(`「${fieldDef(fc).name}」は相手の術カードによる破壊を受けない。`);
      return false;
    }
    let skipArmor=false;
    if(reason==='attack'&&canSpiritBody(side,fc)){
      const outcome=await resolveSpiritBody(side,fc,attacker);
      if(outcome==='prevented')return false;
      if(outcome==='destroyed')return true;
      if(outcome==='skipArmor')skipArmor=true;
    }
    if(!skipArmor&&consumeArmorSynchronously(side,fc))return false;
    if(!ss.field.includes(fc))return true;
    destroyFieldCard(side,fc,reason,attacker);
    await resolveDestroyedAttachmentAftermath(side,fc,reason);
    if(beforePassive?.type==='reincarnationEclose'&&causedByOpponent)await resolveReincarnationEclose(side,printedName);
    return true;
  }
  function destroyFieldCard(side,fc,reason,attacker,options={}){
    const ss=sideObj(side);if(!ss.field.includes(fc))return false;
    const owner=ownerSideOf(fc.inst,side);
    const beforePassive=passiveOfField(fc);
    const hadEnhancement=fc.attachments.length>0;
    const hadWarriorSeal=hasAttachment(fc,'warriorSeal');
    fc.preDestroyEnhanceUids=visibleDiscard(owner).filter(x=>def(x).type==='enhance').map(x=>x.uid);
    ss.field=ss.field.filter(x=>x!==fc);
    sendToOwnerDiscard(fc.inst,side);
    if(fc.abyssRevived)fc.inst.discardFaceDown=true;
    discardAttachmentsToOwners(fc,side,reason,{skipThreadUid:options.skipThreadUid});
    events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:fc,reason,attacker});
    resolveShadowMirrorSourceLeft(fc.inst.uid);revealSpiritAwayBySource(fc.inst.uid);
    events.emit(EVENT.INSECT_DESTROYED,{state,side,fieldCard:fc,reason,attacker});
    log(`「${fieldDef(fc).name}」が破壊された。`);
    if(reason!=='attack'&&beforePassive?.type==='dragonflyReturn'&&hadEnhancement){
      const pile=sideObj(owner).discard,card=removeInstance(pile,fc.inst);
      if(card){sideObj(owner).hand.push(card);log(`＜トンボ返り＞ 「${fieldDef(fc).name}」を手札に戻した。`);}
    }
    if(beforePassive?.type==='silenceAll'||hadWarriorSeal)enforceAllAttachmentLegality();
    return true;
  }
  async function captureDestroyedInsect(side,target){
    if(discardSummonBlocked()){log('＜地獄の番人＞により捨て札から虫を場に出せない。');return null;}
    const owner=ownerSideOf(target.inst,other(side));
    const pile=sideObj(owner).discard;
    const inst=removeInstance(pile,target.inst);
    if(!inst)return null;
    const fc=await putInsectOnField(side,inst,{puppet:true});
    log(`＜操り針＞ 「${fieldDef(fc).name}」を${sideName(side)}の場に出した。ターン終了時に破壊される。`);
    return fc;
  }
  async function discardOneHand(side,text,sourceSide=null){
    const ss=sideObj(side);if(!ss.hand.length)return false;
    const chosen=await chooseOwnedInstance(side,text,ss.hand);if(!chosen)return false;
    const p=passiveOfInst(chosen);
    const opponentEffect=sourceSide&&sourceSide!==side;
    if(opponentEffect&&p?.type==='raid'){
      let use=true;if(side==='player')use=await confirmYesNo(`＜襲来＞で「${def(chosen).name}」を捨てずに場に出しますか？`,'襲来');
      if(use){
        removeInstance(ss.hand,chosen);await putInsectOnField(side,chosen);
        log(`＜襲来＞ 「${def(chosen).name}」を場に出した。`);return true;
      }
    }
    removeInstance(ss.hand,chosen);ss.discard.push(chosen);
    log(`${sideName(side)}は「${def(chosen).name}」を手札から捨てた。`);
    if(opponentEffect&&p?.type==='poisonAntenna'){
      const targets=fieldActive(sourceSide);
      if(targets.length){
        let use=true;if(side==='player')use=await confirmYesNo('＜毒触角＞で相手の虫に400ダメージを与えますか？','毒触角');
        if(use){
          const target=side==='player'?await chooseField('400ダメージを与える虫を選んでください。',targets,true):chooseBurnTargetCPU(targets);
          if(target){const dmg=await dealDamage(sourceSide,target,400,{source:chosen,sourceSide:side,kind:'effect'});log(`＜毒触角＞ 「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(sourceSide,target,'effect',null);}
        }
      }
    }
    return true;
  }
  async function resolveAttackDestructionReaction(defenderSide,target,attacker){
    const attackerSide=other(defenderSide);
    const p=passiveOfField(target);

    const legacy=state?.jewelLegacy?.[defenderSide];
    if(legacy?.turnSeq===state.turnSeq){
      const owner=ownerSideOf(target.inst,defenderSide),pile=sideObj(owner).discard;
      if(pile.some(x=>x.uid===target.inst.uid)){
        let use=owner==='cpu'?true:await confirmYesNo(`「宝石虫の置き土産」で破壊された「${fieldDef(target).name}」をエサ場に置きますか？`,'宝石虫の置き土産');
        if(use){const card=removeInstance(pile,target.inst);card.faceDown=false;sideObj(owner).bait.push(card);log(`「宝石虫の置き土産」で「${fieldDef(target).name}」をエサ場に置いた。`);}
      }
    }

    if(attacker&&sideObj(attackerSide).field.includes(attacker)&&p?.type==='selfDestructMucus'){
      attacker.mucusCurse=true;
      log(`＜自爆粘液＞ 「${fieldDef(attacker).name}」は次にダメージを受けたとき破壊される。`);
    }
    if(attacker&&sideObj(attackerSide).field.includes(attacker)&&p?.type==='poisonBubble'){
      attacker.poisonBubbleTurn=state.turnSeq+1;
      log(`＜毒の泡＞ 「${fieldDef(attacker).name}」に毒の泡がついた。`);
    }
    if(attacker&&sideObj(attackerSide).field.includes(attacker)&&p?.type==='toxicRevenge'){
      log(`＜トウワタ毒＞ 「${fieldDef(attacker).name}」を破壊！`);
      await attemptDestroyFieldCard(attackerSide,attacker,'effect',null);
    }

    if(p?.type==='flyCatcher'&&sideObj(attackerSide).hand.length>=5){
      await discardOneHand(attackerSide,'＜蠅取り＞で捨てる手札を選んでください。',defenderSide);
    }
    if(p?.type==='demonHorn'){
      await discardOneHand(attackerSide,'＜魔王のツノ＞で捨てる手札を選んでください。',defenderSide);
    }

    if(p?.type==='ghostSend'){
      const owner=ownerSideOf(target.inst,defenderSide);
      const bugs=sideObj(owner).hand.filter(x=>def(x).type==='insect');
      if(bugs.length){
        let use=true;if(owner==='player')use=await confirmYesNo('＜亡霊送り＞で手札の虫を1枚捨て、この虫を手札に戻しますか？','亡霊送り');
        if(use){
          const chosen=await chooseOwnedInstance(owner,'捨てる虫を選んでください。',bugs);
          if(chosen){
            removeInstance(sideObj(owner).hand,chosen);sideObj(owner).discard.push(chosen);
            const returned=removeInstance(sideObj(owner).discard,target.inst);
            if(returned){sideObj(owner).hand.push(returned);log(`＜亡霊送り＞ 「${fieldDef(target).name}」を手札に戻した。`);}
            else log('＜亡霊送り＞ 手札の虫を捨てたが、破壊された虫はすでに捨て札になく戻せなかった。');
          }
        }
      }
    }

    if(p?.type==='jewelInsect'){
      const owner=ownerSideOf(target.inst,defenderSide);
      const pile=sideObj(owner).discard;
      const card=removeInstance(pile,target.inst);
      if(card){
        sendToOwnerBait(card,owner);
        log(`＜宝石昆虫＞ 「${fieldDef(target).name}」を持ち主のエサ場に置いた。`);
      }
    }
    if(p?.type==='eyePattern')await flipOpponentBait(defenderSide,Number(p.value||1),p.value===2?'巴紋':'眼状紋');
    if(p?.type==='discardEnhanceRecover'){
      const owner=ownerSideOf(target.inst,defenderSide);
      const allowed=new Set(target.preDestroyEnhanceUids||[]);
      const choices=visibleDiscard(owner).filter(x=>allowed.has(x.uid)&&def(x).type==='enhance');
      if(choices.length){
        let use=true;if(owner==='player')use=await confirmYesNo('＜尺取り＞で捨て札の強化カードを手札に戻しますか？','尺取り');
        if(use){
          const chosen=await chooseOwnedInstance(owner,'手札に戻す強化カードを選んでください。',choices);
          if(chosen){removeInstance(sideObj(owner).discard,chosen);sideObj(owner).hand.push(chosen);log(`＜尺取り＞ 「${def(chosen).name}」を手札に戻した。`);}
        }
      }
    }

    if(p?.type==='dragonflyReturn'&&(target.destroyedAttachmentEffects||[]).length>0){
      const owner=ownerSideOf(target.inst,defenderSide),pile=sideObj(owner).discard;
      const returned=removeInstance(pile,target.inst);
      if(returned){sideObj(owner).hand.push(returned);log(`＜トンボ返り＞ 「${fieldDef(target).name}」を手札に戻した。`);}
    }

    if(!attacker||!sideObj(attackerSide).field.includes(attacker)){
      for(const uid of target.pendingSilverThreadUids||[])resolveSilverThreadDestroyed(uid);
      target.pendingSilverThreadUids=[];
      return;
    }
    const poison=p?.type==='poisonMist';
    const revenge=(target.destroyedAttachmentEffects||[]).includes('revenge');
    if(!poison&&!revenge){
      for(const uid of target.pendingSilverThreadUids||[])resolveSilverThreadDestroyed(uid);
      target.pendingSilverThreadUids=[];
      return;
    }
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
    for(const uid of target.pendingSilverThreadUids||[])resolveSilverThreadDestroyed(uid);
    target.pendingSilverThreadUids=[];
  }

  async function sacrificeTwoForRiock(side){
    const candidates=fieldActive(side);
    if(candidates.length<2)return false;
    let picks;
    if(side==='player'){
      const a=await chooseField('リオックのために破壊する虫（1つ目）',candidates,true);if(!a)return false;
      const b=await chooseField('リオックのために破壊する虫（2つ目）',candidates.filter(x=>x!==a),true);if(!b)return false;
      picks=[a,b];
    }else if(currentCpuDifficulty()==='normal'){
      picks=[...candidates].sort((a,b)=>(maxHp(a)-a.damage)-(maxHp(b)-b.damage)).slice(0,2);
    }else{
      picks=[...candidates].sort((a,b)=>cpuFieldThreat(a,'cpu')-cpuFieldThreat(b,'cpu')).slice(0,2);
    }
    for(const fc of picks)await attemptDestroyFieldCard(side,fc,'sacrifice',null);
    return true;
  }
  async function chooseLarvaSacrifice(side,text){
    const larvae=fieldActive(side).filter(fc=>fieldDef(fc).name.includes('（幼虫）'));
    if(!larvae.length)return null;
    return chooseOwnedField(side,text,larvae);
  }
  async function summonWithSilverThread(side,inst,c){
    if(discardSummonBlocked()){log('＜地獄の番人＞により捨て札から虫を場に出せない。');return false;}
    const ss=sideObj(side);
    const choices=visibleDiscardFrom(ss).filter(x=>def(x).type==='insect');
    if(choices.length<2)return false;
    const first=await chooseOwnedInstance(side,'白銀蜘蛛の糸で場に出す虫（1つ目）',choices);if(!first)return false;
    const second=await chooseOwnedInstance(side,'白銀蜘蛛の糸で場に出す虫（2つ目）',choices.filter(x=>x.uid!==first.uid));if(!second)return false;
    const cost=effectiveCardCost(side,inst);
    if(!spendCost(side,inst,cost))return false;
    if(await shouldCounterCardUse(side,inst,cost)){removeHand(ss,inst);ss.discard.push(inst);log(`「${c.name}」は打ち消された。`);return true;}
    removeHand(ss,inst);removeInstance(ss.discard,first);removeInstance(ss.discard,second);
    let attachTo=first;
    if(side==='player'){
      const uid=await choose([
        {value:first.uid,title:def(first).name,detail:'白銀蜘蛛の糸をつける'},
        {value:second.uid,title:def(second).name,detail:'白銀蜘蛛の糸をつける'}
      ],'どちらに白銀蜘蛛の糸をつけますか？','白銀蜘蛛の糸');
      attachTo=uid===second.uid?second:first;
    }
    const link=inst.uid;
    const f1=await putInsectOnField(side,first,{suppressKeywords:true,silverThreadLink:link,attachments:attachTo.uid===first.uid?[inst]:[]});
    const f2=await putInsectOnField(side,second,{suppressKeywords:true,silverThreadLink:link,attachments:attachTo.uid===second.uid?[inst]:[]});
    log(`「白銀蜘蛛の糸」で「${fieldDef(f1).name}」「${fieldDef(f2).name}」を場に出した。＜＞能力は失われている。`);
    return true;
  }
  async function summonWithBlackSilverThread(side,inst,c,fromTerritory=false){
    if(discardSummonBlocked()){log('＜地獄の番人＞により捨て札から虫を場に出せない。');return false;}
    const ss=sideObj(side),choices=visibleDiscardFrom(ss).filter(x=>def(x).type==='insect');
    if(!choices.length)return false;
    const chosen=await chooseOwnedInstance(side,'「黒銀蜘蛛の糸」で場に出す虫を選んでください。',choices);if(!chosen)return false;
    if(!fromTerritory){
      const cost=effectiveCardCost(side,inst);if(!spendCost(side,inst,cost))return false;
      if(await shouldCounterCardUse(side,inst,cost)){removeHand(ss,inst);ss.discard.push(inst);log(`「${c.name}」は打ち消された。`);return true;}
      removeHand(ss,inst);
    }
    removeInstance(ss.discard,chosen);
    const fc=await putInsectOnField(side,chosen,{attachments:[inst],suppressKeywords:true,temporary:fromTerritory});
    log(`「黒銀蜘蛛の糸」で「${fieldDef(fc).name}」を場に出した。＜＞の技を失う${fromTerritory?'。ターン終了時に破壊される。':'。'}`);
    return true;
  }

  async function useTwinReferenceEnhancement(side,inst,c){
    const ss=sideObj(side),fields=fieldActive(side);if(fields.length<2)return false;
    const first=await chooseOwnedField(side,'参照する2体のうち1体目を選んでください。',fields);if(!first)return false;
    const second=await chooseOwnedField(side,'2体目を選んでください。',fields.filter(x=>x!==first));if(!second)return false;
    let host=first,source=second;
    if(side==='player'){
      const pick=await choose([
        {value:first.inst.uid,title:fieldDef(first).name,detail:'この虫に装着する'},
        {value:second.inst.uid,title:fieldDef(second).name,detail:'この虫に装着する'}
      ],`「${c.name}」をどちらにつけますか？`,c.name);
      if(pick===null)return false;if(pick===second.inst.uid){host=second;source=first;}
    }
    if(!canAttachEnhancement(host,inst)){
      if(canAttachEnhancement(source,inst)){const tmp=host;host=source;source=tmp;}
      else return false;
    }
    const cost=effectiveCardCost(side,inst,host);if(!spendCost(side,inst,cost))return false;
    if(await shouldCounterCardUse(side,inst,cost)){removeHand(ss,inst);sendToOwnerDiscard(inst,side);log(`「${c.name}」は打ち消された。`);return true;}
    removeHand(ss,inst);
    if(c.effect==='shadowDoubleMirror'){
      const base=def(source.inst);
      inst.shadowSourceUid=source.inst.uid;
      inst.shadowCopy={name:base.name,color:base.color,hp:base.hp,attacks:(base.attacks||[]).map(a=>({...a})),passive:base.passive?{...base.passive}:null};
      host.attachments.push(inst);applyShadowMirrorOverride(host);
    }else{
      inst.colorSourceUid=source.inst.uid;inst.copyColor=def(source.inst).color;
      host.attachments.push(inst);
    }
    await configureAttachedCard(side,host,inst,{paidOwnCost:true});
    log(`${sideName(side)}は「${c.name}」を「${fieldDef(host).name}」につけた。`);
    return true;
  }
  async function usePuppetCordyceps(side,inst,c){
    if(discardSummonBlocked())return false;
    const ss=sideObj(side),choices=visibleDiscardFrom(ss).filter(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=3);if(!choices.length)return false;
    const chosen=await chooseOwnedInstance(side,'「傀儡の冬虫夏草」で場に出す虫を選んでください。',choices);if(!chosen)return false;
    const cost=effectiveCardCost(side,inst);if(!spendCost(side,inst,cost))return false;
    if(await shouldCounterCardUse(side,inst,cost)){removeHand(ss,inst);sendToOwnerDiscard(inst,side);log(`「${c.name}」は打ち消された。`);return true;}
    removeHand(ss,inst);removeInstance(ss.discard,chosen);
    const fc=await putInsectOnField(side,chosen,{attachments:[inst]});
    const base=def(chosen);
    Engine.setCardOverrides(fc,{attacks:(base.attacks||[]).map(a=>({...a,effect:null,text:''})),passive:null});
    fc.suppressKeywords=true;fc.cordycepsSuppressed=true;
    log(`「傀儡の冬虫夏草」で「${base.name}」を場に出した。技の効果を失い、体力と攻撃力-100。`);
    return true;
  }

  async function playCardFromHand(side,inst){
    const ss=sideObj(side),c=def(inst);
    let alt=null;
    const normalCost=effectiveCardCost(side,inst);

    if(c.type==='insect'&&passiveOfInst(inst)?.type==='altSacrifice2'){
      if(normalCost>ss.cost){
        if(fieldActive(side).length<2)return false;
        alt='sac2';
      }else if(fieldActive(side).length>=2&&side==='player'){
        const mode=await choose([
          {value:'cost',title:`${normalCost}コスト払う`,detail:'通常通り場に出す'},
          {value:'sac2',title:'虫2つを破壊',detail:'コストを払わず場に出す'}
        ],'リオックをどうやって場に出しますか？','＜エサにする＞');
        if(mode===null)return false;alt=mode==='sac2'?'sac2':null;
      }
    }else if(c.type==='insect'&&passiveOfInst(inst)?.type==='larvaSacrificeSummon'){
      const hasLarva=fieldActive(side).some(fc=>fieldDef(fc).name.includes('（幼虫）'));
      if(normalCost>ss.cost){
        if(!hasLarva)return false;alt='larva';
      }else if(hasLarva&&side==='player'){
        const mode=await choose([
          {value:'cost',title:`${normalCost}コスト払う`,detail:'通常通り場に出す'},
          {value:'larva',title:'幼虫を破壊',detail:'コストを払わず場に出す'}
        ],'イラガセイボウをどうやって場に出しますか？','＜食い破る＞');
        if(mode===null)return false;alt=mode==='larva'?'larva':null;
      }
    }else if(c.type==='insect'&&passiveOfInst(inst)?.type==='demonSummon'&&fieldActive(side).some(fc=>fc.attachments.length>0)){
      if(normalCost>ss.cost)alt='demon';
      else if(side==='player'){
        const mode=await choose([
          {value:'cost',title:`${normalCost}コスト払う`,detail:'通常通り場に出す'},
          {value:'demon',title:'＜悪魔召喚＞',detail:'強化カードがついた自分の虫1つを破壊する'}
        ],'トゲアクマツユムシをどうやって場に出しますか？','＜悪魔召喚＞');
        if(mode===null)return false;alt=mode==='demon'?'demon':null;
      }else alt='demon';
    }else if(c.type==='insect'&&passiveOfInst(inst)?.type==='parthenogenesis'&&fieldActive(side).some(fc=>passiveOfField(fc)?.type==='parthenogenesis')){
      if(normalCost>ss.cost)alt='parthenogenesis';
      else if(side==='player'){
        const mode=await choose([
          {value:'cost',title:`${normalCost}コスト払う`,detail:'通常通り場に出す'},
          {value:'parthenogenesis',title:'＜単為生殖＞',detail:'コストなし。このターン攻撃できない'}
        ],'ヤエヤマツダナナフシをどうやって場に出しますか？','＜単為生殖＞');
        if(mode===null)return false;alt=mode==='parthenogenesis'?'parthenogenesis':null;
      }else alt='parthenogenesis';
    }else if(c.type==='insect'&&normalCost>ss.cost)return false;

    const action={state,side,card:inst,definition:c,cost:alt||normalCost};
    events.emit(EVENT.CARD_USE_DECLARED,action);
    state.busy=true;
    try{
      if(c.type==='insect'){
        if(alt==='sac2'){
          if(!await sacrificeTwoForRiock(side))return false;
          emitCost(side,inst,c,'虫2つ');
        }else if(alt==='larva'){
          const larva=await chooseLarvaSacrifice(side,'＜食い破る＞で破壊する幼虫を選んでください。');if(!larva)return false;
          const destroyed=await attemptDestroyFieldCard(side,larva,'sacrifice',null);if(!destroyed)return false;
          emitCost(side,inst,c,'幼虫1つ');
        }else if(alt==='demon'){
          const choices=fieldActive(side).filter(fc=>fc.attachments.length>0);
          const victim=await chooseOwnedField(side,'＜悪魔召喚＞で破壊する虫を選んでください。',choices);if(!victim)return false;
          await attemptDestroyFieldCard(side,victim,'sacrifice',null);
          emitCost(side,inst,c,'悪魔召喚');
        }else if(alt==='parthenogenesis'){
          emitCost(side,inst,c,'単為生殖');
        }else if(!spendCost(side,inst,normalCost))return false;
        consumeFlowerDance(side,inst);
        removeHand(ss,inst);
        await putInsectOnField(side,inst,{paidOwnCost:!alt,noAttackThisTurn:alt==='parthenogenesis'});
        log(`${sideName(side)}は「${c.name}」を場に出した（コスト${alt?'代替':normalCost}）。`);
        if(side==='cpu'){render();await cpuNotice(`「${c.name}」を場に出した`);}
      }else if(c.type==='enhance'){
        if(c.effect==='shadowDoubleMirror'||c.effect==='jewelColorCopy'){
          if(!await useTwinReferenceEnhancement(side,inst,c))return false;
        }else if(c.effect==='puppetCordyceps'){
          if(!await usePuppetCordyceps(side,inst,c))return false;
        }else if(c.effect==='silverThread'){
          if(!await summonWithSilverThread(side,inst,c))return false;
        }else if(c.effect==='blackSilverThread'){
          if(!await summonWithBlackSilverThread(side,inst,c,false))return false;
        }else if(c.effect==='summonWithAttachment'){
          const insects=ss.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect');if(!insects.length)return false;
          const chosen=await chooseOwnedInstance(side,'「口寄せの時蛹」で場に出す虫を選んでください。',insects);if(!chosen)return false;
          const cost=effectiveCardCost(side,inst);if(!spendCost(side,inst,cost))return false;
          if(await shouldCounterCardUse(side,inst,cost)){removeHand(ss,inst);ss.discard.push(inst);log(`「${c.name}」は打ち消された。`);return true;}
          removeHand(ss,inst);removeHand(ss,chosen);inst.expireTurn=state.turnSeq+1;
          const fc=await putInsectOnField(side,chosen,{attachments:[inst],summonedByTimePupa:true});
          log(`「口寄せの時蛹」で「${fieldDef(fc).name}」を場に出した。時蛹がある間は攻撃できない。`);
          if(side==='cpu'){render();await cpuNotice(`「口寄せの時蛹」→「${fieldDef(fc).name}」を場に出した`);}
        }else{
          const targets=fieldActive(side).filter(fc=>canAttachEnhancement(fc,inst)&&(c.effect==='grudgeJinbaori'
            ?Math.max(0,effectiveCardCost(side,inst,fc)-faceUpBait(side).length)<=ss.cost
            :effectiveCardCost(side,inst,fc)<=ss.cost));
          if(!targets.length)return false;
          const target=await chooseOwnedField(side,`「${c.name}」をつける虫を選んでください。`,targets);if(!target)return false;
          if(c.effect==='imitation'&&!await configureImitation(side,inst,target))return false;
          let cost=effectiveCardCost(side,inst,target);
          if(c.effect==='grudgeJinbaori'){
            let flipped=0;
            while(sideObj(side).bait.some(isFaceUpBait)){
              let use;
              if(side==='cpu')use=flipped<cost;
              else if(Math.max(0,cost-flipped)>ss.cost)use=true;
              else use=await confirmYesNo(`「怨念の陣羽織」で表向きのエサをさらに裏向きにしますか？ 現在の軽減：${flipped}`,'怨念の陣羽織');
              if(!use)break;
              const choices=sideObj(side).bait.filter(isFaceUpBait),chosen=await chooseOwnedInstance(side,'裏向きにするエサを選んでください。',choices);if(!chosen)break;
              chosen.faceDown=true;flipped++;
            }
            cost=Math.max(0,cost-flipped);
          }
          if(!spendCost(side,inst,cost))return false;
          if(await shouldCounterCardUse(side,inst,cost)){removeHand(ss,inst);ss.discard.push(inst);log(`「${c.name}」は打ち消された。`);return true;}
          removeHand(ss,inst);target.attachments.push(inst);
          await configureAttachedCard(side,target,inst,{paidOwnCost:true});
          log(`${sideName(side)}は「${c.name}」を「${fieldDef(target).name}」につけた（コスト${cost}）。`);
          if(side==='cpu'){render();await cpuNotice(`「${c.name}」を「${fieldDef(target).name}」につけた`);}
        }
      }else{
        let prepaid=false,paidCost=null;
        if(counterThreatened(side,inst)){
          paidCost=await prepaySpellForCounter(side,inst,c);if(paidCost===null)return false;prepaid=true;
          if(await shouldCounterCardUse(side,inst,paidCost)){
            removeHand(ss,inst);if(!ss.discard.includes(inst))ss.discard.push(inst);
            clearPrepaid(inst);log(`「${c.name}」は打ち消された。`);
            return true;
          }
        }
        state.resolvingSpellSide=side;
        let ok=false;
        try{ok=await resolveSpell(side,inst,c);}finally{state.resolvingSpellSide=null;if(prepaid)clearPrepaid(inst);}
        if(!ok)return false;
      }
      await resolveStateBasedDestructions('effect');
      events.emit(EVENT.CARD_RESOLVED,action);enforceAllAttachmentLegality();render();
      if(state.forceEndAfterResolve){
        state.forceEndAfterResolve=false;
        state.busy=false;
        await endTurn();
      }
      return true;
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
    const ss=sideObj(side);
    if(inst.prepaidUse){
      removeHand(ss,inst);if(toDiscard&&!ss.discard.includes(inst))ss.discard.push(inst);
      return true;
    }
    const cost=effectiveCardCost(side,inst);
    if(!spendCost(side,inst,cost))return false;
    removeHand(ss,inst);if(toDiscard)ss.discard.push(inst);
    return true;
  }
  async function chooseHalfDeathVictims(side){
    const active=fieldActive(side),need=active.length-Math.floor(active.length/2),picked=[];
    const remaining=[...active];
    for(let n=0;n<need;n++){
      if(!remaining.length)break;
      const chosen=side==='player'
        ? await chooseField('「半死の道連れ」で破壊する自分の虫を選んでください。',remaining,false)
        : await chooseOwnedField(side,'「半死の道連れ」で破壊する自分の虫を選んでください。',remaining);
      if(!chosen)continue;picked.push(chosen);remaining.splice(remaining.indexOf(chosen),1);
    }
    return picked;
  }

  async function resolveSpell(side,inst,c){
    const s=sideObj(side),opp=other(side);
    let target,chosen;

    if(c.effect==='recoverInsect'){
      const choices=visibleDiscardFrom(s).filter(x=>def(x).type==='insect');if(!choices.length)return false;
      chosen=await chooseOwnedInstance(side,'捨て札から手札に戻す虫を選んでください。',choices);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.discard,chosen);s.hand.push(chosen);
      log(`${sideName(side)}は「${c.name}」で「${def(chosen).name}」を手札に戻した。`);
    }else if(c.effect==='burn600'||c.effect==='burn1000'){
      const amount=c.effect==='burn1000'?1000:600;
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField(`${amount}ダメージを与える相手の虫を選んでください。`,choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      paySpell(side,inst,c);
      const actual=await dealDamage(opp,target,amount,{source:inst,sourceSide:side,kind:'spell'});
      log(`${sideName(side)}の「${c.name}」！ ${fieldDef(target).name}に${actual}ダメージ。`);
      if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='baitBoost'){
      {const cost=effectiveCardCost(side,inst);if(!spendCost(side,inst,cost))return false;}removeHand(s,inst);inst.faceDown=false;s.bait.push(inst);
      log(`${sideName(side)}は「蟲の息吹」を使い、エサを1枚増やした（このターンのコストは増えない）。`);
    }else if(c.effect==='allAttack200'||c.effect==='allAttack300'||c.effect==='allAttack500'){
      paySpell(side,inst,c);const value=c.effect==='allAttack500'?500:(c.effect==='allAttack300'?300:200);
      for(const fc of fieldActive(side))fc.turnAttackBonus+=spellModifierValue(fc,value);
      log(`${sideName(side)}の場の虫すべての攻撃力がこのターン+${value}。`);
    }else if(c.effect==='moveEnhance'){
      const pick=await chooseAttachment(side,fieldActive(side),'強化カードがついている虫を選んでください。');if(!pick)return false;
      const dests=fieldActive(side).filter(x=>x!==pick.source&&canAttachEnhancement(x,pick.attachment));if(!dests.length)return false;
      const dest=await chooseOwnedField(side,'つけ替える先の虫を選んでください。',dests);if(!dest)return false;
      if(def(pick.attachment).effect==='imitation'&&!await configureImitation(side,pick.attachment,dest))return false;
      paySpell(side,inst,c);removeInstance(pick.source.attachments,pick.attachment);dest.attachments.push(pick.attachment);
      if(def(pick.attachment).effect==='shadowDoubleMirror'||def(pick.attachment).effect==='puppetCordyceps'){refreshCordycepsSuppression(pick.source);refreshCordycepsSuppression(dest);}
      log(`「${def(pick.attachment).name}」を「${fieldDef(dest).name}」につけ替えた。`);
    }else if(c.effect==='addTerritory'){
      if(!paySpell(side,inst,c,false))return false;inst.faceUpTerritory=true;s.territory.push(inst);
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
        picks.push(first);const same=insects.filter(x=>x.uid!==first.uid&&baitCardColor(x)===baitCardColor(first));
        if(same.length){
          const second=await choose([...same.map(i=>({value:i.uid,title:def(i).name,detail:`${colorJa[def(i).color]} / コスト ${def(i).cost}`})),{value:null,title:'1つだけ出す',detail:''}],'同じ色の虫をもう1つ出せます。','瀬戸際の虫時雨');
          const found=same.find(x=>x.uid===second);if(found)picks.push(found);
        }
      }else{
        const groups={red:[],blue:[],green:[]};for(const i of insects)groups[def(i).color].push(i);
        picks=Object.values(groups).sort((a,b)=>b.length-a.length)[0].sort((a,b)=>def(b).cost-def(a).cost).slice(0,2);
      }
      paySpell(side,inst,c);
      for(const i of picks){removeInstance(s.bait,i);const fc=await putInsectOnField(side,i,{temporary:true,summonedBySpell:true});log(`「${fieldDef(fc).name}」がエサ場から出た。`);}
    }else if(c.effect==='destroyOpponent'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('破壊する相手の虫を選んでください。',choices,true):cpuHardRemovalTarget(choices,false);if(!target)return false;
      paySpell(side,inst,c);await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='topDeckSummon'){
      paySpell(side,inst,c);
      if(!s.deck.length)log('山札にカードがありません。');
      else{
        const top=s.deck.shift();
        if(def(top).type==='insect'){const fc=await putInsectOnField(side,top,{temporary:true,summonedBySpell:true});log(`山札から「${fieldDef(fc).name}」が場に出た。`);}
        else{s.hand.push(top);log(`山札の「${def(top).name}」を手札に加えた。`);}
      }
    }else if(c.effect==='swapDiscardField'){
      const disc=visibleDiscardFrom(s).filter(x=>def(x).type==='insect');if(!disc.length||!fieldActive(side).length)return false;
      const incoming=await chooseOwnedInstance(side,'捨て札から場に出す虫を選んでください。',disc);if(!incoming)return false;
      const outgoing=await chooseOwnedField(side,'捨て札と入れ替える場の虫を選んでください。');if(!outgoing)return false;
      paySpell(side,inst,c);removeInstance(s.discard,incoming);
      s.field=s.field.filter(x=>x!==outgoing);sendToOwnerDiscard(outgoing.inst,side);discardAttachmentsToOwners(outgoing,side);
      await putInsectOnField(side,incoming,{noAttackThisTurn:true,summonedBySpell:true});
      log(`「${fieldDef(outgoing).name}」と「${def(incoming).name}」を入れ替えた。`);
    }else if(c.effect==='baitToHand'){
      const list=faceUpBait(side).filter(x=>def(x).type==='insect');if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'手札に戻すエサの虫を選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.bait,chosen);s.hand.push(chosen);log(`「${def(chosen).name}」をエサ場から手札に戻した。`);
    }else if(c.effect==='baitTempSummon'){
      const list=faceUpBait(side).filter(x=>def(x).type==='insect');if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'場に出すエサの虫を選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.bait,chosen);await putInsectOnField(side,chosen,{temporary:true,summonedBySpell:true});log(`「${def(chosen).name}」をエサ場から場に出した。`);
    }else if(c.effect==='handTempSummon'){
      const list=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect');if(!list.length)return false;
      chosen=side==='cpu'&&currentCpuDifficulty()!=='normal'
        ?cpuHandTempSummonTarget(inst.uid)
        :await chooseOwnedInstance(side,'場に出す手札の虫を選んでください。',list);
      if(!chosen)return false;
      paySpell(side,inst,c);removeHand(s,chosen);await putInsectOnField(side,chosen,{temporary:true,summonedBySpell:true});log(`「${def(chosen).name}」を手札から場に出した。`);
    }else if(c.effect==='sameCostSwap'){
      const handInsects=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect'&&fieldActive(side).some(fc=>def(fc.inst).cost===def(x).cost));if(!handInsects.length)return false;
      const incoming=await chooseOwnedInstance(side,'場に出す手札の虫を選んでください。',handInsects);if(!incoming)return false;
      const matches=fieldActive(side).filter(fc=>def(fc.inst).cost===def(incoming).cost);
      const outgoing=await chooseOwnedField(side,'手札に戻す同コストの虫を選んでください。',matches);if(!outgoing)return false;
      paySpell(side,inst,c);removeHand(s,incoming);
      s.field=s.field.filter(x=>x!==outgoing);discardAttachmentsToOwners(outgoing,side);sendToOwnerHand(outgoing.inst,side);
      await putInsectOnField(side,incoming,{noAttackThisTurn:true,summonedBySpell:true});
      log(`「${def(incoming).name}」と「${fieldDef(outgoing).name}」を入れ替えた。`);
    }else if(c.effect==='destroyEnhance'){
      const choices=spellTargetCandidates(side,opp).filter(fc=>fc.attachments.length);
      const source=side==='player'?await chooseField('強化カードを破壊する相手の虫を選んでください。',choices,true):choices[0];
      if(!source)return false;
      const att=side==='player'?await chooseInstances('破壊する強化カードを選んでください。',source.attachments):source.attachments[0];if(!att)return false;
      paySpell(side,inst,c);destroyAttachment(source,att,opp,'effect');log(`「${def(att).name}」を破壊した。`);
    }else if(c.effect==='blockAttackNext'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
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
      removeHand(s,adult);const fc=await putInsectOnField(side,adult,{summonedBySpell:true,summonedByEclosion:true});
      log(`「${fieldDef(larva).name}」が「${fieldDef(fc).name}」に羽化した。`);
    }else if(c.effect==='smokeNoFlyOut'){
      paySpell(side,inst,c);state.noFlyOutSide=opp;state.noFlyOutTurn=state.turnSeq;
      log(`「蟲祓いの煙幕」！ このターン${sideName(opp)}は＜とびだす＞を使えない。`);
    }else if(c.effect==='singleAttack500'){
      const list=fieldActive(side);if(!list.length)return false;
      target=await chooseOwnedField(side,'攻撃力を500増やす虫を選んでください。',list);if(!target)return false;
      paySpell(side,inst,c);const value=spellModifierValue(target,500);target.turnAttackBonus+=value;log(`「${fieldDef(target).name}」の攻撃力がこのターン+${value}。`);
    }else if(c.effect==='harvestBaitSpecial'){
      const list=faceUpBait(side).filter(x=>['enhance','spell'].includes(def(x).type));if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'手札に戻すエサを選んでください。',list);if(!chosen)return false;
      paySpell(side,inst,c);removeInstance(s.bait,chosen);s.hand.push(chosen);log(`「${def(chosen).name}」をエサ場から手札に戻した。`);
    }else if(c.effect==='queenBeeSummon'){
      const bees=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect'&&def(x).name.includes('バチ'));if(!bees.length)return false;
      let picks=[];
      if(side==='player'){
        const first=await chooseOwnedInstance(side,'場に出す～バチ科の虫（1つ目）',bees);if(!first)return false;picks.push(first);
        const rest=bees.filter(x=>x.uid!==first.uid);
        if(rest.length){
          const uid=await choose([...rest.map(x=>({value:x.uid,title:def(x).name,detail:''})),{value:null,title:'1つだけ出す',detail:''}],'もう1つ場に出しますか？','女王蜂の匂い袋');
          const second=rest.find(x=>x.uid===uid);if(second)picks.push(second);
        }
      }else picks=[...bees].sort((x,y)=>def(y).cost-def(x).cost).slice(0,2);
      if(!paySpell(side,inst,c))return false;
      for(const bug of picks){removeHand(s,bug);await putInsectOnField(side,bug,{temporary:true,summonedBySpell:true});}
      log(`「女王蜂の匂い袋」で${picks.length}体を場に出した。`);
    }else if(c.effect==='bloodPact'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('破壊する相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      const normalCost=effectiveCardCost(side,inst);
      if(inst.prepaidUse){
        removeHand(s,inst);if(!s.discard.includes(inst))s.discard.push(inst);
      }else{
      let useTerritory=s.territory.length>=2&&normalCost>s.cost;
      if(side==='cpu'&&s.territory.length>=2&&normalCost<=s.cost&&cpuShouldPayBloodPactWithTerritory(inst))useTerritory=true;
      if(side==='player'&&s.territory.length>=2&&normalCost<=s.cost){
        const pay=await choose([
          {value:'cost',title:`${normalCost}コスト払う`,detail:'通常のコストで使用'},
          {value:'territory',title:'縄張り2枚を捨てる',detail:'コストの代わりに支払う'}
        ],'刺蠅の血盟の支払い方法を選んでください。','刺蠅の血盟');
        if(pay===null)return false;useTerritory=pay==='territory';
      }
      if(useTerritory){
        const picked=[];
        for(let n=0;n<2;n++){
          let idx=0;
          if(side==='player'){
            const opts=s.territory.map((x,i)=>({value:i,title:`縄張り ${i+1}`,detail:x.faceUpTerritory?def(x).name:'裏向き'}));
            idx=await choose(opts,'捨て札にする縄張りを選んでください。','刺蠅の血盟');if(idx===null)return false;
          }
          const [card]=s.territory.splice(Number(idx)||0,1);picked.push(card);sendToOwnerDiscard(card,side);
        }
        removeHand(s,inst);s.discard.push(inst);emitCost(side,inst,c,'縄張り2枚');
      }else{
        if(normalCost>s.cost||!paySpell(side,inst,c))return false;
      }
      }
      await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='drawOwnTerritory'){
      if(!paySpell(side,inst,c))return false;
      await takeTerritory(side,false,{suppressFlyOut:true});
    }else if(c.effect==='hideOwn'){
      const list=fieldActive(side);if(!list.length)return false;
      target=await chooseOwnedField(side,'裏向きにする自分の虫を選んでください。',list);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      target.hidden=true;target.hiddenUntilTurnSeq=nextOpponentTurnSeq(side);
      log(`「${fieldDef(target).name}」を次の相手ターン終了時まで裏向きにした。`);
    }else if(c.effect==='breathRelease'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('ダメージを与える相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      const base=effectiveCardCost(side,inst);if(base>s.cost)return false;
      const maxExtra=Math.max(0,s.cost-base);
      let extra=maxExtra;
      if(side==='player'){
        const opts=[];for(let n=0;n<=maxExtra;n++)opts.push({value:n,title:`追加${n}コスト`,detail:`${n*300}ダメージ`});
        extra=await choose(opts,'追加で支払うコストを選んでください。','息吹の解放');if(extra===null)return false;
      }
      const total=base+Number(extra||0);if(!spendCost(side,inst,total))return false;
      removeHand(s,inst);s.discard.push(inst);
      const actual=await dealDamage(opp,target,Number(extra||0)*300,{source:inst,sourceSide:side,kind:'spell',forceDamageEvent:true});
      log(`「息吹の解放」！ 追加${extra}コストで「${fieldDef(target).name}」に${actual}ダメージ。`);
      if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='trimHands4'){
      if(!paySpell(side,inst,c))return false;
      const discardDown=async who=>{
        const ss=sideObj(who);
        while(ss.hand.length>4){
          const card=await chooseOwnedInstance(who,'捨てる手札を選んでください。',ss.hand);if(!card)break;
          removeInstance(ss.hand,card);ss.discard.push(card);
        }
      };
      await discardDown('player');await discardDown('cpu');
      log('「四柱の間引き」で手札が5枚以上のプレイヤーは4枚まで捨てた。');
    }else if(c.effect==='flipOwnBaitUp'){
      if(!paySpell(side,inst,c))return false;
      let left=3;
      while(left>0){
        const down=s.bait.filter(x=>x.faceDown);if(!down.length)break;
        let card;
        if(side==='player'){
          const uid=await choose([...down.map(x=>({value:x.uid,title:'裏向きのエサ',detail:'表向きにする'})),{value:null,title:'ここで終了',detail:''}],'表向きにするエサを選んでください。','衣蛾の虫喰み');
          if(uid===null)break;card=down.find(x=>x.uid===uid);
        }else card=down[0];
        if(!card)break;card.faceDown=false;left--;
      }
      log('「衣蛾の虫喰み」で裏向きのエサを表向きにした。');
    }else if(c.effect==='nextEnhanceDiscount'){
      if(!paySpell(side,inst,c))return false;
      const rec=state.enhanceDiscount[side];if(rec.turnSeq!==state.turnSeq){rec.turnSeq=state.turnSeq;rec.count=0;}rec.count++;
      log(`次に使う強化カードのコストが${rec.count}減る。`);
    }else if(c.effect==='nextOpponentSpellTax'){
      if(!paySpell(side,inst,c))return false;
      const rec=state.spellTax[opp];const turn=state.turnSeq+1;
      if(rec.turnSeq!==turn){rec.turnSeq=turn;rec.count=0;}rec.count++;
      log(`次の${sideName(opp)}のターン、術カードのコストが+${rec.count}。`);
    }else if(c.effect==='grasshopperAmbush'){
      if(!paySpell(side,inst,c))return false;
      const rec=state.grasshopperAmbush[side];
      if(s.territory.length===0){rec.active=false;rec.ended=true;}
      else if(!rec.ended){rec.active=true;log(`「飛蝗の待ち伏せ」！ 縄張りが0になるまでバッタ科・イナゴ科に＜とびだす＞を付与。`);}
    }else if(c.effect==='youngReincarnation'){
      const adults=fieldActive(side).filter(fc=>!fieldDef(fc).name.includes('（幼虫）')&&visibleDiscardFrom(s).some(x=>def(x).type==='insect'&&def(x).name===matchingLarvaName(fieldDef(fc).name)));
      if(!adults.length)return false;
      const adult=await chooseOwnedField(side,'対応する幼虫を呼ぶ成虫を選んでください。',adults);if(!adult)return false;
      const larvae=visibleDiscardFrom(s).filter(x=>def(x).type==='insect'&&def(x).name===matchingLarvaName(fieldDef(adult).name));
      const larva=await chooseOwnedInstance(side,'場に出す幼虫を選んでください。',larvae);if(!larva)return false;
      if(!paySpell(side,inst,c))return false;
      removeInstance(s.discard,larva);await putInsectOnField(side,larva,{noAttackThisTurn:true,summonedBySpell:true});
      log(`「若虫の転生」で「${def(larva).name}」を場に出した。`);
    }else if(c.effect==='ghostSwap'){
      const fields=spellTargetCandidates(side,opp),baits=faceUpBait(opp).filter(x=>def(x).type==='insect');
      if(!fields.length||!baits.length)return false;
      const outgoing=side==='player'?await chooseField('エサ場へ送る相手の虫を選んでください。',fields,true):fields[0];if(!outgoing)return false;
      const incoming=await chooseOwnedInstance(side,'相手の場へ出すエサの虫を選んでください。',baits);if(!incoming)return false;
      if(!paySpell(side,inst,c))return false;
      sideObj(opp).field=sideObj(opp).field.filter(x=>x!==outgoing);
      discardAttachmentsToOwners(outgoing,opp,'swap');sendToOwnerBait(outgoing.inst,opp);
      events.emit(EVENT.CARD_LEFT_FIELD,{state,side:opp,fieldCard:outgoing,reason:'swap'});
      removeInstance(sideObj(opp).bait,incoming);await putInsectOnField(opp,incoming,{summonedBySpell:true});
      log(`「怨霊の虫送り」で「${fieldDef(outgoing).name}」と「${def(incoming).name}」を入れ替えた。`);
    }else if(c.effect==='polarEvolution'){
      const larvae=fieldActive(side).filter(fc=>fieldDef(fc).name.includes('（幼虫）')&&visibleDiscardFrom(s).some(x=>def(x).type==='insect'&&def(x).name===baseAdultName(fieldDef(fc).name)));
      if(!larvae.length)return false;
      const larva=await chooseOwnedField(side,'羽化させる幼虫を選んでください。',larvae);if(!larva)return false;
      const adults=visibleDiscardFrom(s).filter(x=>def(x).type==='insect'&&def(x).name===baseAdultName(fieldDef(larva).name));
      const adult=await chooseOwnedInstance(side,'場に出す成虫を選んでください。',adults);if(!adult)return false;
      if(!paySpell(side,inst,c))return false;
      removeInstance(s.discard,adult);
      s.field=s.field.filter(x=>x!==larva);discardAttachmentsToOwners(larva,side,'swap');sendToOwnerDiscard(larva.inst,side);
      events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:larva,reason:'swap'});
      await putInsectOnField(side,adult,{summonedBySpell:true,summonedByEclosion:true});
      log(`「極夜の羽化」で「${fieldDef(larva).name}」と「${def(adult).name}」を入れ替えた。`);
    }else if(c.effect==='kusanagiInferno'){
      if(!paySpell(side,inst,c))return false;
      for(const owner of ['player','cpu']){
        for(const fc of [...fieldActive(owner)])await attemptDestroyFieldCard(owner,fc,'effect',null);
      }
      state.forceEndAfterResolve=true;
      log('「草薙の劫火」で表向きの虫をすべて破壊した。ターンを終了する。');
    }else if(c.effect==='whiteAntHarvest'){
      const list=faceUpBait(side).filter(x=>def(x).type==='enhance');if(!list.length)return false;
      if(!paySpell(side,inst,c))return false;
      let left=2;
      while(left>0){
        const avail=faceUpBait(side).filter(x=>def(x).type==='enhance');if(!avail.length)break;
        let pick=avail[0];
        if(side==='player'){
          const opts=avail.map(x=>({value:x.uid,title:def(x).name,detail:'手札に戻す'}));opts.push({value:null,title:'ここで終了',detail:''});
          const uid=await choose(opts,'手札に戻す強化カードを選んでください。','白蟻の収穫');if(uid===null)break;pick=avail.find(x=>x.uid===uid);
        }
        if(!pick)break;removeInstance(s.bait,pick);s.hand.push(pick);left--;
      }
      log('「白蟻の収穫」で強化カードを手札に戻した。');
    }else if(c.effect==='leafcutterWork'){
      const list=faceUpBait(side);if(!list.length)return false;
      chosen=await chooseOwnedInstance(side,'手札に戻すエサを選んでください。',list);if(!chosen)return false;
      const cost=effectiveCardCost(side,inst);if(!spendCost(side,inst,cost))return false;
      removeHand(s,inst);removeInstance(s.bait,chosen);s.hand.push(chosen);inst.faceDown=false;s.bait.push(inst);
      log(`「葉切蟻の野良仕事」で「${def(chosen).name}」を手札へ戻し、この術をエサ場へ置いた（このターンのコストは増えない）。`);
    }else if(c.effect==='spellShield'){
      const list=fieldActive(side);if(!list.length)return false;
      target=await chooseOwnedField(side,'術カードから守る虫を選んでください。',list);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      target.spellShieldUntilTurnSeq=nextOpponentTurnSeq(side);
      log(`「${fieldDef(target).name}」は次の相手ターン終了時まで相手の術カードの対象にならない。`);
    }else if(c.effect==='swordDanceAttach'){
      if(!paySpell(side,inst,c))return false;
      let attached=0;
      while(attached<2){
        const avail=faceUpBait(side).filter(x=>canSwordDanceAttach(side,x));
        if(!avail.length)break;
        let enhancement=avail[0];
        if(side==='player'){
          const opts=avail.map(x=>({value:x.uid,title:def(x).name,detail:'場の虫につける'}));if(attached>0)opts.push({value:null,title:'ここで終了',detail:''});
          const uid=await choose(opts,'エサ場からつける強化カードを選んでください。','剣舞天翔の刹那');if(uid===null)break;enhancement=avail.find(x=>x.uid===uid);
        }
        if(!enhancement)break;
        const targets=fieldActive(side).filter(fc=>canAttachEnhancement(fc,enhancement));
        if(def(enhancement).effect==='imitation'&&allOwnEnhancements(side).length===0){
          if(side==='player'){removeInstance(s.bait,enhancement);s.bait.push(enhancement);break;}else break;
        }
        if(!targets.length)break;
        const dest=await chooseOwnedField(side,'強化カードをつける虫を選んでください。',targets);if(!dest)break;
        if(def(enhancement).effect==='imitation'&&!await configureImitation(side,enhancement,dest))break;
        removeInstance(s.bait,enhancement);dest.attachments.push(enhancement);
        await configureAttachedCard(side,dest,enhancement);
        attached++;
      }
      log(`「剣舞天翔の刹那」で強化カードを${attached}枚つけた。`);
    }else if(c.effect==='sameNameBurn'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      const first=side==='player'?await chooseField('500ダメージを与える相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!first)return false;
      const name=fieldDef(first).name;if(!paySpell(side,inst,c))return false;
      const firstDmg=await dealDamage(opp,first,500,{source:inst,sourceSide:side,kind:'spell'});
      log(`「伏魔の蟲噛み」で「${name}」に${firstDmg}ダメージ。`);
      if(first.damage>=maxHp(first)&&sideObj(opp).field.includes(first))await attemptDestroyFieldCard(opp,first,'effect',null);
      const same=spellTargetCandidates(side,opp).filter(fc=>fc!==first&&fieldDef(fc).name===name);
      if(same.length){
        let use=true;if(side==='player')use=await confirmYesNo(`同名の「${name}」にも500ダメージを与えますか？`,'伏魔の蟲噛み');
        if(use){
          const second=side==='player'?await chooseField('追加でダメージを与える虫を選んでください。',same,true):same[0];
          if(second){const dmg=await dealDamage(opp,second,500,{source:inst,sourceSide:side,kind:'spell'});if(second.damage>=maxHp(second))await attemptDestroyFieldCard(opp,second,'effect',null);log(`同名の「${fieldDef(second).name}」にも${dmg}ダメージ。`);}
        }
      }
    }else if(c.effect==='sacrificeEnhanceBurn'){
      const pick=await chooseOwnEnhancement(side,'破壊する自分の強化カードを選んでください。');if(!pick)return false;
      if(!paySpell(side,inst,c))return false;
      destroyAttachment(pick.fc,pick.att,side,'effect');log(`「${def(pick.att).name}」を破壊した。`);
      const choices=spellTargetCandidates(side,opp);
      if(choices.length){
        let use=true;if(side==='player')use=await confirmYesNo('相手の虫に700ダメージを与えますか？','捨て身の兜投げ');
        if(use){
          target=side==='player'?await chooseField('700ダメージを与える相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);
          if(target){const dmg=await dealDamage(opp,target,700,{source:inst,sourceSide:side,kind:'spell'});if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);log(`「捨て身の兜投げ」で「${fieldDef(target).name}」に${dmg}ダメージ。`);}
        }
      }
    }else if(c.effect==='fatedShadow'){
      const baseCost=effectiveCardCost(side,inst);
      const choices=faceUpBait(side).filter(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=s.cost-baseCost);if(!choices.length)return false;
      chosen=await chooseOwnedInstance(side,'「宿命の影写し」で場に出すエサの虫を選んでください。',choices);if(!chosen)return false;
      const extra=Number(def(chosen).cost||0);
      if(!paySpell(side,inst,c,false))return false;
      if(extra>s.cost)return false;
      s.cost-=extra;log(`「宿命の影写し」の追加コスト${extra}を支払った。`);
      removeInstance(s.bait,chosen);await putInsectOnField(side,chosen,{summonedBySpell:true});
      inst.faceDown=true;s.bait.push(inst);
      log(`「宿命の影写し」で「${def(chosen).name}」を場に出し、自身を裏向きのエサにした。`);
    }else if(c.effect==='ironSandStorm'){
      if(!paySpell(side,inst,c))return false;
      const turn=nextOpponentTurnSeq(side),rec=state.attackTax[opp];
      if(rec.turnSeq!==turn){rec.turnSeq=turn;rec.count=0;}rec.count++;
      log(`「砂鉄の砂嵐」：次の${sideName(opp)}のターン、1回の攻撃につき追加コスト${rec.count}。`);
    }else if(c.effect==='blackMountain'){
      if(!paySpell(side,inst,c))return false;
      const count=fieldActive(side).length+allOwnEnhancements(side).length,value=count*100;
      for(const fc of fieldActive(side))fc.turnAttackBonus=(fc.turnAttackBonus||0)+value;
      log(`「怒濤の黒山」：現在場にいる虫すべての攻撃力をこのターン+${value}。`);
    }else if(c.effect==='flyLarvae'){
      let choices=visibleDiscardFrom(s).filter(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=1);if(!choices.length)return false;
      if(!paySpell(side,inst,c))return false;
      let moved=0;
      while(moved<2&&choices.length){
        let pick=await chooseOwnedInstance(side,'場に出すコスト1以下の虫を選んでください。',choices);if(!pick)break;
        removeInstance(s.discard,pick);await putInsectOnField(side,pick,{noAttackThisTurn:true,summonedBySpell:true});moved++;choices=choices.filter(x=>x.uid!==pick.uid);
        if(side==='player'&&moved===1&&choices.length&&!(await confirmYesNo('もう1体場に出しますか？','小蠅の落とし子')))break;
      }
      log(`「小蠅の落とし子」で虫を${moved}体場に出した。`);
    }else if(c.effect==='sacredTreeBreath'){
      if(!paySpell(side,inst,c,false))return false;
      inst.faceDown=false;s.bait.push(inst);s.cost+=6;
      log('「神木の息吹」を表向きのエサに置き、コスト6を発生させた。');
      if(visibleDiscardFrom(s).length){
        let use=true;if(side==='player')use=await confirmYesNo('捨て札のカード1枚を裏向きのエサに置きますか？','神木の息吹');
        if(use){const pick=await chooseOwnedInstance(side,'裏向きのエサにする捨て札を選んでください。',visibleDiscardFrom(s));if(pick){removeInstance(s.discard,pick);pick.faceDown=true;s.bait.push(pick);log(`「${def(pick).name}」を裏向きのエサにした。`);}}
      }
    }else if(c.effect==='lightningStorm'||c.effect==='blastStorm'){
      const amount=c.effect==='lightningStorm'?1000:600,name=c.name;
      const hadCopy=visibleDiscardFrom(s).some(x=>def(x).type==='spell'&&def(x).name===name);
      let choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField(`${amount}ダメージを与える相手の虫を選んでください。`,choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      let dmg=await dealDamage(opp,target,amount,{source:inst,sourceSide:side,kind:'spell'});log(`「${name}」で「${fieldDef(target).name}」に${dmg}ダメージ。`);
      if(sideObj(opp).field.includes(target)&&target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
      if(hadCopy){
        choices=spellTargetCandidates(side,opp);
        if(choices.length){
          const second=side==='player'?await chooseField(`追加の${amount}ダメージを与える相手の虫を選んでください。`,choices,true):chooseBurnTargetCPU(choices);
          if(second){dmg=await dealDamage(opp,second,amount,{source:inst,sourceSide:side,kind:'spell'});log(`「${name}」の追加効果で「${fieldDef(second).name}」に${dmg}ダメージ。`);if(sideObj(opp).field.includes(second)&&second.damage>=maxHp(second))await attemptDestroyFieldCard(opp,second,'effect',null);}
        }
      }
    }else if(c.effect==='sacrificeReincarnation'){
      const choices=fieldActive(side).filter(fc=>ownerSideOf(fc.inst,side)===side);if(!choices.length)return false;
      target=await chooseOwnedField(side,'山札の一番下に置く自分の虫を選んでください。',choices);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      sideObj(side).field=sideObj(side).field.filter(x=>x!==target);
      const hadSeal=hasAttachment(target,'warriorSeal'),wasSilence=rawFieldPassive(target)?.type==='silenceAll';
      discardAttachmentsToOwners(target,side,'return');
      target.inst.faceDown=true;s.deck.push(target.inst);
      if(hadSeal||wasSilence)enforceAllAttachmentLegality();
      events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:target,reason:'deck'});
      log(`「贄虫の転生」で「${fieldDef(target).name}」を山札の一番下へ置いた。`);
      let guard=0;
      while(s.deck.length&&guard++<s.deck.length+20){
        const top=s.deck.shift();top.faceDown=true;
        if(def(top).type==='insect'){const fc=await putInsectOnField(side,top,{summonedBySpell:true});log(`「贄虫の転生」で「${fieldDef(fc).name}」を場に出した。`);break;}
        s.deck.push(top);
      }
    }else if(c.effect==='kodokuCycle'){
      if(!paySpell(side,inst,c,false))return false;
      inst.faceDown=true;s.deck.push(inst);
      const drawn=s.deck.shift();if(!drawn)return true;
      const dc=def(drawn);log(`「蠱毒の輪廻」で「${dc.name}」を公開した。`);
      if(dc.type==='insect'){
        await putInsectOnField(side,drawn,{summonedBySpell:true});
        log(`「蠱毒の輪廻」で「${dc.name}」を場に出した。`);
      }else if(dc.name==='蠱毒の輪廻'){
        drawn.faceDown=false;s.bait.push(drawn);log('公開した「蠱毒の輪廻」をエサ場に置いた。');
      }else{
        drawn.freeUse=true;s.hand.push(drawn);
        const canUse=canUseHandCard(side,drawn);
        let actionChoice='hand';
        const opts=[];
        if(canUse)opts.push({value:'use',title:'使用する',detail:'コストを支払わず使用'});
        opts.push({value:'bait',title:'エサ場に置く',detail:'表向きのエサ'});
        opts.push({value:'hand',title:'手札に加える',detail:''});
        if(side==='player')actionChoice=await choose(opts,`「${dc.name}」をどうしますか？`,'蠱毒の輪廻');
        else actionChoice=canUse?'use':'bait';
        if(actionChoice==='use'&&canUse){
          await playCardFromHand(side,drawn);
        }else if(actionChoice==='bait'){
          removeInstance(s.hand,drawn);drawn.faceDown=false;s.bait.push(drawn);log(`「${dc.name}」をエサ場に置いた。`);
        }else log(`「${dc.name}」を手札に加えた。`);
        delete drawn.freeUse;
      }
    }else if(c.effect==='intercept400'||c.effect==='intercept800'){
      const amount=c.effect==='intercept800'?800:400;
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField(`${amount}ダメージを与える相手の虫を選んでください。`,choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      const dmg=await dealDamage(opp,target,amount,{source:inst,sourceSide:side,kind:'spell'});
      log(`「${c.name}」で「${fieldDef(target).name}」に${dmg}ダメージ。`);
      if(target.damage>=maxHp(target)&&sideObj(opp).field.includes(target))await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='flowerDance'){
      if(!paySpell(side,inst,c))return false;
      const eligible=faceUpBait(side).some(x=>def(x).type==='insect'&&def(x).name.includes('（幼虫）'));
      if(eligible){
        const rec=flowerDanceRecord(side);if(rec.turnSeq!==state.turnSeq){rec.turnSeq=state.turnSeq;rec.count=0;}rec.count++;
        log(`「花蝶の幻舞」：対応する成虫のコストをこのターン-${rec.count*3}。`);
      }else log('「花蝶の幻舞」は条件を満たす幼虫のエサがなく、コスト軽減は発生しなかった。');
    }else if(c.effect==='compostSoil'){
      if(visibleDiscardFrom(s).length<2)return false;
      const first=await chooseOwnedInstance(side,'裏向きのエサにする捨て札（1枚目）を選んでください。',visibleDiscardFrom(s));if(!first)return false;
      const second=await chooseOwnedInstance(side,'裏向きのエサにする捨て札（2枚目）を選んでください。',visibleDiscardFrom(s).filter(x=>x.uid!==first.uid));if(!second)return false;
      if(!paySpell(side,inst,c))return false;
      for(const x of [first,second]){removeInstance(s.discard,x);x.faceDown=true;s.bait.push(x);}
      log('「腐葉の沃土」で捨て札2枚を裏向きのエサにした（このターンのコストは増えない）。');
    }else if(c.effect==='poisonFollowUp'){
      const list=fieldActive(side).filter(fc=>fc.attacked&&hasPoisonTechnique(fc));if(!list.length)return false;
      target=await chooseOwnedField(side,'もう一度攻撃できる毒の技を持つ虫を選んでください。',list);if(!target)return false;
      if(!paySpell(side,inst,c))return false;target.attacked=false;
      log(`「毒の追い打ち」で「${fieldDef(target).name}」がもう一度攻撃できる。`);
    }else if(c.effect==='poisonCurse'){
      const list=fieldActive(opp).filter(fc=>(fc.persistentDamage||0)>0);if(!list.length)return false;
      target=side==='player'?await chooseField('回復しないダメージを参照する相手の虫を選んでください。',list,true):list[0];if(!target)return false;
      const amount=Number(target.persistentDamage||0);if(!paySpell(side,inst,c))return false;
      for(const owner of ['player','cpu']){
        for(const fc of [...fieldActive(owner)]){
          if(!sideObj(owner).field.includes(fc))continue;
          const dmg=await dealDamage(owner,fc,amount,{source:inst,sourceSide:side,kind:'spell'});
          log(`「蠱毒の祟り」→「${fieldDef(fc).name}」に${dmg}ダメージ。`);
        }
      }
      for(const owner of ['player','cpu'])for(const fc of [...fieldActive(owner)])if(fc.damage>=maxHp(fc))await attemptDestroyFieldCard(owner,fc,'effect',null);
      state.forceEndAfterResolve=true;
    }else if(c.effect==='armorSmith'){
      let choices=visibleDiscardFrom(s).filter(x=>def(x).type==='enhance'&&/(甲冑|贋作)/.test(def(x).name));if(!choices.length)return false;
      if(!paySpell(side,inst,c))return false;
      let moved=0;
      while(moved<2&&choices.length){
        let pick=side==='player'?await chooseOwnedInstance(side,'手札に戻す「甲冑」または「贋作」を選んでください。',choices):choices[0];
        if(!pick)break;removeInstance(s.discard,pick);s.hand.push(pick);moved++;choices=choices.filter(x=>x.uid!==pick.uid);
        if(side==='player'&&moved===1&&choices.length&&!(await confirmYesNo('もう1枚手札に戻しますか？','甲冑の鍛冶')))break;
      }
      log(`「甲冑の鍛冶」で強化カードを${moved}枚手札に戻した。`);
    }else if(c.effect==='gongChant'){
      const pick=await chooseOwnEnhancement(side,'破壊する自分の強化カードを選んでください。');if(!pick)return false;
      const cost=effectiveCardCost(side,inst);if(!spendCost(side,inst,cost))return false;
      removeHand(s,inst);destroyAttachment(pick.fc,pick.att,side,'effect');inst.faceDown=false;s.bait.push(inst);
      log(`「鉦叩の歌念仏」で「${def(pick.att).name}」を破壊し、この術をエサ場に置いた。`);
    }else if(c.effect==='hellSword'){
      const list=fieldActive(side).filter(fc=>fc.attacked&&fc.attachments.length>0);if(!list.length)return false;
      target=await chooseOwnedField(side,'もう一度攻撃する虫を選んでください。',list);if(!target)return false;
      const att=await chooseOwnedInstance(side,'破壊する強化カードを選んでください。',target.attachments);if(!att)return false;
      if(!paySpell(side,inst,c))return false;destroyAttachment(target,att,side,'effect');target.attacked=false;
      log(`「閻魔虫の斬砕剣」で「${def(att).name}」を破壊し、「${fieldDef(target).name}」を攻撃可能にした。`);
    }else if(c.effect==='sealedGrudge'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('「封印の怨念」の対象を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      const amount=s.bait.filter(x=>x.faceDown).length*100,dmg=await dealDamage(opp,target,amount,{source:inst,sourceSide:side,kind:'spell',forceDamageEvent:true});
      log(`「封印の怨念」で「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='offeringSeal'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('「供物の封印」の対象を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      let count=0;
      while(faceUpBait(side).length){
        let use=side==='cpu'?true:await confirmYesNo(`表向きのエサを裏向きにしますか？ 現在${count}枚`,'供物の封印');if(!use)break;
        const chosen=await chooseOwnedInstance(side,'裏向きにするエサを選んでください。',faceUpBait(side));if(!chosen)break;chosen.faceDown=true;count++;
      }
      const dmg=await dealDamage(opp,target,count*200,{source:inst,sourceSide:side,kind:'spell',forceDamageEvent:true});
      log(`「供物の封印」で「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
    }else if(c.effect==='enhanceDanceCounter'||c.effect==='spellDanceCounter'){
      if(!paySpell(side,inst,c))return false;
      const rec=state.cardCounter[other(side)];
      if(c.effect==='enhanceDanceCounter')rec.enhanceTurn=nextOpponentTurnSeq(side);else rec.spellTurn=nextOpponentTurnSeq(side);
      log(`「${c.name}」により次の相手ターン最初の${c.effect==='enhanceDanceCounter'?'強化':'術'}カードを打ち消す。`);
    }else if(c.effect==='fiveColorRelease'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('400ダメージを与える相手の虫を選んでください。',choices,true):chooseBurnTargetCPU(choices);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      let dmg=await dealDamage(opp,target,400,{source:inst,sourceSide:side,kind:'spell'});log(`「五色の解放」で「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(opp,target,'effect',null);
      if(baitHasRGB(side)){
        const again=spellTargetCandidates(side,opp);
        if(again.length){const t2=side==='player'?await chooseField('もう1度400ダメージを与える虫を選んでください。',again,true):chooseBurnTargetCPU(again);if(t2){dmg=await dealDamage(opp,t2,400,{source:inst,sourceSide:side,kind:'spell'});log(`「五色の解放」2回目で「${fieldDef(t2).name}」に${dmg}ダメージ。`);if(t2.damage>=maxHp(t2))await attemptDestroyFieldCard(opp,t2,'effect',null);}}
      }
    }else if(c.effect==='jewelLegacy'){
      if(!paySpell(side,inst,c))return false;
      state.jewelLegacy[side].turnSeq=nextOpponentTurnSeq(side);
      log('「宝石虫の置き土産」を構えた。');
    }else if(c.effect==='eternalCocoon'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('山札の一番下に置く相手の虫を選んでください。',choices,true):cpuHardRemovalTarget(choices,true);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      const owner=ownerSideOf(target.inst,opp);removeInstance(sideObj(opp).field,target);discardAttachmentsToOwners(target,opp,'return');target.inst.faceDown=true;sideObj(owner).deck.push(target.inst);
      log(`「常闇の繭籠もり」で「${fieldDef(target).name}」を持ち主の山札の一番下に置いた。`);
    }else if(c.effect==='worshipGreatSword'){
      const insects=fieldActive(side).filter(fc=>fc.attacked);if(!insects.length)return false;
      target=await chooseOwnedField(side,'もう1度攻撃させる虫を選んでください。',insects);if(!target)return false;
      const choices=visibleDiscardFrom(s).filter(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=3&&canAttachEnhancement(target,x));if(!choices.length)return false;
      chosen=await chooseOwnedInstance(side,'捨て札からつける強化カードを選んでください。',choices);if(!chosen)return false;
      if(!paySpell(side,inst,c))return false;
      removeInstance(s.discard,chosen);target.attachments.push(chosen);chosen.expireTurn=state.turnSeq;await configureAttachedCard(side,target,chosen);target.attacked=false;
      log(`「拝虫の豪新剣」で「${def(chosen).name}」をつけ、「${fieldDef(target).name}」を再び攻撃可能にした。`);
    }else if(c.effect==='nextSpellDiscount'){
      if(!paySpell(side,inst,c))return false;
      const rec=state.nextSpellDiscount[side];if(rec.turnSeq!==state.turnSeq){rec.turnSeq=state.turnSeq;rec.count=0;}rec.count++;
      log(`「蟲術の息吹」により次に使う術カードのコスト-${rec.count}。`);
    }else if(c.effect==='halfDeathCompanion'){
      if(!paySpell(side,inst,c))return false;
      const own=await chooseHalfDeathVictims(side),enemy=await chooseHalfDeathVictims(opp);
      state.resolvingSpellUntargeted=true;
      try{
        for(const fc of own)if(sideObj(side).field.includes(fc))await attemptDestroyFieldCard(side,fc,'effect',null);
        for(const fc of enemy)if(sideObj(opp).field.includes(fc))await attemptDestroyFieldCard(opp,fc,'effect',null);
      }finally{state.resolvingSpellUntargeted=false;}
      log('「半死の道連れ」で双方の場の虫を半数（端数切り捨て）になるまで破壊した。');
    }else if(c.effect==='allField300End'||c.effect==='allField1200End'){
      const amount=c.effect==='allField1200End'?1200:300;if(!paySpell(side,inst,c))return false;
      const snapshots={player:[...fieldActive('player')],cpu:[...fieldActive('cpu')]};
      state.resolvingSpellUntargeted=true;
      try{
        for(const owner of ['player','cpu'])for(const fc of snapshots[owner]){
          if(!sideObj(owner).field.includes(fc))continue;
          const dmg=await dealDamage(owner,fc,amount,{source:inst,sourceSide:side,kind:'spell',targeted:false});
          log(`「${c.name}」→「${fieldDef(fc).name}」に${dmg}ダメージ。`);
        }
        for(const owner of ['player','cpu'])for(const fc of [...sideObj(owner).field])if(!fc.hidden&&fc.damage>=maxHp(fc))await attemptDestroyFieldCard(owner,fc,'effect',null);
      }finally{state.resolvingSpellUntargeted=false;}
      state.forceEndAfterResolve=true;
    }else if(c.effect==='sparkStorm'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      const hadCopy=visibleDiscard(side).some(x=>def(x).type==='spell'&&def(x).name===c.name&&x.uid!==inst.uid);
      if(!paySpell(side,inst,c))return false;
      const times=hadCopy?3:1;
      for(let n=0;n<times;n++){
        const targets=spellTargetCandidates(side,opp);if(!targets.length)break;
        const t=side==='player'?await chooseField(`「火花の嵐」${n+1}回目：100ダメージの対象を選んでください。`,targets,true):chooseBurnTargetCPU(targets);if(!t)break;
        const dmg=await dealDamage(opp,t,100,{source:inst,sourceSide:side,kind:'spell'});log(`「火花の嵐」→「${fieldDef(t).name}」に${dmg}ダメージ。`);
        if(sideObj(opp).field.includes(t)&&t.damage>=maxHp(t))await attemptDestroyFieldCard(opp,t,'effect',null);
      }
    }else if(c.effect==='pupaWintering'){
      const choices=s.hand.filter(x=>x.uid!==inst.uid);if(!choices.length)return false;
      chosen=await chooseOwnedInstance(side,'「蛹の冬籠り」で捨て札に置く手札を選んでください。',choices);if(!chosen)return false;
      if(!paySpell(side,inst,c))return false;removeInstance(s.hand,chosen);sendToOwnerDiscard(chosen,side);
      log(`「蛹の冬籠り」で「${def(chosen).name}」を捨て札に置いた。`);
    }else if(c.effect==='boundarySend'){
      const choices=spellTargetCandidates(side,opp);if(!choices.length)return false;
      target=side==='player'?await chooseField('「断界の虫送り」で相手のエサ場へ送る虫を選んでください。',choices,true):choices[0];if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      if(!consumeStinkShieldArmor(opp,target)){
        removeInstance(sideObj(opp).field,target);discardAttachmentsToOwners(target,opp,'return');
        resolveShadowMirrorSourceLeft(target.inst.uid);revealSpiritAwayBySource(target.inst.uid);
        target.inst.faceDown=true;target.inst.discardFaceDown=false;sideObj(opp).bait.push(target.inst);
        events.emit(EVENT.CARD_LEFT_FIELD,{state,side:opp,fieldCard:target,reason:'boundarySend'});
        log(`「断界の虫送り」で「${fieldDef(target).name}」を裏向きで相手のエサ場に置いた。`);
      }
    }else if(c.effect==='underworldGuide'){
      if(discardSummonBlocked())return false;
      const choices=visibleDiscard(side).filter(x=>def(x).type==='insect');if(!choices.length)return false;
      chosen=await chooseOwnedInstance(side,'「冥府の導き」で場に出す虫を選んでください。',choices);if(!chosen)return false;
      if(!paySpell(side,inst,c))return false;removeInstance(s.discard,chosen);
      const fc=await putInsectOnField(side,chosen,{summonedBySpell:true,underworldFaceDownTurn:state.turnSeq});
      log(`「冥府の導き」で「${fieldDef(fc).name}」を場に出した。ターン終了時に裏向きで捨て札へ置く。`);
    }else if(c.effect==='silkwormGag'){
      if(!paySpell(side,inst,c))return false;
      state.silkwormGag[opp].untilTurnSeq=nextOpponentTurnSeq(side);
      enforceAllAttachmentLegality();log('「蚕の口封じ」により次の相手ターン終了時まで相手の虫は場所を問わず＜＞の技を失う。');
    }else if(c.effect==='goldenArm'){
      const list=fieldActive(side).filter(fc=>legalSpellTarget(fc,side));if(!list.length)return false;
      target=await chooseOwnedField(side,'「金色の腕」で体力を上げる虫を選んでください。',list);if(!target)return false;
      if(!paySpell(side,inst,c))return false;
      const value=spellModifierValue(target,800);
      Engine.addModifier(target,{stat:'hp',value,expiresAfterTurnSeq:nextOpponentTurnSeq(side)});
      log(`「金色の腕」で「${fieldDef(target).name}」の体力+${value}（次の相手ターン終了時まで）。`);
    }else return false;

    if(side==='cpu'){render();await cpuNotice(`「${c.name}」を使用`);}
    return true;
  }

  function availableAttacks(side,fc){
    const list=(fieldDef(fc).attacks||[]).map(a=>({...a}));
    if(passiveOfField(fc)?.type==='militaryLink'){
      for(const otherFc of fieldActive(side)){
        if(otherFc===fc||passiveOfField(otherFc)?.type!=='militaryLink')continue;
        for(const a of fieldDef(otherFc).attacks||[])list.push({...a,borrowedFrom:otherFc.inst.uid});
      }
    }
    if(passiveOfField(fc)?.type==='antCopy'){
      for(const otherFc of fieldActive(side)){
        if(otherFc===fc||Number(def(otherFc.inst).cost||0)>2||!isAntFamily(otherFc.inst))continue;
        for(const a of fieldDef(otherFc).attacks||[])list.push({...a,borrowedFrom:otherFc.inst.uid});
      }
    }
    const seen=new Set();
    return list.filter(a=>{
      const key=`${a.name}|${a.effect||''}|${a.power||0}`;
      if(seen.has(key))return false;seen.add(key);return true;
    });
  }

  async function onFieldCard(uid){
    if(state.busy||state.turn!=='player'||state.phase!=='main')return;
    const fc=state.player.field.find(x=>x.inst.uid===uid);if(!fc||!canAttack(fc))return;
    const c=fieldDef(fc);
    let attacks=availableAttacks('player',fc).filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('player',fc,a));
    if(state.chain?.side==='player'&&state.chain.uid===fc.inst.uid&&state.chain.kind==='mantisCombo')attacks=attacks.filter(a=>a.effect==='mantisCombo');
    if(state.chain?.side==='player'&&state.chain.uid===fc.inst.uid&&state.chain.kind==='mantisOrchidDance')attacks=attacks.filter(a=>a.effect==='mantisOrchidDance'&&fc.attachments.length>0);
    const options=attacks.map((a,i)=>({value:i,title:`${a.name} ${attackPower('player',fc,a)}`,detail:a.text||'攻撃'}));
    options.push({value:null,title:'やめる',detail:''});
    const idx=await choose(options,'使う技を選んでください。','虫の攻撃');if(idx===null)return;
    await performAttack('player',fc,attacks[idx]);
  }

  async function dealDamage(targetSide,target,amount,ctx={}){
    const incoming=Math.max(0,Number(amount||0));
    let actual=incoming;
    const p=passiveOfField(target);

    if(ctx.kind==='attack'&&p?.type==='poisonBody'&&String(ctx.attack?.name||'').includes('毒')){
      actual=0;
      log(`＜毒の体＞ 「${fieldDef(target).name}」は毒の技のダメージを0にした。`);
    }

    if(ctx.kind==='spell'&&ctx.sourceSide&&ctx.sourceSide!==targetSide){
      if(ctx.targeted!==false&&consumeStinkShieldArmor(targetSide,target)){actual=0;}
      else if(spellDamageDestroyImmune(targetSide,target)){
        actual=0;
        log(`「${fieldDef(target).name}」は相手の術カードのダメージを0にした。`);
      }else if(p?.type==='spellResistance'){
        const src=ctx.source?.inst||ctx.source;
        const spellName=src&&def(src)?.name;
        const same=spellName&&['player','cpu'].some(owner=>visibleDiscard(owner).some(x=>x.uid!==src.uid&&def(x).type==='spell'&&def(x).name===spellName));
        if(same){actual=0;log(`＜耐性＞ 「${fieldDef(target).name}」は「${spellName}」のダメージを0にした。`);}
      }
    }

    if(actual>0&&hasAttachment(target,'blueJade')&&target.blueJadeUsedTurn!==state.turnSeq){
      target.blueJadeUsedTurn=state.turnSeq;actual=0;
      log(`「肉祓いの蒼玉」で「${fieldDef(target).name}」がこのターン最初のダメージを0にした。`);
    }

    if((actual>0||ctx.forceDamageEvent)&&p?.type==='undyingDance'&&target.damageShieldUsedTurn!==state.turnSeq){
      target.damageShieldUsedTurn=state.turnSeq;
      actual=0;
      log(`＜不死蝶の舞＞ 「${fieldDef(target).name}」がこのターン最初のダメージを0にした。`);
    }

    if((actual>0||ctx.forceDamageEvent)&&target.spiderWebTurn===state.turnSeq&&target.spiderWebUsedTurn!==state.turnSeq){
      target.spiderWebUsedTurn=state.turnSeq;
      actual=0;
      log(`「蜘蛛の巣」で「${fieldDef(target).name}」への最初のダメージを0にした。`);
    }
    if(actual>0&&ctx.kind==='attack'&&target.redOgreWebTurn===state.turnSeq&&target.redOgreWebUsedTurn!==state.turnSeq){
      target.redOgreWebUsedTurn=state.turnSeq;actual=0;
      log(`「赤鬼の巣」で「${fieldDef(target).name}」への最初の攻撃ダメージを0にした。`);
    }
    if(actual>0&&ctx.kind==='spell'&&target.blueOgreWebTurn===state.turnSeq&&target.blueOgreWebUsedTurn!==state.turnSeq){
      target.blueOgreWebUsedTurn=state.turnSeq;actual=0;
      log(`「青鬼の巣」で「${fieldDef(target).name}」への最初の術ダメージを0にした。`);
    }

    if(incoming>0&&ctx.kind==='attack'){
      const cuts=target.attachments.filter(a=>def(a).effect==='zeroAttackDamageOnce');
      if(cuts.length){
        target.attachments=target.attachments.filter(a=>def(a).effect!=='zeroAttackDamageOnce');
        for(const a of cuts)sendToOwnerDiscard(a,targetSide);
        actual=0;
        log(`「蚰蜒の足切り」で「${fieldDef(target).name}」への攻撃ダメージを0にした。`);
      }
    }

    events.emit(EVENT.BEFORE_DAMAGE,{state,target,targetSide,amount:actual,...ctx});
    if(actual>0&&ctx.sourceSide)target.pendingDamageSourceSide=ctx.sourceSide;
    target.damage+=actual;
    if(ctx.kind==='attack'&&ctx.attack?.effect==='persistentDamage'&&actual>0){
      target.persistentDamage=(target.persistentDamage||0)+actual;
    }
    events.emit(EVENT.AFTER_DAMAGE,{state,target,targetSide,amount:actual,...ctx});
    if(actual>0&&target.nextDamageDestroy&&sideObj(targetSide).field.includes(target)){
      target.nextDamageDestroy=false;
      log(`「猛毒のキバ」の効果で、次にダメージを受けた「${fieldDef(target).name}」を破壊する。`);
      await attemptDestroyFieldCard(targetSide,target,'effect',null);
    }
    if(target.mucusCurse&&sideObj(targetSide).field.includes(target)){
      target.mucusCurse=false;
      log(`＜自爆粘液＞ ダメージを受けた「${fieldDef(target).name}」を破壊する。`);
      await attemptDestroyFieldCard(targetSide,target,'effect',null);
    }
    return actual;
  }

  async function applyAttackDamage(side,fc,target,attack,base){
    const defenderSide=other(side);
    const noWeak=hasAttachment(target,'noWeakness')||hasAttachment(target,'longhornJaw')||(passiveOfField(target)?.type==='whiteShell'&&target.whiteShellTurn===state.turnSeq)||target.hardenTurn===state.turnSeq;
    const mult=noWeak?1:(attack.effect==='kingHorn'?2:weaknessMultiplier(effectiveColor(fc),effectiveColor(target)));
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
    const att=await chooseOwnedInstance(side,'つけ替える強化カードを選んでください。',fc.attachments);if(!att)return;
    const dests=fieldActive(side).filter(x=>x!==fc&&canAttachEnhancement(x,att));if(!dests.length)return;
    const dest=await chooseOwnedField(side,'強化カードのつけ替え先を選んでください。',dests);if(!dest)return;
    if(def(att).effect==='imitation'&&!await configureImitation(side,att,dest))return;
    removeInstance(fc.attachments,att);dest.attachments.push(att);
    if(def(att).effect==='shadowDoubleMirror'||def(att).effect==='puppetCordyceps'){refreshCordycepsSuppression(fc);refreshCordycepsSuppression(dest);}
    enforceAttachmentLegality(fc,side);enforceAttachmentLegality(dest,side);log(`「${def(att).name}」を「${fieldDef(dest).name}」につけ替えた。`);
  }
  async function chooseOwnEnhancement(side,text){
    const all=allOwnEnhancements(side);if(!all.length)return null;
    if(side==='cpu')return all[0];
    const value=await choose(all.map((x,i)=>({value:i,title:def(x.att).name,detail:`装着先：${fieldDef(x.fc).name}`})),text,'強化カード');
    return value===null?null:all[value];
  }
  async function flipOpponentBait(side,maxCount,title){
    const defender=other(side);let left=maxCount;
    while(left>0){
      const available=sideObj(defender).bait.filter(isFaceUpBait);if(!available.length)break;
      let chosen=null;
      if(side==='player'){
        const opts=available.map(x=>({value:x.uid,title:def(x).name,detail:'裏向きにする'}));
        opts.push({value:null,title:'ここで終了',detail:''});
        const uid=await choose(opts,'裏向きにする相手のエサを選んでください。',title);
        if(uid===null)break;chosen=available.find(x=>x.uid===uid);
      }else chosen=available[0];
      if(!chosen)break;chosen.faceDown=true;left--;
      log(`「${def(chosen).name}」を裏向きのエサにした。`);
    }
  }
  async function configureImitation(side,att,host){
    const choices=allOwnEnhancements(side).filter(x=>x.att.uid!==att.uid);
    if(!choices.length)return false;
    let source=choices[0];
    if(side==='player'){
      const idx=await choose(choices.map((x,i)=>({value:i,title:def(x.att).name,detail:`装着先：${fieldDef(x.fc).name}`})),'蠱術の贋作で写す強化カードを選んでください。','蠱術の贋作');
      if(idx===null)return false;source=choices[idx];
    }
    const mod=attachmentModifier(source.att);
    att.copyAttack=mod.attack;att.copyHp=mod.hp;att.copySourceUid=source.att.uid;
    log(`「蠱術の贋作」は「${def(source.att).name}」の修正値を写した。`);
    return true;
  }
  async function applyAttackUseSetup(side,fc,attack){
    if(attack.effect==='redOgreWeb'){
      fc.redOgreWebTurn=nextOpponentTurnSeq(side);fc.redOgreWebUsedTurn=0;
      log(`「${fieldDef(fc).name}」は赤鬼の巣を張った。`);
    }
    if(attack.effect==='blueOgreWeb'){
      fc.blueOgreWebTurn=nextOpponentTurnSeq(side);fc.blueOgreWebUsedTurn=0;
      log(`「${fieldDef(fc).name}」は青鬼の巣を張った。`);
    }
    if(attack.effect==='spellTaxTwoNext'){
      const rec=state.firstSpellTax[other(side)];rec.turnSeq=nextOpponentTurnSeq(side);rec.count=(rec.count||0)+2;rec.used=false;
      log(`「シャチホコ威嚇」により次の相手ターン、最初の術カードのコスト+2。`);
    }

    if(attack.effect==='banditArm'){
      const hand=sideObj(other(side)).hand;
      if(hand.length){
        const chosen=hand[Math.floor(Math.random()*hand.length)];
        removeInstance(hand,chosen);
        if(def(chosen).type==='insect'){
          await putInsectOnField(other(side),chosen);
          log(`「盗賊の大腕」で相手の手札から「${def(chosen).name}」を相手の場に出した。`);
        }else{
          chosen.faceDown=false;sideObj(other(side)).bait.push(chosen);
          log(`「盗賊の大腕」で相手の手札から「${def(chosen).name}」を相手のエサ場に置いた。`);
        }
      }
    }
    if(attack.effect==='baitFlipOnce')await flipOpponentBait(side,1,'花粉食い');
    if(attack.effect==='dungRoll'){
      const pile=sideObj(other(side)).discard;
      if(pile.length){
        let use=true;if(side==='player')use=await confirmYesNo('相手の捨て札1枚を山札の一番下に戻しますか？','フンコロガシ');
        if(use){
          const chosen=await chooseOwnedInstance(side,'山札の一番下に戻す相手の捨て札を選んでください。',pile);
          if(chosen){
            removeInstance(pile,chosen);chosen.faceDown=true;sideObj(other(side)).deck.push(chosen);
            log(`「フンコロガシ」で「${def(chosen).name}」を相手の山札の一番下に戻した。`);
          }
        }
      }
    }
    if(attack.effect==='mimicColorAttack'){
      const others=fieldActive(side).filter(x=>x!==fc);if(!others.length)return false;
      const chosen=await chooseOwnedField(side,'擬態する色の虫を選んでください。',others);if(!chosen)return false;
      fc.turnColorOverride=effectiveColor(chosen);fc.turnColorOverrideTurn=state.turnSeq;enforceAttachmentLegality(fc,side);
      log(`「${fieldDef(fc).name}」は「${fieldDef(chosen).name}」の色を擬態した。`);
    }
    if(attack.effect==='spiderWeb'){
      fc.spiderWebTurn=nextOpponentTurnSeq(side);fc.spiderWebUsedTurn=0;
      log(`「${fieldDef(fc).name}」は蜘蛛の巣を張った。`);
    }
    if(attack.effect==='nextOwnAttack'){
      Engine.addModifier(fc,{stat:'attack',value:Number(attack.value||0),activeFromTurnSeq:state.turnSeq+2,expiresAfterTurnSeq:state.turnSeq+2});
      log(`「${fieldDef(fc).name}」は次の自分のターン攻撃力+${Number(attack.value||0)}。`);
    }
    if(attack.effect==='forcedTargetNext'){
      fc.forcedAttackTargetTurn=nextOpponentTurnSeq(side);
      log(`「${fieldDef(fc).name}」の橋渡し。次の相手ターンはこの虫が攻撃先になる。`);
    }
    if(attack.effect==='spellTaxNextTurn'){
      const opp=other(side),turn=nextOpponentTurnSeq(side);
      const rec=state.spellTax[opp];
      if(rec.turnSeq!==turn){rec.turnSeq=turn;rec.count=0;}
      rec.count++;
      log(`次の${sideName(opp)}のターン、術カードのコストが+1。`);
    }
    if(attack.effect==='flipOwnBaitUpAttack'){
      const available=sideObj(side).bait.filter(x=>x.faceDown);
      if(available.length){
        let use=true;if(side==='player')use=await confirmYesNo('「発光」で裏向きのエサを1枚表向きにしますか？','発光');
        if(use){
          const chosen=await chooseOwnedInstance(side,'表向きにするエサを選んでください。',available);
          if(chosen){chosen.faceDown=false;log(`「発光」で「${def(chosen).name}」を表向きにした。`);}
        }
      }
    }
    if(attack.effect==='weakPoison'){
      const defender=other(side),available=sideObj(defender).bait.filter(isFaceUpBait);
      if(available.length){
        let use=true;
        if(side==='player')use=await confirmYesNo('＜弱毒針＞で相手のエサを1枚裏向きにしますか？','弱毒針');
        if(use){
          const chosen=side==='player'?await chooseInstances('裏向きにする相手のエサを選んでください。',available):available[0];
          if(chosen){chosen.faceDown=true;log(`＜弱毒針＞ 「${def(chosen).name}」をダメージ前に裏向きにした。`);}
        }
      }
    }
    await resolveStateBasedDestructions('effect');
    return true;
  }
  async function hungryLarvaDiscard(victimSide,sourceSide){
    const ss=sideObj(victimSide),opts=[];
    ss.hand.forEach(x=>opts.push({value:`h:${x.uid}`,title:def(x).name,detail:'手札'}));
    ss.bait.forEach(x=>opts.push({value:`b:${x.uid}`,title:x.faceDown?'裏向きのエサ':def(x).name,detail:'エサ場'}));
    ss.territory.forEach((x,i)=>opts.push({value:`t:${x.uid}`,title:`縄張り ${i+1}`,detail:'縄張り'}));
    if(!opts.length)return false;
    let value;
    if(victimSide==='player')value=await choose(opts,'＜はらぺこ＞で捨て札に置くカードを1枚選んでください。','はらぺこ');
    else value=(opts.find(x=>x.value.startsWith('h:'))||opts.find(x=>x.value.startsWith('b:'))||opts[0]).value;
    if(value==null)return false;
    const [zone,uidText]=String(value).split(':'),uid=Number(uidText);let card=null;
    if(zone==='h')card=removeInstance(ss.hand,ss.hand.find(x=>x.uid===uid));
    else if(zone==='b')card=removeInstance(ss.bait,ss.bait.find(x=>x.uid===uid));
    else card=removeInstance(ss.territory,ss.territory.find(x=>x.uid===uid));
    if(card){sendToOwnerDiscard(card,victimSide);log(`＜はらぺこ＞ ${sideName(victimSide)}は1枚を捨て札に置いた。`);return true;}
    return false;
  }

  async function applyAfterTerritoryAttackEffect(side,fc,attack,drew){
    if(!drew)return;
    if(sideObj(side).field.includes(fc)&&passiveOfField(fc)?.type==='hungryLarva'&&sideObj(side).bait.length>=6){
      await hungryLarvaDiscard(other(side),side);
    }
    if(attack.effect==='corpseEating'){
      const choices=visibleDiscard(other(side)).filter(x=>def(x).type==='insect');
      if(choices.length){
        let use=side==='cpu'?true:await confirmYesNo('「屍喰らい」で相手の捨て札の虫を山札の一番下へ戻しますか？','屍喰らい');
        if(use){const chosen=await chooseOwnedInstance(side,'戻す虫を選んでください。',choices);if(chosen){removeInstance(sideObj(other(side)).discard,chosen);chosen.faceDown=true;sideObj(other(side)).deck.push(chosen);log(`「屍喰らい」で「${def(chosen).name}」を山札の一番下に戻した。`);}}
      }
    }
    if(attack.effect==='growthOnTerritory'&&sideObj(side).field.includes(fc)){
      const value=Number(attack.value||0);
      Engine.addModifier(fc,{stat:'attack',value});
      Engine.addModifier(fc,{stat:'hp',value});
      log(`「${fieldDef(fc).name}」の攻撃力と体力が+${value}。`);
    }
    if(attack.effect==='flipBaitOnTerritory'){
      const defender=other(side),available=sideObj(defender).bait.filter(isFaceUpBait);
      if(available.length){
        let use=true;
        if(side==='player')use=await confirmYesNo('相手のエサを1枚裏向きにしますか？','シロガネタックル');
        if(use){
          const chosen=side==='player'?await chooseInstances('裏向きにする相手のエサを選んでください。',available):available[0];
          if(chosen){chosen.faceDown=true;log(`「${def(chosen).name}」を裏向きのエサにした。`);}
        }
      }
    }
    if(attack.effect==='handDiscardAfterTerritory'){
      await discardOneHand(other(side),'激痛針で捨てる手札を選んでください。',side);
    }
    if(attack.effect==='superPainNeedle'&&sideObj(other(side)).hand.length>=6){
      await discardOneHand(other(side),'「超激痛針」で捨てる手札（1枚目）を選んでください。',side);
      if(sideObj(other(side)).hand.length)await discardOneHand(other(side),'「超激痛針」で捨てる手札（2枚目）を選んでください。',side);
    }
    if(attack.effect==='redBite'){
      const available=sideObj(side).bait.filter(x=>x.faceDown&&def(x).type==='insect'&&def(x).color==='red');
      for(let n=0;n<2&&available.some(x=>x.faceDown);n++){
        const choices=available.filter(x=>x.faceDown);if(!choices.length)break;
        let use=true;if(side==='player')use=await confirmYesNo('「赤咬み」で裏向きの赤のエサを表向きにしますか？','赤咬み');
        if(!use)break;
        const chosen=await chooseOwnedInstance(side,'表向きにする赤のエサを選んでください。',choices);if(!chosen)break;
        chosen.faceDown=false;log(`「赤咬み」で「${def(chosen).name}」を表向きにした。`);
      }
    }
    if(attack.doubleTerritoryActive){
      log('「大顎二刀」の効果でさらに縄張りを1枚引かせる。');
      await takeTerritory(other(side),false,{effectDraw:true});
    }
    if(attack.effect==='earPinch'&&sideObj(other(side)).territory.length>=5){
      sideObj(side).cost+=1;log(`「耳バサミ」で${sideName(side)}にコスト1が発生した。`);
    }
    if(attack.effect==='sapAbsorbBlue'){
      const defender=other(side),available=sideObj(defender).bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect'&&baitCardColor(x)==='blue');
      if(available.length){
        let use=true;if(side==='player')use=await confirmYesNo('「樹液吸収」で相手の青のエサの虫を裏返しますか？','樹液吸収');
        if(use){const chosen=await chooseOwnedInstance(side,'裏向きにする青のエサを選んでください。',available);if(chosen){chosen.faceDown=true;log(`「樹液吸収」で「${def(chosen).name}」を裏向きにした。`);}}
      }
    }
    if(attack.effect==='sapAbsorbChain'){
      const defender=other(side),available=sideObj(defender).bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect');
      if(available.length){
        let use=true;if(side==='player')use=await confirmYesNo('「樹液吸収」で相手のエサの虫を裏返しますか？','樹液吸収');
        if(use){
          const first=await chooseOwnedInstance(side,'最初に裏向きにするエサの虫を選んでください。',available);
          if(first){const wasBlue=baitCardColor(first)==='blue';first.faceDown=true;log(`「樹液吸収」で「${def(first).name}」を裏向きにした。`);
            if(wasBlue){const blues=sideObj(defender).bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect'&&baitCardColor(x)==='blue');if(blues.length){const second=await chooseOwnedInstance(side,'さらに裏向きにする青のエサを選んでください。',blues);if(second){second.faceDown=true;log(`さらに「${def(second).name}」を裏向きにした。`);}}}
          }
        }
      }
    }
  }
  async function useTimePupaFree(side){
    const pupa=sideObj(side).hand.find(x=>def(x).effect==='summonWithAttachment');
    if(!pupa)return false;
    const insects=sideObj(side).hand.filter(x=>x.uid!==pupa.uid&&def(x).type==='insect');if(!insects.length)return false;
    let use=true;if(side==='player')use=await confirmYesNo('「黄金蛹」で口寄せの時蛹をコストなしで使用しますか？','黄金蛹');
    if(!use)return false;
    const chosen=await chooseOwnedInstance(side,'口寄せの時蛹で場に出す虫を選んでください。',insects);if(!chosen)return false;
    removeInstance(sideObj(side).hand,pupa);removeInstance(sideObj(side).hand,chosen);pupa.expireTurn=state.turnSeq+1;
    const summoned=await putInsectOnField(side,chosen,{attachments:[pupa],summonedByTimePupa:true});
    log(`「黄金蛹」→「口寄せの時蛹」で「${fieldDef(summoned).name}」を場に出した。`);
    return true;
  }
  function canDragonUseCardOnHost(side,inst,host){
    const c=def(inst);
    if(c.type==='enhance')return !['summonWithAttachment','silverThread','blackSilverThread'].includes(c.effect)&&canAttachEnhancement(host,inst)&&(c.effect!=='imitation'||allOwnEnhancements(side).length>0);
    if(c.type!=='spell')return false;
    if(c.effect==='singleAttack500'||c.effect==='hideOwn'||c.effect==='spellShield'||c.effect==='readyAttack')return true;
    if(c.effect==='swapDiscardField')return visibleDiscard(side).some(x=>def(x).type==='insect');
    if(c.effect==='sameCostSwap')return sideObj(side).hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&Number(def(x).cost||0)===Number(fieldDef(host).cost||0));
    if(c.effect==='poisonFollowUp')return host.attacked&&hasPoisonTechnique(host);
    if(c.effect==='hellSword')return host.attacked&&host.attachments.length>0;
    if(c.effect==='swordDanceAttach')return faceUpBait(side).some(x=>canSwordDanceAttach(side,x)&&canAttachEnhancement(host,x));
    return false;
  }
  async function dragonUseFreeOnHost(side,host){
    const choices=sideObj(side).hand.filter(x=>canDragonUseCardOnHost(side,x,host));
    if(!choices.length)return false;
    let use=true;if(side==='player')use=await confirmYesNo('「ドラゴン蟷螂拳」で手札の強化・術カードをコストなしで使用しますか？','ドラゴン蟷螂拳');
    if(!use)return false;
    const inst=await chooseOwnedInstance(side,'使用するカードを選んでください。',choices);if(!inst)return false;
    const c=def(inst);removeInstance(sideObj(side).hand,inst);
    if(c.type==='enhance'){
      if(c.effect==='grudgeJinbaori'){
        while(faceUpBait(side).length){
          let flip=side==='cpu'?false:await confirmYesNo('「ドラゴン蟷螂拳」で怨念の陣羽織を使用します。表向きのエサを裏向きにしますか？','怨念の陣羽織');
          if(!flip)break;
          const bait=await chooseOwnedInstance(side,'裏向きにするエサを選んでください。',faceUpBait(side));if(!bait)break;bait.faceDown=true;
        }
      }
      emitCost(side,inst,c,0);
      if(await shouldCounterCardUse(side,inst,0)){sideObj(side).discard.push(inst);log(`「ドラゴン蟷螂拳」で使用した「${c.name}」は打ち消された。`);return true;}
      if(c.effect==='imitation'&&!await configureImitation(side,inst,host)){sideObj(side).hand.push(inst);return false;}
      host.attachments.push(inst);await configureAttachedCard(side,host,inst);
      log(`「ドラゴン蟷螂拳」で「${c.name}」を「${fieldDef(host).name}」に使用した。`);return true;
    }
    emitCost(side,inst,c,0);triggerImmatureOnSpell(side);
    if(await shouldCounterCardUse(side,inst,0)){sideObj(side).discard.push(inst);log(`「ドラゴン蟷螂拳」で使用した「${c.name}」は打ち消された。`);return true;}
    sideObj(side).discard.push(inst);
    if(c.effect==='singleAttack500')host.turnAttackBonus=(host.turnAttackBonus||0)+500;
    else if(c.effect==='hideOwn'){host.hidden=true;host.hiddenUntilTurnSeq=nextOpponentTurnSeq(side);}
    else if(c.effect==='spellShield')host.spellShieldUntilTurnSeq=nextOpponentTurnSeq(side);
    else if(c.effect==='readyAttack'||c.effect==='poisonFollowUp')host.attacked=false;
    else if(c.effect==='swapDiscardField'){
      const choices=visibleDiscard(side).filter(x=>def(x).type==='insect');
      const incoming=await chooseOwnedInstance(side,'「叛逆の蛮勇」で捨て札から場に出す虫を選んでください。',choices);
      if(incoming&&sideObj(side).field.includes(host)){
        removeInstance(sideObj(side).discard,incoming);
        const hadSeal=hasAttachment(host,'warriorSeal'),wasSilence=rawFieldPassive(host)?.type==='silenceAll';
        sideObj(side).field=sideObj(side).field.filter(x=>x!==host);
        sendToOwnerDiscard(host.inst,side);discardAttachmentsToOwners(host,side);
        if(hadSeal||wasSilence)enforceAllAttachmentLegality();
        await putInsectOnField(side,incoming,{noAttackThisTurn:true,summonedBySpell:true});
        events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:host,reason:'swap'});
        log(`「叛逆の蛮勇」で「${fieldDef(host).name}」を捨て札の「${def(incoming).name}」と入れ替えた。`);
      }
    }else if(c.effect==='sameCostSwap'){
      const choices=sideObj(side).hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect'&&Number(def(x).cost||0)===Number(fieldDef(host).cost||0));
      const incoming=await chooseOwnedInstance(side,'「繚乱の足掻き」で場に出す同コストの虫を選んでください。',choices);
      if(incoming&&sideObj(side).field.includes(host)){
        removeInstance(sideObj(side).hand,incoming);
        const hadSeal=hasAttachment(host,'warriorSeal'),wasSilence=rawFieldPassive(host)?.type==='silenceAll';
        sideObj(side).field=sideObj(side).field.filter(x=>x!==host);
        discardAttachmentsToOwners(host,side);sendToOwnerHand(host.inst,side);
        if(hadSeal||wasSilence)enforceAllAttachmentLegality();
        await putInsectOnField(side,incoming,{noAttackThisTurn:true,summonedBySpell:true});
        events.emit(EVENT.CARD_LEFT_FIELD,{state,side,fieldCard:host,reason:'swap'});
        log(`「繚乱の足掻き」で「${fieldDef(host).name}」を手札の「${def(incoming).name}」と入れ替えた。`);
      }
    }else if(c.effect==='hellSword'){
      const att=await chooseOwnedInstance(side,'破壊する強化カードを選んでください。',host.attachments);if(att){destroyAttachment(host,att,side,'effect');host.attacked=false;}
    }else if(c.effect==='swordDanceAttach'){
      let attached=0;
      const firstAvail=faceUpBait(side).filter(x=>canSwordDanceAttach(side,x)&&canAttachEnhancement(host,x));
      if(firstAvail.length){
        const first=await chooseOwnedInstance(side,'オオカレエダカマキリにつける強化カードを選んでください。',firstAvail);
        if(first){removeInstance(sideObj(side).bait,first);host.attachments.push(first);await configureAttachedCard(side,host,first);attached++;}
      }
      if(attached){
        const avail=faceUpBait(side).filter(x=>canSwordDanceAttach(side,x));
        if(avail.length){
          let use=true;if(side==='player')use=await confirmYesNo('剣舞天翔の刹那でもう1枚強化カードをつけますか？','剣舞天翔の刹那');
          if(use){const second=await chooseOwnedInstance(side,'2枚目の強化カードを選んでください。',avail);if(second){const targets=fieldActive(side).filter(x=>canAttachEnhancement(x,second));if(targets.length){const dest=await chooseOwnedField(side,'2枚目のつけ先を選んでください。',targets);removeInstance(sideObj(side).bait,second);dest.attachments.push(second);await configureAttachedCard(side,dest,second);}}}
        }
      }
    }
    log(`「ドラゴン蟷螂拳」で「${c.name}」をコストなしで使用した。`);
    return true;
  }

  async function finishAttackSpecialState(side,fc,attack){
    if(attack.effect==='gigasSlasher'&&sideObj(side).field.includes(fc)){
      fc.gigasLockTurn=state.turnSeq+2;log(`「ギガスラッシャー」により「${fieldDef(fc).name}」は次の自分のターン攻撃できない。`);
    }
    if(attack.effect==='spiritAway'&&sideObj(side).field.includes(fc)){
      const choices=fieldActive(side);
      if(choices.length){
        const chosen=side==='player'
          ? await chooseField('「神隠し」で裏向きにする自分の虫を選んでください。',choices,false)
          : await chooseOwnedField(side,'「神隠し」で裏向きにする自分の虫を選んでください。',choices);
        if(chosen){chosen.hidden=true;chosen.hiddenUntilTurnSeq=nextOpponentTurnSeq(side);chosen.spiritAwaySourceUid=fc.inst.uid;log(`「神隠し」で「${fieldDef(chosen).name}」を裏向きにした。`);}
      }
    }
    if(attack.effect==='decomposeDiscard'){
      let n=0;
      while(n<2){
        const choices=visibleDiscard(side);if(!choices.length)break;
        let use=side==='cpu'?true:await confirmYesNo('「分解」で表向きの捨て札を裏向きにしますか？','分解');if(!use)break;
        const chosen=await chooseOwnedInstance(side,'裏向きにする捨て札を選んでください。',choices);if(!chosen)break;
        chosen.discardFaceDown=true;n++;
      }
      if(n)log(`「分解」で捨て札を${n}枚裏向きにした。`);
    }
    if(attack.effect==='returnEnhanceAfterAttack'&&attack.lastTarget&&sideObj(other(side)).field.includes(attack.lastTarget)&&attack.lastTarget.attachments.length){
      let use=side==='cpu'?true:await confirmYesNo('「カブト戻し」で相手の強化カードを手札に戻しますか？','カブト戻し');
      if(use){
        const target=attack.lastTarget;
        const att=side==='player'?await chooseOwnedInstance(side,'手札に戻す強化カードを選んでください。',target.attachments):target.attachments[0];
        if(att){
          removeInstance(target.attachments,att);revealHairpinTarget(att);sendToOwnerHand(att,other(side));
          if(def(att).effect==='shadowDoubleMirror'||def(att).effect==='puppetCordyceps')refreshCordycepsSuppression(target);
          enforceAttachmentLegality(target,other(side));log(`「カブト戻し」で「${def(att).name}」を持ち主の手札に戻した。`);
        }
      }
    }

    if(attack.effect==='queenOviposition'&&sideObj(side).field.includes(fc)){
      const choices=faceUpBait(side).filter(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=5&&/バチ/.test(def(x).name));
      if(choices.length){
        let use=side==='cpu'?true:await confirmYesNo('「神の産卵」でエサ場の〜バチ科の虫を裏向きで場に出しますか？','神の産卵');
        if(use){
          const chosen=await chooseOwnedInstance(side,'場に出す〜バチ科の虫を選んでください。',choices);
          if(chosen){
            removeInstance(sideObj(side).bait,chosen);
            const baby=newFieldCard(chosen);baby.hidden=true;baby.queenHatchTurn=state.turnSeq+2;baby.enteredTurnSeq=state.turnSeq;
            sideObj(side).field.push(baby);
            log(`「神の産卵」で「${def(chosen).name}」を裏向きで場に出した。`);
          }
        }
      }
    }
    if(attack.effect==='antennaWhip'&&sideObj(side).field.includes(fc)){
      const choices=faceUpBait(side).filter(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=3&&canAttachEnhancement(fc,x));
      if(choices.length){
        let use=side==='cpu'?true:await confirmYesNo('「触角の鞭」でエサ場の強化カードをこの虫につけますか？','触角の鞭');
        if(use){
          const att=await chooseOwnedInstance(side,'つける強化カードを選んでください。',choices);
          if(att){removeInstance(sideObj(side).bait,att);fc.attachments.push(att);await configureAttachedCard(side,fc,att);log(`「触角の鞭」で「${def(att).name}」をつけた。`);}
        }
      }
    }
    if(attack.effect==='bottomEnemyDiscard'){
      const choices=visibleDiscard(other(side)).filter(x=>def(x).type==='insect');
      if(choices.length){
        let use=side==='cpu'?true:await confirmYesNo('相手の捨て札の虫を山札の一番下に戻しますか？','盆トンボ');
        if(use){const chosen=await chooseOwnedInstance(side,'山札の一番下に戻す虫を選んでください。',choices);if(chosen){removeInstance(sideObj(other(side)).discard,chosen);chosen.faceDown=true;sideObj(other(side)).deck.push(chosen);log(`「盆トンボ」で「${def(chosen).name}」を山札の一番下に戻した。`);}}
      }
    }
    if(attack.effect==='mossWrap'&&sideObj(side).field.includes(fc)){
      fc.mossMultiplier=Number(fc.mossMultiplier||1)*2;
      log(`「コケまとい」で「${fieldDef(fc).name}」の元々の体力と攻撃力が2倍になった。`);
    }
    if(attack.effect==='charmingWing'&&sideObj(side).field.includes(fc)){
      await takeTerritory(side,false,{effectDraw:true});
      state.forceEndAfterAttack=true;
      log('「魅惑の翅」により、この攻撃後にターンを終了する。');
    }

    if(attack.effect==='poisonMistBomb'&&sideObj(side).field.includes(fc)){
      const amount=Number(attack.power||0);
      await attemptDestroyFieldCard(side,fc,'effect',null);
      const targets=fieldActive(other(side));
      if(targets.length){
        const target=side==='player'?await chooseField(`「毒霧爆弾」で${amount}ダメージを与える相手の虫を選んでください。`,targets,true):chooseBurnTargetCPU(targets);
        if(target){const dmg=await dealDamage(other(side),target,amount,{source:fc,sourceSide:side,kind:'effect'});log(`「毒霧爆弾」で「${fieldDef(target).name}」に${dmg}ダメージ。`);if(target.damage>=maxHp(target))await attemptDestroyFieldCard(other(side),target,'effect',null);}
      }
    }
    if(attack.effect==='goldenPupa')await useTimePupaFree(side);
    if(attack.effect==='dragonMantisFist'&&sideObj(side).field.includes(fc))await dragonUseFreeOnHost(side,fc);
    if(attack.effect==='attackTurnsGreen'&&sideObj(side).field.includes(fc)){
      fc.turnColorOverride='green';fc.turnColorOverrideTurn=state.turnSeq;
      log(`「${fieldDef(fc).name}」は攻撃後、このターン緑になった。`);
    }
    if(attack.effect==='hideUntilOpponentEnd'&&sideObj(side).field.includes(fc)){
      fc.hidden=true;fc.hiddenUntilTurnSeq=nextOpponentTurnSeq(side);
      log(`「${fieldDef(fc).name}」は＜かくれる＞で次の相手ターン終了時まで裏向きになった。`);
    }
    if(attack.effect==='growthAfterAttack'&&sideObj(side).field.includes(fc)){
      const value=Number(attack.value||300);Engine.addModifier(fc,{stat:'attack',value});Engine.addModifier(fc,{stat:'hp',value});
      log(`「${fieldDef(fc).name}」の攻撃力と体力が+${value}。`);
    }
    if(sideObj(side).field.includes(fc))enforceAttachmentLegality(fc,side);
  }
  function moveDestroyedToDeckBottom(target,defender){
    const owner=ownerSideOf(target.inst,defender),pile=sideObj(owner).discard;
    const card=removeInstance(pile,target.inst);
    if(!card)return false;
    card.faceDown=true;sideObj(owner).deck.push(card);
    log(`「軍配虫の大団扇」で「${fieldDef(target).name}」を持ち主の山札の一番下へ置いた。`);
    return true;
  }
  async function applyAttackerDestroyRouting(side,fc,target,attack){
    const fan=sideObj(side).field.includes(fc)&&hasAttachment(fc,'militaryFan');
    const puppet=attack.effect==='puppetNeedle';
    if(fan&&puppet){
      let first='fan';
      if(side==='player'){
        first=await choose([
          {value:'fan',title:'軍配虫の大団扇',detail:'山札の一番下へ'},
          {value:'puppet',title:'操り針',detail:'自分の場へ出す'}
        ],'同時に使える効果の順番を選んでください。','破壊時効果');
      }
      if(first==='puppet'){await captureDestroyedInsect(side,target);moveDestroyedToDeckBottom(target,other(side));}
      else{moveDestroyedToDeckBottom(target,other(side));await captureDestroyedInsect(side,target);}
    }else if(fan)moveDestroyedToDeckBottom(target,other(side));
    else if(puppet)await captureDestroyedInsect(side,target);
  }
  async function resolveMantisSickle(side,fc){
    if(!sideObj(side).field.includes(fc))return;
    const count=fc.attachments.filter(a=>def(a).effect==='mantisSickle').length;
    const defender=other(side);
    for(let n=0;n<count;n++){
      const choices=fieldActive(defender);if(!choices.length)break;
      const chosen=await chooseOwnedField(defender,'「蟷螂の大鎌」で破壊する自分の虫を選んでください。',choices);
      if(chosen){
        await attemptDestroyFieldCard(defender,chosen,'effect',null);
        log(`「蟷螂の大鎌」で「${fieldDef(chosen).name}」を破壊した。`);
      }
    }
  }
  async function resolveDestroyedAttackTarget(side,fc,target,attack){
    const defender=other(side),p=passiveOfField(target);

    await applyAttackerDestroyRouting(side,fc,target,attack);
    await resolveMantisSickle(side,fc);
    if(attack.effect==='ovipositWasp'){
      const choices=visibleDiscard(side).filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name));
      if(choices.length){
        let use=true;if(side==='player')use=await confirmYesNo('「産みつける」で捨て札の〜バチ科の虫を手札に戻しますか？','産みつける');
        if(use){const chosen=await chooseOwnedInstance(side,'手札に戻す〜バチ科の虫を選んでください。',choices);if(chosen){removeInstance(sideObj(side).discard,chosen);sideObj(side).hand.push(chosen);log(`「産みつける」で「${def(chosen).name}」を手札に戻した。`);}}
      }
    }
    await resolveAttackDestructionReaction(defender,target,fc);
    await resolveStateBasedDestructions('effect');

    if(attack.effect==='growthOnKill'&&sideObj(side).field.includes(fc)){
      const value=Number(attack.value||200);Engine.addModifier(fc,{stat:'attack',value});Engine.addModifier(fc,{stat:'hp',value});
      log(`「${fieldDef(fc).name}」の攻撃力と体力が+${value}。`);
    }

    for(const predator of [...fieldActive(defender)].filter(x=>passiveOfField(x)?.type==='predation')){
      log(`＜捕食＞ 「${fieldDef(predator).name}」の効果で${sideName(side)}が縄張りを1枚引く。`);
      await takeTerritory(side,false,{effectDraw:true});
    }

    let shouldDraw=!attack.redSwordActive;
    if(!shouldDraw)log('「草薙の紅剣」の効果で、この攻撃では縄張りを引かない。');
    if(shouldDraw&&p?.type==='skipTerritoryChoice'){
      if(defender==='player'){
        shouldDraw=!(await confirmYesNo('＜毒蛾の毛針＞で縄張りを引かないことを選びますか？','毒蛾の毛針'));
      }else{
        shouldDraw=false;
        log('CPUは＜毒蛾の毛針＞で縄張りを引かないことを選んだ。');
      }
    }

    let drew=false;
    if(shouldDraw){
      const suppress=attack.effect==='blockFlyOutAttack';
      drew=await takeTerritory(defender,false,{attacker:fc,suppressFlyOut:suppress,jumpOutFamily:p?.type==='jumpOut'?'grasshopper':(p?.type==='cicadaJumpOut'?'cicada':null)});
      await applyAfterTerritoryAttackEffect(side,fc,attack,drew);
    }else if(p?.type==='skipTerritoryChoice')log(`${sideName(defender)}は＜毒蛾の毛針＞で縄張りを引かなかった。`);
    return drew;
  }

  function attackTargetsForTechnique(side,attack){
    let targets=attackableTargets(side);
    if(attack.effect==='targetHasEnhance')targets=targets.filter(fc=>fc.attachments.length>0);
    if(attack.effect==='highCostTarget')targets=targets.filter(fc=>Number(fieldDef(fc).cost||0)>=Number(attack.minCost||5));
    if(attack.effect==='damagedTarget')targets=targets.filter(fc=>fc.damage>0);
    if(attack.effect==='hawkEye')targets=targets.filter(fc=>!!passiveOfField(fc));
    if(attack.effect==='maxCostTarget'||attack.effect==='bounceLowCost')targets=targets.filter(fc=>Number(fieldDef(fc).cost||0)<=Number(attack.maxCost??1));
    if(attack.effect==='colorlessTargetOnce'||attack.effect==='monochromeNeedle')targets=targets.filter(fc=>effectiveColor(fc)==='colorless');
    return targets;
  }
  async function performReverseSwap(side,fc,attack){
    const defender=other(side);
    const fieldChoices=attackableTargets(side);
    const baitChoices=sideObj(defender).bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect');
    if(!fieldChoices.length||!baitChoices.length)return false;

    const outgoing=side==='player'
      ? await chooseField('逆立ち返しでエサ場へ送る相手の虫を選んでください。',fieldChoices,true)
      : chooseAttackTargetCPU(fc,attack,fieldChoices);
    if(!outgoing)return false;
    const incoming=await chooseOwnedInstance(side,'逆立ち返しで場に出す相手のエサの虫を選んでください。',baitChoices);
    if(!incoming)return false;

    if(!await applyAttackUseSetup(side,fc,attack))return false;
    fc.attacked=true;events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,target:outgoing,attack});

    sideObj(defender).field=sideObj(defender).field.filter(x=>x!==outgoing);
    discardAttachmentsToOwners(outgoing,defender,'swap');
    sendToOwnerBait(outgoing.inst,defender);
    events.emit(EVENT.CARD_LEFT_FIELD,{state,side:defender,fieldCard:outgoing,reason:'swap'});
    removeInstance(sideObj(defender).bait,incoming);
    const newTarget=await putInsectOnField(defender,incoming);
    log(`「逆立ち返し」で「${fieldDef(outgoing).name}」とエサの「${def(incoming).name}」を入れ替えた。`);

    if(sideObj(defender).field.includes(newTarget)){
      const base=attackPower(side,fc,attack);
      const {dmg,mult}=await applyAttackDamage(side,fc,newTarget,attack,base);
      log(`逆立ち返しの処理後、「${fieldDef(newTarget).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
      if(newTarget.damage>=maxHp(newTarget)){
        const destroyed=await attemptDestroyFieldCard(defender,newTarget,'attack',fc);
        if(destroyed)await resolveDestroyedAttackTarget(side,fc,newTarget,attack);
      }
    }
    render();return true;
  }

  function currentAttackTax(side){
    const rec=state.attackTax?.[side];
    return rec&&rec.turnSeq===state.turnSeq?Number(rec.count||0):0;
  }

  async function performAttack(side,fc,attack){
    if(state.over||fc.hidden||isAttackBlocked(side,fc))return false;
    const tax=currentAttackTax(side);
    if(tax>sideObj(side).cost)return false;
    if(tax>0){sideObj(side).cost-=tax;log(`「砂鉄の砂嵐」により攻撃コスト${tax}を支払った。`);}
    const isChainAttack=state.chain?.side===side&&state.chain?.uid===fc.inst.uid;
    attack.redSwordActive=hasAttachment(fc,'redSword');
    attack.doubleTerritoryActive=attack.effect==='doubleTerritory'&&fc.attachments.length>0;
    let cpuAttackSummary='',sacrificeName='';

    if(attack.effect==='cannibal'){
      const sacrifices=fieldActive(side).filter(x=>x!==fc);if(!sacrifices.length)return false;
      const sac=await chooseOwnedField(side,'「共食い」で破壊する自分の虫を選んでください。',sacrifices);if(!sac)return false;
      sacrificeName=fieldDef(sac).name;await attemptDestroyFieldCard(side,sac,'sacrifice',null);
      log(`${sideName(side)}は共食いのため「${sacrificeName}」を破壊した。`);
    }
    if(attack.effect==='baitSacrifice'){
      const available=sideObj(side).bait.filter(isFaceUpBait);if(!available.length)return false;
      const bait=await chooseOwnedInstance(side,'「イナゴの大群」で破壊するエサを選んでください。',available);if(!bait)return false;
      removeInstance(sideObj(side).bait,bait);sendToOwnerDiscard(bait,side);log(`「${def(bait).name}」をエサ場から破壊した。`);
    }
    if(attack.effect==='sacrificeEnhanceAttack'){
      const pick=await chooseOwnEnhancement(side,'「ゆりかご落とし」で破壊する強化カードを選んでください。');if(!pick)return false;
      destroyAttachment(pick.fc,pick.att,side,'effect');
      log(`「ゆりかご落とし」のため「${def(pick.att).name}」を破壊した。`);
    }

    if(attack.effect==='hardenNext'){
      fc.attacked=true;events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,target:null,attack});
      fc.hardenTurn=nextOpponentTurnSeq(side);log(`「かたくなる」により次の相手ターン、術の対象にならず弱点2倍を受けない。`);
      render();return true;
    }

    if(attack.effect==='materialGather'){
      fc.attacked=true;events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,target:null,attack});
      log(`「素材集め」！ ダメージ前に「${fieldDef(fc).name}」を破壊する。`);
      await attemptDestroyFieldCard(side,fc,'effect',null);
      sideObj(side).cost+=1;log(`${sideName(side)}にコスト1が発生した。`);render();return true;
    }

    if(attack.effect==='reverseSwap')return performReverseSwap(side,fc,attack);

    if(attack.effect==='longArmMusou'){
      const candidates=attackableTargets(side);
      const pairs=[];
      for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(effectiveColor(candidates[i])===effectiveColor(candidates[j]))pairs.push([candidates[i],candidates[j]]);
      if(!pairs.length)return false;
      let targets;
      if(side==='player'){
        const first=await chooseField('「テナガ無双」の1体目を選んでください。',candidates.filter(a=>candidates.some(b=>b!==a&&effectiveColor(a)===effectiveColor(b))),true);if(!first)return false;
        const second=await chooseField('同じ色の2体目を選んでください。',candidates.filter(x=>x!==first&&effectiveColor(x)===effectiveColor(first)),true);if(!second)return false;
        targets=[first,second];
      }else targets=pairs.sort((a,b)=>((fieldDef(b[0]).name===fieldDef(b[1]).name)?1:0)-((fieldDef(a[0]).name===fieldDef(a[1]).name)?1:0))[0];
      if(!await applyAttackUseSetup(side,fc,attack))return false;
      fc.attacked=true;if(oncePerEntryEffect(attack.effect))fc.usedAttacks.add(attack.name);
      events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,targets,attack});
      const bonus=fieldDef(targets[0]).name===fieldDef(targets[1]).name?500:0;
      for(const target of targets){
        if(!sideObj(side).field.includes(fc)||!sideObj(other(side)).field.includes(target))continue;
        const {dmg,mult}=await applyAttackDamage(side,fc,target,attack,attackPower(side,fc,attack)+bonus);
        log(`「テナガ無双」→「${fieldDef(target).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
        if(!sideObj(other(side)).field.includes(target))continue;
        let destroyed=false;
        if(target.damage>=maxHp(target))destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
        if(destroyed)await resolveDestroyedAttackTarget(side,fc,target,attack);
      }
      await finishAttackSpecialState(side,fc,attack);render();
      if(!isChainAttack&&attack.redSwordActive&&sideObj(side).field.includes(fc)){
        state.chain={side,uid:fc.inst.uid,kind:'redSword'};
        if(side==='cpu'){await sleep(300);const nextAttack=chooseAttackCPU(fc);if(nextAttack)await performAttack(side,fc,nextAttack);state.chain=null;}
        else message('草薙の紅剣！ この虫でもう1度だけ、すぐに攻撃できます。');
      }else if(state.chain?.uid===fc.inst.uid)state.chain=null;
      return true;
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
        if(!sideObj(other(side)).field.includes(target))break;
        const {dmg,mult}=await applyAttackDamage(side,fc,target,attack,attackPower(side,fc,attack));
        log(`「${fieldDef(fc).name}」の「${attack.name}」→「${fieldDef(target).name}」に${dmg}ダメージ${mult===2?'（弱点2倍）':''}。`);
        let destroyed=false;
        if(target.poisonBubbleTurn===state.turnSeq&&sideObj(other(side)).field.includes(target)){
          destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
          if(destroyed)log('＜毒の泡＞の効果で破壊された。');
        }else if(target.damage>=maxHp(target)){
          destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
        }
        if(destroyed){
          if(side==='cpu'){render();await cpuNotice(`${attack.name} → 「${fieldDef(target).name}」を破壊`);}
          await resolveDestroyedAttackTarget(side,fc,target,attack);
        }
      }
      await finishAttackSpecialState(side,fc,attack);render();return true;
    }

    let targets=attackTargetsForTechnique(side,attack),target=null;
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
    attack.lastTarget=target||null;
    events.emit(EVENT.ATTACK_DECLARED,{state,side,attacker:fc,target,attack});
    fc.attacked=true;
    if(target&&attack.effect==='hawkEye')target.hawkEyeSuppressedTurn=state.turnSeq;
    if(target&&attack.effect==='nextDamageDestroy')target.nextDamageDestroy=true;
    if(oncePerEntryEffect(attack.effect))fc.usedAttacks.add(attack.name);

    if(target&&attack.effect==='monochromeNeedle'&&target.damage>0){
      const destroyed=await attemptDestroyFieldCard(other(side),target,'attack',fc);
      if(destroyed){log(`「モノクロ針」で「${fieldDef(target).name}」を破壊した。`);await resolveDestroyedAttackTarget(side,fc,target,attack);}
      await finishAttackSpecialState(side,fc,attack);render();return true;
    }

    if(attack.effect==='paradiseEclosion'){
      const destroyed=await attemptDestroyFieldCard(side,fc,'effect',null);
      const adults=visibleDiscard(side).filter(x=>def(x).name==='ゴクラクトリバネアゲハ');
      if(adults.length){
        let chosen=await chooseOwnedInstance(side,'「極楽羽化」で場に出すゴクラクトリバネアゲハを選んでください。',adults);
        if(chosen){removeInstance(sideObj(side).discard,chosen);await putInsectOnField(side,chosen);log('「極楽羽化」でゴクラクトリバネアゲハを場に出した。');}
      }
      if(destroyed){render();return true;}
    }

    if(target&&attack.effect==='breakTargetEnhance'&&target.attachments.length){
      const att=side==='player'?await chooseOwnedInstance(side,'「ヒメカブト投げ」で破壊する相手の強化カードを選んでください。',target.attachments):target.attachments[0];
      if(att){destroyAttachment(target,att,other(side),'effect');log(`「ヒメカブト投げ」で「${def(att).name}」をダメージ前に破壊した。`);}
    }

    if(!target){
      log(`${sideName(side)}の「${fieldDef(fc).name}」が${attack.name}で直接攻撃！`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「${attack.name}」で直接攻撃`;
      if(side==='cpu'){render();await cpuNotice(cpuAttackSummary);cpuAttackSummary='';}
      if(attack.effect==='directBaitReturn')await chooseBaitToReturn(other(side));
      if(attack.effect==='hpNextTurn')await applyNextTurnHp(fc,attack.value);
      if(attack.effect==='selfDestruct'&&sideObj(side).field.includes(fc))await attemptDestroyFieldCard(side,fc,'effect',null);
      let drew=false;
      if(attack.redSwordActive&&sideObj(other(side)).territory.length>0){
        log('「草薙の紅剣」の効果で、この直接攻撃では縄張りを引かない。');
      }else drew=await takeTerritory(other(side),true,{attacker:fc,suppressFlyOut:attack.effect==='blockFlyOutAttack'});
      await applyAfterTerritoryAttackEffect(side,fc,attack,drew);
    }else if(attack.effect==='flip'){
      target.hidden=true;target.hiddenUntilTurnSeq=state.turnSeq;
      log(`${sideName(side)}の「すくい投げ」！ 「${fieldDef(target).name}」をターン終了まで裏返した。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「すくい投げ」→「${fieldDef(target).name}」を裏返した`;
    }else if(attack.effect==='bounceOnce'||attack.effect==='bounceLowCost'){
      const name=fieldDef(target).name;leaveFieldToHand(other(side),target);
      log(`「${name}」を手札に戻した。`);
      cpuAttackSummary=`「${fieldDef(fc).name}」の「${attack.name}」 → 「${name}」を手札へ`;
    }else{
      if(attack.effect==='rainbowColor'){
        const color=side==='player'?await chooseSimple('相手の虫を何色にしますか？',[['red','赤'],['blue','青'],['green','緑']]):bestColorAgainstCPU(fc,other(side));
        for(const x of fieldActive(other(side))){x.turnColorOverride=color;x.turnColorOverrideTurn=state.turnSeq;enforceAttachmentLegality(x,other(side));}
      }
      if(attack.effect==='sourceAttackLock'||attack.effect==='sourceAttackLockPersistent'){
        target.attackLocks=target.attackLocks||[];target.attackLocks.push({turnSeq:state.turnSeq+1,sourceUid:fc.inst.uid,sourceSide:side,persistent:attack.effect==='sourceAttackLockPersistent'});
      }
      if(attack.effect==='moveEnhanceAttack')await moveEnhanceByAttack(side,fc);
      if(attack.effect==='stinkHorn'){target.attackPenaltyTurn=state.turnSeq+1;target.attackPenalty=Number(attack.value||400);}
      if(attack.effect==='hpNextTurn')await applyNextTurnHp(fc,attack.value);

      let destroyed=false;
      let base=attackPower(side,fc,attack);
      if(attack.effect==='bonusVsEnhanced'&&target.attachments.length)base+=Number(attack.value||300);
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
          if(side==='cpu'){render();await cpuNotice(cpuAttackSummary+' → 破壊');cpuAttackSummary='';}
          await resolveDestroyedAttackTarget(side,fc,target,attack);
        }
      }
    }

    await finishAttackSpecialState(side,fc,attack);
    render();
    if(side==='cpu'&&cpuAttackSummary)await cpuNotice(cpuAttackSummary);
    if(state.over)return true;
    if(state.forceEndAfterAttack){
      state.forceEndAfterAttack=false;state.chain=null;state.busy=false;await endTurn();return true;
    }
    if(!isChainAttack&&attack.redSwordActive&&sideObj(side).field.includes(fc)){
      state.chain={side,uid:fc.inst.uid,kind:'redSword'};
      if(side==='cpu'){await sleep(300);const nextAttack=chooseAttackCPU(fc);if(nextAttack)await performAttack(side,fc,nextAttack);state.chain=null;}
      else message('草薙の紅剣！ この虫でもう1度だけ、すぐに攻撃できます。');
    }else if(!isChainAttack&&attack.effect==='mantisCombo'&&sideObj(side).field.includes(fc)&&opponentHasFieldInsect(side)){
      state.chain={side,uid:fc.inst.uid,kind:'mantisCombo'};
      if(side==='cpu'){await sleep(300);const nextAttack=chooseMantisSecondAttackCPU(fc);if(nextAttack)await performAttack(side,fc,nextAttack);state.chain=null;}
      else message('カマ連撃！ この虫でもう1度だけ、すぐに攻撃できます。');
    }else if(!isChainAttack&&attack.effect==='mantisOrchidDance'&&sideObj(side).field.includes(fc)&&fc.attachments.length>0&&opponentHasFieldInsect(side)){
      state.chain={side,uid:fc.inst.uid,kind:'mantisOrchidDance'};
      if(side==='cpu'){await sleep(300);const nextAttack=availableAttacks(side,fc).find(a=>a.effect==='mantisOrchidDance'&&usableAttack(side,fc,a));if(nextAttack)await performAttack(side,fc,nextAttack);state.chain=null;}
      else message('蟷螂蘭舞！ 強化カードがついているなら、もう1度だけ同じ技で攻撃できます。');
    }else if(state.chain?.uid===fc.inst.uid)state.chain=null;
    render();return true;
  }

  async function takeTerritory(side,isDirect,options={}){
    const ss=sideObj(side);
    if(!ss.territory.length){
      if(isDirect)finishGame(other(side),`${sideName(side)}の縄張りは0。直接攻撃が通り、${sideName(other(side))}の勝ち！`);
      else log(`${sideName(side)}の縄張りは0なので、縄張りは引きません。`);
      return false;
    }
    if(fieldActive(side).some(fc=>hasAttachment(fc,'noTerritory'))){
      log(`「不滅の王台」の効果で${sideName(side)}は縄張りを引かない。`);return false;
    }
    const moon=state.moonlight?.[side];
    if(!options.forceDraw&&moon?.active&&moon.turnSeq===state.turnSeq){
      let skip=side==='cpu'?true:await confirmYesNo('＜月光＞で今回の縄張りを引かないことを選びますか？','月光');
      if(skip){log(`＜月光＞ ${sideName(side)}は今回の縄張りを引かなかった。`);return false;}
    }

    const mistDefense=ss.territory.find(x=>x.poisonMistDefenseActive);
    if(mistDefense){
      removeInstance(ss.territory,mistDefense);mistDefense.poisonMistDefenseActive=false;mistDefense.faceUpTerritory=false;sendToOwnerDiscard(mistDefense,side);
      log(`＜毒霧防御＞ 「${def(mistDefense).name}」を捨て札に置き、縄張りを引く処理を防いだ。`);render();return false;
    }

    let idx;
    if(side==='player'){
      const opts=ss.territory.map((x,i)=>({value:i,title:`縄張り ${i+1}`,detail:x.faceUpTerritory?def(x).name:'裏向きのカード'}));
      idx=await choose(opts,'縄張りを1枚選んで手札に加えます。','縄張り');if(idx===null)idx=0;
    }else idx=Math.floor(Math.random()*ss.territory.length);

    const [drawn]=ss.territory.splice(idx,1),c=def(drawn);
    events.emit(EVENT.TERRITORY_DRAWN,{state,side,card:drawn,definition:c});
    log(`${sideName(side)}が縄張りを1枚引いた。`);

    const drawnPassive=passiveOfInst(drawn);
    if(c.type==='insect'&&drawnPassive?.type==='poisonJuiceTerritory'&&options.attacker&&fieldActive(other(side)).includes(options.attacker)){
      let use=side==='cpu'?true:await confirmYesNo(`＜毒汁噴出＞で攻撃した虫に${Number(drawnPassive.value||0)}ダメージを与えますか？`,'毒汁噴出');
      if(use){
        sendToOwnerDiscard(drawn,side);
        const attacker=options.attacker,amount=Number(drawnPassive.value||0);
        const dmg=await dealDamage(other(side),attacker,amount,{source:drawn,sourceSide:side,kind:'effect'});
        log(`＜毒汁噴出＞ 「${fieldDef(attacker).name}」に${dmg}ダメージ。`);
        if(sideObj(other(side)).field.includes(attacker)&&attacker.damage>=maxHp(attacker))await attemptDestroyFieldCard(other(side),attacker,'effect',null);
        render();return true;
      }
    }

    if(c.type==='insect'&&drawnPassive?.type==='emeraldFlash'&&options.attacker&&!options.effectDraw){
      let use=side==='cpu'?true:await confirmYesNo(`＜エメラルドフラッシュ＞で「${c.name}」を見せて手札に加え、さらに縄張りを1枚引きますか？`,'エメラルドフラッシュ');
      if(use){
        sendToOwnerHand(drawn,side);log(`＜エメラルドフラッシュ＞ 「${c.name}」を手札に加え、もう1枚縄張りを引く。`);
        await takeTerritory(side,false,{effectDraw:true});render();return true;
      }
    }

    // トゲ擬態の攻撃力上昇は擬態期間が終わった後も残る。
    if(state.turn===other(side)){
      for(const fc of fieldActive(side)){
        const p=passiveOfField(fc);
        if(p?.type==='thornMimic'){
          Engine.addModifier(fc,{stat:'attack',value:Number(p.value||300)});
          log(`＜トゲ擬態＞ 「${fieldDef(fc).name}」の攻撃力が+300。`);
        }
      }
    }

    // 飛蝗の待ち伏せは縄張りが0になった瞬間に終了し、後から縄張りが増えても復帰しない。
    const amb=state.grasshopperAmbush?.[side];
    if(amb?.active&&ss.territory.length===0){amb.active=false;amb.ended=true;log('「飛蝗の待ち伏せ」の効果が終了した。');}

    if(drawn.faceUpTerritory){
      sendToOwnerDiscard(drawn,side);
      log('「蜜蝋の壁」は捨て札に置かれた。');render();return true;
    }

    if(c.type==='insect'&&passiveOfInst(drawn)?.type==='moonlight'){
      let use=true;if(side==='player')use=await confirmYesNo(`引いた「${c.name}」を＜月光＞で捨て札に置き、このターン縄張りを引かない選択を可能にしますか？`,'月光');
      if(use){sendToOwnerDiscard(drawn,side);state.moonlight[side]={active:true,turnSeq:state.turnSeq};log('＜月光＞ このターン、縄張りを引くたびに引かないことを選べる。');render();return true;}
    }

    if(c.type==='insect'&&passiveOfInst(drawn)?.type==='poisonMistDefense'){
      let use=true;if(side==='player')use=await confirmYesNo(`引いた「${c.name}」を＜毒霧防御＞で縄張りに置きますか？`,'毒霧防御');
      if(use){drawn.poisonMistDefenseActive=true;drawn.faceUpTerritory=true;ss.territory.push(drawn);log(`＜毒霧防御＞ 「${c.name}」を表向きで縄張りに置いた。`);render();return true;}
    }

    if(c.type==='insect'&&passiveOfInst(drawn)?.type==='woodRound'){
      let use=true;if(side==='player')use=await confirmYesNo(`引いた「${c.name}」を＜木回り＞でエサ場に置きますか？`,'木回り');
      if(use){drawn.faceDown=false;ss.bait.push(drawn);log(`＜木回り＞ 「${c.name}」をエサ場に置いた。`);render();return true;}
    }

    if((c.effect==='intercept400'||c.effect==='intercept800')&&options.attacker&&sideObj(other(side)).field.includes(options.attacker)&&legalSpellTarget(options.attacker,side)){
      let use=true;if(side==='player')use=await confirmYesNo(`＜迎撃＞で「${fieldDef(options.attacker).name}」に${c.effect==='intercept800'?800:400}ダメージを与えますか？`,'迎撃');
      if(use){
        sendToOwnerDiscard(drawn,side);triggerImmatureOnSpell(side);
        const previous=state.resolvingSpellSide;state.resolvingSpellSide=side;
        try{
          const amount=c.effect==='intercept800'?800:400;
          const dmg=await dealDamage(other(side),options.attacker,amount,{source:drawn,sourceSide:side,kind:'spell'});
          log(`＜迎撃＞ 「${fieldDef(options.attacker).name}」に${dmg}ダメージ。`);
          if(sideObj(other(side)).field.includes(options.attacker)&&options.attacker.damage>=maxHp(options.attacker))await attemptDestroyFieldCard(other(side),options.attacker,'effect',null);
        }finally{state.resolvingSpellSide=previous;}
        render();return true;
      }
    }

    if(c.type==='enhance'&&c.territorySpecial&&c.effect==='blackSilverThread'&&visibleDiscardFrom(ss).some(x=>def(x).type==='insect')){
      let use=true;if(side==='player')use=await confirmYesNo('＜特殊装着＞で「黒銀蜘蛛の糸」を使用しますか？','特殊装着');
      if(use){const ok=await summonWithBlackSilverThread(side,drawn,c,true);if(ok){render();return true;}}
    }

    if(options.jumpOutFamily&&c.type==='insect'&&((options.jumpOutFamily==='grasshopper'&&grasshopperFamily(drawn))||(options.jumpOutFamily==='cicada'&&isCicadaCard(drawn)))){
      let use=true;if(side==='player')use=await confirmYesNo(`＜とびでる＞で「${c.name}」を場に出しますか？`,'とびでる');
      if(use){const fc=await putInsectOnField(side,drawn);log(`＜とびでる＞ 「${fieldDef(fc).name}」を場に出した。`);render();return true;}
    }

    // ＜かばう＞は＜とびだす＞とは別の縄張り誘発。
    if(c.type==='insect'&&passiveOfInst(drawn)?.type==='cover'){
      let use=true;
      if(side==='player')use=await confirmYesNo(`引いた「${c.name}」を＜かばう＞で場に出しますか？`,'かばう');
      if(use){
        const fc=await putInsectOnField(side,drawn);
        if(sideObj(side).field.includes(fc)){
          fc.forcedAttackTargetTurn=state.turnSeq;
          fc.coverReturnTurn=state.turnSeq;
          log(`＜かばう＞！ 「${c.name}」を場に出した。ターン終了時に手札へ戻る。`);
          if(side==='cpu')await cpuNotice(`縄張りから「${c.name}」が＜かばう＞で場に出た`);
        }
        render();return true;
      }
    }

    // ＜装着＞は縄張りから引いた直後、表向きで存在する自分の虫につけられる。
    if(c.type==='enhance'&&c.territoryAttach){
      const targets=fieldActive(side).filter(fc=>canAttachEnhancement(fc,drawn));
      if(targets.length){
        let use=true;if(side==='player')use=await confirmYesNo(`＜装着＞で「${c.name}」を場の虫につけますか？`,'装着');
        if(use){
          const target=await chooseOwnedField(side,'＜装着＞のつけ先を選んでください。',targets);
          if(target){
            target.attachments.push(drawn);
            log(`＜装着＞ 「${c.name}」を「${fieldDef(target).name}」につけた。`);
            render();return true;
          }
        }
      }
    }

    const attacker=options.attacker;
    const attachmentBlock=attacker&&sideObj(other(side)).field.includes(attacker)&&hasAttachment(attacker,'blockFlyOut');
    const smokeBlock=state.noFlyOutSide===side&&state.noFlyOutTurn===state.turnSeq;
    const suppressFlyOut=!!options.suppressFlyOut||attachmentBlock||smokeBlock;
    if(hasFlyOutAbility(side,drawn)&&!hasFlyOutOnField(side)&&!suppressFlyOut){
      let use=true;
      if(side==='player')use=await confirmChoice(`引いたカードは「${c.name}」。＜とびだす＞で場に出しますか？`,'とびだす！');
      if(use){
        const fc=await putInsectOnField(side,drawn);
        log(`＜とびだす＞！ ${sideName(side)}の「${c.name}」が場に出た。`);render();
        if(side==='cpu')await cpuNotice(`縄張りから「${c.name}」が＜とびだす＞で場に出た`);
        return true;
      }
    }
    ss.hand.push(drawn);render();return true;
  }

  async function endTurn(){
    if(state.over||state.busy||state.chain)return;
    state.busy=true;
    try{
      events.emit(EVENT.TURN_END,{state,side:state.turn,turnSeq:state.turnSeq,turnNo:state.turnNo});

      for(const controller of ['player','cpu']){
        for(const card of [...sideObj(controller).territory]){
          if(card.poisonMistDefenseActive){
            removeInstance(sideObj(controller).territory,card);card.poisonMistDefenseActive=false;card.faceUpTerritory=false;sendToOwnerDiscard(card,controller);
            log(`ターン終了。＜毒霧防御＞の「${def(card).name}」を捨て札に置いた。`);
          }
        }
      }

      for(const controller of ['player','cpu']){
        for(const fc of [...sideObj(controller).field]){
          if(!sideObj(controller).field.includes(fc))continue;
          const flames=fc.attachments.filter(a=>def(a).effect==='lifeFlame'&&!a.destroyHostResolved&&a.destroyHostTurn===state.turnSeq);
          if(flames.length){
            for(const flame of flames)flame.destroyHostResolved=true;
            log(`「命燃の鬼火」の効果で「${fieldDef(fc).name}」を破壊する。`);
            await attemptDestroyFieldCard(controller,fc,'effect',null);
          }
        }
      }

      for(const controller of ['player','cpu']){
        for(const fc of [...sideObj(controller).field]){
          if(fc.coverReturnTurn===state.turnSeq&&sideObj(controller).field.includes(fc)){
            log(`＜かばう＞の効果で「${fieldDef(fc).name}」を持ち主の手札へ戻した。`);
            leaveFieldToHand(controller,fc);
          }
        }
      }

      for(const controller of ['player','cpu']){
        for(const fc of [...sideObj(controller).field]){
          if(!sideObj(controller).field.includes(fc)||fc.underworldFaceDownTurn!==state.turnSeq)continue;
          fc.underworldFaceDownTurn=0;
          sideObj(controller).field=sideObj(controller).field.filter(x=>x!==fc);
          discardAttachmentsToOwners(fc,controller,'return');
          resolveShadowMirrorSourceLeft(fc.inst.uid);revealSpiritAwayBySource(fc.inst.uid);
          sendToOwnerDiscardFaceDown(fc.inst,controller);
          events.emit(EVENT.CARD_LEFT_FIELD,{state,side:controller,fieldCard:fc,reason:'underworldGuide'});
          log(`「冥府の導き」の効果で「${fieldDef(fc).name}」を裏向きで捨て札に置いた。`);
        }
      }

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
        for(const fc of [...sideObj(controller).field]){
          const expired=fc.attachments.filter(a=>a.expireTurn===state.turnSeq);
          for(const a of expired){
            destroyAttachment(fc,a,controller,'effect');
            log(`「${fieldDef(fc).name}」から「${def(a).name}」が外れた。`);
          }
        }
      }

      // ＜黒光り＞は他のターン終了時破壊処理の後にも常に条件を確認する。
      for(const controller of ['player','cpu']){
        for(const fc of [...sideObj(controller).field]){
          if(passiveOfField(fc)?.type==='blackShine'&&fc.attachments.length===0){
            await attemptDestroyFieldCard(controller,fc,'effect',null);
            log(`＜黒光り＞ 「${fieldDef(fc).name}」を破壊した。`);
          }
        }
      }

      for(const controller of ['player','cpu']){
        for(const fc of sideObj(controller).field){
          fc.damage=fc.persistentDamage||0;fc.turnAttackBonus=0;
          if(fc.hidden&&fc.hiddenUntilTurnSeq===state.turnSeq){fc.hidden=false;fc.hiddenUntilTurnSeq=0;}
          if(fc.turnColorOverrideTurn===state.turnSeq){fc.turnColorOverride=null;fc.turnColorOverrideTurn=0;}
        }
      }
      enforceAllAttachmentLegality();
      await resolveStateBasedDestructions('effect');

      sideObj(state.turn).cost=0;
      state.turn=other(state.turn);state.turnSeq++;state.turnNo++;state.phase='draw';
      log('ターン終了。通常ダメージが回復しました。');render();await sleep(150);await beginTurn();
    }finally{state.busy=false;render();}
  }

  async function cpuTurn(){
    if(currentCpuDifficulty()==='normal')return cpuTurnNormal();
    return cpuTurnSmart(currentCpuDifficulty());
  }

  async function cpuTurnNormal(){
    if(state.over)return; const s=state.cpu;
    message('CPUが考えています…');
    if(s.hand.length){
      const bait=chooseBaitCPU(s.hand); bait.faceDown=false;bait.discardFaceDown=false;Engine.moveCard(s,bait,ZONE.HAND,ZONE.BAIT);events.emit(EVENT.CARD_MOVED,{side:'cpu',card:bait,from:ZONE.HAND,to:ZONE.BAIT});log(`CPUは「${def(bait).name}」をエサにした。`);
      await resolveGoldenDungBait('cpu',bait);
      render();await cpuNotice(`「${def(bait).name}」をエサ場に置いた`);
    }
    s.cost=s.bait.length; state.phase='main';render();
    let guard=0;
    while(!state.over && guard++<20){
      let acted=false;
      if(canAbyssRevive('cpu')){acted=await useAbyssRevival('cpu');if(acted){render();continue;}}
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

  async function cpuTurnSmart(mode){
    if(state.over)return;
    const s=state.cpu;
    message(cpuAquaticBossActive()?'CPU（水生ボスAI）が考えています…':`CPU（${cpuDifficultyLabel(mode)}）が考えています…`);

    if(s.hand.length){
      const bait=chooseBaitCPUSmart(s.hand,mode);
      if(bait){
        bait.faceDown=false;bait.discardFaceDown=false;
        Engine.moveCard(s,bait,ZONE.HAND,ZONE.BAIT);
        events.emit(EVENT.CARD_MOVED,{side:'cpu',card:bait,from:ZONE.HAND,to:ZONE.BAIT});
        log(`CPUは「${def(bait).name}」をエサにした。`);
        await resolveGoldenDungBait('cpu',bait);
        render();await cpuNotice(`「${def(bait).name}」をエサ場に置いた`);
      }else{
        log('CPUは重要カードを温存するため、エサを置かなかった。');
      }
    }

    s.cost=s.bait.length;state.phase='main';render();
    let guard=0;
    while(!state.over&&guard++<24){
      let acted=false;
      if(canAbyssRevive('cpu')){
        const reviveScore=visibleDiscard('cpu')
          .filter(x=>def(x).type==='insect'&&passiveOfInst(x)?.type==='abyssRevival')
          .reduce((m,x)=>Math.max(m,cpuCardKeepValue(x)),0);
        if(reviveScore>=9){
          acted=await useAbyssRevival('cpu');
          if(acted){render();continue;}
        }
      }

      const usable=s.hand.filter(x=>canUseHandCardCPU(x));
      const handAction=chooseCpuMainActionSmart(usable,mode);
      const attacker=chooseCpuAttackerSmart(mode);
      const attackScore=attacker?cpuBestAttackScore(attacker,mode):-Infinity;
      const handScore=handAction?cpuMainActionPlanScore(handAction,mode):-Infinity;
      const directPressure=fieldActive('player').length===0&&attacker;
      const expert=cpuChooseExpertAction(usable,mode);
      const plannedFirst=mode==='veryStrong'?cpuChoosePlannedFirstAction(usable):handAction;
      const comboWeight=cpuPolicyValue('comboWeight',1);
      const candidateHands=[expert,plannedFirst,handAction].filter(Boolean);
      const chosenHand=mode==='veryStrong'
        ? (cpuAquaticBossActive()
            ? (expert||plannedFirst||handAction)
            : [...candidateHands].sort((a,b)=>
                (cpuMainActionPlanScore(b,mode)+cpuComboPriority(b)*comboWeight)-
                (cpuMainActionPlanScore(a,mode)+cpuComboPriority(a)*comboWeight)
              )[0]||null)
        : (expert&&cpuComboPriority(expert)>=18?expert:handAction);
      const chosenHandScore=chosenHand?cpuMainActionPlanScore(chosenHand,mode)+cpuComboPriority(chosenHand)*comboWeight:-Infinity;

      // With an open lane, pressure territory first. Otherwise compare tactical gain.
      const mustDevelop=chosenHand&&cpuDeckArchetype()==='armyAnt'&&passiveOfInst(chosenHand)?.type==='militaryLink'&&chosenHandScore>=cpuPolicyValue('deployThreshold',5);
      const aquaticDevelop=cpuAquaticBossActive()&&chosenHand&&(
        (def(chosenHand).type==='insect'&&effectiveCardCost('cpu',chosenHand)<=1)||
        (['モンシロチョウ','モンキチョウ'].includes(def(chosenHand).name)&&cpuAquaticHasPartnerOnField(def(chosenHand).name))
      );
      if((!directPressure||aquaticDevelop)&&chosenHand&&(mustDevelop||aquaticDevelop||chosenHandScore>=attackScore-0.5)){
        acted=await playCardFromHand('cpu',chosenHand);
        if(acted){render();continue;}
      }

      if(attacker){
        const at=chooseAttackCPUByMode(attacker,mode);
        if(at){
          await performAttack('cpu',attacker,at);acted=true;render();continue;
        }
        attacker.attacked=true;
      }

      if(!acted&&chosenHand){
        acted=await playCardFromHand('cpu',chosenHand);
        if(acted){render();continue;}
      }
      if(!acted)break;
    }
    if(!state.over){state.busy=false;await endTurn();}
  }

  function canUseHandCardCPU(inst){
    if(!canUseHandCard('cpu',inst))return false;
    if(currentCpuDifficulty()!=='normal'&&def(inst).effect==='handTempSummon')return cpuShouldUseHandTempSummon(inst);
    if(currentCpuDifficulty()!=='normal'&&def(inst).effect==='baitTempSummon'){
      if(cpuAquaticBossActive())return cpuAquaticBossShouldUseFlash();
      return cpuShouldUseBaitTempSummon();
    }
    return true;
  }

  function cpuMaxPrintedAttack(card){
    return Math.max(0,...(card?.attacks||[]).map(a=>Number(a.power||0)));
  }
  function cpuDeckArchetype(){
    const key=state?.cpu?.deckKey||'';
    if(key==='metaArmyAnt')return 'armyAnt';
    if(key==='metaHercules')return 'hercules';
    if(key==='metaSumatra3Color')return 'sumatra';
    if(key==='metaBee')return 'bee';
    if(key==='metaAquatic')return 'aquatic';
    if(key==='metaColorBlessing')return 'colorBlessing';
    if(key==='metaColorCounter')return 'colorCounter';
    if(key==='metaMimicAggro')return 'mimicAggro';
    if(key==='metaTermite')return 'termite';
    return 'generic';
  }
  function cpuZoneHasName(side,name){
    const s=sideObj(side);
    const all=[...s.hand,...s.deck,...s.bait,...s.discard,...s.territory,...s.field.map(fc=>fc.inst)];
    return all.some(x=>def(x)?.name===name);
  }
  function cpuEffectExistsInOwnZones(effect){
    const s=state.cpu;
    const all=[...s.hand,...s.deck,...s.bait,...s.discard,...s.territory,...s.field.map(fc=>fc.inst)];
    return all.some(x=>def(x)?.effect===effect);
  }
  function cpuStrategicBonus(inst){
    const c=def(inst);if(!c||!state?.cpu)return 0;
    const arch=cpuDeckArchetype();
    let b=0;

    if(arch==='armyAnt'){
      if(c.name.includes('バーチェルグンタイアリ'))b+=5;
      if(c.name==='ニセハナマオウカマキリ')b+=5;
      if(c.name==='リオック')b+=4;
      if(c.effect==='handTempSummon')b+=6;
      if(c.effect==='recoverInsect')b+=3;
      if(c.name==='ミツツボアリ')b+=1.5;
    }else if(arch==='hercules'){
      if(c.name==='ヘラクレスオオカブト')b+=7;
      if(c.name==='ゴライアスオオツノハナムグリ')b+=3;
      if(c.effect==='handTempSummon')b+=7;
      if(c.effect==='attack500')b+=3;
    }else if(arch==='sumatra'){
      if(c.name==='スマトラオオヒラタクワガタ')b+=8;
      if(c.effect==='handTempSummon')b+=6;
      if(c.effect==='worshipGreatSword')b+=cpuEffectExistsInOwnZones('attack500')||visibleDiscard('cpu').some(x=>def(x).type==='enhance')?4:-4;
      if(c.type==='insect'&&!baitHasRGB('cpu')){
        const colors=new Set(faceUpBait('cpu').filter(x=>def(x).type==='insect').map(x=>baitCardColor(x)));
        if(!colors.has(c.color))b-=1.5;
      }
    }else if(arch==='bee'){
      if(c.name==='オオスズメバチ（女王）')b+=9;
      if(/バチ/.test(c.name||'')&&c.type==='insect')b+=2;
      if(c.effect==='handTempSummon')b+=5;
      if(c.effect==='worshipGreatSword')b+=visibleDiscard('cpu').some(x=>def(x).type==='enhance')?4:-4;
    }else if(arch==='colorCounter'){
      // 色彩対策CPU：ハチの高速展開を維持し、1000火力で色彩の主力だけをテンポ良く除去する。
      if(c.name==='オオスズメバチ（女王）')b+=12;
      if(/バチ/.test(c.name||'')&&c.type==='insect')b+=2.5;
      if(c.effect==='handTempSummon')b+=9;
      if(c.effect==='burn1000')b+=10;
    }else if(arch==='colorBlessing'){
      if(c.passive?.type==='colorBlessing')b+=5;
      if(c.type==='insect'&&!baitHasRGB('cpu'))b+=0.8;
    }else if(arch==='mimicAggro'){
      if(c.passive?.type==='mimic'||c.passive?.type==='batesMimic')b+=4;
      if(Number(c.cost||0)<=2&&c.type==='insect')b+=1.5;
    }else if(arch==='termite'){
      const down=state.cpu.discard.filter(x=>x.discardFaceDown).length;
      const visible=visibleDiscard('cpu').length;
      if(c.passive?.type==='colony')b+=7+down*2.5+(visible?3:0);
      if(c.effect==='pupaWintering')b+=visible<2&&state.cpu.hand.length>=3?7:2;
      if(c.effect==='underworldGuide'&&visibleDiscard('cpu').some(x=>def(x).type==='insect'))b+=6;
      if(['intercept400','intercept800'].includes(c.effect))b+=1.5;
      if(c.passive?.type==='poisonJuiceTerritory')b+=2;
    }else if(arch==='aquatic'){
      if(c.passive?.type==='aquaticCost')b+=5;
      if(c.color==='blue'&&c.type==='insect')b+=2;
      if(['モンシロチョウ','モンキチョウ'].includes(c.name))b+=1.5;
      if(c.effect==='baitTempSummon')b-=4;
      if(c.effect==='bloodPact')b+=3;
      if(['ヘラクレスオオカブト','サカダチコノハナナフシ'].includes(c.name))b+=5;
    }

    // Generic combo preservation.
    if(c.effect==='handTempSummon'&&state.cpu.hand.some(x=>x.uid!==inst.uid&&def(x).type==='insect'&&Number(def(x).cost||0)>=5))b+=4;
    if(c.effect==='recoverInsect'&&visibleDiscard('cpu').some(x=>def(x).type==='insect'&&cpuCardKeepValueBase(x)>=10))b+=2;
    return b;
  }
  function cpuCardKeepValueBase(inst){
    const c=def(inst);if(!c)return 0;
    let v=Number(c.cost||0)*0.8;
    if(c.type==='insect'){
      v+=Number(c.hp||0)/260+cpuMaxPrintedAttack(c)/170;
      if(c.passive)v+=1.4;
      v+=(c.attacks||[]).filter(a=>a.effect).length*0.8;
      if(c.name.includes('バーチェルグンタイアリ'))v+=2.2;
      if(c.name==='オオスズメバチ（女王）')v+=4;
      if(c.name==='スマトラオオヒラタクワガタ')v+=4;
      if(c.name==='リオック')v+=1.5;
    }else if(c.type==='enhance'){
      const m=attachmentModifier(inst);v+=2+(Math.max(0,m.attack)+Math.max(0,m.hp))/350;
    }else{
      const effectValue={
        handTempSummon:5,worshipGreatSword:5,destroyOpponent:5,burn1000:4.5,burn600:3.5,
        allAttack300:4,allAttack200:3,recoverInsect:3.2,baitBoost:3,readyAttack:4,
        baitTempSummon:3.5,baitRushTwo:5,eternalCocoon:5,underworldGuide:4.5,
        nextSpellDiscount:2.5,poisonFollowUp:3.5,spellDanceCounter:4.5,silkwormGag:5.5
      };
      v+=2+(effectValue[c.effect]||1.2);
    }
    return v;
  }
  function cpuCardKeepValue(inst){
    const preserve=cpuPolicyValue('preserveWeight',1);
    const ace=cpuPolicyValue('aceWeight',1);
    return cpuCardKeepValueBase(inst)*preserve+cpuStrategicBonus(inst)*ace;
  }
  function cpuShouldSpendCardAsExtraBait(hand){
    if(!hand.length)return false;
    const ranked=[...hand].sort((a,b)=>cpuCardKeepValue(a)-cpuCardKeepValue(b));
    const lowest=ranked[0];
    const baitCount=state.cpu.bait.length;
    if(baitCount<cpuResourceTarget())return cpuCardKeepValue(lowest)<=13;
    return cpuCardKeepValue(lowest)<=5.5&&hand.length>=4;
  }
  function cpuFieldThreat(fc,side='player'){
    const c=fieldDef(fc);if(!c)return 0;
    let attack=0;
    for(const a of c.attacks||[]){
      if(usableAttack(side,fc,a))attack=Math.max(attack,attackPower(side,fc,a));
    }
    let v=Number(c.cost||0)*1.4+maxHp(fc)/300+attack/180+fc.attachments.length*1.3+(passiveOfField(fc)?1.8:0);
    if(side==='cpu')v+=cpuStrategicBonus(fc.inst)*0.55;
    return v;
  }
  function cpuHasNameInOwnZones(pattern){
    const s=state.cpu;
    const list=[...s.hand,...s.deck,...s.bait,...s.discard,...s.territory,...s.field.map(fc=>fc.inst)];
    return list.some(inst=>pattern.test(def(inst)?.name||''));
  }
  function cpuResourceTarget(){
    const arch=cpuDeckArchetype();
    const defaults={bee:6,colorCounter:5,sumatra:6,hercules:6,armyAnt:5,colorBlessing:5,aquatic:4,mimicAggro:4,termite:3,generic:5};
    return Math.max(2,Math.min(7,Math.round(cpuPolicyValue('resourceTarget',defaults[arch]??5))));
  }
  function cpuAceNames(){
    const arch=cpuDeckArchetype();
    if(arch==='bee')return ['オオスズメバチ（女王）','オオスズメバチ','タランチュラホーク'];
    if(arch==='colorCounter')return ['オオスズメバチ（女王）','オオスズメバチ','タランチュラホーク'];
    if(arch==='sumatra')return ['スマトラオオヒラタクワガタ','ゴライアスオオツノハナムグリ'];
    if(arch==='hercules')return ['ヘラクレスオオカブト','ゴライアスオオツノハナムグリ'];
    if(arch==='armyAnt')return ['ニセハナマオウカマキリ','リオック','バーチェルグンタイアリ メジャー'];
    return [];
  }
  function cpuBestAceInHand(excludeUid=null){
    const names=cpuAceNames();
    const list=state.cpu.hand.filter(x=>x.uid!==excludeUid&&def(x).type==='insect'&&names.includes(def(x).name));
    return [...list].sort((a,b)=>cpuCardKeepValue(b)-cpuCardKeepValue(a))[0]||null;
  }
  function cpuHasTempoSpell(effect){
    return state.cpu.hand.some(x=>def(x).effect===effect&&canUseHandCardCPU(x));
  }
  function cpuReadyAttackCount(){
    return fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc)).length;
  }
  function cpuOpponentHasSingleBlocker(){return fieldActive('player').length===1;}
  function cpuCanRemoveBlockerWith(inst){
    const c=def(inst),targets=fieldActive('player');
    if(targets.length!==1)return false;
    const t=targets[0];
    if(['destroyOpponent','eternalCocoon'].includes(c.effect))return true;
    if(c.effect==='burn600')return t.damage+600>=maxHp(t);
    if(c.effect==='burn1000')return t.damage+1000>=maxHp(t);
    return false;
  }
  function cpuComboPriority(inst){
    const c=def(inst),arch=cpuDeckArchetype();
    if(!c)return 0;
    let p=0;
    if(c.effect==='handTempSummon'){
      const ace=cpuBestAceInHand(inst.uid);
      if(ace){
        p+=20+cpuCardKeepValue(ace);
        if(arch==='sumatra'&&def(ace).name==='スマトラオオヒラタクワガタ')p+=baitHasRGB('cpu')?18:-5;
        if((arch==='bee'||arch==='colorCounter')&&def(ace).name==='オオスズメバチ（女王）'){
          const bees=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&Number(def(x).cost||0)<=5).length;
          p+=bees*7;
        }
      }
    }
    if(arch==='armyAnt'&&passiveOfInst(inst)?.type==='militaryLink'){
      const links=fieldActive('cpu').filter(fc=>passiveOfField(fc)?.type==='militaryLink').length;
      p+=16+links*10;
    }
    if(arch==='bee'&&c.name==='オオスズメバチ（女王）'){
      const bees=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&Number(def(x).cost||0)<=5).length;
      p+=20+bees*8;
    }
    if(arch==='sumatra'&&c.name==='スマトラオオヒラタクワガタ')p+=baitHasRGB('cpu')?26:4;
    if(arch==='hercules'&&c.name==='ヘラクレスオオカブト')p+=24;
    if(arch==='colorCounter'&&c.effect==='burn1000'&&fieldActive('player').length)p+=20;
    if(arch==='colorCounter'&&c.effect==='spellDanceCounter'){
      const lock=fieldActive('cpu').some(fc=>['silenceAll','phaseMutation'].includes(rawFieldPassive(fc)?.type));
      p+=lock?30:8;
    }
    if(c.effect==='worshipGreatSword'&&fieldActive('cpu').some(fc=>fc.attacked)&&visibleDiscard('cpu').some(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=3))p+=22;
    if(cpuOpponentHasSingleBlocker()&&cpuReadyAttackCount()>0&&cpuCanRemoveBlockerWith(inst))p+=28;
    return p;
  }
  function cpuHandTempSummonTarget(excludeUid=null){
    const arch=cpuDeckArchetype();
    const insects=state.cpu.hand.filter(x=>x.uid!==excludeUid&&def(x).type==='insect');
    if(!insects.length)return null;

    const aceNames=cpuAceNames();
    const candidates=insects.filter(x=>{
      const c=def(x);
      const cost=effectiveCardCost('cpu',x);
      const saving=Math.max(0,cost-1);
      const isAce=aceNames.includes(c.name);
      const highImpact=Number(c.cost||0)>=4||cpuMaxPrintedAttack(c)>=700||isAce;

      // Never spend Tamayura on a 1-cost body: normal summon is strictly better
      // because the insect remains on the field.
      if(cost<=1)return false;

      // 2-cost bodies are almost never worth losing at end of turn unless they are
      // a specifically important ace/entry-effect card.
      if(cost===2&&!isAce)return false;

      return highImpact||saving>=3;
    });

    if(!candidates.length)return null;

    const immediateValue=x=>{
      const c=def(x);
      const cost=effectiveCardCost('cpu',x);
      const saving=Math.max(0,cost-1);
      let score=cpuCardKeepValue(x)+cpuMaxPrintedAttack(c)/110+saving*3;

      if(aceNames.includes(c.name))score+=12;
      if(c.name==='ニセハナマオウカマキリ')score+=8;
      if(c.name==='リオック')score+=5;
      if(c.name==='ヘラクレスオオカブト')score+=8;
      if(c.name==='スマトラオオヒラタクワガタ'&&baitHasRGB('cpu'))score+=10;
      if(c.name==='オオスズメバチ（女王）'){
        const bees=faceUpBait('cpu').filter(b=>def(b).type==='insect'&&/バチ/.test(def(b).name)&&Number(def(b).cost||0)<=5).length;
        score+=bees*5;
      }
      return score;
    };

    return [...candidates].sort((a,b)=>immediateValue(b)-immediateValue(a))[0]||null;
  }
  function cpuShouldUseHandTempSummon(spellInst){
    const target=cpuHandTempSummonTarget(spellInst?.uid||null);
    if(!target)return false;

    const c=def(target);
    const targetCost=effectiveCardCost('cpu',target);
    const normalAffordable=targetCost<=state.cpu.cost;
    const saving=Math.max(0,targetCost-1);

    // If it is cheap enough to summon normally, temporary destruction must buy
    // substantial tempo. Small bodies never qualify.
    if(normalAffordable&&targetCost<=3)return false;

    const arch=cpuDeckArchetype();
    if(arch==='armyAnt'){
      // Army Ant uses Tamayura as a cheat for a finisher, not for a link body.
      return ['ニセハナマオウカマキリ','リオック','バーチェルグンタイアリ メジャー'].includes(c.name)
        && (targetCost>=4||saving>=3);
    }
    if(arch==='hercules')return c.name==='ヘラクレスオオカブト'||targetCost>=5;
    if(arch==='sumatra')return c.name==='スマトラオオヒラタクワガタ'||targetCost>=5;
    if(arch==='bee')return c.name==='オオスズメバチ（女王）'||targetCost>=5;

    return targetCost>=4||saving>=3;
  }

  function cpuTempSummonValue(inst){
    const c=def(inst);if(!c||c.type!=='insect')return -Infinity;
    let v=cpuCardKeepValue(inst)+cpuMaxPrintedAttack(c)/120+Number(c.hp||0)/500;
    if(c.passive?.type==='aquaticCost')v+=2;
    if(c.name==='ヘラクレスオオカブト')v+=10;
    if(c.name==='サカダチコノハナナフシ')v+=8;
    if(c.name==='ゴライアスオオツノハナムグリ')v+=4;
    if(['モンシロチョウ','モンキチョウ'].includes(c.name))v-=6;
    return v;
  }
  function cpuTempSummonCreatesLethal(){
    if(fieldActive('player').length)return false;
    const hitsNeeded=state.player.territory.length+1;
    const ready=cpuReadyAttackCount();
    return ready+1>=hitsNeeded;
  }
  function cpuShouldUseBaitTempSummon(){
    const list=faceUpBait('cpu').filter(x=>def(x).type==='insect');
    if(!list.length)return false;
    if(cpuTempSummonCreatesLethal())return true;

    const arch=cpuDeckArchetype();
    const floor=Math.max(1,Math.round(cpuPolicyValue('tempSummonBaitFloor',arch==='aquatic'?5:cpuResourceTarget())));
    const minValue=cpuPolicyValue('tempSummonMinValue',arch==='aquatic'?15:11);
    if(state.cpu.bait.length<=floor)return false;

    const best=[...list].sort((a,b)=>cpuTempSummonValue(b)-cpuTempSummonValue(a))[0];
    if(!best||cpuTempSummonValue(best)<minValue)return false;

    if(arch==='aquatic'){
      const blue=list.filter(x=>baitCardColor(x)==='blue').length;
      const afterBlue=blue-(baitCardColor(best)==='blue'?1:0);
      const beforeDiscount=Math.floor(blue/2);
      const afterDiscount=Math.floor(afterBlue/2);
      const blueFloor=Math.max(2,Math.round(cpuPolicyValue('blueBaitFloor',4)));
      // Never cash in a blue bait if it drops the discount tier, unless it is a lethal push.
      if(afterDiscount<beforeDiscount)return false;
      if(afterBlue<blueFloor&&baitCardColor(best)==='blue')return false;
    }
    return true;
  }

  function cpuAquaticBossActive(){
    return currentCpuDifficulty()==='veryStrong'&&cpuDeckArchetype()==='aquatic';
  }
  function cpuAquaticBlueBaitCount(){
    return faceUpBait('cpu').filter(x=>def(x).type==='insect'&&baitCardColor(x)==='blue').length;
  }
  function cpuAquaticPartnerName(name){
    return name==='モンシロチョウ'?'モンキチョウ':name==='モンキチョウ'?'モンシロチョウ':null;
  }
  function cpuAquaticHasPartnerOnField(name){
    const partner=cpuAquaticPartnerName(name);
    return !!partner&&fieldActive('cpu').some(fc=>fieldDef(fc).name===partner);
  }
  function cpuAquaticHighCostInHand(){
    return state.cpu.hand.some(x=>['ヘラクレスオオカブト','サカダチコノハナナフシ','シタベニオオバッタ'].includes(def(x).name));
  }
  function cpuAquaticBossResourceTarget(){
    if(cpuAquaticBlueBaitCount()<4)return 4;
    if(cpuAquaticHighCostInHand())return Math.max(5,Math.min(7,Math.round(cpuPolicyValue('finisherResourceTarget',6))));
    if(state.cpu.hand.some(x=>def(x).name==='ゴライアスオオツノハナムグリ'))return 5;
    return 4;
  }
  function cpuAquaticBossBaitScore(inst){
    const c=def(inst);
    let score=cpuCardKeepValue(inst);
    const blue=cpuAquaticBlueBaitCount();
    const name=c.name||'';

    // Blue bait is the engine. Prefer putting expendable blue insects there.
    if(c.type==='insect'&&c.color==='blue'){
      score-=blue<4?12:blue<5?6:2;
      if(c.passive?.type==='flyOut')score-=2.5; // in hand, the territory trigger is already lost
      if(c.passive?.type==='cover')score-=2;
    }

    // Butterflies are early attackers when the emblem pair is available.
    if(['モンシロチョウ','モンキチョウ'].includes(name)){
      const partner=cpuAquaticPartnerName(name);
      const pairInHand=state.cpu.hand.some(x=>x.uid!==inst.uid&&def(x).name===partner);
      const pairOnField=fieldActive('cpu').some(fc=>fieldDef(fc).name===partner);
      if(pairInHand||pairOnField)score+=blue<4?7:11;
    }

    // Preserve actual finishers and tactical spells.
    if(['ヘラクレスオオカブト','サカダチコノハナナフシ'].includes(name))score+=20;
    if(name==='シタベニオオバッタ')score+=12;
    if(c.passive?.type==='aquaticCost')score+=8;
    if(c.effect==='bloodPact')score+=14;
    if(c.effect==='baitTempSummon')score+=8;

    // Chitchi / Ant-on are excellent engine bait if drawn in hand.
    if(name==='チッチゼミ')score-=4;
    if(name==='アントアンカブトハナムグリ')score-=3;
    if(name==='ゴライアスオオツノハナムグリ'&&blue<4)score-=2;

    return score;
  }
  function cpuAquaticBossChooseBait(hand){
    if(!hand.length)return null;
    const ranked=[...hand].sort((a,b)=>cpuAquaticBossBaitScore(a)-cpuAquaticBossBaitScore(b));
    const best=ranked[0];
    const baitCount=state.cpu.bait.length;
    const target=cpuAquaticBossResourceTarget();

    if(baitCount<target)return best;

    // Keep ramping to 5-6 only when it unlocks a real finisher.
    if(baitCount<6&&cpuAquaticHighCostInHand()&&cpuAquaticBossBaitScore(best)<11)return best;
    if(hand.length>=5&&cpuAquaticBossBaitScore(best)<5.5)return best;
    return null;
  }
  function cpuAquaticOpponentBaitDanger(inst){
    const c=def(inst);
    if(!c)return 99;
    let v=Number(c.cost||0)*1.2+Number(c.hp||0)/300+cpuMaxPrintedAttack(c)/180;
    if(c.passive)v+=2;
    v+=(c.attacks||[]).filter(a=>a.effect).length*1.3;
    return v;
  }
  function cpuAquaticBestTempBait(){
    const list=faceUpBait('cpu').filter(x=>def(x).type==='insect');
    if(!list.length)return null;
    const blue=cpuAquaticBlueBaitCount();
    const candidates=list.filter(x=>{
      if(baitCardColor(x)!=='blue')return true;
      const after=blue-1;
      return Math.floor(after/2)===Math.floor(blue/2)&&after>=4;
    });
    const pool=candidates.length?candidates:list;
    return [...pool].sort((a,b)=>cpuTempSummonValue(b)-cpuTempSummonValue(a))[0]||null;
  }
  function cpuAquaticBossShouldUseFlash(){
    if(cpuTempSummonCreatesLethal())return true;
    const target=cpuAquaticBestTempBait();
    if(!target)return false;
    if(state.cpu.bait.length<Math.max(4,Math.round(cpuPolicyValue('tempSummonBaitFloor',5))))return false;
    const c=def(target);
    if(['モンシロチョウ','モンキチョウ','チッチゼミ'].includes(c.name))return false;
    if(baitCardColor(target)==='blue'){
      const before=cpuAquaticBlueBaitCount(),after=before-1;
      if(Math.floor(after/2)<Math.floor(before/2)||after<4)return false;
    }
    // Kagero should produce a meaningful tempo swing, not just a body.
    return cpuTempSummonValue(target)>=cpuPolicyValue('tempSummonMinValue',15)||
      ['ヘラクレスオオカブト','サカダチコノハナナフシ','シタベニオオバッタ','ゴライアスオオツノハナムグリ'].includes(c.name);
  }
  function cpuAquaticBloodPactValue(){
    const opp=fieldActive('player');
    if(!opp.length)return -Infinity;
    const best=Math.max(...opp.map(fc=>cpuFieldThreat(fc,'player')));
    const ready=cpuReadyAttackCount();
    let v=best*1.6*cpuPolicyValue('bloodPactWeight',1);
    if(opp.length===1&&ready>=1)v+=24+ready*6;
    if(state.player.territory.length<=2&&opp.length===1&&ready>=1)v+=18;
    if(state.cpu.territory.length<=2&&state.cpu.cost<4)v-=14;
    return v;
  }
  function cpuAquaticBossActionScore(inst){
    const c=def(inst);
    let score=cpuMainActionPlanScore(inst,'veryStrong')+cpuComboPriority(inst);
    const name=c.name||'';
    const cost=effectiveCardCost('cpu',inst);

    if(c.effect==='bloodPact')score+=cpuAquaticBloodPactValue();
    if(c.effect==='baitTempSummon')score+=cpuAquaticBossShouldUseFlash()?22:-100;

    if(c.type==='insect'){
      if(c.passive?.type==='aquaticCost'){
        score+=(cost===0?24:cost===1?17:cost===2?8:0)+cpuPolicyValue('aquaticCheapBonus',0);
      }
      if(['モンシロチョウ','モンキチョウ'].includes(name)){
        score+=cpuAquaticHasPartnerOnField(name)?18:6;
        const partner=cpuAquaticPartnerName(name);
        if(state.cpu.hand.some(x=>x.uid!==inst.uid&&def(x).name===partner))score+=8;
      }
      if(name==='ヘラクレスオオカブト')score+=fieldActive('player').length?24:13;
      if(name==='サカダチコノハナナフシ'){
        const oppBait=state.player.bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect');
        score+=fieldActive('player').length&&oppBait.length?23:5;
      }
      if(name==='ゴライアスオオツノハナムグリ')score+=8;
      if(name==='シタベニオオバッタ')score+=8;
    }
    return score;
  }
  function cpuAquaticBossAction(usable){
    if(!usable.length)return null;

    // If one removal opens the lane, do that before anything else.
    const blood=usable.find(x=>def(x).effect==='bloodPact');
    if(blood&&cpuAquaticBloodPactValue()>=28)return blood;

    // Swarm with free/1-cost aquatic bodies first.
    const cheapAquatic=usable.filter(x=>def(x).type==='insect'&&passiveOfInst(x)?.type==='aquaticCost'&&effectiveCardCost('cpu',x)<=1);
    if(cheapAquatic.length){
      return [...cheapAquatic].sort((a,b)=>cpuAquaticBossActionScore(b)-cpuAquaticBossActionScore(a))[0];
    }

    // Complete the emblem pair aggressively.
    const pair=usable.find(x=>['モンシロチョウ','モンキチョウ'].includes(def(x).name)&&cpuAquaticHasPartnerOnField(def(x).name));
    if(pair)return pair;

    // Establish at least two attackers before probing territory.
    const cheap=usable.filter(x=>def(x).type==='insect'&&effectiveCardCost('cpu',x)<=1);
    if(cheap.length&&fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc)).length<2){
      return [...cheap].sort((a,b)=>cpuAquaticBossActionScore(b)-cpuAquaticBossActionScore(a))[0];
    }

    const flash=usable.find(x=>def(x).effect==='baitTempSummon');
    if(flash&&cpuAquaticBossShouldUseFlash())return flash;

    const ranked=[...usable].sort((a,b)=>cpuAquaticBossActionScore(b)-cpuAquaticBossActionScore(a));
    const best=ranked[0]||null;
    return best&&cpuAquaticBossActionScore(best)>=cpuPolicyValue('deployThreshold',5.5)?best:null;
  }
  function cpuAquaticBossAttackChoice(fc){
    const ats=availableAttacks('cpu',fc).filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('cpu',fc,a));
    if(!ats.length)return null;
    const targets=attackableTargets('cpu');
    const name=fieldDef(fc).name;

    if(name==='ヘラクレスオオカブト'){
      const bounce=ats.find(a=>a.effect==='bounceOnce');
      const damage=[...ats].filter(a=>a.effect!=='bounceOnce').sort((a,b)=>attackPower('cpu',fc,b)-attackPower('cpu',fc,a))[0];
      if(bounce&&targets.length){
        const otherReady=fieldActive('cpu').filter(x=>x!==fc&&canAttackSide('cpu',x)).length;
        const strongest=[...targets].sort((a,b)=>cpuFieldThreat(b,'player')-cpuFieldThreat(a,'player'))[0];
        const normalDmg=damage?attackPower('cpu',fc,damage)*(hasAttachment(strongest,'noWeakness')?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(strongest))):0;
        const killable=damage&&normalDmg>=maxHp(strongest)-strongest.damage;
        if((targets.length===1&&otherReady>=1)||(!killable&&cpuFieldThreat(strongest,'player')>=cpuPolicyValue('bounceThreatThreshold',8)))return bounce;
      }
      if(damage)return damage;
    }

    if(name==='サカダチコノハナナフシ'){
      const swap=ats.find(a=>a.effect==='reverseSwap');
      if(swap&&targets.length){
        const bait=state.player.bait.filter(x=>isFaceUpBait(x)&&def(x).type==='insect');
        if(bait.length){
          const strong=Math.max(...targets.map(t=>cpuFieldThreat(t,'player')));
          const weak=Math.min(...bait.map(cpuAquaticOpponentBaitDanger));
          if(strong-weak>=cpuPolicyValue('reverseSwapDelta',3))return swap;
        }
      }
    }

    return [...ats].sort((a,b)=>cpuAttackOptionScore(fc,b,'veryStrong')-cpuAttackOptionScore(fc,a,'veryStrong'))[0];
  }
  function cpuAquaticBossAttacker(){
    const ready=fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc));
    if(!ready.length)return null;
    const opp=fieldActive('player');

    // Against an open lane, expend the weakest attacker first. This deliberately
    // probes territory for <fly out>/<cover> before committing the finishers.
    if(!opp.length){
      return [...ready].sort((a,b)=>cpuFieldThreat(a,'cpu')-cpuFieldThreat(b,'cpu'))[0];
    }

    // Hercules can remove the final wall so the rest of the board attacks territory.
    if(opp.length===1&&ready.length>=2){
      const herc=ready.find(fc=>fieldDef(fc).name==='ヘラクレスオオカブト'&&cpuAquaticBossAttackChoice(fc)?.effect==='bounceOnce');
      if(herc)return herc;
    }

    // Reverse-swap a premium defender into a weak bait before ordinary combat.
    const saka=ready.find(fc=>fieldDef(fc).name==='サカダチコノハナナフシ'&&cpuAquaticBossAttackChoice(fc)?.effect==='reverseSwap');
    if(saka)return saka;

    // Prefer the smallest attacker that can secure a kill; preserve big attacks for the next blocker.
    const lethal=[];
    for(const fc of ready){
      const attack=cpuAquaticBossAttackChoice(fc);if(!attack)continue;
      const power=attackPower('cpu',fc,attack);
      for(const t of attackableTargets('cpu')){
        const nw=hasAttachment(t,'noWeakness')||(passiveOfField(t)?.type==='whiteShell'&&t.whiteShellTurn===state.turnSeq);
        const dmg=power*(nw?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(t)));
        if(dmg>=maxHp(t)-t.damage)lethal.push({fc,over:dmg-(maxHp(t)-t.damage),power});
      }
    }
    if(lethal.length)return lethal.sort((a,b)=>a.over-b.over||a.power-b.power)[0].fc;

    return [...ready].sort((a,b)=>cpuBestAttackScore(b,'veryStrong')-cpuBestAttackScore(a,'veryStrong'))[0];
  }

  function cpuColorBlessingMissingColors(){
    const colors=new Set(faceUpBait('cpu')
      .filter(x=>def(x).type==='insect')
      .map(x=>baitCardColor(x))
      .filter(Boolean));
    return new Set(['red','blue','green'].filter(x=>!colors.has(x)));
  }
  function cpuColorBlessingDeployableThreats(excludeUid=null,budget=state?.cpu?.cost||0){
    if(!state?.cpu||!baitHasRGB('cpu'))return [];
    const pool=state.cpu.hand.filter(x=>x.uid!==excludeUid&&def(x).type==='insect');
    const blessed=pool.filter(x=>passiveOfInst(x)?.type==='colorBlessing');
    const ranked=[...blessed].sort((a,b)=>{
      const ca=effectiveCardCost('cpu',a),cb=effectiveCardCost('cpu',b);
      if(ca!==cb)return ca-cb;
      return cpuMainActionScore(b)-cpuMainActionScore(a);
    });
    const out=[];let left=Math.max(0,budget);
    for(const x of ranked){
      const cost=effectiveCardCost('cpu',x);
      if(cost<=left){out.push(x);left-=cost;}
    }
    return out;
  }
  function cpuColorBlessingBloodPactPlan(inst=null){
    const s=state?.cpu,opp=fieldActive('player');
    if(!s||!opp.length)return {useTerritory:false,castNow:false,lethal:false,score:-Infinity};
    const normalCost=inst?effectiveCardCost('cpu',inst):4;
    const ready=cpuReadyAttackCount();
    const singleBlocker=opp.length===1;
    const hitsNeeded=state.player.territory.length+1;
    const deployFull=cpuColorBlessingDeployableThreats(inst?.uid||null,s.cost);
    const deployAfterCost=cpuColorBlessingDeployableThreats(inst?.uid||null,Math.max(0,s.cost-normalCost));
    const projectedAttackers=ready+deployFull.length;
    const lethal=singleBlocker&&projectedAttackers>=hitsNeeded;
    const immediateLethal=singleBlocker&&ready>=hitsNeeded;
    const preservesDevelopment=deployFull.length>deployAfterCost.length;
    const targetThreat=Math.max(0,...opp.map(fc=>cpuFieldThreat(fc,'player')));
    const safeToSacrifice=s.territory.length>=3||lethal;
    const territoryWeight=cpuPolicyValue('bloodPactTerritoryWeight',1.15);

    // The alternative cost is strongest when it converts the same turn into
    // additional discounted Color Blessing attackers. Never burn the last two
    // territories for ordinary tempo unless it is a lethal line.
    const useTerritory=s.territory.length>=2&&(
      lethal||
      (safeToSacrifice&&singleBlocker&&preservesDevelopment&&projectedAttackers>=2)||
      (safeToSacrifice&&preservesDevelopment&&ready>=1&&targetThreat>=8)
    );

    // If there are discounted threats to deploy first, develop them before
    // spending Blood Pact unless removing the blocker is already lethal.
    const castNow=immediateLethal||
      (useTerritory&&deployFull.length===0&&ready>=1)||
      (!useTerritory&&singleBlocker&&ready>=1&&deployFull.length===0);

    let score=targetThreat*1.25*cpuPolicyValue('removalWeight',1);
    if(singleBlocker)score+=ready*4;
    if(lethal)score+=45;
    if(useTerritory)score+=(preservesDevelopment?14:4)*territoryWeight;
    if(s.territory.length<=2&&!lethal&&useTerritory)score-=30;
    return {useTerritory,castNow,lethal,immediateLethal,preservesDevelopment,score};
  }
  function cpuHasDeathTrigger(fc){
    const p=passiveOfField(fc);
    const text=String(p?.text||'')+' '+(fieldDef(fc)?.attacks||[]).map(a=>String(a.text||'')).join(' ');
    return /破壊されたとき|破壊されるとき/.test(text)||
      ['toxicRevenge','poisonBubble','revengeDeath','abyssRevival'].includes(p?.type);
  }
  function cpuHardRemovalTarget(targets,preferBottomDeck=false){
    if(!targets?.length)return null;
    const score=fc=>{
      let v=cpuFieldThreat(fc,'player')*cpuPolicyValue('removalWeight',1);
      if(preferBottomDeck&&cpuHasDeathTrigger(fc))v+=16;
      const p=passiveOfField(fc);
      if(p?.type==='taunt'||p?.type==='pollen')v+=10;
      if(fc.attachments?.length)v+=fc.attachments.length*1.5;
      return v;
    };
    return [...targets].sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function cpuMimicCheapDeployables(excludeUid=null,budget=state?.cpu?.cost||0){
    if(!state?.cpu)return [];
    const list=state.cpu.hand.filter(x=>x.uid!==excludeUid&&def(x).type==='insect'&&effectiveCardCost('cpu',x)<=2)
      .sort((a,b)=>effectiveCardCost('cpu',a)-effectiveCardCost('cpu',b)||cpuMainActionScore(b)-cpuMainActionScore(a));
    const out=[];let left=Math.max(0,budget);
    for(const x of list){
      const cost=effectiveCardCost('cpu',x);
      if(cost<=left){out.push(x);left-=cost;}
    }
    return out;
  }
  function cpuMimicBloodPactPlan(inst=null){
    const s=state?.cpu,opp=fieldActive('player');
    if(!s||!opp.length)return {useTerritory:false,castNow:false,lethal:false,score:-Infinity};
    const normalCost=inst?effectiveCardCost('cpu',inst):4;
    const ready=cpuReadyAttackCount();
    const single=opp.length===1;
    const hitsNeeded=state.player.territory.length+1;
    const full=cpuMimicCheapDeployables(inst?.uid||null,s.cost);
    const after=cpuMimicCheapDeployables(inst?.uid||null,Math.max(0,s.cost-normalCost));
    const lethal=single&&(ready+full.length)>=hitsNeeded;
    const preserves=full.length>after.length;
    const safe=s.territory.length>=3||lethal;
    const useTerritory=s.territory.length>=2&&(
      lethal||(safe&&single&&preserves&&(ready+full.length)>=2)
    );
    const castNow=(single&&ready>=hitsNeeded)||(useTerritory&&full.length===0&&ready>=1);
    let score=Math.max(0,...opp.map(fc=>cpuFieldThreat(fc,'player')))*1.35*cpuPolicyValue('removalWeight',1);
    if(single)score+=ready*4;
    if(lethal)score+=42;
    if(useTerritory&&preserves)score+=12*cpuPolicyValue('bloodPactTerritoryWeight',1);
    if(s.territory.length<=2&&!lethal&&useTerritory)score-=28;
    return {useTerritory,castNow,lethal,preserves,score};
  }
  function cpuMimicBlackMountainValue(){
    if(cpuDeckArchetype()!=='mimicAggro')return -Infinity;
    const ready=fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc));
    if(ready.length<2||!fieldActive('player').length)return -20;
    const count=fieldActive('cpu').length+allOwnEnhancements('cpu').length;
    const buff=count*100;
    let newlyLethal=0;
    for(const fc of ready){
      const ats=availableAttacks('cpu',fc).filter(a=>usableAttack('cpu',fc,a));
      const base=Math.max(0,...ats.map(a=>attackPower('cpu',fc,a)));
      for(const t of attackableTargets('cpu')){
        const remain=maxHp(t)-t.damage;
        const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(t));
        if(base*mult<remain&&(base+buff)*mult>=remain){newlyLethal++;break;}
      }
    }
    return ready.length*2+buff/90+newlyLethal*12+(ready.length>=3?6:0);
  }
  function cpuMimicFlyLarvaeValue(){
    if(cpuDeckArchetype()!=='mimicAggro')return -Infinity;
    const bugs=visibleDiscard('cpu').filter(x=>def(x).type==='insect'&&Number(def(x).cost||0)<=1);
    if(!bugs.length)return -20;
    const bodies=Math.min(2,bugs.length);
    const field=fieldActive('cpu').length;
    let v=bodies*5+(field<=1?10:field===2?5:0);
    if(fieldActive('cpu').some(fc=>passiveOfField(fc)?.type==='batesMimic'))v+=bodies*4;
    return v;
  }
  function cpuSingleAttack500Value(){
    const ready=fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc));
    const targets=attackableTargets('cpu');
    if(!ready.length||!targets.length)return -20;
    let best=0;
    for(const fc of ready){
      const attacks=availableAttacks('cpu',fc).filter(a=>usableAttack('cpu',fc,a));
      const base=Math.max(0,...attacks.map(a=>attackPower('cpu',fc,a)));
      for(const t of targets){
        const remain=maxHp(t)-t.damage;
        const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(t));
        if(base*mult<remain&&(base+500)*mult>=remain)best=Math.max(best,14+cpuFieldThreat(t,'player'));
      }
    }
    return best||2;
  }
  function cpuArchetypeActionBonus(inst){
    const c=def(inst),arch=cpuDeckArchetype();
    if(!c)return 0;
    let b=0;
    if(arch==='armyAnt'){
      const links=fieldActive('cpu').filter(fc=>passiveOfField(fc)?.type==='militaryLink').length;
      const ants=fieldActive('cpu').filter(fc=>/アリ/.test(fieldDef(fc).name||'')).length;
      if(passiveOfInst(inst)?.type==='militaryLink'){
        b+=8+links*4;
        if(c.name.includes('メジャー'))b+=ants>=2?12:-4;
        if((c.name.includes('マイナー')||c.name.includes('メディア'))&&links<2)b+=7;
      }
      if(c.name==='ミツツボアリ'&&state.cpu.bait.length<4&&state.cpu.hand.length>=3)b+=8;
      if(c.effect==='recoverInsect'&&visibleDiscard('cpu').some(x=>['ニセハナマオウカマキリ','バーチェルグンタイアリ メジャー'].includes(def(x).name)))b+=8;
    }else if(arch==='hercules'){
      if(c.name==='ヘラクレスオオカブト')b+=22;
      if(c.effect==='handTempSummon'&&cpuHandTempSummonTarget(inst.uid)&&def(cpuHandTempSummonTarget(inst.uid)).name==='ヘラクレスオオカブト')b+=16;
      if(c.effect==='attack500'&&fieldActive('cpu').some(fc=>fieldDef(fc).name==='ヘラクレスオオカブト'&&canAttackSide('cpu',fc)))b+=10;
    }else if(arch==='sumatra'){
      if(c.name==='スマトラオオヒラタクワガタ')b+=baitHasRGB('cpu')?24:-12;
      if(c.effect==='handTempSummon'){
        const t=cpuHandTempSummonTarget(inst.uid);
        if(t&&def(t).name==='スマトラオオヒラタクワガタ')b+=baitHasRGB('cpu')?16:-12;
      }
      if(c.effect==='worshipGreatSword'&&!visibleDiscard('cpu').some(x=>def(x).type==='enhance'))b-=12;
    }else if(arch==='bee'){
      const beeBait=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&def(x).name!=='オオスズメバチ（女王）'&&Number(def(x).cost||0)<=5).length;
      if(c.name==='オオスズメバチ（女王）')b+=beeBait?22+beeBait*3:-14;
      if(c.effect==='handTempSummon'){
        const t=cpuHandTempSummonTarget(inst.uid);
        if(t&&def(t).name==='オオスズメバチ（女王）')b+=beeBait?15:-12;
      }
      if(c.effect==='worshipGreatSword'&&!visibleDiscard('cpu').some(x=>def(x).type==='enhance'))b-=12;
    }else if(arch==='mimicAggro'){
      const bodies=fieldActive('cpu').length;
      const p=passiveOfInst(inst);
      if(p?.type==='batesMimic')b+=7+(bodies>=1?10:0);
      if(p?.type==='mimic')b+=6;
      if(c.type==='insect'&&Number(c.cost||0)<=1)b+=Math.max(0,3-bodies)*3;
      if(c.effect==='blackMountain')b+=cpuMimicBlackMountainValue();
      if(c.effect==='flyLarvae')b+=cpuMimicFlyLarvaeValue();
      if(c.effect==='singleAttack500')b+=cpuSingleAttack500Value();
      if(c.effect==='bloodPact')b+=cpuMimicBloodPactPlan(inst).score;
      if(c.effect==='eternalCocoon'&&fieldActive('player').length){
        const target=cpuHardRemovalTarget(fieldActive('player'),true);
        b+=(target?cpuFieldThreat(target,'player'):0)+(target&&cpuHasDeathTrigger(target)?16:0);
      }
    }
    return b;
  }
  function cpuHerculesAttackChoice(fc){
    const attacks=availableAttacks('cpu',fc).filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('cpu',fc,a));
    if(!attacks.length)return null;
    const smash=attacks.filter(a=>a.effect!=='bounceOnce').sort((a,b)=>attackPower('cpu',fc,b)-attackPower('cpu',fc,a))[0]||null;
    const bounce=attacks.find(a=>a.effect==='bounceOnce')||null;
    if(!bounce)return smash;
    const targets=attackableTargets('cpu');
    if(!targets.length)return smash||bounce;
    const otherReady=fieldActive('cpu').filter(x=>x!==fc&&canAttackSide('cpu',x)).length;
    if(targets.length===1&&otherReady>=1)return bounce;
    if(smash){
      const power=attackPower('cpu',fc,smash);
      const killable=targets.some(t=>{
        const mult=weaknessMultiplier(effectiveColor(fc),effectiveColor(t));
        return power*mult>=maxHp(t)-t.damage;
      });
      if(killable)return smash;
    }
    const best=cpuHardRemovalTarget(targets,false);
    if(best&&cpuFieldThreat(best,'player')>=cpuPolicyValue('bounceThreatThreshold',7))return bounce;
    return smash||bounce;
  }

  function cpuShouldPayBloodPactWithTerritory(inst){
    if(currentCpuDifficulty()==='normal')return false;
    const arch=cpuDeckArchetype();
    if(arch==='colorBlessing')return cpuColorBlessingBloodPactPlan(inst).useTerritory;
    if(arch==='mimicAggro')return cpuMimicBloodPactPlan(inst).useTerritory;
    return false;
  }

  function cpuChooseExpertAction(usable,mode){
    if(!usable.length)return null;
    const arch=cpuDeckArchetype();
    if(mode==='veryStrong'&&arch==='aquatic')return cpuAquaticBossAction(usable);

    if(mode==='veryStrong'&&arch==='armyAnt'){
      const linksOn=fieldActive('cpu').filter(fc=>passiveOfField(fc)?.type==='militaryLink').length;
      const honey=usable.find(x=>def(x).name==='ミツツボアリ');
      if(honey&&state.cpu.bait.length<4&&state.cpu.hand.length>=3)return honey;
      const cheapLinks=usable.filter(x=>passiveOfInst(x)?.type==='militaryLink'&&effectiveCardCost('cpu',x)<=1);
      if(linksOn<2&&cheapLinks.length)return [...cheapLinks].sort((a,b)=>cpuMainActionScore(b)-cpuMainActionScore(a))[0];
      const major=usable.find(x=>def(x).name==='バーチェルグンタイアリ メジャー');
      if(major&&fieldActive('cpu').filter(fc=>/アリ/.test(fieldDef(fc).name||'')).length>=2)return major;
    }
    if(mode==='veryStrong'&&arch==='hercules'){
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama){
        const t=cpuHandTempSummonTarget(tama.uid);
        if(t&&def(t).name==='ヘラクレスオオカブト'&&effectiveCardCost('cpu',t)>state.cpu.cost)return tama;
      }
      const herc=usable.find(x=>def(x).name==='ヘラクレスオオカブト');
      if(herc)return herc;
      const needle=usable.find(x=>def(x).effect==='attack500');
      if(needle&&cpuSingleAttack500Value()>=12)return needle;
    }
    if(mode==='veryStrong'&&arch==='sumatra'){
      const sumatra=usable.find(x=>def(x).name==='スマトラオオヒラタクワガタ');
      if(sumatra&&baitHasRGB('cpu'))return sumatra;
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama&&baitHasRGB('cpu')){
        const t=cpuHandTempSummonTarget(tama.uid);
        if(t&&def(t).name==='スマトラオオヒラタクワガタ')return tama;
      }
    }
    if(mode==='veryStrong'&&arch==='bee'){
      const queen=usable.find(x=>def(x).name==='オオスズメバチ（女王）');
      const beeBait=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&def(x).name!=='オオスズメバチ（女王）'&&Number(def(x).cost||0)<=5).length;
      if(queen&&beeBait)return queen;
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama&&beeBait){
        const t=cpuHandTempSummonTarget(tama.uid);
        if(t&&def(t).name==='オオスズメバチ（女王）')return tama;
      }
    }
    if(mode==='veryStrong'&&arch==='mimicAggro'){
      const blood=usable.find(x=>def(x).effect==='bloodPact');
      if(blood&&cpuMimicBloodPactPlan(blood).castNow)return blood;
      const cocoon=usable.find(x=>def(x).effect==='eternalCocoon');
      if(cocoon&&fieldActive('player').length===1){
        const t=cpuHardRemovalTarget(fieldActive('player'),true);
        if(t&&(cpuHasDeathTrigger(t)||cpuReadyAttackCount()>=1))return cocoon;
      }
      const swarm=usable.filter(x=>def(x).type==='insect'&&effectiveCardCost('cpu',x)<=1&&(passiveOfInst(x)?.type==='mimic'||passiveOfInst(x)?.type==='batesMimic'));
      if(fieldActive('cpu').length<3&&swarm.length)return [...swarm].sort((a,b)=>cpuMainActionScore(b)-cpuMainActionScore(a))[0];
      const mountain=usable.find(x=>def(x).effect==='blackMountain');
      if(mountain&&cpuMimicBlackMountainValue()>=12)return mountain;
      const larvae=usable.find(x=>def(x).effect==='flyLarvae');
      if(larvae&&cpuMimicFlyLarvaeValue()>=10)return larvae;
      const jaw=usable.find(x=>def(x).effect==='singleAttack500');
      if(jaw&&cpuSingleAttack500Value()>=12)return jaw;
    }

    if(mode==='veryStrong'&&arch==='termite'){
      const visible=visibleDiscard('cpu');
      const down=state.cpu.discard.filter(x=>x.discardFaceDown).length;
      const winter=usable.find(x=>def(x).effect==='pupaWintering');
      if(winter&&visible.length<2&&state.cpu.hand.length>=3)return winter;

      const guide=usable.find(x=>def(x).effect==='underworldGuide');
      if(guide&&fieldActive('cpu').every(fc=>passiveOfField(fc)?.type!=='colony')&&
         visible.some(x=>passiveOfInst(x)?.type==='colony'))return guide;

      const colonies=usable.filter(x=>passiveOfInst(x)?.type==='colony');
      if(colonies.length){
        if(down<2){
          return [...colonies].sort((a,b)=>
            effectiveCardCost('cpu',a)-effectiveCardCost('cpu',b)||
            cpuMainActionScore(b)-cpuMainActionScore(a)
          )[0];
        }
        return [...colonies].sort((a,b)=>cpuMainActionScore(b)-cpuMainActionScore(a))[0];
      }
    }

    if(mode==='veryStrong'&&arch==='colorBlessing'){
      const blood=usable.find(x=>def(x).effect==='bloodPact');
      const bloodPlan=blood?cpuColorBlessingBloodPactPlan(blood):null;
      if(blood&&bloodPlan?.immediateLethal)return blood;

      if(baitHasRGB('cpu')){
        const blessed=usable.filter(x=>passiveOfInst(x)?.type==='colorBlessing')
          .sort((a,b)=>cpuMainActionScore(b)-cpuMainActionScore(a));
        if(blessed.length)return blessed[0];
      }

      if(blood&&bloodPlan?.castNow)return blood;
    }

    if(arch==='aquatic'){
      // Public tournament lists use an aggressive beat plan: cheap pressure + blue bait ramp.
      const cheap=usable.filter(x=>{
        const c=def(x);
        return c.type==='insect'&&effectiveCardCost('cpu',x)<=1;
      });
      const aquatic=usable.filter(x=>passiveOfInst(x)?.type==='aquaticCost');
      if(aquatic.length){
        const best=[...aquatic].sort((a,b)=>cpuMainActionScore(b)-cpuMainActionScore(a))[0];
        if(effectiveCardCost('cpu',best)<=1)return best;
      }
      if(cheap.length&&fieldActive('cpu').length<2){
        return [...cheap].sort((a,b)=>cpuMainActionScore(b)-cpuMainActionScore(a))[0];
      }
      const blood=usable.find(x=>def(x).effect==='bloodPact');
      if(blood&&cpuOpponentHasSingleBlocker()&&cpuReadyAttackCount()>0)return blood;
      const flash=usable.find(x=>def(x).effect==='baitTempSummon');
      if(flash&&cpuShouldUseBaitTempSummon())return flash;
    }

    // Clear the last blocker first so the remaining insects can hit territory.
    const removal=usable.filter(cpuCanRemoveBlockerWith).sort((a,b)=>cpuComboPriority(b)-cpuComboPriority(a))[0];
    if(removal&&cpuReadyAttackCount()>0){
      const holdColorBlood=mode==='veryStrong'&&arch==='colorBlessing'&&def(removal).effect==='bloodPact'&&!cpuColorBlessingBloodPactPlan(removal).castNow;
      if(!holdColorBlood)return removal;
    }

    // Exact archetype playbooks.
    if(arch==='armyAnt'&&mode!=='veryStrong'){
      const links=usable.filter(x=>passiveOfInst(x)?.type==='militaryLink');
      if(links.length){
        return [...links].sort((a,b)=>{
          const ca=def(a),cb=def(b);
          // Major scales best after bodies are established; cheap links first.
          const va=(ca.name.includes('マイナー')?8:ca.name.includes('メディア')?7:4)-Number(ca.cost||0);
          const vb=(cb.name.includes('マイナー')?8:cb.name.includes('メディア')?7:4)-Number(cb.cost||0);
          return vb-va;
        })[0];
      }
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama)return tama;
    }

    if(arch==='bee'&&mode!=='veryStrong'){
      const queen=usable.find(x=>def(x).name==='オオスズメバチ（女王）');
      const beeBait=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&Number(def(x).cost||0)<=5).length;
      if(queen&&beeBait)return queen;
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama&&beeBait)return tama;
    }

    if(arch==='sumatra'&&mode!=='veryStrong'){
      const sumatra=usable.find(x=>def(x).name==='スマトラオオヒラタクワガタ');
      if(sumatra&&baitHasRGB('cpu'))return sumatra;
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama&&baitHasRGB('cpu'))return tama;
    }

    if(arch==='hercules'&&mode!=='veryStrong'){
      const herc=usable.find(x=>def(x).name==='ヘラクレスオオカブト');
      if(herc)return herc;
      const tama=usable.find(x=>def(x).effect==='handTempSummon'&&cpuShouldUseHandTempSummon(x));
      if(tama)return tama;
    }

    const sword=usable.find(x=>def(x).effect==='worshipGreatSword'&&fieldActive('cpu').some(fc=>fc.attacked)&&visibleDiscard('cpu').some(y=>def(y).type==='enhance'&&Number(def(y).cost||0)<=3));
    if(sword)return sword;

    const ranked=[...usable].sort((a,b)=>(cpuComboPriority(b)+cpuMainActionPlanScore(b,mode))-(cpuComboPriority(a)+cpuMainActionPlanScore(a,mode)));
    return ranked[0]||null;
  }

  function chooseBaitCPUSmart(hand,mode){
    if(mode==='veryStrong'&&cpuDeckArchetype()==='aquatic')return cpuAquaticBossChooseBait(hand);
    const missingColors=(()=>{
      const colors=new Set(faceUpBait('cpu').filter(x=>def(x).type==='insect').map(x=>baitCardColor(x)).filter(Boolean));
      return new Set(['red','blue','green'].filter(x=>!colors.has(x)));
    })();
    const wantsRGB=state.cpu.deckKey==='metaSumatra3Color'||state.cpu.deckKey==='metaColorBlessing'||state.cpu.deckKey==='metaMimicAggro'||cpuHasNameInOwnZones(/スマトラオオヒラタクワガタ/);
    const wantsBeeBait=state.cpu.deckKey==='metaBee'||cpuHasNameInOwnZones(/オオスズメバチ（女王）/);
    const duplicateCount=new Map();
    for(const x of hand)duplicateCount.set(def(x).name,(duplicateCount.get(def(x).name)||0)+1);

    const baitCost=i=>{
      const c=def(i);let score=cpuCardKeepValue(i);
      if((duplicateCount.get(c.name)||0)>1)score-=1.4;
      if(['handTempSummon','destroyOpponent','burn1000','burn600','readyAttack'].includes(c.effect))score+=3.5;
      if(c.effect==='worshipGreatSword'&&!visibleDiscard('cpu').some(x=>def(x).type==='enhance'))score-=4;
      if(c.effect==='baitBoost')score+=1.5;
      if(wantsRGB&&c.type==='insect'&&missingColors.has(c.color))score-=4.5;
      if(cpuDeckArchetype()==='colorBlessing'){
        const rgbPriority=cpuPolicyValue('rgbBaitPriority',9);
        if(c.type==='insect'&&missingColors.has(c.color)){
          score-=rgbPriority;
          // Preserve the actual payoff cards when another missing-color body is available.
          if(passiveOfInst(i)?.type==='colorBlessing')score+=5;
          if((duplicateCount.get(c.name)||0)>1)score-=2;
        }else if(missingColors.size&&c.type==='insect'&&!['red','blue','green'].includes(c.color)){
          score+=3;
        }
        if(c.effect==='bloodPact')score+=12;
      }
      if(wantsBeeBait&&c.type==='insect'&&/バチ/.test(c.name)&&c.name!=='オオスズメバチ（女王）'&&Number(c.cost||0)<=5){
        const beeBait=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&def(x).name!=='オオスズメバチ（女王）'&&Number(def(x).cost||0)<=5).length;
        score-=beeBait<2?cpuPolicyValue('engineBaitPriority',8):3.2;
      }
      if(cpuDeckArchetype()==='bee'&&c.name==='オオスズメバチ（女王）')score+=18;
      if(cpuDeckArchetype()==='sumatra'){
        if(c.type==='insect'&&missingColors.has(c.color))score-=cpuPolicyValue('rgbBaitPriority',8);
        if(c.name==='スマトラオオヒラタクワガタ')score+=18;
      }
      if(cpuDeckArchetype()==='mimicAggro'){
        if(c.type==='insect'&&missingColors.has(c.color)&&cpuHasNameInOwnZones(/常闇の繭籠もり/))score-=cpuPolicyValue('rgbBaitPriority',7);
        if(c.effect==='bloodPact')score+=10;
        if(c.effect==='eternalCocoon')score+=8;
      }
      if(cpuDeckArchetype()==='armyAnt'){
        if(c.name==='ミツツボアリ'&&state.cpu.bait.length<4)score+=6;
        if(passiveOfInst(i)?.type==='militaryLink'&&fieldActive('cpu').filter(fc=>passiveOfField(fc)?.type==='militaryLink').length<2)score+=5;
      }
      if(cpuDeckArchetype()==='termite'){
        const down=state.cpu.discard.filter(x=>x.discardFaceDown).length;
        const colonyOnField=fieldActive('cpu').filter(fc=>passiveOfField(fc)?.type==='colony').length;
        if(passiveOfInst(i)?.type==='colony')score+=down<3||colonyOnField===0?8:4;
        if(c.effect==='pupaWintering'&&visibleDiscard('cpu').length<2)score+=6;
        if(c.effect==='underworldGuide'&&visibleDiscard('cpu').some(x=>def(x).type==='insect'))score+=5;
      }
      if(cpuDeckArchetype()==='hercules'){
        if(c.name==='ヘラクレスオオカブト'||c.effect==='handTempSummon')score+=15;
        if(c.name==='ゴライアスオオツノハナムグリ')score-=2;
      }
      if(cpuHasNameInOwnZones(/ヒアリ/)&&c.type==='insect'&&c.color==='red')score-=1;
      if(cpuDeckArchetype()==='aquatic'){
        const blueCount=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&baitCardColor(x)==='blue').length;
        const blueFloor=Math.max(2,Math.round(cpuPolicyValue('blueBaitFloor',4)));
        if(c.type==='insect'&&c.color==='blue'&&blueCount<blueFloor)score-=5.5;
        if(['モンシロチョウ','モンキチョウ'].includes(c.name)){
          const partner=c.name==='モンシロチョウ'?'モンキチョウ':'モンシロチョウ';
          if(state.cpu.hand.some(x=>x.uid!==i.uid&&def(x).name===partner)&&state.cpu.bait.length>=1)score+=2.5;
        }
        if(c.effect==='baitTempSummon')score+=5;
      }
      return score;
    };
    const ranked=[...hand].sort((a,b)=>baitCost(a)-baitCost(b));
    const best=ranked[0];
    if(!best)return null;

    // Competitive decks need to reach their engine cost first. Do not stall at 3-4 bait.
    const baitCount=state.cpu.bait.length;
    const target=cpuResourceTarget();
    if(baitCount<target)return best;

    // Once the engine is online, stop converting combo pieces into bait.
    const threshold=mode==='veryStrong'?6.5:7.5;
    if(hand.length<=2&&baitCost(best)>threshold)return null;
    if(baitCost(best)>threshold+1.5)return null;
    return best;
  }

  function cpuMainActionScore(inst){
    const c=def(inst),s=state.cpu;
    if(!c)return -Infinity;
    const cost=effectiveCardCost('cpu',inst);
    let score=cpuCardKeepValue(inst)-cost*0.55+cpuArchetypeActionBonus(inst);

    if(c.type==='insect'){
      score+=Number(c.hp||0)/240+cpuMaxPrintedAttack(c)/155;
      if(cost<=1)score+=cpuPolicyValue('cheapDeployBonus',0);
      const p=passiveOfInst(inst);
      if(p?.type==='militaryLink')score+=fieldActive('cpu').filter(fc=>passiveOfField(fc)?.type==='militaryLink').length*5;
      if(p?.type==='sumatraNature'){
        score+=baitHasRGB('cpu')?14:-6;
      }
      if(cpuDeckArchetype()==='termite'&&p?.type==='colony'){
        const down=s.discard.filter(x=>x.discardFaceDown).length;
        const visible=visibleDiscard('cpu').length;
        score+=8+down*5+(visible?6:0);
        if(cost<=2&&down<2)score+=5;
      }
      if(cpuDeckArchetype()==='colorBlessing'){
        if(p?.type==='colorBlessing'){
          score+=baitHasRGB('cpu')?16:2;
          if(baitHasRGB('cpu')&&cost<=2)score+=8;
        }
        const missing=cpuColorBlessingMissingColors();
        if(!baitHasRGB('cpu')&&c.type==='insect'&&missing.has(c.color)){
          const alternatives=s.hand.filter(x=>x.uid!==inst.uid&&def(x).type==='insect'&&def(x).color===c.color);
          if(!alternatives.length)score-=10;
        }
        const downUseful=s.bait.some(x=>x.faceDown&&def(x).type==='insect'&&['red','blue','green'].includes(baitCardColor(x)));
        if(p?.type==='shineEntry'&&downUseful)score+=10;
        if(c.name==='ゲンジボタル'&&downUseful)score+=6;
      }
      if(c.name==='オオスズメバチ（女王）'){
        const bees=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&Number(def(x).cost||0)<=5).length;
        score+=bees*4+(bees?8:-2);
      }
      if(p?.type==='altSacrifice2'&&cost>s.cost){
        const fodder=[...fieldActive('cpu')].sort((a,b)=>cpuFieldThreat(a,'cpu')-cpuFieldThreat(b,'cpu')).slice(0,2);
        const sacrifice=fodder.reduce((n,fc)=>n+cpuFieldThreat(fc,'cpu'),0);
        score-=sacrifice*1.05;
        const unspent=fodder.filter(fc=>canAttackSide('cpu',fc)).length;
        if(['armyAnt','mimicAggro'].includes(cpuDeckArchetype()))score-=unspent*9;
      }
      if(Number(c.cost||0)>=5&&s.cost<cost&&s.hand.some(x=>def(x).effect==='handTempSummon'))score-=3;
      return score;
    }

    if(c.type==='enhance'){
      const targets=fieldActive('cpu').filter(fc=>canAttachEnhancement(fc,inst));
      if(!targets.length)return -Infinity;
      const m=attachmentModifier(inst);
      score+=3+(Math.max(0,m.attack)+Math.max(0,m.hp))/220;
      score+=Math.max(...targets.map(fc=>cpuFieldThreat(fc,'cpu')))*0.16;
      return score;
    }

    const opp=fieldActive('player');
    const ready=fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc)).length;
    const tempHandTarget=c.effect==='handTempSummon'?cpuHandTempSummonTarget(inst.uid):null;
    const bestHandBug=tempHandTarget?cpuCardKeepValue(tempHandTarget):0;
    const effectScore={
      allAttack200:ready*2.8,
      allAttack300:ready*3.5,
      baitBoost:s.bait.length<4?6:1,
      readyAttack:fieldActive('cpu').some(fc=>fc.attacked)?10:-4,
      handTempSummon:cpuShouldUseHandTempSummon(inst)?bestHandBug*1.1+6:-40,
      baitTempSummon:cpuShouldUseBaitTempSummon()?14+Math.max(0,...faceUpBait('cpu').filter(x=>def(x).type==='insect').map(cpuTempSummonValue))*0.35:-30,
      baitRushTwo:faceUpBait('cpu').filter(x=>def(x).type==='insect').length>=2?10:2,
      recoverInsect:Math.max(0,...visibleDiscard('cpu').filter(x=>def(x).type==='insect').map(cpuCardKeepValue))*0.65,
      destroyOpponent:opp.length?Math.max(...opp.map(fc=>cpuFieldThreat(fc,'player')))*0.95:0,
      eternalCocoon:opp.length?Math.max(...opp.map(fc=>cpuFieldThreat(fc,'player')))*1.0:0,
      bloodPact:opp.length?(cpuDeckArchetype()==='colorBlessing'?cpuColorBlessingBloodPactPlan(inst).score:cpuDeckArchetype()==='mimicAggro'?cpuMimicBloodPactPlan(inst).score:Math.max(...opp.map(fc=>cpuFieldThreat(fc,'player')))*1.1):0,
      blackMountain:cpuMimicBlackMountainValue(),
      flyLarvae:cpuMimicFlyLarvaeValue(),
      singleAttack500:cpuSingleAttack500Value(),
      pupaWintering:s.hand.length>=2?(visibleDiscard('cpu').length<2?12:4):-20,
      underworldGuide:visibleDiscard('cpu').some(x=>def(x).type==='insect')
        ?10+Math.max(0,...visibleDiscard('cpu').filter(x=>def(x).type==='insect').map(cpuCardKeepValue))*0.45
        :-20,
      worshipGreatSword:fieldActive('cpu').some(fc=>fc.attacked)&&visibleDiscard('cpu').some(x=>def(x).type==='enhance'&&Number(def(x).cost||0)<=3)?13:-8
    };
    score+=effectScore[c.effect]??2.2;
    if(c.effect==='burn600'||c.effect==='burn1000'){
      const dmg=c.effect==='burn1000'?1000:600;
      const lethal=opp.filter(fc=>fc.damage+dmg>=maxHp(fc));
      score+=lethal.length?14+Math.max(...lethal.map(fc=>cpuFieldThreat(fc,'player')))*0.45:2;
    }
    return score;
  }

  function cpuAbstractCost(inst,budget){
    const c=def(inst),base=Math.max(0,effectiveCardCost('cpu',inst));
    if(c.type==='insect'&&passiveOfInst(inst)?.type==='altSacrifice2'&&base>budget&&fieldActive('cpu').length>=2)return 0;
    if(c.effect==='bloodPact'&&cpuShouldPayBloodPactWithTerritory(inst))return 0;
    return base;
  }
  function cpuPlanPairSynergy(a,b){
    const ca=def(a),cb=def(b);let s=0;
    if(ca.type==='insect'&&cb.type==='enhance')s+=3;
    if(passiveOfInst(a)?.type==='militaryLink'&&passiveOfInst(b)?.type==='militaryLink')s+=6;
    if(ca.name==='オオスズメバチ（女王）'&&/バチ/.test(cb.name||''))s+=2;
    if(ca.type==='insect'&&['allAttack200','allAttack300'].includes(cb.effect))s+=2.5;
    if(ca.effect==='nextSpellDiscount'&&cb.type==='spell')s+=3;
    if(ca.effect==='handTempSummon'&&cb.type==='insect'&&Number(cb.cost||0)>=4)s+=7;
    return s;
  }
  function cpuPlanSearchFrom(first,usable,depth=4){
    const startBudget=state.cpu.cost;
    const firstCost=cpuAbstractCost(first,startBudget);
    if(firstCost>startBudget&&!(def(first).type==='insect'&&passiveOfInst(first)?.type==='altSacrifice2'))return -Infinity;
    const remaining=usable.filter(x=>x.uid!==first.uid);
    const dfs=(last,list,budget,left)=>{
      if(left<=0||!list.length)return 0;
      let best=0;
      for(const next of list){
        const cost=cpuAbstractCost(next,budget);
        if(cost>budget)continue;
        const immediate=cpuMainActionScore(next)+cpuPlanPairSynergy(last,next);
        const future=dfs(next,list.filter(x=>x.uid!==next.uid),Math.max(0,budget-cost),left-1);
        best=Math.max(best,immediate+future*0.62);
      }
      return best;
    };
    let score=cpuMainActionScore(first);
    score+=dfs(first,remaining,Math.max(0,startBudget-firstCost),depth-1)*0.68;
    const ready=fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc));
    if(ready.length)score+=ready.reduce((n,fc)=>n+Math.max(0,cpuBestAttackScore(fc,'strong')),0)*0.15;
    return score;
  }
  function cpuEstimatedFollowUpScore(first){
    const usable=state.cpu.hand.filter(x=>canUseHandCardCPU(x));
    return Math.max(0,cpuPlanSearchFrom(first,usable,2)-cpuMainActionScore(first));
  }
  function cpuMainActionPlanScore(inst,mode){
    if(mode==='veryStrong'){
      const usable=state.cpu.hand.filter(x=>canUseHandCardCPU(x));
      return cpuPlanSearchFrom(inst,usable,4);
    }
    return cpuMainActionScore(inst);
  }
  function chooseCpuMainActionSmart(usable,mode){
    if(!usable.length)return null;
    const ranked=[...usable].sort((a,b)=>cpuMainActionPlanScore(b,mode)-cpuMainActionPlanScore(a,mode));
    const best=ranked[0];
    const bestScore=best?cpuMainActionPlanScore(best,mode):-Infinity;
    // Don't dump weak cards just because they are legal.
    const baseThreshold=mode==='veryStrong'?6.5:7.5;
    const threshold=cpuPolicyValue('deployThreshold',baseThreshold);
    return bestScore>=threshold?best:null;
  }
  function cpuChoosePlannedFirstAction(usable){
    if(!usable.length)return null;
    const ranked=[...usable].sort((a,b)=>cpuPlanSearchFrom(b,usable,4)-cpuPlanSearchFrom(a,usable,4));
    const best=ranked[0];
    return best&&cpuPlanSearchFrom(best,usable,4)>=cpuPolicyValue('deployThreshold',6.5)?best:null;
  }

  function cpuAttackOptionScore(fc,attack,mode){
    const targets=attackableTargets('cpu');
    const base=attackPower('cpu',fc,attack);
    let score=(base/110)*cpuPolicyValue('aggression',1);
    const effectBonus={
      mantisCombo:7,flip:5,stinkHorn:4,bounceOnce:9,persistentDamage:3,
      oncePerEntry:3,selfDestruct:-1,queenOviposition:8,multiTwo:5,
      directBaitReturn:4,sourceAttackLock:4,sourceAttackLockPersistent:5,
      rainbowColor:3,banditArm:5,hawkEye:5,cannibal:4
    };
    score+=effectBonus[attack.effect]||0;
    if(attack.effect==='queenOviposition'){
      score+=faceUpBait('cpu').filter(x=>def(x).type==='insect'&&/バチ/.test(def(x).name)&&Number(def(x).cost||0)<=5).length*5;
    }
    if(attack.effect==='bounceOnce'&&targets.length)score+=Math.max(...targets.map(t=>cpuFieldThreat(t,'player')))*0.5;
    if(attack.effect==='cannibal'){
      const fodder=fieldActive('cpu').filter(x=>x!==fc).sort((a,b)=>cpuFieldThreat(a,'cpu')-cpuFieldThreat(b,'cpu'))[0];
      if(fodder)score-=cpuFieldThreat(fodder,'cpu')*0.3;
    }

    if(!targets.length){
      const terr=state.player.territory.length;
      score+=(22+Math.max(0,6-terr)*4+(terr<=2?12:0)+(terr===0?40:0))*cpuPolicyValue('directAttackWeight',1);
    }else{
      let bestTarget=-Infinity;
      for(const t of targets){
        const noWeak=hasAttachment(t,'noWeakness')||(passiveOfField(t)?.type==='whiteShell'&&t.whiteShellTurn===state.turnSeq);
        const damage=base*(noWeak?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(t)));
        const lethal=damage>=maxHp(t)-t.damage;
        const rw=cpuPolicyValue('removalWeight',1);
        let ts=cpuFieldThreat(t,'player')*0.35*rw+damage/220+(lethal?12*rw:0);
        bestTarget=Math.max(bestTarget,ts);
      }
      score+=bestTarget;
    }

    if(mode==='veryStrong'){
      const otherReady=fieldActive('cpu').filter(x=>x!==fc&&canAttackSide('cpu',x));
      let next=0;
      for(const other of otherReady){
        const ats=availableAttacks('cpu',other).filter(a=>!(oncePerEntryEffect(a.effect)&&other.usedAttacks.has(a.name))&&usableAttack('cpu',other,a));
        for(const a of ats)next=Math.max(next,attackPower('cpu',other,a)/130);
      }
      score+=next*0.55;
    }
    return score;
  }
  function chooseAttackCPUByMode(fc,mode){
    if(mode==='veryStrong'&&cpuDeckArchetype()==='aquatic')return cpuAquaticBossAttackChoice(fc);
    if(mode==='veryStrong'&&cpuDeckArchetype()==='hercules'&&fieldDef(fc).name==='ヘラクレスオオカブト')return cpuHerculesAttackChoice(fc);
    const ats=availableAttacks('cpu',fc).filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('cpu',fc,a));
    if(!ats.length)return null;
    return [...ats].sort((a,b)=>cpuAttackOptionScore(fc,b,mode)-cpuAttackOptionScore(fc,a,mode))[0];
  }
  function cpuBestAttackScore(fc,mode){
    const a=chooseAttackCPUByMode(fc,mode);
    return a?cpuAttackOptionScore(fc,a,mode):-Infinity;
  }
  function chooseCpuAttackerSmart(mode){
    if(mode==='veryStrong'&&cpuDeckArchetype()==='aquatic')return cpuAquaticBossAttacker();
    const ready=fieldActive('cpu').filter(fc=>canAttackSide('cpu',fc));
    if(!ready.length)return null;
    return [...ready].sort((a,b)=>cpuBestAttackScore(b,mode)-cpuBestAttackScore(a,mode))[0];
  }

  function chooseBaitCPU(hand){
    const score=i=>{const c=def(i);let v=c.cost*1.2;if(c.type==='insect')v+=(c.hp/500)+(Math.max(...c.attacks.map(a=>Number(a.power||0)))/300);if(c.effect==='baitBoost')v-=2;if(c.effect==='allAttack200')v-=.5;return v;};
    return [...hand].sort((a,b)=>score(a)-score(b))[0];
  }
  function chooseAttackCPU(fc){
    const c=fieldDef(fc); let ats=availableAttacks('cpu',fc).filter(a=>!(oncePerEntryEffect(a.effect)&&fc.usedAttacks.has(a.name))&&usableAttack('cpu',fc,a));
    const cann=ats.find(a=>a.effect==='cannibal');if(cann&&fieldActive('cpu').length>1)return cann;
    const combo=ats.find(a=>a.effect==='mantisCombo');if(combo)return combo;
    const flip=ats.find(a=>a.effect==='flip');if(flip&&fieldActive('player').length===1)return flip;
    const stink=ats.find(a=>a.effect==='stinkHorn');if(stink&&fieldActive('player').length)return stink;
    return [...ats].sort((a,b)=>attackPower('cpu',fc,b)-attackPower('cpu',fc,a))[0];
  }
  function chooseMantisSecondAttackCPU(fc){return fieldDef(fc).attacks.find(a=>a.effect==='mantisCombo')||null;}
  function chooseAttackTargetCPU(fc,attack,targets){
    const mode=currentCpuDifficulty();
    const base=attackPower('cpu',fc,attack);
    if(cpuAquaticBossActive()&&attack.effect==='reverseSwap'){
      return [...targets].sort((a,b)=>cpuFieldThreat(b,'player')-cpuFieldThreat(a,'player'))[0];
    }
    if(mode==='normal'){
      return [...targets].sort((a,b)=>{
        const nwa=hasAttachment(a,'noWeakness')||(passiveOfField(a)?.type==='whiteShell'&&a.whiteShellTurn===state.turnSeq);
        const nwb=hasAttachment(b,'noWeakness')||(passiveOfField(b)?.type==='whiteShell'&&b.whiteShellTurn===state.turnSeq);
        const da=base*(nwa?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(a))); const db=base*(nwb?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(b)));
        const ka=da>=maxHp(a)-a.damage?10000:0, kb=db>=maxHp(b)-b.damage?10000:0;
        return (kb+def(b.inst).cost*100-(maxHp(b)-b.damage))-(ka+def(a.inst).cost*100-(maxHp(a)-a.damage));
      })[0];
    }
    const attackResult=t=>{
      const nw=hasAttachment(t,'noWeakness')||(passiveOfField(t)?.type==='whiteShell'&&t.whiteShellTurn===state.turnSeq);
      const dmg=base*(nw?1:weaknessMultiplier(effectiveColor(fc),effectiveColor(t)));
      const remain=maxHp(t)-t.damage;
      return {dmg,remain,lethal:dmg>=remain};
    };
    const killable=targets.filter(t=>attackResult(t).lethal);

    // Fundamental combat rule for smart CPU:
    // if this attacker can remove a body, take a guaranteed removal rather than
    // chip a more valuable enemy and leave both insects alive.
    if(killable.length){
      const killScore=t=>{
        const {dmg,remain}=attackResult(t);
        const removalWeight=cpuPolicyValue('removalWeight',1);
        let score=cpuFieldThreat(t,'player')*removalWeight;
        const p=passiveOfField(t);
        if(p?.type==='taunt'||p?.type==='pollen')score+=12;
        if(t.forceTargetTurn===state.turnSeq||t.forcedTargetTurn===state.turnSeq)score+=8;
        // Among multiple kills, prefer valuable enemies but avoid wasting huge damage
        // when a smaller attack can remove a similar target.
        score-=Math.max(0,dmg-remain)/700;
        if(mode==='veryStrong'){
          const next=fieldActive('cpu').filter(x=>x!==fc&&canAttackSide('cpu',x)).reduce((m,x)=>Math.max(m,cpuBestAttackScore(x,'strong')),0);
          score+=next*0.2;
        }
        return score;
      };
      return [...killable].sort((a,b)=>killScore(b)-killScore(a))[0];
    }

    // No guaranteed kill exists: now chip the most strategically dangerous insect.
    const targetScore=t=>{
      const {dmg,remain}=attackResult(t);
      const removalWeight=cpuPolicyValue('removalWeight',1);
      let score=cpuFieldThreat(t,'player')*removalWeight+Math.min(dmg,remain)/180;
      const p=passiveOfField(t);
      if(p?.type==='taunt'||p?.type==='pollen')score+=12;
      if(t.forceTargetTurn===state.turnSeq||t.forcedTargetTurn===state.turnSeq)score+=8;
      // Prefer damage that meaningfully advances a future KO instead of tiny scratches.
      score+=Math.min(1,dmg/Math.max(1,remain))*4;
      return score;
    };
    return [...targets].sort((a,b)=>targetScore(b)-targetScore(a))[0];
  }
  function chooseEnhanceTargetCPU(c,targets){
    if(currentCpuDifficulty()==='normal')return [...targets].sort((a,b)=>def(b.inst).cost-def(a.inst).cost)[0];
    const score=fc=>{
      let v=cpuFieldThreat(fc,'cpu');
      if(fc.temporaryDestroyTurn===state.turnSeq||fc.temporary)v-=5;
      if(canAttackSide('cpu',fc))v+=cpuBestAttackScore(fc,'strong')*0.35;
      if(cpuDeckArchetype()==='hercules'&&fieldDef(fc).name==='ヘラクレスオオカブト')v+=10;
      if(cpuDeckArchetype()==='sumatra'&&fieldDef(fc).name==='スマトラオオヒラタクワガタ')v+=10;
      if(cpuDeckArchetype()==='bee'&&fieldDef(fc).name==='オオスズメバチ（女王）')v+=8;
      return v;
    };
    return [...targets].sort((a,b)=>score(b)-score(a))[0];
  }
  function chooseBurnTargetCPU(targets){
    if(!targets.length)return null;
    if(cpuAquaticBossActive())return [...targets].sort((a,b)=>cpuFieldThreat(b,'player')-cpuFieldThreat(a,'player'))[0];
    if(currentCpuDifficulty()==='normal')return [...targets].sort((a,b)=>((600>=maxHp(b)-b.damage)?1000:0)+def(b.inst).cost*50-(((600>=maxHp(a)-a.damage)?1000:0)+def(a.inst).cost*50))[0];
    const damage=targets.some(t=>600>=maxHp(t)-t.damage)?600:1000;
    const killable=targets.filter(t=>damage>=maxHp(t)-t.damage);
    const pool=killable.length?killable:targets;
    const score=t=>{
      const remain=maxHp(t)-t.damage;
      const rw=cpuPolicyValue('removalWeight',1);
      let v=cpuFieldThreat(t,'player')*rw;
      if(killable.length)v-=Math.max(0,damage-remain)/700;
      else v+=Math.min(1,damage/Math.max(1,remain))*4;
      return v;
    };
    return [...pool].sort((a,b)=>score(b)-score(a))[0];
  }
  function bestColorAgainstCPU(target,oppSide){
    const opp=fieldActive(oppSide);
    if(!opp.length)return effectiveColor(target);
    if(currentCpuDifficulty()==='normal'){
      const oc=effectiveColor(opp[0]);return oc==='green'?'red':oc==='red'?'blue':'green';
    }
    const threat=[...opp].sort((a,b)=>cpuFieldThreat(b,oppSide)-cpuFieldThreat(a,oppSide))[0];
    const oc=effectiveColor(threat);
    return oc==='green'?'red':oc==='red'?'blue':'green';
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

  function choose(options,text,title='選択',previewRenderer=null){
    return new Promise(resolve=>{
      modalResolver=resolve;
      $('modalTitle').textContent=title;
      $('modalText').textContent=text;
      const preview=$('modalPreview');
      if(preview){
        preview.innerHTML='';
        preview.className='modal-preview';
        if(typeof previewRenderer==='function')previewRenderer(preview);
      }
      const wrap=$('modalOptions');wrap.innerHTML='';
      options.forEach(o=>{const b=document.createElement('button');b.className=`modal-option ${o.value===null?'cancel':''}`;b.innerHTML=`<b>${escapeHtml(o.title)}</b>${o.detail?`<small>${escapeHtml(o.detail)}</small>`:''}`;b.onclick=()=>closeModal(o.value);wrap.appendChild(b);});
      modal.classList.remove('hidden');
    });
  }
  function closeModal(value){
    if(modal.classList.contains('hidden'))return;
    modal.classList.add('hidden');
    const preview=$('modalPreview');if(preview)preview.innerHTML='';
    const r=modalResolver;modalResolver=null;if(r)r(value);
  }
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

  $('resultRestartBtn').addEventListener('click',()=>returnToLearning());
  $('newGameBtn').addEventListener('click',()=>returnToLearning());
  $('learningBtn').addEventListener('click',()=>returnToLearning());
  $('deckBuilderBtn').addEventListener('click',()=>openDeckBuilder());
  $('builderBackBtn').addEventListener('click',()=>closeDeckBuilder());
  $('newDeckBtn').addEventListener('click',()=>newBuilderDeck());
  $('saveDeckBtn').addEventListener('click',()=>saveBuilderDeck());
  $('deleteDeckBtn').addEventListener('click',()=>deleteBuilderDeck());
  $('savedDeckSelect').addEventListener('change',(event)=>{
    if(event.target.value)loadBuilderDeck(event.target.value);
    else newBuilderDeck();
  });
  for(const id of ['cardSetFilter','cardTypeFilter','cardColorFilter']){
    $(id).addEventListener('change',()=>renderCardCatalog());
  }
  $('cardSort').addEventListener('change',()=>{
    renderCardCatalog();
    renderBuilderDeckList();
  });
  const cardSearchInput=$('cardSearchInput');
  const runCardSearch=()=>renderCardCatalog();
  for(const eventName of ['input','change','search','compositionend']){
    cardSearchInput.addEventListener(eventName,runCardSearch);
  }
  cardSearchInput.addEventListener('keydown',(event)=>{
    if(event.key==='Enter'){
      event.preventDefault();
      cardSearchInput.blur();
      runCardSearch();
    }
  });
  $('cardSearchBtn').addEventListener('click',()=>{
    cardSearchInput.blur();
    runCardSearch();
  });
  $('cardSearchClearBtn').addEventListener('click',()=>{
    cardSearchInput.value='';
    runCardSearch();
    cardSearchInput.focus();
  });

  document.querySelectorAll('#startScreen .deck-choice[data-deck]').forEach(button=>{
    button.addEventListener('click',()=>chooseTurnOrder(button.dataset.deck));
  });
  document.querySelectorAll('input[name="cpuDifficulty"]').forEach(input=>{
    input.addEventListener('change',()=>{if(input.checked)setCpuDifficulty(input.value);});
  });
  setCpuDifficulty(cpuDifficulty);

  window.MUSHI_RUNTIME={
    engineVersion:Engine.version,
    events,
    getState:()=>state,
    fieldDef,
    getCustomDecks:()=>customDecks.map(deck=>({...deck,ids:[...deck.ids]})),
    getCpuDifficulty:()=>currentCpuDifficulty(),
    setCpuDifficulty,
    hasBattleAccess
  };

  renderCustomDeckChoices();
  refreshBattleGate();
  const params=new URLSearchParams(window.location.search);
  if(params.get('mode')==='builder')openDeckBuilder();
})();
