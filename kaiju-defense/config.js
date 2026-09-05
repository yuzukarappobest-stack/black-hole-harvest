export const CONFIG = Object.freeze({
  monsterHealth: 5600, bulletDamage: 12, shotInterval: 0.105,
  walkSpeed: 11, monsterSpeed: 1.2, attackInterval: 6.5,
  knockdownSeconds: 1.5, mapLimit: 89, bestKey: "kaijuDefense.best.v1",
});
export const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
