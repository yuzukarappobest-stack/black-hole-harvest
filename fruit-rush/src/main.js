import { Game } from "./Game.js?v=18";

const GAME_ID = "fruit-rush";
const ACCESS_KEY = `miniGameAccess:${GAME_ID}`;
const learningUrl = () => `../${sessionStorage.getItem("miniGameReturnUrl") || "learn.html"}`;

function consumeAccess() {
  if (sessionStorage.getItem(ACCESS_KEY) !== "1") return false;
  sessionStorage.removeItem(ACCESS_KEY); return true;
}

if (!consumeAccess()) {
  window.location.replace(learningUrl());
} else {
  const game = new Game(document.querySelector("#gameRoot"));
  document.querySelector("#startButton").addEventListener("click", async () => {
    const audioReady = game.unlockAudio();
    await game.enableTilt();
    game.start(audioReady);
  });
  document.querySelector("#restartButton").addEventListener("click", () => game.start());
  document.querySelector("#returnButton").addEventListener("click", () => window.location.replace(learningUrl()));
  document.querySelector("#magnetButton").addEventListener("click", () => game.activateMagnet());
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.replace(learningUrl()); });
}
