(() => {
  'use strict';

  const ZONE = Object.freeze({
    DECK:'deck',
    HAND:'hand',
    FIELD:'field',
    TERRITORY:'territory',
    BAIT:'bait',
    BAIT_FACE_DOWN:'baitFaceDown',
    DISCARD:'discard',
    DISCARD_FACE_DOWN:'discardFaceDown'
  });

  const EVENT = Object.freeze({
    TURN_START:'TURN_START',
    TURN_END:'TURN_END',
    CARD_USE_DECLARED:'CARD_USE_DECLARED',
    COST_PAID:'COST_PAID',
    REACTION_WINDOW:'REACTION_WINDOW',
    CARD_RESOLVING:'CARD_RESOLVING',
    CARD_RESOLVED:'CARD_RESOLVED',
    INSECT_ENTERED:'INSECT_ENTERED',
    ATTACK_DECLARED:'ATTACK_DECLARED',
    BEFORE_DAMAGE:'BEFORE_DAMAGE',
    AFTER_DAMAGE:'AFTER_DAMAGE',
    INSECT_DESTROYED:'INSECT_DESTROYED',
    CARD_LEFT_FIELD:'CARD_LEFT_FIELD',
    TERRITORY_DRAWN:'TERRITORY_DRAWN',
    CARD_MOVED:'CARD_MOVED'
  });

  function createEventBus(){
    const listeners=new Map();
    let order=0;
    function on(type,handler,options={}){
      const item={handler,priority:Number(options.priority||0),order:order++};
      const arr=listeners.get(type)||[];
      arr.push(item);
      arr.sort((a,b)=>b.priority-a.priority||a.order-b.order);
      listeners.set(type,arr);
      return ()=>off(type,handler);
    }
    function off(type,handler){
      const arr=listeners.get(type)||[];
      listeners.set(type,arr.filter(x=>x.handler!==handler));
    }
    function emit(type,payload={}){
      const evt={type,cancelled:false,...payload};
      for(const item of [...(listeners.get(type)||[])]) item.handler(evt);
      return evt;
    }
    async function emitAsync(type,payload={}){
      const evt={type,cancelled:false,...payload};
      for(const item of [...(listeners.get(type)||[])]) await item.handler(evt);
      return evt;
    }
    function clear(){listeners.clear();}
    return {on,off,emit,emitAsync,clear};
  }

  function createCardInstance(uid,cardId,owner=null){
    return {uid,cardId,owner,faceDown:false};
  }

  function createRuntimeState(){
    return {
      overrides:{name:null,color:null,hp:null,attacks:null,effectText:null,passive:null},
      modifiers:[]
    };
  }

  function createFieldState(inst,extra={}){
    return {
      inst,
      damage:0,
      attacked:false,
      hidden:false,
      attachments:[],
      usedAttacks:new Set(),
      runtime:createRuntimeState(),
      // Legacy fields remain during migration so the starter set keeps identical behaviour.
      turnAttackBonus:0,
      attackPenaltyTurn:0,
      attackPenalty:0,
      changedColor:null,
      mimicTurn:0,
      ...extra
    };
  }

  function currentCardDefinition(base,fieldState){
    if(!fieldState?.runtime?.overrides) return base;
    const o=fieldState.runtime.overrides;
    return {
      ...base,
      name:o.name ?? base.name,
      color:o.color ?? base.color,
      hp:o.hp ?? base.hp,
      attacks:o.attacks ?? base.attacks,
      effectText:o.effectText ?? base.effectText,
      passive:o.passive ?? base.passive
    };
  }

  function setCardOverrides(fieldState,patch={}){
    if(!fieldState.runtime) fieldState.runtime=createRuntimeState();
    Object.assign(fieldState.runtime.overrides,patch);
  }

  function clearCardOverrides(fieldState){
    if(!fieldState.runtime) fieldState.runtime=createRuntimeState();
    fieldState.runtime.overrides={name:null,color:null,hp:null,attacks:null,effectText:null,passive:null};
  }

  let modifierCounter=1;
  function addModifier(fieldState,modifier){
    if(!fieldState.runtime) fieldState.runtime=createRuntimeState();
    const item={id:'m'+modifierCounter++,...modifier};
    fieldState.runtime.modifiers.push(item);
    return item.id;
  }

  function removeModifier(fieldState,id){
    if(!fieldState.runtime) return;
    fieldState.runtime.modifiers=fieldState.runtime.modifiers.filter(m=>m.id!==id);
  }

  function modifierActive(mod,turnSeq){
    if(mod.activeFromTurnSeq!=null && turnSeq<mod.activeFromTurnSeq)return false;
    if(mod.expiresAfterTurnSeq!=null && turnSeq>mod.expiresAfterTurnSeq)return false;
    return true;
  }

  function modifierTotal(fieldState,stat,turnSeq){
    return (fieldState?.runtime?.modifiers||[])
      .filter(m=>m.stat===stat && modifierActive(m,turnSeq))
      .reduce((sum,m)=>sum+Number(m.value||0),0);
  }

  function pruneExpiredModifiers(fieldState,turnSeq){
    if(!fieldState?.runtime)return;
    fieldState.runtime.modifiers=fieldState.runtime.modifiers.filter(m=>
      m.expiresAfterTurnSeq==null || turnSeq<=m.expiresAfterTurnSeq
    );
  }

  function ensureModernZones(sideState){
    if(!sideState.baitFaceDown)sideState.baitFaceDown=[];
    if(!sideState.discardFaceDown)sideState.discardFaceDown=[];
    return sideState;
  }

  function zoneCards(sideState,zone){
    ensureModernZones(sideState);
    const arr=sideState[zone];
    if(!Array.isArray(arr))throw new Error('Unknown zone: '+zone);
    return arr;
  }

  function moveCard(sideState,card,fromZone,toZone,options={}){
    const from=zoneCards(sideState,fromZone);
    const to=zoneCards(sideState,toZone);
    const idx=from.findIndex(x=>(x?.uid ?? x?.inst?.uid)===card.uid);
    if(idx<0)return false;
    const [moved]=from.splice(idx,1);
    if(options.faceDown!=null)moved.faceDown=!!options.faceDown;
    if(options.toBottom)to.unshift(moved);else to.push(moved);
    return moved;
  }

  async function resolveCardAction(config){
    const {
      bus,
      context={},
      validate,
      payCost,
      openReactionWindow,
      resolve,
      onCancelled
    }=config;

    if(validate && !(await validate()))return {ok:false,stage:'validate'};

    const declared=await bus.emitAsync(EVENT.CARD_USE_DECLARED,context);
    if(declared.cancelled)return {ok:false,stage:'declared'};

    if(payCost && !(await payCost()))return {ok:false,stage:'cost'};
    await bus.emitAsync(EVENT.COST_PAID,context);

    const reaction=await bus.emitAsync(EVENT.REACTION_WINDOW,context);
    if(openReactionWindow)await openReactionWindow(reaction);
    if(reaction.cancelled){
      if(onCancelled)await onCancelled(reaction);
      return {ok:false,cancelled:true,stage:'reaction'};
    }

    await bus.emitAsync(EVENT.CARD_RESOLVING,context);
    const result=resolve ? await resolve() : true;
    await bus.emitAsync(EVENT.CARD_RESOLVED,{...context,result});
    return {ok:result!==false,result,stage:'resolved'};
  }

  window.MUSHI_ENGINE={
    version:'2.0-foundation',
    ZONE,EVENT,
    createEventBus,
    createCardInstance,
    createRuntimeState,
    createFieldState,
    currentCardDefinition,
    setCardOverrides,
    clearCardOverrides,
    addModifier,
    removeModifier,
    modifierTotal,
    pruneExpiredModifiers,
    ensureModernZones,
    zoneCards,
    moveCard,
    resolveCardAction
  };
})();