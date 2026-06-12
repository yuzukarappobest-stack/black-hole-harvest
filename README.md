# こども向けミニアプリ集

スマホ・タブレット向けの静的 Web アプリ集です。

## アプリ

- `hiragana.html`: ひらがな学習
- `math.html`: 算数学習
- `learn.html`: 学習アプリの親ページ
- `index.html`: ブラックホール・ハーベスト
- `kingfisher.html`: カワセミ・ダイブ

## 遊び方

ローカルでは静的サーバーで配信してください。

```sh
python3 -m http.server 8000
```

その後、以下を開きます。

- `http://localhost:8000/learn.html`
- `http://localhost:8000/math.html`
- `http://localhost:8000/`
- `http://localhost:8000/kingfisher.html`

## GitHub Pages URL

- 学習メニュー: https://yuzukarappobest-stack.github.io/black-hole-harvest/learn.html
- ひらがな学習: https://yuzukarappobest-stack.github.io/black-hole-harvest/hiragana.html
- 算数学習: https://yuzukarappobest-stack.github.io/black-hole-harvest/math.html
- ブラックホール・ハーベスト: https://yuzukarappobest-stack.github.io/black-hole-harvest/
- カワセミ・ダイブ: https://yuzukarappobest-stack.github.io/black-hole-harvest/kingfisher.html

静的ファイルだけで動くため、GitHub Pages の Source を `Deploy from a branch`、Branch を `main`、Folder を `/root` に設定すると公開できます。
