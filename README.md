# こども向けミニアプリ集

スマホ・タブレット向けの静的 Web アプリ集です。

## アプリ

- `hiragana.html`: ひらがな学習
- `hiragana-dakuon.html`: ひらがな第二弾（濁音・半濁音・拗音）
- `katakana.html`: カタカナ学習
- `math.html`: 算数学習
- `addition.html`: 一桁の足し算
- `fraction.html`: 分数の足し算・引き算
- `learn.html`: 学習アプリの親ページ
- `index.html`: ブラックホール・ハーベスト
- `kingfisher.html`: カワセミ・ダイブ
- `butterfly.html`: ちょうちょ・フライト
- `meteor.html`: いんせきシューティング
- `race.html`: ミニレース（開発用）
- `tetris.html`: テトリス
- `tetris-drag.html`: テトリス ドラッグベータ

## 遊び方

ローカルでは静的サーバーで配信してください。

```sh
python3 -m http.server 8000
```

その後、以下を開きます。

- `http://localhost:8000/learn.html`
- `http://localhost:8000/hiragana-dakuon.html`
- `http://localhost:8000/katakana.html`
- `http://localhost:8000/math.html`
- `http://localhost:8000/addition.html`
- `http://localhost:8000/fraction.html`
- `http://localhost:8000/`
- `http://localhost:8000/kingfisher.html`
- `http://localhost:8000/butterfly.html`
- `http://localhost:8000/meteor.html`
- `http://localhost:8000/race.html`
- `http://localhost:8000/tetris.html`
- `http://localhost:8000/tetris-drag.html`

## GitHub Pages URL

- 学習メニュー: https://yuzukarappobest-stack.github.io/black-hole-harvest/learn.html
- ひらがな学習: https://yuzukarappobest-stack.github.io/black-hole-harvest/hiragana.html
- ひらがな第二弾（濁音・半濁音・拗音）: https://yuzukarappobest-stack.github.io/black-hole-harvest/hiragana-dakuon.html
- カタカナ学習: https://yuzukarappobest-stack.github.io/black-hole-harvest/katakana.html
- 算数学習: https://yuzukarappobest-stack.github.io/black-hole-harvest/math.html
- 一桁の足し算: https://yuzukarappobest-stack.github.io/black-hole-harvest/addition.html
- 分数の足し算・引き算: https://yuzukarappobest-stack.github.io/black-hole-harvest/fraction.html
- ブラックホール・ハーベスト: https://yuzukarappobest-stack.github.io/black-hole-harvest/
- カワセミ・ダイブ: https://yuzukarappobest-stack.github.io/black-hole-harvest/kingfisher.html
- ちょうちょ・フライト: https://yuzukarappobest-stack.github.io/black-hole-harvest/butterfly.html
- いんせきシューティング: https://yuzukarappobest-stack.github.io/black-hole-harvest/meteor.html
- ミニレース（開発用）: https://yuzukarappobest-stack.github.io/black-hole-harvest/race.html
- テトリス: https://yuzukarappobest-stack.github.io/black-hole-harvest/tetris.html
- テトリス ドラッグベータ: https://yuzukarappobest-stack.github.io/black-hole-harvest/tetris-drag.html

静的ファイルだけで動くため、GitHub Pages の Source を `Deploy from a branch`、Branch を `main`、Folder を `/root` に設定すると公開できます。
