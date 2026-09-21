(() => {
  const MINI_GAME_ACCESS_PREFIX = "miniGameAccess:";
  const REWARD_TOKEN_KEY = "miniGameRewardToken";
  const RETURN_URL_KEY = "miniGameReturnUrl";
  const LEARNING_URL = "learn.html";

  const GAMES = [
    { id: "black-hole", label: "ブラックホール", sub: "天体をのみこめ！", icon: "🕳️", href: "index.html", soft: "#e9e8ff" },
    { id: "kingfisher", label: "カワセミ", sub: "水めんへダイブ！", icon: "🐦", href: "kingfisher.html", soft: "#e5f8ff" },
    { id: "tetris", label: "テトリス", sub: "ブロックをそろえよう", icon: "🧱", href: "tetris.html", soft: "#eef0ff" },
    { id: "butterfly", label: "ちょうちょ", sub: "ひらひらフライト", icon: "🦋", href: "butterfly.html", soft: "#fff0fb" },
    { id: "meteor", label: "いんせき", sub: "シューティング！", icon: "☄️", href: "meteor.html", soft: "#fff0e6" },
    { id: "race", label: "レース", sub: "ゴールをめざせ！", icon: "🏎️", href: "race.html", soft: "#ffeceb" },
    { id: "gem", label: "ほうせき", sub: "キラキラをあつめよう", icon: "💎", href: "gem.html", soft: "#e8f9ff" },
    { id: "pillbug", label: "ダンゴムシ", sub: "ころころチャレンジ", icon: "🪲", href: "pillbug.html", soft: "#f2efe7" },
    { id: "dango-shot", label: "ダンゴショット", sub: "ひっぱって とばそう", icon: "🎯", href: "dango-shot.html", soft: "#fff2e2" },
    { id: "planet-catch", label: "惑星キャッチ", sub: "わくせいをつかまえよう", icon: "🪐", href: "planet-catch.html", soft: "#eeeaff" },
    { id: "shooting-star", label: "流れ星", sub: "すばやくタップ！", icon: "🌠", href: "shooting-star.html", soft: "#e9efff" },
    { id: "frog-jump", label: "カエルジャンプ", sub: "ぴょんぴょん進もう", icon: "🐸", href: "frog-jump.html", soft: "#e9f8df" },
    { id: "fruit-rush", label: "フルーツラッシュ", sub: "フルーツであそぼう", icon: "🍓", href: "fruit-rush/", soft: "#fff0e8" },
    { id: "space-blaster", label: "スペースブラスター", sub: "うちゅうバトル！", icon: "🚀", href: "space-blaster/", soft: "#e9edff" },
    { id: "kabuto-sumo", label: "カブトムシ相撲", sub: "連打で押し出せ！", icon: "🪲", href: "kabuto-sumo/", soft: "#f5eadb" },
    { id: "kaiju-defense", label: "かいじゅうぼうえいせん", sub: "まちをまもれ！", icon: "🦖", href: "kaiju-defense/", soft: "#e8f4df" }
  ];

  const grid = document.getElementById("gameGrid");
  let choosing = false;

  function hasRewardToken() {
    return Boolean(sessionStorage.getItem(REWARD_TOKEN_KEY));
  }

  function requireRewardToken() {
    if (hasRewardToken()) return true;
    window.location.replace(LEARNING_URL);
    return false;
  }

  function chooseGame(game) {
    if (choosing) return;
    choosing = true;

    const token = sessionStorage.getItem(REWARD_TOKEN_KEY);
    if (!token) {
      window.location.replace(LEARNING_URL);
      return;
    }

    sessionStorage.removeItem(REWARD_TOKEN_KEY);
    sessionStorage.setItem(MINI_GAME_ACCESS_PREFIX + game.id, "1");
    sessionStorage.setItem(RETURN_URL_KEY, LEARNING_URL);

    document.querySelectorAll(".game-card").forEach((button) => {
      button.disabled = true;
    });

    window.location.replace(game.href);
  }

  function render() {
    grid.innerHTML = "";

    for (const game of GAMES) {
      const button = document.createElement("button");
      button.className = "game-card";
      button.type = "button";
      button.style.setProperty("--accent-soft", game.soft);
      button.innerHTML =
        '<span class="icon" aria-hidden="true">' + game.icon + '</span>' +
        '<span class="game-text"><strong>' + game.label + '</strong><small>' + game.sub + '</small></span>';
      button.addEventListener("click", () => chooseGame(game));
      grid.appendChild(button);
    }
  }

  if (!requireRewardToken()) return;

  render();

  window.addEventListener("pageshow", () => {
    if (!hasRewardToken()) {
      window.location.replace(LEARNING_URL);
    }
  });
})();