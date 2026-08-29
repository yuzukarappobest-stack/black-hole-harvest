import { Game } from "./Game.js?v=9";

const game = new Game(document.querySelector("#gameRoot"));
document.querySelector("#startButton").addEventListener("click", () => game.start());
document.querySelector("#restartButton").addEventListener("click", () => game.start());
document.querySelector("#magnetButton").addEventListener("click", () => game.activateMagnet());
const tiltButton = document.querySelector("#tiltButton");
tiltButton.addEventListener("click", async () => {
  const enabled = await game.enableTilt();
  tiltButton.textContent = enabled ? "かたむきそうさ OK" : "スワイプで そうさしてね";
  tiltButton.disabled = true;
});
