# Fruit Rush

Three.jsで作った、縦画面向けの「スイカゲーム × 3Dランゲーム」MVPです。学習アプリにはまだ組み込んでいません。

## 起動方法

静的サーバーでリポジトリのルートを配信して、`fruit-rush/` を開きます。

```sh
python3 -m http.server 8000
```

`http://localhost:8000/fruit-rush/`

Three.jsはCDNからESモジュールとして読み込みます。npmのインストールやビルドは不要です。

## 操作

- スマホ: 画面を左右にスワイプ / ドラッグ
- PC: 左右矢印、または A / D
- プレイヤーは自動的に前進します。

## 構成

- `index.html`: ゲーム画面とUI
- `style.css`: 縦画面UI
- `src/config.js`: コース・速度・フルーツの調整値
- `src/Game.js`: ゲームループ、衝突、ゴール
- `src/Player.js`: プレイヤーの操作と転がり
- `src/Fruit.js`: フルーツの簡易3Dモデル
- `src/Course.js`: コース、柵、背景
- `src/InputManager.js`: タッチとキーボード操作
- `src/UI.js`: HUD、開始・結果画面
- `src/Audio.js`: Web Audio APIの効果音

## 実装済み

- 長めの直線3Dコース、カメラ追従、柵、背景
- 同じレベルのフルーツに触れると合体・進化・加点
- 自分より小さいフルーツは「JUICY」ボーナスとして回収。5個ごとに磁石を獲得
- 自分より大きいフルーツは一時的に減速する障害物
- 分岐ゲート（レベルアップ、磁石、追加スコア）
- 2.5秒以内の連続合体コンボと、3コンボごとの磁石チャージ
- 磁石ボタンで同レベルのフルーツを5秒間引き寄せる

`src/config.js` の `courseLength`、`spawnCount`、`smallFruitScoreFactor`、
`smallFruitMagnetEvery` を変えると、コースの長さや小さいフルーツの報酬を調整できます。
- サイズ変更、パーティクル、効果音
- START後に鳴るWeb Audio APIの軽快なBGM
- 異なるレベルのフルーツへの軽い押し返し
- ゴール、落下ゲームオーバー、リスタート
- スワイプ・キーボード操作、リサイズ、devicePixelRatio上限

## 主な調整値

`src/config.js` の `forwardSpeed`、`lateralSpeed`、`courseWidth`、`courseLength`、`spawnCount`、`cameraHeight`、`cameraDistance` と、`FRUIT_LEVELS` の半径・得点を変更できます。

## 次に追加しやすい要素

- GLB/GLTFのフルーツモデル
- 曲線コース、障害物、演出
- ハイスコア保存、ステージ選択
- より自然な接触・転がり物理
