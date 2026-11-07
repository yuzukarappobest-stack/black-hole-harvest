export const CONFIG = Object.freeze({
  monsterHealth: 5600, bulletDamage: 12, shotInterval: 0.105,
  walkSpeed: 11, monsterSpeed: 1.2, attackInterval: 6.5,
  knockdownSeconds: 1.5, mapLimit: 89, bestKey: "kaijuDefense.best.v1",
});
export const STAGES = Object.freeze({
  1: Object.freeze({
    id: 1, district: "BAY DISTRICT", subtitle: "湾岸防衛線", boss: "巨獣 ヴォルガ",
    health: CONFIG.monsterHealth, limit: CONFIG.mapLimit, walkSpeed: CONFIG.walkSpeed,
    playerZ: 42, monsterZ: -26, bestKey: CONFIG.bestKey,
  }),
  2: Object.freeze({
    id: 2, district: "SKY DISTRICT", subtitle: "広域迎撃戦", boss: "翼獣 アルカ",
    health: 4200, limit: 167, walkSpeed: 14,
    playerZ: 90, monsterZ: -20, altitude: 19,
    bestKey: "kaijuDefense.best.stage2.v1",
  }),
});
export const STAGE_TWO_UNLOCK = "kaijuDefense.stage2Unlocked.v1";
export const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;

