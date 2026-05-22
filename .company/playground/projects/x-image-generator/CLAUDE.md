# X Image Generator — プロジェクトルール

## 概要
X（Twitter）発信用の図解画像を HTML + Playwright で生成するプロジェクト。
**HTMLキャンバス（Approach A）のみを使用。** Figmaは不使用。

## ファイル構成
```
x-image-generator/
├── CLAUDE.md                          ← このファイル
├── x-image-design-system-DESIGN.md   ← デザインシステム定義（必ず参照）
├── konkai-transparent.png             ← キャラクター画像（マスター）
├── img_1.jpg 〜 img_4.jpg             ← 参考ポスト画像
├── screenshot.py                      ← Playwright キャプチャスクリプト
├── approach-a-canvas/
│   ├── konkai-transparent.png         ← サーバー用コピー（マスターと常に同期）
│   └── playwright-tips-v2.html        ← 現行テンプレート（新規作成のベース）
└── screenshots/                       ← 生成済み PNG の保存先
```

---

## 制作手順

### Step 0 — 枚数・比率を提案する（必須）

**ポスト文を受け取ったら、HTMLを作る前に必ず枚数と比率を提案する。**

#### 枚数の判断基準

| ポスト内容 | 推奨枚数 |
|-----------|---------|
| 1つのメッセージ・名言・ひとこと図解 | 1枚 |
| Before/Afterの対比・2つの比較 | 2枚 |
| 3つのコツ・3ステップ | 3枚（問題提起＋本題＋まとめ） |
| 4つのコツ・複数ステップ＋まとめ | 4枚（最大） |

- ポイントが4つ以上でも画像は**4枚以内**に収める（読まれなくなるため）
- 迷ったら「問題提起 / 解決策 / 詳細 / まとめ」の4枚構成が安定

#### 比率の判断基準

| 比率 | サイズ | 向いている場面 |
|------|--------|--------------|
| **16:9 横長**（現行） | 1200×675 px | 1〜2枚投稿・テキスト多め・タイムラインで大きく表示される |
| **1:1 正方形** | 1080×1080 px | 3〜4枚投稿・グリッドが均一になって綺麗・インパクト重視 |
| **4:5 縦長** | 1080×1350 px | 縦スクロールで目を引きたい場面（使用頻度低） |

**現在のデフォルト: 16:9（1200×675）**

---

### Step 1 — HTML を作成・更新する
- `playwright-tips-v2.html` をベースにコピーして編集
- 保存先: `approach-a-canvas/[ポスト名].html`
- デザインMD（`x-image-design-system-DESIGN.md`）のルールを守る
- **キャラクター画像を変更した場合は `approach-a-canvas/` にもコピーする**

HTMLを作成・更新したら、必ずこのコマンドを案内する:
```
! python -m http.server 8080 --directory "C:\cc-company\.company\playground\projects\x-image-generator\approach-a-canvas"
```
ブラウザで確認: `http://localhost:8080/[ファイル名].html`
> ⚠️ `file://` での直接オープン不可（Google Fonts・画像・clipboard API が動かない）

---

### Step 2 — Playwright でスクリーンショットを撮る

```
! "C:\Users\konka\AppData\Local\Programs\Python\Python313\python.exe" "C:\cc-company\.company\playground\projects\x-image-generator\screenshot.py"
```

保存先: `screenshots/slide-1.png` 〜

特定のスライドのみ:
```
! "C:\Users\konka\AppData\Local\Programs\Python\Python313\python.exe" "C:\cc-company\.company\playground\projects\x-image-generator\screenshot.py" 1
```

> **注意**: `python` コマンドは browser-use 仮想環境が優先されるため必ず `Python313` の絶対パスで実行する

---

## Next Action（未実装の改善項目）

### 1. 画質改善 — 2x 解像度キャプチャ
現状のスクリーンショットが低画質な原因: `deviceScaleFactor` がデフォルト（1x）のため。

**対応方針: `screenshot.py` に `device_scale_factor=2` を追加する**

```python
# 変更前
page = browser.new_page(viewport={"width": 1200, "height": 675})

# 変更後（2倍の解像度でキャプチャ → 出力は 2400×1350px）
page = browser.new_page(viewport={"width": 1200, "height": 675}, device_scale_factor=2)
```

出力サイズは 2400×1350px になるが、X にアップロードすると最適化されてきれいに表示される。
必要に応じて Pillow で 1200×675 にリサイズしてもよい。

---

### 2. 比率対応 — 正方形（1080×1080）スライドへの切り替え
3〜4枚投稿時は正方形の方がタイムライン上のグリッドが均一でかっこよく見える。

**対応方針: HTML の `--slide-w / --slide-h` をパラメータ化する**
- CSS 変数でサイズを管理し、`?ratio=square` などのクエリで切り替えられるようにする
- または HTML を別ファイル（`*-square.html`）として用意する

---

### 3. 枚数の自動提案フロー（運用ルール）
ポスト文を受け取ったら、HTML着手前に必ず:
1. **何枚構成が適切か** を提案（上記の基準を使う）
2. **比率（16:9 or 1:1）** を提案
3. こんちゃんが承認してから HTML 制作を開始する
