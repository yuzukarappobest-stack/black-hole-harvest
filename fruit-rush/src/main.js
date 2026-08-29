import { Game } from "./Game.js?v=4";

const game = new Game(document.querySelector("#gameRoot"));
document.querySelector("#startButton").addEventListener("click", () => game.start());
document.querySelector("#restartButton").addEventListener("click", () => game.start());
document.querySelector("#magnetButton").addEventListener("click", () => game.activateMagnet());
