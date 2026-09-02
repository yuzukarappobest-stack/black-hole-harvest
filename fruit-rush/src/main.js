import { Game } from "./Game.js?v=18";

const game = new Game(document.querySelector("#gameRoot"));
document.querySelector("#startButton").addEventListener("click", async () => {
  const audioReady = game.unlockAudio();
  await game.enableTilt();
  game.start(audioReady);
});
document.querySelector("#restartButton").addEventListener("click", () => game.start());
document.querySelector("#magnetButton").addEventListener("click", () => game.activateMagnet());
